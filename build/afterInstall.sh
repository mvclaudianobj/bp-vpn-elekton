#!/bin/bash

# Script de pós-instalação para BluePex VPN
echo "🔧 Configurando BluePex VPN..."

# Instalar política do PolicyKit
POLICY_FILE="/usr/share/polkit-1/actions/com.bpvpn.pkexec.policy"
POLICY_SOURCE_1="/opt/BluePex VPN/resources/app/build/com.bpvpn.pkexec.policy"
POLICY_SOURCE_2="/opt/BluePex VPN/resources/build/com.bpvpn.pkexec.policy"

if [ -f "$POLICY_SOURCE_1" ]; then
    echo "📋 Instalando política do PolicyKit..."
    cp "$POLICY_SOURCE_1" "$POLICY_FILE"
    chmod 644 "$POLICY_FILE"
    echo "✅ Política instalada em $POLICY_FILE"
elif [ -f "$POLICY_SOURCE_2" ]; then
    echo "📋 Instalando política do PolicyKit..."
    cp "$POLICY_SOURCE_2" "$POLICY_FILE"
    chmod 644 "$POLICY_FILE"
    echo "✅ Política instalada em $POLICY_FILE"
else
    echo "⚠️ Arquivo de política não encontrado"
fi

# Verificar se OpenVPN está instalado
if ! command -v openvpn &> /dev/null; then
    echo "⚠️ ATENÇÃO: OpenVPN não está instalado!"
    echo "   Por favor, instale o OpenVPN:"
    echo "   Ubuntu/Debian: sudo apt install openvpn"
    echo "   Fedora/RHEL: sudo dnf install openvpn"
    echo "   Arch: sudo pacman -S openvpn"
fi

# Criar diretório de perfis se não existir
PROFILES_DIR="/opt/BluePex VPN/ovpn_profiles"
if [ ! -d "$PROFILES_DIR" ]; then
    mkdir -p "$PROFILES_DIR"
    chmod 755 "$PROFILES_DIR"
    echo "📁 Diretório de perfis criado: $PROFILES_DIR"
fi

echo "✅ Instalação concluída com sucesso!"
echo ""
echo "🚀 Para iniciar o BluePex VPN, execute:"
echo "   - Pelo menu de aplicativos"
echo "   - Ou procure por 'BluePex VPN'"
