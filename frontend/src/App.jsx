import { useEffect, useState } from 'react'
import { listKB } from './api.js'
import KnowledgeBase from './pages/KnowledgeBase.jsx'
import Chat from './pages/Chat.jsx'
import Settings from './pages/Settings.jsx'

const TABS = [
  { key: 'chat', label: '对话' },
  { key: 'kb', label: '知识库' },
  { key: 'settings', label: '设置' },
]

// 支持 ?tab=chat 深链，便于直达某一页
function initialTab() {
  const t = new URLSearchParams(window.location.search).get('tab')
  return TABS.some((x) => x.key === t) ? t : 'kb'
}

export default function App() {
  const [tab, setTab] = useState(initialTab)
  const [kbs, setKbs] = useState([])

  const refreshKB = async () => {
    try {
      setKbs(await listKB())
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    refreshKB()
  }, [])

  return (
    <div className="app">
      <aside className="rail">
        <div className="wordmark">
          RAG 问答
          <span className="sub">证据工作台</span>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'active' : ''}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {/* 对话页的会话列表与证据来源勾选，经 portal 注入到轨内 */}
        <div id="rail-context" className="rail-context" />
      </aside>

      <main className="content">
        {tab === 'kb' && <KnowledgeBase kbs={kbs} onRefresh={refreshKB} />}
        {tab === 'chat' && <Chat kbs={kbs} onRefresh={refreshKB} />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
