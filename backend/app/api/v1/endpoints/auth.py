from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.api.v1.deps import get_current_active_user
from app.models.domain_models import Employee
from app.schemas.validation_schemas import Token, UserLogin, EmployeeOut

router = APIRouter()


def _build_token(employee: Employee) -> Token:
    """Helper: create a JWT and return the Token schema."""
    access_token = create_access_token(
        subject=employee.id,
        role=employee.role,
        company_id=employee.company_id,   # None for super_admin
    )
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=employee.role,
        company_id=employee.company_id,
    )


def _authenticate(email: str, password: str, db: Session) -> Employee:
    """Shared auth logic — raises HTTPException on failure."""
    employee = db.query(Employee).filter(Employee.email == email.lower()).first()
    if not employee or not verify_password(password, employee.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    if not employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive employee account",
        )
    return employee


@router.post("/login", response_model=Token)
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    OAuth2 compatible token login (form-data).
    Returns JWT with role and company_id embedded.
    """
    employee = _authenticate(form_data.username, form_data.password, db)
    return _build_token(employee)


@router.post("/login-json", response_model=Token)
def login_json(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Login via JSON payload (used by mobile and Next.js frontend).
    Returns JWT with role and company_id embedded.
    """
    employee = _authenticate(login_data.email, login_data.password, db)
    return _build_token(employee)


@router.get("/me", response_model=EmployeeOut)
def get_me(
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Return the currently authenticated user's full profile.
    Useful for frontend bootstrap (role, company_id, name, etc.).
    """
    return current_user
