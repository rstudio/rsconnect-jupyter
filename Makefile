.PHONY: clean images image% launch notebook% package dist run test test% shell shell% dist-run dist-run%

NB_UID=$(shell id -u)
NB_GID=$(shell id -g)

IMAGE=rstudio/rsconnect-jupyter-py

clean:
	rm -rf build/ dist/ rsconnect.egg-info/

images: image2 image3.4 image3.5 image3.6 image3.7

image%:
	docker build \
		--tag $(IMAGE)$* \
		--file Dockerfile \
		--build-arg BASE_IMAGE=continuumio/miniconda:4.4.10 \
		--build-arg NB_UID=$(NB_UID) \
		--build-arg NB_GID=$(NB_GID) \
		--build-arg PY_VERSION=$* \
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


notebook%:
	make DOCKER_IMAGE=$(IMAGE)$* PY_VERSION=$* TARGET=run launch

tests: test2 test3.4 test3.5 test3.6 test3.7

test:
# TODO run in container
	python -V
	python -Wi setup.py test

test%:
	make DOCKER_IMAGE=rstudio/rsconnect-jupyter-py$* PY_VERSION=$* TARGET=test launch

dist:
# wheels don't get built if _any_ file it tries to touch has a timestamp < 1980
# (system files) so use the current timestamp as a point of reference instead
	SOURCE_DATE_EPOCH="$(shell date +%s)"; python setup.py bdist_wheel

package:
	make DOCKER_IMAGE=$(IMAGE)3 PY_VERSION=3 TARGET=dist launch

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
	jupyter-notebook -y --notebook-dir=/notebooks --ip='*' --port=9999 --no-browser --NotebookApp.token=''

shell:
	bash

shell%:
	make DOCKER_IMAGE=$(IMAGE)$* PY_VERSION=$* TARGET=shell launch

dist-run%:
	make DOCKER_IMAGE=$(IMAGE)$* PY_VERSION=$* TARGET=dist-run launch

dist-run: dist
	pip install dist/rsconnect-1.0.0-py2.py3-none-any.whl
	jupyter-nbextension install --symlink --user --py rsconnect
	jupyter-nbextension enable --py rsconnect
	jupyter-serverextension enable --py rsconnect
	jupyter-notebook -y --notebook-dir=/notebooks --ip='*' --port=9999 --no-browser --NotebookApp.token=''
