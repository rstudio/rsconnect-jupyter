import pytest

from time import sleep
from selene.api import browser, be, have

from .pages.main_toolbar import MainToolBar
from .pages.publish_content_form import PublishContentForm
from .pages.content_selection import ContentSelectionDialog


pytestmark = [
    pytest.mark.rsconnect_jupyter,
    pytest.mark.publish_static,
]


class TestRepublish(object):
    @pytest.fixture(autouse=True)
    def setup(self, browser_config, jupyter_url, notebook, connect_url):
        """Navigate to the front page
        """

        self.notebook = notebook

        # navigate to the notebook
        browser.open_url(jupyter_url + notebook)

        MainToolBar().rsconnect_dropdown.click()
        MainToolBar().rsconnect_publish.click()

    def test_republish(self, connect_url):
        """Publish a static document
        """
        pf = PublishContentForm()
        sleep(1)  # dialog is racy with event setup

        pf.title.set_value("NotebookRepublish")
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

        pf.title.set_value("")
        pf.title.set_value("Notebook")
        pf.publish_without_source.click()
        pf.submit.click()
        pf.close.should(be.not_(be.visible))

        cs = ContentSelectionDialog()
        cs.title.should(be.visible)
        cs.title.should(have.text("Select deployment location"))

        cs.new_location.should(be.visible)
        cs.new_location.click()
        cs.submit.click()
        cs.close.should(be.not_(be.visible))

        m.rsconnect_notification.should(be.visible)
        m.rsconnect_notification.should(have.text("Successfully published content"))
