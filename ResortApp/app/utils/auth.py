from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt
from app.models.user import User
from sqlalchemy.orm import Session, joinedload
from fastapi import Depends, HTTPException, status
from app.database import SessionLocal
from fastapi.security import OAuth2PasswordBearer
import os

# ENV
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "24"))

# Removed pwd_context - using bcrypt directly
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_password_hash(password):
    # Use bcrypt directly to avoid compatibility issues
    password_bytes = password.encode("utf-8")
    # bcrypt handles truncation automatically, but we'll limit to 72 bytes to be safe
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]

    # Generate salt and hash password using bcrypt directly
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain, hashed):
    # Use bcrypt directly to avoid compatibility issues
    password_bytes = plain.encode("utf-8")
    # bcrypt handles truncation automatically, but we'll limit to 72 bytes to be safe
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]

    # Verify password using bcrypt directly
    return bcrypt.checkpw(password_bytes, hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=100))
    to_encode.update({"exp": expire})
    encoded = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    # Handle both string and bytes return from jwt.encode (version compatibility)
    return encoded.decode('utf-8') if isinstance(encoded, bytes) else encoded


def decode_token(token: str):
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Check if token is None or empty
        if not token:
            raise credentials_exception
        
        payload = decode_token(token)
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except HTTPException:
        # Re-raise HTTP exceptions (like 401/403 from OAuth2PasswordBearer)
        raise
    except JWTError:
        raise credentials_exception
    except Exception as e:
        # Catch any other exceptions during token decoding
        import traceback
        print(f"ERROR in get_current_user (token decode): {str(e)}\n{traceback.format_exc()}")
        raise credentials_exception
    try:
        user = db.query(User).options(joinedload(User.role)).filter(User.id == user_id).first()
        if user is None:
            raise credentials_exception
        if user.role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User role not found. Please contact administrator."
            )
        return user
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any database errors
        import traceback
        print(f"ERROR in get_current_user (database query): {str(e)}\n{traceback.format_exc()}")
        raise credentials_exception
