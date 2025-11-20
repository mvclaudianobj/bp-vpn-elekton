const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsAsync = require('fs').promises;
const os = require('os');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const { PublicClientApplication } = require('@azure/msal-node');
const { dialog } = require('electron');

let mainWindow;
let pca;
let config;
let vpnProcess = null;

// Caminhos dos arquivos
const cachePath = path.join(os.tmpdir(), 'electron_token_cache.json');
const authPath = path.join(os.tmpdir(), 'openvpn_auth.txt');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 650,  // Aumentei de 500 para 800
    height: 700, // Mantive a altura
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'BluePex VPN Connections',
    autoHideMenuBar: true,
    resizable: true, // Permitir redimensionamento
    center: true, // Centralizar na tela
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    if (vpnProcess) {
      vpnProcess.kill();
      console.log("VPN desconectada automaticamente ao fechar a janela.");
    }
  });
}

app.whenReady().then(async () => {
  try {
    config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
  } catch (error) {
    console.error('Erro ao carregar config.json:', error);
    // Criar config padrão se não existir
    config = {
      client_id: "",
      tenant_id: "",
      scope: "https://graph.microsoft.com/.default",
      server_api: "",
      openvpn_config: ""
    };
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  }

  pca = new PublicClientApplication({
    auth: {
      clientId: config.client_id,
      authority: `https://login.microsoftonline.com/${config.tenant_id}`,
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============ FUNÇÕES AUXILIARES ============

async function fileExists(filePath) {
  try {
    await fsAsync.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadOvnFromProfile(profileId) {
  // Primeiro tentar no diretório de perfis normais
  const ovpnDir = path.join(__dirname, 'ovpn_profiles');
  const profileDir = path.join(ovpnDir, profileId);
  const ovpnFilePath = path.join(profileDir, `${profileId}.ovpn`);
  
  console.log(`🔍 Procurando arquivo OVPN para perfil: ${profileId}`);
  console.log(`📁 Caminho procurado: ${ovpnFilePath}`);
  
  try {
    if (await fileExists(ovpnFilePath)) {
      const content = await fsAsync.readFile(ovpnFilePath, 'utf-8');
      console.log(`✅ Arquivo OVPN encontrado: ${ovpnFilePath}`);
      return { 
        success: true, 
        content: content, 
        path: ovpnFilePath,
        profileDir: profileDir 
      };
    }
    
    // Se não encontrou no diretório normal, tentar no diretório Azure
    const azureOvpnDir = path.join(__dirname, 'azure_ovpn_profiles');
    const azureProfileDir = path.join(azureOvpnDir, profileId);
    const azureOvpnFilePath = path.join(azureProfileDir, `${profileId}.ovpn`);
    
    console.log(`🔍 Tentando diretório Azure: ${azureOvpnFilePath}`);
    
    if (await fileExists(azureOvpnFilePath)) {
      const content = await fsAsync.readFile(azureOvpnFilePath, 'utf-8');
      console.log(`✅ Arquivo OVPN Azure encontrado: ${azureOvpnFilePath}`);
      return { 
        success: true, 
        content: content, 
        path: azureOvpnFilePath,
        profileDir: azureProfileDir 
      };
    }
    
    console.log(`❌ Arquivo OVPN não encontrado em nenhum diretório para perfil: ${profileId}`);
    return { success: false, error: `Arquivo OVPN não encontrado para o perfil ${profileId}` };
    
  } catch (error) {
    console.error(`❌ Erro ao carregar OVPN do perfil ${profileId}:`, error);
    return { success: false, error: error.message };
  }
}

// ============ GESTÃO DE ARQUIVOS OVPN ============

// Função: Processar e copiar TODOS os arquivos do perfil OVPN
async function processAndCopyOvpnFiles(originalOvpnPath, profileId, baseDir = null) {
  const defaultOvpnDir = path.join(__dirname, 'ovpn_profiles');
  const ovpnDir = baseDir || defaultOvpnDir;
  const profileDir = path.join(ovpnDir, profileId);
  
  try {
    // Criar diretório do perfil
    await fsAsync.mkdir(profileDir, { recursive: true });
    
    // Ler conteúdo original do OVPN
    const originalContent = await fsAsync.readFile(originalOvpnPath, 'utf-8');
    const originalDir = path.dirname(originalOvpnPath);
    
    // Processar cada linha do OVPN
    const processedLines = [];
    const filesToCopy = new Set();
    
    const lines = originalContent.split('\n');
    for (let line of lines) {
      let processedLine = line.trim();
      
      // Ignorar linhas de autenticação que vamos adicionar depois
      if (processedLine.startsWith('auth-user-pass')) {
        continue;
      }
      
      // Identificar e processar arquivos de certificado
      if (processedLine.startsWith('ca ') || processedLine.startsWith('cert ') || 
          processedLine.startsWith('key ') || processedLine.startsWith('tls-auth ') ||
          processedLine.startsWith('pkcs12 ') || processedLine.startsWith('dh ') ||
          processedLine.startsWith('crl-verify ')) {
        
        const parts = processedLine.split(' ');
        if (parts.length >= 2) {
          const originalFilePath = parts[1].trim();
          let absoluteSourcePath;
          
          // Determinar caminho absoluto do arquivo
          if (path.isAbsolute(originalFilePath)) {
            absoluteSourcePath = originalFilePath;
          } else {
            absoluteSourcePath = path.join(originalDir, originalFilePath);
          }
          
          // Verificar se arquivo existe
          if (await fileExists(absoluteSourcePath)) {
            const fileName = path.basename(absoluteSourcePath);
            const targetFilePath = path.join(profileDir, fileName);
            
            // Adicionar à lista de arquivos para copiar
            filesToCopy.add({ source: absoluteSourcePath, target: targetFilePath });
            
            // Atualizar linha com novo caminho relativo
            processedLine = `${parts[0]} ${fileName}`;
            console.log(`Arquivo processado: ${fileName}`);
          } else {
            console.warn(`Arquivo não encontrado: ${absoluteSourcePath}`);
          }
        }
      }
      
      processedLines.push(processedLine);
    }
    
    // Copiar todos os arquivos identificados
    for (let file of filesToCopy) {
      try {
        await fsAsync.copyFile(file.source, file.target);
        console.log(`✅ Arquivo copiado: ${path.basename(file.source)}`);
      } catch (copyError) {
        console.error(`❌ Erro ao copiar ${file.source}:`, copyError);
      }
    }
    
    // Salvar arquivo OVPN processado
    const processedContent = processedLines.join('\n');
    const targetOvpnPath = path.join(profileDir, `${profileId}.ovpn`);
    await fsAsync.writeFile(targetOvpnPath, processedContent, 'utf-8');
    
    return { 
      success: true, 
      content: processedContent,
      profileDir: profileDir,
      filesCopied: filesToCopy.size
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ CONEXÕES VPN ============

// ============ FUNÇÃO AUXILIAR PARA DETECTAR SYSTEMD CHALLENGE ============
function detectSystemdChallenge(output) {
  return output.includes('Enter Google Authenticator Token') || 
         output.includes('CHALLENGE:') ||
         output.includes('static-challenge');
}

// Conexão OpenVPN com usuário/senha usando perfil
ipcMain.handle('connect-openvpn-userpass-profile', async (event, profileId, username, password) => {
  return new Promise(async (resolve, reject) => {
    let authFilePath = null;
    
    try {
      console.log(`🔗 Iniciando conexão para perfil: ${profileId}`);
      
      const ovpnResult = await loadOvnFromProfile(profileId);
      if (!ovpnResult.success) {
        console.error(`❌ Erro ao carregar perfil: ${ovpnResult.error}`);
        reject(new Error(ovpnResult.error));
        return;
      }

      const profileDir = ovpnResult.profileDir;
      const configPath = ovpnResult.path;

      console.log(`📁 Diretório do perfil: ${profileDir}`);
      console.log(`📄 Configuração: ${configPath}`);

      if (!fs.existsSync(configPath)) {
        const errorMsg = `Arquivo de configuração não encontrado: ${configPath}`;
        console.error(`❌ ${errorMsg}`);
        reject(new Error(errorMsg));
        return;
      }

      if (!fs.existsSync(profileDir)) {
        const errorMsg = `Diretório do perfil não encontrado: ${profileDir}`;
        console.error(`❌ ${errorMsg}`);
        reject(new Error(errorMsg));
        return;
      }

      // CORREÇÃO: Criar arquivo temporário para auth com permissões seguras
      authFilePath = path.join(os.tmpdir(), `openvpn_auth_${Date.now()}.txt`);
      fs.writeFileSync(authFilePath, `${username}\n${password}\n`);
      
      // Definir permissões seguras (apenas usuário atual)
      if (process.platform !== 'win32') {
        fs.chmodSync(authFilePath, 0o600);
        // Também definir o proprietário correto
        try {
          const { uid, gid } = fs.statSync(authFilePath);
          console.log(`📁 Arquivo de auth criado com proprietário: ${uid}:${gid}`);
        } catch (e) {
          console.log('⚠️ Não foi possível verificar proprietário do arquivo:', e.message);
        }
      }

      console.log(`🔐 Arquivo de autenticação criado: ${authFilePath}`);

      // Método CORRIGIDO: usar arquivo temporário
      const openvpnArgs = [
        '--config', configPath,
        '--auth-user-pass', authFilePath,
        '--auth-retry', 'interact'
      ];

      console.log('🔐 Executando OpenVPN...');
      
      let openvpnCommand;
      let openvpnArgsFinal;
      
      if (process.platform !== 'win32') {
        // CORREÇÃO: Usar sudo para garantir permissões adequadas
        openvpnCommand = 'sudo';
        openvpnArgsFinal = ['openvpn', ...openvpnArgs];
        console.log('🔐 Executando OpenVPN com sudo para permissões adequadas');
      } else {
        const openvpnPath = 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe';
        openvpnCommand = openvpnPath;
        openvpnArgsFinal = openvpnArgs;
      }

      // CORREÇÃO: Executar com stdio configurado para interação
      vpnProcess = spawn(openvpnCommand, openvpnArgsFinal, {
        cwd: profileDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let connectionEstablished = false;
      let challengeDetected = false;
      let challengeTimeout;
      let sudoPasswordSent = false;

      // Handler para resposta de desafio
      const challengeHandler = (event, response) => {
        console.log('📤 Recebida resposta para desafio:', response);
        if (vpnProcess && !vpnProcess.killed) {
          vpnProcess.stdin.write(response + '\n');
          challengeDetected = false;
          if (challengeTimeout) clearTimeout(challengeTimeout);
        }
      };

      // Registrar handler para resposta de desafio
      ipcMain.once('send-challenge-response', challengeHandler);

      // CORREÇÃO: Handler para senha do sudo (se necessário)
      const sudoPasswordHandler = (event, password) => {
        console.log('📤 Recebida senha do sudo');
        if (vpnProcess && !vpnProcess.killed && !sudoPasswordSent) {
          vpnProcess.stdin.write(password + '\n');
          sudoPasswordSent = true;
        }
      };

      // Registrar handler para senha do sudo
      ipcMain.once('send-sudo-password', sudoPasswordHandler);

      // CORREÇÃO: stdout e stderr separados corretamente
      vpnProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('OpenVPN stdout:', output);
        mainWindow.webContents.send('vpn-log', output);
        
        if (output.includes('Initialization Sequence Completed')) {
          connectionEstablished = true;
          console.log(`✅ Conexão estabelecida com sucesso! PID: ${vpnProcess.pid}`);
          ipcMain.removeAllListeners('send-challenge-response');
          ipcMain.removeAllListeners('send-sudo-password');
          
          // Limpar arquivo de auth após conexão bem-sucedida
          if (authFilePath && fs.existsSync(authFilePath)) {
            fs.unlinkSync(authFilePath);
          }
          
          resolve({ 
            pid: vpnProcess.pid, 
            success: true,
            message: 'Conexão estabelecida com sucesso'
          });
        }
      
        if (output.includes('AUTH_FAILED') || output.includes('auth-failure')) {
          console.error(`❌ Falha na autenticação`);
          ipcMain.removeAllListeners('send-challenge-response');
          ipcMain.removeAllListeners('send-sudo-password');
          reject(new Error('Falha na autenticação: usuário, senha ou token incorretos'));
        }
      
        // Detectar static challenge
        if ((output.includes('CHALLENGE:') || output.includes('Enter Google Authenticator Token')) && !challengeDetected) {
          console.log('🔐 Static challenge detectado!');
          challengeDetected = true;
          
          let challengeMessage = 'Enter Google Authenticator Token';
          const challengeMatch = output.match(/CHALLENGE:\s*([^\n\r]+)/);
          if (challengeMatch && challengeMatch[1]) {
            challengeMessage = challengeMatch[1].trim();
          }
          
          console.log('📢 Enviando challenge para frontend:', challengeMessage);
          
          // Enviar para frontend solicitar token
          mainWindow.webContents.send('vpn-challenge', {
            type: 'static-challenge',
            message: challengeMessage,
            requiresInput: true
          });

          // Timeout para resposta do challenge
          challengeTimeout = setTimeout(() => {
            if (challengeDetected) {
              console.error('❌ Timeout no desafio 2FA');
              ipcMain.removeAllListeners('send-challenge-response');
              ipcMain.removeAllListeners('send-sudo-password');
              reject(new Error('Timeout: Token 2FA não foi fornecido a tempo'));
            }
          }, 120000);
        }

        // Detectar systemd password prompts
        if (detectSystemdChallenge(output) && !challengeDetected) {
          console.log('🔐 Systemd password challenge detectado!');
          challengeDetected = true;
          
          mainWindow.webContents.send('vpn-challenge', {
            type: 'systemd-challenge',
            message: 'Enter Google Authenticator Token',
            requiresInput: true,
            systemdPrompt: true
          });
        }

        // CORREÇÃO: Detectar prompt de senha do sudo
        if (output.includes('[sudo] password for') && !sudoPasswordSent) {
          console.log('🔐 Solicitação de senha do sudo detectada');
          mainWindow.webContents.send('vpn-challenge', {
            type: 'sudo-password',
            message: 'Digite sua senha de administrador para executar o OpenVPN',
            requiresInput: true,
            isSudoPrompt: true
          });
        }
      });

      // CORREÇÃO: stderr separado do stdout
      vpnProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('OpenVPN stderr:', error);
        mainWindow.webContents.send('vpn-log', `ERRO: ${error}`);
        
        if (error.includes('AUTH_FAILED') || error.includes('auth-failure')) {
          console.error(`❌ Falha na autenticação`);
          ipcMain.removeAllListeners('send-challenge-response');
          ipcMain.removeAllListeners('send-sudo-password');
          reject(new Error('Falha na autenticação: usuário, senha ou token incorretos'));
        }

        // Detectar static challenge no stderr também
        if ((error.includes('CHALLENGE:') || error.includes('Enter Google Authenticator Token')) && !challengeDetected) {
          console.log('🔐 Static challenge detectado no stderr!');
          challengeDetected = true;
          
          let challengeMessage = 'Enter Google Authenticator Token';
          const challengeMatch = error.match(/CHALLENGE:\s*([^\n\r]+)/);
          if (challengeMatch && challengeMatch[1]) {
            challengeMessage = challengeMatch[1].trim();
          }
          
          console.log('📢 Enviando challenge do stderr para frontend:', challengeMessage);
          
          mainWindow.webContents.send('vpn-challenge', {
            type: 'static-challenge',
            message: challengeMessage,
            requiresInput: true
          });

          challengeTimeout = setTimeout(() => {
            if (challengeDetected) {
              console.error('❌ Timeout no desafio 2FA');
              ipcMain.removeAllListeners('send-challenge-response');
              ipcMain.removeAllListeners('send-sudo-password');
              reject(new Error('Timeout: Token 2FA não foi fornecido a tempo'));
            }
          }, 120000);
        }
        
        if (error.includes('Failed to query password') || error.includes('Permission denied')) {
          console.error(`❌ Erro de permissão no arquivo de autenticação`);
          ipcMain.removeAllListeners('send-challenge-response');
          ipcMain.removeAllListeners('send-sudo-password');
          reject(new Error('Erro de permissão. O OpenVPN não pode acessar o arquivo de autenticação.'));
        }
        
        if (error.includes('No such file or directory')) {
          const fileMatch = error.match(/fails with '([^']+)'/);
          if (fileMatch) {
            const errorMsg = `Arquivo não encontrado: ${fileMatch[1]}. Certifique-se de que todos os arquivos de certificado estão no diretório do perfil.`;
            console.error(`❌ ${errorMsg}`);
            ipcMain.removeAllListeners('send-challenge-response');
            ipcMain.removeAllListeners('send-sudo-password');
            reject(new Error(errorMsg));
          }
        }
      });

      vpnProcess.on('close', (code) => {
        console.log(`OpenVPN encerrado com código ${code}`);
        vpnProcess = null;
        ipcMain.removeAllListeners('send-challenge-response');
        ipcMain.removeAllListeners('send-sudo-password');
        mainWindow.webContents.send('vpn-disconnected');
        
        if (challengeTimeout) clearTimeout(challengeTimeout);
        
        // CORREÇÃO: Limpar arquivo de auth ao fechar
        try {
          if (authFilePath && fs.existsSync(authFilePath)) {
            fs.unlinkSync(authFilePath);
            console.log(`🧹 Arquivo de autenticação removido: ${authFilePath}`);
          }
        } catch (e) {
          console.log('Erro ao limpar arquivo de auth:', e.message);
        }
      });

      vpnProcess.on('error', (error) => {
        console.error('❌ Erro ao executar OpenVPN:', error);
        ipcMain.removeAllListeners('send-challenge-response');
        ipcMain.removeAllListeners('send-sudo-password');
        
        // Limpar arquivo de auth em caso de erro
        try {
          if (authFilePath && fs.existsSync(authFilePath)) {
            fs.unlinkSync(authFilePath);
          }
        } catch (e) {
          console.log('Erro ao limpar arquivo de auth:', e.message);
        }
        
        if (error.code === 'ENOENT') {
          reject(new Error('OpenVPN não encontrado. Certifique-se de que o OpenVPN está instalado.'));
        } else {
          reject(new Error(`Erro ao executar OpenVPN: ${error.message}`));
        }
      });

      setTimeout(() => {
        if (!connectionEstablished && vpnProcess && !vpnProcess.killed && !challengeDetected) {
          const errorMsg = 'Timeout na conexão OpenVPN';
          console.error(`❌ ${errorMsg}`);
          ipcMain.removeAllListeners('send-challenge-response');
          ipcMain.removeAllListeners('send-sudo-password');
          
          // Limpar arquivo de auth em caso de timeout
          try {
            if (authFilePath && fs.existsSync(authFilePath)) {
              fs.unlinkSync(authFilePath);
            }
          } catch (e) {
            console.log('Erro ao limpar arquivo de auth:', e.message);
          }
          
          reject(new Error(errorMsg));
        }
      }, 60000);

    } catch (error) {
      console.error(`❌ Erro na conexão:`, error);
      ipcMain.removeAllListeners('send-challenge-response');
      ipcMain.removeAllListeners('send-sudo-password');
      
      // Limpar arquivo de auth em caso de erro geral
      try {
        if (authFilePath && fs.existsSync(authFilePath)) {
          fs.unlinkSync(authFilePath);
        }
      } catch (e) {
        console.log('Erro ao limpar arquivo de auth:', e.message);
      }
      
      reject(error);
    }
  });
});

// Nova função para enviar resposta de desafio
ipcMain.handle('send-challenge-response', async (event, response) => {
  if (vpnProcess && !vpnProcess.killed) {
    vpnProcess.stdin.write(response + '\n');
    return { success: true };
  }
  return { success: false, error: 'Processo VPN não encontrado' };
});

// Handler para senha do sudo
ipcMain.handle('send-sudo-password', async (event, password) => {
  if (vpnProcess && !vpnProcess.killed) {
    vpnProcess.stdin.write(password + '\n');
    return { success: true };
  }
  return { success: false, error: 'Processo VPN não encontrado' };
});


// ============ GESTÃO DE PERFIS USUÁRIO ============

// Selecionar arquivo OVPN
ipcMain.handle('select-ovpn-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar arquivo de configuração OpenVPN',
    filters: [
      { name: 'Arquivos OpenVPN', extensions: ['ovpn', 'conf'] },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = await fsAsync.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath, '.ovpn');
      
      return {
        success: true,
        filePath: filePath,
        fileName: fileName,
        content: content
      };
    } catch (error) {
      return {
        success: false,
        error: `Erro ao ler arquivo: ${error.message}`
      };
    }
  }
  
  return { success: false, error: 'Nenhum arquivo selecionado' };
});

// No main.js, adicione esta função se não existir
ipcMain.handle('send-systemd-challenge-response', async (event, response) => {
  if (vpnProcess && !vpnProcess.killed) {
    vpnProcess.stdin.write(response + '\n');
    return { success: true };
  }
  return { success: false, error: 'Processo VPN não encontrado' };
});

// Salvar OVPN no perfil (COPIA TODOS OS ARQUIVOS)
ipcMain.handle('save-ovpn-to-profile', async (event, profileId, ovpnContent, ovpnFileName, originalOvpnPath) => {
  const profilesPath = path.join(__dirname, 'user_profiles.json');
  
  try {
    // Processar e copiar TODOS os arquivos do perfil
    const processResult = await processAndCopyOvpnFiles(originalOvpnPath, profileId);
    if (!processResult.success) {
      return { success: false, error: processResult.error };
    }

    console.log(`✅ Perfil salvo: ${profileId}`);
    console.log(`📁 Diretório: ${processResult.profileDir}`);
    console.log(`📄 Arquivos copiados: ${processResult.filesCopied}`);

    // Atualizar perfil no arquivo de perfis
    let profiles = [];
    if (await fileExists(profilesPath)) {
      const data = await fsAsync.readFile(profilesPath, 'utf-8');
      profiles = JSON.parse(data);
    }
    
    const profileIndex = profiles.findIndex(p => p.id === profileId);
    if (profileIndex >= 0) {
      profiles[profileIndex].ovpnFile = path.join(processResult.profileDir, `${profileId}.ovpn`);
      profiles[profileIndex].ovpnFileName = ovpnFileName;
      profiles[profileIndex].profileDir = processResult.profileDir;
      profiles[profileIndex].updatedAt = new Date().toISOString();
    }
    
    await fsAsync.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
    return { 
      success: true,
      profileDir: processResult.profileDir,
      filesCopied: processResult.filesCopied
    };
    
  } catch (error) {
    console.error('Erro ao salvar perfil:', error);
    return { success: false, error: error.message };
  }
});

// Carregar perfis salvos
ipcMain.handle('load-user-profiles', async () => {
  const profilesPath = path.join(__dirname, 'user_profiles.json');
  try {
    if (await fileExists(profilesPath)) {
      const profiles = JSON.parse(await fsAsync.readFile(profilesPath, 'utf-8'));
      return { success: true, profiles };
    }
    return { success: true, profiles: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Salvar perfil de usuário
ipcMain.handle('save-user-profile', async (event, profile) => {
  const profilesPath = path.join(__dirname, 'user_profiles.json');
  try {
    let profiles = [];
    
    if (await fileExists(profilesPath)) {
      profiles = JSON.parse(await fsAsync.readFile(profilesPath, 'utf-8'));
    }
    
    const existingIndex = profiles.findIndex(p => p.id === profile.id);
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    
    await fsAsync.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Excluir perfil de usuário
ipcMain.handle('delete-user-profile', async (event, profileId) => {
  const profilesPath = path.join(__dirname, 'user_profiles.json');
  const profileDir = path.join(__dirname, 'ovpn_profiles', profileId);
  
  try {
    // Remover diretório do perfil com todos os arquivos
    if (await fileExists(profileDir)) {
      await fsAsync.rm(profileDir, { recursive: true, force: true });
    }
    
    // Remover do arquivo de perfis
    if (await fileExists(profilesPath)) {
      let profiles = JSON.parse(await fsAsync.readFile(profilesPath, 'utf-8'));
      profiles = profiles.filter(p => p.id !== profileId);
      await fsAsync.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============ GESTÃO DE CREDENCIAIS SEGURAS ============

// Salvar credenciais de forma segura
ipcMain.handle('save-user-credentials', async (event, profileId, username, password, rememberPassword) => {
  const credentialsPath = path.join(__dirname, 'user_credentials.json');
  
  try {
    let credentials = {};
    
    if (await fileExists(credentialsPath)) {
      credentials = JSON.parse(await fsAsync.readFile(credentialsPath, 'utf-8'));
    }
    
    // Criptografar a senha (simples base64 para exemplo - em produção use crypto)
    const encryptedPassword = rememberPassword ? Buffer.from(password).toString('base64') : '';
    
    credentials[profileId] = {
      username: username,
      password: encryptedPassword,
      rememberPassword: rememberPassword,
      updatedAt: new Date().toISOString()
    };
    
    await fsAsync.writeFile(credentialsPath, JSON.stringify(credentials, null, 2));
    return { success: true };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Carregar credenciais salvas
ipcMain.handle('load-user-credentials', async (event, profileId) => {
  const credentialsPath = path.join(__dirname, 'user_credentials.json');
  
  try {
    if (await fileExists(credentialsPath)) {
      const credentials = JSON.parse(await fsAsync.readFile(credentialsPath, 'utf-8'));
      if (credentials[profileId]) {
        // Descriptografar a senha
        const creds = credentials[profileId];
        if (creds.rememberPassword && creds.password) {
          creds.password = Buffer.from(creds.password, 'base64').toString('utf-8');
        } else {
          creds.password = '';
        }
        return { success: true, credentials: creds };
      }
    }
    return { success: true, credentials: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============ DETECÇÃO DE 2FA ============

// Verificar se a configuração OVPN requer 2FA
ipcMain.handle('detect-2fa-requirement', async (event, profileId) => {
  try {
    const ovpnResult = await loadOvnFromProfile(profileId);
    if (!ovpnResult.success) {
      return { success: false, error: ovpnResult.error };
    }

    const ovpnContent = ovpnResult.content;
    
    // Procurar especificamente por static-challenge (padrão OpenVPN para 2FA)
    const staticChallengeMatch = ovpnContent.match(/static-challenge\s+"([^"]+)"\s+(\d)/gi);
    const hasStaticChallenge = staticChallengeMatch && staticChallengeMatch.length > 0;
    
    // Extrair o texto do prompt se existir
    let promptText = '';
    if (hasStaticChallenge) {
      const promptMatch = ovpnContent.match(/static-challenge\s+"([^"]+)"/i);
      if (promptMatch && promptMatch[1]) {
        promptText = promptMatch[1];
      }
    }

    // Verificar se usa auth-user-pass (pré-requisito para static-challenge)
    const usesAuthUserPass = /auth-user-pass/gi.test(ovpnContent);

    return { 
      success: true, 
      requires2FA: hasStaticChallenge && usesAuthUserPass,
      hasStaticChallenge: hasStaticChallenge,
      staticChallengeMatches: staticChallengeMatch,
      promptText: promptText,
      usesEcho: ovpnContent.includes('static-challenge') && ovpnContent.includes(' 1')
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============ GESTÃO DE CONFIGURAÇÕES AZURE AD ============

// Salvar configuração Azure AD
ipcMain.handle('save-azure-config', async (event, profileId, ovpnContent, ovpnFileName, originalOvpnPath) => {
  const azureProfilesPath = path.join(__dirname, 'azure_profiles.json');
  const azureOvpnDir = path.join(__dirname, 'azure_ovpn_profiles');
  
  try {
    // Processar e copiar TODOS os arquivos do perfil Azure
    const processResult = await processAndCopyOvpnFiles(originalOvpnPath, profileId, azureOvpnDir);
    if (!processResult.success) {
      return { success: false, error: processResult.error };
    }

    console.log(`✅ Perfil Azure salvo: ${profileId}`);
    console.log(`📁 Diretório Azure: ${processResult.profileDir}`);

    // Atualizar perfil Azure no arquivo de perfis
    let azureProfiles = [];
    if (await fileExists(azureProfilesPath)) {
      const data = await fsAsync.readFile(azureProfilesPath, 'utf-8');
      azureProfiles = JSON.parse(data);
    }
    
    const profileIndex = azureProfiles.findIndex(p => p.id === profileId);
    if (profileIndex >= 0) {
      azureProfiles[profileIndex].ovpnFile = path.join(processResult.profileDir, `${profileId}.ovpn`);
      azureProfiles[profileIndex].ovpnFileName = ovpnFileName;
      azureProfiles[profileIndex].profileDir = processResult.profileDir;
      azureProfiles[profileIndex].updatedAt = new Date().toISOString();
    } else {
      azureProfiles.push({
        id: profileId,
        name: `Azure ${ovpnFileName}`,
        ovpnFile: path.join(processResult.profileDir, `${profileId}.ovpn`),
        ovpnFileName: ovpnFileName,
        profileDir: processResult.profileDir,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    await fsAsync.writeFile(azureProfilesPath, JSON.stringify(azureProfiles, null, 2));
    
    // Atualizar também o config.json principal se for o perfil ativo
    config.openvpn_config = path.join(processResult.profileDir, `${profileId}.ovpn`);
    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    
    return { 
      success: true,
      profileDir: processResult.profileDir,
      filesCopied: processResult.filesCopied
    };
    
  } catch (error) {
    console.error('Erro ao salvar perfil Azure:', error);
    return { success: false, error: error.message };
  }
});

// ============ GESTÃO DE CONFIGURAÇÕES PADRÃO ============

// Salvar configurações padrão
ipcMain.handle('save-default-profiles', async (event, defaultProfiles) => {
  const defaultsPath = path.join(__dirname, 'default_profiles.json');
  try {
    await fsAsync.writeFile(defaultsPath, JSON.stringify(defaultProfiles, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Carregar configurações padrão
ipcMain.handle('load-default-profiles', async () => {
  const defaultsPath = path.join(__dirname, 'default_profiles.json');
  try {
    if (await fileExists(defaultsPath)) {
      const defaults = JSON.parse(await fsAsync.readFile(defaultsPath, 'utf-8'));
      return { success: true, defaults };
    }
    return { success: true, defaults: {} };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Salvar estado da aplicação
ipcMain.handle('save-app-state', async (event, appState) => {
  const statePath = path.join(__dirname, 'app_state.json');
  try {
    await fsAsync.writeFile(statePath, JSON.stringify(appState, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Carregar estado da aplicação
ipcMain.handle('load-app-state', async () => {
  const statePath = path.join(__dirname, 'app_state.json');
  try {
    if (await fileExists(statePath)) {
      const state = JSON.parse(await fsAsync.readFile(statePath, 'utf-8'));
      return { success: true, state };
    }
    return { success: true, state: {} };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Carregar perfis Azure
ipcMain.handle('load-azure-profiles', async () => {
  const azureProfilesPath = path.join(__dirname, 'azure_profiles.json');
  try {
    if (await fileExists(azureProfilesPath)) {
      const profiles = JSON.parse(await fsAsync.readFile(azureProfilesPath, 'utf-8'));
      return { success: true, profiles };
    }
    return { success: true, profiles: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Salvar perfil Azure
ipcMain.handle('save-azure-profile', async (event, profile) => {
  const azureProfilesPath = path.join(__dirname, 'azure_profiles.json');
  try {
    let profiles = [];
    
    if (await fileExists(azureProfilesPath)) {
      profiles = JSON.parse(await fsAsync.readFile(azureProfilesPath, 'utf-8'));
    }
    
    const existingIndex = profiles.findIndex(p => p.id === profile.id);
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    
    await fsAsync.writeFile(azureProfilesPath, JSON.stringify(profiles, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Excluir perfil Azure
ipcMain.handle('delete-azure-profile', async (event, profileId) => {
  const azureProfilesPath = path.join(__dirname, 'azure_profiles.json');
  const profileDir = path.join(__dirname, 'azure_ovpn_profiles', profileId);
  
  try {
    // Remover diretório do perfil Azure
    if (await fileExists(profileDir)) {
      await fsAsync.rm(profileDir, { recursive: true, force: true });
    }
    
    // Remover do arquivo de perfis Azure
    if (await fileExists(azureProfilesPath)) {
      let profiles = JSON.parse(await fsAsync.readFile(azureProfilesPath, 'utf-8'));
      profiles = profiles.filter(p => p.id !== profileId);
      await fsAsync.writeFile(azureProfilesPath, JSON.stringify(profiles, null, 2));
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============ FUNÇÕES AZURE EXISTENTES ============

ipcMain.handle('login-azure', async () => {
  const request = {
    scopes: config.scope.split(' '),
    deviceCodeCallback: (deviceCodeResponse) => {
      const messageData = {
        verification_uri: deviceCodeResponse.verificationUri,
        user_code: deviceCodeResponse.userCode,
      };
      mainWindow.webContents.send('device-code-response', messageData);
      shell.openExternal(deviceCodeResponse.verificationUri);
    }
  };

  try {
    const response = await pca.acquireTokenByDeviceCode(request);
    const { accessToken, account } = response;

    const cache = {
      access_token: accessToken,
      username: account.username,
      expires_at: new Date(Date.now() + response.expiresOn * 1000).toISOString()
    };
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));

    return { token: accessToken, username: account.username };
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('publish-token', async (event, username, token) => {
  try {
    await axios.post(config.server_api, { username, jwt_token: token });
    return { success: true };
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
});

ipcMain.handle('connect-openvpn', async () => {
  let cache;
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch (err) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }

  const shortID = cache.access_token.substring(0, 16);
  fs.writeFileSync(authPath, `user\n${shortID}`, 'utf-8');

  let openvpnArgs = ['--config', config.openvpn_config, '--auth-user-pass', authPath];

  if (process.platform === 'win32') {
    const openvpnPath = 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe';
    vpnProcess = spawn(openvpnPath, openvpnArgs);
  } else {
    vpnProcess = spawn('sudo', ['openvpn', ...openvpnArgs]);
  }

  vpnProcess.stdout.on('data', (data) => console.log(data.toString()));
  vpnProcess.stderr.on('data', (data) => console.error(data.toString()));

  vpnProcess.on('close', (code) => {
    console.log(`OpenVPN encerrado com código ${code}`);
    vpnProcess = null;
    mainWindow.webContents.send('vpn-disconnected');
  });

  return { pid: vpnProcess.pid, shortID };
});

ipcMain.handle('disconnect-openvpn', async (event, pid) => {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      exec(`taskkill /PID ${pid} /F`, (error) => {
        if (error) {
          reject(new Error(`Falha ao desconectar: ${error.message}`));
        } else {
          if (vpnProcess && vpnProcess.pid === pid) {
            vpnProcess.kill();
            vpnProcess = null;
          }
          resolve({ success: true });
        }
      });
    } else {
      exec(`sudo kill ${pid}`, (error) => {
        if (error) {
          reject(new Error(`Falha ao desconectar: ${error.message}`));
        } else {
          if (vpnProcess && vpnProcess.pid === pid) {
            vpnProcess.kill();
            vpnProcess = null;
          }
          resolve({ success: true });
        }
      });
    }
  });
});

// ============ FUNÇÕES AUXILIARES ============

ipcMain.handle('validate-openvpn-config', async () => {
  return new Promise((resolve) => {
    if (!fs.existsSync(config.openvpn_config)) {
      resolve({ valid: false, error: 'Arquivo de configuração OpenVPN não encontrado' });
      return;
    }
    
    const checkCommand = process.platform === 'win32' 
      ? 'where openvpn' 
      : 'which openvpn';
    
    exec(checkCommand, (error) => {
      if (error) {
        resolve({ 
          valid: false, 
          error: 'OpenVPN não encontrado. Instale o OpenVPN primeiro.' 
        });
      } else {
        resolve({ valid: true });
      }
    });
  });
});

ipcMain.handle('get-current-config', async () => {
  return { 
    success: true, 
    config: {
      userOvpnFile: null,
      azureOvpnFile: config.openvpn_config,
      azureOvpnFileName: path.basename(config.openvpn_config, '.ovpn')
    }
  };
});
