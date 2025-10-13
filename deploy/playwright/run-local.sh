set -xe

PGDATABASE=saltcorn_test saltcorn reset-schema -f
PGDATABASE=saltcorn_test saltcorn create-user -a -e myproject19july@mailinator.com -p myproject19july
PGDATABASE=saltcorn_test saltcorn serve -p 3014