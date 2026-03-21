#!/bin/sh
LOG="/var/log/entra_id.log"
echo "$(date -Iseconds) DISCONNECT: common_name=${common_name:-} reason=${reason:-}" >> "$LOG"
exit 0
