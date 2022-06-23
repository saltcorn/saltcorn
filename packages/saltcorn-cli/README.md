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
@saltcorn/cli/0.7.3-beta.0 darwin-arm64 node-v16.15.1
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
* [`saltcorn configuration-check`](#saltcorn-configuration-check)
* [`saltcorn create-tenant TENANT`](#saltcorn-create-tenant-tenant)
* [`saltcorn create-user`](#saltcorn-create-user)
* [`saltcorn delete-tenants`](#saltcorn-delete-tenants)
* [`saltcorn delete-user USER_EMAIL`](#saltcorn-delete-user-user_email)
* [`saltcorn fixtures`](#saltcorn-fixtures)
* [`saltcorn get-cfg KEY`](#saltcorn-get-cfg-key)
* [`saltcorn help [COMMAND]`](#saltcorn-help-command)
* [`saltcorn info`](#saltcorn-info)
* [`saltcorn install-pack`](#saltcorn-install-pack)
* [`saltcorn install-plugin`](#saltcorn-install-plugin)
* [`saltcorn list-tenants`](#saltcorn-list-tenants)
* [`saltcorn localize-plugin PLUGIN PATH`](#saltcorn-localize-plugin-plugin-path)
* [`saltcorn make-migration`](#saltcorn-make-migration)
* [`saltcorn saltcorn migrate`](#saltcorn-saltcorn-migrate)
* [`saltcorn modify-user USER_EMAIL`](#saltcorn-modify-user-user_email)
* [`saltcorn plugins`](#saltcorn-plugins)
* [`saltcorn plugins:inspect PLUGIN...`](#saltcorn-pluginsinspect-plugin)
* [`saltcorn plugins:install PLUGIN...`](#saltcorn-pluginsinstall-plugin)
* [`saltcorn plugins:link PLUGIN`](#saltcorn-pluginslink-plugin)
* [`saltcorn plugins:uninstall PLUGIN...`](#saltcorn-pluginsuninstall-plugin)
* [`saltcorn plugins:update`](#saltcorn-pluginsupdate)
* [`saltcorn release VERSION`](#saltcorn-release-version)
* [`saltcorn reset-schema`](#saltcorn-reset-schema)
* [`saltcorn restore FILE`](#saltcorn-restore-file)
* [`saltcorn rm-tenant`](#saltcorn-rm-tenant)
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

OPTIONS
  -f, --force  force command execution
```

_See code: [src/commands/add-schema.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/add-schema.js)_

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

_See code: [src/commands/backup.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/backup.js)_

## `saltcorn configuration-check`

Check configuration

```
USAGE
  $ saltcorn configuration-check

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/configuration-check.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/configuration-check.js)_

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
```

_See code: [src/commands/create-tenant.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/create-tenant.js)_

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

_See code: [src/commands/create-user.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/create-user.js)_

## `saltcorn delete-tenants`

Delete inactive tenants

```
USAGE
  $ saltcorn delete-tenants
```

_See code: [src/commands/delete-tenants.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/delete-tenants.js)_

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

_See code: [src/commands/delete-user.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/delete-user.js)_

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

_See code: [src/commands/fixtures.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/fixtures.js)_

## `saltcorn get-cfg KEY`

Get a configuration value

```
USAGE
  $ saltcorn get-cfg KEY

ARGUMENTS
  KEY  Configuration key

OPTIONS
  -p, --plugin=plugin  plugin
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/get-cfg.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/get-cfg.js)_

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

_See code: [src/commands/info.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/info.js)_

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

_See code: [src/commands/install-pack.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/install-pack.js)_

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

_See code: [src/commands/install-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/install-plugin.js)_

## `saltcorn list-tenants`

List tenants in CSV format

```
USAGE
  $ saltcorn list-tenants
```

_See code: [src/commands/list-tenants.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/list-tenants.js)_

## `saltcorn localize-plugin PLUGIN PATH`

Convert plugin to local plugin

```
USAGE
  $ saltcorn localize-plugin PLUGIN PATH

ARGUMENTS
  PLUGIN  Current plugin name
  PATH    Absolute path to local plugin

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/localize-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/localize-plugin.js)_

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

_See code: [src/commands/make-migration.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/make-migration.js)_

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

_See code: [src/commands/migrate.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/migrate.js)_

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

_See code: [src/commands/modify-user.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/modify-user.js)_

## `saltcorn plugins`

List installed plugins.

```
USAGE
  $ saltcorn plugins

OPTIONS
  --core  Show core plugins.

EXAMPLE
  $ saltcorn plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/index.ts)_

## `saltcorn plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ saltcorn plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

OPTIONS
  -h, --help     Show CLI help.
  -v, --verbose

EXAMPLE
  $ saltcorn plugins:inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/inspect.ts)_

## `saltcorn plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ saltcorn plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

OPTIONS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command 
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in 
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ saltcorn plugins:add

EXAMPLES
  $ saltcorn plugins:install myplugin 
  $ saltcorn plugins:install https://github.com/someuser/someplugin
  $ saltcorn plugins:install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/install.ts)_

## `saltcorn plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ saltcorn plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

OPTIONS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
   command will override the user-installed or core plugin implementation. This is useful for development work.

EXAMPLE
  $ saltcorn plugins:link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/link.ts)_

## `saltcorn plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ saltcorn plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

OPTIONS
  -h, --help     Show CLI help.
  -v, --verbose

ALIASES
  $ saltcorn plugins:unlink
  $ saltcorn plugins:remove
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/uninstall.ts)_

## `saltcorn plugins:update`

Update installed plugins.

```
USAGE
  $ saltcorn plugins:update

OPTIONS
  -h, --help     Show CLI help.
  -v, --verbose
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.1.0/src/commands/plugins/update.ts)_

## `saltcorn release VERSION`

Release a new saltcorn version

```
USAGE
  $ saltcorn release VERSION

ARGUMENTS
  VERSION  New version number
```

_See code: [src/commands/release.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/release.js)_

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

_See code: [src/commands/reset-schema.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/reset-schema.js)_

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

_See code: [src/commands/restore.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/restore.js)_

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

_See code: [src/commands/rm-tenant.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/rm-tenant.js)_

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

_See code: [src/commands/run-benchmark.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/run-benchmark.js)_

## `saltcorn run-tests [PACKAGE]`

Run test suites

```
USAGE
  $ saltcorn run-tests [PACKAGE]

ARGUMENTS
  PACKAGE  which package to run tests for

OPTIONS
  -c, --coverage               Coverage
  -t, --testFilter=testFilter  Filter tests by suite or test name
  --watch                      Watch files for changes and rerun tests related to changed files.
  --watchAll                   Watch files for changes and rerun all tests.
```

_See code: [src/commands/run-tests.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/run-tests.js)_

## `saltcorn scheduler`

Run the Saltcorn scheduler

```
USAGE
  $ saltcorn scheduler

OPTIONS
  -v, --verbose  Verbose
```

_See code: [src/commands/scheduler.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/scheduler.js)_

## `saltcorn serve`

Start the Saltcorn server

```
USAGE
  $ saltcorn serve

OPTIONS
  -a, --addschema    Add schema if missing
  -d, --dev          Run in dev mode and re-start on file changes
  -n, --nomigrate    No migrations
  -p, --port=port    [default: 3000] port
  -r, --watchReaper  Watch reaper
  -s, --noscheduler  No scheduler
  -v, --verbose      Verbose
```

_See code: [src/commands/serve.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/serve.js)_

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

_See code: [src/commands/set-cfg.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/set-cfg.js)_

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

_See code: [src/commands/setup.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/setup.js)_

## `saltcorn setup-benchmark`

Setup an instance for benchmarking

```
USAGE
  $ saltcorn setup-benchmark

OPTIONS
  -t, --tenant=tenant  tenant
```

_See code: [src/commands/setup-benchmark.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/setup-benchmark.js)_

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

_See code: [src/commands/test-plugin.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/test-plugin.js)_

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

_See code: [src/commands/transform-field.js](https://github.com/saltcorn/saltcorn/blob/v0.7.3-beta.0/src/commands/transform-field.js)_
<!-- commandsstop -->
