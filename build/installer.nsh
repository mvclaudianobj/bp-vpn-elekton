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

  # Instalar OpenVPN com privilégios elevados e aguardar conclusão
  ExecWait '"msiexec" /i "$PLUGINSDIR\OpenVPN.msi" /qn /norestart ADDLOCAL=OpenVPN.Service,Drivers.OvpnDco,Drivers.TAPWindows6' $0
  DetailPrint "OpenVPN MSI (tentativa 1) retornou código: $0"

    ${If} $0 == 0
      Goto CleanupMSI
    ${EndIf}

    ${If} $0 == 1638
      # Código 1638 = versão mais nova já instalada — OK
      Goto CleanupMSI
    ${EndIf}

    ${If} $0 == 3010
      # Código 3010 = sucesso com reinicialização necessária
      DetailPrint "OpenVPN instalado com sucesso (reinicialização recomendada)."
      Goto CleanupMSI
    ${EndIf}

    ${If} $0 == 1641
      # Código 1641 = sucesso e reinicialização iniciada/necessária
      DetailPrint "OpenVPN instalado com sucesso (reinicialização iniciada/necessária)."
      Goto CleanupMSI
    ${EndIf}

    IfFileExists "$PROGRAMFILES64\OpenVPN\bin\openvpn.exe" CleanupMSI 0
    IfFileExists "$PROGRAMFILES\OpenVPN\bin\openvpn.exe" CleanupMSI 0

    # Fallback técnico: tentar instalação sem ADDLOCAL para MSI com árvore de features diferente
    ExecWait '"msiexec" /i "$PLUGINSDIR\OpenVPN.msi" /qn /norestart' $1
    DetailPrint "OpenVPN MSI (tentativa 2, sem ADDLOCAL) retornou código: $1"

    ${If} $1 == 0
      Goto CleanupMSI
    ${EndIf}

    ${If} $1 == 1638
      Goto CleanupMSI
    ${EndIf}

    ${If} $1 == 3010
      DetailPrint "OpenVPN instalado com sucesso na tentativa 2 (reinicialização recomendada)."
      Goto CleanupMSI
    ${EndIf}

    ${If} $1 == 1641
      DetailPrint "OpenVPN instalado com sucesso na tentativa 2 (reinicialização iniciada/necessária)."
      Goto CleanupMSI
    ${EndIf}

    IfFileExists "$PROGRAMFILES64\OpenVPN\bin\openvpn.exe" CleanupMSI 0
    IfFileExists "$PROGRAMFILES\OpenVPN\bin\openvpn.exe" CleanupMSI 0

    MessageBox MB_OK "Falha na instalação do OpenVPN. Codigos retornados: tentativa 1 = $0, tentativa 2 = $1. Por favor, instale manualmente a partir de https://openvpn.net/community-downloads/"

  CleanupMSI:
    Delete "$PLUGINSDIR\OpenVPN.msi"
    Goto OpenVPNDone

  OpenVPNAlreadyInstalled:
    DetailPrint "OpenVPN já está instalado — ignorando instalação."

  OpenVPNDone:
!macroend
