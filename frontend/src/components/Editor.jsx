import React, { useEffect, useRef, useState } from 'react'
import { api, compressImage } from '../api'
import { Badge, Icon, mastered } from './ui'

export const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道法']
export const CAUSES = ['概念不清', '计算失误', '审题疏漏', '方法不熟', '记忆遗漏']
export const DIFFS = ['基础', '进阶', '挑战']

export function EditorModal({ question, onClose, ctx }) {
  const ref = useRef(null)
  const [image, setImage] = useState(question?.image || '')
  const [form, setForm] = useState({
    subject: question?.subject || '数学', difficulty: question?.difficulty || '基础',
    title: question?.title || '', answer: question?.answer || '', reason: question?.reason || '',
    tag: question?.tag || '', cause: question?.cause || CAUSES[0], favorite: !!question?.favorite,
  })
  useEffect(() => { ref.current?.showModal() }, [])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    try {
      const body = { ...form, image }
      if (question?.id) await api.put(`/questions/${question.id}`, body)
      else await api.post('/questions', body)
      ctx.toast(question?.id ? '已保存修改' : '已收录，成长值 +3')
      onClose()
      ctx.refresh()
    } catch (err) { ctx.toast(err.message, true) }
  }
  return (<dialog className="dialog" ref={ref} onClose={onClose}>
    <div className="modalhead"><h2>{question?.id ? '编辑错题' : '记录错题'}</h2>
      <button className="btn icononly" onClick={onClose}><Icon n="close" /></button></div>
    <form onSubmit={submit}><div className="modalbody"><div className="formgrid">
      <div className="formfield"><label>学科 *</label>
        <select value={form.subject} onChange={set('subject')}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="formfield"><label>难度</label>
        <select value={form.difficulty} onChange={set('difficulty')}>{DIFFS.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="formfield span2"><label>题目 *</label><textarea rows="4" required maxLength="10000" value={form.title} onChange={set('title')} /></div>
      <div className="formfield span2"><label>参考答案 *</label><textarea rows="4" required maxLength="10000" value={form.answer} onChange={set('answer')} /></div>
      <div className="formfield span2"><label>错因说明</label><textarea rows="2" maxLength="10000" value={form.reason} onChange={set('reason')} /></div>
      <div className="formfield"><label>知识点</label><input value={form.tag} onChange={set('tag')} maxLength="200" /></div>
      <div className="formfield"><label>错因分类</label>
        <select value={form.cause} onChange={set('cause')}>{CAUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="formfield span2"><label>附图（可选，自动压缩）</label>
        <input type="file" accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => { if (e.target.files[0]) setImage(await compressImage(e.target.files[0])) }} />
        {image && <img className="qimage" src={image} alt="附图预览" />}</div>
      <label className="ai-check"><input type="checkbox" checked={form.favorite} onChange={set('favorite')} /> 收藏这道题</label>
    </div></div>
      <div className="modalfoot"><button className="btn" type="button" onClick={onClose}>取消</button>
        <button className="btn primary" type="submit">保存{question?.id ? '' : '（新题 +3 分）'}</button></div></form>
  </dialog>)
}

export function DetailModal({ question, onClose, ctx }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.showModal() }, [])
  const q = question
  return (<dialog className="dialog" ref={ref} onClose={onClose}>
    <div className="modalhead"><h2>错题详情</h2><button className="btn icononly" onClick={onClose}><Icon n="close" /></button></div>
    <div className="modalbody">
      <div className="qmeta"><Badge s={q.subject} /><span>{q.subject} · {q.difficulty} · {q.tag || ''}</span>
        <span className="badge">{mastered(q) ? '已掌握' : `巩固中 · 阶段 ${q.stage}`}</span></div>
      <h3 style={{ whiteSpace: 'pre-wrap' }}>{q.title}</h3>
      {q.image && <img className="qimage" src={q.image} alt="题目附图" />}
      <h3>参考答案</h3><p style={{ whiteSpace: 'pre-wrap' }}>{q.answer}</p>
      <h3>错因</h3><p>{q.reason || '—'}（{q.cause || '未分类'}）</p>
      <p className="muted">收录 {q.created} · 下次复习 {q.due}</p>
    </div>
    <div className="modalfoot">
      <button className="btn" onClick={() => { onClose(); ctx.go('variations', q.id) }}>举一反三</button>
      <button className="btn primary" onClick={() => { onClose(); ctx.openEditor(q) }}>编辑</button>
    </div>
  </dialog>)
}
