// Mock require for browser
window.require = (module) => {
  if (module === 'electron') {
    return { ipcRenderer: window.ipcRenderer };
  }
  if (module === 'fs') {
    return {
      existsSync: (path) => {
        console.log('Mock fs.existsSync:', path);
        return false; // Assume file doesn't exist in browser
      },
      readFileSync: (path, encoding) => {
        console.log('Mock fs.readFileSync:', path, encoding);
        return 'Mock log content for debugging';
      },
      watchFile: (path, options, callback) => {
        console.log('Mock fs.watchFile:', path);
        // No-op in browser
      }
    };
  }
  if (module === 'path') {
    return {
      join: (...args) => {
        console.log('Mock path.join:', ...args);
        return args.join('/');
      },
      dirname: (path) => {
        console.log('Mock path.dirname:', path);
        return path.split('/').slice(0, -1).join('/');
      }
    };
  }
  throw new Error(`Module ${module} not mocked for browser debugging`);
};

// Debug mocks for Electron APIs
window.electronAPI = {
  // Autenticação Azure
  loginAzure: async () => {
    console.log('Mock: loginAzure called');
    return { token: 'mock-token', username: 'mock-user' };
  },
  publishToken: async (username, token) => {
    console.log('Mock: publishToken called', username, token);
    return { success: true };
  },

  // Conexões VPN
  connectOpenVPN: async () => {
    console.log('Mock: connectOpenVPN called');
    return { pid: 12345, shortID: 'mock-id' };
  },
  disconnectOpenVPN: async (pid) => {
    console.log('Mock: disconnectOpenVPN called', pid);
    return { success: true };
  },
  killVPNConnection: async () => {
    console.log('Mock: killVPNConnection called');
    return { success: true };
  },
  connectOpenVPNUserPassProfile: async (profileId, username, password) => {
    console.log('Mock: connectOpenVPNUserPassProfile called', profileId, username);
    return { pid: 12345 };
  },

  // Gestão de Arquivos
  selectOvpnFile: async () => {
    console.log('Mock: selectOvpnFile called');
    return { success: true, fileName: 'mock.ovpn', filePath: '/mock/path', content: 'mock content' };
  },
  validateOpenVPNConfig: async () => {
    console.log('Mock: validateOpenVPNConfig called');
    return { success: true };
  },

  // Perfis Usuário
  loadUserProfiles: async () => {
    console.log('Mock: loadUserProfiles called');
    return { success: true, profiles: [
      { id: 'profile_123', name: 'Perfil Mock', ovpnFileName: 'mock.ovpn', type: 'user' }
    ]};
  },
  saveUserProfile: async (profile) => {
    console.log('Mock: saveUserProfile called', profile);
    return { success: true };
  },
  deleteUserProfile: async (profileId) => {
    console.log('Mock: deleteUserProfile called', profileId);
    return { success: true };
  },
  saveOvpnToProfile: async (profileId, ovpnContent, ovpnFileName, originalOvpnPath) => {
    console.log('Mock: saveOvpnToProfile called', profileId, ovpnFileName);
    return { success: true };
  },

  // Credenciais
  saveUserCredentials: async (profileId, username, password, rememberPassword) => {
    console.log('Mock: saveUserCredentials called', profileId, username);
    return { success: true };
  },
  loadUserCredentials: async (profileId) => {
    console.log('Mock: loadUserCredentials called', profileId);
    return { success: true, credentials: { username: 'mock-user', password: 'mock-pass', rememberPassword: false } };
  },

  // Perfis Azure
  saveAzureConfig: async (profileId, ovpnContent, ovpnFileName, originalOvpnPath) => {
    console.log('Mock: saveAzureConfig called', profileId, ovpnFileName);
    return { success: true };
  },
  loadAzureProfiles: async () => {
    console.log('Mock: loadAzureProfiles called');
    return { success: true, profiles: [
      { id: 'azure_123', name: 'Perfil Azure Mock', ovpnFileName: 'mock-azure.ovpn', type: 'azure' }
    ]};
  },
  saveAzureProfile: async (profile) => {
    console.log('Mock: saveAzureProfile called', profile);
    return { success: true };
  },
  deleteAzureProfile: async (profileId) => {
    console.log('Mock: deleteAzureProfile called', profileId);
    return { success: true };
  },

  // Configurações
  getCurrentConfig: async () => {
    console.log('Mock: getCurrentConfig called');
    return { success: true, config: {} };
  },
  quitApp: async () => {
    console.log('Mock: quitApp called');
    alert('App would quit here');
  },
  getAzureAppConfig: async () => {
    console.log('Mock: getAzureAppConfig called');
    return { success: true, config: { client_id: 'mock-id', tenant_id: 'mock-tenant' } };
  },
  saveAzureAppConfig: async (config) => {
    console.log('Mock: saveAzureAppConfig called', config);
    return { success: true };
  },

  // Estado da aplicação
  saveAppState: async (appState) => {
    console.log('Mock: saveAppState called', appState);
    return { success: true };
  },
  loadAppState: async () => {
    console.log('Mock: loadAppState called');
    return { success: true, state: { lastProfileId: 'profile_123' } };
  },

  // Sistema de atualizações
  checkForUpdates: async (showDialog) => {
    console.log('Mock: checkForUpdates called', showDialog);
    return { success: true };
  },
  downloadUpdate: async () => {
    console.log('Mock: downloadUpdate called');
    return { success: true };
  },
  installUpdate: async () => {
    console.log('Mock: installUpdate called');
    return { success: true };
  },
  getUpdateStatus: async () => {
    console.log('Mock: getUpdateStatus called');
    return { success: true, status: 'ready' };
  },

  // Detecção 2FA
  detect2FARequirement: async (profileId) => {
    console.log('Mock: detect2FARequirement called', profileId);
    return { success: true, requires2FA: false };
  },

  // Desafio de autenticação
  sendChallengeResponse: async (response) => {
    console.log('Mock: sendChallengeResponse called', response);
    return { success: true };
  },
  sendSudoPassword: async (password) => {
    console.log('Mock: sendSudoPassword called', password);
    return { success: true };
  },

  // Eventos (mocks simples)
  onVPNDisconnected: (callback) => {
    console.log('Mock: onVPNDisconnected registered');
  },
  onVPNConnected: (callback) => {
    console.log('Mock: onVPNConnected registered');
  },
  onVPNLog: (callback) => {
    console.log('Mock: onVPNLog registered');
  },
  onUpdateAvailable: (callback) => {
    console.log('Mock: onUpdateAvailable registered');
  },
  onUpdateProgress: (callback) => {
    console.log('Mock: onUpdateProgress registered');
  },
  onUpdateDownloaded: (callback) => {
    console.log('Mock: onUpdateDownloaded registered');
  },
  onUpdateError: (callback) => {
    console.log('Mock: onUpdateError registered');
  },
  onUpdateCheckComplete: (callback) => {
    console.log('Mock: onUpdateCheckComplete registered');
  },
  onDeviceCodeResponse: (callback) => {
    console.log('Mock: onDeviceCodeResponse registered');
  },
  onVpnChallenge: (callback) => {
    console.log('Mock: onVpnChallenge registered');
  },

  // Minimizar para tray
  minimizeToTray: async () => {
    console.log('Mock: minimizeToTray called');
    alert('App would minimize to tray');
  },

  // Obter versão da aplicação
  getVersion: async () => {
    console.log('Mock: getVersion called');
    return '0.0.5-debug';
  },

  // Logs da aplicação
  getAppLogs: async () => {
    console.log('Mock: getAppLogs called');
    return { success: true, logs: '[2025-12-18T15:00:00.000Z] INFO [SYSTEM] MOCK_LOG: This is a mock log entry for debugging.' };
  },

  // Simulação de progresso de atualização
  simulateUpdateProgress: () => {
    console.log('Mock: Starting update progress simulation');
    let percent = 0;
    const interval = setInterval(() => {
      percent += Math.random() * 10;
      if (percent > 100) percent = 100;

      const progress = {
        percent: Math.round(percent),
        speed: Math.round(Math.random() * 500 + 100), // KB/s
        transferred: Math.round(percent * 10 / 100), // MB
        total: 10 // MB
      };

      // Trigger the progress event
      if (window.electronAPI._onUpdateProgressCallback) {
        window.electronAPI._onUpdateProgressCallback(progress);
      }

      if (percent >= 100) {
        clearInterval(interval);
        console.log('Mock: Update progress simulation complete');
      }
    }, 500);
  }
};

// Mock para ipcRenderer (se usado diretamente)
window.ipcRenderer = {
  send: (channel, ...args) => console.log('Mock ipcRenderer.send:', channel, ...args),
  invoke: async (channel, ...args) => {
    console.log('Mock ipcRenderer.invoke:', channel, ...args);
    return { success: true };
  },
  on: (channel, callback) => console.log('Mock ipcRenderer.on:', channel),
  removeAllListeners: (channel) => console.log('Mock ipcRenderer.removeAllListeners:', channel)
};

// Adicionar event listener para simulação de progresso
document.addEventListener('DOMContentLoaded', () => {
  const simulateBtn = document.getElementById('simulateProgressBtn');
  if (simulateBtn) {
    simulateBtn.addEventListener('click', () => {
      window.electronAPI.simulateUpdateProgress();
    });
  }
});

console.log('🔧 Debug mocks loaded - Electron APIs simulated for browser debugging');