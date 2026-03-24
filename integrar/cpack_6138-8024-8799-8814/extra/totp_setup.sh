#!/bin/sh
# totp_setup.sh - Setup TOTP 2FA dependencies and directories

echo "Setting up TOTP 2FA..."

# Create TOTP secrets directory
mkdir -p /var/db/openvpn/totp_secrets
chmod 700 /var/db/openvpn/totp_secrets
chown nobody:nobody /var/db/openvpn/totp_secrets

# Install pyotp Python package
if ! python3 -c "import pyotp" 2>/dev/null; then
    echo "Installing pyotp..."
    pip3 install pyotp
fi

# Set permissions on TOTP scripts
chmod +x /usr/local/bin/totp/verify_totp.py
chmod +x /usr/local/bin/totp/verify_totp.sh

echo "TOTP 2FA setup complete!"
