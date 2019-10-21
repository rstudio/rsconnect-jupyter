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
