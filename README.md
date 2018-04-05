# Development

Need to run this after checkout and when modifying the docker images

    make images

Launch jupyter in a python 2 environment

    make notebook2

Launch jupyter in a python 3 environment

    make notebook3


> Note: notebooks in the `notebooks2` and `notebooks3` directories will be
> available in respective python environments.

# Packaging

The following will create a universal [wheel](https://pythonwheels.com/) ready
to be installed in any python 2 or python 3 environment.

    make package
