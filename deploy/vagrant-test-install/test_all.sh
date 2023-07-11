#!/usr/bin/env bash

set -ex

# machines to run with libvirt
libvirts=("ubuntu2004-mobile/")

for d in */ ; do
    echo ""
    echo "-----------------------------------------"
    echo "Now testing $d"
    echo "-----------------------------------------"
    pushd "$d"
    if [[ "${libvirts[@]}" =~ "$d" ]]; then
      vagrant up --provider=libvirt
    else
      vagrant up
    fi
    vagrant destroy -f
    popd
done