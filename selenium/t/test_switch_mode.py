import pytest

from time import sleep
from selene.api import browser, be, have

from .pages.main_toolbar import MainToolBar
from .pages.publish_content_form import PublishContentForm


pytestmark = [
    pytest.mark.rsconnect_jupyter,
    pytest.mark.switch_mode,
]


class TestSwitchMode(object):
    @pytest.fixture(autouse=True)
    def setup(self, browser_config, jupyter_url, notebook, connect_url):
        """Navigate to the front page
        """

        self.notebook = notebook

        # navigate to the notebook
        browser.open_url(jupyter_url + notebook)

        MainToolBar().rsconnect_dropdown.click()
        MainToolBar().rsconnect_publish.click()

    def test_switch_mode(self, connect_url):
        """Publish a static document
        """
        pf = PublishContentForm()
        sleep(1)  # dialog is racy with event setup

        pf.title.set_value("NotebookSwitchMode2")
        pf.publish_without_source.click()
        pf.submit.click()
        pf.close.should(be.not_(be.visible))

        m = MainToolBar()
        notification = m.rsconnect_notification
        sleep(1)  # race
        notification.should(be.visible)
        notification.should(have.text("Successfully published content"))

        # republish
        sleep(1)  # clicking before waiting results in the event not being triggered
        m.rsconnect_dropdown.click()
        m.rsconnect_publish.click()
        sleep(1)  # racy dialog

        pf.publish_with_source.click()
        pf.submit.click()

        pf.title_error.should(have.text("Cannot change app mode once deployed"))
