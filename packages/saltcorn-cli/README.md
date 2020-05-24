# saltcorn-cli

Saltcorn command line interface

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/saltcorn-cli.svg)](https://npmjs.org/package/saltcorn-cli)
[![Downloads/week](https://img.shields.io/npm/dw/saltcorn-cli.svg)](https://npmjs.org/package/saltcorn-cli)
[![License](https://img.shields.io/npm/l/saltcorn-cli.svg)](https://github.com/glutamate/saltcorns/blob/master/package.json)

<!-- toc -->

- [saltcorn-cli](#saltcorn-cli)
- [Usage](#usage)
- [Commands](#commands)
  <!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g @saltcorn/cli
$ saltcorn COMMAND
running command...
$ saltcorn (-v|--version|version)
@saltcorn/cli/0.0.2 linux-x64 node-v14.2.0
$ saltcorn --help [COMMAND]
USAGE
  $ saltcorn COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`saltcorn backup`](#saltcorn-backup)
- [`saltcorn create-user`](#saltcorn-create-user)
- [`saltcorn fixtures`](#saltcorn-fixtures)
- [`saltcorn help [COMMAND]`](#saltcorn-help-command)
- [`saltcorn make-migration`](#saltcorn-make-migration)
- [`saltcorn migrate`](#saltcorn-migrate)
- [`saltcorn reset-schema`](#saltcorn-reset-schema)
- [`saltcorn restore FILE`](#saltcorn-restore-file)
- [`saltcorn run-tests [PACKAGE]`](#saltcorn-run-tests-package)
- [`saltcorn serve`](#saltcorn-serve)
- [`saltcorn setup`](#saltcorn-setup)
- [`saltcorn test-plugin PATH`](#saltcorn-test-plugin-path)

## `saltcorn backup`

Backup the database to a file

```
USAGE
  $ saltcorn backup

OPTIONS
  -o, --output=output  [default: 20200523-saltcorn-tomn-VirtualBox.sqlc] output filename
```

_See code: [src/commands/backup.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/backup.js)_

## `saltcorn create-user`

Create a new user

```
USAGE
  $ saltcorn create-user

OPTIONS
  -a, --admin  Admin user
```

_See code: [src/commands/create-user.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/create-user.js)_

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

_See code: [src/commands/fixtures.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/fixtures.js)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.3/src/commands/help.ts)_

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

_See code: [src/commands/make-migration.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/make-migration.js)_

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

_See code: [src/commands/migrate.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/migrate.js)_

## `saltcorn reset-schema`

Reset the database

```
USAGE
  $ saltcorn reset-schema

OPTIONS
  -f, --force  force

DESCRIPTION
  ...
  This will delete all existing information
```

_See code: [src/commands/reset-schema.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/reset-schema.js)_

## `saltcorn restore FILE`

Restore a previously backed up database from a file

```
USAGE
  $ saltcorn restore FILE

ARGUMENTS
  FILE  backup file to restore
```

_See code: [src/commands/restore.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/restore.js)_

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

_See code: [src/commands/run-tests.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/run-tests.js)_

## `saltcorn serve`

Start the Saltcorn server

```
USAGE
  $ saltcorn serve

OPTIONS
  -p, --port=port  [default: 3000] port
```

_See code: [src/commands/serve.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/serve.js)_

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

_See code: [src/commands/setup.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/setup.js)_

## `saltcorn test-plugin PATH`

Describe the command here

```
USAGE
  $ saltcorn test-plugin PATH

ARGUMENTS
  PATH  path to plugin package

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/test-plugin.js](https://github.com/glutamate/saltcorns/blob/v0.0.2/src/commands/test-plugin.js)_

<!-- commandsstop -->
