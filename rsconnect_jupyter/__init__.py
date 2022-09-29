import hashlib
import json
import os
import sys

from six.moves.urllib.parse import unquote_plus
from os.path import dirname

from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado import web

from rsconnect import VERSION
from rsconnect.actions import test_server
from rsconnect.api import (
    RSConnect,
    RSConnectException,
    RSConnectServer,
    override_title_search,
    verify_api_key,
)
from rsconnect.bundle import (
    make_notebook_html_bundle,
    make_notebook_source_bundle,
    write_manifest,
)
from rsconnect.environment import Environment
from rsconnect.http_support import CookieJar

from ssl import SSLError

try:
    from rsconnect_jupyter.version import version as __version__  # noqa
except ImportError:
    __version__ = "NOTSET"  # noqa


def _jupyter_server_extension_paths():
    return [{"module": "rsconnect_jupyter"}]


# Jupyter Extension points
def _jupyter_nbextension_paths():
    return [
        dict(
            section="notebook",
            # the path is relative to the `rsconnect` directory
            src="static",
            # directory in the `nbextension/` namespace
            dest="rsconnect_jupyter",
            # _also_ in the `nbextension/` namespace
            require="rsconnect_jupyter/index",
        )
    ]


def md5(s):
    if hasattr(s, "encode"):
        s = s.encode("utf-8")

    try:
        h = hashlib.md5()
    except Exception:
        # md5 is not available in FIPS mode, see if the usedforsecurity option is available
        # (it was added in python 3.9). We set usedforsecurity=False since we are only
        # using this for a file upload integrity check.
        h = hashlib.md5(usedforsecurity=False)

    h.update(s)
    return h.hexdigest()


# https://github.com/jupyter/notebook/blob/master/notebook/base/handlers.py
class EndpointHandler(APIHandler):
    @web.authenticated
    def post(self, action):
        data = self.get_json_body()

        if action == "verify_server":
            server_address = data["server_address"]
            api_key = data["api_key"]
            disable_tls_check = data["disable_tls_check"]
            cadata = data.get("cadata", None)

            canonical_address = None
            result = None
            try:
                canonical_address, result = test_server(
                    RSConnectServer(server_address, api_key, disable_tls_check, cadata)
                )
            except SSLError as exc:
                if exc.reason == "UNKNOWN_PROTOCOL":
                    raise web.HTTPError(
                        400,
                        'Received an "SSL:UNKNOWN_PROTOCOL" error when trying to connect securely '
                        + "to the Posit Connect server.\n"
                        + '* Try changing "https://" in the "Server Address" field to "http://".\n'
                        + "* If the condition persists, contact your Posit Connect server "
                        + "administrator.",
                    )
                raise web.HTTPError(
                    400,
                    "A TLS error occurred when trying to reach the Posit Connect server.\n"
                    + "* Ensure that the server address you entered is correct.\n"
                    + "* Ask your Posit Connect administrator if you need a certificate bundle and\n"
                    + '  upload it using "Upload TLS Certificate Bundle" below.',
                )
            except Exception as err:
                self.log.exception("Unable to verify that the provided server is running Posit Connect")
                raise web.HTTPError(
                    400,
                    "Unable to verify that the provided server is running Posit Connect: %s" % err,
                )
            if canonical_address is not None:
                uri = canonical_address.url
                try:
                    verify_api_key(RSConnectServer(uri, api_key, disable_tls_check, cadata))
                    address_hash = md5(server_address)
                    self.finish(
                        json.dumps(
                            {
                                "status": "Provided server is running Posit Connect",
                                "address_hash": address_hash,
                                "server_address": canonical_address.url,
                            }
                        )
                    )
                except RSConnectException:
                    raise web.HTTPError(401, "Unable to verify the provided API key")
            return

        if action == "app_search":
            uri = data["server_address"]
            api_key = data["api_key"]
            title = data["notebook_title"]
            app_id = data.get("app_id")
            disable_tls_check = data["disable_tls_check"]
            cadata = data.get("cadata", None)

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                retval = override_title_search(server, app_id, title)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == "deploy":
            uri = data["server_address"]
            app_id = data.get("app_id")
            nb_title = data["notebook_title"]
            nb_name = data["notebook_name"]
            nb_path = unquote_plus(data["notebook_path"].strip("/"))
            api_key = data["api_key"]
            app_mode = data["app_mode"]
            environment_dict = data.get("environment")
            disable_tls_check = data["disable_tls_check"]
            cadata = data.get("cadata", None)
            extra_files = data.get("files", [])
            hide_all_input = data.get("hide_all_input", False)
            hide_tagged_input = data.get("hide_tagged_input", False)

            model = self.contents_manager.get(path=nb_path)
            if model["type"] != "notebook":
                # not a notebook
                raise web.HTTPError(400, "Not a notebook: %s" % nb_path)

            if not hasattr(self.contents_manager, "_get_os_path"):
                raise web.HTTPError(400, "Notebook does not live on a mounted filesystem")

            os_path = self.contents_manager._get_os_path(nb_path)

            if app_mode == "static":
                try:
                    bundle = make_notebook_html_bundle(
                        os_path, sys.executable, hide_all_input=hide_all_input, hide_tagged_input=hide_tagged_input
                    )
                except Exception as exc:
                    self.log.exception("Bundle creation failed")
                    raise web.HTTPError(500, "Bundle creation failed: %s" % exc)
            elif app_mode == "jupyter-static":
                if not environment_dict:
                    raise web.HTTPError(400, "environment is required for jupyter-static app_mode")

                try:
                    bundle = make_notebook_source_bundle(
                        os_path,
                        Environment(**environment_dict),
                        extra_files,
                        hide_all_input=hide_all_input,
                        hide_tagged_input=hide_tagged_input,
                    )
                except Exception as exc:
                    self.log.exception("Bundle creation failed")
                    raise web.HTTPError(500, "Bundle creation failed: %s" % exc)
            else:
                raise web.HTTPError(
                    400,
                    'Invalid app_mode: %s, must be "static" or "jupyter-static"' % app_mode,
                )

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                with RSConnect(server) as api_client:
                    retval = api_client.deploy(app_id, nb_name, nb_title, nb_title is not None, bundle)
                    retval["cookies"] = server.cookie_jar.as_dict()
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)

            self.finish(json.dumps(retval))
            return

        if action == "app_get":
            uri = data["server_address"]
            api_key = data["api_key"]
            app_id = data["app_id"]
            disable_tls_check = data["disable_tls_check"]
            cadata = data.get("cadata", None)

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                with RSConnect(server) as api_client:
                    retval = api_client.app_get(app_id)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == "get_log":
            uri = data["server_address"]
            api_key = data["api_key"]
            task_id = data["task_id"]
            last_status = data["last_status"]
            cookie_source = data.get("cookies", {})
            disable_tls_check = data["disable_tls_check"]
            cadata = data.get("cadata", None)

            try:
                rs_connect_server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                rs_connect_server.cookie_jar = CookieJar.from_dict(cookie_source)
                with RSConnect(rs_connect_server) as api_client:
                    retval = api_client.task_get(task_id, last_status)
                rs_connect_server.handle_bad_response(retval)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == "app_config":
            uri = data["server_address"]
            api_key = data["api_key"]
            app_id = data["app_id"]
            disable_tls_check = data["disable_tls_check"]
            cadata = data.get("cadata", None)

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                with RSConnect(server) as api_client:
                    retval = api_client.app_config(app_id)
                server.handle_bad_response(retval)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

        if action == "write_manifest":
            environment_dict = data["environment"]
            nb_path = unquote_plus(data["notebook_path"].strip("/"))
            relative_dir = dirname(nb_path)
            os_path = self.contents_manager._get_os_path(nb_path)
            output_dir = dirname(os_path)
            nb_name = os.path.basename(os_path)
            created, skipped = write_manifest(relative_dir, nb_name, Environment(**environment_dict), output_dir)
            self.finish(json.dumps({"created": created, "skipped": skipped}))
            return

        if action == "get_python_settings":
            uri = data["server_address"]
            api_key = data["api_key"]
            disable_tls_check = data["disable_tls_check"]
            cadata = data.get("cadata", None)

            try:
                server = RSConnectServer(uri, api_key, disable_tls_check, cadata)
                with RSConnect(server) as api_client:
                    retval = api_client.python_settings()
                server.handle_bad_response(retval)
            except RSConnectException as exc:
                raise web.HTTPError(400, exc.message)
            self.finish(json.dumps(retval))
            return

    @web.authenticated
    def get(self, action):
        if action == "plugin_version":
            rsconnect_jupyter_server_extension = __version__
            rsconnect_python_version = VERSION
            self.finish(
                json.dumps(
                    {
                        "rsconnect_jupyter_server_extension": rsconnect_jupyter_server_extension,
                        "rsconnect_python_version": rsconnect_python_version,
                    }
                )
            )


def load_jupyter_server_extension(nb_app):
    nb_app.log.info("rsconnect_jupyter enabled!")
    web_app = nb_app.web_app
    host_pattern = ".*$"
    action_pattern = r"(?P<action>\w+)"
    route_pattern = url_path_join(web_app.settings["base_url"], r"/rsconnect_jupyter/%s" % action_pattern)
    web_app.add_handlers(host_pattern, [(route_pattern, EndpointHandler)])
