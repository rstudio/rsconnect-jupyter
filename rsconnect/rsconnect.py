import json
import socket
import time

try:
    # python2
    import httplib as http
except ImportError:
    import http.client as http

try:
    # python3
    from urllib.parse import urlparse, urlencode
except ImportError:
    from urllib import urlparse, urlencode


class RSConnectException(Exception):
    pass


def wait_until(predicate, timeout, period=0.1):
    """
    Run <predicate> every <period> seconds until it returns True or until
    <timeout> seconds have passed.

    Returns True if <predicate> returns True before <timeout> elapses, False
    otherwise.
    """
    ending = time.time() + timeout
    while time.time() < ending:
        if predicate():
            return True
        time.sleep(period)
    return False


def verify_server(uri, api_key):
    r = urlparse(uri)
    conn = None
    try:
        if r.scheme == 'http':
            conn = http.HTTPConnection(r.hostname, port=(r.port or http.HTTP_PORT), timeout=10)
        else:
            conn = http.HTTPSConnection(r.hostname, port=(r.port or http.HTTPS_PORT), timeout=10)
        conn.request('GET', '/__api__/me', None, {'Authorization': 'Key %s' % api_key})
        response = conn.getresponse()
        if response.status >= 400:
            return False
    except (http.HTTPException, OSError, socket.error):
        return False
    finally:
        if conn is not None:
            conn.close()
    return True


class RSConnect:
    def __init__(self, scheme, host, api_key, port=3939):
        self.api_key = api_key
        self.conn = None
        self.mk_conn = lambda: http.HTTPConnection(host, port=port, timeout=10)
        if scheme == 'https':
            self.mk_conn = lambda: http.HTTPSConnection(host, port=port, timeout=10)
        self.http_headers = {
            'Authorization': 'Key %s' % self.api_key,
        }

    def __enter__(self):
        self.conn = self.mk_conn()
        return self

    def __exit__(self, *args):
        self.conn.close()
        self.conn = None

    def response(self):
        response = self.conn.getresponse()
        raw = response.read()
        if response.status >= 400:
            raise RSConnectException('Unexpected response: %d: %s' % (response.status, str(raw)))
        return raw

    def json_response(self):
        response = self.conn.getresponse()
        raw = response.read()
        data = json.loads(raw)
        if response.status >= 400:
            raise RSConnectException('Unexpected response: %d: %s' % (response.status, str(raw)))
        return data


    def whoami(self):
        self.conn.request('GET', '/__api__/me')
        return self.json_response()

    def app_find(self, name):
        params = urlencode({'search': name, 'count': 1})
        self.conn.request('GET', '/__api__/applications?' + params, None, self.http_headers)
        data = self.json_response()
        if data['count'] > 0:
            return data['applications'][0]

    def app_create(self, name):
        params = json.dumps({'name': name})
        self.conn.request('POST', '/__api__/applications', params, self.http_headers)
        return self.json_response()

    def app_upload(self, app_id, tarball):
        self.conn.request('POST', '/__api__/applications/%d/upload' % app_id, tarball, self.http_headers)
        return self.json_response()

    def app_deploy(self, app_id, bundle_id = None):
        params = json.dumps({'bundle': bundle_id})
        self.conn.request('POST', '/__api__/applications/%d/deploy' % app_id, params, self.http_headers)
        return self.json_response()

    def app_publish(self, app_id, access):
        params = json.dumps({
            'access_type': access,
            'id': app_id,
            'needs_config': False
        })
        self.conn.request('POST', '/__api__/applications/%d' % app_id, params, self.http_headers)
        return self.json_response()

    def task_get(self, task_id):
        self.conn.request('GET', '/__api__/tasks/%s' % task_id, None, self.http_headers)
        return self.json_response()


def mk_manifest(file_name):
    return json.dumps({
        "version": 1,
        "platform": "3.4.3",
        "metadata": {
            "appmode": "static",
            "content_category": "site",
            "primary_rmd": None,
            "primary_html": file_name,
            "has_parameters": False
        },
        "packages": None,
        "files": {
            file_name: {
                "checksum": "banana"
            }
        },
        "users": None
    })


def deploy(scheme, host, port, api_key, app_id, app_name, tarball):
    # TODO deal with app_id?
    with RSConnect(scheme, host, api_key, port) as api:
        app = api.app_find(app_name)

        if app is None:
            app = api.app_create(app_name)

        app_bundle = api.app_upload(app['id'], tarball)
        task = api.app_deploy(app['id'], app_bundle['id'])

        timeout = 600
        def task_is_finished(task_id):
            return api.task_get(task_id)['finished']
        task_id = task['id']
        task_finished = wait_until(lambda: task_is_finished(task_id), timeout)

        if task_finished:
            if task['code'] == 0:
                # app deployed successfully
                return api.app_publish(app['id'], 'acl')
            else:
                # app failed to deploy
                print('Unsuccessful deployment :(')
