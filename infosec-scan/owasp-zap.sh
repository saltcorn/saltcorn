#!/usr/bin/env bash

set -e 

if [[ $# -eq 0 ]] ; then
    echo 'owasp-zap.sh URL'
    exit 0
fi

source infosec_scan_tmp/zapcli/bin/activate

infosec_scan_tmp/ZAP_2.10.0/zap.sh \
   -daemon -config api.disablekey=true -port 8090 &

while ! nc -z localhost 8090; do   
  sleep 0.1 
done

zap-cli shutdown