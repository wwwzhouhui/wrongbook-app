from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, services
from ..database import get_db

router = APIRouter(tags=["rewards"])


@router.get("/rewards")
def list_rewards(db: Session = Depends(get_db)):
    bal, growth = services.points_balance(db)
    return {
        "balance": bal, "growth": growth,
        "rewards": [{"id": r.id, "name": r.name, "cost": r.cost}
                    for r in db.query(models.Reward).order_by(models.Reward.cost).all()],
        "redemptions": [{"id": r.id, "name": r.name, "cost": r.cost, "date": r.date}
                        for r in db.query(models.Redemption).order_by(models.Redemption.at.desc()).limit(100).all()],
    }


@router.post("/rewards", status_code=201)
def create_reward(body: schemas.RewardIn, db: Session = Depends(get_db)):
    rid = services.uid()
    db.add(models.Reward(id=rid, name=body.name, cost=body.cost))
    db.commit()
    return {"reward": {"id": rid, "name": body.name, "cost": body.cost}}


@router.delete("/rewards/{rid}")
def delete_reward(rid: str, db: Session = Depends(get_db)):
    row = db.query(models.Reward).filter(models.Reward.id == rid).first()
    if not row:
        raise HTTPException(404, "奖励不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/rewards/{rid}/redeem")
def redeem(rid: str, db: Session = Depends(get_db)):
    row = db.query(models.Reward).filter(models.Reward.id == rid).first()
    if not row:
        raise HTTPException(404, "奖励不存在")
    bal, _ = services.points_balance(db)
    if bal < row.cost:
        raise HTTPException(400, "积分不足")
    db.add(models.Redemption(id=services.uid(), reward_id=row.id, name=row.name, cost=row.cost,
                             date=services.today(), at=services.now_iso()))
    db.commit()
    return {"ok": True, "balance": bal - row.cost}
