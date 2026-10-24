"""Vercel 部署入口：把 backend/ 下的 FastAPI 应用暴露为 serverless 函数。

本地/Docker 部署不受此文件影响（仍走 backend + docker-compose）。
Vercel 无 MySQL：DATABASE_URL 未设置时默认落到 /tmp 的 SQLite（serverless 临时存储，
冷启动/多实例数据不持久，仅作演示；接外部 MySQL/Postgres 只需改环境变量 DATABASE_URL）。
"""
import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/wrongbook.db")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402

# serverless 环境不保证 ASGI lifespan 一定执行，导入期再幂等建表+播种一次兜底
try:
    Base.metadata.create_all(bind=engine)
    _db = SessionLocal()
    try:
        seed_if_empty(_db)
    finally:
        _db.close()
except Exception:
    pass
