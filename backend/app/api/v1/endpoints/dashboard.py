"""
dashboard.py — Announcements and holidays (tenant-isolated)

Announcements / holidays with company_id=NULL are treated as global
(visible to all tenants). Company-specific ones are visible only to
employees of that company.
"""

from typing import List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, AdminOrHR, require_same_tenant
from app.models.domain_models import Announcement, Holiday, Employee
from app.schemas.validation_schemas import AnnouncementOut, HolidayOut, AnnouncementBase, HolidayBase

router = APIRouter()


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------

@router.get("/announcements", response_model=List[AnnouncementOut])
def get_announcements(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Get announcements: tenant-specific + global (company_id=NULL)."""
    if current_user.role == "super_admin":
        return db.query(Announcement).order_by(Announcement.created_at.desc()).all()
    return (
        db.query(Announcement)
        .filter(
            (Announcement.company_id == current_user.company_id)
            | (Announcement.company_id.is_(None))
        )
        .order_by(Announcement.created_at.desc())
        .all()
    )


@router.post("/announcements", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementBase,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    Create a new announcement (Admin & HR only).
    - Super Admin: company_id=NULL → global announcement visible to all tenants.
    - Admin / HR: scoped to their own company.
    """
    company_id = None if current_user.role == "super_admin" else current_user.company_id
    announcement = Announcement(
        title=payload.title,
        content=payload.content,
        tag=payload.tag,
        is_urgent=payload.is_urgent,
        company_id=company_id,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """Delete an announcement (Admin & HR only). Tenant boundary enforced."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")

    # Global announcements (company_id=None) can only be deleted by super_admin
    if announcement.company_id is None and current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin can delete global announcements.",
        )

    if announcement.company_id is not None:
        require_same_tenant(announcement.company_id, current_user)

    db.delete(announcement)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Holidays
# ---------------------------------------------------------------------------

@router.get("/holidays", response_model=List[HolidayOut])
def get_holidays(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Get holidays: tenant-specific + global (company_id=NULL)."""
    if current_user.role == "super_admin":
        return db.query(Holiday).order_by(Holiday.date.asc()).all()
    return (
        db.query(Holiday)
        .filter(
            (Holiday.company_id == current_user.company_id)
            | (Holiday.company_id.is_(None))
        )
        .order_by(Holiday.date.asc())
        .all()
    )


@router.post("/holidays", response_model=HolidayOut, status_code=status.HTTP_201_CREATED)
def create_holiday(
    payload: HolidayBase,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    Create a new holiday (Admin & HR only).
    - Super Admin: global holiday (company_id=NULL).
    - Admin / HR: scoped to their own company.
    """
    day_name = payload.day_name or payload.date.strftime("%A")
    company_id = None if current_user.role == "super_admin" else current_user.company_id
    holiday = Holiday(
        title=payload.title,
        date=payload.date,
        day_name=day_name,
        holiday_type=payload.holiday_type,
        company_id=company_id,
    )
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """Delete a holiday (Admin & HR only). Tenant boundary enforced."""
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    if holiday.company_id is None and current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin can delete global holidays.",
        )

    if holiday.company_id is not None:
        require_same_tenant(holiday.company_id, current_user)

    db.delete(holiday)
    db.commit()
    return None
