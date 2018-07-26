from unittest import TestCase
from os.path import dirname, exists, join

from rsconnect.environment import detect_environment

class TestEnvironment(TestCase):
    def get_dir(self, name):
        path = join(dirname(__file__), 'data', name)
        self.assertTrue(exists(path))
        return path

    def test_file(self):
        result = detect_environment(self.get_dir('pip1'))
        self.assertEqual(result, {
            'source': 'file',
            'filename': 'requirements.txt', 
            'contents': 'numpy\npandas\nmatplotlib\n',
        })

    def test_pip_freeze(self):
        result = detect_environment(self.get_dir('pip2'))

        self.assertIn('contents', result)
        contents = result['contents']
        del result['contents']

        # this assumes `python setup.py install` was run before testing
        self.assertIn('notebook', contents)
        self.assertIn('nbformat', contents)

        self.assertEqual(result, {
            'source': 'pip_freeze',
            'filename': 'requirements.txt', 
        })
