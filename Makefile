.PHONY: test dist develop-setup develop


test:
	python setup.py test

dist:
# build egg
	python setup.py sdist
# build wheel

# wheels don't get built if _any_ file it tries to touch has a timestamp < 1980
# (system files) so use the current timestamp as a point of reference instead
	SOURCE_DATE_EPOCH="$(shell date +%s)"; python setup.py bdist_wheel

develop-setup:
	python setup.py develop

develop:
	jupyter-nbextension install --symlink --user --py rsconnect_jupyter
	jupyter-nbextension enable --py rsconnect_jupyter
	jupyter-serverextension enable --py rsconnect_jupyter
