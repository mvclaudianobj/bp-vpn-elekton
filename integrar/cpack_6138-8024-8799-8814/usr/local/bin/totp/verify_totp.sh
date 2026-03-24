#!/bin/sh
# verify_totp.sh - Wrapper para validação TOTP

LOG="/var/log/verify_totp.log"
VERIFY_PY="/usr/local/bin/totp/verify_totp.py"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG"
}

USERNAME="$1"
TOTP_CODE="$2"

if [ -z "$USERNAME" ] || [ -z "$TOTP_CODE" ]; then
    echo "Usage: verify_totp.sh <username> <totp_code>"
    log "ERROR: Missing username or totp_code"
    exit 1
fi

log "Validating TOTP for user: $USERNAME"

if [ ! -f "$VERIFY_PY" ]; then
    log "ERROR: verify_totp.py not found"
    exit 1
fi

python3 "$VERIFY_PY" "$USERNAME" "$TOTP_CODE"
RC=$?

if [ $RC -eq 0 ]; then
    log "TOTP validation SUCCESS for: $USERNAME"
else
    log "TOTP validation FAILED for: $USERNAME"
fi

exit $RC
