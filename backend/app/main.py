"""FastAPI 应用入口与路由。"""
import json
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import chat_store, embedding, extractors, knowledge_store, llm, rag
from .chunking import chunk_text
from .config import settings
from .embedding import embed_texts
from .embedding_config import get_embedding_config, save_embedding_config
from .llm_config import get_llm_config, save_llm_config
from .vectorstore import drop_index, get_index

app = FastAPI(title="RAG 问答服务")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_EXT = {".txt", ".md", ".markdown", ".csv", ".json", ".log", ".pdf", ".docx"}


# ---------------- 知识库 ----------------
@app.post("/api/kb")
async def create_knowledge_base(name: str = Form(...), description: str = Form("")):
    kb_id = uuid.uuid4().hex[:12]
    kb = knowledge_store.create_kb(kb_id, name.strip(), description.strip())
    return kb


@app.get("/api/kb")
def list_knowledge_bases():
    return knowledge_store.list_kbs()


@app.delete("/api/kb/{kb_id}")
def delete_knowledge_base(kb_id: str):
    if not knowledge_store.get_kb(kb_id):
        raise HTTPException(404, "知识库不存在")
    knowledge_store.delete_kb(kb_id)
    drop_index(kb_id)
    # 删除该知识库下所有原始文件
    for f in Path(settings.data_dir / "files" / kb_id).glob("*") if (settings.data_dir / "files" / kb_id).exists() else []:
        f.unlink(missing_ok=True)
    return {"ok": True}


@app.post("/api/kb/{kb_id}/upload")
async def upload_file(kb_id: str, file: UploadFile = File(...)):
    if not knowledge_store.get_kb(kb_id):
        raise HTTPException(404, "知识库不存在")
    name = file.filename or "unnamed"
    ext = Path(name).suffix.lower()
    if ext not in SUPPORTED_EXT:
        raise HTTPException(400, f"不支持的文件类型: {ext}")

    # 1. 落盘原始文件
    file_dir = settings.data_dir / "files" / kb_id
    file_dir.mkdir(parents=True, exist_ok=True)
    file_path = file_dir / name
    with open(file_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    # 2. 抽取文本
    try:
        text = extractors.extract_text(file_path)
    except Exception as e:  # noqa: BLE001
        file_path.unlink(missing_ok=True)
        raise HTTPException(400, f"文件解析失败: {e}") from e

    # 3. 分块
    chunks = chunk_text(text)
    if not chunks:
        file_path.unlink(missing_ok=True)
        raise HTTPException(400, "文件内容为空或无法解析出文本")

    # 4. 向量化并写入向量库（同名文件会重建索引）
    idx = get_index(kb_id)
    if any(f["name"] == name for f in knowledge_store.get_kb(kb_id)["files"]):
        idx.reset()  # 覆盖同名文件：清空后重建（简化处理）

    vectors = embed_texts(chunks)
    chunk_records = [
        {"id": f"{kb_id}_{i}", "file": name, "text": c}
        for i, c in enumerate(chunks)
    ]
    idx.add(vectors, chunk_records)
    knowledge_store.add_file(kb_id, name, len(chunks))
    return {"ok": True, "file": name, "chunks": len(chunks)}


# ---------------- 会话持久化 ----------------
class ChatIn(BaseModel):
    messages: list[dict]


@app.get("/api/chats")
def list_chats():
    return chat_store.list_chats()


@app.post("/api/chats")
def create_chat():
    return chat_store.create_chat()


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str):
    chat = chat_store.get_chat(chat_id)
    if chat is None:
        raise HTTPException(404, "会话不存在")
    return chat


@app.put("/api/chats/{chat_id}")
def save_chat(chat_id: str, body: ChatIn):
    chat = chat_store.save_chat(chat_id, body.messages)
    if chat is None:
        raise HTTPException(404, "会话不存在")
    return {"ok": True}


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: str):
    if not chat_store.delete_chat(chat_id):
        raise HTTPException(404, "会话不存在")
    return {"ok": True}


# ---------------- Embedding 配置 ----------------
class EmbedConfigIn(BaseModel):
    base_url: str
    api_key: str = ""
    model: str = ""


@app.get("/api/embed/config")
def get_embed_config():
    cfg = get_embedding_config()
    return {
        "base_url": cfg["base_url"],
        "has_api_key": bool(cfg["api_key"]),
        "model": cfg["model"],
    }


@app.post("/api/embed/config")
def set_embed_config(body: EmbedConfigIn):
    return save_embedding_config(body.base_url, body.api_key, body.model)


@app.get("/api/embed/models")
def list_embed_models():
    try:
        return {"models": embedding.list_models()}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"获取模型列表失败: {e}") from e


@app.post("/api/embed/test")
def test_embed():
    """连接测试：向量化一条样例文本，返回向量维度。"""
    try:
        return embedding.test_connection()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"连接失败: {e}") from e


# ---------------- LLM 配置 ----------------
class LLMConfigIn(BaseModel):
    base_url: str
    api_key: str
    model: str = ""


@app.get("/api/llm/config")
def get_config():
    cfg = get_llm_config()
    # 不回传完整 key，只回传是否已配置
    return {"base_url": cfg.get("base_url", ""), "has_api_key": bool(cfg.get("api_key")), "model": cfg.get("model", "")}


@app.post("/api/llm/config")
def set_config(body: LLMConfigIn):
    cfg = save_llm_config(body.base_url, body.api_key, body.model)
    return cfg


@app.get("/api/llm/models")
def list_models():
    try:
        models = llm.list_models()
        return {"models": models}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"获取模型列表失败: {e}") from e


# ---------------- 问答 ----------------
class AskIn(BaseModel):
    question: str
    kb_ids: list[str] = []
    model: str | None = None
    history: list[dict] = []


@app.post("/api/ask")
def ask(body: AskIn):
    if not body.question.strip():
        raise HTTPException(400, "问题不能为空")
    try:
        result = rag.rag_answer(body.kb_ids, body.question, model=body.model, history=body.history)
        return result
    except RuntimeError as e:
        raise HTTPException(400, str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"问答失败: {e}") from e


@app.post("/api/ask/stream")
def ask_stream(body: AskIn):
    """流式问答：SSE 逐段推送增量文本，检索结果作为首个事件先行下发。"""
    if not body.question.strip():
        raise HTTPException(400, "问题不能为空")

    def event_stream():
        try:
            for ev in rag.rag_answer_stream(
                body.kb_ids, body.question, model=body.model, history=body.history
            ):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except RuntimeError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"
        except Exception as e:  # noqa: BLE001
            yield f"data: {json.dumps({'type': 'error', 'message': f'问答失败: {e}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/health")
def health():
    return {"ok": True}
