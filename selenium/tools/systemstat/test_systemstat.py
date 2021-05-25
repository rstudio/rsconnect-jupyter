from argparse import Namespace
import pytest
from systemstattool import SystemStatTool

pytestmark = [
    pytest.mark.systemstat,
]


# default arguments from SystemStatTool
systemStatToolArgs = Namespace(
    sleep=1.0, wait=2.0, logfile="systemstat.log", logformat="%(asctime)s %(message)s", verbose=3, stdout=False
)


class TestSystemStatTool(object):
    def test_default_command_fxn(self):
        """with default is_ready() method, wait_until_ready() still works."""

        # create a test tool based off the systemstat class
        tool = SystemStatTool()

        # parse command line and config file options
        tool.parse_options()

        # start logging
        tool.start_logging()

        # run using the default is_ready() function
        system_ready = tool.wait_until_ready()

        # wait_until_ready should successfully exit after 1 iteration
        assert system_ready is True
        assert tool._iterations == 1

    def test_system_up_no_waiting(self):
        """if is_ready() returns True, wait_until_ready() doesn't wait."""

        class MySystemStatTool(SystemStatTool):
            def __init__(self):
                super(MySystemStatTool, self).__init__()

                # parse command line and config file options
                self.parse_options()

                # start logging
                self.start_logging()

            def is_ready(self):

                return True

        # create a test tool based off the MySystemStatTool class
        tool = MySystemStatTool()

        # system is up, no need to wait
        system_ready = tool.wait_until_ready()

        # wait_until_ready should successfully exit after 1 iteration
        assert system_ready is True
        assert tool._iterations == 1

    def test_delay_systemup(self):
        """wait_until_ready() waits and polls while system is down."""

        class MySystemStatTool(SystemStatTool):
            def __init__(self):
                super(MySystemStatTool, self).__init__()

                # parse command line and config file options
                self.parse_options()

                # start logging
                self.start_logging()

                # track the number of entries
                self.counter = 0

            def is_ready(self):

                self.counter += 1

                # after the 4th entry, signal that the system is up.
                if self.counter > 3:
                    return True
                else:
                    return False

        # create a test tool based off the MySystemStatTool class
        tool = MySystemStatTool()

        # wait for delayed system up
        system_ready = tool.wait_until_ready()

        # wait_until_ready should successfully exit after 4 iteration
        assert system_ready is True
        assert tool._iterations == 4

    def test_wait_timeout(self):
        """if wait_until_ready never returns True, then timeout."""

        class MySystemStatTool(SystemStatTool):
            def __init__(self):
                super(MySystemStatTool, self).__init__()

                # parse command line and config file options
                # set the wait time to 4 seconds
                self.parse_options(["--wait", "4"], systemStatToolArgs)

                # start logging
                self.start_logging()

                # track the number of entries
                self.counter = 0

            def is_ready(self):

                # keep returning False until we timeout
                return False

        # create a test tool based off the MySystemStatTool class
        tool = MySystemStatTool()

        # run using the default command() function
        system_ready = tool.wait_until_ready()

        # wait_until_ready should unsuccessfully exit after 4 iterations
        # 4 second wait time / 1 second sleep = 4 iterations
        assert system_ready is False
        assert tool._iterations == 4

    def test_sleep_affects_iterations(self):
        """sleeping longer means fewer iterations."""

        class MySystemStatTool(SystemStatTool):
            def __init__(self):
                super(MySystemStatTool, self).__init__()

                # parse command line and config file options
                # set the wait time to 4 seconds
                self.parse_options(["--wait", "4", "--sleep", "2"], systemStatToolArgs)

                # start logging
                self.start_logging()

                # track the number of entries
                self.counter = 0

            def is_ready(self):

                # keep returning False until we timeout
                return False

        # create a test tool based off the MySystemStatTool class
        tool = MySystemStatTool()

        # wait for timeout
        system_ready = tool.wait_until_ready()

        # wait_until_ready should unsuccessfully exit after 2 iterations
        # 4 second wait time / 2 second sleep = 2 iterations
        assert system_ready is False
        assert tool._iterations == 2
