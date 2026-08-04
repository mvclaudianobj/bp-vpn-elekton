#!/bin/sh
# /usr/local/sbin/ovpn_auth_verify_unificado.sh
LOG="/var/log/ovpn_auth_unificado.log"
PHP="/usr/local/bin/php"
PYTHON="/usr/local/bin/python3.8"
VERIFY_PY="/usr/local/bin/verify_saml.py"
PLUGIN="/usr/local/sbin/ovpn_auth_verify_async"
OPENVPN_CONTROL_SCRIPT="/usr/local/bin/openvpn_control_script.php"
MFA_DB="/var/db/openvpn/mfa_users"
PFSENSE_GOOGLE_AUTH_DIR="/usr/local/www/openvpn/google-auth"

export TMPDIR=/tmp
export PATH="/usr/local/sbin:/usr/local/bin:/usr/bin:/bin"

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

check_openvpn_control() {
	if [ ! -x "$PHP" ] || [ ! -f "$OPENVPN_CONTROL_SCRIPT" ]; then
		return 0
	fi
	OVPN_DEV="${dev:-${daemon:-}}"
	OVPN_MODEID="${modeid:-${OVPN_DEV}}"
	CHECK_RESULT=$("$PHP" "$OPENVPN_CONTROL_SCRIPT" checkuser "$USERNAME" "$OVPN_MODEID" "$OVPN_DEV" 2>>"$LOG")
	if [ "$CHECK_RESULT" = "expired" ]; then
		log "DENIED: OpenVPN Control blocked '$USERNAME' (modeid='$OVPN_MODEID' dev='$OVPN_DEV')"
		exit 1
	fi
}

short_username() { echo "$1" | cut -d'@' -f1; }

check_mfa_enabled() {
	local user="$1"
	local short=$(short_username "$user")
	if [ -f "$MFA_DB" ]; then
		grep -qE "^${user}$|^${short}$" "$MFA_DB" 2>/dev/null && return 0
	fi
	if [ -f "${PFSENSE_GOOGLE_AUTH_DIR}/${short}" ] || \
	   [ -f "${PFSENSE_GOOGLE_AUTH_DIR}/${user}" ]; then
		return 0
	fi
	return 1
}

# read credentials — prioriza via-env do OpenVPN
if [ -n "${username:-}" ] || [ -n "${password:-}" ]; then
	USERNAME="${username:-}"
	PASSWORD="${password:-}"
elif [ "$1" = "--from-file" ] && [ -n "$2" ]; then
	if [ -f "$2" ]; then
		USERNAME=$(sed -n '1p' "$2" | tr -d '\r\n')
		PASSWORD=$(sed -n '2p' "$2" | tr -d '\r\n')
	else
		log "DENIED: file not found $2"; exit 1
	fi
else
	USERNAME="$1"
	PASSWORD="$2"
fi

log "Attempt auth for '$USERNAME' (len password: ${#PASSWORD})"

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
	log "DENIED: empty username or password"
	exit 1
fi

check_openvpn_control

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
		log "Local user detected: $USERNAME"

		# Formato password|TOTP vindo do static-challenge BluePexVPN
		if echo "$PASSWORD" | grep -q '|'; then
			REAL_PASS=$(echo "$PASSWORD" | cut -d'|' -f1)
			TOTP_CODE=$(echo "$PASSWORD" | cut -d'|' -f2 | tr -d ' ')
			log "TOTP format detected (password|TOTP)"

			if [ -z "$REAL_PASS" ] || [ -z "$TOTP_CODE" ]; then
				log "DENIED: invalid TOTP format"
				exit 1
			fi

			if check_mfa_enabled "$USERNAME"; then
				log "MFA enabled for '$USERNAME' -> converting to SCRV1 for plugin"
				PASS_B64=$(printf "%s" "$REAL_PASS" | openssl enc -base64 | tr -d '\n')
				SHORT=$(short_username "$USERNAME")
				SECRET_FILE="${PFSENSE_GOOGLE_AUTH_DIR}/${SHORT}"
				[ ! -f "$SECRET_FILE" ] && SECRET_FILE="${PFSENSE_GOOGLE_AUTH_DIR}/${USERNAME}"
				CURRENT_TOTP=$(oathtool -b --totp "$(head -1 "$SECRET_FILE")" 2>/dev/null)
				if [ -z "$CURRENT_TOTP" ]; then
					log "DENIED: could not generate current TOTP for plugin"
					exit 1
				fi
				TOTP_B64=$(printf "%s" "$CURRENT_TOTP" | openssl enc -base64 | tr -d '\n')
				PASSWORD="SCRV1:${PASS_B64}:${TOTP_B64}"
				log "SCRV1 format built for plugin with current TOTP"
			else
				log "MFA not configured for '$USERNAME', using only password"
				PASSWORD="$REAL_PASS"
			fi
		else
			if check_mfa_enabled "$USERNAME"; then
				log "DENIED: MFA required for '$USERNAME' but no TOTP provided"
				exit 1
			fi
		fi

		log "Local user -> calling ovpn_auth_verify_async"
		if [ -x "$PLUGIN" ]; then
			TMPCTL=$(mktemp /tmp/ovpn_auth_ctl.XXXXXX 2>/dev/null || mktemp -t ovpn_auth_ctl)
			if [ -z "$TMPCTL" ] || [ ! -f "$TMPCTL" ]; then
				log "ERROR: could not create auth control temp file"
				exit 1
			fi
			password="$PASSWORD" username="$USERNAME" auth_control_file="$TMPCTL" "$PLUGIN" "$@" >> "$LOG" 2>&1
			PLUGIN_RC=$?
			AUTH_RESULT=$(cat "$TMPCTL" 2>/dev/null)
			rm -f "$TMPCTL"
			log "ovpn_auth_verify_async exit code: $PLUGIN_RC; auth_control_file result: '${AUTH_RESULT}'"
			if [ "$AUTH_RESULT" = "1" ]; then
				exit 0
			fi
			exit 1
		else
			log "ERROR: plugin missing ($PLUGIN)"
			exit 1
		fi
		;;
esac
