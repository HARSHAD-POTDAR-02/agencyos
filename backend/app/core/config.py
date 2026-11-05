from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://agencyos:agencyos_pass@localhost:5432/agencyos_db"
    SYNC_DATABASE_URL: str = "postgresql://agencyos:agencyos_pass@localhost:5432/agencyos_db"

    # Auth
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # AI
    GROQ_API_KEY: str = ""

    # File storage
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "agencyos-assets"

    # File storage (local filesystem for MVP)
    UPLOAD_DIR: str = "uploads"

    # App
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"


settings = Settings()
