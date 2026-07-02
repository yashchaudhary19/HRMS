"""
leaves.py — Leave request management (tenant-isolated)
"""

from datetime import date, datetime
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, AdminHROrManager, require_same_tenant
from app.models.domain_models import LeaveRequest, Employee
from app.schemas.validation_schemas import LeaveRequestCreate, LeaveRequestOut, LeaveStatusUpdate

router = APIRouter()

# Default leave allocations per year
DEFAULT_ALLOCATIONS = {
    "casual": 15,
    "sick": 10,
    "wfh": 30,
    "earned": 12,
    "maternity": 90,
    "paternity": 15,
    "half_day": 10,
}


# ---------------------------------------------------------------------------
# Internal helper: compute leave balances for any employee
# ---------------------------------------------------------------------------

def calculate_balances_for_employee(db: Session, employee: Employee) -> Dict[str, int]:
    current_year = datetime.utcnow().year
    approved_leaves = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == employee.id,
        LeaveRequest.status == "approved",
        LeaveRequest.start_date >= date(current_year, 1, 1),
    ).all()

    taken_days = {key: 0 for key in DEFAULT_ALLOCATIONS}
    for req in approved_leaves:
        days = (req.end_date - req.start_date).days + 1
        l_type = req.leave_type.lower()
        if l_type in taken_days:
            taken_days[l_type] += days

    allocations = {
        "casual": employee.casual_leaves_entitled if employee.casual_leaves_entitled is not None else 15,
        "sick": employee.sick_leaves_entitled if employee.sick_leaves_entitled is not None else 10,
        "wfh": employee.wfh_leaves_entitled if employee.wfh_leaves_entitled is not None else 30,
        "earned": employee.earned_leaves_entitled if employee.earned_leaves_entitled is not None else 12,
        "maternity": 90,
        "paternity": 15,
        "half_day": 10,
    }
    return {key: max(0, allocated - taken_days[key]) for key, allocated in allocations.items()}


# ---------------------------------------------------------------------------
# Apply for leave
# ---------------------------------------------------------------------------

@router.post("/apply", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
def apply_leave(
    payload: LeaveRequestCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Submit a new leave request."""
    if payload.start_date > payload.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before or equal to end date.",
        )

    leave_type_lower = payload.leave_type.lower()
    if leave_type_lower not in DEFAULT_ALLOCATIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid leave type. Allowed: {list(DEFAULT_ALLOCATIONS.keys())}",
        )

    db_leave = LeaveRequest(
        employee_id=current_user.id,
        leave_type=leave_type_lower,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="pending",
        reason=payload.reason,
    )
    db.add(db_leave)
    db.commit()
    db.refresh(db_leave)
    return db_leave


# ---------------------------------------------------------------------------
# Employee: my requests
# ---------------------------------------------------------------------------

@router.get("/my-requests", response_model=List[LeaveRequestOut])
def get_my_leave_requests(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """List all leave requests filed by the logged-in employee."""
    return (
        db.query(LeaveRequest)
        .filter(LeaveRequest.employee_id == current_user.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Employee: leave balances
# ---------------------------------------------------------------------------

@router.get("/balances", response_model=Dict[str, int])
def get_leave_balances(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Calculate remaining leave balances for the logged-in employee."""
    return calculate_balances_for_employee(db, current_user)


# ---------------------------------------------------------------------------
# Admin/HR/Manager: pending requests
# ---------------------------------------------------------------------------

@router.get("/pending", response_model=List[LeaveRequestOut])
def get_pending_leave_requests(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminHROrManager)
):
    """
    Fetch pending leave requests requiring approval.

    - Super Admin: cross-tenant visibility.
    - Admin / HR: all pending in their company.
    - Manager: pending from their direct reports only.
    """
    query = db.query(LeaveRequest).filter(LeaveRequest.status == "pending")

    if current_user.role != "super_admin":
        query = (
            query
            .join(Employee, LeaveRequest.employee_id == Employee.id)
            .filter(Employee.company_id == current_user.company_id)
        )

    if current_user.role == "manager":
        report_ids = [r.id for r in current_user.direct_reports]
        query = query.filter(LeaveRequest.employee_id.in_(report_ids))

    requests = query.order_by(LeaveRequest.created_at.asc()).all()

    for r in requests:
        if r.employee:
            r.employee_balances = calculate_balances_for_employee(db, r.employee)

    return requests


# ---------------------------------------------------------------------------
# Admin/HR/Manager: approve or reject
# ---------------------------------------------------------------------------

@router.put("/{leave_id}/status", response_model=LeaveRequestOut)
def update_leave_status(
    leave_id: int,
    payload: LeaveStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminHROrManager)
):
    """
    Approve or reject a leave request.

    - Admin / HR: any request in their company.
    - Manager: only direct reports' requests.
    """
    req = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    applicant = db.query(Employee).filter(Employee.id == req.employee_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Employee not found.")

    # Tenant boundary
    if current_user.role != "super_admin":
        require_same_tenant(applicant.company_id, current_user)

    if req.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"This leave request has already been {req.status}.",
        )

    # Manager: can only act on direct reports
    if current_user.role == "manager":
        if applicant.reporting_manager_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only approve/reject leaves of their direct reports.",
            )

    new_status = payload.status.lower()
    if new_status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'.")

    req.status = new_status
    req.approved_by_id = current_user.id
    db.commit()
    db.refresh(req)
    return req
