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
@saltcorn/cli/0.8.6-beta.17 linux-x64 node-v18.7.0
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
* [`saltcorn build-app`](#saltcorn-build-app)
* [`saltcorn build-cordova-builder`](#saltcorn-build-cordova-builder)
* [`saltcorn configuration-check`](#saltcorn-configuration-check)
* [`saltcorn configuration-check-backups FILES`](#saltcorn-configuration-check-backups-files)
* [`saltcorn create-tenant TENANT`](#saltcorn-create-tenant-tenant)
* [`saltcorn create-user`](#saltcorn-create-user)
* [`saltcorn delete-tenants`](#saltcorn-delete-tenants)
* [`saltcorn delete-user USER_EMAIL`](#saltcorn-delete-user-user_email)
* [`saltcorn fixtures`](#saltcorn-fixtures)
* [`saltcorn get-cfg [KEY]`](#saltcorn-get-cfg-key)
* [`saltcorn help [COMMAND]`](#saltcorn-help-command)
* [`saltcorn info`](#saltcorn-info)
* [`saltcorn inspect TYPE [NAME]`](#saltcorn-inspect-type-name)
* [`saltcorn install-pack`](#saltcorn-install-pack)
* [`saltcorn install-plugin`](#saltcorn-install-plugin)
* [`saltcorn list-tenants`](#saltcorn-list-tenants)
* [`saltcorn localize-plugin PLUGIN [PATH]`](#saltcorn-localize-plugin-plugin-path)
* [`saltcorn make-migration`](#saltcorn-make-migration)
* [`saltcorn saltcorn migrate`](#saltcorn-saltcorn-migrate)
* [`saltcorn modify-user USER_EMAIL`](#saltcorn-modify-user-user_email)
* [`saltcorn plugins`](#saltcorn-plugins)
* [`saltcorn release VERSION`](#saltcorn-release-version)
* [`saltcorn reset-schema`](#saltcorn-reset-schema)
* [`saltcorn restore FILE`](#saltcorn-restore-file)
* [`saltcorn rm-tenant`](#saltcorn-rm-tenant)
* [`saltcorn run-benchmark [BASEURL]`](#saltcorn-run-benchmark-baseurl)
* [`saltcorn run-tests [PACKAGE]`](#saltcorn-run-tests-package)
* [`saltcorn run-trigger TRIGGER`](#saltcorn-run-trigger-trigger)
* [`saltcorn scheduler`](#saltcorn-scheduler)
* [`saltcorn serve`](#saltcorn-serve)
* [`saltcorn set-cfg [KEY] [VALUE]`](#saltcorn-set-cfg-key-value)
* [`saltcorn setup`](#saltcorn-setup)
* [`saltcorn setup-benchmark`](#saltcorn-setup-benchmark)
* [`saltcorn take-snapshot`](#saltcorn-take-snapshot)
* [`saltcorn test-plugin PATH`](#saltcorn-test-plugin-path)
* [`saltcorn transform-field EXPRESSION FIELD TABLE [TENANT]`](#saltcorn-transform-field-expression-field-table-tenant)

## `saltcorn add-schema`

Add Saltcorn schema to existing database

```
USAGE
  $ saltcorn add-schema

OPTIONS
  -f, --force  force command execution
```

_See code: [src/commands/add-schema.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/add-schema.js)_

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

_See code: [src/commands/backup.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/backup.js)_

## `saltcorn build-app`

Build mobile app

```
USAGE
  $ saltcorn build-app

OPTIONS
  -a, --appFileName=appFileName            If set, the copied app will get this name
  -b, --buildDirectory=buildDirectory      A directory where the app should be build
  -c, --copyAppDirectory=copyAppDirectory  If set, the app file will be copied here, please set 'user email', too
  -d, --useDocker                          Use a docker container to build the app.
  -e, --entryPoint=entryPoint              This is the first view or page (see -t) after the login.
  -l, --localUserTables=localUserTables    user defined tables that should be replicated into the app
  -p, --platforms=platforms                Platforms to build for, space separated list
  -s, --serverURL=serverURL                URL to a saltcorn server
  -t, --entryPointType=entryPointType      Type of the entry point ('view' or 'page'). The default is 'view'.
  -u, --userEmail=userEmail                Email of the user building the app

  --allowOfflineMode                       Switch to offline mode when there is no internet, sync the data when a
                                           connection is available again.

  --buildForEmulator                       build without '--device', generates no .ipa file so that iOS apps can be
                                           build without developer accounts

  --tenantAppName=tenantAppName            Optional name of a tenant application, if set, the app will be build for this
                                           tenant
```

_See code: [src/commands/build-app.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/build-app.js)_

## `saltcorn build-cordova-builder`

Build the 'saltcorn/cordova-builder' docker image

```
USAGE
  $ saltcorn build-cordova-builder

OPTIONS
  --buildClean  run a clean build with --no-cache
```

_See code: [src/commands/build-cordova-builder.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/build-cordova-builder.js)_

## `saltcorn configuration-check`

Check configuration

```
USAGE
  $ saltcorn configuration-check

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/configuration-check.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/configuration-check.js)_

## `saltcorn configuration-check-backups FILES`

Check configuration

```
USAGE
  $ saltcorn configuration-check-backups FILES

ARGUMENTS
  FILES  backup file to check. can be repeated, e.g. with *

OPTIONS
  -d, --destructive  destructive
```

_See code: [src/commands/configuration-check-backups.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/configuration-check-backups.js)_

## `saltcorn create-tenant TENANT`

Create a tenant

```
USAGE
  $ saltcorn create-tenant TENANT

ARGUMENTS
  TENANT  Tenant subdomain to create

OPTIONS
  -d, --description=description  Description of tenant
  -e, --email=email              Email of owner of tenant
  --url=url                      Url of tenant
```

_See code: [src/commands/create-tenant.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/create-tenant.js)_

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

_See code: [src/commands/create-user.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/create-user.js)_

## `saltcorn delete-tenants`

Delete inactive tenants

```
USAGE
  $ saltcorn delete-tenants
```

_See code: [src/commands/delete-tenants.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/delete-tenants.js)_

## `saltcorn delete-user USER_EMAIL`

Delete user.

```
USAGE
  $ saltcorn delete-user USER_EMAIL

ARGUMENTS
  USER_EMAIL  User to delete

OPTIONS
  -f, --force          force command execution
  -t, --tenant=tenant  tenant

DESCRIPTION
  Command deletes the user specified by USER_EMAIL.
```

_See code: [src/commands/delete-user.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/delete-user.js)_

## `saltcorn fixtures`

Load fixtures for testing

```
USAGE
  $ saltcorn fixtures

OPTIONS
  -r, --reset          Also reset schema
  -t, --tenant=tenant  tenant

DESCRIPTION
  ...
  This manual step it is never required for users and rarely required for developers
```

_See code: [src/commands/fixtures.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/fixtures.js)_

## `saltcorn get-cfg [KEY]`

Get a configuration value. The value is printed to stdout as a JSON value

```
USAGE
  $ saltcorn get-cfg [KEY]

ARGUMENTS
  KEY  Configuration key

OPTIONS
  -p, --plugin=plugin  plugin
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/get-cfg.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/get-cfg.js)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.18/src/commands/help.ts)_

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

_See code: [src/commands/info.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/info.js)_

## `saltcorn inspect TYPE [NAME]`

Inspect an entity's JSON representation, or list entities

```
USAGE
  $ saltcorn inspect TYPE [NAME]

ARGUMENTS
  TYPE  (view|page|trigger|table) Entity type
  NAME  Entity name. If not supplied, list all names

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/inspect.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/inspect.js)_

## `saltcorn install-pack`

Install a pack or restore a snapshot

```
USAGE
  $ saltcorn install-pack

OPTIONS
  -f, --file=file      File with pack JSON
  -n, --name=name      Pack name in store
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/install-pack.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/install-pack.js)_

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

_See code: [src/commands/install-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/install-plugin.js)_

## `saltcorn list-tenants`

List tenants in CSV format

```
USAGE
  $ saltcorn list-tenants
```

_See code: [src/commands/list-tenants.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/list-tenants.js)_

## `saltcorn localize-plugin PLUGIN [PATH]`

Convert plugin to local plugin

```
USAGE
  $ saltcorn localize-plugin PLUGIN [PATH]

ARGUMENTS
  PLUGIN  Current plugin name
  PATH    Absolute path to local plugin

OPTIONS
  -t, --tenant=tenant  tenant
  -u, --unlocalize     Unlocalize plugin (local to npm)
```

_See code: [src/commands/localize-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/localize-plugin.js)_

## `saltcorn make-migration`

Create a new blank Database structure migration file.

```
USAGE
  $ saltcorn make-migration

DESCRIPTION
  These migrations update database structure.
  You should not normally need to run this
  unless you are a developer.
```

_See code: [src/commands/make-migration.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/make-migration.js)_

## `saltcorn saltcorn migrate`

Run Database structure migrations

```
USAGE
  $ saltcorn saltcorn migrate

DESCRIPTION
  ...
  NOTE!
  - Please stop Saltcorn before run DB migrations.
  - Please make db backup before migration.
  - There are no way to rollback migration if you doesn't make backup.

  This is not normally required as migrations will be run when the server starts.
  However, this command may be useful if you are running multiple application
  servers and need to control when the migrations are run.
```

_See code: [src/commands/migrate.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/migrate.js)_

## `saltcorn modify-user USER_EMAIL`

Modify (update) user.

```
USAGE
  $ saltcorn modify-user USER_EMAIL

ARGUMENTS
  USER_EMAIL  User to modify

OPTIONS
  -a, --admin              make user be Admin
  -e, --email=email        new email
  -i, --imode              interactive mode
  -p, --password=password  new password
  -r, --role=role          new role (can conflict with -a option)
  -t, --tenant=tenant      tenant

DESCRIPTION
  Command changes the user specified by USER_EMAIL.

  You can change the user group, password and email.

  NOTE that -a and -r role (--role=role) can give conflict.
```

_See code: [src/commands/modify-user.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/modify-user.js)_

## `saltcorn plugins`

List and upgrade plugins for tenants

```
USAGE
  $ saltcorn plugins

OPTIONS
  -d, --dryRun     Upgrade dry-run
  -f, --force      Force update
  -n, --name=name  Plugin name
  -u, --upgrade    Upgrade
  -v, --verbose    Verbose output

DESCRIPTION
  ...
  Extra documentation goes here

EXAMPLES
  plugins -v - verbose output of commands
  plugins -u -d - dry-run for plugin update
  plugins -u -f - force plugin update
```

_See code: [src/commands/plugins.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/plugins.js)_

## `saltcorn release VERSION`

Release a new saltcorn version

```
USAGE
  $ saltcorn release VERSION

ARGUMENTS
  VERSION  New version number
```

_See code: [src/commands/release.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/release.js)_

## `saltcorn reset-schema`

Reset the database

```
USAGE
  $ saltcorn reset-schema

OPTIONS
  -f, --force          force command execution
  -t, --tenant=tenant  tenant

DESCRIPTION
  ...
  This will delete all existing information
```

_See code: [src/commands/reset-schema.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/reset-schema.js)_

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

_See code: [src/commands/restore.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/restore.js)_

## `saltcorn rm-tenant`

Remove a tenant.

```
USAGE
  $ saltcorn rm-tenant

OPTIONS
  -f, --force          force command execution
  -t, --tenant=tenant  (required) tenant

DESCRIPTION
  Attention! All tenant data will be lost!
  It recommended to make backup of tenant before perform this command.
```

_See code: [src/commands/rm-tenant.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/rm-tenant.js)_

## `saltcorn run-benchmark [BASEURL]`

Run benchmark

```
USAGE
  $ saltcorn run-benchmark [BASEURL]

ARGUMENTS
  BASEURL  Base URL

OPTIONS
  -b, --benchmark=benchmark  Which benchmark to run
  -d, --delay=delay          [default: 30] delay between runs (s)
  -t, --token=token          API Token for reporting results
```

_See code: [src/commands/run-benchmark.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/run-benchmark.js)_

## `saltcorn run-tests [PACKAGE]`

Run test suites

```
USAGE
  $ saltcorn run-tests [PACKAGE]

ARGUMENTS
  PACKAGE  which package to run tests for

OPTIONS
  -c, --coverage               Coverage
  -d, --detectOpenHandles      Detect Open Handles
  -l, --listTests              List tests
  -t, --testFilter=testFilter  Filter tests by suite or test name
  -v, --verbose                Verbose
  --database=database          Run on specified database. Default is saltcorn_test
  --watch                      Watch files for changes and rerun tests related to changed files.
  --watchAll                   Watch files for changes and rerun all tests.
```

_See code: [src/commands/run-tests.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/run-tests.js)_

## `saltcorn run-trigger TRIGGER`

Run a trigger

```
USAGE
  $ saltcorn run-trigger TRIGGER

ARGUMENTS
  TRIGGER  trigger name

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/run-trigger.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/run-trigger.js)_

## `saltcorn scheduler`

Run the Saltcorn scheduler

```
USAGE
  $ saltcorn scheduler

OPTIONS
  -v, --verbose  Verbose
```

_See code: [src/commands/scheduler.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/scheduler.js)_

## `saltcorn serve`

Start the Saltcorn server

```
USAGE
  $ saltcorn serve

OPTIONS
  -a, --addschema                      Add schema if missing
  -d, --dev                            Run in dev mode and re-start on file changes
  -n, --nomigrate                      No migrations
  -p, --port=port                      [default: 3000] port
  -r, --watchReaper                    Watch reaper
  -s, --noscheduler                    No scheduler
  -v, --verbose                        Verbose
  --subdomain_offset=subdomain_offset  Number of parts to remove to access subdomain in 'multi_tenant' mode
```

_See code: [src/commands/serve.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/serve.js)_

## `saltcorn set-cfg [KEY] [VALUE]`

Set a configuration value. The supplied value (argument, or file stdin) will be parsed as JSON. If this fails, it is stored as a string.

```
USAGE
  $ saltcorn set-cfg [KEY] [VALUE]

ARGUMENTS
  KEY    Configuration key
  VALUE  Configuration value (JSON or string)

OPTIONS
  -f, --file=file      file
  -i, --stdin          read value from stdin
  -p, --plugin=plugin  plugin
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/set-cfg.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/set-cfg.js)_

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

_See code: [src/commands/setup.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/setup.js)_

## `saltcorn setup-benchmark`

Setup an instance for benchmarking

```
USAGE
  $ saltcorn setup-benchmark

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/setup-benchmark.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/setup-benchmark.js)_

## `saltcorn take-snapshot`

Print a current snapshout to stdout

```
USAGE
  $ saltcorn take-snapshot

OPTIONS
  -f, --fresh          fresh
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/take-snapshot.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/take-snapshot.js)_

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

_See code: [src/commands/test-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/test-plugin.js)_

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

_See code: [src/commands/transform-field.js](https://github.com/saltcorn/saltcorn/blob/v0.8.6-beta.17/src/commands/transform-field.js)_
<!-- commandsstop -->
