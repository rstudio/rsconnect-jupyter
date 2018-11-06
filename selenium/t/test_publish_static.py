import pytest

from time import sleep
from selene.api import browser, be, have

from .pages.main_toolbar import MainToolBar
from .pages.add_server_form import AddServerForm
from .pages.publish_content_form import PublishContentForm

from conftest import generate_random_string


pytestmark = [ pytest.mark.rsconnect_jupyter,
               pytest.mark.publish_static,
             ]


class TestPublishStatic(object):

    @pytest.fixture(autouse=True)
    def setup(self, browser_config, jupyter_url, notebook, connect_url):
        """Navigate to the front page
        """

        self.notebook = notebook

        # navigate to the notebook
        browser.open_url(jupyter_url + notebook)

        MainToolBar().rsconnect_publish.click()


    def test_publish_static(self, connect_url):
        """Publish a static document
        """
        pf = PublishContentForm()
        pf.api_key.should(be.visible)
        # dialog is racy with event setup
        sleep(1)

        pf.api_key.set_value('0123456789abcdef0123456789abcdef')
        pf.title.set_value('NotebookStatic')
        pf.publish_without_source.click()
        pf.submit.click()

        m = MainToolBar()
        notification = m.rsconnect_notification
        notification.should(be.visible)
        notification.should(have.text('Successfully published content'))