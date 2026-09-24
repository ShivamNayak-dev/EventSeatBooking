# 🎟️ Seat Booking System — Real-Time Concurrency-Safe Event Booking

A full-stack event ticketing system where multiple users can browse a seat
map and book seats in real time — without ever double-booking the same
seat, even under concurrent requests. Includes role-based access control:
regular users book seats, admins manage the event catalog.

Built end-to-end in **Python (FastAPI) + React/TypeScript**, with a focus
on solving the concurrency-control problem correctly rather than just the
CRUD surface.

## The core problem this solves

When two users click the same seat at nearly the same instant, only one of
them should get it — and the loser should get a clear, immediate error
instead of a broken booking. This is a classic race condition, and it's
solved here with **two independent layers of protection**:

1. **Redis distributed lock** — `SET key value NX EX 300` is atomic at the
   Redis level, so only one request can ever "win" a seat hold. The hold
   lasts 5 minutes, giving the user time to complete checkout before the
   seat is released back to everyone else.
2. **PostgreSQL unique constraint** — as a defense-in-depth backstop, the
   `bookings` table has a `UNIQUE` constraint on `seat_id`. Even in an
   extreme edge case where two requests both believed they held a valid
   lock, the database itself physically cannot store two confirmed
   bookings for the same seat — the second insert fails with an
   `IntegrityError`, which the API turns into a clean `409 Conflict`.

On top of that, a **WebSocket connection per event** pushes `seat_locked`,
`seat_released`, and `seat_booked` events to every connected client
instantly, so everyone's seat map updates live without polling. A
background Redis keyspace-notification listener also detects when a hold
**expires naturally** (user walks away) and broadcasts the seat becoming
available again.

## Roles

- **Regular user:** register, log in, browse events, lock and book seats.
- **Admin:** everything a regular user can do, plus create events (the
  full seat grid is auto-generated based on rows/seats-per-row), update
  event details, and delete events. Admin status isn't self-service by
  design — there's no signup checkbox for it — it's granted via a
  one-off script (`app/promote_admin.py`) so it stays an intentional,
  backend-controlled action rather than something any user can flip on
  themselves.

## Tech stack

**Backend:** FastAPI, PostgreSQL (SQLAlchemy ORM), Redis, JWT auth (via
`python-jose`), `bcrypt` password hashing, native WebSockets.

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router,
Axios.

**Infra:** Docker Compose (Postgres + Redis + backend in one command).

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py            # app entrypoint, CORS, startup, lock-expiry listener
│   │   ├── models.py          # SQLAlchemy models (User w/ is_admin, Event, Seat, Booking)
│   │   ├── schemas.py         # Pydantic request/response schemas
│   │   ├── auth.py            # JWT + bcrypt hashing + admin-check dependency
│   │   ├── redis_client.py    # Redis connection + lock key helper
│   │   ├── websocket_manager.py
│   │   ├── seed.py            # demo data seeder
│   │   ├── promote_admin.py   # one-off script to grant a user admin rights
│   │   └── routers/
│   │       ├── auth.py        # /auth/register, /auth/login, /auth/me
│   │       ├── events.py      # /events (list/get public; create/update/delete admin-only)
│   │       ├── seats.py       # /events/{id}/seats, /seats/{id}/lock, /ws/events/{id}
│   │       └── bookings.py    # /bookings
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── pages/SeatMap.tsx  # the core seat-selection + booking UI
│       ├── pages/Events.tsx   # event list + admin-only create/delete UI
│       ├── context/AuthContext.tsx
│       ├── hooks/useWebSocket.ts
│       └── ...
└── docker-compose.yml
```

## Running it locally

### Option A — Docker Compose (fastest)

```bash
cp backend/.env.example backend/.env
docker compose up --build
# in another terminal, seed demo events:
docker compose exec backend python -m app.seed
```

Backend runs at `http://localhost:8000` (docs at `/docs`).

### Option B — Manual

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then point DATABASE_URL / REDIS_URL at your local instances
python -m app.seed
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Visit `http://localhost:5173`.

### Making yourself an admin

Sign up normally through the frontend first, then from the `backend`
folder (with your virtual environment active):

```bash
python -m app.promote_admin your-email@example.com
```

Log out and back in on the frontend so your session picks up the updated
role — you'll then see a **"+ Create Event"** button and **"Delete"**
controls on the Events page that regular users don't see.

## API overview

| Method | Endpoint                | Description                                  | Access        |
|--------|--------------------------|-----------------------------------------------|---------------|
| POST   | `/auth/register`        | Create account                                | Public        |
| POST   | `/auth/login`            | Get JWT access token                          | Public        |
| GET    | `/auth/me`               | Get current user (includes `is_admin`)        | Authenticated |
| GET    | `/events`                | List events                                   | Public        |
| GET    | `/events/{id}`           | Get one event                                 | Public        |
| POST   | `/events`                | Create event (auto-generates its seat grid)   | Admin only    |
| PUT    | `/events/{id}`           | Update event details                          | Admin only    |
| DELETE | `/events/{id}`           | Delete event (cascades to its seats/bookings) | Admin only    |
| GET    | `/events/{id}/seats`     | Seat map with live status                     | Public        |
| POST   | `/seats/{id}/lock`       | Acquire a 5-min hold on a seat                | Authenticated |
| DELETE | `/seats/{id}/lock`       | Release your hold                             | Authenticated |
| POST   | `/bookings`              | Confirm booking (requires active hold)        | Authenticated |
| GET    | `/bookings/me`           | List your own bookings                        | Authenticated |
| WS     | `/ws/events/{id}`        | Live seat status broadcast                    | Public        |
| GET    | `/health`                | Health check                                  | Public        |

## What I'd add next

- Automated tests (pytest for the lock/booking race conditions specifically)
- Payment integration (Stripe, as in my other projects)
- Alembic migrations instead of manual `ALTER TABLE` / `create_all`
- Rate limiting on the lock endpoint to prevent hold-spam
- A dedicated "My Bookings" page on the frontend
