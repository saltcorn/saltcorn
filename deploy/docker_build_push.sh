#!/usr/bin/env bash

set -xe

VERSION=`jq -r .version packages/saltcorn-data/package.json`
echo $VERSION
docker build --no-cache -t saltcorn/saltcorn:latest -f Dockerfile.release .
docker push saltcorn/saltcorn:latest

docker build -t saltcorn/saltcorn:$VERSION -f Dockerfile.release .
docker push saltcorn/saltcorn:$VERSION

docker build --no-cache -t saltcorn/saltcorn-with-mobile:latest -f Dockerfile.mobile.release .
docker push saltcorn/saltcorn-with-mobile:latest

docker build -t saltcorn/saltcorn-with-mobile:$VERSION -f Dockerfile.mobile.release .
docker push saltcorn/saltcorn-with-mobile:$VERSION

docker build -t saltcorn/cordova-builder:$VERSION -f packages/saltcorn-mobile-builder/docker/Dockerfile packages/saltcorn-mobile-builder/docker
docker push saltcorn/cordova-builder:$VERSION

docker build --no-cache -t saltcorn/cordova-builder:latest -f packages/saltcorn-mobile-builder/docker/Dockerfile packages/saltcorn-mobile-builder/docker
docker push saltcorn/cordova-builder:latest

docker build -t saltcorn/saltcorn:dev -f Dockerfile.dev .
docker push saltcorn/saltcorn:dev


