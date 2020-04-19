#!/usr/bin/env bash

set -e

createdb saltcorn_test
trap "sleep 1; dropdb saltcorn_test" EXIT

export PGDATABASE=saltcorn_test 

node packages/saltcorn-data/db/reset_schema.js
node packages/saltcorn/fixtures.js

if [ -z "$1" ]
then
    lerna run test
else
    cd packages/$1
    npm run test
fi


