"""
departments.py — Department management (tenant-isolated)

Non-super-admin users have company_id auto-injected — they never need to
pass it in the request body (and cannot create departments in another company).
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, AdminOrHR, require_same_tenant
from app.models.domain_models import Department, Company, Employee
from app.schemas.validation_schemas import DepartmentCreate, DepartmentOut

router = APIRouter()


@router.get("/", response_model=List[DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    List departments.
    - Super Admin: all departments across all companies.
    - Others: only departments in their own company.
    """
    if current_user.role == "super_admin":
        return db.query(Department).order_by(Department.company_id, Department.name).all()
    if current_user.company_id is None:
        return []
    return (
        db.query(Department)
        .filter(Department.company_id == current_user.company_id)
        .order_by(Department.name)
        .all()
    )


@router.post("/", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    Create a new department (Admin & HR only).

    - Non-super-admins: company_id is auto-assigned from their token;
      any company_id in the payload is ignored.
    - Super Admin: must supply company_id explicitly in the payload.
    """
    if current_user.role == "super_admin":
        target_company_id = payload.company_id
        if target_company_id is None:
            raise HTTPException(
                status_code=400,
                detail="Super Admin must supply a company_id when creating a department.",
            )
    else:
        # Auto-assign — ignore any company_id sent in the body
        target_company_id = current_user.company_id

    # Verify the target company exists
    company = db.query(Company).filter(Company.id == target_company_id).first()
    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found. A department must be linked to an existing company.",
        )

    department = Department(
        name=payload.name,
        company_id=target_company_id,
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    Delete a department (Admin & HR only).
    Enforces tenant boundary.
    """
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    require_same_tenant(department.company_id, current_user)

    db.delete(department)
    db.commit()
    return None
