BROWSER?=firefox
COMMAND=bash
CONNECT_DOCKERFILE_DIR=docker/mock-connect
CONNECT_HOST=mock-connect
CONNECT_LOG=mock-connect.log
CONNECT_PORT=5000
CONNECT_SCHEME=http
CONNECT_IMAGE=rstudio/rsconnect-mock-connect
DCYML_GRID=${CURDIR}/docker/grid/docker-compose.yml
GRID_HOST=selenium-hub
GRID_PORT=4444
GRID_SCHEME=http
GRID_TIMEOUT=30000
HOURMINSEC=`date +'%H%M%S'`
JUPYTER_HOST=jupyter-py${PY_VERSION}
JUPYTER_LOG=jupyter-py${PY_VERSION}.log
JUPYTER_PORT=9999
JUPYTER_SCHEME=http
JUPYTER_IMAGE=rstudio/rsconnect-jupyter-py${PY_VERSION}
LOGS_DIR=${RSCONNECT_DIR}/selenium
NB_UID=$(shell id -u)
NB_GID=$(shell id -g)
NETWORK=${PROJECT}_default
NOTEBOOKS_DIR=/notebooks
PROJECT=rscjnet
PY_VERSION=2
PYTESTLOG?=selenium_tests.log
PYTESTOPTS?=
RERUN_FAILURES?=0
RESULT_XML?=result.xml
RSCONNECT_DIR=/rsconnect
SCALE=1
SCALE_FIREFOX=${SCALE}
SCALE_CHROME=${SCALE}
SELENIUM_VERSION=3.8.1-dubnium
TMP_PIPE=tmp.pipe
TRE_IMAGE?=rstudio/checkrs-tew:0.1.0

# Allocate a tty and keep stdin open when running locally
# Jenkins nodes don't have input tty, so we set this to ""
DOCKER_TTY_FLAGS?=-it

DOCKER_RUN_COMMAND=docker run --rm --init \
	    ${DOCKER_TTY_FLAGS} \
	    --name=tre-${HOURMINSEC} \
	    --network=$(NETWORK) \
	    --volume=$(CURDIR)/..:${RSCONNECT_DIR} \
	    --volume=$(CURDIR)/../notebooks$(PY_VERSION):${NOTEBOOKS_DIR} \
	    --user=`id -u`:`id -g` \
	    --workdir=${RSCONNECT_DIR}/selenium \
	    ${TRE_IMAGE}

TEST_RUNNER_COMMAND=pytest \
	    --junitxml=${RESULT_XML} \
	    --driver=Remote \
	    --host=${GRID_HOST} \
	    --port=${GRID_PORT} \
	    --capability browserName ${BROWSER} \
	    --jupyter-url='${JUPYTER_SCHEME}://${JUPYTER_HOST}:${JUPYTER_PORT}' \
	    --connect-url='${CONNECT_SCHEME}://${CONNECT_HOST}:${CONNECT_PORT}' \
	    --data-dir=${RSCONNECT_DIR}/selenium/data \
	    --notebooks-dir=${NOTEBOOKS_DIR} \
	    --verbose \
	    --tb=short \
	    --reruns=${RERUN_FAILURES} \
	    -m "not (fail or systemstat)" \
	    ${PYTESTOPTS}

ifdef DEBUG
	GRID_TIMEOUT=0
endif

# NOTE: This Makefile does not support running with concurrency (-j XX).
.NOTPARALLEL:

all: build

build: build-mock-connect

build-mock-connect:
	docker build -t ${CONNECT_IMAGE} ${CONNECT_DOCKERFILE_DIR}

clean:
	rm -f *.png *.log *.xml ${TMP_PIPE};
	rm -rf .pytest_cache;

distclean: clean

# The test target launches a Docker container to run the test cases.
# Prior to launching the Docker container, we check that the prerequisite
# systems (selenium grid, system under test) are up and accepting requests.
# We also launch a named pipe to capture output from the pytest process.
# The output is sent to stdout and a log file. After the test cases run,
# we remove the named pipe, which also ends the pytest output from being
# printed to stdout through the tee command.

test: wait-for-systems-up prepare-logging
	${DOCKER_RUN_COMMAND} ${TEST_RUNNER_COMMAND} > ${TMP_PIPE} || EXITCODE=$$?; \
	rm -f ${TMP_PIPE}; \
	exit $$EXITCODE

# Create a named pipe (mkfifo) where we can forward stdout from a process.
# Then use the tee command to read from the pipe, printing the output
# to stdout and saving it to a log file. tee will terminate when it gets
# to the end of stdin, or in this case, when our named pipe is closed
# and removed.

prepare-logging:
	rm -f ${TMP_PIPE}
	mkfifo ${TMP_PIPE}
	tee ${PYTESTLOG} < ${TMP_PIPE} &

run:
	@${DOCKER_RUN_COMMAND} ${COMMAND}

test-env-up: grid-up connect-up

test-env-down: network-down

wait-for-systems-up:
	@docker run --rm \
	    --name=systemstat \
	    --network=$(NETWORK) \
	    --volume=${CURDIR}/..:${RSCONNECT_DIR} \
	    --user=`id -u`:`id -g` \
	    --workdir=${RSCONNECT_DIR}/selenium \
	    ${TRE_IMAGE} \
	    ./wait_for_systems_up.sh \
	        -g '${GRID_SCHEME}://${GRID_HOST}:${GRID_PORT}' \
	        -n $$(( ${SCALE_FIREFOX} + ${SCALE_CHROME} )) \
	        -l ${LOGS_DIR} \
	        -j '${JUPYTER_SCHEME}://${JUPYTER_HOST}:${JUPYTER_PORT}' \
	        -c '${CONNECT_SCHEME}://${CONNECT_HOST}:${CONNECT_PORT}'

grid-up: network-up
	NETWORK=${NETWORK} \
	GRID_TIMEOUT=${GRID_TIMEOUT} \
	SELENIUM_VERSION=${SELENIUM_VERSION} \
	docker-compose -f ${DCYML_GRID} -p ${PROJECT} up -d --scale firefox=${SCALE_FIREFOX} --scale chrome=${SCALE_CHROME}

grid-down:
	NETWORK=${NETWORK} \
	GRID_TIMEOUT=${GRID_TIMEOUT} \
	SELENIUM_VERSION=${SELENIUM_VERSION} \
	docker-compose -f ${DCYML_GRID} -p ${PROJECT} down

grid-restart:
	NETWORK=${NETWORK} \
	GRID_TIMEOUT=${GRID_TIMEOUT} \
	SELENIUM_VERSION=${SELENIUM_VERSION} \
	docker-compose -f ${DCYML_GRID} -p ${PROJECT} restart

network-up:
	$(eval NETWORK_EXISTS=$(shell docker network inspect ${NETWORK} > /dev/null 2>&1 && echo 0 || echo 1))
	@if [ "${NETWORK_EXISTS}" = "1" ] ; then \
	    echo "Creating network: ${NETWORK}"; \
	    docker network create --driver bridge ${NETWORK} ; \
	fi;

network-down: connect-down grid-down
	$(eval NETWORK_EXISTS=$(shell docker network inspect ${NETWORK} > /dev/null 2>&1 && echo 0 || echo 1))
	@if [ "${NETWORK_EXISTS}" = "0" ] ; then \
	    for i in `docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' ${NETWORK}`; do \
	        echo "Removing container \"$${i}\" from network \"${NETWORK}\""; \
	        docker network disconnect -f ${NETWORK} $${i}; \
	    done; \
	    echo "Removing network: ${NETWORK}"; \
	    docker network rm ${NETWORK}; \
	fi;

# I think we need TINI_SUBREAPER set because we are using --init, but run.sh
# calls a make command which launches another command.

jupyter-up:
	@echo -n "Creating ${JUPYTER_HOST} ..."
	@docker run --rm -d --init \
	    ${DOCKER_TTY_FLAGS} \
	    --name=${JUPYTER_HOST} \
	    --network=${NETWORK} \
	    --volume=$(CURDIR)/../notebooks$(PY_VERSION):${NOTEBOOKS_DIR} \
	    --volume=$(CURDIR)/..:${RSCONNECT_DIR} \
	    --env=NB_UID=$(NB_UID) \
	    --env=NB_GID=$(NB_GID) \
	    --env=PY_VERSION=$(PY_VERSION) \
	    --env=TINI_SUBREAPER=1 \
	    --publish=:${JUPYTER_PORT}:${JUPYTER_PORT} \
	    --workdir=${RSCONNECT_DIR} \
	    $(JUPYTER_IMAGE) \
	    ${RSCONNECT_DIR}/run.sh run \
	    1>/dev/null
	@docker logs -f ${JUPYTER_HOST} > ${JUPYTER_LOG} &
	@echo " done"

jupyter-down:
	$(eval JUPYTER_EXISTS=$(shell docker container inspect ${JUPYTER_HOST} > /dev/null 2>&1 && echo 0 || echo 1))
	@if [ "${JUPYTER_EXISTS}" = "0" ] ; then \
	    echo -n "Stopping ${JUPYTER_HOST} ..."; \
	    docker stop ${JUPYTER_HOST} 1>/dev/null; \
	    echo " done"; \
	fi;

connect-up:
	@echo -n "Creating ${CONNECT_HOST} ..."
	@docker run --rm -d --init \
	    ${DOCKER_TTY_FLAGS} \
	    --name=${CONNECT_HOST} \
	    --network=${NETWORK} \
	    --volume=$(CURDIR)/..:${RSCONNECT_DIR} \
	    --env=FLASK_APP=mock_connect.py \
	    --publish=:${CONNECT_PORT}:${CONNECT_PORT} \
	    --workdir=${RSCONNECT_DIR} \
	    $(CONNECT_IMAGE) \
	    flask run --host=0.0.0.0 --port=${CONNECT_PORT} \
	    1>/dev/null
	@docker logs -f ${CONNECT_HOST} > ${CONNECT_LOG} &
	@echo " done"

connect-down:
	$(eval CONNECT_EXISTS=$(shell docker container inspect ${CONNECT_HOST} > /dev/null 2>&1 && echo 0 || echo 1))
	@if [ "${CONNECT_EXISTS}" = "0" ] ; then \
	    echo -n "Stopping ${CONNECT_HOST} ..."; \
	    docker stop ${CONNECT_HOST} 1>/dev/null; \
	    echo " done"; \
	fi;


.PHONY: all
.PHONY: build
.PHONY: build-mock-connect
.PHONY: clean
.PHONY: connect-down
.PHONY: connect-up
.PHONY: distclean
.PHONY: grid-down
.PHONY: grid-restart
.PHONY: grid-up
.PHONY: jupyter-down
.PHONY: jupyter-up
.PHONY: network-down
.PHONY: network-up
.PHONY: prepare-logging
.PHONY: test
.PHONY: test-env-down
.PHONY: test-env-up
.PHONY: wait-for-systems-up