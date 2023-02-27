from inspect import isawaitable
from typing import Union, Awaitable

from jupyter_server.services.contents.manager import ContentsManager


async def get_model(manager: ContentsManager, path: str) -> dict:
    """
    Gets the model via the ContentsManager.

    If the ContentsManager is async (e.g., AsyncContentsManager), then an await is issued. Otherwise,
    the model is returned under synchronous expectations.

    :param manager: A Jupyter ContentsManager
    :param path: The model path
    :return: The model
    """
    model: Union[dict, Awaitable[dict]] = manager.get(path)
    if isawaitable(model):
        model = await model
    return model
