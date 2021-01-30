#!/usr/bin/env bash


#check we have python 2 and 3
python3 -V || { echo 'need to install python3' ; exit 1; }
java --version || { echo 'need to install java (apt: default-jre)' ; exit 1; }
#python2 -V || { echo 'need to install python2' ; exit 1; }
#virtualenv --version || { echo 'need to install virtualenv' ; exit 1; }

set -Eeo pipefail

rm -rf infosec_scan_tmp/
mkdir -p infosec_scan_tmp/
python3 -m venv infosec_scan_tmp/wapiti
python3 -m venv infosec_scan_tmp/zapcli

source infosec_scan_tmp/wapiti/bin/activate
pip install wheel
pip install wapiti3
deactivate

source infosec_scan_tmp/zapcli/bin/activate
pip install zapcli
deactivate

cd infosec_scan_tmp
curl -Ls https://github.com/zaproxy/zaproxy/releases/download/v2.10.0/ZAP_2.10.0_Linux.tar.gz >ZAP_2.10.0_Linux.tar.gz
tar -zxvf ZAP_2.10.0_Linux.tar.gz