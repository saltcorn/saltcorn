#!/bin/bash

dir=`dirname "$0"`
if [ "$SKIP_DOCKER_IMAGE_INSTALL" != "true" ]; then
  docker build "$dir" -f "$dir"/Dockerfile -t saltcorn/cordova-builder
fi

exit 0
