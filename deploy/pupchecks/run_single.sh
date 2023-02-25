#!/usr/bin/env bash

set -e

echo Starting background Saltcorn server...
saltcorn serve -p 3012 &
SCPID=$!
trap "kill $SCPID" EXIT

while ! nc -z localhost 3012; do   
  sleep 0.2 
done

PUPCHECK_BASE_URL="http://localhost:3012" npx pupcheck $1