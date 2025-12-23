# 🔐 BluePex VPN

> Cliente VPN OpenVPN profissional com autenticação Azure AD, suporte a 2FA, sistema de logging avançado e atualizações automáticas

[![Version](https://img.shields.io/badge/version-0.0.6-blue.svg)](https://github.com/your-repo/bluepex-vpn)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-39.2.6-47848F.svg)](https://electronjs.org/)
[![Auto Update](https://img.shields.io/badge/Auto_Update-✅-green.svg)](https://electronjs.org/docs/tutorial/updates)
[![Logging](https://img.shields.io/badge/Logging-Advanced-orange.svg)](https://github.com/winstonjs/winston)
[![Azure AD](https://img.shields.io/badge/Azure_AD-✅-blue.svg)](https://azure.microsoft.com/)
[![2FA](https://img.shields.io/badge/2FA-Google_Authenticator-red.svg)](https://github.com/google/google-authenticator)

## 📋 Visão Geral

O **BluePex VPN** é uma aplicação desktop profissional para gerenciamento de conexões VPN OpenVPN, desenvolvida com Electron. Oferece autenticação integrada com Azure Active Directory, suporte a autenticação de dois fatores (2FA) e um sistema completo de logging para auditoria e monitoramento.

### ✨ Características Principais

- 🔄 **Atualizações Automáticas** com electron-updater
- 🔐 **Autenticação Azure AD** com device code flow e configuração visual
- 🔑 **Suporte a 2FA** (Google Authenticator, TOTP)
- 📁 **Gestão de Perfis** (usuário/senha e Azure AD)
- 📊 **Sistema de Logging Avançado** com debug detalhado e rotação
- 🎨 **Interface Moderna** responsiva com modal de atualizações
- 🛡️ **Segurança Aprimorada** com controle de permissões e rollback
- 📦 **Multiplataforma** (Linux, Windows, macOS) com builds otimizados

### 🚀 Novas Funcionalidades Implementadas

#### **🔄 Sistema de Atualização Automática**
- ✅ Verificação automática a cada 4 horas
- ✅ Modal interativo com barra de progresso
- ✅ Download controlado pelo usuário
- ✅ Instalação automática com reinício
- ✅ Suporte GitHub Releases
- ✅ Rollback em caso de falha

#### **⚙️ Configuração Automática Azure AD**
- ✅ Configurações extraídas automaticamente do arquivo .ovpn
- ✅ Tags especiais `#AZURE:` ignoradas pelo OpenVPN
- ✅ Salvamento automático no config.json
- ✅ Sem interface manual - tudo vem do arquivo

#### **📊 Logging de Debug Detalhado**
- ✅ Logs estruturados em JSON para todas as operações
- ✅ Categorias específicas: SYSTEM, PROFILE, CONNECTION, AUTH, AZURE, UPDATE
- ✅ Rastreamento completo de diretórios, permissões e erros
- ✅ Logs de elevação de privilégios (pkexec/sudo)
- ✅ Análise de performance e troubleshooting avançado

#### **🎨 Melhorias na Interface**
- ✅ Botão de atualização com design limpo (sem fundo)
- ✅ Modal de atualização com progresso visual

#### **🔌 Sistema de Desconexão Robusta**
- ✅ **Desconexão Específica**: Mata apenas processos da VPN conectada usando arquivo .ovpn
- ✅ **Estratégia Multi-Método**: Kill direto → PID específico → Arquivo específico → Fallback geral
- ✅ **Proteção contra Múltiplas Conexões**: Previne conexões simultâneas no mesmo perfil
- ✅ **Limpeza Inteligente**: Remove referências globais e arquivos temporários
- ✅ Feedback em tempo real para todas as operações
- ✅ Responsividade aprimorada

#### **🛡️ Segurança Aprimorada**
- ✅ Controle rigoroso de permissões de arquivo
- ✅ Verificação de integridade de downloads
- ✅ Isolamento de processos de atualização
- ✅ Logs de auditoria completos

## 🚀 Funcionalidades

### VPN e Conectividade
- ✅ Conexão OpenVPN (TCP/UDP)
- ✅ Suporte a múltiplos protocolos de autenticação
- ✅ Reconexão automática
- ✅ Monitoramento de status em tempo real
- ✅ Logs detalhados de conexão
- ✅ **Desconexão Específica**: Mata apenas processos da VPN conectada usando arquivo .ovpn

### Autenticação e Segurança
- ✅ **Azure AD Integration**
  - Device code authentication
  - Token refresh automático
  - Suporte a múltiplos tenants
- ✅ **2FA (Two-Factor Authentication)**
  - Google Authenticator
  - TOTP tokens
  - Timeout configurável
- ✅ **Credenciais Seguras**
  - Armazenamento local encriptado
  - Validação de entrada
  - Limpeza automática de dados temporários

### Gestão de Perfis
- ✅ Perfis de usuário/senha
- ✅ Perfis Azure AD
- ✅ Importação de arquivos .ovpn
- ✅ Processamento automático de certificados
- ✅ Backup e restauração

### Interface e UX
- ✅ Design moderno e responsivo
- ✅ Tema escuro profissional
- ✅ Notificações do sistema
- ✅ Suporte a múltiplos idiomas
- ✅ Acessibilidade (teclado e leitores de tela)

## 📊 Sistema de Logging Avançado

### 📁 Estrutura de Logs

```
# Produção (Linux)
/var/log/bluepex-vpn/
├── bluepex-vpn-2025-12-04.log    # Log atual
├── bluepex-vpn-2025-12-03.log.1  # Rotacionado
├── bluepex-vpn-2025-12-02.log.2  # Rotacionado
└── ...

# Desenvolvimento
~/.config/bluepex-vpn/logs/
└── bluepex-vpn-2025-12-04.log
```

### 📈 Categorias de Eventos

| Categoria | Descrição | Eventos Detalhados |
|-----------|-----------|-------------------|
| **SYSTEM** | Sistema e aplicação | Inicialização, diretórios, permissões, ambiente, erros críticos |
| **PROFILE** | Gestão de perfis | Criação/edição/exclusão, processamento OVPN, metadados completos |
| **CONNECTION** | Conexões VPN | Início/fim, elevação privilégios, spawn errors, estratégias |
| **AUTH** | Autenticação | Usuário/senha, 2FA, tokens Azure, validações |
| **AZURE** | Azure AD | Configuração cliente, device code, publicação tokens |
| **CONFIG** | Configurações | Mudanças Azure, validações, salvamento seguro |
| **UPDATE** | Atualizações | Verificações, downloads, instalações, rollback |
| **RENDERER** | Interface | Erros JavaScript, eventos DOM, inicialização |

### 🔍 Comandos de Visualização

```bash
# Logs recentes (50 entradas)
npm run logs

# Logs específicos do renderer (interface)
npm run logs:renderer

# Mais entradas
npm run logs -- --lines 200

# Filtrar por categoria
npm run logs -- --filter connection
npm run logs -- --filter renderer
npm run logs -- --filter azure

# Filtrar por erros
npm run logs -- --filter error

# Acompanhar em tempo real
npm run logs:tail

# Ajuda completa
npm run logs -- --help
```

### 📄 Formato dos Logs

```json
{
  "timestamp": "2025-12-04T15:45:25.727Z",
  "level": "INFO|WARN|ERROR",
  "category": "CONNECTION",
  "action": "SUCCESS",
  "data": {
    "profileId": "profile-123",
    "profileType": "user",
    "details": {
      "ip": "192.168.1.100",
      "duration": "00:15:30"
    }
  },
  "pid": 12345
}
```

### 🎨 Logging do Renderer (Interface)

O sistema captura automaticamente todos os logs do console JavaScript da interface:

#### **Eventos Rastreados:**
- **Erros globais** (`window.onerror`)
- **Promises rejeitadas** (`unhandledrejection`)
- **Console logs** (`console.log`, `console.error`, etc.)
- **Eventos DOM** (cliques, inicialização)
- **Estado da interface** (elementos encontrados/perdidos)

#### **Logs Específicos do Renderer:**
```bash
# Ver apenas logs da interface
npm run logs:renderer

# Exemplos de logs capturados:
RENDERER -> INIT_START: {}
RENDERER -> CONSOLE_LOG: {"args":["🚀 DOM Carregado"]}
RENDERER -> MENU_BUTTON_CLICKED: {"button":"<button...>"}
RENDERER -> GLOBAL_ERROR: {"message":"TypeError: ..."}
```

### 🔄 Rotação Automática

- **Tamanho máximo**: 10MB por arquivo
- **Arquivos históricos**: Máximo 5
- **Compressão**: Automática para arquivos antigos
- **Limpeza**: Arquivos com mais de 30 dias são removidos

## 🛠️ Instalação e Configuração

### Pré-requisitos

- **Node.js** 16.x ou superior
- **OpenVPN** 2.4+ instalado
- **PolicyKit** (Linux)
- **Git** para clonagem

### 🚀 Instalação Rápida

```bash
# Clonar repositório
git clone https://github.com/mvclaudianobj/BluePexVPN.git
cd BluePexVPN

# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev
```

### 📦 Build para Produção

```bash
# Linux (AppImage + DEB + RPM)
npm run build:linux

# Windows (NSIS installer)
npm run build:win

# Todas as plataformas
npm run build:all
```

### 🔧 Configuração Azure AD

1. **Criar App Registration no Azure Portal**
   - Acesse [Azure Portal](https://portal.azure.com)
   - App Registrations → New Registration
   - Configure redirect URIs e permissões

2. **Configurar na Aplicação**
   - Abra a aplicação → Menu ⚙️
   - Seção "Configuração Azure AD"
   - Preencha:
     - **Client ID**: Application (client) ID
     - **Tenant ID**: Directory (tenant) ID
     - **Scope**: `https://graph.microsoft.com/.default`
     - **URL da API**: Endpoint do servidor VPN

## 📖 Guia de Uso

### 🎯 Primeiros Passos

1. **Iniciar Aplicação**
   ```bash
   npm start
   ```

2. **Selecionar Modo**
   - 🔐 **Usuário/Senha**: Para VPNs tradicionais
   - 🌐 **Azure AD**: Para autenticação corporativa

3. **Configurar Perfil**
    - Menu ⚙️ → Selecionar arquivo .ovpn
    - Para Azure AD: adicionar configurações no arquivo .ovpn
    - Salvar perfil com nome descritivo

### 🔧 Configuração Azure AD no Arquivo .ovpn

Para perfis Azure AD, adicione as seguintes linhas no arquivo .ovpn (elas serão ignoradas pelo OpenVPN):

```ovpn
#AZURE:client_id=9048af0b-7b65-44c6-ae70-e8aac67229fb
#AZURE:tenant_id=10a9f605-3852-43d4-82fa-c39fe4693c69
#AZURE:scope=https://graph.microsoft.com/.default openid profile offline_access
#AZURE:server_api=http://wsutm.bluepex.com:30001/publish
```

**Parâmetros:**
- `client_id`: ID do aplicativo registrado no Azure AD
- `tenant_id`: ID do tenant/diretório no Azure AD
- `scope`: Escopos de permissão (padrão: Graph API)
- `server_api`: URL do servidor para publicar tokens JWT

### 🔑 Conexão VPN

#### Modo Usuário/Senha
1. Selecionar perfil ativo
2. Digitar usuário e senha
3. Marcar "Lembrar credenciais" (opcional)
4. Clicar "🔗 Conectar VPN"

#### Modo Azure AD
1. Selecionar perfil Azure
2. Clicar "🌐 Conectar com Azure AD"
3. Seguir link e inserir código
4. Aguardar autenticação

#### Com 2FA
- Token será solicitado automaticamente
- Digite o código do Google Authenticator
- Timeout de 2 minutos para resposta

### 🔌 Desconexão VPN

#### Desconexão Inteligente
- **Específica por Arquivo**: Mata apenas processos OpenVPN usando o arquivo .ovpn da conexão atual
- **Comando**: `pkill -9 -f "nome-do-arquivo.ovpn"`
- **Fallback**: Se específico falhar, mata todos os processos OpenVPN
- **Limpeza**: Remove referências globais e arquivos temporários

#### Como Desconectar
1. Clicar "🔴 Desconectar VPN" durante conexão ativa
2. Aguardar confirmação de desconexão
3. Status retorna a "Pronto para conectar"

### 📁 Gestão de Perfis

#### Criar Perfil
1. Menu ⚙️ → "Selecionar Arquivo .ovpn"
2. Escolher arquivo de configuração
3. Opcional: Marcar "Salvar como perfil"
4. Definir nome do perfil
5. 💾 Salvar

#### Gerenciar Perfis
- **Ativar**: Clicar em "Ativar" no perfil desejado
- **Editar**: Modificar configurações existentes
- **Excluir**: Remover perfil permanentemente
- **Importar**: Carregar perfis de backup

## 🔧 Scripts e Comandos

### Desenvolvimento
```bash
npm start              # Executar aplicação
npm run dev           # Modo desenvolvimento (com recarga)
npm run clean         # Limpar arquivos temporários
npm run reset         # Reset completo (clean + start)
```

### Build e Distribuição
```bash
npm run build         # Build básico
npm run build:linux   # Linux (AppImage, DEB, RPM)
npm run build:win     # Windows (NSIS installer)
npm run build:all     # Todas as plataformas
npm run release       # Build + publicar release no GitHub
npm run release:linux # Build Linux + publicar
npm run release:win   # Build Windows + publicar
```

### Logging e Debug Avançado
```bash
npm run logs          # Visualizar logs (50 últimas entradas)
npm run logs -- --lines 100    # Mais entradas
npm run logs -- --filter connection  # Filtrar conexões VPN
npm run logs -- --filter profile     # Filtrar operações de perfil
npm run logs -- --filter system      # Filtrar sistema/diretórios
npm run logs -- --filter azure       # Filtrar Azure AD
npm run logs -- --filter update      # Filtrar atualizações
npm run logs -- --filter error       # Apenas erros
npm run logs:tail      # Acompanhar em tempo real
```

### Testes e Utilitários
```bash
npm test              # Executar testes unitários
npm run test:e2e      # Testes end-to-end
npm run test:logging  # Testar sistema de logs
node scripts/test-update-permissions.js  # Testar permissões de sistema
```

## 📂 Estrutura do Projeto

```
BluePexVPN/
├── 📁 build/                    # Arquivos de build e instalação
│   ├── afterInstall.sh         # Script pós-instalação
│   ├── afterRemove.sh          # Script pós-desinstalação
│   ├── com.bpvpn.pkexec.policy # PolicyKit para elevação
│   └── icon.png                # Ícones da aplicação
├── 📁 scripts/                 # Scripts utilitários
│   ├── view-logs.js           # Visualizador avançado de logs
│   ├── test-logging.js        # Teste do sistema de logs
│   └── test-update-permissions.js # Teste de permissões de atualização
├── 📄 main.js                  # Processo principal Electron
├── 📄 renderer.js              # Interface frontend (UI)
├── 📄 preload.js               # API segura para comunicação
├── 📄 index.html               # Template HTML principal
├── 📄 package.json             # Dependências e configurações
├── 📄 capacitor.config.ts      # Configuração Capacitor (não usado)
├── 📄 config.json              # Configurações padrão (template)
├── 🔒 user_credentials.json    # Credenciais salvas (gerado)
├── 🔒 user_profiles.json       # Perfis usuário (gerado)
├── 🔒 azure_profiles.json      # Perfis Azure (gerado)
├── 🔒 app_state.json          # Estado da aplicação (gerado)
└── 📄 README.md                # Esta documentação
```

## 🔒 Segurança e Privacidade

### 🛡️ Medidas de Segurança

- **Isolamento de Processos**: Main e renderer separados
- **Sandboxing**: Restrições no acesso ao sistema
- **Encriptação**: Credenciais armazenadas com base64
- **Validação**: Entrada de dados sanitizada
- **Limpeza**: Arquivos temporários removidos automaticamente

### 🔐 Armazenamento de Dados

- **Credenciais**: `~/.config/bluepex-vpn/user_credentials.json`
- **Perfis**: `~/.config/bluepex-vpn/user_profiles.json`
- **Estado**: `~/.config/bluepex-vpn/app_state.json`
- **Logs**: `/var/log/bluepex-vpn/` (produção)

### 🚨 Avisos de Segurança

- ❌ **Não compartilhe** arquivos de configuração
- ❌ **Não execute** como root desnecessariamente
- ✅ **Mantenha** a aplicação atualizada
- ✅ **Monitore** logs regularmente
- ✅ **Use senhas fortes** e 2FA

## 🐛 Troubleshooting

### Problemas Comuns

#### ❌ "OpenVPN não encontrado"
```bash
# Instalar OpenVPN
sudo apt install openvpn     # Ubuntu/Debian
sudo dnf install openvpn     # Fedora
```

#### ❌ "Permissões insuficientes"
```bash
# Verificar PolicyKit
sudo apt install policykit-1
```

#### ❌ "Perfil não aparece"
```bash
# Verificar logs
npm run logs -- --filter profile

# Resetar perfis
npm run clean && npm start
```

#### ❌ "Erro de conexão Azure"
```bash
# Verificar configuração
npm run logs -- --filter azure
```

#### ❌ "Desconexão não funciona"
```bash
# Verificar processos ativos
ps aux | grep openvpn

# Forçar desconexão manual
pkexec pkill -9 -f openvpn

# Verificar logs de desconexão
npm run logs -- --filter connection | grep disconnect
```

#### ❌ "Múltiplas conexões simultâneas"
```bash
# Verificar processos duplicados
ps aux | grep openvpn | wc -l

# Solução: reiniciar aplicação
npm run reset

# Prevenção: aguardar conclusão da conexão atual
```

### 📊 Diagnóstico Avançado

```bash
# Logs detalhados de conexão
npm run logs -- --filter connection --lines 20

# Todos os erros
npm run logs -- --filter error --lines 50

# Logs do sistema
npm run logs -- --filter system
```

### 🔄 Recuperação

```bash
# Reset completo
npm run clean
rm -rf ~/.config/bluepex-vpn/
npm start

# Limpar logs antigos
sudo rm -rf /var/log/bluepex-vpn/
```

## 🤝 Contribuição

### 📋 Processo de Contribuição

1. **Fork** o projeto
2. **Clone** sua fork: `git clone https://github.com/your-username/BluePexVPN.git`
3. **Crie** uma branch: `git checkout -b feature/nova-funcionalidade`
4. **Commit** suas mudanças: `git commit -m 'Adiciona nova funcionalidade'`
5. **Push** para origin: `git push origin feature/nova-funcionalidade`
6. **Abra** um Pull Request

### 🧪 Testes

```bash
# Testes unitários
npm test

# Testes de integração
npm run test:integration

# Coverage de testes
npm run test:coverage
```

### 📝 Padrões de Código

- **ESLint**: `npm run lint`
- **Prettier**: `npm run format`
- **TypeScript**: Verificação de tipos
- **Commits**: Conventional commits

### 🔧 Desenvolvimento Avançado

#### **Sistema de Logging**
- Logs estruturados em JSON para análise automatizada
- Categorização granular: SYSTEM, PROFILE, CONNECTION, AUTH, AZURE, UPDATE
- Rotaçã automática (10MB, 5 arquivos históricos)
- Filtros avançados por categoria, ação e conteúdo

#### **Atualizações Automáticas**
- Baseado em electron-updater com GitHub Releases
- Controle total do usuário sobre downloads/instalações
- Verificações de integridade e rollback automático
- Suporte multiplataforma (Linux/Windows/macOS)

#### **Configuração Azure AD Visual**
- Interface dedicada para configuração de app Azure
- Validação em tempo real dos campos obrigatórios
- Salvamento seguro no config.json local
- Feedback visual completo

#### **Debugging Avançado**
- Logs detalhados para todas as operações críticas
- Rastreamento de permissões e elevação de privilégios
- Análise de performance de conexões VPN
- Diagnóstico de problemas de autenticação

## 📄 Licença

```
MIT License

Copyright (c) 2025 BluePex Cybersecurity

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

## 🆘 Suporte e Contato

### 📞 Canais de Suporte

- 📧 **Email**: contato@bluepex.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/mvclaudianobj/BluePexVPN/issues)
- 📖 **Wiki**: [Documentação Completa](https://github.com/mvclaudianobj/BluePexVPN/wiki)
- 💬 **Discord**: [Comunidade BluePex VPN](https://discord.gg/bluepex-vpn)

### 🔍 Antes de Reportar

1. **Verifique os logs**:
   ```bash
   npm run logs -- --filter error --lines 10
   ```

2. **Teste em modo desenvolvimento**:
   ```bash
   npm run dev
   ```

3. **Limpe dados temporários**:
   ```bash
   npm run clean && npm start
   ```

### 📋 Informações para Suporte

Ao reportar problemas, inclua:

- **Versão da aplicação**
- **Sistema operacional e versão**
- **Logs relevantes** (últimas 20 linhas)
- **Passos para reproduzir**
- **Comportamento esperado vs atual**

### 📊 Monitoramento e Métricas

#### **Logs de Performance**
```bash
# Analisar tempo de inicialização
npm run logs -- --filter "APP_START|APP_READY" --lines 5

# Verificar conexões VPN
npm run logs -- --filter connection --lines 20

# Monitorar atualizações
npm run logs -- --filter update --lines 10
```

#### **Diagnóstico de Sistema**
```bash
# Verificar permissões de diretório
npm run logs -- --filter directory --lines 10

# Analisar configurações Azure
npm run logs -- --filter azure --lines 10

# Ver erros críticos
npm run logs -- --filter error --lines 20
```

#### **Métricas Disponíveis**
- **Taxa de Conexão**: Sucesso vs falha de conexões VPN
- **Performance**: Tempo de inicialização e resposta
- **Atualizações**: Downloads e instalações bem-sucedidas
- **Erros**: Tipos e frequência de problemas

---

<div align="center">

**BluePex VPN** - Conectividade segura, simplicidade profissional.

🛡️ **BluePex® Cybersecurity** © 2025

*Desenvolvido com ❤️ para profissionais de TI*

</div>