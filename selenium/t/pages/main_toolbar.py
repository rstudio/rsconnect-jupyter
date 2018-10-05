from selene.api import s, by


class MainToolBar(object):

    def __init__(self):
        self._locators = {
            "rsconnect_publish"   : by.css("[title='Publish to RStudio Connect']"),
        }


    @property
    def rsconnect_publish(self):

        return s(self._locators['rsconnect_publish'])

