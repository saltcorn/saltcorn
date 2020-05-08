# Saltcorn

![Build and Test](https://github.com/glutamate/saltcorns/workflows/Node.js%20CI/badge.svg)

## Install from source (for saltcorn developers)

### Installing node and npm on Ubuntu

`sudo apt install nodejs npm libpq-dev`

will give you a usable version. For a more recent version (v13) of Node.js:

```
sudo apt install curl
curl -sL https://deb.nodesource.com/setup_13.x | sudo -E bash -
sudo apt-get install -y nodejs libpq-dev
```

I had problems connecting to the database on Node 14.

### Prepare Node


assuming you have cloned this repository to \$HOME/saltcorns (otherwise adjust PATH)

```
npm config set prefix ~/.local
echo 'export PATH=$HOME/saltcorns/packages/saltcorn-cli/bin:$HOME/.local/bin:$PATH' >> ~/.bashrc
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

## Prettier

`git ls-files | xargs prettier --write`

## dev server

`nodemon packages/saltcorn-cli/bin/saltcorn serve`

to also watch a local module

`nodemon --watch ../saltcorn-kanban/ packages/saltcorn-cli/bin/saltcorn serve`
