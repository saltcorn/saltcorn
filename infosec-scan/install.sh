#!/usr/bin/env bash


#check we have python 2 and 3
python3 -V || { echo 'need to install python3' ; exit 1; }
python2 -V || { echo 'need to install python2' ; exit 1; }
virtualenv --version || { echo 'need to install virtualenv' ; exit 1; }

set -Eeuxo pipefail

rm -rf infosec_scan_tmp/
mkdir -p infosec_scan_tmp/
python3 -m venv infosec_scan_tmp/wapiti

source infosec_scan_tmp/wapiti/bin/activate
pip install wheel
pip install wapiti3
deactivate

virtualenv infosec_scan_tmp/w3af -p `which python2`