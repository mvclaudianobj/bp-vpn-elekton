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

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Carregar perfis salvos
        await loadUserProfiles();
        await loadAzureProfiles();
        
        // Configurar event listeners
        setupEventListeners();
        
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
        
        console.log('Aplicação inicializada com sucesso');
    } catch (error) {
        console.error('Erro na inicialização:', error);
        showStatus('Erro ao inicializar a aplicação', 'alert');
    }
}

// ============ CONFIGURAÇÃO DE EVENT LISTENERS ============
function setupEventListeners() {
    // Menu e Modal
    menuBtn.addEventListener('click', openConfigModal);
    configCloseBtn.addEventListener('click', closeConfigModal);
    configSaveBtn.addEventListener('click', saveAllConfigurations);
    
    // Fechar modal ao clicar fora
    configModal.addEventListener('click', (e) => {
        if (e.target === configModal) closeConfigModal();
    });
    
    // Seleção de Modo - NOVO com elementos de container
    modoUsuarioCheckbox.addEventListener('change', handleModeChange);
    modoAzureCheckbox.addEventListener('change', handleModeChange);
    
    // Adicionar eventos de clique nos containers também
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
    
    // Listeners do Electron
    setupElectronListeners();
}

function setupElectronListeners() {
    window.electronAPI.onDeviceCodeResponse((event, data) => {
        currentDeviceCodeMessage = `Visite: ${data.verification_uri} e digite o código: ${data.user_code}`;
        showStatus(currentDeviceCodeMessage, 'status');
        btnCopiarCodigo.style.display = 'block';
    });
    
    window.electronAPI.onVPNDisconnected(() => {
        showStatus('VPN desconectada externamente.', 'status');
        vpnPid = null;
        updateConnectionButtons();
    });
    
    window.electronAPI.onVPNLog((event, log) => {
        if (userLogs.style.display === 'block') {
            addLogEntry(log);
        }
    });
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
        // Se desmarcou ambos, manter pelo menos um marcado
        if (!modoUsuarioCheckbox.checked && !modoAzureCheckbox.checked) {
            this.checked = true;
            if (this.id === 'modoUsuario') {
                userItem.classList.add('active');
            } else {
                azureItem.classList.add('active');
            }
        } else {
            // Atualizar estados visuais
            userItem.classList.toggle('active', modoUsuarioCheckbox.checked);
            azureItem.classList.toggle('active', modoAzureCheckbox.checked);
        }
    }
    toggleMode();
}

function toggleMode() {
    if (modoUsuarioCheckbox.checked) {
        formUsuario.style.display = 'block';
        formAzure.style.display = 'none';
        initializeUserMode();
    } else {
        formUsuario.style.display = 'none';
        formAzure.style.display = 'block';
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
        showStatus(`Perfil "${profile.name}" ativado!`, 'success');
        
        // Carregar credenciais salvas
        await loadUserCredentials(profileId);
        validateUserForm();
    }
}

function setActiveAzureProfile(profileId) {
    const profile = availableAzureProfiles.find(p => p.id === profileId);
    if (profile) {
        currentAzureProfile = profile;
        updateAzureConfigDisplay();
        closeConfigModal();
        showStatus(`Perfil Azure "${profile.name}" ativado!`, 'success');
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
            // Atualizar perfil com o nome de usuário
            currentUserProfile.username = username;
            await window.electronAPI.saveUserProfile(currentUserProfile);
            
            if (remember) {
                showStatus('Credenciais salvas com sucesso!', 'success');
            } else {
                showStatus('Usuário salvo (senha não armazenada)', 'success');
            }
            
            // Recarregar lista de perfis para atualizar visual
            await loadUserProfiles();
            renderConfigProfiles();
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
            // Limpar campos se não houver credenciais salvas
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
        
        // Salvar perfil de usuário
        if (currentUserOvpnFile && configSaveProfile.checked && configProfileName.value.trim()) {
            await saveUserProfile();
            savedCount++;
        }
        
        // Salvar perfil Azure
        if (currentAzureOvpnFile && configSaveAzureProfile.checked && configAzureProfileName.value.trim()) {
            await saveAzureProfile();
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
        const ovpnResult = await window.electronAPI.saveOvpnToProfile(
            profile.id,
            currentUserOvpnFile.content,
            currentUserOvpnFile.name,
            currentUserOvpnFile.path
        );
        
        if (ovpnResult.success) {
            showStatus(`Perfil "${profileName}" salvo com sucesso! (${ovpnResult.filesCopied} arquivos copiados)`, 'success');
            
            // Definir como perfil ativo automaticamente
            setActiveUserProfile(profile.id);
        } else {
            showStatus(`Perfil salvo, mas erro nos arquivos: ${ovpnResult.error}`, 'alert');
        }
    } else {
        showStatus(`Erro ao salvar perfil: ${saveResult.error}`, 'alert');
    }
}

async function saveAzureProfile() {
    const profileName = configAzureProfileName.value.trim();
    if (!profileName || !currentAzureOvpnFile) {
        showStatus('Digite um nome para o perfil Azure', 'alert');
        return;
    }

    const profileId = generateId();
    
    // Salvar configuração OVPN para Azure
    const saveResult = await window.electronAPI.saveAzureConfig(
        profileId,
        currentAzureOvpnFile.content,
        currentAzureOvpnFile.name,
        currentAzureOvpnFile.path
    );
    
    if (saveResult.success) {
        // Salvar perfil Azure
        const azureProfile = {
            id: profileId,
            name: profileName,
            ovpnFileName: currentAzureOvpnFile.name,
            server: currentAzureOvpnFile.server,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const profileResult = await window.electronAPI.saveAzureProfile(azureProfile);
        
        if (profileResult.success) {
            showStatus(`Perfil Azure "${profileName}" salvo com sucesso!`, 'success');
            
            // Definir como perfil ativo automaticamente
            setActiveAzureProfile(profileId);
        }
    } else {
        showStatus(`Erro ao salvar perfil Azure: ${saveResult.error}`, 'alert');
    }
}

// ============ CONEXÕES VPN ============
async function connectUserVPN() {
    const username = userUsername.value.trim();
    const password = userPassword.value;

    if (!username || !password) {
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
        showStatus(`Conectando ao perfil "${currentUserProfile.name}"...`, 'status');
        
        userLogs.innerHTML = '';
        userLogs.style.display = 'block';

        // Salvar credenciais se o checkbox estiver marcado
        if (rememberCredentials.checked) {
            await saveUserCredentials();
        }

        const result = await window.electronAPI.connectOpenVPNUserPassProfile(
            currentUserProfile.id, 
            username, 
            password
        );

        vpnPid = result.pid;
        showStatus(`Conectado ao perfil "${currentUserProfile.name}"! PID: ${vpnPid}`, 'success');

    } catch (err) {
        showStatus(`Erro: ${err.message}`, 'alert');
        btnConectarUsuario.disabled = false;
        btnDesconectarUsuario.disabled = true;
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
}

function isUserFormValid() {
    return userUsername.value.trim() && userPassword.value && currentUserProfile;
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

function showStatus(message, type = 'status') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
}

function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}
