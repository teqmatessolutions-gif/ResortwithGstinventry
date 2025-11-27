from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import SessionLocal
from app.schemas.auth import LoginRequest, Token
from app.utils import auth
from app.curd import user as crud_user
from fastapi import Depends
from app.utils.auth import get_current_user


router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(auth.get_db)):
    try:
        # Check if user exists
        user = crud_user.get_user_by_email(db, request.email)
        if not user:
            print(f"Login attempt: User not found for email: {request.email}")
            raise HTTPException(status_code=400, detail="Invalid credentials")
        
        # Check if user is active
        if not user.is_active:
            print(f"Login attempt: User {request.email} is inactive")
            raise HTTPException(status_code=400, detail="Account is inactive. Please contact administrator.")
        
        # Check if user has a role
        if not user.role:
            print(f"Login attempt: User {request.email} has no role assigned")
            raise HTTPException(status_code=400, detail="User role not assigned. Please contact administrator.")
        
        # Verify password
        try:
            password_valid = auth.verify_password(request.password, user.hashed_password)
        except Exception as pwd_error:
            print(f"Password verification error for {request.email}: {str(pwd_error)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=400, detail="Invalid credentials")
        
        if not password_valid:
            print(f"Login attempt: Invalid password for email: {request.email}")
            raise HTTPException(status_code=400, detail="Invalid credentials")
        
        # Create access token
        access_token = auth.create_access_token(
            data={"user_id": user.id, "role": user.role.name},
            expires_delta=timedelta(hours=auth.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        print(f"Login successful: {request.email}")
        return {"access_token": access_token}
    except HTTPException:
        # Re-raise HTTP exceptions (like invalid credentials)
        raise
    except Exception as e:
        # Log unexpected errors
        print(f"Login error for {request.email}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@router.get("/admin-only")
def admin_data(user=Depends(get_current_user)):
    if user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"message": "Admin access granted"}



