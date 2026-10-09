"""FAISS 向量库：每个知识库一个独立索引，持久化到磁盘。

使用内积（IP）索引 + 归一化向量，等价于余弦相似度。
"""
import json
from pathlib import Path

import faiss
import numpy as np

from .config import settings


def _normalize(vectors: np.ndarray) -> np.ndarray:
    vectors = vectors.astype("float32")
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


class KnowledgeIndex:
    """单个知识库的向量索引。"""

    def __init__(self, kb_id: str):
        self.kb_id = kb_id
        self.index_dir = settings.data_dir / "index" / kb_id
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self.faiss_index: faiss.IndexFlatIP | None = None
        self.chunks: list[dict] = []  # 与 faiss 向量顺序一一对应
        self._load()

    # ---- 持久化 ----
    def _load(self) -> None:
        index_file = self.index_dir / "index.faiss"
        chunks_file = self.index_dir / "chunks.json"
        if index_file.exists():
            self.faiss_index = faiss.read_index(str(index_file))
        if chunks_file.exists():
            self.chunks = json.loads(chunks_file.read_text(encoding="utf-8"))

    def _save(self) -> None:
        if self.faiss_index is not None:
            faiss.write_index(self.faiss_index, str(self.index_dir / "index.faiss"))
        (self.index_dir / "chunks.json").write_text(
            json.dumps(self.chunks, ensure_ascii=False), encoding="utf-8"
        )

    @property
    def dim(self) -> int:
        return self.faiss_index.d if self.faiss_index is not None else 0

    def add(self, vectors: list[list[float]], chunks: list[dict]) -> None:
        """新增向量与文本块。dim 首次确定时建索引。"""
        if not vectors:
            return
        arr = np.array(vectors, dtype="float32")
        dim = arr.shape[1]
        if self.faiss_index is None:
            self.faiss_index = faiss.IndexFlatIP(dim)
        else:
            assert dim == self.faiss_index.d, "向量维度不一致，请确认 Embedding 模型未变更"
        self.faiss_index.add(_normalize(arr))
        start = len(self.chunks)
        self.chunks.extend(chunks)
        self._save()

    def reset(self) -> None:
        self.faiss_index = None
        self.chunks = []
        self._save()

    def search(self, query_vector: list[float], k: int) -> list[dict]:
        """返回带 score 的 Top-K 片段。"""
        if self.faiss_index is None or not self.chunks:
            return []
        q = _normalize(np.array([query_vector], dtype="float32"))
        k = min(k, len(self.chunks))
        scores, idxs = self.faiss_index.search(q, k)
        results = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx < 0:
                continue
            item = dict(self.chunks[idx])
            item["score"] = float(score)
            results.append(item)
        return results


_index_cache: dict[str, KnowledgeIndex] = {}


def get_index(kb_id: str) -> KnowledgeIndex:
    if kb_id not in _index_cache:
        _index_cache[kb_id] = KnowledgeIndex(kb_id)
    return _index_cache[kb_id]


def drop_index(kb_id: str) -> None:
    if kb_id in _index_cache:
        del _index_cache[kb_id]
    index_dir = settings.data_dir / "index" / kb_id
    if index_dir.exists():
        for f in index_dir.iterdir():
            f.unlink(missing_ok=True)
        index_dir.rmdir()
