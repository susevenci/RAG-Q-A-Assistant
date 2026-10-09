// 后端 API 封装（走 Vite 代理 /api -> http://127.0.0.1:8000）
const BASE = ''

async function handle(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `请求失败: ${res.status}`)
  return data
}

// 知识库
export async function listKB() {
  const res = await fetch(`${BASE}/api/kb`)
  return handle(res)
}

export async function createKB(name, description = '') {
  const form = new FormData()
  form.append('name', name)
  form.append('description', description)
  const res = await fetch(`${BASE}/api/kb`, { method: 'POST', body: form })
  return handle(res)
}

export async function deleteKB(kbId) {
  const res = await fetch(`${BASE}/api/kb/${kbId}`, { method: 'DELETE' })
  return handle(res)
}

export async function uploadFile(kbId, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/kb/${kbId}/upload`, { method: 'POST', body: form })
  return handle(res)
}

// Embedding 配置
export async function getEmbedConfig() {
  const res = await fetch(`${BASE}/api/embed/config`)
  return handle(res)
}

export async function setEmbedConfig(base_url, api_key, model) {
  const res = await fetch(`${BASE}/api/embed/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_url, api_key, model }),
  })
  return handle(res)
}

export async function listEmbedModels() {
  const res = await fetch(`${BASE}/api/embed/models`)
  return handle(res)
}

export async function testEmbed() {
  const res = await fetch(`${BASE}/api/embed/test`, { method: 'POST' })
  return handle(res)
}

// LLM 配置
export async function getLLMConfig() {
  const res = await fetch(`${BASE}/api/llm/config`)
  return handle(res)
}

export async function setLLMConfig(base_url, api_key, model) {
  const res = await fetch(`${BASE}/api/llm/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_url, api_key, model }),
  })
  return handle(res)
}

export async function listModels() {
  const res = await fetch(`${BASE}/api/llm/models`)
  return handle(res)
}

// 会话持久化
export async function listChats() {
  const res = await fetch(`${BASE}/api/chats`)
  return handle(res)
}

export async function createChat() {
  const res = await fetch(`${BASE}/api/chats`, { method: 'POST' })
  return handle(res)
}

export async function getChat(chatId) {
  const res = await fetch(`${BASE}/api/chats/${chatId}`)
  return handle(res)
}

export async function saveChat(chatId, messages) {
  const res = await fetch(`${BASE}/api/chats/${chatId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  return handle(res)
}

export async function deleteChat(chatId) {
  const res = await fetch(`${BASE}/api/chats/${chatId}`, { method: 'DELETE' })
  return handle(res)
}

// 问答
export async function ask(question, kbIds, model = null, history = []) {
  const res = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, kb_ids: kbIds, model, history }),
  })
  return handle(res)
}

// 流式问答（SSE）：通过回调接收事件 {type: 'sources'|'delta'|'error', ...}
export async function askStream(question, kbIds, model, history, onEvent) {
  const res = await fetch(`${BASE}/api/ask/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, kb_ids: kbIds, model, history }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || `请求失败: ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    // SSE 以空行分隔事件
    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return
        try {
          onEvent(JSON.parse(payload))
        } catch {
          /* 忽略无法解析的事件 */
        }
      }
    }
  }
}
