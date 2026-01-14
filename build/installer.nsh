!macro customInstall
  # Extrair o MSI para um local temporário
  File /oname=$PLUGINSDIR\OpenVPN.msi "${BUILD_RESOURCES_DIR}\OpenVPN.msi"

  # Executar o instalador MSI em modo silencioso
  ExecWait '"msiexec" /i "$PLUGINSDIR\OpenVPN.msi" /quiet /norestart'

  # Verificar se houve erro
  ${If} ${Errors}
    MessageBox MB_OK "Falha na instalação do OpenVPN. Por favor, instale manualmente."
  ${EndIf}
!macroend