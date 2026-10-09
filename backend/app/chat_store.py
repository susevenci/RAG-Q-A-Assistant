"""会话持久化：每个会话一个 JSON 文件，存于 data/chats/。

文件格式：
{
  "id": "...",
  "title": "...",            # 取首条用户消息前 20 字
  "created_at": "...",
  "updated_at": "...",
  "messages": [{"role", "content", "sources?"}, ...]
}
"""
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .config import settings

CHATS_DIR: Path = settings.data_dir / "chats"
CHATS_DIR.mkdir(parents=True, exist_ok=True)

TITLE_LEN = 20


def _path(chat_id: str) -> Path:
    # 防路径穿越
    safe = chat_id.strip().replace("/", "_").replace("\\", "_")
    return CHATS_DIR / f"{safe}.json"


def _now() -> str:
    # 微秒精度的 ISO 时间戳，字典序即时间序，保证同秒创建的会话排序稳定
    return datetime.now(timezone.utc).isoformat()


def _load(chat_id: str) -> dict | None:
    p = _path(chat_id)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def _save(chat: dict) -> dict:
    _path(chat["id"]).write_text(
        json.dumps(chat, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return chat


def list_chats() -> list[dict]:
    """返回会话元数据列表（按更新时间倒序，不含消息正文）。"""
    items = []
    for p in CHATS_DIR.glob("*.json"):
        try:
            chat = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        items.append({
            "id": chat.get("id", p.stem),
            "title": chat.get("title") or "新会话",
            "created_at": chat.get("created_at", ""),
            "updated_at": chat.get("updated_at", ""),
            "message_count": len(chat.get("messages", [])),
        })
    items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return items


def get_chat(chat_id: str) -> dict | None:
    return _load(chat_id)


def create_chat(messages: list[dict] | None = None) -> dict:
    chat = {
        "id": uuid.uuid4().hex[:12],
        "title": "",
        "created_at": _now(),
        "updated_at": _now(),
        "messages": list(messages or []),
    }
    _update_title(chat)
    return _save(chat)


def save_chat(chat_id: str, messages: list[dict]) -> dict | None:
    """保存会话消息；不存在则报错（由调用方先 create）。"""
    chat = _load(chat_id)
    if chat is None:
        return None
    chat["messages"] = messages
    chat["updated_at"] = _now()
    _update_title(chat)
    return _save(chat)


def delete_chat(chat_id: str) -> bool:
    p = _path(chat_id)
    if p.exists():
        p.unlink(missing_ok=True)
        return True
    return False


def _update_title(chat: dict) -> None:
    if chat.get("title"):
        return
    for m in chat.get("messages", []):
        if m.get("role") == "user" and m.get("content"):
            chat["title"] = m["content"].strip().replace("\n", " ")[:TITLE_LEN]
            break
