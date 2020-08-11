FROM node:14

RUN npm install -g lerna

WORKDIR /opt/saltcorn

COPY . /opt/saltcorn

RUN lerna bootstrap