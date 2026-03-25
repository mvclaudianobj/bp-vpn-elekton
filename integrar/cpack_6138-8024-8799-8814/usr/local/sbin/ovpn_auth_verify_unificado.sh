#!/bin/sh
# /usr/local/sbin/ovpn_auth_verify_unificado.sh
LOG="/var/log/ovpn_auth_unificado.log"
PYTHON="/usr/local/bin/python3.8"
VERIFY_SAML_PY="/usr/local/bin/verify_saml.py"
VERIFY_TOTP_SH="/usr/local/bin/totp/verify_totp.sh"
VERIFY_TOTP_PY="/usr/local/bin/totp/verify_totp.py"
PLUGIN="/usr/local/sbin/ovpn_auth_verify_async"
MFA_DB="/var/db/openvpn/mfa_users"

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

check_mfa_enabled() {
  local user="$1"
  local short_user=$(echo "$user" | cut -d'@' -f1)

  # 1. checar nosso MFA_DB
  if [ -f "$MFA_DB" ]; then
    grep -qE "^${user}$|^${short_user}$" "$MFA_DB" 2>/dev/null && return 0
  fi

  # 2. fallback: checar diretório nativo do pfSense
  if [ -f "/usr/local/www/openvpn/google-auth/${short_user}" ] || \
     [ -f "/usr/local/www/openvpn/google-auth/${user}" ]; then
    return 0
  fi

  return 1
}

extract_totp_code() {
  local password="$1"
  echo "$password" | cut -d'|' -f2 | tr -d ' '
}

extract_password() {
  local password="$1"
  echo "$password" | cut -d'|' -f1
}

is_totp_format() {
  local password="$1"
  echo "$password" | grep -q '|'
  return $?
}

case "$USERNAME" in
  *@*)
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
    ;;
  *)
    log "Local user detected"
    
    if is_totp_format "$PASSWORD"; then
      log "TOTP format detected (password|TOTP)"
      REAL_PASS=$(extract_password "$PASSWORD")
      TOTP_CODE=$(extract_totp_code "$PASSWORD")
      
      if [ -z "$REAL_PASS" ] || [ -z "$TOTP_CODE" ]; then
        log "DENIED: invalid TOTP format (expected password|TOTP)"
        exit 1
      fi
      
      if check_mfa_enabled "$USERNAME"; then
        log "MFA enabled for user '$USERNAME' -> validating TOTP"
        if [ -x "$VERIFY_TOTP_SH" ]; then
          "$VERIFY_TOTP_SH" "$USERNAME" "$TOTP_CODE" >> "$LOG" 2>&1
          RC=$?
          if [ $RC -ne 0 ]; then
            log "TOTP validation FAILED for: $USERNAME"
            exit 1
          fi
          log "TOTP validation SUCCESS"
        else
          log "ERROR: TOTP verification script not found"
          exit 1
        fi
      else
        log "MFA not enabled for user '$USERNAME', skipping TOTP"
      fi
      
      log "Validating password for user '$USERNAME'"
      if [ -x "$PLUGIN" ]; then
        "$PLUGIN" "$USERNAME" "$REAL_PASS" >> "$LOG" 2>&1
        RC=$?
        log "ovpn_auth_verify_async exit code: $RC"
        exit $RC
      else
        log "ERROR: plugin missing ($PLUGIN)"
        exit 1
      fi
    else
      log "Standard password format (no TOTP)"
      if check_mfa_enabled "$USERNAME"; then
        log "MFA is REQUIRED for user '$USERNAME', but no TOTP code provided"
        exit 1
      fi
      
      log "Calling ovpn_auth_verify_async for user '$USERNAME'"
      if [ -x "$PLUGIN" ]; then
        "$PLUGIN" "$USERNAME" "$PASSWORD" >> "$LOG" 2>&1
        RC=$?
        log "ovpn_auth_verify_async exit code: $RC"
        exit $RC
      else
        log "ERROR: plugin missing ($PLUGIN)"
        exit 1
      fi
    fi
    ;;
esac
