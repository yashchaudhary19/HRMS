import sys
from pathlib import Path

# Add backend directory to path
backend_path = Path(__file__).resolve().parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.core.database import SessionLocal
from app.models.domain_models import Announcement, Holiday, HelpTicket, Document, Employee, Attendance, LeaveRequest, SalarySlip, Company, Department

def clear_mock_data():
    db = SessionLocal()
    try:
        print("Cleaning up database tables...")
        
        # Deleting dependent items first to respect foreign keys
        documents_count = db.query(Document).delete()
        print(f"Deleted {documents_count} Documents.")
        
        tickets_count = db.query(HelpTicket).delete()
        print(f"Deleted {tickets_count} HelpTickets.")

        slips_count = db.query(SalarySlip).delete()
        print(f"Deleted {slips_count} SalarySlips.")

        leaves_count = db.query(LeaveRequest).delete()
        print(f"Deleted {leaves_count} LeaveRequests.")

        attendance_count = db.query(Attendance).delete()
        print(f"Deleted {attendance_count} Attendance records.")
        
        announcements_count = db.query(Announcement).delete()
        print(f"Deleted {announcements_count} Announcements.")
        
        holidays_count = db.query(Holiday).delete()
        print(f"Deleted {holidays_count} Holidays.")

        # Deleting employees
        employees_count = db.query(Employee).delete()
        print(f"Deleted {employees_count} Employees (all users).")

        # Deleting departments
        depts_count = db.query(Department).delete()
        print(f"Deleted {depts_count} Departments.")

        # Deleting companies
        companies_count = db.query(Company).delete()
        print(f"Deleted {companies_count} Companies.")
        
        db.commit()
        print("\nDatabase cleanup completed successfully!")
        print("All users, companies, and departments have been removed.")
    except Exception as e:
        db.rollback()
        print(f"Error occurred during cleanup: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    clear_mock_data()

