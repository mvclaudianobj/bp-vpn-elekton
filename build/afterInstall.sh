#!/bin/bash

# After install script for BluePex VPN

set -e

echo "Installing pkexec policy..."

# Copy policy file to /usr/share/polkit-1/actions/
sudo cp /opt/BluePex\ VPN/resources/com.bpvpn.pkexec.policy /usr/share/polkit-1/actions/ 2>/dev/null || true

# Reload polkit
sudo systemctl reload polkit 2>/dev/null || true

echo "Post-install completed."