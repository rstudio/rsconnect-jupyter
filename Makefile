.PHONY: clean all-images image% launch notebook% package dist run test all-tests test% shell shell% dist-run dist-run% pypi-run pypi-run% mock-server docs-build docs-image version-frontend

NB_UID=$(shell id -u)
NB_GID=$(shell id -g)

IMAGE=rstudio/rsconnect-jupyter-py
VERSION = $(shell pipenv run python setup.py --version)
PORT = $(shell printenv PORT || echo 9999)

clean:
	rm -rf build/ dist/ rsconnect_jupyter.egg-info/

all-images: image2 image3.5 image3.6 image3.7

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
		-v $(CURDIR):/rsconnect_jupyter \
		-e NB_UID=$(NB_UID) \
		-e NB_GID=$(NB_GID) \
		-e PY_VERSION=$(PY_VERSION) \
		-p :$(PORT):9999 \
		$(DOCKER_IMAGE) \
		/rsconnect_jupyter/run.sh $(TARGET)


notebook%:
	make DOCKER_IMAGE=$(IMAGE)$* PY_VERSION=$* TARGET=run launch

all-tests: test2 test3.5 test3.6 test3.7

test: version-frontend
	pip install --extra-index-url=https://test.pypi.org/simple rsconnect-python
	python -V
	python -Wi setup.py test

test%: version-frontend
	make DOCKER_IMAGE=rstudio/rsconnect-jupyter-py$* PY_VERSION=$* TARGET=test launch

test-selenium:
	$(MAKE) -C selenium clean test-env-up jupyter-up test || EXITCODE=$$? ; \
	$(MAKE) -C selenium jupyter-down || true ; \
	$(MAKE) -C selenium test-env-down || true ; \
	exit $$EXITCODE

dist: version-frontend
# wheels don't get built if _any_ file it tries to touch has a timestamp < 1980
# (system files) so use the current timestamp as a point of reference instead
	SOURCE_DATE_EPOCH="$(shell date +%s)"; pipenv run python setup.py sdist bdist_wheel

package:
	make DOCKER_IMAGE=$(IMAGE)3 PY_VERSION=3 TARGET=dist launch

run:
# link python package
	pipenv install --dev
# install rsconnect_jupyter as a jupyter extension
	pipenv run jupyter-nbextension install --symlink --user --py rsconnect_jupyter
# enable js extension
	pipenv run jupyter-nbextension enable --py rsconnect_jupyter
# enable python extension
	pipenv run jupyter-serverextension enable --py rsconnect_jupyter
# start notebook
	pipenv run jupyter-notebook -y --notebook-dir=/notebooks --ip='0.0.0.0' --port=9999 --no-browser --NotebookApp.token=''

shell:
	bash

shell%:
	make DOCKER_IMAGE=$(IMAGE)$* PY_VERSION=$* TARGET=shell launch

dist-run%:
	make DOCKER_IMAGE=$(IMAGE)$* PY_VERSION=$* TARGET=dist-run launch

dist-run: dist
	pipenv run pip install dist/rsconnect_jupyter-$(VERSION)-py2.py3-none-any.whl
	pipenv run jupyter-nbextension install --symlink --user --py rsconnect_jupyter
	pipenv run jupyter-nbextension enable --py rsconnect_jupyter
	pipenv run jupyter-serverextension enable --py rsconnect_jupyter
	pipenv run jupyter-notebook -y --notebook-dir=/notebooks --ip='0.0.0.0' --port=9999 --no-browser --NotebookApp.token=''

pypi-run%:
	make DOCKER_IMAGE=$(IMAGE)$* PY_VERSION=$* TARGET=pypi-run launch

pypi-run:
	pipenv run pip install rsconnect_jupyter==$(VERSION)
	pipenv run jupyter-nbextension install --symlink --user --py rsconnect_jupyter
	pipenv run jupyter-nbextension enable --py rsconnect_jupyter
	pipenv run jupyter-serverextension enable --py rsconnect_jupyter
	pipenv run jupyter-notebook -y --notebook-dir=/notebooks --ip='0.0.0.0' --port=9999 --no-browser --NotebookApp.token=''

pypi-test-run%:
	make DOCKER_IMAGE=$(IMAGE)$* PY_VERSION=$* TARGET=pypi-test-run launch

pypi-test-run:
	pipenv run pip install --index-url https://test.pypi.org/simple/ rsconnect_jupyter==$(VERSION)
	pipenv run jupyter-nbextension install --symlink --user --py rsconnect_jupyter
	pipenv run jupyter-nbextension enable --py rsconnect_jupyter
	pipenv run jupyter-serverextension enable --py rsconnect_jupyter
	pipenv run jupyter-notebook -y --notebook-dir=/notebooks --ip='0.0.0.0' --port=9999 --no-browser --NotebookApp.token=''

build/mock-connect/bin/flask:
	bash -c '\
		mkdir -p build && \
		virtualenv build/mock-connect && \
		. build/mock-connect/bin/activate && \
		pip install flask'

mock-server: build/mock-connect/bin/flask
	bash -c '\
		. build/mock-connect/bin/activate && \
		FLASK_APP=mock_connect.py flask run --host=0.0.0.0'

## Code quality tools

yarn:
	yarn install

lint: lint-js

lint-js:
	npm run lint

## Specify that Docker runs with the calling user's uid/gid to avoid file
## permission issues on Linux dev hosts.
DOCKER_RUN_AS=
ifeq (Linux,$(shell uname))
	DOCKER_RUN_AS=-u $(shell id -u):$(shell id -g)
endif

## Inside Jenkins (when JOB_NAME is defined), we are in the right type of
## Docker container. Otherwise, launch pandoc inside a
## rstudio/connect:docs container.
BUILD_DOC=env VERSION=${VERSION} ./docs/build-doc.sh
ifeq (${JOB_NAME},)
	BUILD_DOC=docker run --rm=true ${DOCKER_RUN_AS} \
		-e VERSION=${VERSION} \
		${DOCKER_ARGS} \
		-v $(CURDIR):/rsconnect_jupyter \
		-w /rsconnect_jupyter \
		rsconnect-jupyter-docs docs/build-doc.sh
endif

docs-image:
	docker build -t rsconnect-jupyter-docs ./docs

docs-build:
	${BUILD_DOC}


dist/rsconnect-jupyter-${VERSION}.pdf: docs/README.md docs/*.gif
	${BUILD_DOC}

version-frontend:
	printf '{"version":"%s"}\n' $(VERSION) >rsconnect_jupyter/static/version.json
