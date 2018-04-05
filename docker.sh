#!/usr/bin/env bash

set -e
set -o pipefail

if [[ $(id -u) == "0" ]];
then
    apt-get update -qq
    apt-get install -y make
    useradd --password password --no-create-home --home-dir /rsconnect --uid "$NB_UID" --gid "$NB_GID" "$NB_USER"
    su -l -c "$0 $@" "$NB_USER"
    exit $?
fi

export PATH=/opt/conda/bin:$PATH

if [[ $(conda env list | grep py3 | wc -l) == "1" ]];
then
    echo Environment already exists
else
    # install jupyter into a new environment
    conda create --yes --name py3 jupyter
fi
source activate py3

make -f /rsconnect/Makefile $1
