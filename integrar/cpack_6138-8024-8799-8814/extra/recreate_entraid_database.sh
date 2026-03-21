#!/bin/sh
set -e  

ENTRAID_DB="/var/db/entraid_access.db"
ENTRAID_OLD_DB_BACKUP_PATH="/etc/bkp-6.0.0-RELEASE-entraid_proxy_rule_conflict"
SQLITE="/usr/local/bin/sqlite3"
NEW_DB_COMMAND="CREATE TABLE IF NOT EXISTS entraid (username TEXT, email TEXT, ip TEXT PRIMARY KEY);"

mkdir -p "$ENTRAID_OLD_DB_BACKUP_PATH"

if [ -f "$ENTRAID_DB" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    BACKUP_FILE="$ENTRAID_OLD_DB_BACKUP_PATH/entraid_access-${TIMESTAMP}.db"
    echo "Banco existente encontrado. Movendo para $BACKUP_FILE ..."
    mv "$ENTRAID_DB" "$BACKUP_FILE"
else
    echo "ℹNenhum banco existente encontrado, prosseguindo..."
fi

echo "Criando novo banco de dados..."
$SQLITE "$ENTRAID_DB" "$NEW_DB_COMMAND"

if [ -f "$ENTRAID_DB" ]; then
    echo "Banco recriado com sucesso em $ENTRAID_DB"
else
    echo "Erro: o novo banco não foi criado!"
    exit 1
fi

if $SQLITE "$ENTRAID_DB" ".tables" | grep -q "entraid"; then
    echo "Verificação concluída: tabela 'entraid' acessível."
else
    echo "Erro: tabela 'entraid' não encontrada ou banco inacessível!"
    exit 2
fi

echo "Processo concluído com sucesso."
