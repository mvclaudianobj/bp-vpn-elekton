#!/usr/bin/env node

// Testes unitários da lógica conservadora de ownership BluePex/OpenVPN.
// Não executa OpenVPN, não usa certificados reais e não mata processos.

const assert = require('assert');
const path = require('path');

function normalizePathForCompare(value, platform = process.platform) {
  if (!value || typeof value !== 'string') return '';
  let normalized = value.replace(/^file:\/\//i, '').trim();
  if (platform === 'win32') {
    normalized = normalized.replace(/\\/g, '/').toLowerCase();
  } else {
    try {
      normalized = path.resolve(normalized);
    } catch (_) {}
  }
  return normalized;
}

function getConfigPathFromArgs(args = []) {
  for (let i = 0; i < args.length; i++) {
    const arg = String(args[i] || '');
    if (arg === '--config' && args[i + 1]) return String(args[i + 1]);
    if (arg.startsWith('--config=')) return arg.slice('--config='.length);
  }
  return null;
}

function commandLineMatchesBluepexConfig(argsOrText, expectedConfigPath, platform = process.platform) {
  const expected = normalizePathForCompare(expectedConfigPath, platform);
  if (!expected) return false;

  if (Array.isArray(argsOrText)) {
    const configArg = getConfigPathFromArgs(argsOrText);
    return normalizePathForCompare(configArg, platform) === expected;
  }

  const text = String(argsOrText || '');
  if (!/--config(?:\s|=)/i.test(text)) return false;
  const comparable = platform === 'win32'
    ? text.replace(/\\/g, '/').toLowerCase()
    : text;
  return comparable.includes(expected);
}

function runTests() {
  const expected = '/home/marcos/.config/bluepex-vpn/ovpn_profiles/profile_1/profile_1.ovpn';
  const external = '/etc/openvpn/client/external.ovpn';

  assert.strictEqual(
    commandLineMatchesBluepexConfig(['openvpn', '--config', expected, '--auth-user-pass', '/tmp/auth.txt'], expected),
    true,
    'deve reconhecer openvpn BluePex com --config separado'
  );

  assert.strictEqual(
    commandLineMatchesBluepexConfig(['openvpn', `--config=${expected}`], expected),
    true,
    'deve reconhecer openvpn BluePex com --config='
  );

  assert.strictEqual(
    commandLineMatchesBluepexConfig(['openvpn', '--config', external], expected),
    false,
    'não deve reconhecer OpenVPN externo como BluePex'
  );

  assert.strictEqual(
    commandLineMatchesBluepexConfig(['pkexec', 'openvpn', '--config', expected], expected),
    true,
    'deve permitir localizar relação wrapper/openvpn pela linha de comando'
  );

  assert.strictEqual(
    commandLineMatchesBluepexConfig('openvpn.exe --config C:\\Users\\Marcos\\AppData\\Roaming\\bluepex-vpn\\profile.ovpn', 'C:\\Users\\Marcos\\AppData\\Roaming\\bluepex-vpn\\profile.ovpn', 'win32'),
    true,
    'deve reconhecer caminho Windows case-insensitive'
  );

  assert.strictEqual(
    commandLineMatchesBluepexConfig('openvpn --auth-user-pass /tmp/auth.txt', expected),
    false,
    'fallback sem --config deve ser conservador'
  );

  console.log('✅ Testes de ownership BluePex/OpenVPN passaram');
}

if (require.main === module) {
  runTests();
}
