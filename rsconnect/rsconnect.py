import json
import logging
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
    from urllib import urlencode
    from urlparse import urlparse

class RSConnectException(Exception):
    def __init__(self, message):
        super(RSConnectException, self).__init__(message)
        self.message = message


logger = logging.getLogger('rsconnect')


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


def verify_server(server_address):
    r = urlparse(server_address)
    conn = None
    try:
        if r.scheme == 'http':
            conn = http.HTTPConnection(r.hostname, port=(r.port or http.HTTP_PORT), timeout=10)
        else:
            conn = http.HTTPSConnection(r.hostname, port=(r.port or http.HTTPS_PORT), timeout=10)
        conn.request('GET', '/__api__/server_settings')
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

    def request(self, method, path, *args, **kwargs):
        logger.info('Performing: %s %s' % (method, path))
        try:
            self.conn.request(method, path, *args, **kwargs)
        except http.HTTPException as e:
            logger.error('HTTPException: %s' % e)
            raise RSConnectException(str(e))
        except (IOError, OSError) as e:
            logger.error('IO/OS Error: %s' % e)
            raise RSConnectException(str(e))

    def _update_cookie(self, response):
        ### This is a hacky way of setting a cookie if we receive one
        value = response.getheader('set-cookie', None)
        if value is not None:
            self.http_headers['Cookie'] = value
        else:
            if 'Cookie' in self.http_headers:
                del self.http_headers['Cookie']

    def json_response(self):
        response = self.conn.getresponse()
        self._update_cookie(response)
        raw = response.read()

        if response.status >= 500:
            logger.error('Received HTTP 500: %s', raw)
            try:
                message = json.loads(raw)['error']
            except:
                message = 'Unexpected response code: %d' % (response.status)
            raise RSConnectException(message)
        elif response.status >= 400:
            data = json.loads(raw)
            raise RSConnectException(data['error'])
        else:
            data = json.loads(raw)
            return data

    def me(self):
        self.request('GET', '/__api__/me', None, self.http_headers)
        return self.json_response()

    def app_find(self, filters):
        params = urlencode(filters)
        self.request('GET', '/__api__/applications?' + params, None, self.http_headers)
        data = self.json_response()
        if data['count'] > 0:
            return data['applications']

    def app_create(self, name):
        params = json.dumps({'name': name})
        self.request('POST', '/__api__/applications', params, self.http_headers)
        return self.json_response()

    def app_upload(self, app_id, tarball):
        self.request('POST', '/__api__/applications/%d/upload' % app_id, tarball, self.http_headers)
        return self.json_response()

    def app_deploy(self, app_id, bundle_id = None):
        params = json.dumps({'bundle': bundle_id})
        self.request('POST', '/__api__/applications/%d/deploy' % app_id, params, self.http_headers)
        return self.json_response()

    def app_publish(self, app_id, access):
        params = json.dumps({
            'access_type': access,
            'id': app_id,
            'needs_config': False
        })
        self.request('POST', '/__api__/applications/%d' % app_id, params, self.http_headers)
        return self.json_response()

    def app_config(self, app_id):
        self.request('GET', '/__api__/applications/%d/config' % app_id, None, self.http_headers)
        return self.json_response()

    def task_get(self, task_id):
        self.request('GET', '/__api__/tasks/%s' % task_id, None, self.http_headers)
        return self.json_response()


def mk_manifest(file_name):
    return json.dumps({
        "version": 1,
         # unused for content without source
        "metadata": {
            "appmode": "static",
            "primary_html": file_name,
        },
    })


def deploy(scheme, host, port, api_key, app_id, app_title, tarball):
    with RSConnect(scheme, host, api_key, port) as api:
        if app_id is None:
            # create an app if id is not provided
            app = api.app_create(app_title)
        else:
            # assume app exists. if it was deleted then Connect will
            # raise an error
            app = {'id': app_id}

        app_bundle = api.app_upload(app['id'], tarball)
        task = api.app_deploy(app['id'], app_bundle['id'])

        # 10 minute timeout
        timeout = 600
        def task_is_finished(task_id):
            return api.task_get(task_id)['finished']
        task_id = task['id']
        task_finished = wait_until(lambda: task_is_finished(task_id), timeout)

        if task_finished:
            if task['code'] == 0:
                # app deployed successfully
                api.app_publish(app['id'], 'acl')
                config = api.app_config(app['id'])
                return {
                    'app_id': app['id'],
                    'config': config,
                }
            else:
                # app failed to deploy
                raise RSConnectException('Failed to deploy successfully')


def app_search(scheme, host, port, api_key, app_title):
    with RSConnect(scheme, host, api_key, port) as api:
        me = api.me()
        filters = [('count', 5),
                   ('filter', 'min_role:editor'),
                   ('filter', 'account_id:%d' % me['id']),
                   ('search', app_title)]
        apps = api.app_find(filters)
        if apps is None:
            return []

        data = []
        for app in apps:
            data.append({
                'id': app['id'],
                'name': app['name'],
                'config_url': api.app_config(app['id'])['config_url'],
            })
        return data
