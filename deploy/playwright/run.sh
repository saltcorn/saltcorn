#!/usr/bin/env bash
set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR
PATH=../../packages/saltcorn-cli/bin/:$PATH
PGDATABASE=saltcorn_test saltcorn reset-schema -f

echo Starting background Saltcorn server...
PGDATABASE=saltcorn_test saltcorn serve -p 3014 &
SCPID=$!
trap "kill $SCPID" EXIT

while ! nc -z localhost 3014; do   
  sleep 0.2 
done

npx playwright test