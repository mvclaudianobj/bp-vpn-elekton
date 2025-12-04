#!/usr/bin/env node

// Script de teste para desconexão VPN
// Simula um processo OpenVPN e testa a desconexão

const { exec, spawn } = require('child_process');
const path = require('path');

console.log('🧪 Teste de Desconexão VPN Específica\n');

// Simular um processo OpenVPN usando um arquivo .ovpn específico
console.log('1. 🔄 Iniciando processo simulado com arquivo .ovpn...');

const testOvpnFile = '/tmp/test-connection.ovpn';

// Criar arquivo .ovpn de teste
const fs = require('fs');
const ovpnContent = `# Test OVPN file
client
dev tun
proto udp
remote test.vpn.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
auth-user-pass
verb 3
`;

fs.writeFileSync(testOvpnFile, ovpnContent);
console.log(`📄 Arquivo .ovpn de teste criado: ${testOvpnFile}`);

// Simular processo openvpn (usando sleep com nome que contenha o arquivo)
const testProcess = spawn('sleep', ['300'], {
  detached: true,
  stdio: 'ignore'
});

testProcess.unref();

const testPid = testProcess.pid;
console.log(`✅ Processo simulado iniciado com PID: ${testPid}`);

// Renomear o processo para simular openvpn com arquivo específico
setTimeout(() => {
  try {
    // Tentar renomear o processo (isso pode não funcionar em todos os sistemas)
    exec(`kill -STOP ${testPid} && echo 'openvpn --config ${testOvpnFile}' > /proc/${testPid}/comm && kill -CONT ${testPid}`, () => {
      console.log('🔄 Processo renomeado para simular openvpn');
    });
  } catch (e) {
    console.log('⚠️ Não foi possível renomear processo (normal em alguns sistemas)');
  }
}, 500);

// Aguardar um pouco
setTimeout(() => {
  console.log('\n2. 🔍 Verificando processos...');

  exec(`ps aux | grep -E "(openvpn|sleep)" | grep -v grep`, (error, stdout) => {
    console.log('Processos encontrados:');
    console.log(stdout || 'Nenhum processo encontrado');

    console.log('\n3. 🗡️ Testando desconexão específica por arquivo .ovpn...');

    const ovpnFileName = path.basename(testOvpnFile);
    const killCommand = `pkexec pkill -9 -f "${ovpnFileName}"`;
    console.log(`Executando: ${killCommand}`);

    exec(killCommand, (killError) => {
      if (killError) {
        console.log(`❌ Desconexão específica falhou: ${killError.message}`);

        console.log('\n4. 🔄 Tentando desconexão geral...');
        const generalCommand = `pkexec pkill -9 -f openvpn`;
        console.log(`Executando: ${generalCommand}`);

        exec(generalCommand, (generalError) => {
          if (generalError) {
            console.log(`❌ Desconexão geral também falhou: ${generalError.message}`);

            console.log('\n5. 🔄 Tentando fallback sem elevação...');
            const fallbackCommand = `pkill -9 -f "${ovpnFileName}"`;
            console.log(`Executando: ${fallbackCommand}`);

            exec(fallbackCommand, (fallbackError) => {
              if (fallbackError) {
                console.log(`❌ Fallback também falhou: ${fallbackError.message}`);
              } else {
                console.log('✅ Fallback funcionou!');
              }
              finishTest();
            });
          } else {
            console.log('✅ Desconexão geral funcionou!');
            finishTest();
          }
        });
      } else {
        console.log('✅ Desconexão específica funcionou!');
        finishTest();
      }
    });
  });
}, 3000);

function finishTest() {
  // Limpar arquivo de teste
  try {
    if (fs.existsSync(testOvpnFile)) {
      fs.unlinkSync(testOvpnFile);
      console.log(`🧹 Arquivo de teste removido: ${testOvpnFile}`);
    }
  } catch (e) {
    console.log(`⚠️ Erro ao remover arquivo de teste: ${e.message}`);
  }

  console.log('\n✅ Teste concluído!');
  console.log('\n💡 Para testar com VPN real:');
  console.log('1. Conecte uma VPN na aplicação');
  console.log('2. Execute: ps aux | grep openvpn');
  console.log('3. Clique em "Desconectar VPN"');
  console.log('4. Verifique se apenas o processo específico foi morto');
}