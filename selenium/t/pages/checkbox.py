class Checkbox(object):

    def __init__(self, element):

        # type: (SeleneElement) -> None
        self._element = element


    def set(self, value):

        if self._element.is_selected() is not value:
            self._element.click()
