1. Install `jupyter` and `rsconnect-jupyter`.

    <div class="code-title">Terminal</div>
    ``` shell
    python -m pip install jupyter rsconnect-jupyter
    ```

1. Install the `rsconnect-jupyter` _Jupyter Notebook_ extension.

    <div class="code-title">Terminal</div>
    ```shell
    python -m jupyter nbextension install --sys-prefix --py rsconnect_jupyter
    ```

1. Enable the `rsconnect-jupyter` _Jupyter Notebook_ extension

    <div class="code-title">Terminal</div>
    ```shell
    python -m jupyter nbextension enable --sys-prefix --py rsconnect_jupyter
    ```

1. Enable the `rsconnect-jupyter` _Jupyter Server_ extension.

    <div class="code-title">Terminal</div>
    ```shell
    python -m jupyter serverextension enable --sys-prefix --py rsconnect_jupyter
    ```

