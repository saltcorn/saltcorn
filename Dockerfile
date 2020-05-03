FROM ubuntu:20.04

RUN apt-get update && 
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm

RUN npm install -g lerna

COPY . saltcorn/

WORKDIR saltcorn

RUN lerna bootstrap

EXPOSE 4649

CMD ["saltcorn", "serve", "-p", "4649"]

