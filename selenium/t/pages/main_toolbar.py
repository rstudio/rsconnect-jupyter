from selene.api import s, by


class MainToolBar(object):
    @property
    def rsconnect_dropdown(self):
        return s(by.css("[title='Publish to Posit Connect']"))

    @property
    def rsconnect_publish(self):
        return s(by.css("#publish-to-connect"))

    @property
    def rsconnect_manifest(self):
        return s(by.css("#create-manifest"))

    @property
    def rsconnect_notification(self):
        return s(by.css("#notification_rsconnect_jupyter"))
