#!/bin/bash

echo "🚀 BP VPN - Script de Build Automatizado"
echo "========================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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
echo "5) Apenas AppImage"
echo "6) Sair"
echo ""
read -p "Opção [1-6]: " choice

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
        echo -e "${BLUE}📦 Buildando AppImage...${NC}"
        npx electron-builder --linux AppImage
        ;;
    6)
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
