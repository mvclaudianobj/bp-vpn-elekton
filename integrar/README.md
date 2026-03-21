# Integracao BluePexVPN <-> BluePexUTM6

Este diretorio concentra o pacote customizado (cpack) usado para integrar o ciclo Entra ID entre o aplicativo Node/Electron (`BluePexVPN`) e o UTM (`BluePexUTM 6`).

## Pacote atual

- `cpack_6138-8024-8799-8814/`
- instalador: `install_cpack_6138-8024-8799-8814.sh`

## Objetivo do ciclo Entra ID

1. App BluePexVPN autentica o usuario via Device Flow.
2. App publica token no backend (`/publish`).
3. Backend gera `short_id` temporario.
4. OpenVPN no UTM valida `<username, short_id>` via `verify_saml.py` (`/validate/<short_id>`).
5. Autenticacao OpenVPN e sessao webfilter seguem o estado validado.

## Ajustes aplicados nesta rodada

- Corrigido instalador do cpack para copiar scripts runtime que faltavam:
  - `/usr/local/bin/on_connect.sh`
  - `/usr/local/bin/on_disconnect.sh`
  - `/usr/local/bin/verify_saml.sh`
  - `/usr/local/bin/verify_saml.py`
  - `/usr/local/sbin/test_azure_token.sh`
  - `/usr/local/sbin/ovpn_auth_verify_unificado.sh`
- Endurecida leitura de `/usr/local/bin/.env` em `entraid_config.inc`:
  - valida existencia/leitura
  - ignora comentarios/linhas vazias
  - parse `KEY=VALUE` com limite de split
- Corrigido `ENTRAID_DEFAULT_ERROR_MSG` em `entraid_error_handling.inc` (agora array, nao JSON string).
- `verify_saml.py` passa a aceitar `ENTRAID_FASTAPI_SERVER` por variavel de ambiente.
- `verify_saml.sh` passa a carregar `/usr/local/bin/.env` antes de executar Python.

## Revalidacao pos-update (UTM em cpack33)

Status validado no host UTM6:

- `verify_saml.py`, `verify_saml.sh`, `ovpn_auth_verify_unificado.sh` presentes e executaveis
- `python3.8` e modulo `requests` ok
- teste funcional `publish -> validate -> verify_saml` com `RC=0`
- teste funcional `ovpn_auth_verify_unificado.sh` com `RC=0`

Pontos encontrados:

- `/usr/local/bin/.env` ausente (necessario para frontend PHP EntraID e variaveis de ambiente)
- `config.xml` ainda com `auth_method=none` e sem geracao ativa em `/var/etc/openvpn`
  - sem `auth-user-pass-verify`, o ciclo VPN nao fecha no OpenVPN runtime
- `callback.php` remoto divergiu do arquivo local do cpack (possivel alteracao do cpack33)
  - antes de sobrescrever, revisar merge de comportamento para nao perder ajustes do cpack base

## Pre-flight para teste E2E

No UTM, conferir:

- `python3.8` instalado
- modulo Python `requests` instalado
- arquivos de runtime presentes e executaveis em `/usr/local/bin` e `/usr/local/sbin`
- servidor OpenVPN realmente configurado com `auth-user-pass-verify` apontando para script unificado

No backend/app:

- `server_api` do app apontando para endpoint `/publish`
- endpoint `/validate/<short_id>` respondendo no UTM

## Validacao tecnica minima

Exemplo rapido:

```bash
SHORT_ID=$(curl -s -X POST "http://wsutm.bluepex.com:30001/publish" \
  -H "Content-Type: application/json" \
  -d '{"username":"qa.entraid@bluepex.com","jwt_token":"dummy"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["short_id"])')

/usr/local/bin/python3.8 /usr/local/bin/verify_saml.py qa.entraid@bluepex.com "$SHORT_ID"
echo $?
```

Retorno `0` indica validacao positiva.

## Correcao adicional (wizard OpenVPN)

Foi identificado que o instalador nao aplicava os arquivos do wizard customizado, apesar deles existirem no pacote.

Arquivos adicionados ao fluxo de instalacao do cpack:

- `/usr/local/www/wizards/openvpn_wizard.inc`
- `/usr/local/www/wizards/openvpn_wizard.xml`
- `/usr/local/www/vpn_openvpn_server.php`

Evidencia de validacao no UTM apos reaplicar pacote:

- `openvpn_wizard.xml` contem opcao `EntraID` (`<name>EntraID</name>` / `<value>entraid</value>`)
- `openvpn_wizard.inc` contem branch `$_POST['authtype'] == "entraid"`

## Correcao adicional (openvpn.inc nao aplicado)

Foi identificado que, apos update de pacote base, o runtime voltou a gerar plugin legado:

- `plugin ... ovpn_auth_verify_async`

em vez de:

- `auth-user-pass-verify /usr/local/sbin/ovpn_auth_verify_unificado.sh via-env`

Causa raiz:

- instalador do cpack nao copiava `/etc/inc/openvpn.inc`.

Correcao:

- adicionado `install_cpack "/etc/inc/openvpn.inc" "bk"` no instalador
- reaplicado `openvpn.inc` no UTM e executado `openvpn_resync_all()`
- validado em `/var/etc/openvpn/server1/config.ovpn` com diretiva `auth-user-pass-verify` ativa

## Correcao adicional (include de auditoria no wizard)

Foi corrigido erro fatal de include no wizard:

- antes: `require_once("bluepex/bp_auditing.inc")`
- agora: fallback robusto
  - tenta `/etc/inc/bluepex/bp_auditing.inc`
  - fallback para `require_once('bp_auditing.inc')`

Isso evita quebra em ambientes onde o arquivo de auditoria fica no include path padrao de `/etc/inc`.

## Correcao adicional (compatibilidade config_*_path no wizard)

Foi identificado erro fatal em ambientes onde `config_get_path()` nao existe no runtime do wizard.

Correcao aplicada em `openvpn_wizard.inc`:

- camada de compatibilidade para:
  - `config_get_path()`
  - `config_set_path()`
  - `config_del_path()`

Com isso, o wizard customizado EntraID funciona tanto em builds mais novos quanto em builds legados do UTM/pfSense.

## Correcao adicional (compatibilidade PHP legada)

Foi adicionada compatibilidade para ambientes PHP antigos sem `str_starts_with()`.

- arquivo: `openvpn_wizard.inc`
- acao: polyfill local com `if (!function_exists('str_starts_with'))`

## Correcao adicional (compatibilidade add_filter_rules)

Em alguns runtimes de wizard, `add_filter_rules()` nao esta disponivel.

- arquivo: `openvpn_wizard.inc`
- acao: fallback com `if (!function_exists('add_filter_rules'))` adicionando regras em `$config['filter']['rule']`
