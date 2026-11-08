from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
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

    # AI & Centralized LLM Configuration
    GROQ_API_KEY: str = ""
    GROQ_API_KEY_2: str = ""
    TAVILY_API_KEY: str = ""
    BRAVE_SEARCH_API_KEY: str = ""
    SERPER_API_KEY: str = ""
    LLM_PROVIDER: str = "groq"
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    FALLBACK_MODEL: str = "openai/gpt-oss-20b"
    EXPERIMENTAL_MODEL: str = "openai/gpt-oss-20b"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 2500
    LLM_TIMEOUT_SECONDS: int = 60

    @property
    def groq_api_keys(self) -> list[str]:
        """Returns all configured Groq API keys as an active pool."""
        keys = []
        if self.GROQ_API_KEY:
            keys.append(self.GROQ_API_KEY.strip())
        if self.GROQ_API_KEY_2:
            keys.append(self.GROQ_API_KEY_2.strip())
        return keys or [""]

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
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    META_GRAPH_API_VERSION: str = "v22.0"


settings = Settings()
