import io
import os
import tarfile
import uuid

from datetime import datetime
from json import dumps, loads
from functools import wraps
from pprint import pprint

# noinspection PyPackageRequirements
from flask import (
    Flask,
    Blueprint,
    abort,
    after_this_request,
    g,
    request,
    url_for,
    jsonify,
)


def error(code, reason):
    def set_code(response):
        response.status_code = code
        return response

    after_this_request(set_code)

    return {"error": reason}


class IdGenerator(object):
    def __init__(self):
        self._value = 0

    def next(self):
        self._value = self._value + 1
        return self._value


app = Flask(__name__)


apps, app_id_generator = {}, IdGenerator()
bundles, bundle_id_generator = {}, IdGenerator()
tasks, task_id_generator = {}, IdGenerator()
api_keys = {os.environ.get("CONNECT_API_KEY", "0123456789abcdef0123456789abcdef"): "admin"}

# noinspection SpellCheckingInspection
users = {
    "admin": {
        "username": "admin",
        "active_time": "2018-08-30T23:49:18.421238194Z",
        "first_name": "Super",
        "last_name": "User",
        "locked": False,
        "privileges": [
            "add_users",
            "add_vanities",
            "change_app_permissions",
            "change_apps",
            "change_groups",
            "change_usernames",
            "change_users",
            "change_variant_schedule",
            "create_groups",
            "edit_run_as",
            "edit_runtime",
            "lock_users",
            "publish_apps",
            "remove_apps",
            "remove_groups",
            "remove_users",
            "remove_vanities",
            "view_app_settings",
            "view_apps",
        ],
        "guid": "29a74070-2c13-4ef9-a898-cfc6bcf0f275",
        "user_role": "administrator",
        "updated_time": "2018-08-29T19:25:23.68280816Z",
        "confirmed": True,
        "created_time": "2018-08-29T19:25:23.68280816Z",
        "password": "",
        "email": "admin@example.com",
    }
}


def authenticated(f):
    @wraps(f)
    def wrapper(*args, **kw):
        auth = request.headers.get("Authorization")
        if auth is None or not auth.startswith("Key "):
            abort(401)
        key = auth[4:]
        if key not in api_keys:
            abort(401)

        g.user = users[api_keys[key]]
        return f(*args, **kw)

    return wrapper


def json(f):
    @wraps(f)
    def wrapper(*args, **kw):
        return jsonify(f(*args, **kw))

    return wrapper


def item_by_id(d):
    def decorator(f):
        @wraps(f)
        def wrapper(object_id, *args, **kw):
            item = d.get(object_id)
            if item is None:
                return dumps(error(404, "Not found"))
            return f(item, *args, **kw)

        return wrapper

    return decorator


api = Blueprint("api", __name__)


@app.route("/")
def index():
    return "<html><body>Welcome to Mock Connect!</body></html>"


@api.route("me")
@authenticated
@json
def me():
    return g.user


def timestamp():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


@api.route("applications", methods=["GET", "POST"])
@authenticated
@json
def applications():
    if request.method == "POST":
        connect_app = request.get_json(force=True)
        name = connect_app.get("name")
        if name and [existing_app for existing_app in apps.values() if existing_app.get("name") == name]:
            return error(409, "An object with that name already exists.")

        connect_app["id"] = app_id_generator.next()
        connect_app["guid"] = str(uuid.uuid4())
        connect_app["url"] = "{0}content/{1}".format(url_for("index", _external=True), connect_app["id"])
        connect_app["owner_username"] = g.user.get("username")
        connect_app["owner_first_name"] = g.user.get("first_name")
        connect_app["owner_last_name"] = g.user.get("last_name")
        connect_app["owner_email"] = g.user.get("email")
        connect_app["owner_locked"] = g.user.get("locked")
        connect_app["bundle_id"] = None
        connect_app["needs_config"] = True
        connect_app["access_type"] = None
        connect_app["description"] = ""
        connect_app["app_mode"] = None
        connect_app["created_time"] = timestamp()
        connect_app.setdefault("title", "")
        apps[str(connect_app["id"])] = connect_app
        return connect_app
    else:
        count = int(request.args.get("count", 10000))
        search = request.args.get("search")

        def match(app_to_match):
            return search is None or (app_to_match.get("title") or "").startswith(search)

        matches = list(filter(match, apps.values()))[:count]
        return {
            "count": len(matches),
            "total": len(matches),
            "applications": matches,
        }


# noinspection PyUnresolvedReferences
@api.route("applications/<object_id>", methods=["GET", "POST"])
@authenticated
@json
@item_by_id(apps)
def application(connect_app):
    if request.method == "GET":
        return connect_app
    else:
        connect_app.update(request.get_json(force=True))
        return connect_app


# noinspection PyUnresolvedReferences
@api.route("applications/<object_id>/config")
@authenticated
@json
@item_by_id(apps)
def config(connect_app):
    return {"config_url": "{0}content/apps/{1}".format(url_for("index", _external=True), connect_app["id"])}


# noinspection PyUnresolvedReferences
@api.route("applications/<object_id>/upload", methods=["POST"])
@authenticated
@json
@item_by_id(apps)
def upload(connect_app):
    bundle_id = bundle_id_generator.next()
    ts = timestamp()

    bundle = {
        "id": bundle_id,
        "app_id": connect_app["id"],
        "created_time": ts,
        "updated_time": ts,
    }
    bundles[bundle_id] = (bundle, request.data)
    return bundle


def read_bundle_file(tarball, filename):
    bio = io.BytesIO(tarball)
    with tarfile.open("r:gz", fileobj=bio) as tar:
        return tar.extractfile(filename).read()


def read_manifest(tarball):
    manifest_data = read_bundle_file(tarball, "manifest.json").decode("utf-8")
    return loads(manifest_data)


def read_html(tarball):
    manifest = read_manifest(tarball)
    meta = manifest["metadata"]
    # noinspection SpellCheckingInspection
    filename = meta.get("primary_html") or meta.get("entrypoint")
    return read_bundle_file(tarball, filename).decode("utf-8")


app_modes = {
    "static": 4,
    "jupyter-static": 7,
}


# noinspection PyUnresolvedReferences
@api.route("applications/<object_id>/deploy", methods=["POST"])
@authenticated
@json
@item_by_id(apps)
def deploy(connect_app):
    bundle_id = request.get_json(force=True).get("bundle")
    if bundle_id is None:
        return error(400, "bundle_id is required")  # message and status code probably wrong

    if bundle_id not in bundles:
        return error(404, "bundle %s not found" % bundle_id)  # message and status code probably wrong

    bundle, tarball = bundles[bundle_id]

    manifest = read_manifest(tarball)
    pprint(manifest)

    old_app_mode = connect_app["app_mode"]
    # noinspection SpellCheckingInspection
    new_app_mode = app_modes[manifest["metadata"]["appmode"]]

    if old_app_mode is not None and old_app_mode != new_app_mode:
        return error(400, "Cannot change app mode once deployed")  # message and status code probably wrong

    connect_app["app_mode"] = new_app_mode
    connect_app["bundle_id"] = bundle_id
    connect_app["last_deployed_time"] = timestamp()

    task_id = task_id_generator.next()
    task = {
        "id": task_id,
        "user_id": 0,
        "finished": True,
        "code": 0,
        "error": "",
        "last_status": 0,
        "status": ["Building static content", "Deploying static content"],
    }
    tasks[str(task_id)] = task
    return task


# noinspection PyUnresolvedReferences
@api.route("tasks/<object_id>")
@authenticated
@json
@item_by_id(tasks)
def get_task(task):
    return task


@api.route("server_settings")
@json
def server_settings():
    return {"not_empty": True}


# noinspection PyUnresolvedReferences
@app.route("/content/apps/<object_id>")
@item_by_id(apps)
def content(connect_app):
    bundle, tarball = bundles[connect_app["bundle_id"]]
    return read_html(tarball)


app.register_blueprint(api, url_prefix="/__api__")
