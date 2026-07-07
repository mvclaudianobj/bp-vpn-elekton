>>> Launching rc.local in background...
<?php
/*
 * vpn_openvpn_export.php
 *
 * part of pfSense (https://www.pfsense.org)
 * Copyright (c) 2011-2022 Rubicon Communications, LLC (Netgate)
 * Copyright (C) 2008 Shrew Soft Inc
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified by Allan Vilas Boas <vilas.allan@bluepex.com>, 2026
 */

require_once("globals.inc");
require_once("guiconfig.inc");
require_once("openvpn-client-export.inc");
require_once("pfsense-utils.inc");
require_once("pkg-utils.inc");
require_once("classes/Form.class.php");
require_once("bp_auditing.inc");
require_once("bp_endpoints.inc");
require_once("entraid_config.inc");

if (!function_exists('bluepex_env_map')) {
	function bluepex_env_map() {
		$path = '/usr/local/bin/.env';
		$map = array();
		if (!file_exists($path) || !is_readable($path)) {
			return $map;
		}
		$lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
		if (!is_array($lines)) {
			return $map;
		}
		foreach ($lines as $line) {
			$line = trim($line);
			if ($line === '' || strpos($line, '#') === 0) {
				continue;
			}
			$parts = explode('=', $line, 2);
			if (count($parts) !== 2) {
				continue;
			}
			$k = trim($parts[0]);
			$v = trim($parts[1]);
			if ($k !== '') {
				$map[$k] = $v;
			}
		}
		return $map;
	}
}

if (!function_exists('bluepex_tenant_from_authority')) {
	function bluepex_tenant_from_authority($authority) {
		$authority = trim((string)$authority);
		if ($authority === '') {
			return '';
		}
		$parts = explode('/', rtrim($authority, '/'));
		return trim(end($parts));
	}
}

if (!function_exists('bluepex_is_entraid_server')) {
	function bluepex_is_entraid_server($server) {
		global $config;

		if (!isset($config['system']['authserver'])) {
			return false;
		}

		$authservers_raw = $config['system']['authserver'];
		$authservers = array();

		/*
		 * BluePexUTM can load authserver in two formats:
		 * 1) List: [0 => ['name'=>..., 'type'=>...], ...]
		 * 2) Single object: ['name'=>..., 'type'=>...]
		 */
		if (is_array($authservers_raw) && isset($authservers_raw['name'])) {
			$authservers[] = $authservers_raw;
		} elseif (is_array($authservers_raw)) {
			foreach ($authservers_raw as $entry) {
				if (is_array($entry)) {
					$authservers[] = $entry;
				}
			}
		}

		if (empty($authservers)) {
			return false;
		}

		$is_entra_type = function($type_value) {
			return !empty($type_value) && strtolower(trim((string)$type_value)) === 'entraid';
		};

		$auth_server_candidates = array();
		$possible_fields = array('authserver', 'auth_server', 'authmode', 'auth_mode');
		foreach ($possible_fields as $f) {
			if (!empty($server[$f])) {
				$val = trim((string)$server[$f]);
				if ($val !== '' && strtolower($val) !== 'local database') {
					$auth_server_candidates[] = $val;
				}
			}
		}

		$auth_server_candidates = array_values(array_unique($auth_server_candidates));

		if (empty($auth_server_candidates)) {
			return false;
		}

		if (function_exists('auth_get_authserver')) {
			foreach ($auth_server_candidates as $candidate) {
				$as = auth_get_authserver($candidate);
				if (is_array($as)) {
					$type = isset($as['type']) ? trim((string)$as['type']) : '';
					if ($is_entra_type($type)) {
						return true;
					}
				}
			}
		}

		if (in_array(get_entraid_server_name(), $auth_server_candidates, true)) {
			return true;
		}

		foreach ($authservers as $as) {
			$name = isset($as['name']) ? trim((string)$as['name']) : '';
			$type = isset($as['type']) ? trim((string)$as['type']) : '';
			if ($name !== '' && in_array($name, $auth_server_candidates, true) && $is_entra_type($type)) {
				return true;
			}
		}

		return false;
	}
}

if (!function_exists('bluepex_build_azure_tags')) {
	function bluepex_build_azure_tags() {
		$env = bluepex_env_map();

		$client_id = trim((string)($env['CLIENT_ID'] ?? ''));
		$tenant_id = trim((string)($env['TENANT_ID'] ?? ''));
		if ($tenant_id === '' && !empty($env['AUTHORITY'])) {
			$tenant_id = bluepex_tenant_from_authority($env['AUTHORITY']);
		}

		$scope = trim((string)($env['SCOPE'] ?? 'https://graph.microsoft.com/.default openid profile offline_access'));

		$server_api = trim((string)($env['SERVER_API'] ?? ''));
		if ($server_api === '' && !empty($env['FASTAPI_SERVER'])) {
			$server_api = rtrim(trim((string)$env['FASTAPI_SERVER']), '/') . '/publish';
		}
		if ($server_api === '') {
			$server_api = BP_WSUTM_FASTAPI . '/publish';
		}

		if ($client_id === '' || $tenant_id === '') {
			return '';
		}

		$tags = "#AZURE:client_id={$client_id}\n";
		$tags .= "#AZURE:tenant_id={$tenant_id}\n";
		$tags .= "#AZURE:scope={$scope}\n";
		$tags .= "#AZURE:server_api={$server_api}\n";

		return $tags;
	}
}

if (!function_exists('bluepex_append_azure_tags_to_ovpn')) {
	function bluepex_append_azure_tags_to_ovpn($ovpn, $server_cfg) {
		if (!is_string($ovpn) || $ovpn === '') {
			return $ovpn;
		}
		if (!bluepex_is_entraid_server($server_cfg)) {
			return $ovpn;
		}
		if (strpos($ovpn, '#AZURE:client_id=') !== false) {
			return $ovpn;
		}
		$tags = bluepex_build_azure_tags();
		if ($tags === '') {
			return $ovpn;
		}
		return rtrim($ovpn, "\n") . "\n" . $tags;
	}
}

if (!function_exists('bluepex_append_azure_tags_to_zip')) {
	function bluepex_append_azure_tags_to_zip($zip_path, $server_cfg) {
		if (!is_string($zip_path) || $zip_path === '' || !file_exists($zip_path)) {
			return $zip_path;
		}
		if (!bluepex_is_entraid_server($server_cfg)) {
			return $zip_path;
		}

		$patched = false;

		if (class_exists('ZipArchive')) {
			$zip = new ZipArchive();
			$open_result = $zip->open($zip_path);
			if ($open_result === true) {
				for ($i = 0; $i < $zip->numFiles; $i++) {
					$entry_name = $zip->getNameIndex($i);
					if (!is_string($entry_name) || substr($entry_name, -1) === '/') {
						continue;
					}

					$content = $zip->getFromName($entry_name);
					if (!is_string($content) || $content === '') {
						continue;
					}

					$lower_name = strtolower($entry_name);
					$looks_like_ovpn_by_name = (substr($lower_name, -5) === '.ovpn' || substr($lower_name, -5) === '.conf');
					$looks_like_ovpn_by_content = (
						strpos($content, "\nclient\n") !== false ||
						strpos($content, "\nremote ") !== false ||
						strpos($content, "auth-user-pass") !== false ||
						strpos($content, "tls-client") !== false
					);

					if (!$looks_like_ovpn_by_name && !$looks_like_ovpn_by_content) {
						continue;
					}

					$updated = bluepex_append_azure_tags_to_ovpn($content, $server_cfg);
					if ($updated !== $content) {
						if ($zip->setFromName($entry_name, $updated) !== false) {
							$patched = true;
						}
					}
				}
				$zip->close();
			}
		}

		if ($patched) {
			return $zip_path;
		}

		$tmp_dir = sys_get_temp_dir() . '/bluepex_zip_' . uniqid('', true);
		@mkdir($tmp_dir, 0700, true);

		$unzip_cmd = '/usr/bin/unzip -oq ' . escapeshellarg($zip_path) . ' -d ' . escapeshellarg($tmp_dir);
		exec($unzip_cmd, $out1, $rc1);
		if ($rc1 !== 0) {
			exec('/bin/rm -rf ' . escapeshellarg($tmp_dir));
			return $zip_path;
		}

		$rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tmp_dir, FilesystemIterator::SKIP_DOTS));
		$changed = false;
		foreach ($rii as $file_info) {
			if (!$file_info->isFile()) {
				continue;
			}
			$path = $file_info->getPathname();
			$name = strtolower($file_info->getFilename());
			$content = @file_get_contents($path);
			if (!is_string($content) || $content === '') {
				continue;
			}

			$looks_like_ovpn_by_name = (substr($name, -5) === '.ovpn' || substr($name, -5) === '.conf');
			$looks_like_ovpn_by_content = (
				strpos($content, "\nclient\n") !== false ||
				strpos($content, "\nremote ") !== false ||
				strpos($content, "auth-user-pass") !== false ||
				strpos($content, "tls-client") !== false
			);

			if (!$looks_like_ovpn_by_name && !$looks_like_ovpn_by_content) {
				continue;
			}

			$updated = bluepex_append_azure_tags_to_ovpn($content, $server_cfg);
			if ($updated !== $content) {
				@file_put_contents($path, $updated);
				$changed = true;
			}
		}

		if ($changed) {
			$cwd = getcwd();
			chdir($tmp_dir);
			$zip_out = $zip_path . '.bluepex';
			$rc2 = 127;

			if (@is_executable('/usr/local/bin/zip')) {
				$zip_cmd = '/usr/local/bin/zip -rq ' . escapeshellarg($zip_out) . ' .';
				exec($zip_cmd, $out2, $rc2);
			}

			if ($rc2 !== 0 && @is_executable('/usr/bin/zip')) {
				$zip_cmd = '/usr/bin/zip -rq ' . escapeshellarg($zip_out) . ' .';
				exec($zip_cmd, $out2, $rc2);
			}

			if ($rc2 !== 0 && @is_executable('/usr/local/bin/7z')) {
				$zip_cmd = '/usr/local/bin/7z a -tzip ' . escapeshellarg($zip_out) . ' .';
				exec($zip_cmd, $out3, $rc3);
				$rc2 = $rc3;
			}

			chdir($cwd);
			if ($rc2 === 0 && file_exists($zip_out)) {
				@rename($zip_out, $zip_path);
			}
		}

		exec('/bin/rm -rf ' . escapeshellarg($tmp_dir));
		return $zip_path;
	}
}

global $current_openvpn_version, $current_openvpn_version_rev, $legacy_openvpn_version, $legacy_openvpn_version_rev, $dyndns_split_domain_types;

$pgtitle = array("OpenVPN", "Client Export Utility");

if (!is_array($config['openvpn'])) {
	$config['openvpn'] = array();
}

if (!is_array($config['openvpn']['openvpn-server'])) {
	$config['openvpn']['openvpn-server'] = array();
}

$a_server = $config['openvpn']['openvpn-server'];

if (!is_array($config['system']['user'])) {
	$config['system']['user'] = array();
}

$a_user = $config['system']['user'];

if (!is_array($config['cert'])) {
	$config['cert'] = array();
}

$a_cert = $config['cert'];

$ras_server = array();
foreach ($a_server as $server) {
	if (isset($server['disable'])) {
		continue;
	}
	$vpnid = $server['vpnid'];
	$ras_user = array();
	$ras_certs = array();
	if (stripos($server['mode'], "server") === false) {
		continue;
	}
	init_config_arr(array('cert'));
	$ecdsagood = array();
	foreach ($config['cert'] as $cert) {
		if (!empty($cert['prv']) && function_exists('cert_check_pkey_compatibility') &&
		    !cert_check_pkey_compatibility($cert['prv'], 'OpenVPN')) {
			continue;
		} else {
			$ecdsagood[] = $cert['refid'];
		}
	}

	if (($server['mode'] == "server_tls_user") && ($server['authmode'] == "Local Database")) {
		foreach ($a_user as $uindex => $user) {
			if (!is_array($user['cert'])) {
				continue;
			}
			foreach ($user['cert'] as $cindex => $cert) {
				// If $cert is not an array, it's a certref not a cert.
				if (!is_array($cert)) {
					$cert = lookup_cert($cert);
				}

				$purpose = cert_get_purpose($cert['crt']);
				if (($cert['caref'] != $server['caref']) ||
				    !in_array($cert['refid'], $ecdsagood) ||
				    ($purpose['server'] == 'Yes')) {
					continue;
				}
				$ras_userent = array();
				$ras_userent['uindex'] = $uindex;
				$ras_userent['cindex'] = $cindex;
				$ras_userent['name'] = $user['name'];
				$ras_userent['certname'] = $cert['descr'];
				$ras_userent['cert'] = $cert;
				$ras_user[] = $ras_userent;
			}
		}
	} elseif (($server['mode'] == "server_tls") ||
			(($server['mode'] == "server_tls_user") && ($server['authmode'] != "Local Database"))) {
		foreach ($a_cert as $cindex => $cert) {

			$purpose = cert_get_purpose($cert['crt']);
			if (($cert['caref'] != $server['caref']) ||
			    ($cert['refid'] == $server['certref']) ||
			    !in_array($cert['refid'], $ecdsagood) ||
			    ($purpose['server'] == 'Yes')) {
				continue;
			}
			$ras_cert_entry['cindex'] = $cindex;
			$ras_cert_entry['certname'] = $cert['descr'];
			$ras_cert_entry['certref'] = $cert['refid'];
			$ras_certs[] = $ras_cert_entry;
		}
	}

	$ras_serverent = array();
	$prot = $server['protocol'];
	$port = $server['local_port'];
	if ($server['description']) {
		$name = "{$server['description']} {$prot}:{$port}";
	} else {
		$name = "Server {$prot}:{$port}";
	}
	$ras_serverent['index'] = $vpnid;
	$ras_serverent['name'] = $name;
	$ras_serverent['users'] = $ras_user;
	$ras_serverent['certs'] = $ras_certs;
	$ras_serverent['mode'] = $server['mode'];
	$ras_serverent['crlref'] = $server['crlref'];
	$ras_serverent['authmode'] = $server['authmode'] != "Local Database" ? 'other' : 'local';
	$ras_server[$vpnid] = $ras_serverent;
}

$id = $_POST['id'];
$act = $_POST['act'];

global $simplefields;
$simplefields = array('server','useaddr','useaddr_hostname','verifyservercn','blockoutsidedns','legacy','bindmode',
	'usepkcs11','pkcs11providers',
	'usetoken','usepass',
	'useproxy','useproxytype','proxyaddr','proxyport', 'silent','useproxypass','proxyuser');
	//'pass','proxypass','advancedoptions'

$openvpnexportcfg = &$config['installedpackages']['vpn_openvpn_export'];
$ovpnserverdefaults = &$openvpnexportcfg['serverconfig']['item'];
$cfg = &$config['installedpackages']['vpn_openvpn_export']['defaultsettings'];
if (!is_array($ovpnserverdefaults)) {
	$ovpnserverdefaults = array();
}

if (isset($_POST['save'])) {
	$vpnid = $_POST['server'];
	$index = count($ovpnserverdefaults);
	foreach($ovpnserverdefaults as $key => $cfg) {
		if ($cfg['server'] == $vpnid) {
			$index = $key;
			break;
		}
	}
	$cfg = &$ovpnserverdefaults[$index];
	if (!is_array($cfg)) {
		$cfg = array();
	}
	if ($_POST['pass'] <> DMYPWD) {
		if ($_POST['pass'] <> $_POST['pass_confirm']) {
			$input_errors[] = "Different certificate passwords entered.";
		}
		$cfg['pass'] = $_POST['pass'];
	}
	if ($_POST['proxypass'] <> DMYPWD) {
		if ($_POST['proxypass'] <> $_POST['proxypass_confirm']) {
			$input_errors[] = "Different Proxy passwords entered.";
		}
		$cfg['proxypass'] = $_POST['proxypass'];
	}

	foreach ($simplefields as $value) {
		$cfg[$value] = $_POST[$value];
	}
	$cfg['advancedoptions'] = base64_encode($_POST['advancedoptions']);
	if (empty($input_errors)) {
		write_config("Save openvpn client export defaults");
	}
}

for($i = 0; $i < count($ovpnserverdefaults); $i++) {
	$ovpnserverdefaults[$i]['advancedoptions'] = base64_decode($ovpnserverdefaults[$i]['advancedoptions']);
}

if (!empty($act)) {

	$srvid = $_POST['srvid'];
	$usrid = $_POST['usrid'];
	$crtid = $_POST['crtid'];
	$srvcfg = get_openvpnserver_by_id($srvid);
	if ($srvid === false) {
		pfSenseHeader("vpn_openvpn_export.php");
		exit;
	} else if (($srvcfg['mode'] != "server_user") &&
		(($usrid === false) || ($crtid === false))) {
		pfSenseHeader("vpn_openvpn_export.php");
		exit;
	}

	if ($srvcfg['mode'] == "server_user") {
		$nokeys = true;
	} else {
		$nokeys = false;
	}

	$useaddr = '';
	if (isset($_POST['useaddr']) && !empty($_POST['useaddr'])) {
		$useaddr = trim($_POST['useaddr']);
	}

	if (!(is_ipaddr($useaddr) || is_hostname($useaddr) ||
		in_array($useaddr, array("serveraddr", "servermagic", "servermagichost", "serverhostname")))) {
		$input_errors[] = "An IP address or hostname must be specified.";
	}

	$advancedoptions = $_POST['advancedoptions'];

	$verifyservercn = $_POST['verifyservercn'];
	$blockoutsidedns = $_POST['blockoutsidedns'];
	$legacy = $_POST['legacy'];
	$silent = $_POST['silent'];
	$bindmode = $_POST['bindmode'];
	$usetoken = $_POST['usetoken'];
	if ($usetoken && (substr($act, 0, 10) == "confinline")) {
		$input_errors[] = "Microsoft Certificate Storage cannot be used with an Inline configuration.";
	}
	if ($usetoken && (($act == "conf_yealink_t28") || ($act == "conf_yealink_t38g") || ($act == "conf_yealink_t38g2") || ($act == "conf_snom"))) {
		$input_errors[] = "Microsoft Certificate Storage cannot be used with a Yealink or SNOM configuration.";
	}
	$usepkcs11 = $_POST['usepkcs11'];
	$pkcs11providers = $_POST['pkcs11providers'];
	if ($usepkcs11 && !$pkcs11providers) {
		$input_errors[] = "You must provide the PKCS#11 providers.";
	}
	$pkcs11id = $_POST['pkcs11id'];
	if ($usepkcs11 && !$pkcs11id) {
		$input_errors[] = "You must provide the PKCS#11 ID.";
	}
	$password = "";
	if ($_POST['password']) {
		if ($_POST['password'] != DMYPWD) {
			$password = $_POST['password'];
		} else {
			$password = $cfg['pass'];
		}
	}
	if (($srvcfg['mode'] == "server_tls_user") && ($settings['authmode'] == "Local Database")) {
		$cert = $user['cert'][$crtid];
	} else {
		$cert = $config['cert'][$crtid];
	}
	if (($srvcfg['mode'] != "server_user") && !$usepkcs11 && !$usetoken && empty($cert['prv'])) {
		$input_errors[] = "A private key cannot be empty if PKCS#11 or Microsoft Certificate Storage is not used.";
	}

	$proxy = "";
	if (!empty($_POST['proxy_addr']) || !empty($_POST['proxy_port'])) {
		$proxy = array();
		if (empty($_POST['proxy_addr'])) {
			$input_errors[] = "An address for the proxy must be specified.";
		} else {
			$proxy['ip'] = $_POST['proxy_addr'];
		}
		if (empty($_POST['proxy_port'])) {
			$input_errors[] = "A port for the proxy must be specified.";
		} else {
			$proxy['port'] = $_POST['proxy_port'];
		}
		$proxy['proxy_type'] = $_POST['proxy_type'];
		$proxy['proxy_authtype'] = $_POST['proxy_authtype'];
		if ($_POST['proxy_authtype'] != "none") {
			if (empty($_POST['proxy_user'])) {
				$input_errors[] = "A username for the proxy configuration must be specified.";
			} else {
				$proxy['user'] = $_POST['proxy_user'];
			}
			if (!empty($_POST['proxy_user']) && empty($_POST['proxy_password'])) {
				$input_errors[] = "A password for the proxy user must be specified.";
			} else {
				if ($_POST['proxy_password'] != DMYPWD) {
					$proxy['password'] = $_POST['proxy_password'];
				} else {
					$proxy['password'] = $cfg['proxypass'];
				}
			}
		}
	}

	$exp_name = openvpn_client_export_prefix($srvid, $usrid, $crtid);

	if (substr($act, 0, 4) == "conf") {
		switch ($act) {
			case "confzip":
				$exp_name = urlencode($exp_name . "-config.zip");
				$expformat = "zip";
				break;
			case "conf_yealink_t28":
				$exp_name = urlencode("client.tar");
				$expformat = "yealink_t28";
				break;
			case "conf_yealink_t38g":
				$exp_name = urlencode("client.tar");
				$expformat = "yealink_t38g";
				break;
			case "conf_yealink_t38g2":
				$exp_name = urlencode("client.tar");
				$expformat = "yealink_t38g2";
				break;
			case "conf_snom":
				$exp_name = urlencode("vpnclient.tar");
				$expformat = "snom";
				break;
			case "confinline":
				$exp_name = urlencode($exp_name . "-config.ovpn");
				$expformat = "inline";
				break;
			case "confinlinedroid":
				$exp_name = urlencode($exp_name . "-android-config.ovpn");
				$expformat = "inlinedroid";
				break;
			case "confinlineios":
				$exp_name = urlencode($exp_name . "-ios-config.ovpn");
				$expformat = "inlineios";
				break;
			case "confinlinevisc":
				$exp_name = urlencode($exp_name . "-viscosity-config.ovpn");
				$expformat = "inlinevisc";
				break;
			default:
				$exp_name = urlencode($exp_name . "-config.ovpn");
				$expformat = "baseconf";
		}
		$exp_path = openvpn_client_export_config($srvid, $usrid, $crtid, $useaddr, $verifyservercn, $blockoutsidedns, $legacy, $bindmode, $usetoken, $nokeys, $proxy, $expformat, $password, false, false, $advancedoptions, $usepkcs11, $pkcs11providers, $pkcs11id);
	}

	if ($act == "visc") {
		$exp_name = urlencode($exp_name . "-Viscosity.visc.zip");
		$exp_path = viscosity_openvpn_client_config_exporter($srvid, $usrid, $crtid, $useaddr, $verifyservercn, $blockoutsidedns, $legacy, $bindmode, $usetoken, $password, $proxy, $advancedoptions, $usepkcs11, $pkcs11providers, $pkcs11id);
	}

	if (substr($act, 0, 4) == "inst") {
		$openvpn_version = substr($act, 5);
		$exp_name = "openvpn-{$exp_name}-install-";
		switch ($openvpn_version) {
			case "Win7":
				$legacy = true;
				$exp_name .= "{$legacy_openvpn_version}-I6{$legacy_openvpn_version_rev}-Win7.exe";
				break;
			case "Win10":
				$legacy = true;
				$exp_name .= "{$legacy_openvpn_version}-I6{$legacy_openvpn_version_rev}-Win10.exe";
				break;
			case "x86-msi":
				$exp_name .= "{$current_openvpn_version}-I6{$current_openvpn_version_rev}-x86.exe";
				break;
			case "x64-msi":
			default:
				$exp_name .= "{$current_openvpn_version}-I6{$current_openvpn_version_rev}-amd64.exe";
				break;
		}

		$exp_name = urlencode($exp_name);
		$exp_path = openvpn_client_export_installer($srvid, $usrid, $crtid, $useaddr, $verifyservercn, $blockoutsidedns, $legacy, $bindmode, $usetoken, $password, $proxy, $advancedoptions, substr($act, 5), $usepkcs11, $pkcs11providers, $pkcs11id, $silent);
	}

	/* pfSense 2.5.0 with OpenVPN 2.5.0 has ciphers not compatible with
	 * legacy clients, check for those and warn */
	if ($legacy && function_exists('openvpn_build_data_cipher_list')) {
		/* This will only be reached for pfSense 2.5.0 with OpenVPN 2.5.0 */
		global $legacy_incompatible_ciphers;
		$settings = get_openvpnserver_by_id($srvid);
		if (in_array($settings['data_ciphers_fallback'], $legacy_incompatible_ciphers)) {
			$input_errors[] = gettext("The Fallback Data Encryption Algorithm for the selected server is not compatible with Legacy clients.");
		}
	}

	if (!$exp_path) {
		$input_errors[] = "Failed to export config files!";
	}

	if (empty($input_errors)) {
		if ((($act == "conf") || (substr($act, 0, 10) == "confinline")) && is_string($exp_path)) {
			$exp_path = bluepex_append_azure_tags_to_ovpn($exp_path, $srvcfg);
		}
		if ($act == "confzip" && is_string($exp_path) && file_exists($exp_path)) {
			$exp_path = bluepex_append_azure_tags_to_zip($exp_path, $srvcfg);
		}

		if (($act == "conf") || (substr($act, 0, 10) == "confinline")) {
			$exp_size = strlen($exp_path);
		} else {
			$exp_size = filesize($exp_path);
		}
		header('Content-Description: File Transfer');
		header('Content-Type: application/octet-stream');
		header("Content-Disposition: attachment; filename=$exp_name");
		header('Content-Transfer-Encoding: binary');
		header('Expires: 0');
		header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
		header('Pragma: public');
		header("Content-Length: $exp_size");
		ob_clean();
		flush();

		if (($act == "conf") || (substr($act, 0, 10) == "confinline")) {
			echo $exp_path;
		} else {
			readfile($exp_path);
			@unlink($exp_path);
		}
		exit;
	}
}

include("head.inc");

if ($input_errors) {
	print_input_errors($input_errors);
}
if ($savemsg) {
	print_info_box($savemsg, 'success');
}
$tab_array = array();
$tab_array[] = array(dgettext("OpenVPNClientExport", "Server"), false, "vpn_openvpn_server.php");
$tab_array[] = array(dgettext("OpenVPNClientExport", "Client"), false, "vpn_openvpn_client.php");
$tab_array[] = array(dgettext("OpenVPNClientExport", "Client Specific Overrides"), false, "vpn_openvpn_csc.php");
$tab_array[] = array(dgettext("OpenVPNClientExport", "Wizards"), false, "wizard.php?xml=openvpn_wizard.xml");
add_package_tabs("OpenVPN", $tab_array);
foreach($tab_array as $key => $pages) {
	$tab_array[$key][0] = gettext($tab_array[$key][0]);
	if (str_replace("/", "", end($pages)) == str_replace("/", "", $_SERVER["PHP_SELF"])) {
		$tab_array[$key][1] = true;
	}
}
display_top_tabs($tab_array);

$form = new Form("Save as default");

$section = new Form_Section('OpenVPN Server');

$serverlist = array();
foreach ($ras_server as $server) {
	$serverlist[$server['index']] = $server['name'];
}

$section->addInput(new Form_Select(
	'server',
	'Remote Access Server',
	$cfg['server'],
	$serverlist
	));

$form->add($section);

$section = new Form_Section('Client Connection Behavior');

$useaddrlist = array(
	"serveraddr" => "Interface IP Address",
	"servermagic" => "Automagic Multi-WAN IPs (port forward targets)",
	"servermagichost" => "Automagic Multi-WAN DDNS Hostnames (port forward targets)",
	"serverhostname" => "Installation hostname"
);

if (is_array($config['dyndnses']['dyndns'])) {
	foreach ($config['dyndnses']['dyndns'] as $ddns) {
		if (in_array($ddns['type'], $dyndns_split_domain_types)) {
			$useaddrlist[$ddns["host"] . '.' . $ddns["domainname"]] = $ddns["host"] . '.' . $ddns["domainname"];
		} else {
			$useaddrlist[$ddns["host"]] = $ddns["host"];
		}
	}
}
if (is_array($config['dnsupdates']['dnsupdate'])) {
	foreach ($config['dnsupdates']['dnsupdate'] as $ddns) {
		$useaddrlist[$ddns["host"]] = $ddns["host"];
	}
}

$useaddrlist["other"] = "Other";

$section->addInput(new Form_Select(
	'useaddr',
	'Host Name Resolution',
	$cfg['useaddr'],
	$useaddrlist
	));

$section->addInput(new Form_Input(
	'useaddr_hostname',
	'Host Name',
	'text',
	$cfg['useaddr_hostname']
))->setHelp('Enter the hostname or IP address the client will use to connect to this server.');


$section->addInput(new Form_Select(
	'verifyservercn',
	'Verify Server CN',
	$cfg['verifyservercn'],
	array(
		"auto" => "Automatic - Use verify-x509-name where possible",
		"none" => "Do not verify the server CN")
))->setHelp("Optionally verify the server certificate Common Name (CN) when the client connects. ");

$section->addInput(new Form_Checkbox(
	'blockoutsidedns',
	'Block Outside DNS',
	'Block access to DNS servers except across OpenVPN while connected, forcing clients to use only VPN DNS servers.',
	$cfg['blockoutsidedns']
))->setHelp("Requires Windows 10 and OpenVPN 2.3.9 or later. Only Windows 10 is prone to DNS leakage in this way, other clients will ignore the option as they are not affected.");

$section->addInput(new Form_Checkbox(
	'legacy',
	'Legacy Client',
	'Do not include OpenVPN 2.5 settings in the client configuration.',
	$cfg['legacy']
))->setHelp("When using an older client (OpenVPN 2.4.x), check this option to prevent the exporter from placing known-incompatible settings into the client configuration.");

$section->addInput(new Form_Checkbox(
	'silent',
	'Silent Installer',
	'Create Windows installer for unattended deploy.',
	$cfg['silent']
))->setHelp("Create a silent Windows installer for unattended deploy; installer must be run with elevated permissions. Since this installer is not signed, you may need special software to deploy it correctly.");

$section->addInput(new Form_Select(
	'bindmode',
	'Bind Mode',
	$cfg['bindmode'],
	array(
		"nobind" => "Do not bind to the local port",
		"lport0" => "Use a random local source port",
		"bind" => "Bind to the default OpenVPN port")
))->setHelp("If OpenVPN client binds to the default OpenVPN port (1194), two clients may not run concurrently.");

$form->add($section);

$section = new Form_Section('Certificate Export Options');

$section->addInput(new Form_Checkbox(
	'usepkcs11',
	'PKCS#11 Certificate Storage',
	'Use PKCS#11 storage device (cryptographic token, HSM, smart card) instead of local files.',
	$cfg['usepkcs11']
));

$section->addInput(new Form_Input(
	'pkcs11providers',
	'PKCS#11 Providers',
	'text',
	$cfg['pkcs11providers']
))->setHelp('Enter the client local path to the PKCS#11 provider(s) (DLL, module), multiple separated by a space character.');

$section->addInput(new Form_Input(
	'pkcs11id',
	'PKCS#11 ID',
	'text'
))->setHelp('Enter the object\'s ID on the PKCS#11 device.');

$section->addInput(new Form_Checkbox(
	'usetoken',
	'Microsoft Certificate Storage',
	'Use Microsoft Certificate Storage instead of local files.',
	$cfg['usetoken']
));

$section->addInput(new Form_Checkbox(
	'usepass',
	'Password Protect Certificate',
	'Use a password to protect the pkcs12 file contents or key in Viscosity bundle.',
	$cfg['usepass']
));

$section->addPassword(new Form_Input(
	'pass',
	'Certificate Password',
	'password',
	$cfg['pass']
))->setHelp('Password used to protect the certificate file contents.');

$form->add($section);

$section = new Form_Section('Proxy Options');

$section->addInput(new Form_Checkbox(
	'useproxy',
	'Use A Proxy',
	'Use proxy to communicate with the OpenVPN server.',
	$cfg['useproxy']
));

$section->addInput(new Form_Select(
	'useproxytype',
	'Proxy Type',
	$cfg['useproxytype'],
	array(
		"http" => "HTTP",
		"socks" => "SOCKS")
));

$section->addInput(new Form_Input(
	'proxyaddr',
	'Proxy IP Address',
	'text',
	$cfg['proxyaddr']
))->setHelp('Hostname or IP address of proxy server.');

$section->addInput(new Form_Input(
	'proxyport',
	'Proxy Port',
	'text',
	$cfg['proxyport']
))->setHelp('Port where proxy server is listening.');

$section->addInput(new Form_Select(
	'useproxypass',
	'Proxy Authentication',
	$cfg['useproxypass'],
	array(
		"none" => "None",
		"basic" => "Basic",
		"ntlm" => "NTLM")
))->setHelp('Choose proxy authentication method, if any.');

$section->addInput(new Form_Input(
	'proxyuser',
	'Proxy Username',
	'text',
	$cfg['proxyuser']
))->setHelp('Username for authentication to proxy server.');

$section->addPassword(new Form_Input(
	'proxypass',
	'Proxy Password',
	'password',
	$cfg['proxypass']
))->setHelp('Password for authentication to proxy server.');
$form->add($section);

$section = new Form_Section('Advanced');

	$section->addInput(new Form_Textarea(
		'advancedoptions',
		'Additional configuration options',
		$cfg['advancedoptions']
	))->setHelp('Enter any additional options to add to the OpenVPN client export configuration here, separated by a line break or semicolon.<br/><br/>EXAMPLE: remote-random;');

$form->add($section);

print($form);
?>

<div class="panel panel-default" id="search-panel">
	<div class="panel-heading">
		<h2 class="panel-title">
			<?=gettext('Search')?>
			<span class="widget-heading-icon pull-right">
				<a data-toggle="collapse" href="#search-panel_panel-body">
					<i class="fa fa-plus-circle"></i>
				</a>
			</span>
		</h2>
	</div>
	<div id="search-panel_panel-body" class="panel-body collapse in">
		<div class="form-group">
			<label class="col-sm-2 control-label">
				<?=gettext("Search term")?>
			</label>
			<div class="col-sm-5"><input class="form-control" name="searchstr" id="searchstr" type="text"/></div>
			<div class="col-sm-3">
				<a id="btnsearch" title="<?=gettext("Search")?>" class="btn btn-primary btn-sm"><i class="fa fa-search icon-embed-btn"></i><?=gettext("Search")?></a>
				<a id="btnclear" title="<?=gettext("Clear")?>" class="btn btn-info btn-sm"><i class="fa fa-undo icon-embed-btn"></i><?=gettext("Clear")?></a>
			</div>
			<div class="col-sm-10 col-sm-offset-2">
				<span class="help-block"><?=gettext('Enter a search string or *nix regular expression to search.')?></span>
			</div>
		</div>
	</div>
</div>

<div class="panel panel-default">
	<div class="panel-heading"><h2 class="panel-title"><?=dgettext("OpenVPNClientExport", "OpenVPN Clients")?></h2></div>
	<div class="panel-body">
		<div class="table-responsive">
			<table class="table table-striped table-hover table-condensed" id="users">
				<thead>
					<tr>
						<td width="25%" class="listhdrr"><?=dgettext("OpenVPNClientExport", "User")?></td>
						<td width="35%" class="listhdrr"><?=dgettext("OpenVPNClientExport", "Certificate Name")?></td>
						<td width="40%" class="listhdrr"><?=dgettext("OpenVPNClientExport", "Export")?></td>
					</tr>
				</thead>
				<tbody>
				</tbody>
			</table>
		</div>
	</div>
</div>
<span class="help-block"><?=gettext('Only OpenVPN-compatible user certificates are shown')?>
<br />
<br />
<?= print_info_box(gettext("If a client is missing from the list it is likely due to a CA mismatch between the OpenVPN server instance and the client certificate, the client certificate does not exist on this firewall, or a user certificate is not associated with a user when local database authentication is enabled." .
"<br /><br />" .
"OpenVPN 2.4.8+ requires Windows 7 or later"), 'info', false); ?>

<?=gettext("Links to OpenVPN clients for various platforms:")?><br />
<br />
<a href="http://openvpn.net/index.php/open-source/downloads.html"><?= gettext("OpenVPN Community Client") ?></a> - <?=gettext("Binaries for Windows, Source for other platforms. Packaged above in the Windows Installers")?>
<br/><a href="https://play.google.com/store/apps/details?id=de.blinkt.openvpn"><?= gettext("OpenVPN For Android") ?></a> - <?=gettext("Recommended client for Android")?>
<br/><a href="http://www.featvpn.com/"><?= gettext("FEAT VPN For Android") ?></a> - <?=gettext("For older versions of Android")?>
<br/><?= gettext("OpenVPN Connect") ?>: <a href="https://play.google.com/store/apps/details?id=net.openvpn.openvpn"><?=gettext("Android (Google Play)")?></a> or <a href="https://itunes.apple.com/us/app/openvpn-connect/id590379981"><?=gettext("iOS (App Store)")?></a> - <?= gettext("Recommended client for iOS") ?>
<br/><a href="https://www.sparklabs.com/viscosity/"><?= gettext("Viscosity") ?></a> - <?= gettext("Recommended commercial client for Mac OS X and Windows") ?>
<br/><a href="https://tunnelblick.net"><?= gettext("Tunnelblick") ?></a> - <?= gettext("Free client for OS X") ?>
<br/><a href="https://community.openvpn.net/openvpn/wiki/OpenvpnSoftwareRepos"><?= gettext("Using the Latest OpenVPN on Linux Distros") ?></a> - <?= gettext("Install OpenVPN using the OpenVPN apt repositories to get the latest version, rather than one included with distributions.") ?>

<script type="text/javascript">
//<![CDATA[
var viscosityAvailable = false;

var servers = new Array();
<?php
foreach ($ras_server as $sindex => $server): ?>
servers[<?=$sindex?>] = new Array();
servers[<?=$sindex?>][0] = '<?=$server['index']?>';
servers[<?=$sindex?>][1] = new Array();
servers[<?=$sindex?>][2] = '<?=$server['mode']?>';
servers[<?=$sindex?>][3] = new Array();
servers[<?=$sindex?>][4] = '<?=$server['authmode']?>';
<?php
	$c=0;
	foreach ($server['users'] as $uindex => $user): ?>
<?php		if (!$server['crlref'] || !is_cert_revoked($user['cert'], $server['crlref'])): ?>
servers[<?=$sindex?>][1][<?=$c?>] = new Array();
servers[<?=$sindex?>][1][<?=$c?>][0] = '<?=$user['uindex']?>';
servers[<?=$sindex?>][1][<?=$c?>][1] = '<?=$user['cindex']?>';
servers[<?=$sindex?>][1][<?=$c?>][2] = '<?=$user['name']?>';
servers[<?=$sindex?>][1][<?=$c?>][3] = '<?=str_replace("'", "\\'", $user['certname'])?>';
<?php
			$c++;
		endif;
	endforeach;
	$c=0;
	foreach ($server['certs'] as $cert): ?>
<?php
		if (!$server['crlref'] || !is_cert_revoked($config['cert'][$cert['cindex']], $server['crlref'])): ?>
servers[<?=$sindex?>][3][<?=$c?>] = new Array();
servers[<?=$sindex?>][3][<?=$c?>][0] = '<?=$cert['cindex']?>';
servers[<?=$sindex?>][3][<?=$c?>][1] = '<?=str_replace("'", "\\'", $cert['certname'])?>';
<?php
			$c++;
		endif;
	endforeach;
endforeach;
?>

serverdefaults = <?=json_encode($ovpnserverdefaults)?>;

function make_form_variable(varname, varvalue) {
	var exportinput = document.createElement("input");
	exportinput.type = "hidden";
	exportinput.name = varname;
	exportinput.value = varvalue;
	return exportinput;
}

function download_begin(act, i, j) {
	var index = document.getElementById("server").value;
	var users = servers[index][1];
	var certs = servers[index][3];
	var useaddr;

	var advancedoptions;

	if (document.getElementById("useaddr").value == "other") {
		if (document.getElementById("useaddr_hostname").value == "") {
			alert("Please specify an IP address or hostname.");
			return;
		}
		useaddr = document.getElementById("useaddr_hostname").value;
	} else {
		useaddr = document.getElementById("useaddr").value;
	}

	advancedoptions = document.getElementById("advancedoptions").value;

	var verifyservercn;
	verifyservercn = document.getElementById("verifyservercn").value;

	var blockoutsidedns = 0;
	if (document.getElementById("blockoutsidedns").checked) {
		blockoutsidedns = 1;
	}
	var legacy = 0;
	if (document.getElementById("legacy").checked) {
		legacy = 1;
	}
	var silent = 0;
	if (document.getElementById("silent").checked) {
		silent = 1;
	}

	var bindmode = 0;
	bindmode = document.getElementById("bindmode").value;

	var usetoken = 0;
	if (document.getElementById("usetoken").checked) {
		usetoken = 1;
	}
	var usepkcs11 = 0;
	if (document.getElementById("usepkcs11").checked) {
		usepkcs11 = 1;
	}
	var silent = 0;
	if (document.getElementById("silent").checked) {
		silent = 1;
	}
	var pkcs11providers = document.getElementById("pkcs11providers").value;
	var pkcs11id = document.getElementById("pkcs11id").value;
	var usepass = 0;
	if (document.getElementById("usepass").checked) {
		usepass = 1;
	}

	var pass = document.getElementById("pass").value;
	var pass_confirm = document.getElementById("pass_confirm").value;
	if (usepass && (act.substring(0, 4) == "inst")) {
		if (!pass || !pass_confirm) {
			alert("The password or confirm field is empty");
			return;
		}
		if (pass != pass_confirm) {
			alert("The password and confirm fields must match");
			return;
		}
	}

	var useproxy = 0;
	var useproxypass = 0;
	if (document.getElementById("useproxy").checked) {
		useproxy = 1;
	}

	var proxyaddr = document.getElementById("proxyaddr").value;
	var proxyport = document.getElementById("proxyport").value;
	if (useproxy) {
		if (!proxyaddr || !proxyport) {
			alert("The proxy ip and port cannot be empty");
			return;
		}

		if (document.getElementById("useproxypass").value != 'none') {
			useproxypass = 1;
		}

		var proxytype = document.getElementById("useproxytype").value;

		var proxyauth = document.getElementById("useproxypass").value;
		var proxyuser = document.getElementById("proxyuser").value;
		var proxypass = document.getElementById("proxypass").value;
		var proxypass_confirm = document.getElementById("proxypass_confirm").value;
		if (useproxypass) {
			if (!proxyuser) {
				alert("Please fill the proxy username and password.");
				return;
			}
			if (!proxypass || !proxypass_confirm) {
				alert("The proxy password or confirm field is empty");
				return;
			}
			if (proxypass != proxypass_confirm) {
				alert("The proxy password and confirm fields must match");
				return;
			}
		}
	}

	var exportform = document.createElement("form");
	exportform.method = "POST";
	exportform.action = "/vpn_openvpn_export.php";
	exportform.target = "_self";
	exportform.style.display = "none";

	exportform.appendChild(make_form_variable("act", act));
	exportform.appendChild(make_form_variable("srvid", servers[index][0]));
	if (users[i]) {
		exportform.appendChild(make_form_variable("usrid", users[i][0]));
		exportform.appendChild(make_form_variable("crtid", users[i][1]));
	}
	if (certs[j]) {
		exportform.appendChild(make_form_variable("usrid", ""));
		exportform.appendChild(make_form_variable("crtid", certs[j][0]));
	}
	exportform.appendChild(make_form_variable("useaddr", useaddr));
	exportform.appendChild(make_form_variable("verifyservercn", verifyservercn));
	exportform.appendChild(make_form_variable("blockoutsidedns", blockoutsidedns));
	exportform.appendChild(make_form_variable("legacy", legacy));
	exportform.appendChild(make_form_variable("silent", silent));
	exportform.appendChild(make_form_variable("bindmode", bindmode));
	exportform.appendChild(make_form_variable("usetoken", usetoken));
	exportform.appendChild(make_form_variable("usepkcs11", usepkcs11));
	exportform.appendChild(make_form_variable("pkcs11providers", pkcs11providers));
	exportform.appendChild(make_form_variable("pkcs11id", pkcs11id));
	if (usepass) {
		exportform.appendChild(make_form_variable("password", pass));
	}
	if (useproxy) {
		exportform.appendChild(make_form_variable("proxy_type", proxytype));
		exportform.appendChild(make_form_variable("proxy_addr", proxyaddr));
		exportform.appendChild(make_form_variable("proxy_port", proxyport));
		exportform.appendChild(make_form_variable("proxy_authtype", proxyauth));
		if (useproxypass) {
			exportform.appendChild(make_form_variable("proxy_user", proxyuser));
			exportform.appendChild(make_form_variable("proxy_password", proxypass));
		}
	}
	exportform.appendChild(make_form_variable("advancedoptions", advancedoptions));

	exportform.appendChild(make_form_variable(csrfMagicName, csrfMagicToken));
	document.body.appendChild(exportform);
	exportform.submit();
}

function server_changed() {

	var table = document.getElementById("users");
	table = table.tBodies[0];

	while (table.rows.length > 0 ) {
		table.deleteRow(0);
	}

	function setFieldValue(field, value) {
		checkboxes = $("input[type=checkbox]#"+field);
		checkboxes.prop('checked', value == 'yes').trigger("change");

		inputboxes = $("input[type!=checkbox]#"+field);
		inputboxes.val(value);

		selectboxes = $("select#"+field);
		selectboxes.val(value);

		textareaboxes = $("textarea#"+field);
		textareaboxes.val(value);
	}

	var index = document.getElementById("server").value;
	for(i = 0; i < serverdefaults.length; i++) {
		if (serverdefaults[i]['server'] !== index) {
			continue;
		}
		fields = serverdefaults[i];
		fieldnames = Object.getOwnPropertyNames(fields);
		for (fieldnr = 0; fieldnr < fieldnames.length; fieldnr++) {
			fieldname = fieldnames[fieldnr];
			setFieldValue(fieldname, fields[fieldname]);
		}
		setFieldValue('pass_confirm', fields['pass']);
		setFieldValue('proxypass_confirm', fields['proxypass']);
		break;
	}


	var users = servers[index][1];
	var certs = servers[index][3];
	for (i = 0; i < users.length; i++) {
		var row = table.insertRow(table.rows.length);
		var cell0 = row.insertCell(0);
		var cell1 = row.insertCell(1);
		var cell2 = row.insertCell(2);
		cell0.className = "listlr";
		cell0.innerHTML = users[i][2];
		cell1.className = "listr";
		cell1.innerHTML = users[i][3];
		cell2.className = "listr";
		cell2.innerHTML = "- Inline Configurations:<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinline\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Most Clients<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlinedroid\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Android<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlineios\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> OpenVPN Connect (iOS/Android)<\/a>";
		cell2.innerHTML += "<br\/>- Bundled Configurations:<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confzip\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Archive<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"conf\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Config File Only<\/a>";
		cell2.innerHTML += "<br\/>- Current Windows Installers (<?=$current_openvpn_version . '-Ix' . $current_openvpn_version_rev?>):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-x64-msi\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 64-bit<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-x86-msi\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 32-bit<\/a>";
		cell2.innerHTML += "<br\/>- Legacy Windows Installers (<?=$legacy_openvpn_version . '-Ix' . $legacy_openvpn_version_rev?>):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-Win10\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 10/2016/2019<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-Win7\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 7/8/8.1/2012r2<\/a>";
		cell2.innerHTML += "<br\/>- Viscosity (Mac OS X and Windows):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"visc\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Viscosity Bundle<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlinevisc\"," + i + ", -1)' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Viscosity Inline Config<\/a>";
	}
	for (j = 0; j < certs.length; j++) {
		var row = table.insertRow(table.rows.length);
		var cell0 = row.insertCell(0);
		var cell1 = row.insertCell(1);
		var cell2 = row.insertCell(2);
		cell0.className = "listlr";
		if (servers[index][2] == "server_tls") {
			cell0.innerHTML = "Certificate (SSL/TLS, no Auth)";
		} else {
			cell0.innerHTML = "Certificate with External Auth";
		}
		cell1.className = "listr";
		cell1.innerHTML = certs[j][1];
		cell2.className = "listr";
		cell2.innerHTML = "- Inline Configurations:<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinline\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Most Clients<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlinedroid\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Android<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlineios\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> OpenVPN Connect (iOS/Android)<\/a>";
		cell2.innerHTML += "<br\/>- Bundled Configurations:<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confzip\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Archive<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"conf\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Config File Only<\/a>";
		cell2.innerHTML += "<br\/>- Current Windows Installer (<?=$current_openvpn_version . '-Ix' . $current_openvpn_version_rev?>):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-x64-msi\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 64-bit<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-x86-msi\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 32-bit<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<br\/>- Legacy Windows Installers (<?=$legacy_openvpn_version . '-Ix' . $legacy_openvpn_version_rev?>):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-Win10\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 10/2016/2019<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-Win7\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 7/8/8.1/2012r2<\/a>";
		cell2.innerHTML += "<br\/>- Viscosity (Mac OS X and Windows):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"visc\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Viscosity Bundle<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlinevisc\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Viscosity Inline Config<\/a>";
		if (servers[index][2] == "server_tls") {
			cell2.innerHTML += "<br\/>- Yealink SIP Handsets:<br\/>";
			cell2.innerHTML += "&nbsp;&nbsp; ";
			cell2.innerHTML += "<a href='javascript:download_begin(\"conf_yealink_t28\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> T28<\/a>";
			cell2.innerHTML += "&nbsp;&nbsp; ";
			cell2.innerHTML += "<a href='javascript:download_begin(\"conf_yealink_t38g\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> T38G (1)<\/a>";
			cell2.innerHTML += "&nbsp;&nbsp; ";
			cell2.innerHTML += "<a href='javascript:download_begin(\"conf_yealink_t38g2\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> T38G (2) / V83<\/a>";
			cell2.innerHTML += "<br\/>- Snom SIP Handsets:<br\/>";
			cell2.innerHTML += "&nbsp;&nbsp; ";
			cell2.innerHTML += "<a href='javascript:download_begin(\"conf_snom\", -1," + j + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> SNOM<\/a>";
		}
	}
	if (servers[index][2] == 'server_user') {
		var row = table.insertRow(table.rows.length);
		var cell0 = row.insertCell(0);
		var cell1 = row.insertCell(1);
		var cell2 = row.insertCell(2);
		cell0.className = "listlr";
		cell0.innerHTML = "Authentication Only (No Cert)";
		cell1.className = "listr";
		cell1.innerHTML = "none";
		cell2.className = "listr";
		cell2.innerHTML = "- Inline Configurations:<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinline\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Most Clients<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlinedroid\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Android<\a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlineios\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> OpenVPN Connect (iOS/Android)<\/a>";
		cell2.innerHTML += "<br\/>- Bundled Configurations:<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confzip\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Archive<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"conf\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Config File Only<\/a>";
		cell2.innerHTML += "<br\/>- Current Windows Installer (<?=$current_openvpn_version . '-Ix' . $current_openvpn_version_rev?>):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-x64-msi\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 64-bit<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-x86-msi\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 32-bit<\/a>";
		cell2.innerHTML += "<br\/>- Legacy Windows Installers (<?=$legacy_openvpn_version . '-Ix' . $legacy_openvpn_version_rev?>):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-Win10\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 10/2016/2019<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"inst-Win7\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> 7/8/8.1/2012r2<\/a>";
		cell2.innerHTML += "<br\/>- Viscosity (Mac OS X and Windows):<br\/>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"visc\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Viscosity Bundle<\/a>";
		cell2.innerHTML += "&nbsp;&nbsp; ";
		cell2.innerHTML += "<a href='javascript:download_begin(\"confinlinevisc\"," + i + ")' class=\"btn btn-sm btn-primary\"><i class=\"fa fa-download\"></i> Viscosity Inline Config<\/a>";
	}
}

function useaddr_changed() {
	if ($('#useaddr').val() == "other") {
		hideInput('useaddr_hostname', false);
	} else {
		hideInput('useaddr_hostname', true);
	}
}

function usepkcs11_changed() {
	if ($('#usepkcs11').prop('checked')) {
		hideInput('pkcs11id', false);
		hideInput('pkcs11providers', false);
	} else {
		hideInput('pkcs11id', true);
		hideInput('pkcs11providers', true);
	}
}

function usepass_changed() {
	if ($('#usepass').prop('checked')) {
		hideInput('pass', false);
		hideInput('pass_confirm', false);
	} else {
		hideInput('pass', true);
		hideInput('pass_confirm', true);
	}
}

function useproxy_changed() {
	if ($('#useproxy').prop('checked')) {
		hideInput('useproxytype', false);
		hideInput('proxyaddr', false);
		hideInput('proxyport', false);
		hideInput('useproxypass', false);
	} else {
		hideInput('useproxytype', true);
		hideInput('proxyaddr', true);
		hideInput('proxyport', true);
		hideInput('useproxypass', true);
		hideInput('proxyuser', true);
		hideInput('proxypass', true);
		hideInput('proxypass_confirm', true);
	}
	if ($('#useproxy').prop('checked') && ($('#useproxypass').val() != 'none')) {
		hideInput('proxyuser', false);
		hideInput('proxypass', false);
		hideInput('proxypass_confirm', false);
	} else {
		hideInput('proxyuser', true);
		hideInput('proxypass', true);
		hideInput('proxypass_confirm', true);
	}
}

events.push(function(){
	// ---------- OnChange handlers ---------------------------------------------------------

	$('#server').on('change', function() {
		server_changed();
	});
	$('#useaddr').on('change', function() {
		useaddr_changed();
	});
	$('#usepkcs11').on('change', function() {
		usepkcs11_changed();
	});
	$('#usepass').on('change', function() {
		usepass_changed();
	});
	$('#useproxy').on('change', function() {
		useproxy_changed();
	});
	$('#useproxypass').on('change', function() {
		useproxy_changed();
	});

	// Make these controls plain buttons
	$("#btnsearch").prop('type', 'button');
	$("#btnclear").prop('type', 'button');

	// Search for a term in the package name and/or description
	$("#btnsearch").click(function() {
		var searchstr = $('#searchstr').val().toLowerCase();
		var table = $("table tbody");

		table.find('tr').each(function (i) {
			var $tds = $(this).find('td'),
				username = $tds.eq(0).text().trim().toLowerCase(),
				certname = $tds.eq(1).text().trim().toLowerCase();

			regexp = new RegExp(searchstr);
			if (searchstr.length > 0) {
				if (!(regexp.test(username)) && !(regexp.test(certname))) {
					$(this).hide();
				} else {
					$(this).show();
				}
			} else {
				$(this).show();	// A blank search string shows all
			}
		});
	});

	// Clear the search term and unhide all rows (that were hidden during a previous search)
	$("#btnclear").click(function() {
		var table = $("table tbody");

		$('#searchstr').val("");

		table.find('tr').each(function (i) {
			$(this).show();
		});
	});

	// Hitting the enter key will do the same as clicking the search button
	$("#searchstr").on("keyup", function (event) {
	    if (event.keyCode == 13) {
	        $("#btnsearch").get(0).click();
	    }
	});

	// ---------- On initial page load ------------------------------------------------------------

	server_changed();
	useaddr_changed();
	usepkcs11_changed();
	usepass_changed();
	useproxy_changed();
});
//]]>
</script>

<?php
include("foot.inc");
