"""首次启动播种：原版 18 道示例题 + 默认奖励 + 默认偏好（与旧版 seed 逐条一致）。"""
import json

from sqlalchemy.orm import Session

from . import models
from .services import add_days, now_iso, today

SEED = [
    ("语文", "“学而不思则罔，思而不学则殆”中，“罔”和“殆”分别是什么意思？", "罔：迷惑、感到迷茫。殆：疑惑。", "把“殆”误解成了“危险”，忽略了课文语境。", "文言实词", "概念不清"),
    ("语文", "判断句子“为了防止这类事故不再发生，我们加强了安全教育”的语病，并修改。", "否定不当。改为：为了防止这类事故再次发生，我们加强了安全教育。", "“防止”和“不再”叠加，使句意与本意相反。", "病句辨析", "审题疏漏"),
    ("数学", "解方程：2(x－3)＋4＝3x－5。", "2x－6＋4＝3x－5\n2x－2＝3x－5\nx＝3。", "去括号时漏乘常数项。", "一元一次方程", "计算失误"),
    ("数学", "直角三角形两条直角边分别为 6 和 8，斜边长是多少？", "由勾股定理：c²＝6²＋8²＝100，所以 c＝10。", "把直角边之和当成斜边长，未使用平方关系。", "勾股定理", "方法不熟"),
    ("英语", "用适当形式填空：She has ___ (be) to Beijing twice.", "been。has been to 表示去过某地，已经回来。", "混淆了 has been to 与 has gone to 的使用场景。", "现在完成时", "概念不清"),
    ("英语", "选择正确形式：If it ___ (rain) tomorrow, we will stay at home.", "rains。条件状语从句用一般现在时表示将来。", "看到 tomorrow 就直接使用 will rain。", "条件状语从句", "方法不熟"),
    ("物理", "一个物体质量为 2 kg，取 g＝10 N/kg，它受到的重力是多少？", "G＝mg＝2×10＝20 N，方向竖直向下。", "混淆质量与重力的单位，结果误写为 kg。", "重力计算", "计算失误"),
    ("物理", "同一导体两端电压从 3 V 增至 6 V，温度不变时，电阻怎样变化？", "电阻不变。温度不变时，同一导体的电阻由材料、长度、横截面积等决定。", "把 R＝U/I 理解为电阻随电压增大而增大，忽略电流也变化。", "欧姆定律", "概念不清"),
    ("化学", "配平化学方程式：Fe＋O₂ → Fe₃O₄。", "3Fe＋2O₂ → Fe₃O₄。", "配平只看铁原子，忽略了氧原子数量。", "化学方程式", "方法不熟"),
    ("化学", "20 g 氯化钠溶于 80 g 水，溶液中溶质的质量分数是多少？", "20÷(20＋80)×100%＝20%。", "分母误用溶剂质量，应该使用溶液总质量。", "溶液质量分数", "概念不清"),
    ("生物", "光合作用与呼吸作用分别主要在哪种细胞器中进行？", "光合作用主要在叶绿体中进行；有氧呼吸主要在线粒体中进行。", "把两个细胞器的功能记反了。", "细胞器", "记忆遗漏"),
    ("生物", "肺循环的起点和终点分别是什么？", "起点为右心室，终点为左心房。路径：右心室→肺动脉→肺部毛细血管→肺静脉→左心房。", "混淆了体循环和肺循环的起止位置。", "血液循环", "记忆遗漏"),
    ("历史", "秦朝统一后，为加强中央集权，在地方推行了什么制度？", "郡县制。地方主要官员由朝廷直接任免。", "把西周的分封制与秦朝的郡县制混淆。", "秦的统一", "概念不清"),
    ("历史", "中国近代史通常以哪一历史事件为开端？该事件开始于哪一年？", "鸦片战争，1840 年。", "记错了事件与年份的对应关系。", "近代史开端", "记忆遗漏"),
    ("地理", "地球自转产生的主要地理现象是什么？自转方向是什么？", "主要产生昼夜交替、地方时差等现象；方向为自西向东。", "把自转与公转产生的现象混在一起。", "地球运动", "概念不清"),
    ("地理", "在等高线地形图上，等高线越密集，坡度通常怎样变化？", "坡度越陡；等高线稀疏处，坡度较缓。", "读图时未比较等高线疏密。", "等高线地形图", "方法不熟"),
    ("道法", "我国的根本政治制度是什么？", "人民代表大会制度。", "把根本政治制度与基本政治制度混淆。", "国家制度", "概念不清"),
    ("道法", "当个人利益与集体利益发生冲突时，应如何处理？", "把集体利益放在个人利益之上，坚持集体主义；同时，集体应充分尊重和保护个人的正当利益。", "回答过于片面，忽略个人正当利益也需要得到尊重。", "集体与个人", "审题疏漏"),
]

DEFAULT_PREFS = {
    "name": "同学", "goal": 5, "minutes": 25, "theme": "light",
    "ai_provider": "qwen",
    "ai_qwen_endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "ai_qwen_vision": "qwen3-vl-plus", "ai_qwen_text": "qwen-plus",
    "ai_deepseek_endpoint": "https://api.deepseek.com",
    "ai_deepseek_vision": "deepseek-flash", "ai_deepseek_text": "deepseek-flash",
}


def seed_if_empty(db: Session):
    if db.query(models.Pref).filter(models.Pref.key == "seeded").first():
        return
    if db.query(models.Question).count() == 0:
        for i, r in enumerate(SEED):
            db.add(models.Question(
                id=f"demo-{i}", subject=r[0], title=r[1], answer=r[2], reason=r[3], tag=r[4], cause=r[5],
                difficulty=["基础", "进阶", "挑战"][i % 3], favorite=(i % 5 == 0),
                stage=3 if i % 4 == 0 else 0,
                due=add_days(today(), 4 if i % 4 == 0 else -(i % 3)),
                created=add_days(today(), -8 + i % 5), is_demo=True, source="demo", updated_at=now_iso()))
    for rid, name, cost in [("reward1", "自由阅读 30 分钟", 30), ("reward2", "周末选一部电影", 80), ("reward3", "给自己一份小点心", 50)]:
        if not db.query(models.Reward).filter(models.Reward.id == rid).first():
            db.add(models.Reward(id=rid, name=name, cost=cost))
    for k, v in DEFAULT_PREFS.items():
        if not db.query(models.Pref).filter(models.Pref.key == k).first():
            db.add(models.Pref(key=k, value=json.dumps(v, ensure_ascii=False)))
    db.merge(models.Pref(key="seeded", value="1"))
    db.commit()
