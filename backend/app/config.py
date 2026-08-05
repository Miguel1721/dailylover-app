from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    # Base setup
    app_name: str = "Daily Lover AI System"
    
    # Database
    database_url: str = Field(..., validation_alias="DATABASE_URL")
    
    # Redis
    redis_url: str = Field(..., validation_alias="REDIS_URL")
    redis_password: str = Field(..., validation_alias="REDIS_PASSWORD")
    
    # APIs
    anthropic_api_key: str = Field("", validation_alias="ANTHROPIC_API_KEY")
    openai_api_key: str = Field("", validation_alias="OPENAI_API_KEY")
    gemini_api_key: str = Field("", validation_alias="GEMINI_API_KEY")
    anthropic_base_url: str = Field("", validation_alias="ANTHROPIC_BASE_URL")
    demo_mode: bool = Field(False, validation_alias="DEMO_MODE")
    jwt_secret_key: str = Field("default_insecure_jwt_secret", validation_alias="JWT_SECRET_KEY")
    
    # Webhooks
    whatsapp_api_token: str = Field("", validation_alias="WHATSAPP_API_TOKEN")
    whatsapp_phone_number_id: str = Field("", validation_alias="WHATSAPP_PHONE_NUMBER_ID")
    whatsapp_webhook_verify_token: str = Field("daily_lover_verify_token_default", validation_alias="WHATSAPP_WEBHOOK_VERIFY_TOKEN")
    smartmatchapp_webhook_secret: str = Field(..., validation_alias="SMARTMATCHAPP_WEBHOOK_SECRET")




    
    # AWS S3 / Oracle Object Storage
    aws_access_key_id: str = Field("", validation_alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field("", validation_alias="AWS_SECRET_ACCESS_KEY")
    aws_s3_bucket: str = Field("", validation_alias="AWS_S3_BUCKET")
    aws_endpoint_url: str = Field("", validation_alias="AWS_ENDPOINT_URL")
    aws_default_region: str = "us-east-1"

    
    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
