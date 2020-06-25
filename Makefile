CONNECT_API_KEY ?= 0123456789abcdef0123456789abcdef
CONNECT_DOCKERFILE_DIR := mock-connect
CONNECT_HOST := mock-connect
CONNECT_IMAGE := rstudio/rsconnect-mock-connect
CONNECT_PORT := 6958
IMAGE := rstudio/rsconnect-jupyter-py
IMAGE_PREFIX := rstudio/rsconnect-jupyter-py
JUPYTER_HOST := jupyter
JUPYTER_IMAGE := rstudio/rsconnect-jupyter-py3.8
JUPYTER_LOG_LEVEL ?= INFO
JUPYTER_PORT := 9483
NB_GID := $(shell id -g)
NB_UID := $(shell id -u)
NOTEBOOKS_DIR := $(CURDIR)/notebooks3.8
NOTEBOOKS_DIR := /notebooks
NOTEBOOKS_DIR_MOUNT := /notebooks
PORT := $(shell printenv PORT || echo 9999)
PROJECT := rscjnet
RSCONNECT_DIR := /rsconnect_jupyter
S3_PREFIX := s3://rstudio-connect-downloads/connect/rsconnect-jupyter
VERSION := $(shell pipenv run python setup.py --version 2>/dev/null || echo 'NOTSET')

BDIST_WHEEL := dist/rsconnect_jupyter-$(VERSION)-py2.py3-none-any.whl
NETWORK := $(PROJECT)_default

# NOTE: See the `dist` target for why this exists.
SOURCE_DATE_EPOCH := $(shell date +%s)
export SOURCE_DATE_EPOCH

PYTHONPATH ?= $(CURDIR)
export PYTHONPATH

.PHONY: prereqs
prereqs:
	pip install -U pip
	pip install -U pipenv

.PHONY: install-latest-rsconnect-python
install-latest-rsconnect-python:
	pipenv run pip install -U https://cdn.rstudio.com/connect/rsconnect-python/latest/rsconnect_python-latest-py2.py3-none-any.whl

.PHONY: clean
clean:
	$(RM) -r \
		build/ \
		dist/ \
		docs/out/ \
		rsconnect_jupyter.egg-info/ \
		notebooks*/*

.PHONY: all-images
all-images: image2.7 image3.5 image3.6 image3.7 image3.8

image%:
	docker build \
		--tag $(IMAGE_PREFIX)$* \
		--file Dockerfile \
		--build-arg BASE_IMAGE=python:$*-slim \
		--build-arg NB_UID=$(NB_UID) \
		--build-arg NB_GID=$(NB_GID) \
		--build-arg PY_VERSION=$* \
		.

.PHONY: all-tests
all-tests: test2.7 test3.5 test3.6 test3.7 test3.8

.PHONY: test
test: version-frontend
	pipenv run pytest -vv --cov=rsconnect_jupyter tests/

.PHONY: test-selenium
test-selenium:
	$(MAKE) -C selenium clean test-env-up jupyter-up test || EXITCODE=$$? ; \
	$(MAKE) -C selenium jupyter-down || true ; \
	$(MAKE) -C selenium test-env-down || true ; \
	exit $$EXITCODE

# NOTE: Wheels won't get built if _any_ file it tries to touch has a timestamp
# before 1980 (system files) so the $(SOURCE_DATE_EPOCH) current timestamp is
# exported as a point of reference instead.
.PHONY: dist
dist: version-frontend
	pipenv run python setup.py bdist_wheel
	pipenv run twine check $(BDIST_WHEEL)
	rm -vf dist/*.egg
	@echo "::set-output name=whl::$(BDIST_WHEEL)"
	@echo "::set-output name=whl_basename::$(notdir $(BDIST_WHEEL))"

.PHONY: run
run: install
	mkdir -p $(NOTEBOOKS_DIR)
	pipenv run jupyter notebook \
		-y \
		--log-level=$(JUPYTER_LOG_LEVEL) \
		--notebook-dir=$(NOTEBOOKS_DIR) \
		--ip='0.0.0.0' \
		--port=$(JUPYTER_PORT) \
		--no-browser \
		--NotebookApp.token='' \
		--NotebookApp.disable_check_xsrf=True

.PHONY: run-local
run-local: NOTEBOOKS_DIR := $(CURDIR)/notebooks3.8
run-local: run

.PHONY: install
install:
	pipenv install --dev
	$(MAKE) install-latest-rsconnect-python
	$(MAKE) version-frontend
	pipenv run jupyter nbextension install --symlink --user --py rsconnect_jupyter
	pipenv run jupyter nbextension enable --py rsconnect_jupyter
	pipenv run jupyter serverextension enable --py rsconnect_jupyter

build-mock-connect:
	docker build -t $(CONNECT_IMAGE) $(CONNECT_DOCKERFILE_DIR)

build/mock-connect/bin/flask:
	bash -c '\
		mkdir -p build && \
		virtualenv build/mock-connect && \
		. build/mock-connect/bin/activate && \
		pip install flask'

.PHONY: mock-server
mock-server: build/mock-connect/bin/flask
	bash -c '\
		. build/mock-connect/bin/activate && \
		FLASK_APP=mock_connect.py flask run --host=0.0.0.0'

.PHONY: yarn
yarn:
	yarn install

.PHONY: cypress-specs
cypress-specs:
	docker run --rm \
		$(DOCKER_TTY_FLAGS) \
		--network=$(NETWORK) \
		-e CYPRESS_MOCK_CONNECT=http://$(CONNECT_HOST):$(CONNECT_PORT) \
		-e CYPRESS_JUPYTER=http://$(JUPYTER_HOST):$(JUPYTER_PORT) \
		-e CYPRESS_API_KEY=$(CONNECT_API_KEY) \
		-v $(CURDIR):/e2e \
		-w /e2e \
		cypress/included:4.9.0

.PHONY: cypress-open-local
cypress-open-local:
	CYPRESS_MOCK_CONNECT=http://$(CONNECT_HOST):$(CONNECT_PORT) \
	CYPRESS_JUPYTER=http://127.0.0.1:$(JUPYTER_PORT) \
	CYPRESS_API_KEY=$(CONNECT_API_KEY) \
		npx cypress open

.PHONY: jupyter-up
jupyter-up:
	docker run --rm -d --init \
		$(DOCKER_TTY_FLAGS) \
		--name=$(JUPYTER_HOST) \
		--network=$(NETWORK) \
		-v $(NOTEBOOKS_DIR):$(NOTEBOOKS_DIR_MOUNT) \
		-v $(CURDIR):$(RSCONNECT_DIR) \
		-e NB_UID=$(NB_UID) \
		-e NB_GID=$(NB_GID) \
		-e PY_VERSION=$(PY_VERSION) \
		-e TINI_SUBREAPER=1 \
		-e PYTHONPATH=$(RSCONNECT_DIR) \
		-p :$(JUPYTER_PORT):$(JUPYTER_PORT) \
		-w $(RSCONNECT_DIR) \
		-u $(NB_UID):$(NB_GID) \
		$(JUPYTER_IMAGE) \
		make -C $(RSCONNECT_DIR) run JUPYTER_LOG_LEVEL=$(JUPYTER_LOG_LEVEL)

.PHONY: jupyter-down
jupyter-down:
	docker rm -f $(JUPYTER_HOST) || true

.PHONY: test-env-up
test-env-up: network-up connect-up

.PHONY: test-env-down
test-env-down: connect-down network-down

.PHONY: network-up
network-up:
	if ! docker network inspect $(NETWORK) &>/dev/null; then \
		docker network create --driver bridge $(NETWORK); \
	fi

.PHONY: network-down
network-down:
	docker network rm $(NETWORK) || true

.PHONY: connect-up
connect-up:
	docker run --rm -d --init \
		$(DOCKER_TTY_FLAGS) \
		--name=$(CONNECT_HOST) \
		--network=$(NETWORK) \
		--volume=$(CURDIR):$(RSCONNECT_DIR) \
		-e FLASK_APP=mock_connect.py \
		-e CONNECT_API_KEY=$(CONNECT_API_KEY) \
		--publish=:$(CONNECT_PORT):$(CONNECT_PORT) \
		--workdir=$(RSCONNECT_DIR) \
		--user=$(NB_UID):$(NB_GID) \
		$(CONNECT_IMAGE) \
		flask run --host=0.0.0.0 --port=$(CONNECT_PORT)

.PHONY: connect-down
connect-down:
	docker rm -f $(CONNECT_HOST) || true

.PHONY: lint
lint: lint-js lint-py

.PHONY: lint-js
lint-js: yarn
	npm run lint

.PHONY: lint-py
lint-py:
	pipenv run black --check --diff .
	pipenv run flake8 .

.PHONY: fmt
fmt:
	pipenv run black .

## Specify that Docker runs with the calling user's uid/gid to avoid file
## permission issues on Linux dev hosts.
DOCKER_RUN_AS =
ifeq (Linux,$(shell uname))
	DOCKER_RUN_AS = -u $(shell id -u):$(shell id -g)
endif

BUILD_DOC := docker run --rm=true $(DOCKER_RUN_AS) \
	-e VERSION=$(VERSION) \
	$(DOCKER_ARGS) \
	-v $(CURDIR):$(RSCONNECT_DIR) \
	-w $(RSCONNECT_DIR) \
	pandoc/latex:2.9 docs/build-doc.sh

.PHONY: docs-build
docs-build: docs/out
	$(BUILD_DOC)

docs/out:
	mkdir -p $@

dist/rsconnect-jupyter-$(VERSION).pdf: docs/README.md docs/*.gif docs/out
	$(BUILD_DOC)

.PHONY: version
version:
	@echo $(VERSION)

.PHONY: version-frontend
version-frontend:
	printf '{"version":"%s"}\n' $(VERSION) >rsconnect_jupyter/static/version.json

.PHONY: sync-latest-to-s3
sync-latest-to-s3:
	aws s3 cp --acl bucket-owner-full-control \
		$(BDIST_WHEEL) \
		$(S3_PREFIX)/latest/rsconnect_jupyter-latest-py2.py3-none-any.whl

.PHONY: sync-latest-docs-to-s3
sync-latest-docs-to-s3:
	aws s3 cp --acl bucket-owner-full-control \
		docs/out/rsconnect_jupyter-$(VERSION).html \
		$(S3_PREFIX)/latest/rsconnect_jupyter-latest.html
	aws s3 cp --acl bucket-owner-full-control \
		docs/out/rsconnect_jupyter-$(VERSION).pdf \
		$(S3_PREFIX)/latest/rsconnect_jupyter-latest.pdf

.PHONY: promote-docs-in-s3
promote-docs-in-s3:
	aws s3 cp --acl bucket-owner-full-control \
		docs/out/rsconnect_jupyter-$(VERSION).html \
		s3://docs.rstudio.com/rsconnect-jupyter/rsconnect_jupyter-$(VERSION).html
	aws s3 cp --acl bucket-owner-full-control \
		docs/out/rsconnect_jupyter-$(VERSION).html \
		s3://docs.rstudio.com/rsconnect-jupyter/index.html
