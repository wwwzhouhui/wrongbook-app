import React, { useState } from 'react'
import { api } from '../api'
import { SUBJECTS } from '../components/Editor'
import { Badge, Empty, Head } from '../components/ui'

// 今日复习与随机练习共用一个会话组件；排期与计分都在服务端（/api/review/grade）
export function SessionView({ ctx, list, mode }) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState([])
  if (!list.length) return <Empty t="暂无题目" s="今天没有到期题目，或题库是空的。" />
  if (index >= list.length) {
    const g = results.filter((x) => x === 'good').length
    const h = results.filter((x) => x === 'hard').length
    const a = results.filter((x) => x === 'again').length
    return (<section className="card center" style={{ padding: 34 }}>
      <div className="resultnum">{results.length}</div><h2>本轮完成</h2>
      <p className="muted">掌握了 {g} · 有点模糊 {h} · 还不会 {a}。复习计划已由服务端按间隔规则更新。</p>
      <div className="btnrow" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={() => ctx.go('home')}>回概览</button>
        <button className="btn primary" onClick={() => ctx.go('library')}>去错题库</button></div></section>)
  }
  const q = list[index]
  const grade = async (g) => {
    try {
      const r = await api.post('/review/grade', { qid: q.id, mode, grade: g })
      ctx.toast(r.pointsAwarded ? '已记录，成长值 +5' : '已更新复习计划')
      setResults([...results, g]); setIndex(index + 1); setRevealed(false); ctx.bumpNav()
    } catch (e) { ctx.toast(e.message, true) }
  }
  return (<div className="reviewwrap"><section className="card reviewq">
    <div className="reviewtop"><Badge s={q.subject} /><span>{q.subject} · {q.tag || ''}</span>
      <span className="badge">阶段 {q.stage}</span><span className="muted">第 {index + 1} / {list.length} 题</span></div>
    <div className="questiontext">{q.title}</div>
    {q.image && <img className="qimage" src={q.image} alt="题目附图" />}
    {revealed ? (<>
      <div className="answer"><h3>参考答案</h3><p style={{ whiteSpace: 'pre-wrap' }}>{q.answer}</p>
        <h3>当时错因</h3><p>{q.reason || '—'}（{q.cause || '未分类'}）</p></div>
      <div className="reviewgrade">
        <button className="btn" onClick={() => grade('again')}>还不会 · 明天复习</button>
        <button className="btn" onClick={() => grade('hard')}>有点模糊 · 2 天后</button>
        <button className="btn primary" onClick={() => grade('good')}>掌握了 · 拉长间隔</button></div></>)
      : <div className="btnrow"><button className="btn primary" onClick={() => setRevealed(true)}>看参考答案</button></div>}
  </section></div>)
}

export function Review({ ctx }) {
  const [list, setList] = useState(null)
  React.useEffect(() => { api.get('/review/today').then((d) => setList(d.questions)).catch((e) => ctx.toast(e.message, true)) }, [])
  return (<>
    <Head title="今日复习" sub="先回忆、再看答案、自评决定下一次见面的时间。" onNew={ctx.openNew} />
    {list === null ? <p className="muted">加载中…</p> : <SessionView ctx={ctx} list={list} mode="review" />}
  </>)
}

export function Practice({ ctx }) {
  const [list, setList] = useState(null)
  const [subject, setSubject] = useState('')
  const [count, setCount] = useState(10)
  const [round, setRound] = useState(0)
  const start = async () => {
    const d = await api.get(`/practice/random?count=${count}&subject=${encodeURIComponent(subject)}`)
    if (!d.questions.length) { ctx.toast('题库是空的，先记录几道错题', true); return }
    setList(d.questions); setRound(round + 1)
  }
  return (<>
    <Head title="随机练习" sub="从题库里随机抽题自测，自评规则与今日复习相同。" onNew={ctx.openNew} />
    <section className="card" style={{ marginBottom: 20 }}><div className="formgrid">
      <div className="formfield"><label>学科</label>
        <select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">全部学科</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="formfield"><label>题数</label>
        <input type="number" min="1" max="50" value={count} onChange={(e) => setCount(e.target.value)} /></div>
    </div>
      <div className="btnrow" style={{ marginTop: 16 }}><button className="btn primary" onClick={start}>开始练习</button></div>
      <p className="helper" style={{ marginTop: 12 }}>先自己作答，再看参考答案自评：还不会明天再来，有点模糊 2 天后，掌握了按 1/3/7/14/30 天拉长间隔。每题每天首次自评 +5 分。</p>
    </section>
    {list && <SessionView key={round} ctx={ctx} list={list} mode="practice" />}
  </>)
}
