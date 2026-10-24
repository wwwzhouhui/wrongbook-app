from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, services
from ..database import get_db

router = APIRouter(tags=["stats"])


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    return services.compute_stats(db)


@router.get("/calendar")
def calendar(month: str = "", db: Session = Depends(get_db)):
    ym = month or services.today()[:7]
    planned = dict(db.query(models.Question.due, func.count()).filter(
        models.Question.deleted_at.is_(None), models.Question.due.like(ym + "%")
    ).group_by(models.Question.due).all())
    done = dict(db.query(models.Log.date, func.count(func.distinct(models.Log.qid))).filter(
        models.Log.type.in_(["review", "practice"]), models.Log.date.like(ym + "%")
    ).group_by(models.Log.date).all())
    return {"planned": planned, "done": done}


@router.get("/logs")
def logs(date: str = "", db: Session = Depends(get_db)):
    d = date or services.today()
    rows = db.query(models.Log).filter(models.Log.date == d).order_by(models.Log.at).all()
    return {"logs": [{"id": r.id, "date": r.date, "at": r.at, "type": r.type, "label": r.label,
                      "points": r.points, "qid": r.qid, "grade": r.grade, "minutes": r.minutes} for r in rows]}
