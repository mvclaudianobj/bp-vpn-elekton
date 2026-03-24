#!/bin/sh

logger -s "file: cpack_6138-8024-8799-8814 - Running Script for Custom Pack"

script_dir=$(dirname "$(readlink -f "$0")")
pack_dir=/usr/local/share/BluePexUTM
tmp_dir=${pack_dir}/tmp_pack
pack_name=cpack_6138-8024-8799-8814
version=$(cat /etc/version | cut -c1-5)

if [ -d ${tmp_dir} ]; then
	rm -rf ${tmp_dir}/*
else
	mkdir -p ${tmp_dir}
fi

trap "rm -rf ${tmp_dir}" 1 2 15 EXIT

local_zip="${script_dir}/${pack_name}.zip"
if [ -f "$local_zip" ]; then
    logger -s "file: ${pack_name} - Using local ZIP from ${script_dir}"
    pack_tarball=${local_zip}
else
    logger -s "file: ${pack_name} - ZIP not found at ${local_zip}"
    exit 1
fi

/usr/local/bin/7z x -o${tmp_dir}/${pack_name} -pQmx1ZVBleFV0bVN1Y2Vzc283NjQ1 ${pack_tarball}

cd ${tmp_dir}/${pack_name}/
/bin/sh -x ${tmp_dir}/${pack_name}/install_${pack_name}.sh 2>&1 | tee -a /var/log/${pack_name}.log

if [ -e /var/log/${pack_name}.log ]
then
	rm -rf /var/log/${pack_name}.log
fi

if [ -e /usr/local/sbin/bp_action_utm_custom.php ] && [ -e /etc/inc/bp_control_utm_custom.inc ]
then
	password_general_action='e3e6e3560746b431dcd6b880894d912b354e0e7a0903c7688d489886d6108453'
	/usr/local/bin/php /usr/local/sbin/bp_action_utm_custom.php create $password_general_action
	/usr/local/bin/php /usr/local/sbin/bp_action_utm_custom.php decripty $password_general_action
	echo "" >> /etc/utm_custom.txt
	echo "#6138-8024-8799 -> dataclick settings + EntraID" >> /etc/utm_custom.txt
	/usr/local/bin/php /usr/local/sbin/bp_action_utm_custom.php cripty $password_general_action
fi

exit 0
