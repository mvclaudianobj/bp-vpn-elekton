#!/usr/bin/env node

// Testes práticos das funções relacionadas à seleção/importação de .ovpn.
// Usa dados fictícios para evitar versionamento/exposição de material sensível.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

let selectedOvpnFile = null;
let selectedAzureOvpnFile = null;

function hasInlineBlock(content, blockName) {
    const escapedName = String(blockName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^\\s*<${escapedName}>\\s*$[\\s\\S]*?^\\s*</${escapedName}>\\s*$`, 'im').test(String(content || ''));
}

function hasDirective(content, directiveName) {
    const escapedName = String(directiveName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^\\s*${escapedName}(?:\\s|$)`, 'im').test(String(content || ''));
}

function validateOvpnFixture(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return { valid: false, error: 'Caminho do arquivo OVPN não informado' };
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
        return { valid: false, error: 'Caminho selecionado não é arquivo regular' };
    }

    if (path.extname(filePath).toLowerCase() !== '.ovpn') {
        return { valid: false, error: 'Arquivo inválido. Selecione um arquivo com extensão .ovpn' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const hasRemote = hasDirective(content, 'remote');
    const hasClientMode = hasDirective(content, 'client') || hasDirective(content, 'tls-client') || hasDirective(content, 'dev');
    const hasAuthUserPass = hasDirective(content, 'auth-user-pass');
    const hasCa = hasDirective(content, 'ca') || hasInlineBlock(content, 'ca');
    const hasTlsAuth = hasDirective(content, 'tls-auth') || hasInlineBlock(content, 'tls-auth');
    const clientCertDisabled = /^\s*setenv\s+CLIENT_CERT\s+0\b/im.test(content);

    if (!hasRemote || !hasClientMode || !hasCa) {
        return { valid: false, error: 'Conteúdo OVPN obrigatório ausente' };
    }

    return {
        valid: true,
        fileName: path.parse(filePath).name,
        metadata: { hasRemote, hasClientMode, hasAuthUserPass, hasCa, hasTlsAuth, clientCertDisabled }
    };
}

function validateAzureOvpnTagsFixture(ovpnContent) {
    const azureTagRegex = /^\s*#AZURE:\s*([^=\s]+)\s*=\s*(.+?)\s*$/gim;
    const foundTags = new Set();
    let match;

    while ((match = azureTagRegex.exec(String(ovpnContent || ''))) !== null) {
        foundTags.add(String(match[1] || '').trim().toLowerCase());
    }

    if (foundTags.size === 0) {
        return {
            valid: false,
            error: 'Configuração não compatível com perfil Azure/Entra ID. O arquivo .ovpn deve conter tags #AZURE de configuração.'
        };
    }

    const requiredTags = ['client_id', 'tenant_id', 'scope', 'server_api'];
    const missingTags = requiredTags.filter(tag => !foundTags.has(tag));

    return {
        valid: true,
        foundTags: Array.from(foundTags),
        missingTags
    };
}

function removeUnsupportedOvpnDirectivesFixture(ovpnContent) {
    const inlineBlockStartRegex = /^\s*<([a-zA-Z0-9_-]+)>\s*$/;
    const inlineBlockEndRegex = /^\s*<\/([a-zA-Z0-9_-]+)>\s*$/;
    const processedLines = [];
    let currentInlineBlock = null;

    for (const line of String(ovpnContent || '').split('\n')) {
        const originalLine = line.replace(/\r$/, '');
        const trimmedLine = originalLine.trim();

        if (currentInlineBlock) {
            processedLines.push(originalLine);
            const blockEndMatch = trimmedLine.match(inlineBlockEndRegex);
            if (blockEndMatch && blockEndMatch[1].toLowerCase() === currentInlineBlock.toLowerCase()) {
                currentInlineBlock = null;
            }
            continue;
        }

        const blockStartMatch = trimmedLine.match(inlineBlockStartRegex);
        if (blockStartMatch) {
            currentInlineBlock = blockStartMatch[1];
            processedLines.push(originalLine);
            continue;
        }

        if (/^keysize\b/i.test(trimmedLine)) {
            continue;
        }

        processedLines.push(originalLine);
    }

    return processedLines.join('\n');
}

function getFriendlyIpcErrorMessageFixture(error) {
    let message = String(error?.message || error || 'Erro desconhecido');

    message = message.replace(/^Error invoking remote method '[^']+':\s*/i, '');
    message = message.replace(/^Error:\s*/i, '');

    if (/Falha na autenticação/i.test(message)) {
        return 'Falha na autenticação: usuário, senha ou token incorretos. Verifique também a permissão no Controle OpenVPN.';
    }

    return message;
}

function isActiveVpnErrorFixture(error) {
    const message = getFriendlyIpcErrorMessageFixture(error);
    return /Já existe uma conexão VPN ativa|conexão VPN ativa|VPN ativa/i.test(message);
}

async function promptForceDisconnectActiveVpnFixture({ confirmResult, killResult }) {
    const statusCalls = [];
    const buttonUpdates = [];
    const stateSaves = [];
    const shownConnectionElements = [];
    let vpnPidFixture = 1234;
    let killCalled = false;

    const windowFixture = {
        confirm: () => confirmResult,
        electronAPI: {
            killVPNConnection: async () => {
                killCalled = true;
                return killResult;
            }
        }
    };

    function showStatus(message, type) {
        statusCalls.push({ message, type });
    }

    function updateConnectionButtons() {
        buttonUpdates.push({ vpnPid: vpnPidFixture });
    }

    async function saveApplicationState() {
        stateSaves.push({ vpnPid: vpnPidFixture });
    }

    function showConnectionElements() {
        shownConnectionElements.push(true);
    }

    async function promptForceDisconnectActiveVpn() {
        const shouldForce = windowFixture.confirm(
            'Já existe uma conexão VPN ativa ou presa pelo BluePex VPN.\n\n' +
            'Deseja forçar a desconexão agora?\n\n' +
            'Isso tentará encerrar apenas a conexão VPN gerenciada pelo BluePex.'
        );

        if (!shouldForce) {
            return false;
        }

        try {
            showStatus('Forçando desconexão da VPN ativa...', 'warning');
            const result = await windowFixture.electronAPI.killVPNConnection();

            if (result?.success) {
                vpnPidFixture = null;
                await saveApplicationState();
                showConnectionElements();
                updateConnectionButtons();
                showStatus('VPN desconectada com sucesso. Tente conectar novamente.', 'success');
                return true;
            }

            showStatus(`Falha ao forçar desconexão: ${result?.error || 'erro desconhecido'}`, 'alert');
            updateConnectionButtons();
            return false;
        } catch (forceError) {
            showStatus(`Erro ao forçar desconexão: ${forceError.message}`, 'alert');
            updateConnectionButtons();
            return false;
        }
    }

    const disconnected = await promptForceDisconnectActiveVpn();

    return {
        disconnected,
        killCalled,
        statusCalls,
        buttonUpdates,
        stateSaves,
        shownConnectionElements,
        vpnPid: vpnPidFixture
    };
}

function createFixtures() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bluepex-ovpn-tests-'));
    const inlineContent = `persist-tun
persist-key
data-ciphers AES-256-GCM
data-ciphers-fallback AES-256-GCM
auth SHA256
tls-client
client
resolv-retry infinite
remote 127.0.0.1 2006 udp4
nobind
auth-user-pass
remote-cert-tls server
comp-lzo adaptive
explicit-exit-notify

<ca>
-----BEGIN CERTIFICATE-----
MIIBFAKECERTDATAFORTESTONLY
-----END CERTIFICATE-----
</ca>
setenv CLIENT_CERT 0
key-direction 1
<tls-auth>
#
# 2048 bit OpenVPN static key - fictício
#
-----BEGIN OpenVPN Static key V1-----
FAKESTATICKEYDATAFORTESTONLY
-----END OpenVPN Static key V1-----
</tls-auth>
`;

    const validLower = path.join(tmpDir, 'perfil-valido.ovpn');
    const validUpper = path.join(tmpDir, 'PERFIL-VALIDO.OVPN');
    const azureValid = path.join(tmpDir, 'perfil-azure-valido.ovpn');
    const invalidExt = path.join(tmpDir, 'perfil-invalido.txt');
    const keysizeCompat = path.join(tmpDir, 'perfil-keysize-compat.ovpn');
    const azureContent = `${inlineContent}
#AZURE: client_id=fake-client-id
#AZURE: tenant_id=fake-tenant-id
#AZURE: scope=api://fake-client-id/.default
#AZURE: server_api=https://vpn-api.example.invalid
`;
    const keysizeCompatContent = `${inlineContent}
keysize 256
key-direction 1
<key>
keysize 256
-----BEGIN PRIVATE KEY-----
FAKEPRIVATEKEYDATAFORTESTONLY
-----END PRIVATE KEY-----
</key>
`;

    fs.writeFileSync(validLower, inlineContent, 'utf-8');
    fs.writeFileSync(validUpper, inlineContent, 'utf-8');
    fs.writeFileSync(azureValid, azureContent, 'utf-8');
    fs.writeFileSync(invalidExt, inlineContent, 'utf-8');
    fs.writeFileSync(keysizeCompat, keysizeCompatContent, 'utf-8');

    return { tmpDir, validLower, validUpper, azureValid, invalidExt, keysizeCompat };
}

async function testHandleOvpnFileSelection(filePath) {
    const result = validateOvpnFixture(filePath);
    if (!result.valid) return false;

    selectedOvpnFile = {
        path: filePath,
        name: result.fileName,
        content: fs.readFileSync(filePath, 'utf-8')
    };

    assert.strictEqual(selectedOvpnFile.name, path.parse(filePath).name);
    return true;
}

async function testSaveUserProfileConfig() {
    assert.ok(selectedOvpnFile, 'Nenhum arquivo selecionado');
    assert.ok(selectedOvpnFile.content.includes('setenv CLIENT_CERT 0'));
    selectedOvpnFile = null;
    return true;
}

async function testSaveAzureProfileConfigFailureShowsStatus(filePath) {
    const statusCalls = [];
    const configStatusCalls = [];
    const saveButton = { disabled: false, textContent: 'Salvar Perfil Azure' };
    const profileNameInput = { value: 'Azure Teste' };
    const mainError = 'Configuração não compatível com perfil Azure/Entra ID. O arquivo .ovpn deve conter tags #AZURE de configuração.';

    selectedAzureOvpnFile = {
        path: filePath,
        name: path.parse(filePath).name,
        content: fs.readFileSync(filePath, 'utf-8')
    };

    async function saveAzureConfig() {
        return { success: false, error: mainError };
    }

    function showStatus(message, type) {
        statusCalls.push({ message, type });
    }

    function showConfigStatus(message, type) {
        configStatusCalls.push({ message, type });
    }

    async function saveAzureProfileConfigFixture() {
        if (!selectedAzureOvpnFile) {
            showStatus('Por favor, selecione um arquivo OVPN Azure primeiro.', 'alert');
            showConfigStatus('Por favor, selecione um arquivo OVPN Azure primeiro.', 'alert');
            return;
        }

        if (!profileNameInput.value.trim()) {
            showStatus('Por favor, digite um nome para o perfil Azure.', 'alert');
            showConfigStatus('Por favor, digite um nome para o perfil Azure.', 'alert');
            return;
        }

        const originalButtonText = saveButton.textContent;

        try {
            showStatus('Salvando perfil Azure...', 'status');
            showConfigStatus('Salvando perfil Azure...', 'status');
            saveButton.disabled = true;
            saveButton.textContent = 'Salvando...';

            const result = await saveAzureConfig(
                `azure_${Date.now()}`,
                selectedAzureOvpnFile.content,
                profileNameInput.value.trim(),
                selectedAzureOvpnFile.path
            );

            if (result?.success) {
                showStatus(`Perfil Azure "${profileNameInput.value.trim()}" salvo com sucesso!`, 'success');
                showConfigStatus(`Perfil Azure "${profileNameInput.value.trim()}" salvo com sucesso!`, 'success');
            } else {
                const errorMessage = result?.error || 'Falha desconhecida ao salvar perfil Azure.';
                showStatus(`Erro ao salvar perfil Azure: ${errorMessage}`, 'alert');
                showConfigStatus(`Erro ao salvar perfil Azure: ${errorMessage}`, 'alert');
            }
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = originalButtonText;
        }
    }

    await saveAzureProfileConfigFixture();

    const errorStatus = statusCalls.find(call => call.type === 'alert');
    assert.ok(errorStatus, 'Falha de salvamento Azure deveria exibir status de erro');
    assert.ok(errorStatus.message.includes(mainError), 'Status deveria incluir mensagem retornada pelo main');
    const localErrorStatus = configStatusCalls.find(call => call.type === 'alert');
    assert.ok(localErrorStatus, 'Falha de salvamento Azure deveria exibir status local de erro nas configurações');
    assert.ok(localErrorStatus.message.includes(mainError), 'Status local deveria incluir mensagem retornada pelo main');
    assert.strictEqual(saveButton.disabled, false, 'Botão Azure deveria ser reabilitado após erro');
    assert.strictEqual(saveButton.textContent, 'Salvar Perfil Azure', 'Texto do botão Azure deveria ser restaurado após erro');
    selectedAzureOvpnFile = null;
    return true;
}

async function runTests() {
    console.log('🚀 Iniciando testes das funções de seleção/importação OVPN...\n');
    const fixtures = createFixtures();

    try {
        assert.strictEqual(validateOvpnFixture(fixtures.validLower).valid, true, '.ovpn válido deveria passar');
        console.log('Teste 1 - .ovpn válido:', '✅ PASSOU');

        const upperValidation = validateOvpnFixture(fixtures.validUpper);
        assert.strictEqual(upperValidation.valid, true, '.OVPN deveria passar');
        assert.strictEqual(upperValidation.fileName, 'PERFIL-VALIDO');
        console.log('Teste 2 - .OVPN case-insensitive:', '✅ PASSOU');

        assert.strictEqual(validateOvpnFixture(fixtures.invalidExt).valid, false, 'extensão inválida deveria falhar');
        console.log('Teste 3 - extensão inválida:', '✅ PASSOU');

        const inlineValidation = validateOvpnFixture(fixtures.validLower);
        assert.strictEqual(inlineValidation.metadata.clientCertDisabled, true);
        assert.strictEqual(inlineValidation.metadata.hasCa, true);
        assert.strictEqual(inlineValidation.metadata.hasTlsAuth, true);
        assert.strictEqual(inlineValidation.metadata.hasAuthUserPass, true);
        console.log('Teste 4 - inline setenv CLIENT_CERT 0 + <ca> + <tls-auth>:', '✅ PASSOU');

        assert.strictEqual(await testHandleOvpnFileSelection(fixtures.validLower), true);
        console.log('Teste 5 - seleção simulada:', '✅ PASSOU');

        assert.strictEqual(await testSaveUserProfileConfig(), true);
        console.log('Teste 6 - salvamento simulado:', '✅ PASSOU');

        const azureWithoutTags = validateAzureOvpnTagsFixture(fs.readFileSync(fixtures.validLower, 'utf-8'));
        assert.strictEqual(azureWithoutTags.valid, false, 'Azure sem #AZURE deveria falhar');
        assert.ok(azureWithoutTags.error.includes('Configuração não compatível com perfil Azure/Entra ID'));
        console.log('Teste 7 - Azure sem tags #AZURE:', '✅ PASSOU');

        const azureWithTags = validateAzureOvpnTagsFixture(fs.readFileSync(fixtures.azureValid, 'utf-8'));
        assert.strictEqual(azureWithTags.valid, true, 'Azure com #AZURE deveria passar');
        assert.deepStrictEqual(azureWithTags.missingTags, []);
        console.log('Teste 8 - Azure com tags #AZURE:', '✅ PASSOU');

        assert.strictEqual(await testSaveAzureProfileConfigFailureShowsStatus(fixtures.validLower), true);
        console.log('Teste 9 - erro save Azure exibe status e restaura botão:', '✅ PASSOU');

        const keysizeProcessed = removeUnsupportedOvpnDirectivesFixture(fs.readFileSync(fixtures.keysizeCompat, 'utf-8'));
        assert.strictEqual((keysizeProcessed.match(/^\s*keysize\b/img) || []).length, 1, 'somente keysize dentro de bloco inline deveria permanecer');
        assert.strictEqual(/^\s*key-direction\s+1\b/im.test(keysizeProcessed), true, 'key-direction não deveria ser removido');
        assert.ok(/<key>[\s\S]*keysize 256[\s\S]*<\/key>/im.test(keysizeProcessed), 'keysize dentro de <key> deveria ser preservado');
        console.log('Teste 10 - keysize fora de bloco inline removido:', '✅ PASSOU');

        assert.strictEqual(isActiveVpnErrorFixture(new Error('Já existe uma conexão VPN ativa')), true, 'Erro de VPN ativa deveria ser reconhecido');
        assert.strictEqual(isActiveVpnErrorFixture('Erro qualquer'), false, 'Erro não relacionado não deveria ser reconhecido');
        console.log('Teste 11 - detector de erro VPN ativa:', '✅ PASSOU');

        const authErrorMessage = getFriendlyIpcErrorMessageFixture(
            "Error invoking remote method 'connect-openvpn-userpass-profile': Error: Falha na autenticação: usuário, senha ou token incorretos"
        );
        assert.ok(
            authErrorMessage.includes('Falha na autenticação: usuário, senha ou token incorretos. Verifique também a permissão no Controle OpenVPN.'),
            'Erro de autenticação deveria incluir orientação sobre permissão no Controle OpenVPN'
        );
        assert.strictEqual(
            authErrorMessage.includes('Error invoking remote method'),
            false,
            'Erro amigável não deveria incluir wrapper técnico do Electron'
        );
        console.log('Teste 12 - sanitização erro autenticação IPC:', '✅ PASSOU');

        const activeVpnWrappedMessage = getFriendlyIpcErrorMessageFixture(
            "Error invoking remote method 'connect-openvpn': Error: Já existe uma conexão VPN ativa"
        );
        assert.strictEqual(activeVpnWrappedMessage, 'Já existe uma conexão VPN ativa');
        assert.strictEqual(
            isActiveVpnErrorFixture("Error invoking remote method 'connect-openvpn': Error: Já existe uma conexão VPN ativa"),
            true,
            'Detector de VPN ativa deveria funcionar com wrapper IPC do Electron'
        );
        console.log('Teste 13 - sanitização erro VPN ativa IPC:', '✅ PASSOU');

        const forceDisconnectConfirmed = await promptForceDisconnectActiveVpnFixture({
            confirmResult: true,
            killResult: { success: true }
        });
        assert.strictEqual(forceDisconnectConfirmed.disconnected, true, 'Confirmação deveria desconectar com sucesso');
        assert.strictEqual(forceDisconnectConfirmed.killCalled, true, 'killVPNConnection deveria ser chamado quando confirmado');
        assert.strictEqual(forceDisconnectConfirmed.vpnPid, null, 'vpnPid deveria ser limpo após desconexão forçada');
        assert.strictEqual(forceDisconnectConfirmed.stateSaves.length, 1, 'Estado deveria ser salvo após desconexão forçada');
        assert.ok(forceDisconnectConfirmed.statusCalls.some(call => call.type === 'success'), 'Status de sucesso deveria ser exibido');
        console.log('Teste 14 - confirmação força desconexão BluePex:', '✅ PASSOU');

        const forceDisconnectCancelled = await promptForceDisconnectActiveVpnFixture({
            confirmResult: false,
            killResult: { success: true }
        });
        assert.strictEqual(forceDisconnectCancelled.disconnected, false, 'Cancelamento não deveria desconectar');
        assert.strictEqual(forceDisconnectCancelled.killCalled, false, 'killVPNConnection não deveria ser chamado quando cancelado');
        console.log('Teste 15 - cancelamento não força desconexão:', '✅ PASSOU');

        console.log('\n🎯 Todos os testes de UI/importação OVPN passaram!');
    } finally {
        fs.rmSync(fixtures.tmpDir, { recursive: true, force: true });
    }
}

if (require.main === module) {
    runTests().catch((error) => {
        console.error('❌ Falha nos testes:', error.message);
        process.exit(1);
    });
}
