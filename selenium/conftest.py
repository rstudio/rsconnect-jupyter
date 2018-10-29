import argparse
import logging
import os
import pytest
import secrets
import selene
import selene.browser
import selene.config
import shutil
import string

from selene.api import be


# set the default selene reports folder
# to the present working directory
selene.config.reports_folder = os.getcwd()


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    # execute all other hooks to obtain the report object
    outcome = yield
    rep = outcome.get_result()

    # set a report attribute for each phase of a call, which can
    # be "setup", "call", "teardown"

    setattr(item, "rep_" + rep.when, rep)


class ReportsAction(argparse.Action):
    """Custom action to update Selene's reports_folder configuration option"""

    def __call__(self, parser, namespace, values, option_string=None):
        setattr(namespace, self.dest, values)
        selene.config.reports_folder = namespace.selene_reports


class TimeoutAction(argparse.Action):
    """Custom action to update Selene's timeout configuration option"""

    def __call__(self, parser, namespace, values, option_string=None):
        setattr(namespace, self.dest, values)
        selene.config.timeout = namespace.selene_timeout


def pytest_addoption(parser):
    """Define and parse command line options"""

    parser.addoption(
        "--selene-reports",
        action=ReportsAction,
        help="parent directory for storing selene test reports")

    parser.addoption(
        "--selene-timeout",
        action=TimeoutAction,
        default=4,
        type=int,
        help="set the default timeout in selene")

    parser.addoption(
        "--jupyter-url",
        action="store",
        default="http://jupyter-py2/",
        help="URI of the Jupyter system under test")

    parser.addoption(
        "--connect-url",
        action="store",
        default="http://mock-connect/",
        help="URI of the Connect server where content is deployed")

    parser.addoption(
        "--data-dir",
        action="store",
        default="/selenium/data",
        help="Directory where data files are stored")

    parser.addoption(
        "--notebooks-dir",
        action="store",
        default="/notebooks",
        help="Directory where Jupyter Notebooks are stored")


def log_web_error(msg):
    """Take a screenshot of a web browser based error

    Use this function to capture a screen shot of the web browser
    when using Python's `assert` keyword to perform assertions.
    """

    screenshot = selene.helpers.take_screenshot(selene.browser.driver(),)
    msg = '''{original_msg}
        screenshot: file://{screenshot}'''.format(original_msg=msg, screenshot=screenshot)
    return msg


@pytest.fixture(scope="session")
def jupyter_url(request):
    """Retrieve the url of the system under test
    """

    return request.config.getoption("--jupyter-url")


@pytest.fixture(scope="session")
def connect_url(request):
    """Retrieve the url of the Connect server where content is deployed
    """

    return request.config.getoption("--connect-url")


@pytest.fixture(scope="session")
def data_dir(request):
    """Retrieve the directory where data files, used in tests, are stored
    """

    return request.config.getoption("--data-dir")


@pytest.fixture(scope="session")
def notebooks_dir(request):
    """Retrieve the directory where notebooks for the Jupyer server are stored
    """

    return request.config.getoption("--notebooks-dir")


@pytest.fixture(scope="function")
def browser_config(driver):
    """Setup the core driver for the browser object

    The driver is managed by the pytest-selenium plugin, which handles
    setting up which browser to use, based on command line options.

    This fixture must stay function scoped because driver is function scoped.
    """

    # driver.set_window_size(1280,1024)
    driver.maximize_window()
    selene.browser.set_driver(driver)


@pytest.fixture(autouse=True)
def skip_by_browser(request, session_capabilities):
    if request.node.get_marker('skip_browser'):
        if request.node.get_marker('skip_browser').args[0] == session_capabilities['browserName']:
            pytest.skip('skipped on this browser: {}'.format(session_capabilities['browserName']))


def generate_random_string(length=8, charset="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()"):
    """Randomly pick chars from an alphabet
    """

    return ''.join(secrets.choice(charset) for i in range(length))


def generate_content_name():
    """Generate random application name
    """

    # start with a letter for safety

    alphabet1 = string.ascii_letters
    alphabet2 = string.ascii_letters + string.digits + '-_'

    name = generate_random_string(1,alphabet1) \
            + generate_random_string(10,alphabet2)

    return name


@pytest.fixture(scope="function")
def notebook(data_dir, notebooks_dir):
    """Create a new, never deployed notebook
    """

    # file that will be used to generate the new notebook
    template_path = os.path.join(data_dir,'spiro.ipynb')

    # name of the new notebook
    notebook_fname = generate_content_name() + '.ipynb'
    notebook_path = os.path.join(notebooks_dir, notebook_fname)

    # copy the template to create the new notebook
    shutil.copyfile(template_path, notebook_path)

    yield notebook_path

    # after test case has completed,
    # clean up the notebook file
    os.remove(notebook_path)
