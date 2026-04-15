!macro customInstall
  # Verificar se OpenVPN já está instalado
  IfFileExists "$PROGRAMFILES64\OpenVPN\bin\openvpn.exe" OpenVPNAlreadyInstalled 0
  IfFileExists "$PROGRAMFILES\OpenVPN\bin\openvpn.exe" OpenVPNAlreadyInstalled 0

  # OpenVPN não encontrado - extrair MSI embutido no próprio instalador
  # Isso garante que o arquivo faça parte do EXE final do NSIS.
  Goto InstallOpenVPN

  InstallOpenVPN:
    SetOutPath "$PLUGINSDIR"
    File "/oname=OpenVPN.msi" "${BUILD_RESOURCES_DIR}\OpenVPN-2.7_rc2-I009-amd64.msi"

  DoInstall:
    # Instalar OpenVPN com privilégios elevados e aguardar conclusão
    ExecWait '"msiexec" /i "$PLUGINSDIR\OpenVPN.msi" /qn /norestart ADDLOCAL=OpenVPN.Service,Drivers.OvpnDco,Drivers.TAPWindows6,Drivers.Wintun' $0

    ${If} $0 != 0
      ${If} $0 == 1638
        # Código 1638 = versão mais nova já instalada — OK
        Goto CleanupMSI
      ${EndIf}
      MessageBox MB_OK "Falha na instalação do OpenVPN (código: $0). Por favor, instale manualmente a partir de https://openvpn.net/community-downloads/"
    ${EndIf}

  CleanupMSI:
    Delete "$PLUGINSDIR\OpenVPN.msi"
    Goto OpenVPNDone

  OpenVPNAlreadyInstalled:
    DetailPrint "OpenVPN já está instalado — ignorando instalação."

  OpenVPNDone:
!macroend
