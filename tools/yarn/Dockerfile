FROM node:6.11.0
LABEL maintainer="RStudio Connect <rsconnect@rstudio.com>"

RUN curl -o- -L https://yarnpkg.com/install.sh | \  bash -s -- --version 1.13.0

RUN getent group ${NB_GID} || groupadd -g ${NB_GID} builder
RUN useradd --password password \
    --create-home \
    --home-dir /home/builder \
    --uid ${NB_UID} \
    --gid ${NB_GID} \
    builder

USER ${NB_UID}:${NB_GID}
