"""AI 代理：白名单/密钥隔离逻辑与旧版逐条对应，HTTP 客户端换 httpx，上游仍为
OpenAI Chat Completions 兼容协议（百炼 compatible-mode / DeepSeek 官方域名）。"""
import os
import urllib.parse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, services
from ..config import settings
from ..database import get_db

router = APIRouter(tags=["ai"])


def endpoint_provider(value: str) -> str:
    if not isinstance(value, str):
        raise HTTPException(400, "接口地址不能为空")
    u = urllib.parse.urlsplit(value)
    host = (u.hostname or "").lower()
    if u.scheme != "https" or u.username or u.password or u.query or u.fragment or u.port not in (None, 443):
        raise HTTPException(400, "仅接受服务商官方 HTTPS 接口基础地址")
    if (host == "aliyuncs.com" or host.endswith(".aliyuncs.com")) and u.path.rstrip("/").endswith("/compatible-mode/v1"):
        return "qwen"
    if host == "api.deepseek.com" and u.path.rstrip("/") in ("", "/v1"):
        return "deepseek"
    raise HTTPException(400, "仅接受百炼或 DeepSeek 官方接口基础地址")


@router.post("/ai/chat")
async def ai_chat(body: schemas.AiChatIn):
    provider = endpoint_provider(body.endpoint)
    if body.provider and body.provider != provider:
        raise HTTPException(400, "服务商与接口地址不一致")
    env_key = settings.deepseek_api_key if provider == "deepseek" else settings.dashscope_api_key
    key = body.apiKey or env_key or os.environ.get("DEEPSEEK_API_KEY" if provider == "deepseek" else "DASHSCOPE_API_KEY", "")
    if not key or len(key) > 500 or "\n" in key or "\r" in key:
        raise HTTPException(400, "请填写所选服务商的 API Key，或配置对应环境变量")
    req = body.request or {}
    if not isinstance(req.get("messages"), list) or not isinstance(req.get("model"), str):
        raise HTTPException(400, "请求缺少模型或消息")
    payload = {k: req[k] for k in ("model", "messages", "response_format", "max_tokens", "stream") if k in req}
    if provider == "deepseek":
        payload["thinking"] = {"type": "disabled"}
    else:
        payload["enable_thinking"] = False
    payload["stream"] = False
    try:
        async with httpx.AsyncClient(timeout=100, follow_redirects=False) as client:  # 禁重定向：防密钥被带走
            r = await client.post(body.endpoint.rstrip("/") + "/chat/completions",
                                  json=payload,
                                  headers={"Authorization": "Bearer " + key.strip(),
                                           "Content-Type": "application/json"})
    except httpx.HTTPError:
        raise HTTPException(502, "无法连接所选服务商，请检查网络和接口设置后重试")
    if len(r.content) > 3 * 1024 * 1024:
        raise HTTPException(502, "模型响应过大，请减少题量")
    if r.status_code != 200:
        try:
            msg = str(r.json().get("error", {}).get("message") or "上游请求失败")
        except Exception:
            msg = "上游请求失败"
        raise HTTPException(r.status_code if 400 <= r.status_code < 600 else 502,
                            msg.replace(key, "[密钥已隐藏]")[:500])
    return r.json()


@router.get("/ai-sets")
def list_ai_sets(db: Session = Depends(get_db)):
    out = []
    for s in db.query(models.AiSet).order_by(models.AiSet.created.desc()).limit(30).all():
        out.append({
            "id": s.id, "subject": s.subject, "source_id": s.source_id, "source_title": s.source_title,
            "mode": s.mode, "created": s.created,
            "questions": [{"id": q.id, "set_id": q.set_id, "title": q.title, "answer": q.answer,
                           "explanation": q.explanation, "knowledge": q.knowledge, "note": q.note,
                           "revealed": q.revealed, "grade": q.grade} for q in s.questions],
        })
    return {"sets": out}


@router.post("/ai-sets", status_code=201)
def create_ai_set(body: schemas.AiSetIn, db: Session = Depends(get_db)):
    sid = services.uid()
    db.add(models.AiSet(id=sid, subject=body.subject, source_id=body.sourceId,
                        source_title=body.sourceTitle, mode=body.mode, created=services.today()))
    db.flush()
    for q in body.questions:
        db.add(models.AiQuestion(id=services.uid(), set_id=sid, title=q.title, answer=q.answer,
                                 explanation=q.explanation, knowledge=q.knowledge))
    # 最多保留最近 30 组
    ids = [r.id for r in db.query(models.AiSet).order_by(models.AiSet.created.desc()).all()]
    for old_id in ids[30:]:
        old = db.query(models.AiSet).filter(models.AiSet.id == old_id).first()
        if old:
            db.delete(old)
    db.commit()
    return {"id": sid}


@router.post("/ai-questions/{qid}/grade")
def ai_grade(qid: str, body: schemas.AiGradeIn, db: Session = Depends(get_db)):
    row = db.query(models.AiQuestion).filter(models.AiQuestion.id == qid).first()
    if not row:
        raise HTTPException(404, "练习题不存在")
    row.grade = body.grade
    row.revealed = True
    db.commit()
    return {"ok": True}
