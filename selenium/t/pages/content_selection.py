from selene.api import s, by

from .form_base import FormBase

class ContentSelectionDialog:

    @property
    def title(self):
        return s(by.css(".modal-title"))

    @property
    def close(self):
        return s(by.css(".modal-header .close"))

    @property
    def cancel(self):
        return s(by.css(".modal-footer .btn[data-dismiss=modal]"))

    @property
    def submit(self):
        return s(by.css(".modal-footer .btn-primary"))

    @property
    def new_location(self):
        return s(by.css("#new-location"))
