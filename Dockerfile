FROM ubuntu:20.04

RUN apt-get update \ 
 && DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm libpq-dev

RUN npm install -g lerna

COPY . saltcorn/

WORKDIR saltcorn

RUN lerna bootstrap

EXPOSE 4649

CMD ["/saltcorn/packages/saltcorn-cli/bin/saltcorn", "serve", "-p", "4649"]

