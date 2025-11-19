[![Saltcorn Banner](https://user-images.githubusercontent.com/66894759/159173453-2ca63e71-1ff5-4f1e-b551-58b157b0de52.png)](https://saltcorn.com)

[![Build and Test](https://github.com/saltcorn/saltcorn/workflows/Node.js%20CI/badge.svg)](https://github.com/saltcorn/saltcorn/actions/workflows/nodejs.yml) [![OpenCollective](https://img.shields.io/badge/OpenCollective-1F87FF?style=flat&logo=OpenCollective&logoColor=black)](https://opencollective.com/saltcorn)

# Saltcorn

Saltcorn is an extensible open source no-code database application builder. Use it to build web and mobile database applications with flexible views, datatypes, layouts and actions

This repository contains the core codebase, including the code necessary to self-host an instance and to host a multitenant instance.

## Acknowledgements

Saltcorn is using [PostgreSQL](https://github.com/postgres/postgres), [node.js](https://github.com/nodejs/node), [node-postgres](https://node-postgres.com/), [express](https://github.com/expressjs/express), [live-plugin-manager](https://www.npmjs.com/package/live-plugin-manager), [craft.js](https://craft.js.org/), [jQuery-Menu-Editor](https://github.com/davicotico/jQuery-Menu-Editor), [Blockly](https://developers.google.com/blockly), [CodeMirror](https://codemirror.net/) and other awesome free and open source projects.

## Trying out Saltcorn

#### Online

A multitenant instance of Saltcorn is running at [saltcorn.com](https://saltcorn.com), and you can create a new application under a subdomain at [https://saltcorn.com/tenant/create](https://saltcorn.com/tenant/create).
This service is free but there are no guarantees about the security or availability of your application or the information you are storing. This service should only be used to explore the capabilities of Saltcorn.

#### Desktop

To try out Saltcorn on your desktop, make sure you have node.js 18+ and npm installed. Then run these commands on the command line:

```
npm config set prefix ~/.local
npm install -g @saltcorn/cli
export SQLITE_FILEPATH=~/saltcorn.sqlite
.local/bin/saltcorn reset-schema -f
.local/bin/saltcorn serve
```

Now open http://localhost:3000/ in your browser. When you want to run this again, you need to run the `export` line and the `saltcorn serve` line. or simply run `SQLITE_FILEPATH=~/saltcorn.sqlite .local/bin/saltcorn serve`.

#### Server

To install Saltcorn on a fresh virtual machine, simply install node.js and run `npx saltcorn-install -y`; see [Quick install server on Linux](#quick-install-server-on-linux). To try out Saltcorn with docker-compose see [Quickstart with Docker](#quickstart-with-docker).

## Hosting options

For self-hosting, a 2 GB virtual private server is sufficient to run Saltcorn unless you expect high traffic volumes. Installation instructions are given below. Saltcorn can also run on a 1GB virtual machine, but there can be issues with upgrading.

[DigitalOcean](https://marketplace.digitalocean.com/apps/saltcorn) and [Linode](https://www.linode.com/marketplace/apps/linode/saltcorn/) have one-click install options for Saltcorn

If hosting on DigitalOcean, which offers a 2GB virtual machine for $12 per month, please consider using our [referral code](https://m.do.co/c/a1bcfb757fda) which will give you $100 credit over 60 days.

## Quickstart with Docker

You can run a local instance for quick testing by running the following command:

`cd ./deploy/examples/test && docker-compose up -d`

and then go to http://localhost:3000 in your web browser.

NOTE: The dependencies to build mobile apps are quite large, they are not installed in the standard docker image (saltcorn/saltcorn). To use an image that includes the mobile dependencies as well, either use 'saltcorn/saltcorn-with-mobile' directly or replace 'saltcorn/saltcorn' with 'saltcorn/saltcorn-with-mobile' in the docker-compose file.

## Quick install server on Linux

This has been [tested on Debian 11 and 12, Ubuntu 18.04, 20.04, 22.04, 24.04, OpenSuSE, AlmaLinux, and Fedora](https://releases.saltcorn.com/). All you need is to run these
three lines on the command line shell, as root or as a user with sudo access:

```
wget -qO - https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -qqy nodejs
npx saltcorn-install -y
```

The first two lines will install Node.js 22 (you can also use 18, 20, or 24). The last line will call the Saltcorn install script
accepting all the defaults, which installs PostgreSQL and sets up Saltcorn as a service
listening on port 80.

If you want a different port, different database backend, or to not install as a service, you
can omit the final `-y` to get an interactive installation:

```
wget -qO - https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -qqy nodejs
npx saltcorn-install
```

## Install from NPM packages

Instructions have been tested on Ubuntu 20.04 on a 1GB VM.

TL;DR: `npm install -g @saltcorn/cli && saltcorn setup`

### Installing node and npm

For a recent version (v22) of Node.js:

```
wget -qO - https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs libpq-dev build-essential python-is-python3
```

You can also any Node version 18-24.

### Install Saltcorn

`npm install -g @saltcorn/cli`

If this fails, you may need to tell npm to disregard file permissions during compilation:

`npm install -g @saltcorn/cli --unsafe`

Sometimes, the above commands fail to install the library `sd-notify` (which is useful for
integrating with systemd) even though it is installable. You can rectify that by installing
it subsequently:

`npm install -g sd-notify`

### Setup (automated)

if you are `root`, create a user with sudo and switch to that user:

```
adduser saltcorn
adduser saltcorn sudo
su saltcorn
cd
mkdir -p ~/.config/
```

then run

`saltcorn setup` and follow the instructions given.

### Setup (manual)

NOTE: this is somewhat out of date; see instead https://wiki.saltcorn.com/view/ShowPage?title=Install%20on%20Ubuntu, in paticular the last section.

Skip this section if you ran `saltcorn setup` or `npx saltcorn-install`

1. Install PostgreSQL: `sudo apt install postgresql postgresql-client`
2. Either,

   - Create a JSON file `.saltcorn` in your XDG config directory (on Ubuntu this is normally \$HOME/.config) with these values:

     - `host`: address of PostgreSQL server
     - `port`: port of PostgreSQL server
     - `database`: PostgreSQL database
     - `user`: PostgreSQL user name
     - `password`: PostgreSQL user password
     - `sslmode`: PostgreSQL [SSL Mode](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNECT-SSLMODE)
     - `sslcert`: PostgreSQL [SSL Certificate](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNECT-SSLCERT)
     - `sslkey`: PostgreSQL [SSL Key](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNECT-SSLKEY)
     - `sslrootcert`: PostgreSQL [SSL Root Certificate](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNECT-SSLROOTCERT)
     - `session_secret`: Saltcorn session secret
     - `multi_tenant`: run as multi-tenant (true/false)
     - `multi_node`: update other Saltcorn nodes when data changes with Postgres LISTEN/NOTIFY (true/false)

     For example:

     ```
     {
        "host":"localhost",
        "port":5432,
        "database":"saltcorn",
        "user":"tomn",
        "password":"dgg2342vfB",
        "session_secret":"hrh64b45b3",
        "multi_tenant":true,
        "multi_node":false
     }
     ```

     Or,

   - Set environment variables. `SALTCORN_SESSION_SECRET`, `SALTCORN_MULTI_TENANT` (defaults to `false`), `SALTCORN_MULTI_NODE` (defaults to `false`), and either `DATABASE_URL` or `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`. You can also set `PGSSLMODE`, `PGSSLCERT`, `PGSSLKEY`, `PGSSLROOTCERT` (see [Postgres Documentation](https://www.postgresql.org/docs/current/libpq-envars.html))

### Run

`saltcorn serve`

### Server install

#### Install Saltcorn as a service

Installing saltcorn as a service will mean it runs in the background and restarts automatically if the system reboots.

create a file `/lib/systemd/system/saltcorn.service` with these contents:

```
[Unit]
Description=saltcorn
Documentation=https://saltcorn.com
After=network.target

[Service]
Type=notify
WatchdogSec=30
User=saltcorn
WorkingDirectory=/home/saltcorn
ExecStart=/home/saltcorn/.local/bin/saltcorn serve -p 80
Restart=always
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
```

run:

```
sudo systemctl daemon-reload
sudo systemctl start saltcorn
sudo systemctl enable saltcorn
```

This may be in a different location in non-Debian systems, e.g. in `/etc/systemd/system` instead.

In order to allow the `saltcorn` user to open port 80, you need to permission node.js to allow
this by running:

```
sudo setcap 'cap_net_bind_service=+ep' `which node`
```

#### SSL certificate

Use [Let's Encrypt](https://letsencrypt.org/) or [Cloudflare](https://www.cloudflare.com/ssl/) to get a free SSL certificate (for https).

## Install from source (for Saltcorn developers)

### Installing node and npm on Ubuntu

`sudo apt install nodejs npm libpq-dev`

will give you a usable version. For a more recent version (v22) of Node.js:

```
wget -qO - https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs libpq-dev
```

### Prepare Node

assuming you have cloned this repository to \$HOME/saltcorn (otherwise adjust PATH)

```
npm config set prefix ~/.local
echo 'export PATH=$HOME/saltcorn/packages/saltcorn-cli/bin:$HOME/.local/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Install packages

run

```
npm install --legacy-peer-deps
npm run tsc
```

to install everything. If successful, you should now be able to run `saltcorn` in your shell.

## Packages

- [@saltcorn-cli](https://github.com/saltcorn/saltcorn/tree/master/packages/saltcorn-cli): command-line interface

## Deployment tips

- If your Saltcorn server is running behind a reverse proxy such as Nginx, refer to the [Socket.io reverse proxy documentation](https://socket.io/docs/v3/reverse-proxy/#nginx). This configuration is essential for Socket.io, which powers the chat, log-viewer, and streaming API functionalities (e.g. for the [recorder plugin](https://www.npmjs.com/package/@saltcorn/recorder)).
  - If you're behind Apache >= 2.4.47 then all you need in your virtual host section is two lines:
    ```
    # To identify the tenant
    ProxyPreserveHost On 

    ProxyPass / http://localhost:3000/ upgrade=websocket 
    ```
- If a mobile app build gives you `Error: EACCES: permission denied, rmdir '/home/saltcorn/mobile_app_build/android/.gradle/8.4'` or similar, try running `sudo rm -rf /home/saltcorn/mobile_app_build/android/.gradle/8.4` once. From version 1.3.0-beta.5 on, it should disappear.
### Multi-node

* Saltcorn's `multi_node` mode only works when using **PostgreSQL** as the database backend.
  * When running multiple Saltcorn nodes on **different machines**, all nodes must share the same **tenant folder** and **Saltcorn file system**.
  * Use a **shared drive** so all nodes read and write from a single central location.

## Development tips

### Dev server

cd to your saltcorn repository clone, then then run this in shell:

`npm run tsc; while [ 1 ]; do SALTCORN_NWORKERS=1 saltcorn serve --dev;done`

This will restart the server and rebuild with tsc every time you save a file in the saltcorn repo or in a local plugin.

### Working with local plugins

A Local plugin means that the code lives in your home directory and when you edit it, the plugin updates in the instance after a restart (which will happen automatically on save, when running the dev server)

If you have a plugin checked out in a directory, you can install it in the running instance through the CLI in two different ways:

* If the plugin is not already installed in the instance, run `saltcorn install-plugin -d path_to_plugin` (if the plugin is checked out in path_to_plugin)

* if the plugin is already installed in the instance, you can convert it to a local plugin with the `dev:localize-plugin` CLI command: `saltcorn dev:localize-plugin plugin_name {path_to_plugin}`.

* You can also unlocalize a plugin, see the help for `dev:localize-plugin`

### Running tests

Run all jest tests with `saltcorn run-tests`

Run jest tests for a specific package: `saltcorn run-tests saltcorn-data` to run tests for the data package - third argument should match directory name inside `packages/`

Tests coverage reporter: `saltcorn run-tests saltcorn-data -c`

Run a specific test by matching name: `saltcorn run-tests saltcorn-data -t 'File class'`


See github/pytest.yml for running the python-based security tests. 

### Prettier

we use prettier:

`npm install -g prettier`

to format code:

`git ls-files | grep -v builder_bundle | xargs prettier --write`

Run this before every pull request.


### React build builder

```
cd packages/saltcorn-builder
npm install
npm install styled-components@4.4.1
npm run build
```

### React rebuild on save

in `saltcorn/packages/saltcorn-builder/` run:

`git ls-files | entr npm run builddev`

but this is not a production build, so run

`npm run build`

when done.

If you get this error: `Error: error:0308010C:digital envelope routines::unsupported`,
run this and try again: `export NODE_OPTIONS=--openssl-legacy-provider`.

### Build tsdocs

```
npm install --legacy-peer-deps
npm run tsc
```

then

`npm run docs`

TSDocs will then be available in `docs/`.

To deploy these to https://saltcorn.github.io/tsdocs/:

```
cp -R docs/* /path/to/tsdocs
cd /path/to/tsdocs
git add .
git commit -am 'version number or other message...'
```
