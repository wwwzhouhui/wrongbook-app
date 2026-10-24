import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from .. import models, services
from ..database import get_db

router = APIRouter(tags=["data"])


@router.get("/export/json")
def export_json(db: Session = Depends(get_db)):
    return services.export_state(db)


@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["学科", "题目", "参考答案", "错因说明", "知识点", "错因分类", "难度", "掌握状态", "复习日期", "收录日期", "收藏"])

    def cell(v):
        s = str(v if v is not None else "")
        return "'" + s if services.CSV_FORMULA.match(s) else s

    for r in db.query(models.Question).filter(models.Question.deleted_at.is_(None)) \
            .order_by(models.Question.subject, models.Question.created).all():
        w.writerow([cell(x) for x in [r.subject, r.title, r.answer, r.reason, r.tag, r.cause, r.difficulty,
                                      "已掌握" if r.stage >= 3 else "巩固中", r.due, r.created,
                                      "是" if r.favorite else "否"]])
    return Response(content="\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8")


@router.post("/import/json")
def import_json(body: dict, db: Session = Depends(get_db)):
    try:
        n = services.import_state(db, body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"imported": n}


@router.post("/admin/clear-demo")
def clear_demo(db: Session = Depends(get_db)):
    db.query(models.Question).filter(models.Question.is_demo.is_(True)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}
