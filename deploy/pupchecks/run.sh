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

  ./run_single.sh $filename
done


for filename in no_fixtures/*.pch; do
  saltcorn reset-schema -f

  ./run_single.sh $filename
done
