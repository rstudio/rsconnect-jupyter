# Selenium Tests

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

# run all of the test
make test

# run a single test multiple times
make test PYTESTOPTS="t/test_login.py::TestLogin::test_local_login_success"
make test PYTESTOPTS="t/test_login.py::TestLogin::test_local_login_success"
make test PYTESTOPTS="t/test_login.py::TestLogin::test_local_login_success"

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
like mail servers, LDAP servers, and databases.

With the support containers launched, test cases can be run by using the `test`
Makefile target. The `test` target launches a separate Docker container that
hosts a Connect server which test cases are run against. The container
communicates with the other support containers over a virtual Docker network.
Attributes of the `test` target  can be tuned by setting a number of
environment and Makefile variables. The most often used of these variables is
`PYTESTOPTS`, used to set flags for the `pytest` test runner, like filtering
the test cases to be run. A list of all available variables is shown in the
next section. Test cases can be run multiple times against the same support and
Connect containers. This is helpful when trying to write or debug test cases
during the development cycle, where the developer may need to rerun tests
multiple times without the cost of launching the tearing down the test
environment.

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
make test PYTESTOPTS="t/test_login.py"

# test a class within a file
make test PYTESTOPTS="t/test_login.py::TestLogin"

# test a specific test within a class of a specific file
make test PYTESTOPTS="t/test_login.py::TestLogin::test_local_login_success"
```

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
make test PYTESTOPTS="t/test_login.py" BROWSER=firefox
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
make run COMMAND=python3
```

From the Python3 interpreter, Python commands can be executed to open a web
browser and navigate it to the Connect server:

```python
# import the Selenium library to automate the web browser
from selenium import webdriver

# import the Selene library to help simplify browser automation
# Selene uses the Selenium library
from selene.api import browser, s, ss, be, have

# set the url of the Connect server
url = 'http://solo.rstudiopm.com'

# launch the web browser
driver = webdriver.Remote("http://selenium-hub:4444/wd/hub", webdriver.DesiredCapabilities.FIREFOX.copy())

# associate the WebDriber object with the Selene library
browser.set_driver(driver)

# navigate the web browser to the Connect front page
browser.open_url(url)

# load functions from conftest
from conftest import user_api_by_password

# load page objects
from t.pages.login_local import LoginLocal
from t.pages.alert_message import AlertMessage

# navigate the web browser to the login page
login_url = url + '/connect/#/login'
browser.open_url(login_url)

# interact with the login panel on the login page
login_panel = LoginLocal()
login_panel.populate_form({ 'username':'admin', 'password':'password' })
login_panel.login.click()

# check that the alert message is not shown
msg = AlertMessage()
msg.message.should_not(be.visible)

# use the Selene library directly to interact with the web page
header_menu_people_link = s('[data-automation-header-menu-people]')
header_menu_people_link.click()

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
    --name=rsc-ui-tests-${HOURMINSEC} \
    --network=$(NETWORK) \
    --volume=${CURDIR}/../..:${CONNECT_DIR} \
    --user=`id -u`:`id -g` \
    --workdir=${CONNECT_DIR}/test/selenium \
    -e PYTHONPATH="${CONNECT_DIR}/test" \
    ${SELENIUM_IMAGE}
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

##### NETWORK

Full name of the virtual Docker network, based on PROJECT variable

Default Value: `${PROJECT}_default`

Example usage:
```
make test-env-up NETWORK=rscnet2_default
```

##### PROJECT

Name used as the base of the virtual Docker network

Default Value: `rscnet2`

Example usage:
```
make test-env-up PROJECT=rscnet2
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

##### PYTESTOPTS

Flags and filters to pass to the test runner program. These flags can change
the behavior of the test runner program by helping to determine which test
cases to run, what to do when a test case fails, or by injecting data into the
test runner.

Default Value: ""

Example usage:
```
make test PYTESTOPTS="loginflow/test_loginflow.py::LoginFlow::test_good_login"
make test PYTESTOPTS="loginflow/test_loginflow.py::LoginFlow::test_good_login"
make test PYTESTOPTS="-k test_good_login -xv"
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
    --bundles-dir=${CONNECT_BUNDLES} \
    --url=${URL} \
    --verbose \
    ${PYTESTOPTS} \
    .
```

Example usage:
```
make test TEST_RUNNER_COMMAND="pytest"
```

##### URL

Full url of the System Under Test, combined host and port. Instead of setting
this variable, set `${SUT_HOST}` and `${SUT_PORT}`.

Default Value: `http://${SUT_HOST}:${SUT_PORT}`

Example usage:
```
make test URL=http://solo.rstudiopm.com:80
```
