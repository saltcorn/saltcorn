FROM node:14

RUN npm install -g lerna

WORKDIR /opt/saltcorn

COPY . /opt/saltcorn

RUN lerna bootstrap

ENV PATH "$PATH:/opt/saltcorn/packages/saltcorn-cli/bin/saltcorn"

ENTRYPOINT ["/opt/saltcorn/packages/saltcorn-cli/bin/saltcorn"]