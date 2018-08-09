
import hashlib
import io
import json
import logging
import tarfile
import tempfile

from os.path import basename, join, split

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


def manifest_add_file(manifest, rel_path, base_dir):
    """Add the specified file to the manifest files section

    The file must be specified as a pathname relative to the notebook directory.
    """
    path = join(base_dir, rel_path)

    manifest['files'][rel_path] = {
        'checksum': file_checksum(path)
    }


def manifest_add_buffer(manifest, filename, buf):
    """Add the specified in-memory buffer to the manifest files section"""
    manifest['files'][filename] = {
        'checksum': buffer_checksum(buf)
    }


def file_checksum(path):
    """Calculate the md5 hex digest of the specified file"""
    with open(path, 'rb') as f:
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


def bundle_add_file(bundle, rel_path, base_dir):
    """Add the specified file to the tarball.

    The file path is relative to the notebook directory.
    """
    path = join(base_dir, rel_path)
    bundle.add(path, arcname=rel_path)
    log.debug('added file: %s', path)


def bundle_add_buffer(bundle, filename, contents):
    """Add an in-memory buffer to the tarball.

    `contents` may be a string or bytes object
    """
    buf = io.BytesIO(to_bytes(contents))
    fileinfo = tarfile.TarInfo(filename)
    fileinfo.size = len(buf.getvalue())
    bundle.addfile(fileinfo, buf)
    log.debug('added buffer: %s', filename)


def make_bundle(nb_path, environment, extra_files=None):
    """Create a bundle containing the specified notebook file and python environment.

    Returns a file-like object containing the bundle tarball.
    """
    nb_dir, nb_name = split(nb_path)
    manifest = make_manifest(nb_name, environment, 'jupyter-static')
    manifest_add_file(manifest, nb_name, nb_dir)
    manifest_add_buffer(manifest, environment['filename'], environment['contents'])

    for rel_path in (extra_files or []):
        manifest_add_file(manifest, rel_path, nb_dir)

    log.debug('manifest: %r', manifest)

    bundle_file = tempfile.TemporaryFile(prefix='rsc_bundle')
    bundle = tarfile.open(mode='w:gz', fileobj=bundle_file)

    # add the manifest first in case we want to partially untar the bundle for inspection
    bundle_add_buffer(bundle, 'manifest.json', json.dumps(manifest))
    bundle_add_file(bundle, nb_name, nb_dir)
    bundle_add_buffer(bundle, environment['filename'], environment['contents'])

    for rel_path in (extra_files or []):
        bundle_add_file(bundle, rel_path, nb_dir)

    bundle.close()
    bundle_file.seek(0)
    return bundle_file
