"""
employees.py — Employee management (tenant-isolated)

Tenant isolation rules enforced here:
  1. All queries automatically filter by current_user.company_id.
  2. employee_id uniqueness is per-tenant (two companies can both have EMP-001).
  3. department_id and reporting_manager_id must belong to the same company.
  4. Admins cannot create super_admin or another admin (use /admins/ for that).
  5. HR cannot create admin or HR accounts.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash
from app.api.v1.deps import (
    get_current_active_user, AdminOrHR, AdminHROrManager, require_same_tenant
)
from app.models.domain_models import Employee, Document, Department
from app.schemas.validation_schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut, DocumentOut

router = APIRouter()


# ---------------------------------------------------------------------------
# Guards / helpers
# ---------------------------------------------------------------------------

def _assert_cross_reference_in_tenant(
    db: Session,
    company_id: int,
    department_id: Optional[int],
    reporting_manager_id: Optional[int],
) -> None:
    """
    Ensure that a department and reporting manager, if provided,
    both belong to the same company as the new/updated employee.
    """
    if department_id is not None:
        dept = db.query(Department).filter(Department.id == department_id).first()
        if not dept or dept.company_id != company_id:
            raise HTTPException(
                status_code=400,
                detail="The specified department does not belong to your company.",
            )

    if reporting_manager_id is not None:
        mgr = db.query(Employee).filter(Employee.id == reporting_manager_id).first()
        if not mgr or mgr.company_id != company_id:
            raise HTTPException(
                status_code=400,
                detail="The specified reporting manager does not belong to your company.",
            )


def _assert_employee_id_unique_in_tenant(
    db: Session, employee_id_str: str, company_id: int, exclude_id: Optional[int] = None
) -> None:
    """Check employee_id uniqueness within a single tenant (company)."""
    query = db.query(Employee).filter(
        Employee.employee_id == employee_id_str,
        Employee.company_id == company_id,
    )
    if exclude_id is not None:
        query = query.filter(Employee.id != exclude_id)
    if query.first():
        raise HTTPException(
            status_code=400,
            detail=f"An employee with ID '{employee_id_str}' already exists in your company.",
        )


# ---------------------------------------------------------------------------
# Create employee
# ---------------------------------------------------------------------------

@router.post("/", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(
    employee_in: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Create a new employee profile.

    Permission matrix:
      super_admin → can create any role, for any company
      admin       → can create hr, manager, employee within their company
      hr          → can create manager, employee within their company
      others      → forbidden
    """
    creator_role = current_user.role
    role_to_create = employee_in.role

    # --- Permission check ---
    if creator_role == "super_admin":
        pass  # unrestricted
    elif creator_role == "admin":
        if role_to_create in ("super_admin", "admin"):
            raise HTTPException(
                status_code=403,
                detail="Admins cannot create Super Admin or Admin accounts. "
                       "Use the /admins/ endpoint to provision a new tenant admin.",
            )
    elif creator_role == "hr":
        if role_to_create in ("super_admin", "admin", "hr"):
            raise HTTPException(
                status_code=403,
                detail="HR personnel can only create Manager or Employee accounts.",
            )
    else:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to create employee profiles.",
        )

    # --- Determine company_id ---
    if creator_role == "super_admin":
        company_id = employee_in.company_id
        if company_id is None:
            raise HTTPException(
                status_code=400,
                detail="Super Admin must specify a company_id when creating an employee.",
            )
    else:
        company_id = current_user.company_id

    # --- Global email uniqueness (emails must be unique across the whole system) ---
    if db.query(Employee).filter(Employee.email == employee_in.email.lower()).first():
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists.",
        )

    # --- Per-tenant employee_id uniqueness ---
    _assert_employee_id_unique_in_tenant(db, employee_in.employee_id, company_id)

    # --- Validate cross-references stay within the same tenant ---
    _assert_cross_reference_in_tenant(
        db, company_id, employee_in.department_id, employee_in.reporting_manager_id
    )

    db_employee = Employee(
        email=employee_in.email.lower(),
        hashed_password=get_password_hash(employee_in.password),
        first_name=employee_in.first_name,
        last_name=employee_in.last_name,
        employee_id=employee_in.employee_id,
        role=role_to_create,
        is_active=employee_in.is_active,
        company_id=company_id,
        department_id=employee_in.department_id,
        reporting_manager_id=employee_in.reporting_manager_id,
        bank_name=employee_in.bank_name,
        bank_account_no=employee_in.bank_account_no,
        salary_amount=employee_in.salary_amount,
        emergency_contact=employee_in.emergency_contact,
        casual_leaves_entitled=employee_in.casual_leaves_entitled,
        sick_leaves_entitled=employee_in.sick_leaves_entitled,
        wfh_leaves_entitled=employee_in.wfh_leaves_entitled,
        earned_leaves_entitled=employee_in.earned_leaves_entitled,
    )
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


# ---------------------------------------------------------------------------
# List employees
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[EmployeeOut])
def read_employees(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    department_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    current_user: Employee = Depends(AdminHROrManager)
):
    """
    Retrieve a list of employees (Admin, HR & Managers only).

    - Super Admin: all employees across all tenants.
    - Admin / HR: all employees in their company.
    - Manager: only their direct reports.
    """
    query = db.query(Employee)

    # Tenant isolation
    if current_user.role != "super_admin":
        query = query.filter(Employee.company_id == current_user.company_id)

    # Managers see only direct reports
    if current_user.role == "manager":
        query = query.filter(Employee.reporting_manager_id == current_user.id)
    else:
        if manager_id is not None:
            query = query.filter(Employee.reporting_manager_id == manager_id)

    if department_id is not None:
        query = query.filter(Employee.department_id == department_id)

    return query.offset(skip).limit(limit).all()


# ---------------------------------------------------------------------------
# Get current user
# ---------------------------------------------------------------------------

@router.get("/me", response_model=EmployeeOut)
def read_employee_me(
    current_user: Employee = Depends(get_current_active_user)
):
    """Fetch the currently logged-in user's profile."""
    return current_user


@router.get("/me/documents", response_model=List[DocumentOut])
def get_my_documents(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Get all documents for the logged-in employee."""
    return db.query(Document).filter(Document.employee_id == current_user.id).all()


# ---------------------------------------------------------------------------
# Get employee by ID
# ---------------------------------------------------------------------------

@router.get("/{employee_id_val}", response_model=EmployeeOut)
def read_employee_by_id(
    employee_id_val: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Retrieve a specific employee by primary key.

    - Super Admin: anyone.
    - Admin / HR: anyone in their company.
    - Manager: their direct reports.
    - Employee: only themselves.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id_val).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Super Admin passes through
    if current_user.role == "super_admin":
        return employee

    # Tenant boundary
    require_same_tenant(employee.company_id, current_user)

    if current_user.role in ("admin", "hr"):
        return employee
    if current_user.role == "manager" and employee.reporting_manager_id == current_user.id:
        return employee
    if current_user.id == employee.id:
        return employee

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to view this employee profile.",
    )


# ---------------------------------------------------------------------------
# Update employee
# ---------------------------------------------------------------------------

@router.put("/{employee_id_val}", response_model=EmployeeOut)
def update_employee(
    employee_id_val: int,
    employee_update: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Update employee profile.

    - Admin / HR: can update all fields (role, department, salary, etc.).
    - Employee: can update personal info only (email, bank details, emergency contact, password).
    """
    db_employee = db.query(Employee).filter(Employee.id == employee_id_val).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Super Admin can touch anyone; everyone else must stay in their tenant
    if current_user.role != "super_admin":
        require_same_tenant(db_employee.company_id, current_user)

    is_admin_or_hr = current_user.role in ("super_admin", "admin", "hr")
    is_self = current_user.id == db_employee.id

    if not (is_admin_or_hr or is_self):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this profile.",
        )

    update_data = employee_update.dict(exclude_unset=True)

    # Guard: prevent modifying the root super_admin
    if db_employee.role == "super_admin":
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=403,
                detail="Only Super Admins can modify Super Admin accounts.",
            )
        if "role" in update_data and update_data["role"] != "super_admin":
            raise HTTPException(status_code=400, detail="The Super Admin role cannot be changed.")
        if "is_active" in update_data and not update_data["is_active"]:
            if db_employee.email.lower() == settings.ADMIN_EMAIL.lower():
                raise HTTPException(
                    status_code=400,
                    detail="The root Super Admin account cannot be deactivated.",
                )

    # Guard: role elevation/demotion rules
    if "role" in update_data and update_data["role"] != db_employee.role:
        new_role = update_data["role"]
        if current_user.role != "super_admin":
            if new_role in ("super_admin", "admin") or db_employee.role in ("super_admin", "admin"):
                raise HTTPException(
                    status_code=403,
                    detail="You do not have permission to assign or remove Admin/Super Admin roles.",
                )
            if current_user.role == "hr" and new_role == "hr":
                raise HTTPException(
                    status_code=403,
                    detail="HR personnel cannot assign the HR role.",
                )

    # Guard: company transfer only by super_admin
    if "company_id" in update_data and update_data["company_id"] != db_employee.company_id:
        if current_user.role != "super_admin":
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to change company associations.",
            )

    # Validate cross-references if they are being updated
    target_company_id = update_data.get("company_id", db_employee.company_id)
    _assert_cross_reference_in_tenant(
        db,
        target_company_id,
        update_data.get("department_id"),
        update_data.get("reporting_manager_id"),
    )

    # Validate per-tenant employee_id uniqueness if it changed
    if "employee_id" in update_data and update_data["employee_id"] != db_employee.employee_id:
        _assert_employee_id_unique_in_tenant(
            db, update_data["employee_id"], target_company_id, exclude_id=db_employee.id
        )

    # Strip privileged fields for non-admin/hr self-updates
    if not is_admin_or_hr:
        forbidden_keys = {
            "role", "is_active", "department_id", "reporting_manager_id",
            "salary_amount", "company_id",
            "casual_leaves_entitled", "sick_leaves_entitled",
            "wfh_leaves_entitled", "earned_leaves_entitled",
        }
        for key in list(update_data.keys()):
            if key in forbidden_keys:
                del update_data[key]

    # Hash password if included
    if "password" in update_data:
        if update_data["password"]:
            db_employee.hashed_password = get_password_hash(update_data["password"])
        del update_data["password"]

    for key, value in update_data.items():
        setattr(db_employee, key, value)

    db.commit()
    db.refresh(db_employee)
    return db_employee


# ---------------------------------------------------------------------------
# Deactivate (soft delete) employee
# ---------------------------------------------------------------------------

@router.delete("/{employee_id_val}", response_model=EmployeeOut)
def deactivate_employee(
    employee_id_val: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    Soft-delete an employee by setting is_active=False. (Admin & HR only)
    """
    db_employee = db.query(Employee).filter(Employee.id == employee_id_val).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if current_user.role != "super_admin":
        require_same_tenant(db_employee.company_id, current_user)

    if db_employee.role == "super_admin":
        raise HTTPException(
            status_code=400,
            detail="The Super Admin account cannot be deactivated or deleted.",
        )

    db_employee.is_active = False
    db.commit()
    db.refresh(db_employee)
    return db_employee
