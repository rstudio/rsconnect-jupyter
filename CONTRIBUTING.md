# Contributing Guidelines

This documentation covers common tasks related to development.

For installation and usage instructions see [README.md](./README.md).

<!-- markdown-toc start - Don't edit this section. Run M-x markdown-toc-refresh-toc -->
**Table of Contents**

- [Contributing Guidelines](#contributing-guidelines)
- [Development](#development)
    - [Trying out notebooks](#trying-out-notebooks)
    - [Seeing code changes](#seeing-code-changes)
- [Packaging](#packaging)
- [Versioning and Releases](#versioning-and-releases)
    - [Versioning](#versioning)
    - [Releases](#releases)
        - [Releasing on Conda Forge](#releasing-on-conda-forge)
        - [Adding yourself as a rsconnect-jupyter conda-forge maintainer](#adding-yourself-as-a-rsconnect-jupyter-conda-forge-maintainer)

<!-- markdown-toc end -->

# Development

Need to run this after checkout and when modifying the docker images

    make images

Launch jupyter in a python 3 environment

    make notebook3

## Trying out notebooks

> Note: notebooks in the `notebooks3` directories will be available in respective python environments.

Sample notebooks can be obtained from:

- https://github.com/ipython/ipython-in-depth
- https://github.com/jupyter/jupyter/wiki/A-gallery-of-interesting-Jupyter-Notebooks
- https://losc.ligo.org/tutorials/
- http://nb.bianp.net/sort/views/

e.g.

```
cd notebooks3
git clone https://github.com/ipython/ipython-in-depth
```

## Seeing code changes

When modifying JavaScript files simply refresh the browser window to see
changes.

When modifying Python files restart the jupyter process to see changes.

# Packaging

The following will create a universal [wheel](https://pythonwheels.com/) ready
to be installed in any python 2 or python 3 environment.

    make package
# Versioning and Releases

## Versioning

Versioning is accomplished via Git tagging using [Semantic Versioning](https://semver.org/). Read more about tagging [here](https://git-scm.com/book/en/v2/Git-Basics-Tagging).
o view the most recent release tag, execute the following.

```shell
git describe master --match "v*" --tags
```

## Releases

Releases are accomplished through GitHub Actions.

To initiate a release, create a manual tag use the following steps. The `<MAJOR>.<MINOR>.<PATCH>` values **MUST** follow semantic versioning.

    git tag <MAJOR>.<MINOR>.<PATCH>
    git push origin <MAJOR>.<MINOR>.<PATCH>

Once pushed, a GitHub Action will be trigged. This action with publish the release to [PyPi](https://pypi.org/project/rsconnect-jupyter/) using the specified version.

### Releasing on Conda Forge

`rsconnect-jupyter` exists on conda-forge as its own [feedstock](https://github.com/conda-forge/rsconnect-jupyter-feedstock)

Updating the package requires a fork of the repository and a push request [example workflow](https://conda-forge.org/docs/maintainer/updating_pkgs.html#example-workflow-for-updating-a-package). 

- For new version/release, update the [meta.yaml](https://github.com/conda-forge/rsconnect-jupyter-feedstock/blob/master/recipe/meta.yaml) file with the new version number, source url, and corresponding checksum.

- For a rebuild of the same version, increase "number" under "build" by one in the [meta.yaml](https://github.com/conda-forge/rsconnect-jupyter-feedstock/blob/master/recipe/meta.yaml) file.

### Adding yourself as a rsconnect-jupyter conda-forge maintainer

Add your GitHub username under recipe-maintainers in the [meta.yaml](https://github.com/conda-forge/rsconnect-jupyter-feedstock/blob/master/recipe/meta.yaml) file.

