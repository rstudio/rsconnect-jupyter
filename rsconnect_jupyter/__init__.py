import io
import json
import os
import tarfile

try:
    # python3
    import urllib.parse as urllib
except ImportError:
    import urllib

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from notebook.nbconvert.handlers import get_exporter
from tornado import web
from tornado.log import app_log
from ipython_genutils import text

from rsconnect_jupyter.rsconnect import mk_manifest, deploy


__version__ = '0.1.0'


def _jupyter_server_extension_paths():
    return [{
        "module": "rsconnect_jupyter"
    }]


# Jupyter Extension points
def _jupyter_nbextension_paths():
    return [dict(
        section="notebook",
        # the path is relative to the `rsconnect_jupyter` directory
        src="static",
        # directory in the `nbextension/` namespace
        dest="rsconnect_jupyter",
        # _also_ in the `nbextension/` namespace
        require="rsconnect_jupyter/index")]


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
    def get(self):
        user = self.get_current_user()
        self.finish(json.dumps({'hello': user.decode()}))

    @web.authenticated
    def post(self):
        data = self.get_json_body()
        server, port, api_key, notebook_path = data['server'], data['port'], data['api_key'], data['notebook_path']
        exporter = get_exporter(config=self.config, log=self.log)

        path = urllib.unquote_plus(notebook_path.strip('/'))

        # If the notebook relates to a real file (default contents manager),
        # give its path to nbconvert.
        if hasattr(self.contents_manager, '_get_os_path'):
            os_path = self.contents_manager._get_os_path(path)
            ext_resources_dir, basename = os.path.split(os_path)
        else:
            ext_resources_dir = None
        print('file working directory: %s' %ext_resources_dir)

        model = self.contents_manager.get(path=path)
        name = model['name']
        if model['type'] != 'notebook':
            # not a notebook
            raise web.HTTPError(400, u"Not a notebook: %s" % notebook_path)

        nb = model['content']
        # create resources dictionary
        mod_date = model['last_modified'].strftime(text.date_format)
        nb_title = os.path.splitext(name)[0]

        resource_dict = {
            "metadata": {
                "name": nb_title,
                "modified_date": mod_date
            },
            "config_dir": self.application.settings['config_dir']
        }

        if ext_resources_dir:
            resource_dict['metadata']['path'] = ext_resources_dir

        # TODO handle zip file?

        try:
            output, resources = exporter.from_notebook_node(
                nb,
                resources=resource_dict
            )
        except Exception as e:
            self.log.exception("nbconvert failed: %s", e)
            raise web.HTTPError(500, "nbconvert failed: %s" % e)
        filename = os.path.splitext(name)[0] + resources['output_extension']
        self.log.info('filename = %s' % filename)

        published_app = {}
        with io.BytesIO() as bundle:
            app_name = name.replace('.', '_').replace(' ', '_')

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

            # reset fp
            bundle.seek(0)
            published_app = deploy('http', '192.168.42.1', 'tY3YklF1SQWuxoGVzhoI2rwPXun0q68w', app_name, bundle)

        self.finish(json.dumps(published_app))


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("rsconnect_jupyter enabled!")
    web_app = nb_app.web_app
    host_pattern = '.*$'
    route_pattern = url_path_join(web_app.settings['base_url'], '/rsconnect')
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
