<?php
# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# Written by Marcos Claudiano <marcos.claudiano@bluepex.com>, 2024
# Rewritten by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
# ====================================================================

require_once('config.inc');
require_once('entraid_config.inc');
require "vendor/autoload.php";
use myPHPnotes\Microsoft\Auth;

session_start();

try {
	$missing = [];

	foreach (ENTRAID_ENV_PARAMS as $key => $value) {
		if(empty($value)) { $missing[] = $key; }
	}

	if (!empty($missing)) {
		entraid_handle_error("Error during authentication.","It seems that we faced an error when trying to authenticate.");
	}

	$microsoft = new Auth(
	    ENTRAID_AUTHORITY,
	    ENTRAID_CLIENT_ID,
	    ENTRAID_CLIENT_SECRET,
	    ENTRAID_CALLBACK,
	    ["User.Read"]
	);

	header("location: " . $microsoft->getAuthUrl());

} catch (\Throwable $th) {
	entraid_handle_error(
	    "Error on entraid autentication process.",
	    "Error when trying to authenticating with entra_id conf, please check configuration data.\n{$th->getMessage()}",
	    false,
	    true,
	    401,
	    false
	);
}
