# 🎟️ Seat Booking System — Real-Time Concurrency-Safe Event Booking

A full-stack event ticketing system where multiple users can browse a seat
map and book seats in real time — without ever double-booking the same
seat, even under concurrent requests.

Built as a from-scratch reimplementation of a seat-locking problem I'd
already solved once in Java/Spring Boot (TicketFlow), here done end-to-end
in **Python (FastAPI) + React/TypeScript**, to demonstrate the same
concurrency-control thinking in a different stack.

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
│   │   ├── models.py          # SQLAlchemy models (User, Event, Seat, Booking)
│   │   ├── schemas.py         # Pydantic request/response schemas
│   │   ├── auth.py            # JWT + bcrypt password hashing
│   │   ├── redis_client.py    # Redis connection + lock key helper
│   │   ├── websocket_manager.py
│   │   ├── seed.py            # demo data seeder
│   │   └── routers/
│   │       ├── auth.py        # /auth/register, /auth/login, /auth/me
│   │       ├── events.py      # /events
│   │       ├── seats.py       # /events/{id}/seats, /seats/{id}/lock, /ws/events/{id}
│   │       └── bookings.py    # /bookings
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── pages/SeatMap.tsx  # the core seat-selection + booking UI
│       ├── pages/Events.tsx
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

## API overview

| Method | Endpoint                | Description                          |
|--------|--------------------------|---------------------------------------|
| POST   | `/auth/register`        | Create account                        |
| POST   | `/auth/login`            | Get JWT access token                  |
| GET    | `/events`                | List events                           |
| GET    | `/events/{id}/seats`     | Seat map with live status             |
| POST   | `/seats/{id}/lock`       | Acquire a 5-min hold on a seat        |
| DELETE | `/seats/{id}/lock`       | Release your hold                     |
| POST   | `/bookings`              | Confirm booking (requires active hold)|
| WS     | `/ws/events/{id}`        | Live seat status broadcast            |

## What I'd add next

- Automated tests (pytest for the lock/booking race conditions specifically)
- Payment integration (Stripe, as in my other projects)
- Alembic migrations instead of `create_all` on startup
- Rate limiting on the lock endpoint to prevent hold-spam
