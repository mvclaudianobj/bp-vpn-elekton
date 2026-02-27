# Registro de Alterações

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

## [1.0.5] - 2026-02-27

### 🔧 Correções de Bugs

- **Correção de Salvamento de Credenciais**: Corrigido bug onde senhas não eram salvas ao marcar "Lembrar credenciais". Agora o perfil é automaticamente selecionado após criação e o ID do perfil é corretamente utilizado para salvar/carregar credenciais.

- **Correção de Ícones no App Packaged**: Corrigido problema onde ícones do menu não carregavam no aplicativo compilado. Implementado protocolo customizado `local-resource://` para servir ícones corretamente tanto em desenvolvimento quanto em produção.

- **Correção de HTML Duplicado**: Removidas seções HTML duplicadas no index.html que causavam comportamento estranho na interface.

- **Correção de Event Listeners Duplicados**: Removida chamada duplicada de `setupEventListeners()` no renderer.js que podia causar múltiplas execuções de eventos.

### 🐛 Melhorias Técnicas

- Adicionado tratamento de erro mais robusto para salvar credenciais
- Adicionado logging para debug de problemas com credenciais
- Configurado asarUnpack para permitir acesso a recursos estáticos (ícones)

---

## [0.1.4] - 2026-01-15

### 🔒 Melhorias de Segurança
- **Criptografia Aprimorada de Credenciais**: Atualização de codificação Base64 para criptografia AES-256-GCM para senhas armazenadas
- **Migração Automática**: Migração perfeita de credenciais existentes para criptografia segura
- **Funções Criptográficas**: Implementadas utilitários adequados de criptografia/descriptografia usando módulo crypto do Node.js

### 🔧 Técnico
- **Arquitetura de Segurança**: Adicionado armazenamento seguro de credenciais com criptografia padrão da indústria
- **Compatibilidade Reversa**: Detecção automática e migração de credenciais Base64 legadas

---

## [0.1.3] - 2026-01-15

### 🎯 Novidades
- **Janela sem Frame**: Removida barra de menu do sistema e implementada barra de título customizada com marca BluePex VPN
- **Controle Unificado de Minimização**: Única opção "Minimizar" no menu que mantém ícones visíveis na barra de tarefas e no tray
- **Interface Limpa**: Removida opção duplicada de minimizar para tray para melhor UX

### 🐛 Correções
- **Conexão Windows**: Corrigida execução do OpenVPN removendo complexidade de elevação do PowerShell
- **Localização do Arquivo de Auth**: Alterado arquivo de autenticação do diretório temporário para diretório do perfil para melhor compatibilidade com Windows
- **UI do Modal de Atualização**: Removido texto de progresso indefinido que aparecia durante verificações de atualização
- **Comportamento de Minimização**: Garantida minimização correta para barra de tarefas em vez de ocultar imediatamente

### 📱 Melhorias de Plataforma
- **Windows**: Execução direta do OpenVPN sem verbo RunAs do PowerShell para melhor compatibilidade
- **Multiplataforma**: Melhorado tratamento de caminhos e permissões de arquivos para Windows
- **Debugging**: Logs aprimorados para melhor resolução de problemas no Windows

### 🔧 Técnico
- **Configurações Electron**: Otimizada configuração do BrowserWindow para design sem frame
- **Comunicações IPC**: Simplificadas operações de minimização entre processos main e renderer
- **Sistema de Arquivos**: Melhor tratamento de caminhos de arquivos e permissões no Windows
- **Configuração de Build**: Corrigido artifactName no NSIS para corresponder ao formato do nome do binário

---

## [0.1.2] - 2026-01-15

## [0.1.2] - 2026-01-15

### Adicionado
- **Suporte a Domínios Windows**: Compatibilidade aprimorada com máquinas Windows ingressadas em domínio
- **Elevação Automática**: OpenVPN executa com privilégios de admin quando necessário no Windows
- **Controle de Nível de Execução**: Configurado explicitamente para não requerer privilégios de admin

### Corrigido
- **Problemas de Privilégios Admin**: App não solicita mais senha em máquinas de domínio
- **Execução OpenVPN**: Restaurada elevação adequada para conexões VPN no Windows
- **Gerenciamento de Processos**: Melhor tratamento de processos em background e visibilidade de janelas

### Alterado
- **Configuração do Instalador**: Adicionada configuração requestedExecutionLevel
- **Estratégia de Conexão**: Execução OpenVPN aprimorada no Windows com elevação PowerShell
- **Visibilidade de Processos**: Janelas PowerShell ocultas para experiência mais limpa

### Melhorias Técnicas
- **Segurança**: Separação adequada de privilégios entre app e processos VPN
- **Compatibilidade**: Melhor suporte para ambientes corporativos/domínio
- **Controle de Processos**: Passagem de argumentos e controle de execução aprimorados

## [0.1.1] - 2026-01-14

### Adicionado
- **Melhoria no Instalador Windows**: OpenVPN MSI incluído diretamente no instalador para instalação automática
- **Modal de Atualização Aprimorado**: Indicadores de fase mostrando status de download/instalação com feedback visual
- **Recursos do Modo Debug**: Simulação de progresso de atualização para testes em `index_debug.html`
- **Logs de Conexão**: Carregamento adequado via IPC com suporte multiplataforma
- **Logs da Aplicação**: Método `getRecentLogs` implementado para logging da aplicação
- **Mensagens User-Friendly**: Melhoria nas mensagens de estado vazio para logs com dicas úteis

### Corrigido
- **Instalação OpenVPN**: Problemas de bundling MSI no instalador NSIS Windows
- **Erros de Carregamento de Logs**: Resolução do erro "logger.getRecentLogs is not a function"
- **Exibição de Logs de Conexão**: Comunicação IPC corrigida para recuperação segura de logs
- **Progresso de Atualização**: Barra de progresso e transições de fase corrigidas
- **Mensagens de Erro**: Erros técnicos substituídos por orientações amigáveis ao usuário
- **Variáveis NSIS**: Variável de diretório temporário corrigida no script do instalador

### Alterado
- **Versão**: Atualizada para 0.1.1
- **Mensagens de Log**: Mais informativas e úteis quando não há logs disponíveis
- **Fluxo de Atualização**: Melhor feedback visual durante download e instalação

### Melhorias Técnicas
- **Segurança**: Acesso a arquivos de log movido do renderer para processo principal via IPC
- **Multiplataforma**: Tratamento aprimorado de diretórios de log para Windows e Linux
- **Processo de Build**: Instalador NSIS aprimorado com dependências incluídas
- **Tratamento de Erros**: Melhores mensagens de fallback para diversos cenários de falha

## [0.1.0] - 2025-12-18

### Adicionado
- Lançamento inicial do Cliente VPN BluePex
- Suporte à autenticação Azure AD
- Gerenciamento de conexões OpenVPN
- Gerenciamento de perfis de usuário
- Sistema básico de logging
- Aplicação desktop baseada em Electron
- Suporte para Windows e Linux</content>
<parameter name="filePath">/home/marcos/projetos/BluePexVPN/CHANGELOG-pt-BR.md