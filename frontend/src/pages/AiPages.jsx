import React, { useEffect, useState } from 'react'
import { aiKeys, api, compressImage } from '../api'
import { CAUSES, SUBJECTS } from '../components/Editor'
import { AiSettings, Empty, Head, Icon } from '../components/ui'

function aiCfg(prefs) {
  const p = prefs.ai_provider || 'qwen'
  return { provider: p, endpoint: prefs[`ai_${p}_endpoint`] || '', vision: prefs[`ai_${p}_vision`] || '', text: prefs[`ai_${p}_text`] || '', key: aiKeys[p] || '' }
}
async function aiChat(prefs, model, messages) {
  const c = aiCfg(prefs)
  const r = await api.post('/ai/chat', {
    provider: c.provider, endpoint: c.endpoint, apiKey: c.key || undefined,
    request: { model, messages, response_format: { type: 'json_object' }, max_tokens: 4000 },
  })
  const txt = r.choices?.[0]?.message?.content || ''
  const m = txt.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('模型未返回合法 JSON，请重试')
  return JSON.parse(m[0])
}

export function Capture({ ctx }) {
  const [drafts, setDrafts] = useState([])
  const filesRef = React.useRef(null)
  const buildDrafts = async () => {
    const files = [...(filesRef.current?.files || [])]
    if (!files.length) { ctx.toast('先选择照片', true); return null }
    const out = []
    for (const f of files.slice(0, 12)) {
      if (f.size > 12 * 1024 * 1024) { ctx.toast(`「${f.name}」超过 12MB，已跳过`, true); continue }
      out.push({ image: await compressImage(f), subject: SUBJECTS[0], title: '', answer: '', reason: '', tag: '', cause: CAUSES[0], checked: true, aiAnswer: false })
    }
    return out
  }
  const manual = async () => { const d = await buildDrafts(); if (d) setDrafts(d) }
  const ocr = async () => {
    const d = await buildDrafts()
    if (!d) return
    try {
      ctx.toast('识别中，请稍候…')
      const c = aiCfg(ctx.prefs)
      for (const item of d) {
        const out = await aiChat(ctx.prefs, c.vision, [{ role: 'user', content: [
          { type: 'text', text: '识别这张错题照片。只输出 JSON：{"questions":[{"subject":"九科之一","title":"题目全文","answer":"图中已有答案，没有则空字符串","tag":"知识点"}]}。不要把学生的错误答案当成正确答案。' },
          { type: 'image_url', image_url: { url: item.image } }] }])
        const q = (out.questions || [])[0]
        if (q) {
          if (SUBJECTS.includes(q.subject)) item.subject = q.subject
          item.title = q.title || ''; item.answer = q.answer || ''; item.tag = q.tag || ''
          item.aiAnswer = !q.answer
        }
      }
      setDrafts([...d])
    } catch (e) { ctx.toast(e.message, true); setDrafts(d) }
  }
  const setD = (i, k, v) => { const d = [...drafts]; d[i] = { ...d[i], [k]: v }; setDrafts(d) }
  const save = async () => {
    let n = 0
    for (const d of drafts) {
      if (!d.checked) continue
      if (!d.title.trim() || !d.answer.trim()) { ctx.toast('有草稿缺题目或答案，未全部保存', true); continue }
      await api.post('/questions', { subject: d.subject, title: d.title.trim(), answer: d.answer.trim(),
        reason: d.reason, tag: d.tag, cause: d.cause, difficulty: '基础', image: d.image, source: 'ai_capture' })
      n++
    }
    setDrafts([])
    ctx.toast(n ? `已保存 ${n} 道错题（+${n * 3} 分）` : '没有可保存的草稿')
    if (n) ctx.go('library')
  }
  return (<>
    <Head title="拍照录题" sub="上传题目照片，AI 识别后逐题校对再入库；没有配置 AI 时也可以对照照片手动录入。" onNew={ctx.openNew} />
    <AiSettings ctx={ctx} />
    <section className="card">
      <input type="file" ref={filesRef} accept="image/jpeg,image/png,image/webp" multiple />
      <p className="helper">支持 JPG / PNG / WebP，单张 ≤12MB、一批 ≤12 张，图片在本地压缩后才会发送给模型。PDF 请先逐页导出为图片再上传（本版未内嵌 PDF.js，见 README 的取舍说明）。</p>
      <div className="btnrow">
        <button className="btn primary" onClick={ocr}><Icon n="camera" />识别所选素材</button>
        <button className="btn" onClick={manual}>无 AI：按素材手动建草稿</button></div>
      {drafts.map((d, i) => (
        <div key={i} className="ai-draft card" style={{ marginTop: 14 }}>
          <label className="ai-check"><input type="checkbox" checked={d.checked} onChange={(e) => setD(i, 'checked', e.target.checked)} /> 入库这道题</label>
          {d.image && <img className="qimage" src={d.image} alt="原图" />}
          <div className="formgrid">
            <div className="formfield"><label>学科</label>
              <select value={d.subject} onChange={(e) => setD(i, 'subject', e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="formfield"><label>知识点</label><input value={d.tag} onChange={(e) => setD(i, 'tag', e.target.value)} /></div>
            <div className="formfield span2"><label>题目</label><textarea rows="3" value={d.title} onChange={(e) => setD(i, 'title', e.target.value)} /></div>
            <div className="formfield span2"><label>参考答案 {d.aiAnswer && <span className="badge orange">AI 补全，请核对</span>}</label>
              <textarea rows="3" value={d.answer} onChange={(e) => setD(i, 'answer', e.target.value)} /></div>
            <div className="formfield"><label>错因说明</label><input value={d.reason} onChange={(e) => setD(i, 'reason', e.target.value)} /></div>
            <div className="formfield"><label>错因分类</label>
              <select value={d.cause} onChange={(e) => setD(i, 'cause', e.target.value)}>{CAUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div></div>))}
      {drafts.length > 0 && <div className="btnrow" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={save}>保存勾选题目（每题 +3 分）</button></div>}
    </section>
  </>)
}

const GRADE_CN = { again: '还不会', hard: '有点模糊', good: '掌握了' }

export function Variations({ ctx }) {
  const [all, setAll] = useState([])
  const [sets, setSets] = useState([])
  const [source, setSource] = useState(ctx.params || '')
  const [mode, setMode] = useState('same')
  const [status, setStatus] = useState('')
  const load = async () => {
    const [qs, ss] = await Promise.all([api.get('/questions?sort=newest'), api.get('/ai-sets')])
    setAll(qs.questions); setSets(ss.sets)
    if (!source && qs.questions.length) setSource(ctx.params || qs.questions[0].id)
  }
  useEffect(() => { load().catch((e) => ctx.toast(e.message, true)) }, [ctx.refreshTick])
  const gen = async () => {
    try {
      const src = all.find((q) => q.id === source)
      if (!src) return
      const c = aiCfg(ctx.prefs)
      setStatus('生成中（第 1 次调用）…')
      const out = await aiChat(ctx.prefs, src.image ? c.vision : c.text,
        [{ role: 'user', content: `围绕同一知识点「${src.tag || src.title}」、保持题型与主要解法，为下面原题生成 3 道${mode === 'step' ? '循序渐进' : '同难度'}变式题。只输出 JSON：{"questions":[{"title":"题干","answer":"答案","explanation":"解析","knowledge":"知识点"}]}，必须恰好 3 道且互不重复。\n原题（${src.subject}）：${src.title}\n参考答案：${src.answer}` }])
      if (!Array.isArray(out.questions) || out.questions.length !== 3) throw new Error('生成不完整，未保存')
      setStatus('独立校核中（第 2 次调用）…')
      const chk = await aiChat(ctx.prefs, c.text,
        [{ role: 'user', content: `逐题核对题干、答案、解析是否一致且正确。只输出 JSON：{"ok":true} 或 {"ok":false,"why":"原因"}。\n${JSON.stringify(out.questions)}` }])
      if (chk.ok !== true) throw new Error('校核未通过，未保存：' + (chk.why || ''))
      await api.post('/ai-sets', { subject: src.subject, sourceId: src.id, sourceTitle: src.title, mode, questions: out.questions })
      setStatus(''); ctx.toast('已生成并校核通过，练习组已存入数据库'); load()
    } catch (e) { setStatus(''); ctx.toast(e.message, true) }
  }
  const importQ = async (set, q) => {
    if (all.some((x) => x.title === q.title)) { ctx.toast('错题库已有相同题干，未重复收录', true); return }
    await api.post('/questions', { subject: set.subject, title: q.title, answer: q.answer,
      reason: q.explanation, tag: q.knowledge || set.source_title, cause: CAUSES[0], difficulty: '基础', source: 'variation' })
    ctx.toast('已收进错题库（+3 分）'); load()
  }
  return (<>
    <Head title="举一反三" sub="选一道原题，AI 保持题型与主要解法生成 3 道变式并独立校核，通过后才保存到数据库。" onNew={ctx.openNew} />
    <AiSettings ctx={ctx} />
    <section className="card" style={{ marginBottom: 20 }}>
      <div className="formgrid">
        <div className="formfield span2"><label>原题</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {all.map((q) => <option key={q.id} value={q.id}>{q.subject} · {q.title.slice(0, 60)}</option>)}</select></div>
        <div className="formfield"><label>难度模式</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="same">同难度</option><option value="step">循序渐进</option></select></div>
      </div>
      <div className="btnrow" style={{ marginTop: 12 }}><button className="btn primary" onClick={gen}>AI 出三道相似题</button></div>
      {status && <p className="helper">{status}</p>}
    </section>
    {sets.length ? sets.map((s) => (
      <section key={s.id} className="card" style={{ marginBottom: 18 }}>
        <div className="sectiontitle"><h2>{s.subject} · 源自：{s.source_title.slice(0, 40)}</h2><span className="badge">{s.created}</span></div>
        {s.questions.map((q) => (
          <div key={q.id} className="ai-draft" style={{ margin: '12px 0' }}>
            <h3 className="qtitle">{q.title}</h3><p className="muted">知识点：{q.knowledge || ''}</p>
            {(q.revealed || q.grade) ? (<>
              <div className="answer"><p style={{ whiteSpace: 'pre-wrap' }}><strong>答案：</strong>{q.answer}</p>
                <p style={{ whiteSpace: 'pre-wrap' }}><strong>解析：</strong>{q.explanation}</p></div>
              {q.grade ? <p className="badge">已自评：{GRADE_CN[q.grade] || q.grade}</p>
                : <div className="btnrow">{['again', 'hard', 'good'].map((g) => (
                  <button key={g} className={`btn small ${g === 'good' ? 'primary' : ''}`}
                    onClick={async () => { await api.post(`/ai-questions/${q.id}/grade`, { grade: g }); load() }}>{GRADE_CN[g]}</button>))}</div>}
            </>) : <button className="btn small" onClick={async () => { await api.post(`/ai-questions/${q.id}/grade`, { grade: '' }); load() }}>写完后看答案</button>}
            <button className="btn small" onClick={() => importQ(s, q)}>收进错题库（+3 分）</button>
          </div>))}
      </section>)) : <Empty t="还没有练习组" s="先在上方选一道原题生成。" />}
  </>)
}
