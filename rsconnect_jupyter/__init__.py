import hashlib
import json
import os

from six.moves.urllib.parse import unquote_plus, urlparse

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado import web

from .api import app_config, app_get, app_search, deploy, task_get, verify_server, RSConnectException
from .bundle import make_html_bundle, make_source_bundle

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
            canonical_address = verify_server(server_address)

            if canonical_address:
                address_hash = md5(server_address)
                self.finish(json.dumps({
                    'status': 'Provided server is running RStudio Connect',
                    'address_hash': address_hash,
                    'server_address': canonical_address,
                }))
            else:
                raise web.HTTPError(400, u'Unable to verify the provided server is running RStudio Connect')
            return

        if action == 'app_search':
            uri = urlparse(data['server_address'])
            api_key = data['api_key']
            title = data['notebook_title']
            app_id = data.get('app_id')

            try:
                retval = app_search(uri, api_key, title, app_id)
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
                    bundle = make_source_bundle(model, environment, ext_resources_dir, extra_files=[])
                except Exception as exc:
                    self.log.exception('Bundle creation failed')
                    raise web.HTTPError(500, u"Bundle creation failed: %s" % exc)
            else:
                raise web.HTTPError(400, 'Invalid app_mode: %s, must be "static" or "jupyter-static"' % app_mode)

            try:
                retval = deploy(uri, api_key, app_id, nb_name, nb_title, bundle)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)

            self.finish(retval)
            return

        if action == 'app_get':
            uri = urlparse(data['server_address'])
            api_key = data['api_key']
            app_id = data['app_id']

            try:
                retval = app_get(uri, api_key, app_id)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'get_api_key':
            server_address = data['server_address']
            address_hash = md5(server_address)
            api_key = self.get_secure_cookie('key_' + address_hash, max_age_days=3650)

            self.finish(json.dumps({
                'server_address': server_address,
                'api_key': api_key and api_key.decode('utf-8')
            }))
            return

        if action == 'set_api_key':
            server_address = data['server_address']
            api_key = data['api_key']
            address_hash = md5(server_address)
            self.set_secure_cookie('key_' + address_hash, api_key, expires_days=3650)
            return

        if action == 'get_log':
            uri = urlparse(data['server_address'])
            api_key = data['api_key']
            task_id = data['task_id']
            last_status = data['last_status']
            try:
                retval = task_get(uri, api_key, task_id, last_status)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == 'app_config':
            uri = urlparse(data['server_address'])
            api_key = data['api_key']
            app_id = data['app_id']
            try:
                retval = app_config(uri, api_key, app_id)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return



def load_jupyter_server_extension(nb_app):
    nb_app.log.info("rsconnect_jupyter enabled!")
    web_app = nb_app.web_app
    host_pattern = '.*$'
    action_pattern = r'(?P<action>\w+)'
    route_pattern = url_path_join(web_app.settings['base_url'], r'/rsconnect_jupyter/%s' % action_pattern)
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
