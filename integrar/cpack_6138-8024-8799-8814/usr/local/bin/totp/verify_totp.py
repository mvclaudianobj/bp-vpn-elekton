#!/usr/bin/env python3
import sys
import os
import pyotp

TOTP_SECRET_DIR = "/var/db/openvpn/totp_secrets"


def main():
    if len(sys.argv) != 3:
        print("Usage: verify_totp.py <username> <totp_code>")
        sys.exit(1)

    username, totp_code = sys.argv[1], sys.argv[2]

    secret_file = os.path.join(TOTP_SECRET_DIR, f"{username}.secret")

    if not os.path.exists(secret_file):
        print(f"No TOTP secret found for user: {username}")
        sys.exit(1)

    try:
        with open(secret_file, "r") as f:
            secret = f.read().strip()

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
