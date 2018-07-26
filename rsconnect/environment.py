#!python
import json
import os
import subprocess
import sys


def detect_environment(dirname):
	"""Determine the python dependencies in the environment.

	If requirements.txt exists in the notebook directory,
	its contents will be used. Otherwise, the results
	of `pip freeze` will be used.

	Returns a dictionary containing the package spec filename
	and contents if successful, or a dictionary containing 'error' 
	on failure.
	"""
	return (output_file(dirname, 'requirements.txt') or
		    pip_freeze(dirname))


def output_file(dirname, filename):
	"""Read an existing package spec file.

	Returns a dictionary containing the filename and contents
	if successful, None if the file does not exist, 
	or a dictionary containing 'error' on failure.
	"""
	try:
		path = os.path.join(dirname, filename)
		if not os.path.exists(path):
			return None

		with open(path, 'r') as f:
			data = f.read()

		return {
			'filename': filename,
			'contents': data,
			'source': 'file',
		}
	except Exception as exc:
		return dict(error='Error reading %s: %s' % (filename, str(exc)))


def pip_freeze(dirname):
	"""Inspect the environment using `pip freeze`.

	Returns a dictionary containing the filename
	(always 'requirements.txt') and contents if successful,
	or a dictionary containing 'error' on failure.
	"""
	try:
		proc = subprocess.Popen(
			['pip', 'freeze'], cwd=dirname, 
			stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)

		pip_stdout, pip_stderr = proc.communicate()
		pip_status = proc.returncode
	except Exception as exc:
		return dict(error='Error during pip freeze: %s' % str(exc),)

	if pip_status != 0:
		msg = pip_stderr or ('exited with code %d' % pip_status)
		return dict(error='Error during pip freeze: %s' % msg)

	return {
		'filename': 'requirements.txt',
		'contents': pip_stdout,
		'source': 'pip_freeze',
	}


if __name__ == '__main__':
	if len(sys.argv) < 2:
		result = dict(error ='Usage: %s NOTEBOOK_PATH' % sys.argv[0])
	else:
		notebook_path = sys.argv[1]
		dirname = os.path.dirname(notebook_path)
		result = detect_environment(dirname)
	json.dump(result, sys.stdout, indent=4)
