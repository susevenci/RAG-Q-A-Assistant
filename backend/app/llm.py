"""LLM 客户端：调用用户在界面里配置的云端 OpenAI 兼容 API。"""
from openai import OpenAI

from .llm_config import get_llm_config


def _client() -> OpenAI:
    cfg = get_llm_config()
    if not cfg.get("base_url") or not cfg.get("api_key"):
        raise RuntimeError("尚未配置 LLM API，请先在「设置」中填写 base_url 与 API Key")
    return OpenAI(base_url=cfg["base_url"], api_key=cfg["api_key"])


def list_models() -> list[str]:
    """拉取云端可用模型列表。"""
    cfg = get_llm_config()
    client = _client()
    resp = client.models.list()
    # 部分服务返回对象列表，统一取 id 字段
    return sorted(m.id for m in resp.data)


def chat(messages: list[dict], model: str | None = None, temperature: float = 0.3) -> str:
    """发起一次对话，返回模型文本。"""
    cfg = get_llm_config()
    client = _client()
    model = model or cfg.get("model")
    if not model:
        raise RuntimeError("尚未选择 LLM 模型，请先在「设置」中选择模型")
    resp = client.chat.completions.create(
        model=model, messages=messages, temperature=temperature
    )
    return resp.choices[0].message.content or ""
