#!/bin/bash

# setup miniconda
if ! [ $(which conda) ] ; then
	echo installing conda
	curl -o miniconda.sh 'https://repo.continuum.io/miniconda/Miniconda2-latest-MacOSX-x86_64.sh'
	sh miniconda.sh -u -b
fi

if [ $(grep $1 versions) ] ; then
    conda create -n testenv$1 python=$1 anaconda
    conda install virtualenv
else
    echo Please run with a valid Python Version
    exit 1
fi

# activate virtualenv
source activate testenv$1

# get appropriate jupyter plugin
curl http://s3.amazonaws.com/rstudio-rsconnect-jupyter/>AWS_OUTPUT

read_dom () {
    local IFS=\>
    read -d \< ENTITY CONTENT
}

if [ -z $2 ] ; then
        CONTENT_ARRAY=()
        while read_dom ; do
            if [[ $ENTITY = "Key" ]] ; then
                for i in $CONTENT ; do
                        if [[ $CONTENT == *".whl" ]] ; then
                                 CONTENT_ARRAY+=($CONTENT)
                        fi
                    done
        fi
        done<AWS_OUTPUT

        echo installing the latest version of the jupyter plugin: ${CONTENT_ARRAY[${#CONTENT_ARRAY[@]}-1]}...
        pip install https://s3.amazonaws.com/rstudio-rsconnect-jupyter/${CONTENT_ARRAY[${#CONTENT_ARRAY[@]}-1]} || exit 1
else 
        echo installing jupyter plugin version $2: https://s3.amazonaws.com/rstudio-rsconnect-jupyter/rsconnect-1.1.0.$2-py2.py3-none-any.whl
        pip install https://s3.amazonaws.com/rstudio-rsconnect-jupyter/rsconnect-1.1.0.$2-py2.py3-none-any.whl || exit 1
fi

# install and run jupyter
pip install install jupyter
jupyter-nbextension install --sys-prefix --py rsconnect
jupyter-nbextension enable --sys-prefix --py rsconnect
jupyter-serverextension enable --sys-prefix --py rsconnect
jupyter notebook
