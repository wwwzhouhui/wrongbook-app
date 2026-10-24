import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { SUBJECTS } from '../components/Editor'
import { Empty, Head, Icon, QuestionCard } from '../components/ui'

export default function Library({ ctx }) {
  const [list, setList] = useState([])
  const [f, setF] = useState({ subject: '', status: '', query: '', favorite: false, sort: 'due', trash: false })
  const load = async () => {
    const qs = new URLSearchParams()
    if (f.subject) qs.set('subject', f.subject)
    if (f.status) qs.set('status', f.status)
    if (f.query) qs.set('q', f.query)
    if (f.favorite) qs.set('favorite', 'true')
    qs.set('sort', f.sort)
    qs.set('deleted', f.trash ? 'true' : 'false')
    setList((await api.get('/questions?' + qs)).questions)
  }
  useEffect(() => { load().catch((e) => ctx.toast(e.message, true)) }, [f, ctx.refreshTick])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const printList = () => {
    const w = window.open('', '_blank')
    w.document.write(`<title>拾光错题打印</title><style>body{font:14px/1.9 sans-serif;max-width:850px;margin:30px auto;padding:0 20px}.q{border-bottom:1px solid #ddd;padding:14px 0}</style>` +
      list.map((q, i) => `<div class="q"><h3>${i + 1}. [${q.subject}] ${q.title}</h3><p><strong>答案：</strong>${q.answer}</p><p>错因：${q.reason || ''} · 知识点：${q.tag || ''}</p></div>`).join('') +
      '<button onclick="window.print()">打印 / 保存 PDF</button>')
    w.document.close()
  }
  return (<>
    <Head title={f.trash ? '回收站' : '我的错题库'} sub={f.trash ? '删除的题目先放在这里，可恢复或彻底删除。' : '按学科、状态筛选，或搜索题目、知识点与错因。'} onNew={ctx.openNew} />
    <section className="card filters"><div className="btnrow">
      <span className="searchbox"><Icon n="search" />
        <input placeholder="搜索题目 / 知识点 / 错因" value={f.query}
          onChange={(e) => setF({ ...f, query: e.target.value })} /></span>
      <select value={f.subject} onChange={set('subject')}><option value="">全部学科</option>
        {SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
      <select value={f.status} onChange={set('status')}><option value="">全部状态</option>
        <option value="learning">巩固中</option><option value="mastered">已掌握</option><option value="due">已到期</option></select>
      <select value={f.sort} onChange={set('sort')}>
        <option value="due">按复习日期</option><option value="newest">最新收录</option><option value="subject">按学科</option></select>
      <button className={`btn small ${f.favorite ? 'primary' : ''}`} onClick={() => setF({ ...f, favorite: !f.favorite })}>★ 只看收藏</button>
      <button className="btn small" onClick={() => setF({ ...f, trash: !f.trash })}>{f.trash ? '返回错题库' : '回收站'}</button>
      <button className="btn small" onClick={printList}><Icon n="print" />打印当前列表</button>
    </div></section>
    <p className="muted" style={{ margin: '14px 2px' }}>共 {list.length} 道</p>
    {f.trash ? (list.length ? <div className="librarygrid">{list.map((q) => (
      <article key={q.id} className="card questioncard"><h3 className="qtitle">{q.title}</h3>
        <div className="cardfoot"><span className="muted">{q.subject} · {q.tag || ''}</span>
          <span className="btnrow">
            <button className="btn small" onClick={async () => { await api.post(`/questions/${q.id}/restore`); ctx.refresh() }}>恢复</button>
            <button className="btn small danger" onClick={async () => {
              if (confirm('彻底删除？此操作不可恢复。')) { await api.post(`/questions/${q.id}/permanent`); ctx.refresh() }
            }}>彻底删除</button></span></div></article>))}</div>
      : <Empty t="回收站是空的" s="" />)
      : (list.length ? <div className="librarygrid">{list.map((q) => <QuestionCard key={q.id} q={q} ctx={{ ...ctx, refresh: load }} />)}</div>
        : <Empty t="没有符合条件的错题" s="换个筛选条件，或记录一道新错题。" />)}
  </>)
}
