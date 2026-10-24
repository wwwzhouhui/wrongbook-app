"""后端自测：用 SQLite 临时库跑同一套 ORM/业务代码（生产为 MySQL），覆盖与旧版相同的 13 项断言。
运行：cd backend && DATABASE_URL=sqlite:///./test.db pytest tests/ -q   或直接 python tests/test_api.py"""
import os
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DATABASE_URL", "sqlite:///./test-run.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

DB_FILE = Path("test-run.db")
if DB_FILE.exists():
    DB_FILE.unlink()

checks = []


def check(name, cond):
    checks.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name)


with TestClient(app) as c:
    st = c.get("/api/stats").json()
    check("首次启动播种 18 道示例题", st["total"] == 18)

    r = c.post("/api/questions", json={"subject": "数学", "title": "1+1=?", "answer": "2",
                                       "tag": "加法", "cause": "计算失误", "reason": "粗心", "difficulty": "基础"})
    qid = r.json()["question"]["id"]
    check("新建错题 +3 分", r.status_code == 201 and r.json()["pointsAwarded"] == 3)

    r = c.post("/api/review/grade", json={"qid": qid, "mode": "review", "grade": "good"}).json()
    check("首次复习 +5 分且间隔 1 天", r["pointsAwarded"] == 5
          and r["question"]["due"] == (date.today() + timedelta(days=1)).isoformat()
          and r["question"]["stage"] == 1)

    r = c.post("/api/review/grade", json={"qid": qid, "mode": "review", "grade": "good"}).json()
    check("同日重复复习不再给分、间隔 3 天", r["pointsAwarded"] == 0
          and r["question"]["due"] == (date.today() + timedelta(days=3)).isoformat())

    r = c.post("/api/review/grade", json={"qid": qid, "mode": "review", "grade": "again"}).json()
    check("还不会：stage 归零、明天复习", r["question"]["stage"] == 0
          and r["question"]["due"] == (date.today() + timedelta(days=1)).isoformat())

    r = c.post("/api/focus", json={"minutes": 45}).json()
    check("专注 45 分钟封顶 +30", r["pointsAwarded"] == 30)

    rw = c.get("/api/rewards").json()
    check("积分余额 = 3+5+30", rw["balance"] == 38)

    assert c.delete(f"/api/questions/{qid}").status_code == 200
    lst = c.get("/api/questions", params={"deleted": True}).json()["questions"]
    check("删除进入回收站", any(q["id"] == qid for q in lst))

    assert c.post(f"/api/questions/{qid}/restore").status_code == 200
    lst = c.get("/api/questions", params={"q": "1+1"}).json()["questions"]
    check("回收站恢复 + 搜索命中", any(q["id"] == qid for q in lst))

    exp = c.get("/api/export/json").json()
    check("导出与原版 schema=1 兼容", exp["schema"] == 1 and len(exp["questions"]) == 19)

    r = c.post("/api/import/json", json=exp).json()
    st = c.get("/api/stats").json()
    check("导入原版备份可全量恢复", r["imported"] == 19 and st["total"] == 19)

    r = c.post("/api/questions", json={"subject": "不存在", "title": "x", "answer": "y"})
    check("非法学科被拒绝（Pydantic 422）", r.status_code == 422)

    r = c.post("/api/ai/chat", json={"endpoint": "https://evil.example.com/v1",
                                     "request": {"model": "x", "messages": []}})
    check("AI 代理白名单拦截非官方地址", r.status_code == 400)

failed = [n for n, ok in checks if not ok]
print(f"\n{len(checks) - len(failed)}/{len(checks)} passed")
if DB_FILE.exists():
    DB_FILE.unlink()
sys.exit(1 if failed else 0)
