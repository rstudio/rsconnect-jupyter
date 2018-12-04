#!/usr/bin/env bash

set -e
set -o pipefail

if [[ $(id -u) == "0" ]];
then
    su -c "$0 $@" "$NB_USER"
    exit $?
fi

cd /rsconnect_jupyter
export PATH=/opt/conda/bin:$PATH
source activate "py${PY_VERSION/./}"
make -f /rsconnect_jupyter/Makefile $1
