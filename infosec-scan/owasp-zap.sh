#!/usr/bin/env bash

set -e 

if [[ $# -eq 0 ]] ; then
    echo 'owasp-zap.sh URL'
    exit 0
fi


infosec_scan_tmp/ZAP_2.10.0/zap.sh \
   -daemon -config api.disablekey=true -port 8090 &
ZAP_PID=$!
source infosec_scan_tmp/zapcli/bin/activate


# wait for zap port to open
while ! nc -z localhost 8090; do   
  sleep 0.1 
done

zap-cli quick-scan --spider -r -s all $1
zap-cli report -o zap.html -f html
zap-cli shutdown

sleep 1
kill $ZAP_PID || echo ''