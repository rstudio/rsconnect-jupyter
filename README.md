# User Guide

Installation and usage instructions are available
[here](https://github.com/rstudio/rsconnect-jupyter/tree/master/docs).

# Developing `rsconnect`

Need to run this after checkout and when modifying the docker images

    make images

Launch jupyter in a python 2 environment

    make notebook2

Launch jupyter in a python 3 environment

    make notebook3

## Trying out notebooks

> Note: notebooks in the `notebooks2` and `notebooks3` directories will be
> available in respective python environments.

Sample notebooks can be obtained from
[ipython-in-depth](https://github.com/ipython/ipython-in-depth). e.g.

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
