FROM ubuntu:bionic-20180526
MAINTAINER RStudio Quality <qa@rstudio.com>

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8

ARG AWS_REGION=us-east-1

# Use EC2 (Cloudfront) apt source instead of default redirecting mirror.
RUN set -ex; \
        \
        sed -i "s/archive.ubuntu.com/$AWS_REGION.ec2.archive.ubuntu.com/" /etc/apt/sources.list;

# Install basic development & debugging tools
RUN set -ex; \
        \
        apt-get update; \
        apt-get install -y --no-install-recommends \
            bash \
            curl \
            jq \
            make \
            wget; \
        \
        rm -rf /var/lib/apt/lists/*;


# Copy in Python package requirements files
WORKDIR /opt/work
COPY requirements.txt requirements.txt

# Install build dependencies and Python packages
# these build dependencies are only needed to compile
# Python packages. After installing the packages,
# purge them to keep the final layer small.
RUN set -ex; \
        \
        buildDeps=" \
            gcc \
            git \
            libc6-dev \
            libffi-dev \
            libssl-dev \
        "; \
        \
        pythonPkgs=" \
            python3 \
            python3-dev \
            python3-pip \
        "; \
        \
        apt-get update; \
        apt-get install -y $buildDeps $pythonPkgs --no-install-recommends; \
        rm -rf /var/lib/apt/lists/*; \
        \
        ln -s /usr/bin/python3 /usr/bin/python; \
        ln -s /usr/bin/pydoc3 /usr/bin/pydoc; \
        \
        python3 -m pip install --no-cache-dir setuptools; \
        python3 -m pip install --no-cache-dir -r requirements.txt; \
        rm -f requirements; \
        \
        apt-get purge -y --auto-remove $buildDeps;


# Prevent python from creating .pyc files and __pycache__ dirs
ENV PYTHONDONTWRITEBYTECODE=1


# Show stdout when running in docker compose (dont buffer)
ENV PYTHONUNBUFFERED=1


# Add a python startup file
COPY pystartup /usr/local/share/python/pystartup
ENV PYTHONSTARTUP=/usr/local/share/python/pystartup


# command line setup
# do minimal setup so we can be semi-efficient when using
# the command line of the container. Without PS1, we will
# get a prompt like "I have no name!@<container_id_hash>:/$"
# since we don't create a user or group.
RUN set -ex; \
        echo "PS1='\h:\w\$ '" >> /etc/bash.bashrc; \
        echo "alias ls='ls --color=auto'" >> /etc/bash.bashrc; \
        echo "alias grep='grep --color=auto'" >> /etc/bash.bashrc;
