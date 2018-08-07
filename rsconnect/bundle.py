
import hashlib
import io
import json
import logging
import tarfile
import tempfile

from os.path import basename, join

log = logging.getLogger('rsconnect')


def make_manifest(entrypoint, environment, appmode):
    package_manager = environment['package_manager']

    manifest = {
        "version": 1,
        "metadata": {
            "appmode": appmode,
            "entrypoint": entrypoint
        },
        "python": {
            "version": environment['python'],
            "package_manager": {
                "name": package_manager,
                "version": environment[package_manager],
                "package_file": environment['filename']
            }
        },
        "files": {}
    }
    return manifest


def add_manifest_file(manifest, path):
    """Add the specified file to the manifest files section"""
    filename = basename(path)

    manifest['files'][filename] = {
        'checksum': file_checksum(path)
    }


def add_manifest_file_buffer(manifest, filename, buf):
    """Add the specified in-memory buffer to the manifest files section"""
    manifest['files'][filename] = {
        'checksum': buffer_checksum(buf)
    }


def file_checksum(path):
    """Calculate the md5 hex digest of the specified file"""
    with open(path, 'r') as f:
        m = hashlib.md5()
        chunk_size = 64 * 1024

        chunk = f.read(chunk_size)
        while chunk:
            m.update(chunk)
            chunk = f.read(chunk_size)
        return m.hexdigest()


def buffer_checksum(buf):
    """Calculate the md5 hex digest of a buffer (str or bytes)"""
    m = hashlib.md5()
    m.update(to_bytes(buf))
    return m.hexdigest()


def to_bytes(s):
    if hasattr(s, 'encode'):
        return s.encode('utf-8')
    return s


def tar_add(tar, filename, contents):
    """Add an in-memory buffer to the tarball.

    `contents` may be a string or bytes object
    """
    buf = io.BytesIO(to_bytes(contents))
    fileinfo = tarfile.TarInfo(filename)
    fileinfo.size = len(buf.getvalue())
    tar.addfile(fileinfo, buf)


def make_bundle(nb_path, environment):
    """Create a bundle containing the specified notebook file and python environment.

    Returns a file-like object containing the bundle tarball.
    """
    nb_name = basename(nb_path)
    manifest = make_manifest(nb_name, environment, 'jupyter-static')
    add_manifest_file(manifest, nb_path)
    add_manifest_file_buffer(manifest, environment['filename'], environment['contents'])
    log.debug('manifest: %r', manifest)

    bundle_file = tempfile.TemporaryFile(prefix='rsc_bundle')
    bundle = tarfile.open(mode='w:gz', fileobj=bundle_file)
    bundle.add(nb_path, arcname=nb_name)
    tar_add(bundle, environment['filename'], environment['contents'])
    tar_add(bundle, 'manifest.json', json.dumps(manifest))
    bundle.close()
    bundle_file.seek(0)
    return bundle_file
