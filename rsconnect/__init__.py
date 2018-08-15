import json
import os

try:
    # python3
    from urllib.parse import unquote_plus, urlparse
except ImportError:
    from urllib import unquote_plus
    from urlparse import urlparse

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado import web

try:
    from rsconnect import app_get, app_search, deploy, verify_server, RSConnectException
    from rsconnect.bundle import make_html_bundle, make_source_bundle
except ImportError:
    from .rsconnect import app_get, app_search, deploy, verify_server, RSConnectException
    from .bundle import make_html_bundle, make_source_bundle

__version__ = '1.0.0'


def _jupyter_server_extension_paths():
    return [{
        "module": "rsconnect"
    }]


# Jupyter Extension points
def _jupyter_nbextension_paths():
    return [dict(
        section="notebook",
        # the path is relative to the `rsconnect` directory
        src="static",
        # directory in the `nbextension/` namespace
        dest="rsconnect",
        # _also_ in the `nbextension/` namespace
        require="rsconnect/index")]


# https://github.com/jupyter/notebook/blob/master/notebook/base/handlers.py
class EndpointHandler(APIHandler):

    @web.authenticated
    def post(self, action):
        data = self.get_json_body()

        if action == 'verify_server':
            if verify_server(data['server_address']):
                self.finish(json.dumps({'status': 'Provided server is running RStudio Connect'}))
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

            if app_mode == 'static':
                # If the notebook relates to a real file (default contents manager),
                # give its path to nbconvert.
                if hasattr(self.contents_manager, '_get_os_path'):
                    os_path = self.contents_manager._get_os_path(nb_path)
                    ext_resources_dir, _ = os.path.split(os_path)
                else:
                    ext_resources_dir = None

                model = self.contents_manager.get(path=nb_path)
                if model['type'] != 'notebook':
                    # not a notebook
                    raise web.HTTPError(400, u"Not a notebook: %s" % nb_path)

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
                    bundle = make_source_bundle(nb_path, environment, extra_files=[])
                except Exception as exc:
                    self.log.exception('Bundle creation failed')
                    raise web.HTTPError(500, u"Bundle creation failed: %s" % exc)
            else:
                raise web.HTTPError(400, 'Invalid app_mode: %s, must be "static" or "jupyter-static"' % app_mode)

            try:
                published_app = deploy(uri, api_key, app_id, nb_name, nb_title, bundle)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)

            self.finish(published_app)
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


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("rsconnect enabled!")
    web_app = nb_app.web_app
    host_pattern = '.*$'
    action_pattern = r'(?P<action>\w+)'
    route_pattern = url_path_join(web_app.settings['base_url'], r'/rsconnect_jupyter/%s' % action_pattern)
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
