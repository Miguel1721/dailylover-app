from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.config import get_settings
from typing import Optional

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_account_id: str, role_id: Optional[str]) -> str:
    """Generates a JWT access token with an 8-hour expiration."""
    expire = datetime.utcnow() + timedelta(hours=8)
    to_encode = {
        "sub": str(user_account_id),
        "role_id": str(role_id) if role_id else None,
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm="HS256")
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    """Decodes a JWT access token, returning its payload if valid."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
        return payload
    except JWTError:
        return None
