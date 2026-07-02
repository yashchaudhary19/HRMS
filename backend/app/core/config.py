import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "HRMS Portal API")
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "9a7c36a4bb0dbde6d2b380d32f5f19bb4486fb79a32c25389d4fb97a829ba8f5")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@db.supabase.co:5432/postgres")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", os.getenv("SUPER_ADMIN_EMAIL", "chaudharyyash103c@gmail.com"))
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", os.getenv("SUPER_ADMIN_PASSWORD", "admin123"))

settings = Settings()
