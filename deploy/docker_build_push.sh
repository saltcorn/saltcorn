#!/usr/bin/env bash

set -xe

VERSION=`jq -r .version packages/saltcorn-data/package.json`
echo $VERSION
docker build -t saltcorn/saltcorn:$TAG -f Dockerfile.release .
docker push saltcorn/saltcorn:$TAG

docker build -t saltcorn/saltcorn:$VERSION -f Dockerfile.release .
docker push saltcorn/saltcorn:$VERSION

docker build -t saltcorn/saltcorn-with-mobile:$TAG -f Dockerfile.mobile.release .
docker push saltcorn/saltcorn-with-mobile:$TAG

docker build -t saltcorn/saltcorn-with-mobile:$VERSION -f Dockerfile.mobile.release .
docker push saltcorn/saltcorn-with-mobile:$VERSION

docker build -t saltcorn/capacitor-builder:$VERSION -f packages/saltcorn-mobile-builder/docker/Dockerfile packages/saltcorn-mobile-builder/docker
docker push saltcorn/capacitor-builder:$VERSION

docker build -t saltcorn/capacitor-builder:$TAG -f packages/saltcorn-mobile-builder/docker/Dockerfile packages/saltcorn-mobile-builder/docker
docker push saltcorn/capacitor-builder:$TAG

docker build -t saltcorn/saltcorn-isolated:$TAG -f Dockerfile.isolated.release .
docker push saltcorn/saltcorn-isolated:$TAG

docker build -t saltcorn/saltcorn-isolated:$VERSION -f Dockerfile.isolated.release .
docker push saltcorn/saltcorn-isolated:$VERSION

docker build -t saltcorn/saltcorn:dev -f Dockerfile.dev .
docker push saltcorn/saltcorn:dev

