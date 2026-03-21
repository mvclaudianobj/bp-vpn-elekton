#!/usr/local/bin/python
#  -*- coding: UTF-8 -*-
#
#  Copyright (C) 2015-2022 BluePex Security Company (R)
#  Wesley Peres <desenvolvimento@bluepex.com>
#  All rights reserved.
#

import os
import re
import csv
import sys
import time
import smtplib
import MySQLdb
import sqlite3
from datetime import datetime
import email.utils
import configparser
import logging
from logging import config
from threading import Thread
from tldextract import extract
from email.mime.text import MIMEText
from itertools import groupby
from subprocess import check_output, call, run
from random import randint

platform = open("/etc/platform", "rb").read().rstrip()
pattern = re.compile(r"^(.*)?(\/.*[%|\'|\"|\?])?")

wf_instances = ""
wf_instances_interface = ""
wf_instances_interface_enabled = []

#Confirm that there is a valid interface in the webfilter

import xmltodict

with open('/cf/conf/config.xml') as fd:
	xmldoc = xmltodict.parse(fd.read(), process_namespaces=True)['bluepex']

try:
	i = 0
	for xml_item in xmldoc['system']['webfilter']['instance']['config']:
		if xmldoc['system']['webfilter']['instance']['config'][i]['server']['name'] and xmldoc['system']['webfilter']['instance']['config'][i]['server']['enable_squid'] == "on":
			wf_instances_interface_enabled.append(xmldoc['system']['webfilter']['instance']['config'][i]['server']['name'])
		i = i + 1
except:
	try:
		if xmldoc['system']['webfilter']['instance']['config']['server']['name'] and xmldoc['system']['webfilter']['instance']['config']['server']['enable_squid'] == "on":
			wf_instances_interface_enabled.append(xmldoc['system']['webfilter']['instance']['config']['server']['name'])
	except:
		pass

if xmldoc['system']['webfilter']['instance']['info']['wf_instances']:
	wf_instances = xmldoc['system']['webfilter']['instance']['info']['wf_instances']
	wf_instances_interface = xmldoc['system']['webfilter']['instance']['info']['wf_instances_interface']

status_services = {
	"wfrotate": "ok",
	"mysql": "alert"
}

log_referer = xmldoc['system']['webfilter']['nf_reports_settings']['element0']['remote_reports']

def check_syslogd():
	get_time = time.time()

	while (get_syslogd_processes() > 1 or time.time() - get_time > 300):
		call(['/bin/pkill -f "syslogd -s"'], shell=True)

	if (get_syslogd_processes() != 1):
		call(['service syslogd restart'], shell=True)

def get_syslogd_processes():
	return len(list(filter(None, check_output(['pgrep -f "syslogd -s"; exit 0'], shell=True).decode('utf-8').split('\n'))))

class mount_disk():
	global platform

	def rw(self):
		os.system('/etc/rc.conf_mount_rw')

	def ro(self):
		os.system('/etc/rc.conf_mount_ro')

mount = mount_disk()

LOGGING = {
	'version': 1,
	'disable_existing_loggers': False,
	'formatters': {
		'verbose': {
			'format': 'WFMonitor: %(message)s'
		},
	},
	'handlers': {
		'stdout': {
			'class': 'logging.StreamHandler',
			'stream': sys.stdout,
			'formatter': 'verbose',
		},
		'sys-logger6': {
			'class': 'logging.handlers.SysLogHandler',
			'address': '/var/run/log',
			'facility': "local3",
			'formatter': 'verbose',
		},
	},
	'loggers': {
		'wf-logger': {
			'handlers': ['sys-logger6', 'stdout'],
			'level': logging.INFO,
			'propagate': True,
		},
	}
}

check_syslogd()

config.dictConfig(LOGGING)
error_message = logging.getLogger("wf-logger")

def get_config(config_to_read):
	try:
		config = configparser.ConfigParser()
		config.read('/usr/local/etc/webfilter/wf_monitor.cfg')

		if config_to_read == 'time_process':
			if config.get('main', 'time_process') != "":
				return float(config.get('main', 'time_process'))
			else:
				return 2.0
		if config_to_read == 'contatos':
			return config.get('email_users', 'contatos').split(',')
		if config_to_read == 'time_mysql_entry':
			return int(config.get('time_mysql', 'time_mysql_entry'))
		if config_to_read == 'check_mysql_entry':
			return config.get('time_mysql', 'check_mysql_entry')
		if config_to_read == 'lines_log_update':
			return int(config.get('wf_logs', 'lines_log_update'))
	except Exception as error:
		error_message.info("{} | {}".format(error, sys.exc_info()[0]))


def log_process():
	w_data = csv.writer(open('/usr/local/etc/webfilter/wf_monitor_services', 'w'), lineterminator="\n")

	for k, v in status_services.items():
		w_data.writerow([k, str(v).replace("\"", "")])

def check_mysql_connect():
	if not connect_db():
		if platform != "nanobsd":
			status_services['mysql'] = "off"
			error_message.info("WFMonitor: Process mysqld is not running...")
			log_process()
			try_cont = 0

			while try_cont < 5:
				try_cont = try_cont + 1
				os.system('/usr/local/etc/rc.d/mysql-server restart; exit 0')
				time.sleep(1)

				if connect_db():
					status_services['mysql'] = "ok"
					error_message.info("Process mysqld is running...")
					break
	else:
		status_services['mysql'] = "ok"

	log_process()

class check_process(Thread):
	global status_services
	global log_process

	def __init__(self, cp_service):
		Thread.__init__(self)
		self.process_ck = cp_service[1]
		self.process_rc = cp_service[2]
		self.process_name = cp_service[0]
		self.process_t = time.time()

	def run(self):
		if check_output(["/bin/pgrep -f {}; exit 0".format(self.process_ck)], shell=True).decode('utf-8') != "":
			status_services[self.process_name] = "ok"
			log_process()
			return
		else:
			error_message.info("WFMonitor: Process {} is not running...".format(self.process_name))

		while time.time() - self.process_t < 5:
			error_message.info("WFMonitor: Process {} is not running. Trying to start...".format(self.process_name))

			os.system(self.process_rc)

			if check_output(["/bin/pgrep -l -f {}; exit 0".format(self.process_ck)], shell=True).decode('utf-8') != "":
				log_process()
				return
			else:
				error_message.info("WFMonitor: Process {} is not running...".format(self.process_name))

				os.system(self.process_rc)

				time.sleep(1)

			status_services[self.process_name] = "off"

		log_process()

sqd = " ".join([
	'/usr/local/sbin/squid -s -f /usr/local/etc/squid/squid0.conf;',
	'/usr/local/sbin/squid -k reconfigure -f /usr/local/etc/squid/squid0.conf;',
	'exit 0'
])

def check_var_folder():
	global log_process

	#Change /var to / in df -k
	df_output = check_output(['/bin/df -k /; exit 0'], shell=True).decode('utf-8').split()
	capacity_u = int(df_output[-2].replace("%", ""))
	capacity_t = int(df_output[-5])
	status_services["diskusage"] = capacity_u
	log_process()

	if capacity_u > 85:
		var_squid = int(check_output(['/usr/bin/du -s /var/squid/logs; exit 0'], shell=True).decode('utf-8').split()[0])

		if var_squid > (capacity_t / 2):
			os.system('/bin/rm -rf /var/squid/logs/*; exit 0')
			os.system(sqd)

def check_pipe_process():
	pipe_processes = len(filter(None, check_output(['/bin/pgrep -f "cat -u"; exit 0'], shell=True).decode('utf-8').split()))

	if pipe_processes > 5:
		os.system('/bin/pkill -f "cat -u"; exit 0')

def connect_db():
	report_settings = xmldoc['system']['webfilter']['nf_reports_settings']

	if report_settings:
		mysqlUser = "root"
		mysqlIP = "127.0.0.1"
		mysqlPass = "123"
		mysqlDb = "webfilter"

		try:
			return MySQLdb.connect(mysqlIP, mysqlUser, mysqlPass, mysqlDb, connect_timeout=3)
		except Exception as error:
			error_message.info("CONNECT DATABASE: {}".format(error))
			return False
	else:
		error_message.info("CONNECT DATABASE: Report settings not configured")
		return False


def categorize_netfilter(netfilter_list, scheme):
	_new_logs = []
	log = []
	categories = ""

	for log in netfilter_list:
		if log[3] == '-':
			parse_log = extract(log[1])
			parsed_domain = ".".join([parse_log.domain, parse_log.suffix])

			if not pattern.match(parsed_domain):
				categories = ['99']
			else:
				get_categories = check_output(['/usr/local/bin/python3.8 /usr/local/bin/wf_get_url_categories.py -c -u {}'.format(parsed_domain)], shell=True).decode('utf-8').rstrip()

				if get_categories == ",":
					get_categories = "99,"

				categories = ",".join(list(filter(lambda x: x, get_categories.split(','))))

				_new_logs.append((log[0], log[1], log[2], categories, log[4], log[5], log[6]))
		else:
			_new_logs.append(log)

	_new_logs.append((log[0], log[1], log[2], categories, log[4], log[5], log[6]))

	return _new_logs

class process_data(Thread):
	global pattern
	global platform

	def __init__(self, logs):
		Thread.__init__(self)

		self.pattern = re.compile(r".*(squid|redirector).*\:\ ")
		self.logs = list(set([self.pattern.split(log)[-1] for log in logs]))
		self.access = [log.split() for log in set([log for log in self.logs if len(log.split()) == 11])]
		self.netfilter = [log.split() for log in set([log for log in self.logs if len(log.split()) == 8 if not re.match(r'^https.*', log.split()[1])])]
		self.https = [log.split() for log in set([log for log in self.logs if len(log.split()) == 8 if re.match(r'^https.*', log.split()[1])])]
		self.log = []
		self.send_data = []

	def run(self):
		try:
			for a_line in self.access:
				if len(self.access) > 0:
					for idx, n_line in enumerate(self.netfilter):
						if (a_line[6].split('?') == n_line[1].split('?') and
	 						a_line[0][0:8] == n_line[0][0:8] and a_line[2] == n_line[4]):
							self.log.append((a_line[0], a_line[2], n_line[5], n_line[6], n_line[1], a_line[4], a_line[1], n_line[2], n_line[3], a_line[-5]))
							del self.netfilter[idx]
							break

			if (os.path.exists('/var/squid/logs/backup_data') and not 
      				os.path.exists('/var/tmp/wfsendbkp.lock')):
				call(['/usr/local/bin/python -u /usr/local/bin/wfsendbkp.py'], shell=True)

			if len(self.https) > 0:
				for log in sorted(self.https, key=lambda log: (log[0][0:8], log[1], log[4].split('?')[0])):
					self.log.append((log[0], log[4], log[5], log[6], log[1], "{}".format(randint(1024, 1048576)), "{}".format(randint(1024, 1048576)), log[2], log[3], "https"))

			if len(self.log) > 0:
				start_insert_data = insert_data(self.log)
				start_insert_data.start()

		except Exception as error:
			error_message.info("PROCESS DATA: {}".format(error))

			if (not os.path.exists('/var/squid/logs/backup_data') or
				int(os.path.getsize('/var/squid/logs/backup_data') < 5242880 or
				platform != "nanobsd")):
				for log in sorted(set(self.send_data)):
					print >> open('/var/squid/logs/backup_data', 'a', 0), " ".join(log)

class insert_data(Thread):
	global log_referer
	global garbage

	def __init__(self, insert_logs):
		Thread.__init__(self)
		self.insert_logs = insert_logs
		self.conn = connect_db()
		self.insert = self.conn.cursor()
		self.select_categories = "select id, description from categories"
		self.s_insert = "insert into accesses(time_date, ip, username, groupname, url_str, size_bytes, elapsed_ms, blocked, url_no_qry, url_path, categories) values ('{}','{}','{}','{}','{}','{}','{}', '{}', '', '{}', '')"
		self.insert_dataclick_top_10_users_support = "insert into dataclick_top_10_users_support(total, user, ip, type, time_period) values ('{}', '{}', '{}', '{}', '{}')"
		self.insert_dataclick_top_10_accessed_sites_support = "insert into dataclick_top_10_accessed_sites_support(url, total, blocked, time_period) values ('{}', '{}', '{}', '{}')"
		self.insert_dataclick_top_10_categories_support = "insert into dataclick_top_10_categories_support(category_id, category_name, total, blocked, time_period) values ('{}', '{}', '{}', '{}', '{}')"
		self.insert_dataclick_top_10_consumed_sites_support = "insert into dataclick_top_10_consumed_sites_support(url, total, time_period) values ('{}', '{}', '{}')"
		self.insert_dataclick_top_10_social_networks_support = "insert into dataclick_top_10_social_networks_support(site, total, blocked, time_period) values ('{}', '{}', '{}', '{}')"
		self.insert_dataclick_top_access_social_networks_support = "insert into dataclick_top_access_social_networks_support(username, ipaddress, site, total, size_bytes, time_period) values ('{}', '{}', '{}', '{}', '{}', '{}')"

	def run(self):
		try:
			url_no_referers = [log for log in self.insert_logs if re.match(r"-|https", log[-1])]
			
			groups = [{url: list(group)} for url, group in groupby(sorted(self.insert_logs, key=lambda log: (log[0][0:8], log[2], log[4])), lambda log: log[4])]

			dataclick_top_10_users = {}
			dataclick_top_10_accessed_sites = {}
			dataclick_top_10_consumed_sites = {}
			dataclick_top_10_social_networks = {0:{},1:{}}
			dataclick_top_access_social_networks = {"Facebook":{}, "YouTube":{}, "LinkedIn":{}, "Twitter":{}, "Instagram":{}, "Whatsapp Web":{}}
			dataclick_top_10_categories = {0:{},1:{}}

			try:
				self.insert.execute(self.select_categories)	
				rows_categories = self.insert.fetchall()
				all_categories = {str(row_category[0]): row_category[1] for row_category in rows_categories}
			except:
				all_categories = {
					"0": "Nao categorizado",
					"1": "Pornografia",
					"2": "Musica",
					"3": "Video",
					"4": "Livro",
					"5": "Emprego",
					"6": "Esporte",
					"7": "Jogos",
					"8": "Humor",
					"9": "Ensino a distancia",
					"10": "Batepapo",
					"11": "Jornal",
					"12": "Revista",
					"13": "Animacoes",
					"14": "Tutoriais",
					"15": "Classificados",
					"16": "Namoro on-line",
					"17": "Curiosidades",
					"18": "Compras",
					"19": "Noticias",
					"20": "Cartoes Virtuais",
					"21": "Esoterismo",
					"22": "Webmail",
					"25": "Quadrinhos",
					"26": "Televisao",
					"27": "Culinaria",
					"28": "Armas",
					"29": "Leiloes",
					"30": "Viagem",
					"31": "Animais",
					"32": "Hackers",
					"33": "Filmes",
					"34": "Fotografia",
					"35": "Companhias Aereas",
					"36": "Artes",
					"37": "Carros",
					"38": "Bancos",
					"39": "Blogs",
					"40": "Drogas",
					"41": "Relacionamentos",
					"42": "Saude",
					"43": "Seitas e cultos",
					"44": "Banner",
					"45": "Proxy",
					"46": "Sites de busca",
					"47": "Violencia",
					"48": "Portais",
					"49": "Nazismo",
					"50": "Downloads",
					"99": "Nao categorizado"
				}

			for group in groups:
				for idx, log in enumerate(group.get(list(group.keys())[0])):
					if not re.match(r"-|https", log[-1]):
						self.time = datetime.fromtimestamp(
							int(log[0].replace(",", ".").split('.')[0])).strftime('%Y-%m-%d %H:%M:%S')
						if re.match(r'^[0-9]{4}', log[7]):
							self.blocked = 1
						else:
							self.blocked = 0
						if idx == 0 or log[-1] != self.insert_logs[idx - 1][-1]:
							self.domain = extract(log[-1])

							url_str = re.sub(r"^(\.)(.*)", "\g<2>", ".".join([self.domain.subdomain, self.domain.domain, self.domain.suffix]))

							self.insert.execute(self.s_insert.format(
								self.time,
								log[1],
								log[2],
								log[3],
								url_str,
								log[6],
								log[7],
								self.blocked,
								log[-1]))
							self.conn.commit()
							lastid = int(self.insert.lastrowid)

							for id_categories in re.split(',', log[8]):
								self.insert.execute("insert into access_categories (accesses_id,categories_id) values ('{}', '{}')".format(lastid, int(re.sub('-', '99', id_categories))))
								self.conn.commit()
						else:
							if log_referer == 'on' and log[4] != '':
								self.insert.execute("insert into referers (id_referer,url_referer) values ('{}', '{}')".format(lastid, log[4]))
								self.conn.commit()

			for log in url_no_referers:
				self.time = datetime.fromtimestamp(int(log[0].replace(",", ".").split('.')[0])).strftime('%Y-%m-%d %H:%M:%S')

				if re.match(r'^[0-9]{4}', log[7]):
					self.blocked = 1
				else:
					self.blocked = 0

				match = None

				if "youtube" in log[4] and "docid" in log[4]:
					match = re.search(r"docid=([^\&]+)", log[4])

				if match:
					docid = match.group(1)
					adjusted_url = f"https://www.youtube.com/watch?v={docid}"
				else:
					adjusted_url = log[4]

				self.domain = extract(adjusted_url)

				url_str = re.sub(r"^(\.)(.*)", "\g<2>", ".".join([self.domain.subdomain, self.domain.domain, self.domain.suffix]))

				self.insert.execute(self.s_insert.format(
					self.time,
					log[1],
					log[2],
					log[3],
					url_str,
					log[6],
					log[7],
					self.blocked,
					adjusted_url))
				self.conn.commit()
				lastid = int(self.insert.lastrowid)

				# dataclick_top_10_users
				if self.blocked == 0:
					if log[2] == "" or log[2] == "-":
						typeUser = "ip"
						user = log[1]
					else:
						typeUser = "username"
						user = log[2]

					if user in dataclick_top_10_users:
						dataclick_top_10_users[user].update({
							'total': dataclick_top_10_users[user]['total'] + int(log[6])
						})
					else:
						dataclick_top_10_users.update({
							user: {
								'total': int(log[6]),
								'user': user,
								'ip': log[1],
								'type': typeUser,
								'time_period': self.time,
							}
						})

				if len(url_str) != 0:
					# dataclick_top_10_accessed_sites
					if url_str in dataclick_top_10_accessed_sites:
						dataclick_top_10_accessed_sites[url_str].update({
							'total': dataclick_top_10_accessed_sites[url_str]['total'] + 1
						})
					else:
						dataclick_top_10_accessed_sites.update({
							url_str: {
								'url': url_str,
								'total': 1,
								'blocked': self.blocked,
								'time_period': self.time,
							}
						})

					# dataclick_top_10_consumed_sites
					if self.blocked == 0:
						if url_str in dataclick_top_10_consumed_sites:
							dataclick_top_10_consumed_sites[url_str].update({
								'total': dataclick_top_10_consumed_sites[url_str]['total'] + int(log[6])
							})
						else:
							dataclick_top_10_consumed_sites.update({
								url_str: {
									'url': url_str,
									'total': int(log[6]),
									'time_period': self.time,
								}
							})

					# dataclick_top_10_social_networks
					# dataclick_top_access_social_networks
					social_media = ""

					if re.match(r'.*facebook\.com.*', url_str):
						social_media = "Facebook"
					elif re.match(r'.*youtube\.com.*', url_str):
						social_media = "YouTube"
					elif re.match(r'.*linkedin\.com.*', url_str):
						social_media = "LinkedIn"
					elif re.match(r'.*twitter\.com.*', url_str):
						social_media = "Twitter"
					elif re.match(r'.*instagram\.com.*', url_str):
						social_media = "Instagram"
					elif re.match(r'.*whatsapp\.(com|net).*', url_str):
						social_media = "Whatsapp Web"

					if social_media != "":
						# dataclick_top_10_social_networks
						if social_media in dataclick_top_10_social_networks[self.blocked]:
							dataclick_top_10_social_networks[social_media].update({
								'total': dataclick_top_10_consumed_sites[self.blocked][social_media]['total'] + 1
							})
						else:
							dataclick_top_10_social_networks[self.blocked].update({
								social_media: {
									'site': social_media,
									'total': 1,
									'blocked': self.blocked,
									'time_period': self.time,
								}
							})

						# dataclick_top_access_social_networks
						if self.blocked == 0:
							if log[2] == "" or log[2] == "-":
								user = log[1]
							else:
								user = log[2]

							if user in dataclick_top_access_social_networks[social_media]:
								dataclick_top_access_social_networks[social_media][user].update({
									'total': dataclick_top_access_social_networks[social_media][user]['total'] + 1,
									'size_bytes': dataclick_top_access_social_networks[social_media][user]['size_bytes'] + int(log[6])
								})
							else:
								dataclick_top_access_social_networks[social_media].update({
									user: {
										'username': user,
										'ipaddress': log[1],
										'site': social_media,
										'total': 1,
										'size_bytes': int(log[6]),
										'time_period': self.time,
									}
								})

				categories = "{},".format(log[8])

				if categories:
					for id_categories in re.split(',', categories):
						if id_categories == "":
							id_categories = '99'

						# dataclick_top_10_categories
						if id_categories in dataclick_top_10_categories[self.blocked]:
							dataclick_top_10_categories[self.blocked][id_categories].update({
								'total': dataclick_top_10_categories[self.blocked][id_categories]['total'] + 1
							})
						else:
							dataclick_top_10_categories[self.blocked].update({
								id_categories: {
									'category_id': id_categories,
									'category_name': all_categories[id_categories],
									'total': 1,
									'blocked': self.blocked,
									'time_period': self.time,
								}
							})

						self.insert.execute("insert into access_categories (accesses_id,categories_id) values ('{}','{}')".format(lastid, int(id_categories)))
						self.conn.commit()

			# dataclick_top_10_users
			for keydic, valuesdic in dataclick_top_10_users.items():
				self.insert.execute(self.insert_dataclick_top_10_users_support.format(
					valuesdic['total'],
					valuesdic['user'],
					valuesdic['ip'],
					valuesdic['type'],
					valuesdic['time_period']))
				self.conn.commit()

			# dataclick_top_10_accessed_sites
			for keydic, valuesdic in dataclick_top_10_accessed_sites.items():
				self.insert.execute(self.insert_dataclick_top_10_accessed_sites_support.format(
					valuesdic['url'],
					valuesdic['total'],
					valuesdic['blocked'],
					valuesdic['time_period']))
				self.conn.commit()

			# dataclick_top_10_consumed_sites
			for keydic, valuesdic in dataclick_top_10_consumed_sites.items():
				self.insert.execute(self.insert_dataclick_top_10_consumed_sites_support.format(
					valuesdic['url'],
					valuesdic['total'],
					valuesdic['time_period']))
				self.conn.commit()

			# dataclick_top_10_social_networks
			for keydic, valuesdic in dataclick_top_10_social_networks.items():
				for keydic_group, valuesdic_group in valuesdic.items():
					self.insert.execute(self.insert_dataclick_top_10_social_networks_support.format(
						valuesdic_group['site'],
						valuesdic_group['total'],
						valuesdic_group['blocked'],
						valuesdic_group['time_period']))
					self.conn.commit()

			# dataclick_top_10_categories
			for keydic, valuesdic in dataclick_top_10_categories.items():
				for keydic_group, valuesdic_group in valuesdic.items():
					self.insert.execute(self.insert_dataclick_top_10_categories_support.format(
						valuesdic_group['category_id'],
						valuesdic_group['category_name'],
						valuesdic_group['total'],
						valuesdic_group['blocked'],
						valuesdic_group['time_period']))
					self.conn.commit()

			# dataclick_top_access_social_networks
			for keydic, valuesdic in dataclick_top_access_social_networks.items():
				for keydic_group, valuesdic_group in valuesdic.items():
					self.insert.execute(self.insert_dataclick_top_access_social_networks_support.format(
						valuesdic_group['username'],
						valuesdic_group['ipaddress'],
						valuesdic_group['site'],
						valuesdic_group['total'],
						valuesdic_group['size_bytes'],
						valuesdic_group['time_period']))
					self.conn.commit()

			self.conn.commit()
			self.insert.close()
			self.conn.close()

		except Exception as error:
			error_message.info("INSERT DATA: {}".format(error))

##################################
# FIREWALLAPP
##################################

def categorize_netfilter_fapp(netfilter_list, scheme):
	_new_logs = []

	for log in netfilter_list:
		is_ip = re.match(r"^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})?$", log[2])

		if is_ip:
			src_ip = log[2]
		else:
			src_ip = log[4]

		categories = '99'

		if os.path.exists('/usr/local/bin/bp_category_redis_fapp.sh') and len(log[1]) > 0:
			cmd = "/bin/sh /usr/local/bin/bp_category_redis_fapp.sh {}".format(log[1])
			categories = check_output(cmd, shell=True).decode("utf-8").strip()

		_new_logs.append((log[0], src_ip, '', '', log[1], int(log[3]), 0, '', log[1], categories))

	return _new_logs

class process_data_fapp(Thread):
	global pattern
	global platform
	global categorize_netfilter

	def __init__(self, logs, log_type):
		Thread.__init__(self)

		self.log_type = log_type
		self.netfilter = []
		self.log_http = []
		self.log_https = []
		self.log_alerts = []
		self.log_sshd = []
		self.log_filter = []
		self.lines_log_http = []
		self.lines_log_https = []
		self.lines_log_alerts = []
		self.lines_log_sshd = []
		self.lines_log_filter = []

		if log_type == "http":
			for line in logs:
				pattern = re.findall(r"(\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}).\d{1,}\s([?!:\/\/a-zA-Z0-9-_.|\<hostname unknown\>]+)\[\*\*\]([?!:\/\/a-zA-Z0-9-_.=&]+)", line)
				
				if len(pattern) == 0:
					continue

				if pattern[0][1] != "<hostname unknown>":
					line_timestamp = pattern[0][0]
					date_time = datetime.strptime(line_timestamp, '%m/%d/%Y-%H:%M:%S')
					time_stamp = int(time.mktime(date_time.timetuple()))
					time_db = datetime.fromtimestamp(int(time_stamp)).strftime('%Y-%m-%d %H:%M:%S')
					pattern_status = line.split("[**]")[6]

					src_ip = re.findall(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", line.split("[**]")[8])[0]

					if len(pattern_status) > 0:
						if pattern_status == "<no status>":
							status = 0
						else:
							status = pattern_status[0:3]
					else:
						status = ''

					pattern_size_bytes = line.split("[**]")[7]

					if len(pattern_size_bytes) > 0:
						size_bytes = pattern_size_bytes.replace(" bytes", "")
					else:
						size_bytes = 0

					try:
						line_log = "{0} {1} {2} {3} {4}".format(time_stamp, pattern[0][1], status, size_bytes, src_ip)
						self.lines_log_http.append(line_log)
					except:
						pass

		if log_type == "https":
			for line in logs:
				line_timestamp = re.match(r"(\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2})", line).group()
				date_time = datetime.strptime(line_timestamp, '%m/%d/%Y-%H:%M:%S')
				time_stamp = int(time.mktime(date_time.timetuple()))
				time_db = datetime.fromtimestamp(int(time_stamp)).strftime('%Y-%m-%d %H:%M:%S')

				line_url = re.findall(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}).*SNI='([?!:\/\/a-zA-Z0-9-_.=&]+)'", line.rstrip())

				if len(line_url) > 0:
					url = line_url[0][1]
					is_ip = re.match(r"^(?:http|ftp)s?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\:\d{1,5})?(\/)?$", url)

					if not is_ip:
						try:
							size_byte = check_output(["curl", "-o", "/dev/null", "-s",  "-w", "%{size_download}", hostname])
						except Exception as error:
							size_byte = randint(1024, 1048576)
					else:
						size_byte = randint(1024, 1048576)

					if size_byte == 0:
						size_byte = randint(1024, 1048576)

					src_ip = line_url[0][0]

					try:
						line_log = "{0} {1} {2} {3}".format(time_stamp, url, src_ip, size_byte)
						self.lines_log_https.append(line_log)
					except:
						pass

		if log_type == "alerts":
			for line in logs:
				alert = re.findall(r"(\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}).\d{6}\s\s(\[w?Drop\]\s|)\[(\*{2})\]\s\[(\d+):(\d+):(\d+)\]\s(.*)\[\*{2}\]\s\[Classification:\s(.*)\]\s\[Priority:\s(\d+)\]\s\{([a-zA-Z]*)}\s(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d{1,})\s(->|<-)\s(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}:\d{1,})", line.rstrip())

				if len(alert) > 0:
					line_timestamp = alert[0][0]
					date_time = datetime.strptime(line_timestamp, '%m/%d/%Y-%H:%M:%S')
					time_stamp = int(time.mktime(date_time.timetuple()))
					id_rule = alert[0][4]

					if (alert[0][1] == "[Drop] ") or (alert[0][1] == "[wDrop] "):
						action = "drop"
					else:
						action = "alert"

					rule = alert[0][6]
					group_r = alert[0][7]
					group_rule = group_r.replace(" ","-")
					classification = alert[0][8]
					protocol = alert[0][9]
					src_ip_port = alert[0][10]
					direction = alert[0][11]
					dst_ip_port = alert[0][12]

					try:
						line_log = "{0} {1} {2} {3} {4} {5} {6} {7} {8} {9}".format(time_stamp, id_rule, action, rule, group_rule, classification, protocol, src_ip_port, direction, dst_ip_port)
						self.lines_log_alerts.append(line_log)
					except:
						pass

		if log_type == "sshd":
			for line in logs:
				action = ""
				sshd = re.findall(r"([a-zA-Z]*\s{1,2}\d{1,2}\s\d{1,2}:\d{1,2}:\d{1,2})\s([_a-zA-Z0-9\_\-]*)\s([a-zA-Z\[\d{1,5}\]]*):\s([a-zA-Z]*\s[a-zA-Z- \/]*)\s([a-zA-Z]*)\s([a-zA-Z]*)\s(([A-Za-z]*)|(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}))\s([a-zA-Z]*)\s(\d{1,5})", line.rstrip(), re.MULTILINE)

				if len(sshd) > 0:
					line_timestamp = datetime.now()
					date_time = line_timestamp.strftime("%m/%d/%Y-%H:%M:%S")
					date_time2 = datetime.strptime(date_time, '%m/%d/%Y-%H:%M:%S')
					time_stamp = int(time.mktime(date_time2.timetuple()))

					if sshd[0][3] == "Accepted keyboard-interactive/pam for":
						action = "connect"
						user = sshd[0][4]
						src_ip = sshd[0][6]
						port = sshd[0][10]
						date = sshd[0][0]
						date = date.replace(" ","-")

					elif sshd[0][3] == "Disconnected from":
						action = "disconnect"
						user = sshd[0][5]
						src_ip = sshd[0][6]
						port = sshd[0][10]
						date = sshd[0][0]
						date = date.replace(" ","-")

					try:
						line_log = "{0} {1} {2} {3} {4} {5}".format(time_stamp, action, user, src_ip, port, date)
						self.lines_log_sshd.append(line_log)
					except:
						pass

		if log_type == "filter":
			file_path = "/tmp/rules.debug"
			ridentifier_labels = {}
			interfaces_descr = {}

			if os.path.exists(file_path):
				regex_ridentifier = re.compile(r'ridentifier\s+(\d+)')
				regex_labels = re.compile(r'label\s+"([^"]+)"')

				with open(file_path, 'r') as file:
					for line in file:
						if "ridentifier" in line:
							ridentifier_match = regex_ridentifier.search(line)
							if ridentifier_match:
								ridentifier = ridentifier_match.group(1)
								labels = regex_labels.findall(line)
								if not labels:
									labels = ["-"]
								ridentifier_labels[ridentifier] = labels

			interfaces_descr = {}

			for key_interface, values_interface in xmldoc["interfaces"].items():
				if_real = values_interface.get("if", "-")
				descr = values_interface.get("descr", "-")
				if len(descr) > 0:
					interfaces_descr[if_real] = "{}|{}|{}".format(key_interface, descr, if_real)
					continue
				interfaces_descr[if_real] = "{}|{}".format(key_interface, if_real)

			for line in logs:
				try:
					filter_line = re.findall(r"(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+\S+\s+filterlog\[\d+\]:.\d+,?(\w+)?,?(\w+)?,?(\d+)\,(\w+),\w+,(\w+),(\w+),(\d+)", line.rstrip(), re.MULTILINE)
					filter_ip_protocol = filter_line[0][-1]

					if len(filter_ip_protocol) > 0:
						date_action = ""
						rule_id = ""
						interface_target = ""
						rule_action = ""
						packet_direction = ""
						protocol = ""
						packet_size = ""
						src_ip = ""
						dst_ip = ""
						src_port = ""
						dst_port = ""

						if filter_ip_protocol == "4":
							filter_line = re.findall(r"(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+\S+\s+filterlog\[\d+\]:.\d+,?(\w+)?,?(\w+)?,?(\d+)\,(\w+),\w+,(\w+),(\w+),4,\w+,?,?\w+,\w+,\w+,\w+,\w+,(\w+),(\w+),(\d{1,3}(?:\.\d{1,3}){3}),(\d{1,3}(?:\.\d{1,3}){3}),(\d+),(\d+)", line.rstrip(), re.MULTILINE)
							packet_size = filter_line[0][8]
							src_ip = filter_line[0][9]
							dst_ip = filter_line[0][10]
							src_port = filter_line[0][11]
							dst_port = filter_line[0][12]
						elif filter_ip_protocol == "6":
							filter_line = re.findall(r"(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+\S+\s+filterlog\[\d+\]:.\d+,?(\w+)?,?(\w+)?,?(\d+)\,(\w+),\w+,(\w+),(\w+),6,\w+,?,?\w+,\w+,\w+,(\w+),\w+,\w+,([\w\:]+),([\w\:]+),(\d+),(\d+),(\d+)", line.rstrip(), re.MULTILINE)
							packet_size = filter_line[0][12]
							src_ip = filter_line[0][8]
							dst_ip = filter_line[0][9]
							src_port = filter_line[0][10]
							dst_port = filter_line[0][11]
						else:
							continue

						date_action = filter_line[0][0]
						rule_id = filter_line[0][3]
						interface_target = filter_line[0][4]
						rule_action = filter_line[0][5]
						packet_direction = filter_line[0][6]
						protocol = filter_line[0][7].lower()

						date_action = datetime.strptime("{} {}".format(date_action, datetime.now().year), "%b %d %H:%M:%S %Y")
						date_action = date_action.strftime("%Y-%m-%d %H:%M:%S").replace(" ", "_")

						line_timestamp = datetime.now()
						date_time = line_timestamp.strftime("%m/%d/%Y-%H:%M:%S")
						date_time = datetime.strptime(date_time, '%m/%d/%Y-%H:%M:%S')
						time_stamp = int(time.mktime(date_time.timetuple()))

						rule_description = ridentifier_labels.get("{}".format(rule_id), ["-"])[0].replace(" ", "_")

						interface_target = interfaces_descr.get(interface_target, interface_target).replace(" ", "_")

						line_log = "{0} {1} {2} {3} {4} {5} {6} {7} {8} {9} {10} {11} {12}".format(\
							time_stamp,\
							interface_target,\
							protocol,\
							packet_direction,\
							packet_size,\
							src_ip,\
							src_port,\
							dst_ip,\
							dst_port,\
							rule_id,\
							rule_action,\
							rule_description,\
							date_action)

						self.lines_log_filter.append(line_log)
				except:
					pass

	def run(self):
		if self.log_type == 'http':
			lines_http = []

			for line in self.lines_log_http:
				if len(line.split()) == 5:
					lines_http.append(line.split())

			self.log_http = categorize_netfilter_fapp(lines_http, "http")
			start_insert_data_fapp_http = insert_data_fapp(self.log_http, self.log_type)
			start_insert_data_fapp_http.start()
		if self.log_type == "https":
			lines_https = []

			for line in self.lines_log_https:
				if len(line.split()) == 4:
					lines_https.append(line.split())

			self.log_https = categorize_netfilter_fapp(lines_https, "https")
			start_insert_data_fapp_https = insert_data_fapp(self.log_https, self.log_type)
			start_insert_data_fapp_https.start()
		if self.log_type == "alerts":
			lines_alerts = []

			for line in self.lines_log_alerts:
				lines_alerts.append(line.split())

			self.log_alerts = lines_alerts
			start_insert_data_fapp_alerts = insert_data_fapp(self.log_alerts, self.log_type)
			start_insert_data_fapp_alerts.start()
		if self.log_type == "sshd":
			lines_sshd = []

			for line in self.lines_log_sshd:
				lines_sshd.append(line.split())

			self.log_sshd = lines_sshd
			start_insert_data_fapp_sshd = insert_data_fapp(self.log_sshd, self.log_type)
			start_insert_data_fapp_sshd.start()
		if self.log_type == "filter":
			lines_filter = []

			for line in self.lines_log_filter:
				lines_filter.append(line.split())

			self.log_filter = lines_filter
			start_insert_data_fapp_filter = insert_data_fapp(self.log_filter, self.log_type)
			start_insert_data_fapp_filter.start()

class insert_data_fapp(Thread):
	global log_referer
	global garbage

	def __init__(self, insert_logs, log_type):
		Thread.__init__(self)
		self.log_type = log_type
		self.insert_logs = insert_logs
		self.time = ""
		self.host = ""

		self.conn = connect_db()
		self.insert = self.conn.cursor()

		if log_type == 'http':
			self.s_insert = "insert into http(time_date, ip, username, groupname, url_str, size_bytes, blocked, url_no_qry, url_path, categories) values ('{}','{}','{}','{}','{}','{}','{}','{}','{}','{}')"

		if log_type == 'https':
			self.s_insert = "insert into https(time_date, ip, username, groupname, url_str, size_bytes, blocked, url_no_qry, url_path, categories) values ('{}','{}','{}','{}','{}','{}','{}','{}','{}','{}')"

		if log_type == 'alerts': 
			self.s_insert = "insert into alerts(time_date, id_rule, action, rule, classification, priority, protocol, src_ip_port, dir, dst_ip_port) values ('{}','{}','{}','{}','{}','{}','{}', '{}', '{}', '{}')"

		if log_type == 'sshd': 
			self.s_insert = "insert into sshd(time_date, action, user, src_ip, port, date) values ('{}','{}','{}','{}','{}','{}')"

		if log_type == 'filter':
			self.s_insert = "insert into filter(time_date, interface, protocol, packet_direction, packet_size, ip1, port1, ip2, port2, rule_id, rule_action, rule_description, date_action) values ('{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}')"

	def run(self):
		try:
			logs = [log for log in self.insert_logs]

			for log in logs:
				self.time = datetime.fromtimestamp(int(log[0])).strftime('%Y-%m-%d %H:%M:%S')

				if xmldoc['system']['firewallapp']['type'] == 1:
					conn = sqlite3.connect('/var/db/captiveportalfirewallapp_lan.db')
					cursor = conn.cursor()

					cursor.execute("SELECT username FROM captiveportal where ip='{}'".format(log[2]))

					row = cursor.fetchone()[0]

					conn.close()

					if row != "":
						self.host = row
				else:
					self.host = ""

				if self.log_type == 'alerts':
					self.insert.execute(self.s_insert.format(
						self.time,
						log[1],
						log[2],
						log[3],
						log[4],
						log[5],
						log[6],
						log[7],
						log[8],
						log[9]
					))
				elif self.log_type == 'sshd':
					self.insert.execute(self.s_insert.format(
						self.time,
						log[1],
						log[2],
						log[3],
						log[4],
						log[5]
					))
				elif self.log_type == 'filter':
					self.insert.execute(self.s_insert.format(
						self.time,
						log[1].replace("_", " "),
						log[2],
						log[3],
						log[4],
						log[5],
						log[6],
						log[7],
						log[8],
						log[9],
						log[10],
						log[11].replace("_", " "),
						log[12].replace("_", " "),
					))
				elif self.log_type == 'http':
					self.insert.execute(self.s_insert.format(
						self.time,
						log[1],
						self.host,
						log[3],
						log[4],
						log[5],
						log[6],
						log[7],
						log[8],
						log[9]
					))
				elif self.log_type == 'https':
					self.insert.execute(self.s_insert.format(
						self.time,
						log[1],
						self.host,
						log[3],
						log[4],
						log[5],
						log[6],
						log[7],
						log[8],
						log[9]
					))
				else:
					self.insert.execute(self.s_insert.format(
						self.time,
						log[2],
						self.host,
						'',
						log[1],
						log[3],
						0,
						0,
						'',
						'',
						''
					))

				self.conn.commit()

				lastid = int(self.insert.lastrowid)

				if len(log) == 10:
					for id_categories in re.split(',', log[9]):
						if self.log_type == "http":
							self.insert.execute("insert into access_categories (accesses_id, accesses_id_http, categories_id) values ('{}', '{}', '{}')".format(0, lastid, int(re.sub('-', '99', id_categories))))
							self.conn.commit()
						if self.log_type == "https":
							self.insert.execute("insert into access_categories (accesses_id, accesses_id_https, categories_id) values ('{}', '{}', '{}')".format(0, lastid, int(re.sub('-', '99', id_categories))))
							self.conn.commit()

			self.conn.commit()
			self.insert.close()
			self.conn.close()

		except Exception as error:
			error_message.info("INSERT DATA: {}".format(error))

def set_prestart():
	if os.path.exists('/var/run/wfrotated.pid'):
		os.unlink('/var/run/wfrotated.pid')

	print(str(os.getpid()), file=open('/var/run/wfrotated.pid', 'w'))
	time.sleep(1)

def create_wft(wft_host):
	if os.path.exists('/usr/local/bin/wft_log.sh'):
		os.unlink('/usr/local/bin/wft_log.sh')

	data_wft = """#!/bin/sh
#
# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# <desenvolvimento@bluepex.com>, 2015
# Rewrite Guilherme R.Brechot <guilherme.brechot@bluepex.com>, 2025
# ====================================================================
#

while read LINE
do
	echo "${{LINE}}" | grep -Eq 'redirector\[[0-9]+\]:' || continue

	set -- $(echo "${{LINE}}" | awk '{{print $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12}}')

	RULE=$9

	if [ "${{RULE}}" = "-" ]
	then
		LINE=$(echo "${{LINE}}" | awk -v new_value="99" '{{
			for (i = 1; i <= NF; i++) {{
				if (i == 9) {{
					printf new_value " "
				}} else {{
					printf $i " "
				}}
			}}
		}}' | sed 's/ $//')
	fi

	echo "${{LINE}}" | nc -w 1 -U {} &
done""".format(wft_host)

	print(data_wft, file=open('/usr/local/bin/wft_log.sh', 'a'))
	os.system('/bin/chmod +x /usr/local/bin/wft_log.sh; exit 0')

	if os.path.exists('/usr/local/bin/bp_category_redis_fapp.sh'):
		os.unlink('/usr/local/bin/bp_category_redis_fapp.sh')

	data_wft = """#!/bin/sh
#
# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# <desenvolvimento@bluepex.com>, 2015
# Rewrite Guilherme R.Brechot <guilherme.brechot@bluepex.com>, 2025
# ====================================================================
#

bp_possible_variations() {
	local INPUT_VALUE=$1

	# Split the INPUT_VALUE into dot-separated parts
	OLD_IFS=$IFS
	IFS='.'; set -- $INPUT_VALUE; IFS=$OLD_IFS

	# Put the parts in a list
	parts=""
	for part in "$@"; do
		parts="$parts $part"
	done

	# Count how many parts it has (number of separators = parts - 1)
	set -- $parts
	num_parts=$#
	num_dots=$(($num_parts - 1))
	max=$((1 << num_dots)) # 2^n combinations

	RETURN_VALUE=""

	i=0
	while [ $i -lt $max ]
	do
		j=1
		result=$(echo $parts | cut -d' ' -f1)
		while [ $j -lt $num_parts ]
		do
			bit=$(( (i >> (j - 1)) & 1 ))
			if [ $bit -eq 1 ]
			then
				sep=","
			else
				sep="."
			fi
			next=$(echo $parts | cut -d' ' -f$((j + 1)))
			result="${result}${sep}${next}"
			j=$((j + 1))
		done
		RETURN_VALUE="$RETURN_VALUE $result"
		i=$((i + 1))
	done

	echo "$RETURN_VALUE"
}

URL=$1

# Generates a range of possible addresses to align with the netfilter scheme
VARIATIONS_URL=""

# Optional snippet, I can get the netfilter address directly and work with it
# -----------------------------------------------------------------------------------------------
for PROTOCOL_HTTP in "http://" "https://" #"http://www." "https://www."
do
	for AFTER_DOMAIN in "" "/" #".com" ".com/" ".br" ".br/" ".com.br" ".com.br/"
	do
		POSSIBLE_VALUE=$(bp_possible_variations "${PROTOCOL_HTTP}${URL}${AFTER_DOMAIN}")
		if [ "$VARIATIONS_URL" = "" ]
		then
			VARIATIONS_URL="$POSSIBLE_VALUE"
		else
			VARIATIONS_URL="$VARIATIONS_URL $POSSIBLE_VALUE"
		fi
	done
done
# -----------------------------------------------------------------------------------------------

VARIATIONS_URL=$(echo "$VARIATIONS_URL" | tr 'a-z' 'A-Z')

REDIS_VALUE=$(/usr/local/bin/redis-cli --raw mget $VARIATIONS_URL | /usr/bin/tr -d '\r' | /usr/bin/sed '/^$/d' | /usr/bin/tr ',' '\n' | /usr/bin/sed '/^$/d' | /usr/bin/sort -n -u | /usr/bin/paste -sd ',' -)

if [ "$REDIS_VALUE" = "" ]
then
	echo "99"
	exit
fi

echo "$REDIS_VALUE"
"""

	print(data_wft, file=open('/usr/local/bin/bp_category_redis_fapp.sh', 'a'))
	os.system('/bin/chmod +x /usr/local/bin/bp_category_redis_fapp.sh; exit 0')

def send_mail():
	c_email = "gnteste@gmail.com"
	user = "gnteste"
	passwd = "Gn.teste."

	if os.path.exists('/etc/serial'):
		serial = check_output(['/bin/cat /etc/serial'], shell=True).decode('utf-8').rstrip()
	else:
		serial = ''

	wan_ip = check_output(["echo 'cat //interfaces/wan/ipaddr' | /usr/local/bin/xmllint --shell /cf/conf/config.xml | sed '/^\/ >/d' | sed 's/<[^>]*.//g'"], shell=True).decode('utf-8')
	host = check_output(['/bin/hostname'], shell=True).decode('utf-8').rstrip()
	msg = MIMEText("""
Rotacionamento de logs parado!
Hostname:   {}
Serial:     {}
WAN Ip:     {}
""".format(host, serial, wan_ip))
	msg['Subject'] = "{}: Rotacionamento de logs parado! [TESTE]".format(host)
	msg['From'] = email.utils.formataddr((host, c_email))

	try:
		server = smtplib.SMTP("smtp.gmail.com:587")
		server.starttls()
		server.login(user, passwd)

		for cont in get_config('contatos'):
			msg['To'] = email.utils.formataddr(("BP Analyst", cont))
			server.sendmail(c_email, cont, msg.as_string())

		server.quit()
		error_message.info("WFMonitor: Email enviado...")
	except Exception as error:
		error_message.info("Email não enviado..")
		error_message.info("SendMail: {}".format(error))


def check_syslogd():
	get_time = time.time()

	while (get_syslogd_processes() > 1 or time.time() - get_time > 300):
		call(['/bin/pkill -f "syslogd -s"'], shell=True)

	if (get_syslogd_processes() != 1):
		call(['service syslogd restart'], shell=True)


def check_mysql_entry():
	check_time = get_config('time_mysql_entry')
	conn = connect_db()

	if (conn):
		cur = conn.cursor()
		cur.execute('select time_date from accesses order by id desc limit 1')
		date_tmp = cur.fetchone()
		
		if date_tmp:
			get_entry_time = time.mktime(date_tmp[0].timetuple())
		else:
			error_message.info("WFMonitor: Nao houve entrada no banco a mais de {} segundos...".format(check_time))

			return True
	
		if time.time() - get_entry_time > check_time:
			error_message.info("WFMonitor: Ultima entrada no banco a mais de {} segundos...".format(check_time))

			return False
		else:
			error_message.info("WFMonitor: Ultima entrada no banco em menos de {} segundos...".format(check_time))

			return True
	else:
		error_message.info("WF_MONITOR: Não foi possivel conectar ao banco.")

		return False


class check_reverse_proxy_log(Thread):
	def __init__(self):
		Thread.__init__(self)
		self.log_file = "/var/log/reverse_proxy.log"

	def run(self):
		while True:
			if os.path.exists(self.log_file):
				log_size = os.path.getsize(self.log_file)

				if log_size > 1024000:
					os.system('/bin/mv {} {}.1'.format(self.log_file, self.log_file))
			time.sleep(60)

