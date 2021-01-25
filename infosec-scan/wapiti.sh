#!/usr/bin/env bash

set -e 

if [[ $# -eq 0 ]] ; then
    echo 'wapiti.sh URL'
    exit 0
fi

source infosec_scan_tmp/wapiti/bin/activate


wapiti -u $1