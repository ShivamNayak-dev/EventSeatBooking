"""
Usage: python -m app.promote_admin your-email@example.com
"""
import sys

from app.database import SessionLocal
from app import models


def promote(email: str):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"No user found with email: {email}")
            return
        user.is_admin = True
        db.commit()
        print(f"{email} is now an admin.")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m app.promote_admin <email>")
        sys.exit(1)
    promote(sys.argv[1])