ARG BASE_IMAGE
FROM ${BASE_IMAGE}
LABEL maintainer="RStudio Connect <rsconnect@rstudio.com>"

ARG NB_USER
ARG NB_UID
ARG NB_GID
ARG PY_VERSION
RUN apt-get update -qq
RUN apt-get install -y make
RUN useradd --password password \
    --create-home \
    --home-dir /home/${NB_USER} \
    --uid ${NB_UID} \
    --gid ${NB_GID} \
    ${NB_USER}

USER ${NB_UID}:${NB_GID}
WORKDIR /home/${NB_USER}
RUN conda create --yes --name py${PY_VERSION} jupyter
