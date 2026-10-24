"""运行时配置：全部来自环境变量（Docker Compose / .env 注入），代码里不写死任何连接串与密钥。"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Docker Compose 默认值与 compose 文件一致；本地开发可改成 sqlite:///./dev.db 免装 MySQL 调试业务逻辑
    database_url: str = "mysql+pymysql://wrongbook:wrongbook@db:3306/wrongbook?charset=utf8mb4"
    cors_origins: str = "http://localhost:5173,http://localhost:8080,http://127.0.0.1:8080"
    # 可选：设置后，所有写接口需带请求头 X-API-Key（单用户本地部署默认不设）
    api_key: str = ""
    dashscope_api_key: str = ""
    deepseek_api_key: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
