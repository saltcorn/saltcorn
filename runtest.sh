#!/usr/bin/env bash

set -e

createdb saltcorn_test
trap "sleep 1; dropdb saltcorn_test" EXIT

export PGDATABASE=saltcorn_test 

saltcorn fixtures -r

if [ -z "$1" ]
then
    lerna run test
else
    cd packages/$1
    npm run test
fi


