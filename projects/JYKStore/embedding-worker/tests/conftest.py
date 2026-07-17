import os

os.environ.setdefault("E5_WORKER_ENV", "test")
os.environ.setdefault("E5_WORKER_STUB", "true")

import pytest

from app import model as embed_model


@pytest.fixture(scope="session", autouse=True)
def _warmup_worker():
    embed_model.warmup()
    yield
