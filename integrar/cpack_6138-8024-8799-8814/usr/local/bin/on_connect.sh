#!/bin/sh
LOG="/var/log/entra_id.log"
echo "$(date -Iseconds) CONNECT: common_name=${common_name:-} trusted_ip=${trusted_ip:-} remote_ip=${trusted_ip:-} ifconfig_pool_remote_ip=${ifconfig_pool_remote_ip:-}" >> "$LOG"
exit 0
