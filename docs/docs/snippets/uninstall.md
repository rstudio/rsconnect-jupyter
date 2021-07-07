- Disable and remove the `rsconnect-jupyter` notebook extension:
  <div class="code-title">Terminal</div>
  ```bash
  # Disable Python extensions found in `rsconnect-jupyter`
  jupyter-serverextension disable --sys-prefix --py rsconnect_jupyter

  # Remove JavaScript extension
  jupyter-nbextension uninstall --sys-prefix --py rsconnect_jupyter
  ```

- Finally, uninstall the `rsconnect-jupyter` python package:
  <div class="code-title">Terminal</div>
  ```bash
  pip uninstall rsconnect_jupyter
  ```