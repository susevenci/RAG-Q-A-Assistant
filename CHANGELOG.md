# 版本更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.0] - 2026-10-09

### 新增（Features）

- **流式对话输出**
  - 后端新增 `POST /api/ask/stream`（SSE），检索结果作为首个事件先行下发，LLM 回答逐段增量推送，末尾以 `[DONE]` 收尾。
  - 前端对话页改为流式渲染：检索中先显示"检索中…"，回答逐字显示并带闪烁光标；中途出错时已生成的部分保留并标注。
  - 原 `POST /api/ask` 一次性返回接口保留，二者并存。

- **Embedding 模型自定义**
  - 向量服务由"固定本地 LM Studio"升级为任意 OpenAI 兼容端点，界面（设置页）可配置 `base_url` / `API Key` / `model`，未配置项自动回落 `.env` 默认值，老用户零感知。
  - 新增 `GET/POST /api/embed/config`、`GET /api/embed/models`（拉取可用模型列表）、`POST /api/embed/test`（连接测试，返回向量维度，提前暴露维度不匹配）。
  - 配置存于 `backend/data/embedding_config.json`（已被 gitignore）。

- **历史对话持久化**
  - 会话保存到 `backend/data/chats/{id}.json`，刷新页面或重启电脑后历史对话不再丢失。
  - 新增 `GET/POST /api/chats`、`GET/PUT/DELETE /api/chats/{id}`。
  - 对话页侧栏新增"历史会话"列表：点选切换、悬停删除、＋新建；打开页面自动进入最近一次会话；每轮问答结束自动落盘。

### 修复（Fixes）

- 会话列表按更新时间倒序时，秒级时间戳在同秒创建多条会话时顺序不稳定，改为 UTC 微秒精度 ISO 时间戳，保证排序稳定。

### 说明

- 本次无新增第三方依赖，Python / Node / 各框架环境版本保持不变。
- `frontend/dist/` 构建产物已加入 `.gitignore`，不再入库。
- 更换 Embedding 模型后向量维度可能变化，已有知识库需重新上传文件。

## [0.1.0] - 初版

- 知识库管理（创建 / 删除，独立向量索引）
- 文档上传（`.txt .md .csv .json .log .pdf .docx`）：解析 → 分块 → 向量化 → FAISS 入库
- 对话页勾选知识库作为回答来源（支持全选）
- RAG 检索（问题向量化 → FAISS 余弦 Top-K → 拼装 Prompt）
- 引用展示（文件名 + 相似度 + 片段）
- 多轮对话记忆（历史作 LLM 上下文，检索仅用当前问题）
- LLM 自定义（界面配置 base_url / API Key，拉取模型列表后选择）
