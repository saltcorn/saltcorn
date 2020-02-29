#!/usr/bin/env bash

createdb saltcorn_test
PGDATABASE=saltcorn_test node db/reset_schema.js
PGDATABASE=saltcorn_test node db/fixtures.js
PGDATABASE=saltcorn_test npm run test
dropdb saltcorn_test
