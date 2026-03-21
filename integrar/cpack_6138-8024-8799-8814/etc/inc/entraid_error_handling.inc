<?php
# ====================================================================
# Copyright (C) BluePex Security Solutions - All rights reserved
# Unauthorized copying of this file, via any medium is strictly prohibited
# Proprietary and confidential
# Written by Allan Vilas Boas <allan.vilas@bluepex.com>, 2025
# ====================================================================

define("SCRIPT_NAME", $_SERVER['REQUEST_URI']);
define("ENTRAID_DEFAULT_ERROR_MSG",
	[
		'title' => gettext('Connection Error'),
		'message' => gettext('It appears there has been an error; please contact the network administrator.'),
	]
);

/**
* Handles errors generated during the authentication process,
* Allows logging to the syslog, launching proposals, and optionally
* Redirect the user to an error page.
*
* --- --- * General behavior:
* - Can log an error message to the syslog
* - Can redirect the user to an error page by sending the data via GET
* - Can throw an Exception with customized code and message
* --- --- * Parameters:
*
* @param string $title
* Friendly title for display in the error interface.
* Default: "Error"
*
* @param string $message
* Detailed error message. Used for both logging and for proposals.
* Default: "An error occurred during the authentication process." *
*
* @param bool $should_throw_exception
* Define whether the function should throw an exception after logging/forwarding the error.
* Default: true
*
* @param bool $should_log_to_syslog
* Indicates whether the error should be logged to the system syslog.
* Default: true
*
* @param int $error_code
* Error code associated with the thrown exception.
* Default: 400
*
* @param bool $should_redirect
* If true, the function redirects the user to an error page,
* sending data via GET (`?data=...`).
* Default: false
*
* @param string|null $redirect_page
* Path to the redirect page.
* If not specified, use `/entraid_saml/entraid_error.php`.
*
* ---
* Redirection:
* If `$should_redirect` is true, the function sends:
* - `Location: {redirect_page}?data={json_urlencoded}`
*
* The payload sent follows this structure:
* [
* 'title' => string,
* 'message' => string
* ]
* Or ENTRAID_DEFAULT_ERROR_MSG, consider the defined case.
*
* ---
* Exception:
* If `$should_throw_exception` is true, an Exception will be thrown:
* throw new Exception($message, $error_code);
*
* ---
* Log:
* If `$should_log_to_syslog` is true, log to syslog:
* SCRIPT_NAME + $ message
*
* ---
* Return:
* - No explicit return.
* - Execution may be interrupted by redirection or by an Exception.
*
*/
function entraid_handle_error($title=null, $message=null, $should_throw_exception=true, $should_log_to_syslog=true, $error_code=400, $should_redirect=true, $redirect_page="/entraid_saml/entraid_error.php") {
	if ($should_log_to_syslog) {
		syslog(LOG_ERR, SCRIPT_NAME . $message);
	}

	if ($should_redirect) {
		$redirect_response = [
			'title' => $title ?? ENTRAID_DEFAULT_ERROR_MSG['title'],
			'message' => $message  ?? ENTRAID_DEFAULT_ERROR_MSG['message']
		];

		header("Location: " .
			($redirect_page ?? "/entraid_saml/entraid_error.php") .
			"?data=" .
			urlencode(json_encode($redirect_response))
		);
	}

	if ($should_throw_exception) {
		throw new Exception($message,$error_code);
	}
}
