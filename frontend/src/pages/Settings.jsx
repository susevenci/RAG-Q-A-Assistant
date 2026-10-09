import { useEffect, useState } from 'react'
import { getLLMConfig, setLLMConfig, listModels } from '../api.js'

export default function Settings() {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const c = await getLLMConfig()
        setBaseUrl(c.base_url || '')
        setModel(c.model || '')
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  const doSave = async () => {
    setErr('')
    setMsg('')
    try {
      await setLLMConfig(baseUrl, apiKey, model)
      setApiKey('')
      setMsg('已保存')
    } catch (e) {
      setErr(e.message)
    }
  }

  const doLoadModels = async () => {
    setErr('')
    setMsg('正在拉取模型列表…')
    try {
      const r = await listModels()
      setModels(r.models || [])
      setMsg(`获取到 ${r.models.length} 个模型`)
    } catch (e) {
      setErr(e.message)
      setModels([])
    }
  }

  return (
    <div className="page">
      <section className="card">
        <h2>大模型 API 配置</h2>
        <p className="muted">
          填写云端大模型的 base_url 与 API Key，保存后拉取可用模型并选择。
          回答将基于勾选的知识库内容生成。
        </p>
        <div className="form">
          <label>
            Base URL
            <input
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </label>
          <label>
            API Key
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <label>
            模型
            <input
              list="model-list"
              placeholder="模型名称，如 gpt-4o"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <datalist id="model-list">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <div className="row">
            <button onClick={doLoadModels}>拉取模型列表</button>
            <button onClick={doSave} disabled={!baseUrl.trim() || !apiKey.trim()}>
              保存配置
            </button>
          </div>
          {msg && <p className="msg">{msg}</p>}
          {err && <p className="error">{err}</p>}
        </div>
      </section>

      <section className="card">
        <h2>Embedding（本地 LM Studio）</h2>
        <p className="muted">
          向量模型使用本地 LM Studio 的 <code>text-embedding-qwen3-embedding-0.6b</code>，
          走 OpenAI 兼容端点（默认 <code>http://localhost:1234/v1</code>）。
          请在 LM Studio 中加载该模型并开启本地服务器。
        </p>
      </section>
    </div>
  )
}
