# RStudio Connect Jupyter User Guide

This directory contains the RStudio Connect: Jupyter User Guide. We use
[mkdocs-1.0.4](https://www.mkdocs.org) to build this guide.

The Jupyter User Guide is geared towards the people who will publish Jupyter Notebooks to RStudio Connect.

## Docker

The `rsconnect-jupyter-docs` Docker image is used to produce our
documentation. We use a number of plugins and extensions; use the Docker image
rather than a local `mkdocs` installation.

Create the image:
```bash
just image
```

Build documentation:

```bash
just build
```

Launch an auto-reloading documentation server at http://localhost:8001 with
the command:

```bash
just watch
```
