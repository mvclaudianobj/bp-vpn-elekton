// ============ IMPORTS ============
const { app, BrowserWindow, ipcMain, shell, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsAsync = require('fs').promises;
const os = require('os');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const { PublicClientApplication } = require('@azure/msal-node');
const { dialog } = require('electron');
const ps = require('ps-node');
const { autoUpdater } = require('electron-updater');

// ============ SISTEMA DE LOGGING ============

class AppLogger {
  constructor() {
    this.logDir = this.getLogDirectory();
    this.currentLogFile = null;
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;
    this.initializeLogger();
  }

  getLogDirectory() {
    if (process.platform === 'linux') {
      return '/var/log/bluepexvpn';
    } else if (process.platform === 'win32') {
      return path.join(app.getPath('userData'), 'logs');
    } else {
      // Desenvolvimento ou outros: usar ~/.config/bluepex-vpn/logs/
      return path.join(app.getPath('userData'), 'logs');
    }
  }

  async initializeLogger() {
    try {
      // Criar diretório de logs se não existir
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`📁 Diretório de logs criado: ${this.logDir}`);
      }

      // Verificar permissões de escrita
      const testFile = path.join(this.logDir, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      this.currentLogFile = this.getCurrentLogFile();
      console.log(`📝 Logger inicializado. Arquivo atual: ${this.currentLogFile}`);

      // Log de inicialização
      this.log('SYSTEM', 'APP_START', {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        userData: app.getPath('userData'),
        logDir: this.logDir,
        packaged: app.isPackaged
      });

    } catch (error) {
      console.error('❌ Erro ao inicializar logger:', error);

      // Fallback: tentar usar diretório do usuário
      try {
        const fallbackLogDir = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(fallbackLogDir)) {
          fs.mkdirSync(fallbackLogDir, { recursive: true });
        }

        // Testar permissões no diretório fallback
        const testFile = path.join(fallbackLogDir, '.write_test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);

        this.logDir = fallbackLogDir;
        this.currentLogFile = this.getCurrentLogFile();
        console.log(`📝 Logger inicializado com fallback. Arquivo atual: ${this.currentLogFile}`);

        this.log('SYSTEM', 'LOGGER_FALLBACK', {
          originalDir: this.getLogDirectory(),
          fallbackDir: fallbackLogDir,
          reason: 'permission_denied'
        });

      } catch (fallbackError) {
        console.error('❌ Fallback do logger também falhou:', fallbackError);
        // Último fallback: apenas console
        this.currentLogFile = null;
      }
    }
  }

  getCurrentLogFile() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `data_${today}.log`);
  }

  async checkLogRotation() {
    if (!this.currentLogFile) return;

    try {
      const stats = await fsAsync.stat(this.currentLogFile);
      if (stats.size > this.maxLogSize) {
        await this.rotateLog();
      }
    } catch (error) {
      // Arquivo não existe ainda, ok
    }
  }

  async rotateLog() {
    const baseName = path.basename(this.currentLogFile, '.log');

    // Mover arquivos existentes
    for (let i = this.maxLogFiles - 1; i >= 1; i--) {
      const oldFile = path.join(this.logDir, `${baseName}.${i}.log`);
      const newFile = path.join(this.logDir, `${baseName}.${i + 1}.log`);

      try {
        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // Remover o mais antigo
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      } catch (error) {
        console.error(`Erro ao rotacionar log ${oldFile}:`, error.message);
      }
    }

    // Renomear arquivo atual
    const rotatedFile = path.join(this.logDir, `${baseName}.1.log`);
    try {
      fs.renameSync(this.currentLogFile, rotatedFile);
    } catch (error) {
      console.error('Erro ao rotacionar log atual:', error.message);
    }

    this.currentLogFile = this.getCurrentLogFile();
  }

  log(category, action, data = {}, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      category,
      action,
      data,
      pid: process.pid
    };

    // Formatar para arquivo
    const logLine = JSON.stringify(logEntry) + '\n';

    // Formatar para console (mais legível)
    const consoleLine = `[${timestamp}] ${level} [${category}] ${action}: ${JSON.stringify(data)}`;

    // Log no console
    if (level === 'ERROR') {
      console.error(consoleLine);
    } else if (level === 'WARN') {
      console.warn(consoleLine);
    } else {
      console.log(consoleLine);
    }

    // Log no arquivo
    if (this.currentLogFile) {
      try {
        fs.appendFileSync(this.currentLogFile, logLine);
      } catch (error) {
        console.error('Erro ao escrever no arquivo de log:', error);
      }
    }
  }

  // Métodos específicos para diferentes tipos de eventos
  logProfileCreate(profileId, profileType, profileName) {
    this.log('PROFILE', 'CREATE', { profileId, profileType, profileName });
  }

  logProfileDelete(profileId, profileType, profileName) {
    this.log('PROFILE', 'DELETE', { profileId, profileType, profileName });
  }

  logProfileUpdate(profileId, profileType, changes) {
    this.log('PROFILE', 'UPDATE', { profileId, profileType, changes });
  }

  logConnectionStart(profileId, profileType, connectionType) {
    this.log('CONNECTION', 'START', { profileId, profileType, connectionType });
  }

  logConnectionSuccess(profileId, profileType, details = {}) {
    this.log('CONNECTION', 'SUCCESS', { profileId, profileType, ...details });
  }

  logConnectionFailure(profileId, profileType, error, details = {}) {
    this.log('CONNECTION', 'FAILURE', { profileId, profileType, error: error.message, ...details }, 'ERROR');
  }

  logConnectionDisconnect(profileId, profileType, reason = '') {
    this.log('CONNECTION', 'DISCONNECT', { profileId, profileType, reason });
  }

  logAuthSuccess(profileId, authType, details = {}) {
    this.log('AUTH', 'SUCCESS', { profileId, authType, ...details });
  }

  logAuthFailure(profileId, authType, error, details = {}) {
    this.log('AUTH', 'FAILURE', { profileId, authType, error: error.message, ...details }, 'ERROR');
  }

  logAzureTokenPublish(username, success, details = {}) {
    this.log('AZURE', 'TOKEN_PUBLISH', { username, success, ...details }, success ? 'INFO' : 'ERROR');
  }

  logSystemError(component, error, details = {}) {
    this.log('SYSTEM', 'ERROR', { component, error: error.message, ...details }, 'ERROR');
  }

  logSystemWarning(component, message, details = {}) {
    this.log('SYSTEM', 'WARNING', { component, message, ...details }, 'WARN');
  }

  logConfigChange(configType, changes) {
    this.log('CONFIG', 'CHANGE', { configType, changes });
  }
}

// Verificar processos OpenVPN ativos
async function checkActiveOpenVPN() {
  return new Promise((resolve) => {
    ps.lookup({ command: 'openvpn' }, (err, resultList) => {
      if (err) {
        console.error('Erro ao verificar processos OpenVPN:', err);
        resolve([]);
        return;
      }
      resolve(resultList);
    });
  });
}

// Instância global do logger
const logger = new AppLogger();

// ============ SISTEMA DE ATUALIZAÇÃO AUTOMÁTICA ============

class AutoUpdaterManager {
  constructor() {
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.updateInfo = null;
    this.checkInterval = null;
    this.isChecking = false;

    this.configureUpdater();
    this.setupEventHandlers();
    this.startPeriodicChecks();
  }

  configureUpdater() {
    // Configurações do electron-updater
    autoUpdater.autoDownload = false; // Não baixar automaticamente
    autoUpdater.autoInstallOnAppQuit = false; // Não instalar automaticamente ao sair
    autoUpdater.allowDowngrade = false; // Não permitir downgrade
    autoUpdater.allowPrerelease = false; // Não usar pre-releases

    // Configurar provedor (GitHub Releases)
    if (process.env.GITHUB_TOKEN) {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'mvclaudianobj', // Owner do repositório GitHub
        repo: 'BluePexVPN',
        private: true,
        token: process.env.GITHUB_TOKEN
      });
    } else {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'mvclaudianobj', // Owner do repositório GitHub
        repo: 'BluePexVPN'
      });
    }

    logger.log('UPDATE', 'CONFIGURED', {
      autoDownload: autoUpdater.autoDownload,
      autoInstallOnAppQuit: autoUpdater.autoInstallOnAppQuit,
      provider: 'github'
    });
  }

  setupEventHandlers() {
    // Evento: Atualização encontrada
    autoUpdater.on('update-available', (info) => {
      logger.log('UPDATE', 'AVAILABLE', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        currentVersion: app.getVersion()
      });

      this.updateAvailable = true;
      this.updateInfo = info;

      // Notificar renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', info);
      }
    });

    // Evento: Nenhuma atualização disponível
    autoUpdater.on('update-not-available', (info) => {
      logger.log('UPDATE', 'NOT_AVAILABLE', {
        currentVersion: app.getVersion(),
        checkedAt: new Date().toISOString()
      });

      this.updateAvailable = false;
      this.updateInfo = null;
    });

    // Evento: Download iniciado
    autoUpdater.on('download-progress', (progressObj) => {
      const progress = {
        percent: Math.round(progressObj.percent),
        speed: Math.round(progressObj.bytesPerSecond / 1024), // KB/s
        transferred: Math.round(progressObj.transferred / 1024 / 1024), // MB
        total: Math.round(progressObj.total / 1024 / 1024), // MB
        remaining: progressObj.total - progressObj.transferred
      };

      // Notificar renderer a cada 10%
      if (progress.percent % 10 === 0 || progress.percent === 100) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-progress', progress);
        }
      }
    });

    // Evento: Download concluído
    autoUpdater.on('update-downloaded', (info) => {
      logger.log('UPDATE', 'DOWNLOADED', {
        version: info.version,
        downloadedAt: new Date().toISOString()
      });

      this.updateDownloaded = true;

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', info);
      }
    });

    // Evento: Erro na atualização
    autoUpdater.on('error', (error) => {
      logger.logSystemError('AUTO_UPDATER', error, {
        currentVersion: app.getVersion(),
        platform: process.platform
      });

      this.updateAvailable = false;
      this.updateDownloaded = false;

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-error', {
          message: error.message,
          code: error.code
        });
      }
    });
  }

  startPeriodicChecks() {
    // Verificar atualizações a cada 4 horas
    const checkInterval = 4 * 60 * 60 * 1000; // 4 horas em ms

    this.checkInterval = setInterval(() => {
      if (!this.isChecking) {
        this.checkForUpdates(false); // Verificação silenciosa
      }
    }, checkInterval);

    // Primeira verificação após 30 segundos
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 30000);

    logger.log('UPDATE', 'PERIODIC_CHECKS_STARTED', {
      intervalHours: 4,
      firstCheckDelaySeconds: 30
    });
  }

  async checkForUpdates(showDialog = true) {
    if (this.isChecking) {
      logger.log('UPDATE', 'CHECK_ALREADY_RUNNING');
      return;
    }

    this.isChecking = true;

    try {
      logger.log('UPDATE', 'CHECK_START', {
        manual: showDialog,
        currentVersion: app.getVersion()
      });

      const result = await autoUpdater.checkForUpdates();

      if (showDialog && !this.updateAvailable) {
        // Mostrar dialog informando que não há atualizações
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-check-complete', {
            available: false,
            currentVersion: app.getVersion()
          });
        }
      }

    } catch (error) {
      logger.logSystemError('UPDATE_CHECK', error);
    } finally {
      this.isChecking = false;
    }
  }

  async downloadUpdate() {
    if (!this.updateAvailable) {
      throw new Error('Nenhuma atualização disponível');
    }

    try {
      logger.log('UPDATE', 'DOWNLOAD_START', {
        version: this.updateInfo.version
      });

      await autoUpdater.downloadUpdate();

    } catch (error) {
      logger.logSystemError('UPDATE_DOWNLOAD', error);
      throw error;
    }
  }

  async installUpdate() {
    if (!this.updateDownloaded) {
      throw new Error('Atualização não foi baixada');
    }

    logger.log('UPDATE', 'INSTALL_START', {
      version: this.updateInfo.version,
      installAt: new Date().toISOString()
    });

    // Salvar estado antes da instalação
    try {
      await saveApplicationState();
    } catch (error) {
      logger.logSystemError('STATE_SAVE_BEFORE_UPDATE', error);
    }

    // Instalar e reiniciar
    autoUpdater.quitAndInstall(false, true); // Não forçar, mas reiniciar
  }

  getStatus() {
    return {
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      updateInfo: this.updateInfo,
      currentVersion: app.getVersion(),
      isChecking: this.isChecking
    };
  }
}

// Instância global do auto-updater
const updaterManager = new AutoUpdaterManager();

// Padronizar nome da aplicação para consistência de diretórios
app.setName('bluepex-vpn');

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
  const dirs = [
    { path: USER_DATA_DIR, name: 'dados do usuário', critical: true },
    { path: PROFILES_DIR, name: 'perfis VPN', critical: false },
    { path: AZURE_PROFILES_DIR, name: 'perfis Azure', critical: false }
  ];

  logger.log('SYSTEM', 'DIRECTORY_CHECK_START', {
    directories: dirs.map(d => ({ path: d.path, name: d.name, critical: d.critical })),
    platform: process.platform,
    user: process.env.USER || 'unknown'
  });

  for (const dir of dirs) {
    try {
      const existsBefore = fs.existsSync(dir.path);
      const stats = existsBefore ? fs.statSync(dir.path) : null;

      if (!existsBefore) {
        fs.mkdirSync(dir.path, { recursive: true });
        logger.log('SYSTEM', 'DIRECTORY_CREATED', {
          path: dir.path,
          name: dir.name,
          permissions: '0755',
          recursive: true,
          critical: dir.critical,
          success: true
        });
        console.log(`📁 Diretório criado: ${dir.path}`);
      } else {
        logger.log('SYSTEM', 'DIRECTORY_EXISTS', {
          path: dir.path,
          name: dir.name,
          isDirectory: stats.isDirectory(),
          permissions: stats.mode.toString(8),
          size: stats.size
        });
        console.log(`📁 Diretório já existe: ${dir.path}`);
      }

      // Verificar permissões de escrita detalhadamente
      try {
        const testFile = path.join(dir.path, '.write_test_' + Date.now());
        const testContent = `permission_test_${Date.now()}`;

        fs.writeFileSync(testFile, testContent);
        const readBack = fs.readFileSync(testFile, 'utf-8');
        fs.unlinkSync(testFile);

        const writeSuccess = readBack === testContent;

        logger.log('SYSTEM', 'DIRECTORY_PERMISSIONS_OK', {
          path: dir.path,
          name: dir.name,
          testFile: path.basename(testFile),
          writeSuccess,
          readSuccess: true,
          deleteSuccess: true,
          critical: dir.critical
        });
        console.log(`✅ Permissões OK para: ${dir.path}`);
      } catch (permError) {
        logger.logSystemError('DIRECTORY_PERMISSIONS_DENIED', permError, {
          path: dir.path,
          name: dir.name,
          errorCode: permError.code,
          errorMessage: permError.message,
          errno: permError.errno,
          syscall: permError.syscall,
          critical: dir.critical
        });
        console.error(`❌ Problema de permissões em: ${dir.path}`, permError.message);
      }
    } catch (error) {
      logger.logSystemError('DIRECTORY_CREATION_FAILED', error, {
        path: dir.path,
        name: dir.name,
        errorCode: error.code,
        errorMessage: error.message,
        errno: error.errno,
        syscall: error.syscall,
        critical: dir.critical
      });
      console.error(`❌ Erro ao criar diretório: ${dir.path}`, error.message);
    }
  }

  logger.log('SYSTEM', 'DIRECTORY_CHECK_COMPLETE', {
    userDataDir: USER_DATA_DIR,
    profilesDir: PROFILES_DIR,
    azureProfilesDir: AZURE_PROFILES_DIR,
    totalDirectories: dirs.length,
    criticalDirectories: dirs.filter(d => d.critical).length,
    success: true
  });

  console.log(`📁 Diretório de perfis: ${PROFILES_DIR}`);
  console.log(`📁 Diretório de perfis Azure: ${AZURE_PROFILES_DIR}`);
}

let mainWindow;
let splashWindow;
let tray;
let pca;
let config;
let currentElevationMethod = null; // Armazena o método de elevação atual
let currentOvpnPath = null; // Caminho do arquivo .ovpn atual
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
    try {
      if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true });
      }
    } catch (err) {
      console.warn('Erro ao criar diretório resources:', err.message);
    }
    
    // Copiar arquivo de política
    if (fs.existsSync(policySource) && !fs.existsSync(policyDest)) {
      fs.copyFileSync(policySource, policyDest);
      console.log('✅ Arquivo de política copiado para resources');
    }
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Minimizar para Tray',
      click: () => {
        mainWindow.hide();
      }
    },
    {
      label: 'Sair',
      click: () => {
        app.quit();
      }
    }
  ]);
  tray.setToolTip('BluePex VPN');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    center: true,
    show: false,
  });

  // Carregar splash.html, substituir a versão e embeddar o logo
  const splashPath = path.join(__dirname, 'splash.html');
  let splashContent = fs.readFileSync(splashPath, 'utf8');
  const version = app.getVersion();
  splashContent = splashContent.replace('Versão 1.0.0', `Versão ${version}`);

  // Embeddar logo como base64
  const logoPath = path.join(__dirname, 'logo.png');
  if (fs.existsSync(logoPath)) {
    const logoData = fs.readFileSync(logoPath);
    const logoBase64 = logoData.toString('base64');
    splashContent = splashContent.replace('src="logo.png"', `src="data:image/png;base64,${logoBase64}"`);
  }

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashContent)}`);

  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
}

function createWindow() {
  console.log('🏗️ Criando janela principal...');
  mainWindow = new BrowserWindow({
    width: 500,
    height: 650,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'BluePex VPN Connections',
    autoHideMenuBar: false,
    resizable: true,
    center: true,
    show: false,
  });

  // Criar menu da aplicação
  const menuTemplate = [
    {
      label: 'Arquivo',
      submenu: [
        { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        {
          label: 'Minimizar para Tray',
          click: () => {
            mainWindow.hide();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    if (app.isPackaged) {
      setTimeout(() => {
        if (splashWindow) {
          splashWindow.close();
          splashWindow = null;
        }
        mainWindow.show();
        createTray(); // Criar tray após mostrar main window
      }, 3000); // Mostrar splash por 3 segundos
    } else {
      mainWindow.show();
      createTray(); // Criar tray imediatamente em desenvolvimento
    }
  });

  mainWindow.on('minimize', () => {
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    if (tray) tray.destroy();
    if (vpnProcess) {
      console.log("Tentando desconectar VPN automaticamente ao fechar a janela...");

      // Tentar desconectar graciosamente
      try {
        exec(`pkexec kill -TERM ${vpnProcess.pid}`, (error) => {
          if (error) {
            console.error('Erro ao matar processo VPN:', error);
          }
        });
        logger.logConnectionDisconnect(null, null, 'window_closed');
        setTimeout(() => {
          try {
            process.kill(vpnProcess.pid, 'SIGKILL');
          } catch (err) {
            // Processo já morto
          }
        }, 5000);
      } catch (err) {
        console.error("Erro ao desconectar VPN:", err.message);
      }
    }
    mainWindow = null;
  });
}

// Prevenir múltiplas instâncias
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  return;
}

app.whenReady().then(async () => {
  try {
    // Verificar se há display disponível
    if (!process.env.DISPLAY) {
      console.error('Erro: DISPLAY não definido. Execute em ambiente com interface gráfica.');
      app.quit();
      return;
    }

    // Criar splash window apenas em produção
    if (app.isPackaged) {
      createSplashWindow();
    }

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
    logger.logSystemError('CONFIG_LOAD', error);
    config = {
      client_id: "",
      tenant_id: "",
      scope: "https://graph.microsoft.com/.default",
      server_api: "",
      openvpn_config: ""
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }

   // Configurar Azure AD
   try {
     pca = new PublicClientApplication({
       auth: {
         clientId: config.client_id,
         authority: `https://login.microsoftonline.com/${config.tenant_id}`,
       }
     });

     logger.log('AZURE', 'CLIENT_CONFIGURED', {
       hasClientId: !!config.client_id,
       hasTenantId: !!config.tenant_id,
       authority: `https://login.microsoftonline.com/${config.tenant_id}`,
       scope: config.scope,
       serverApi: config.server_api
     });
   } catch (azureError) {
     logger.logSystemError('AZURE_CLIENT_INIT_FAILED', azureError, {
       clientId: config.client_id ? '***configured***' : 'not_set',
       tenantId: config.tenant_id ? '***configured***' : 'not_set'
     });
     console.error('Erro ao configurar cliente Azure:', azureError);
   }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============ FUNÇÕES AUXILIARES ============

async function checkPkexecAvailable() {
  return new Promise((resolve) => {
    exec('which pkexec', (error) => {
      resolve(!error);
    });
  });
}

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
    PROFILES_DIR,           // ~/.config/bluepex-vpn/ovpn_profiles
    AZURE_PROFILES_DIR,     // ~/.config/bluepex-vpn/azure_ovpn_profiles
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

    // ✅ EXTRAÇÃO DE CONFIGURAÇÕES AZURE DO ARQUIVO .OVPN
    const azureConfig = {
      client_id: null,
      tenant_id: null,
      scope: null,
      server_api: null
    };
    
    const lines = originalContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // ✅ EXTRAÇÃO DE CONFIGURAÇÕES AZURE DE COMENTÁRIOS ESPECIAIS
      if (line.startsWith('#AZURE:')) {
        const azureLine = line.substring(7).trim(); // Remove '#AZURE:'
        const [key, value] = azureLine.split('=').map(s => s.trim());

        if (key && value) {
          switch (key.toLowerCase()) {
            case 'client_id':
              azureConfig.client_id = value;
              console.log(`🔧 Configuração Azure extraída: client_id = ${value}`);
              break;
            case 'tenant_id':
              azureConfig.tenant_id = value;
              console.log(`🔧 Configuração Azure extraída: tenant_id = ${value}`);
              break;
            case 'scope':
              azureConfig.scope = value;
              console.log(`🔧 Configuração Azure extraída: scope = ${value}`);
              break;
            case 'server_api':
              azureConfig.server_api = value;
              console.log(`🔧 Configuração Azure extraída: server_api = ${value}`);
              break;
          }
        }
        // Não adiciona a linha de configuração Azure ao arquivo processado
        continue;
      }

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
      filesCopied: filesToCopy.size,
      azureConfig: azureConfig // ✅ CONFIGURAÇÕES AZURE EXTRAÍDAS
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

    const connectionId = `conn_${profileId}_${Date.now()}`;

    try {
      logger.log('CONNECTION', 'START', {
        connectionId,
        profileId,
        profileType: 'user',
        connectionType: 'openvpn-userpass',
        username: username ? '***provided***' : 'empty',
        passwordLength: password ? password.length : 0,
        platform: process.platform,
        user: process.env.USER || 'unknown',
        timestamp: new Date().toISOString()
      });

      const ovpnResult = await loadOvnFromProfile(profileId);
      if (!ovpnResult.success) {
        console.error(`❌ Erro ao carregar perfil: ${ovpnResult.error}`);
        logger.log('CONNECTION', 'LOAD_PROFILE_FAILED', {
          connectionId,
          profileId,
          error: ovpnResult.error,
          step: 'load_ovpn_profile',
          profileDir: ovpnResult.profileDir || 'unknown'
        }, 'ERROR');
        reject(new Error(ovpnResult.error));
        return;
      }

      logger.log('CONNECTION', 'PROFILE_LOADED', {
        connectionId,
        profileId,
        configPath: ovpnResult.path,
        profileDir: ovpnResult.profileDir,
        configSize: ovpnResult.content ? ovpnResult.content.length : 0
      });

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

       // Criar fifo para stdin interativo

       const openvpnArgs = [
         '--config', configPath,
         '--auth-user-pass', authFilePath,
         '--auth-retry', 'interact'
       ];

      console.log('🔐 Executando OpenVPN...');
     
      let openvpnCommand;
      let openvpnArgsFinal;
     
       let spawnOptions = {
         stdio: ['pipe', 'pipe', 'pipe'],
         env: { ...process.env, SYSTEMD_ASK_PASSWORD: '' }
       };

        if (process.platform === 'linux') {
           // Verificar disponibilidade de ferramentas de elevação
           logger.log('CONNECTION', 'CHECK_ELEVATION_TOOLS', {
             connectionId,
             displayAvailable: !!process.env.DISPLAY,
             checkingPkexec: true
           });

           const pkexecAvailable = await checkPkexecAvailable();
           logger.log('CONNECTION', 'PKEXEC_AVAILABILITY', {
             connectionId,
             pkexecAvailable,
             displayEnv: process.env.DISPLAY || 'not_set'
           });

           // Encontrar caminho do openvpn
           const openvpnPath = await new Promise((resolve) => {
             exec('which openvpn', (error, stdout) => {
               if (error) {
                 logger.log('CONNECTION', 'OPENVPN_NOT_FOUND', {
                   connectionId,
                   error: error.message,
                   code: error.code
                 }, 'ERROR');
                 resolve('openvpn'); // fallback
               } else {
                 const path = stdout.trim();
                 logger.log('CONNECTION', 'OPENVPN_FOUND', {
                   connectionId,
                   path,
                   versionCheck: true
                 });
                 resolve(path);
               }
             });
           });

           // Estratégia de elevação
           if (process.env.DISPLAY && pkexecAvailable) {
             openvpnCommand = 'pkexec';
             currentElevationMethod = 'pkexec'; // Armazenar método usado
             openvpnArgsFinal = ['stdbuf', '-oL', '-eL', 'env', 'SYSTEMD_ASK_PASSWORD=', openvpnPath, ...openvpnArgs];
             logger.log('CONNECTION', 'ELEVATION_STRATEGY', {
               connectionId,
               strategy: 'pkexec',
               command: openvpnCommand,
               args: openvpnArgsFinal.slice(0, 3), // primeiros args apenas
               reason: 'display_and_pkexec_available',
               elevationMethodStored: currentElevationMethod
             });
             console.log(`🔐 Usando pkexec com stdbuf e ${openvpnPath} para isolamento e buffering`);
             console.log(`🔐 Método de elevação armazenado: ${currentElevationMethod}`);
           } else {
             openvpnCommand = 'sudo';
             currentElevationMethod = 'sudo'; // Armazenar método usado
             openvpnArgsFinal = [openvpnPath, ...openvpnArgs];
             logger.log('CONNECTION', 'ELEVATION_STRATEGY', {
               connectionId,
               strategy: 'sudo',
               command: openvpnCommand,
               reason: process.env.DISPLAY ? 'pkexec_not_available' : 'no_display',
               elevationMethodStored: currentElevationMethod
             });
             console.log(`🔐 Usando sudo com ${openvpnPath} para elevação`);
             console.log(`🔐 Método de elevação armazenado: ${currentElevationMethod}`);
           }
       } else if (process.platform === 'win32') {
         const openvpnPath = 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe';
         openvpnCommand = 'powershell.exe';
         openvpnArgsFinal = [
           '-Command',
           `Start-Process -FilePath '${openvpnPath}' -ArgumentList '${openvpnArgs.join(' ')}' -Verb RunAs -WorkingDirectory '${profileDir.replace(/\\/g, '\\\\')}'`
         ];
         spawnOptions.shell = true;
         logger.log('CONNECTION', 'ELEVATION_STRATEGY', {
           connectionId,
           strategy: 'powershell_runas',
           openvpnPath,
           profileDir,
           platform: 'windows'
         });
         console.log('🔐 Usando PowerShell com RunAs para elevação no Windows');
       } else {
         logger.log('CONNECTION', 'UNSUPPORTED_PLATFORM', {
           connectionId,
           platform: process.platform,
           supported: ['linux', 'win32']
         }, 'ERROR');
         throw new Error('Plataforma não suportada');
       }
     
        vpnProcess = spawn(openvpnCommand, openvpnArgsFinal, spawnOptions);

        // ✅ CORREÇÃO: Armazenar caminho do .ovpn para desconexão específica
        currentOvpnPath = configPath;

        // ✅ CORREÇÃO: Resolver imediatamente com o PID após spawn bem-sucedido
        console.log(`🔌 [MAIN] Processo OpenVPN iniciado com PID: ${vpnProcess.pid}`);
        logger.logConnectionStart(profileId, 'user', 'openvpn-userpass');
        resolve({ pid: vpnProcess.pid });

        let connectionEstablished = false;
        let challengeDetected = false;
        let authFailed = false;
        let stdinReady = false;

       // Abrir fifo para escrita
       try {
       } catch (error) {
         console.error('Erro ao abrir FIFO:', error);
         reject(new Error('Falha ao abrir FIFO'));
         return;
       }

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

           // Marcar que stdin está pronto após primeira saída
          if (!stdinReady) {
            stdinReady = true;
            console.log('🔄 OpenVPN stdin pronto para entrada');
          }



          // Detectar falha de auth
          if (output.includes('AUTH_FAILED')) {
            mainWindow.webContents.send('vpn-status', 'Falha de autenticação (usuário/senha incorretos)');
          }

          // ✅ CORREÇÃO: Detectar conexão bem-sucedida
          if ((output.includes('Initialization Sequence Completed') || output.includes('Connected')) && !connectionEstablished) {
           connectionEstablished = true;
           console.log('✅ [MAIN] VPN conectada com sucesso!');
           logger.logConnectionSuccess(profileId, 'user', { pid: vpnProcess.pid });
           mainWindow.webContents.send('vpn-connected', { pid: vpnProcess.pid });

           // Limpar timeouts
           if (connectionTimeout) clearTimeout(connectionTimeout);
           if (challengeTimeout) clearTimeout(challengeTimeout);
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

         // ✅ CORREÇÃO: Detectar desafio também no stderr e verificar stdin pronto
         if ((error.includes('CHALLENGE:') || error.includes('Enter Google Authenticator Token') || error.includes('challenge')) && !challengeDetected && !authFailed && stdinReady) {
           console.log('🔐 Static challenge detectado no stderr!', { error, challengeDetected, authFailed, stdinReady });
           challengeDetected = true;

           let challengeMessage = 'Enter Google Authenticator Token';
           const challengeMatch = error.match(/CHALLENGE:\s*([^\n\r]+)/);
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

           // Log de desconexão
           if (code === 0) {
             logger.logConnectionDisconnect(profileId, 'user', 'normal_exit');
           } else {
             logger.logConnectionDisconnect(profileId, 'user', `exit_code_${code}`);
           }

            // Limpar método de elevação quando a conexão termina
            currentElevationMethod = null;
            currentOvpnPath = null;

           try {
             if (authFilePath && fs.existsSync(authFilePath)) {
               fs.unlinkSync(authFilePath);
               console.log(`🧹 Arquivo de autenticação removido: ${authFilePath}`);
             }
           } catch (e) {
             console.log('Erro ao limpar arquivos:', e.message);
           }


       });

        vpnProcess.on('error', (error) => {
          console.error('❌ Erro ao executar OpenVPN:', error);

          logger.log('CONNECTION', 'PROCESS_SPAWN_ERROR', {
            connectionId,
            profileId,
            errorCode: error.code,
            errorMessage: error.message,
            errno: error.errno,
            syscall: error.syscall,
            command: openvpnCommand,
            argsCount: openvpnArgsFinal.length,
            platform: process.platform,
            elevationStrategy: openvpnCommand === 'pkexec' ? 'pkexec' : openvpnCommand === 'sudo' ? 'sudo' : 'direct'
          }, 'ERROR');

          ipcMain.removeAllListeners('send-challenge-response');
          if (connectionTimeout) clearTimeout(connectionTimeout);
          if (challengeTimeout) clearTimeout(challengeTimeout);

          try {
            if (authFilePath && fs.existsSync(authFilePath)) {
              fs.unlinkSync(authFilePath);
              logger.log('CONNECTION', 'AUTH_FILE_CLEANUP', {
                connectionId,
                authFilePath,
                cleanupSuccess: true
              });
            }
          } catch (cleanupError) {
            logger.logSystemError('AUTH_FILE_CLEANUP_FAILED', cleanupError, {
              connectionId,
              authFilePath
            });
            console.log('Erro ao limpar arquivos:', cleanupError.message);
          }

          let userFriendlyError;
          if (error.code === 'ENOENT') {
            userFriendlyError = 'OpenVPN não encontrado. Certifique-se de que o OpenVPN está instalado.';
            logger.log('CONNECTION', 'OPENVPN_NOT_INSTALLED', {
              connectionId,
              command: openvpnCommand,
              suggestion: 'install_openvpn'
            }, 'ERROR');
          } else if (error.code === 'EACCES' || error.code === 'EPERM') {
            userFriendlyError = 'Permissões insuficientes para executar OpenVPN. Tente executar como administrador.';
            logger.log('CONNECTION', 'INSUFFICIENT_PERMISSIONS', {
              connectionId,
              command: openvpnCommand,
              errorCode: error.code,
              suggestion: 'run_as_admin'
            }, 'ERROR');
          } else if (error.code === 'ENOEXEC') {
            userFriendlyError = 'Erro na execução do comando de elevação. Verifique se pkexec/sudo estão instalados.';
            logger.log('CONNECTION', 'ELEVATION_EXEC_ERROR', {
              connectionId,
              command: openvpnCommand,
              errorCode: error.code,
              suggestion: 'check_elevation_tools'
            }, 'ERROR');
          } else {
            userFriendlyError = `Erro ao executar OpenVPN: ${error.message}`;
            logger.log('CONNECTION', 'UNKNOWN_EXEC_ERROR', {
              connectionId,
              command: openvpnCommand,
              errorCode: error.code,
              errorMessage: error.message
            }, 'ERROR');
          }

          reject(new Error(userFriendlyError));
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
  const profilesPath = USER_PROFILES_PATH;

  try {
    logger.log('PROFILE', 'SAVE_START', {
      profileId,
      ovpnFileName,
      originalOvpnPath,
      profilesPath,
      operation: 'save_ovpn_to_profile'
    });

    // Verificar se arquivo OVPN original existe
    if (!fs.existsSync(originalOvpnPath)) {
      logger.log('PROFILE', 'ORIGINAL_FILE_NOT_FOUND', {
        profileId,
        ovpnFileName,
        originalOvpnPath,
        exists: false
      }, 'ERROR');
      return { success: false, error: `Arquivo OVPN não encontrado: ${originalOvpnPath}` };
    }

    const originalStats = fs.statSync(originalOvpnPath);
    logger.log('PROFILE', 'ORIGINAL_FILE_INFO', {
      profileId,
      originalOvpnPath,
      size: originalStats.size,
      modified: originalStats.mtime.toISOString()
    });

    const processResult = await processAndCopyOvpnFiles(originalOvpnPath, profileId);
    if (!processResult.success) {
      logger.log('PROFILE', 'PROCESS_OVPN_FAILED', {
        profileId,
        ovpnFileName,
        originalOvpnPath,
        error: processResult.error,
        operation: 'process_and_copy_files'
      }, 'ERROR');
      return { success: false, error: processResult.error };
    }

    logger.log('PROFILE', 'OVPN_PROCESS_SUCCESS', {
      profileId,
      ovpnFileName,
      profileDir: processResult.profileDir,
      filesCopied: processResult.filesCopied,
      content: processResult.content ? processResult.content.substring(0, 100) + '...' : null
    });

    console.log(`✅ Perfil salvo: ${profileId}`);
    console.log(`📁 Diretório: ${processResult.profileDir}`);

    // Carregar perfis existentes
    let profiles = [];
    const profilesExistBefore = await fileExists(profilesPath);

    if (profilesExistBefore) {
      const data = await fsAsync.readFile(profilesPath, 'utf-8');
      profiles = JSON.parse(data);
      logger.log('PROFILE', 'EXISTING_PROFILES_LOADED', {
        profileId,
        profilesCount: profiles.length,
        profilesPath
      });
    } else {
      logger.log('PROFILE', 'NO_EXISTING_PROFILES', {
        profileId,
        profilesPath,
        willCreate: true
      });
    }

    const isNew = profiles.findIndex(p => p.id === profileId) === -1;
    const profileIndex = profiles.findIndex(p => p.id === profileId);

    if (profileIndex >= 0) {
      // Atualizar perfil existente
      const oldProfile = { ...profiles[profileIndex] };
      profiles[profileIndex].ovpnFile = path.join(processResult.profileDir, `${profileId}.ovpn`);
      profiles[profileIndex].ovpnFileName = ovpnFileName;
      profiles[profileIndex].profileDir = processResult.profileDir;
      profiles[profileIndex].updatedAt = new Date().toISOString();

      logger.log('PROFILE', 'PROFILE_UPDATED', {
        profileId,
        profileType: 'user',
        oldValues: {
          ovpnFile: oldProfile.ovpnFile,
          ovpnFileName: oldProfile.ovpnFileName,
          updatedAt: oldProfile.updatedAt
        },
        newValues: {
          ovpnFile: profiles[profileIndex].ovpnFile,
          ovpnFileName: ovpnFileName,
          filesCopied: processResult.filesCopied
        }
      });
    } else {
      // Criar novo perfil
      const newProfile = {
        id: profileId,
        name: ovpnFileName,
        type: 'user',
        ovpnFile: path.join(processResult.profileDir, `${profileId}.ovpn`),
        ovpnFileName: ovpnFileName,
        profileDir: processResult.profileDir,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      profiles.push(newProfile);

      logger.log('PROFILE', 'PROFILE_CREATED', {
        profileId,
        profileType: 'user',
        profileName: ovpnFileName,
        ovpnFile: newProfile.ovpnFile,
        profileDir: processResult.profileDir,
        filesCopied: processResult.filesCopied,
        totalProfiles: profiles.length
      });
    }

    // Salvar arquivo de perfis
    const profilesJson = JSON.stringify(profiles, null, 2);
    await fsAsync.writeFile(profilesPath, profilesJson);

    const finalStats = fs.statSync(profilesPath);
    logger.log('PROFILE', 'PROFILES_FILE_SAVED', {
      profileId,
      profilesPath,
      fileSize: finalStats.size,
      profilesCount: profiles.length,
      isNew,
      success: true
    });

    logger.log('PROFILE', 'SAVE_SUCCESS', {
      profileId,
      profileType: 'user',
      isNew,
      filesCopied: processResult.filesCopied,
      profileDir: processResult.profileDir,
      totalProfiles: profiles.length
    });

    return {
      success: true,
      profileDir: processResult.profileDir,
      filesCopied: processResult.filesCopied
    };

  } catch (error) {
    console.error('Erro ao salvar perfil:', error);
    logger.logSystemError('PROFILE_SAVE_EXCEPTION', error, {
      profileId,
      ovpnFileName,
      originalOvpnPath,
      profilesPath,
      errorCode: error.code,
      errorMessage: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-user-profiles', async () => {
  const profilesPath = USER_PROFILES_PATH;
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
  const profilesPath = USER_PROFILES_PATH;
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
  const profilesPath = USER_PROFILES_PATH;
  const profileDir = path.join(PROFILES_DIR, profileId);

  try {
    logger.log('PROFILE', 'DELETE_START', { profileId, profileType: 'user' });

    // Buscar nome do perfil antes de deletar
    let profileName = 'Unknown';
    if (await fileExists(profilesPath)) {
      const profiles = JSON.parse(await fsAsync.readFile(profilesPath, 'utf-8'));
      const profile = profiles.find(p => p.id === profileId);
      if (profile) profileName = profile.name;
    }

    if (await fileExists(profileDir)) {
      await fsAsync.rm(profileDir, { recursive: true, force: true });
      logger.log('PROFILE', 'DIR_REMOVED', { profileId, profileDir });
    }

    if (await fileExists(profilesPath)) {
      let profiles = JSON.parse(await fsAsync.readFile(profilesPath, 'utf-8'));
      profiles = profiles.filter(p => p.id !== profileId);
      await fsAsync.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
    }

    logger.logProfileDelete(profileId, 'user', profileName);
    return { success: true };
  } catch (error) {
    logger.logSystemError('PROFILE_DELETE', error, { profileId, profileType: 'user' });
    return { success: false, error: error.message };
  }
});

// ============ GESTÃO DE CREDENCIAIS SEGURAS ============

ipcMain.handle('save-user-credentials', async (event, profileId, username, password, rememberPassword) => {
  const credentialsPath = USER_CREDENTIALS_PATH;

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
  const credentialsPath = USER_CREDENTIALS_PATH;

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
  const azureProfilesPath = AZURE_PROFILES_PATH;
  const azureOvpnDir = AZURE_PROFILES_DIR;

  try {
    const processResult = await processAndCopyOvpnFiles(originalOvpnPath, profileId, azureOvpnDir);
    if (!processResult.success) {
      return { success: false, error: processResult.error };
    }

    // ✅ SALVAR CONFIGURAÇÕES AZURE EXTRAÍDAS DO ARQUIVO .OVPN
    if (processResult.azureConfig) {
      const configPath = CONFIG_PATH;
      const currentConfig = JSON.parse(await fsAsync.readFile(configPath, 'utf-8'));

      // Atualizar apenas as configurações que foram encontradas no arquivo
      if (processResult.azureConfig.client_id) {
        currentConfig.client_id = processResult.azureConfig.client_id;
        console.log(`💾 Client ID salvo: ${processResult.azureConfig.client_id}`);
      }
      if (processResult.azureConfig.tenant_id) {
        currentConfig.tenant_id = processResult.azureConfig.tenant_id;
        console.log(`💾 Tenant ID salvo: ${processResult.azureConfig.tenant_id}`);
      }
      if (processResult.azureConfig.scope) {
        currentConfig.scope = processResult.azureConfig.scope;
        console.log(`💾 Scope salvo: ${processResult.azureConfig.scope}`);
      }
      if (processResult.azureConfig.server_api) {
        currentConfig.server_api = processResult.azureConfig.server_api;
        console.log(`💾 Server API salvo: ${processResult.server_api}`);
      }

      await fsAsync.writeFile(configPath, JSON.stringify(currentConfig, null, 2));
      console.log(`✅ Configurações Azure salvas no config.json`);
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
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

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
  const defaultsPath = DEFAULT_PROFILES_PATH;
  try {
    await fsAsync.writeFile(defaultsPath, JSON.stringify(defaultProfiles, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-default-profiles', async () => {
  const defaultsPath = DEFAULT_PROFILES_PATH;
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
  const statePath = APP_STATE_PATH;
  try {
    await fsAsync.writeFile(statePath, JSON.stringify(appState, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-app-state', async () => {
  const statePath = APP_STATE_PATH;
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
  const azureProfilesPath = AZURE_PROFILES_PATH;
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
  const azureProfilesPath = AZURE_PROFILES_PATH;
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
  const azureProfilesPath = AZURE_PROFILES_PATH;
  const profileDir = path.join(AZURE_PROFILES_DIR, profileId);

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
  logger.log('AZURE', 'LOGIN_START', { scopes: config.scope });

  const request = {
    scopes: config.scope.split(' '),
    deviceCodeCallback: (deviceCodeResponse) => {
      logger.log('AZURE', 'DEVICE_CODE_GENERATED', {
        verificationUri: deviceCodeResponse.verificationUri,
        userCode: deviceCodeResponse.userCode
      });
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

    logger.logAuthSuccess('azure_device_code', 'azure_ad', {
      username: account.username,
      expiresAt: cache.expires_at
    });

    return { token: accessToken, username: account.username };
  } catch (err) {
    logger.logAuthFailure('azure_device_code', 'azure_ad', err);
    throw new Error(err.message);
  }
});

ipcMain.handle('publish-token', async (event, username, token) => {
  try {
    logger.log('AZURE', 'TOKEN_PUBLISH_START', { username, serverApi: config.server_api });

    await axios.post(config.server_api, { username, jwt_token: token });

    logger.logAzureTokenPublish(username, true, { serverApi: config.server_api });
    return { success: true };
  } catch (err) {
    logger.logAzureTokenPublish(username, false, {
      serverApi: config.server_api,
      error: err.response?.data?.message || err.message
    });
    throw new Error(err.response?.data?.message || err.message);
  }
});

ipcMain.handle('connect-openvpn', async () => {
  console.log(`🔗 [MAIN] connect-openvpn chamado - Timestamp: ${new Date().toISOString()}`);

  // ✅ PROTEÇÃO: Verificar se já há uma conexão ativa
  if (vpnProcess && !vpnProcess.killed) {
    console.log(`⚠️ [MAIN] Conexão Azure já ativa (PID: ${vpnProcess.pid})`);
    throw new Error('Já existe uma conexão VPN ativa');
  }

  let cache;
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch (err) {
    throw new Error('Token não encontrado. Faça login primeiro.');
  }

  const shortID = cache.access_token.substring(0, 16);
  fs.writeFileSync(authPath, `user\n${shortID}`, 'utf-8');

   let openvpnArgs = ['--config', config.openvpn_config, '--auth-user-pass', authPath];

   // ✅ DEFINIR CAMINHO DO ARQUIVO OVPN PARA DESCONEXÃO ESPECÍFICA
   currentOvpnPath = config.openvpn_config;

   // ✅ DEFINIR MÉTODO DE ELEVAÇÃO PARA DESCONEXÃO
   currentElevationMethod = 'sudo';

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

// ============ DESCONEXÃO VPN ROBUSTA ============

// ============ DESCONEXÃO VPN ULTRA FORÇADA ============

// ============ DESCONEXÃO ULTRA SIMPLES E FORÇADA ============

ipcMain.handle('disconnect-openvpn', async (event, pid) => {
  return new Promise(async (resolve, reject) => {
    if (!pid) {
      reject(new Error('PID não fornecido'));
      return;
    }

    // Verificar se processo existe usando ps
    const activeProcesses = await checkActiveOpenVPN();
    const processExists = activeProcesses.some(p => p.pid === pid);

    if (!processExists) {
      logger.logConnectionDisconnect(null, null, 'already_dead');
      resolve({ success: true, message: 'Processo já encerrado' });
      return;
    }

    // Matar processos openvpn com pkexec
    const processesToKill = await checkActiveOpenVPN();
    for (const proc of processesToKill) {
      try {
        await new Promise((resolve, reject) => {
          exec(`pkexec kill -TERM ${proc.pid}`, (error, stdout, stderr) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        logger.logConnectionDisconnect(null, null, 'SIGTERM_pkexec');
      } catch (err) {
        logger.logSystemError('DISCONNECT_PKEXEC_KILL', err, { pid: proc.pid });
      }
    }

    // Aguardar até 5 segundos para encerramento gracioso
    let attempts = 0;
    const checkInterval = setInterval(async () => {
      attempts++;
      const stillActive = (await checkActiveOpenVPN()).length > 0;
      if (!stillActive) {
        clearInterval(checkInterval);
        logger.logConnectionDisconnect(null, null, 'graceful');
        resolve({ success: true, message: 'VPN desconectada com sucesso' });
      } else if (attempts >= 50) { // 5 segundos
        clearInterval(checkInterval);
        // Forçar encerramento
        const stillActiveForce = await checkActiveOpenVPN();
        for (const proc of stillActiveForce) {
          try {
            process.kill(proc.pid, 'SIGKILL');
            logger.logConnectionDisconnect(null, null, 'SIGKILL_forced');
          } catch (killErr) {
            logger.logSystemError('DISCONNECT_FORCE_KILL', killErr, { pid: proc.pid });
          }
        }
        resolve({ success: true, message: 'VPN desconectada forçadamente' });
      }
    }, 100);
  });
});

// ============ FUNÇÕES AUXILIARES ============

ipcMain.handle('validate-openvpn-config', async () => {
  return new Promise(async (resolve) => {
    if (!fs.existsSync(config.openvpn_config)) {
      resolve({ valid: false, error: 'Arquivo de configuração OpenVPN não encontrado' });
      return;
    }

    try {
      const content = fs.readFileSync(config.openvpn_config, 'utf-8');
      const lines = content.split('\n');

      // Verificações básicas
      const hasRemote = lines.some(line => line.trim().startsWith('remote '));
      const hasCa = lines.some(line => line.trim().startsWith('ca '));
      const hasCert = lines.some(line => line.trim().startsWith('cert '));
      const hasKey = lines.some(line => line.trim().startsWith('key '));

      if (!hasRemote) {
        resolve({ valid: false, error: 'Configuração não possui servidor remoto (remote)' });
        return;
      }

      if (!hasCa) {
        resolve({ valid: false, error: 'Configuração não possui certificado CA' });
        return;
      }

      resolve({
        valid: true,
        info: {
          hasRemote,
          hasCa,
          hasCert,
          hasKey,
          lineCount: lines.length
        }
      });
    } catch (error) {
      resolve({ valid: false, error: `Erro ao ler arquivo: ${error.message}` });
    }
  });
});

ipcMain.handle('get-azure-app-config', async () => {
  try {
    logger.log('AZURE', 'GET_CONFIG_START');

    const azureConfig = {
      client_id: config.client_id || '',
      tenant_id: config.tenant_id || '',
      scope: config.scope || '',
      server_api: config.server_api || ''
    };

    logger.log('AZURE', 'GET_CONFIG_SUCCESS', {
      hasClientId: !!azureConfig.client_id,
      hasTenantId: !!azureConfig.tenant_id,
      hasScope: !!azureConfig.scope,
      hasServerApi: !!azureConfig.server_api
    });

    return {
      success: true,
      config: azureConfig
    };
  } catch (error) {
    logger.logSystemError('AZURE_GET_CONFIG_FAILED', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('save-azure-app-config', async (event, newConfig) => {
  try {
    logger.log('AZURE', 'SAVE_CONFIG_START', {
      hasClientId: !!newConfig.client_id,
      hasTenantId: !!newConfig.tenant_id,
      hasScope: !!newConfig.scope,
      hasServerApi: !!newConfig.server_api
    });

    // Validação básica
    if (!newConfig.client_id || !newConfig.tenant_id) {
      logger.log('AZURE', 'SAVE_CONFIG_VALIDATION_FAILED', {
        hasClientId: !!newConfig.client_id,
        hasTenantId: !!newConfig.tenant_id
      }, 'WARN');
      return {
        success: false,
        error: 'Client ID e Tenant ID são obrigatórios'
      };
    }

    // Registrar mudanças
    const changes = {};
    if (config.client_id !== newConfig.client_id) changes.client_id = { old: config.client_id, new: newConfig.client_id };
    if (config.tenant_id !== newConfig.tenant_id) changes.tenant_id = { old: config.tenant_id, new: newConfig.tenant_id };
    if (config.scope !== newConfig.scope) changes.scope = { old: config.scope, new: newConfig.scope };
    if (config.server_api !== newConfig.server_api) changes.server_api = { old: config.server_api, new: newConfig.server_api };

    // Atualizar o objeto config global
    config.client_id = newConfig.client_id;
    config.tenant_id = newConfig.tenant_id;
    config.scope = newConfig.scope || config.scope;
    config.server_api = newConfig.server_api || config.server_api;

    // Salvar no arquivo
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    logger.log('AZURE', 'SAVE_CONFIG_SUCCESS', {
      changes: Object.keys(changes).length,
      changesDetail: changes
    });

    return { success: true };
  } catch (error) {
    logger.logSystemError('AZURE_SAVE_CONFIG_FAILED', error, {
      configKeys: Object.keys(newConfig || {})
    });
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('check-for-updates', async (event, showDialog = true) => {
  try {
    await updaterManager.checkForUpdates(showDialog);
    return { success: true };
  } catch (error) {
    logger.logSystemError('CHECK_UPDATES_FAILED', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await updaterManager.downloadUpdate();
    return { success: true };
  } catch (error) {
    logger.logSystemError('DOWNLOAD_UPDATE_FAILED', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', async () => {
  try {
    await updaterManager.installUpdate();
    return { success: true };
  } catch (error) {
    logger.logSystemError('INSTALL_UPDATE_FAILED', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-update-status', async () => {
  return updaterManager.getStatus();
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



// Handler para logs do renderer
ipcMain.handle('send-renderer-log', async (event, logData) => {
  logger.log(logData.category, logData.action, logData.data, logData.level);
});

ipcMain.on('adjust-window-size', (event, { width, height }) => {
  if (mainWindow) {
    mainWindow.setSize(width, Math.min(height, 800)); // Máximo 800px
  }
});

ipcMain.handle('quit-app', async () => {
  app.quit();
});

ipcMain.handle('minimize-to-tray', async () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// ============ FUNÇÃO PARA SALVAR ESTADO DA APLICAÇÃO ============

async function saveApplicationState() {
  const statePath = APP_STATE_PATH;
  try {
    // Estado básico da aplicação
    const appState = {
      version: app.getVersion(),
      lastSaved: new Date().toISOString(),
      platform: process.platform,
      userData: app.getPath('userData')
    };

    await fsAsync.writeFile(statePath, JSON.stringify(appState, null, 2));
    logger.log('SYSTEM', 'APP_STATE_SAVED', {
      statePath,
      version: appState.version,
      platform: appState.platform
    });
  } catch (error) {
    logger.logSystemError('APP_STATE_SAVE_FAILED', error, { statePath });
  }
}
