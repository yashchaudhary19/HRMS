"""
salary.py — Salary slip management (tenant-isolated)
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, AdminOrHR, require_same_tenant
from app.models.domain_models import SalarySlip, Employee
from app.schemas.validation_schemas import SalarySlipOut, SalaryHistoryOut

router = APIRouter()


# ---------------------------------------------------------------------------
# Schema for issuing a new salary slip
# ---------------------------------------------------------------------------

class SalarySlipCreate(BaseModel):
    employee_id: int
    month: str                  # e.g. "June 2025"
    payout_date: date
    status: str = "processing"  # processing | paid | pending
    gross_salary: float
    base_salary: float
    bonus: float = 0.0
    federal_tax: float = 0.0
    health_insurance: float = 0.0
    retirement_contribution: float = 0.0


# ---------------------------------------------------------------------------
# Employee endpoints (self)
# ---------------------------------------------------------------------------

@router.get("/slips", response_model=List[SalarySlipOut])
def get_my_salary_slips(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Get all salary slips for the logged-in employee."""
    return (
        db.query(SalarySlip)
        .filter(SalarySlip.employee_id == current_user.id)
        .order_by(SalarySlip.payout_date.desc())
        .all()
    )


@router.get("/history", response_model=SalaryHistoryOut)
def get_salary_history(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Retrieve YTD tax metrics and salary trends (net payout for last 6 months)."""
    slips = (
        db.query(SalarySlip)
        .filter(SalarySlip.employee_id == current_user.id)
        .order_by(SalarySlip.payout_date.desc())
        .all()
    )
    if not slips:
        return {"ytd_tax": 0.0, "trends": []}

    current_year = date.today().year
    ytd_tax = sum(slip.federal_tax for slip in slips if slip.payout_date.year == current_year)

    latest_6 = sorted(slips[:6], key=lambda s: s.payout_date)
    trends = [
        {"month": slip.month.split()[0][:3], "payout": slip.net_payout}
        for slip in latest_6
    ]
    return {"ytd_tax": ytd_tax, "trends": trends}


# ---------------------------------------------------------------------------
# Admin / HR endpoints — manage salary slips (tenant-isolated)
# ---------------------------------------------------------------------------

@router.get("/all", response_model=List[SalarySlipOut])
def get_all_salary_slips(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    [Admin / HR] List all salary slips.
    Optionally filtered by employee_id.
    Scoped to the current user's company.
    """
    query = db.query(SalarySlip)

    if current_user.role != "super_admin":
        query = (
            query
            .join(Employee, SalarySlip.employee_id == Employee.id)
            .filter(Employee.company_id == current_user.company_id)
        )

    if employee_id is not None:
        target_emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not target_emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        require_same_tenant(target_emp.company_id, current_user)
        query = query.filter(SalarySlip.employee_id == employee_id)

    return query.order_by(SalarySlip.payout_date.desc()).all()


@router.post("/issue", response_model=SalarySlipOut, status_code=status.HTTP_201_CREATED)
def issue_salary_slip(
    payload: SalarySlipCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    [Admin / HR] Issue a new salary slip for an employee.
    Computes total_deductions and net_payout automatically.
    """
    employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found.")

    require_same_tenant(employee.company_id, current_user)

    # Prevent duplicate slips for the same employee + month
    if db.query(SalarySlip).filter(
        SalarySlip.employee_id == payload.employee_id,
        SalarySlip.month == payload.month,
    ).first():
        raise HTTPException(
            status_code=400,
            detail=f"A salary slip for '{payload.month}' already exists for this employee.",
        )

    total_deductions = payload.federal_tax + payload.health_insurance + payload.retirement_contribution
    net_payout = payload.gross_salary - total_deductions

    slip = SalarySlip(
        employee_id=payload.employee_id,
        month=payload.month,
        payout_date=payload.payout_date,
        status=payload.status,
        gross_salary=payload.gross_salary,
        base_salary=payload.base_salary,
        bonus=payload.bonus,
        federal_tax=payload.federal_tax,
        health_insurance=payload.health_insurance,
        retirement_contribution=payload.retirement_contribution,
        total_deductions=total_deductions,
        net_payout=net_payout,
        pdf_size="—",
    )
    db.add(slip)
    db.commit()
    db.refresh(slip)
    return slip


@router.put("/{slip_id}/status", response_model=SalarySlipOut)
def update_slip_status(
    slip_id: int,
    new_status: str,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """[Admin / HR] Update the status of a salary slip (processing → paid, etc.)."""
    valid_statuses = {"processing", "paid", "pending"}
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {sorted(valid_statuses)}",
        )

    slip = db.query(SalarySlip).filter(SalarySlip.id == slip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Salary slip not found.")

    recipient = db.query(Employee).filter(Employee.id == slip.employee_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Employee not found.")

    require_same_tenant(recipient.company_id, current_user)

    slip.status = new_status
    db.commit()
    db.refresh(slip)
    return slip


@router.delete("/{slip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_salary_slip(
    slip_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """[Admin / HR] Delete a salary slip."""
    slip = db.query(SalarySlip).filter(SalarySlip.id == slip_id).first()
    if not slip:
        raise HTTPException(status_code=404, detail="Salary slip not found.")

    recipient = db.query(Employee).filter(Employee.id == slip.employee_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Employee not found.")

    require_same_tenant(recipient.company_id, current_user)

    db.delete(slip)
    db.commit()
