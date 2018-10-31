from selene.api import s, by

from .form_base import FormBase

class ContentSelectionDialog:

    def __init__(self):
        self._locators = {
            "title": by.css(".modal-title"),
            "close": by.css(".modal-header .close"),
            "cancel": by.css(".modal-footer .btn[data-dismiss=modal]"),
            "submit": by.css(".modal-footer .btn-primary"),
            "new_location": by.css("#new-location"),
        }

    @property
    def title(self):
        return s(self._locators['title'])

    @property
    def close(self):
        return s(self._locators['close'])

    @property
    def cancel(self):
        return s(self._locators['cancel'])

    @property
    def submit(self):
        return s(self._locators['submit'])

    @property
    def new_location(self):
        return s(self._locators['new_location'])
