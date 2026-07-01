#!/bin/bash
# After install script for BluePex VPN
# Este script roda como root pelo dpkg/rpm após instalação

set -e

echo "=== BluePex VPN: pós-instalação ==="

POLICY_SRC="/opt/BluePex VPN/resources/com.bpvpn.pkexec.policy"
POLICY_DEST="/usr/share/polkit-1/actions/com.bpvpn.pkexec.policy"

# Detecta caminho real do openvpn
OPENVPN_PATH=""
for candidate in /usr/sbin/openvpn /usr/bin/openvpn /sbin/openvpn /bin/openvpn; do
    if [ -x "$candidate" ]; then
        OPENVPN_PATH="$candidate"
        break
    fi
done

if [ -z "$OPENVPN_PATH" ]; then
    echo "AVISO: openvpn não encontrado — instalando policy com caminho padrão /usr/sbin/openvpn"
    OPENVPN_PATH="/usr/sbin/openvpn"
fi

echo "Caminho do openvpn detectado: $OPENVPN_PATH"

# Verifica se o arquivo de policy fonte existe
if [ ! -f "$POLICY_SRC" ]; then
    echo "ERRO: arquivo de policy não encontrado em: $POLICY_SRC"
    exit 1
fi

# Cria o destino se não existir
mkdir -p /usr/share/polkit-1/actions/

# Copia e ajusta o caminho do openvpn na policy
sed "s|/usr/sbin/openvpn|${OPENVPN_PATH}|g" "$POLICY_SRC" > "$POLICY_DEST"
chmod 644 "$POLICY_DEST"

echo "Policy instalada em: $POLICY_DEST"
echo "exec.path configurado para: $OPENVPN_PATH"

# Instala também o arquivo .rules para polkit moderno (≥0.105)
RULES_SRC="/opt/BluePex VPN/resources/com.bluepex.vpn.rules"
RULES_DEST_1="/usr/share/polkit-1/rules.d/com.bluepex.vpn.rules"
RULES_DEST_2="/etc/polkit-1/rules.d/com.bluepex.vpn.rules"

if [ -f "$RULES_SRC" ]; then
    # Tenta instalar em ambos os locais (distros diferentes usam um ou outro)
    if [ -d "/usr/share/polkit-1/rules.d" ]; then
        cp "$RULES_SRC" "$RULES_DEST_1"
        chmod 644 "$RULES_DEST_1"
        echo "Rules instalado em: $RULES_DEST_1"
    fi
    if [ -d "/etc/polkit-1/rules.d" ]; then
        cp "$RULES_SRC" "$RULES_DEST_2"
        chmod 644 "$RULES_DEST_2"
        echo "Rules instalado em: $RULES_DEST_2"
    fi
else
    echo "AVISO: arquivo .rules não encontrado em: $RULES_SRC"
fi

# Recarrega polkit
if command -v systemctl >/dev/null 2>&1; then
    systemctl reload polkit 2>/dev/null && echo "polkit recarregado via systemctl" || echo "AVISO: falha ao recarregar polkit via systemctl"
elif command -v pkill >/dev/null 2>&1; then
    pkill -HUP polkitd 2>/dev/null && echo "polkitd recarregado via pkill" || echo "AVISO: falha ao recarregar polkitd"
fi

echo "=== Pós-instalação concluída ==="
