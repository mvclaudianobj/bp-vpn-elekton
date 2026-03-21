#!/bin/sh
# Teste de token Entra ID / Azure AD para OpenVPN (FreeBSD compatível)

AUTH_FILE="/tmp/openvpn_auth.txt"

if [ ! -f "$AUTH_FILE" ]; then
    echo "Arquivo de autenticação não encontrado: $AUTH_FILE"
    exit 1
fi

# Lê username e token do arquivo
USERNAME=$(sed -n '1p' "$AUTH_FILE")
TOKEN=$(sed -n '2p' "$AUTH_FILE")

# Substring compatível com FreeBSD
SHORT_TOKEN=$(echo "$TOKEN" | cut -c1-30)

echo "Usuário: $USERNAME"
echo "Token JWT: $SHORT_TOKEN... (cortado para segurança)"

# Teste com Microsoft Graph
echo "[*] Testando token no Graph /me..."
HTTP_STATUS=$(curl -s -o /tmp/graph_response.json -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    https://graph.microsoft.com/v1.0/me)

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "[✓] Token válido!"
    cat /tmp/graph_response.json | jq
else
    echo "[✗] Token inválido ou sem permissão. HTTP status: $HTTP_STATUS"
    cat /tmp/graph_response.json
fi

