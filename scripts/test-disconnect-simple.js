#!/usr/bin/env node

// Script simples para testar apenas a lógica de desconexão
const { exec } = require('child_process');

console.log('🧪 Teste Simples de Desconexão VPN');
console.log('=====================================');

// Simular a lógica da função disconnect-openvpn
function testDisconnect() {
  console.log('🔌 Iniciando desconexão...');

  // Mesmo comando usado na aplicação
  const killCommand = `pkexec pkill -9 -f openvpn`;

  console.log(`🗡️ Executando: ${killCommand}`);

  exec(killCommand, (error, stdout, stderr) => {
    console.log('Resultado:');
    console.log(`  Error: ${!!error}`);
    console.log(`  stdout: "${stdout || 'nenhum'}"`);
    console.log(`  stderr: "${stderr || 'nenhum'}"`);

    if (error) {
      console.log(`❌ Comando falhou: ${error.message}`);
      console.log(`❌ Código: ${error.code}`);

      // Testar fallback
      console.log('\n🔄 Testando fallback...');
      exec(`pkill -9 -f openvpn`, (pkillError) => {
        if (pkillError) {
          console.log(`❌ Fallback também falhou: ${pkillError.message}`);
        } else {
          console.log('✅ Fallback funcionou!');
        }
        console.log('\n🏁 Teste concluído');
      });
    } else {
      console.log('✅ Comando executado com sucesso!');
      console.log('\n🏁 Teste concluído');
    }
  });
}

// Verificar processos OpenVPN antes
console.log('📊 Verificando processos OpenVPN antes...');
exec(`pgrep -f openvpn`, (error, stdout) => {
  if (stdout.trim()) {
    console.log(`Encontrados: ${stdout.trim().split('\n').length} processos`);
    console.log(`PIDs: ${stdout.trim().split('\n').join(', ')}`);
  } else {
    console.log('Nenhum processo OpenVPN encontrado');
  }

  console.log('\n🚀 Executando desconexão...\n');
  testDisconnect();
});