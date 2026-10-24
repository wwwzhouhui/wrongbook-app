"""业务领域逻辑：与旧版 server.py 逐条对应的规则实现，只换了存储层（ORM）。
SRS：again→stage归零/+1天；hard→stage归零/+2天；good→stage+1(≤5)，间隔 1/3/7/14/30 天；stage>=3 已掌握。
积分：新题 +3；每题每天首次 review/practice +5；专注 +1/分钟、单次封顶 +30；兑换不扣成长值。"""
import re
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models

GOOD_INTERVALS = [1, 3, 7, 14, 30]


def uid() -> str:
    return uuid.uuid4().hex[:26]


def today() -> str:
    return date.today().isoformat()


def add_days(s: str, n: int) -> str:
    return (date.fromisoformat(s) + timedelta(days=n)).isoformat()


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def question_out(q: models.Question) -> dict:
    return {
        "id": q.id, "subject": q.subject, "title": q.title, "answer": q.answer,
        "reason": q.reason, "tag": q.tag, "cause": q.cause, "difficulty": q.difficulty,
        "favorite": q.favorite, "stage": q.stage, "due": q.due, "created": q.created,
        "demo": q.is_demo, "source": q.source, "deleted": q.deleted_at is not None,
        "image": q.attachment.image_data if q.attachment else "",
    }


def add_log(db: Session, type_: str, label: str, points: int = 0, qid=None, grade=None, minutes: int = 0):
    db.add(models.Log(id=uid(), date=today(), at=now_iso(), type=type_, label=label,
                      points=points, qid=qid, grade=grade, minutes=minutes))


def points_balance(db: Session) -> tuple[int, int]:
    gained = db.query(func.coalesce(func.sum(models.Log.points), 0)).scalar()
    spent = db.query(func.coalesce(func.sum(models.Redemption.cost), 0)).scalar()
    return gained - spent, gained


def grade_question(db: Session, qid: str, mode: str, grade: str):
    """自评一题：单事务完成 stage/due 更新 + 流水 + 计分，返回 (question_dict, points)。"""
    q = db.query(models.Question).filter(models.Question.id == qid, models.Question.deleted_at.is_(None)).first()
    if not q:
        return None, 0
    stage = min(q.stage + 1, 5) if grade == "good" else 0
    interval = 1 if grade == "again" else 2 if grade == "hard" else GOOD_INTERVALS[stage - 1]
    first = not db.query(models.Log).filter(
        models.Log.type.in_(["review", "practice"]), models.Log.qid == qid, models.Log.date == today()).first()
    pts = 5 if first else 0
    q.stage = stage
    q.due = add_days(today(), interval)
    q.updated_at = now_iso()
    add_log(db, mode, f"{q.subject} · {q.tag or q.title[:18]}", pts, qid=qid, grade=grade)
    db.commit()
    db.refresh(q)
    return question_out(q), pts


def compute_stats(db: Session) -> dict:
    base = db.query(models.Question).filter(models.Question.deleted_at.is_(None))
    total = base.count()
    mastered = base.filter(models.Question.stage >= 3).count()
    due = base.filter(models.Question.due <= today()).count()
    bal, growth = points_balance(db)
    week = []
    for i in range(6, -1, -1):
        d = add_days(today(), -i)
        n = db.query(models.Log).filter(models.Log.type.in_(["review", "practice"]), models.Log.date == d).count()
        week.append({"date": d, "count": n})
    from .schemas import SUBJECTS
    subjects = [{
        "subject": s,
        "total": base.filter(models.Question.subject == s).count(),
        "mastered": base.filter(models.Question.subject == s, models.Question.stage >= 3).count(),
    } for s in SUBJECTS]
    causes: dict[str, int] = {}
    for cause, c in db.query(models.Question.cause, func.count()).filter(
            models.Question.deleted_at.is_(None), models.Question.stage < 3).group_by(models.Question.cause).all():
        causes[cause or "未分类"] = c
    streak, d = 0, today()
    if not db.query(models.Log).filter(models.Log.date == d).first():
        d = add_days(d, -1)
    while db.query(models.Log).filter(models.Log.date == d).first() and streak < 10000:
        streak += 1
        d = add_days(d, -1)
    return {
        "total": total, "mastered": mastered, "rate": round(mastered / total * 100) if total else 0,
        "due": due, "balance": bal, "growth": growth, "week": week, "subjects": subjects,
        "causes": dict(sorted(causes.items(), key=lambda kv: -kv[1])), "streak": streak,
        "reviews": db.query(models.Log).filter(models.Log.type.in_(["review", "practice"])).count(),
        "focusToday": db.query(func.coalesce(func.sum(models.Log.minutes), 0)).filter(
            models.Log.type == "focus", models.Log.date == today()).scalar(),
        "reviewedToday": db.query(func.count(func.distinct(models.Log.qid))).filter(
            models.Log.type.in_(["review", "practice"]), models.Log.date == today()).scalar(),
    }


def export_state(db: Session) -> dict:
    """导出与原版 schema=1 完全兼容的 JSON 备份（可导回原版 HTML 与旧版）。"""
    def dump(rows, deleted):
        out = []
        for q in rows:
            item = question_out(q)
            item.pop("deleted"); item.pop("source")
            out.append(item)
        return out
    qs = dump(db.query(models.Question).filter(models.Question.deleted_at.is_(None)).all(), False)
    trash = dump(db.query(models.Question).filter(models.Question.deleted_at.is_not(None)).all(), True)
    logs = []
    for r in db.query(models.Log).order_by(models.Log.at).all():
        item = {"id": r.id, "date": r.date, "at": r.at, "type": r.type, "label": r.label, "points": r.points}
        if r.qid: item["qid"] = r.qid
        if r.grade: item["grade"] = r.grade
        if r.minutes: item["minutes"] = r.minutes
        logs.append(item)
    prefs = {p.key: _json_loads(p.value) for p in db.query(models.Pref).all() if p.key not in ("seeded", "timer")}
    ai_sets = []
    for s in db.query(models.AiSet).order_by(models.AiSet.created.desc()).all():
        ai_sets.append({
            "id": s.id, "subject": s.subject, "sourceId": s.source_id, "sourceTitle": s.source_title, "created": s.created,
            "questions": [{"id": q.id, "title": q.title, "answer": q.answer, "explanation": q.explanation,
                           "knowledge": q.knowledge, "note": q.note, "revealed": q.revealed, "grade": q.grade}
                          for q in s.questions],
        })
    return {
        "schema": 1, "questions": qs, "trash": trash, "logs": logs,
        "rewards": [{"id": r.id, "name": r.name, "cost": r.cost} for r in db.query(models.Reward).all()],
        "redemptions": [{"id": r.id, "name": r.name, "cost": r.cost, "date": r.date} for r in db.query(models.Redemption).all()],
        "prefs": {"name": prefs.get("name", "同学"), "goal": prefs.get("goal", 5),
                  "minutes": prefs.get("minutes", 25), "theme": prefs.get("theme", "light")},
        "timer": None, "aiSets": ai_sets, "createdAt": now_iso(),
        "_exportedBy": "shiguang-wrongbook-app (FastAPI) v2",
        "_aiPrefs": {k: v for k, v in prefs.items() if k.startswith("ai_")},
    }


def _json_loads(v: str):
    import json
    try:
        return json.loads(v)
    except Exception:
        return v


def import_state(db: Session, state: dict) -> int:
    """导入 schema=1 备份：全量替换，FastAPI 依赖事务内失败自动回滚（此处异常即 rollback）。"""
    if not isinstance(state, dict) or state.get("schema") != 1 or not isinstance(state.get("questions"), list):
        raise ValueError("不是拾光自习室的有效备份（版本 1）")
    try:
        for model in (models.AiQuestion, models.AiSet, models.Attachment, models.Question,
                      models.Log, models.Reward, models.Redemption):
            db.query(model).delete()
        def put(q: dict, deleted: bool):
            row = models.Question(
                id=q["id"], subject=q["subject"], title=q["title"], answer=q["answer"],
                reason=q.get("reason", ""), tag=q.get("tag", ""), cause=q.get("cause", ""),
                difficulty=q.get("difficulty", "基础"), favorite=bool(q.get("favorite")),
                stage=int(q.get("stage", 0)), due=q["due"], created=q["created"],
                is_demo=bool(q.get("demo")), source="import",
                deleted_at=now_iso() if deleted else None, updated_at=now_iso())
            db.add(row)
            db.flush()
            if q.get("image"):
                db.add(models.Attachment(id=uid(), question_id=q["id"], image_data=q["image"], created_at=now_iso()))
        n = 0
        for q in state["questions"]:
            put(q, False); n += 1
        for q in state.get("trash", []):
            put(q, True)
        for l in state.get("logs", []):
            db.add(models.Log(id=l["id"], date=l["date"], at=l.get("at", now_iso()), type=l["type"],
                              label=l.get("label", ""), points=int(l.get("points", 0)),
                              qid=l.get("qid"), grade=l.get("grade"), minutes=int(l.get("minutes", 0) or 0)))
        for r in state.get("rewards", []):
            db.add(models.Reward(id=r["id"], name=r["name"], cost=int(r["cost"])))
        for r in state.get("redemptions", []):
            db.add(models.Redemption(id=r["id"], reward_id=None, name=r["name"], cost=int(r["cost"]),
                                     date=r["date"], at=now_iso()))
        for s in state.get("aiSets", []):
            row = models.AiSet(id=s["id"], subject=s["subject"], source_id=s.get("sourceId", ""),
                               source_title=s.get("sourceTitle", ""), mode="same", created=s["created"])
            db.add(row); db.flush()
            for q in s["questions"]:
                db.add(models.AiQuestion(id=q["id"], set_id=s["id"], title=q["title"], answer=q["answer"],
                                         explanation=q.get("explanation", ""), knowledge=q.get("knowledge", ""),
                                         note=q.get("note", ""), revealed=bool(q.get("revealed")), grade=q.get("grade", "")))
        import json
        p = state.get("prefs", {})
        for k in ("name", "goal", "minutes", "theme"):
            if k in p:
                db.merge(models.Pref(key=k, value=json.dumps(p[k], ensure_ascii=False)))
        for k, v in (state.get("_aiPrefs") or {}).items():
            db.merge(models.Pref(key=k, value=json.dumps(v, ensure_ascii=False)))
        db.commit()
        return n
    except Exception:
        db.rollback()
        raise


CSV_FORMULA = re.compile(r"^\s*[=+\-@]")
