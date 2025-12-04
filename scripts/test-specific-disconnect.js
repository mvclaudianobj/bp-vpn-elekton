#!/usr/bin/env node

// Script de teste para desconexão VPN específica por arquivo .ovpn

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Teste de Desconexão VPN Específica por Arquivo .ovpn\n');

// Criar arquivo .ovpn de teste
const testOvpnFile = '/tmp/test-vpn-connection.ovpn';
const ovpnContent = `# Test OVPN file for specific disconnection
client
dev tun
proto udp
remote test.vpn.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
auth-user-pass
verb 3
`;

try {
  fs.writeFileSync(testOvpnFile, ovpnContent);
  console.log(`📄 Arquivo .ovpn de teste criado: ${testOvpnFile}`);
} catch (error) {
  console.error(`❌ Erro ao criar arquivo de teste: ${error.message}`);
  process.exit(1);
}

console.log('\n1. 🧪 Testando comando de desconexão específica...');

const ovpnFileName = path.basename(testOvpnFile);
const killCommand = `pkexec pkill -9 -f "${ovpnFileName}"`;
console.log(`Comando: ${killCommand}`);

exec(killCommand, (error, stdout, stderr) => {
  console.log(`Resultado: ${error ? 'ERRO' : 'SUCESSO'}`);
  if (error) {
    console.log(`Erro: ${error.message}`);
    console.log(`Código: ${error.code}`);

    console.log('\n2. 🔄 Testando fallback sem elevação...');
    const fallbackCommand = `pkill -9 -f "${ovpnFileName}"`;
    console.log(`Comando: ${fallbackCommand}`);

    exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
      console.log(`Resultado fallback: ${fallbackError ? 'ERRO' : 'SUCESSO'}`);
      if (fallbackError) {
        console.log(`Erro fallback: ${fallbackError.message}`);
      } else {
        console.log('✅ Fallback funcionou!');
      }
      cleanup();
    });
  } else {
    console.log('✅ Comando específico funcionou!');
    cleanup();
  }
});

function cleanup() {
  // Limpar arquivo de teste
  try {
    if (fs.existsSync(testOvpnFile)) {
      fs.unlinkSync(testOvpnFile);
      console.log(`\n🧹 Arquivo de teste removido: ${testOvpnFile}`);
    }
  } catch (e) {
    console.log(`\n⚠️ Erro ao remover arquivo de teste: ${e.message}`);
  }

  console.log('\n✅ Teste concluído!');
  console.log('\n💡 Implementação:');
  console.log('- A desconexão agora usa o nome do arquivo .ovpn específico');
  console.log('- Comando: pkill -9 -f "nome-do-arquivo.ovpn"');
  console.log('- Fallback: mata todos os processos openvpn se específico falhar');
}