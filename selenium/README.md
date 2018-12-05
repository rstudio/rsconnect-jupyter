# Selenium Tests

## Getting Started

You'll need the following commands available on your system to run the test cases:
  * bash
  * coreutils (id, rm, cd, cat, printf, ...)
  * docker
  * docker-compose
  * git
  * make
  * python 2.7+
  * vncviewer (macosx users can launch vnc from spotlight, or the ```open```
    command in the terminal)

Make sure you also have a copy of the this repository. You can get a copy by
executing the following commands in your terminal.

```
cd ${REPOBASE};
git clone https://github.com/rstudio/rsconnect-jupyter.git rsconnect-jupyter;
cd rsconnect-jupyter;
```

Where ```${REPOBASE}``` is the directory where you download repositories to.


## Build the Mock Connect Server

Use the Makefile's `build` target to build the mock connect server Docker
image:

```
make build
```


## Running the Tests

The Selenium based tests in this directory use web browsers provided by
Selenium Grid Docker containers. These Docker containers can be launched and
torn down, separate from running the tests, by using the `test-env-up` and
`test-env-down` local Makefile targets.

A typical workflow for running tests may look like this:

```
# launch the Selenium Grid containers once
# at the beginning of the testing session
make test-env-up

# launch the Jupyter Server
make jupyter-up

# run all of the test
make test

# run a single test multiple times
make test PYTESTOPTS="t/test_add_server.py::TestAddServer::test_valid_address_valid_name"
make test PYTESTOPTS="t/test_add_server.py::TestAddServer::test_valid_address_valid_name"
make test PYTESTOPTS="t/test_add_server.py::TestAddServer::test_valid_address_valid_name"

# tear down the Jupyter Server
make jupyter-down

# tear down the Selenium Grid containers
# at the end of the testing session
make test-env-down
```

In this example workflow, we launch the Selenium Grid containers, which host
the Firefox and Chrome web browsers, once at the beginning of the testing
session by using the `test-env-up` Makefile target. The `test-env-up` target is
responsible for launching all Docker containers that make up the testing
environment. That includes the web browser containers from the Selenium Grid
along with any other support containers that may be needed to run the tests
like mail servers, LDAP servers, and databases. This target also brings up the
mock Connect server, which replicates many of the APIs the Jupyter plugin tries
to communicate with.

Next, the `jupyter-up` target is used to launch the Jupyter server, with the
rsconnect-jupyter plugin installed. The server runs in a Docker container, on
the same Docker network as the Selenium Grid and mock Connect containers, under
the name `jupyter-pyX` where `X` represents the version of Python being used.

With the support containers launched, test cases can be run by using the `test`
Makefile target. The `test` target launches a Docker container, on the same
virtual Docker network as the Selenium Grid and support containers, and hosts
the `pytest` test runner.  Behavior of the `test` target  can be tuned by
setting a number of environment and Makefile variables. The most often used of
these variables is `PYTESTOPTS`, used to set flags for the `pytest` test
runner, like filtering the test cases to be run. A list of all available
variables is shown in the next section. Test cases can be run multiple times
against the same support and Connect containers. This is helpful when trying to
write or debug test cases during the development cycle, where the developer may
need to rerun tests multiple times without the cost of launching the tearing
down the test environment.

When the testing session has finished, the support containers can be torn down
by using the `test-env-down` Makefile target. This target is responsible for
shutting down all of the Docker containers that were launched with the
`test-env-up` target.


### Test Runner Flags

Under the hood, the Makefile's `test` target uses `pytest` as the test runner.
You can pass custom `pytest` flags via `PYTESTOPTS`. Here we are passing `-v`
which enables verbosity and `-x` which enables fast fail.

```
make test PYTESTOPTS="-xv"
```

If you want to test a specific feature, you can also use the `PYTESTOPTS`
Makefile variable to select a collection of tests.

```
# test a directory
make test PYTESTOPTS="t"

# test a specific file
make test PYTESTOPTS="t/test_add_server.py"

# test a class within a file
make test PYTESTOPTS="t/test_add_server.py::TestAddServer"

# test a specific test within a class of a specific file
make test PYTESTOPTS="t/test_add_server.py::TestAddServer::test_valid_address_valid_name"
```

##### Common pytest flags

You can find an exhaustive list of pytest flags in the [pytest
documentation](https://docs.pytest.org/en/latest/usage.html). In the table
below are listed the handful of pytest flags that pop up frequently in daily
use for configuring how and which test cases are executed.


| Flag | Description | Example | Link |
|------|-------------|---------|------|
| -x   | Stop execution after the first (or N) failures | `PYTESTOPTS="-x"` | [Learn more](https://docs.pytest.org/en/latest/usage.html#stopping-after-the-first-or-n-failures) |
| -k expression  | Run tests by keyword expressions | `PYTESTOPTS="-k ClassName and not (method1 or method2)"` | [Learn more](https://docs.pytest.org/en/latest/usage.html#specifying-tests-selecting-tests) |
| -m expression  | Run tests by marker expressions, markers are set as `@pytest.mark.marker1` or `@pytest.mark.marker2` | `PYTESTOPTS="-m marker1 or marker2"` | [Learn more](https://docs.pytest.org/en/latest/usage.html#specifying-tests-selecting-tests) |
| --pdb | Drop into PDB (Python Debugger) on failures | `PYTESTOPTS="--pdb"` | [Learn more](https://docs.pytest.org/en/latest/usage.html#dropping-to-pdb-python-debugger-on-failures) |
| --count=10 | Repeat each test case 10 times | `PYTESTOPTS="--count=10"` | [Learn more](https://pypi.org/project/pytest-repeat/) |
| --durations=0 | Profile test case execution. Print the time duration of each test case. | `PYTESTOPTS="--durations=0"` | [Learn more](https://docs.pytest.org/en/latest/usage.html#profiling-test-execution-duration) |
| --rerun=4 | Rerun test case failures a maximum of 4 additional times, waiting for success | `PYTESTOPTS="--rerun=4"` | [Learn more](https://github.com/pytest-dev/pytest-rerunfailures) |
| --test-group-count=10 | Specify the number of test groups. Must be used with `--test-group` flag. Primarily used for running test cases in parallel on different Jenkins nodes. | `PYTESTOPTS="--test-group-count=10"` | [Learn more](https://pypi.org/project/pytest-test-groups/) |
| --test-group=2 | Specify which group of tests to execute. Must be used with `--test-group-count`. Primarily used for running test cases in parallel on different Jenkins nodes. | `PYTESTOPTS="--test-group=2"` | [Learn more](https://pypi.org/project/pytest-test-groups/) |
| --test-group-random-seed=12345 | Randomize the grouping of test cases. Must be used with `--test-group-count` and `--test-group` flags. Primarily used for running test cases in parallel on different Jenkins nodes. | `PYTESTOPTS="--test-group-count=10 --test-group=2 --test-group-random-seed=12345"` | [Learn more](https://pypi.org/project/pytest-test-groups/) |

Although it is not a pytest command line flag, when placed inside a test case,
`import pdb; pdb.set_trace()` sets a Python Debugger breakpoint within the test
case. When the Python interpreter reaches this breakpoint, it will drop into
the Python Debugger and allow you to interactively step through the test case
code and print the values of variables. You can learn more about its use in the
[Setting
breakpoints](https://docs.pytest.org/en/latest/usage.html#setting-breakpoints)
section of the [pytest
documentation](https://docs.pytest.org/en/latest/usage.html)


### Testing by browser

You can use the `BROWSER` Makefile variable to set the web browser used in the
test run.  By default, we test against the Firefox web browser by setting
`BROWSER=firefox`. Valid option for the `BROWSER` variable are `firefox` and
`chrome`.

This feature can be combined with the any of the other test running techniques
discussed previously.

#### Test everything, using the Chrome web browser

```bash
make test BROWSER=chrome
```

#### Test a single module, using the Firefox web browser

```bash
make test PYTESTOPTS="t/test_add_server.py" BROWSER=firefox
```

## Using a debug container

The Makefile includes a `run` target that can be used to launch a Docker
container running on the same Docker network as the Selenium Grid and the
Connect server. Enter the debug container with the command:

```bash
make run
```

The default command for the debug container is `bash`, but this can be changed
by setting the `COMMAND` Makefile variable. Another common command is to start
a Python3 interpreter:

```bash
make run COMMAND=ipython3
```

From the Python3 interpreter, Python commands can be executed to open a web
browser and navigate it to the Connect server:

```python
# import the Selenium library to automate the web browser
from selenium import webdriver

# import the Selene library to help simplify browser automation
# Selene uses the Selenium library
from selene.api import browser, s, ss, be, have, by

# set the url of the Connect server
url = 'http://jupyter-py2:9999'

# launch the web browser
driver = webdriver.Remote("http://selenium-hub:4444/wd/hub", webdriver.DesiredCapabilities.FIREFOX.copy())

# associate the WebDriber object with the Selene library
browser.set_driver(driver)

# navigate the web browser to the Connect front page
browser.open_url(url)

# load functions from conftest
from conftest import generate_content_name, generate_random_string

# load page objects
from t.pages.add_server_form import AddServerForm
from t.pages.main_toolbar import MainToolBar
from t.pages.publish_content_form import PublishContentForm


# set the directory paths for where data files and jupyter notebooks
data_dir = "/rsconnect_jupyter/selenium/data"
notebooks_dir = "/notebooks"

# copy the template notbook to a new notebooks directory
import os, shutil
template_path = os.path.join(data_dir,'spiro.ipynb')
notebook_fname = generate_content_name() + '.ipynb'
notebook_path = os.path.join(notebooks_dir, notebook_fname)
shutil.copyfile(template_path, notebook_path)

# navigate the web browser to the notebook
notebook_url = url + notebook_path
browser.open_url(notebook_url)

# click the rsconnect publish button
MainToolBar().rsconnect_publish.click()

# populate the form with a server name and url
connect_url = 'http://mock-connect:5000'
server_name = generate_random_string()
server_form = AddServerForm()
server_form.address.set(connect_url)
server_form.name.set(server_name)
server_form.submit.click()

# check that the publish content form is visible
publish_form = PublishContentForm()
publish_form.add_server.should(be.visible)

# clean up temporary notebook
os.remove(notebook_path)

# close the web browser
browser.quit()
```

## Tuning the Test Environment

A number of environment and Makefile variables are available to tune the test
environment. Adjusting these variables change things like the types and number
of web browsers available for testing, the hostname and port of the Selenium
Grid, and the options accepted by the test runner program.

##### BROWSER

Specify the web browser to use for testing, `chrome` or `firefox`.

Default Value: "firefox"

Example usage:
```
make test BROWSER=firefox
```

##### COMMAND

Command to run inside of the debug container started with the `make run`
command.

Default Value: `bash`

Example usage:
```
make run COMMAND=python3
```

##### CONNECT_HOST

Name of the Docker container hosting the mock Connect server.

Default Value: `mock-connect`

Example usage:
```
make test GRID_HOST=mock-connect
```

##### CONNECT_LOG

Name of the log file for the mock connect server running in a Docker container.

Default Value: `mock-connect.log`

Example usage:
```
make test CONNECT_LOG=mock-connect.log
```

##### CONNECT_PORT

Port number of the mock-connect server running in a Docker container.

Default Value: 5000

Example usage:
```
make test CONNECT_PORT=5000
```

##### CONNECT_SCHEME

URI Scheme of the mock-connect server running in a Docker container.

Default Value: `http`

Example usage:
```
make test CONNECT_SCHEME=http
```

##### DCYML_GRID

File path of the Selenium Grid Docker Compile YAML config file.

Default Value: `./docker/grid/docker-compose.yml`

Example usage:
```
make test-env-up DCYML_GRID=./docker/grid/docker-compose.yml
```

##### DEBUG

Setup the test environment for debugging tests. For example, disable
GRID_TIMEOUT by setting it to 0. See below for details on GRID_TIMEOUT.

Default Value: 0

Example usage
```
DEBUG=1 make test-env-up
```

##### DOCKER_RUN_COMMAND

Command to launch a Docker container for both `make test` and `make run`
commands. This variable does not include the command that will run inside of
the Docker container. In most cases you will not need to change this variable.

Default Value:
```
DOCKER_RUN_COMMAND=docker run -it --rm --init \
    --name=tre-${HOURMINSEC} \
    --network=$(NETWORK) \
    --volume=$(CURDIR)/..:${RSCONNECT_DIR} \
    --volume=$(CURDIR)/../notebooks$(PY_VERSION):${NOTEBOOKS_DIR} \
    --user=`id -u`:`id -g` \
    --workdir=${RSCONNECT_DIR}/selenium \
    ${TRE_IMAGE}
```

Example usage:
Not meant to be changed

##### GRID_HOST

Name of the Docker container hosting the Selenium Grid hub.

Default Value: `selenium-hub`

Example usage:
```
make test GRID_HOST=selenium-hub
```

##### GRID_PORT

Port number of the Docker container hosting the Selenium Grid hub.

Default Value: 4444

Example usage:
```
make test GRID_PORT=4444
```

##### GRID_SCHEME

URI Scheme of the Docker container hosting the Selenium Grid hub.

Default Value: `http`

Example usage:
```
make test GRID_SCHEME=http
```

##### GRID_TIMEOUT

Number of milliseconds the Selenium Grid Hub should wait before automatically
closing a web browser due to inactivity. This value is also set by the DEBUG
variable.

Default Value: 30000

Example usage:
```
make test-env-up GRID_TIMEOUT=30000
```

##### HOURMINSEC

Timestamp used as a part of a Docker container name.

Default Value: `date +'%H%M%S'`

Example usage:
```
make run HOURMINSEC=`date +'%y%m%d-%H%M%S'`
```

##### JUPYTER_HOST

Name of the Docker container hosting the Jupyter server.

Default Value: `jupyter-py${PY_VERSION}`

Example usage:
```
make test JUPYTER_HOST=jupyter-py2
```

##### JUPYTER_LOG

Name of the log file for the Jupyter server running in a Docker container.

Default Value: `jupyter-py${PY_VERSION}.log`

Example usage:
```
make test JUPYTER_LOG=jupyter-py2.log
```

##### JUPYTER_PORT

Port number of the Jupyter server running in a Docker container.

Default Value: 9999

Example usage:
```
make test JUPYTER_PORT=9999
```

##### JUPYTER_SCHEME

URI Scheme of the Jupyter server running in a Docker container.

Default Value: `http`

Example usage:
```
make test JUPYTER_SCHEME=http
```

##### LOGS_DIR

Directory where log files from systemstat are stored.

Default Value: `${RSCONNECT_DIR}/selenium`

Example usage:
```
make test LOGS_DIR=/rsconnect_jupyter/selenium
```

##### NB_UID

UID sent to the Jupyter container when launching the Jupyter server.

Default Value: `$(shell id -u)`

Example usage:
```
make jupyter-up NB_UID=$(shell id -u)
```

##### NB_GID

GID sent to the Jupyter container when launching the Jupyter server.

Default Value: `$(shell id -g)`

Example usage:
```
make jupyter-up NB_GID=$(shell id -g)
```

##### NETWORK

Full name of the virtual Docker network, based on PROJECT variable

Default Value: `${PROJECT}_default`

Example usage:
```
make test-env-up NETWORK=rscnet2_default
```

##### NOTEBOOKS_DIR

Directory path where the Jupyter server will read notebooks from. Root
directory of the Jupyter server

Default Value: `/notebooks`

Example usage:
```
make jupyter-up NOTEBOOKS_DIR=/notebooks
make test NOTEBOOKS_DIR=/notebooks
```

##### PROJECT

Name used as the base of the virtual Docker network

Default Value: `rscnet2`

Example usage:
```
make test-env-up PROJECT=rscnet2
```

##### PY_VERSION

Version of Python to use when launching the Jupyter server. Valid version include 2, 3.6, 3.7

Default Value: `2`

Example usage:
```
make jupyter-up PY_VERSION=2
make test PY_VERSION=2
```

##### PYTESTLOG

Name of the file to store pytest stdout into.

Default Value: `selenium_tests.log`

Example usage:
```
make test PYTESTLOG=selenium_tests.log
```

##### PYTESTOPTS

Flags and filters to pass to the test runner program. These flags can change
the behavior of the test runner program by helping to determine which test
cases to run, what to do when a test case fails, or by injecting data into the
test runner.

Default Value: ""

Example usage:
```
make test PYTESTOPTS="t/test_add_server.py::TestAddServer::test_valid_address_valid_name"
make test PYTESTOPTS="t/test_add_server.py::TestAddServer::test_valid_address_valid_name"
make test PYTESTOPTS="-k test_valid_address_valid_name -xv"
```

##### RERUN_FAILURES

Number of times to try rerunning a test failure. When a test failure occurs,
this value tells the test runner how many times to rerun the test in an attempt
to get a successful run. If all rerun attempts fail, the test will show up as
failed in the results. If one attempt passes, the failed attempts will show up
in the test results as reruns, but the results will show that the test passed.
This variable accepts zero and positive integers. Setting this value may hide
flaky test failures.

Default Value: 0

Example usage:
```
make test RERUN_FAILURES=4
```

##### RESULT_XML

Name of the file holding pytest's junit style xml results.

Default Value:`result.xml`

Example usage:
```
make test RESULT_XML=result.xml
```

##### RSCONNECT_DIR

Name of the directory that the rsconnect_jupyter directory, on the host
machine, will be mounted to, in the Docker container.

Default Value:`/rsconnect_jupyter`

Example usage:
```
make test-env-up RSCONNECT_DIR=/rsconnect_jupyter
make jupyter-up RSCONNECT_DIR=/rsconnect_jupyter
make test RSCONNECT_DIR=/rsconnect_jupyter
```

##### SCALE

Number of Firefox and Chrome web browsers to launch

Default Value: 1

Example usage:
```
make test-env-up SCALE=1
```

##### SCALE_CHROME

Number of Chrome web browsers to launch, does not affect Firefox web browsers

Default Value: `${SCALE}`

Example usage:
```
make test-env-up SCALE_CHROME=2
```

##### SCALE_FIREFOX

Number of Firefox web browsers to launch, does not affect Chrome web browsers

Default Value: `${SCALE}`

Example usage:
```
make test-env-up SCALE_FIREFOX=2
```

##### SELENIUM_VERSION

Version of the Selenium Grid Docker images

Default Value: `3.8.1-dubnium`

Example usage:
```
make test-env-up SELENIUM_VERSION=3.8.1-dubnium
```

##### TEST_RUNNER_COMMAND

Command to launch the test runner program.

Default Value:
```
pytest \
    --junitxml=${RESULT_XML} \
    --driver=Remote \
    --host=${GRID_HOST} \
    --port=${GRID_PORT} \
    --capability browserName ${BROWSER} \
    --jupyter-url='${JUPYTER_SCHEME}://${JUPYTER_HOST}:${JUPYTER_PORT}' \
    --connect-url='${CONNECT_SCHEME}://${CONNECT_HOST}:${CONNECT_PORT}' \
    --data-dir=${RSCONNECT_DIR}/selenium/data \
    --notebooks-dir=${NOTEBOOKS_DIR} \
    --verbose \
    --tb=short \
    --reruns=${RERUN_FAILURES} \
    -m "not (fail or systemstat)" \
    ${PYTESTOPTS}
```

Example usage:
```
make test TEST_RUNNER_COMMAND="pytest"
```

##### TMP_PIPE

Name of the temporary pipe file used to capture stdout from pytest.
Do not change.

Default Value: `tmp.pipe`

Example usage:
```
make test TMP_PIPE=tmp.pipe
```

##### TRE_IMAGE

Name of the Docker image to use as the Test Runner Environment container. This
is the Docker container where the test runner, `pytest`, is executed.

Default Value: `rstudio/checkrs-tew:0.1.0`

Example usage:
```
make test TRE_IMAGE=rstudio/checkrs-tew:0.1.0
```

##### TRE_IMAGE

Name of the Docker image to use as the Test Runner Environment container. This
is the Docker container where the test runner, `pytest`, is executed.

Default Value: `rstudio/checkrs-tew:0.1.0`

Example usage:
```
make test TRE_IMAGE=rstudio/checkrs-tew:0.1.0
```
