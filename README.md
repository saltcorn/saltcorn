# Saltcorn

![Build and Test](https://github.com/saltcorn/saltcorn/workflows/Node.js%20CI/badge.svg)

## Install from packages

### Installing node and npm

Instructions have been tested on Ubuntu 20.04

For a recent version (v14) of Node.js:

```
wget -qO - https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs libpq-dev
```

### Install saltcorn

`npm install -g @saltcorn/cli`

### Setup (automated)

`saltcorn setup` and follow instructions

### Setup (manual)

skip this section if you ran `saltcorn setup`

1. Install PostgreSQL: `sudo apt install postgresql postgresql-client`
2. Either,
   - Create a JSON file `.saltcorn` in your XDF config directory (on Ubuntu this is normally $HOME/.config) with these values:
      * host: address of PostgreSQL server
      * port: port of PostgreSQL server
      * database: PostgreSQL database
      * user: PostgreSQL user name
      * password: PostgreSQL user password
      * session_secret: Saltcorb session secret
      * multi_tenant: run as multi-tenant (true/false)
     
     For example: `{"host":"localhost","port":5432,"database":"saltcorn","user":"tomn","password":"dgg2342vfB","session_secret":"hrh64b45b3","multi_tenant":true}`. Or, 
   - Set environment variables. TODO

### Run

`saltcorn serve`



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

`git ls-files | xargs prettier --write`

### dev server

`nodemon packages/saltcorn-cli/bin/saltcorn serve`

to also watch a local module

`nodemon --watch ../saltcorn-kanban/ packages/saltcorn-cli/bin/saltcorn serve`

### React rebuild on save

in `saltcorn/packages/saltcorn-builder/` run:

`git ls-files | entr npm run builddev`
