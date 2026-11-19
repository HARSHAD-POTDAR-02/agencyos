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
    TAVILY_API_KEY_2: str = ""
    BRAVE_SEARCH_API_KEY: str = ""
    SERPER_API_KEY: str = ""
    LLM_PROVIDER: str = "groq"
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    FALLBACK_MODEL: str = "openai/gpt-oss-120b"
    EXPERIMENTAL_MODEL: str = "openai/gpt-oss-20b"
    CAMPAIGN_STRATEGY_MODEL: str = "minimaxai/minimax-m3.1-flash"
    CAMPAIGN_CONTENT_MODEL: str = "minimaxai/minimax-m3.1-flash"
    CAMPAIGN_EVALUATION_MODEL: str = "openai/gpt-oss-120b"
    LLM_TEMPERATURE: float = 0.2
    LLM_MAX_TOKENS: int = 2500
    LLM_TIMEOUT_SECONDS: int = 120

    # NVIDIA NIM Configuration
    NVIDIA_API_KEY: str = ""
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_MODEL: str = "nvidia/nemotron-3.5-lightning-30b-a3b"
    MARKET_RESEARCH_MODEL: str = "nvidia/nemotron-3.5-lightning-30b-a3b"

    @property
    def groq_api_keys(self) -> list[str]:
        """Returns all configured Groq API keys as an active pool."""
        keys = []
        if self.GROQ_API_KEY:
            keys.append(self.GROQ_API_KEY.strip())
        if self.GROQ_API_KEY_2:
            keys.append(self.GROQ_API_KEY_2.strip())
        return keys or [""]

    @property
    def tavily_api_keys(self) -> list[str]:
        """Returns all configured Tavily API keys as an active pool."""
        keys = []
        if self.TAVILY_API_KEY:
            keys.append(self.TAVILY_API_KEY.strip())
        if self.TAVILY_API_KEY_2:
            keys.append(self.TAVILY_API_KEY_2.strip())
        return keys or [""]

    # File storage (Backblaze B2 / S3 / Local)
    STORAGE_BACKEND: str = "b2"  # "b2", "s3", or "local"
    B2_ENDPOINT: str = "https://s3.us-east-005.backblazeb2.com"
    B2_KEY_ID: str = ""
    B2_APPLICATION_KEY: str = ""
    B2_BUCKET_NAME: str = "agencyos-bucket"
    B2_REGION: str = "us-east-005"
    B2_PRESIGNED_EXPIRATION_SECONDS: int = 86400  # 24 hours

    # S3 Fallback Compatibility
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "agencyos-assets"
    S3_REGION: str = "us-east-005"

    # File storage (local filesystem fallback/cache)
    UPLOAD_DIR: str = "uploads"

    # App
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    META_GRAPH_API_VERSION: str = "v22.0"
    META_APP_ID: str = "573556449081156"
    META_APP_SECRET: str = ""


settings = Settings()
