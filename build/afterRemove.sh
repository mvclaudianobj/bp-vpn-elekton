#!/bin/bash

# Script de desinstalação para BluePex VPN
echo "🧹 Removendo configurações do BluePex VPN..."

# Remover política do PolicyKit
POLICY_FILE="/usr/share/polkit-1/actions/com.bpvpn.pkexec.policy"

if [ -f "$POLICY_FILE" ]; then
    echo "📋 Removendo política do PolicyKit..."
    rm -f "$POLICY_FILE"
    echo "✅ Política removida"
fi

echo "✅ Desinstalação concluída!"
echo "💡 Os perfis VPN em '/opt/BluePex VPN/ovpn_profiles' foram mantidos."
echo "   Para removê-los completamente, execute:"
echo "   sudo rm -rf '/opt/BluePex VPN'"
