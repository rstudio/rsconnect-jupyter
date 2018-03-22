from setuptools import setup


def readme():
    with open('README.md') as f:
        return f.read()


setup(name='rsconnect_python',
      version='0.1.0',
      description='Jupyter Notebook integration with RStudio Connect',
      url='http://github.com/rstudio/rsconnect-jupyter',
      author='Jonathan Curran',
      author_email='jonathan.curran@rstudio.com',
      license='GPL-2.0',
      packages=['rsconnect_jupyter'],
      install_requires=[
          'nbformat'
      ],
      include_package_data=True,
      zip_safe=False)
