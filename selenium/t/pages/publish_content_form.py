from selene.api import s, by

from .form_base import FormBase

class PublishContentForm(FormBase):

    def __init__(self):
        self._fields = ['address', 'name']

    @property
    def close(self):
        return s(by.css(".modal-header .close"))

    @property
    def add_server(self):
        return s(by.css("#rsc-add-server"))

    @property
    def cancel(self):
        return s(by.css(".modal-footer .btn[data-dismiss=modal]"))

    @property
    def submit(self):
        return s(by.css(".modal-footer .btn-primary"))

    @property
    def publish_without_source(self):
        return s(by.css("#rsc-publish-without-source"))

    @property
    def publish_with_source(self):
        return s(by.css("#rsc-publish-with-source"))

    @property
    def title(self):
        return s(by.css('#rsc-content-title'))

    @property
    def title_error(self):
        return s(by.css('#rsc-deploy-error'))
