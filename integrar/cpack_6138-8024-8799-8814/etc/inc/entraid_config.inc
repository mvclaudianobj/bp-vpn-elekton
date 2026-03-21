<?php

# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# Written by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
# ====================================================================

require_once("config.inc");
require_once("entraid_error_handling.inc");

define("ENV_ENTRAID", '/usr/local/bin/.env');
define("ENTRAID_DATABASE_PATH",'/var/db/entraid_access.db');
define("SYSTEM_LANGUAGE",$config['system']['language'] ?? 'pt_BR');
/**
 * @ Entraid ENV configuration
 * Expected constants:
 * ENTRAID_CLIENT_ID
 * ENTRAID_AUTHORITY
 * ENTRAID_USERNAME
 * ENTRAID_CLIENT_SECRET
 * ENTRAID_CALLBACK
 * ENTRAID_PASS
 * ENTRAID_REDIRECTION_URL
 */
$env_file = [];
$env_file_error = null;

if (file_exists(ENV_ENTRAID) && is_readable(ENV_ENTRAID)) {
	$env_file = file(ENV_ENTRAID, FILE_SKIP_EMPTY_LINES | FILE_IGNORE_NEW_LINES);
} else {
	$env_file_error = "Missing or unreadable EntraID env file: " . ENV_ENTRAID;
}

$entraid_env_config = [];

foreach ($env_file as $full_parameter) { 
	$line = trim($full_parameter);
	if ($line === '' || strpos($line, '#') === 0) {
		continue;
	}

	if ($parameter = explode('=', $line, 2)) {
		$parameter_key = empty($parameter[0]) ? null : trim($parameter[0]);
		$parameter_value = empty($parameter[1]) ? null : trim($parameter[1]);

		if (empty($parameter_key)) {
			continue;
		}

		//Export a array with all conf values
		$entraid_env_config[$parameter_key] = $parameter_value;

		// Create singular constants from env file values
		$const_name = "ENTRAID_" . $parameter_key;
		if (!defined($const_name)) {
			define($const_name, $parameter_value);
		}
	}
}

define("ENTRAID_ENV_PARAMS", $entraid_env_config);

if (!empty($env_file_error)) {
	entraid_handle_error(
		"EntraID env configuration error.",
		$env_file_error,
		true,
		true,
		501,
		false
	);
}

if (isset($config['system']['webfilter']['instance']['config'])) {
	$wf_instances = &$config['system']['webfilter']['instance']['config'];
} else {
	entraid_handle_error(
		"EntraID instance configuration reading error.", 
		"Error when trying to read EntraID instance configuration from config.xml.",
		true,
		true,
		501,
		false
	);
}

foreach ($wf_instances as $index => $instance) {
	if (isset($instance['server']['authsettings']['auth_method']) &&
	    $instance['server']['authsettings']['auth_method'] === "entraid") {
		$settings = $instance['server'];
		$configured_entraid_interfaces = explode(",", $settings['active_interface']);

		foreach ($configured_entraid_interfaces as $entraid_interface) {
			define("ENTRAID_INTERFACE_IP",get_interface_ip($entraid_interface));
		}
		break;
	}
}

if (!defined("ENTRAID_INTERFACE_IP")) {
	entraid_handle_error(
		"EntraID Missconfiguration Error.",
		"Error when trying to read EntraID instance configuration.",
		true,
		true,
		501,
		true,
	);
}
