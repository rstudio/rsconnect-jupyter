from unittest import TestCase
from asyncmock import Mock, MagicMock, AsyncMock

from rsconnect_jupyter.managers import ContentsManager, get_model, isawaitable


class GetModelTestCase(TestCase):
    async def test_synchronous(self):
        model = AsyncMock()
        manager = MagicMock(spec=ContentsManager)
        manager.get = Mock(return_value=model)
        path = "path"
        spy = Mock(wraps=isawaitable, return_value=False)
        res = await get_model(manager, path)
        self.assertEqual(res, model)
        model.assert_not_awaited()
        manager.get.assert_called_once_with(path)
        spy.assert_called_once_with(model)

    async def test_asynchronous(self):
        model = AsyncMock()
        manager = MagicMock(spec=ContentsManager)
        manager.get = Mock(return_value=model)
        path = "path"
        spy = Mock(wraps=isawaitable, return_value=True)
        res = await get_model(manager, path)
        self.assertEqual(res, model)
        model.assert_awaited()
        manager.get.assert_called_once_with(path)
        spy.assert_called_once_with(model)
