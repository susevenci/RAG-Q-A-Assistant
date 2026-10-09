import { useEffect, useState } from 'react'
import { askStream, listChats, createChat, getChat, saveChat, deleteChat } from '../api.js'

export default function Chat({ kbs }) {
  const [question, setQuestion] = useState('')
  const [selected, setSelected] = useState({}) // { [kbId]: true }
  const [messages, setMessages] = useState([]) // [{role, content, sources}]
  const [streaming, setStreaming] = useState('') // 正在流式输出的增量文本
  const [streamSources, setStreamSources] = useState([]) // 流式过程中已收到的引用
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // ---- 会话持久化 ----
  const [chats, setChats] = useState([]) // 会话元数据列表
  const [chatId, setChatId] = useState(null) // 当前会话 id
  const [loadingChat, setLoadingChat] = useState(false)

  const refreshChats = async () => {
    try {
      setChats(await listChats())
    } catch (e) {
      console.error(e)
    }
  }

  // 初始化：加载会话列表，自动进入最近一次会话
  useEffect(() => {
    ;(async () => {
      try {
        const list = await listChats()
        setChats(list)
        if (list.length > 0) {
          const latest = list[0]
          setChatId(latest.id)
          const chat = await getChat(latest.id)
          setMessages(chat.messages || [])
        }
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  // 切换会话
  const switchChat = async (id) => {
    if (loading || id === chatId) return
    setLoadingChat(true)
    try {
      const chat = await getChat(id)
      setChatId(id)
      setMessages(chat.messages || [])
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingChat(false)
    }
  }

  // 新建会话（不立即落盘，首次提问时创建）
  const newChat = () => {
    if (loading) return
    setChatId(null)
    setMessages([])
    setError('')
  }

  // 删除会话
  const removeChat = async (id) => {
    if (loading) return
    try {
      await deleteChat(id)
      if (chatId === id) {
        setChatId(null)
        setMessages([])
      }
      await refreshChats()
    } catch (e) {
      setError(e.message)
    }
  }

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
    const userMsg = { role: 'user', content: q }
    setQuestion('')
    setMessages((m) => [...m, userMsg])
    setStreaming('')
    setStreamSources([])
    setLoading(true)
    // 用闭包局部变量累积完整答案（回调按序同步触发，无需依赖 state）
    let fullText = ''
    let sources = []
    let roundError = null
    try {
      await askStream(q, kbIds, null, history, (ev) => {
        if (ev.type === 'sources') {
          sources = ev.sources || []
          setStreamSources(sources)
        } else if (ev.type === 'delta') {
          fullText += ev.text
          setStreaming(fullText)
        } else if (ev.type === 'error') {
          throw new Error(ev.message)
        }
      })
      // 流结束：累积文本落为一条完整消息
      setMessages((m) => [...m, { role: 'assistant', content: fullText || '（模型未返回内容）', sources }])
    } catch (e) {
      roundError = e
      setError(e.message)
      // 已有部分内容则保留并标注错误，否则加一条报错消息
      const msg = fullText ? `${fullText}\n\n⚠️ ${e.message}` : `⚠️ ${e.message}`
      setMessages((m) => [...m, { role: 'assistant', content: msg, sources }])
    } finally {
      setStreaming('')
      setLoading(false)
    }
    // 持久化本轮：新会话先创建，再保存完整消息列表
    try {
      let id = chatId
      if (!id) {
        id = (await createChat()).id
        setChatId(id)
      }
      // 完整消息列表 = 本轮前的旧消息（doAsk 开始时捕获）+ 本轮 user + 本轮 assistant
      const assistantMsg = roundError
        ? { role: 'assistant', content: fullText ? `${fullText}\n\n⚠️ ${roundError.message}` : `⚠️ ${roundError.message}`, sources }
        : { role: 'assistant', content: fullText || '（模型未返回内容）', sources }
      await saveChat(id, [...messages, userMsg, assistantMsg])
      await refreshChats()
    } catch (e) {
      console.error('会话保存失败:', e)
    }
  }

  const clearChat = () => {
    setMessages([])
    setStreamSources([])
    setError('')
  }

  const kbName = (id) => kbs.find((k) => k.id === id)?.name || id

  return (
    <div className="chat">
      <aside className="chat-side card">
        <h3>
          历史会话
          <button className="small" onClick={newChat} disabled={loading}>
            ＋ 新建
          </button>
        </h3>
        {chats.length === 0 ? (
          <p className="muted">暂无历史会话</p>
        ) : (
          <ul className="chat-list">
            {chats.map((c) => (
              <li
                key={c.id}
                className={chatId === c.id ? 'chat-item active' : 'chat-item'}
                onClick={() => switchChat(c.id)}
              >
                <span className="chat-title">{c.title || '新会话'}</span>
                <button
                  className="danger small"
                  title="删除该会话"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`确定删除会话「${c.title || '新会话'}」？`)) removeChat(c.id)
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {loadingChat && <p className="muted">加载中…</p>}

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
          {loading && (
            <div className="bubble assistant streaming">
              {streaming ? (
                <>
                  <div className="bubble-text">{streaming}</div>
                  {streamSources.length > 0 && (
                    <details className="sources" open>
                      <summary>引用来源（{streamSources.length}）</summary>
                      {streamSources.map((s) => (
                        <div key={s.index} className="source">
                          <span className="src-tag">[{s.index}]</span>
                          <span className="src-file">{kbName(s.kb_id)} / {s.file}</span>
                          <span className="src-score">相似度 {s.score}</span>
                          <p className="src-text">{s.text}</p>
                        </div>
                      ))}
                    </details>
                  )}
                </>
              ) : (
                <span className="muted">检索中…</span>
              )}
            </div>
          )}
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
