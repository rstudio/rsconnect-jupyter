.PHONY: pull launch notebook2 notebook3 package dist test dist develop run

DOCKER_USER=$(shell id -nu)
DOCKER_UID=jenkins
DOCKER_GID=jenkins
ifeq (Linux,$(shell uname))
	DOCKER_UID=$(shell id -u)
	DOCKER_GID=$(shell id -g)
endif

PY3=continuumio/miniconda3:4.4.10
PY2=continuumio/miniconda:4.4.10

PY_VERSION=3

pull:
	docker pull $(PY3)
	docker pull $(PY2)
#	docker pull python:2.7
#	docker pull python:3.6
	docker pull node:6-slim

launch:
	docker run --rm -i -t \
		-v $(CURDIR)/notebooks:/notebooks \
		-v $(CURDIR):/rsconnect \
		-e NB_UID=${DOCKER_UID} \
		-e NB_GID=${DOCKER_GID} \
		-e NB_USER=${DOCKER_USER} \
		-e PY_VERSION=${PY_VERSION} \
		-p :9999:9999 \
		$(DOCKER_IMAGE) \
		/rsconnect/docker.sh $(TARGET)


notebook2:
	make DOCKER_IMAGE=$(PY2) PY_VERSION=2 TARGET=run launch

notebook3:
	make DOCKER_IMAGE=$(PY3) TARGET=run launch

test:
# TODO run in container
	python setup.py test

dist:
# wheels don't get built if _any_ file it tries to touch has a timestamp < 1980
# (system files) so use the current timestamp as a point of reference instead
	SOURCE_DATE_EPOCH="$(shell date +%s)"; python setup.py bdist_wheel

package:
	make DOCKER_IMAGE=$(PY3) TARGET=dist launch

develop:
# link python package
	python setup.py develop
# install rsconnect as a jupyter extension
	jupyter-nbextension install --symlink --user --py rsconnect
# enable js extension
	jupyter-nbextension enable --py rsconnect
# enable python extension
	jupyter-serverextension enable --py rsconnect

run: develop
# start notebook
	jupyter-notebook -y --notebook-dir=/notebooks --ip='*' --port=9999 --no-browser
