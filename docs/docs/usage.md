# Usage

## Publish to Posit Connect

To publish to Posit Connect:

- Open a Jupyter notebook.
- Click the <img class="icon"; src="../images/publish-icon.gif" alt="blue toolbar icon used for publishing the notebook"> icon (blue publish button) and select **Publish to Posit Connect**
to publish the current notebook to Posit Connect.

!!! note
    This plugin is only for notebooks using Python kernels. Therefore, R notebooks cannot be published using this plugin.

## Entering server information

- If this is your first time publishing a notebook, you will be
prompted to enter the location and a nickname for the Posit Connect server.
- You will also be prompted to enter your API Key. See the [Posit Connect User
Guide](http://docs.posit.co/connect/user/api-keys) for
instructions on generating API Keys for your user.
- When you click the **Add Server** button, `rsconnect-jupyter` will send a request to the Posit Connect server to verify that it can be reached via the requested URL and that the API key is valid.

If your Posit Connect server was configured with a self-signed certificate (or other certificates that the computer hosting your Jupyter notebook server does not trust), the attempt to contact Posit Connect may fail with a TLS-related error.

You have multiple options in this case, depending on your needs:

1. If your administrator can give you the Certificate Authority (CA)
 Bundle for your Posit Connect server, ask your administrator if it
 can be added to the trusted system store.
1. If the CA Bundle cannot be added to the trusted system store, you may select
 **Upload TLS Certificate Bundle** to upload the bundle to Jupyter, which will verify
 your secure connection to Posit Connect.
1. If you cannot obtain the CA bundle, you can disable TLS verification completely
 by selecting the **Disable TLS Certificate Verification** check box. Your connection to
 Posit Connect will still be encrypted, but you will not be able to verify the
 identity of the Posit Connect server.

<img class="border" src="../images/add-dialog.png" class="block" alt="initial dialog that prompts for the location of Posit Connect">

## Publishing options

There are three different publication modes:

- If you select **Publish document with source code**, the notebook file and a list of the Python
packages installed in your environment will be sent to Posit Connect. This enables Posit
Connect to recreate the environment and re-run the notebook at a later time.
- If you select **Publish interactive Voila document with source code**, your notebook will
be published using the [Voila](https://voila.readthedocs.io/en/stable/) package. When
visitors view your published notebook, Connect will present it as an interactive
application. Voila creates a Jupyter kernel for each visitor so they can interact
with any `ipywidgets` that you have included in your notebook.
- Selecting **Publish finished document only** will
publish an HTML snapshot of the notebook to Posit Connect. HTML snapshots are static and
cannot be scheduled or re-run on the Posit Connect server.

<img class="border" src="../images/rsconnect-jupyter-usage.png" class="block" alt="publish dialog">

### Hide Input

There are two options for hiding input code cells in Jupyter Notebooks published
to Posit Connect:

- Hide all input code cells
- Hide only selected input code cells

To hide all input code cells, make that selection in the Publish dialog under the **Hide Input** section.

To hide only the tagged cells, first enable Tags in the **View** > **Cell Toolbar** menu:

<img class="border" src="../images/view-celltoolbar-tags.png" class="block" alt="Enable Tags in the Cell Toolbar menu">

Once enabled, tag each cell where you would like to hide the input code. The tag must be named `hide_input`:

1. Enter `hide_input` into the text field.
2. Click **Add tag** to apply the tag to a code cell.

<img class="border" src="../images/add-tags.png" class="block" alt="Add the hide_input tag to individual cells">


### Additional Files

If your notebook needs some external file to render, add the file using the
**Select Files...** button. You can select any file within the notebook folder. However,
these files may not be made available to users after render.

<img class="border" src="../images/add-files.png" class="block" alt="publish dialog">


### Environment detection with pip

The list of packages sent along with the notebook comes from the python
environment where the notebook kernel is running. For environment
inspection to work, the `rsconnect-jupyter` package must be installed in the
kernel environment; that is, the environment where the `ipykernel` package is
installed. In most cases that will be the same as the notebook server
environment where `jupyter` is installed.

The command `pip freeze` will be used to inspect the environment. The output
of `pip freeze` lists all packages currently installed, as well as their
versions, which enables Posit Connect to recreate the same environment.

## Generating Manifests for git Publishing

Posit Connect can poll git repositories for deployable content and update
as you add new commits to your repository. To be deployable, a
directory must have a valid `manifest.json`. Python content should also have
some kind of environment file (i.e.: `requirements.txt`) to be able
to restore the package set in your current environment.



To begin, click the **Publish** button and select **Create Manifest for git Publishing**.

<img class="border" src="../images/deploy-options.png" class="block" alt="Deployment drop-down
menu showing "Publish to Connect" and "Create Manifest for git Publishing>

When you click **Create Manifest**, one of the following will happen:

- If a `manifest.json` or a `requirements.txt` file does not exist, one will be generated for the current notebook using your current environment.
- If either file exists, you will be presented with a message
informing you of this fact. If you need to regenerate the files, delete them in the Jupyter UI or using the console, then repeat this process.

<img class="border" src="../images/git-backed.png" class="block" alt="Dialog titled "Create Manifest" explaining the manifest creation process with "Cancel" and "Create Manifest" options">

For more information on git publishing, see the
[Posit Connect User Guide](https://docs.posit.co/connect/user/git-backed#git-backed-publishing).

## Handling conflicts

If content that matches your notebook's title is found on Posit Connect, you
may choose to overwrite the existing content or create new content.

<img class="border" src="../images/overwrite.png" class="block" alt="dialog that prompts for overwriting or publishing new content">

- Choosing **New location** creates a new document in Posit Connect.
- You can choose either publication mode:
    - an HTML snapshot *or*
    - a document with source code

Updating an existing document will not change its publication mode.

Upon successful publishing of the document, a notification will be
shown in the toolbar.

Clicking the notification will open the published
document in the Posit Connect server you selected in the previous
dialog.

<img class="border" src="../images/published.gif" class="block" alt="notification that shows the notebook was published successfully">
