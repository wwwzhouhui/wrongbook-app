import React from 'react'
import { aiKeys, api } from '../api'

export const ICONS = { book: 'M4 4h6a3 3 0 0 1 2 2v15a4 4 0 0 0-4-2H3V4Zm16 0h-6a2 2 0 0 0-2 2m0 15a4 4 0 0 1 4-2h5V4h-1', home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z', layers: 'm12 3 10 6-10 6L2 9Zm-9 11 9 6 9-6M3 18l9 5 9-5', review: 'M3 10a9 9 0 1 1 1 8M3 4v6h6m3-3v5l3 2', dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01', calendar: 'M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1 1-1V6a1 1 0 0 1 1-1Zm3-3v6m10-6v6M3 11h18', chart: 'M4 3v18h18M8 16v-4m5 4V7m5 9v-6', pet: 'M8 10C3 3 1 6 3 13m13-3c5-7 7-4 5 3M5 13c0-5 14-5 14 0v4c0 6-14 6-14 0Zm4 2h.01m6-.01h.01m-5 3h4', timer: 'M9 2h6m-3 0v3m5 2 2-2m1 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5v5l3 1', settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-3-5h6l1 3 3 1 2 5-2 3-1 4-5 2-3-2-4-1-2-5 2-3 1-4Z', plus: 'M12 5v14M5 12h14', search: 'M20 20l-5-5m2-6A7 7 0 1 1 3 9a7 7 0 0 1 14 0Z', close: 'm6 6 12 12M6 18 18 6', edit: 'm14 4 6 6M4 20l5-1L21 7l-5-5L4 14Z', trash: 'M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', upload: 'M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5', print: 'M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6Z', check: 'm4 12 5 5L20 6', leaf: 'M20 3c1 12-4 17-10 16C-1 17 1 5 20 3ZM4 21 16 9', gift: 'M3 8h18v4H3Zm2 4v9h14v-9M12 8v13m0-13c-9 0-7-8-3-5l3 5Zm0 0c9 0 7-8 3-5l-3 5', target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-4 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-5 0h.01', camera: 'M4 8h3l2-3h6l2 3h3v11H4Zm8 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l3 2' }
export const Icon = ({ n }) => (<svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[n] || ICONS.book} /></svg>)

export const SUBJ_STYLE = { 语文: ['文', '#f5e7d8', '#a27743'], 数学: ['π', '#e4eadc', '#69804f'], 英语: ['Aa', '#e0ebed', '#5b8190'], 物理: ['φ', '#e8e3ee', '#88709b'], 化学: ['化', '#eee8d7', '#9e8b4d'], 生物: ['生', '#e1ecdf', '#638b62'], 历史: ['史', '#f4e2dc', '#a77768'], 地理: ['地', '#dfe9e5', '#5f8c7a'], 道法: ['法', '#e6e6eb', '#787994'] }
export const Badge = ({ s }) => { const a = SUBJ_STYLE[s] || SUBJ_STYLE['语文']; return <span className="subjecticon" style={{ '--tone': a[1], '--tc': a[2] }}>{a[0]}</span> }
export const mastered = (q) => q.stage >= 3

export function Head({ title, sub, children, onNew }) {
  return (<div className="pagehead"><div><h1>{title}</h1><p>{sub}</p></div>
    <div className="btnrow">{children}<button className="btn primary" onClick={onNew}><Icon n="plus" />记录错题</button></div></div>)
}
export const Metric = ({ label, value, note, ico, unit = '' }) => (
  <div className="card metric"><div className="label"><Icon n={ico} />{label}</div>
    <div className="value">{value}<span className="unit">{unit}</span></div><p className="muted">{note}</p></div>)
export const Empty = ({ t, s }) => (<div className="empty"><h3>{t}</h3><p>{s}</p></div>)

export function QRow({ q, onClick }) {
  return (<div className="qrow" onClick={onClick}>
    <div className="qmeta"><Badge s={q.subject} /><span>{q.subject}</span>
      <span className={`badge ${mastered(q) ? '' : 'orange'}`}>{mastered(q) ? '已掌握' : '巩固中'}</span>
      {q.favorite && <span className="badge warm">★ 收藏</span>}</div>
    <div className="qtitle clamp">{q.title}</div>
    <div className="qmeta"><span>{q.tag || '未填知识点'}</span><span>复习：{q.due.slice(5).replace('-', '月')}日</span></div></div>)
}

export function QuestionCard({ q, ctx }) {
  return (<article className="card questioncard">
    <div className="qmeta"><Badge s={q.subject} /><span>{q.subject}</span><span className="badge">{q.difficulty}</span>
      <span className={`badge ${mastered(q) ? '' : 'orange'}`}>{mastered(q) ? '已掌握' : `巩固中 · 阶段 ${q.stage}`}</span>
      <button className={`textbtn star ${q.favorite ? 'on' : ''}`} title="收藏"
        onClick={async () => { await api.post(`/questions/${q.id}/favorite`); ctx.refresh() }}>★</button></div>
    <h3 className="qtitle" onClick={() => ctx.openDetail(q)}>{q.title}</h3>
    {q.image && <img className="qimage" src={q.image} alt="题目附图" />}
    <p className="reason"><strong>错因：</strong>{q.reason || '—'}（{q.cause || '未分类'}）</p>
    <div className="cardfoot"><span className="muted">知识点：{q.tag || '—'} · {q.due.slice(5)}复习</span>
      <span className="btnrow">
        <button className="btn small" onClick={() => ctx.openDetail(q)}>详情</button>
        <button className="btn small" onClick={() => ctx.go('variations', q.id)}>举一反三</button>
        <button className="btn small" onClick={() => ctx.openEditor(q)}><Icon n="edit" />编辑</button>
        <button className="btn small danger" onClick={async () => {
          if (confirm('移入回收站？')) { await api.del(`/questions/${q.id}`); ctx.toast('已移入回收站'); ctx.refresh() }
        }}><Icon n="trash" /></button>
      </span></div></article>)
}

/** AI 设置块（拍照录题 / 举一反三 / 设置页共用）。密钥只存页面内存。 */
export function AiSettings({ ctx }) {
  const prefs = ctx.prefs
  const provider = prefs.ai_provider || 'qwen'
  const [key, setKey] = React.useState('')
  const [status, setStatus] = React.useState('')
  const save = async () => {
    const upd = { ai_provider: provider }
    upd[`ai_${provider}_endpoint`] = document.getElementById('ai_endpoint').value.trim()
    upd[`ai_${provider}_vision`] = document.getElementById('ai_vision').value.trim()
    upd[`ai_${provider}_text`] = document.getElementById('ai_text').value.trim()
    if (key) aiKeys[provider] = key.trim()
    await api.post('/prefs', upd)
    ctx.setPrefs({ ...prefs, ...upd })
    ctx.toast('AI 设置已保存（密钥仅在本页内存）')
  }
  const switchProvider = async (p) => {
    await api.post('/prefs', { ai_provider: p })
    ctx.setPrefs({ ...prefs, ai_provider: p })
  }
  const test = async () => {
    setStatus('测试中…')
    try {
      const c = ctx.aiCfg()
      const r = await api.post('/ai/chat', { provider: c.provider, endpoint: c.endpoint, apiKey: c.key || undefined, request: { model: c.text, messages: [{ role: 'user', content: '只回复 OK' }], max_tokens: 10 } })
      setStatus(r.choices ? '连接成功：文本模型可用。请再用一道真实错题试识别确认视觉模型。' : '已返回，但格式异常')
    } catch (e) { setStatus('失败：' + e.message) }
  }
  return (<section className="card" style={{ marginBottom: 20 }}>
    <div className="sectiontitle"><h2>AI 设置</h2><span className="badge">{provider === 'qwen' ? '通义千问' : 'DeepSeek'}</span></div>
    <div className="formgrid">
      <div className="formfield"><label>AI 服务商</label>
        <select value={provider} onChange={(e) => switchProvider(e.target.value)}>
          <option value="qwen">通义千问</option><option value="deepseek">DeepSeek</option></select></div>
      <div className="formfield"><label>接口地址</label><input id="ai_endpoint" defaultValue={prefs[`ai_${provider}_endpoint`] || ''} /></div>
      <div className="formfield"><label>视觉识别模型</label><input id="ai_vision" defaultValue={prefs[`ai_${provider}_vision`] || ''} /></div>
      <div className="formfield"><label>文本出题模型</label><input id="ai_text" defaultValue={prefs[`ai_${provider}_text`] || ''} /></div>
      <div className="formfield span2"><label>API Key（只保留在当前页面内存，不入库、不进备份；也可由后端环境变量 DASHSCOPE_API_KEY / DEEPSEEK_API_KEY 提供）</label>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={aiKeys[provider] ? '已填写（刷新后需重填）' : '粘贴所选服务商的 API Key'} autoComplete="off" /></div>
    </div>
    <div className="btnrow" style={{ marginTop: 12 }}>
      <button className="btn" onClick={save}>保存设置</button>
      <button className="btn" onClick={test}>测试连接</button></div>
    {status && <p className="helper">{status}</p>}
  </section>)
}
