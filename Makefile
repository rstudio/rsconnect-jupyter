NB_UID := $(shell id -u)
NB_GID := $(shell id -g)

IMAGE := rstudio/rsconnect-jupyter-py
NOTEBOOKS_DIR := /notebooks
PORT := $(shell printenv PORT || echo 9999)
S3_PREFIX := s3://rstudio-connect-downloads/connect/rsconnect-jupyter
VERSION := $(shell python setup.py --version 2>/dev/null || echo 'NOTSET')

BDIST_WHEEL := dist/rsconnect_jupyter-$(VERSION)-py2.py3-none-any.whl
JUPYTER_LOG_LEVEL ?= INFO

# NOTE: See the `dist` target for why this exists.
SOURCE_DATE_EPOCH := $(shell date +%s)
export SOURCE_DATE_EPOCH

PYTHONPATH ?= $(CURDIR)
export PYTHONPATH

.PHONY: prereqs
prereqs:
	pip install -U pip
	pip install -r requirements-dev.txt

.PHONY: install-latest-rsconnect-python
install-latest-rsconnect-python:
	pip install -U https://cdn.rstudio.com/connect/rsconnect-python/latest/rsconnect_python-latest-py2.py3-none-any.whl

.PHONY: clean
clean:
	rm -rf build/ dist/ docs/out/ rsconnect_jupyter.egg-info/

.PHONY: all-images
all-images: image3.7 image3.8 image3.9 image3.10 image3.11

image%:
	docker build \
		--tag $(IMAGE)$* \
		--file Dockerfile \
		--build-arg BASE_IMAGE=python:$*-slim \
		--build-arg NB_UID=$(NB_UID) \
		--build-arg NB_GID=$(NB_GID) \
		--build-arg PY_VERSION=$* \
		.

test: version-frontend
	pytest -vv --cov=rsconnect_jupyter tests/

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
	rm -vf dist/*.whl
	python setup.py bdist_wheel
	twine check $(BDIST_WHEEL)
	rm -vf dist/*.egg
	@echo "::set-output name=whl::$(BDIST_WHEEL)"
	@echo "::set-output name=whl_basename::$(notdir $(BDIST_WHEEL))"

run: install
	jupyter notebook \
		-y \
		--log-level=$(JUPYTER_LOG_LEVEL) \
		--notebook-dir=$(NOTEBOOKS_DIR) \
		--ip='0.0.0.0' \
		--port=9999 \
		--no-browser \
		--NotebookApp.token=''

.PHONY: install
install: version-frontend
	jupyter nbextension install --symlink --user --py rsconnect_jupyter
	jupyter nbextension enable --py rsconnect_jupyter
	jupyter serverextension enable --py rsconnect_jupyter

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

.PHONY: lint
lint: lint-js lint-py

.PHONY: lint-js
lint-js:
	npm run lint

.PHONY: lint-py
lint-py:
	black --check --diff ./rsconnect_jupyter
	flake8 ./rsconnect_jupyter

.PHONY: fmt
fmt:
	black ./rsconnect_jupyter

## Specify that Docker runs with the calling user's uid/gid to avoid file
## permission issues on Linux dev hosts.
DOCKER_RUN_AS =
ifeq (Linux,$(shell uname))
	DOCKER_RUN_AS = -u $(shell id -u):$(shell id -g)
endif

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
		--recursive \
		--cache-control max-age=0 \
		docs/site/ \
		$(S3_PREFIX)/latest/

.PHONY: promote-docs-in-s3
promote-docs-in-s3:
	aws s3 cp --acl bucket-owner-full-control \
		--recursive \
		docs/site/ \
		s3://docs.rstudio.com/rsconnect-jupyter/rsconnect_jupyter-$(VERSION)/
	aws s3 cp --acl bucket-owner-full-control \
		--recursive \
		--cache-control max-age=300 \
		docs/site/ \
		s3://docs.rstudio.com/rsconnect-jupyter/
