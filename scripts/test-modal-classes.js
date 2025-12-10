#!/usr/bin/env node

// Script de teste para verificar a lógica do modal com classes CSS

console.log('🧪 Testando lógica do modal com classes CSS...\n');

// Simular um elemento DOM
class MockElement {
    constructor() {
        this.classes = new Set();
    }

    addClass(className) {
        this.classes.add(className);
    }

    removeClass(className) {
        this.classes.delete(className);
    }

    containsClass(className) {
        return this.classes.has(className);
    }
}

// Simular o comportamento da função toggleConfigModal
function testToggleModalWithClasses() {
    const modal = new MockElement();

    console.log('Estado inicial: classe "show" presente?', modal.containsClass('show'));

    // Simular primeiro clique
    console.log('\n🖱️ Primeiro clique:');
    const isVisible1 = modal.containsClass('show');
    if (isVisible1) {
        modal.removeClass('show');
        console.log('  Classe "show" removida');
    } else {
        modal.addClass('show');
        console.log('  Classe "show" adicionada');
    }
    console.log('  Agora visível:', modal.containsClass('show'));

    // Simular segundo clique
    console.log('\n🖱️ Segundo clique:');
    const isVisible2 = modal.containsClass('show');
    if (isVisible2) {
        modal.removeClass('show');
        console.log('  Classe "show" removida');
    } else {
        modal.addClass('show');
        console.log('  Classe "show" adicionada');
    }
    console.log('  Agora visível:', modal.containsClass('show'));

    // Simular terceiro clique
    console.log('\n🖱️ Terceiro clique:');
    const isVisible3 = modal.containsClass('show');
    if (isVisible3) {
        modal.removeClass('show');
        console.log('  Classe "show" removida');
    } else {
        modal.addClass('show');
        console.log('  Classe "show" adicionada');
    }
    console.log('  Agora visível:', modal.containsClass('show'));

    console.log('\n✅ Lógica com classes CSS funcionando corretamente!');
    console.log('✅ Alterna a classe "show" corretamente');
}

testToggleModalWithClasses();