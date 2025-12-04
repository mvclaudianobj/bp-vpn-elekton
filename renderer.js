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

// NOVAS VARIÁVEIS PARA OS BOTÕES DE SALVAR
const configSaveUserProfile = document.getElementById('configSaveUserProfile');
const configSaveAzureProfileBtn = document.getElementById('configSaveAzureProfileBtn');
const saveAzureConfigBtn = document.getElementById('saveAzureConfig');

// Estado da Aplicação
let vpnPid = null;
let currentDeviceCodeMessage = null;
let availableUserProfiles = [];
let availableAzureProfiles = [];

// Estado das Atualizações
let updateAvailable = false;
let updateDownloaded = false;
let updateInfo = null;
let updateProgressData = null;

// VARIÁVEIS FALTANTES
let currentUserProfile = null;
let currentAzureProfile = null;
let currentUserOvpnFile = null;
let currentAzureOvpnFile = null;
let currentUserOvpnContent = null;
let currentAzureOvpnContent = null;
let currentUserOvpnFileName = null;
let currentAzureOvpnFileName = null;

// Elementos de Atualização
let updateBtn = null;
let updateModal = null;
let updateVersion = null;
let updateDate = null;
let updateNotes = null;
let updateProgress = null;
let progressFill = null;
let progressPercent = null;
let progressSpeed = null;
let progressSize = null;
let updateLaterBtn = null;
let updateDownloadBtn = null;
let updateInstallBtn = null;

// Estado 2FA
let requires2FA = false;
let current2FAProfileId = null;

// Elementos 2FA
let twoFAContainer = null;
let twoFAInput = null;
let twoFALabel = null;

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Carregado - Iniciando aplicação...');
    initializeApp();
});

function setupChallengeModalListeners() {
    const submitBtn = document.getElementById('submitChallengeBtn');
    const cancelBtn = document.getElementById('cancelChallengeBtn');
    const challengeInput = document.getElementById('challengeResponse');
    
    // ✅ VERIFIQUE se os elementos existem antes de adicionar listeners
    if (!submitBtn || !cancelBtn || !challengeInput) {
        console.error('❌ Elementos do modal 2FA não encontrados');
        return;
    }
    
    // ✅ REMOVA listeners existentes para evitar duplicação
    submitBtn.replaceWith(submitBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    challengeInput.replaceWith(challengeInput.cloneNode(true));
    
    // ✅ ADICIONE novos listeners
    document.getElementById('submitChallengeBtn').addEventListener('click', handleChallengeSubmit);
    document.getElementById('cancelChallengeBtn').addEventListener('click', handleChallengeCancel);
    document.getElementById('challengeResponse').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleChallengeSubmit();
        }
    });
    
    // ✅ Listener para ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('challengeModal').style.display === 'flex') {
            handleChallengeCancel();
        }
    });
    
    console.log('✅ Listeners do modal 2FA configurados');
}

function handleChallengeSubmit() {
    const token = document.getElementById('challengeResponse').value.trim();
    if (!token || token.length !== 6) {
        showStatus('Por favor, digite um token válido de 6 dígitos.', 'alert');
        return;
    }

    console.log('✅ Enviando token 2FA:', token);

    // ✅ ENVIE O TOKEN PARA O PROCESSO OPENVPN VIA API
    if (window.electronAPI && window.electronAPI.sendChallengeResponse) {
        window.electronAPI.sendChallengeResponse(token).then(() => {
            console.log('✅ Token enviado com sucesso');
            hideChallengeModal();
            showStatus('Token 2FA enviado. Aguardando autenticação...', 'status');
        }).catch(error => {
            console.error('❌ Erro ao enviar token:', error);
            showStatus('Erro ao enviar token 2FA', 'alert');
        });
    } else {
        console.error('❌ electronAPI.sendChallengeResponse não disponível');
        showStatus('Erro: API não disponível', 'alert');
    }
}

function handleChallengeCancel() {
    console.log('❌ Token 2FA cancelado pelo usuário');
    
    // ✅ CORREÇÃO: Enviar mensagem de cancelamento
    if (window.electronAPI && window.electronAPI.sendChallengeResponse) {
        window.electronAPI.sendChallengeResponse('CANCEL').then(() => {
            hideChallengeModal();
            showStatus('Autenticação 2FA cancelada', 'alert');
        }).catch(error => {
            console.error('❌ Erro ao cancelar:', error);
            hideChallengeModal();
            showStatus('Autenticação 2FA cancelada', 'alert');
        });
    } else {
        hideChallengeModal();
        showStatus('Autenticação 2FA cancelada', 'alert');
    }
}

async function initializeApp() {
  try {
    console.log('🚀 Inicializando aplicação...');

    // Inicializar elementos de atualização
    initializeUpdateElements();

    console.log('🚀 Elementos inicializados. Verificando botões...');
    console.log('🚀 btnDesconectarUsuario existe:', !!document.getElementById('btnDesconectarUsuario'));

    // Configurar event listeners primeiro
    setupEventListeners();

    // ✅ INICIALIZAR ELEMENTOS 2FA DINAMICAMENTE
    initialize2FAElements();

    // Configurar listener de desafios
    setupChallengeListener();

    // Configurar listeners de atualização
    setupUpdateListeners();

    // Carregar perfis salvos
    await loadUserProfiles();
    await loadAzureProfiles();

    // Verificar atualizações automaticamente
    checkForUpdatesOnStartup();

    // Restaurar estado da aplicação
    await restoreApplicationState();

    // Inicializar interface
    toggleMode();

    // ✅ GARANTIR QUE CAMPO 2FA ESTEJA ESCONDIDO INICIALMENTE
    hide2FAField();

    // Mostrar botão de atualização
    if (updateBtn) {
      updateBtn.style.display = 'block';
    }

    console.log('✅ Aplicação inicializada com sucesso');
    showStatus('Aplicação carregada com sucesso!', 'success');
  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    showStatus('Erro ao inicializar a aplicação', 'alert');
  }
}

// ============ SISTEMA DE ATUALIZAÇÕES ============

function initializeUpdateElements() {
  updateBtn = document.getElementById('updateBtn');
  updateModal = document.getElementById('updateModal');
  updateVersion = document.getElementById('updateVersion');
  updateDate = document.getElementById('updateDate');
  updateNotes = document.getElementById('updateNotes');
  updateProgress = document.getElementById('updateProgress');
  progressFill = document.getElementById('progressFill');
  progressPercent = document.getElementById('progressPercent');
  progressSpeed = document.getElementById('progressSpeed');
  progressSize = document.getElementById('progressSize');
  updateLaterBtn = document.getElementById('updateLaterBtn');
  updateDownloadBtn = document.getElementById('updateDownloadBtn');
  updateInstallBtn = document.getElementById('updateInstallBtn');

  console.log('🔄 Elementos de atualização inicializados');
}

function setupUpdateListeners() {
  if (!window.electronAPI) return;

  // Listener para atualização disponível
  window.electronAPI.onUpdateAvailable((event, info) => {
    console.log('🔄 Atualização disponível:', info);
    updateAvailable = true;
    updateInfo = info;
    showUpdateNotification(info);
  });

  // Listener para progresso do download
  window.electronAPI.onUpdateProgress((event, progress) => {
    console.log('📥 Progresso do download:', progress);
    updateProgressData = progress;
    updateDownloadProgress(progress);
  });

  // Listener para download concluído
  window.electronAPI.onUpdateDownloaded((event, info) => {
    console.log('✅ Download concluído:', info);
    updateDownloaded = true;
    showUpdateReady(info);
  });

  // Listener para erros
  window.electronAPI.onUpdateError((event, error) => {
    console.error('❌ Erro na atualização:', error);
    showUpdateError(error);
  });

  // Listener para verificação concluída
  window.electronAPI.onUpdateCheckComplete((event, result) => {
    console.log('🔍 Verificação de atualização concluída:', result);
    if (!result.available) {
      showStatus('Aplicação está atualizada!', 'success');
    }
  });

  console.log('✅ Listeners de atualização configurados');
}

async function checkForUpdatesOnStartup() {
  // Pequeno delay para não interferir na inicialização
  setTimeout(async () => {
    try {
      const result = await window.electronAPI.checkForUpdates(false);
      if (result.success) {
        console.log('🔍 Verificação automática de atualizações realizada');
      }
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
    }
  }, 5000); // 5 segundos após inicialização
}

async function manualUpdateCheck() {
  if (!updateBtn) return;

  try {
    // Mostrar indicador de carregamento
    updateBtn.classList.add('updating');
    updateBtn.disabled = true;

    showStatus('Verificando atualizações...', 'status');

    const result = await window.electronAPI.checkForUpdates(true);

    if (result.success) {
      showStatus('Verificação concluída!', 'success');
    } else {
      showStatus(`Erro na verificação: ${result.error}`, 'alert');
    }

  } catch (error) {
    console.error('Erro ao verificar atualizações:', error);
    showStatus('Erro ao verificar atualizações', 'alert');
  } finally {
    // Remover indicador de carregamento
    updateBtn.classList.remove('updating');
    updateBtn.disabled = false;
  }
}

function showUpdateNotification(info) {
  if (!updateModal || !updateVersion || !updateDate || !updateNotes) return;

  updateVersion.textContent = info.version;
  updateDate.textContent = new Date(info.releaseDate).toLocaleDateString();
  updateNotes.textContent = info.releaseNotes || 'Nenhuma nota de release disponível.';

  updateModal.style.display = 'flex';

  // Tocar som de notificação (opcional)
  // new Audio('notification.mp3').play().catch(() => {});
}

function updateDownloadProgress(progress) {
  if (!progressFill || !progressPercent || !progressSpeed || !progressSize) return;

  progressFill.style.width = `${progress.percent}%`;
  progressPercent.textContent = `${progress.percent}%`;
  progressSpeed.textContent = `${progress.speed} KB/s`;
  progressSize.textContent = `${progress.transferred} MB / ${progress.total} MB`;

  // Mostrar barra de progresso
  if (updateProgress) {
    updateProgress.style.display = 'block';
  }
}

function showUpdateReady(info) {
  if (!updateDownloadBtn || !updateInstallBtn) return;

  // Esconder botão de download e mostrar botão de instalar
  updateDownloadBtn.style.display = 'none';
  updateInstallBtn.style.display = 'inline-block';

  showStatus('Atualização baixada! Clique em "Instalar Agora" para aplicar.', 'success');
}

function showUpdateError(error) {
  showStatus(`Erro na atualização: ${error.message}`, 'alert');

  // Esconder modal após alguns segundos
  setTimeout(() => {
    if (updateModal) {
      updateModal.style.display = 'none';
    }
  }, 5000);
}

async function downloadUpdate() {
  if (!updateDownloadBtn) return;

  try {
    updateDownloadBtn.disabled = true;
    updateDownloadBtn.textContent = '📥 Baixando...';

    showStatus('Iniciando download da atualização...', 'status');

    const result = await window.electronAPI.downloadUpdate();

    if (result.success) {
      showStatus('Download iniciado! Acompanhe o progresso.', 'success');
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    console.error('Erro ao baixar atualização:', error);
    showStatus(`Erro no download: ${error.message}`, 'alert');
    updateDownloadBtn.disabled = false;
    updateDownloadBtn.textContent = '📥 Baixar Atualização';
  }
}

async function installUpdate() {
  if (!updateInstallBtn) return;

  try {
    updateInstallBtn.disabled = true;
    updateInstallBtn.textContent = '⚡ Instalando...';

    showStatus('Instalando atualização... A aplicação será reiniciada.', 'status');

    const result = await window.electronAPI.installUpdate();

    if (result.success) {
      showStatus('Instalação iniciada! A aplicação será reiniciada automaticamente.', 'success');
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    console.error('Erro ao instalar atualização:', error);
    showStatus(`Erro na instalação: ${error.message}`, 'alert');
    updateInstallBtn.disabled = false;
    updateInstallBtn.textContent = '⚡ Instalar Agora';
  }
}

function closeUpdateModal() {
  if (updateModal) {
    updateModal.style.display = 'none';
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
            username: userUsername?.value || '',
            rememberCredentials: rememberCredentials?.checked || false,
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
            
            if (userItem) userItem.classList.toggle('active', savedState.userMode);
            if (azureItem) azureItem.classList.toggle('active', savedState.azureMode);
        }
        
        // Restaurar perfis ativos
        if (savedState.userProfileId) {
            await setActiveUserProfile(savedState.userProfileId);
        }
        
        if (savedState.azureProfileId) {
            await setActiveAzureProfile(savedState.azureProfileId);
        }
        
        // Restaurar credenciais
        if (savedState.username && userUsername) {
            userUsername.value = savedState.username;
        }
        
        if (savedState.rememberCredentials !== undefined && rememberCredentials) {
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
    console.log('🎧 [RENDERER] Configurando event listeners...');

    // Verificar se os botões existem
    console.log('🎧 [RENDERER] btnDesconectarUsuario encontrado:', !!btnDesconectarUsuario);
    console.log('🔧 Configurando event listeners...');
    
    // Verificar se elementos existem
    if (!menuBtn || !configModal) {
        console.error('❌ Elementos do DOM não encontrados');
        return;
    }
    
    // Menu e Modal
    menuBtn.addEventListener('click', openConfigModal);
    configCloseBtn.addEventListener('click', closeConfigModal);
    
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
    if (configSelectOvpn) {
        configSelectOvpn.addEventListener('click', () => selectOvpnFile('user'));
    }
    if (configSelectAzureOvpn) {
        configSelectAzureOvpn.addEventListener('click', () => selectOvpnFile('azure'));
    }
    
    // NOVOS BOTÕES DE SALVAR
    if (configSaveUserProfile) {
        configSaveUserProfile.addEventListener('click', saveUserProfileConfig);
    }
    if (configSaveAzureProfileBtn) {
        configSaveAzureProfileBtn.addEventListener('click', saveAzureProfileConfig);
    }
    if (saveAzureConfigBtn) {
        saveAzureConfigBtn.addEventListener('click', saveAzureConfig);
    }
    
    // Opções de Perfil
    if (configSaveProfile) {
        configSaveProfile.addEventListener('change', toggleProfileNameField);
    }
    if (configSaveAzureProfile) {
        configSaveAzureProfile.addEventListener('change', toggleAzureProfileNameField);
    }
    
    // Conexões
    if (btnConectarUsuario) {
        btnConectarUsuario.addEventListener('click', connectUserVPN);
    }
    if (btnDesconectarUsuario) {
        btnDesconectarUsuario.addEventListener('click', disconnectUserVPN);
    }
    if (btnConectarAzure) {
        btnConectarAzure.addEventListener('click', connectAzureVPN);
    }
    if (btnDesconectarAzure) {
        btnDesconectarAzure.addEventListener('click', disconnectAzureVPN);
    }
    if (btnCopiarCodigo) {
        btnCopiarCodigo.addEventListener('click', copyDeviceCode);
    }
    
    // Credenciais
    if (rememberCredentials) {
        rememberCredentials.addEventListener('change', handleRememberCredentials);
    }
    
    // Validação em tempo real
    if (userUsername) {
      userUsername.addEventListener('input', validateUserForm);
    }
    if (userPassword) {
      userPassword.addEventListener('input', validateUserForm);
    }

    // ✅ ADICIONE ESTA LINHA: Configurar listeners do modal 2FA
    setupChallengeModalListeners();

    // Listeners de atualização
    if (updateBtn) {
      updateBtn.addEventListener('click', manualUpdateCheck);
    }
    if (updateLaterBtn) {
      updateLaterBtn.addEventListener('click', closeUpdateModal);
    }
    if (updateDownloadBtn) {
      updateDownloadBtn.addEventListener('click', downloadUpdate);
    }
    if (updateInstallBtn) {
      updateInstallBtn.addEventListener('click', installUpdate);
    }

    // Fechar modal de atualização ao clicar fora
    if (updateModal) {
      updateModal.addEventListener('click', (e) => {
        if (e.target === updateModal) closeUpdateModal();
      });
    }

    // Listeners do Electron
    setupElectronListeners();

    console.log('✅ Event listeners configurados');
}

// ============ SALVAR PERFIS SEPARADAMENTE ============

// Salvar perfil de USUÁRIO
async function saveUserProfileConfig() {
    if (!currentUserOvpnFile) {
        showStatus('Nenhum arquivo OVPN selecionado', 'alert');
        return;
    }

    const profileName = document.getElementById('configProfileName').value.trim() || currentUserOvpnFileName;
    const profileId = generateProfileId(profileName);

    try {
        showStatus(`Salvando perfil de usuário "${profileName}"...`, 'status');
        
        const result = await window.electronAPI.saveOvpnToProfile(
            profileId, 
            currentUserOvpnContent, 
            currentUserOvpnFileName, 
            currentUserOvpnFile
        );
        
        if (result.success) {
            showStatus(`Perfil de usuário "${profileName}" salvo com sucesso!`, 'success');
            
            // Salvar o perfil no arquivo de perfis de usuário
            const profileData = {
                id: profileId,
                name: profileName,
                type: 'user',
                ovpnFileName: currentUserOvpnFileName,
                server: extractServerInfo(currentUserOvpnContent),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await window.electronAPI.saveUserProfile(profileData);
            
            // Recarregar a lista de perfis
            await loadUserProfiles();
            renderConfigProfiles();
            
            // Resetar o formulário
            resetUserProfileForm();
            
        } else {
            showStatus(`Erro ao salvar perfil: ${result.error}`, 'alert');
        }
    } catch (error) {
        showStatus(`Erro: ${error.message}`, 'alert');
    }
}

// Salvar perfil AZURE
async function saveAzureProfileConfig() {
    if (!currentAzureOvpnFile) {
        showStatus('Nenhum arquivo OVPN Azure selecionado', 'alert');
        return;
    }

    const profileName = document.getElementById('configAzureProfileName').value.trim() || `Azure ${currentAzureOvpnFileName}`;
    const profileId = generateProfileId(profileName);

    try {
        showStatus(`Salvando perfil Azure "${profileName}"...`, 'status');
        
        const result = await window.electronAPI.saveAzureConfig(
            profileId, 
            currentAzureOvpnContent, 
            currentAzureOvpnFileName, 
            currentAzureOvpnFile
        );
        
        if (result.success) {
            showStatus(`Perfil Azure "${profileName}" salvo com sucesso!`, 'success');
            
            // Salvar o perfil no arquivo de perfis Azure
            const profileData = {
                id: profileId,
                name: profileName,
                type: 'azure',
                ovpnFileName: currentAzureOvpnFileName,
                server: extractServerInfo(currentAzureOvpnContent),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await window.electronAPI.saveAzureProfile(profileData);
            
            // Recarregar a lista de perfis Azure
            await loadAzureProfiles();
            renderAzureProfiles();
            
            // Resetar o formulário
            resetAzureProfileForm();
            
        } else {
            showStatus(`Erro ao salvar perfil Azure: ${result.error}`, 'alert');
        }
    } catch (error) {
        showStatus(`Erro: ${error.message}`, 'alert');
    }
}

function extractServerInfo(ovpnContent) {
    if (!ovpnContent) return 'Servidor Desconhecido';
    
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

// Funções auxiliares para resetar formulários
function resetUserProfileForm() {
    if (configSaveUserProfile) configSaveUserProfile.style.display = 'none';
    if (configOvpnInfo) configOvpnInfo.style.display = 'none';
    if (configProfileName) configProfileName.value = '';
    if (configSaveProfile) configSaveProfile.checked = false;
    currentUserOvpnFile = null;
    currentUserOvpnContent = null;
    currentUserOvpnFileName = null;
}

function resetAzureProfileForm() {
    if (configSaveAzureProfileBtn) configSaveAzureProfileBtn.style.display = 'none';
    if (configAzureOvpnInfo) configAzureOvpnInfo.style.display = 'none';
    if (configAzureProfileName) configAzureProfileName.value = '';
    if (configSaveAzureProfile) configSaveAzureProfile.checked = false;
    currentAzureOvpnFile = null;
    currentAzureOvpnContent = null;
    currentAzureOvpnFileName = null;
}

// Gerar ID único para perfis
function generateProfileId(name) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
    return `${nameSlug}${timestamp}${randomStr}`;
}

function setupElectronListeners() {
    console.log('🔧 Configurando listeners do Electron...');
    
    if (!window.electronAPI) {
        console.error('❌ electronAPI não disponível');
        showStatus('Erro: API do Electron não carregada', 'alert');
        return;
    }
    
    console.log('✅ electronAPI disponível, configurando listeners...');
    
    try {
        window.electronAPI.onDeviceCodeResponse((event, data) => {
            console.log('📱 Device code response recebido');
            currentDeviceCodeMessage = `Visite: ${data.verification_uri} e digite o código: ${data.user_code}`;
            showStatus(currentDeviceCodeMessage, 'status');
            if (btnCopiarCodigo) btnCopiarCodigo.style.display = 'block';
        });
        
         window.electronAPI.onVPNDisconnected(() => {
             console.log('🔌 VPN desconectada externamente');
             showStatus('VPN desconectada externamente.', 'status');
             vpnPid = null;
             updateConnectionButtons();
         });

         window.electronAPI.onVPNConnected((event, data) => {
             console.log('🔗 VPN conectada:', data);
             vpnPid = data.pid;
             updateConnectionButtons();
             showStatus('VPN conectada com sucesso!', 'success');
         });
        
        window.electronAPI.onVPNLog((event, log) => {
            console.log('📝 Log VPN recebido:', log);
            if (userLogs && userLogs.style.display === 'block') {
                addLogEntry(log);
            }
        });

        // ✅ CORREÇÃO: Listener para desafios VPN
        window.electronAPI.onVpnChallenge((event, challengeData) => {
            console.log('🔐 Recebido desafio VPN:', challengeData);

            if (challengeData && challengeData.requiresInput) {
                console.log('📢 Mostrando modal de desafio 2FA...');
                showChallengeModal(challengeData.message);
            }
        });

        console.log('✅ Listeners do Electron configurados com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao configurar listeners do Electron:', error);
        showStatus('Erro ao configurar comunicação com a aplicação', 'alert');
    }
}

// ============ GESTÃO DO MODAL 2FA ============

let challengeTimer = null;
let challengeTimeLeft = 120;

function showChallengeModal(message) {
    console.log('📢 Mostrando modal 2FA:', message);
    
    // Atualizar mensagem
    document.getElementById('challengeMessage').textContent = message;
    
    // Resetar timer
    challengeTimeLeft = 120;
    updateChallengeTimer();
    
    // Mostrar modal
    document.getElementById('challengeModal').style.display = 'flex';
    
    // Focar no input
    document.getElementById('challengeResponse').focus();
    
    // Iniciar timer
    challengeTimer = setInterval(() => {
        challengeTimeLeft--;
        updateChallengeTimer();
        
        if (challengeTimeLeft <= 0) {
            hideChallengeModal();
            // Timeout - enviar mensagem de erro
            window.electronAPI.sendChallengeResponse('TIMEOUT');
        }
    }, 1000);
}

function hideChallengeModal() {
    const modal = document.getElementById('challengeModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Limpar timer se existir
    if (window.challengeTimer) {
        clearInterval(window.challengeTimer);
        window.challengeTimer = null;
    }
}

function updateChallengeTimer() {
    const timerElement = document.getElementById('challengeTimer');
    if (timerElement) {
        timerElement.textContent = `Tempo restante: ${challengeTimeLeft} segundos`;
        
        // Mudar cor conforme o tempo diminui
        if (challengeTimeLeft <= 30) {
            timerElement.style.color = '#ff6b6b';
        } else if (challengeTimeLeft <= 60) {
            timerElement.style.color = '#ffc107';
        } else {
            timerElement.style.color = '#ffc107';
        }
    }
}

// ============ LISTENERS PARA OS EVENTOS DO MAIN PROCESS ============

function setupChallengeListener() {
    if (!window.electronAPI) return;

    // Remover qualquer listener anterior
    window.electronAPI.removeAllListeners('vpn-challenge');

    // Adicionar novo listener - RECEBE APENAS OS DADOS, NÃO EVENTO
    window.electronAPI.onVpnChallenge((challengeData) => {
        console.log('🎯 Desafio VPN recebido (CORRIGIDO):', challengeData);

        if (challengeData && challengeData.type === 'static-challenge' && challengeData.requiresInput) {
            console.log('📢 Mostrando modal de desafio 2FA...');
            showChallengeModal(challengeData.message);
        }
    });

    console.log('✅ Listener de desafio VPN configurado corretamente');
}

function showChallengeModal(challengeMessage) {
  console.log('🔄 Mostrando modal 2FA com mensagem:', challengeMessage);
  
  const modal = document.getElementById('challengeModal');
  const messageElement = document.getElementById('challengeMessage');
  const inputElement = document.getElementById('challengeResponse');
  
  if (!modal || !messageElement || !inputElement) {
    console.error('❌ Elementos do modal 2FA não encontrados');
    return;
  }
  
  // Atualizar mensagem
  messageElement.textContent = challengeMessage;
  
  // Resetar e mostrar modal
  inputElement.value = '';
  modal.style.display = 'flex';
  
  // Focar no input
  inputElement.focus();
  
  // Configurar timer
  startChallengeTimer();
}

function startChallengeTimer() {
    let timeLeft = 120;
    const timerElement = document.getElementById('challengeTimer');
    
    const timer = setInterval(() => {
        timeLeft--;
        
        if (timerElement) {
            timerElement.textContent = `Tempo restante: ${timeLeft} segundos`;
            
            // Mudar cor conforme o tempo diminui
            if (timeLeft <= 30) {
                timerElement.style.color = '#ff6b6b';
            } else if (timeLeft <= 60) {
                timerElement.style.color = '#ffc107';
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            hideChallengeModal();
            showStatus('Tempo esgotado para o token 2FA', 'alert');
        }
    }, 1000);
    
    // Guardar referencia do timer para limpar se necessário
    window.challengeTimer = timer;
}

function closeChallengeModal() {
    const modal = document.getElementById('challengeModal');
    if (modal) {
        modal.style.display = 'none';
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
            if (userItem) userItem.classList.toggle('active', modoUsuarioCheckbox.checked);
            if (azureItem) azureItem.classList.toggle('active', modoAzureCheckbox.checked);
        }
    }
    toggleMode();
    saveApplicationState(); // SALVAR ESTADO
}

function toggleMode() {
  if (modoUsuarioCheckbox.checked) {
    formUsuario.style.display = 'block';
    formAzure.style.display = 'none';
    initializeUserMode();
  } else {
    formUsuario.style.display = 'none';
    formAzure.style.display = 'block';
    // ✅ GARANTIR QUE CAMPO 2FA ESTEJA ESCONDIDO NO MODO AZURE
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
    if (configModal) {
        configModal.style.display = 'flex';
        loadConfigModalData();
    }
}

function closeConfigModal() {
    if (configModal) {
        configModal.style.display = 'none';
        resetUserProfileForm();
        resetAzureProfileForm();
    }
}

// ============ GESTÃO DE CONFIGURAÇÕES AZURE ============

async function loadAzureConfig() {
    try {
        console.log('🔧 Carregando configurações do app Azure...');
        const result = await window.electronAPI.getAzureAppConfig();

        if (result.success && result.config) {
            const config = result.config;

            // Preencher os campos do formulário
            document.getElementById('azureClientId').value = config.client_id || '';
            document.getElementById('azureTenantId').value = config.tenant_id || '';
            document.getElementById('azureScope').value = config.scope || '';
            document.getElementById('azureServerApi').value = config.server_api || '';

            console.log('✅ Configurações do app Azure carregadas com sucesso');
        } else {
            console.log('ℹ️ Nenhuma configuração do app Azure encontrada, campos vazios');
            // Limpar campos se não houver configuração
            document.getElementById('azureClientId').value = '';
            document.getElementById('azureTenantId').value = '';
            document.getElementById('azureScope').value = '';
            document.getElementById('azureServerApi').value = '';
        }
    } catch (error) {
        console.error('❌ Erro ao carregar configurações do app Azure:', error);
        showStatus('Erro ao carregar configurações do app Azure', 'alert');
    }
}

async function saveAzureConfig() {
    try {
        const config = {
            client_id: document.getElementById('azureClientId').value.trim(),
            tenant_id: document.getElementById('azureTenantId').value.trim(),
            scope: document.getElementById('azureScope').value.trim(),
            server_api: document.getElementById('azureServerApi').value.trim()
        };

        // Validação básica
        if (!config.client_id || !config.tenant_id) {
            showStatus('Client ID e Tenant ID são obrigatórios', 'alert');
            return;
        }

        console.log('💾 Salvando configurações Azure...', config);

        const result = await window.electronAPI.saveAzureAppConfig(config);

        if (result.success) {
            showStatus('✅ Configurações Azure salvas com sucesso!', 'success');
            console.log('✅ Configurações Azure salvas com sucesso');
        } else {
            showStatus(`❌ Erro ao salvar configurações: ${result.error}`, 'alert');
        }
    } catch (error) {
        console.error('❌ Erro ao salvar configurações Azure:', error);
        showStatus('Erro ao salvar configurações Azure', 'alert');
    }
}

async function loadConfigModalData() {
    try {
        await loadUserProfiles();
        await loadAzureProfiles();
        await loadAzureConfig();
        renderConfigProfiles();
        renderAzureProfiles();
    } catch (error) {
        console.error('Erro ao carregar dados do modal:', error);
    }
}

// ============ SELEÇÃO DE ARQUIVOS OVPN ============
async function selectOvpnFile(mode) {
    try {
        console.log(`📁 Selecionando arquivo OVPN para modo: ${mode}`);
        showStatus('Selecionando arquivo OVPN...', 'status');
        
        const result = await window.electronAPI.selectOvpnFile();
        console.log('Resultado da seleção:', result);
        
        if (result.success) {
            const ovpnFile = {
                path: result.filePath,
                name: result.fileName,
                content: result.content,
                server: extractServerInfo(result.content)
            };
            
            if (mode === 'user') {
                currentUserOvpnFile = result.filePath;
                currentUserOvpnContent = result.content;
                currentUserOvpnFileName = result.fileName;
                
                if (configOvpnName) configOvpnName.textContent = `${result.fileName} (${ovpnFile.server})`;
                if (configOvpnInfo) configOvpnInfo.style.display = 'block';
                
                if (configSaveUserProfile) {
                    configSaveUserProfile.style.display = 'block';
                    console.log('✅ Botão de salvar perfil de usuário mostrado');
                }
                
                showStatus(`Arquivo ${result.fileName} selecionado para modo usuário`, 'success');
            } else {
                currentAzureOvpnFile = result.filePath;
                currentAzureOvpnContent = result.content;
                currentAzureOvpnFileName = result.fileName;
                
                if (configAzureOvpnName) configAzureOvpnName.textContent = `${result.fileName} (${ovpnFile.server})`;
                if (configAzureOvpnInfo) configAzureOvpnInfo.style.display = 'block';
                
                if (configSaveAzureProfileBtn) {
                    configSaveAzureProfileBtn.style.display = 'block';
                    console.log('✅ Botão de salvar perfil Azure mostrado');
                }
                
                showStatus(`Arquivo ${result.fileName} selecionado para Azure AD`, 'success');
            }
        } else {
            console.error('❌ Erro ao selecionar arquivo:', result.error);
            showStatus(`Erro: ${result.error}`, 'alert');
        }
    } catch (error) {
        console.error('❌ Erro ao selecionar arquivo:', error);
        showStatus(`Erro ao selecionar arquivo: ${error.message}`, 'alert');
    }
}

// ============ SISTEMA DE 2FA CORRIGIDO ============

// Inicializar elementos 2FA - criar dinamicamente
function initialize2FAElements() {
  console.log('🔧 Inicializando elementos 2FA...');

  // Crie um container para info de 2FA (não input)
  twoFAContainer = document.createElement('div');
  twoFAContainer.className = 'twofa-section';
  twoFAContainer.style.display = 'none'; // Sempre escondido inicialmente

  twoFALabel = document.createElement('div');
  twoFALabel.className = 'twofa-info-badge';
  twoFALabel.innerHTML = '<strong>⚠️ Este perfil requer 2FA</strong><br>Digite usuário e senha para iniciar. O token será solicitado durante a conexão.';

  const helpText = document.createElement('small');
  helpText.className = 'twofa-help text-muted';
  helpText.textContent = 'Use o Google Authenticator para gerar o token quando solicitado.';

  twoFAContainer.appendChild(twoFALabel);
  twoFAContainer.appendChild(helpText);

  // Insira após o campo de senha
  const passwordField = document.getElementById('userPassword');
  if (passwordField && passwordField.parentNode) {
    passwordField.parentNode.insertAdjacentElement('afterend', twoFAContainer);
  }

  // Criar elemento de input para 2FA (embora não usado no fluxo atual, manter para consistência)
  twoFAInput = document.createElement('input');
  twoFAInput.type = 'password';
  twoFAInput.className = 'form-control';
  twoFAInput.placeholder = 'Digite o token 2FA';
  twoFAInput.style.display = 'none'; // Escondido por padrão

  console.log('✅ Elementos 2FA inicializados');
}

// Verificar se o perfil requer 2FA
async function check2FARequirement(profileId) {
  try {
    const result = await window.electronAPI.detect2FARequirement(profileId);
    
    if (result.success) {
      requires2FA = result.requires2FA;
      current2FAProfileId = profileId;
      
      if (requires2FA) {
        show2FAInfo(); // Mudei o nome da função para refletir que é só info
        showStatus('Perfil requer autenticação de dois fatores (2FA). Token será solicitado após iniciar conexão.', 'status');
      } else {
        hide2FAInfo();
      }
      
      validateUserForm();
    }
  } catch (error) {
    console.error('❌ Erro ao detectar requisito de 2FA:', error);
    showStatus('Erro ao verificar 2FA', 'alert');
  }
}

function show2FAInfo() {
  if (twoFAContainer) {
    twoFAContainer.style.display = 'block';
    twoFAContainer.classList.add('active');
  }
}

function hide2FAInfo() {
  if (twoFAContainer) {
    twoFAContainer.style.display = 'none';
    twoFAContainer.classList.remove('active');
  }
}

// Mostrar campo 2FA
function show2FAField(promptText = 'Token 2FA', usesEcho = false) {
  console.log('📢 Mostrando campo 2FA:', { promptText, usesEcho });
  
  // Garantir que os elementos estão inicializados
  if (!twoFAContainer || !twoFAInput) {
    console.log('🔄 Elementos 2FA não inicializados, inicializando...');
    initialize2FAElements();
  }
  
  if (!twoFAContainer || !twoFAInput) {
    console.error('❌ Elementos 2FA não disponíveis após inicialização');
    return;
  }
  
  // Atualizar label
  if (twoFALabel) {
    twoFALabel.innerHTML = `🔐 ${promptText}`;
  }
  
  // Configurar input
  if (usesEcho) {
    twoFAInput.placeholder = `Digite ${promptText.toLowerCase()} (visível)`;
    twoFAInput.type = 'text';
  } else {
    twoFAInput.placeholder = `Digite ${promptText.toLowerCase()}`;
    twoFAInput.type = 'password';
  }
  
  // Mostrar elementos
  twoFAContainer.style.display = 'block';
  twoFAInput.required = true;
  twoFAContainer.classList.add('active');
  
  const infoBadge = document.getElementById('twoFAInfoBadge');
  if (infoBadge) {
    infoBadge.style.display = 'block';
  }
  
  console.log('✅ Campo 2FA mostrado com sucesso');
}

// Esconder campo 2FA
function hide2FAField() {
  console.log('👻 Escondendo campo 2FA');
  
  if (twoFAContainer) {
    twoFAContainer.style.display = 'none';
    twoFAContainer.classList.remove('active');
  }
  
  if (twoFAInput) {
    twoFAInput.required = false;
    twoFAInput.value = '';
    twoFAInput.type = 'password'; // Reset para password
  }
  
  const infoBadge = document.getElementById('twoFAInfoBadge');
  if (infoBadge) {
    infoBadge.style.display = 'none';
  }
  
  requires2FA = false;
  current2FAProfileId = null;
  
  console.log('✅ Campo 2FA escondido com sucesso');
}

// Obter credenciais completas
function getCompleteCredentials() {
  const username = userUsername.value.trim();
  const password = userPassword.value;
  const twoFAToken = twoFAInput ? twoFAInput.value.trim() : '';
  
  console.log('🔐 Obtendo credenciais:', {
    username,
    passwordLength: password.length,
    requires2FA,
    twoFATokenLength: twoFAToken.length
  });
  
  if (requires2FA && twoFAToken) {
    return {
      username: username,
      password: password + twoFAToken,
    };
  }
  
  return {
    username: username,
    password: password,
  };
}

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
    if (!configProfilesList) return;
    
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
    if (!configAzureProfilesList) return;
    
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
    
    // ✅ CORREÇÃO: Primeiro esconder, depois verificar se precisa mostrar
    hide2FAField();
    
    // Verificar se este perfil requer 2FA
    await check2FARequirement(profileId);
    
    // Carregar credenciais salvas
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
        
        saveApplicationState(); // SALVAR ESTADO
        
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
    saveApplicationState(); // SALVAR ESTADO
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
        showStatus(`Iniciando conexão ao perfil "${currentUserProfile.name}"...`, 'status');
        userLogs.innerHTML = '';
        userLogs.style.display = 'block';

        // ✅ ENVIAR APENAS USUÁRIO E SENHA
        const result = await window.electronAPI.connectOpenVPNUserPassProfile(
            currentUserProfile.id,
            username,
            password
        );

        vpnPid = result.pid;
        console.log(`🔌 [RENDERER] VPN PID definido: ${vpnPid}`);
        showStatus(`Conexão iniciada. Aguardando autenticação...`, 'status');

        saveApplicationState();

    } catch (err) {
        console.log(`❌ [RENDERER] Erro na conexão: ${err.message}`);
        console.log(`❌ [RENDERER] Limpando VPN PID devido a erro`);
        vpnPid = null; // Garantir que vpnPid seja limpo em caso de erro
        showStatus(`Erro: ${err.message}`, 'alert');
        btnConectarUsuario.disabled = false;
        btnDesconectarUsuario.disabled = true;
    }
}

async function disconnectUserVPN() {
  console.log(`🔌 [RENDERER] Botão desconectar clicado. VPN PID atual: ${vpnPid}`);
  console.log(`🔌 [RENDERER] Verificando se electronAPI.disconnectOpenVPN existe:`, !!window.electronAPI?.disconnectOpenVPN);

  try {
    if (vpnPid) {
      console.log(`🔌 [RENDERER] Enviando solicitação de desconexão para PID: ${vpnPid}`);
      const result = await window.electronAPI.disconnectOpenVPN(vpnPid);
      console.log(`🔌 [RENDERER] Resultado da desconexão:`, result);
      showStatus(`VPN desconectada (PID: ${vpnPid})`, 'status');
      vpnPid = null;
    } else {
      console.log(`🔌 [RENDERER] Nenhum VPN PID encontrado`);
      showStatus('Nenhuma conexão ativa encontrada.', 'status');
    }
        
        btnConectarUsuario.disabled = false;
        btnDesconectarUsuario.disabled = true;
        userLogs.style.display = 'none';
        
        if (twoFAInput) {
            twoFAInput.value = '';
        }

        saveApplicationState(); // SALVAR ESTADO APÓS DESCONEXÃO
    } catch (err) {
        showStatus(`Erro ao desconectar: ${err.message}`, 'alert');
    }
}

async function connectAzureVPN() {
    // ✅ PROTEÇÃO: Verificar se já há uma conexão em andamento
    if (vpnPid !== null) {
        showStatus('Já existe uma conexão VPN ativa', 'alert');
        return;
    }

    try {
        showStatus('Iniciando login Azure...', 'status');
        if (btnCopiarCodigo) btnCopiarCodigo.style.display = 'none';

        const { token, username } = await window.electronAPI.loginAzure();
        showStatus(`Login realizado: ${username}`, 'status');

        await window.electronAPI.publishToken(username, token);
        showStatus('Token publicado. Conectando...', 'status');

        const { pid, shortID } = await window.electronAPI.connectOpenVPN();
        vpnPid = pid;
        showStatus(`Conectado! PID: ${pid}, ID: ${shortID}`, 'success');
        if (btnCopiarCodigo) btnCopiarCodigo.style.display = 'none';

        updateConnectionButtons();
        saveApplicationState(); // SALVAR ESTADO APÓS CONEXÃO
    } catch (err) {
        showStatus(`Erro: ${err.message}`, 'alert');
        if (btnCopiarCodigo) btnCopiarCodigo.style.display = 'none';
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
        if (btnCopiarCodigo) btnCopiarCodigo.style.display = 'none';
        saveApplicationState(); // SALVAR ESTADO APÓS DESCONEXÃO
    } catch (err) {
        showStatus(`Erro ao desconectar: ${err.message}`, 'alert');
    }
}

// ============ FUNÇÕES AUXILIARES ============
function updateConnectionButtons() {
    const isConnected = vpnPid !== null;
    
    if (modoUsuarioCheckbox.checked) {
        if (btnConectarUsuario) btnConectarUsuario.disabled = isConnected || !isUserFormValid();
        if (btnDesconectarUsuario) btnDesconectarUsuario.disabled = !isConnected;
    } else {
        if (btnConectarAzure) btnConectarAzure.disabled = isConnected;
        if (btnDesconectarAzure) btnDesconectarAzure.disabled = !isConnected;
    }
}

function updateUserConfigDisplay() {
    if (currentConfigInfo && currentConfigName) {
        if (currentUserProfile) {
            currentConfigName.textContent = `${currentUserProfile.name} (${currentUserProfile.server || 'Servidor'})`;
            currentConfigInfo.style.display = 'block';
        } else {
            currentConfigInfo.style.display = 'none';
        }
    }
}

function updateAzureConfigDisplay() {
    if (azureConfigInfo && azureConfigName) {
        if (currentAzureProfile) {
            azureConfigName.textContent = currentAzureProfile.name;
            azureConfigInfo.style.display = 'block';
        } else {
            azureConfigInfo.style.display = 'none';
        }
    }
}

function validateUserForm() {
    updateConnectionButtons();
}

function isUserFormValid() {
    const username = userUsername?.value?.trim() || '';
    const password = userPassword?.value || '';
    const hasBasicCredentials = username && password;
    return hasBasicCredentials && currentUserProfile; // Só isso!
}

function toggleProfileNameField() {
    if (configProfileName) {
        configProfileName.style.display = this.checked ? 'block' : 'none';
    }
}

function toggleAzureProfileNameField() {
    if (configAzureProfileName) {
        configAzureProfileName.style.display = this.checked ? 'block' : 'none';
    }
}

function addLogEntry(log) {
    if (!userLogs) return;
    
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    logLine.textContent = log;
    userLogs.appendChild(logLine);
    userLogs.scrollTop = userLogs.scrollHeight;
}

async function copyDeviceCode() {
    if (currentDeviceCodeMessage && btnCopiarCodigo) {
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
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    console.log(`📢 Status: ${message} (${type})`);
}

function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// ============ EVENTOS GLOBAIS ============

// Evento antes de fechar a janela
window.addEventListener('beforeunload', async function() {
    await saveApplicationState();
});

// ============ FUNÇÕES GLOBAIS PARA HTML ============
// Estas funções precisam ser globais para serem chamadas do HTML
window.setActiveUserProfile = setActiveUserProfile;
window.setActiveAzureProfile = setActiveAzureProfile;
window.deleteUserProfile = deleteUserProfile;
window.deleteAzureProfile = deleteAzureProfile;
