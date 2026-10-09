import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { askStream, listChats, createChat, getChat, saveChat, deleteChat } from '../api.js'

// 把回答正文里的 [n] 角标渲染成可悬停联动的引用芯片
function withCites(text, lit, setLit) {
  const parts = text.split(/(\[\d{1,2}\])/g)
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d{1,2})\]$/)
    if (!m) return <span key={i}>{p}</span>
    const n = Number(m[1])
    return (
      <button
        key={i}
        type="button"
        className={lit === n ? 'cite lit' : 'cite'}
        onMouseEnter={() => setLit(n)}
        onMouseLeave={() => setLit(null)}
        onClick={() => setLit(n)}
      >
        {n}
      </button>
    )
  })
}

// 渲染回答正文，拆出末尾的报错标注
function renderBody(text, lit, setLit) {
  const wi = text.indexOf('⚠️')
  if (wi === -1) return withCites(text, lit, setLit)
  return (
    <>
      {withCites(text.slice(0, wi), lit, setLit)}
      <span className="warn">{text.slice(wi)}</span>
    </>
  )
}

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
  // ---- 证据工作台 ----
  const [railEl, setRailEl] = useState(null) // 左轨 portal 挂载点
  const [lit, setLit] = useState(null) // 当前悬停联动的引用编号
  const [activeMsgIdx, setActiveMsgIdx] = useState(null) // 摊在证据栏的回答索引

  useEffect(() => {
    setRailEl(document.getElementById('rail-context'))
  }, [])

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
      setActiveMsgIdx(null)
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
    setActiveMsgIdx(null)
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
      setError('请在左轨勾选至少一个知识库作为回答来源')
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
      setActiveMsgIdx(null) // 新回答自动成为证据栏当前展品
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
    setActiveMsgIdx(null)
    setError('')
  }

  const kbName = (id) => kbs.find((k) => k.id === id)?.name || id

  // ---- 证据栏：当前摊开的回答与其展品 ----
  const lastSrcIdx = messages.reduce(
    (acc, m, i) => (m.role === 'assistant' && m.sources && m.sources.length ? i : acc),
    -1
  )
  const activeIdx = activeMsgIdx != null ? activeMsgIdx : lastSrcIdx
  const shownSources = loading
    ? streamSources
    : activeIdx >= 0
      ? messages[activeIdx].sources || []
      : []
  const questionFor = (idx) => {
    for (let i = idx - 1; i >= 0; i--) if (messages[i].role === 'user') return messages[i].content
    return ''
  }
  const shownQuestion = loading
    ? questionFor(messages.length)
    : activeIdx >= 0
      ? questionFor(activeIdx)
      : ''

  return (
    <>
      <div className="workbench">
        <section className="answer-col">
          <div className="answer-toolbar">
            <span className="muted">多轮对话 · 回答基于左轨勾选的知识库</span>
            <button className="btn-ghost" onClick={clearChat} disabled={messages.length === 0}>
              清空对话
            </button>
          </div>

          <div className="answer-scroll">
            {messages.length === 0 && !loading && (
              <p className="muted center">勾选知识库后，在此提问。回答会带编号引用，对应右侧展品。</p>
            )}
            <div className="answer-stream">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="msg-user">
                    {m.content}
                  </div>
                ) : (
                  <div
                    key={i}
                    className={
                      'msg-assistant' +
                      (m.sources && m.sources.length ? ' has-src' : '') +
                      (i === activeIdx && !loading ? ' active-src' : '')
                    }
                    title={m.sources && m.sources.length ? '点击在证据栏摊开这轮展品' : undefined}
                    onClick={() => m.sources && m.sources.length && setActiveMsgIdx(i)}
                  >
                    {renderBody(m.content, lit, setLit)}
                  </div>
                )
              )}
              {loading && (
                <div className="msg-assistant streaming">
                  {streaming ? (
                    withCites(streaming, lit, setLit)
                  ) : (
                    <span className="streaming-hint">检索中…</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <p className="error" style={{ margin: '0 32px' }}>{error}</p>}

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
            <button className="btn-primary" onClick={doAsk} disabled={loading || !question.trim()}>
              发送
            </button>
          </div>
        </section>

        <aside className="evidence-col">
          <div className="evidence-head">
            <h3>证据 · {shownSources.length} 件展品</h3>
            {shownQuestion && <p className="evidence-q">支持主张：{shownQuestion}</p>}
          </div>
          {shownSources.length === 0 ? (
            <p className="evidence-empty">
              {loading ? '正在检索知识库…' : '检索到的片段会摊在这里，编号与正文角标一一对应。'}
            </p>
          ) : (
            shownSources.map((s) => (
              <div
                key={s.index}
                className={lit === s.index ? 'exhibit lit' : 'exhibit'}
                onMouseEnter={() => setLit(s.index)}
                onMouseLeave={() => setLit(null)}
              >
                <div className="exhibit-head">
                  <span className="ex-num">{String(s.index).padStart(2, '0')}</span>
                  <span className="ex-file">{s.file}</span>
                  <span className="ex-kb">{kbName(s.kb_id)}</span>
                </div>
                <div className="sim-row">
                  <span className="sim-label">相似度</span>
                  <div className="sim-bar">
                    <div
                      className="sim-fill"
                      style={{ width: `${Math.max(0, Math.min(1, Number(s.score) || 0)) * 100}%` }}
                    />
                  </div>
                  <span className="sim-val">{Number(s.score).toFixed(3)}</span>
                </div>
                <p className="ex-text">{s.text}</p>
              </div>
            ))
          )}
        </aside>
      </div>

      {/* 会话列表 + 证据来源勾选：注入左轨 */}
      {railEl &&
        createPortal(
          <div className="rail-panel">
            <section>
              <h4>
                会话
                <button className="rail-mini" onClick={newChat} disabled={loading}>
                  ＋ 新建
                </button>
              </h4>
              {chats.length === 0 ? (
                <p className="rail-empty">暂无历史会话</p>
              ) : (
                <ul className="rail-list">
                  {chats.map((c) => (
                    <li
                      key={c.id}
                      className={chatId === c.id ? 'active' : ''}
                      onClick={() => switchChat(c.id)}
                    >
                      <span className="rail-title">{c.title || '新会话'}</span>
                      <button
                        className="btn-del"
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
              {loadingChat && <p className="rail-empty">加载中…</p>}
            </section>

            <section>
              <h4>证据来源</h4>
              {kbs.length === 0 ? (
                <p className="rail-empty">暂无知识库，请先到「知识库」创建并上传文件。</p>
              ) : (
                <ul className="rail-check">
                  <li>
                    <label>
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                      全选
                    </label>
                  </li>
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
              )}
            </section>
          </div>,
          railEl
        )}
    </>
  )
}
