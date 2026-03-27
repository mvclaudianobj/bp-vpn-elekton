#!/bin/sh

TARGET_FILE="/usr/local/www/vpn_openvpn_export.php"
ALT_TARGET_FILE="/usr/local/www/vpn_openvpn_export_shared.php"
INCLUDE_LINE="require_once('/etc/inc/bluepex_azure_export.inc');"
START_LINE="if (function_exists('bluepex_start_export_buffer')) { bluepex_start_export_buffer(); } // BLUEPEX_AZURE_TAGS_PATCH"

echo "[bluepex] Patch export OVPN com tags AZURE"

if [ ! -f "$TARGET_FILE" ] && [ -f "$ALT_TARGET_FILE" ]; then
  TARGET_FILE="$ALT_TARGET_FILE"
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "[bluepex] Arquivo alvo não encontrado: $TARGET_FILE"
  echo "[bluepex] Dica: instale/ative o pacote OpenVPN Client Export no UTM"
  exit 1
fi

if grep -q "BLUEPEX_AZURE_TAGS_PATCH" "$TARGET_FILE"; then
  echo "[bluepex] Patch já aplicado"
  exit 0
fi

cp "$TARGET_FILE" "${TARGET_FILE}.bluepex.bak"

# Inserção robusta: injeta após a primeira linha require_once(*guiconfig.inc*)
awk -v inc="$INCLUDE_LINE" -v start="$START_LINE" '
  {
    print $0;
    if (!done && $0 ~ /require_once\(["\x27]guiconfig\.inc["\x27]\);/) {
      print inc;
      print start;
      done=1;
    }
  }
  END {
    if (!done) exit 2;
  }
' "$TARGET_FILE" > "${TARGET_FILE}.bluepex.tmp"

AWK_RC=$?
if [ $AWK_RC -ne 0 ]; then
  rm -f "${TARGET_FILE}.bluepex.tmp"
  echo "[bluepex] Marcador guiconfig.inc não encontrado. Restaurando backup."
  mv "${TARGET_FILE}.bluepex.bak" "$TARGET_FILE"
  exit 1
fi

mv "${TARGET_FILE}.bluepex.tmp" "$TARGET_FILE"

if grep -q "BLUEPEX_AZURE_TAGS_PATCH" "$TARGET_FILE"; then
  echo "[bluepex] Patch aplicado com sucesso"
  exit 0
fi

echo "[bluepex] Falha ao validar patch. Restaurando backup."
mv "${TARGET_FILE}.bluepex.bak" "$TARGET_FILE"
exit 1
