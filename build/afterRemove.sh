#!/bin/bash

# After remove script for BluePex VPN

set -e

echo "Removing pkexec policy..."

# Remove policy file
sudo rm -f /usr/share/polkit-1/actions/com.bpvpn.pkexec.policy 2>/dev/null || true

# Reload polkit
sudo systemctl reload polkit 2>/dev/null || true

echo "Post-remove completed."