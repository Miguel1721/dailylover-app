from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.config import get_settings
from jose import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext

settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["Auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=1)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm="HS256")
    return encoded_jwt

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Demo bypass
    if settings.demo_mode:
        # Check standard user
        query = text("SELECT id, email, password_hash, full_name, role, brand_access FROM platform_users WHERE email = :email")
        res = await db.execute(query, {"email": req.email})
        user = res.fetchone()
        
        if user:
            # Check password
            if pwd_context.verify(req.password, user.password_hash) or req.password == "admin123":
                token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})
                return {
                    "access_token": token,
                    "token_type": "bearer",
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "full_name": user.full_name,
                        "role": user.role,
                        "brand_access": user.brand_access
                    }
                }
        
        # In demo mode, fallback to a dummy user if not in database
        if req.email == "admin@nightpulse.ai" and req.password == "admin123":
            token = create_access_token({"sub": req.email, "role": "superadmin", "id": 1})
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": 1,
                    "email": req.email,
                    "full_name": "Admin NightPulse",
                    "role": "superadmin",
                    "brand_access": [1, 2, 3, 4, 5]
                }
            }

    # Standard db check
    query = text("SELECT id, email, password_hash, full_name, role, brand_access FROM platform_users WHERE email = :email")
    res = await db.execute(query, {"email": req.email})
    user = res.fetchone()
    
    if not user or not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas"
        )
        
    token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "brand_access": user.brand_access
        }
    }
