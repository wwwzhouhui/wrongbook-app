# 错题本 · 工程化版（FastAPI + React + MySQL + Docker）

按指定技术栈重构的版本：后端 **FastAPI**、前端 **React（Vite + npm 工程化）**、数据库 **MySQL 8**、
**Docker Compose** 三容器一键部署。界面、九科、间隔复习与积分规则与原版/旧版完全一致；
JSON 备份仍保持原版 schema=1 格式，三版之间可互相迁移。

## 技术栈总览

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | React 18 + Vite 6（npm，含 package-lock） | 11 个页面按 `src/pages/` 拆分，公共组件在 `src/components/`，API 层统一封装在 `src/api.js`；样式复用原版 CSS |
| 后端 | FastAPI 0.115 + Uvicorn（ASGI） | `app/routers/` 按域拆分（questions / stats / rewards / prefs / ai / data），自动生成 OpenAPI 文档 `/docs` |
| 校验 | Pydantic v2 | 请求模型在 `app/schemas.py`，非法学科/超长/非法图片在入口以 422 拦截（替代旧版手写 validate） |
| 数据访问 | SQLAlchemy 2.0 ORM | `app/models.py` 8 张表；长文本用 MySQL `LONGTEXT` 变体（普通 TEXT 只有 64KB，装不下带图题） |
| 数据库 | MySQL 8.0（utf8mb4） | compose 内置，数据卷 `mysql_data` 持久化；后端等 db 健康检查通过才启动 |
| AI 代理 | httpx（异步） | 千问/DeepSeek OpenAI 兼容协议；白名单、禁重定向、密钥脱敏沿用旧版设计；密钥走环境变量或页面内存 |
| 部署 | Docker Compose 3 服务 | db（MySQL）+ backend（FastAPI）+ frontend（Node 构建 → nginx 托管并反代 /api） |

## 一键启动（Docker）

```bash
cp .env.example .env      # 按需改 MySQL 密码、AI 密钥；默认密码也能直接跑
docker compose up -d --build
```

- 前端入口：http://localhost:8080
- API 文档（Swagger）：http://localhost:8000/docs
- 停服保留数据：`docker compose down`；连数据卷一起删：`docker compose down -v`（慎用）

首次启动后端自动建表并播种 18 道示例题与默认奖励（「偏好与数据」里可清除示例题）。

## 本地开发（不走 Docker）

```bash
# 后端（需要一台 MySQL，或临时用 SQLite 验证业务逻辑——ORM 已做方言隔离）
cd backend
pip install -r requirements.txt
export DATABASE_URL="mysql+pymysql://wrongbook:wrongbook@localhost:3306/wrongbook?charset=utf8mb4"
# 或：export DATABASE_URL="sqlite:///./dev.db"
uvicorn app.main:app --reload --port 8000

# 前端（另开一个终端）
cd frontend
npm install
npm run dev        # http://localhost:5173，/api 已由 vite.config.js 代理到 8000
npm run build      # 产出 dist/（已实测构建成功：约 196KB JS / gzip 63KB）
```

## 目录结构

```
docker-compose.yml / .env.example
backend/
  Dockerfile                python:3.12-slim + uvicorn，带 /api/health 健康检查
  requirements.txt          fastapi / uvicorn / sqlalchemy / pymysql / cryptography / pydantic / httpx
  app/
    main.py                 应用组装：CORS、可选 API-Key 中间件、启动建表+播种
    config.py               pydantic-settings，全部配置走环境变量
    database.py             引擎/会话（pool_pre_ping 处理 MySQL 长连接回收）
    models.py               8 张表的 ORM 模型与索引
    schemas.py              Pydantic 请求模型与校验器
    services.py             SRS/积分/统计/导入导出等领域逻辑（与存储无关）
    seed.py                 18 道示例题 + 默认奖励/偏好
    routers/                questions（CRUD/复习/练习/专注）· stats · rewards · prefs · ai · data
  tests/test_api.py         13 项断言（自带 SQLite 临时库，见下方自测）
frontend/
  Dockerfile                多阶段：node:24-alpine 构建 → nginx:alpine 托管
  nginx.conf                /api 反代 backend:8000（120s 超时、25MB 体积），SPA 回退
  package.json / vite.config.js
  src/
    api.js                  统一请求封装、图片 Canvas 压缩、AI 密钥仅驻留内存
    App.jsx                 外壳（侧边栏/顶栏/Toast/编辑与详情弹窗挂载）
    components/             ui.jsx（图标/徽章/AI 设置块等）、Editor.jsx（编辑器/详情）
    pages/                  Home / Library / Session（复习+练习）/ CalendarStats /
                            Grow（小伙伴+专注）/ AiPages（拍照录题+举一反三）/ Settings
    styles.css              原版样式原样复用
qa/                         无头浏览器实测截图（首页/错题库/今日复习）
```

## 配置（.env）

| 变量 | 默认 | 说明 |
|---|---|---|
| MYSQL_DATABASE / USER / PASSWORD / ROOT_PASSWORD | wrongbook / wrongbook / wrongbook / rootpass | compose 用它们拼装后端连接串 |
| API_KEY | 空 | 设置后所有写接口需带 `X-API-Key` 请求头（前端可用 `VITE_API_KEY` 构建变量携带），单机自用可留空 |
| DASHSCOPE_API_KEY / DEEPSEEK_API_KEY | 空 | 配在后端环境里则前端免填；不配也能在页面临时填写（只驻留内存） |

## 数据库迁移说明（如实）

启动时用 SQLAlchemy `create_all` 幂等建表（表不存在才建，不改已有表结构）。
如果后续要改字段，应引入 **Alembic** 做版本化迁移（`services.py` 与存储无关，迁移只动 models/迁移脚本）；
本版未内置 Alembic，是为保持开箱即用，README 在此明示。

## 与上一版（标准库 + SQLite）的差异

- 服务形态：单进程脚本 → FastAPI 标准工程（路由/模型/服务分层，`/docs` 自动契约）；
- 前端：原生 JS 单文件 → React 组件化 + Vite 构建，开发热更新、生产出静态包由 nginx 托管；
- 数据库：SQLite 单文件 → MySQL 8（并发、连接池、独立备份/运维）；因走 ORM，本地调试仍可一键切 SQLite；
- 部署：双击脚本 → Docker Compose 三容器（健康检查、依赖顺序、数据卷、反向代理都配好）。

## 自测结果（2026-10-23 实测）

- 后端：`python tests/test_api.py` **13/13 通过**（临时 SQLite 库跑同一套 ORM 与业务代码：播种、建题积分、SRS 三档、同日防重复、专注封顶、回收站、搜索、schema=1 导出/导入回环、422 校验、AI 白名单）。
- 前端：`npm install && npm run build` 成功，37 个模块，产物见上。
- 端到端：uvicorn + Vite dev（代理）实跑，无头 Chromium 打开首页/错题库/今日复习三页，数据由 API 真实渲染、零 page error，截图在 `qa/`。
- **未实测项（如实说明）**：本开发 VM 没有 Docker 与 MySQL，`docker compose up` 与 MySQL 方言路径未在此机实际运行；
  Compose 文件已通过 YAML 解析校验，MySQL 差异点（LONGTEXT、RAND()、utf8mb4 连接串、健康检查探针）
  均已针对性处理，首次在有 Docker 的机器上启动时请留意 `docker compose logs backend` 的建表日志。
