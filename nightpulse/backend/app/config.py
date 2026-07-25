from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Base setup
    app_name: str = "NightPulse AI"

    # Database
    database_url: str = Field(..., validation_alias="DATABASE_URL")

    # Redis
    redis_url: str = Field("redis://localhost:6379/0", validation_alias="REDIS_URL")
    redis_password: str = Field("", validation_alias="REDIS_PASSWORD")

    # AI APIs
    anthropic_api_key: str = Field("", validation_alias="ANTHROPIC_API_KEY")
    openai_api_key: str = Field("", validation_alias="OPENAI_API_KEY")
    gemini_api_key: str = Field("", validation_alias="GEMINI_API_KEY")

    # Auth
    jwt_secret_key: str = Field(
        "default_insecure_jwt_secret", validation_alias="JWT_SECRET_KEY"
    )
    demo_mode: bool = Field(True, validation_alias="DEMO_MODE")

    # CORS
    cors_origins: str = Field("*", validation_alias="CORS_ORIGINS")

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
