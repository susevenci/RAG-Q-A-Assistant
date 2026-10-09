import { useRef, useState } from 'react'
import { createKB, deleteKB, uploadFile } from '../api.js'

export default function KnowledgeBase({ kbs, onRefresh }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeKB, setActiveKB] = useState(null)
  const [uploading, setUploading] = useState(null)
  const fileRef = useRef(null)

  const doCreate = async () => {
    if (!name.trim()) return
    setBusy(true)
    setMsg('')
    try {
      await createKB(name, desc)
      setName('')
      setDesc('')
      await onRefresh()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async (kb) => {
    if (!confirm(`确定删除知识库「${kb.name}」及其所有文件？`)) return
    try {
      await deleteKB(kb.id)
      if (activeKB === kb.id) setActiveKB(null)
      await onRefresh()
    } catch (e) {
      alert(e.message)
    }
  }

  const doUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !activeKB) return
    for (const file of files) {
      setUploading(file.name)
      try {
        const r = await uploadFile(activeKB, file)
        setMsg(`「${file.name}」已入库，${r.chunks} 个片段`)
      } catch (err) {
        setMsg(`「${file.name}」失败: ${err.message}`)
      }
    }
    setUploading(null)
    e.target.value = ''
    await onRefresh()
  }

  const active = kbs.find((k) => k.id === activeKB)

  return (
    <div className="page">
      <div className="page-doc">
        <h1 className="page-title">知识库</h1>

        <section className="block">
          <h2>新建</h2>
          <div className="row">
            <input
              placeholder="知识库名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="描述（可选）"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <button className="btn-primary" onClick={doCreate} disabled={busy || !name.trim()}>
              创建
            </button>
          </div>
        </section>

        <section className="block">
          <h2>全部知识库</h2>
          {kbs.length === 0 && <p className="muted">暂无知识库，先创建一个吧。</p>}
          <ul className="kb-list">
            {kbs.map((kb) => (
              <li key={kb.id}>
                <div className="kb-row" onClick={() => setActiveKB(activeKB === kb.id ? null : kb.id)}>
                  <span className="kb-name">{kb.name}</span>
                  <span className="kb-meta mono">
                    {kb.files.length} 文件 · {kb.files.reduce((n, f) => n + (f.chunks || 0), 0)} 片段
                  </span>
                  <button
                    className="btn-del"
                    onClick={(e) => {
                      e.stopPropagation()
                      doDelete(kb)
                    }}
                  >
                    删除
                  </button>
                </div>
                {activeKB === kb.id && (
                  <div className="kb-detail">
                    <p className="muted">{kb.description || '暂无描述'}</p>
                    <div className="row">
                      <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
                        上传文件
                      </button>
                      <span className="muted">支持 .txt .md .csv .pdf .docx 等</span>
                      {uploading && <span className="msg">正在处理 {uploading} …</span>}
                      {msg && <span className="msg">{msg}</span>}
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      accept=".txt,.md,.markdown,.csv,.json,.log,.pdf,.docx"
                      style={{ display: 'none' }}
                      onChange={doUpload}
                    />
                    {active && active.files.length > 0 && (
                      <ul className="file-list">
                        {active.files.map((f) => (
                          <li key={f.name}>
                            <span className="file-name">{f.name}</span>
                            <span className="muted mono">{f.chunks} 片段</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
