// ============ VARIÁVEIS GLOBAIS ============
const statusEl = document.getElementById('status');
const modoUsuarioCheckbox = document.getElementById('modoUsuario');
const modoAzureCheckbox = document.getElementById('modoAzure');
const formUsuario = document.getElementById('formUsuario');
const formAzure = document.getElementById('formAzure');
const btnConectarUsuario = document.getElementById('btnConectarUsuario');
const btnDesconectarUsuario = document.getElementById('btnDesconectarUsuario');
const btnConectarAzure = document.getElementById('btnConectarAzure');
const btnDesconectarAzure = document.getElementById('btnDesconectarAzure');
const btnCopiarCodigo = document.getElementById('btnCopiarCodigo');

// Elementos do Menu e Configurações
const menuBtn = document.getElementById('menuBtn');
const configModal = document.getElementById('configModal');
const configCloseBtn = document.getElementById('configCloseBtn');
const configSaveBtn = document.getElementById('configSaveBtn');

// Elementos do Modo Usuário
const userUsername = document.getElementById('userUsername');
const userPassword = document.getElementById('userPassword');
const currentConfigInfo = document.getElementById('currentConfigInfo');
const currentConfigName = document.getElementById('currentConfigName');
const userLogs = document.getElementById('userLogs');
const rememberCredentials = document.getElementById('rememberCredentials');

// Elementos do Modo Azure
const azureConfigInfo = document.getElementById('azureConfigInfo');
const azureConfigName = document.getElementById('azureConfigName');

// Elementos do Modal de Configuração
const configSelectOvpn = document.getElementById('configSelectOvpn');
const configOvpnInfo = document.getElementById('configOvpnInfo');
const configOvpnName = document.getElementById('configOvpnName');
const configProfilesList = document.getElementById('configProfilesList');
const configSaveProfile = document.getElementById('configSaveProfile');
const configProfileName = document.getElementById('configProfileName');

const configSelectAzureOvpn = document.getElementById('configSelectAzureOvpn');
const configAzureOvpnInfo = document.getElementById('configAzureOvpnInfo');
const configAzureOvpnName = document.getElementById('configAzureOvpnName');
const configAzureProfilesList = document.getElementById('configAzureProfilesList');
const configSaveAzureProfile = document.getElementById('configSaveAzureProfile');
const configAzureProfileName = document.getElementById('configAzureProfileName');

// Estado da Aplicação
let vpnPid = null;
let currentDeviceCodeMessage = null;
let availableUserProfiles = [];
let availableAzureProfiles = [];
let currentUserProfile = null;
let currentAzureProfile = null;
let currentUserOvpnFile = null;
let currentAzureOvpnFile = null;

// Estado 2FA
let requires2FA = false;
let current2FAProfileId = null;

// Elementos 2FA
let twoFAContainer = null;
let twoFAInput = null;
let twoFALabel = null;

// Configurações padrão
let defaultProfiles = {
  userMode: false,
  azureMode: true,
  userProfileId: null,
  azureProfileId: null,
  rememberCredentials: false
};

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Evento antes de fechar a janela
window.addEventListener('beforeunload', async function() {
    await saveApplicationState();
});

async function initializeApp() {
    try {
        console.log('🚀 Inicializando aplicação...');
        
        // Carregar estado salvo da aplicação
        await loadApplicationState();
        
        // Carregar perfis salvos
        await loadUserProfiles();
        await loadAzureProfiles();
        
        // Configurar event listeners
        setupEventListeners();
        
        // Restaurar estado da aplicação
        await restoreApplicationState();
        
        // Configurar estado visual inicial
        const userItem = document.getElementById('modeUserItem');
        const azureItem = document.getElementById('modeAzureItem');
        
        if (modoAzureCheckbox.checked) {
            azureItem.classList.add('active');
        } else if (modoUsuarioCheckbox.checked) {
            userItem.classList.add('active');
        }
        
        // Inicializar interface
        toggleMode();
        
        console.log('✅ Aplicação inicializada com sucesso');
        showStatus('Aplicação carregada com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showStatus('Erro ao inicializar a aplicação', 'alert');
    }
}

// ============ SISTEMA DE PERSISTÊNCIA ============

// Salvar estado completo da aplicação
async function saveApplicationState() {
    try {
        const appState = {
            userMode: modoUsuarioCheckbox.checked,
            azureMode: modoAzureCheckbox.checked,
            userProfileId: currentUserProfile?.id || null,
            azureProfileId: currentAzureProfile?.id || null,
            username: userUsername.value,
            rememberCredentials: rememberCredentials.checked,
            vpnPid: vpnPid,
            lastSaved: new Date().toISOString()
        };
        
        await window.electronAPI.saveAppState(appState);
        console.log('💾 Estado da aplicação salvo com sucesso');
    } catch (error) {
        console.error('❌ Erro ao salvar estado da aplicação:', error);
    }
}

// Carregar estado da aplicação
async function loadApplicationState() {
    try {
        const result = await window.electronAPI.loadAppState();
        if (result.success && result.state) {
            return result.state;
        }
        return {};
    } catch (error) {
        console.error('❌ Erro ao carregar estado da aplicação:', error);
        return {};
    }
}

// Restaurar estado da aplicação
async function restoreApplicationState() {
    try {
        const savedState = await loadApplicationState();
        
        if (Object.keys(savedState).length === 0) {
            console.log('ℹ️ Nenhum estado salvo encontrado, usando configurações padrão');
            return;
        }
        
        console.log('🔄 Restaurando estado da aplicação:', savedState);
        
        // Restaurar modo
        if (savedState.userMode !== undefined) {
            modoUsuarioCheckbox.checked = savedState.userMode;
            modoAzureCheckbox.checked = savedState.azureMode;
            
            const userItem = document.getElementById('modeUserItem');
            const azureItem = document.getElementById('modeAzureItem');
            
            userItem.classList.toggle('active', savedState.userMode);
            azureItem.classList.toggle('active', savedState.azureMode);
        }
        
        // Restaurar perfis ativos
        if (savedState.userProfileId) {
            await setActiveUserProfile(savedState.userProfileId);
        }
        
        if (savedState.azureProfileId) {
            await setActiveAzureProfile(savedState.azureProfileId);
        }
        
        // Restaurar credenciais
        if (savedState.username) {
            userUsername.value = savedState.username;
        }
        
        if (savedState.rememberCredentials !== undefined) {
            rememberCredentials.checked = savedState.rememberCredentials;
        }
        
        // Restaurar estado da VPN
        if (savedState.vpnPid) {
            console.log(`ℹ️ VPN estava conectada com PID: ${savedState.vpnPid}`);
            showStatus('VPN estava conectada anteriormente. Reconecte se necessário.', 'status');
        }
        
        showStatus('✅ Configurações anteriores restauradas com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao restaurar estado da aplicação:', error);
        showStatus('Erro ao restaurar configurações anteriores', 'alert');
    }
}

// ============ CONFIGURAÇÃO DE EVENT LISTENERS ============
function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Menu e Modal
    menuBtn.addEventListener('click', openConfigModal);
    configCloseBtn.addEventListener('click', closeConfigModal);
    configSaveBtn.addEventListener('click', saveAllConfigurations);
    
    // Fechar modal ao clicar fora
    configModal.addEventListener('click', (e) => {
        if (e.target === configModal) closeConfigModal();
    });
    
    // Seleção de Modo
    modoUsuarioCheckbox.addEventListener('change', handleModeChange);
    modoAzureCheckbox.addEventListener('change', handleModeChange);
    
    document.getElementById('modeUserItem').addEventListener('click', function(e) {
        if (e.target.type !== 'checkbox') {
            modoUsuarioCheckbox.checked = !modoUsuarioCheckbox.checked;
            handleModeChange.call(modoUsuarioCheckbox);
        }
    });
    
    document.getElementById('modeAzureItem').addEventListener('click', function(e) {
        if (e.target.type !== 'checkbox') {
            modoAzureCheckbox.checked = !modoAzureCheckbox.checked;
            handleModeChange.call(modoAzureCheckbox);
        }
    });
    
    // Configurações OVPN
    configSelectOvpn.addEventListener('click', () => selectOvpnFile('user'));
    configSelectAzureOvpn.addEventListener('click', () => selectOvpnFile('azure'));
    
    // Opções de Perfil
    configSaveProfile.addEventListener('change', toggleProfileNameField);
    configSaveAzureProfile.addEventListener('change', toggleAzureProfileNameField);
    
    // Conexões
    btnConectarUsuario.addEventListener('click', connectUserVPN);
    btnDesconectarUsuario.addEventListener('click', disconnectUserVPN);
    btnConectarAzure.addEventListener('click', connectAzureVPN);
    btnDesconectarAzure.addEventListener('click', disconnectAzureVPN);
    btnCopiarCodigo.addEventListener('click', copyDeviceCode);
    
    // Credenciais
    rememberCredentials.addEventListener('change', handleRememberCredentials);
    
    // Validação em tempo real
    userUsername.addEventListener('input', validateUserForm);
    userPassword.addEventListener('input', validateUserForm);
    
    // Salvar estado quando houver mudanças importantes
    userUsername.addEventListener('blur', () => saveApplicationState());
    userPassword.addEventListener('blur', () => saveApplicationState());
    
    // Listeners do Electron
    setupElectronListeners();
    
    console.log('✅ Event listeners configurados');
}

function setupElectronListeners() {
    console.log('🔧 Configurando listeners do Electron...');
    
    window.electronAPI.onDeviceCodeResponse((event, data) => {
        console.log('📱 Device code response recebido');
        currentDeviceCodeMessage = `Visite: ${data.verification_uri} e digite o código: ${data.user_code}`;
        showStatus(currentDeviceCodeMessage, 'status');
        btnCopiarCodigo.style.display = 'block';
    });
    
    window.electronAPI.onVPNDisconnected(() => {
        console.log('🔌 VPN desconectada externamente');
        showStatus('VPN desconectada externamente.', 'status');
        vpnPid = null;
        updateConnectionButtons();
        saveApplicationState();
    });
    
    window.electronAPI.onVPNLog((event, log) => {
        console.log('📝 Log VPN recebido:', log);
        if (userLogs.style.display === 'block') {
            addLogEntry(log);
        }
    });

    // Listener para desafios VPN
    setupChallengeListener();
}

// ============ SISTEMA DE DESAFIO INTERATIVO ============

// Configurar listener para desafios VPN
function setupChallengeListener() {
  console.log('🔧 Configurando listener para desafios VPN...');
  
  window.electronAPI.onVPNChallenge((event, challengeData) => {
    console.log('🎯 Desafio VPN recebido:', challengeData);
    
    if (challengeData && challengeData.requiresInput) {
      console.log('📢 Mostrando modal de desafio...');
      showChallengeModal(challengeData.message, challengeData.systemdPrompt || false);
    } else {
      console.warn('⚠️ Desafio recebido sem requiresInput:', challengeData);
    }
  });
  
  console.log('✅ Listener de desafios configurado');
}

// Mostrar modal para desafio
function showChallengeModal(challengeMessage, isSystemdPrompt = false) {
  console.log('🔄 showChallengeModal chamado com:', { challengeMessage, isSystemdPrompt });

  if (challengeData.isSudoPrompt) {
      // Configurar para senha do sudo
      challengeText.textContent = challengeData.message;
      responseInput.type = 'password';
      responseInput.placeholder = 'Digite sua senha de administrador';
      
      submitBtn.onclick = function() {
        const password = responseInput.value.trim();
        if (password) {
          window.electronAPI.sendSudoPassword(password).then(() => {
            closeChallengeModal();
            showStatus('Senha do sudo enviada. Continuando conexão...', 'status');
          });
        }
      };
    } else {
  
          const modalId = 'challengeModal';
          let modal = document.getElementById(modalId);
          
          // Se modal existe, reutilizar
          if (modal) {
            console.log('♻️ Reutilizando modal existente');
            const challengeText = document.getElementById('challengeText');
            if (challengeText) {
              challengeText.textContent = challengeMessage;
            }
            modal.style.display = 'flex';
            return;
          }
          
          console.log('🆕 Criando novo modal');
          
          // Criar novo modal
          modal = document.createElement('div');
          modal.id = modalId;
          modal.className = 'config-modal';
          
          const systemdWarning = isSystemdPrompt ? 
            '<div style="margin-top: 10px; font-size: 0.8rem; color: #ffa000;"><strong>⚠️ Systemd Prompt:</strong> Esta solicitação vem do sistema.</div>' : 
            '';
          
          modal.innerHTML = `
            <div class="config-content" style="max-width: 500px;">
              <h3>🔐 Autenticação de Dois Fatores</h3>
              <div class="challenge-message" style="
                background: rgba(255, 193, 7, 0.1);
                border: 1px solid #ffc107;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
                font-size: 0.9rem;
                color: #ffc107;
              ">
                <strong>Solicitação do Servidor:</strong><br>
                <span id="challengeText">${challengeMessage}</span>
                ${systemdWarning}
              </div>
              <div class="mb-3">
                <label for="challengeResponse" class="form-label">Digite o token 2FA:</label>
                <input type="text" class="form-control" id="challengeResponse" 
                       placeholder="Token do Google Authenticator" autocomplete="one-time-code">
              </div>
              <div class="config-actions">
                <button class="btn btn-success flex-fill" id="submitChallenge">✅ Enviar Token</button>
                <button class="btn btn-danger flex-fill" id="cancelChallenge">❌ Cancelar</button>
              </div>
            </div>
          `;
          
          document.body.appendChild(modal);
          
          // Configurar eventos
          document.getElementById('submitChallenge').addEventListener('click', function() {
            const responseInput = document.getElementById('challengeResponse');
            const response = responseInput ? responseInput.value.trim() : '';
            
            if (!response) {
              showStatus('Por favor, digite o token 2FA', 'alert');
              return;
            }
            
            console.log('📤 Enviando token:', response);
            
            // Usar a API apropriada
            const apiMethod = isSystemdPrompt ? 
              window.electronAPI.sendSystemdChallengeResponse : 
              window.electronAPI.sendChallengeResponse;
            
            apiMethod(response).then(() => {
              console.log('✅ Token enviado com sucesso');
              closeChallengeModal();
              showStatus('Token 2FA enviado. Aguardando autenticação...', 'status');
            }).catch(error => {
              console.error('❌ Erro ao enviar token:', error);
              showStatus('Erro ao enviar token 2FA', 'alert');
            });
          });
          
          document.getElementById('cancelChallenge').addEventListener('click', closeChallengeModal);
          
          // Focar no input
          setTimeout(() => {
            const input = document.getElementById('challengeResponse');
            if (input) input.focus();
          }, 100);
          
          modal.style.display = 'flex';
          console.log('✅ Modal mostrado com sucesso');
    }
}

// Fechar modal de desafio
function closeChallengeModal() {
  const modal = document.getElementById('challengeModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Função para enviar resposta do desafio
async function submitChallengeResponse(isSystemdPrompt = false) {
  const responseInput = document.getElementById('challengeResponse');
  const response = responseInput ? responseInput.value.trim() : '';
  
  if (!response) {
    showStatus('Por favor, digite o token 2FA', 'alert');
    return;
  }
  
  try {
    console.log('📤 Enviando resposta para desafio:', response, 'Systemd:', isSystemdPrompt);
    
    if (isSystemdPrompt) {
      await window.electronAPI.sendSystemdChallengeResponse(response);
    } else {
      await window.electronAPI.sendChallengeResponse(response);
    }
    
    closeChallengeModal();
    showStatus('Token 2FA enviado. Aguardando autenticação...', 'status');
  } catch (error) {
    console.error('Erro ao enviar resposta:', error);
    showStatus('Erro ao enviar token 2FA', 'alert');
  }
}

// ============ GERENCIAMENTO DE MODO ============
function handleModeChange() {
    const userItem = document.getElementById('modeUserItem');
    const azureItem = document.getElementById('modeAzureItem');
    
    if (this.id === 'modoUsuario' && this.checked) {
        modoAzureCheckbox.checked = false;
        userItem.classList.add('active');
        azureItem.classList.remove('active');
    } else if (this.id === 'modoAzure' && this.checked) {
        modoUsuarioCheckbox.checked = false;
        azureItem.classList.add('active');
        userItem.classList.remove('active');
    } else {
        if (!modoUsuarioCheckbox.checked && !modoAzureCheckbox.checked) {
            this.checked = true;
            if (this.id === 'modoUsuario') {
                userItem.classList.add('active');
            } else {
                azureItem.classList.add('active');
            }
        } else {
            userItem.classList.toggle('active', modoUsuarioCheckbox.checked);
            azureItem.classList.toggle('active', modoAzureCheckbox.checked);
        }
    }
    toggleMode();
    saveApplicationState();
}

function toggleMode() {
    if (modoUsuarioCheckbox.checked) {
        formUsuario.style.display = 'block';
        formAzure.style.display = 'none';
        initializeUserMode();
    } else {
        formUsuario.style.display = 'none';
        formAzure.style.display = 'block';
        hide2FAField();
        initializeAzureMode();
    }
    updateConnectionButtons();
}

function initializeUserMode() {
    validateUserForm();
    updateUserConfigDisplay();
}

function initializeAzureMode() {
    updateAzureConfigDisplay();
}

// ============ MODAL DE CONFIGURAÇÕES ============
function openConfigModal() {
    configModal.style.display = 'flex';
    loadConfigModalData();
}

function closeConfigModal() {
    configModal.style.display = 'none';
}

async function loadConfigModalData() {
    try {
        await loadUserProfiles();
        await loadAzureProfiles();
        renderConfigProfiles();
        renderAzureProfiles();
    } catch (error) {
        console.error('Erro ao carregar dados do modal:', error);
        showStatus('Erro ao carregar configurações', 'alert');
    }
}

// ============ SELEÇÃO DE ARQUIVOS OVPN ============
async function selectOvpnFile(mode) {
    try {
        showStatus('Selecionando arquivo OVPN...', 'status');
        
        const result = await window.electronAPI.selectOvpnFile();
        if (result.success) {
            const ovpnFile = {
                path: result.filePath,
                name: result.fileName,
                content: result.content,
                server: extractServerInfo(result.content)
            };
            
            if (mode === 'user') {
                currentUserOvpnFile = ovpnFile;
                configOvpnName.textContent = `${result.fileName} (${ovpnFile.server})`;
                configOvpnInfo.style.display = 'block';
                showStatus(`Arquivo ${result.fileName} selecionado para modo usuário`, 'success');
            } else {
                currentAzureOvpnFile = ovpnFile;
                configAzureOvpnName.textContent = `${result.fileName} (${ovpnFile.server})`;
                configAzureOvpnInfo.style.display = 'block';
                showStatus(`Arquivo ${result.fileName} selecionado para Azure AD`, 'success');
            }
        } else {
            showStatus(`Erro: ${result.error}`, 'alert');
        }
    } catch (error) {
        showStatus(`Erro ao selecionar arquivo: ${error.message}`, 'alert');
    }
}

function extractServerInfo(ovpnContent) {
    const lines = ovpnContent.split('\n');
    for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('remote ')) {
            const parts = trimmed.split(' ');
            if (parts.length >= 2) {
                return `${parts[1]}${parts[2] ? ':' + parts[2] : ''}`;
            }
        }
    }
    return 'Servidor Desconhecido';
}

// ============ SISTEMA DE 2FA ============

// Criar elementos 2FA dinamicamente
function create2FAElements() {
    if (twoFAContainer) return;
    
    twoFAContainer = document.createElement('div');
    twoFAContainer.id = 'twoFAContainer';
    twoFAContainer.className = 'twofa-section';
    twoFAContainer.style.display = 'none';
    
    twoFALabel = document.createElement('label');
    twoFALabel.className = 'form-label';
    twoFALabel.htmlFor = 'twoFAToken';
    twoFALabel.innerHTML = '🔐 Token 2FA';
    
    twoFAInput = document.createElement('input');
    twoFAInput.type = 'password';
    twoFAInput.className = 'form-control';
    twoFAInput.id = 'twoFAToken';
    twoFAInput.placeholder = 'Digite o token de autenticação de dois fatores';
    twoFAInput.autocomplete = 'one-time-code';
    
    const helpText = document.createElement('div');
    helpText.className = 'form-text twofa-help';
    helpText.innerHTML = 'Token temporário do Google Authenticator, Duo, Authy, etc.';
    
    const infoBadge = document.createElement('div');
    infoBadge.className = 'twofa-info-badge';
    infoBadge.innerHTML = '<strong>Autenticação de Dois Fatores</strong><br>Esta VPN requer verificação adicional de segurança';
    infoBadge.style.display = 'none';
    infoBadge.id = 'twoFAInfoBadge';
    
    twoFAContainer.appendChild(twoFALabel);
    twoFAContainer.appendChild(twoFAInput);
    twoFAContainer.appendChild(helpText);
    twoFAContainer.appendChild(infoBadge);
    
    const passwordField = document.getElementById('userPassword');
    if (passwordField && passwordField.parentNode) {
        passwordField.parentNode.insertBefore(twoFAContainer, passwordField.nextSibling);
    }
    
    twoFAInput.addEventListener('input', validateUserForm);
}

// Verificar se o perfil requer 2FA
async function check2FARequirement(profileId) {
    if (!profileId) {
        hide2FAField();
        return;
    }
    
    try {
        showStatus('Verificando requisitos de autenticação...', 'status');
        
        const result = await window.electronAPI.detect2FARequirement(profileId);
        
        if (result.success) {
            requires2FA = result.requires2FA;
            current2FAProfileId = profileId;
            
            if (requires2FA) {
                let promptText = 'Token 2FA';
                if (result.promptText) {
                    promptText = result.promptText.replace(/Enter|Token|:/gi, '').trim();
                    if (!promptText) promptText = 'Token 2FA';
                }
                
                show2FAField(promptText, result.usesEcho);
                showStatus(`✅ VPN configurada com autenticação de dois fatores (${promptText})`, 'success');
                console.log('Static-challenge detectado:', result.staticChallengeMatches);
            } else {
                hide2FAField();
                showStatus('VPN usando autenticação padrão', 'status');
            }
        } else {
            hide2FAField();
            console.error('Erro ao verificar 2FA:', result.error);
        }
    } catch (error) {
        hide2FAField();
        console.error('Erro ao verificar requisitos 2FA:', error);
    }
}

// Mostrar campo 2FA
function show2FAField(promptText = 'Token 2FA', usesEcho = false) {
    if (!twoFAContainer) {
        create2FAElements();
    }
    
    if (twoFALabel) {
        twoFALabel.innerHTML = `🔐 ${promptText}`;
    }
    
    if (twoFAInput) {
        if (usesEcho) {
            twoFAInput.placeholder = `Digite ${promptText.toLowerCase()} (visível)`;
            twoFAInput.type = 'text';
        } else {
            twoFAInput.placeholder = `Digite ${promptText.toLowerCase()}`;
            twoFAInput.type = 'password';
        }
    }
    
    const infoBadge = document.getElementById('twoFAInfoBadge');
    if (infoBadge) {
        infoBadge.style.display = 'block';
    }
    
    twoFAContainer.style.display = 'block';
    twoFAInput.required = true;
    
    twoFAContainer.classList.add('active');
    
    twoFAContainer.classList.add('highlight');
    setTimeout(() => {
        twoFAContainer.classList.remove('highlight');
    }, 2000);
}

// Esconder campo 2FA
function hide2FAField() {
    if (twoFAContainer) {
        twoFAContainer.style.display = 'none';
        twoFAInput.required = false;
        twoFAInput.value = '';
        twoFAContainer.classList.remove('active');
    }
    requires2FA = false;
    current2FAProfileId = null;
}

// Obter credenciais completas
function getCompleteCredentials() {
    const username = userUsername.value.trim();
    const password = userPassword.value;
    const twoFAToken = requires2FA ? twoFAInput.value.trim() : '';
    
    if (requires2FA && twoFAToken) {
        return {
            username: username,
            password: password + twoFAToken,
            has2FA: true
        };
    }
    
    return {
        username: username,
        password: password,
        has2FA: false
    };
}

// ============ GERENCIAMENTO DE PERFIS ============
async function loadUserProfiles() {
    try {
        const result = await window.electronAPI.loadUserProfiles();
        if (result.success) {
            availableUserProfiles = result.profiles;
        }
    } catch (error) {
        console.error('Erro ao carregar perfis:', error);
    }
}

async function loadAzureProfiles() {
    try {
        const result = await window.electronAPI.loadAzureProfiles();
        if (result.success) {
            availableAzureProfiles = result.profiles;
        }
    } catch (error) {
        console.error('Erro ao carregar perfis Azure:', error);
    }
}

function renderConfigProfiles() {
    configProfilesList.innerHTML = '';

    if (availableUserProfiles.length === 0) {
        configProfilesList.innerHTML = '<div class="empty-state">Nenhum perfil salvo</div>';
        return;
    }

    availableUserProfiles.forEach(profile => {
        const profileElement = document.createElement('div');
        profileElement.className = `profile-item ${currentUserProfile?.id === profile.id ? 'active' : ''}`;
        
        const serverInfo = profile.server ? 
            `<div class="profile-server">🌐 ${profile.server}</div>` : '';
        
        const ovpnInfo = profile.ovpnFileName ?
            `<div class="profile-ovpn">📁 ${profile.ovpnFileName}</div>` :
            '<div class="profile-warning">⚠️ Sem arquivo OVPN</div>';

        const credentialsInfo = profile.username ?
            `<div class="profile-credentials">🔑 Credenciais salvas</div>` :
            '<div class="profile-warning">🔒 Sem credenciais</div>';

        profileElement.innerHTML = `
            <div class="profile-info">
                <div class="profile-name">${profile.name}</div>
                <div class="profile-username">👤 ${profile.username || 'Não configurado'}</div>
                ${serverInfo}
                ${ovpnInfo}
                ${credentialsInfo}
            </div>
            <div class="profile-actions">
                <button class="profile-connect" onclick="setActiveUserProfile('${profile.id}')">Ativar</button>
                <button class="profile-delete" onclick="deleteUserProfile('${profile.id}')">×</button>
            </div>
        `;
        configProfilesList.appendChild(profileElement);
    });
}

function renderAzureProfiles() {
    configAzureProfilesList.innerHTML = '';

    if (availableAzureProfiles.length === 0) {
        configAzureProfilesList.innerHTML = '<div class="empty-state">Nenhum perfil Azure salvo</div>';
        return;
    }

    availableAzureProfiles.forEach(profile => {
        const profileElement = document.createElement('div');
        profileElement.className = `profile-item ${currentAzureProfile?.id === profile.id ? 'active' : ''}`;
        
        profileElement.innerHTML = `
            <div class="profile-info">
                <div class="profile-name">${profile.name}</div>
                <div class="profile-ovpn">📁 ${profile.ovpnFileName}</div>
                <div class="profile-server">🌐 Azure AD</div>
            </div>
            <div class="profile-actions">
                <button class="profile-connect" onclick="setActiveAzureProfile('${profile.id}')">Ativar</button>
                <button class="profile-delete" onclick="deleteAzureProfile('${profile.id}')">×</button>
            </div>
        `;
        configAzureProfilesList.appendChild(profileElement);
    });
}

// ============ OPERAÇÕES DE PERFIL ============
async function setActiveUserProfile(profileId) {
    const profile = availableUserProfiles.find(p => p.id === profileId);
    if (profile) {
        currentUserProfile = profile;
        updateUserConfigDisplay();
        closeConfigModal();
        
        await check2FARequirement(profileId);
        
        await loadUserCredentials(profileId);
        validateUserForm();
        
        saveApplicationState();
        
        showStatus(`Perfil "${profile.name}" ativado!`, 'success');
    }
}

async function setActiveAzureProfile(profileId) {
    const profile = availableAzureProfiles.find(p => p.id === profileId);
    if (profile) {
        currentAzureProfile = profile;
        updateAzureConfigDisplay();
        closeConfigModal();
        showStatus(`Perfil Azure "${profile.name}" ativado!`, 'success');
        
        saveApplicationState();
    }
}

async function deleteUserProfile(profileId) {
    const profile = availableUserProfiles.find(p => p.id === profileId);
    if (!profile) return;
    
    if (confirm(`Tem certeza que deseja excluir o perfil "${profile.name}"?`)) {
        try {
            await window.electronAPI.deleteUserProfile(profileId);
            await loadUserProfiles();
            renderConfigProfiles();
            
            if (currentUserProfile && currentUserProfile.id === profileId) {
                currentUserProfile = null;
                updateUserConfigDisplay();
                saveApplicationState();
            }
            
            showStatus('Perfil excluído com sucesso!', 'success');
        } catch (error) {
            showStatus(`Erro ao excluir perfil: ${error.message}`, 'alert');
        }
    }
}

async function deleteAzureProfile(profileId) {
    const profile = availableAzureProfiles.find(p => p.id === profileId);
    if (!profile) return;
    
    if (confirm(`Tem certeza que deseja excluir o perfil Azure "${profile.name}"?`)) {
        try {
            await window.electronAPI.deleteAzureProfile(profileId);
            await loadAzureProfiles();
            renderAzureProfiles();
            
            if (currentAzureProfile && currentAzureProfile.id === profileId) {
                currentAzureProfile = null;
                updateAzureConfigDisplay();
                saveApplicationState();
            }
            
            showStatus('Perfil Azure excluído com sucesso!', 'success');
        } catch (error) {
            showStatus(`Erro ao excluir perfil: ${error.message}`, 'alert');
        }
    }
}

// ============ GESTÃO DE CREDENCIAIS ============
function handleRememberCredentials() {
    if (this.checked && currentUserProfile) {
        saveUserCredentials();
    }
    saveApplicationState();
}

async function saveUserCredentials() {
    if (!currentUserProfile) return;
    
    const username = userUsername.value.trim();
    const password = userPassword.value;
    const remember = rememberCredentials.checked;
    
    if (!username) {
        showStatus('Digite um usuário para salvar as credenciais', 'alert');
        return;
    }
    
    try {
        const result = await window.electronAPI.saveUserCredentials(
            currentUserProfile.id,
            username,
            password,
            remember
        );
        
        if (result.success) {
            currentUserProfile.username = username;
            await window.electronAPI.saveUserProfile(currentUserProfile);
            
            if (remember) {
                showStatus('Credenciais salvas com sucesso!', 'success');
            } else {
                showStatus('Usuário salvo (senha não armazenada)', 'success');
            }
            
            await loadUserProfiles();
            renderConfigProfiles();
            
            saveApplicationState();
        }
    } catch (error) {
        showStatus(`Erro ao salvar credenciais: ${error.message}`, 'alert');
    }
}

async function loadUserCredentials(profileId) {
    try {
        const result = await window.electronAPI.loadUserCredentials(profileId);
        if (result.success && result.credentials) {
            const creds = result.credentials;
            
            userUsername.value = creds.username || '';
            
            if (creds.rememberPassword && creds.password) {
                userPassword.value = creds.password;
                rememberCredentials.checked = true;
                showStatus('Credenciais carregadas automaticamente', 'success');
            } else {
                userPassword.value = '';
                rememberCredentials.checked = false;
            }
        } else {
            userUsername.value = currentUserProfile?.username || '';
            userPassword.value = '';
            rememberCredentials.checked = false;
        }
    } catch (error) {
        console.error('Erro ao carregar credenciais:', error);
    }
}

// ============ SALVAR CONFIGURAÇÕES ============
async function saveAllConfigurations() {
    try {
        let savedCount = 0;
        
        if (currentUserOvpnFile && configSaveProfile.checked && configProfileName.value.trim()) {
            await saveUserProfile();
            savedCount++;
        }
        
        if (currentAzureOvpnFile && configSaveAzureProfile.checked && configAzureProfileName.value.trim()) {
            await saveAzureProfile(); // ← Esta função estava faltando
            savedCount++;
        }
        
        if (savedCount > 0) {
            showStatus(`${savedCount} configuração(ões) salva(s) com sucesso!`, 'success');
            await loadConfigModalData();
            setTimeout(closeConfigModal, 1500);
        } else {
            showStatus('Nenhuma configuração para salvar', 'alert');
        }
        
    } catch (error) {
        showStatus(`Erro ao salvar configurações: ${error.message}`, 'alert');
    }
}

// ADICIONE ESTA FUNÇÃO QUE ESTAVA FALTANDO
async function saveAzureProfile() {
    const profileName = configAzureProfileName.value.trim();
    if (!profileName || !currentAzureOvpnFile) return;

    const profile = {
        id: generateId(),
        name: profileName,
        ovpnFileName: currentAzureOvpnFile.name,
        server: currentAzureOvpnFile.server,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        // Salvar configuração Azure
        const saveResult = await window.electronAPI.saveAzureConfig(
            profile.id,
            currentAzureOvpnFile.content,
            currentAzureOvpnFile.name,
            currentAzureOvpnFile.path
        );

        if (saveResult.success) {
            // Salvar perfil Azure
            const profileResult = await window.electronAPI.saveAzureProfile(profile);
            if (profileResult.success) {
                showStatus(`Perfil Azure "${profileName}" salvo com sucesso!`, 'success');
                await setActiveAzureProfile(profile.id);
            } else {
                showStatus(`Erro ao salvar perfil Azure: ${profileResult.error}`, 'alert');
            }
        } else {
            showStatus(`Erro ao salvar configuração Azure: ${saveResult.error}`, 'alert');
        }
    } catch (error) {
        showStatus(`Erro ao salvar perfil Azure: ${error.message}`, 'alert');
    }
}

async function saveUserProfile() {
    const profileName = configProfileName.value.trim();
    if (!profileName || !currentUserOvpnFile) return;

    const profile = {
        id: generateId(),
        name: profileName,
        username: userUsername.value.trim(),
        ovpnFileName: currentUserOvpnFile.name,
        server: currentUserOvpnFile.server,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const saveResult = await window.electronAPI.saveUserProfile(profile);
    if (saveResult.success) {
        showStatus(`Perfil "${profileName}" salvo com sucesso!`, 'success');
        await setActiveUserProfile(profile.id);
    } else {
        showStatus(`Erro ao salvar perfil: ${saveResult.error}`, 'alert');
    }
}

// ============ CONEXÕES VPN ============
async function connectUserVPN() {
    const credentials = getCompleteCredentials();
    
    if (!credentials.username || !credentials.password) {
        showStatus('Por favor, preencha usuário e senha.', 'alert');
        return;
    }

    if (!currentUserProfile) {
        showStatus('Por favor, selecione um perfil ativo primeiro.', 'alert');
        return;
    }

    try {
        btnConectarUsuario.disabled = true;
        btnDesconectarUsuario.disabled = false;
        
        const statusMsg = requires2FA ? 
            `Conectando ao perfil "${currentUserProfile.name}" com autenticação de dois fatores...` :
            `Conectando ao perfil "${currentUserProfile.name}"...`;
            
        showStatus(statusMsg, 'status');
        
        userLogs.innerHTML = '';
        userLogs.style.display = 'block';

        if (rememberCredentials.checked) {
            await saveUserCredentials();
        }

        console.log('Enviando credenciais para VPN:', {
            profile: currentUserProfile.name,
            username: credentials.username,
            has2FA: credentials.has2FA,
            passwordLength: credentials.password.length
        });

        const result = await window.electronAPI.connectOpenVPNUserPassProfile(
            currentUserProfile.id, 
            credentials.username, 
            credentials.password
        );

        vpnPid = result.pid;
        
        const successMsg = requires2FA ?
            `Conectado ao perfil "${currentUserProfile.name}" com autenticação de dois fatores! PID: ${vpnPid}` :
            `Conectado ao perfil "${currentUserProfile.name}"! PID: ${vpnPid}`;
            
        showStatus(successMsg, 'success');
        saveApplicationState();

        if (requires2FA && twoFAInput) {
            twoFAInput.value = '';
        }

    } catch (err) {
        showStatus(`Erro: ${err.message}`, 'alert');
        btnConectarUsuario.disabled = false;
        btnDesconectarUsuario.disabled = true;
        
        if (requires2FA && twoFAInput && err.message.includes('AUTH_FAILED')) {
            twoFAInput.focus();
        }
    }
}

async function disconnectUserVPN() {
    try {
        if (vpnPid) {
            await window.electronAPI.disconnectOpenVPN(vpnPid);
            showStatus(`VPN desconectada (PID: ${vpnPid})`, 'status');
            vpnPid = null;
        } else {
            showStatus('Nenhuma conexão ativa encontrada.', 'status');
        }
        
        btnConectarUsuario.disabled = false;
        btnDesconectarUsuario.disabled = true;
        userLogs.style.display = 'none';
        
        if (twoFAInput) {
            twoFAInput.value = '';
        }
        
        saveApplicationState();
    } catch (err) {
        showStatus(`Erro ao desconectar: ${err.message}`, 'alert');
    }
}

async function connectAzureVPN() {
    try {
        showStatus('Iniciando login Azure...', 'status');
        btnCopiarCodigo.style.display = 'none';

        const { token, username } = await window.electronAPI.loginAzure();
        showStatus(`Login realizado: ${username}`, 'status');

        await window.electronAPI.publishToken(username, token);
        showStatus('Token publicado. Conectando...', 'status');

        const { pid, shortID } = await window.electronAPI.connectOpenVPN();
        vpnPid = pid;
        showStatus(`Conectado! PID: ${pid}, ID: ${shortID}`, 'success');
        btnCopiarCodigo.style.display = 'none';

        updateConnectionButtons();
        saveApplicationState();
    } catch (err) {
        showStatus(`Erro: ${err.message}`, 'alert');
        btnCopiarCodigo.style.display = 'none';
    }
}

async function disconnectAzureVPN() {
    try {
        if (vpnPid) {
            await window.electronAPI.disconnectOpenVPN(vpnPid);
            showStatus(`VPN desconectada (PID: ${vpnPid})`, 'status');
            vpnPid = null;
        } else {
            showStatus('Nenhuma conexão ativa encontrada.', 'status');
        }
        updateConnectionButtons();
        btnCopiarCodigo.style.display = 'none';
        saveApplicationState();
    } catch (err) {
        showStatus(`Erro ao desconectar: ${err.message}`, 'alert');
    }
}

// ============ FUNÇÕES AUXILIARES ============
function updateConnectionButtons() {
    const isConnected = vpnPid !== null;
    
    if (modoUsuarioCheckbox.checked) {
        btnConectarUsuario.disabled = isConnected || !isUserFormValid();
        btnDesconectarUsuario.disabled = !isConnected;
    } else {
        btnConectarAzure.disabled = isConnected;
        btnDesconectarAzure.disabled = !isConnected;
    }
}

function updateUserConfigDisplay() {
    if (currentUserProfile) {
        currentConfigName.textContent = `${currentUserProfile.name} (${currentUserProfile.server || 'Servidor'})`;
        currentConfigInfo.style.display = 'block';
    } else {
        currentConfigInfo.style.display = 'none';
    }
}

function updateAzureConfigDisplay() {
    if (currentAzureProfile) {
        azureConfigName.textContent = currentAzureProfile.name;
        azureConfigInfo.style.display = 'block';
    } else {
        azureConfigInfo.style.display = 'none';
    }
}

function validateUserForm() {
    updateConnectionButtons();

    if (twoFAInput) {
        if (requires2FA && !twoFAInput.value.trim()) {
            twoFAInput.classList.add('is-invalid');
        } else {
            twoFAInput.classList.remove('is-invalid');
        }
    }
}

function isUserFormValid() {
    const credentials = getCompleteCredentials();
    const hasBasicCredentials = credentials.username && credentials.password;
    const has2FAIfRequired = !requires2FA || (requires2FA && twoFAInput.value.trim());
    
    return hasBasicCredentials && has2FAIfRequired && currentUserProfile;
}

function toggleProfileNameField() {
    configProfileName.style.display = this.checked ? 'block' : 'none';
}

function toggleAzureProfileNameField() {
    configAzureProfileName.style.display = this.checked ? 'block' : 'none';
}

function addLogEntry(log) {
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    logLine.textContent = log;
    userLogs.appendChild(logLine);
    userLogs.scrollTop = userLogs.scrollHeight;
}

async function copyDeviceCode() {
    if (currentDeviceCodeMessage) {
        const regex = /código:\s*([A-Z0-9]+)/;
        const match = currentDeviceCodeMessage.match(regex);
        let codeToCopy = currentDeviceCodeMessage;

        if (match && match[1]) {
            codeToCopy = match[1];
        }

        try {
            await navigator.clipboard.writeText(codeToCopy);
            const originalText = statusEl.textContent;
            statusEl.textContent = `Código "${codeToCopy}" copiado!`;
            setTimeout(() => {
                statusEl.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error("Falha ao copiar:", err);
            statusEl.textContent = 'Falha ao copiar.';
            setTimeout(() => {
                statusEl.textContent = currentDeviceCodeMessage;
            }, 2000);
        }
    }
}

async function submitChallengeResponse(isSystemdPrompt = false) {
  const responseInput = document.getElementById('challengeResponse');
  const response = responseInput ? responseInput.value.trim() : '';
  
  if (!response) {
    showStatus('Por favor, digite o token 2FA', 'alert');
    return;
  }
  
  try {
    console.log('📤 Enviando resposta para desafio:', response, 'Systemd:', isSystemdPrompt);
    
    if (isSystemdPrompt) {
      // Usar a nova API para systemd
      await window.electronAPI.sendSystemdChallengeResponse(response);
    } else {
      // Usar a API original para static challenge
      await window.electronAPI.sendChallengeResponse(response);
    }
    
    closeChallengeModal();
    showStatus('Token 2FA enviado. Aguardando autenticação...', 'status');
  } catch (error) {
    console.error('Erro ao enviar resposta:', error);
    showStatus('Erro ao enviar token 2FA', 'alert');
  }
}

function showStatus(message, type = 'status') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
}

function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
