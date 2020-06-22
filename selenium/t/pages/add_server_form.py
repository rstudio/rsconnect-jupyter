from selene.api import s, by

from .form_base import FormBase


class AddServerForm(FormBase):
    def __init__(self):
        self._fields = ["address", "api_key", "name"]

    @property
    def close(self):
        return s(by.css(".modal-content .close"))

    @property
    def address(self):
        return s(by.css("#rsc-server"))

    @property
    def api_key(self):
        return s(by.css("#rsc-api-key"))

    @property
    def name(self):
        return s(by.css("#rsc-servername"))

    @property
    def cancel(self):
        return s(by.css(".modal-footer .btn[data-dismiss=modal]"))

    @property
    def submit(self):
        return s(by.css(".modal-footer .btn-primary"))
