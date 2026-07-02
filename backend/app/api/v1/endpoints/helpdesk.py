"""
helpdesk.py — Help ticket management (tenant-isolated)

All ticket reads and writes are scoped to the current user's company.
"""

import random
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, AdminOrHR, require_same_tenant
from app.models.domain_models import HelpTicket, Employee
from app.schemas.validation_schemas import HelpTicketCreate, HelpTicketOut, HelpTicketUpdate

router = APIRouter()


def _get_ticket_or_404(ticket_id: int, db: Session) -> HelpTicket:
    ticket = db.query(HelpTicket).filter(HelpTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.get("/tickets", response_model=List[HelpTicketOut])
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Get all support tickets raised by the currently logged-in employee."""
    return (
        db.query(HelpTicket)
        .filter(HelpTicket.employee_id == current_user.id)
        .order_by(HelpTicket.created_at.desc())
        .all()
    )


@router.post("/tickets", response_model=HelpTicketOut, status_code=status.HTTP_201_CREATED)
def raise_ticket(
    payload: HelpTicketCreate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Submit a new support ticket. Generates a unique ticket number."""
    # Simple collision-resistant ticket number
    for _ in range(5):
        ticket_no = f"TK-{random.randint(1000, 9999)}"
        if not db.query(HelpTicket).filter(HelpTicket.ticket_no == ticket_no).first():
            break

    new_ticket = HelpTicket(
        ticket_no=ticket_no,
        employee_id=current_user.id,
        category=payload.category,
        title=payload.title,
        description=payload.description,
        status="open",
        last_message="Ticket submitted. Waiting for assignment.",
        assigned_to="Unassigned",
        created_at=datetime.utcnow(),
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket


@router.get("/tickets/all", response_model=List[HelpTicketOut])
def get_all_tickets(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    [Admin / HR] Get all support tickets scoped to their company.
    Super Admin sees all tickets across every tenant.
    """
    query = db.query(HelpTicket)

    if current_user.role != "super_admin":
        # Join through Employee to filter by company
        query = (
            query
            .join(Employee, HelpTicket.employee_id == Employee.id)
            .filter(Employee.company_id == current_user.company_id)
        )

    return query.order_by(HelpTicket.created_at.desc()).all()


@router.patch("/tickets/{ticket_id}", response_model=HelpTicketOut)
def update_ticket(
    ticket_id: int,
    payload: HelpTicketUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    [Admin / HR] Update ticket status, assignee, or last message.
    Enforces tenant boundary: Admin/HR can only update tickets within their company.
    """
    ticket = _get_ticket_or_404(ticket_id, db)

    # Verify the ticket owner belongs to the same company
    ticket_owner = db.query(Employee).filter(Employee.id == ticket.employee_id).first()
    if ticket_owner:
        require_same_tenant(ticket_owner.company_id, current_user)

    if payload.status is not None:
        ticket.status = payload.status
        if payload.status.lower() == "resolved":
            ticket.closed_at = datetime.utcnow()

    if payload.assigned_to is not None:
        ticket.assigned_to = payload.assigned_to

    if payload.last_message is not None:
        ticket.last_message = payload.last_message

    db.commit()
    db.refresh(ticket)
    return ticket
