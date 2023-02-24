#!/usr/bin/env bash

set -e

PGDATABASE=saltcorn_test
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR
../../packages/saltcorn-cli/bin/saltcorn reset-schema -f

echo Restoring test application backup...
../../packages/saltcorn-cli/bin/saltcorn restore ../../packages/saltcorn-random-tests/backup-files/sc-backup-sub2-2023-01-06-21-49.zip

echo Starting background Saltcorn server...
../../packages/saltcorn-cli/bin/saltcorn serve -p 3012 &
SCPID=$!
trap "kill $SCPID" EXIT

while ! nc -z localhost 3012; do   
  sleep 0.2 
done

npx pupcheck e2e.pch