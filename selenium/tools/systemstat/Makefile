NETWORK=${PROJECT}_default
PROJECT=rscjnet_systemstat
PYTEST_DOCKER_CMD_FLAGS=
PYTESTOPTS=
RESULT_XML?=result.xml
TRE_IMAGE?=rstudio/checkrs-tew:0.1.0
WORKDIR=/opt/work

PYTEST_DOCKER_CMD=docker run --rm -it \
	--name=test-systemstat \
	--volume=${CURDIR}/../../:${WORKDIR} \
	--workdir=${WORKDIR}/tools/systemstat \
	--user=`id -u`:`id -g` \
	${PYTEST_DOCKER_CMD_FLAGS} \
	${TRE_IMAGE}

# NOTE: This Makefile does not support running with concurrency (-j XX).
.NOTPARALLEL:

all:

clean:
	rm -f *.log *.xml *.pyc;
	rm -rf .pytest_cache;

distclean: clean

test: test-systemstat

test-systemstat:
	@${PYTEST_DOCKER_CMD} \
	    pytest \
	        --junitxml=${RESULT_XML} \
	        --tb=short \
	        --verbose \
	        -m systemstat \
	        ${PYTESTOPTS}

run:
	${PYTEST_DOCKER_CMD} bash

network-up:
	$(eval NETWORK_EXISTS=$(shell docker network inspect ${NETWORK} > /dev/null 2>&1 && echo 0 || echo 1))
	@if [ "${NETWORK_EXISTS}" = "1" ] ; then \
	    echo "Creating network: ${NETWORK}"; \
	    docker network create --driver bridge ${NETWORK} ; \
	fi;

network-down:
	$(eval NETWORK_EXISTS=$(shell docker network inspect ${NETWORK} > /dev/null 2>&1 && echo 0 || echo 1))
	@if [ "${NETWORK_EXISTS}" = "0" ] ; then \
	    for i in `docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' ${NETWORK}`; do \
	        echo "Removing container \"$${i}\" from network \"${NETWORK}\""; \
	        docker network disconnect -f ${NETWORK} $${i}; \
	    done; \
	    echo "Removing network: ${NETWORK}"; \
	    docker network rm ${NETWORK}; \
	fi;

.PHONY: all clean network-down network-up test test-systemstat
