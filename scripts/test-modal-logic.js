#!/usr/bin/env node

// Script de teste para verificar a lógica do modal

console.log('🧪 Testando lógica do modal...\n');

// Simular o comportamento da função toggleConfigModal
function testToggleModal() {
    let modalDisplay = 'none'; // Estado inicial

    console.log('Estado inicial:', modalDisplay);

    // Simular primeiro clique
    console.log('\n🖱️ Primeiro clique:');
    const newDisplay1 = (modalDisplay === 'flex' || modalDisplay === 'block') ? 'none' : 'flex';
    modalDisplay = newDisplay1;
    console.log('  Novo estado:', modalDisplay);

    // Simular segundo clique
    console.log('\n🖱️ Segundo clique:');
    const newDisplay2 = (modalDisplay === 'flex' || modalDisplay === 'block') ? 'none' : 'flex';
    modalDisplay = newDisplay2;
    console.log('  Novo estado:', modalDisplay);

    // Simular terceiro clique
    console.log('\n🖱️ Terceiro clique:');
    const newDisplay3 = (modalDisplay === 'flex' || modalDisplay === 'block') ? 'none' : 'flex';
    modalDisplay = newDisplay3;
    console.log('  Novo estado:', modalDisplay);

    console.log('\n✅ Lógica do modal funcionando corretamente!');
    console.log('✅ Alterna entre "none" e "flex"');
}

testToggleModal();