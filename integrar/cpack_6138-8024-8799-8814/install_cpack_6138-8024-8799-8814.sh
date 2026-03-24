#!/bin/sh
# apply patch 6138-8024-8799-8814

# Checa versão base para atualizar
#if [ "$(/usr/bin/cut -c1-5 /etc/version)" != '6.0.0' -a "$(/usr/bin/cut -c1-5 /etc/version)" != '7.0.0' ]
#then
#    echo 'Current version does not allow updating'
#    exit 1
#fi

#---------------------------------------------------------------------------
# Check version CP - only check if >= 0.3.3.0
#---------------------------------------------------------------------------
current_ver=$(cat /etc/cpack_install | cut -c1-7)
required_ver="0.3.3.0"

if [ "$(echo -e "$current_ver\n$required_ver" | sort -V | head -n1)" != "$required_ver" ]; then
    echo "Current cpack version: $current_ver (required >= $required_ver)"
fi
#---------------------------------------------------------------------------


# Prepara diretório do bkp
dir_update="/usr/local/share/BluePexUTM/tmp_pack/cpack_6138-8024-8799-8814"
version=$(cat /etc/version)
dir="/etc/bkp-${version}-cpack_6138-8024-8799-8814"
mkdir -p "${dir}"
restore_file="$dir/restore_file"

# Caso necessite, criar caminho dos arquivos
create_path_files() {
    file_target=$1
    if [ ! -e "${file_target}" ]
    then
        dir_path=$(dirname $file_target)
        mkdir -p "${dir_path}"
    fi
}

create_path_files_bk() {
    dir_bkp=$1
    file_target=$2
    if [ ! -e "$dir_bkp/$file_target" ]
    then
        dir_path=$(dirname $dir_bkp/$file_target)
        mkdir -p "${dir_path}"
    fi
}

# Acao de instalacao de arquivo com patches
#install_patches() {
#    patch_file=$1
#    /usr/bin/patch --directory='/' -t -i "/usr/local/pkg/patches/${patch_file}.patch" --forward --ignore-whitespace
#}

create_restore_cp() {
    file_to_restore=$1
    file_in_bkp_path=$2

    echo "if [ ! -e $file_to_restore ]" >> $restore_file
    echo "then" >> $restore_file
    echo "    mkdir -p $(dirname $file_to_restore)" >> $restore_file
    echo "fi" >> $restore_file
    echo "chmod 000 $file_to_restore" >> $restore_file
    echo "cp $file_in_bkp_path $file_to_restore" >> $restore_file
    echo "chmod $(ls -l $file_in_bkp_path | awk '{print $1}' | sed 's/-/+/g') $file_to_restore" >> $restore_file
    echo "echo \"Restore ${file_to_restore}\"" >> $restore_file
    echo "" >> $restore_file
}

# Acao de copia de arquivo -> CP Base
# $1 => Arquivo | $2 => Permitir fazer bkp do arquivo
install_cpack() {
    file_target=$1
    bk_file=$2
    if [ "${bk_file}" = "bk" ]
    then
        if [ -e "${file_target}" ]
        then
            create_path_files_bk "${dir}" "${file_target}"
	    if [ ! -e "${dir}${file_target}" ]
	    then
                cp "${file_target}" "${dir}${file_target}"
                create_restore_cp "${file_target}" "${dir}${file_target}"
            fi
        fi
    fi
    create_path_files "$file_target"
    cp -f "${dir_update}${file_target}" "${file_target}"
}

install_shell_action() {
    taget_exec=$1
    if [ -e "${dir_update}${taget_exec}" ]
    then
        chmod +x "${dir_update}${taget_exec}"
        /bin/sh "${dir_update}${taget_exec}"
    fi
}

# Copiar patches e manifest atualização
#if [ ! -e /usr/local/pkg/patches/ ]
#then
#    mkdir -p /usr/local/pkg/patches/
#fi
#cp -rf "${dir_update}"/patches/* /usr/local/pkg/patches/

### Copiar os arquivos gerais do cpack
### Patch Hash #27dd8f135
### Patch Desc #6138 -> chore. Addition of initial states for per-user report adjustments. Implements
install_cpack "/etc/inc/dataclick_report.inc" "bk"
install_cpack "/usr/local/www/dataclick-web/application/views/dashboard.php" "bk"
install_cpack "/usr/local/www/dataclick-web/application/views/reports.php" "bk"
install_cpack "/usr/local/www/dataclick-web/public/js/dashboard.js" "bk"

### Patch Hash #29f39f9d0
### Patch Desc #6138 -> feat. Added page redirection mechanism for generating reports. Fix
install_cpack "/etc/inc/dataclick_report.inc" "bk"
install_cpack "/usr/local/www/dataclick-web/application/views/dashboard.php" "bk"
install_cpack "/usr/local/www/dataclick-web/application/views/reports.php" "bk"
install_cpack "/usr/local/www/dataclick-web/public/js/dashboard.js" "bk"

### Patch Hash #386338ba7
### Patch Desc #8024 -> chore. Added initial states for dataclick top adjustments. Implements
install_cpack "/usr/local/etc/webfilter/webfilter.py" "bk"

### Patch Hash #0c5b1905d
### Patch Desc #8024 -> feat. Population mechanism and population location adjustments. Fix
install_cpack "/etc/inc/dataclick_report.inc" "bk"
install_cpack "/usr/local/etc/webfilter/webfilter.py" "bk"

### Patch Hash #407888da7
### Patch Desc #8024 -> feat. Syntax adjustments and delemiter error. Fix
install_cpack "/etc/inc/dataclick_report.inc" "bk"

### Patch Hash #58650a5f6
### Patch Desc #8799 -> chore. Initial states for EntraID adjustments. Implements
install_cpack "/usr/local/pkg/squid.inc" "bk"
install_cpack "/usr/local/www/entraid_saml/callback.php" "bk"
install_cpack "/usr/local/www/entraid_saml/http/auth/valid.php" "bk"
install_cpack "/usr/local/www/entraid_saml/http/index.php" "bk"
install_cpack "/usr/local/www/entraid_saml/signup.php" "bk"
install_cpack "/usr/local/www/webfilter/wf_server_edit.php" "bk"

### Patch Hash #46416a4b9
### Patch Desc #8799 -> feat. New web interface for EntraID. Fix
install_cpack "/etc/inc/entraid_config.inc" "bk"
install_cpack "/etc/inc/entraid_error_handling.inc" "bk"
install_cpack "/etc/inc/openvpn.inc" "bk"
install_cpack "/usr/local/pkg/squid.inc" "bk"
install_cpack "/usr/local/www/wizards/openvpn_wizard.inc" "bk"
install_cpack "/usr/local/www/wizards/openvpn_wizard.xml" "bk"
install_cpack "/usr/local/www/vpn_openvpn_server.php" "bk"
install_cpack "/usr/local/www/entraid_saml/callback.php" "bk"
install_cpack "/usr/local/www/entraid_saml/css/style.css" "bk"
install_cpack "/usr/local/www/entraid_saml/entraid_active_session.php" "bk"
install_cpack "/usr/local/www/entraid_saml/entraid_error.php" "bk"
install_cpack "/usr/local/www/entraid_saml/entraid_footer.php" "bk"
install_cpack "/usr/local/www/entraid_saml/entraid_header.php" "bk"
install_cpack "/usr/local/www/entraid_saml/entraid_logout.php" "bk"
install_cpack "/usr/local/www/entraid_saml/http/auth/valid.php" "bk"
install_cpack "/usr/local/www/entraid_saml/http/index.php" "bk"
install_cpack "/usr/local/www/entraid_saml/index.html" "bk"
install_cpack "/usr/local/www/entraid_saml/signup.php" "bk"
install_cpack "/usr/local/www/webfilter/delete_user.php" "bk"
install_cpack "/usr/local/www/webfilter/users_entraid.php" "bk"
install_cpack "/usr/local/www/webfilter/wf_server_edit.php" "bk"


### Copy binaries files
### Patch Hash #e186c58e0
### Patch Desc #8799 -> chore. Initial state of term files to webfilter. Implements
install_cpack "/usr/local/share/locale/pt_BR/LC_MESSAGES/BluePexWebFilter.po" "bk"
install_cpack "/usr/local/share/locale/pt_BR/LC_MESSAGES/BluePexWebFilter.mo" "bk"

### Patch Hash #3ffab56c6
### Patch Desc #8799 -> chore. Adding webfilter terms. Fix
install_cpack "/usr/local/share/locale/pt_BR/LC_MESSAGES/BluePexWebFilter.po" "bk"
install_cpack "/usr/local/share/locale/pt_BR/LC_MESSAGES/BluePexWebFilter.mo" "bk"


### Run the installation files
### Patch Hash #0c377d6c4
### Patch Desc #8024 -> chore. Recreate the dataclick tops procedure. Fix
install_shell_action "/extra/apply_new_procedure.sh"

### Patch Hash #7fa7f97e7
### Patch Desc #8024 -> chore. Restart the wfrotated process. Fix
install_shell_action "/extra/restart_wfrotated.sh"

### Patch Hash #7361279f8
### Patch Desc #8799 -> chore. shell for recreating the EntraID db with new valid schema. Fix
install_shell_action "/extra/recreate_entraid_database.sh"

### Patch Hash #entraid-runtime-bin
### Patch Desc #8799/8814 -> fix. Ensure runtime auth scripts are actually installed (not only chmod). Fix
install_cpack "/usr/local/bin/on_connect.sh" "bk"
install_cpack "/usr/local/bin/on_disconnect.sh" "bk"
install_cpack "/usr/local/bin/verify_saml.sh" "bk"
install_cpack "/usr/local/bin/verify_saml.py" "bk"
install_cpack "/usr/local/sbin/test_azure_token.sh" "bk"
install_cpack "/usr/local/sbin/ovpn_auth_verify_unificado.sh" "bk"

### Run the installation files
### Patch Hash #entraid-runtime-bin
### Patch Desc #8799/8814 -> fix. Ensure runtime auth scripts are actually installed (not only chmod). Fix
install_cpack "/usr/local/bin/on_connect.sh" "bk"
install_cpack "/usr/local/bin/on_disconnect.sh" "bk"
install_cpack "/usr/local/bin/verify_saml.sh" "bk"
install_cpack "/usr/local/bin/verify_saml.py" "bk"
install_cpack "/usr/local/sbin/test_azure_token.sh" "bk"
install_cpack "/usr/local/sbin/ovpn_auth_verify_unificado.sh" "bk"

### Patch Hash #totp-2fa
### Patch Desc #8814 -> feat. Add TOTP 2FA validation scripts
install_cpack "/usr/local/bin/totp/verify_totp.py" "bk"
install_cpack "/usr/local/bin/totp/verify_totp.sh" "bk"
install_cpack "/usr/local/sbin/mfa_manage.sh" "bk"

### Run the installation files
### Patch Hash #eb1db4a92
### Patch Desc #8814 -> chore. Entry permissions. Fix
install_shell_action "/extra/permissions.sh"

### Patch Hash #totp-permissions
### Patch Desc #8814 -> chore. Set TOTP directory and Python dependencies
install_shell_action "/extra/totp_setup.sh"
