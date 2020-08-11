FROM node:14

WORKDIR /opt/saltcorn

COPY . /opt/saltcorn

RUN lerna bootstrap