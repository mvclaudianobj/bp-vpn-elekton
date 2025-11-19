const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Autenticação Azure
  loginAzure: () => ipcRenderer.invoke('login-azure'),
  publishToken: (username, token) => ipcRenderer.invoke('publish-token', username, token),
  
  // Conexões VPN
  connectOpenVPN: () => ipcRenderer.invoke('connect-openvpn'),
  disconnectOpenVPN: (pid) => ipcRenderer.invoke('disconnect-openvpn', pid),
  connectOpenVPNUserPassProfile: (profileId, username, password) => 
    ipcRenderer.invoke('connect-openvpn-userpass-profile', profileId, username, password),
  
  // Gestão de Arquivos
  selectOvpnFile: () => ipcRenderer.invoke('select-ovpn-file'),
  validateOpenVPNConfig: () => ipcRenderer.invoke('validate-openvpn-config'),
  
  // Perfis Usuário
  loadUserProfiles: () => ipcRenderer.invoke('load-user-profiles'),
  saveUserProfile: (profile) => ipcRenderer.invoke('save-user-profile', profile),
  deleteUserProfile: (profileId) => ipcRenderer.invoke('delete-user-profile', profileId),
  saveOvpnToProfile: (profileId, ovpnContent, ovpnFileName, originalOvpnPath) => 
    ipcRenderer.invoke('save-ovpn-to-profile', profileId, ovpnContent, ovpnFileName, originalOvpnPath),
  
  // Credenciais
  saveUserCredentials: (profileId, username, password, rememberPassword) => 
    ipcRenderer.invoke('save-user-credentials', profileId, username, password, rememberPassword),
  loadUserCredentials: (profileId) => ipcRenderer.invoke('load-user-credentials', profileId),
  
  // Perfis Azure
  saveAzureConfig: (profileId, ovpnContent, ovpnFileName, originalOvpnPath) => 
    ipcRenderer.invoke('save-azure-config', profileId, ovpnContent, ovpnFileName, originalOvpnPath),
  loadAzureProfiles: () => ipcRenderer.invoke('load-azure-profiles'),
  saveAzureProfile: (profile) => ipcRenderer.invoke('save-azure-profile', profile),
  deleteAzureProfile: (profileId) => ipcRenderer.invoke('delete-azure-profile', profileId),
  
  // Configurações
  getCurrentConfig: () => ipcRenderer.invoke('get-current-config'),
  
  // Event Listeners
  onDeviceCodeResponse: (callback) => ipcRenderer.on('device-code-response', callback),
  onVPNDisconnected: (callback) => ipcRenderer.on('vpn-disconnected', callback),
  onVPNLog: (callback) => ipcRenderer.on('vpn-log', callback),
});
