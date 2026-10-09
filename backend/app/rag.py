"""RAG 核心流程：检索 + 组装 Prompt + 调 LLM 生成带引用的回答。"""
from . import embedding, llm
from .config import settings
from .vectorstore import get_index


def retrieve(kb_ids: list[str], query: str) -> list[dict]:
    """在勾选的知识库集合中检索，聚合并按相似度排序返回 Top-K。"""
    qv = embedding.embed_query(query)
    all_hits = []
    for kb_id in kb_ids:
        if not kb_id:
            continue
        hits = get_index(kb_id).search(qv, settings.top_k)
        for h in hits:
            h["kb_id"] = kb_id
            all_hits.append(h)
    # 按相似度降序，取 Top-K
    all_hits.sort(key=lambda x: x.get("score", 0.0), reverse=True)
    top = all_hits[: settings.top_k]
    # 低于阈值则过滤
    if settings.score_threshold > 0:
        top = [h for h in top if h["score"] >= settings.score_threshold]
    return top


SYSTEM_PROMPT = (
    "你是一个基于知识库的问答助手。请仅依据下方提供的参考片段回答用户问题。"
    "若参考片段不足以回答，请明确说明「知识库中未找到相关内容」，不要编造。"
    "回答末尾请用「引用」列出所依据的片段编号，例如：引用[1][2]。"
)


def build_context(hits: list[dict]) -> str:
    if not hits:
        return ""
    lines = []
    for i, h in enumerate(hits, 1):
        lines.append(f"[{i}] (来源: {h.get('file', '未知')}, 相似度: {h.get('score', 0):.3f})\n{h.get('text', '')}")
    return "\n\n".join(lines)


def rag_answer(
    kb_ids: list[str],
    question: str,
    model: str | None = None,
    history: list[dict] | None = None,
) -> dict:
    """执行一次 RAG 问答，返回 answer 与 sources。

    history 为之前的对话轮次（不含当前问题），格式 [{"role","content"}]，
    仅用于给 LLM 提供上下文记忆；RAG 检索只使用当前 question。
    """
    hits = retrieve(kb_ids, question)
    context = build_context(hits)
    user_prompt = question
    if context:
        user_prompt = f"参考片段:\n{context}\n\n用户问题:\n{question}"

    # 组装带上下文记忆的 messages：system -> 历史轮次 -> 当前问题（含参考片段）
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in history or []:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_prompt})
    answer = llm.chat(messages, model=model)
    sources = [
        {
            "index": i + 1,
            "file": h.get("file", "未知"),
            "kb_id": h.get("kb_id"),
            "score": round(h.get("score", 0.0), 4),
            "text": h.get("text", ""),
        }
        for i, h in enumerate(hits)
    ]
    return {"answer": answer, "sources": sources}
