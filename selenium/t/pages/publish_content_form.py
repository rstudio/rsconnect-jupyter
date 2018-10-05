from selene.api import s, by

from .form_base import FormBase

class PublishContentForm(FormBase):

    def __init__(self):
        self._locators = {
            "close"         : by.css(".modal-content .close"),
            "add_server"    : by.css("#rsc-add-server"),
            "cancel"   : by.css(".modal-footer .btn:nth-of-type(1)"),
            "submit"   : by.css(".modal-footer .btn:nth-of-type(2)"),
        }

        self._fields = ['address', 'name']


    @property
    def close(self):
        return s(self._locators['close'])


    @property
    def add_server(self):
        return s(self._locators['add_server'])


    @property
    def cancel(self):
        return s(self._locators['cancel'])


    @property
    def submit(self):
        return s(self._locators['submit'])
