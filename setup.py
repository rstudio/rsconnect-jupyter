from setuptools import setup
import os
import sys


def readme():
    with open('README.md') as f:
        return f.read()


# https://github.com/ipython/ipython/blob/master/README.rst#ipython-requires-python-version-3-or-above
if sys.version_info[0] < 3 and 'bdist_wheel' not in sys.argv:
    ipython_dependency = ['ipython<6']
else:
    ipython_dependency = ['ipython']

print('setup.py using python', sys.version_info[0])
print('ipython_dependency:', ipython_dependency)

with open('version.txt', 'r') as f:
    VERSION = f.read().strip()

BUILD = os.environ.get('BUILD_NUMBER', '9999')

setup(name='rsconnect_jupyter',
      version='{version}.{build}'.format(version=VERSION, build=BUILD),
      description='Jupyter Notebook integration with RStudio Connect',
      long_description=readme(),
      long_description_content_type='text/markdown',
      url='http://github.com/rstudio/rsconnect-jupyter',
      project_urls={
          "Documentation": "https://docs.rstudio.com/rsconnect-jupyter",
      },
      author='Jonathan Curran',
      author_email='jonathan.curran@rstudio.com',
      license='GPL-2.0',
      packages=['rsconnect_jupyter'],
      install_requires=[
          'notebook',
          'nbformat',
          'nbconvert>=5.0',
          'six'
      ] + ipython_dependency,
      include_package_data=True,
      zip_safe=False)
