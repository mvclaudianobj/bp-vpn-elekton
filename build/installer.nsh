!macro customInstall
  # Extrair o MSI do OpenVPN bundled
  File /oname=$TEMP\OpenVPN.msi "${BUILD_RESOURCES_DIR}\OpenVPN-2.7_rc2-I009-amd64.msi"

  # Executar o instalador MSI em modo passivo (mostra progresso)
  ExecWait '"msiexec" /i "$TEMP\OpenVPN.msi" /passive /norestart'

  # Verificar se houve erro na instalação
  ${If} ${Errors}
    MessageBox MB_OK "Falha na instalação do OpenVPN. Por favor, instale manualmente."
  ${EndIf}
!macroend