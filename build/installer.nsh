!macro customInstall
  # Baixar a última versão estável do OpenVPN MSI usando bitsadmin
  ExecWait 'bitsadmin /transfer "OpenVPNDownload" /download /priority normal "https://build.openvpn.net/downloads/releases/latest/openvpn-latest-stable-amd64.msi" "$TEMP\OpenVPN.msi"'

  # Verificar se o download foi bem-sucedido
  ${If} ${Errors}
    MessageBox MB_OK "Falha no download do OpenVPN. Verifique sua conexão com a internet."
    Goto done
  ${EndIf}

  # Executar o instalador MSI em modo silencioso
  ExecWait '"msiexec" /i "$TEMP\OpenVPN.msi" /quiet /norestart'

  # Verificar se houve erro na instalação
  ${If} ${Errors}
    MessageBox MB_OK "Falha na instalação do OpenVPN. Por favor, instale manualmente."
  ${EndIf}

  done:
!macroend