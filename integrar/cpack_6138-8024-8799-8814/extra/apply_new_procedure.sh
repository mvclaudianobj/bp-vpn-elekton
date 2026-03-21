# Apply new procedure
echo "<?php" > /tmp/execute_php
echo "require_once('dataclick_report.inc');" >> /tmp/execute_php
echo "createEventToReports();" >> /tmp/execute_php
chmod +x /tmp/execute_php
/usr/local/bin/php -f /tmp/execute_php
/bin/rm /tmp/execute_php
