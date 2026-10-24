import React, { useRef, useState } from 'react'
import { api, download, today } from '../api'
import { AiSettings, Head, Icon } from '../components/ui'

export default function Settings({ ctx }) {
  const prefs = ctx.prefs
  const [form, setForm] = useState({ name: prefs.name || '同学', goal: prefs.goal || 5, minutes: prefs.minutes || 25, theme: prefs.theme || 'light' })
  const [stats, setStats] = useState(null)
  const importRef = useRef(null)
  React.useEffect(() => { api.get('/stats').then(setStats).catch(() => {}) }, [ctx.refreshTick])
  React.useEffect(() => { setForm({ name: prefs.name || '同学', goal: prefs.goal || 5, minutes: prefs.minutes || 25, theme: prefs.theme || 'light' }) }, [prefs.name, prefs.goal, prefs.minutes, prefs.theme])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    const upd = { name: form.name.trim(), goal: Number(form.goal), minutes: Number(form.minutes), theme: form.theme }
    await api.post('/prefs', upd)
    ctx.setPrefs({ ...prefs, ...upd })
    ctx.toast('偏好已保存到数据库')
  }
  const doImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!confirm('导入将全量替换当前数据库，确定继续？请确保已导出当前备份。')) return
    try {
      const data = JSON.parse(await file.text())
      const r = await api.post('/import/json', data)
      ctx.toast(`导入完成，共 ${r.imported} 道题`)
      ctx.refresh(); ctx.go('home')
    } catch (err) { ctx.toast(err.message, true) }
  }
  return (<>
    <Head title="偏好与数据" sub="数据保存在 MySQL 数据库中，换浏览器不再丢数据；仍建议定期导出备份。" onNew={ctx.openNew} />
    <div className="twocol">
      <div className="dashleft">
        <section className="card"><div className="sectiontitle"><h2>按你的节奏来</h2></div>
          <form onSubmit={save}><div className="formgrid">
            <div className="formfield"><label>怎么称呼你</label><input value={form.name} onChange={set('name')} maxLength="20" required /></div>
            <div className="formfield"><label>每日复习目标（道）</label><input type="number" min="1" max="100" value={form.goal} onChange={set('goal')} required /></div>
            <div className="formfield"><label>默认专注时长（分钟）</label><input type="number" min="1" max="120" value={form.minutes} onChange={set('minutes')} required /></div>
            <div className="formfield"><label>主题</label>
              <select value={form.theme} onChange={set('theme')}>
                <option value="light">浅色</option>
                <option value="dark">深色（偏好已保存，前端沿用原版浅色样式）</option></select></div>
          </div>
            <div className="btnrow" style={{ marginTop: 14 }}><button className="btn primary" type="submit">保存偏好</button></div></form>
        </section>
        <AiSettings ctx={ctx} />
      </div>
      <div className="dashright">
        <section className="card"><div className="sectiontitle"><h2>数据管理</h2><span className="badge">MySQL</span></div>
          <p className="helper">当前错题 {stats?.total ?? '…'} 道，数据存于 MySQL（Docker 卷 mysql_data）。导出的 JSON 与原版 schema=1 完全兼容，可在原版、旧版与本版之间互相迁移；CSV 不含图片。</p>
          <div className="btnrow" style={{ marginTop: 12, flexDirection: 'column', alignItems: 'stretch' }}>
            <button className="btn" onClick={() => download('/export/json', `错题本-完整备份-${today()}.json`)}><Icon n="download" />导出完整 JSON 备份</button>
            <button className="btn" onClick={() => download('/export/csv', `错题-${today()}.csv`)}><Icon n="download" />导出 CSV（表格查看）</button>
            <button className="btn" onClick={() => importRef.current?.click()}><Icon n="upload" />导入原版 / 本版 JSON 备份（全量替换）</button>
            <button className="btn danger" onClick={async () => {
              if (confirm('清除 18 道示例题？自己录入的题目不受影响。')) { await api.post('/admin/clear-demo'); ctx.toast('示例题已清除'); ctx.refresh() }
            }}>清除 18 道示例题</button>
          </div>
          <input type="file" ref={importRef} accept="application/json,.json" hidden onChange={doImport} />
          <p className="helper" style={{ marginTop: 14 }}>导入会全量替换当前数据库内容（单事务，失败自动回滚），请先导出一份当前备份。</p>
        </section>
      </div>
    </div>
  </>)
}
