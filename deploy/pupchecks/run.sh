#!/usr/bin/env bash

set -e

PGDATABASE=saltcorn_test
saltcorn reset-schema -f
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR

echo Restoring test application backup...
saltcorn restore ../../packages/saltcorn-random-tests/backup-files/sc-backup-sub2-2023-01-06-21-49.zip

echo Starting background Saltcorn server...
saltcorn serve -p 3012 &
SCPID=$!
trap "kill $SCPID" EXIT

while ! nc -z localhost 3012; do   
  sleep 0.1 
done

