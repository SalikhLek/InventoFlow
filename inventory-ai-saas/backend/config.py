import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    secret_key: str
    db_path: str
    algorithm: str
    access_token_expire_minutes: int
    log_level: str
    cors_origins: tuple[str, ...]


@lru_cache
def get_settings() -> Settings:
    secret = os.getenv("INVENTORY_SECRET_KEY", "CHANGE_ME_DEV_SECRET")
    db = os.getenv("INVENTORY_DB_PATH", "inventory.db")
    origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    origins = tuple(o.strip() for o in origins_raw.split(",") if o.strip())
    return Settings(
        secret_key=secret,
        db_path=db,
        algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7))),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        cors_origins=origins if origins else ("http://localhost:3000", "http://127.0.0.1:3000"),
    )


settings = get_settings()
