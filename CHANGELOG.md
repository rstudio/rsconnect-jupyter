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
