title: rsconnect-jupyter Release Notes

# Introduction

This document contains the release notes associated with each release of `rsconnect-jupyter`.

`rsconnect-jupyter` 1.4.2
--------------------------------------------------------------------------------
New

* Added ability to hide all code cells when rendering Jupyter notebooks. 
* Added ability to selectively hide code cells tagged with 'hide_input' when rendering Jupyter notebooks. 

`rsconnect-jupyter` 1.4.1
--------------------------------------------------------------------------------
New

*   UI now shows more error details for troubleshooting.
*   Bumped version of `rsconnect-python` used to 1.5.1.

Fixed

*   Fixed an issue where Windows 10 was not detecting `requirements.txt`.
*   Fixed an issue where older versions (around 5.4.0) of Jupyter notebook failed to
    recognize the presence of a `requirements.txt` file.


`rsconnect-jupyter` 1.4.0
--------------------------------------------------------------------------------
New

*   Bump version of `rsconnect-python` used.


`rsconnect-jupyter` 1.3.3
--------------------------------------------------------------------------------
New

*   Bump version of `rsconnect-python` used.

*   Manage cookies the right way.


`rsconnect-jupyter` 1.3.2
--------------------------------------------------------------------------------
New

*   Bump version of `rsconnect-python` used.

*   Make sure Conda environments don't cause problems.


`rsconnect-jupyter` 1.3.1
--------------------------------------------------------------------------------
New

*   Bump version of `rsconnect-python` used.


`rsconnect-jupyter` 1.3.0
--------------------------------------------------------------------------------
New

*   Core functionality was moved to the `rsconnect-python` package, which includes a
    command-line interface for convenience. See https://github.com/rstudio/rsconnect-python
    for more information.

*   Extra files may now be included with a deployed bundle. Use the `Add Files` button in
    the deployment dialog.

*   In addition to disabling TLS checking entirely, users now have the option of uploading
    their own self-signed certificate bundle as a more secure TLS alternative.

*   Network errors when connecting to an RStudio Connect server are now described more
    clearly.

*   Users may now prepare a repository for git-based deployment from `rsconnect-jupyter`.
    The `Create Manifest` menu will create the necessary files for RStudio Connect to
    recognize the jupyter notebook as deployable from git.


`rsconnect-jupyter` 1.2.2.7
--------------------------------------------------------------------------------
Fixed

*   Fixed an issue where content could fail to deploy using old server configurations.
    The plugin will now delete any configuration without an associated API key, and you
    may have to add the configuration again.

`rsconnect-jupyter` 1.2.2
--------------------------------------------------------------------------------
New

*   API key entry has been moved to the Add Server dialog.
*   API keys are validated by the server as part of Add Server.
*   API keys are now saved in the Jupyter configuration.
*   Specific TLS errors are displayed in the Add Server dialog, rather than a generic error message.
*   Added an option to disable TLS certificate checking when adding a new server.
*   If a deployment fails, the top-level error message from the server is now displayed in the publishing window.
*   Cookies from the Connect server are now saved. This enables use with HA deployments of Connect, which require sticky sessions.
*   The logs panel no longer autoscrolls if you have scrolled up to review the log.
*   Environment inspection now always uses the kernel's python installation. Previously the wrong python could be used if the registered Jupyter kernelspec did not include a full path.


`rsconnect-jupyter` 1.2.1
--------------------------------------------------------------------------------
New

*   pip is now invoked with `python -m pip` instead of looking for the pip executable
*   Always use `pip freeze` instead of pulling in requirements.txt.


`rsconnect-jupyter` 1.2.0
--------------------------------------------------------------------------------
New

*   Renamed plugin from `rsconnect` to `rsconnect_jupyter`
*   Publish notebooks with source allowing them to be rendered on RStudio Connect.
    `pip` and `virtualenv` are used to determine dependent packages.
*   Deploy logs are shown while notebook is deployed.


`rsconnect-jupyter` 1.0.1
--------------------------------------------------------------------------------
New

*   Ensure json is decoded as utf-8


`rsconnect-jupyter` 1.0.0
--------------------------------------------------------------------------------
New

*   Initial release
*   Publish notebooks as pre-rendered static documents
