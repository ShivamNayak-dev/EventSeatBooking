"""
Run with: python -m app.seed
Creates a couple of demo events with a seat grid so the frontend has
something to show immediately after setup.
"""
import datetime

from app.database import Base, engine, SessionLocal
from app import models

Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        if db.query(models.Event).count() > 0:
            print("Events already exist, skipping seed.")
            return

        events_data = [
            {"name": "Coldplay Live in Concert", "venue": "DY Patil Stadium, Mumbai",
             "rows": 6, "cols": 10, "price": 2499.00,
             "event_time": datetime.datetime.utcnow() + datetime.timedelta(days=30)},
            {"name": "Stand-up Comedy Night", "venue": "Canvas Laugh Club, Delhi",
             "rows": 5, "cols": 8, "price": 599.00,
             "event_time": datetime.datetime.utcnow() + datetime.timedelta(days=7)},
        ]

        for data in events_data:
            event = models.Event(**data)
            db.add(event)
            db.flush()  # get event.id before creating seats

            for r in range(data["rows"]):
                row_label = chr(ord("A") + r)
                for c in range(1, data["cols"] + 1):
                    seat = models.Seat(
                        event_id=event.id,
                        row_label=row_label,
                        col_number=c,
                        label=f"{row_label}{c}",
                    )
                    db.add(seat)

        db.commit()
        print("Seed data created.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
