ARG BASE_IMAGE
FROM ${BASE_IMAGE}
LABEL maintainer="Posit Connect <rsconnect@posit.co>"

ARG NB_UID
ARG NB_GID
ARG PY_VERSION
RUN apt-get update -qq && \
    apt-get install -y make curl xz-utils git && \
    curl -fsSL "https://nodejs.org/dist/v12.18.1/node-v12.18.1-linux-x64.tar.xz" | \
      tar --strip-components=1 -C /usr/local -xJf - && \
    npm install -g yarn

RUN getent group ${NB_GID} || groupadd -g ${NB_GID} builder
RUN useradd --password password \
    --create-home \
    --home-dir /home/builder \
    --uid ${NB_UID} \
    --gid ${NB_GID} \
    builder && \
    mkdir -p /rsconnect_jupyter && \
    chown ${NB_UID}:${NB_GID} /rsconnect_jupyter

USER ${NB_UID}:${NB_GID}
WORKDIR /rsconnect_jupyter
ENV WORKON_HOME=/home/builder \
    PIPENV_DONT_LOAD_ENV=1 \
    PIPENV_SHELL=/bin/bash \
    PATH=/home/builder/.local/bin:/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    PYTHONPATH=/rsconnect_jupyter
COPY Pipfile Pipfile
COPY Pipfile.lock Pipfile.lock
RUN python -m pip install -I -U pip pipenv && \
    pipenv install --dev --python=/usr/local/bin/python && \
    rm -vf Pipfile*
