#!/usr/bin/env python3
import sys
import os
import pyotp

TOTP_SECRET_DIR = "/var/db/openvpn/totp_secrets"
# pfSense armazena em /usr/local/www/openvpn/google-auth/<username>
PFSENSE_GOOGLE_AUTH_DIR = "/usr/local/www/openvpn/google-auth"


def load_secret(username):
    # 1. Tentar nosso diretório primeiro
    secret_file = os.path.join(TOTP_SECRET_DIR, f"{username}.secret")
    if os.path.exists(secret_file):
        with open(secret_file, "r") as f:
            return f.readline().strip()

    # 2. Fallback: ler direto do diretório do pfSense
    pfsense_file = os.path.join(PFSENSE_GOOGLE_AUTH_DIR, username)
    if os.path.exists(pfsense_file):
        with open(pfsense_file, "r") as f:
            return f.readline().strip()

    return None


def main():
    if len(sys.argv) != 3:
        print("Usage: verify_totp.py <username> <totp_code>")
        sys.exit(1)

    username, totp_code = sys.argv[1], sys.argv[2]

    # Normalizar username: marcos@fwutm.fenixsis.local -> marcos
    short_user = username.split("@")[0] if "@" in username else username

    secret = load_secret(short_user) or load_secret(username)

    if not secret:
        print(
            f"No TOTP secret found for user: {username} (tried: {short_user}, {username})"
        )
        sys.exit(1)

    try:
        totp = pyotp.TOTP(secret)

        if totp.verify(totp_code, valid_window=1):
            print(f"TOTP validation successful for user: {username}")
            sys.exit(0)
        else:
            print(f"Invalid TOTP code for user: {username}")
            sys.exit(1)

    except Exception as e:
        print(f"Error validating TOTP: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
