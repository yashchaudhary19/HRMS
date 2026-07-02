from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.api import api_router
from app.core.database import SessionLocal, engine, Base
from app.models.domain_models import Employee
from app.core.security import get_password_hash

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Multi-tenant HR Management System API. "
        "Role hierarchy: Super Admin → Admin (tenant) → HR / Manager / Employee."
    ),
    version="2.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS — restrict to known origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "version": "2.0.0",
        "architecture": "multi-tenant SaaS",
        "docs_url": "/docs",
        "role_hierarchy": "super_admin → admin (tenant) → hr / manager / employee",
    }


@app.on_event("startup")
def startup_event():
    """
    On startup:
      1. Ensure all DB tables exist (auto-migration for new columns).
      2. Seed / verify the root Super Admin account.

    The Super Admin lives outside any tenant — company_id is NULL.
    Companies and Admins are created at runtime via the /admins/ endpoint.
    """
    try:
        Base.metadata.create_all(bind=engine)
        print("[DB] Database tables verified/created.")

        db = SessionLocal()
        try:
            # -- Remove any rogue super_admin accounts (not the root one) --
            other_super_admins = db.query(Employee).filter(
                Employee.role == "super_admin",
                Employee.email != settings.ADMIN_EMAIL.lower()
            ).all()
            if other_super_admins:
                for sa in other_super_admins:
                    db.delete(sa)
                db.commit()
                print(f"[INFO] Removed {len(other_super_admins)} extra super_admin accounts.")

            # -- Seed / enforce root Super Admin --
            super_admin = db.query(Employee).filter(
                Employee.email == settings.ADMIN_EMAIL.lower()
            ).first()
            hashed_password = get_password_hash(settings.ADMIN_PASSWORD)

            if not super_admin:
                super_admin = Employee(
                    email=settings.ADMIN_EMAIL.lower(),
                    hashed_password=hashed_password,
                    first_name="Super",
                    last_name="Admin",
                    employee_id="SADMIN-001",
                    role="super_admin",
                    is_active=True,
                    company_id=None,   # Super Admin is above all tenants
                )
                db.add(super_admin)
                db.commit()
                print(f"[SUCCESS] Super Admin seeded: {settings.ADMIN_EMAIL}")
            else:
                # Enforce correct credentials and role on every boot
                super_admin.hashed_password = hashed_password
                super_admin.role = "super_admin"
                super_admin.is_active = True
                super_admin.email = settings.ADMIN_EMAIL.lower()
                super_admin.company_id = None   # Always outside any tenant
                db.commit()
                print(f"[SUCCESS] Super Admin verified: {settings.ADMIN_EMAIL}")

        finally:
            db.close()

    except Exception as e:
        print(f"[WARNING] Database startup warning: {e}")
