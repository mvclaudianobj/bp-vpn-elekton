# Registro de Alterações

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/spec/v2.0.0.html).

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