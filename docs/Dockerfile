# Using dated tags from https://hub.docker.com/_/ubuntu/
FROM ubuntu:bionic-20201119
MAINTAINER Posit Connect <rsconnect@rstudio.com>

# Configure apt-get to use the mirror in us-east-1 instead of the Docker default of archive.ubuntu.com
RUN sed -i "s/archive.ubuntu.com/us-east-1.ec2.archive.ubuntu.com/g" /etc/apt/sources.list

# git is used to examine the repository and compute product version.
RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get update && \
    apt-get install -y \
        git \
        python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Needed with Python3 mkdocs.
# https://click.palletsprojects.com/en/7.x/python3/
ENV LC_ALL C.UTF-8
ENV LANG C.UTF-8

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt && \
        rm -f requirements.txt
