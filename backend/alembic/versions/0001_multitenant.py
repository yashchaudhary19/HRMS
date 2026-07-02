"""Add subscription_plan and is_active to companies; drop global employee_id unique constraint

Revision ID: 0001_multitenant
Revises: 
Create Date: 2026-07-01

Changes:
  - companies.subscription_plan  VARCHAR(50) NOT NULL DEFAULT 'basic'
  - companies.is_active           BOOLEAN NOT NULL DEFAULT TRUE
  - employees.employee_id         Drop UNIQUE constraint (uniqueness now per-tenant via application layer)
  - employees                     Add composite index ix_employees_company_role (company_id, role)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic
revision: str = "0001_multitenant"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add new columns to companies ──────────────────────────────────
    op.add_column(
        "companies",
        sa.Column(
            "subscription_plan",
            sa.String(50),
            nullable=False,
            server_default="basic",
        ),
    )
    op.add_column(
        "companies",
        sa.Column(
            "is_active",
            sa.Boolean,
            nullable=False,
            server_default=sa.true(),
        ),
    )

    # ── 2. Drop the global UNIQUE constraint on employees.employee_id ────
    # Uniqueness is now enforced per-tenant (company_id) in the application layer.
    # NOTE: PostgreSQL auto-creates a unique index named "employees_employee_id_key".
    #       Adjust the constraint name if your DB uses a different naming convention.
    bind = op.get_bind()
    
    # Check if index exists before dropping
    has_idx = bind.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = 'ix_employees_employee_id'")
    ).fetchone()
    if has_idx:
        op.drop_index("ix_employees_employee_id", table_name="employees")

    # Check if constraint exists before dropping
    has_const = bind.execute(
        sa.text("SELECT 1 FROM pg_constraint WHERE conname = 'employees_employee_id_key'")
    ).fetchone()
    if has_const:
        op.drop_constraint("employees_employee_id_key", "employees", type_="unique")

    # Re-create as a regular (non-unique) index so queries are still fast
    op.create_index(
        "ix_employees_employee_id",
        "employees",
        ["employee_id"],
        unique=False,
    )

    # ── 3. Add composite index for per-tenant role lookups ───────────────
    op.create_index(
        "ix_employees_company_role",
        "employees",
        ["company_id", "role"],
        unique=False,
    )


def downgrade() -> None:
    # Remove composite index
    op.drop_index("ix_employees_company_role", table_name="employees")

    # Restore non-unique employee_id index (was already non-unique before in some setups)
    op.drop_index("ix_employees_employee_id", table_name="employees")
    op.create_index(
        "ix_employees_employee_id",
        "employees",
        ["employee_id"],
        unique=True,
    )

    # Remove new company columns
    op.drop_column("companies", "is_active")
    op.drop_column("companies", "subscription_plan")
