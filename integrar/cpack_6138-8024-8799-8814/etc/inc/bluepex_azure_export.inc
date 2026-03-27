<?php

if (!function_exists('bluepex_get_env_map')) {
    function bluepex_get_env_map() {
        $envPath = '/usr/local/bin/.env';
        $map = [];
        if (!file_exists($envPath) || !is_readable($envPath)) {
            return $map;
        }

        $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            return $map;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0) {
                continue;
            }
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }
            $k = trim($parts[0]);
            $v = trim($parts[1]);
            if ($k !== '') {
                $map[$k] = $v;
            }
        }

        return $map;
    }
}

if (!function_exists('bluepex_tenant_from_authority')) {
    function bluepex_tenant_from_authority($authority) {
        $authority = trim((string)$authority);
        if ($authority === '') {
            return '';
        }
        $parts = explode('/', rtrim($authority, '/'));
        return count($parts) ? trim(end($parts)) : '';
    }
}

if (!function_exists('bluepex_azure_tags_block')) {
    function bluepex_azure_tags_block() {
        $env = bluepex_get_env_map();

        $clientId = isset($env['CLIENT_ID']) ? trim($env['CLIENT_ID']) : '';
        $tenantId = '';
        if (!empty($env['AUTHORITY'])) {
            $tenantId = bluepex_tenant_from_authority($env['AUTHORITY']);
        }

        $serverApi = '';
        if (!empty($env['SERVER_API'])) {
            $serverApi = trim($env['SERVER_API']);
        } elseif (!empty($env['FASTAPI_SERVER'])) {
            $serverApi = rtrim(trim($env['FASTAPI_SERVER']), '/') . '/publish';
        } else {
            $serverApi = 'http://wsutm.bluepex.com:30001/publish';
        }

        if ($clientId === '' || $tenantId === '') {
            return '';
        }

        $scope = 'https://graph.microsoft.com/.default openid profile offline_access';

        $tags = "\n#AZURE:client_id={$clientId}\n";
        $tags .= "#AZURE:tenant_id={$tenantId}\n";
        $tags .= "#AZURE:scope={$scope}\n";
        $tags .= "#AZURE:server_api={$serverApi}\n";

        return $tags;
    }
}

if (!function_exists('bluepex_append_azure_tags_if_ovpn')) {
    function bluepex_append_azure_tags_if_ovpn($output) {
        if (!is_string($output) || $output === '') {
            return $output;
        }

        if (strpos($output, '#AZURE:client_id=') !== false) {
            return $output;
        }

        $looksLikeHtml = (stripos($output, '<html') !== false || stripos($output, '<!doctype') !== false);
        $looksLikeOvpn = (strpos($output, "\nclient\n") !== false || strpos($output, "\nremote ") !== false || strpos($output, 'auth-user-pass') !== false);

        if ($looksLikeHtml || !$looksLikeOvpn) {
            return $output;
        }

        $tags = bluepex_azure_tags_block();
        if ($tags === '') {
            return $output;
        }

        return rtrim($output, "\n") . "\n" . ltrim($tags, "\n");
    }
}

if (!function_exists('bluepex_start_export_buffer')) {
    function bluepex_start_export_buffer() {
        if (defined('BLUEPEX_AZURE_EXPORT_BUFFER_STARTED')) {
            return;
        }
        define('BLUEPEX_AZURE_EXPORT_BUFFER_STARTED', true);
        ob_start('bluepex_append_azure_tags_if_ovpn');
    }
}
