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
    width: 500,
    height: 650,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'BluePex VPN Connections',
    autoHideMenuBar: true,
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

// Conexão OpenVPN com usuário/senha usando perfil
// Conexão OpenVPN com usuário/senha usando perfil
ipcMain.handle('connect-openvpn-userpass-profile', async (event, profileId, username, password) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`🔗 Iniciando conexão para perfil: ${profileId}`);
      
      // Carregar configuração do perfil
      const ovpnResult = await loadOvnFromProfile(profileId);
      if (!ovpnResult.success) {
        console.error(`❌ Erro ao carregar perfil: ${ovpnResult.error}`);
        reject(new Error(ovpnResult.error));
        return;
      }

      // Usar o profileDir retornado pela função
      const profileDir = ovpnResult.profileDir;
      const configPath = ovpnResult.path;

      console.log(`📁 Diretório do perfil: ${profileDir}`);
      console.log(`📄 Configuração: ${configPath}`);

      // Verificar se o arquivo de configuração existe
      if (!fs.existsSync(configPath)) {
        const errorMsg = `Arquivo de configuração não encontrado: ${configPath}`;
        console.error(`❌ ${errorMsg}`);
        reject(new Error(errorMsg));
        return;
      }

      // Verificar se o diretório existe
      if (!fs.existsSync(profileDir)) {
        const errorMsg = `Diretório do perfil não encontrado: ${profileDir}`;
        console.error(`❌ ${errorMsg}`);
        reject(new Error(errorMsg));
        return;
      }

      // Criar arquivo de autenticação temporário com permissões seguras
      const authContent = `${username}\n${password}`;
      fs.writeFileSync(authPath, authContent, 'utf-8');
      
      // No Linux, ajustar permissões do arquivo de auth
      if (process.platform !== 'win32') {
        await fsAsync.chmod(authPath, 0o600);
      }

      // Listar arquivos no diretório para debug
      try {
        const files = await fsAsync.readdir(profileDir);
        console.log(`📂 Arquivos no diretório do perfil:`, files);
      } catch (dirError) {
        console.error(`❌ Erro ao listar diretório:`, dirError);
      }

      console.log(`🚀 Executando OpenVPN...`);

      // Executar OpenVPN no diretório do perfil
      let openvpnArgs = ['--config', configPath, '--auth-user-pass', authPath];

      if (process.platform === 'win32') {
        const openvpnPath = 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe';
        vpnProcess = spawn(openvpnPath, openvpnArgs, { 
          cwd: profileDir // Executar no diretório dos certificados
        });
      } else {
        vpnProcess = spawn('sudo', ['openvpn', ...openvpnArgs], {
          cwd: profileDir // Executar no diretório dos certificados
        });
      }

      let connectionEstablished = false;

      vpnProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('OpenVPN:', output);
        mainWindow.webContents.send('vpn-log', output);
        
        if (output.includes('Initialization Sequence Completed')) {
          connectionEstablished = true;
          console.log(`✅ Conexão estabelecida com sucesso! PID: ${vpnProcess.pid}`);
          resolve({ 
            pid: vpnProcess.pid, 
            success: true,
            message: 'Conexão estabelecida com sucesso'
          });
        }
        
        if (output.includes('AUTH_FAILED') || output.includes('auth-failure')) {
          console.error(`❌ Falha na autenticação`);
          reject(new Error('Falha na autenticação: usuário ou senha incorretos'));
        }
      });

      vpnProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('OpenVPN Error:', error);
        mainWindow.webContents.send('vpn-log', `ERRO: ${error}`);
        
        if (error.includes('AUTH_FAILED') || error.includes('auth-failure')) {
          console.error(`❌ Falha na autenticação`);
          reject(new Error('Falha na autenticação: usuário ou senha incorretos'));
        }
        
        // Detectar erros de arquivo não encontrado
        if (error.includes('No such file or directory')) {
          const fileMatch = error.match(/fails with '([^']+)'/);
          if (fileMatch) {
            const errorMsg = `Arquivo não encontrado: ${fileMatch[1]}. Certifique-se de que todos os arquivos de certificado estão no diretório do perfil.`;
            console.error(`❌ ${errorMsg}`);
            reject(new Error(errorMsg));
          }
        }
      });

      vpnProcess.on('close', (code) => {
        console.log(`OpenVPN encerrado com código ${code}`);
        vpnProcess = null;
        mainWindow.webContents.send('vpn-disconnected');
        
        // Limpar arquivo de auth
        try {
          if (fs.existsSync(authPath)) {
            fs.unlinkSync(authPath);
          }
        } catch (e) {
          console.log('Erro ao limpar arquivo de auth:', e.message);
        }
      });

      // Timeout de conexão
      setTimeout(() => {
        if (!connectionEstablished && vpnProcess && !vpnProcess.killed) {
          const errorMsg = 'Timeout na conexão OpenVPN - Verifique os logs para detalhes';
          console.error(`❌ ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      }, 45000);

    } catch (error) {
      console.error(`❌ Erro na conexão:`, error);
      reject(error);
    }
  });
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
