"""FastAPI 入口：组装路由、CORS、可选 API-Key 中间件、启动时建表+播种。
交互式 API 文档自动生成于 /docs（Swagger UI），机器可读契约在 /openapi.json。"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import ai, data, prefs, questions, rewards, stats
from .schemas import CAUSES, DIFFICULTIES, SUBJECTS
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 工程化项目通常用 Alembic 管理迁移；本项目保留 create_all 以便开箱即用，迁移路径见 README
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title="拾光错题本 API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def api_key_guard(request: Request, call_next):
    """设置环境变量 API_KEY 后，所有非 GET 的 /api 请求必须带 X-API-Key（默认不启用）。"""
    if settings.api_key and request.method != "GET" and request.url.path.startswith("/api"):
        if request.headers.get("X-API-Key") != settings.api_key:
            return JSONResponse({"detail": "缺少或错误的 X-API-Key"}, status_code=401)
    return await call_next(request)


@app.get("/api/health", tags=["meta"])
def health():
    return {"app": "shiguang-wrongbook-app", "version": "2.0.0",
            "database": engine.dialect.name}  # mysql / sqlite（本地调试）


@app.get("/api/meta", tags=["meta"])
def meta():
    return {"subjects": SUBJECTS, "causes": CAUSES, "difficulties": DIFFICULTIES,
            "ai": {"qwen": bool(settings.dashscope_api_key), "deepseek": bool(settings.deepseek_api_key)}}


for r in (questions, stats, rewards, prefs, ai, data):
    app.include_router(r.router, prefix="/api")
