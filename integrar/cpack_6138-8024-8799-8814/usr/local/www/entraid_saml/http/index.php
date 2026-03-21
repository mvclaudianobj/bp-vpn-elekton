<?php
/* ====================================================================
 * Copyright (C) BluePex Security Solutions - All rights reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by  Marcos V. Claudiano <marcos.claudiano@bluepex.com>, 2024
 * Modified by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
 * ====================================================================
 *
 */

require_once("config.inc");
require_once("entraid_config.inc");
require_once("../entraid_header.php");

$translation = [
	"pt_BR" => [
		"title" => "Login com Microsoft (SSO)",
		"subtitle" => "Conecte-se com sua conta Microsoft.",
		"action_button" => "Autenticar com Microsoft"
	],
	"en_US" => [
		"title" => "Login with Microsoft (SSO)",
		"subtitle" => "Connect with your Microsoft account.",
		"action_button" => "Authenticate with Microsoft"
	]
];

$port = "";
if (isset($config['system']['webgui']['port']) &&
    !empty($config['system']['webgui']['port'])) {
	$port = $config['system']['webgui']['port'];
}
if ($port == "") {
	$port = ($config['system']['webgui']['protocol'] == "http") ? 80 : 443;
}

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'];
$url_utm = "https://" . ENTRAID_INTERFACE_IP . ":{$port}/entraid_saml/signup.php";
$ip = ENTRAID_INTERFACE_IP;

echo <<< EOD
	<div id="wrap"> 
		<div class="row">
			<div class="col-md-12">
				<div class="row">
					</div>				
				<div id="content">
					<h1>{$translation[SYSTEM_LANGUAGE]['title']}</h1>
					<h2>{$translation[SYSTEM_LANGUAGE]['subtitle']}</h2>
					<a
						id="microsoft-login"
						class="mt-5 btn btn-info btn-lg"
						href="$url_utm"
						role="button"
						aria-label="{$translation[SYSTEM_LANGUAGE]['action_button']}"
					>
					{$translation[SYSTEM_LANGUAGE]['action_button']}
					</a>
					<h4 class="text-right font-weight-light text-muted">$ip</h4>
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

require_once('../entraid_footer.php');
