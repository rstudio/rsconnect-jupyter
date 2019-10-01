import hashlib
import json
import os

from six.moves.urllib.parse import unquote_plus, urlparse

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado import web

from .api import app_config, app_get, app_search, deploy, task_get, verify_server, verify_api_key, RSConnectException
from .bundle import list_files, make_html_bundle, make_source_bundle, write_manifest

from ssl import SSLError

__version__ = '1.0.0'


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

            try:
                canonical_address = verify_server(server_address, disable_tls_check)
            except SSLError:
                raise web.HTTPError(400, u'A TLS error occurred when trying to reach the RStudio Connect server.\n' +
                                    u'* Ensure that the server address you entered is correct.\n' +
                                    u'* Ensure that your Jupyter server has the proper certificates.')
            except Exception as err:
                raise web.HTTPError(400, u'Unable to verify that the provided server is running RStudio Connect: %s' % err)
            if canonical_address is not None:
                uri = urlparse(canonical_address)
                if verify_api_key(uri, api_key, disable_tls_check):
                    address_hash = md5(server_address)
                    self.finish(json.dumps({
                        'status': 'Provided server is running RStudio Connect',
                        'address_hash': address_hash,
                        'server_address': canonical_address,
                    }))
                else:
                    raise web.HTTPError(401, u'Unable to verify the provided API key')
            return

        if action == 'app_search':
            uri = urlparse(data['server_address'])
            api_key = data['api_key']
            title = data['notebook_title']
            app_id = data.get('app_id')
            disable_tls_check = data['disable_tls_check']

            try:
                retval = app_search(uri, api_key, title, app_id, disable_tls_check)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'deploy':
            uri = urlparse(data['server_address'])
            app_id = data.get('app_id')
            nb_title = data['notebook_title']
            nb_name = data['notebook_name']
            nb_path = unquote_plus(data['notebook_path'].strip('/'))
            api_key = data['api_key']
            app_mode = data['app_mode']
            environment = data.get('environment')
            include_files = data['include_files']
            include_subdirs = data['include_subdirs']
            disable_tls_check = data['disable_tls_check']

            model = self.contents_manager.get(path=nb_path)
            if model['type'] != 'notebook':
                # not a notebook
                raise web.HTTPError(400, u"Not a notebook: %s" % nb_path)

            if hasattr(self.contents_manager, '_get_os_path'):
                os_path = self.contents_manager._get_os_path(nb_path)
                ext_resources_dir, _ = os.path.split(os_path)
            else:
                ext_resources_dir = None

            if app_mode == 'static':
                # If the notebook relates to a real file (default contents manager),
                # give its path to nbconvert.

                config_dir = self.application.settings['config_dir']

                try:
                    bundle = make_html_bundle(model, nb_title, config_dir,
                                              ext_resources_dir, self.config, self.log)
                except Exception as exc:
                    self.log.exception('Bundle creation failed')
                    raise web.HTTPError(500, u"Bundle creation failed: %s" % exc)
            elif app_mode == 'jupyter-static':
                if not environment:
                    raise web.HTTPError(400, 'environment is required for jupyter-static app_mode')

                try:
                    if include_files:
                        extra_files = list_files(ext_resources_dir, include_subdirs)
                    else:
                        extra_files = []

                    bundle = make_source_bundle(model, environment, ext_resources_dir, extra_files)
                except Exception as exc:
                    self.log.exception('Bundle creation failed')
                    raise web.HTTPError(500, u"Bundle creation failed: %s" % exc)
            else:
                raise web.HTTPError(400, 'Invalid app_mode: %s, must be "static" or "jupyter-static"' % app_mode)

            try:
                retval = deploy(uri, api_key, app_id, nb_name, nb_title, bundle, disable_tls_check)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)

            self.finish(retval)
            return

        if action == 'app_get':
            uri = urlparse(data['server_address'])
            api_key = data['api_key']
            app_id = data['app_id']
            disable_tls_check = data['disable_tls_check']

            try:
                retval = app_get(uri, api_key, app_id, disable_tls_check)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'get_log':
            uri = urlparse(data['server_address'])
            api_key = data['api_key']
            task_id = data['task_id']
            last_status = data['last_status']
            cookies = data.get('cookies', [])
            disable_tls_check = data['disable_tls_check']

            try:
                retval = task_get(uri, api_key, task_id, last_status, cookies, disable_tls_check)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'app_config':
            uri = urlparse(data['server_address'])
            api_key = data['api_key']
            app_id = data['app_id']
            disable_tls_check = data['disable_tls_check']
            try:
                retval = app_config(uri, api_key, app_id, disable_tls_check)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'write_manifest':
            environment = data['environment']
            nb_path = unquote_plus(data['notebook_path'].strip('/'))
            os_path = self.contents_manager._get_os_path(nb_path)
            output_dir = os.path.dirname(os_path)
            nb_name = os.path.basename(os_path)
            files = write_manifest(nb_name, environment, output_dir)
            self.finish(json.dumps({"files": files}))


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("rsconnect_jupyter enabled!")
    web_app = nb_app.web_app
    host_pattern = '.*$'
    action_pattern = r'(?P<action>\w+)'
    route_pattern = url_path_join(web_app.settings['base_url'], r'/rsconnect_jupyter/%s' % action_pattern)
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
