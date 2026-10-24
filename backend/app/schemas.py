"""Pydantic v2 请求/响应模型：校验从旧版手写 validate() 改为声明式 schema，
非法学科、超长字段、非法图片会在进入业务逻辑前被 FastAPI 以 422 拦截。"""
import re

from pydantic import BaseModel, field_validator

SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "道法"]
CAUSES = ["概念不清", "计算失误", "审题疏漏", "方法不熟", "记忆遗漏"]
DIFFICULTIES = ["基础", "进阶", "挑战"]
IMAGE_RE = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")


def check_image(v: str) -> str:
    if v and (len(v) > 2_200_000 or not IMAGE_RE.match(v)):
        raise ValueError("图片格式或大小不符合要求（压缩后的 png/jpeg/webp，≤约1.6MB）")
    return v


class QuestionIn(BaseModel):
    subject: str
    title: str
    answer: str
    reason: str = ""
    tag: str = ""
    cause: str = ""
    difficulty: str = "基础"
    favorite: bool = False
    image: str = ""
    source: str = "manual"

    @field_validator("subject")
    @classmethod
    def subject_ok(cls, v):
        if v not in SUBJECTS:
            raise ValueError("学科不合法")
        return v

    @field_validator("title", "answer")
    @classmethod
    def not_empty(cls, v):
        if not v.strip():
            raise ValueError("题目和参考答案不能为空")
        return v.strip()

    @field_validator("title", "answer", "reason")
    @classmethod
    def length_ok(cls, v):
        if len(v) > 10000:
            raise ValueError("字段过长")
        return v

    @field_validator("image")
    @classmethod
    def image_ok(cls, v):
        return check_image(v)


class QuestionPatch(BaseModel):
    subject: str | None = None
    title: str | None = None
    answer: str | None = None
    reason: str | None = None
    tag: str | None = None
    cause: str | None = None
    difficulty: str | None = None
    image: str | None = None

    @field_validator("subject")
    @classmethod
    def subject_ok(cls, v):
        if v is not None and v not in SUBJECTS:
            raise ValueError("学科不合法")
        return v

    @field_validator("image")
    @classmethod
    def image_ok(cls, v):
        return check_image(v) if v is not None else v


class GradeIn(BaseModel):
    qid: str
    mode: str = "review"
    grade: str

    @field_validator("mode")
    @classmethod
    def mode_ok(cls, v):
        if v not in ("review", "practice"):
            raise ValueError("mode 不合法")
        return v

    @field_validator("grade")
    @classmethod
    def grade_ok(cls, v):
        if v not in ("again", "hard", "good"):
            raise ValueError("grade 不合法")
        return v


class FocusIn(BaseModel):
    minutes: int

    @field_validator("minutes")
    @classmethod
    def minutes_ok(cls, v):
        if not 1 <= v <= 600:
            raise ValueError("专注时长不合法")
        return v


class RewardIn(BaseModel):
    name: str
    cost: int

    @field_validator("name")
    @classmethod
    def name_ok(cls, v):
        if not v.strip():
            raise ValueError("奖励名称不能为空")
        return v.strip()

    @field_validator("cost")
    @classmethod
    def cost_ok(cls, v):
        if not 1 <= v <= 10000:
            raise ValueError("所需积分不合法")
        return v


class AiQuestionIn(BaseModel):
    title: str
    answer: str
    explanation: str = ""
    knowledge: str = ""


class AiSetIn(BaseModel):
    subject: str
    sourceId: str = ""
    sourceTitle: str = ""
    mode: str = "same"
    questions: list[AiQuestionIn]

    @field_validator("questions")
    @classmethod
    def three_only(cls, v):
        if len(v) != 3:
            raise ValueError("每组变式题必须恰好 3 道")
        return v


class AiGradeIn(BaseModel):
    grade: str = ""

    @field_validator("grade")
    @classmethod
    def grade_ok(cls, v):
        if v not in ("again", "hard", "good", ""):
            raise ValueError("自评不合法")
        return v


class AiChatIn(BaseModel):
    provider: str | None = None
    endpoint: str
    apiKey: str | None = None
    request: dict
