"""Embedding 客户端：调用本地 LM Studio 的 OpenAI 兼容端点。"""
from openai import OpenAI

from .config import settings


def _client() -> OpenAI:
    return OpenAI(base_url=settings.embedding_base_url, api_key=settings.embedding_api_key)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """批量向量化，返回向量列表。"""
    client = _client()
    resp = client.embeddings.create(model=settings.embedding_model, input=texts)
    return [d.embedding for d in resp.data]


def embed_query(text: str) -> list[float]:
    """单条向量化。"""
    return embed_texts([text])[0]
