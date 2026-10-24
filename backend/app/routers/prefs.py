import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(tags=["prefs"])

ALLOWED = {"name", "goal", "minutes", "theme", "ai_provider",
           "ai_qwen_endpoint", "ai_qwen_vision", "ai_qwen_text",
           "ai_deepseek_endpoint", "ai_deepseek_vision", "ai_deepseek_text", "timer"}


@router.get("/prefs")
def get_prefs(db: Session = Depends(get_db)):
    prefs = {}
    timer = None
    for p in db.query(models.Pref).all():
        if p.key == "seeded":
            continue
        try:
            value = json.loads(p.value)
        except Exception:
            value = p.value
        if p.key == "timer":
            timer = value
        else:
            prefs[p.key] = value
    return {"prefs": prefs, "timer": timer}


@router.post("/prefs")
def update_prefs(body: dict, db: Session = Depends(get_db)):
    for k, v in body.items():
        if k in ALLOWED:
            db.merge(models.Pref(key=k, value=json.dumps(v, ensure_ascii=False)))
    db.commit()
    return {"ok": True}
