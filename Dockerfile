FROM node:14

RUN apt-get update \ 
 && DEBIAN_FRONTEND=noninteractive apt-get install -y libpq-dev

RUN npm install -g lerna

COPY . saltcorn/

WORKDIR saltcorn

RUN lerna bootstrap

EXPOSE 4649

ENV SALTCORN_MULTI_TENANT true

CMD ["/saltcorn/packages/saltcorn-cli/bin/saltcorn", "serve", "-p", "4649"]

