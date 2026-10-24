import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { Empty, Head, Metric, QRow } from '../components/ui'

export default function Home({ ctx }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    Promise.all([api.get('/stats'), api.get('/review/today'), api.get('/questions?sort=newest')])
      .then(([st, due, all]) => setData({ st, due: due.questions, recent: all.questions.slice(0, 4) }))
      .catch((e) => ctx.toast(e.message, true))
  }, [])
  if (!data) return <p className="muted">加载中…</p>
  const { st, due, recent } = data
  const detail = async (id) => {
    const all = (await api.get('/questions?sort=due')).questions
    const q = all.find((x) => x.id === id)
    if (q) ctx.openDetail(q)
  }
  return (<>
    <Head title="学习概览" sub={`你好，${ctx.prefs.name || '同学'}。把错题变成会题，一天一点点。`} onNew={ctx.openNew} />
    <div className="metrics">
      <Metric label="今日待复习" value={st.due} note="到期题目在「今日复习」" ico="review" unit="道" />
      <Metric label="今日已复习" value={st.reviewedToday} note={`每日目标 ${ctx.prefs.goal || 5} 道`} ico="check" unit="道" />
      <Metric label="掌握率" value={st.rate} note="连续 3 次掌握计入" ico="chart" unit="%" />
      <Metric label="可用积分" value={st.balance} note={'成长值 ' + st.growth} ico="gift" unit="分" />
    </div>
    <div className="twocol">
      <div className="dashleft"><section className="card">
        <div className="sectiontitle"><h2>今日复习</h2>
          <button className="btn small primary" onClick={() => ctx.go('review')}>开始复习</button></div>
        {due.length ? due.slice(0, 5).map((q) => <QRow key={q.id} q={q} onClick={() => detail(q.id)} />)
          : <Empty t="今天没有到期题目" s="可以去随机练习保持手感。" />}
      </section></div>
      <div className="dashright">
        <section className="card"><div className="sectiontitle"><h2>最近收录</h2></div>
          {recent.length ? recent.map((q) => <QRow key={q.id} q={q} onClick={() => detail(q.id)} />)
            : <Empty t="还没有错题" s="点右上角记录第一道错题吧。" />}</section>
        <section className="card"><h2>连续学习 {st.streak} 天</h2>
          <p className="muted">今日专注 {st.focusToday} 分钟 · 累计复习 {st.reviews} 次 · 错题共 {st.total} 道</p></section>
      </div>
    </div>
  </>)
}
