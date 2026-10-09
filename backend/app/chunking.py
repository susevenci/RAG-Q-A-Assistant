"""文本分块：按字符滑动窗口切分，带重叠。"""
from .config import settings


def chunk_text(text: str) -> list[str]:
    """将文本切分为若干块，返回块文本列表（去除首尾空白，跳过空块）。"""
    text = text.strip()
    if not text:
        return []
    size = settings.chunk_size
    overlap = settings.chunk_overlap
    if overlap >= size:
        overlap = size // 4
    step = size - overlap
    chunks = []
    for i in range(0, len(text), step):
        piece = text[i:i + size].strip()
        if piece:
            chunks.append(piece)
        if i + size >= len(text):
            break
    return chunks
