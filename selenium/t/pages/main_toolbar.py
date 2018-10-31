from selene.api import s, by


class MainToolBar(object):

    @property
    def rsconnect_publish(self):
        return s(by.css("[title='Publish to RStudio Connect']"))

    @property
    def rsconnect_notification(self):
        return s(by.css("#notification_rsconnect"))
