#!/bin/sh

if [ `grep $1 versions` ] ; then
	sudo conda create -y -p /opt/Python/$1 python=$1
    sudo -H /opt/Python/$1/bin/pip install virtualenv
else
	echo Please run with a valid Python Version
	exit 1
fi

# setup miniconda
sudo curl -o miniconda.sh https://repo.continuum.io/miniconda/Miniconda3-latest-MacOSX-x86_64.sh
sudo sh miniconda.sh -b -u -p /opt/Python/miniconda

# setup virtualenv
PYTHONMAJOR=${1:0:3}
virtualenv --python=/opt/Python/$1/bin/python$PYTHONMAJOR testenv$1
source testenv$1/bin/activate

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
	done < AWS_OUTPUT

	echo installing the latest version of the jupyter plugin: ${CONTENT_ARRAY[${#CONTENT_ARRAY[@]}-1]}...
	sudo -H /opt/Python/$1/bin/pip install https://s3.amazonaws.com/rstudio-rsconnect-jupyter/${CONTENT_ARRAY[${#CONTENT_ARRAY[@]}-1]} || 
	echo "Latest notebook not available, try again." 
	exit 1

else 
	echo installing jupyter plugin version $2: https://s3.amazonaws.com/rstudio-rsconnect-jupyter/rsconnect-1.1.0.$2-py2.py3-none-any.whl
	sudo -H /opt/Python/$1/bin/pip install https://s3.amazonaws.com/rstudio-rsconnect-jupyter/rsconnect-1.1.0.$2-py2.py3-none-any.whl || 
	echo "$2 may not be a valid notebook version." 
	exit 1
fi

# install and run jupyter
sudo -H /opt/Python/$1/bin/pip install jupyter
sudo /opt/Python/$1/bin/jupyter-nbextension install --sys-prefix --py rsconnect
sudo /opt/Python/$1/bin/jupyter-nbextension enable --sys-prefix --py rsconnect
sudo /opt/Python/$1/bin/jupyter-serverextension enable --sys-prefix --py rsconnect
/opt/Python/$1/bin/jupyter notebook