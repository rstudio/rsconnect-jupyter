from setuptools import setup


def readme():
    with open('README.md') as f:
        return f.read()


setup(name='rsconnect',
      version='1.0.0',
      description='Jupyter Notebook integration with RStudio Connect',
      long_description=readme(),
      url='http://github.com/rstudio/rsconnect-jupyter',
      author='Jonathan Curran',
      author_email='jonathan.curran@rstudio.com',
      license='GPL-2.0',
      packages=['rsconnect'],
      install_requires=[
          'notebook',
          'nbformat'
      ],
      include_package_data=True,
      zip_safe=False)
