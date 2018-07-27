#!python
import json
import os
import re
import subprocess
import sys


version_re = re.compile(r'\d+\.\d+(\.\d+)?')
exec_dir = os.path.join(sys.exec_prefix, 'bin')


def detect_environment(dirname):
    """Determine the python dependencies in the environment.

    If requirements.txt exists in the notebook directory,
    its contents will be used. Otherwise, the results
    of `pip freeze` will be used.

    Returns a dictionary containing the package spec filename
    and contents if successful, or a dictionary containing 'error' 
    on failure.
    """
    result = (output_file(dirname, 'requirements.txt') or
              pip_freeze(dirname))

    if result is not None:
        result['python'] = get_python_version()

        pip_version, err = get_version('pip')
        if err:
            result['error'] = err
        else:
            result['pip'] = pip_version

    return result


def get_python_version():
    v = sys.version_info
    return "%d.%d.%d" % (v[0], v[1], v[2])


def get_version(binary):
    # use os.path.realpath to traverse any symlinks
    try:
        binary_path = os.path.realpath(os.path.join(exec_dir, binary))
        if not os.path.isfile(binary_path):
            return None, ("File not found: %s" % binary_path)
        args = [binary_path, "--version"]
        proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
        stdout, stderr = proc.communicate()
        match = version_re.search(stdout)
        if match:
            return match.group(), None
        return None, ("Failed to get version of '%s' from the output of: %s --version" % (binary, binary_path))
    except Exception as exc:
        return None, str(exc)


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
        return dict(error='Error during pip freeze: %s' % str(exc))

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
