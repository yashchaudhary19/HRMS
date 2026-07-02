from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import datetime, date


# ---------------------------------------------------------------------------
# Auth Schemas
# ---------------------------------------------------------------------------

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    company_id: Optional[int] = None   # None for super_admin


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None
    company_id: Optional[int] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# ---------------------------------------------------------------------------
# Company Schemas
# ---------------------------------------------------------------------------

class CompanyBase(BaseModel):
    name: str
    address: Optional[str] = None
    office_latitude: Optional[float] = 28.6252
    office_longitude: Optional[float] = 77.3736
    allowed_wifi_ssids: Optional[str] = "office_wifi,office-5g,hr_connect_wifi,connect_office"
    allowed_wifi_bssids: Optional[str] = ""
    max_distance_meters: Optional[float] = 200.0


class CompanyCreate(CompanyBase):
    subscription_plan: Optional[str] = "basic"


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    office_latitude: Optional[float] = None
    office_longitude: Optional[float] = None
    allowed_wifi_ssids: Optional[str] = None
    allowed_wifi_bssids: Optional[str] = None
    max_distance_meters: Optional[float] = None


class CompanyOut(CompanyBase):
    id: int
    subscription_plan: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CompanyStats(BaseModel):
    """Summary stats returned to Super Admin for a tenant overview."""
    company_id: int
    company_name: str
    subscription_plan: str
    is_active: bool
    total_employees: int
    total_departments: int
    total_admins: int
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriptionUpdate(BaseModel):
    subscription_plan: Optional[str] = None   # basic, pro, enterprise
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Admin (Tenant Admin) Schemas  — managed exclusively by Super Admin
# ---------------------------------------------------------------------------

class AdminCreate(BaseModel):
    """
    Single payload to atomically create a company + its admin account.
    Super Admin uses this endpoint instead of the separate /companies + /employees flow.
    """
    # Company info
    company_name: str
    company_address: Optional[str] = None
    subscription_plan: Optional[str] = "basic"

    # Admin account info
    admin_email: EmailStr
    admin_first_name: str
    admin_last_name: str
    admin_password: str
    admin_employee_id: str


class AdminOut(BaseModel):
    """Returned after creating or reading a tenant admin."""
    id: int
    email: str
    first_name: str
    last_name: str
    employee_id: str
    role: str
    is_active: bool
    company_id: Optional[int]
    company: Optional[CompanyOut] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    admin_email: Optional[EmailStr] = None
    password: Optional[str] = None         # Will be hashed
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Department Schemas
# ---------------------------------------------------------------------------

class DepartmentBase(BaseModel):
    name: str
    company_id: Optional[int] = None   # Optional: auto-filled for non-super-admins


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentOut(DepartmentBase):
    id: int
    company_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Employee / User Schemas
# ---------------------------------------------------------------------------

class EmployeeBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    employee_id: str
    role: str = "employee"   # admin, hr, manager, employee  (super_admin excluded from normal flows)
    is_active: bool = True
    company_id: Optional[int] = None
    department_id: Optional[int] = None
    reporting_manager_id: Optional[int] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    salary_amount: Optional[float] = None
    emergency_contact: Optional[str] = None

    # Custom leave entitlements
    casual_leaves_entitled: Optional[int] = 15
    sick_leaves_entitled: Optional[int] = 10
    wfh_leaves_entitled: Optional[int] = 30
    earned_leaves_entitled: Optional[int] = 12

    # Shift scheduling
    shift_name: Optional[str] = "Fixed Day Shift"
    shift_schedule: Optional[str] = "Mon-Fri 09:00-17:00"


class EmployeeCreate(EmployeeBase):
    password: str


class EmployeeUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    company_id: Optional[int] = None
    department_id: Optional[int] = None
    reporting_manager_id: Optional[int] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    salary_amount: Optional[float] = None
    emergency_contact: Optional[str] = None
    password: Optional[str] = None

    # Custom leave entitlements
    casual_leaves_entitled: Optional[int] = None
    sick_leaves_entitled: Optional[int] = None
    wfh_leaves_entitled: Optional[int] = None
    earned_leaves_entitled: Optional[int] = None

    # Shift scheduling
    shift_name: Optional[str] = None
    shift_schedule: Optional[str] = None


class EmployeeOut(EmployeeBase):
    id: int
    company_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Attendance Schemas
# ---------------------------------------------------------------------------

class AttendanceBase(BaseModel):
    device_info: Optional[str] = None
    device_id: Optional[str] = None    # Unique hardware device identifier
    wifi_ssid: Optional[str] = None
    wifi_bssid: Optional[str] = None
    check_in_gps: Optional[str] = None


class AttendanceCheckIn(AttendanceBase):
    status: Optional[str] = "present"


class AttendanceCheckOut(BaseModel):
    check_out_gps: Optional[str] = None
    device_id: Optional[str] = None    # Unique hardware device identifier
    wifi_bssid: Optional[str] = None
    task_updates: Optional[str] = None
    daily_summary: Optional[str] = None


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    check_in_gps: Optional[str] = None
    check_out_gps: Optional[str] = None
    wifi_ssid: Optional[str] = None
    wifi_bssid: Optional[str] = None
    device_info: Optional[str] = None
    status: str
    working_hours: float
    task_updates: Optional[str] = None
    daily_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Leave Schemas
# ---------------------------------------------------------------------------

class LeaveRequestBase(BaseModel):
    leave_type: str   # casual, sick, earned, maternity, paternity, wfh, half_day
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveRequestCreate(LeaveRequestBase):
    pass


class LeaveStatusUpdate(BaseModel):
    status: str   # approved, rejected


class LeaveRequestOut(LeaveRequestBase):
    id: int
    employee_id: int
    status: str
    approved_by_id: Optional[int] = None
    created_at: datetime
    employee_balances: Optional[Dict[str, int]] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Salary Slip Schemas
# ---------------------------------------------------------------------------

class SalarySlipBase(BaseModel):
    month: str
    payout_date: date
    status: str
    gross_salary: float
    total_deductions: float
    net_payout: float
    base_salary: float
    bonus: float
    federal_tax: float
    health_insurance: float
    retirement_contribution: float
    pdf_size: str


class SalarySlipOut(SalarySlipBase):
    id: int
    employee_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Help Ticket Schemas
# ---------------------------------------------------------------------------

class HelpTicketBase(BaseModel):
    category: str
    title: str
    description: str


class HelpTicketCreate(HelpTicketBase):
    pass


class HelpTicketUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    last_message: Optional[str] = None


class HelpTicketOut(HelpTicketBase):
    id: int
    ticket_no: str
    employee_id: int
    status: str
    last_message: Optional[str] = None
    assigned_to: Optional[str] = None
    closed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Announcement Schemas
# ---------------------------------------------------------------------------

class AnnouncementBase(BaseModel):
    title: str
    content: str
    tag: Optional[str] = None
    is_urgent: bool = False
    company_id: Optional[int] = None


class AnnouncementOut(AnnouncementBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Holiday Schemas
# ---------------------------------------------------------------------------

class HolidayBase(BaseModel):
    title: str
    date: date
    day_name: Optional[str] = None
    holiday_type: str = "Public Holiday"
    company_id: Optional[int] = None


class HolidayOut(HolidayBase):
    id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Document Schemas
# ---------------------------------------------------------------------------

class DocumentBase(BaseModel):
    filename: str
    detail: str


class DocumentOut(DocumentBase):
    id: int
    employee_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Salary History / Trends Schemas
# ---------------------------------------------------------------------------

class SalaryTrendItem(BaseModel):
    month: str
    payout: float


class SalaryHistoryOut(BaseModel):
    ytd_tax: float
    trends: List[SalaryTrendItem]
