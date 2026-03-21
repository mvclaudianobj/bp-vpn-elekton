<?php
# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# Written by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
# ====================================================================

require_once('entraid_header.php');

$data = json_decode($_GET['data'], true);

echo <<< EOD
<div id="wrap">
	<div class="row">
		<div class="col-md-12">
			<div id="error">
				<h1 class="text-warning">{$data['title']}</h1>
				<h3>{$data['message']}</h3>
			</div>
		</div>
	</div>
</div>
EOD;

require_once('entraid_footer.php');
?>
