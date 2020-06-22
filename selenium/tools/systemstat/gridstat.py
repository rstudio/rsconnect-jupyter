import logging
import requests
import systemstat


class GridStat(systemstat.SystemStat):
    def __init__(self, url="http://localhost:4444", nodes=2, sleep=1.0, wait=30, **kwargs):
        super(GridStat, self).__init__(sleep=sleep, wait=wait, **kwargs)

        self._url = url
        self._nodes = nodes

        self.logger = logging.getLogger(__name__)

        self.logger.info("url: {}".format(url))
        self.logger.info("nodes: {}".format(nodes))

    def is_ready(self):
        """check if selenium grid is ready

        system ready means:
        1. accepting requests
        2. all nodes attached
        3. all nodes free
        """

        grid_api_hub_url = self._url + "/grid/api/hub"

        try:
            # query the selenium grid server to see if the nodes have attached.
            response = requests.get(grid_api_hub_url)
        except requests.exceptions.ConnectionError:
            self.logger.info("waiting for hub to respond at {}".format(grid_api_hub_url))
            # wait and poll again
            return False

        if response.ok:
            # hub is up
            self.logger.info("hub is up at {}".format(grid_api_hub_url))

            # check if nodes are attached
            slotCounts = response.json()["slotCounts"]

            self.logger.info("{} of {} nodes are attached".format(slotCounts["total"], self._nodes))

            if slotCounts["total"] == self._nodes:
                # nodes are attached
                self.logger.info("all nodes are attached")

                # check if nodes are ready
                self.logger.info("{} of {} nodes are ready".format(slotCounts["free"], self._nodes))

                if slotCounts["free"] == self._nodes:
                    # nodes are ready
                    self.logger.info("all nodes are ready")
                    return True

                else:
                    # nodes are not ready yet
                    self.logger.info("waiting on {} node(s) to be ready".format(self._nodes - slotCounts["free"]))

            else:
                # nodes are not attached yet
                self.logger.info("waiting on {} node(s) to attach".format(self._nodes - slotCounts["total"]))

        else:
            # response was not "ok", log error details
            self.logger.info(
                'hub responded at "{}" with error:\n{}\n{}\n{}'.format(
                    grid_api_hub_url, response.status_code, response.headers, response.text,
                )
            )

        # wait and poll again
        return False
