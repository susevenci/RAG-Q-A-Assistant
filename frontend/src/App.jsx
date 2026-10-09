import { useEffect, useState } from 'react'
import { listKB } from './api.js'
import KnowledgeBase from './pages/KnowledgeBase.jsx'
import Chat from './pages/Chat.jsx'
import Settings from './pages/Settings.jsx'

const TABS = [
  { key: 'kb', label: '知识库' },
  { key: 'chat', label: '对话' },
  { key: 'settings', label: '设置' },
]

export default function App() {
  const [tab, setTab] = useState('kb')
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
      <header className="topbar">
        <div className="logo">RAG 问答</div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'tab active' : 'tab'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {tab === 'kb' && <KnowledgeBase kbs={kbs} onRefresh={refreshKB} />}
        {tab === 'chat' && <Chat kbs={kbs} onRefresh={refreshKB} />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
