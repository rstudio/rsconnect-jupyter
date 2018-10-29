from selene.api import s, by

from .form_base import FormBase

class AddServerForm(FormBase):

    def __init__(self):
        self._locators = {
            "close"    : by.css(".modal-content .close"),
            "address"  : by.css("#rsc-server"),
            "name"     : by.css("#rsc-servername"),
            "cancel"   : by.css(".modal-footer .btn:nth-of-type(1)"),
            "submit"   : by.css(".modal-footer .btn:nth-of-type(2)"),
        }

        self._fields = ['address', 'name']


    @property
    def close(self):
        return s(self._locators['close'])


    @property
    def address(self):
        return s(self._locators['address'])


    @property
    def name(self):
        return s(self._locators['name'])


    @property
    def cancel(self):
        return s(self._locators['cancel'])


    @property
    def submit(self):
        return s(self._locators['submit'])
