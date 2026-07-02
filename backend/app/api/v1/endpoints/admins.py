"""
admins.py — Tenant Admin management (Super Admin only)

Endpoints in this module are exclusively for the Super Admin (service owner)
to manage the client companies and their designated admin accounts.

Flow:
  POST /admins/          → atomically create a Company + Admin account
  GET  /admins/          → list all tenant admins (with company details)
  GET  /admins/{id}      → get a specific admin
  PUT  /admins/{id}      → update admin credentials / active status
  POST /admins/{id}/suspend   → toggle tenant suspension
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.api.v1.deps import get_current_active_user, SuperAdminOnly
from app.models.domain_models import Employee, Company
from app.schemas.validation_schemas import (
    AdminCreate, AdminOut, AdminUpdate,
    CompanyOut, CompanyStats, SubscriptionUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_admin_or_404(admin_id: int, db: Session) -> Employee:
    """Fetch an admin-role employee by primary key, raise 404 if not found."""
    admin = db.query(Employee).filter(
        Employee.id == admin_id,
        Employee.role == "admin"
    ).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found.")
    return admin


# ---------------------------------------------------------------------------
# List all tenant admins
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[AdminOut])
def list_admins(
    db: Session = Depends(get_db),
    _: Employee = Depends(SuperAdminOnly)
):
    """
    [Super Admin] List every admin account across all tenants.
    Each result includes the nested company object.
    """
    admins = (
        db.query(Employee)
        .filter(Employee.role == "admin")
        .order_by(Employee.created_at.desc())
        .all()
    )
    return admins


# ---------------------------------------------------------------------------
# Create company + admin atomically
# ---------------------------------------------------------------------------

@router.post("/", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
def create_admin(
    payload: AdminCreate,
    db: Session = Depends(get_db),
    _: Employee = Depends(SuperAdminOnly)
):
    """
    [Super Admin] Provision a new tenant.

    Creates the Company record and the Admin account in a single transaction.
    If either step fails, both are rolled back.
    """
    # 1. Guard: admin email must be globally unique
    if db.query(Employee).filter(Employee.email == payload.admin_email.lower()).first():
        raise HTTPException(
            status_code=400,
            detail=f"An account with email '{payload.admin_email}' already exists."
        )

    # 2. Create Company
    company = Company(
        name=payload.company_name,
        address=payload.company_address,
        subscription_plan=payload.subscription_plan or "basic",
        is_active=True,
    )
    db.add(company)
    db.flush()   # populate company.id without committing yet

    # 3. Guard: employee_id must be unique within this (new) company — trivially true for first admin
    #    but we check globally for the admin_employee_id just in case.
    existing_emp_id = db.query(Employee).filter(
        Employee.employee_id == payload.admin_employee_id,
        Employee.company_id == company.id,
    ).first()
    if existing_emp_id:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Employee ID '{payload.admin_employee_id}' already exists in this company."
        )

    # 4. Create Admin account linked to the new company
    admin = Employee(
        email=payload.admin_email.lower(),
        hashed_password=get_password_hash(payload.admin_password),
        first_name=payload.admin_first_name,
        last_name=payload.admin_last_name,
        employee_id=payload.admin_employee_id,
        role="admin",
        is_active=True,
        company_id=company.id,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


# ---------------------------------------------------------------------------
# Get single admin
# ---------------------------------------------------------------------------

@router.get("/{admin_id}", response_model=AdminOut)
def get_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    _: Employee = Depends(SuperAdminOnly)
):
    """[Super Admin] Retrieve a specific tenant admin by ID."""
    return _get_admin_or_404(admin_id, db)


# ---------------------------------------------------------------------------
# Update admin credentials / status
# ---------------------------------------------------------------------------

@router.put("/{admin_id}", response_model=AdminOut)
def update_admin(
    admin_id: int,
    payload: AdminUpdate,
    db: Session = Depends(get_db),
    _: Employee = Depends(SuperAdminOnly)
):
    """
    [Super Admin] Update an admin account.
    Supports: name, email, password reset, is_active toggle.
    """
    admin = _get_admin_or_404(admin_id, db)

    if payload.admin_email is not None:
        new_email = payload.admin_email.lower()
        conflict = db.query(Employee).filter(
            Employee.email == new_email,
            Employee.id != admin_id
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Email already in use by another account.")
        admin.email = new_email

    if payload.first_name is not None:
        admin.first_name = payload.first_name

    if payload.last_name is not None:
        admin.last_name = payload.last_name

    if payload.password is not None:
        admin.hashed_password = get_password_hash(payload.password)

    if payload.is_active is not None:
        admin.is_active = payload.is_active

    db.commit()
    db.refresh(admin)
    return admin


# ---------------------------------------------------------------------------
# Suspend / unsuspend entire tenant
# ---------------------------------------------------------------------------

@router.post("/{admin_id}/suspend", response_model=CompanyOut)
def toggle_tenant_suspension(
    admin_id: int,
    db: Session = Depends(get_db),
    _: Employee = Depends(SuperAdminOnly)
):
    """
    [Super Admin] Toggle the is_active flag on a tenant's Company.

    When a company is suspended (is_active=False):
      - All employees of that company get HTTP 403 on login.
      - The admin account itself is also blocked from active use.
    Returns the updated Company object.
    """
    admin = _get_admin_or_404(admin_id, db)

    if admin.company_id is None:
        raise HTTPException(status_code=400, detail="This admin is not linked to any company.")

    company = db.query(Company).filter(Company.id == admin.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    company.is_active = not company.is_active
    action = "activated" if company.is_active else "suspended"
    db.commit()
    db.refresh(company)

    print(f"[TENANT] Company '{company.name}' (ID {company.id}) has been {action}.")
    return company


# ---------------------------------------------------------------------------
# Update subscription plan
# ---------------------------------------------------------------------------

@router.patch("/{admin_id}/subscription", response_model=CompanyOut)
def update_subscription(
    admin_id: int,
    payload: SubscriptionUpdate,
    db: Session = Depends(get_db),
    _: Employee = Depends(SuperAdminOnly)
):
    """
    [Super Admin] Change the subscription plan or active status of a tenant.
    """
    admin = _get_admin_or_404(admin_id, db)

    if admin.company_id is None:
        raise HTTPException(status_code=400, detail="This admin is not linked to any company.")

    valid_plans = {"basic", "pro", "enterprise"}
    company = db.query(Company).filter(Company.id == admin.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    if payload.subscription_plan is not None:
        if payload.subscription_plan not in valid_plans:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid plan. Choose from: {sorted(valid_plans)}"
            )
        company.subscription_plan = payload.subscription_plan

    if payload.is_active is not None:
        company.is_active = payload.is_active

    db.commit()
    db.refresh(company)
    return company


# ---------------------------------------------------------------------------
# Tenant stats (for Super Admin dashboard)
# ---------------------------------------------------------------------------

@router.get("/{admin_id}/stats", response_model=CompanyStats)
def get_tenant_stats(
    admin_id: int,
    db: Session = Depends(get_db),
    _: Employee = Depends(SuperAdminOnly)
):
    """
    [Super Admin] Return usage statistics for a specific tenant.
    """
    from app.models.domain_models import Department

    admin = _get_admin_or_404(admin_id, db)

    if admin.company_id is None:
        raise HTTPException(status_code=400, detail="This admin is not linked to any company.")

    company = db.query(Company).filter(Company.id == admin.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    total_employees = db.query(Employee).filter(
        Employee.company_id == company.id,
        Employee.role == "employee"
    ).count()

    total_admins = db.query(Employee).filter(
        Employee.company_id == company.id,
        Employee.role == "admin"
    ).count()

    total_departments = db.query(Department).filter(
        Department.company_id == company.id
    ).count()

    return CompanyStats(
        company_id=company.id,
        company_name=company.name,
        subscription_plan=company.subscription_plan,
        is_active=company.is_active,
        total_employees=total_employees,
        total_departments=total_departments,
        total_admins=total_admins,
        created_at=company.created_at,
    )
