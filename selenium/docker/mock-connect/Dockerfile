FROM python:3.6.6-alpine
MAINTAINER RStudio Quality <qa@rstudio.com>

WORKDIR /opt/work
COPY requirements.txt requirements.txt

# Install build dependencies and Python packages
# these build dependencies are only needed to compile
# Python packages. After installing the packages,
# purge them to keep the final layer small.
RUN set -ex; \
        \
        python3 -m pip install --no-cache-dir -r requirements.txt; \
        rm -f requirements;


# Prevent python from creating .pyc files and __pycache__ dirs
ENV PYTHONDONTWRITEBYTECODE=1
