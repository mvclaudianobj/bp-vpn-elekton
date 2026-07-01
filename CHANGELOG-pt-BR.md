# Registro de Alterações

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

---

## [0.1.8] - beta

### 📂 Importação de Perfis `.ovpn`

- Filtro de arquivo adicionado ao diálogo de seleção: somente arquivos `.ovpn` são exibidos
- Validação de extensão case-insensitive (`.ovpn` e `.OVPN`) no processo principal, antes e durante o salvamento
- Validação de existência e tipo de arquivo regular antes de processar
- Validação mínima de conteúdo: exige ao menos `remote` e diretiva/bloco `ca` (externo ou inline)
- Geração de nome do perfil corrigida para usar `path.parse().name`, evitando problema com `.OVPN` maiúsculo
- Mensagens de erro específicas para tipo de arquivo inválido exibidas dentro do modal de configurações

### 📋 Perfis de Arquivo Único / OpenVPN Connect (blocos inline)

- Suporte explícito a perfis com certificados e chaves embutidas no mesmo arquivo (blocos `<ca>`, `<cert>`, `<key>`, `<tls-auth>`, `<tls-crypt>`)
- Parser de blocos inline adicionado: detecta abertura/fechamento via `<tag>` / `</tag>`
- Conteúdo dentro de blocos inline preservado literalmente: sem `trim()` destrutivo, sem remoção de linhas vazias, sem processamento de diretivas externas
- `auth-user-pass` removido/substituído somente fora de blocos inline
- Remoção global de linhas em branco eliminada: arquivo processado mantém estrutura original com `join('\n')`
- Validação ajustada para aceitar `<ca>` inline além de `ca arquivo`
- Validação aceita perfis com `setenv CLIENT_CERT 0` sem exigir `<cert>`/`<key>`
- Reconhecimento de diretivas corrigido para não confundir `key` com `key-direction` e `remote` com `remote-cert-tls`
- Parsing de caminhos externos melhorado para suportar aspas e espaços
- Logs de processamento reduzidos: não imprime mais conteúdo bruto do `.ovpn`; registra apenas metadados (caminho, linhas, tamanho)

### 🔵 Perfis Azure / Entra ID

- Validação de tags `#AZURE:` adicionada ao salvar perfil Azure: arquivo sem nenhuma tag `#AZURE:` é rejeitado com mensagem clara
- Aviso informativo para tags parcialmente ausentes (`client_id`, `tenant_id`, `scope`, `server_api`)
- Mensagem de erro de compatibilidade exibida diretamente no modal de configurações sem depender do status da tela principal

### 🖥️ Status no Modal de Configurações

- Área de status local adicionada ao modal de configurações (`#configStatus`)
- Mensagens de seleção, salvamento e erro exibidas dentro do modal, sem necessidade de fechá-lo
- Status local limpo automaticamente ao abrir e fechar o modal
- Estilos consistentes com o status global (`success`, `alert`)

### 🔒 Separação de Conexões BluePex vs. OpenVPN Avulsas

- Rastreamento de ownership de conexão adicionado: metadados `connectionOwner`, `connectionId`, `profileId`, `profileType`, `ovpnPath`, `authFilePath`, `startedAt`, `wrapperPid` persistidos no estado da aplicação
- Fechamento da janela, tray/sair, `before-quit` e `window-all-closed` bloqueiam somente para sessão BluePex rastreada; OpenVPN externo não trava mais o fechamento
- `killVPNConnection()` reescrita para matar somente o processo rastreado pelo BluePex; removidos comandos globais `pkill -x openvpn` e `taskkill /IM openvpn.exe`
- Verificação de desconexão revisada: sucesso não depende mais da ausência de todo e qualquer OpenVPN no sistema
- `check-vpn-status` e `load-app-state` consideram sessão ativa somente se o PID corresponder à conexão BluePex
- Validação de ownership via `/proc/<pid>/cmdline` (Linux): exige `--config` com caminho do `.ovpn` do BluePex
- Validação de ownership via PowerShell/CIM/WMI (Windows) quando disponível
- Compatibilidade com `pkexec`/`sudo`: busca processo `openvpn` real pelo caminho `--config` quando PID rastreado é wrapper
- Fallback conservador: se não for possível provar ownership, não assume que o processo pertence ao BluePex
- `hasAnyOpenVpnProcess()` mantido apenas para diagnóstico/log, sem papel em decisões de sessão ativa

---

## [0.1.8] - PLANEJADO (itens adiados para próxima versão)

### 🔀 RF012: Split Tunneling
- Permitir configurar rotas específicas por perfil `.ovpn` diretamente na interface

### 🍎 RNF011-012: Suporte macOS + ARM
- Testar e validar build para macOS 10.15+
- Suporte a arquitetura ARM (Apple Silicon / Linux ARM)

### 🧱 RNF021: Modularização do `main.js`
- Separar arquivo de ~3.000 linhas em módulos independentes: `vpn-manager`, `auth-manager`, `profile-manager`, `updater`
- Aplicar padrão de módulos CommonJS com interfaces claras entre processos

### ⚙️ CI/CD: GitHub Actions
- Criar workflow para build automático em push para branches `beta-*`
- Publicação automática de releases para GitHub Releases

### 🧹 Limpeza de Repositório
- Remover arquivos de debug commitados: `debug.js`, `debug.js.backup`, `index_backup.html`, `index_debug.html`
- Atualizar badge de versão no `README.md`

---

## [0.1.7] - PLANEJADO — Fase 2: Média Prioridade / Features

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

## [0.1.6] - 2026-03-13

### 🐛 IS007: Ícones corrigidos no pacote `.deb`
- Substituídos todos os caminhos relativos de ícones no `index.html` pelo protocolo `local-resource://` de forma estática, garantindo carregamento correto no app empacotado
- Corrigido ícone inserido dinamicamente no `renderer.js` (botão de download de atualização)

### 🐛 IS006: Senha limpa ao trocar de perfil
- Campos de usuário, senha e "Lembrar credenciais" são zerados antes de carregar credenciais do novo perfil selecionado
- Perfis sem senha salva agora exibem campos vazios (sem vazamento do perfil anterior)

### 🐛 IS002: Falso estado "conectado" corrigido
- `load-app-state` agora valida o PID salvo via `process.kill(pid, 0)` e, no Linux, confirma que o processo é `openvpn` via `/proc/<pid>/comm`
- Se o PID não corresponde a processo ativo, `vpnPid` e `vpnConnected` são limpos e o arquivo `app_state.json` é persistido imediatamente

### 🐛 IS001: Tray icon corrigido no Linux
- Adicionada guarda contra criação dupla do tray (`tray.isDestroyed()`)
- No Linux, a criação do `Tray` é feita com delay de 500ms para evitar race condition com o `appindicator`
- Clique e double-clique no tray verificam se `mainWindow` existe antes de agir
- Todos os handlers do menu contextual do tray protegidos com verificação de `mainWindow`

### 🐛 IS003: Link de download do OpenVPN no Windows
- Quando o executável OpenVPN não é encontrado nos caminhos padrão nem via `where`, o renderer recebe evento `openvpn-not-found` com link direto para `openvpn.net/community-downloads/`
- Link clicável exibido na barra de status do app

### 🔐 IS004: Segurança de Credenciais
- `MASTER_PASSWORD` e `SALT` hardcoded removidos do `main.js`
- Chave de criptografia agora derivada do `machine-id` do sistema (Windows: registro `MachineGuid`; Linux: `/etc/machine-id`)
- Fallback seguro via hash SHA-256 do caminho de dados do app
- Compatibilidade retroativa: `decrypt()` tenta a nova chave primeiro e faz fallback para a chave legada, re-criptografando na próxima gravação

### 🔐 RF004: Logout com limpeza completa de sessão
- Implementado handler IPC `logout` que remove o token Azure em cache e limpa o `app_state.json` (PID, estado de conexão)
- Renderer recebe evento `session-cleared` e limpa campos de usuário/senha e estado de UI
- Exposto em `preload.js` como `window.electronAPI.logout()`

### 🔄 RF010: Reconexão automática com backoff exponencial
- Implementado `scheduleReconnect()` com até 3 tentativas, delay inicial de 5s e backoff exponencial (máx 60s)
- Reconexão disparada automaticamente quando VPN cai com `code !== 0` após conexão estabelecida
- Reconexão cancelada automaticamente quando usuário desconecta manualmente
- Renderer notificado via `vpn-reconnecting` (tentativa em andamento) e `vpn-reconnect-failed` (esgotado)

### 🔄 IS005: Auto-Update

- **Campo `repository` adicionado ao `package.json`**: O `electron-builder 26.x` requer o campo `repository` para gerar o arquivo `package-type` dentro do `.deb`, sem o qual o `electron-updater` não ativa o `DebUpdater` e o auto-update não funciona.
- **`checkForUpdates` aguarda evento real**: Corrigido retorno falso imediato que reportava "versão mais recente" sem verificar o GitHub.
- **`openExternal` exposto no `preload.js`**: Permite que o renderer abra URLs externas com segurança via `shell.openExternal`.

### 🔧 Correções de Conexão Entra ID (Azure AD)

- **Conexão OpenVPN Azure robusta**: O fluxo `connect-openvpn` foi refatorado para usar Promise explícita e só resolve após detecção real de túnel estabelecido (`Initialization Sequence Completed` / `CONNECTED,SUCCESS`), eliminando falso positivo por PID.
- **Timeout de conexão**: Adicionado timeout explícito de 60 segundos.
- **Diagnóstico de falhas ampliado**: Captura e classificação de erros de `stdout`/`stderr` com mensagens específicas para falha de sudo, permissão TUN/TAP e `AUTH_FAILED`.
- **Limpeza garantida do arquivo de auth**: O arquivo temporário de autenticação (`authPath`) é removido em todos os caminhos de encerramento.
- **Tratamento de desconexão ajustado**: `vpn-disconnected` não é disparado quando o processo cai antes de estabelecer túnel.
- **UPN real no auth-user-pass**: o cliente passou a enviar o usuário Entra ID real (`marcos@...`) em vez de `user` fixo, permitindo correlação correta no UTM.
- **`short_id` obrigatório no connect**: o `publish-token` agora persiste o `short_id` retornado pelo backend e o `connect-openvpn` exige esse valor para autenticação Entra ID.
- **Compatibilidade de resposta do backend**: suporte a formatos `short_id`, `shortID` e variantes em `data` na resposta da API de publish.
- **Reconexão manual corrigida**: ao clicar em desconectar, o app não exibe mais "conexão perdida/tentando reconectar" (reconexão automática suprimida para desconexão manual).
- **Elevação Linux no fluxo Azure**: fallback por estratégia (`direct` se root, `pkexec` com GUI, `sudo -n` como último recurso) para reduzir falhas de interação de senha.

### 🛡️ Correções de Sessão e Fechamento

- **Bloqueio reforçado de saída com VPN ativa**: Melhorada detecção de sessão ativa via `isVpnSessionActive()`.

### 🔐 Correção de Token Azure

- **Expiração do token corrigida**: Ajustado cálculo de `expires_at` para tratar todos os formatos possíveis do campo `expiresOn` retornado pelo MSAL: objeto `Date`, número Unix timestamp (segundos) ou ausência do campo (fallback de +1 hora).

---

## [0.1.5] - 2026-03-02

### 🔧 Correções de Bugs

- **Correção de Salvamento de Credenciais**: Corrigido bug onde senhas não eram salvas ao marcar "Lembrar credenciais". Agora o perfil é automaticamente selecionado após criação e o ID do perfil é corretamente utilizado para salvar/carregar credenciais.
- **Correção de Ícones no App Packaged**: Corrigido problema onde ícones do menu não carregavam no aplicativo compilado. Implementado protocolo customizado `local-resource://` para servir ícones corretamente tanto em desenvolvimento quanto em produção.
- **Correção de HTML Duplicado**: Removidas seções HTML duplicadas no `index.html` que causavam comportamento estranho na interface.
- **Correção de Event Listeners Duplicados**: Removida chamada duplicada de `setupEventListeners()` no `renderer.js` que podia causar múltiplas execuções de eventos.
- **Correção de Configuração Desktop**: Removida configuração `desktop` incompatível com `electron-builder 26.x`.

### ✅ Correções de Persistência e Estado

- **Persistência de senha corrigida**: Ajustado uso de chaves de estado (`selectedProfileId`/`selectedProfileType`) e removida gravação parcial inconsistente com `lastProfileId`.
- **Criptografia de credenciais corrigida**: Substituídas APIs inválidas de criptografia GCM por `createCipheriv`/`createDecipheriv` com AES-256-GCM, restaurando gravação/leitura de senha.
- **Estado do túnel VPN validado na inicialização**: A checagem passou a validar PID + processo OpenVPN real, evitando UI conectada com túnel já caído.
- **Bloqueio de fechamento com VPN ativa**: Fechamento da janela/aplicação agora é bloqueado enquanto houver túnel ativo, exigindo desconexão explícita.

### 🐛 Melhorias Técnicas

- Adicionado tratamento de erro mais robusto para salvar credenciais
- Adicionado logging para debug de problemas com credenciais
- Configurado `asarUnpack` para permitir acesso a recursos estáticos (ícones)
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

---

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

---

## [0.1.0] - 2025-12-18

### Adicionado
- Lançamento inicial do Cliente VPN BluePex
- Suporte à autenticação Azure AD
- Gerenciamento de conexões OpenVPN
- Gerenciamento de perfis de usuário
- Sistema básico de logging
- Aplicação desktop baseada em Electron
- Suporte para Windows e Linux
