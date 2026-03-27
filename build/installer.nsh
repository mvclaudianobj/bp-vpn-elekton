!macro customInstall
  # Verificar se OpenVPN já está instalado
  IfFileExists "$PROGRAMFILES64\OpenVPN\bin\openvpn.exe" OpenVPNAlreadyInstalled 0
  IfFileExists "$PROGRAMFILES\OpenVPN\bin\openvpn.exe" OpenVPNAlreadyInstalled 0

  # OpenVPN não encontrado - instalar o MSI bundled
  # O MSI está em $INSTDIR\resources\ (extraResources do electron-builder)
  IfFileExists "$INSTDIR\resources\OpenVPN-2.7_rc2-I009-amd64.msi" InstallOpenVPN 0

  # Fallback: tentar no diretório temporário
  IfFileExists "$TEMP\OpenVPN.msi" DoInstall 0

  MessageBox MB_OK "Instalador do OpenVPN não encontrado. Por favor, instale o OpenVPN manualmente a partir de https://openvpn.net/community-downloads/"
  Goto OpenVPNDone

  InstallOpenVPN:
    CopyFiles "$INSTDIR\resources\OpenVPN-2.7_rc2-I009-amd64.msi" "$TEMP\OpenVPN.msi"

  DoInstall:
    # Instalar OpenVPN com privilegios elevados e aguardar conclusao
    # Nao fixa ADDLOCAL para evitar falha quando nomes de features mudam entre versoes do MSI.
    ExecWait '"$SYSDIR\msiexec.exe" /i "$TEMP\OpenVPN.msi" /qn /norestart /L*V "$TEMP\bluepex-openvpn-msi.log"' $0

    ${If} $0 != 0
      ${If} $0 == 1638
        # Codigo 1638 = versao mais nova ja instalada - OK
        Goto CleanupMSI
      ${EndIf}

      # Fallback: tentar modo passive (alguns ambientes bloqueiam /qn)
      ExecWait '"$SYSDIR\msiexec.exe" /i "$TEMP\OpenVPN.msi" /passive /norestart /L*V "$TEMP\bluepex-openvpn-msi.log"' $1

      ${If} $1 != 0
        MessageBox MB_OK "Falha na instalacao do OpenVPN (codigos: qn=$0, passive=$1). Verifique o log em %TEMP%\\bluepex-openvpn-msi.log ou instale manualmente: https://openvpn.net/community-downloads/"
      ${EndIf}
    ${EndIf}

  CleanupMSI:
    Delete "$TEMP\OpenVPN.msi"
    Goto OpenVPNDone

  OpenVPNAlreadyInstalled:
    DetailPrint "OpenVPN ja esta instalado - ignorando instalacao."

  OpenVPNDone:
!macroend
