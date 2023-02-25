#!/usr/bin/env bash

set -e

PGDATABASE=saltcorn_test
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR
PATH=../../packages/saltcorn-cli/bin/:$PATH

for filename in with_fixtures/*.pch; do
  saltcorn reset-schema -f

  echo Restoring test application backup...
  saltcorn fixtures

  echo Starting background Saltcorn server...
  saltcorn serve -p 3012 &
  SCPID=$!
  trap "kill $SCPID" EXIT

  while ! nc -z localhost 3012; do   
    sleep 0.2 
  done

  npx pupcheck $filename
done
