import React, { useEffect, useState } from 'react'
import { api, pretty, today } from '../api'
import { Empty, Head, Metric, QRow } from '../components/ui'

export function CalendarPage({ ctx }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(today())
  const [data, setData] = useState({ planned: {}, done: {} })
  const [planned, setPlanned] = useState([])
  const [logs, setLogs] = useState([])
  const ym = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  useEffect(() => { api.get('/calendar?month=' + ym).then(setData).catch(() => {}) }, [ym, ctx.refreshTick])
  useEffect(() => {
    api.get('/questions?sort=due').then((d) => setPlanned(d.questions.filter((q) => q.due === selected))).catch(() => {})
    api.get('/logs?date=' + selected).then((d) => setLogs(d.logs)).catch(() => {})
  }, [selected, ctx.refreshTick])
  const y = month.getFullYear(), m = month.getMonth()
  const off = (new Date(y, m, 1).getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(y, m, 1 - off + i)
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { d, s, out: d.getMonth() !== m }
  })
  const detail = async (q) => ctx.openDetail(q)
  return (<>
    <Head title="复习日历" sub="把每一次回顾，放在看得见的日子里。" onNew={ctx.openNew} />
    <div className="twocol">
      <section className="card">
        <div className="calendarheader"><h2>{y} 年 {m + 1} 月</h2>
          <div className="btnrow">
            <button className="btn small" onClick={() => setMonth(new Date(y, m - 1, 1))}>上个月</button>
            <button className="btn small" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelected(today()) }}>今天</button>
            <button className="btn small" onClick={() => setMonth(new Date(y, m + 1, 1))}>下个月</button></div></div>
        <div className="calendargrid">
          {'一二三四五六日'.split('').map((x) => <div key={x} className="dayname">周{x}</div>)}
          {cells.map(({ d, s, out }) => (
            <button key={s} className={`calday ${out ? 'out' : ''} ${s === selected ? 'selected' : ''} ${s === today() ? 'today' : ''}`}
              onClick={() => setSelected(s)}>
              <span className="date">{d.getDate()}</span>
              {!!data.planned[s] && <small style={{ color: 'var(--orange)' }}>{data.planned[s]} 道计划</small>}
              {!!data.done[s] && <small style={{ color: 'var(--green)' }}>已学 {data.done[s]}</small>}
            </button>))}
        </div>
      </section>
      <aside className="card">
        <div className="sectiontitle"><h2>{pretty(selected)}</h2><span className="badge">{planned.length} 道计划</span></div>
        {planned.length ? planned.map((q) => <QRow key={q.id} q={q} onClick={() => detail(q)} />) : <Empty t="这一天还没有复习计划" s="" />}
        <h3 style={{ margin: '22px 0 10px' }}>当天学习记录</h3>
        {logs.length ? <div className="loglist">{logs.slice().reverse().map((l) => (
          <div key={l.id} className="logitem"><span>{l.label}</span><span className="muted">{l.points ? `+${l.points} 分` : ''}</span></div>))}</div>
          : <p className="helper">暂无记录。</p>}
      </aside>
    </div>
  </>)
}

export function Stats({ ctx }) {
  const [st, setSt] = useState(null)
  useEffect(() => { api.get('/stats').then(setSt).catch((e) => ctx.toast(e.message, true)) }, [ctx.refreshTick])
  if (!st) return <p className="muted">加载中…</p>
  const max = Math.max(5, ...st.week.map((w) => w.count))
  return (<>
    <Head title="学习统计" sub="看看走过的路，也看看下一步往哪儿走。" onNew={ctx.openNew} />
    <div className="metrics">
      <Metric label="掌握率" value={st.rate} note="连续 3 次掌握计入" ico="chart" unit="%" />
      <Metric label="累计复习" value={st.reviews} note="含随机练习" ico="review" unit="次" />
      <Metric label="连续学习" value={st.streak} note="" ico="leaf" unit="天" />
      <Metric label="可用积分" value={st.balance} note="" ico="gift" unit="分" />
    </div>
    <div className="twocol">
      <div className="dashleft">
        <section className="card"><div className="sectiontitle"><h2>最近 7 天的回顾</h2><small>单位：次</small></div>
          <div className="bars">{st.week.map((w) => (
            <div key={w.date} className="barcol"><span>{w.count}</span>
              <i style={{ height: Math.max(3, (w.count / max) * 120) + 'px' }} /><span>{pretty(w.date)}</span></div>))}</div></section>
        <section className="card"><div className="sectiontitle"><h2>各科学习进度</h2><small>已掌握 / 总数</small></div>
          {st.subjects.map((s) => (
            <div key={s.subject} className="breakrow"><span>{s.subject}</span>
              <div className="progress"><i style={{ width: (s.total ? (s.mastered / s.total) * 100 : 0) + '%' }} /></div>
              <span className="muted" style={{ textAlign: 'right' }}>{s.mastered} / {s.total}</span></div>))}</section>
      </div>
      <div className="dashright">
        <section className="card"><div className="sectiontitle"><h2>还没掌握的原因</h2><span className="badge orange">薄弱点</span></div>
          {Object.keys(st.causes).length ? Object.entries(st.causes).map(([c, n]) => (
            <div key={c} className="breakrow"><span>{c}</span><span /><span className="muted" style={{ textAlign: 'right' }}>{n} 道</span></div>))
            : <Empty t="没有未掌握题目" s="" />}</section>
      </div>
    </div>
  </>)
}
