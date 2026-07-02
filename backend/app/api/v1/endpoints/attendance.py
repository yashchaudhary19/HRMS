"""
attendance.py — Attendance check-in/check-out (tenant-isolated)

Geofencing and device-binding logic is unchanged.
Tenant isolation is enforced on all history/admin queries.
"""

from datetime import date, datetime
from typing import List, Optional
import os
import math
import urllib.request
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, AdminOrHR, AdminHROrManager, require_same_tenant
from app.models.domain_models import Attendance, Employee
from app.schemas.validation_schemas import AttendanceCheckIn, AttendanceCheckOut, AttendanceOut

router = APIRouter()


# ---------------------------------------------------------------------------
# Device binding
# ---------------------------------------------------------------------------

def verify_device_binding(db: Session, employee: Employee, device_id: Optional[str]) -> None:
    """
    Ensure the device is either:
    - Not yet registered (first use → it will be bound to this employee)
    - Already registered to THIS employee
    - Reject if registered to a DIFFERENT employee
    """
    if not device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device ID is required for attendance.",
        )

    other_employee = db.query(Employee).filter(
        Employee.registered_device_id == device_id,
        Employee.company_id == employee.company_id,
        Employee.id != employee.id,
    ).first()

    if other_employee:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This device is already registered to another employee "
                   f"({other_employee.employee_id}). Each device can only be used by one employee.",
        )


# ---------------------------------------------------------------------------
# Geofence / WiFi verification
# ---------------------------------------------------------------------------

def verify_geofence_or_wifi(
    db: Session,
    employee: Employee,
    gps: Optional[str],
    wifi_ssid: Optional[str],
    wifi_bssid: Optional[str],
    status_type: str,
) -> None:
    """Verify employee location via BSSID whitelist or GPS geofence."""
    if status_type == "wfh":
        return   # WFH does not require location check

    company = None
    if employee.company_id:
        from app.models.domain_models import Company
        company = db.query(Company).filter(Company.id == employee.company_id).first()

    if company:
        ALLOWED_BSSIDS = (
            [b.strip().lower() for b in company.allowed_wifi_bssids.split(",") if b.strip()]
            if company.allowed_wifi_bssids else []
        )
        OFFICE_LAT = company.office_latitude if company.office_latitude is not None else 28.6252
        OFFICE_LON = company.office_longitude if company.office_longitude is not None else 77.3736
        MAX_DISTANCE_METERS = company.max_distance_meters if company.max_distance_meters is not None else 200.0
    else:
        ALLOWED_BSSIDS = []
        OFFICE_LAT = float(os.getenv("OFFICE_LATITUDE", "28.6252"))
        OFFICE_LON = float(os.getenv("OFFICE_LONGITUDE", "77.3736"))
        MAX_DISTANCE_METERS = float(os.getenv("MAX_GEOCLIENT_DISTANCE", "200.0"))

    # 1. BSSID whitelist check
    device_bssid = (wifi_bssid or "").strip().lower()
    if device_bssid and ALLOWED_BSSIDS:
        if any(bssid in device_bssid for bssid in ALLOWED_BSSIDS):
            print(f"BSSID match verified: {device_bssid}")
            return

    # 2. GPS geofence (mandatory when BSSID not matched)
    if not gps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GPS coordinates are required when not connected to a secure office Wi-Fi router.",
        )

    try:
        lat_str, lon_str = gps.split(",")
        user_lat = float(lat_str.strip())
        user_lon = float(lon_str.strip())
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid GPS format. Expected 'latitude,longitude'.",
        )

    # Optional: reverse-geocode for logging
    google_maps_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if google_maps_key:
        try:
            url = (
                f"https://maps.googleapis.com/maps/api/geocode/json"
                f"?latlng={user_lat},{user_lon}&key={google_maps_key}"
            )
            with urllib.request.urlopen(url, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if data.get("status") == "OK" and data.get("results"):
                        addr = data["results"][0].get("formatted_address")
                        print(f"Geocode result: {addr}")
        except Exception as e:
            print(f"Google Maps API call failed: {e}")

    # Haversine distance
    R = 6371000.0
    phi1 = math.radians(OFFICE_LAT)
    phi2 = math.radians(user_lat)
    delta_phi = math.radians(user_lat - OFFICE_LAT)
    delta_lambda = math.radians(user_lon - OFFICE_LON)
    a = (math.sin(delta_phi / 2.0) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distance_meters = R * c

    print(
        f"[GEOFENCE] Office: ({OFFICE_LAT}, {OFFICE_LON}), "
        f"User: ({user_lat}, {user_lon}), "
        f"Distance: {int(distance_meters)}m / Limit: {int(MAX_DISTANCE_METERS)}m"
    )

    if distance_meters > MAX_DISTANCE_METERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Attendance failed: You are {int(distance_meters)}m away from the office "
                f"(limit: {int(MAX_DISTANCE_METERS)}m). "
                "Update the office coordinates in the admin panel to match your location."
            ),
        )


# ---------------------------------------------------------------------------
# Status (today's record)
# ---------------------------------------------------------------------------

@router.get("/status", response_model=Optional[AttendanceOut])
def get_attendance_status(
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Get today's check-in/check-out status for the logged-in employee."""
    today = date.today()
    return db.query(Attendance).filter(
        Attendance.employee_id == current_user.id,
        Attendance.date == today,
    ).first()


# ---------------------------------------------------------------------------
# Check-in
# ---------------------------------------------------------------------------

@router.post("/check-in", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def check_in(
    payload: AttendanceCheckIn,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Daily check-in punch.
    Enforces: device uniqueness, BSSID / GPS geofence.
    """
    today = date.today()

    verify_device_binding(db=db, employee=current_user, device_id=payload.device_id)

    existing_record = db.query(Attendance).filter(
        Attendance.employee_id == current_user.id,
        Attendance.date == today,
    ).first()
    if existing_record:
        raise HTTPException(status_code=400, detail="You have already checked in today.")

    verify_geofence_or_wifi(
        db=db,
        employee=current_user,
        gps=payload.check_in_gps,
        wifi_ssid=payload.wifi_ssid,
        wifi_bssid=payload.wifi_bssid,
        status_type=payload.status or "present",
    )

    # Bind device on first check-in
    if not current_user.registered_device_id:
        current_user.registered_device_id = payload.device_id
        db.add(current_user)
        print(f"[DEVICE BIND] Bound device {payload.device_id} to {current_user.employee_id}")

    record = Attendance(
        employee_id=current_user.id,
        date=today,
        check_in=datetime.utcnow(),
        check_in_gps=payload.check_in_gps,
        wifi_ssid=payload.wifi_ssid,
        wifi_bssid=payload.wifi_bssid,
        device_info=payload.device_info,
        status=payload.status or "present",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Check-out
# ---------------------------------------------------------------------------

@router.post("/check-out", response_model=AttendanceOut)
def check_out(
    payload: AttendanceCheckOut,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user)
):
    """Daily check-out punch. Matches today's check-in and updates it."""
    today = date.today()

    record = db.query(Attendance).filter(
        Attendance.employee_id == current_user.id,
        Attendance.date == today,
    ).first()
    if not record:
        raise HTTPException(status_code=400, detail="No check-in found for today. Check in first.")

    if record.check_out is not None:
        raise HTTPException(status_code=400, detail="You have already checked out today.")

    verify_device_binding(db=db, employee=current_user, device_id=payload.device_id)
    if current_user.registered_device_id and payload.device_id:
        if current_user.registered_device_id != payload.device_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Check-out must be done from the same device used for check-in.",
            )

    verify_geofence_or_wifi(
        db=db,
        employee=current_user,
        gps=payload.check_out_gps,
        wifi_ssid=record.wifi_ssid,
        wifi_bssid=payload.wifi_bssid,
        status_type=record.status or "present",
    )

    check_out_time = datetime.utcnow()
    record.check_out = check_out_time
    record.check_out_gps = payload.check_out_gps
    if payload.wifi_bssid is not None:
        record.wifi_bssid = payload.wifi_bssid
    if payload.task_updates is not None:
        record.task_updates = payload.task_updates
    if payload.daily_summary is not None:
        record.daily_summary = payload.daily_summary

    if record.check_in:
        delta = check_out_time - record.check_in
        record.working_hours = round(delta.total_seconds() / 3600.0, 2)

    db.commit()
    db.refresh(record)
    return record


# ---------------------------------------------------------------------------
# Attendance history (tenant-isolated)
# ---------------------------------------------------------------------------

@router.get("/history", response_model=List[AttendanceOut])
def get_attendance_history(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    employee_id: Optional[int] = None,
    current_user: Employee = Depends(get_current_active_user)
):
    """
    Fetch attendance history.

    - Employees: only their own history.
    - HR / Admin: all history in their company.
    - Manager: their direct reports + self.
    - Super Admin: cross-tenant.
    """
    query = db.query(Attendance)

    # Tenant scoping via JOIN
    if current_user.role != "super_admin":
        query = query.join(Employee).filter(Employee.company_id == current_user.company_id)

    if employee_id is not None:
        target_emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not target_emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        if current_user.role != "super_admin":
            require_same_tenant(target_emp.company_id, current_user)

        if current_user.role not in ("admin", "hr", "manager", "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view other employees' attendance.",
            )

        if current_user.role == "manager":
            if target_emp.reporting_manager_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Managers can only view their direct reports' attendance.",
                )

        query = query.filter(Attendance.employee_id == employee_id)
    else:
        if current_user.role in ("admin", "hr", "super_admin"):
            pass  # see all company records
        elif current_user.role == "manager":
            report_ids = [r.id for r in current_user.direct_reports] + [current_user.id]
            query = query.filter(Attendance.employee_id.in_(report_ids))
        else:
            query = query.filter(Attendance.employee_id == current_user.id)

    return query.order_by(Attendance.date.desc()).offset(skip).limit(limit).all()
