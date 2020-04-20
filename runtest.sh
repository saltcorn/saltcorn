#!/usr/bin/env bash

set -e

export PGDATABASE=saltcorn_test 

saltcorn fixtures -r

if [ -z "$1" ]
then
    lerna run test
else
    cd packages/$1
    npm run test
fi


