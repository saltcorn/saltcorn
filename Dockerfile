FROM node:14

RUN npm install -g lerna

WORKDIR /opt/

COPY . /opt/

RUN lerna bootstrap

CMD ["/opt/saltcorn/packages/saltcorn-cli/bin/saltcorn"]