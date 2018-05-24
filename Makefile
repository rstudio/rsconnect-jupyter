.PHONY: clean images image2 image3 launch notebook2 notebook3 package dist test dist run bash

NB_UID=$(shell id -u)
NB_GID=$(shell id -g)

PY2=rstudio/rsconnect-jupyter-py2
PY3=rstudio/rsconnect-jupyter-py3

clean:
	rm -rf build/ dist/ rsconnect.egg-info/

images: image2 image3

image2:
	docker build \
		--tag $(PY2) \
		--file Dockerfile \
		--build-arg BASE_IMAGE=continuumio/miniconda:4.4.10 \
		--build-arg NB_UID=$(NB_UID) \
		--build-arg NB_GID=$(NB_GID) \
		--build-arg PY_VERSION=2 \
		.

image3:
	docker build \
		--tag $(PY3) \
		--file Dockerfile \
		--build-arg BASE_IMAGE=continuumio/miniconda3:4.4.10 \
		--build-arg NB_UID=$(NB_UID) \
		--build-arg NB_GID=$(NB_GID) \
		--build-arg PY_VERSION=3 \
		.

launch:
	docker run --rm -i -t \
		-v $(CURDIR)/notebooks$(PY_VERSION):/notebooks \
		-v $(CURDIR):/rsconnect \
		-e NB_UID=$(NB_UID) \
		-e NB_GID=$(NB_GID) \
		-e PY_VERSION=$(PY_VERSION) \
		-p :9999:9999 \
		$(DOCKER_IMAGE) \
		/rsconnect/run.sh $(TARGET)


notebook2:
	make DOCKER_IMAGE=$(PY2) PY_VERSION=2 TARGET=run launch

notebook3:
	make DOCKER_IMAGE=$(PY3) PY_VERSION=3 TARGET=run launch

test:
# TODO run in container
	python setup.py test

dist:
# wheels don't get built if _any_ file it tries to touch has a timestamp < 1980
# (system files) so use the current timestamp as a point of reference instead
	SOURCE_DATE_EPOCH="$(shell date +%s)"; python setup.py bdist_wheel

package:
	make DOCKER_IMAGE=$(PY3) PY_VERSION=3 TARGET=dist launch

run:
# link python package
	python setup.py develop
# install rsconnect as a jupyter extension
	jupyter-nbextension install --symlink --user --py rsconnect
# enable js extension
	jupyter-nbextension enable --py rsconnect
# enable python extension
	jupyter-serverextension enable --py rsconnect
# start notebook
	jupyter-notebook -y --notebook-dir=/notebooks --ip='*' --port=9999 --no-browser

shell:
	bash
