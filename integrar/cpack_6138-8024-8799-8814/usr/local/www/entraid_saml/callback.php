<?php
# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# Written by Marcos Claudiano <marcos.claudiano@bluepex.com>, 2024
# Rewritten by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
# ====================================================================

require_once("config.inc");
require_once("entraid_config.inc");
require_once("entraid_header.php");
require_once("vendor/autoload.php");
use myPHPnotes\Microsoft\Auth;
use myPHPnotes\Microsoft\Handlers\Session;
use myPHPnotes\Microsoft\Models\User;

$translation = [
	"pt_BR" => [
		"title" => "Conectado com credenciais Microsoft",
		"subtitle" => "Bem-vindo!"
	],
	"en_US" => [
		"title" => "Connected with Microsoft credentials",
		"subtitle" => "Welcome!"
	]
];

try {
	$auth = new Auth(
		ENTRAID_AUTHORITY,
		ENTRAID_CLIENT_ID,
		ENTRAID_CLIENT_SECRET,
		ENTRAID_CALLBACK,
		["User.Read"]
	);

	$tokens = $auth->getToken(
		$_REQUEST['code'],
		Session::get("state")
	);

	$accessToken = $tokens->access_token;

	$auth->setAccessToken($accessToken);

	$user = new User;

	$unique_identifier = hash('sha256', session_id() . $accessToken);

	file_put_contents('/var/log/squid/authenticated_hosts', $unique_identifier . "\n", FILE_APPEND);

	$name = $user->data->getDisplayName();
	$email = $user->data->getUserPrincipalName();

	$redirect_address = "http://" . ENTRAID_INTERFACE_IP . ":59789/auth/valid.php?f=authenticated_users&e=" . urlencode($email) . "&u=" . urlencode($name);

} catch (\Throwable $th) {
	entraid_handle_error(
		"EntraId flow error:", 
		$th->getMessage(),
		false,
		true,
		$th->getCode(),
		true
	);
}

$title = gettext('Connected with Microsoft credentials');
$subtitle = gettext('Welcome!');

echo <<< EOD
	<div id="wrap"> 
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					</div>				
				<div id="content">
					<h1>{$translation[SYSTEM_LANGUAGE]['title']}</h1>
					<h3>{$translation[SYSTEM_LANGUAGE]['subtitle']}</h3>					
					<div class="mt-4">
						<p class="mt-3" style="font-size: 1.1em; text-align: left;">
							$name
						</p>
						<p class="mt-3" style="font-size: 1.1em; text-align: left;">
							$email
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
	<script>
		setTimeout(() => {
			window.location.href = "$redirect_address";
		}, 4000);
	</script>
EOD;

require_once('entraid_footer.php');
