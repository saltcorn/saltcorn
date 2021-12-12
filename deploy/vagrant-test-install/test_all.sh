#!/usr/bin/env bash

set -ex

for d in */ ; do
    echo ""
    echo "-----------------------------------------"
    echo "Now testing $d"
    echo "-----------------------------------------"
    pushd "$d"
    vagrant up
    vagrant destroy -f
    popd
done