#!/bin/sh
# /usr/local/sbin/ovpn_auth_verify_unificado.sh
LOG="/var/log/ovpn_auth_unificado.log"
PYTHON="/usr/local/bin/python3.8"
VERIFY_SAML_PY="/usr/local/bin/verify_saml.py"
VERIFY_TOTP_SH="/usr/local/bin/totp/verify_totp.sh"
PLUGIN="/usr/local/sbin/ovpn_auth_verify_async"
MFA_DB="/var/db/openvpn/mfa_users"
PFSENSE_GOOGLE_AUTH_DIR="/usr/local/www/openvpn/google-auth"

# predictable env
export TMPDIR=/tmp
export PATH="/usr/local/sbin:/usr/local/bin:/usr/bin:/bin"

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

# read args or file
if [ "$#" -ge 2 ]; then
  USERNAME="$1"
  PASSWORD="$2"
elif [ "$1" = "--from-file" ] && [ -n "$2" ]; then
  if [ -f "$2" ]; then
    USERNAME=$(sed -n '1p' "$2" | tr -d '\r\n')
    PASSWORD=$(sed -n '2p' "$2" | tr -d '\r\n')
  else
    log "DENIED: file not found $2"; exit 1
  fi
else
  # fallback to OpenVPN via-env
  USERNAME="${username:-}"
  PASSWORD="${password:-}"
fi

log "Attempt auth for '$USERNAME' (len password: ${#PASSWORD})"

# ensure non-empty
if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  log "DENIED: empty username or password"
  exit 1
fi

# Detecta se é Azure UPN (externo) ou usuário local com domínio
is_azure_upn() {
  local user="$1"
  # Locais: terminam em .local, .intranet, .internal ou sem TLD válido
  case "$user" in
    *.local|*.local.*|*.intranet|*.internal|*.lan) return 1 ;;
  esac
  # Azure/externo: onmicrosoft.com ou TLDs comuns
  case "$user" in
    *onmicrosoft.com|*@*.com|*@*.net|*@*.org|*@*.io) return 0 ;;
  esac
  return 1
}

# Extrai username curto: marcos@fwutm.fenixsis.local -> marcos
short_username() {
  echo "$1" | cut -d'@' -f1
}

# Verifica se MFA está habilitado para o usuário
check_mfa_enabled() {
  local user="$1"
  local short=$(short_username "$user")

  # 1. checar nosso MFA_DB
  if [ -f "$MFA_DB" ]; then
    grep -qE "^${user}$|^${short}$" "$MFA_DB" 2>/dev/null && return 0
  fi

  # 2. fallback: checar diretório nativo do pfSense (google-auth)
  if [ -f "${PFSENSE_GOOGLE_AUTH_DIR}/${short}" ] || \
     [ -f "${PFSENSE_GOOGLE_AUTH_DIR}/${user}" ]; then
    return 0
  fi

  return 1
}

# Funções para extrair senha e TOTP do formato senha|TOTP
is_totp_format() {
  echo "$1" | grep -q '|'
}

extract_password() {
  echo "$1" | cut -d'|' -f1
}

extract_totp_code() {
  echo "$1" | cut -d'|' -f2 | tr -d ' '
}

# Autenticar usuário local com plugin pfSense
auth_local_password() {
  local user="$1"
  local pass="$2"
  if [ -x "$PLUGIN" ]; then
    "$PLUGIN" "$user" "$pass" >> "$LOG" 2>&1
    RC=$?
    log "ovpn_auth_verify_async exit code: $RC"
    return $RC
  else
    log "ERROR: plugin missing ($PLUGIN)"
    return 1
  fi
}

# Validar código TOTP
auth_totp() {
  local user="$1"
  local code="$2"
  local short=$(short_username "$user")
  if [ -x "$VERIFY_TOTP_SH" ]; then
    "$VERIFY_TOTP_SH" "$short" "$code" >> "$LOG" 2>&1
    RC=$?
    log "verify_totp.sh exit code: $RC"
    return $RC
  else
    log "ERROR: verify_totp.sh not found or not executable"
    return 1
  fi
}

# ============ ROTEAMENTO PRINCIPAL ============

# Azure UPN → verify_saml.py (short_id)
if echo "$USERNAME" | grep -q '@' && is_azure_upn "$USERNAME"; then
  log "Azure UPN detected -> calling verify_saml.py"
  if [ -x "$PYTHON" ] && [ -f "$VERIFY_SAML_PY" ]; then
    "$PYTHON" "$VERIFY_SAML_PY" "$USERNAME" "$PASSWORD" >> "$LOG" 2>&1
    RC=$?
    log "verify_saml.py exit code: $RC"
    exit $RC
  else
    log "ERROR: python or verify_saml.py missing ($PYTHON, $VERIFY_SAML_PY)"
    exit 1
  fi
fi

# Usuário local (com ou sem domínio .local)
log "Local user detected: $USERNAME"

if is_totp_format "$PASSWORD"; then
  log "TOTP format detected (password|TOTP)"
  REAL_PASS=$(extract_password "$PASSWORD")
  TOTP_CODE=$(extract_totp_code "$PASSWORD")

  if [ -z "$REAL_PASS" ] || [ -z "$TOTP_CODE" ]; then
    log "DENIED: invalid TOTP format (expected password|TOTP)"
    exit 1
  fi

  if check_mfa_enabled "$USERNAME"; then
    log "MFA enabled for '$USERNAME' -> validating TOTP"
    auth_totp "$USERNAME" "$TOTP_CODE"
    if [ $? -ne 0 ]; then
      log "DENIED: TOTP validation failed for '$USERNAME'"
      exit 1
    fi
    log "TOTP OK -> validating password"
  else
    log "MFA not configured for '$USERNAME', validating only password"
  fi

  auth_local_password "$USERNAME" "$REAL_PASS"
  exit $?

else
  # Sem TOTP - verificar se MFA é obrigatório
  if check_mfa_enabled "$USERNAME"; then
    log "DENIED: MFA required for '$USERNAME' but no TOTP code provided (expected format: password|TOTP)"
    exit 1
  fi

  log "Standard auth for '$USERNAME'"
  auth_local_password "$USERNAME" "$PASSWORD"
  exit $?
fi
