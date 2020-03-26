# v1.3.0
- Core functionality was moved to the `rsconnect-python` package, which includes a
  command-line interface for convenience. See https://github.com/rstudio/rsconnect-python
  for more information.
- Extra files may now be included with a deployed bundle. Use the `Add Files` button in
  the deployment dialog.
- In addition to disabling TLS checking entirely, users now have the option of uploading
  their own self-signed certificate bundle as a more secure TLS alternative.
- Network errors when connecting to an RStudio Connect server are now described more
  clearly.
- Users may now prepare a repository for git-based deployment from `rsconnect-jupyter`.
  The `Create Manifest` menu will create the necessary files for RStudio Connect to
  recognize the jupyter notebook as deployable from git.

# v1.2.2.7
- Fixed an issue where content could fail to deploy using old server configurations.
  The plugin will now delete any configuration without an associated API key, and you
  may have to add the configuration again.

# v1.2.2
- API key entry has been moved to the Add Server dialog.
- API keys are validated by the server as part of Add Server.
- API keys are now saved in the Jupyter configuration.
- Specific TLS errors are displayed in the Add Server dialog, rather than a generic error message.
- Added an option to disable TLS certificate checking when adding a new server.
- If a deployment fails, the top-level error message from the server is now displayed in the publishing window.
- Cookies from the Connect server are now saved. This enables use with HA deployments of Connect, which require sticky sessions.
- The logs panel no longer autoscrolls if you have scrolled up to review the log.
- Environment inspection now always uses the kernel's python installation. Previously the wrong python could be used if the registered Jupyter kernelspec did not include a full path.

# v1.2.1
- pip is now invoked with `python -m pip` instead of looking for the pip executable
- Always use `pip freeze` instead of pulling in requirements.txt.

# v1.2.0
- Renamed plugin from `rsconnect` to `rsconnect_jupyter`
- Publish notebooks with source allowing them to be rendered on RStudio Connect.
  `pip` and `virtualenv` are used to determine dependent packages.
- Deploy logs are shown while notebook is deployed.

# v1.0.1
- Ensure json is decoded as utf-8

# v1.0.0
- Initial release
- Publish notebooks as pre-rendered static documents
