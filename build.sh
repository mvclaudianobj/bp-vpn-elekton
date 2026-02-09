#!/bin/bash

echo "🚀 BP VPN - Script de Build Automatizado"
echo "========================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se está rodando como root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ Não execute este script como root/sudo${NC}"
    echo -e "${RED}   Execute como usuário normal: ./build.sh${NC}"
    exit 1
fi

# Limpar diretório dist para evitar problemas de permissões
echo -e "${BLUE}🧹 Limpando dist...${NC}"
rm -rf dist 2>/dev/null || true
echo -e "${GREEN}✅ Dist limpo${NC}"
echo ""

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Instalando dependências...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erro ao instalar dependências${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Dependências instaladas${NC}"
    echo ""
fi

# Verificar se electron-builder está instalado
if ! npm list electron-builder > /dev/null 2>&1; then
    echo -e "${BLUE}📦 Instalando electron-builder...${NC}"
    npm install --save-dev electron-builder
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erro ao instalar electron-builder${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ electron-builder instalado${NC}"
    echo ""
fi

# Menu de opções
echo "Escolha a plataforma para build:"
echo "1) Linux (DEB + RPM + AppImage)"
echo "2) Windows (NSIS Installer)"
echo "3) Todas as plataformas"
echo "4) Apenas DEB"
echo "5) Apenas RPM"
echo "6) Apenas AppImage"
echo "7) DEB + AppImage"
echo "8) Sair"
echo ""
read -p "Opção [1-8]: " choice

case $choice in
    1)
        echo -e "${BLUE}🐧 Buildando para Linux...${NC}"
        npm run build:linux
        ;;
    2)
        echo -e "${BLUE}🪟 Buildando para Windows...${NC}"
        npm run build:win
        ;;
    3)
        echo -e "${BLUE}🌍 Buildando para todas as plataformas...${NC}"
        npm run build:all
        ;;
    4)
        echo -e "${BLUE}📦 Buildando DEB...${NC}"
        npx electron-builder --linux deb
        ;;
    5)
        echo -e "${BLUE}📦 Buildando RPM...${NC}"
        npx electron-builder --linux rpm
        ;;
    6)
        echo -e "${BLUE}📦 Buildando AppImage...${NC}"
        npx electron-builder --linux AppImage --publish=never
        if [ $? -eq 0 ]; then
            echo -e "${BLUE}🔧 Ajustando latest-linux.yml...${NC}"
            VERSION=$(node -p "require('./package.json').version")
            APPIMAGE_FILE="dist/bluepex-vpn-${VERSION}.AppImage"
            if [ -f "dist/BluePex VPN-${VERSION}.AppImage" ]; then
                mv "dist/BluePex VPN-${VERSION}.AppImage" "$APPIMAGE_FILE"
                SHA512=$(sha512sum "$APPIMAGE_FILE" | awk '{print $1}')
                SIZE=$(stat -c%s "$APPIMAGE_FILE")
                sed -i "s/version: .*/version: $VERSION/" dist/latest-linux.yml
                sed -i "s|url: .*|url: bluepex-vpn-${VERSION}.AppImage|" dist/latest-linux.yml
                sed -i "s|path: .*|path: bluepex-vpn-${VERSION}.AppImage|" dist/latest-linux.yml
                sed -i "s/sha512: .*/sha512: $SHA512/" dist/latest-linux.yml
                sed -i "s/size: .*/size: $SIZE/" dist/latest-linux.yml
                echo -e "${GREEN}✅ AppImage renomeado e latest-linux.yml ajustado${NC}"
            else
                echo -e "${RED}❌ Arquivo AppImage não encontrado${NC}"
            fi
        fi
        ;;
    7)
        echo -e "${BLUE}📦 Buildando DEB + AppImage...${NC}"
        npx electron-builder --linux deb AppImage --publish=never
        if [ $? -eq 0 ]; then
            echo -e "${BLUE}🔧 Ajustando arquivos e latest-linux.yml...${NC}"
            VERSION=$(node -p "require('./package.json').version")
            APPIMAGE_FILE="dist/bluepex-vpn-${VERSION}.AppImage"
            DEB_FILE="dist/bluepex-vpn_${VERSION}_amd64.deb"
            if [ -f "dist/BluePex VPN-${VERSION}.AppImage" ]; then
                mv "dist/BluePex VPN-${VERSION}.AppImage" "$APPIMAGE_FILE"
            fi
            # Calcular hashes
            if [ -f "$APPIMAGE_FILE" ]; then
                SHA512_APPIMAGE=$(sha512sum "$APPIMAGE_FILE" | awk '{print $1}')
                SHA256_APPIMAGE=$(sha256sum "$APPIMAGE_FILE" | awk '{print $1}')
                SIZE_APPIMAGE=$(stat -c%s "$APPIMAGE_FILE")
            fi
            if [ -f "$DEB_FILE" ]; then
                SHA512_DEB=$(sha512sum "$DEB_FILE" | awk '{print $1}')
                SHA256_DEB=$(sha256sum "$DEB_FILE" | awk '{print $1}')
                SIZE_DEB=$(stat -c%s "$DEB_FILE")
            fi
            # Ajustar yml
            if [ -f "$APPIMAGE_FILE" ]; then
                sed -i "s/version: .*/version: $VERSION/" dist/latest-linux.yml
                sed -i "s|BluePex-VPN-${VERSION}.AppImage|bluepex-vpn-${VERSION}.AppImage|g" dist/latest-linux.yml
                # Adicionar sha256 se não existir
                if ! grep -q "^sha256:" dist/latest-linux.yml; then
                    sed -i "/^sha512: .*/a\sha256: $SHA256_APPIMAGE" dist/latest-linux.yml
                else
                    sed -i "s/^sha256: .*/sha256: $SHA256_APPIMAGE/" dist/latest-linux.yml
                fi
                echo -e "${GREEN}✅ Arquivos ajustados com SHA256${NC}"
            fi
        fi
        ;;
    8)
        echo "👋 Saindo..."
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Opção inválida${NC}"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Build concluído com sucesso!${NC}"
    echo ""
    echo "📁 Os arquivos foram gerados em: ./dist/"
    echo ""
    ls -lh dist/
else
    echo -e "${RED}❌ Erro durante o build${NC}"
    exit 1
fi
