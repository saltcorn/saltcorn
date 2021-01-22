# Saltcorn

![Build and Test](https://github.com/saltcorn/saltcorn/workflows/Node.js%20CI/badge.svg)

Saltcorn is an extensible open source no-code database application builder. Use it to build web applications based on relational data with flexible views, datatypes and layouts.

This repository contains the core codebase, including the code necessary to self host an instance and to host a multitenant instance.

## Trying out Saltcorn

A multitenant instance of Saltcorn is running at [saltcorn.com](https://saltcorn.com), and you can create a new database under a subdomain at [https://saltcorn.com/tenant/create](https://saltcorn.com/tenant/create)
this service is free but there are no guarantees about the security or availability of your application or the information you are storing. This service should only be used to explore the capabilities of saltcorn.

For self hosting, a 1 GB virtual private server is sufficient to run Saltcorn unless you expect high traffic volumes. Installation instructions are given below. If hosting on DigitalOcean, which offers a 1GB virtual machine for $5 per month, please consider using my [referral code](https://m.do.co/c/a1bcfb757fda) which will give you $100 credit over 60 days.

## Acknowledgements

Saltcorn is using PostgreSQL, node.js, [node-postgres](https://node-postgres.com/), express, [live-plugin-manager](https://www.npmjs.com/package/live-plugin-manager), [craft.js](https://craft.js.org/), [jQuery-Menu-Editor](https://github.com/davicotico/jQuery-Menu-Editor) and other awesome free and open source projects.

## Quickstart with Docker

You can run a local instance for quick test by running the following command

`cd ./deploy/examples/test && docker-compose up -d`

and then point your browser to http://localhost:3000

## Install from packages

Instructions have been tested on Ubuntu 20.04 on a 1GB VM.

TL;DR: `npm install -g @saltcorn/cli && saltcorn setup`

### Installing node and npm

For a recent version (v14) of Node.js:

```
wget -qO - https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs libpq-dev build-essential python-is-python3
```

### Install saltcorn

`npm install -g @saltcorn/cli`

If this fails, you may need to tell npm to disregard file permissions during compilation:

`npm install -g @saltcorn/cli --unsafe`

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

`saltcorn setup` and follow instructions

### Setup (manual)

Skip this section if you ran `saltcorn setup`

1. Install PostgreSQL: `sudo apt install postgresql postgresql-client`
2. Either,

   - Create a JSON file `.saltcorn` in your XDG config directory (on Ubuntu this is normally \$HOME/.config) with these values:

     - `host`: address of PostgreSQL server
     - `port`: port of PostgreSQL server
     - `database`: PostgreSQL database
     - `user`: PostgreSQL user name
     - `password`: PostgreSQL user password
     - `session_secret`: Saltcorb session secret
     - `multi_tenant`: run as multi-tenant (true/false)

     For example:

     ```
     {
        "host":"localhost",
        "port":5432,
        "database":"saltcorn",
        "user":"tomn",
        "password":"dgg2342vfB",
        "session_secret":"hrh64b45b3",
        "multi_tenant":true
     }
     ```

     Or,

   - Set environment variables. `SALTCORN_SESSION_SECRET`, `SALTCORN_MULTI_TENANT` (defaults to `false`), and either `DATABASE_URL` or `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`.

### Run

`saltcorn serve`

### Server install

#### nginx install and setup

Install nginx: `sudo apt install nginx`

create a file `/etc/nginx/sites-available/domain.com`, replacing `domain.com` with your domain, with these contents:

```
server {
    listen 80;
    server_name domain.com www.domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

link this file to the `sites-enabled` directory:

`sudo ln -s /etc/nginx/sites-available/domain.com /etc/nginx/sites-enabled/domain.com`

reload nginx:

`sudo service nginx reload`

now run saltcorn:

`sudo -u saltcorn saltcorn serve`

or

`saltcorn serve` if you didn't created a new user.

Check whether you can access your new site in the browser.

#### Install saltcorn as a service

Installing saltcorn as a service will mean it runs in the background and restarts automatically if the system reboots.

create a file `/lib/systemd/system/saltcorn.service` with these contents:

```
[Unit]
Description=saltcorn
Documentation=https://saltcorn.com
After=network.target

[Service]
Type=simple
User=saltcorn
WorkingDirectory=/home/saltcorn
ExecStart=/usr/bin/saltcorn serve
Restart=always

[Install]
WantedBy=multi-user.target
```

run:

```
sudo systemctl daemon-reload
sudo systemctl start saltcorn
sudo systemctl enable saltcorn
```

#### SSL certificate

Use cloudflare or lets encrypt to get a free SSL certificate (for https).

## Install from source (for saltcorn developers)

### Installing node and npm on Ubuntu

`sudo apt install nodejs npm libpq-dev`

will give you a usable version. For a more recent version (v14) of Node.js:

```
wget -qO - https://deb.nodesource.com/setup_14.x | sudo -E bash -
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

install lerna with

```
npm install -g lerna
```

run

```
lerna bootstrap
```

to install everything. If successful, you should now be able to run `saltcorn` in your shell

## Packages

- [@saltcorn-cli](https://github.com/saltcorn/saltcorn/tree/master/packages/saltcorn-cli): command-line interface

## Development tips

### Prettier

we use prettier:

`npm install -g prettier`

to format code:

`git ls-files | grep -v builder_bundle | xargs prettier --write`

Run this before every pull request.

### dev server

`nodemon packages/saltcorn-cli/bin/saltcorn serve`

to also watch a local module

`nodemon --watch ../saltcorn-kanban/ packages/saltcorn-cli/bin/saltcorn serve`

### React rebuild on save

in `saltcorn/packages/saltcorn-builder/` run:

`git ls-files | entr npm run builddev`
