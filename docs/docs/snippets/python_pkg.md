- The following commands should be run after activating the Python environment where you plan to use `jupyter`.

    - Install the `rsconnect-jupyter` package with the following command:
    <div class="code-title">Terminal</div>
    ```bash
    pip install rsconnect_jupyter
    ```

    - Enable the `rsconnect-jupyter` extension with the following commands:
    <div class="code-title">Terminal</div>
    ```bash
    # Install `rsconnect-jupyter` as a jupyter extension
    jupyter-nbextension install --sys-prefix --py rsconnect_jupyter

    # Enable JavaScript extension
    jupyter-nbextension enable --sys-prefix --py rsconnect_jupyter

    # Enable Python extension
    jupyter-serverextension enable --sys-prefix --py rsconnect_jupyter
    ```

    !!! note
        - The above commands only need to be run once when installing `rsconnect_jupyter`.
        - In order to deploy content, you will need at least the [rsconnect-python](https://github.com/rstudio/rsconnect-python) package in every kernel you plan to deploy from.
        - If you run into an issue during installation, please let us know by filing a bug [here](https://github.com/rstudio/rsconnect-jupyter/issues).