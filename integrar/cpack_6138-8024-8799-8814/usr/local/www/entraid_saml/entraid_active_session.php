<?php
/* 
* ====================================================================
* Copyright (C) BluePex Security Solutions - All rights reserved
* Unauthorized copying of this file, via any medium is strictly prohibited
* Proprietary and confidential
* Written by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
* ====================================================================
*/

require_once("entraid_header.php");
require_once("entraid_config.inc");

$translation = [
	"pt_BR" => [
		"title" => "Sessão Ativa",
		"subtitle" => "Você está conectado!",
		"action_button" => "Encerrar Sessão",
	],
	"en_US" => [
		"title" => "Active Session",
		"subtitle" => "You are connected!",
		"action_button" => "End Session",
	]
];

$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'];
?>

<div id="wrap">
	<div class="row">
		<div class="col-md-12">
			<div class="row">
			</div>
			<div id="content">
				<h1><?php echo $translation[SYSTEM_LANGUAGE]['title']?></h1>
				<p class="mt-3" style="font-size: 1.1em; text-align: left;">
					<?php echo $translation[SYSTEM_LANGUAGE]['subtitle']?>
				</p>
				<a id="logout-btn" class="btn btn-danger btn-lg mt-4" role="button">
					<?php echo $translation[SYSTEM_LANGUAGE]['action_button']?>
				</a>
			</div>
		</div>
	</div>
</div>

<script>
$(document).ready(function() {
	$("#logout-btn").click(function() {
		// Desabilita o botão e mostra feedback
		$("#logout-btn").text("Encerrando…").prop("disabled", true);
		$.ajax({
			url: "/entraid_saml/entraid_logout.php",
			type: "POST",
			data: {
				ip: '<?php echo $ip ?>'
			}
		}).done(function(data) {
			$("#content").html(data['data']['component']);
			setTimeout(() => {
				window.location.href = "/entraid_saml/http/index.php";
			}, 3000);
		}).fail(function() {
			$("#content").html(`
			<h1>Erro</h1>
			<p>Não foi possível encerrar a sessão.</p>
			<a href="entraid_active_session.php" class="btn btn-secondary mt-3">Voltar</a>
			`);
		});
	});
});
</script>

<?php
require_once("entraid_footer.php");
?>
