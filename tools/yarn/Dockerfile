FROM node:6.11.0
LABEL maintainer="RStudio Connect <rsconnect@rstudio.com>"
ARG NB_UID
ARG NB_GID

RUN npm install -g yarn@1.13.0

RUN getent group ${NB_GID} || groupadd -g ${NB_GID} builder
RUN useradd --password password \
    --create-home \
    --home-dir /home/builder \
    --uid ${NB_UID} \
    --gid ${NB_GID} \
    builder

USER ${NB_UID}:${NB_GID}
