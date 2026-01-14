!macro customInstall
  # Baixar a última versão do OpenVPN MSI
  ExecWait 'powershell -Command "try { Invoke-WebRequest -Uri https://openvpn.net/downloads/OpenVPN-2.6.17-I001-amd64.msi -OutFile $TEMP\OpenVPN.msi -UseBasicParsing } catch { exit 1 }"'

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