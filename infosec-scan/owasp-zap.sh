#!/usr/bin/env bash

set -e 

if [[ $# -eq 0 ]] ; then
    echo 'owasp-zap.sh URL'
    exit 0
fi

source infosec_scan_tmp/zapcli/bin/activate
export ZAP_PATH=$PWD/infosec_scan_tmp/ZAP_2.10.0

 zap-cli quick-scan --self-contained --spider -r -s xss $1