"""
companies.py — Company profile management

Access rules:
  Super Admin → full access across all companies
  Admin       → read & update ONLY their own company (geofence, wifi, name, address)
  HR          → read their company; can update non-security settings (name, address only)
  Others      → read their own company only
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, SuperAdminOnly, AdminOrHR, require_same_tenant
from app.models.domain_models import Company, Employee
from app.schemas.validation_schemas import CompanyOut, CompanyUpdate

router = APIRouter()


@router.get("/", response_model=List[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    List companies.
    - Super Admin: all companies.
    - All others: only their own company.
    """
    if current_user.role == "super_admin":
        return db.query(Company).order_by(Company.created_at.desc()).all()
    if current_user.company_id is None:
        return []
    return db.query(Company).filter(Company.id == current_user.company_id).all()


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Get company details by ID.
    - Super Admin: any company.
    - Others: only their own company.
    """
    require_same_tenant(company_id, current_user)

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(AdminOrHR)
):
    """
    Update company profile / office geofencing and wifi configuration.

    - Super Admin: can update any company.
    - Admin: can update their own company (including geofence/wifi/security settings).
    - HR: can update name and address only — security/geofence settings are restricted to Admin.
    """
    require_same_tenant(company_id, current_user)

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    update_data = payload.dict(exclude_unset=True)

    # Security-sensitive fields: restricted to admin and super_admin only
    restricted_fields = {
        "office_latitude", "office_longitude",
        "allowed_wifi_ssids", "allowed_wifi_bssids",
        "max_distance_meters"
    }
    modifying_restricted = restricted_fields.intersection(update_data.keys())
    if modifying_restricted and current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators can modify office network and geolocation settings.",
        )

    for key, value in update_data.items():
        setattr(company, key, value)

    db.commit()
    db.refresh(company)
    return company


@router.post("/", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: CompanyUpdate,  # Reuse CompanyUpdate or CompanyCreate (CompanyUpdate is fine as all fields except name are optional/nullable)
    db: Session = Depends(get_db),
    _: Employee = Depends(SuperAdminOnly)
):
    """
    [Super Admin Only] Create a new company.
    """
    if not payload.name:
        raise HTTPException(
            status_code=400,
            detail="Company name is required."
        )
    company = Company(
        name=payload.name,
        address=payload.address,
        office_latitude=payload.office_latitude if payload.office_latitude is not None else 28.6252,
        office_longitude=payload.office_longitude if payload.office_longitude is not None else 77.3736,
        allowed_wifi_ssids=payload.allowed_wifi_ssids if payload.allowed_wifi_ssids is not None else "office_wifi,office-5g,hr_connect_wifi,connect_office",
        allowed_wifi_bssids=payload.allowed_wifi_bssids if payload.allowed_wifi_bssids is not None else "",
        max_distance_meters=payload.max_distance_meters if payload.max_distance_meters is not None else 200.0,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company

