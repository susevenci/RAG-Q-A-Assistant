# RAG 问答助手（RAG-Q-A-Assistant）

一个参考腾讯 ima 实现的本地化 **RAG（检索增强生成）问答** 应用：上传文档建立知识库，在对话页勾选知识库作为大模型回答的来源，基于知识库内容生成带引用出处、支持多轮上下文记忆的回答。

- **Embedding（向量化）**：任意 OpenAI 兼容端点，默认本地 LM Studio 的轻量化模型 `text-embedding-qwen3-embedding-0.6b`（离线免费），可在设置页自定义服务地址与模型，并支持连接测试（返回向量维度）。
- **LLM（生成）**：云端大模型 API，在界面里自定义 `base_url` / `API Key` 并拉取模型列表后选择，可自由接入任意 OpenAI 兼容服务。
- **向量库**：FAISS（本地索引，每个知识库独立）。

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 知识库管理 | 创建 / 删除知识库，每个知识库独立存储文档与向量索引 |
| 文档上传 | 支持 `.txt` `.md` `.csv` `.json` `.log` `.pdf` `.docx`，自动解析、分块、向量化入库 |
| 来源勾选 | 对话页可勾选一个或多个知识库作为回答来源，支持全选 |
| RAG 检索 | 问题向量化 → FAISS 余弦相似度检索 Top-K → 拼装 Prompt |
| 引用展示 | 回答附带引用来源（文件名 + 相似度 + 片段内容） |
| 多轮对话 | 助手记住本轮上下文（检索仅针对当前问题，历史仅作 LLM 记忆），可一键清空 |
| 流式输出 | 回答逐字显示（SSE），检索结果先行下发，体验接近即时问答 |
| 历史对话持久化 | 会话保存至 `data/chats/`，刷新页面 / 重启电脑后历史对话不丢失，可切换、新建、删除会话 |
| LLM 自定义 | 界面配置云端 API 的 base_url / API Key，拉取模型列表后选择 |
| Embedding 自定义 | 界面配置向量化服务的 base_url / API Key / 模型，支持拉取模型列表与连接测试（返回向量维度） |

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python 3.10+ · FastAPI · FAISS · OpenAI SDK · Pydantic |
| 前端 | React 19 · Vite 6 |
| 依赖管理 | 后端 `uv`，前端 `npm` |

## 环境要求

- **Python 3.10+**（开发环境为 3.14）
- **Node.js 18+**
- **uv**（后端依赖管理）
- **LM Studio**：本地运行 Embedding 模型
  - 在 LM Studio 中加载 `text-embedding-qwen3-embedding-0.6b`
  - 开启本地服务器（默认端口 `1234`）

## 目录结构

```
RAG/
├── backend/                # 后端
│   ├── pyproject.toml      # uv 项目定义与依赖
│   ├── uv.lock             # 依赖锁文件
│   ├── .env.example        # 环境变量示例（复制为 .env）
│   └── app/
│       ├── main.py         # FastAPI 入口与路由（含 /api/ask/stream SSE、/api/chats 会话）
│       ├── config.py       # 配置（默认 Embedding 端点、检索参数）
│       ├── embedding.py    # Embedding 客户端（OpenAI 兼容端点，界面可自定义）
│       ├── embedding_config.py # Embedding 配置读写（界面自定义，回落 .env 默认）
│       ├── extractors.py   # 文档文本解析
│       ├── chunking.py     # 文本分块
│       ├── vectorstore.py  # FAISS 向量库（每知识库独立索引）
│       ├── llm.py          # 云端 LLM 客户端（含流式 chat_stream）
│       ├── llm_config.py   # LLM 配置读写
│       ├── knowledge_store.py # 知识库元数据
│       ├── chat_store.py   # 历史会话持久化（data/chats/）
│       └── rag.py          # 检索 + Prompt 组装 + 生成（含流式 rag_answer_stream）
└── frontend/               # 前端
    ├── package.json
    ├── vite.config.js      # 开发代理 /api -> 后端 8000
    └── src/
        ├── App.jsx
        ├── api.js
        └── pages/          # 知识库 / 对话 / 设置 三页
```

## 快速开始

### 1. 启动 LM Studio（Embedding 服务）

1. 打开 LM Studio，加载模型 `text-embedding-qwen3-embedding-0.6b`。
2. 进入「Developer」→ 启动本地服务器，确认地址为 `http://localhost:1234`。

### 2. 启动后端（uv 一键安装依赖）

```bash
cd backend

# 一键安装依赖（uv 会自动创建虚拟环境并按 uv.lock 精确安装）
uv sync

# 可选：自定义 Embedding 端点 / 检索参数
cp .env.example .env    # Windows 可用: copy .env.example .env

# 启动（--reload 开发时改代码自动重启）
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

后端运行在 <http://127.0.0.1:8000>，交互式文档见 <http://127.0.0.1:8000/docs>。

### 3. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端运行在 <http://localhost:5173>，已配置代理把 `/api` 转发到后端 `8000` 端口。

### 4. 使用

1. 浏览器打开 <http://localhost:5173>。
2. 进入「设置」：填写云端大模型的 `base_url` 与 `API Key` → 点「拉取模型列表」→ 选择一个模型 → 保存。
3. 进入「知识库」：创建知识库并上传文件（等待解析入库）。
4. 进入「对话」：勾选知识库作为回答来源，输入问题即可。回答会基于知识库内容并给出引用，且支持多轮追问。

## 配置说明

### Embedding（向量化服务）

两种配置方式，界面配置优先：

1. **界面配置（推荐）**：在「设置」页填写任意 OpenAI 兼容端点的 `base_url` / `API Key` / `model`，
   可拉取模型列表、测试连接（返回向量维度）。保存后存于 `backend/data/embedding_config.json`（已被 gitignore）。
2. **`.env` 默认值（兜底）**：复制 `backend/.env.example` 为 `backend/.env`，界面未配置时自动回落这些值：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `EMBEDDING_BASE_URL` | `http://localhost:1234/v1` | LM Studio OpenAI 兼容端点 |
| `EMBEDDING_API_KEY` | `lm-studio` | 占位，LM Studio 不校验 |
| `EMBEDDING_MODEL` | `text-embedding-qwen3-embedding-0.6b` | Embedding 模型名 |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `500` / `80` | 分块大小 / 重叠（字符） |
| `TOP_K` | `4` | 检索返回片段数 |

> ⚠️ 更换 Embedding 模型后向量维度可能变化，已有知识库需重新上传文件。

### LLM（云端，界面配置）

在「设置」页填写，保存后存于 `backend/data/llm_config.json`（该文件已被 `.gitignore` 忽略，不会上传）。

### 历史对话（自动持久化，无需配置）

每轮对话自动保存到 `backend/data/chats/{会话id}.json`，刷新页面或重启后自动恢复（打开对话页进入最近一次会话）。

## 版本

- **应用版本**：`0.3.0`（变更明细见 [CHANGELOG.md](./CHANGELOG.md)）
- 后端 Python：3.10+（开发验证于 3.14.7）
- 前端 Node：18+（开发验证于 24.20.0）
- 关键依赖：FastAPI 0.115+ · FAISS-cpu 1.13+ · OpenAI SDK 1.58+ · React 19 · Vite 6（精确版本见 `backend/uv.lock` 与 `frontend/package-lock.json`）

## 安全说明

以下内容**不会**被提交到仓库（见 `.gitignore`）：

- `backend/data/` —— 运行时数据，包含你填写的 **LLM / Embedding API Key**、上传的原始文件、向量索引与历史会话。
- `backend/.env` —— 真实环境配置。
- `backend/.venv/`、`frontend/node_modules/`、`frontend/dist/`、`__pycache__/` —— 依赖、构建产物与缓存。

> 提交前请确认未把 `.env` 或 `data/` 下的 `llm_config.json` / `embedding_config.json` 加入暂存区。
