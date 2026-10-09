import { useEffect, useState } from 'react'
import {
  getLLMConfig, setLLMConfig, listModels,
  getEmbedConfig, setEmbedConfig, listEmbedModels, testEmbed,
} from '../api.js'

export default function Settings() {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Embedding 配置
  const [ebUrl, setEbUrl] = useState('')
  const [ebKey, setEbKey] = useState('')
  const [ebModel, setEbModel] = useState('')
  const [ebModels, setEbModels] = useState([])
  const [ebMsg, setEbMsg] = useState('')
  const [ebErr, setEbErr] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const c = await getLLMConfig()
        setBaseUrl(c.base_url || '')
        setModel(c.model || '')
      } catch (e) {
        console.error(e)
      }
      try {
        const ec = await getEmbedConfig()
        setEbUrl(ec.base_url || '')
        setEbModel(ec.model || '')
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

  const doSaveEmbed = async () => {
    setEbErr('')
    setEbMsg('')
    try {
      await setEmbedConfig(ebUrl, ebKey, ebModel)
      setEbKey('')
      setEbMsg('已保存')
    } catch (e) {
      setEbErr(e.message)
    }
  }

  const doLoadEmbedModels = async () => {
    setEbErr('')
    setEbMsg('正在拉取模型列表…')
    try {
      const r = await listEmbedModels()
      setEbModels(r.models || [])
      setEbMsg(`获取到 ${r.models.length} 个模型`)
    } catch (e) {
      setEbErr(e.message)
      setEbModels([])
    }
  }

  const doTestEmbed = async () => {
    setEbErr('')
    setEbMsg('正在测试连接…')
    try {
      const r = await testEmbed()
      setEbMsg(`连接成功，向量维度 ${r.dim}`)
    } catch (e) {
      setEbErr(e.message)
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
        <h2>Embedding（向量化服务）</h2>
        <p className="muted">
          向量模型走任意 OpenAI 兼容端点，默认本地 LM Studio（<code>http://localhost:1234/v1</code> +
          <code> text-embedding-qwen3-embedding-0.6b</code>）。可改为其他服务或模型。
          <b>注意：更换模型后向量维度可能变化，已有知识库需重新上传文件。</b>
        </p>
        <div className="form">
          <label>
            Base URL
            <input
              placeholder="http://localhost:1234/v1"
              value={ebUrl}
              onChange={(e) => setEbUrl(e.target.value)}
            />
          </label>
          <label>
            API Key
            <input
              type="password"
              placeholder="留空则保持原值（LM Studio 可不填）"
              value={ebKey}
              onChange={(e) => setEbKey(e.target.value)}
            />
          </label>
          <label>
            模型
            <input
              list="embed-model-list"
              placeholder="如 text-embedding-qwen3-embedding-0.6b"
              value={ebModel}
              onChange={(e) => setEbModel(e.target.value)}
            />
            <datalist id="embed-model-list">
              {ebModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <div className="row">
            <button onClick={doLoadEmbedModels}>拉取模型列表</button>
            <button onClick={doTestEmbed}>测试连接</button>
            <button onClick={doSaveEmbed} disabled={!ebUrl.trim() || !ebModel.trim()}>
              保存配置
            </button>
          </div>
          {ebMsg && <p className="msg">{ebMsg}</p>}
          {ebErr && <p className="error">{ebErr}</p>}
        </div>
      </section>
    </div>
  )
}
