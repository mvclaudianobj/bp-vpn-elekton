<?php
# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# Written by Marcos Claudiano <marcos.claudiano@bluepex.com>, 2024
# Rewritten by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
# ====================================================================

require_once("entraid_config.inc");

$responde_message = 'User successfully disconnected!';
$response_status = 'ok';
$component = '';

try {
	header('Content-Type: application/json');

	$translation = [
		"pt_BR" => [
			"title" => "Sessão Encerrada",
			"message" => "Você foi desconectado com sucesso.",
			"sub_message" => "Redirecionando em 3 segundos...",
			"session_error" => "Ocorreu um erro ao tentar desconectar seu usuário. Verifique sua conexão com a internet."
		],
		"en_US" => [
			"title" => "Session Ended",
			"message" => "You have been successfully disconnected.",
			"sub_message" => "Redirecting in 3 seconds...",
			"session_error" => "Error when trying to disconnect your user, please check your internet connection."
		]
	];

	$component = <<< EOD
<h1>{$translation[SYSTEM_LANGUAGE]['title']}</h1>
<p style="font-size: 1.1em; margin-top: 15px;">
{$translation[SYSTEM_LANGUAGE]['message']}
</p>
<p class="mt-3">{$translation[SYSTEM_LANGUAGE]['sub_message']}</p>
EOD;

	if ($_SERVER['REQUEST_METHOD'] == 'POST' &&
		isset($_POST['ip'])) {
		$ip = $_POST['ip'];

		$db = new SQLite3('/var/db/entraid_access.db');
		$stmt = $db->prepare('DELETE FROM entraid WHERE ip = :ip');
		$stmt->bindValue(':ip', $ip, SQLITE3_TEXT);

		$result = $stmt->execute();

		$db->close();
	}

} catch (\Throwable $th) {
	$responde_message = 'Error when trying to disconnect your user, please check your internet connection.';
	$response_status = 'error';
	$component = "<p class=\"mt-3\">{$translation[SYSTEM_LANGUAGE]['session_error']}</p>";
    
	entraid_handle_error(
	    'Entraid kill authenticated user error',
	    $translation[SYSTEM_LANGUAGE]['session_error'] . "\n{$th->getMessage()}",
	    false,
	    true,
	    501,
	    false,
	);
}

$response = [
	'message' => $responde_message,
	'status' => $response_status,
	'data' => [
		'component' => $component
	]
];

echo json_encode($response);

exit;
