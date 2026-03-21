#!/bin/sh
# Wrapper que chama o verificador Python de token Entra ID
if [ -f /usr/local/bin/.env ]; then
  set -a
  . /usr/local/bin/.env
  set +a
fi

exec /usr/local/bin/python3.8 /usr/local/bin/verify_saml.py "$@"
