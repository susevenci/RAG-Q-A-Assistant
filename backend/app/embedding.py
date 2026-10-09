"""Embedding 客户端：调用界面配置的 OpenAI 兼容端点（默认本地 LM Studio）。"""
from openai import OpenAI

from .embedding_config import get_embedding_config


def _client() -> OpenAI:
    cfg = get_embedding_config()
    return OpenAI(base_url=cfg["base_url"], api_key=cfg["api_key"])


def list_models() -> list[str]:
    """拉取 Embedding 服务可用模型列表。"""
    client = _client()
    resp = client.models.list()
    return sorted(m.id for m in resp.data)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """批量向量化，返回向量列表。"""
    cfg = get_embedding_config()
    client = _client()
    resp = client.embeddings.create(model=cfg["model"], input=texts)
    return [d.embedding for d in resp.data]


def embed_query(text: str) -> list[float]:
    """单条向量化。"""
    return embed_texts([text])[0]


def test_connection() -> dict:
    """连接测试：向量化一条样例文本，返回向量维度（用于提前发现维度不匹配）。"""
    vec = embed_query("连接测试")
    return {"ok": True, "dim": len(vec)}
