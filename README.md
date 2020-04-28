# Saltcorn

![Build and Test](https://github.com/glutamate/saltcorns/workflows/Node.js%20CI/badge.svg)

### Install

`lerna bootstrap`

### Prettier

`git ls-files | xargs prettier --write`

### dev server 

`nodemon packages/saltcorn-cli/bin/saltcorn serve`

to also watch a local module

`nodemon --watch ../saltcorn-kanban/ packages/saltcorn-cli/bin/saltcorn serve`