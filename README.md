# Saltcorn

![Build and Test](https://github.com/saltcorn/saltcorn/workflows/Node.js%20CI/badge.svg)

## Install from packages

Instructions have been tested on Ubuntu 20.04

### Installing node and npm

For a recent version (v14) of Node.js:

```
wget -qO - https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs libpq-dev
```

### Install saltcorn

`npm install -g @saltcorn/cli`

### Setup (automated)

if you are `root`, create a user with sudo and switch to that user:

```
adduser saltcorn
adduser saltcorn sudo
su saltcorn
cd
mkdir -p ~/.config/
```

run

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
Restart=on-failure

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

## Development Tips

### Prettier

we use prettier 1.x:

`npm install -g prettier@1.19.1`

to format code:

`git ls-files | grep -v builder_bundle | xargs prettier --write`

### dev server

`nodemon packages/saltcorn-cli/bin/saltcorn serve`

to also watch a local module

`nodemon --watch ../saltcorn-kanban/ packages/saltcorn-cli/bin/saltcorn serve`

### React rebuild on save

in `saltcorn/packages/saltcorn-builder/` run:

`git ls-files | entr npm run builddev`
