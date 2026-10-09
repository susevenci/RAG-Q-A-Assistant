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

// 问答
export async function ask(question, kbIds, model = null, history = []) {
  const res = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, kb_ids: kbIds, model, history }),
  })
  return handle(res)
}
