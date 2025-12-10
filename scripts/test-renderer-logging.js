#!/usr/bin/env node

// Script de teste para verificar o sistema de logging do renderer

const fs = require('fs');
const path = require('path');

// Simular o logger do main process
class TestLogger {
  constructor() {
    this.logDir = '/var/log/bluepex-vpn';
    this.currentLogFile = path.join(this.logDir, 'bluepex-vpn-2025-12-08.log');
  }

  log(category, action, data = {}, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      category,
      action,
      data,
      pid: process.pid
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.currentLogFile, logLine);
    console.log(`📝 Log gravado: ${category} -> ${action}`);
  }
}

const logger = new TestLogger();

// Simular logs do renderer
console.log('🧪 Testando sistema de logging do renderer...\n');

// Simular diferentes tipos de logs que o renderer enviaria
logger.log('RENDERER', 'INIT_START', {});
logger.log('RENDERER', 'CONSOLE_LOG', { args: ['🚀 DOM Carregado - Iniciando aplicação...'] });
logger.log('RENDERER', 'EVENT_LISTENER_ADDED', { element: 'menuBtn' });
logger.log('RENDERER', 'MENU_BUTTON_CLICKED', { button: '<button id="menuBtn">⚙️</button>' });
logger.log('RENDERER', 'TOGGLE_MODAL_CALLED', {});
logger.log('RENDERER', 'MODAL_DISPLAY_CHANGED', { from: 'none', to: 'block' });
logger.log('RENDERER', 'INIT_SUCCESS', {});

// Simular um erro
logger.log('RENDERER', 'GLOBAL_ERROR', {
  message: 'Test error',
  filename: 'renderer.js',
  lineno: 123,
  colno: 45
}, 'ERROR');

console.log('\n✅ Teste concluído! Verifique os logs com:');
console.log('tail -f /var/log/bluepex-vpn/bluepex-vpn-2025-12-08.log | grep RENDERER');