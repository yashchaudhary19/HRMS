import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Float, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=True)

    # Geofencing & WiFi attendance settings
    office_latitude = Column(Float, default=28.6252, server_default="28.6252")
    office_longitude = Column(Float, default=77.3736, server_default="77.3736")
    allowed_wifi_ssids = Column(String(1000), default="office_wifi,office-5g,hr_connect_wifi,connect_office", server_default="'office_wifi,office-5g,hr_connect_wifi,connect_office'")
    allowed_wifi_bssids = Column(String(1000), default="", server_default="''")
    max_distance_meters = Column(Float, default=200.0, server_default="200.0")

    # Tenant / SaaS fields
    subscription_plan = Column(String(50), default="basic", server_default="'basic'")   # basic, pro, enterprise
    is_active = Column(Boolean, default=True, server_default="true")                    # False = suspended tenant

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    departments = relationship("Department", back_populates="company", cascade="all, delete-orphan")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    company = relationship("Company", back_populates="departments")
    employees = relationship("Employee", back_populates="department")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    employee_id = Column(String(50), index=True, nullable=False)   # Uniqueness enforced per-tenant in API layer
    role = Column(String(50), default="employee")  # super_admin, admin, hr, manager, employee
    is_active = Column(Boolean, default=True)

    # Tenant structure
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    reporting_manager_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)

    # Leave entitlements
    casual_leaves_entitled = Column(Integer, default=15, server_default="15")
    sick_leaves_entitled = Column(Integer, default=10, server_default="10")
    wfh_leaves_entitled = Column(Integer, default=30, server_default="30")
    earned_leaves_entitled = Column(Integer, default=12, server_default="12")

    # Financial & Contact info
    bank_name = Column(String(100), nullable=True)
    bank_account_no = Column(String(50), nullable=True)
    salary_amount = Column(Float, nullable=True)
    emergency_contact = Column(String(100), nullable=True)

    # Device binding — stores the unique device ID used on first check-in
    # Once set, only this device can mark attendance for this employee
    registered_device_id = Column(String(255), nullable=True)

    # Shift scheduling details
    shift_name = Column(String(100), default="Fixed Day Shift", server_default="'Fixed Day Shift'")
    shift_schedule = Column(String(255), default="Mon-Fri 09:00-17:00", server_default="'Mon-Fri 09:00-17:00'")

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    company = relationship("Company", backref="employees")
    department = relationship("Department", back_populates="employees")

    # Self-referencing reporting manager relationship
    reporting_manager = relationship("Employee", remote_side=[id], backref="direct_reports")

    attendance_records = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", foreign_keys="[LeaveRequest.employee_id]", back_populates="employee", cascade="all, delete-orphan")
    approved_leaves = relationship("LeaveRequest", foreign_keys="[LeaveRequest.approved_by_id]", back_populates="approved_by")

    # Composite index: fast per-tenant role lookups
    __table_args__ = (
        Index("ix_employees_company_role", "company_id", "role"),
    )


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, default=datetime.date.today, index=True)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)

    check_in_gps = Column(String(100), nullable=True)
    check_out_gps = Column(String(100), nullable=True)
    wifi_ssid = Column(String(100), nullable=True)
    wifi_bssid = Column(String(100), nullable=True)
    device_info = Column(String(255), nullable=True)

    status = Column(String(50), default="present")  # present, absent, late, early_departure, half_day, wfh
    working_hours = Column(Float, default=0.0)
    task_updates = Column(String(2000), nullable=True)
    daily_summary = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", back_populates="attendance_records")


class LeaveRequest(Base):
    __tablename__ = "leaves"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    leave_type = Column(String(50), nullable=False)  # casual, sick, earned, maternity, paternity, wfh, half_day
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(50), default="pending")  # pending, approved, rejected
    reason = Column(String(500), nullable=True)

    approved_by_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", foreign_keys=[employee_id], back_populates="leave_requests")
    approved_by = relationship("Employee", foreign_keys=[approved_by_id], back_populates="approved_leaves")


class SalarySlip(Base):
    __tablename__ = "salary_slips"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    month = Column(String(50), nullable=False)  # e.g., "May 2024"
    payout_date = Column(Date, nullable=False)
    status = Column(String(50), default="processing")  # processing, paid, pending

    gross_salary = Column(Float, nullable=False)
    total_deductions = Column(Float, nullable=False)
    net_payout = Column(Float, nullable=False)

    base_salary = Column(Float, nullable=False)
    bonus = Column(Float, default=0.0)
    federal_tax = Column(Float, default=0.0)
    health_insurance = Column(Float, default=0.0)
    retirement_contribution = Column(Float, default=0.0)

    pdf_size = Column(String(50), default="1.2 MB")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", backref="salary_slips")


class HelpTicket(Base):
    __tablename__ = "help_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_no = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "TK-8821"
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(50), nullable=False)  # payroll, benefits, it_tech, policy
    title = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=False)
    status = Column(String(50), default="open")  # open, pending, resolved
    last_message = Column(String(500), nullable=True)
    assigned_to = Column(String(100), nullable=True)  # e.g., "Sarah M."
    closed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", backref="help_tickets")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(String(1000), nullable=False)
    tag = Column(String(50), nullable=True)
    is_urgent = Column(Boolean, default=False)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    company = relationship("Company")


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    date = Column(Date, nullable=False)
    day_name = Column(String(50), nullable=True)
    holiday_type = Column(String(100), default="Public Holiday")
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    company = relationship("Company")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    detail = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    employee = relationship("Employee", backref="documents")
