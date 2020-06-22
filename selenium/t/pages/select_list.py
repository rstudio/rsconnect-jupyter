from selene.support.conditions import have


class SelectList(object):
    def __init__(self, element):
        self._element = element

    def open(self):
        self._element.click()

    def _options(self):
        return self._element.all("option")

    def select_by_value(self, value):
        self._options().element_by(have.value(value)).click()

    def select_by_text(self, text):
        self._options().element_by(have.text(text)).click()

    def select_by_exact_text(self, text):
        self._options().element_by(have.exact_text(text)).click()

    def set(self, value):
        self.open()
        self.select_by_value(value)

    @property
    def selected(self):
        return self._element.s("[selected='selected']")
