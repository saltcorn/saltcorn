#!/usr/bin/env bash

createdb saltcorn_test
PGDATABASE=saltcorn_test node packages/saltcorn/db/reset_schema.js
PGDATABASE=saltcorn_test node packages/saltcorn/db/fixtures.js
(cd packages/saltcorn/ && PGDATABASE=saltcorn_test npm run test)
dropdb saltcorn_test
