    // Minimizar janela (minimize to taskbar)
    const minimizeBtn = document.getElementById('minimizeBtn');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', async () => {
            try {
                await window.electronAPI.minimizeWindow();
                console.log('✅ Janela minimizada para barra de tarefas');
            } catch (error) {
                console.error('❌ Erro ao minimizar:', error);
            }
        });
        console.log('✅ Event listener adicionado ao minimizeBtn');
    } else {
        console.log('ℹ️ minimizeBtn não encontrado');
    }

    // Minimizar para tray
    const minimizeToTrayBtn = document.getElementById('minimizeToTrayBtn');
    if (minimizeToTrayBtn) {
        minimizeToTrayBtn.addEventListener('click', async () => {
            try {
                await window.electronAPI.minimizeToTray();
                console.log('✅ Janela minimizada para tray');
            } catch (error) {
                console.error('❌ Erro ao minimizar para tray:', error);
            }
        });
        console.log('✅ Event listener adicionado ao minimizeToTrayBtn');
    } else {
        console.log('ℹ️ minimizeToTrayBtn não encontrado');
    }