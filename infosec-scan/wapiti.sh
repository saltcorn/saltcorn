#!/usr/bin/env bash

set -e 

if [[ $# -eq 0 ]] ; then
    echo 'wapiti.sh URL'
    exit 0
fi

source infosec_scan_tmp/wapiti/bin/activate

if [[ $# -eq 1 ]] ; then
   wapiti -u $1
fi

if [[ $# -eq 3 ]] ; then
   wapiti-getcookie -c /tmp/cookies.txt -u $1/auth/login -a $2%$3 
   wapiti -u $1 -x $1/auth/logout -c /tmp/cookies.txt
fi

