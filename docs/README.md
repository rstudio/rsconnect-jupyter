[`rsconnect`](https://www.github.com/rstudio/rsconnect-jupyter/) is a
plugin for [Jupyter Notebook](https://jupyter.org/) that enables
publishing of notebooks to [RStudio
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

Install the `rsconnect` package with the following command:

```
pip install rsconnect-0.1.0-py2.py3-none-any.whl
```

Enable the `rsconnect` extension with the following commands:

```
# Install `rsconnect` as a jupyter extension for your user. If you wish
# to allow the extension to be available for all users who access
# jupyter, remove the `--user` flag
jupyter-nbextension install --user --py rsconnect

# Enable JavaScript extension
jupyter-nbextension enable --py rsconnect

# Enable Python extension
jupyter-serverextension enable --py rsconnect
```

# Usage

Open a notebook and click the blue "Publish to RStudio Connect" icon
to publish the current notebook to RStudio Connect.

<img alt="blue toolbar icon used for publishing the notebook" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAkCAYAAAD7PHgWAAACUUlEQVR42mNgGAWjYBSMVDDzPyvD9GfBDDOez2OY+fwikH4HxH8Ypj9/BRQ/CmR3MUx/ajgwjpv+PIFhxosnQEf8JwLvpZ9D59/nAFq4kkiHIePfQA/l09Zxq66wMcx4tosMxyHhl/q0jNYeHBbfAMo1MEx74QekHRhmvXABpsl4oPh0IP6AonbaSz0aOQ6YhmY8/4vmsG/AzJDOUP+fCae+ya+lgOqOAx38lGHmiwrahd6M55vQHPeTYdZz+wEqPp6HouDpz2LBxQeyA2c+L0XRAwrFGc/sgBkhl2H6iyRgdCvRMrQIJfabQAexwNXPeqIGFDuHpuYvMD1OA2cs+jvwWRpc7bznokCxx3jUz6O3A38wTHrLh1D7rI2A+n/UL1rwWTjz+UZUtS/OEwxx9PRKMZj2UBAnBtUkqBnqNhFpthGufvYLRSD/LhA/g9bdMPwaKn6YyqH9Yj1BB05/HoYUO+UE1D+ksgNfuhKw8BFD32NOJAdeoa8DIdFcj8Oyd8DawxxRGz1zJyI5PKRR4f7MDZyBIOnoCpA9mWHqU1nUhgZGWXkYGuUwXEfb6hBvUng2ASO0QI0KmoA5j4XAITTj+VpwriTURJv+bCKWqDxGy9CYg2TRB6AD2oEOdmSY+VoSWAwJQDzw1AgcXTOe38fiuO/A+lqHlg6kpNH6D9xdoHF/xAxo0RsyHAfsUD1LpU+in/1EBhitayB1LVGOuwqMdhv6505QEx6SCe5gcdRriCeeBTGs+s88CPrJ7/gZpj1VB+PZL8VHBw5GwSigEwAAO8Vb1WEAypEAAAAASUVORK5CYII=">

If this is your first time publishing this notebook, you will be
prompted to enter the location and a nickname for the RStudio Connect
server.

<img alt="initial dialog that prompts for the location of RStudio Connect" src="add-dialog.gif">

You will then be prompted to enter your API Key which will be used to
publish the notebook under your account to the selected RStudio
Connect server.

See the [RStudio Connect User
Guide](http://docs.rstudio.com/connect/user/api-keys.html) for
instructions on generating API Keys for your user.

<img alt="publish dialog that prompts for an API key" src="manage.gif">

Upon successful publishing of the document a notification will be
shown in toolbar.  Clicking the notification will open the published
document in the RStudio Connect server you selected in the previous
dialog.

<img alt="notification that shows the notebook was published successfully" src="published.gif">
