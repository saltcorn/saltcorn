#!/usr/bin/env bash
set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR
saltcorn reset-schema -f

echo Starting background Saltcorn server...
saltcorn serve -p 3012 &
SCPID=$!
trap "kill $SCPID" EXIT

while ! nc -z localhost 3012; do   
  sleep 0.2 
done

npx playwright test