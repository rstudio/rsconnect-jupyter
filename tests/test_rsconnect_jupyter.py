import logging

import rsconnect_jupyter

import pytest


class FakeNbApp(object):
    def __init__(self):
        self.handlers = {}
        self.log = logging.getLogger(__name__)
        self.settings = {"base_url": "http://nb-app.example.org"}

    @property
    def web_app(self):
        return self

    def add_handlers(self, host_pattern, handlers):
        self.handlers[host_pattern] = handlers


@pytest.fixture
def fake_nb_app():
    return FakeNbApp()


def test_has_jupyter_extension_funcs():
    assert rsconnect_jupyter._jupyter_server_extension_paths() is not None
    assert rsconnect_jupyter._jupyter_nbextension_paths() is not None


def test_load_jupyter_server_extension(fake_nb_app):
    assert len(fake_nb_app.handlers) == 0
    assert rsconnect_jupyter.load_jupyter_server_extension(fake_nb_app) is None
    assert len(fake_nb_app.handlers) == 1
    assert fake_nb_app.handlers.get(".*$") is not None
    host_handlers = fake_nb_app.handlers[".*$"]
    assert len(host_handlers) == 1
    route_pattern, handler = host_handlers[0]
    assert route_pattern == "http://nb-app.example.org/rsconnect_jupyter/(?P<action>\\w+)"
    assert handler.__name__ == "EndpointHandler"
