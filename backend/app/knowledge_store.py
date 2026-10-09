"""知识库元数据存储：知识库列表、所属文件清单。"""
import json
from pathlib import Path

from .config import settings

KB_FILE = settings.data_dir / "knowledge_bases.json"


def _load() -> list[dict]:
    if KB_FILE.exists():
        return json.loads(KB_FILE.read_text(encoding="utf-8"))
    return []


def _save(kbs: list[dict]) -> None:
    KB_FILE.write_text(json.dumps(kbs, ensure_ascii=False, indent=2), encoding="utf-8")


def list_kbs() -> list[dict]:
    return _load()


def get_kb(kb_id: str) -> dict | None:
    for kb in _load():
        if kb["id"] == kb_id:
            return kb
    return None


def create_kb(kb_id: str, name: str, description: str = "") -> dict:
    kbs = _load()
    kb = {"id": kb_id, "name": name, "description": description, "files": []}
    kbs.append(kb)
    _save(kbs)
    return kb


def add_file(kb_id: str, file_name: str, chunk_count: int) -> None:
    kbs = _load()
    for kb in kbs:
        if kb["id"] == kb_id:
            for f in kb["files"]:
                if f["name"] == file_name:
                    f["chunks"] = chunk_count  # 同名文件覆盖：更新块数
                    break
            else:
                kb["files"].append({"name": file_name, "chunks": chunk_count})
            break
    _save(kbs)


def remove_file(kb_id: str, file_name: str) -> None:
    kbs = _load()
    for kb in kbs:
        if kb["id"] == kb_id:
            kb["files"] = [f for f in kb["files"] if f["name"] != file_name]
            break
    _save(kbs)


def delete_kb(kb_id: str) -> None:
    _save([kb for kb in _load() if kb["id"] != kb_id])
