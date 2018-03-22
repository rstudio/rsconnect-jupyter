.PHONY: test dist develop-setup develop

test:
	python setup.py test

sdist:
	python setup.py sdist

develop-setup:
	python setup.py develop

develop:
	jupyter-nbextension install --symlink --user --py rsconnect_jupyter
	jupyter-nbextension enable --py rsconnect_jupyter
	jupyter-serverextension enable --py rsconnect_jupyter
