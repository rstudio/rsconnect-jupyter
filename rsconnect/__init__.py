import io
import json
import os
import tarfile
import tempfile

try:
    # python3
    from urllib.parse import unquote_plus, urlparse
except ImportError:
    from urllib import unquote_plus
    from urlparse import urlparse

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado import web
from tornado.log import app_log
from ipython_genutils import text

try:
    from rsconnect import app_get, app_search, mk_manifest, deploy, verify_server, RSConnectException
except:
    from .rsconnect import app_get, app_search, mk_manifest, deploy, verify_server, RSConnectException

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


def get_exporter(**kwargs):
    """get an exporter, raising appropriate errors"""
    # if this fails, will raise 500
    try:
        from nbconvert.exporters.base import get_exporter
    except ImportError as e:
        raise web.HTTPError(500, "Could not import nbconvert: %s" % e)

    try:
        Exporter = get_exporter('html')
    except KeyError:
        # should this be 400?
        raise web.HTTPError(400, u"No exporter for format: html")

    try:
        return Exporter(**kwargs)
    except Exception as e:
        app_log.exception("Could not construct Exporter: %s", Exporter)
        raise web.HTTPError(500, "Could not construct Exporter: %s" % e)


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
            app_id = data['app_id'] if 'app_id' in data else None
            nb_title = data['notebook_title']
            nb_path = unquote_plus(data['notebook_path'].strip('/'))
            api_key = data['api_key']

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

            # create resources dictionary
            resource_dict = {
                "metadata": {
                    "name": nb_title,
                    "modified_date": model['last_modified'].strftime(text.date_format)
                },
                "config_dir": self.application.settings['config_dir']
            }
            # TODO handle zip file? (not sure what this is yet)
            if ext_resources_dir:
                resource_dict['metadata']['path'] = ext_resources_dir

            exporter = get_exporter(config=self.config, log=self.log)
            notebook = model['content']
            try:
                output, resources = exporter.from_notebook_node(notebook, resources=resource_dict)
            except Exception as e:
                self.log.exception("nbconvert failed: %s", e)
                raise web.HTTPError(500, "nbconvert failed: %s" % e)

            filename = os.path.splitext(model['name'])[0] + resources['output_extension']
            self.log.info('filename = %s' % filename)

            published_app = {}
            with tempfile.TemporaryFile() as bundle:
                with tarfile.open(mode='w:gz', fileobj=bundle) as tar:
                    buf = io.BytesIO(output.encode())
                    fileinfo = tarfile.TarInfo(filename)
                    fileinfo.size = len(buf.getvalue())
                    tar.addfile(fileinfo, buf)

                    # manifest
                    buf = io.BytesIO(mk_manifest(filename).encode())
                    fileinfo = tarfile.TarInfo('manifest.json')
                    fileinfo.size = len(buf.getvalue())
                    tar.addfile(fileinfo, buf)

                # rewind file pointer
                bundle.seek(0)
                try:
                    published_app = deploy(uri, api_key, app_id, nb_title, bundle)
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
