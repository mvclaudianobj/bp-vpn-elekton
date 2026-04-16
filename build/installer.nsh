!macro customInstall
  # Verificar se OpenVPN já está instalado
  IfFileExists "$PROGRAMFILES64\OpenVPN\bin\openvpn.exe" OpenVPNAlreadyInstalled 0
  IfFileExists "$PROGRAMFILES\OpenVPN\bin\openvpn.exe" OpenVPNAlreadyInstalled 0

  # OpenVPN não encontrado - extrair MSI embutido no próprio instalador
  # Isso garante que o arquivo faça parte do EXE final do NSIS.
  Goto InstallOpenVPN

  InstallOpenVPN:
    SetOutPath "$TEMP"
    File "/oname=$TEMP\OpenVPN.msi" "${BUILD_RESOURCES_DIR}\OpenVPN-2.7_rc2-I009-amd64.msi"

  # Método das versões 0.1.4/0.1.5: instalar MSI bundled em modo passivo
  # (sem ADDLOCAL), mantendo fluxo totalmente offline.
  ExecWait '"msiexec" /i "$TEMP\OpenVPN.msi" /passive /norestart' $0
  DetailPrint "OpenVPN MSI (metodo legado /passive) retornou codigo: $0"

    ${If} $0 == 0
      Goto CleanupMSI
    ${EndIf}

    ${If} $0 == 1638
      # 1638 = versao mais nova ja instalada
      Goto CleanupMSI
    ${EndIf}

    ${If} $0 == 3010
      DetailPrint "OpenVPN instalado com sucesso (reinicializacao recomendada)."
      Goto CleanupMSI
    ${EndIf}

    ${If} $0 == 1641
      DetailPrint "OpenVPN instalado com sucesso (reinicializacao iniciada/necessaria)."
      Goto CleanupMSI
    ${EndIf}

    IfFileExists "$PROGRAMFILES64\OpenVPN\bin\openvpn.exe" CleanupMSI 0
    IfFileExists "$PROGRAMFILES\OpenVPN\bin\openvpn.exe" CleanupMSI 0

    # Fallback tecnico offline: repetir em modo silencioso sem UI
    ExecWait '"msiexec" /i "$TEMP\OpenVPN.msi" /qn /norestart' $1
    DetailPrint "OpenVPN MSI (tentativa 2 /qn) retornou codigo: $1"

    ${If} $1 == 0
      Goto CleanupMSI
    ${EndIf}

    ${If} $1 == 1638
      Goto CleanupMSI
    ${EndIf}

    ${If} $1 == 3010
      DetailPrint "OpenVPN instalado com sucesso na tentativa 2 (reinicializacao recomendada)."
      Goto CleanupMSI
    ${EndIf}

    ${If} $1 == 1641
      DetailPrint "OpenVPN instalado com sucesso na tentativa 2 (reinicializacao iniciada/necessaria)."
      Goto CleanupMSI
    ${EndIf}

    IfFileExists "$PROGRAMFILES64\OpenVPN\bin\openvpn.exe" CleanupMSI 0
    IfFileExists "$PROGRAMFILES\OpenVPN\bin\openvpn.exe" CleanupMSI 0

    MessageBox MB_OK "Falha na instalacao offline do OpenVPN embutido. Metodo legado (/passive) retornou: $0. Tentativa silenciosa (/qn) retornou: $1."

  CleanupMSI:
    Delete "$TEMP\OpenVPN.msi"
    Goto OpenVPNDone

  OpenVPNAlreadyInstalled:
    DetailPrint "OpenVPN já está instalado — ignorando instalação."

  OpenVPNDone:
!macroend
