# `rsconnect-jupyter` User Guide

The `rsconnect-jupyter` package is a _Jupyter Notebook_ extension (i.e., `nbextension`) that provides publishing compatiblity with [Posit Connect](https://docs.posit.co/rsc/#rstudio-connect).

## Requirements

- [Python >=3.7](https://www.python.org/downloads/)
- [Jupyter](https://pypi.org/project/jupyter)
- [Posit Connect](https://www.posit.co/download/posit-connect/**) v1.7.0 or higher, configured with Python support

!!! Warning
    This extension is **NOT** compatible with _JupyterLab_. Only _Jupyter Notebooks_, and associated runtime enviornments, such as _JupyterHub_, are supported.

!!! Warning
    In order to publish to _Posit Connect_, a compatible Python environment must in exist on the _Post Connect_ instance. See the _Posit Connect_ documentation on [Python integrations](https://docs.posit.co/rsc/integration/python/) for additional information.

## Installation

--8<-- "snippets/install.md"

## Runtime Environment Configuration

### Localhost (Your Computer)

For localhost installation, a Python virtual environment is recommend to isolate runtime dependencies. There are various Python virtual environments avaiable. The following tutorial covers a few of them.

#### Conda

Install `rsconnect-jupyter` from [Conda Forge](https://conda-forge.org).

<div class="code-title">Terminal</div>
```shell
conda create --name rsconnect-jupyter
conda activate rsconnect-jupyter
conda install -c conda-forge jupyter rsconnect-jupyter
```

Next, following the [installation guide](#installation).

!!! Tip
    When creating a _Conda_ virtual environment, a specific Python version may be specified. Create your virtual environment with a Python environment that is avaiable on your Posit Connect server.

    <div class="code-title">Terminal</div>
    ```shell
    conda create --name rsconnect-jupyter python=3.8
    ```

#### Python Virtual Environment (virtualenv)

<div class="code-title">Terminal</div>
```shell
python -m pip install virtualenv
python -m virtualenv .venv
source .venv/bin/activate
```

Next, following the [installation guide](#installation).

!!! Tip
    Running `source .venv/bin/activate` activates the virtual environment. While the `virtualenv` is active, Python-related commands like `python`, `pip`, and `jupyter` will use to copies located inside the virtual environment.

### Posit Workbench

See [Installing Python on Posit Workbench](https://docs.posit.co/rsw/integration/jupyter-standalone/#4-install-jupyter-notebooks-jupyterlab-and-python-packages).

Once you complete the installation instructions, please return to this document for additional information such as [Upgrading](upgrading) or [Usage](usage) instructions.

## JupyterHub

Follow the [installation guide](#installation) to install `rsconnect-jupyter` onto the _JupyterHub_ server.

If you've configured separate kernel environments, repeat the installation guide for each kernel environment.

!!! Note
    The exact install location depends on your JupyterHub configuration.

#### Quick Start Example

The following example shows how to launch a Docker container running _JupyterHub_ with the `rsconnect-jupyter` extension installed.

!!! example "Docker Example"

    Create the following Dockerfile.

    <p class="code-title">Dockerfile</p>
    ```dockerfile
    FROM jupyterhub/jupyterhub:3

    # Install Jupyter and the rsconnect-jupyter extension
    RUN python3 -m pip install jupyter rsconnect-jupyter

    # Enables the rsconnect-jupyter extension
    RUN python3 -m jupyter nbextension install --sys-prefix --py rsconnect_jupyter
    RUN python3 -m jupyter nbextension enable --sys-prefix --py rsconnect_jupyter
    RUN python3 -m jupyter serverextension enable --sys-prefix --py rsconnect_jupyter

    # Create a new user called "username" with the password "password"
    #
    # Use these credentials when logging into JupyterHub.
    #
    # Example:
    #     username: "username"
    #     password: "password"
    RUN useradd -m -p $(openssl passwd -1 password) -s /bin/sh username

    ENTRYPOINT ["jupyterhub"]
    ```

    Next, build the `Dockerfile` to create a new Docker image named jupyterhub:rsconnect-jupyter.

    <p class="code-title">Terminal</p>
    ```shell
    docker build -t jupyterhub:rsconnect-jupyter .
    ```

    Finally, launch the Docker image.

    <p class="code-title">Terminal</p>
    ```shell
    docker run --rm -p 8000:8000 --name jupyterhub jupyterhub:rsconnect-jupyter
    ```

    Once executed, a series of startup logs will be shown. Wait for the log message "JupyterHub is now running at http://:8000".

    Once shown, the _JupyterHub_ server is running on your local machine. To access _JupyterHub_ procceed with the following steps:

    1. Open [http://localhost:8000](http://localhost:8000) in your browser.
    1. Login to using the credentials "username" and "password". These credentials match the credentials set in the Dockerfile and may be changed.
    1. Select the "New" dropdown menu and select "Python 3 (pykernal)".
    1. Next, follow the [usage guide](./usage).

    !!! Warning

        At the time of writing, the `jupyterhub:jupyterhub:3` Docker image is built using Python version 3.10.6. Therefore, in order to publish to Posit Connect, a compatible Python version 3.10 environment must exist in Posit Connect.
