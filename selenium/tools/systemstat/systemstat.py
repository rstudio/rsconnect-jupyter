import datetime
import logging
import sys
import time


class SystemStat(object):

    def __init__(self, sleep=1.0, wait=120, **kwargs):

        # instrumentation for testing
        self._iterations = 0

        self._sleep = sleep
        self._wait = wait

        self.logger = logging.getLogger(__name__)
        self.logger.info("initialization options")
        self.logger.info("sleep: {}".format(sleep))
        self.logger.info("wait: {}".format(wait))


    def wait_until_ready(self):
        """Poll and wait for system to be up

        Return boolean signalling if system came up within self.options.wait
        time.
        """

        try:
            # set the current time and the time when we should exit.
            nowTime = datetime.datetime.now()
            startTime = nowTime
            endTime = nowTime + datetime.timedelta(seconds=self._wait)

            self.logger.info('starting at {}'.format(startTime))
            self.logger.info('ending at {}'.format(endTime))

            while nowTime < endTime:

                self._iterations += 1
                if self.is_ready():
                    # stop polling, the system is accepting requests.
                    return True
                else:
                    # wait before polling again
                    self.logger.debug(
                        'sleeing for {} seconds'.format(self._sleep))
                    time.sleep(self._sleep)
                    nowTime = datetime.datetime.now()

            # timed out waiting for system to come up.
            self.logger.info('timed out waiting for system to come up')
            return False

        except Exception as e:
            self.logger.exception(e)
            raise


    def is_ready(self):
        """Check if the system is up.

        In a subclass, override this method with code that checks if the system
        is up and running. If the system is ready, the method should return
        True.  Otherwise, to continue waiting and polling, the method should
        return False.
        """

        return True
