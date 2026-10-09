import { useState } from 'react'
import { ask } from '../api.js'

export default function Chat({ kbs }) {
  const [question, setQuestion] = useState('')
  const [selected, setSelected] = useState({}) // { [kbId]: true }
  const [messages, setMessages] = useState([]) // [{role, content, sources}]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }))
  const allChecked = kbs.length > 0 && kbs.every((k) => selected[k.id])
  const toggleAll = () => {
    const next = {}
    if (allChecked) setSelected({})
    else kbs.forEach((k) => (next[k.id] = true))
    setSelected(next)
  }

  const doAsk = async () => {
    if (!question.trim() || loading) return
    const kbIds = Object.keys(selected).filter((id) => selected[id])
    if (kbIds.length === 0) {
      setError('请至少勾选一个知识库作为回答来源')
      return
    }
    setError('')
    const q = question.trim()
    // 历史上下文：取当前消息（不含本轮问题），过滤掉报错占位消息
    const history = messages
      .filter((m) => !m.content.startsWith('⚠️'))
      .map(({ role, content }) => ({ role, content }))
    setQuestion('')
    setMessages((m) => [...m, { role: 'user', content: q }])
    setLoading(true)
    try {
      const r = await ask(q, kbIds, null, history)
      setMessages((m) => [...m, { role: 'assistant', content: r.answer, sources: r.sources }])
    } catch (e) {
      setError(e.message)
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setError('')
  }

  const kbName = (id) => kbs.find((k) => k.id === id)?.name || id

  return (
    <div className="chat">
      <aside className="chat-side card">
        <h3>回答来源（勾选知识库）</h3>
        <label className="check-all">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          全选
        </label>
        {kbs.length === 0 && <p className="muted">暂无知识库，请先到「知识库」页创建并上传文件。</p>}
        <ul className="kb-check">
          {kbs.map((kb) => (
            <li key={kb.id}>
              <label>
                <input
                  type="checkbox"
                  checked={!!selected[kb.id]}
                  onChange={() => toggle(kb.id)}
                />
                {kb.name}
              </label>
            </li>
          ))}
        </ul>
      </aside>

      <section className="chat-main card">
        <div className="chat-toolbar">
          <span className="muted">多轮对话 · 助手会记住本轮上下文</span>
          <button className="small" onClick={clearChat} disabled={messages.length === 0}>
            清空对话
          </button>
        </div>
        <div className="chat-msgs">
          {messages.length === 0 && (
            <p className="muted center">勾选知识库后，在此提问。回答会基于知识库内容并给出引用。</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              <div className="bubble-text">{m.content}</div>
              {m.sources && m.sources.length > 0 && (
                <details className="sources">
                  <summary>引用来源（{m.sources.length}）</summary>
                  {m.sources.map((s) => (
                    <div key={s.index} className="source">
                      <span className="src-tag">[{s.index}]</span>
                      <span className="src-file">{kbName(s.kb_id)} / {s.file}</span>
                      <span className="src-score">相似度 {s.score}</span>
                      <p className="src-text">{s.text}</p>
                    </div>
                  ))}
                </details>
              )}
            </div>
          ))}
          {loading && <div className="bubble assistant">思考中…</div>}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="chat-input">
          <textarea
            rows={2}
            placeholder="输入问题，回车发送，Shift+Enter 换行"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                doAsk()
              }
            }}
          />
          <button onClick={doAsk} disabled={loading || !question.trim()}>
            发送
          </button>
        </div>
      </section>
    </div>
  )
}
