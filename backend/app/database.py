"""SQLAlchemy 2.0 引擎与会话。业务代码只写 ORM 模型，MySQL / SQLite 方言差异由此层吸收。"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

# Neon 等托管 Postgres 给的连接串可能是 postgres:// 短协议名，SQLAlchemy 2.0 要求 postgresql://
_db_url = settings.database_url
if _db_url.startswith("postgres://"):
    _db_url = "postgresql://" + _db_url[len("postgres://"):]

connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
engine = create_engine(
    _db_url,
    pool_pre_ping=True,          # MySQL 长连接被服务端断开时自动重连
    pool_recycle=3600,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
