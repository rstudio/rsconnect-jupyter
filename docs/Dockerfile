# Using dated tags from https://hub.docker.com/_/ubuntu/
FROM ubuntu:trusty-20180420
MAINTAINER RStudio Connect <rsconnect@rstudio.com>

ARG AWS_REGION=us-east-1

# Use EC2 (Cloudfront) apt source instead of default redirecting mirror.
RUN set -x \
    && sed -i "s/archive.ubuntu.com/$AWS_REGION.ec2.archive.ubuntu.com/" /etc/apt/sources.list \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get update

# Install packages aside from R and TeX (because they are large)
RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get update && \
    apt-get install -y \
    git \
    libcurl4-gnutls-dev \
    libssl-dev \
    libxml2-dev \
    make \
    curl && \
    rm -rf /var/lib/apt/lists/*

# First install some non-texlive packages which are recommended but will be skipped when we install texlive
# in order to not install the documentation.
#
# biber depends on libwww-perl which has a tree of recommended packages, and recommends libreadonly-xs-perl
# texlive-base depends on xdg-utils which has a tree of recommended packages
# texinfo depends upon libxml-libxml-perl which has a tree of recommended packages
RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get update && \
    apt-get install -y \
    libreadonly-xs-perl \
    libwww-perl \
    libxml-libxml-perl \
    ruby \
    tcl \
    tk \
    xdg-utils && \
    rm -rf /var/lib/apt/lists/*

# First part of texlive itself. Use --no-install-recommends to avoid installing ~750MB of documentation
RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    texlive \
    texlive-fonts-extra \
    texlive-generic-recommended && \
    rm -rf /var/lib/apt/lists/*

# Second part of texlive itself. Use --no-install-recommends to avoid installing ~750MB of documentation
RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    biber \
    latex-beamer \
    lmodern \
    prosper \
    ps2eps \
    tex-gyre \
    texinfo \
    texlive-bibtex-extra \
    texlive-extra-utils \
    texlive-font-utils \
    texlive-latex-extra \
    texlive-luatex \
    texlive-pstricks \
    texlive-xetex && \
    rm -rf /var/lib/apt/lists/*

# Install pre-compiled pandoc
# Inspired by /connect/dependencies/install-pandoc
RUN export PANDOC_VERSION=2.1.3 && \
    cd /usr/local/bin && \
    curl -L -O https://s3.amazonaws.com/rstudio-buildtools/pandoc/${PANDOC_VERSION}/linux-64/pandoc.gz && \
    curl -L -O https://s3.amazonaws.com/rstudio-buildtools/pandoc/${PANDOC_VERSION}/linux-64/pandoc-citeproc.gz && \
    gzip -d pandoc.gz pandoc-citeproc.gz && \
    chmod 0755 pandoc pandoc-citeproc

WORKDIR /rsconnect_jupyter
