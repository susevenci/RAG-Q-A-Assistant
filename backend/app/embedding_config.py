"""Embedding 服务配置：界面自定义 base_url / api_key / model。

未填写的项回落到 .env（Settings）中的默认值。
"""
import json
from pathlib import Path

from .config import settings

CONFIG_FILE: Path = settings.data_dir / "embedding_config.json"

DEFAULTS = {
    "base_url": settings.embedding_base_url,
    "api_key": settings.embedding_api_key,
    "model": settings.embedding_model,
}


def get_embedding_config() -> dict:
    """读取已保存的 Embedding 配置；空字段回落 .env 默认值。"""
    raw: dict = {}
    if CONFIG_FILE.exists():
        raw = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    return {
        "base_url": (raw.get("base_url") or "").strip() or DEFAULTS["base_url"],
        "api_key": (raw.get("api_key") or "").strip() or DEFAULTS["api_key"],
        "model": (raw.get("model") or "").strip() or DEFAULTS["model"],
    }


def save_embedding_config(base_url: str, api_key: str, model: str) -> dict:
    old = _raw()
    cfg = {
        "base_url": base_url.strip().rstrip("/"),
        "api_key": api_key.strip() or old.get("api_key", "") or DEFAULTS["api_key"],
        "model": model.strip() or DEFAULTS["model"],
    }
    CONFIG_FILE.write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
    return cfg


def _raw() -> dict:
    if CONFIG_FILE.exists():
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    return {}
