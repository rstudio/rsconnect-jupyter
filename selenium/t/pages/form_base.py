class FormBase(object):
    def __init__(self):
        self._locators = {}

        self._fields = []

    @property
    def submit(self):

        return None

    def populate_form(self, data):
        """populate the form with data from the data parameter"""

        if hasattr(data, "items"):
            # convert dictionaries to lists
            # so we can support filling out forms in order
            data = data.items()

        for (k, v) in data:
            if v is None:
                continue
            if k not in self._fields:
                # bail, the key is not a field
                raise ValueError("invalid form field: %s" % (k))
            # find the widget in the object's dictionary and set its value
            widget = getattr(self, k)
            widget.set(v)

        return self

    def submit_form(self, data=None):

        if data is not None:
            self.populate_form(data)

        self.submit.click()

        return self
