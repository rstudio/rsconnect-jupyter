from setuptools import setup
import os
import sys


def readme():
    with open('README.md') as f:
        return f.read()


def ipython_dependency():
    # https://github.com/ipython/ipython/blob/master/README.rst#ipython-requires-python-version-3-or-above
    if sys.version_info[0] < 3 and 'bdist_wheel' not in sys.argv:
        return ['ipython<6']
    else:
        return ['ipython']


with open('version.txt', 'r') as f:
    VERSION = f.read().strip()

BUILD = os.environ.get('BUILD_NUMBER', '9999')

setup(name='rsconnect',
      version='{version}.{build}'.format(version=VERSION, build=BUILD),
      description='Jupyter Notebook integration with RStudio Connect',
      long_description=readme(),
      url='http://github.com/rstudio/rsconnect-jupyter',
      author='Jonathan Curran',
      author_email='jonathan.curran@rstudio.com',
      license='GPL-2.0',
      packages=['rsconnect'],
      install_requires=[
          'notebook',
          'nbformat',
          'nbconvert>=5.0',
          'six'
      ] + ipython_dependency(),
      include_package_data=True,
      zip_safe=False)
