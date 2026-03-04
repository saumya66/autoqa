from pathlib import Path
from pydantic_settings import BaseSettings

_CLOUD_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _CLOUD_ROOT / ".env"


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "autoqa"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    class Config:
        case_sensitive = True
        env_file = str(_ENV_FILE)
        extra = "ignore"


settings = Settings()
