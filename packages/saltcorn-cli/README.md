# @saltcorn/cli

Saltcorn command line interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@saltcorn/cli.svg)](https://npmjs.org/package/@saltcorn/cli)
[![License](https://img.shields.io/npm/l/@saltcorn/cli.svg)](https://github.com/saltcorn/saltcorn/blob/master/package.json)

<!-- toc -->
* [@saltcorn/cli](#saltcorncli)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @saltcorn/cli
$ saltcorn COMMAND
running command...
$ saltcorn (-v|--version|version)
@saltcorn/cli/0.4.4-beta.2 darwin-x64 node-v15.11.0
$ saltcorn --help [COMMAND]
USAGE
  $ saltcorn COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`saltcorn add-schema`](#saltcorn-add-schema)
* [`saltcorn backup`](#saltcorn-backup)
* [`saltcorn create-tenant TENANT`](#saltcorn-create-tenant-tenant)
* [`saltcorn create-user`](#saltcorn-create-user)
* [`saltcorn fixtures`](#saltcorn-fixtures)
* [`saltcorn help [COMMAND]`](#saltcorn-help-command)
* [`saltcorn info`](#saltcorn-info)
* [`saltcorn install-pack`](#saltcorn-install-pack)
* [`saltcorn install-plugin`](#saltcorn-install-plugin)
* [`saltcorn list-tenants`](#saltcorn-list-tenants)
* [`saltcorn localize-plugin PLUGIN PATH`](#saltcorn-localize-plugin-plugin-path)
* [`saltcorn make-migration`](#saltcorn-make-migration)
* [`saltcorn migrate`](#saltcorn-migrate)
* [`saltcorn plugins`](#saltcorn-plugins)
* [`saltcorn reset-schema`](#saltcorn-reset-schema)
* [`saltcorn restore FILE`](#saltcorn-restore-file)
* [`saltcorn rm-tenant TENANT`](#saltcorn-rm-tenant-tenant)
* [`saltcorn run-benchmark [BASEURL]`](#saltcorn-run-benchmark-baseurl)
* [`saltcorn run-tests [PACKAGE]`](#saltcorn-run-tests-package)
* [`saltcorn scheduler`](#saltcorn-scheduler)
* [`saltcorn serve`](#saltcorn-serve)
* [`saltcorn set-cfg KEY VALUE`](#saltcorn-set-cfg-key-value)
* [`saltcorn setup`](#saltcorn-setup)
* [`saltcorn setup-benchmark`](#saltcorn-setup-benchmark)
* [`saltcorn test-plugin PATH`](#saltcorn-test-plugin-path)
* [`saltcorn transform-field EXPRESSION FIELD TABLE [TENANT]`](#saltcorn-transform-field-expression-field-table-tenant)

## `saltcorn add-schema`

Add Saltcorn schema to existing database

```
USAGE
  $ saltcorn add-schema
```

_See code: [src/commands/add-schema.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/add-schema.js)_

## `saltcorn backup`

Backup the PostgreSQL database to a file with pg_dump or zip

```
USAGE
  $ saltcorn backup

OPTIONS
  -o, --output=output  output filename
  -t, --tenant=tenant  tenant
  -z, --zip            zip format
```

_See code: [src/commands/backup.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/backup.js)_

## `saltcorn create-tenant TENANT`

Create a tenant

```
USAGE
  $ saltcorn create-tenant TENANT

ARGUMENTS
  TENANT  Tenant subdomain to create
```

_See code: [src/commands/create-tenant.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/create-tenant.js)_

## `saltcorn create-user`

Create a new user

```
USAGE
  $ saltcorn create-user

OPTIONS
  -a, --admin              Admin user
  -e, --email=email        email
  -p, --password=password  password
  -r, --role=role          role
  -t, --tenant=tenant      tenant
```

_See code: [src/commands/create-user.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/create-user.js)_

## `saltcorn fixtures`

Load fixtures for testing

```
USAGE
  $ saltcorn fixtures

OPTIONS
  -r, --reset  Also reset schema

DESCRIPTION
  ...
  This manual step it is never required for users and rarely required for developers
```

_See code: [src/commands/fixtures.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/fixtures.js)_

## `saltcorn help [COMMAND]`

display help for saltcorn

```
USAGE
  $ saltcorn help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_

## `saltcorn info`

Show paths

```
USAGE
  $ saltcorn info

OPTIONS
  -j, --json  json format

DESCRIPTION
  ...
  Show configuration and file store paths

ALIASES
  $ saltcorn paths
```

_See code: [src/commands/info.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/info.js)_

## `saltcorn install-pack`

Install a pack

```
USAGE
  $ saltcorn install-pack

OPTIONS
  -f, --file=file      File with pack JSON
  -n, --name=name      Pack name in store
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/install-pack.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/install-pack.js)_

## `saltcorn install-plugin`

Install a plugin

```
USAGE
  $ saltcorn install-plugin

OPTIONS
  -d, --directory=directory  Directory with local plugin
  -n, --name=name            Plugin name in store
  -t, --tenant=tenant        tenant
```

_See code: [src/commands/install-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/install-plugin.js)_

## `saltcorn list-tenants`

List tenants in CSV format

```
USAGE
  $ saltcorn list-tenants
```

_See code: [src/commands/list-tenants.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/list-tenants.js)_

## `saltcorn localize-plugin PLUGIN PATH`

Convert npm to local plugin

```
USAGE
  $ saltcorn localize-plugin PLUGIN PATH

ARGUMENTS
  PLUGIN  Current (npm) plugin name
  PATH    path to local plugin
```

_See code: [src/commands/localize-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/localize-plugin.js)_

## `saltcorn make-migration`

Create a new blank migration file

```
USAGE
  $ saltcorn make-migration

DESCRIPTION
  ...
  These migrations track internal structures to the database. You should not
  normally need to run this unless you are a developer.
```

_See code: [src/commands/make-migration.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/make-migration.js)_

## `saltcorn migrate`

Run migrations

```
USAGE
  $ saltcorn migrate

DESCRIPTION
  ...
  This is not normally required as migrations will be run when the server starts. 
  However, this command may be useful if you are running multiple application 
  servers and need to control when the migrations are run.
```

_See code: [src/commands/migrate.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/migrate.js)_

## `saltcorn plugins`

List and upgrade plugins for tenants

```
USAGE
  $ saltcorn plugins

OPTIONS
  -d, --dryRun   Upgrade dry-run
  -u, --upgrade  Upgrade

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/plugins.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/plugins.js)_

## `saltcorn reset-schema`

Reset the database

```
USAGE
  $ saltcorn reset-schema

OPTIONS
  -f, --force          force
  -t, --tenant=tenant  tenant

DESCRIPTION
  ...
  This will delete all existing information
```

_See code: [src/commands/reset-schema.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/reset-schema.js)_

## `saltcorn restore FILE`

Restore a previously backed up database (zip or sqlc format)

```
USAGE
  $ saltcorn restore FILE

ARGUMENTS
  FILE  backup file to restore

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/restore.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/restore.js)_

## `saltcorn rm-tenant TENANT`

Remove a tenant

```
USAGE
  $ saltcorn rm-tenant TENANT

ARGUMENTS
  TENANT  Tenant to remove
```

_See code: [src/commands/rm-tenant.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/rm-tenant.js)_

## `saltcorn run-benchmark [BASEURL]`

Run benchmark

```
USAGE
  $ saltcorn run-benchmark [BASEURL]

ARGUMENTS
  BASEURL  Base URL

OPTIONS
  -d, --delay=delay  [default: 30] delay between runs (s)
  -t, --token=token  API Token for reporting results
```

_See code: [src/commands/run-benchmark.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/run-benchmark.js)_

## `saltcorn run-tests [PACKAGE]`

Run test suites

```
USAGE
  $ saltcorn run-tests [PACKAGE]

ARGUMENTS
  PACKAGE  which package to run tests for

OPTIONS
  -c, --coverage  Coverage
  -f, --forever   Run forever till failure
```

_See code: [src/commands/run-tests.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/run-tests.js)_

## `saltcorn scheduler`

Run the Saltcorn scheduler

```
USAGE
  $ saltcorn scheduler

OPTIONS
  -v, --verbose  Verbose
```

_See code: [src/commands/scheduler.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/scheduler.js)_

## `saltcorn serve`

Start the Saltcorn server

```
USAGE
  $ saltcorn serve

OPTIONS
  -n, --nomigrate    No migrations
  -p, --port=port    [default: 3000] port
  -s, --noscheduler  No scheduler
  -v, --verbose      Verbose
```

_See code: [src/commands/serve.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/serve.js)_

## `saltcorn set-cfg KEY VALUE`

Set a configuration value

```
USAGE
  $ saltcorn set-cfg KEY VALUE

ARGUMENTS
  KEY    Configuration key
  VALUE  Configuration value (JSON or string)

OPTIONS
  -p, --plugin=plugin  plugin
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/set-cfg.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/set-cfg.js)_

## `saltcorn setup`

Set up a new system

```
USAGE
  $ saltcorn setup

OPTIONS
  -c, --coverage  Coverage

DESCRIPTION
  ...
  This will attempt to install or connect a database, and set up a 
  configuration file
```

_See code: [src/commands/setup.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/setup.js)_

## `saltcorn setup-benchmark`

Setup an instance for benchmarking

```
USAGE
  $ saltcorn setup-benchmark

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/setup-benchmark.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/setup-benchmark.js)_

## `saltcorn test-plugin PATH`

Test a plugin

```
USAGE
  $ saltcorn test-plugin PATH

ARGUMENTS
  PATH  path to plugin package

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/test-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/test-plugin.js)_

## `saltcorn transform-field EXPRESSION FIELD TABLE [TENANT]`

transform an existing field by applying a calculated expression

```
USAGE
  $ saltcorn transform-field EXPRESSION FIELD TABLE [TENANT]

ARGUMENTS
  EXPRESSION  expression to calculate field
  FIELD       field name
  TABLE       table name
  TENANT      tenant name
```

_See code: [src/commands/transform-field.js](https://github.com/saltcorn/saltcorn/blob/v0.4.4-beta.2/src/commands/transform-field.js)_
<!-- commandsstop -->
