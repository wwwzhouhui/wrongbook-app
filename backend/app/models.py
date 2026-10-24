"""8 张表，与旧 SQLite 版一一对应。长文本用 LONGTEXT(MySQL) / TEXT(其他) 变体：
MySQL 的 TEXT 上限只有 64KB，装不下一篇带图题的 base64 或长答案，必须显式声明。"""
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

BigText = Text().with_variant(LONGTEXT(), "mysql")


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    subject: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(BigText, nullable=False)
    answer: Mapped[str] = mapped_column(BigText, nullable=False)
    reason: Mapped[str] = mapped_column(BigText, default="")
    tag: Mapped[str] = mapped_column(String(200), default="")
    cause: Mapped[str] = mapped_column(String(50), default="")
    difficulty: Mapped[str] = mapped_column(String(10), default="基础")
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    stage: Mapped[int] = mapped_column(Integer, default=0)          # 连续掌握次数 0-5
    due: Mapped[str] = mapped_column(String(10), nullable=False)   # 下次复习日 YYYY-MM-DD
    created: Mapped[str] = mapped_column(String(10), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    deleted_at: Mapped[str | None] = mapped_column(String(40), nullable=True)  # 软删除 = 回收站
    updated_at: Mapped[str] = mapped_column(String(40), default="")
    attachment: Mapped["Attachment | None"] = relationship(back_populates="question", cascade="all, delete-orphan", uselist=False)

    __table_args__ = (Index("idx_q_due", "due", "deleted_at"), Index("idx_q_subject", "subject", "deleted_at"))


class Attachment(Base):
    __tablename__ = "attachments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), unique=True)
    image_data: Mapped[str] = mapped_column(BigText, nullable=False)  # base64 data URI
    created_at: Mapped[str] = mapped_column(String(40), default="")
    question: Mapped[Question] = relationship(back_populates="attachment")


class Log(Base):
    __tablename__ = "logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    at: Mapped[str] = mapped_column(String(40), default="")
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # add/review/practice/focus
    label: Mapped[str] = mapped_column(String(500), default="")
    points: Mapped[int] = mapped_column(Integer, default=0)
    qid: Mapped[str | None] = mapped_column(String(36), nullable=True)
    grade: Mapped[str | None] = mapped_column(String(10), nullable=True)  # again/hard/good
    minutes: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (Index("idx_logs_date", "date"), Index("idx_logs_qid", "qid", "date"))


class Reward(Base):
    __tablename__ = "rewards"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    cost: Mapped[int] = mapped_column(Integer, nullable=False)


class Redemption(Base):
    __tablename__ = "redemptions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    reward_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    cost: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    at: Mapped[str] = mapped_column(String(40), default="")


class Pref(Base):
    __tablename__ = "prefs"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(BigText, nullable=False)  # JSON 编码的值；密钥不入此表


class AiSet(Base):
    __tablename__ = "ai_sets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    subject: Mapped[str] = mapped_column(String(10), nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), default="")
    source_title: Mapped[str] = mapped_column(BigText, default="")
    mode: Mapped[str] = mapped_column(String(10), default="same")
    created: Mapped[str] = mapped_column(String(10), nullable=False)
    questions: Mapped[list["AiQuestion"]] = relationship(cascade="all, delete-orphan")


class AiQuestion(Base):
    __tablename__ = "ai_questions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    set_id: Mapped[str] = mapped_column(ForeignKey("ai_sets.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(BigText, nullable=False)
    answer: Mapped[str] = mapped_column(BigText, nullable=False)
    explanation: Mapped[str] = mapped_column(BigText, default="")
    knowledge: Mapped[str] = mapped_column(String(200), default="")
    note: Mapped[str] = mapped_column(BigText, default="")
    revealed: Mapped[bool] = mapped_column(Boolean, default=False)
    grade: Mapped[str] = mapped_column(String(10), default="")
