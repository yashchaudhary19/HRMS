from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.domain_models import Employee, Company
from app.schemas.validation_schemas import TokenData


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


# ---------------------------------------------------------------------------
# Core auth dependency
# ---------------------------------------------------------------------------

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> Employee:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        company_id: Optional[int] = payload.get("company_id")

        if user_id is None:
            raise credentials_exception

        token_data = TokenData(user_id=int(user_id), role=role, company_id=company_id)
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(Employee).filter(Employee.id == token_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    return user


def get_current_active_user(
    current_user: Employee = Depends(get_current_user),
) -> Employee:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive employee account")

    # Block login for all users of a suspended tenant (except super_admin)
    if current_user.role != "super_admin" and current_user.company_id is not None:
        # Lazy import to avoid circular dependency
        from sqlalchemy.orm import Session as _Session
        # company is eager-loaded via relationship — just check the attribute
        company = current_user.company
        if company and not company.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your company account has been suspended. Please contact support.",
            )
    return current_user


# ---------------------------------------------------------------------------
# Tenant guard helper
# ---------------------------------------------------------------------------

def require_same_tenant(target_company_id: Optional[int], current_user: Employee) -> None:
    """
    Raise 403 if a non-super-admin tries to access data belonging to a
    different tenant (company). Super admins always pass through.
    """
    if current_user.role == "super_admin":
        return
    if target_company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access data from another company.",
        )


# ---------------------------------------------------------------------------
# Role-based access control
# ---------------------------------------------------------------------------

class RoleChecker:
    """Dependency that allows only the specified roles (super_admin always passes)."""

    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(
        self, current_user: Employee = Depends(get_current_active_user)
    ) -> Employee:
        if current_user.role == "super_admin":
            return current_user
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have enough permissions to perform this action.",
            )
        return current_user


# ---------------------------------------------------------------------------
# Convenience role shortcuts (use as FastAPI dependencies)
# ---------------------------------------------------------------------------

SuperAdminOnly = RoleChecker(allowed_roles=["super_admin"])
AdminOnly = RoleChecker(allowed_roles=["admin"])
AdminOrHR = RoleChecker(allowed_roles=["admin", "hr"])
AdminHROrManager = RoleChecker(allowed_roles=["admin", "hr", "manager"])
