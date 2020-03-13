import hashlib
import json
import os
import sys

from rsconnect.actions import test_server
from six.moves.urllib.parse import unquote_plus
from os.path import dirname, join

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado import web

from rsconnect import VERSION
from rsconnect.api import verify_api_key, RSConnect, RSConnectException, RSConnectServer, \
    override_title_search
from rsconnect.bundle import make_notebook_html_bundle, make_notebook_source_bundle, write_manifest

from ssl import SSLError

with open(join(dirname(__file__), 'version.txt')) as f:
    __version__ = f.read().strip()


def _jupyter_server_extension_paths():
    return [{
        "module": "rsconnect_jupyter"
    }]


# Jupyter Extension points
def _jupyter_nbextension_paths():
    return [dict(
        section="notebook",
        # the path is relative to the `rsconnect` directory
        src="static",
        # directory in the `nbextension/` namespace
        dest="rsconnect_jupyter",
        # _also_ in the `nbextension/` namespace
        require="rsconnect_jupyter/index")]


def md5(s):
    if hasattr(s, 'encode'):
        s = s.encode('utf-8')

    h = hashlib.md5()
    h.update(s)
    return h.hexdigest()


# https://github.com/jupyter/notebook/blob/master/notebook/base/handlers.py
class EndpointHandler(APIHandler):

    @web.authenticated
    def post(self, action):
        data = self.get_json_body()

        if action == 'verify_server':
            server_address = data['server_address']
            api_key = data['api_key']
            disable_tls_check = data['disable_tls_check']
            cadata = data.get('cadata', None)

            try:
                canonical_address, result = test_server(RSConnectServer(server_address, api_key, disable_tls_check, cadata))
            except SSLError as exc:
                if exc.reason == u'UNKNOWN_PROTOCOL':
                    raise web.HTTPError(400,
                                        u'Received an "SSL:UNKNOWN_PROTOCOL" error when trying to connect securely ' +
                                        u'to the RStudio Connect server.\n' +
                                        u'* Try changing "https://" in the "Server Address" field to "http://".\n' +
                                        u'* If the condition persists, contact your RStudio Connect server ' +
                                        u'administrator.')
                raise web.HTTPError(400, u'A TLS error occurred when trying to reach the RStudio Connect server.\n' +
                                    u'* Ensure that the server address you entered is correct.\n' +
                                    u'* Ask your RStudio Connect administrator if you need a certificate bundle and\n' +
                                    u'  upload it using "Upload TLS Certificate Bundle" below.')
            except Exception as err:
                raise web.HTTPError(400, u'Unable to verify that the provided server is running RStudio Connect: %s' % err)
            if canonical_address is not None:
                uri = canonical_address.url
                try:
                    verify_api_key(RSConnectServer(uri, api_key, disable_tls_check, cadata))
                    address_hash = md5(server_address)
                    self.finish(json.dumps({
                        'status': 'Provided server is running RStudio Connect',
                        'address_hash': address_hash,
                        'server_address': canonical_address.url,
                    }))
                except RSConnectException:
                    raise web.HTTPError(401, u'Unable to verify the provided API key')
            return

        if action == 'app_search':
            uri = data['server_address']
            api_key = data['api_key']
            title = data['notebook_title']
            app_id = data.get('app_id')
            disable_tls_check = data['disable_tls_check']
            cadata = data.get('cadata', None)

            try:
                server = RSConnectServer(
                        uri,
                        api_key,
                        disable_tls_check,
                        cadata
                    )
                retval = override_title_search(
                    server,
                    app_id,
                    title
                )
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'deploy':
            uri = data['server_address']
            app_id = data.get('app_id')
            nb_title = data['notebook_title']
            nb_name = data['notebook_name']
            nb_path = unquote_plus(data['notebook_path'].strip('/'))
            api_key = data['api_key']
            app_mode = data['app_mode']
            environment = data.get('environment')
            disable_tls_check = data['disable_tls_check']
            cadata = data.get('cadata', None)
            extra_files = data.get('files', [])

            model = self.contents_manager.get(path=nb_path)
            if model['type'] != 'notebook':
                # not a notebook
                raise web.HTTPError(400, u"Not a notebook: %s" % nb_path)

            if not hasattr(self.contents_manager, '_get_os_path'):
                raise web.HTTPError(400, u"Notebook does not live on a mounted filesystem")

            os_path = self.contents_manager._get_os_path(nb_path)

            if app_mode == 'static':
                try:
                    bundle = make_notebook_html_bundle(os_path, sys.executable)
                except Exception as exc:
                    self.log.exception('Bundle creation failed')
                    raise web.HTTPError(500, u"Bundle creation failed: %s" % exc)
            elif app_mode == 'jupyter-static':
                if not environment:
                    raise web.HTTPError(400, 'environment is required for jupyter-static app_mode')

                try:
                    bundle = make_notebook_source_bundle(os_path, environment, extra_files)
                except Exception as exc:
                    self.log.exception('Bundle creation failed')
                    raise web.HTTPError(500, u"Bundle creation failed: %s" % exc)
            else:
                raise web.HTTPError(400, 'Invalid app_mode: %s, must be "static" or "jupyter-static"' % app_mode)

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                with RSConnect(server) as api_client:
                    retval = api_client.deploy(app_id, nb_name, nb_title, nb_title is not None, bundle)
                    retval['cookies'] = api_client._cookies
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)

            self.finish(retval)
            return

        if action == 'app_get':
            uri = data['server_address']
            api_key = data['api_key']
            app_id = data['app_id']
            disable_tls_check = data['disable_tls_check']
            cadata = data.get('cadata', None)

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                with RSConnect(server) as api_client:
                    retval = api_client.app_get(app_id)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'get_log':
            uri = data['server_address']
            api_key = data['api_key']
            task_id = data['task_id']
            last_status = data['last_status']
            cookies = data.get('cookies', [])
            disable_tls_check = data['disable_tls_check']
            cadata = data.get('cadata', None)

            try:
                with RSConnect(RSConnectServer(uri, api_key, disable_tls_check, cadata), cookies) as api_client:
                    retval = api_client.task_get(task_id, last_status)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'app_config':
            uri = data['server_address']
            api_key = data['api_key']
            app_id = data['app_id']
            disable_tls_check = data['disable_tls_check']
            cadata = data.get('cadata', None)

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                with RSConnect(server) as api_client:
                    retval = api_client.app_config(app_id)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'write_manifest':
            environment = data['environment']
            nb_path = unquote_plus(data['notebook_path'].strip('/'))
            relative_dir = os.path.dirname(nb_path)
            os_path = self.contents_manager._get_os_path(nb_path)
            output_dir = os.path.dirname(os_path)
            nb_name = os.path.basename(os_path)
            created, skipped = write_manifest(relative_dir, nb_name, environment, output_dir)
            self.finish(json.dumps({"created": created, "skipped": skipped}))
            return

        if action == 'get_python_settings':
            uri = data['server_address']
            api_key = data['api_key']
            disable_tls_check = data['disable_tls_check']
            cadata = data.get('cadata', None)

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                with RSConnect(server) as api_client:
                    retval = api_client.python_settings()
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

    @web.authenticated
    def get(self, action):
        if action == 'plugin_version':
            rsconnect_jupyter_server_extension = __version__
            rsconnect_python_version = VERSION
            self.finish(json.dumps({
                "rsconnect_jupyter_server_extension": rsconnect_jupyter_server_extension,
                "rsconnect_python_version": rsconnect_python_version
            }))


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("rsconnect_jupyter enabled!")
    web_app = nb_app.web_app
    host_pattern = '.*$'
    action_pattern = r'(?P<action>\w+)'
    route_pattern = url_path_join(web_app.settings['base_url'], r'/rsconnect_jupyter/%s' % action_pattern)
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
