<?php

ini_set('memory_limit','2048M');
ini_set('max_execution_time', '3600');
set_time_limit(3600);

require_once("nf_db.inc");
require_once("decode_reports.inc");

$db = new MysqlBackend();

if ($db) {
	$db_config = get_element_config('nf_reports_settings');
	if (is_array($db_config) && !empty($db_config)) {
		$conn = $db->Connect($db_config['reports_ip'], $db_config['reports_port'], $db_config['reports_user'], $db_config['reports_password'], $db_config['reports_db']);
	}
}

function getReportsInfo()
{
	global $db;

	$sql = "SELECT * FROM dataclick_reports_info";
	$res = $db->Query(filter_query_select($sql));
	if ($res) {
		$data = $db->FetchAssoc($res);
		$db->FreeRes($res);
	}
	return decode_return_select($data);
}

/*
function createRelatoriosEventToClearlog($time = "10:10", $day = 61)
{
	global $db;

	$event_sql = <<<EOF
	DROP EVENT IF EXISTS firewallapp_clearlog;
		SET GLOBAL event_scheduler = ON;
		CREATE EVENT `firewallapp_clearlog`
			ON SCHEDULE EVERY 15 MINUTE STARTS (date_format(now(), '%Y-%m-%d {$time}:00'))
			DO BEGIN
				START TRANSACTION;
				CREATE TABLE clean_alerts_ids (tid int(10));
				INSERT INTO clean_alerts_ids SELECT id FROM alerts WHERE DATE(time_date) < DATE_SUB(CURDATE(), INTERVAL 60 DAY) LIMIT 3000000;
				DELETE th FROM alerts AS th WHERE th.id IN ( SELECT tid FROM clean_alerts_ids );
				DROP TABLE clean_alerts_ids;
				CREATE TABLE clean_http_ids (tid int(10));
				INSERT INTO clean_http_ids SELECT id FROM http WHERE DATE(time_date) < DATE_SUB(CURDATE(), INTERVAL 60 DAY) LIMIT 1000000;
				DELETE th FROM http AS th WHERE th.id IN ( SELECT tid FROM clean_http_ids );
				DROP TABLE clean_http_ids;
				CREATE TABLE clean_https_ids (tid int(10));
				INSERT INTO clean_https_ids SELECT id FROM https WHERE DATE(time_date) < DATE_SUB(CURDATE(), INTERVAL 60 DAY) LIMIT 1000000;
				DELETE th FROM https AS th WHERE th.id IN ( SELECT tid FROM clean_https_ids );
				DROP TABLE clean_https_ids;
			COMMIT;
		END;
EOF;

	$res = $db->MultiQuery($event_sql);
	if ($res) {
		$db->FreeRes($res);
	return true;
	} else {
		log_error("Error to create dataclick_clearlog Event!");
		log_error("MySQL Error=" . $db->GetErrorString());
	return false;
	}
}
*/

function createEventToClearlog($time = "23:30", $month = 3)
{
	global $db;

	$event_sql = <<<EOF
	DROP PROCEDURE IF EXISTS dataclick_clearlog_reports_procedure;

	CREATE PROCEDURE `dataclick_clearlog_reports_procedure`()
	BEGIN
		SET @max_access = (SELECT MAX(time_date) FROM accesses);
		SET @max_id_access = (SELECT MAX(id) FROM accesses WHERE (time_date < DATE_SUB(@max_access, INTERVAL {$month} MONTH) ));
		SET @max_justif = (SELECT MAX(time_date) FROM justification);
		START TRANSACTION;
			DELETE FROM access_categories WHERE accesses_id <= @max_id_access AND accesses_id <> 0 AND accesses_id_http IS NULL AND accesses_id_https IS NULL;
			DELETE FROM accesses WHERE id <= @max_id_access;
			DELETE FROM justification WHERE (time_date < DATE_SUB(@max_justif, INTERVAL {$month} MONTH) );
			OPTIMIZE TABLE accesses, access_categories, justification;
		COMMIT;
	END;

	DROP EVENT IF EXISTS dataclick_clearlog;
	DROP EVENT IF EXISTS dataclick_clearlog_reports_event;

	SET GLOBAL event_scheduler = ON;
	CREATE EVENT `dataclick_clearlog_reports_event`
		ON SCHEDULE EVERY 1 DAY STARTS (date_format(now(), '%Y-%m-%d {$time}:00'))
		DO BEGIN
			call dataclick_clearlog_reports_procedure();
		COMMIT;
	END;
EOF;

	$res = $db->MultiQuery($event_sql);
	if ($res) {
		log_error("Bluepex: Dataclick report: Create dataclick_clearlog procedure / event");
		$db->FreeRes($res);
		return true;
	} else {
		log_error("Bluepex: Dataclick report: Error to create dataclick_clearlog procedure / event: MySQL Error=" . $db->GetErrorString());
	}

	return false;
}

function createEventToReports($time = '')
{
	global $db;

	$sql = <<<EOF
DROP PROCEDURE IF EXISTS dataclick_summary_reports;

CREATE PROCEDURE `dataclick_summary_reports` ( IN reports_period char(20) )
	BEGIN
		SET @current_date = (SELECT NOW());

		IF reports_period = "all" THEN
			SET @reports_period = "daily, weekly, monthly";
		ELSE
			SET @reports_period = reports_period;
		END IF;

		SET @separator = ", ";
		SET @separatorLen = LENGTH( @separator );

		SET AUTOCOMMIT=0;
		START TRANSACTION;

		CREATE TABLE IF NOT EXISTS dataclick_top_10_users (
			total bigint(8) not null,
			user varchar (50),
			ip varchar(15),
			type varchar(8),
			period varchar(20),
			INDEX (period)
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_accessed_sites (
			url varchar(4096) not null,
			total bigint(8) not null,
			blocked tinyint(1),
			period varchar(20),
			INDEX (period)
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_categories(
			category_id int(11) NOT NULL,
			category_name varchar(50) NOT NULL,
			total bigint(8) NOT NULL,
			blocked tinyint(1),
			period varchar(20),
			INDEX (period)
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_consumed_sites(
			url varchar(4096) not null,
			total bigint(8) not null,
			period varchar(20),
			INDEX (period)
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_social_networks (
			site varchar(255) NOT NULL,
			total bigint(8) NOT NULL,
			blocked tinyint(1),
			period varchar(20),
			INDEX (period)
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_access_social_networks (
			username varchar(50) default NULL,
			ipaddress varchar(15),
			site varchar(255),
			total bigint(8) default 0,
			size_bytes bigint(8) default 0,
			period varchar(20),
			INDEX (period)
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_users_support (
			id bigint(20) unsigned not null auto_increment primary key,
			total bigint(8) not null,
			user varchar (50),
			ip varchar(15),
			type varchar(8),
			time_period datetime
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_accessed_sites_support (
			id bigint(20) unsigned not null auto_increment primary key,
			url varchar(4096) not null,
			total bigint(8) not null,
			blocked tinyint(1),
			time_period datetime
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_categories_support (
			id bigint(20) unsigned not null auto_increment primary key,
			category_id int(11) NOT NULL,
			category_name varchar(50) NOT NULL,
			total bigint(8) NOT NULL,
			blocked tinyint(1),
			time_period datetime
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_consumed_sites_support (
			id bigint(20) unsigned not null auto_increment primary key,
			url varchar(4096) not null,
			total bigint(8) not null,
			time_period datetime
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_10_social_networks_support (
			id bigint(20) unsigned not null auto_increment primary key,
			site varchar(255) NOT NULL,
			total bigint(8) NOT NULL,
			blocked tinyint(1),
			time_period datetime
		);

		CREATE TABLE IF NOT EXISTS dataclick_top_access_social_networks_support (
			id bigint(20) unsigned not null auto_increment primary key,
			username varchar(50) default NULL,
			ipaddress varchar(15),
			site varchar(255),
			total bigint(8) default 0,
			size_bytes bigint(8) default 0,
			time_period datetime
		);

		CREATE TABLE IF NOT EXISTS dataclick_reports_info(
			last_generated_reports TIMESTAMP
		);

		SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_users_support WHERE time_period < NOW() - INTERVAL 30 DAY;");
		PREPARE stmtp FROM @strQueryDelete;
		EXECUTE stmtp;

		SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_accessed_sites_support WHERE time_period < NOW() - INTERVAL 30 DAY;");
		PREPARE stmtp FROM @strQueryDelete;
		EXECUTE stmtp;

		SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_categories_support WHERE time_period < NOW() - INTERVAL 30 DAY;");
		PREPARE stmtp FROM @strQueryDelete;
		EXECUTE stmtp;

		SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_consumed_sites_support WHERE time_period < NOW() - INTERVAL 30 DAY;");
		PREPARE stmtp FROM @strQueryDelete;
		EXECUTE stmtp;

		SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_social_networks_support WHERE time_period < NOW() - INTERVAL 30 DAY;");
		PREPARE stmtp FROM @strQueryDelete;
		EXECUTE stmtp;

		SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_access_social_networks_support WHERE time_period < NOW() - INTERVAL 30 DAY;");
		PREPARE stmtp FROM @strQueryDelete;
		EXECUTE stmtp;

		WHILE @reports_period != '' DO
			SET @report_period  = SUBSTRING_INDEX(@reports_period, @separator, 1);
			SET @reports_period = SUBSTRING( @reports_period, LENGTH(@report_period) + 1 + @separatorLen );

			IF @report_period = "daily" THEN
				SET @interval = CONCAT("'", (SELECT DATE_SUB(@current_date, INTERVAL 1 DAY)) , "' AND '", @current_date , "'");
			ELSEIF @report_period = "weekly" THEN
				SET @interval = CONCAT("'", (SELECT DATE_SUB(@current_date, INTERVAL 1 WEEK)) , "' AND '", @current_date , "'");
			ELSEIF @report_period = "monthly" THEN
				SET @interval = CONCAT("'", (SELECT DATE_SUB(@current_date, INTERVAL 1 MONTH)) , "' AND '", @current_date , "'");
			END IF;

			-- TOP 10 USERS --
			SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_users WHERE period='", @report_period , "'");
			SET @strQueryInsert = CONCAT("
			INSERT INTO dataclick_top_10_users (
				select sum(total) as total, user, ip, type, '", @report_period , "' from dataclick_top_10_users_support
				WHERE (time_period between ", @interval , ")
				GROUP BY user, ip
				ORDER BY total DESC
			);");
			PREPARE stmtp FROM @strQueryDelete;
			PREPARE stmtp1 FROM @strQueryInsert;
			EXECUTE stmtp;
			EXECUTE stmtp1;

			-- TOP 10 ACCESSED SITES --
			SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_accessed_sites WHERE period='", @report_period , "'");
			SET @strQueryInsert = CONCAT("
			INSERT INTO dataclick_top_10_accessed_sites (
				select url, sum(total) as total, blocked, '", @report_period , "' from dataclick_top_10_accessed_sites_support
				WHERE (time_period between ", @interval , ")
				GROUP BY url, blocked
				ORDER BY total DESC
			);");
			PREPARE stmtp FROM @strQueryDelete;
			PREPARE stmtp1 FROM @strQueryInsert;
			EXECUTE stmtp;
			EXECUTE stmtp1;

			-- TOP 10 CATEGORIES --
			SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_categories WHERE period='", @report_period , "'");
			SET @strQueryInsert = CONCAT("
			INSERT INTO dataclick_top_10_categories (
				select category_id, category_name as category, total, blocked, '", @report_period , "' from dataclick_top_10_categories_support
				WHERE (time_period between ", @interval , ")
				GROUP BY category_id, blocked
				ORDER BY total DESC
			);");
			PREPARE stmtp FROM @strQueryDelete;
			PREPARE stmtp1 FROM @strQueryInsert;
			EXECUTE stmtp;
			EXECUTE stmtp1;

			-- TOP 10 COSUMMED SITES --
			SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_consumed_sites WHERE period='", @report_period , "'");
			SET @strQueryInsert = CONCAT("
			INSERT INTO dataclick_top_10_consumed_sites (
				SELECT url, SUM(total) AS total, '", @report_period , "' FROM dataclick_top_10_consumed_sites_support
				WHERE (time_period between ", @interval , ")
				GROUP BY url
				ORDER BY total DESC
			);");
			PREPARE stmtp FROM @strQueryDelete;
			PREPARE stmtp1 FROM @strQueryInsert;
			EXECUTE stmtp;
			EXECUTE stmtp1;

			-- TOP 10 SOCIAL NETWORKS --
			SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_10_social_networks WHERE period='", @report_period , "'");
			SET @strQueryInsert = CONCAT("
			INSERT INTO dataclick_top_10_social_networks (
				select site, sum(total) as total, blocked, '", @report_period , "' from dataclick_top_10_social_networks_support
				WHERE (time_period BETWEEN ", @interval , ")
				group by site, blocked
				order by total desc
			);");
			PREPARE stmtp FROM @strQueryDelete;
			PREPARE stmtp1 FROM @strQueryInsert;
			EXECUTE stmtp;
			EXECUTE stmtp1;

			SET @strQueryDelete = CONCAT("DELETE FROM dataclick_top_access_social_networks WHERE period='", @report_period , "'");
			SET @strQueryInsert = CONCAT("
			INSERT INTO dataclick_top_access_social_networks (
				SELECT username, ipaddress, site, sum(total) as total, sum(size_bytes) as size_bytes,'", @report_period , "' FROM dataclick_top_access_social_networks_support
				WHERE (time_period BETWEEN ", @interval , ")
				GROUP by site, username, ipaddress
				order by total desc
			);");
			PREPARE stmtp FROM @strQueryDelete;
			PREPARE stmtp1 FROM @strQueryInsert;
			EXECUTE stmtp;
			EXECUTE stmtp1;
		END WHILE;

		SET @strQueryDelete = "DELETE FROM dataclick_reports_info";
		PREPARE stmtp FROM @strQueryDelete;
		EXECUTE stmtp;

		SET @strQueryInsert = CONCAT("
			INSERT INTO dataclick_reports_info (last_generated_reports) VALUES ('", @current_date ,"');
		");
		PREPARE stmtp FROM @strQueryInsert;
		EXECUTE stmtp;

		COMMIT;
	END;

DROP EVENT IF EXISTS dataclick_generate_reports;

SET GLOBAL event_scheduler = ON;

CREATE EVENT `dataclick_generate_reports`
	ON SCHEDULE EVERY 5 MINUTE
	STARTS CURRENT_TIMESTAMP
	DO
	BEGIN
		CALL dataclick_summary_reports('all');
		COMMIT;
	END;
EOF;

	$res = $db->MultiQuery($sql);
	if ($res) {
		$db->FreeRes($res);
	} else {
		log_error("Error to create dataclick_generate_reports Event!");
		log_error("MySQL Error=" . $db->GetErrorString());
	}
}

function is_invalid_period($filter)
{
	if(!isset($filter['period']) || !in_array($filter['period'], ["daily", "weekly", "monthly"])) {
		return true;
	} else {
		return false;
	}
}

function get_top_10_users($filter = array())
{
	global $db;

	if (is_invalid_period($filter)) {
		return;
	}

	$data = array();
	$sql = "SELECT SUM(total) as total, user, ip, type, period FROM dataclick_top_10_users WHERE period='{$filter['period']}' GROUP BY user ORDER BY total desc";
	if (isset($filter['limit']) && is_numeric($filter['limit'])) {
		$sql .= " LIMIT {$filter['limit']}";
	}

	$res = $db->Query(filter_query_select($sql));
	if ($res) {
		while ($result = $db->FetchArray($res)) {
			$data[] = [
				"item" => $result['user'],
				"type" => $result['type'],
				"value" => str_replace(',', '', number_format($result['total'] / pow(1024, 2), 2))
			];
		}
		$db->FreeRes($res);
	}
	return decode_return_select($data);
}

function get_top_5_social_access($filter = array())
{
	global $db;

	if (is_invalid_period($filter)) {
		return;
	}

	$data = array();
	$sql = "SELECT * FROM dataclick_top_10_social_networks WHERE period='{$filter['period']}'";

	if (isset($filter['blocked']) && is_numeric($filter['blocked']) && $filter['blocked']) {
		$sql .= " AND blocked=1";
	} else {
		$sql .= " AND blocked=0";
	}

	$sql .= " ORDER BY total desc";

	if (isset($filter['limit']) && is_numeric($filter['limit'])) {
		$sql .= " LIMIT {$filter['limit']}";
	}

	$result = $db->Query(filter_query_select($sql));
	$get_total_values[] = 0;
	if ($result) {
		$data = [];
		while ($res = $db->FetchArray($result)) {
			$data['sites'][] = ["site" => $res['site'],"total" => $res['total']];
			$get_total_values[] = $res['total'];
		}
		$data['max_result'] = array_sum($get_total_values);
		$db->FreeRes($result);
	}
	return decode_return_select($data);
}

function get_top_categories($filter = array())
{
	global $db;

	if (is_invalid_period($filter)) {
		return;
	}

	$data = array();
	$sql = "SELECT * FROM dataclick_top_10_categories WHERE period='{$filter['period']}'";

	if (isset($filter['blocked']) && is_numeric($filter['blocked']) && $filter['blocked']) {
		$sql .= " AND blocked=1";
	} else {
		$sql .= " AND blocked=0";
	}

	if (isset($filter['limit']) && is_numeric($filter['limit'])) {
		$sql .= " LIMIT {$filter['limit']}";
	}

	$res = $db->Query(filter_query_select($sql));
	if ($res) {
		while ($result = $db->FetchArray($res)) {
			$data[] = [
				"item" => $result['category_name'],
				"value" => $result['total']
			];
		}
		$db->FreeRes($res);
	}
	return decode_return_select($data);
}

function get_top_10_domains($filter = array())
{
	global $db;

	if (is_invalid_period($filter)) {
		return;
	}

	$data = array();
	$sql = "SELECT * FROM dataclick_top_10_consumed_sites WHERE period='{$filter['period']}'";

	if (isset($filter['limit']) && is_numeric($filter['limit'])) {
		$sql .= " LIMIT {$filter['limit']}";
	}

	$res = $db->Query(filter_query_select($sql));
	if ($res) {
		while ($result = $db->FetchArray($res)) {
			$data[] = [
				"item" => $result['url'],
				"value" => str_replace(',', '', number_format($result['total'] / pow(1024, 2), 2))
			];
		}
		$db->FreeRes($res);
	}
	return decode_return_select($data);
}

function get_top_10_accessed_sites($filter = array())
{
	global $db;

	if (is_invalid_period($filter)) {
		return;
	}

	$data = array();
	$sql = "SELECT * FROM dataclick_top_10_accessed_sites WHERE period='{$filter['period']}'";

	if (isset($filter['blocked']) && is_numeric($filter['blocked']) && $filter['blocked']) {
		$sql .= " AND blocked=1";
	} else {
		$sql .= " AND blocked=0";
	}

	if (isset($filter['limit']) && is_numeric($filter['limit'])) {
		$sql .= " LIMIT {$filter['limit']}";
	}

	$res = $db->Query(filter_query_select($sql));
	if ($res) {
		while ($result = $db->FetchArray($res)) {
		$data[] = [
				"item" => $result['url'],
				"value" => $result['total']
			];
		}
		$db->FreeRes($res);
	}
	return decode_return_select($data);
}

function get_top_openvpn_control($filter = array())
{
	if (is_invalid_period($filter)) {
		return;
	}

	$data = array();

	$today = date('Y-m-d');
	switch($filter['period']) {
		case "daily":
			$daily = date('Y-m-d', strtotime('-1 days', strtotime($today)));
			$interval = "datetime(time, \"unixepoch\") >= \"{$daily} 00:00:00\" AND datetime(time, \"unixepoch\") <= \"{$today} 23:59:59\"";
			break;
		case "weekly":
			$weekly = date('Y-m-d', strtotime('-1 week', strtotime($today)));
			$interval = "datetime(time, \"unixepoch\") >= \"{$weekly} 00:00:00\" AND datetime(time, \"unixepoch\") <= \"{$today} 23:59:59\"";
			break;
		case "monthly":
			$monthly = date('Y-m-d', strtotime('-1 month', strtotime($today)));
			$interval = "datetime(time, \"unixepoch\") >= \"{$monthly} 00:00:00\" AND datetime(time, \"unixepoch\") <= \"{$today} 23:59:59\"";
			break;
	}

	$sql = "SELECT username, SUM(cast((julianday(time_disconnect) - julianday(time_connect)) * 24 * 60 * 60 As Integer)) AS connect_time, SUM(bytes_sent) as bytes_sent, SUM(bytes_received) as bytes_received FROM openvpn_control WHERE {$interval} AND time_disconnect <> \"\" GROUP BY username ORDER BY bytes_received ASC";

	if (isset($filter['limit']) && is_numeric($filter['limit'])) {
		$sql .= " LIMIT {$filter['limit']}";
	}

	$sql = filter_query_select($sql);

	exec("sqlite3 /var/db/openvpn_control.db '{$sql}'", $out, $err);
	if (!$err) {
		if (!empty($out)) {
			foreach ($out as $res) {
				$res = explode("|", $res);
				$data[] = [
					"username" => $res[0],
					"connect_time" => $res[1],
					"bytes_sent" => $res[2],
					"bytes_received" => $res[3]
				];
			}
		}
		return decode_return_select($data);
	}
}

function get_top_access_social_networks($filter = [])
{
	global $db;

	if (is_invalid_period($filter)) {
		return;
	}

	$data = [];
	$social_networks = [ "facebook", "youtube", "instagram", "linkedin", "whatsapp" ];

	if (isset($filter['social_network']) && in_array($filter['social_network'], $social_networks)) {
		$sql = "SELECT username, ipaddress, site, total, size_bytes
			FROM dataclick_top_access_social_networks
			WHERE period='{$filter['period']}' AND site='{$filter['social_network']}'
			GROUP BY username, ipaddress, site
			ORDER BY total DESC";
	} else {
		$sql = "SELECT * FROM dataclick_top_access_social_networks WHERE period='{$filter['period']}'";
	}

	if (isset($filter['limit']) && is_numeric($filter['limit'])) {
		$sql .= " LIMIT {$filter['limit']}";
	}

	$res = $db->Query(filter_query_select($sql));
	if ($res) {
		while ($result = $db->FetchArray($res)) {
			/*
			if(strpos($result['url'], 'facebook') !== false) {
                                if(strpos($result['url'], 'www.facebook') === false)
                                        continue;
                        }
			*/
			$data[] = [
				"username" => $result['username'],
				"ipaddress" => $result['ipaddress'],
				"total" => $result['total'],
				"size_bytes" => str_replace(',', '', number_format($result['size_bytes'] / pow(1024, 2), 2))
			];
		}
		$db->FreeRes($res);
	}
	return decode_return_select($data);
}

function get_justifications($filter = array())
{
	global $db;

	$data = array();

	$sql = "SELECT * FROM justification
		WHERE (time_date between '{$filter['interval_from']}' AND '{$filter['interval_until']}')
	";
	if (isset($filter['username']) && !empty($filter['username'])) {
		$sql .= " AND username='{$filter['username']}'";
	}
	if (isset($filter['ipaddress']) && !empty($filter['ipaddress'])) {
		$sql .= " AND ip='{$filter['ipaddress']}'";
	}
	if (isset($filter['limit']) && is_numeric($filter['limit'])) {
		$sql .= " LIMIT {$filter['limit']}";
	}

	$res = $db->Query(filter_query_select($sql));
	if ($res) {
		while ($result = $db->FetchAssoc($res)) {
			$data[] = $result;
		}
	}
	return decode_return_select($data);
}
