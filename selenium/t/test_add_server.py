import pytest

from selene.api import browser, be

from .pages.main_toolbar import MainToolBar
from .pages.add_server_form import AddServerForm
from .pages.publish_content_form import PublishContentForm

from conftest import generate_random_string


pytestmark = [ pytest.mark.rsconnet_jupyter,
               pytest.mark.add_server,
             ]


class TestAddServer(object):

    @pytest.fixture(autouse=True)
    def setup(self, browser_config, jupyter_url, notebook):
        """Navigate to the front page
        """

        self.notebook = notebook

        # navigate to the notebook
        browser.open_url(jupyter_url + notebook)

        MainToolBar(). \
            rsconnect_publish.click()


    def test_valid_address_valid_name(self, connect_url):
        """Fill in the add server form with valid address and name
        """

        server_name = generate_random_string()

        AddServerForm() \
            .populate_form({
                'address'   : connect_url,
                'name'      : server_name,
            }) \
            .submit_form()

        PublishContentForm() \
            .add_server.should(be.visible)
