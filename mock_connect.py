
# Installation:
# virtualenv flask
# source flask/bin/activate
# pip install flask

# To run:
# FLASK_APP=mock_connect.py flask run --host=0.0.0.0

# Use the API key below (0123456789abcdef0123456789abcdef) in rsconnect-jupyter

import io
import tarfile
from datetime import datetime
from json import dumps, loads
from functools import wraps
from pprint import pprint

from flask import Flask, Blueprint, abort, after_this_request, g, request, url_for, jsonify

def error(code, reason):
    def set_code(response):
        response.status_code = code
        return response

    after_this_request(set_code)

    return {
        'error': reason
    }


app = Flask(__name__)

apps = {}
app_id = 0

bundles = {}
bundle_id = 0

tasks = {}
task_id = 0

apikeys = {
    '0123456789abcdef0123456789abcdef': 'admin'
}

users = {
    'admin': {
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
            "view_apps"
        ],
        "guid": "29a74070-2c13-4ef9-a898-cfc6bcf0f275",
        "user_role": "administrator",
        "updated_time": "2018-08-29T19:25:23.68280816Z",
        "confirmed": True,
        "created_time": "2018-08-29T19:25:23.68280816Z",
        "password": "",
        "email": "admin@example.com"
    }
}

def authenticated(f):
    @wraps(f)
    def wrapper(*args, **kw):
        auth = request.headers.get('Authorization')
        if auth is None or not auth.startswith('Key '):
            abort(401)
        key = auth[4:]
        if key not in apikeys:
            abort(401)

        g.user = users[apikeys[key]]
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
        def wrapper(id, *args, **kw):
            item = d.get(id)
            if item is None:
                return dumps(error(404, 'Not found'))
            return f(item, *args, **kw)
        return wrapper
    return decorator

api = Blueprint('api', __name__)

@app.route('/')
def index():
    return '<html><body>Welcome to Mock Connect!</body></html>'


@api.route('me')
@authenticated
@json
def me():
    return g.user


def timestamp():
    return datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'


@api.route('applications', methods=['GET', 'POST'])
@authenticated
@json
def applications():
    if request.method == 'POST':
        app = request.get_json(force=True)
        name = app.get('name')
        if name and [app for app in apps.values() if app.get('name') == name]:
            return error(409, 'An object with that name already exists.')

        global app_id
        app_id = app_id + 1

        app['id'] = app_id
        app['url'] = '{0}content/{1}'.format(url_for('index', _external=True), app_id)
        app['owner_username'] = g.user.get('username')
        app['owner_first_name'] = g.user.get('first_name')
        app['owner_last_name'] = g.user.get('last_name')
        app['owner_email'] = g.user.get('email')
        app['owner_locked'] = g.user.get('locked')
        app['bundle_id'] = None
        app['needs_config'] = True
        app['access_type'] = None
        app['description'] = ''
        app['app_mode'] = None
        app['created_time'] = timestamp()
        app.setdefault('title', '')
        apps[str(app_id)] = app
        return app
    else:
        count = int(request.args.get('count', 10000))
        search = request.args.get('search')

        def match(app):
            return (search is None or (app.get('title') or '').startswith(search))

        matches = list(filter(match, apps.values()))[:count]
        return {
            'count': len(matches),
            'total': len(matches),
            'applications': matches,
        }


@api.route('applications/<id>', methods=['GET', 'POST'])
@authenticated
@json
@item_by_id(apps)
def application(app):
    if request.method == 'GET':
        return app
    else:
        app.update(request.get_json(force=True))
        return app


@api.route('applications/<id>/config')
@authenticated
@json
@item_by_id(apps)
def config(app):
    return {
        'config_url': '{0}content/apps/{1}'.format(url_for('index', _external=True), app['id'])
    }


@api.route('applications/<id>/upload', methods=['POST'])
@authenticated
@json
@item_by_id(apps)
def upload(app):
    global bundle_id
    bundle_id = bundle_id + 1
    ts = timestamp()

    bundle = {
        'id': bundle_id,
        'app_id': app['id'],
        'created_time': ts,
        'updated_time': ts,
    }
    bundles[bundle_id] = (bundle, request.data)
    return bundle


def read_bundle_file(tarball, filename):
    bio = io.BytesIO(tarball)
    with tarfile.open('r:gz', fileobj=bio) as tar:
        return tar.extractfile(filename).read()

def read_manifest(tarball):
    manifest_data = read_bundle_file(tarball, 'manifest.json').decode('utf-8')
    return loads(manifest_data)

def read_html(tarball):
    manifest = read_manifest(tarball)
    meta = manifest['metadata']
    filename = meta.get('primary_html') or meta.get('entrypoint')
    return read_bundle_file(tarball, filename).decode('utf-8')

app_modes = {
    'static': 4,
    'jupyter-static': 7,
}

@api.route('applications/<id>/deploy', methods=['POST'])
@authenticated
@json
@item_by_id(apps)
def deploy(app):
    bundle_id = request.get_json(force=True).get('bundle')
    if bundle_id is None:
        return error(400, 'bundle_id is required')  # message and status code probably wrong

    if bundle_id not in bundles:
        return error(404, 'bundle %s not found' % bundle_id)  # message and status code probably wrong

    bundle, tarball = bundles[bundle_id]

    manifest = read_manifest(tarball)
    pprint(manifest)

    old_app_mode = app['app_mode']
    new_app_mode = app_modes[manifest['metadata']['appmode']]

    if old_app_mode is not None and old_app_mode != new_app_mode:
        return error(400, 'Cannot change app mode once deployed')  # message and status code probably wrong

    app['app_mode'] = new_app_mode
    app['bundle_id'] = bundle_id
    app['last_deployed_time'] = timestamp()

    global task_id
    task_id = task_id + 1

    task = {
        'id': task_id,
        'user_id': 0,
        'finished': True,
        'code': 0,
        'error': '',
        'last_status': 0,
        'status': ['Building static content', 'Deploying static content'],
    }
    tasks[str(task_id)] = task
    return task


@api.route('tasks/<id>')
@authenticated
@json
@item_by_id(tasks)
def get_task(task):
    return task


@api.route('server_settings')
@json
def server_settings():
    # for our purposes, any non-error response will do
    return {}


@app.route('/content/apps/<id>')
@item_by_id(apps)
def content(app):
    bundle, tarball = bundles[app['bundle_id']]
    return read_html(tarball)


app.register_blueprint(api, url_prefix='/__api__')
