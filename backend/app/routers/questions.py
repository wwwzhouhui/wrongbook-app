from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas, services
from ..database import get_db

router = APIRouter(tags=["questions"])


@router.get("/questions")
def list_questions(db: Session = Depends(get_db), subject: str = "", status: str = "",
                   q: str = "", favorite: bool = False, sort: str = "due", deleted: bool = False):
    query = db.query(models.Question)
    query = query.filter(models.Question.deleted_at.is_not(None)) if deleted else \
        query.filter(models.Question.deleted_at.is_(None))
    if subject:
        query = query.filter(models.Question.subject == subject)
    if favorite:
        query = query.filter(models.Question.favorite.is_(True))
    if status == "mastered":
        query = query.filter(models.Question.stage >= 3)
    elif status == "learning":
        query = query.filter(models.Question.stage < 3)
    elif status == "due":
        query = query.filter(models.Question.due <= services.today())
    if q:
        like = f"%{q}%"
        query = query.filter(models.Question.title.like(like) | models.Question.answer.like(like)
                             | models.Question.tag.like(like) | models.Question.reason.like(like))
    order = {"due": (models.Question.due, models.Question.created),
             "newest": (models.Question.created.desc(),),
             "subject": (models.Question.subject, models.Question.due)}.get(sort, (models.Question.due,))
    rows = query.order_by(*order).limit(3000).all()
    return {"questions": [services.question_out(r) for r in rows]}


@router.post("/questions", status_code=201)
def create_question(body: schemas.QuestionIn, db: Session = Depends(get_db)):
    qid = services.uid()
    row = models.Question(
        id=qid, subject=body.subject, title=body.title, answer=body.answer, reason=body.reason,
        tag=body.tag, cause=body.cause, difficulty=body.difficulty, favorite=body.favorite,
        stage=0, due=services.today(), created=services.today(), is_demo=False,
        source=body.source, updated_at=services.now_iso())
    db.add(row)
    db.flush()
    if body.image:
        db.add(models.Attachment(id=services.uid(), question_id=qid, image_data=body.image,
                                 created_at=services.now_iso()))
    services.add_log(db, "add", f"{body.subject} · {body.tag or body.title[:18]}", 3, qid=qid)
    db.commit()
    db.refresh(row)
    return {"question": services.question_out(row), "pointsAwarded": 3}


def _get(db: Session, qid: str) -> models.Question:
    row = db.query(models.Question).filter(models.Question.id == qid).first()
    if not row:
        raise HTTPException(404, "题目不存在")
    return row


@router.put("/questions/{qid}")
def update_question(qid: str, body: schemas.QuestionPatch, db: Session = Depends(get_db)):
    row = _get(db, qid)
    data = body.model_dump(exclude_unset=True)
    image = data.pop("image", None)
    for k, v in data.items():
        setattr(row, k, v)
    row.updated_at = services.now_iso()
    if image is not None:
        if row.attachment:
            db.delete(row.attachment)
            db.flush()
        if image:
            db.add(models.Attachment(id=services.uid(), question_id=qid, image_data=image,
                                     created_at=services.now_iso()))
    db.commit()
    db.refresh(row)
    return {"question": services.question_out(row)}


@router.delete("/questions/{qid}")
def trash_question(qid: str, db: Session = Depends(get_db)):
    row = _get(db, qid)
    if row.deleted_at is not None:
        raise HTTPException(404, "题目不存在或已在回收站")
    row.deleted_at = services.now_iso()
    db.commit()
    return {"ok": True}


@router.post("/questions/{qid}/restore")
def restore_question(qid: str, db: Session = Depends(get_db)):
    row = _get(db, qid)
    row.deleted_at = None
    row.updated_at = services.now_iso()
    db.commit()
    db.refresh(row)
    return {"question": services.question_out(row)}


@router.post("/questions/{qid}/permanent")
def delete_permanent(qid: str, db: Session = Depends(get_db)):
    row = _get(db, qid)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/questions/{qid}/favorite")
def toggle_favorite(qid: str, db: Session = Depends(get_db)):
    row = _get(db, qid)
    row.favorite = not row.favorite
    db.commit()
    db.refresh(row)
    return {"question": services.question_out(row)}


@router.get("/review/today")
def review_today(db: Session = Depends(get_db)):
    rows = db.query(models.Question).filter(
        models.Question.deleted_at.is_(None), models.Question.due <= services.today()
    ).order_by(models.Question.due).all()
    return {"questions": [services.question_out(r) for r in rows]}


@router.post("/review/grade")
def review_grade(body: schemas.GradeIn, db: Session = Depends(get_db)):
    q, pts = services.grade_question(db, body.qid, body.mode, body.grade)
    if q is None:
        raise HTTPException(404, "题目不存在")
    return {"question": q, "pointsAwarded": pts}


@router.get("/practice/random")
def practice_random(db: Session = Depends(get_db), count: int = Query(10, ge=1, le=50), subject: str = ""):
    query = db.query(models.Question).filter(models.Question.deleted_at.is_(None))
    if subject:
        query = query.filter(models.Question.subject == subject)
    # RANDOM() 在 MySQL 是 RAND()，用 func.random() 由方言层翻译，两边通用
    rows = query.order_by(func.random()).limit(count).all()
    return {"questions": [services.question_out(r) for r in rows]}


@router.post("/focus")
def focus(body: schemas.FocusIn, db: Session = Depends(get_db)):
    pts = min(body.minutes, 30)
    services.add_log(db, "focus", f"专注学习 {body.minutes} 分钟", pts, minutes=body.minutes)
    db.commit()
    return {"ok": True, "pointsAwarded": pts}
