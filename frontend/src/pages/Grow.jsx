import React, { useEffect, useRef, useState } from 'react'
import { api, today } from '../api'
import { Head } from '../components/ui'

export function Pet({ ctx }) {
  const [data, setData] = useState(null)
  const [name, setName] = useState('')
  const [cost, setCost] = useState(50)
  const load = () => api.get('/rewards').then(setData).catch((e) => ctx.toast(e.message, true))
  useEffect(load, [ctx.refreshTick])
  if (!data) return <p className="muted">加载中…</p>
  return (<>
    <Head title="成长小伙伴" sub="积分来自真实的学习：新题 +3、每日首次复习 +5、专注每分钟 +1（单次封顶 30）。" onNew={ctx.openNew} />
    <div className="twocol">
      <section className="card petcard">
        <div className="petart" style={{ fontSize: 96, lineHeight: 1.2 }}>🦊</div>
        <div className="petname">拾拾</div>
        <p className="petcaption">可用积分 <strong>{data.balance}</strong> 分 · 累计成长值 {data.growth} 分（兑换不扣成长值）</p>
      </section>
      <section className="card">
        <div className="sectiontitle"><h2>奖励兑换</h2></div>
        {data.rewards.map((r) => (
          <div key={r.id} className="reward"><span>{r.name} · {r.cost} 分</span>
            <button className={`btn small ${data.balance >= r.cost ? 'primary' : ''}`} disabled={data.balance < r.cost}
              onClick={async () => { await api.post(`/rewards/${r.id}/redeem`); ctx.toast('兑换成功，去享受你的奖励吧'); load(); ctx.bumpNav() }}>兑换</button></div>))}
        <form className="formgrid" style={{ marginTop: 18 }} onSubmit={async (e) => {
          e.preventDefault(); await api.post('/rewards', { name, cost: Number(cost) }); setName(''); load()
        }}>
          <div className="formfield"><label>奖励名称</label><input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="formfield"><label>所需积分</label><input type="number" min="1" max="10000" required value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          <div className="formfield"><label>&nbsp;</label><button className="btn" type="submit">添加奖励</button></div>
        </form>
        <h3 style={{ margin: '22px 0 10px' }}>兑换记录</h3>
        {data.redemptions.length ? data.redemptions.map((r) => (
          <div key={r.id} className="logitem"><span>{r.name}</span><span className="muted">{r.date} · -{r.cost} 分</span></div>))
          : <p className="helper">暂无兑换记录。</p>}
      </section>
    </div>
  </>)
}

export function Focus({ ctx }) {
  const total0 = (ctx.prefs.minutes || 25) * 60
  const [left, setLeft] = useState(total0)
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [mins, setMins] = useState(ctx.prefs.minutes || 25)
  const [todayMin, setTodayMin] = useState(0)
  const state = useRef({ left: total0, running: false, startedMin: 0 })
  useEffect(() => { api.get('/stats').then((s) => setTodayMin(s.focusToday)).catch(() => {}) }, [ctx.refreshTick])
  useEffect(() => {
    const t = setInterval(async () => {
      if (!state.current.running) return
      state.current.left -= 1
      setLeft(state.current.left)
      if (state.current.left <= 0) {
        const doneMin = state.current.startedMin
        state.current = { left: total0, running: false, startedMin: 0 }
        setRunning(false); setStarted(false); setLeft(total0)
        const r = await api.post('/focus', { minutes: doneMin })
        ctx.toast(`专注完成，成长值 +${r.pointsAwarded}`); ctx.bumpNav()
        api.get('/stats').then((s) => setTodayMin(s.focusToday)).catch(() => {})
      }
    }, 1000)
    return () => clearInterval(t)
  }, [total0])
  const toggle = () => {
    if (!started) {
      const m = Math.min(120, Math.max(1, Number(mins) || 25))
      state.current = { left: m * 60, running: true, startedMin: m }
      setLeft(m * 60); setStarted(true); setRunning(true)
    } else {
      state.current.running = !running; setRunning(!running)
    }
  }
  const reset = () => { state.current = { left: total0, running: false, startedMin: 0 }; setRunning(false); setStarted(false); setLeft(total0) }
  const total = started ? state.current.startedMin * 60 : total0
  return (<>
    <Head title="专注时光" sub="关掉一点干扰，给自己一段完整的时间。完成整轮才记积分：每分钟 +1，单次最多 +30。" onNew={ctx.openNew} />
    <div className="twocol">
      <section className="card center" style={{ padding: 30 }}>
        <div className="eyebrow">ONE THING AT A TIME</div>
        <div className="timerface">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div>
        <p className="muted">{started ? (running ? '正在专注，拾拾陪着你。' : '已暂停，准备好了再继续。') : '选好时长，从一件小事开始。'}</p>
        <div className="timerline"><i style={{ width: (total ? (1 - left / total) * 100 : 0) + '%' }} /></div>
        <div className="btnrow" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={toggle}>{started ? (running ? '暂停' : '继续专注') : '开始专注'}</button>
          <button className="btn" onClick={reset} disabled={!started}>放弃本轮</button></div>
        <div className="formfield" style={{ maxWidth: 200, margin: '26px auto 0', textAlign: 'left' }}>
          <label>专注时长（1–120 分钟）</label>
          <input type="number" min="1" max="120" value={mins} disabled={started} onChange={(e) => setMins(e.target.value)} /></div>
      </section>
      <section className="card">
        <div className="sectiontitle"><h2>今天的专注</h2><span className="badge">{todayMin} 分钟</span></div>
        <p className="quote">不追赶时间，<br />只认真过好这一刻。</p>
      </section>
    </div>
  </>)
}
