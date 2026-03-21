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

// Check if the request was via POST and if the email was passed
if ($_SERVER['REQUEST_METHOD'] == 'POST' &&
    isset($_POST['ip'])) {
	$ip = $_POST['ip'];

	// Connect to SQLite3 database
	$db = new SQLite3('/var/db/entraid_access.db');

	// Prepare the deletion query
	$stmt = $db->prepare('DELETE FROM entraid WHERE ip = :ip');
	$stmt->bindValue(':ip', $ip, SQLITE3_TEXT);

	// Execute the query
	$result = $stmt->execute();

	echo ($result) ? "success" : "error";

	// Close the connection
	$db->close();
}
?>
