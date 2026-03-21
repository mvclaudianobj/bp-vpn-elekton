#!/bin/sh
# /usr/local/sbin/ovpn_auth_verify_unificado.sh
LOG="/var/log/ovpn_auth_unificado.log"
PYTHON="/usr/local/bin/python3.8"
VERIFY_PY="/usr/local/bin/verify_saml.py"
PLUGIN="/usr/local/sbin/ovpn_auth_verify_async"

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

case "$USERNAME" in
  *@*)
    log "Azure UPN detected -> calling verify_saml.py"
    if [ -x "$PYTHON" ] && [ -f "$VERIFY_PY" ]; then
      "$PYTHON" "$VERIFY_PY" "$USERNAME" "$PASSWORD" >> "$LOG" 2>&1
      RC=$?
      log "verify_saml.py exit code: $RC"
      exit $RC
    else
      log "ERROR: python or verify_saml.py missing ($PYTHON, $VERIFY_PY)"
      exit 1
    fi
    ;;
  *)
    log "Local user -> calling ovpn_auth_verify_async"
    if [ -x "$PLUGIN" ]; then
      # plugin expects particular args; preserve original behavior by forwarding args
      "$PLUGIN" "$USERNAME" "$PASSWORD" >> "$LOG" 2>&1
      RC=$?
      log "ovpn_auth_verify_async exit code: $RC"
      exit $RC
    else
      log "ERROR: plugin missing ($PLUGIN)"
      exit 1
    fi
    ;;
esac
