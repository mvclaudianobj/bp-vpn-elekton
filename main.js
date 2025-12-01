// ============ CONFIGURAÇÃO DE DIRETÓRIOS ============

// ✅ Usar diretório de dados do usuário (leitura/escrita permitida)
const USER_DATA_DIR = app.getPath('userData');
const PROFILES_DIR = path.join(USER_DATA_DIR, 'ovpn_profiles');
const AZURE_PROFILES_DIR = path.join(USER_DATA_DIR, 'azure_ovpn_profiles');

// Arquivos de configuração
const USER_PROFILES_PATH = path.join(USER_DATA_DIR, 'user_profiles.json');
const AZURE_PROFILES_PATH = path.join(USER_DATA_DIR, 'azure_profiles.json');
const DEFAULT_PROFILES_PATH = path.join(USER_DATA_DIR, 'default_profiles.json');
const APP_STATE_PATH = path.join(USER_DATA_DIR, 'app_state.json');
const USER_CREDENTIALS_PATH = path.join(USER_DATA_DIR, 'user_credentials.json');
const CONFIG_PATH = path.join(USER_DATA_DIR, 'config.json');

// Criar diretórios necessários
function ensureDirectories() {
  const dirs = [USER_DATA_DIR, PROFILES_DIR, AZURE_PROFILES_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Diretório criado: ${dir}`);
    }
  }
  console.log(`📁 Diretório de perfis: ${PROFILES_DIR}`);
  console.log(`📁 Diretório de perfis Azure: ${AZURE_PROFILES_DIR}`);
}

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

// Função para copiar a política para o local correto (se necessário)
function ensurePolicyFile() {
  if (process.platform === 'linux') {
    const policySource = path.join(__dirname, 'build', 'com.bpvpn.pkexec.policy');
    const policyDest = path.join(__dirname, 'resources', 'com.bpvpn.pkexec.policy');
    
    // Criar diretório resources se não existir
    const resourcesDir = path.dirname(policyDest);
    if (!fs.existsSync(resourcesDir)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
    }
    
    // Copiar arquivo de política
    if (fs.existsSync(policySource) && !fs.existsSync(policyDest)) {
      fs.copyFileSync(policySource, policyDest);
      console.log('✅ Arquivo de política copiado para resources');
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'BluePex VPN Connections',
    autoHideMenuBar: true,
    resizable: true,
    center: true,
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
    ensurePolicyFile();
    ensureDirectories(); // ✅ Criar diretórios
    
    // ✅ Carregar config do diretório do usuário
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } else {
      // Se não existir, tentar copiar do diretório da aplicação
      const oldConfigPath = path.join(__dirname, 'config.json');
      if (fs.existsSync(oldConfigPath)) {
        config = JSON.parse(fs.readFileSync(oldConfigPath, 'utf-8'));
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      } else {
        config = {
          client_id: "",
          tenant_id: "",
          scope: "https://graph.microsoft.com/.default",
          server_api: "",
          openvpn_config: ""
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      }
    }
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
    config = {
      client_id: "",
      tenant_id: "",
      scope: "https://graph.microsoft.com/.default",
      server_api: "",
      openvpn_config: ""
    };
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
  console.log(`🔍 Iniciando busca por arquivo OVPN para perfil: ${profileId}`);
  
  // ✅ CORREÇÃO: Usar diretórios do usuário
  const searchDirs = [
    PROFILES_DIR,           // ~/.config/bp-vpn-electron/ovpn_profiles
    AZURE_PROFILES_DIR,     // ~/.config/bp-vpn-electron/azure_ovpn_profiles
  ];

  const possibleFilenames = [
    `${profileId}.ovpn`,
    `${profileId}.conf`,
    `config.ovpn`,
    `client.ovpn`
  ];

  for (const baseDir of searchDirs) {
    console.log(`📁 Verificando diretório base: ${baseDir}`);
    
    const profileDir = path.join(baseDir, profileId);
    for (const filename of possibleFilenames) {
      const filePath = path.join(profileDir, filename);
      console.log(`   🔎 Tentando: ${filePath}`);
      
      try {
        if (await fileExists(filePath)) {
          const content = await fsAsync.readFile(filePath, 'utf-8');
          console.log(`✅ Arquivo OVPN encontrado: ${filePath}`);
          return { 
            success: true, 
            content: content, 
            path: filePath,
            profileDir: profileDir 
          };
        }
      } catch (error) {
        console.log(`   ❌ Erro ao acessar ${filePath}: ${error.message}`);
      }
    }
    
    for (const filename of possibleFilenames) {
      const filePath = path.join(baseDir, filename);
      console.log(`   🔎 Tentando: ${filePath}`);
      
      try {
        if (await fileExists(filePath)) {
          const content = await fsAsync.readFile(filePath, 'utf-8');
          console.log(`✅ Arquivo OVPN encontrado: ${filePath}`);
          return { 
            success: true, 
            content: content, 
            path: filePath,
            profileDir: baseDir 
          };
        }
      } catch (error) {
        console.log(`   ❌ Erro ao acessar ${filePath}: ${error.message}`);
      }
    }
  }
  
  console.log(`❌ Arquivo OVPN não encontrado em nenhum local para perfil: ${profileId}`);
  return { 
    success: false, 
    error: `Arquivo OVPN não encontrado para o perfil ${profileId}. Verifique se o arquivo existe.` 
  };
}

// ============ FUNÇÃO PARA PROCESSAR ARQUIVOS OVPN ============

async function processAndCopyOvpnFiles(originalOvpnPath, profileId, baseDir = null) {
  // ✅ CORREÇÃO: Usar diretório do usuário por padrão
  const ovpnDir = baseDir || PROFILES_DIR;
  const profileDir = path.join(ovpnDir, profileId);
  
  try {
    await fsAsync.mkdir(profileDir, { recursive: true });
    
    let originalContent = await fsAsync.readFile(originalOvpnPath, 'utf-8');
    const originalDir = path.dirname(originalOvpnPath);
    
    console.log(`📂 Processando arquivo OVPN: ${originalOvpnPath}`);
    console.log(`📁 Diretório do perfil: ${profileDir}`);
    
    const processedLines = [];
    const filesToCopy = new Set();
    
    const lines = originalContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      if (!line || line.startsWith('#')) {
        processedLines.push(line);
        continue;
      }
      
      if (line.startsWith('auth-user-pass')) {
        continue;
      }
      
      const fileDirectives = ['ca', 'cert', 'key', 'tls-auth', 'tls-crypt', 'pkcs12', 'dh', 'extra-certs', 'crl-verify'];
      
      for (const directive of fileDirectives) {
        if (line.startsWith(directive + ' ')) {
          console.log(`🔍 Processando diretiva: ${line}`);
          
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const directiveName = parts[0];
            let fileNamePart = parts[1];
            let extraParams = parts.slice(2).join(' ');
            
            console.log(`   Diretiva: ${directiveName}, Arquivo: ${fileNamePart}, Extra: ${extraParams}`);
            
            if (fileNamePart) {
              let absoluteSourcePath;
              
              if (path.isAbsolute(fileNamePart)) {
                absoluteSourcePath = fileNamePart;
              } else {
                const possiblePaths = [
                  path.join(originalDir, fileNamePart),
                  path.join(originalDir, '..', fileNamePart),
                  path.join(__dirname, fileNamePart),
                  fileNamePart
                ];
                
                for (const possiblePath of possiblePaths) {
                  if (await fileExists(possiblePath)) {
                    absoluteSourcePath = possiblePath;
                    break;
                  }
                }
                
                if (!absoluteSourcePath) {
                  absoluteSourcePath = path.join(originalDir, fileNamePart);
                }
              }
              
              if (await fileExists(absoluteSourcePath)) {
                const fileName = path.basename(absoluteSourcePath);
                const targetFilePath = path.join(profileDir, fileName);
                
                filesToCopy.add({ 
                  source: absoluteSourcePath, 
                  target: targetFilePath,
                  directive: directiveName
                });
                
                // Usar caminho absoluto no arquivo OVPN processado
                line = `${directiveName} ${targetFilePath}`;
                if (extraParams) {
                  line += ` ${extraParams}`;
                }
                
                console.log(`✅ Arquivo identificado: ${fileName} (${directiveName})`);
                console.log(`   Caminho absoluto: ${targetFilePath}`);
              } else {
                console.error(`❌ Arquivo não encontrado: ${absoluteSourcePath}`);
                throw new Error(`Arquivo obrigatório não encontrado para ${directiveName}: ${fileNamePart}`);
              }
            }
          }
          break;
        }
      }
      
      processedLines.push(line);
    }
    
    for (let file of filesToCopy) {
      try {
        await fsAsync.copyFile(file.source, file.target);
        console.log(`✅ Arquivo copiado: ${path.basename(file.source)} -> ${file.target}`);
      } catch (copyError) {
        console.error(`❌ Erro ao copiar ${file.source}:`, copyError);
        throw copyError;
      }
    }
    
    if (!processedLines.some(line => line.startsWith('auth-user-pass'))) {
      processedLines.push('auth-user-pass');
    }
    
    const processedContent = processedLines.filter(line => line.trim() !== '').join('\n');
    const targetOvpnPath = path.join(profileDir, `${profileId}.ovpn`);
    await fsAsync.writeFile(targetOvpnPath, processedContent, 'utf-8');
    
    console.log(`✅ Perfil OVPN processado salvo em: ${targetOvpnPath}`);
    
    return { 
      success: true, 
      content: processedContent,
      profileDir: profileDir,
      filesCopied: filesToCopy.size
    };
    
  } catch (error) {
    console.error('❌ Erro ao processar perfil OVPN:', error);
    return { success: false, error: error.message };
  }
}

// ============ CONEXÕES VPN ============

function detectSystemdChallenge(output) {
  return output.includes('Enter Google Authenticator Token') || 
         output.includes('CHALLENGE:') ||
         output.includes('static-challenge');
}

// Conexão OpenVPN com usuário/senha usando perfil
ipcMain.handle('connect-openvpn-userpass-profile', async (event, profileId, username, password) => {
  return new Promise(async (resolve, reject) => {
    let authFilePath = null;
    let challengeHandler = null;
    let challengeTimeout = null;
   
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

      // Criar arquivo de autenticação
      authFilePath = path.join(os.tmpdir(), `openvpn_auth_${Date.now()}.txt`);
      fs.writeFileSync(authFilePath, `${username}\n${password}\n`);
     
      if (process.platform !== 'win32') {
        fs.chmodSync(authFilePath, 0o600);
      }
      
      console.log(`🔐 Arquivo de autenticação criado: ${authFilePath}`);

      const openvpnArgs = [
        '--config', configPath,
        '--auth-user-pass', authFilePath,
        '--auth-retry', 'interact'
      ];

      console.log('🔐 Executando OpenVPN...');
     
      let openvpnCommand;
      let openvpnArgsFinal;
      
      let spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe']
      };

      if (process.platform === 'linux') {
          // Usar pkexec para elevação gráfica no Linux (PolicyKit)
          openvpnCommand = 'pkexec';
          openvpnArgsFinal = ['openvpn', ...openvpnArgs];
          console.log('🔐 Usando pkexec para elevação gráfica no Linux');
      } else if (process.platform === 'win32') {
        const openvpnPath = 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe';
        openvpnCommand = 'powershell.exe';
        openvpnArgsFinal = [
          '-Command',
          `Start-Process -FilePath '${openvpnPath}' -ArgumentList '${openvpnArgs.join(' ')}' -Verb RunAs -WorkingDirectory '${profileDir.replace(/\\/g, '\\\\')}'`
        ];
        spawnOptions.shell = true;
        console.log('🔐 Usando PowerShell com RunAs para elevação no Windows');
      } else {
        throw new Error('Plataforma não suportada');
      }
     
      vpnProcess = spawn(openvpnCommand, openvpnArgsFinal, spawnOptions);
      
      let connectionEstablished = false;
      let challengeDetected = false;
      let authFailed = false;

      // Handler para resposta do desafio
      challengeHandler = (event, response) => {
        console.log('📤 Recebida resposta para desafio:', response);
        if (vpnProcess && !vpnProcess.killed && challengeDetected) {
          vpnProcess.stdin.write(response + '\n');
          challengeDetected = false;
          if (challengeTimeout) clearTimeout(challengeTimeout);
          
          // Resetar timeout da conexão após enviar o token
          connectionTimeout = setTimeout(() => {
            if (!connectionEstablished && vpnProcess && !vpnProcess.killed) {
              const errorMsg = 'Timeout na autenticação após token 2FA';
              console.error(`❌ ${errorMsg}`);
              reject(new Error(errorMsg));
            }
          }, 30000);
        }
      };

      // Adicionar listener para resposta do desafio
      ipcMain.once('send-challenge-response', challengeHandler);

      let connectionTimeout = setTimeout(() => {
        if (!connectionEstablished && vpnProcess && !vpnProcess.killed && !challengeDetected) {
          const errorMsg = 'Timeout na conexão OpenVPN';
          console.error(`❌ ${errorMsg}`);
          ipcMain.removeAllListeners('send-challenge-response');
          reject(new Error(errorMsg));
        }
      }, 60000);

      vpnProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('OpenVPN stdout:', output);
        mainWindow.webContents.send('vpn-log', output);
       
        if (output.includes('Initialization Sequence Completed')) {
          connectionEstablished = true;
          console.log(`✅ Conexão estabelecida com sucesso! PID: ${vpnProcess.pid}`);
          ipcMain.removeAllListeners('send-challenge-response');
          if (connectionTimeout) clearTimeout(connectionTimeout);
          if (challengeTimeout) clearTimeout(challengeTimeout);
         
          if (authFilePath && fs.existsSync(authFilePath)) {
            fs.unlinkSync(authFilePath);
          }
         
          resolve({
            pid: vpnProcess.pid,
            success: true,
            message: 'Conexão estabelecida com sucesso'
          });
        }
     
        if ((output.includes('AUTH_FAILED') || output.includes('auth-failure')) && !authFailed) {
          console.error(`❌ Falha na autenticação`);
          authFailed = true;
          ipcMain.removeAllListeners('send-challenge-response');
          if (connectionTimeout) clearTimeout(connectionTimeout);
          if (challengeTimeout) clearTimeout(challengeTimeout);
          reject(new Error('Falha na autenticação: usuário, senha ou token incorretos'));
        }

        // ✅ CORREÇÃO: Detectar desafio APÓS tentativa de autenticação inicial
        if ((output.includes('CHALLENGE:') || output.includes('Enter Google Authenticator Token')) && !challengeDetected && !authFailed) {
          console.log('🔐 Static challenge detectado!');
          challengeDetected = true;
         
          let challengeMessage = 'Enter Google Authenticator Token';
          const challengeMatch = output.match(/CHALLENGE:\s*([^\n\r]+)/);
          if (challengeMatch && challengeMatch[1]) {
            challengeMessage = challengeMatch[1].trim();
          }
         
          // ✅ CORREÇÃO: Limpar timeout de conexão quando desafio é detectado
          if (connectionTimeout) clearTimeout(connectionTimeout);
         
          mainWindow.webContents.send('vpn-challenge', {
            type: 'static-challenge',
            message: challengeMessage,
            requiresInput: true
          });
          
          // Timeout específico para o desafio
          challengeTimeout = setTimeout(() => {
            if (challengeDetected) {
              console.error('❌ Timeout no desafio 2FA');
              ipcMain.removeAllListeners('send-challenge-response');
              reject(new Error('Timeout: Token 2FA não foi fornecido a tempo'));
            }
          }, 120000);
        }
      });

      vpnProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('OpenVPN stderr:', error);
        mainWindow.webContents.send('vpn-log', `ERRO: ${error}`);
       
        if ((error.includes('AUTH_FAILED') || error.includes('auth-failure')) && !authFailed) {
          console.error(`❌ Falha na autenticação`);
          authFailed = true;
          ipcMain.removeAllListeners('send-challenge-response');
          if (connectionTimeout) clearTimeout(connectionTimeout);
          if (challengeTimeout) clearTimeout(challengeTimeout);
          reject(new Error('Falha na autenticação: usuário, senha ou token incorretos'));
        }

        // ✅ CORREÇÃO: Detectar desafio também no stderr
        if ((error.includes('CHALLENGE:') || error.includes('Enter Google Authenticator Token')) && !challengeDetected && !authFailed) {
          console.log('🔐 Static challenge detectado no stderr!');
          challengeDetected = true;
         
          let challengeMessage = 'Enter Google Authenticator Token';
          const challengeMatch = error.match('/CHALLENGE:\s*([^\n\r]+)/');
          if (challengeMatch && challengeMatch[1]) {
            challengeMessage = challengeMatch[1].trim();
          }
         
          if (connectionTimeout) clearTimeout(connectionTimeout);
         
          mainWindow.webContents.send('vpn-challenge', {
            type: 'static-challenge',
            message: challengeMessage,
            requiresInput: true
          });
          
          challengeTimeout = setTimeout(() => {
            if (challengeDetected) {
              console.error('❌ Timeout no desafio 2FA');
              ipcMain.removeAllListeners('send-challenge-response');
              reject(new Error('Timeout: Token 2FA não foi fornecido a tempo'));
            }
          }, 120000);
        }
      });

      vpnProcess.on('close', (code) => {
        console.log(`OpenVPN encerrado com código ${code}`);
        vpnProcess = null;
        ipcMain.removeAllListeners('send-challenge-response');
        mainWindow.webContents.send('vpn-disconnected');
       
        if (connectionTimeout) clearTimeout(connectionTimeout);
        if (challengeTimeout) clearTimeout(challengeTimeout);
       
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
        if (connectionTimeout) clearTimeout(connectionTimeout);
        if (challengeTimeout) clearTimeout(challengeTimeout);
       
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

    } catch (error) {
      console.error(`❌ Erro na conexão:`, error);
      ipcMain.removeAllListeners('send-challenge-response');
      if (challengeTimeout) clearTimeout(challengeTimeout);
     
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

ipcMain.handle('send-systemd-challenge-response', async (event, response) => {
  if (vpnProcess && !vpnProcess.killed) {
    vpnProcess.stdin.write(response + '\n');
    return { success: true };
  }
  return { success: false, error: 'Processo VPN não encontrado' };
});

// ============ GESTÃO DE PERFIS USUÁRIO ============

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

ipcMain.handle('save-ovpn-to-profile', async (event, profileId, ovpnContent, ovpnFileName, originalOvpnPath) => {
  // ✅ CORREÇÃO
  // const profilesPath = path.join(__dirname, 'user_profiles.json');
  const profilesPath = USER_PROFILES_PATH;
  
  try {
    const processResult = await processAndCopyOvpnFiles(originalOvpnPath, profileId);
    if (!processResult.success) {
      return { success: false, error: processResult.error };
    }

    console.log(`✅ Perfil salvo: ${profileId}`);
    console.log(`📁 Diretório: ${processResult.profileDir}`);

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

ipcMain.handle('delete-user-profile', async (event, profileId) => {
  const profilesPath = path.join(__dirname, 'user_profiles.json');
  const profileDir = path.join(__dirname, 'ovpn_profiles', profileId);
  
  try {
    if (await fileExists(profileDir)) {
      await fsAsync.rm(profileDir, { recursive: true, force: true });
    }
    
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

ipcMain.handle('save-user-credentials', async (event, profileId, username, password, rememberPassword) => {
  const credentialsPath = path.join(__dirname, 'user_credentials.json');
  
  try {
    let credentials = {};
    
    if (await fileExists(credentialsPath)) {
      credentials = JSON.parse(await fsAsync.readFile(credentialsPath, 'utf-8'));
    }
    
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

ipcMain.handle('load-user-credentials', async (event, profileId) => {
  const credentialsPath = path.join(__dirname, 'user_credentials.json');
  
  try {
    if (await fileExists(credentialsPath)) {
      const credentials = JSON.parse(await fsAsync.readFile(credentialsPath, 'utf-8'));
      if (credentials[profileId]) {
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

ipcMain.handle('detect-2fa-requirement', async (event, profileId) => {
  try {
    const ovpnResult = await loadOvnFromProfile(profileId);
    if (!ovpnResult.success) {
      return { success: false, error: ovpnResult.error };
    }

    const ovpnContent = ovpnResult.content;
    
    const staticChallengeMatch = ovpnContent.match(/static-challenge\s+"([^"]+)"\s+(\d)/gi);
    const hasStaticChallenge = staticChallengeMatch && staticChallengeMatch.length > 0;
    
    let promptText = '';
    if (hasStaticChallenge) {
      const promptMatch = ovpnContent.match(/static-challenge\s+"([^"]+)"/i);
      if (promptMatch && promptMatch[1]) {
        promptText = promptMatch[1];
      }
    }

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

ipcMain.handle('save-azure-config', async (event, profileId, ovpnContent, ovpnFileName, originalOvpnPath) => {
  const azureProfilesPath = path.join(__dirname, 'azure_profiles.json');
  const azureOvpnDir = path.join(__dirname, 'azure_ovpn_profiles');
  
  try {
    const processResult = await processAndCopyOvpnFiles(originalOvpnPath, profileId, azureOvpnDir);
    if (!processResult.success) {
      return { success: false, error: processResult.error };
    }

    console.log(`✅ Perfil Azure salvo: ${profileId}`);

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

ipcMain.handle('save-default-profiles', async (event, defaultProfiles) => {
  const defaultsPath = path.join(__dirname, 'default_profiles.json');
  try {
    await fsAsync.writeFile(defaultsPath, JSON.stringify(defaultProfiles, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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

ipcMain.handle('save-app-state', async (event, appState) => {
  const statePath = path.join(__dirname, 'app_state.json');
  try {
    await fsAsync.writeFile(statePath, JSON.stringify(appState, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

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

ipcMain.handle('delete-azure-profile', async (event, profileId) => {
  const azureProfilesPath = path.join(__dirname, 'azure_profiles.json');
  const profileDir = path.join(__dirname, 'azure_ovpn_profiles', profileId);
  
  try {
    if (await fileExists(profileDir)) {
      await fsAsync.rm(profileDir, { recursive: true, force: true });
    }
    
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
    console.log(`🔌 Solicitando desconexão do processo VPN PID: ${pid}`);
    
    if (process.platform === 'win32') {
      // Windows: usar taskkill
      exec(`taskkill /PID ${pid} /F`, (error) => {
        if (error) {
          console.error(`❌ Erro ao desconectar no Windows: ${error.message}`);
          reject(new Error(`Falha ao desconectar: ${error.message}`));
        } else {
          console.log(`✅ Processo VPN ${pid} finalizado no Windows`);
          if (vpnProcess && vpnProcess.pid === pid) {
            vpnProcess.kill();
            vpnProcess = null;
          }
          resolve({ success: true });
        }
      });
    } else {
      // Linux: usar pkexec para elevação gráfica
      const killCommand = `kill ${pid}`;
      console.log(`🔐 Executando comando de desconexão: ${killCommand}`);
      
      exec(`pkexec ${killCommand}`, (error) => {
        if (error) {
          console.warn(`⚠️ pkexec falhou, tentando sudo: ${error.message}`);
          
          // Fallback para sudo
          exec(`sudo kill ${pid}`, (sudoError) => {
            if (sudoError) {
              console.error(`❌ Erro ao desconectar com sudo: ${sudoError.message}`);
              
              // Última tentativa: kill direto (pode não funcionar sem permissões)
              exec(`kill ${pid}`, (killError) => {
                if (killError) {
                  console.error(`❌ Falha total ao desconectar: ${killError.message}`);
                  reject(new Error(`Falha ao desconectar: Não foi possível finalizar o processo VPN`));
                } else {
                  console.log(`✅ Processo VPN ${pid} finalizado (sem elevação)`);
                  if (vpnProcess && vpnProcess.pid === pid) {
                    vpnProcess.kill();
                    vpnProcess = null;
                  }
                  resolve({ success: true });
                }
              });
            } else {
              console.log(`✅ Processo VPN ${pid} finalizado com sudo`);
              if (vpnProcess && vpnProcess.pid === pid) {
                vpnProcess.kill();
                vpnProcess = null;
              }
              resolve({ success: true });
            }
          });
        } else {
          console.log(`✅ Processo VPN ${pid} finalizado com pkexec`);
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
