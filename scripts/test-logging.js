#!/usr/bin/env node

// Script de teste para o sistema de logging
// Simula algumas operações para gerar logs de teste

const fs = require('fs');
const path = require('path');
const os = require('os');

// Simular a classe AppLogger (versão simplificada)
class TestLogger {
  constructor() {
    this.logDir = this.getLogDirectory();
    this.currentLogFile = this.getCurrentLogFile();
  }

  getLogDirectory() {
    if (process.platform === 'linux' && process.env.NODE_ENV !== 'development') {
      return '/var/log/bluepex-vpn';
    } else {
      return path.join(os.homedir(), '.config', 'bluepex-vpn', 'logs');
    }
  }

  getCurrentLogFile() {
    const today = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `bluepex-vpn-${today}.log`);
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

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    fs.appendFileSync(this.currentLogFile, logLine);
    console.log(`✅ Log criado: ${category} -> ${action}`);
  }
}

const logger = new TestLogger();

console.log('🧪 Iniciando testes de logging...\n');

// Simular diferentes tipos de eventos
logger.log('SYSTEM', 'TEST_START', { testType: 'logging_system' });

// Perfis
logger.log('PROFILE', 'CREATE', { profileId: 'test-profile-001', profileType: 'user', profileName: 'Perfil de Teste' });
logger.log('PROFILE', 'UPDATE', { profileId: 'test-profile-001', profileType: 'user', changes: { name: 'Novo Nome' } });
logger.log('PROFILE', 'DELETE', { profileId: 'test-profile-001', profileType: 'user', profileName: 'Perfil de Teste' });

// Conexões
logger.log('CONNECTION', 'START', { profileId: 'test-profile-001', profileType: 'user', connectionType: 'openvpn-userpass' });
logger.log('CONNECTION', 'SUCCESS', { profileId: 'test-profile-001', profileType: 'user', details: { ip: '192.168.1.100' } });
logger.log('CONNECTION', 'DISCONNECT', { profileId: 'test-profile-001', profileType: 'user', reason: 'user_request' });

// Autenticação
logger.log('AUTH', 'SUCCESS', { profileId: 'test-profile-001', authType: 'userpass', username: 'testuser' });
logger.log('AUTH', 'FAILURE', { profileId: 'test-profile-001', authType: 'userpass', error: 'Invalid credentials' });

// Azure
logger.log('AZURE', 'LOGIN_START', { scopes: ['https://graph.microsoft.com/.default'] });
logger.log('AZURE', 'TOKEN_PUBLISH', { username: 'test@domain.com', success: true });

// Configurações
logger.log('CONFIG', 'CHANGE', { configType: 'azure_app', changes: { client_id: '***', tenant_id: '***' } });

// Sistema
logger.log('SYSTEM', 'ERROR', { component: 'VPN_PROCESS', error: 'Connection timeout' }, 'ERROR');
logger.log('SYSTEM', 'WARNING', { component: 'FILE_SYSTEM', message: 'Permission issue' }, 'WARN');

logger.log('SYSTEM', 'TEST_END', { testType: 'logging_system', eventsGenerated: 12 });

console.log('\n✅ Testes concluídos! Verifique os logs com: npm run logs');
console.log(`📁 Arquivo de log: ${logger.currentLogFile}`);