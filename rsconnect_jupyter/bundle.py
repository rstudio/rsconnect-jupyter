
import hashlib
import io
import json
import logging
import posixpath
import tarfile
import tempfile

from os.path import join, split, splitext

import nbformat
from ipython_genutils import text

log = logging.getLogger('rsconnect_jupyter')
log.setLevel(logging.DEBUG)


def make_source_manifest(entrypoint, environment, appmode):
    package_manager = environment['package_manager']

    manifest = {
        "version": 1,
        "metadata": {
            "appmode": appmode,
            "entrypoint": entrypoint
        },
        "locale": environment['locale'],
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


def make_source_bundle(model, environment, ext_resources_dir, extra_files=None):
    """Create a bundle containing the specified notebook and python environment.

    Returns a file-like object containing the bundle tarball.
    """
    nb_name = model['name']
    nb_content = nbformat.writes(model['content'], nbformat.NO_CONVERT) + '\n'

    manifest = make_source_manifest(nb_name, environment, 'jupyter-static')
    manifest_add_buffer(manifest, nb_name, nb_content)
    manifest_add_buffer(manifest, environment['filename'], environment['contents'])

    for rel_path in (extra_files or []):
        manifest_add_file(manifest, rel_path, ext_resources_dir)

    log.debug('manifest: %r', manifest)

    bundle_file = tempfile.TemporaryFile(prefix='rsc_bundle')
    with tarfile.open(mode='w:gz', fileobj=bundle_file) as bundle:

        # add the manifest first in case we want to partially untar the bundle for inspection
        bundle_add_buffer(bundle, 'manifest.json', json.dumps(manifest))
        bundle_add_buffer(bundle, nb_name, nb_content)
        bundle_add_buffer(bundle, environment['filename'], environment['contents'])

        for rel_path in (extra_files or []):
            bundle_add_file(bundle, rel_path, ext_resources_dir)

    bundle_file.seek(0)
    return bundle_file


def get_exporter(**kwargs):
    """get an exporter, raising appropriate errors"""
    # if this fails, will raise 500
    try:
        from nbconvert.exporters.base import get_exporter
    except ImportError as e:
        raise Exception("Could not import nbconvert: %s" % e)

    try:
        Exporter = get_exporter('html')
    except KeyError:
        raise Exception("No exporter for format: html")

    try:
        return Exporter(**kwargs)
    except Exception as e:
        raise Exception("Could not construct Exporter: %s" % e)


def make_html_manifest(file_name):
    return {
        "version": 1,
        "metadata": {
            "appmode": "static",
            "primary_html": file_name,
        },
    }


def make_html_bundle(model, nb_title, config_dir, ext_resources_dir, config, jupyter_log):
    # create resources dictionary
    resource_dict = {
        "metadata": {
            "name": nb_title,
            "modified_date": model['last_modified'].strftime(text.date_format)
        },
        "config_dir": config_dir
    }

    if ext_resources_dir:
        resource_dict['metadata']['path'] = ext_resources_dir

    exporter = get_exporter(config=config, log=jupyter_log)
    notebook = model['content']
    output, resources = exporter.from_notebook_node(notebook, resources=resource_dict)

    filename = splitext(model['name'])[0] + resources['output_extension']
    log.info('filename = %s' % filename)

    bundle_file = tempfile.TemporaryFile(prefix='rsc_bundle')

    with tarfile.open(mode='w:gz', fileobj=bundle_file) as bundle:
        bundle_add_buffer(bundle, filename, output)

        # manifest
        manifest = make_html_manifest(filename)
        log.debug('manifest: %r', manifest)
        bundle_add_buffer(bundle, 'manifest.json', json.dumps(manifest))

    # rewind file pointer
    bundle_file.seek(0)
    return bundle_file
