
import json
import sys
import tarfile

from unittest import TestCase
from os.path import dirname, exists, join

from rsconnect.environment import detect_environment
from rsconnect.bundle import make_bundle


class TestBundle(TestCase):
    def get_dir(self, name):
        path = join(dirname(__file__), 'data', name)
        self.assertTrue(exists(path))
        return path

    def python_version(self):
        return '.'.join(map(str, sys.version_info[:3]))

    def test_bundle1(self):
        self.maxDiff = 5000
        dir = self.get_dir('pip1')
        nb_path = join(dir, 'dummy.ipynb')

        # Note that here we are introspecting the environment from within
        # the test environment. Don't do this in the production code, which
        # runs in the notebook server. We need the introspection to run in
        # the kernel environment and not the notebook server environment.
        environment = detect_environment(dir)
        bundle = make_bundle(nb_path, environment)

        tar = tarfile.open(mode='r:gz', fileobj=bundle)

        try:
            names = sorted(tar.getnames())
            self.assertEqual(names, [
                'dummy.ipynb',
                'manifest.json',
                'requirements.txt',
            ])

            reqs = tar.extractfile('requirements.txt').read()
            self.assertEqual(reqs, b'numpy\npandas\nmatplotlib\n')

            manifest = json.load(tar.extractfile('manifest.json'))

            # don't check locale value, just require it be present
            del manifest['locale']

            self.assertEqual(manifest, {
                "version": 1,
                "metadata": {
                    "appmode": "jupyter-static",
                    "entrypoint": "dummy.ipynb"
                },
                "python": {
                    "version": self.python_version(),
                    "package_manager": {
                        "name": "pip",
                        "version": "10.0.1",  # this is the version in our docker image
                        "package_file": "requirements.txt"
                    }
                },
                "files": {
                    "dummy.ipynb": {
                        "checksum": "d41d8cd98f00b204e9800998ecf8427e"
                    },
                    "requirements.txt": {
                        "checksum": "5f2a5e862fe7afe3def4a57bb5cfb214"
                    }
                }
            })
        finally:
            tar.close()
            bundle.close()

    def test_bundle2(self):
        self.maxDiff = 5000
        dir = self.get_dir('pip2')
        nb_path = join(dir, 'dummy.ipynb')

        # Note that here we are introspecting the environment from within
        # the test environment. Don't do this in the production code, which
        # runs in the notebook server. We need the introspection to run in
        # the kernel environment and not the notebook server environment.
        environment = detect_environment(dir)
        bundle = make_bundle(nb_path, environment, extra_files=['data.csv'])

        tar = tarfile.open(mode='r:gz', fileobj=bundle)

        try:
            names = sorted(tar.getnames())
            self.assertEqual(names, [
                'data.csv',
                'dummy.ipynb',
                'manifest.json',
                'requirements.txt',
            ])

            reqs = tar.extractfile('requirements.txt').read()

            # these are the dependencies declared in our setup.py
            self.assertIn(b'notebook', reqs)
            self.assertIn(b'nbformat', reqs)

            manifest = json.load(tar.extractfile('manifest.json'))

            # don't check requirements.txt since we don't know the checksum
            del manifest['files']['requirements.txt']

            # also don't check locale value, just require it be present
            del manifest['locale']

            self.assertEqual(manifest, {
                "version": 1,
                "metadata": {
                    "appmode": "jupyter-static",
                    "entrypoint": "dummy.ipynb"
                },
                "python": {
                    "version": self.python_version(),
                    "package_manager": {
                        "name": "pip",
                        "version": "10.0.1",  # this is the version in our docker image
                        "package_file": "requirements.txt"
                    }
                },
                "files": {
                    "dummy.ipynb": {
                        "checksum": "d41d8cd98f00b204e9800998ecf8427e"
                    },
                    "data.csv": {
                        "checksum": "f2bd77cc2752b3efbb732b761d2aa3c3"
                    }
                }
            })
        finally:
            tar.close()
            bundle.close()
