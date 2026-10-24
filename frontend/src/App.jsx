import React, { useCallback, useEffect, useRef, useState } from 'react'
import { aiKeys, api } from './api'
import { DetailModal, EditorModal } from './components/Editor'
import { Icon } from './components/ui'
import { Capture, Variations } from './pages/AiPages'
import { CalendarPage, Stats } from './pages/CalendarStats'
import { Focus, Pet } from './pages/Grow'
import Home from './pages/Home'
import Library from './pages/Library'
import Settings from './pages/Settings'
import { Practice, Review } from './pages/Session'

const NAV = [
  ['home', 'home', '学习概览'], ['library', 'layers', '我的错题库'], ['review', 'review', '今日复习'],
  ['practice', 'dice', '随机练习'], ['capture', 'camera', '拍照录题'], ['variations', 'target', '举一反三'],
  ['calendar', 'calendar', '复习日历'], ['stats', 'chart', '学习统计'],
  ['pet', 'pet', '成长小伙伴'], ['focus', 'timer', '专注时光'], ['settings', 'settings', '偏好与数据'],
]
const LEARN = ['home', 'library', 'review', 'practice', 'capture', 'variations', 'calendar', 'stats']

export default function App() {
  const [view, setView] = useState('home')
  const [params, setParams] = useState('')
  const [prefs, setPrefs] = useState({})
  const [dueCount, setDueCount] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const [toastMsg, setToastMsg] = useState(null)
  const [editor, setEditor] = useState(null)   // null 关 | {} 新建 | question 编辑
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const toastTimer = useRef(null)

  const toast = useCallback((msg, isError = false) => {
    clearTimeout(toastTimer.current)
    setToastMsg({ msg, isError })
    toastTimer.current = setTimeout(() => setToastMsg(null), 4500)
  }, [])
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])
  const loadPrefs = useCallback(() => {
    api.get('/prefs').then((d) => setPrefs(d.prefs)).catch((e) => setError(e.message))
    api.get('/stats').then((s) => setDueCount(s.due)).catch(() => {})
  }, [])
  useEffect(loadPrefs, [loadPrefs, refreshTick])

  const go = useCallback((v, p = '') => { setView(v); setParams(p); window.scrollTo(0, 0) }, [])
  const aiCfg = useCallback(() => {
    const p = prefs.ai_provider || 'qwen'
    return { provider: p, endpoint: prefs[`ai_${p}_endpoint`] || '', vision: prefs[`ai_${p}_vision`] || '', text: prefs[`ai_${p}_text`] || '', key: aiKeys[p] || '' }
  }, [prefs])

  const ctx = {
    prefs, setPrefs, toast, go, refresh, refreshTick, bumpNav: refresh, aiCfg, params,
    openNew: () => setEditor({}),
    openEditor: (q) => setEditor(q),
    openDetail: (q) => setDetail(q),
  }

  const pages = {
    home: <Home ctx={ctx} />, library: <Library ctx={ctx} />, review: <Review ctx={ctx} />,
    practice: <Practice ctx={ctx} />, capture: <Capture ctx={ctx} />, variations: <Variations ctx={ctx} />,
    calendar: <CalendarPage ctx={ctx} />, stats: <Stats ctx={ctx} />, pet: <Pet ctx={ctx} />,
    focus: <Focus ctx={ctx} />, settings: <Settings ctx={ctx} />,
  }
  const crumb = (NAV.find((n) => n[0] === view) || [])[2] || ''

  return (<>
    <div className="shell">
      <aside className="sidebar" id="sidebar">
        <div className="brand"><div className="brandmark"><Icon n="book" /></div>
          <div><div className="brandname">拾光自习室</div><small>SHIGUANG STUDY</small></div></div>
        <div className="navgroup">我的学习 · LEARN</div>
        <nav>{NAV.filter((n) => LEARN.includes(n[0])).map(([id, ico, title]) => (
          <button key={id} className={`nav ${view === id ? 'active' : ''}`} onClick={() => go(id)}>
            <Icon n={ico} /><span>{title}</span>
            {id === 'review' && dueCount > 0 && <span className="count">{dueCount}</span>}</button>))}</nav>
        <div className="navgroup">成长空间 · GROW</div>
        <nav>{NAV.filter((n) => !LEARN.includes(n[0])).map(([id, ico, title]) => (
          <button key={id} className={`nav ${view === id ? 'active' : ''}`} onClick={() => go(id)}>
            <Icon n={ico} /><span>{title}</span></button>))}
        </nav>
        <div className="sidebarfoot"><div className="offline"><i className="dot" />数据库存储 · MySQL</div>
          <p>每一点进步，都值得被记住</p></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>我的自习室</span><span>/</span><strong>{crumb || '随机练习'}</strong></div>
          <div className="toptools">
            <span className="topdate">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</span>
            <button className="btn icononly" title="专注计时" onClick={() => go('focus')}><Icon n="timer" /></button>
            <div className="avatar">{(prefs.name || '同学').slice(0, 1)}</div>
          </div>
        </header>
        <main className="main">
          {error && view === 'home'
            ? <div className="empty"><h3>无法连接后端服务</h3><p>{error}。请确认 FastAPI 已启动（docker compose up 或 uvicorn）。</p></div>
            : (pages[view] || <Practice ctx={ctx} />)}
        </main>
      </div>
    </div>
    {editor !== null && <EditorModal question={editor.id ? editor : null} onClose={() => setEditor(null)} ctx={ctx} />}
    {detail && <DetailModal question={detail} onClose={() => setDetail(null)} ctx={ctx} />}
    <div aria-live="polite">{toastMsg && <div className={`toast ${toastMsg.isError ? 'errorToast' : ''}`} role="status">{toastMsg.msg}</div>}</div>
  </>)
}
