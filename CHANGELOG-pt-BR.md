# Registro de Alterações

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

---

## [0.1.9] - PLANEJADO — Fase 3: Baixa Prioridade / Qualidade de Código

### 🔀 RF012: Split Tunneling
- Permitir configurar rotas específicas por perfil `.ovpn` diretamente na interface

### 🍎 RNF011-012: Suporte macOS + ARM
- Testar e validar build para macOS 10.15+
- Suporte a arquitetura ARM (Apple Silicon / Linux ARM)

### 🧱 RNF021: Modularização do `main.js`
- Separar arquivo de 2.876 linhas em módulos independentes: `vpn-manager`, `auth-manager`, `profile-manager`, `updater`
- Aplicar padrão de módulos CommonJS com interfaces claras entre processos

### ⚙️ CI/CD: GitHub Actions
- Criar workflow para build automático em push para branches `beta-*`
- Publicação automática de releases para GitHub Releases

### 🧹 Limpeza de Repositório
- Remover arquivos de debug commitados: `debug.js`, `debug.js.backup`, `index_backup.html`, `index_debug.html`
- Atualizar badge de versão no `README.md`

---

## [0.1.8] - PLANEJADO — Fase 2: Média Prioridade / Features

### 🔔 RF021/RNF016: Notificações de Sistema
- Implementar `Notification` API do Electron para eventos: conexão estabelecida, desconexão, erro e atualização disponível

### 📊 RF022-RF024: Monitoramento em Tempo Real
- Exibir velocidade de upload/download em tempo real no dashboard
- Contador de tráfego total consumido na sessão
- Timer de tempo de conexão ativo

### 📋 RF025: Histórico de Conexões
- Persistir e exibir log de sessões anteriores (perfil, duração, data, status)

### 🔒 RF011: Kill Switch
- Bloquear todo tráfego de rede fora da interface VPN quando a conexão cair
- Implementação via `iptables` (Linux) e `netsh` (Windows)

### 🛡️ RNF008: Proteção contra DNS Leak
- Forçar resolução DNS exclusivamente via interface VPN
- Validação automática de ausência de leak na tela de diagnósticos

---

## [0.1.7] - PLANEJADO — Fase 1: Alta Prioridade / Correções Críticas

### 🐛 IS007: Ícones ausentes no pacote `.deb`
- Corrigir carregamento de ícones no aplicativo empacotado
- Substituir caminhos relativos simples no `index.html` pelo protocolo `local-resource://` já implementado no `main.js`

### 🐛 IS006: Senha não limpa ao trocar de perfil
- Limpar campos de usuário e senha antes de carregar credenciais do novo perfil
- Garantir que perfis sem senha salva exibam campos vazios

### 🐛 IS002: Falso estado "conectado" após reiniciar
- Reforçar validação de PID no `restoreApplicationState` para verificar processo real no SO antes de exibir status conectado
- Limpar `app_state.json` quando PID não corresponder a processo ativo

### 🐛 IS001: Tray icon — app desaparece ao minimizar
- Corrigir race condition na criação do tray no Linux
- Garantir que clicar no ícone do tray restaure a janela corretamente em todas as plataformas

### 🐛 IS005: Verificação de updates reporta versão errada
- Corrigir lógica de comparação de versão no auto-updater
- Garantir que a versão atual seja lida corretamente de `app.getVersion()`

### 🐛 IS003: Windows — OpenVPN não instalado automaticamente
- Validar existência do executável OpenVPN antes de tentar conectar
- Exibir mensagem clara e link de download caso o executável não seja encontrado
- Verificar silenciosamente se o MSI foi instalado pelo NSIS pós-instalação

### 🔐 IS004 / RF003 / RNF006: Segurança de Credenciais
- Remover `MASTER_PASSWORD` e `SALT` hardcoded do `main.js`
- Implementar derivação de chave a partir de `machine-id` do sistema ou keychain nativo (`keytar`)

### 🔐 RF004 / RNF006: Logout e Limpeza de Credenciais
- Validar que logout apaga todos os tokens Azure, credenciais de perfil e cache de sessão

### 🔄 RF010: Reconexão Automática em Caso de Queda
- Implementar lógica de retry com backoff exponencial no evento `close` do `vpnProcess`
- Configuração do número de tentativas e intervalo na tela de preferências

---

## [0.1.6] - 2026-03-06

### 🔧 Correções de Conexão Entra ID (Azure AD)

- **Conexão OpenVPN Azure robusta**: O fluxo `connect-openvpn` foi refatorado para usar Promise explícita e só resolve após detecção real de túnel estabelecido (`Initialization Sequence Completed` / `CONNECTED,SUCCESS`), eliminando falso positivo por PID.
- **Timeout de conexão**: Adicionado timeout explícito de 60 segundos; se o túnel não for estabelecido dentro do prazo, o processo é encerrado com `SIGTERM` e a Promise é rejeitada com mensagem descritiva.
- **Diagnóstico de falhas ampliado**: Captura e classificação de erros de `stdout`/`stderr` com mensagens específicas para falha de sudo, permissão TUN/TAP e `AUTH_FAILED`.
- **Limpeza garantida do arquivo de auth**: O arquivo temporário de autenticação (`authPath`) é removido em todos os caminhos de encerramento (sucesso, falha e timeout).
- **Erro de spawn tratado**: Adicionado bloco `try/catch` ao `spawn()` do OpenVPN com rejeição limpa da Promise em caso de falha no início do processo.
- **Tratamento de desconexão ajustado**: O evento `vpn-disconnected` não é mais disparado quando o processo cai antes de estabelecer túnel, evitando estado inconsistente na UI.
- **Validação de config antes de conectar**: Adicionada verificação da existência de `config.openvpn_config` antes de tentar iniciar o processo OpenVPN.

### 🛡️ Correções de Sessão e Fechamento

- **Bloqueio reforçado de saída com VPN ativa**: Melhorada detecção de sessão ativa via `isVpnSessionActive()` para impedir fechamento da aplicação enquanto houver túnel VPN em execução.

### 🔐 Correção de Token Azure

- **Expiração do token corrigida**: Ajustado cálculo de `expires_at` para tratar todos os formatos possíveis do campo `expiresOn` retornado pelo MSAL: objeto `Date`, número Unix timestamp (segundos) ou ausência do campo (fallback de +1 hora).

## [1.0.5] - 2026-02-27

### 🔧 Correções de Bugs

- **Correção de Salvamento de Credenciais**: Corrigido bug onde senhas não eram salvas ao marcar "Lembrar credenciais". Agora o perfil é automaticamente selecionado após criação e o ID do perfil é corretamente utilizado para salvar/carregar credenciais.

- **Correção de Ícones no App Packaged**: Corrigido problema onde ícones do menu não carregavam no aplicativo compilado. Implementado protocolo customizado `local-resource://` para servir ícones corretamente tanto em desenvolvimento quanto em produção.

- **Correção de HTML Duplicado**: Removidas seções HTML duplicadas no index.html que causavam comportamento estranho na interface.

- **Correção de Event Listeners Duplicados**: Removida chamada duplicada de `setupEventListeners()` no renderer.js que podia causar múltiplas execuções de eventos.

- **Correção de Configuração Desktop**: Removida configuração `desktop` incompatível com electron-builder 26.x.

### ✅ Correções de Persistência e Estado (hotfix)

- **Persistência de senha corrigida**: Ajustado uso de chaves de estado (`selectedProfileId`/`selectedProfileType`) e removida gravação parcial inconsistente com `lastProfileId`.

- **Criptografia de credenciais corrigida**: Substituídas APIs inválidas de criptografia GCM por `createCipheriv`/`createDecipheriv` com AES-256-GCM, restaurando gravação/leitura de senha.

- **Estado do túnel VPN validado na inicialização**: A checagem passou a validar PID + processo OpenVPN real, evitando UI conectada com túnel já caído.

- **Bloqueio de fechamento com VPN ativa**: Fechamento da janela/aplicação agora é bloqueado enquanto houver túnel ativo, exigindo desconexão explícita.

### 🐛 Melhorias Técnicas

- Adicionado tratamento de erro mais robusto para salvar credenciais
- Adicionado logging para debug de problemas com credenciais
- Configurado asarUnpack para permitir acesso a recursos estáticos (ícones)
- Atualizado dependências npm (axios, msal-node, electron, electron-builder, electron-updater)

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
- Suporte para Windows e Linux
