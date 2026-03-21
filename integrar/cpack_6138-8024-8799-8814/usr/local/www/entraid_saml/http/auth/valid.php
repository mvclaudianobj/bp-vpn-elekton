<?php
/* ====================================================================
 * Copyright (C) BluePex Security Solutions - All rights reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Marcos Claudiano Moreira <marcos.claudiano@bluepex.com>, 2024
 * Modified by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
 * ====================================================================
 *
 */

require_once("config.inc");
require_once("entraid_config.inc");

$username = $_GET['u'];
$email = $_GET['e'];
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'];
$sleep_value = 2;
$custom_url_redirection = ENTRAID_REDIRECTION_URL;

try {
	foreach (['username', 'email', 'ip'] as $attr) {
		if (!isset($$attr) || $$attr === '') {
			entraid_handle_error(
				"EntraID user authentication error.", 
				" Error when validating user attribute {$attr}.",
				true,
				true,
				501,
				false
			);
		}
	}

	$database_connection = new SQLite3(ENTRAID_DATABASE_PATH, SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);

	$is_table_entraid_created = $database_connection->querySingle("SELECT name FROM sqlite_master WHERE type='table' AND name='entraid';");

	if (!$is_table_entraid_created) {
		entraid_handle_error(
			"EntraID database does not exists.", 
			"Error when trying to connect to EntraID database, please check " . ENTRAID_DATABASE_PATH . " integrity.",
			true,
			true,
			501,
			false
		);
	}

	$statement = $database_connection->prepare("
		INSERT INTO entraid (username, email, ip)
		VALUES (:username, :email, :ip)
		ON CONFLICT(ip) DO UPDATE SET
			username = excluded.username,
			email = excluded.email;
	");

	$statement->bindValue(':username', $username, SQLITE3_TEXT);
	$statement->bindValue(':email', $email, SQLITE3_TEXT);
	$statement->bindValue(':ip', $ip, SQLITE3_TEXT);
	$statement->execute();

	$sleep_value = 4;

	sleep($sleep_value);

	echo <<< EOD
		<script>
			setTimeout(() => {
				window.open("$redirect_address", "_blank");
				window.location.href = "$custom_url_redirection";
			}, 1000);
		</script>
	EOD;
	exit();

} catch (\Throwable $th) {
	entraid_handle_error(
		"EntraId flow error:", 
		$th->getMessage(),
		false,
		true,
		501,
		true
	);
}
