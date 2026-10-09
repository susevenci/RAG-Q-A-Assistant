"""LLM 云端 API 配置：保存/读取用户在界面里自定义的 base_url / api_key / model。"""
import json
from pathlib import Path

from .config import settings

CONFIG_FILE = settings.data_dir / "llm_config.json"


def get_llm_config() -> dict:
    """读取已保存的 LLM 配置，无则返回空默认。"""
    if CONFIG_FILE.exists():
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    return {"base_url": "", "api_key": "", "model": ""}


def save_llm_config(base_url: str, api_key: str, model: str) -> dict:
    cfg = {"base_url": base_url.strip().rstrip("/"), "api_key": api_key.strip(), "model": model.strip()}
    CONFIG_FILE.write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
    return cfg
