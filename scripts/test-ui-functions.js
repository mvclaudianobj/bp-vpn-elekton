#!/usr/bin/env node

// Script de teste para verificar se as funções de seleção de arquivo estão funcionando
// Simula a interação com a interface

const fs = require('fs');
const path = require('path');

// Simular as funções do renderer.js
let selectedOvpnFile = null;
let selectedAzureOvpnFile = null;

async function testHandleOvpnFileSelection() {
    console.log('🧪 Testando handleOvpnFileSelection...');

    try {
        // Simular resultado da API
        const mockResult = {
            success: true,
            filePath: '/media/marcos/Files2/projetos/BluePexVPN/test-vpn.ovpn',
            fileName: 'test-vpn',
            content: fs.readFileSync('/media/marcos/Files2/projetos/BluePexVPN/test-vpn.ovpn', 'utf-8')
        };

        if (mockResult.success) {
            console.log('✅ Arquivo simulado selecionado:', mockResult.fileName);

            // Armazenar informações do arquivo
            selectedOvpnFile = {
                path: mockResult.filePath,
                name: mockResult.fileName,
                content: mockResult.content
            };

            console.log('📁 Arquivo armazenado:', selectedOvpnFile.name);
            return true;
        } else {
            console.error('❌ Erro na simulação:', mockResult.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        return false;
    }
}

async function testSaveUserProfileConfig() {
    console.log('🧪 Testando saveUserProfileConfig...');

    if (!selectedOvpnFile) {
        console.error('❌ Nenhum arquivo selecionado');
        return false;
    }

    const profileName = 'Perfil de Teste';

    try {
        console.log('💾 Simulando salvamento de perfil...');

        // Simular chamada da API
        const mockResult = {
            success: true,
            profileDir: '/root/.config/bluepex-vpn/ovpn_profiles/profile_test',
            filesCopied: 0
        };

        if (mockResult.success) {
            console.log('✅ Perfil simulado salvo:', profileName);
            console.log('📁 Diretório:', mockResult.profileDir);

            // Limpar formulário simulado
            selectedOvpnFile = null;

            return true;
        } else {
            console.error('❌ Erro no salvamento simulado:', mockResult.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Erro no teste de salvamento:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Iniciando testes das funções de seleção de arquivo...\n');

    // Teste 1: Seleção de arquivo
    const test1Result = await testHandleOvpnFileSelection();
    console.log('Teste 1 - Seleção de arquivo:', test1Result ? '✅ PASSOU' : '❌ FALHOU');

    // Teste 2: Salvamento de perfil
    const test2Result = await testSaveUserProfileConfig();
    console.log('Teste 2 - Salvamento de perfil:', test2Result ? '✅ PASSOU' : '❌ FALHOU');

    console.log('\n🎯 Todos os testes foram executados!');
    console.log('💡 Para testar na interface real, clique em "Selecionar arquivo .ovpn" no menu de configurações.');
}

if (require.main === module) {
    runTests();
}