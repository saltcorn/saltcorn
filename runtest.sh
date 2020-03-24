#!/usr/bin/env bash

set -e

createdb saltcorn_test
trap "dropdb saltcorn_test" EXIT
PGDATABASE=saltcorn_test node packages/saltcorn/db/reset_schema.js
PGDATABASE=saltcorn_test node packages/saltcorn/db/fixtures.js
PGDATABASE=saltcorn_test lerna run test

