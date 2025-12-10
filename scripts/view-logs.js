#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Determinar diretório de logs
function getLogDirectory() {
  if (process.platform === 'linux' && process.env.NODE_ENV !== 'development') {
    return '/var/log/bluepex-vpn';
  } else {
    return path.join(os.homedir(), '.config', 'bluepex-vpn', 'logs');
  }
}

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(level) {
  switch (level) {
    case 'ERROR': return colors.red;
    case 'WARN': return colors.yellow;
    case 'INFO': return colors.green;
    default: return colors.white;
  }
}

function formatLogEntry(entry) {
  try {
    const data = JSON.parse(entry);
    const timestamp = new Date(data.timestamp).toLocaleString();
    const level = data.level.padEnd(5);
    const category = data.category.padEnd(10);
    const action = data.action.padEnd(15);

    let details = '';
    if (data.data && Object.keys(data.data).length > 0) {
      details = JSON.stringify(data.data, null, 2);
    }

    return `${colorize(data.level)}[${timestamp}] ${level} [${category}] ${action}${colors.reset} ${details}`;
  } catch (error) {
    return entry; // Se não conseguir parsear, mostrar como está
  }
}

function viewLogs(logDir, options = {}) {
  const { lines = 50, follow = false, filter = null } = options;

  if (!fs.existsSync(logDir)) {
    console.error(`Diretório de logs não encontrado: ${logDir}`);
    return;
  }

  // Encontrar arquivos de log
  const logFiles = fs.readdirSync(logDir)
    .filter(file => file.endsWith('.log'))
    .sort()
    .reverse(); // Mais recente primeiro

  if (logFiles.length === 0) {
    console.log('Nenhum arquivo de log encontrado.');
    return;
  }

  console.log(`📁 Diretório de logs: ${logDir}`);
  console.log(`📄 Arquivos encontrados: ${logFiles.join(', ')}\n`);

  // Ler e exibir logs
  let allEntries = [];

  for (const logFile of logFiles) {
    const logPath = path.join(logDir, logFile);
    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      const entries = content.trim().split('\n').filter(line => line.trim());
      allEntries.push(...entries.map(entry => ({ file: logFile, entry })));
    } catch (error) {
      console.error(`Erro ao ler ${logFile}:`, error.message);
    }
  }

  // Filtrar se necessário
  if (filter) {
    allEntries = allEntries.filter(item => {
      try {
        const data = JSON.parse(item.entry);
        return data.category.toLowerCase().includes(filter.toLowerCase()) ||
               data.action.toLowerCase().includes(filter.toLowerCase()) ||
               JSON.stringify(data.data).toLowerCase().includes(filter.toLowerCase());
      } catch {
        return item.entry.toLowerCase().includes(filter.toLowerCase());
      }
    });
  }

  // Ordenar por timestamp (mais recente primeiro)
  allEntries.sort((a, b) => {
    try {
      const timeA = JSON.parse(a.entry).timestamp;
      const timeB = JSON.parse(b.entry).timestamp;
      return new Date(timeB) - new Date(timeA);
    } catch {
      return 0;
    }
  });

  // Limitar número de linhas
  const entriesToShow = allEntries.slice(0, lines);

  console.log(`📊 Mostrando ${entriesToShow.length} entradas mais recentes:\n`);

  for (const item of entriesToShow) {
    console.log(`📄 ${item.file}:`);
    console.log(formatLogEntry(item.entry));
    console.log('');
  }

  if (allEntries.length > lines) {
    console.log(`... e mais ${allEntries.length - lines} entradas. Use --lines para ver mais.`);
  }
}

// Função principal
function main() {
  const args = process.argv.slice(2);
  const logDir = getLogDirectory();

  let options = {
    lines: 50,
    follow: false,
    filter: null
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--lines':
      case '-n':
        options.lines = parseInt(args[++i]) || 50;
        break;
      case '--filter':
      case '-f':
        options.filter = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Visualizador de Logs - BluePex VPN

Uso: npm run logs [opções]

Opções:
  -n, --lines <num>    Número de linhas a mostrar (padrão: 50)
  -f, --filter <text>  Filtrar logs por texto
  -h, --help          Mostrar esta ajuda

Exemplos:
  npm run logs
  npm run logs --lines 100
  npm run logs --filter connection
  npm run logs --filter error --lines 20

Diretório de logs: ${logDir}
        `);
        process.exit(0);
    }
  }

  viewLogs(logDir, options);
}

if (require.main === module) {
  main();
}

module.exports = { viewLogs, getLogDirectory };