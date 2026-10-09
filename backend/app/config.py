"""应用配置。

Embedding 走本地 LM Studio（OpenAI 兼容端点）；
LLM 走云端 API，base_url / api_key / model 由前端在界面上自定义配置并保存到本地。
"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 项目根目录（backend/app/config.py 的上两级）
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    # ---- Embedding：本地 LM Studio（OpenAI 兼容端点） ----
    # 默认指向本地 LM Studio，端口 1234，可被 .env 覆盖
    embedding_base_url: str = "http://localhost:1234/v1"
    embedding_api_key: str = "lm-studio"  # 占位，LM Studio 不校验
    embedding_model: str = "text-embedding-qwen3-embedding-0.6b"

    # 向量库 / 检索参数（暂不暴露给前端调参，固定值）
    chunk_size: int = 500        # 分块大小（字符）
    chunk_overlap: int = 80      # 分块重叠（字符）
    top_k: int = 4               # 检索返回片段数
    # 检索相似度阈值（cosine），低于该值的片段不进入上下文；0 表示不过滤
    score_threshold: float = 0.0

    # 数据目录
    data_dir: Path = BASE_DIR / "data"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "files").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "vectors").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "index").mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
