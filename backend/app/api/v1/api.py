from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, admins, employees, attendance, leaves,
    salary, helpdesk, dashboard, companies, departments
)

api_router = APIRouter()

# Auth
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Super Admin — tenant management
api_router.include_router(admins.router, prefix="/admins", tags=["admins (super-admin)"])

# Company & department management
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])

# Core HR modules (tenant-isolated)
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(leaves.router, prefix="/leaves", tags=["leaves"])
api_router.include_router(salary.router, prefix="/salary", tags=["salary"])
api_router.include_router(helpdesk.router, prefix="/helpdesk", tags=["helpdesk"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
