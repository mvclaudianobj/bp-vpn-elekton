<?php
/* ====================================================================
 * Copyright (C) BluePex Security Solutions - All rights reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Marcos Claudiano Moreira <marcos.claudiano@bluepex.com>, 2024
 * Modified by Allan Vilas Boas <allan.vilas@bluepex.com>, 2026
 * ====================================================================
 *
 */

require_once("guiconfig.inc");
require_once("service-utils.inc");

$pgtitle = array(dgettext("BluePexWebFilter", "WebFilter"), dgettext("BluePexWebFilter", "Entra ID Users"));
include("head.inc");

include("shortcuts_menu.php");

$show_users_id_tab_array = false;

if (isset($config['system']['webfilter']['instance']) &&
    !empty($config['system']['webfilter']['instance'])) {
	foreach ($config['system']['webfilter']['instance']['config'] as $wfinstances) {
		if ($wfinstances['server']['authsettings']['auth_method'] == 'entraid') {
			$show_users_id_tab_array = true;
			break;
		}
	}
}

if (!$show_users_id_tab_array) {
	header("Location: ./wf_dashboard.php");
}

$tab_array = array();
$tab_array[] = array(dgettext('BluePexWebFilter', 'Dashboard'), false, '/webfilter/wf_dashboard.php');
$tab_array[] = array(dgettext('BluePexWebFilter', 'Diagnostic'), false, '/webfilter/wf_diagnostic.php');
$tab_array[] = array(dgettext('BluePexWebFilter', 'Port test'), false, '/webfilter/wf_nc.php');
$tab_array[] = array(dgettext('BluePexWebFilter', 'Connected Users'), true, '/webfilter/users_entraid.php');
display_top_tabs($tab_array);

// Connect to SQLite3 database
$db = new SQLite3('/var/db/entraid_access.db');

// Execute the SQL query
$query = "SELECT distinct username, email, ip FROM entraid LIMIT 1000";
$results = $db->query($query);

// Check for results
$users_registered = [];

if ($results) {
	while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
		// Add each user to the $users_registered array
		$users_registered[] = $row;
	}
}

// Close the database connection
$db->close();
?>

<div class="table-responsive">
	<table class="table table-hover table-striped table-condensed table-rowdblclickedit sortable-theme-bootstrap" data-sortable>
		<thead>
			<tr>
				<th><?=dgettext("BluePexWebFilter", "Name"); ?></th>
				<th><?=dgettext("BluePexWebFilter", "Email"); ?></th>
				<th><?=dgettext("BluePexWebFilter", "IP"); ?></th>
				<th data-sortable="false"><?=dgettext("BluePexWebFilter", "Actions");?></th>
			</tr>
		</thead>
		<tbody>
<?php
$show_msg_users_not_found = false;
// Check if there are users
if (is_array($users_registered) &&
    !empty($users_registered)) {
	$render_html = "";
	foreach ($users_registered as $user) {
		$render_html .= "<tr>";
		$render_html .= "<td>" . htmlspecialchars($user['username']) . "</td>";
		$render_html .= "<td>" . htmlspecialchars($user['email']) . "</td>";
		$render_html .= "<td>" . htmlspecialchars($user['ip']) . "</td>";
		$render_html .= "<td><button type='button' class='btn btn-danger' onclick='deleteUser(\"{$user['ip']}\")'>" . dgettext("BluePexWebFilter", 'Disconnect') . "</button></td>";
		$render_html .= "</tr>";
	}
	echo $render_html;
} else {
	$show_msg_users_not_found = true;
}
?>
		</tbody>
	</table>
<?php if ($show_msg_users_not_found): ?>
	<p><?=dgettext("BluePexWebFilter", "No users found.")?></p>
<?php endif; ?>
</div>

<script type="text/javascript">

// User deletion function via AJAX
function deleteUser(ip) {
	if (confirm("<?=dgettext("BluePexWebFilter", "Do you want to disconnect this user?")?>")) {
		$.ajax({
			url: 'delete_user.php', // URL of the PHP file that will perform the deletion
			type: 'POST',
			data: {
				'ip': ip
			},
			success: function(response) {
				if (response.trim() === "success") {
					alert("<?=dgettext("BluePexWebFilter", "User Logged Out Successfully!")?>");
					location.reload(); // Refresh the page after deletion
				} else {
					alert("<?=dgettext("BluePexWebFilter", "Error disconnecting User.")?>");
				}
			}
		});
	}
}
</script>

<?php include("foot.inc"); ?>
