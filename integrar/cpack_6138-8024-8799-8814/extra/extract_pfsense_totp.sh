#!/bin/sh
# extract_pfsense_totp.sh
# Extrai segredo TOTP do pfSense e importa para o diretório do verify_totp.py
# Executar no UTM como root/admin

LOG="/var/log/extract_totp.log"
GOOGLE_AUTH_DIR="/usr/local/www/openvpn/google-auth"
TOTP_DIR="/var/db/openvpn/totp_secrets"

log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }

log "=== Extração de segredos TOTP do pfSense ==="

# Criar diretório destino
mkdir -p "$TOTP_DIR"
chmod 700 "$TOTP_DIR"

# Verificar se o diretório existe
if [ ! -d "$GOOGLE_AUTH_DIR" ]; then
    log "ERRO: diretório $GOOGLE_AUTH_DIR não encontrado"
    log "Tentando localizar diretório de autenticação..."
    find /usr/local/www -name "*.totp" -o -name "*.secret" -o -name "*google*" 2>/dev/null | head -20
    find /var -name "*.totp" -o -name "*.secret" -o -name "*google*" 2>/dev/null | head -20
    exit 1
fi

log "Diretório encontrado: $GOOGLE_AUTH_DIR"
log "Arquivos encontrados:"
ls -la "$GOOGLE_AUTH_DIR"

# Importar segredos para o diretório do verify_totp.py
# O pfSense armazena como: /usr/local/www/openvpn/google-auth/<username>
for secret_file in "$GOOGLE_AUTH_DIR"/*; do
    if [ -f "$secret_file" ]; then
        username=$(basename "$secret_file")
        secret=$(head -1 "$secret_file")
        
        log "Importando usuário: $username"
        
        # Salvar no formato esperado pelo verify_totp.py
        echo "$secret" > "$TOTP_DIR/$username.secret"
        chmod 600 "$TOTP_DIR/$username.secret"
        
        # Adicionar ao MFA database
        MFA_DB="/var/db/openvpn/mfa_users"
        if [ ! -f "$MFA_DB" ]; then
            touch "$MFA_DB"
            chmod 600 "$MFA_DB"
        fi
        
        if ! grep -q "^${username}$" "$MFA_DB" 2>/dev/null; then
            echo "$username" >> "$MFA_DB"
        fi
        
        log "Usuário $username importado com sucesso"
    fi
done

log "=== Importação concluída ==="
log "Usuários com 2FA habilitado:"
cat "$TOTP_DIR"/*.secret 2>/dev/null | while IFS= read -r line; do
    log "  - $line"
done

ls -la "$TOTP_DIR"
