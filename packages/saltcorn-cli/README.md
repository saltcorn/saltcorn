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
$ saltcorn (--version)
@saltcorn/cli/1.6.0-alpha.8 linux-x64 node-v20.19.4
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
* [`saltcorn build-capacitor-builder`](#saltcorn-build-capacitor-builder)
* [`saltcorn configuration-check`](#saltcorn-configuration-check)
* [`saltcorn configuration-check-backups FILES`](#saltcorn-configuration-check-backups-files)
* [`saltcorn create-tenant TENANT`](#saltcorn-create-tenant-tenant)
* [`saltcorn create-user`](#saltcorn-create-user)
* [`saltcorn delete-tenants`](#saltcorn-delete-tenants)
* [`saltcorn delete-user USER_EMAIL`](#saltcorn-delete-user-user_email)
* [`saltcorn dev:build [COMPONENT]`](#saltcorn-devbuild-component)
* [`saltcorn dev:localize-plugin PLUGIN [PATH]`](#saltcorn-devlocalize-plugin-plugin-path)
* [`saltcorn make-migration`](#saltcorn-make-migration)
* [`saltcorn saltcorn dev:plugin-test -d [PATH_TO_LOCAL_PLUGIN]/statistics -f test-backup.zip`](#saltcorn-saltcorn-devplugin-test--d-path_to_local_pluginstatistics--f-test-backupzip)
* [`saltcorn dev:post-release [TASK] [TAG]`](#saltcorn-devpost-release-task-tag)
* [`saltcorn dev:release VERSION TAG`](#saltcorn-devrelease-version-tag)
* [`saltcorn dev:release-resume VERSION`](#saltcorn-devrelease-resume-version)
* [`saltcorn dev:serve`](#saltcorn-devserve)
* [`saltcorn dev:test-plugin PATH`](#saltcorn-devtest-plugin-path)
* [`saltcorn dev:translate LOCALE`](#saltcorn-devtranslate-locale)
* [`saltcorn fixtures`](#saltcorn-fixtures)
* [`saltcorn get-cfg [KEY]`](#saltcorn-get-cfg-key)
* [`saltcorn info [KEY]`](#saltcorn-info-key)
* [`saltcorn inspect TYPE [NAME]`](#saltcorn-inspect-type-name)
* [`saltcorn install-pack`](#saltcorn-install-pack)
* [`saltcorn install-plugin`](#saltcorn-install-plugin)
* [`saltcorn list-tenants`](#saltcorn-list-tenants)
* [`saltcorn list-triggers`](#saltcorn-list-triggers)
* [`saltcorn list-users`](#saltcorn-list-users)
* [`saltcorn saltcorn migrate`](#saltcorn-saltcorn-migrate)
* [`saltcorn modify-user USER_EMAIL`](#saltcorn-modify-user-user_email)
* [`saltcorn paths [KEY]`](#saltcorn-paths-key)
* [`saltcorn plugins`](#saltcorn-plugins)
* [`saltcorn pre-install-modules PLUGINSELECTOR`](#saltcorn-pre-install-modules-pluginselector)
* [`saltcorn prepare`](#saltcorn-prepare)
* [`saltcorn reset-schema`](#saltcorn-reset-schema)
* [`saltcorn restore FILE`](#saltcorn-restore-file)
* [`saltcorn rm-tenant`](#saltcorn-rm-tenant)
* [`saltcorn run-benchmark [BASEURL]`](#saltcorn-run-benchmark-baseurl)
* [`saltcorn run-js`](#saltcorn-run-js)
* [`saltcorn run-sql`](#saltcorn-run-sql)
* [`saltcorn run-tests [PACKAGE]`](#saltcorn-run-tests-package)
* [`saltcorn run-trigger TRIGGER`](#saltcorn-run-trigger-trigger)
* [`saltcorn scheduler`](#saltcorn-scheduler)
* [`saltcorn serve`](#saltcorn-serve)
* [`saltcorn set-cfg [KEY] [VALUE]`](#saltcorn-set-cfg-key-value)
* [`saltcorn set-daily-time [MINS]`](#saltcorn-set-daily-time-mins)
* [`saltcorn setup`](#saltcorn-setup)
* [`saltcorn setup-benchmark`](#saltcorn-setup-benchmark)
* [`saltcorn sync-upload-data`](#saltcorn-sync-upload-data)
* [`saltcorn take-snapshot`](#saltcorn-take-snapshot)
* [`saltcorn transform-field EXPRESSION FIELD TABLE [TENANT]`](#saltcorn-transform-field-expression-field-table-tenant)

## `saltcorn add-schema`

Add Saltcorn schema to existing database

```
USAGE
  $ saltcorn add-schema [-f]

FLAGS
  -f, --force  force command execution

DESCRIPTION
  Add Saltcorn schema to existing database
```

_See code: [src/commands/add-schema.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/add-schema.js)_

## `saltcorn backup`

Backup the PostgreSQL database to a file with pg_dump or saltcorn backup zip

```
USAGE
  $ saltcorn backup [-v] [-o <value>] [-t <value>] [-a] [-z]

FLAGS
  -a, --all_tenants     Backup all tenants in saltcorn zip format
  -o, --output=<value>  output filename
  -t, --tenant=<value>  Backup tenant in saltcorn zip format
  -v, --verbose         Verbose
  -z, --zip             Backup public in saltcorn zip format

DESCRIPTION
  Backup the PostgreSQL database to a file with pg_dump or saltcorn backup zip
```

_See code: [src/commands/backup.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/backup.js)_

## `saltcorn build-app`

Build mobile app

```
USAGE
  $ saltcorn build-app [-m full|prepare|finish] [--allowShareTo] [--tenantAppName <value>] [-p <value>...] [-e
    <value>] [-t <value>] [-l <value>...] [--synchedTables <value>...] [--includedPlugins <value>...] [-d] [-b <value>]
    [-c <value>] [-u <value>] [--appName <value>] [--appId <value>] [--appVersion <value>] [--appIcon <value>] [-s
    <value>] [--splashPage <value>] [--autoPublicLogin] [--showContinueAsPublicUser] [--allowOfflineMode]
    [--syncOnReconnect] [--syncOnAppResume] [--pushSync] [--syncInterval <value>] [--noProvisioningProfile]
    [--provisioningProfile <value>] [--shareExtensionProvisioningProfile <value>] [--appGroupId <value>] [--buildType
    <value>] [--allowClearTextTraffic] [--androidKeystore <value>] [--androidKeyStoreAlias <value>]
    [--androidKeystorePassword <value>] [--googleServicesFile <value>]

FLAGS
  -b, --buildDirectory=<value>                     A directory where the app should be build
  -c, --copyAppDirectory=<value>                   If set, the app file will be copied here, please set 'user email',
                                                   too
  -d, --useDocker                                  Use a docker container to build the app.
  -e, --entryPoint=<value>                         This is the first view or page (see -t) after the login.
  -l, --localUserTables=<value>...                 user defined tables that should be replicated into the app
  -m, --mode=<option>                              [default: full] Build the app completely (full), prepare the ios
                                                   build directory (prepare) or finish the ios build in the prepared ios
                                                   folder (finish)
                                                   <options: full|prepare|finish>
  -p, --platforms=<value>...                       Platforms to build for, space separated list
  -s, --serverURL=<value>                          URL to a saltcorn server
  -t, --entryPointType=<value>                     Type of the entry point ('view' or 'page'). The default is 'view'.
  -u, --userEmail=<value>                          Email of the user building the app
      --allowClearTextTraffic                      Enable this to allow unsecure HTTP connections. Useful for local
                                                   testing.
      --allowOfflineMode                           Switch to offline mode when there is no internet, sync the data when
                                                   a connection is available again.
      --allowShareTo                               Allow sharing from other apps to this app
      --androidKeyStoreAlias=<value>               A unique name to identify the key within the keystore file.
      --androidKeystore=<value>                    A self-signed certificate that includes the private key used to sign
                                                   your app.
      --androidKeystorePassword=<value>            he password to access the keystore file.
      --appGroupId=<value>                         An app group identifier to share data between the main app and the
                                                   share extension on iOS, e.g. group.com.saltcorn.myapp
      --appIcon=<value>                            A png that will be used as launcher icon. The default is a png of a
                                                   saltcorn symbol.
      --appId=<value>                              Id of the mobile app (default com.saltcorn.mobileapp)
      --appName=<value>                            Name of the mobile app (default SaltcornMobileApp)
      --appVersion=<value>                         Version of the mobile app (default 0.0.1)
      --autoPublicLogin                            Show public entry points before the login as a public user.
      --buildType=<value>                          debug or release build
      --googleServicesFile=<value>                 Path to the google-services.json file for Firebase Push Notifications
                                                   (Android only)
      --includedPlugins=<value>...                 Names of plugins that should be bundled into the app.If empty, no
                                                   modules are used.
      --noProvisioningProfile                      Do not use a provisioning profile, only for simulator builds (iOS
                                                   only)
      --provisioningProfile=<value>                This profile will be used to sign your app
      --pushSync                                   When offline mode is enabled, synchronize the synchedTables tables
                                                   when a push notification is received.
      --shareExtensionProvisioningProfile=<value>  This profile will be used to sign your share extension on iOS
      --showContinueAsPublicUser                   Show a button to continue as public user on the login screen.
      --splashPage=<value>                         Name of a page that should be shown while the app is loading.
      --syncInterval=<value>                       Perdiodic interval (in minutes) to run synchronizations in the
                                                   background. This is just a min interval, depending on system
                                                   conditions, the actual time may be longer.
      --syncOnAppResume                            When offline mode is enabled, synchronize the synchedTables tables
                                                   when the app is resumed.
      --syncOnReconnect                            Run Synchronizations and return into online mode when the network
                                                   connection is restored. When disabled, you still can do this
                                                   manually.
      --synchedTables=<value>...                   Table names for which the offline should be synchronized with the
                                                   saltcorn server
      --tenantAppName=<value>                      Optional name of a tenant application, if set, the app will be build
                                                   for this tenant

DESCRIPTION
  Build mobile app
```

_See code: [src/commands/build-app.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/build-app.js)_

## `saltcorn build-capacitor-builder`

Build the 'saltcorn/capacitor-builder' docker image or pull it from docker hub.

```
USAGE
  $ saltcorn build-capacitor-builder [--buildClean] [--pullFromHub]

FLAGS
  --buildClean   run a clean build with --no-cache
  --pullFromHub  pull the image from docker hub

DESCRIPTION
  Build the 'saltcorn/capacitor-builder' docker image or pull it from docker hub.
```

_See code: [src/commands/build-capacitor-builder.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/build-capacitor-builder.js)_

## `saltcorn configuration-check`

Check configuration

```
USAGE
  $ saltcorn configuration-check [-t <value>]

FLAGS
  -t, --tenant=<value>  tenant

DESCRIPTION
  Check configuration
```

_See code: [src/commands/configuration-check.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/configuration-check.js)_

## `saltcorn configuration-check-backups FILES`

Check configuration

```
USAGE
  $ saltcorn configuration-check-backups FILES... [-d]

ARGUMENTS
  FILES...  backup file to check. can be repeated, e.g. with *

FLAGS
  -d, --destructive  destructive

DESCRIPTION
  Check configuration
```

_See code: [src/commands/configuration-check-backups.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/configuration-check-backups.js)_

## `saltcorn create-tenant TENANT`

Create a tenant

```
USAGE
  $ saltcorn create-tenant TENANT [--url <value>] [-e <value>] [-d <value>]

ARGUMENTS
  TENANT  Tenant subdomain to create

FLAGS
  -d, --description=<value>  Description of tenant
  -e, --email=<value>        Email of owner of tenant
      --url=<value>          Url of tenant

DESCRIPTION
  Create a tenant
```

_See code: [src/commands/create-tenant.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/create-tenant.js)_

## `saltcorn create-user`

Create a new user

```
USAGE
  $ saltcorn create-user [-a] [-t <value>] [-e <value>] [-r <value>] [-p <value>]

FLAGS
  -a, --admin             Admin user
  -e, --email=<value>     email
  -p, --password=<value>  password
  -r, --role=<value>      role
  -t, --tenant=<value>    tenant

DESCRIPTION
  Create a new user
```

_See code: [src/commands/create-user.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/create-user.js)_

## `saltcorn delete-tenants`

Delete inactive tenants

```
USAGE
  $ saltcorn delete-tenants

DESCRIPTION
  Delete inactive tenants
```

_See code: [src/commands/delete-tenants.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/delete-tenants.js)_

## `saltcorn delete-user USER_EMAIL`

Delete user.

```
USAGE
  $ saltcorn delete-user USER_EMAIL [-f] [-t <value>]

ARGUMENTS
  USER_EMAIL  User to delete

FLAGS
  -f, --force           force command execution
  -t, --tenant=<value>  tenant

DESCRIPTION
  Delete user.

  Command deletes the user specified by USER_EMAIL.
```

_See code: [src/commands/delete-user.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/delete-user.js)_

## `saltcorn dev:build [COMPONENT]`

Rebuild static assets

```
USAGE
  $ saltcorn dev:build [COMPONENT]

ARGUMENTS
  COMPONENT  (builder|filemanager|workflow-editor) Component to rebuild

DESCRIPTION
  Rebuild static assets
```

_See code: [src/commands/dev/build.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/build.js)_

## `saltcorn dev:localize-plugin PLUGIN [PATH]`

Convert plugin to local plugin

```
USAGE
  $ saltcorn dev:localize-plugin PLUGIN [PATH] [-u] [-t <value>]

ARGUMENTS
  PLUGIN  Current plugin name
  PATH    Absolute path to local plugin

FLAGS
  -t, --tenant=<value>  tenant
  -u, --unlocalize      Unlocalize plugin (local to npm)

DESCRIPTION
  Convert plugin to local plugin
```

_See code: [src/commands/dev/localize-plugin.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/localize-plugin.js)_

## `saltcorn make-migration`

Create a new blank Database structure migration file.

```
USAGE
  $ saltcorn dev:make-migration make-migration

DESCRIPTION
  Create a new blank Database structure migration file.
  These migrations update database structure.
  You should not normally need to run this
  unless you are a developer.
```

_See code: [src/commands/dev/make-migration.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/make-migration.js)_

## `saltcorn saltcorn dev:plugin-test -d [PATH_TO_LOCAL_PLUGIN]/statistics -f test-backup.zip`

Install a plugin, spawn 'npm run test' in the install directory and check the return code.

```
USAGE
  $ saltcorn dev:plugin-test saltcorn dev:plugin-test -d [PATH_TO_LOCAL_PLUGIN]/statistics -f test-backup.zip

FLAGS
  -d, --directory=<value>               Directory of local plugin
  -f, --backupFile=<value>              Optional name of a backup file in the tests folder. If you ommit this, then the
                                        test has to create its own data.
  -n, --name=<value>                    Plugin name in store of a released plugin
  -o, --overwriteDependency=<value>...  Dependency to overwrite with a local plugin (can be used multiple times). Please
                                        specify the path to the local plugin, the module name will be taken from there.
      --database=<value>                Run on specified database. Default is 'saltcorn_test''

DESCRIPTION
  Install a plugin, spawn 'npm run test' in the install directory and check the return code.
```

_See code: [src/commands/dev/plugin-test.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/plugin-test.js)_

## `saltcorn dev:post-release [TASK] [TAG]`

Post-release tasks: docker and vagrant builds

```
USAGE
  $ saltcorn dev:post-release [TASK] [TAG]

ARGUMENTS
  TASK  (docker|vagrant|all|none) What to do
  TAG   Docker tag to give this release

DESCRIPTION
  Post-release tasks: docker and vagrant builds
```

_See code: [src/commands/dev/post-release.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/post-release.js)_

## `saltcorn dev:release VERSION TAG`

Release a new saltcorn version

```
USAGE
  $ saltcorn dev:release VERSION TAG

ARGUMENTS
  VERSION  New version number
  TAG      NPM tag to give this release

DESCRIPTION
  Release a new saltcorn version
```

_See code: [src/commands/dev/release.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/release.js)_

## `saltcorn dev:release-resume VERSION`

Release a new saltcorn version

```
USAGE
  $ saltcorn dev:release-resume VERSION [-t <value>]

ARGUMENTS
  VERSION  New version number

FLAGS
  -t, --tag=<value>  NPM tag

DESCRIPTION
  Release a new saltcorn version
```

_See code: [src/commands/dev/release-resume.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/release-resume.js)_

## `saltcorn dev:serve`

Development server. Serve on port 3000, restart when source files change

```
USAGE
  $ saltcorn dev:serve [-p <value>] [-w <value>]

FLAGS
  -p, --port=<value>     [default: 3000] port
  -w, --workers=<value>  [default: 1] workers

DESCRIPTION
  Development server. Serve on port 3000, restart when source files change
```

_See code: [src/commands/dev/serve.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/serve.js)_

## `saltcorn dev:test-plugin PATH`

Test a plugin

```
USAGE
  $ saltcorn dev:test-plugin PATH

ARGUMENTS
  PATH  path to plugin package

DESCRIPTION
  Test a plugin
  ...
  Extra documentation goes here
```

_See code: [src/commands/dev/test-plugin.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/test-plugin.js)_

## `saltcorn dev:translate LOCALE`

Produce translation files with LLM

```
USAGE
  $ saltcorn dev:translate LOCALE [-p <value>]

ARGUMENTS
  LOCALE  locale to translate

FLAGS
  -p, --plugin=<value>  Plugin to translate

DESCRIPTION
  Produce translation files with LLM
```

_See code: [src/commands/dev/translate.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/dev/translate.js)_

## `saltcorn fixtures`

Load fixtures for testing

```
USAGE
  $ saltcorn fixtures [-r] [-t <value>]

FLAGS
  -r, --reset           Also reset schema
  -t, --tenant=<value>  tenant

DESCRIPTION
  Load fixtures for testing
  ...
  This manual step it is never required for users and rarely required for developers
```

_See code: [src/commands/fixtures.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/fixtures.js)_

## `saltcorn get-cfg [KEY]`

Get a configuration value. The value is printed to stdout as a JSON value

```
USAGE
  $ saltcorn get-cfg [KEY] [-t <value>] [-p <value>]

ARGUMENTS
  KEY  Configuration key

FLAGS
  -p, --plugin=<value>  plugin
  -t, --tenant=<value>  tenant

DESCRIPTION
  Get a configuration value. The value is printed to stdout as a JSON value
```

_See code: [src/commands/get-cfg.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/get-cfg.js)_

## `saltcorn info [KEY]`

Show paths

```
USAGE
  $ saltcorn info [KEY] [-j]

ARGUMENTS
  KEY  (configFilePath|cliPath|file_store|saltcornVersion|version_tag) Output single value

FLAGS
  -j, --json  json format

DESCRIPTION
  Show paths
  ...
  Show configuration and file store paths


ALIASES
  $ saltcorn paths
```

_See code: [src/commands/info.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/info.js)_

## `saltcorn inspect TYPE [NAME]`

Inspect an entity's JSON representation, or list entities

```
USAGE
  $ saltcorn inspect TYPE [NAME] [-t <value>]

ARGUMENTS
  TYPE  (view|page|trigger|table) Entity type
  NAME  Entity name. If not supplied, list all names

FLAGS
  -t, --tenant=<value>  tenant

DESCRIPTION
  Inspect an entity's JSON representation, or list entities
```

_See code: [src/commands/inspect.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/inspect.js)_

## `saltcorn install-pack`

Install a pack or restore a snapshot

```
USAGE
  $ saltcorn install-pack [-t <value>] [-n <value>] [-f <value>]

FLAGS
  -f, --file=<value>    File with pack JSON
  -n, --name=<value>    Pack name in store
  -t, --tenant=<value>  tenant

DESCRIPTION
  Install a pack or restore a snapshot
```

_See code: [src/commands/install-pack.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/install-pack.js)_

## `saltcorn install-plugin`

Install a plugin

```
USAGE
  $ saltcorn install-plugin [-t <value>] [-n <value>] [-d <value>] [-u]

FLAGS
  -d, --directory=<value>  Directory with local plugin
  -n, --name=<value>       Plugin name in store
  -t, --tenant=<value>     tenant
  -u, --unsafe             Allow unsafe plugins on tenants

DESCRIPTION
  Install a plugin
```

_See code: [src/commands/install-plugin.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/install-plugin.js)_

## `saltcorn list-tenants`

List tenants in CSV format

```
USAGE
  $ saltcorn list-tenants [-t <value>] [-v] [-j] [-p]

FLAGS
  -j, --json            json format
  -p, --plain           plain text format
  -t, --tenant=<value>  tenant
  -v, --verbose         verbose output

DESCRIPTION
  List tenants in CSV format
```

_See code: [src/commands/list-tenants.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/list-tenants.js)_

## `saltcorn list-triggers`

List triggers

```
USAGE
  $ saltcorn list-triggers [-t <value>] [-v] [-j]

FLAGS
  -j, --json            json format
  -t, --tenant=<value>  tenant
  -v, --verbose         verbose output

DESCRIPTION
  List triggers
```

_See code: [src/commands/list-triggers.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/list-triggers.js)_

## `saltcorn list-users`

List users

```
USAGE
  $ saltcorn list-users [-t <value>] [-v]

FLAGS
  -t, --tenant=<value>  tenant
  -v, --verbose         verbose output

DESCRIPTION
  List users
```

_See code: [src/commands/list-users.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/list-users.js)_

## `saltcorn saltcorn migrate`

Run Database structure migrations

```
USAGE
  $ saltcorn migrate saltcorn migrate

DESCRIPTION
  Run Database structure migrations
  ...
  NOTE!
  - Please stop Saltcorn before run DB migrations.
  - Please make db backup before migration.
  - There are no way to rollback migration if you doesn't make backup.

  This is not normally required as migrations will be run when the server starts.
  However, this command may be useful if you are running multiple application
  servers and need to control when the migrations are run.
```

_See code: [src/commands/migrate.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/migrate.js)_

## `saltcorn modify-user USER_EMAIL`

Modify (update) user.

```
USAGE
  $ saltcorn modify-user USER_EMAIL [-a] [-t <value>] [-e <value>] [-r <value>] [-p <value>] [-i]

ARGUMENTS
  USER_EMAIL  User to modify

FLAGS
  -a, --admin             make user be Admin
  -e, --email=<value>     new email
  -i, --imode             interactive mode
  -p, --password=<value>  new password
  -r, --role=<value>      new role (can conflict with -a option)
  -t, --tenant=<value>    tenant

DESCRIPTION
  Modify (update) user.

  Command changes the user specified by USER_EMAIL.

  You can change the user group, password and email.

  NOTE that -a and -r role (--role=role) can give conflict.
```

_See code: [src/commands/modify-user.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/modify-user.js)_

## `saltcorn paths [KEY]`

Show paths

```
USAGE
  $ saltcorn paths [KEY] [-j]

ARGUMENTS
  KEY  (configFilePath|cliPath|file_store|saltcornVersion|version_tag) Output single value

FLAGS
  -j, --json  json format

DESCRIPTION
  Show paths
  ...
  Show configuration and file store paths


ALIASES
  $ saltcorn paths
```

## `saltcorn plugins`

List and upgrade plugins for tenants

```
USAGE
  $ saltcorn plugins [-u] [-d] [-v] [-f] [-n <value>]

FLAGS
  -d, --dryRun        Upgrade dry-run
  -f, --force         Force update
  -n, --name=<value>  Plugin name
  -u, --upgrade       Upgrade
  -v, --verbose       Verbose output

DESCRIPTION
  List and upgrade plugins for tenants
  ...
  Extra documentation goes here


EXAMPLES
  plugins -v - verbose output of commands

  plugins -u -d - dry-run for plugin update

  plugins -u -f - force plugin update
```

_See code: [src/commands/plugins.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/plugins.js)_

## `saltcorn pre-install-modules PLUGINSELECTOR`

Pre-install modules required by Saltcorn before running the application.

```
USAGE
  $ saltcorn pre-install-modules PLUGINSELECTOR [--store_endpoint <value>]

ARGUMENTS
  PLUGINSELECTOR  Either 'all' to pre-install all plugins or one specific plugin name

FLAGS
  --store_endpoint=<value>  [default: https://store.saltcorn.com/api/extensions] Saltcorn Modules Store endpoint

DESCRIPTION
  Pre-install modules required by Saltcorn before running the application.
```

_See code: [src/commands/pre-install-modules.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/pre-install-modules.js)_

## `saltcorn prepare`

Prepare to serve. Optional, may accelerate subsequent 'saltcorn serve' startup

```
USAGE
  $ saltcorn prepare [-v] [-a]

FLAGS
  -a, --addschema  Add schema if missing
  -v, --verbose    Verbose

DESCRIPTION
  Prepare to serve. Optional, may accelerate subsequent 'saltcorn serve' startup
```

_See code: [src/commands/prepare.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/prepare.js)_

## `saltcorn reset-schema`

Reset the database

```
USAGE
  $ saltcorn reset-schema [-f] [-t <value>]

FLAGS
  -f, --force           force command execution
  -t, --tenant=<value>  tenant

DESCRIPTION
  Reset the database
  ...
  This will delete all existing information
```

_See code: [src/commands/reset-schema.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/reset-schema.js)_

## `saltcorn restore FILE`

Restore a previously backed up database (zip or sqlc format)

```
USAGE
  $ saltcorn restore FILE [-t <value>]

ARGUMENTS
  FILE  backup file to restore

FLAGS
  -t, --tenant=<value>  tenant

DESCRIPTION
  Restore a previously backed up database (zip or sqlc format)
```

_See code: [src/commands/restore.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/restore.js)_

## `saltcorn rm-tenant`

Remove a tenant.

```
USAGE
  $ saltcorn rm-tenant -t <value> [-f]

FLAGS
  -f, --force           force command execution
  -t, --tenant=<value>  (required) tenant

DESCRIPTION
  Remove a tenant.
  Attention! All tenant data will be lost!
  It recommended to make backup of tenant before perform this command.
```

_See code: [src/commands/rm-tenant.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/rm-tenant.js)_

## `saltcorn run-benchmark [BASEURL]`

Run benchmark

```
USAGE
  $ saltcorn run-benchmark [BASEURL] [-t <value>] [-b <value>] [-d <value>]

ARGUMENTS
  BASEURL  Base URL

FLAGS
  -b, --benchmark=<value>  Which benchmark to run
  -d, --delay=<value>      [default: 30] delay between runs (s)
  -t, --token=<value>      API Token for reporting results

DESCRIPTION
  Run benchmark
```

_See code: [src/commands/run-benchmark.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/run-benchmark.js)_

## `saltcorn run-js`

Run javascript code

```
USAGE
  $ saltcorn run-js [-t <value>] [-c <value>] [-f <value>]

FLAGS
  -c, --code=<value>    js code
  -f, --file=<value>    path to script file
  -t, --tenant=<value>  tenant name

DESCRIPTION
  Run javascript code
```

_See code: [src/commands/run-js.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/run-js.js)_

## `saltcorn run-sql`

Run sql expression

```
USAGE
  $ saltcorn run-sql [-t <value>] [-s <value>] [-f <value>]

FLAGS
  -f, --file=<value>    path to sql file name
  -s, --sql=<value>     sql statement
  -t, --tenant=<value>  tenant name

DESCRIPTION
  Run sql expression
```

_See code: [src/commands/run-sql.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/run-sql.js)_

## `saltcorn run-tests [PACKAGE]`

Run test suites

```
USAGE
  $ saltcorn run-tests [PACKAGE] [-c] [-l] [-v] [-d] [-t <value>] [--watch] [--watchAll] [--database <value>]

ARGUMENTS
  PACKAGE  which package to run tests for

FLAGS
  -c, --coverage            Coverage
  -d, --detectOpenHandles   Detect Open Handles
  -l, --listTests           List tests
  -t, --testFilter=<value>  Filter tests by suite or test name
  -v, --verbose             Verbose
      --database=<value>    Run on specified database. Default is saltcorn_test
      --watch               Watch files for changes and rerun tests related to changed files.
      --watchAll            Watch files for changes and rerun all tests.

DESCRIPTION
  Run test suites
```

_See code: [src/commands/run-tests.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/run-tests.js)_

## `saltcorn run-trigger TRIGGER`

Run a trigger

```
USAGE
  $ saltcorn run-trigger TRIGGER [-t <value>]

ARGUMENTS
  TRIGGER  trigger name

FLAGS
  -t, --tenant=<value>  tenant

DESCRIPTION
  Run a trigger
```

_See code: [src/commands/run-trigger.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/run-trigger.js)_

## `saltcorn scheduler`

Run the Saltcorn scheduler

```
USAGE
  $ saltcorn scheduler [-v]

FLAGS
  -v, --verbose  Verbose

DESCRIPTION
  Run the Saltcorn scheduler
```

_See code: [src/commands/scheduler.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/scheduler.js)_

## `saltcorn serve`

Start the Saltcorn server

```
USAGE
  $ saltcorn serve [-h <value>] [-p <value>] [-v] [-r] [-d] [-a] [-n] [-s] [--subdomain_offset <value>]

FLAGS
  -a, --addschema                 Add schema if missing
  -d, --dev                       Run in dev mode and re-start on file changes
  -h, --host=<value>              listen hostname
  -n, --nomigrate                 No migrations
  -p, --port=<value>              [default: 3000] port
  -r, --watchReaper               Watch reaper
  -s, --noscheduler               No scheduler
  -v, --verbose                   Verbose
      --subdomain_offset=<value>  Number of parts to remove to access subdomain in 'multi_tenant' mode

DESCRIPTION
  Start the Saltcorn server
```

_See code: [src/commands/serve.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/serve.js)_

## `saltcorn set-cfg [KEY] [VALUE]`

Set a configuration value. The supplied value (argument, or file stdin) will be parsed as JSON. If this fails, it is stored as a string.

```
USAGE
  $ saltcorn set-cfg [KEY] [VALUE] [-t <value>] [-p <value>] [-f <value>] [-i]

ARGUMENTS
  KEY    Configuration key
  VALUE  Configuration value (JSON or string)

FLAGS
  -f, --file=<value>    file
  -i, --stdin           read value from stdin
  -p, --plugin=<value>  plugin
  -t, --tenant=<value>  tenant

DESCRIPTION
  Set a configuration value. The supplied value (argument, or file stdin) will be parsed as JSON. If this fails, it is
  stored as a string.
```

_See code: [src/commands/set-cfg.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/set-cfg.js)_

## `saltcorn set-daily-time [MINS]`

Set the time the default daily event will run, offset in minutes from the current time. Restart required.

```
USAGE
  $ saltcorn set-daily-time [MINS] [-t <value>]

ARGUMENTS
  MINS  Number of minutes in the futute (negative for past)

FLAGS
  -t, --tenant=<value>  tenant

DESCRIPTION
  Set the time the default daily event will run, offset in minutes from the current time. Restart required.
```

_See code: [src/commands/set-daily-time.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/set-daily-time.js)_

## `saltcorn setup`

Set up a new system

```
USAGE
  $ saltcorn setup [-c]

FLAGS
  -c, --coverage  Coverage

DESCRIPTION
  Set up a new system
  ...
  This will attempt to install or connect a database, and set up a
  configuration file
```

_See code: [src/commands/setup.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/setup.js)_

## `saltcorn setup-benchmark`

Setup an instance for benchmarking

```
USAGE
  $ saltcorn setup-benchmark [-t <value>] [-n <value>]

FLAGS
  -n, --name=<value>    name
  -t, --tenant=<value>  tenant

DESCRIPTION
  Setup an instance for benchmarking
```

_See code: [src/commands/setup-benchmark.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/setup-benchmark.js)_

## `saltcorn sync-upload-data`

Runs a sync for data supplied by the mobile app

```
USAGE
  $ saltcorn sync-upload-data [--tenantAppName <value>] [--userEmail <value>] [--directory <value>]
    [--newSyncTimestamp <value>] [--oldSyncTimestamp <value>]

FLAGS
  --directory=<value>         directory name for input output data
  --newSyncTimestamp=<value>  new timestamp for the sync_info rows
  --oldSyncTimestamp=<value>  TODO
  --tenantAppName=<value>     Optional name of a tenant application
  --userEmail=<value>         email of the user running the sync

DESCRIPTION
  Runs a sync for data supplied by the mobile app
```

_See code: [src/commands/sync-upload-data.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/sync-upload-data.js)_

## `saltcorn take-snapshot`

Print a current snapshout to stdout

```
USAGE
  $ saltcorn take-snapshot [-t <value>] [-f]

FLAGS
  -f, --fresh           fresh
  -t, --tenant=<value>  tenant

DESCRIPTION
  Print a current snapshout to stdout
```

_See code: [src/commands/take-snapshot.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/take-snapshot.js)_

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

DESCRIPTION
  transform an existing field by applying a calculated expression
```

_See code: [src/commands/transform-field.js](https://github.com/saltcorn/saltcorn/blob/v1.6.0-alpha.8/packages/saltcorn-cli/src/commands/transform-field.js)_
<!-- commandsstop -->
