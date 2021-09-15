#!/usr/bin/env bash

set -ex

for d in */ ; do
    pushd "$d"
    vagrant up
    vagrant destroy -f
    popd
done