#!/usr/bin/env bash
set -e

BUILD_DIR=/tmp/saltcorn_build
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR
PATH=../../packages/saltcorn-cli/bin/:$PATH
PGDATABASE=saltcorn_test saltcorn reset-schema -f
PGDATABASE=saltcorn_test saltcorn restore ./backups/guitars_backup.zip
PGDATABASE=saltcorn_test saltcorn build-app -p web -e guitar_feed -t view -b $BUILD_DIR -u admin@foo.com -s http://localhost:3000

# put tables.json into test_schema.js like this: var _test_schema_ = [content from tables.json]
if [ -f $BUILD_DIR/www/data/tables.json ]; then
  echo "var _test_schema_ = $(cat $BUILD_DIR/www/data/tables.json)" > $BUILD_DIR/www/data/test_schema.js
fi

echo Starting background Saltcorn server...
PGDATABASE=saltcorn_test SALTCORN_SERVE_MOBILE_TEST_BUILD=/tmp/saltcorn_build/www saltcorn serve -p 3000 &
SCPID=$!
trap "kill $SCPID" EXIT

while ! nc -z localhost 3000; do
  sleep 0.2
done

npx playwright test
