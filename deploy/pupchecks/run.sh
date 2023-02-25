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
  SCPID1=$!
  trap "kill $SCPID1" EXIT

  while ! nc -z localhost 3012; do   
    sleep 0.2 
  done

  PUPCHECK_BASE_URL="http://localhost:3012" npx pupcheck -H $filename
done


for filename in no_fixtures/*.pch; do
  saltcorn reset-schema -f

  echo Restoring test application backup...

  echo Starting background Saltcorn server...
  saltcorn serve -p 3013 &
  SCPID2=$!
  trap "kill $SCPID2" EXIT

  while ! nc -z localhost 3013; do   
    sleep 0.2 
  done

  PUPCHECK_BASE_URL="http://localhost:3013" npx pupcheck -H $filename
done
