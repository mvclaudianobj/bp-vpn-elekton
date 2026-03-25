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
    ExecWait '"msiexec" /i "$TEMP\OpenVPN.msi" /qn /norestart ADDLOCAL=OpenVPN.Service,Drivers.OvpnDco,Drivers.TAPWindows6,Drivers.Wintun' $0

    ${If} $0 != 0
      ${If} $0 == 1638
        # Codigo 1638 = versao mais nova ja instalada - OK
        Goto CleanupMSI
      ${EndIf}
      MessageBox MB_OK "Falha na instalacao do OpenVPN (codigo: $0). Por favor, instale manualmente a partir de https://openvpn.net/community-downloads/"
    ${EndIf}

  CleanupMSI:
    Delete "$TEMP\OpenVPN.msi"
    Goto OpenVPNDone

  OpenVPNAlreadyInstalled:
    DetailPrint "OpenVPN ja esta instalado - ignorando instalacao."

  OpenVPNDone:
!macroend
