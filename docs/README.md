[`rsconnect`](https://www.github.com/rstudio/rsconnect-jupyter/) is a
plugin for [Jupyter Notebook](https://jupyter.org/) that enables
publishing notebooks to [RStudio
Connect](https://www.rstudio.com/products/connect/).

# Requirements

- Python 2.7 or Python 3.4 and higher
- Jupyter Notebook 5.x
- `pip`
- [`wheel`](https://pypi.org/project/wheel/)

If using `conda`, `pip` and `wheel` should already be installed.

# Installation

Download the `rsconnect` python package from
[here](https://github.com/rstudio/rsconnect-jupyter/releases)
(packaged as a [wheel](https://pythonwheels.com/) file).

We recommend working within a `virtualenv` (especially on Mac).  If you
are unfamiliar, these commands create and activate a `virtualenv`
at `/my/path`:

```
pip install virtualenv
virtualenv /my/path
cd /my/path
source bin/activate
```

Install the `rsconnect` package with the following command:

```
pip install rsconnect-1.0.0-py2.py3-none-any.whl
```

Enable the `rsconnect` extension with the following commands:

```
# Install `rsconnect` as a jupyter extension
jupyter-nbextension install --sys-prefix --py rsconnect

# Enable JavaScript extension
jupyter-nbextension enable --sys-prefix --py rsconnect

# Enable Python extension
jupyter-serverextension enable --sys-prefix --py rsconnect
```

Note: The above commands only need to be run once when installing
`rsconnect`.

Note: If you run into an issue during installation please let us know by filing
a bug [here](https://github.com/rstudio/rsconnect-jupyter/issues).

# Uninstalling

First disable and remove the `rsconnect` notebook extension:

```
# Disable Python extensions found in `rsconnect`
jupyter-serverextension disable --sys-prefix --py rsconnect

# Remove JavaScript extension
jupyter-nbextension uninstall --sys-prefix --py rsconnect
```

Finally, uninstall the `rsconnect` python package:

```
pip uninstall rsconnect
```

# Upgrading

To upgrade `rsconnect`, first uninstall the extension and then
re-install it.

# Usage

Open a notebook and click the blue "Publish to RStudio Connect" icon
to publish the current notebook to RStudio Connect.

![blue toolbar icon used for publishing the notebook](publish-icon.gif)

### Entering server information

If this is your first time publishing this notebook, you will be
prompted to enter the location and a nickname for the RStudio Connect
server.

![initial dialog that prompts for the location of RStudio Connect](add-dialog.gif)

### Publishing options

You will then be prompted to enter your API Key which will be used to publish
the notebook under your account to the selected RStudio Connect server.

See the [RStudio Connect User
Guide](http://docs.rstudio.com/connect/user/api-keys.html) for
instructions on generating API Keys for your user.

![publish dialog that prompts for an API key](manage.png)

There are two different publication modes. Selecting "Publish finished document only" will publish an HTML snapshot of the notebook to Connect. HTML snapshots are static and cannot be scheduled or re-run on the Connect server.

If you select "Publish document with source code", the notebook file and a list of the Python packages installed in your environment will be sent to Connect. This enables Connect to recreate the environment and re-run the notebook at a later time.


### Handling conflicts
If content that matches your notebook's title is found on RStudio Connect, you
may choose to overwrite the existing content or create new content.

![dialog that prompts for overwriting or publishing new content](overwrite.png)

Choosing "New location" will create a new document in Connect. You can choose either publication mode - an HTML snapshot or a document with source code.

Updating an existing document will not change its publication mode.


Upon successful publishing of the document a notification will be
shown in toolbar.  Clicking the notification will open the published
document in the RStudio Connect server you selected in the previous
dialog.

![notification that shows the notebook was published successfully](published.gif)

# Collaboration

To collaborate with others add them as collaborators in RStudio Connect. During
publishing they should provide their API key and will be able to choose a
content location to publish to if the notebook title is the same.

You may share notebooks if appropriate.
