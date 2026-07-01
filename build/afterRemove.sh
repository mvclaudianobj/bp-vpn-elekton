#!/bin/bash
# After remove script for BluePex VPN
# Este script roda como root pelo dpkg/rpm após remoção

set -e

echo "=== BluePex VPN: pós-remoção ==="

POLICY_DEST="/usr/share/polkit-1/actions/com.bpvpn.pkexec.policy"

# Remove policy file
if [ -f "$POLICY_DEST" ]; then
    rm -f "$POLICY_DEST"
    echo "Policy removida: $POLICY_DEST"
else
    echo "Policy não encontrada (já removida ou nunca instalada): $POLICY_DEST"
fi

rm -f /usr/share/polkit-1/rules.d/com.bluepex.vpn.rules 2>/dev/null && echo "Rules removido de rules.d" || true
rm -f /etc/polkit-1/rules.d/com.bluepex.vpn.rules 2>/dev/null && echo "Rules removido de etc/polkit-1" || true

# Recarrega polkit
if command -v systemctl >/dev/null 2>&1; then
    systemctl reload polkit 2>/dev/null && echo "polkit recarregado via systemctl" || echo "AVISO: falha ao recarregar polkit via systemctl"
elif command -v pkill >/dev/null 2>&1; then
    pkill -HUP polkitd 2>/dev/null && echo "polkitd recarregado via pkill" || echo "AVISO: falha ao recarregar polkitd"
fi

echo "=== Pós-remoção concluída ==="
