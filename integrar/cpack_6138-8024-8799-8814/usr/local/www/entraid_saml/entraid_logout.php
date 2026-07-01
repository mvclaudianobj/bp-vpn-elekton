<?php
# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# Written by Marcos Claudiano <marcos.claudiano@bluepex.com>, 2024
# Rewritten by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
# ====================================================================

require_once("entraid_config.inc");

function entraid_openvpn_disconnect($client_id, $remote_ip) {
	global $g;

	$client_id = is_string($client_id) ? trim($client_id) : '';
	$remote_ip = is_string($remote_ip) ? trim($remote_ip) : '';
	$has_client_id = $client_id !== '' && preg_match('/^[0-9]+$/', $client_id);
	$has_remote_ip = $remote_ip !== '' && filter_var($remote_ip, FILTER_VALIDATE_IP);

	$result = [
		'attempted' => false,
		'success' => false,
		'method' => null,
		'message' => 'Sessao web removida; parametros insuficientes para derrubar OpenVPN.',
		'sockets_checked' => []
	];

	if (!$has_client_id && !$has_remote_ip) {
		return $result;
	}

	$base = !empty($g['openvpn_base']) ? $g['openvpn_base'] : '/var/etc/openvpn';
	$socket_paths = glob(rtrim($base, '/') . '/server*/sock');
	if (!is_array($socket_paths)) {
		$socket_paths = [];
	}

	if ($base !== '/var/etc/openvpn') {
		$fallback_paths = glob('/var/etc/openvpn/server*/sock');
		if (is_array($fallback_paths)) {
			$socket_paths = array_merge($socket_paths, $fallback_paths);
		}
	}

	$socket_paths = array_values(array_unique($socket_paths));
	$result['attempted'] = true;
	$result['method'] = $has_client_id ? 'client-kill' : 'kill';
	$result['sockets_checked'] = $socket_paths;

	foreach ($socket_paths as $socket_path) {
		if (!is_string($socket_path) || !is_readable($socket_path)) {
			continue;
		}

		$fp = @stream_socket_client('unix://' . $socket_path, $errval, $errstr, 1);
		if (!$fp) {
			continue;
		}

		stream_set_timeout($fp, 1);
		if ($has_client_id) {
			fputs($fp, "client-kill {$client_id} HALT\n");
		} else {
			fputs($fp, "kill {$remote_ip}\n");
		}

		while (!feof($fp)) {
			$line = fgets($fp, 1024);
			$info = stream_get_meta_data($fp);
			if ($info['timed_out']) {
				break;
			}
			if (strpos($line, 'INFO:') !== false) {
				continue;
			}
			if (strpos($line, 'SUCCESS') !== false) {
				$result['success'] = true;
				$result['message'] = 'Sessao web removida e desconexao OpenVPN solicitada.';
			}
			break;
		}

		fclose($fp);

		if ($result['success']) {
			return $result;
		}
	}

	$result['message'] = 'Sessao web removida; nao foi possivel confirmar desconexao OpenVPN via management socket.';
	return $result;
}

$responde_message = 'User successfully disconnected!';
$response_status = 'ok';
$component = '';
$openvpn_disconnect = null;

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

	if ($_SERVER['REQUEST_METHOD'] == 'POST') {
		$ip = isset($_POST['ip']) ? trim($_POST['ip']) : '';
		$remote_ip = isset($_POST['remote_ip']) ? trim($_POST['remote_ip']) : $ip;
		$client_id = isset($_POST['client_id']) ? trim($_POST['client_id']) : '';

		if ($ip !== '') {
			$db = new SQLite3('/var/db/entraid_access.db');
			$stmt = $db->prepare('DELETE FROM entraid WHERE ip = :ip');
			$stmt->bindValue(':ip', $ip, SQLITE3_TEXT);

			$result = $stmt->execute();

			$db->close();
		}

		$openvpn_disconnect = entraid_openvpn_disconnect($client_id, $remote_ip);
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
		'component' => $component,
		'openvpn_disconnect' => $openvpn_disconnect
	]
];

echo json_encode($response);

exit;
