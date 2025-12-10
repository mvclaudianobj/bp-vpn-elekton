// ============ TESTE SIMPLES ============

console.log('🔧 RENDERER.JS CARREGADO!');

// ============ IPC HANDLERS ============
const { ipcRenderer } = require('electron');

ipcRenderer.on('vpn-status', (event, message) => {
  showStatus(message, 'alert');
});

ipcRenderer.on('vpn-log', (event, log) => {
  // Garantir que log seja string
  const logStr = typeof log === 'string' ? log : JSON.stringify(log);
  // Adicionar ao logs em tempo real
  if (typeof connectionLogsText !== 'undefined') {
    connectionLogsText += logStr;
  }
  // Se modal estiver aberto, atualizar e rolar
  if (logsModal && logsModal.classList.contains('show') && logsModalContent) {
    logsModalContent.textContent += logStr;
    logsModalContent.scrollTop = logsModalContent.scrollHeight;
  }
});

ipcRenderer.on('vpn-status-check', (event, data) => {
  if (data.active) {
    vpnPid = data.processes[0].pid; // Assumir primeiro
    showStatus('VPN detectada ativa (PID: ' + vpnPid + ')', 'success');
    updateConnectionButtons();
  }
});

// Ajustar tamanho da janela dinamicamente
function adjustWindowSize() {
  const body = document.body;
  const height = body.scrollHeight + 20; // Margem
  const width = 500; // Largura fixa
  ipcRenderer.send('adjust-window-size', { width, height });
}

// Chamar após mudanças no DOM
const observer = new MutationObserver(adjustWindowSize);
observer.observe(document.body, { childList: true, subtree: true });

// Ajustar inicialmente
window.addEventListener('load', () => {
  setTimeout(adjustWindowSize, 100);
});

// Teste básico do botão menu
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM CARREGADO!');

    const menuBtn = document.getElementById('menuBtn');
    const configModal = document.getElementById('configModal');

    console.log('🔍 menuBtn encontrado:', !!menuBtn);
    console.log('🔍 configModal encontrado:', !!configModal);

    if (menuBtn) {
        menuBtn.addEventListener('click', function() {
            console.log('🖱️ BOTÃO MENU CLICADO!');
            //alert('Botão menu clicado!');

            if (configModal) {
                configModal.style.display = configModal.style.display === 'block' ? 'none' : 'block';
                console.log('🔄 Modal display:', configModal.style.display);
            } else {
                alert('Modal não encontrado!');
            }
        });
        console.log('✅ Event listener adicionado');
    } else {
        console.error('❌ menuBtn não encontrado');
        alert('menuBtn não encontrado!');
    }
});

// ============ ELEMENTOS DA INTERFACE ============

// Elementos da Interface Unificada
const statusEl = document.getElementById('status');
const profileSelect = document.getElementById('profileSelect');
const selectedProfileInfo = document.getElementById('selectedProfileInfo');
const profileIcon = document.getElementById('profileIcon');
const profileName = document.getElementById('profileName');
const profileType = document.getElementById('profileType');
const profileDetails = document.getElementById('profileDetails');
const credentialsSection = document.getElementById('credentialsSection');
const btnConectar = document.getElementById('btnConectar');
const btnDesconectar = document.getElementById('btnDesconectar');
// Logs armazenados em memória (removidos da interface principal)
let connectionLogsText = '';

// Watcher para arquivo de logs
let logWatcher = null;
const btnCopiarCodigo = document.getElementById('btnCopiarCodigo');

// Elementos do Menu e Configurações
const menuBtn = document.getElementById('menuBtn');
const configModal = document.getElementById('configModal');
const configCloseBtn = document.getElementById('configCloseBtn');

// Elementos de Credenciais
const userUsername = document.getElementById('userUsername');
const userPassword = document.getElementById('userPassword');
const rememberCredentials = document.getElementById('rememberCredentials');

// Elementos de Configuração
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

// Botões de configuração
const configSaveUserProfile = document.getElementById('configSaveUserProfile');
const configSaveAzureProfileBtn = document.getElementById('configSaveAzureProfileBtn');

// Elementos de atualização
const updateBtn = document.getElementById('updateBtn');
const updateModal = document.getElementById('updateModal');
const updateCloseBtn = document.getElementById('updateCloseBtn');

// Elementos de Device Code (Azure)
const deviceCodeSection = document.getElementById('deviceCodeSection');
const verificationUri = document.getElementById('verificationUri');
const userCode = document.getElementById('userCode');

// Elementos de Logs
const logsBtn = document.getElementById('logsBtn');
const logsModal = document.getElementById('logsModal');
const logsCloseBtn = document.getElementById('logsCloseBtn');
const logsModalContent = document.getElementById('logsModalContent');

const clearLogsBtn = document.getElementById('clearLogsBtn');
const closeLogsModalBtn = document.getElementById('closeLogsModalBtn');

// ============ VARIÁVEIS GLOBAIS ============

// Estado da aplicação unificado
let vpnPid = null;
let currentProfile = null; // Perfil selecionado atualmente
let allProfiles = []; // Todos os perfis disponíveis (user + azure)

// Estado de atualização
let updateInfo = null;

// Estado de arquivos selecionados
let selectedOvpnFile = null;
let selectedAzureOvpnFile = null;

// Estado do device code (Azure)
let currentDeviceCode = null;

// ============ SISTEMA DE LOGGING DO RENDERER ============

// Função para enviar logs do renderer para o main process
function logToMain(category, action, data = {}, level = 'INFO') {
    if (window.electronAPI && window.electronAPI.sendLog) {
        window.electronAPI.sendLog({ category, action, data, level });
    }
}

// Capturar erros globais
window.addEventListener('error', function(event) {
    logToMain('RENDERER', 'GLOBAL_ERROR', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? event.error.stack : null
    }, 'ERROR');
});

// Capturar erros de promise não tratadas
window.addEventListener('unhandledrejection', function(event) {
    logToMain('RENDERER', 'UNHANDLED_PROMISE_REJECTION', {
        reason: event.reason,
        promise: event.promise
    }, 'ERROR');
});

// Sobrescrever console methods para capturar logs
const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug
};

console.log = function(...args) {
    logToMain('RENDERER', 'CONSOLE_LOG', { args: args }, 'INFO');
    originalConsole.log.apply(console, args);
};

console.info = function(...args) {
    logToMain('RENDERER', 'CONSOLE_INFO', { args: args }, 'INFO');
    originalConsole.info.apply(console, args);
};

console.warn = function(...args) {
    logToMain('RENDERER', 'CONSOLE_WARN', { args: args }, 'WARN');
    originalConsole.warn.apply(console, args);
};

console.error = function(...args) {
    logToMain('RENDERER', 'CONSOLE_ERROR', { args: args }, 'ERROR');
    originalConsole.error.apply(console, args);
};

console.debug = function(...args) {
    logToMain('RENDERER', 'CONSOLE_DEBUG', { args: args }, 'INFO');
    originalConsole.debug.apply(console, args);
};

// ============ INICIALIZAÇÃO ============

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Carregado - Iniciando aplicação...');
    try {
        initializeApp();
    } catch (error) {
        console.error('❌ Erro na inicialização do renderer:', error);
        logToMain('RENDERER', 'INIT_ERROR', {
            message: error.message,
            stack: error.stack
        }, 'ERROR');
    }
});

function setupEventListeners() {
    console.log('🎧 Configurando event listeners...');

    // Debug detalhado dos elementos
    console.log('🔍 DEBUG ELEMENTOS DOM:');
    console.log('  menuBtn:', document.getElementById('menuBtn'));
    console.log('  configModal:', document.getElementById('configModal'));
    console.log('  profileSelect:', document.getElementById('profileSelect'));
    console.log('  btnConectar:', document.getElementById('btnConectar'));

    // Verificar se elementos críticos existem
    const criticalElements = ['menuBtn', 'configModal', 'profileSelect', 'closeBtn', 'minimizeBtn'];
    const missingElements = criticalElements.filter(id => !document.getElementById(id));

    if (missingElements.length > 0) {
        console.error('❌ Elementos críticos não encontrados:', missingElements);
        logToMain('RENDERER', 'MISSING_ELEMENTS', { missingElements }, 'ERROR');
    } else {
        console.log('✅ Todos os elementos críticos encontrados');
    }

    // Seleção de perfil unificado
    if (profileSelect) {
        profileSelect.addEventListener('change', handleProfileSelection);
    }

    // Conexões unificadas
    if (btnConectar) {
        btnConectar.addEventListener('click', handleConnect);
    }
    if (btnDesconectar) {
        btnDesconectar.addEventListener('click', handleDisconnect);
    }
    if (btnCopiarCodigo) {
        btnCopiarCodigo.addEventListener('click', copyDeviceCode);
    }

    // Campos de entrada para validação em tempo real
    if (userUsername) {
        userUsername.addEventListener('input', updateConnectionButtons);
    }
    if (userPassword) {
        userPassword.addEventListener('input', updateConnectionButtons);
    }

    // Menu e configurações
    if (menuBtn) {
        menuBtn.addEventListener('click', toggleConfigModal);
    } else {
        logToMain('RENDERER', 'ELEMENT_NOT_FOUND', { element: 'menuBtn' }, 'ERROR');
    }

    // Botão de minimizar para tray
    const minimizeBtn = document.getElementById('minimizeBtn');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', async () => {
            try {
                await window.electronAPI.minimizeToTray();
                logToMain('RENDERER', 'MINIMIZE_TO_TRAY_CLICKED', {}, 'INFO');
            } catch (error) {
                console.error('Erro ao minimizar para tray:', error);
                logToMain('RENDERER', 'MINIMIZE_TO_TRAY_ERROR', { error: error.message }, 'ERROR');
            }
        });
    } else {
        logToMain('RENDERER', 'ELEMENT_NOT_FOUND', { element: 'minimizeBtn' }, 'ERROR');
    }

    // Botão de logs
    if (logsBtn) {
        logsBtn.addEventListener('click', toggleLogsModal);
        console.log('✅ Event listener adicionado ao logsBtn');
    } else {
        console.error('❌ logsBtn não encontrado!');
        logToMain('RENDERER', 'ELEMENT_NOT_FOUND', { element: 'logsBtn' }, 'ERROR');
    }

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', clearLogs);
    }

    // Modal de logs
    if (logsCloseBtn) {
        logsCloseBtn.addEventListener('click', closeLogsModal);
    }
    if (closeLogsModalBtn) {
        closeLogsModalBtn.addEventListener('click', closeLogsModal);
    }


    if (configCloseBtn) {
        configCloseBtn.addEventListener('click', function(event) {
            console.log('🖱️ Botão fechar clicado!', event);
            logToMain('RENDERER', 'CLOSE_BUTTON_CLICKED', {
                button: configCloseBtn.outerHTML,
                eventType: event.type,
                target: event.target.id
            });
            console.log('🔒 Chamando closeConfigModal...');
            closeConfigModal();
            console.log('✅ closeConfigModal chamado');
        });
        console.log('✅ Event listener adicionado ao configCloseBtn');
        logToMain('RENDERER', 'CLOSE_BUTTON_LISTENER_ADDED', {});
    } else {
        console.error('❌ configCloseBtn não encontrado!');
        logToMain('RENDERER', 'CLOSE_BUTTON_NOT_FOUND', {}, 'ERROR');
    }

    // Configurações
    if (configSelectOvpn) {
        configSelectOvpn.addEventListener('click', handleOvpnFileSelection);
    }
    if (configSaveProfile) {
        configSaveProfile.addEventListener('change', handleSaveProfileCheckbox);
    }
    if (configSaveUserProfile) {
        configSaveUserProfile.addEventListener('click', saveUserProfileConfig);
    }
    if (configSelectAzureOvpn) {
        configSelectAzureOvpn.addEventListener('click', handleAzureOvpnFileSelection);
    }
    if (configSaveAzureProfile) {
        configSaveAzureProfile.addEventListener('change', handleSaveAzureProfileCheckbox);
    }
    if (configSaveAzureProfileBtn) {
        configSaveAzureProfileBtn.addEventListener('click', saveAzureProfileConfig);
    }

    // Atualizações
    if (updateBtn) {
      updateBtn.addEventListener('click', checkForUpdates);
      console.log('✅ Event listener adicionado ao updateBtn');
    } else {
      console.error('❌ updateBtn não encontrado!');
      logToMain('RENDERER', 'ELEMENT_NOT_FOUND', { element: 'updateBtn' }, 'ERROR');
    }

    const closeBtn = document.getElementById('closeBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.electronAPI.quitApp();
      });
      console.log('✅ Event listener adicionado ao closeBtn');
    } else {
      console.error('❌ closeBtn não encontrado!');
      logToMain('RENDERER', 'ELEMENT_NOT_FOUND', { element: 'closeBtn' }, 'ERROR');
    }
    if (updateCloseBtn) {
        updateCloseBtn.addEventListener('click', closeUpdateModal);
    }

    // Cliques fora do modal para fechar
    window.addEventListener('click', function(event) {
        if (event.target === configModal) {
            closeConfigModal();
        }
        if (event.target === logsModal) {
            closeLogsModal();
        }
        if (event.target === updateModal) {
            closeUpdateModal();
        }
    });
}

async function initializeApp() {
    try {
        console.log('🚀 Inicializando aplicação...');
        logToMain('RENDERER', 'INIT_START', {});

        // Aguardar APIs ficarem disponíveis
        if (!window.electronAPI) {
            console.log('🔄 Aguardando electronAPI...');
            setTimeout(() => initializeApp(), 500);
            return;
        }

        // Verificar se APIs estão disponíveis
        console.log('🔍 Verificando APIs disponíveis:');
        console.log('  window.electronAPI:', !!window.electronAPI);
        if (window.electronAPI) {
            console.log('  loadUserProfiles:', !!window.electronAPI.loadUserProfiles);
            console.log('  loadAzureProfiles:', !!window.electronAPI.loadAzureProfiles);
        }

        // Inicializar elementos de atualização
        initializeUpdateElements();

        // Configurar event listeners primeiro
        setupEventListeners();

        // Carregar perfis salvos unificados
        await loadAllProfiles();

        // Verificar atualizações automaticamente
        checkForUpdatesOnStartup();

        // Restaurar estado da aplicação
        await restoreApplicationState();

        console.log('✅ Aplicação inicializada com sucesso');
        logToMain('RENDERER', 'INIT_SUCCESS', {});
        showStatus('Aplicação carregada com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        logToMain('RENDERER', 'INIT_ERROR', {
            message: error.message,
            stack: error.stack
        }, 'ERROR');
        showStatus('Erro ao inicializar a aplicação', 'alert');
    }
}

// ============ GESTÃO DE PERFIS ============

async function loadAllProfiles() {
    try {
        if (!window.electronAPI) {
            throw new Error('window.electronAPI not available');
        }
        // Carregar perfis de usuário
        const userResult = await window.electronAPI.loadUserProfiles();
        const userProfiles = userResult.success ? userResult.profiles || [] : [];

        // Carregar perfis Azure
        const azureResult = await window.electronAPI.loadAzureProfiles();
        const azureProfiles = azureResult.success ? azureResult.profiles || [] : [];

        // Unificar todos os perfis
        allProfiles = [
            ...userProfiles.map(p => ({ ...p, type: 'user', icon: '🔐', typeLabel: 'Usuário/Senha' })),
            ...azureProfiles.map(p => ({ ...p, type: 'azure', icon: '🌐', typeLabel: 'Azure AD' }))
        ];

        console.log(`✅ Carregados ${allProfiles.length} perfis totais (${userProfiles.length} usuário, ${azureProfiles.length} Azure)`);

        // Popular o select de perfis
        populateProfileSelect();

        // Carregar último perfil usado
        await loadLastProfile();

        // Popular listas de configuração
        populateConfigProfilesList();

    } catch (error) {
        console.error('❌ Erro ao carregar perfis:', error);
        allProfiles = [];
    }
}

async function loadLastProfile() {
    try {
        const result = await window.electronAPI.loadAppState();
        if (result.success && result.state.lastProfileId) {
            const lastProfileId = result.state.lastProfileId;
            const option = profileSelect.querySelector(`option[value*="${lastProfileId}"]`);
            if (option) {
                profileSelect.value = option.value;
                profileSelect.dispatchEvent(new Event('change'));
            }
        }
    } catch (error) {
        console.error('Erro ao carregar último perfil:', error);
    }
}

function populateProfileSelect() {
    if (!profileSelect) return;

    // Limpar opções existentes exceto a primeira
    while (profileSelect.options.length > 1) {
        profileSelect.remove(1);
    }

    // Adicionar perfis
    allProfiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = `${profile.type}:${profile.id}`;
        option.textContent = `${profile.icon} ${profile.name}`;
        profileSelect.appendChild(option);
    });

    console.log(`📋 Select populado com ${allProfiles.length} perfis`);
}

function populateConfigProfilesList() {
    if (!configProfilesList) return;

    configProfilesList.innerHTML = '';

    allProfiles.filter(p => p.type === 'user').forEach(profile => {
        const li = document.createElement('li');
        li.className = 'profile-item';
        li.innerHTML = `
            <div class="profile-info">
                <strong>${profile.name}</strong>
                <small>${profile.ovpnFileName || 'Arquivo não especificado'}</small>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteProfile('${profile.id}', 'user')">Excluir</button>
        `;
        configProfilesList.appendChild(li);
    });

    if (!configAzureProfilesList) return;

    configAzureProfilesList.innerHTML = '';

    allProfiles.filter(p => p.type === 'azure').forEach(profile => {
        const li = document.createElement('li');
        li.className = 'profile-item';
        li.innerHTML = `
            <div class="profile-info">
                <strong>${profile.name}</strong>
                <small>${profile.ovpnFileName || 'Arquivo não especificado'}</small>
            </div>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteProfile('${profile.id}', 'azure')">Excluir</button>
        `;
        configAzureProfilesList.appendChild(li);
    });
}

// ============ SELEÇÃO E GESTÃO DE PERFIS ============

function handleProfileSelection() {
    const selectedValue = profileSelect.value;
    if (!selectedValue) {
        currentProfile = null;
        updateProfileDisplay();
        updateConnectionButtons();
        return;
    }

    const [type, id] = selectedValue.split(':');
    const profile = allProfiles.find(p => p.type === type && p.id === id);

    if (profile) {
        currentProfile = profile;
        console.log(`🎯 Perfil selecionado: ${profile.name} (${profile.typeLabel})`);

        // Carregar credenciais salvas para perfis de usuário
        if (profile.type === 'user') {
            loadSavedCredentials(profile.id);
        }

        updateProfileDisplay();
        updateConnectionButtons();
    }
}

async function loadSavedCredentials(profileId) {
    try {
        const result = await window.electronAPI.loadUserCredentials(profileId);
        if (result.success && result.credentials) {
            if (userUsername) userUsername.value = result.credentials.username || '';
            if (userPassword) userPassword.value = result.credentials.password || '';
            if (rememberCredentials) rememberCredentials.checked = result.credentials.rememberPassword || false;
            console.log('🔑 Credenciais carregadas para perfil:', profileId);
            // Atualizar botões após carregar credenciais
            updateConnectionButtons();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar credenciais:', error);
    }
}

function updateProfileDisplay() {
    if (!selectedProfileInfo || !profileIcon || !profileName || !profileType || !profileDetails) return;

    if (currentProfile) {
        profileIcon.textContent = currentProfile.icon;
        profileName.textContent = currentProfile.name;
        profileType.textContent = currentProfile.typeLabel;
        profileType.className = `profile-type-badge ${currentProfile.type}`;

        // Detalhes específicos do perfil
        let details = '';
        if (currentProfile.type === 'user') {
            details = `Arquivo: ${currentProfile.ovpnFileName || 'N/A'}`;
        } else if (currentProfile.type === 'azure') {
            details = `Arquivo: ${currentProfile.ovpnFileName || 'N/A'}`;
        }
        profileDetails.textContent = details;

        selectedProfileInfo.style.display = 'block';

        // Mostrar/esconder seção de credenciais
        if (credentialsSection) {
            credentialsSection.style.display = currentProfile.type === 'user' ? 'block' : 'none';
        }

        // Seção de device code sempre escondida por padrão (aparece apenas durante login)
        if (deviceCodeSection) {
            deviceCodeSection.style.display = 'none';
        }
    } else {
        selectedProfileInfo.style.display = 'none';
        if (credentialsSection) {
            credentialsSection.style.display = 'none';
        }
        if (deviceCodeSection) {
            deviceCodeSection.style.display = 'none';
        }
    }
}

function updateConnectionButtons() {
    const isConnected = vpnPid !== null;
    const hasValidProfile = currentProfile !== null;

    if (btnConectar) {
        btnConectar.disabled = isConnected || !hasValidProfile ||
                              (currentProfile?.type === 'user' && !isUserFormValid());
    }
    if (btnDesconectar) {
        btnDesconectar.disabled = !isConnected;
    }

    // Travar seleção de perfil durante conexão
    if (profileSelect) {
        profileSelect.disabled = isConnected;
    }
}

function isUserFormValid() {
    return currentProfile?.type === 'user' &&
           userUsername && userPassword &&
           userUsername.value.trim() !== '' &&
           userPassword.value !== '';
}

// ============ CONEXÃO VPN ============

async function handleConnect() {
    // ✅ PROTEÇÃO: Verificar se há uma conexão em andamento
    if (vpnPid !== null) {
        showStatus('Já existe uma conexão VPN ativa', 'alert');
        return;
    }

    if (!currentProfile) {
        showStatus('Por favor, selecione um perfil primeiro.', 'alert');
        return;
    }

    try {
        btnConectar.disabled = true;
        btnDesconectar.disabled = false;
        // Travar seleção de perfil durante todo o processo de conexão
        if (profileSelect) profileSelect.disabled = true;
        showStatus(`Iniciando conexão ao perfil "${currentProfile.name}"...`, 'status');

        // Limpar logs de conexão (armazenados em memória)
        connectionLogsText = '';
        console.log('📝 [RENDERER] Logs de conexão limpos');

        if (currentProfile.type === 'user') {
            // Conexão usuário/senha
            const username = userUsername.value.trim();
            const password = userPassword.value;

            if (!username || !password) {
                throw new Error('Usuário e senha são obrigatórios');
            }

            const result = await window.electronAPI.connectOpenVPNUserPassProfile(
                currentProfile.id,
                username,
                password
            );

            vpnPid = result.pid;
            console.log(`🔌 [RENDERER] VPN PID definido: ${vpnPid}`);
            showStatus(`Conectado com sucesso! PID: ${vpnPid}`, 'success');

            // Salvar credenciais se "Lembrar credenciais" estiver marcado
            if (rememberCredentials && rememberCredentials.checked) {
                await window.electronAPI.saveUserCredentials(
                    currentProfile.id,
                    username,
                    password,
                    true
                );
                console.log('💾 Credenciais salvas para perfil:', currentProfile.id);
            }

            // Esconder elementos desnecessários quando conectado
            hideConnectionElements();

        } else if (currentProfile.type === 'azure') {
            // Conexão Azure AD
            const { token, username } = await window.electronAPI.loginAzure();
            showStatus(`Login realizado: ${username}`, 'status');

            await window.electronAPI.publishToken(username, token);
            showStatus('Token publicado. Conectando...', 'status');

            const { pid, shortID } = await window.electronAPI.connectOpenVPN();
            vpnPid = pid;
            showStatus(`Conectado com sucesso! PID: ${pid}`, 'success');

            // Salvar último perfil usado
            await window.electronAPI.saveAppState({ lastProfileId: currentProfile.id });

            // Esconder elementos desnecessários quando conectado
            hideConnectionElements();
        }

        saveApplicationState();

    } catch (err) {
        console.log(`❌ [RENDERER] Erro na conexão: ${err.message}`);
        vpnPid = null; // Garantir que vpnPid seja limpo em caso de erro
        // Destravar seleção de perfil em caso de erro
        if (profileSelect) profileSelect.disabled = false;
        showStatus(`Erro: ${err.message}`, 'alert');
        updateConnectionButtons();
    }
}

async function handleDisconnect() {
    console.log(`🔌 [RENDERER] Botão desconectar clicado. VPN PID atual: ${vpnPid}`);

    try {
        if (vpnPid) {
            console.log(`🔌 [RENDERER] Enviando solicitação de desconexão para PID: ${vpnPid}`);
            const result = await window.electronAPI.disconnectOpenVPN(vpnPid);
            console.log(`🔌 [RENDERER] Resultado da desconexão:`, result);
            showStatus('VPN desconectada com sucesso!', 'status');
            vpnPid = null;
            // Limpar status após desconectar
            setTimeout(() => {
                if (statusEl) statusEl.style.display = 'none';
            }, 3000);

            // Destravar seleção de perfil
            if (profileSelect) profileSelect.disabled = false;

            // Mostrar elementos de conexão novamente
            showConnectionElements();
        } else {
            console.log(`🔌 [RENDERER] Nenhum VPN PID encontrado`);
            showStatus('Nenhuma conexão ativa encontrada.', 'status');
        }

        updateConnectionButtons();



        saveApplicationState(); // SALVAR ESTADO APÓS DESCONEXÃO
    } catch (err) {
        console.error('❌ Erro na desconexão:', err);
        showStatus(`Erro na desconexão: ${err.message}`, 'alert');
    }
}

// ============ CONFIGURAÇÕES ============

function toggleConfigModal() {
    if (configModal) {
        const isVisible = configModal.classList.contains('show');

        if (isVisible) {
            configModal.classList.remove('show');
        } else {
            configModal.classList.add('show');
        }

        logToMain('RENDERER', 'CONFIG_MODAL_TOGGLE', {
            wasVisible: isVisible,
            nowVisible: !isVisible
        });
    } else {
        logToMain('RENDERER', 'CONFIG_MODAL_NOT_FOUND', {}, 'ERROR');
    }
}

function closeConfigModal() {
    console.log('🔒 Fechando modal de configurações');
    if (configModal) {
        console.log('  Modal encontrado, removendo classe show');
        configModal.classList.remove('show');
        configModal.style.display = 'none'; // Forçar fechamento
        console.log('  Classe show removida, classes atuais:', configModal.className, 'display:', configModal.style.display);
    } else {
        console.log('  Modal não encontrado!');
    }
}

function toggleLogsModal() {
    console.log("📋 Alternando modal de logs - BOTÃO CLICADO");
    //alert("Botão Logs clicado!");
    if (logsModal) {
        const isVisible = logsModal.classList.contains('show');
        console.log("  Modal está visível:", isVisible);

        if (isVisible) {
            logsModal.classList.remove('show');
            console.log("  Classe 'show' removida");
        } else {
            logsModal.classList.add('show');
            updateLogsModalContent();
            console.log("  Classe 'show' adicionada");
        }

        logToMain('RENDERER', 'LOGS_MODAL_TOGGLE', {
            wasVisible: isVisible,
            nowVisible: !isVisible
        });
    } else {
        console.error("❌ logsModal não encontrado");
        logToMain('RENDERER', 'LOGS_MODAL_NOT_FOUND', {}, 'ERROR');
    }
}

function closeLogsModal() {
    if (logsModal) {
        logsModal.classList.remove('show');
    }
}



async function clearLogs() {
    connectionLogsText = '';
    logToMain('RENDERER', 'LOGS_CLEARED', {});
    showStatus('Logs limpos!', 'success');
}

function updateLogsModalContent() {
    if (logsModalContent) {
        try {
            // Tentar ler o arquivo de log atual
            const today = new Date().toISOString().split('T')[0];
            const logFile = `/var/log/bluepexvpn/data_${today}.log`;

            const fs = require('fs');
            if (fs.existsSync(logFile)) {
                const logs = fs.readFileSync(logFile, 'utf8');
                let content = logs || '📋 Arquivo de log vazio.';
            if (connectionLogsText) {
              content += '\n--- Logs em Tempo Real ---\n' + connectionLogsText;
            }
            logsModalContent.textContent = content;
            } else {
                logsModalContent.textContent = '📋 Arquivo de log não encontrado.';
            }

            // Configurar watcher se não existir
            if (!logWatcher) {
                logWatcher = fs.watchFile(logFile, { interval: 1000 }, (curr, prev) => {
                    if (logsModal && logsModal.classList.contains('show')) {
                        updateLogsModalContent();
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao ler logs:', error);
            logsModalContent.textContent = '📋 Erro ao carregar logs.';
        }
    }

    // Rolar para o final
    logsModalContent.scrollTop = logsModalContent.scrollHeight;
}

function hideConnectionElements() {
    // Esconder seção de device code
    if (deviceCodeSection) {
        deviceCodeSection.style.display = 'none';
    }

    // Esconder botão copiar código
    if (btnCopiarCodigo) {
        btnCopiarCodigo.style.display = 'none';
    }



    // Esconder seção de credenciais se for perfil usuário
    if (currentProfile?.type === 'user' && credentialsSection) {
        credentialsSection.style.display = 'none';
    }

    logToMain('RENDERER', 'CONNECTION_ELEMENTS_HIDDEN', {
        profileType: currentProfile?.type,
        vpnPid: vpnPid
    });
}

function showConnectionElements() {
    // Mostrar seção de credenciais se for perfil usuário
    if (currentProfile?.type === 'user' && credentialsSection) {
        credentialsSection.style.display = 'block';
    }

    logToMain('RENDERER', 'CONNECTION_ELEMENTS_SHOWN', {
        profileType: currentProfile?.type
    });
}

// ============ UTILITÁRIOS ============

function showStatus(message, type = 'status') {
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';

    // Auto-hide success messages after 5 seconds, unless connected
    if (type === 'success' && !vpnPid) {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

function saveApplicationState() {
    const appState = {
        selectedProfileType: currentProfile?.type || null,
        selectedProfileId: currentProfile?.id || null,
        username: userUsername?.value || '',
        rememberCredentials: rememberCredentials?.checked || false,
        vpnPid: vpnPid,
        lastSaved: new Date().toISOString()
    };

    if (window.electronAPI?.saveAppState) {
        window.electronAPI.saveAppState(appState);
    }
}

async function restoreApplicationState() {
    try {
        if (!window.electronAPI?.loadAppState) return;

        const result = await window.electronAPI.loadAppState();
        if (result.success && result.state) {
            const state = result.state;

            // Restaurar perfil selecionado
            if (state.selectedProfileId && state.selectedProfileType) {
                const profileKey = `${state.selectedProfileType}:${state.selectedProfileId}`;
                if (profileSelect) {
                    profileSelect.value = profileKey;
                    // Simular seleção para atualizar interface
                    setTimeout(() => {
                        profileSelect.dispatchEvent(new Event('change'));
                    }, 100);
                }
            }

            // Restaurar credenciais
            if (userUsername && state.username) {
                userUsername.value = state.username;
            }
            if (rememberCredentials && state.rememberCredentials !== undefined) {
                rememberCredentials.checked = state.rememberCredentials;
            }

            // Restaurar status de conexão
            if (state.vpnPid) {
                vpnPid = state.vpnPid;
                updateConnectionButtons();
                showStatus('Estado de conexão restaurado', 'success');
            }

            console.log('✅ Estado da aplicação restaurado');
        }
    } catch (error) {
        console.error('❌ Erro ao restaurar estado:', error);
    }
}

// ============ PLACEHOLDER FUNCTIONS ============
// Estas funções serão implementadas conforme necessário

function copyDeviceCode() {
    if (!currentDeviceCode || !currentDeviceCode.user_code) {
        showStatus('Nenhum código de verificação disponível para copiar.', 'alert');
        logToMain('RENDERER', 'COPY_DEVICE_CODE_FAILED', { reason: 'no_device_code' });
        return;
    }

    try {
        // Copiar para clipboard
        navigator.clipboard.writeText(currentDeviceCode.user_code).then(() => {
            showStatus(`Código "${currentDeviceCode.user_code}" copiado para a área de transferência!`, 'success');
            logToMain('RENDERER', 'DEVICE_CODE_COPIED', {
                code: currentDeviceCode.user_code,
                success: true
            });
        }).catch((error) => {
            console.error('Erro ao copiar código:', error);
            showStatus('Erro ao copiar código. Copie manualmente.', 'alert');
            logToMain('RENDERER', 'DEVICE_CODE_COPY_FAILED', {
                code: currentDeviceCode.user_code,
                error: error.message
            });
        });
    } catch (error) {
        console.error('Erro ao acessar clipboard:', error);
        showStatus('Erro ao acessar área de transferência.', 'alert');
        logToMain('RENDERER', 'CLIPBOARD_ACCESS_FAILED', { error: error.message });
    }
}

async function handleOvpnFileSelection() {
    try {
        console.log('📁 Abrindo diálogo de seleção de arquivo OVPN...');
        const result = await window.electronAPI.selectOvpnFile();

        if (result.success) {
            console.log('✅ Arquivo selecionado:', result.fileName);

            // Atualizar a interface com as informações do arquivo
            if (configOvpnInfo) {
                configOvpnInfo.style.display = 'block';
                if (configOvpnName) {
                    configOvpnName.textContent = result.fileName;
                }
            }

            // Mostrar checkbox de salvar perfil
            if (configSaveProfile) {
                configSaveProfile.style.display = 'inline-block';
            }

            // Armazenar informações do arquivo para uso posterior
            selectedOvpnFile = {
                path: result.filePath,
                name: result.fileName,
                content: result.content
            };

            showStatus(`Arquivo "${result.fileName}" selecionado com sucesso!`, 'success');
        } else {
            console.error('❌ Erro na seleção:', result.error);
            showStatus(`Erro: ${result.error}`, 'alert');
        }
    } catch (error) {
        console.error('❌ Erro ao selecionar arquivo:', error);
        showStatus(`Erro ao selecionar arquivo: ${error.message}`, 'alert');
    }
}

function handleSaveProfileCheckbox() {
    const isChecked = configSaveProfile.checked;
    console.log('📋 Checkbox salvar perfil:', isChecked);

    // Mostrar/esconder campo de nome do perfil
    if (configProfileName) {
        configProfileName.style.display = isChecked ? 'block' : 'none';
    }

    // Mostrar/esconder botão de salvar
    if (configSaveUserProfile) {
        configSaveUserProfile.style.display = isChecked ? 'inline-block' : 'none';
    }
}

async function saveUserProfileConfig() {
    if (!selectedOvpnFile) {
        showStatus('Por favor, selecione um arquivo OVPN primeiro.', 'alert');
        return;
    }

    if (!configProfileName || !configProfileName.value.trim()) {
        showStatus('Por favor, digite um nome para o perfil.', 'alert');
        return;
    }

    try {
        console.log('💾 Salvando perfil usuário...');
        showStatus('Salvando perfil...', 'status');

        const profileId = `profile_${Date.now()}`;
        const profileName = configProfileName.value.trim();

        const result = await window.electronAPI.saveOvpnToProfile(
            profileId,
            selectedOvpnFile.content,
            profileName,
            selectedOvpnFile.path
        );

        if (result.success) {
            console.log('✅ Perfil salvo:', result);
            showStatus(`Perfil "${profileName}" salvo com sucesso!`, 'success');

            // Limpar formulário
            selectedOvpnFile = null;
            if (configProfileName) configProfileName.value = '';
            if (configSaveProfile) configSaveProfile.checked = false;
            if (configOvpnInfo) configOvpnInfo.style.display = 'none';
            if (configSaveUserProfile) configSaveUserProfile.style.display = 'none';
            if (configProfileName) configProfileName.style.display = 'none';

            // Recarregar perfis
            await loadAllProfiles();
        } else {
            console.error('❌ Erro ao salvar perfil:', result.error);
            showStatus(`Erro ao salvar perfil: ${result.error}`, 'alert');
        }
    } catch (error) {
        console.error('❌ Erro ao salvar perfil:', error);
        showStatus(`Erro ao salvar perfil: ${error.message}`, 'alert');
    }
}

async function handleAzureOvpnFileSelection() {
    try {
        console.log('📁 Abrindo diálogo de seleção de arquivo OVPN Azure...');
        const result = await window.electronAPI.selectOvpnFile();

        if (result.success) {
            console.log('✅ Arquivo Azure selecionado:', result.fileName);

            // Atualizar a interface com as informações do arquivo
            if (configAzureOvpnInfo) {
                configAzureOvpnInfo.style.display = 'block';
                if (configAzureOvpnName) {
                    configAzureOvpnName.textContent = result.fileName;
                }
            }

            // Mostrar checkbox de salvar perfil Azure
            if (configSaveAzureProfile) {
                configSaveAzureProfile.style.display = 'inline-block';
            }

            // Armazenar informações do arquivo para uso posterior
            selectedAzureOvpnFile = {
                path: result.filePath,
                name: result.fileName,
                content: result.content
            };

            showStatus(`Arquivo Azure "${result.fileName}" selecionado com sucesso!`, 'success');
        } else {
            console.error('❌ Erro na seleção Azure:', result.error);
            showStatus(`Erro: ${result.error}`, 'alert');
        }
    } catch (error) {
        console.error('❌ Erro ao selecionar arquivo Azure:', error);
        showStatus(`Erro ao selecionar arquivo: ${error.message}`, 'alert');
    }
}

function handleSaveAzureProfileCheckbox() {
    const isChecked = configSaveAzureProfile.checked;
    console.log('📋 Checkbox salvar perfil Azure:', isChecked);

    // Mostrar/esconder campo de nome do perfil Azure
    if (configAzureProfileName) {
        configAzureProfileName.style.display = isChecked ? 'block' : 'none';
    }

    // Mostrar/esconder botão de salvar Azure
    if (configSaveAzureProfileBtn) {
        configSaveAzureProfileBtn.style.display = isChecked ? 'inline-block' : 'none';
    }
}

async function saveAzureProfileConfig() {
    if (!selectedAzureOvpnFile) {
        showStatus('Por favor, selecione um arquivo OVPN Azure primeiro.', 'alert');
        return;
    }

    if (!configAzureProfileName || !configAzureProfileName.value.trim()) {
        showStatus('Por favor, digite um nome para o perfil Azure.', 'alert');
        return;
    }

    try {
        console.log('💾 Salvando perfil Azure...');
        showStatus('Salvando perfil Azure...', 'status');

        const profileId = `azure_${Date.now()}`;
        const profileName = configAzureProfileName.value.trim();

        const result = await window.electronAPI.saveAzureConfig(
            profileId,
            selectedAzureOvpnFile.content,
            profileName,
            selectedAzureOvpnFile.path
        );

        if (result.success) {
            console.log('✅ Perfil Azure salvo:', result);
            showStatus(`Perfil Azure "${profileName}" salvo com sucesso!`, 'success');

            // Limpar formulário
            selectedAzureOvpnFile = null;
            if (configAzureProfileName) configAzureProfileName.value = '';
            if (configSaveAzureProfile) configSaveAzureProfile.checked = false;
            if (configAzureOvpnInfo) configAzureOvpnInfo.style.display = 'none';
            if (configSaveAzureProfileBtn) configSaveAzureProfileBtn.style.display = 'none';
            if (configAzureProfileName) configAzureProfileName.style.display = 'none';

            // Recarregar perfis
            await loadAllProfiles();
        } else {
            console.error('❌ Erro ao salvar perfil Azure:', result.error);
            showStatus(`Erro ao salvar perfil Azure: ${result.error}`, 'alert');
        }
    } catch (error) {
        console.error('❌ Erro ao salvar perfil Azure:', error);
        showStatus(`Erro ao salvar perfil Azure: ${error.message}`, 'alert');
    }
}

async function deleteProfile(profileId, profileType) {
    if (!confirm(`Tem certeza que deseja excluir o perfil "${profileId}"?`)) {
        return;
    }

    try {
        console.log(`🗑️ Excluindo perfil ${profileType}:${profileId}...`);
        showStatus('Excluindo perfil...', 'status');

        let result;
        if (profileType === 'user') {
            result = await window.electronAPI.deleteUserProfile(profileId);
        } else if (profileType === 'azure') {
            result = await window.electronAPI.deleteAzureProfile(profileId);
        } else {
            throw new Error('Tipo de perfil inválido');
        }

        if (result.success) {
            console.log('✅ Perfil excluído:', profileId);
            showStatus('Perfil excluído com sucesso!', 'success');

            // Recarregar perfis
            await loadAllProfiles();
        } else {
            console.error('❌ Erro ao excluir perfil:', result.error);
            showStatus(`Erro ao excluir perfil: ${result.error}`, 'alert');
        }
    } catch (error) {
        console.error('❌ Erro ao excluir perfil:', error);
        showStatus(`Erro ao excluir perfil: ${error.message}`, 'alert');
    }
}

// ============ SISTEMA DE ATUALIZAÇÃO ============

function initializeUpdateElements() {
    // Inicializar elementos de atualização se existirem
    console.log('🔄 Elementos de atualização inicializados');
}

async function checkForUpdates() {
    try {
        console.log('🔄 BOTÃO DE ATUALIZAÇÃO CLICADO - Verificando atualizações...');
        //alert("Botão Atualização clicado!");
        showStatus('Verificando atualizações...', 'status');

        const result = await window.electronAPI.checkForUpdates(true);

        if (result.success) {
            showStatus('Verificação concluída. Você está usando a versão mais recente.', 'success');
        } else {
            showStatus(`Erro na verificação: ${result.error}`, 'alert');
        }
    } catch (error) {
        console.error('❌ Erro ao verificar atualizações:', error);
        showStatus(`Erro ao verificar atualizações: ${error.message}`, 'alert');
    }
}

function checkForUpdatesOnStartup() {
    // Implementar verificação automática de atualizações
    console.log('🔄 Verificação automática de atualizações - função placeholder');
}

function closeUpdateModal() {
    if (updateModal) {
        updateModal.style.display = 'none';
    }
}

// ============ EVENT LISTENERS IPC ============

// Configurar listeners de eventos IPC
if (window.electronAPI) {
    // Device Code Response (Azure Login)
    window.electronAPI.onDeviceCodeResponse((event, deviceCodeData) => {
        console.log('🔐 Device code recebido:', deviceCodeData);
        logToMain('RENDERER', 'DEVICE_CODE_RECEIVED', {
            hasUri: !!deviceCodeData.verification_uri,
            hasCode: !!deviceCodeData.user_code
        });

        // Armazenar device code
        currentDeviceCode = deviceCodeData;

        // Atualizar interface
        if (verificationUri && deviceCodeData.verification_uri) {
            verificationUri.textContent = deviceCodeData.verification_uri;
        }

        if (userCode && deviceCodeData.user_code) {
            userCode.textContent = deviceCodeData.user_code;
        }

        // Mostrar seção de device code
        if (deviceCodeSection) {
            deviceCodeSection.style.display = 'block';
        }

        // Mostrar botão de copiar código
        if (btnCopiarCodigo) {
            btnCopiarCodigo.style.display = 'block';
        }

        showStatus('Código de verificação gerado. Copie e use no navegador.', 'success');
    });

    // Evento de desconexão externa
    window.electronAPI.onVPNDisconnected(() => {
        console.log('🔌 VPN desconectada externamente');
        showStatus('VPN desconectada externamente.', 'status');
        vpnPid = null;
        updateConnectionButtons();

        // Esconder device code quando desconectar
        if (deviceCodeSection) {
            deviceCodeSection.style.display = 'none';
        }
        if (btnCopiarCodigo) {
            btnCopiarCodigo.style.display = 'none';
        }
        currentDeviceCode = null;
    });

    // Evento de conexão estabelecida
    window.electronAPI.onVPNConnected((event, data) => {
        console.log('🔗 VPN conectada:', data);
        vpnPid = data.pid;
        updateConnectionButtons();
        showStatus('VPN conectada com sucesso!', 'success');

        // Esconder device code quando conectar
        if (deviceCodeSection) {
            deviceCodeSection.style.display = 'none';
        }
        if (btnCopiarCodigo) {
            btnCopiarCodigo.style.display = 'none';
        }
        currentDeviceCode = null;
    });

    // Logs de VPN
    window.electronAPI.onVPNLog((log) => {
        connectionLogsText += log + '\n';
        // Atualizar modal de logs se estiver aberto
        if (logsModal && logsModal.classList.contains('show')) {
            updateLogsModalContent();
        }
    });

    // Desafio 2FA
    window.electronAPI.onVpnChallenge((event, data) => {
        console.log('🔐 Desafio VPN recebido:', data);
        // Implementar modal de desafio 2FA
        showStatus(`Desafio 2FA: ${data.message}`, 'alert');
    });

    // Eventos de atualização
    window.electronAPI.onUpdateAvailable((info) => {
        updateInfo = info;
        if (updateBtn) updateBtn.style.display = 'block';
        showStatus('Atualização disponível!', 'success');
    });
}

