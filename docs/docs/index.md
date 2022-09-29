# `rsconnect-jupyter` User Guide

`rsconnect-jupyter` is a plugin for Jupyter Notebooks that enables publishing notebooks to Posit Connect.

## Requirements

- Python 3.5.0 and higher
- Jupyter Notebook 5.x
- [pip](https://pypi.org/project/pip/)
- [wheel](https://pypi.org/project/wheel/)
- [Posit Connect](https://www.rstudio.com/products/connect/download-commercial/) v1.7.0 or higher, configured with Python support

!!! note
    If using `conda`, `pip` and `wheel` should already be installed.

## Installation

The installation method depends on the Python environment that you are installing the `rsconnect-jupyter` package into.

!!! note
    The `rsconnect-jupyter` package is developed for Jupyter Notebook, specifically. Therefore, the package does not work with the JupyterLab development environment.

This documentation covers three methods:

- [Installing Jupyter within a virtual environment](#installing-jupyter-within-a-virtual-environment)
- [Installing `rsconnect-jupyter` to Jupyter running on Posit Workbench](#installing-to-jupyter-running-on-posit-workbench)
- [Installation in JupyterHub](#installing-in-jupyterhub)

Please navigate to the installation section below that is best for your environment.

### Installing Jupyter within a virtual environment

To install and use Jupyter within a virtual environment using
`virtualenv`, follow the procedures shown below or learn more using the
[Virtualenv](https://virtualenv.pypa.io/en/latest/) documentation.

- These commands create and activate a `virtualenv` at `/my/path`:
  <div class="code-title">Terminal</div>
  ```bash
  $ pip install virtualenv
  virtualenv /my/path
  source /my/path/bin/activate
  ```

!!! tip
    Running `source /my/path/bin/activate` activates the virtual environment. While the `virtualenv` is active, Python-related commands like `python`, `pip`, and `jupyter` will use to copies located inside the virtual environment. You can check which copy of `python` you're using by running `which python`.

- Install Jupyter inside the `virtualenv`:
  <div class="code-title">Terminal</div>
  ```bash
  $ pip install jupyter
  ```

- Install rsconnect-jupyter with your virtual environment active to install and activate the plugin for that copy of Jupyter:

    --8<-- "snippets/python_pkg.md"

!!! important
    Be sure to run Jupyter from this virtual environment, not from
    another installation, or the `rsconnect-jupyter` extension will
    not be available. To do so, you will need to activate the virtual
    environment in each new terminal session before you run `jupyter`.

---

### Installing to Jupyter running on Posit Workbench

- If you are installing `rsconnect-jupyter` to Jupyter running on RStudio Server Pro, see
the [RStudio Server Pro documentation on Jupyter Notebooks](https://docs.rstudio.com/rsp/integration/jupyter-standalone/#4-install-jupyter-notebooks-jupyterlab-and-python-packages)
for instructions on installing the plugin to the right location.

- Once you complete the installation instructions, please return to this document for additional information such as [Upgrading](upgrading) or [Usage](usage) instructions.

---

### Installation in JupyterHub

In JupyterHub, follow these directions to install the
`rsconnect-jupyter` package into the Python environment where the Jupyter
notebook server and kernel are installed:

--8<-- "snippets/python_pkg.md"

Typically those will be the same
environment. If you've configured separate kernel environments, install the
`rsconnect-jupyter` package in the notebook server environment as well as each
kernel environment.

The exact install location depends on your JupyterHub configuration.

#### JupyterHub Example Configuration

This section presents a simple working example of a JupyterHub configuration
with `rsconnect-jupyter` installed.

??? example "Docker Example"
    This example uses Docker, but you can install the `rsconnect-jupyter` package in
    any Jupyterhub installation. Docker is not required.

    Example Dockerfile:

    <p class="code-title">Dockerfile</p>
    ```dockerfile
    FROM jupyterhub/jupyterhub:0.9.4

    # Install Jupyter notebook into the existing base conda environment
    RUN conda install notebook

    # Download and install rsconnect-jupyter in the same environment
    # Update this to specify the desired version of the rsconnect-jupyter package,
    # or pass `--build-arg VERSION=...` to docker build.
    ARG VERSION=RSCONNECT_VERSION
    ARG REPOSITORY=https://s3.amazonaws.com/rstudio-rsconnect-jupyter

    RUN wget ${REPOSITORY}/rsconnect_jupyter-${VERSION}-py2.py3-none-any.whl
    RUN pip install rsconnect_jupyter-${VERSION}-py2.py3-none-any.whl && \
      jupyter-nbextension install --sys-prefix --py rsconnect_jupyter && \
      jupyter-nbextension enable --sys-prefix --py rsconnect_jupyter && \
      jupyter-serverextension enable --sys-prefix --py rsconnect_jupyter

    # create test users
    RUN useradd -m -s /bin/bash user1 && \
      useradd -m -s /bin/bash user2 && \
      useradd -m -s /bin/bash user3 && \
      bash -c 'echo -en "password\npassword" | passwd user1' && \
      bash -c 'echo -en "password\npassword" | passwd user2' && \
      bash -c 'echo -en "password\npassword" | passwd user3'

    CMD ["jupyterhub"]
    ```

    Run these commands to build and start the container:

    <p class="code-title">Terminal</p>
    ```bash
    docker build -t jupyterhub:rsconnect-jupyter .
    docker run --rm -p 8000:8000 --name jupyterhub jupyterhub:rsconnect-jupyter
    ```

    Connect to Jupyterhub on http://localhost:8000 and log in as one of the test
    users. From there, you can create a notebook and publish it to Posit Connect.
    Note that the current Jupyterhub docker image uses Python 3.6.5, so you will
    need a compatible Python version installed on your Posit Connect server.
