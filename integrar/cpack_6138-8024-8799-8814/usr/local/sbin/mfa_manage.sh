#!/bin/sh
# mfa_manage.sh - Gerenciar usuários 2FA TOTP
# Usage: mfa_manage.sh [add|remove|list|show-secret] <username> [secret]

MFA_DB="/var/db/openvpn/mfa_users"
TOTP_DIR="/var/db/openvpn/totp_secrets"

case "$1" in
  add)
    if [ -z "$2" ]; then
      echo "Usage: $0 add <username> [secret]"
      echo "  If secret is not provided, a new random secret will be generated."
      exit 1
    fi
    USER="$2"
    SECRET="$3"
    
    if [ -z "$SECRET" ]; then
      SECRET=$(python3 -c "import pyotp; print(pyotp.random_base32())")
      echo "Generated new TOTP secret for user '$USER': $SECRET"
    fi
    
    # Save secret
    echo "$SECRET" > "$TOTP_DIR/$USER.secret"
    chmod 600 "$TOTP_DIR/$USER.secret"
    
    # Add to MFA database
    if [ ! -f "$MFA_DB" ]; then
      touch "$MFA_DB"
      chmod 600 "$MFA_DB"
    fi
    
    if ! grep -q "^${USER}$" "$MFA_DB" 2>/dev/null; then
      echo "$USER" >> "$MFA_DB"
    fi
    
    echo "User '$USER' added to MFA. Secret saved."
    echo "Use this secret in Google Authenticator:"
    echo "$SECRET"
    ;;
    
  remove)
    if [ -z "$2" ]; then
      echo "Usage: $0 remove <username>"
      exit 1
    fi
    USER="$2"
    
    # Remove secret
    rm -f "$TOTP_DIR/$USER.secret"
    
    # Remove from MFA database
    if [ -f "$MFA_DB" ]; then
      grep -v "^${USER}$" "$MFA_DB" > "$MFA_DB.tmp"
      mv "$MFA_DB.tmp" "$MFA_DB"
    fi
    
    echo "User '$USER' removed from MFA."
    ;;
    
  list)
    echo "Users with MFA enabled:"
    if [ -f "$MFA_DB" ]; then
      cat "$MFA_DB"
    else
      echo "  (none)"
    fi
    ;;
    
  show-secret)
    if [ -z "$2" ]; then
      echo "Usage: $0 show-secret <username>"
      exit 1
    fi
    USER="$2"
    SECRET_FILE="$TOTP_DIR/$USER.secret"
    
    if [ -f "$SECRET_FILE" ]; then
      SECRET=$(cat "$SECRET_FILE")
      echo "TOTP Secret for user '$USER':"
      echo "$SECRET"
      echo ""
      echo "Google Authenticator URI:"
      python3 -c "import pyotp; print(pyotp.totp.TOTP('$SECRET').provisioning_uri(name='$USER', issuer_name='BluePexVPN'))"
    else
      echo "No TOTP secret found for user '$USER'"
      exit 1
    fi
    ;;
    
  *)
    echo "MFA Management Tool"
    echo ""
    echo "Usage: $0 <command> [username] [secret]"
    echo ""
    echo "Commands:"
    echo "  add <username> [secret]    - Add user to MFA (generates secret if not provided)"
    echo "  remove <username>          - Remove user from MFA"
    echo "  list                       - List all MFA-enabled users"
    echo "  show-secret <username>     - Show TOTP secret for user"
    exit 1
    ;;
esac
