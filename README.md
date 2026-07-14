A full-stack delivery management platform where customers create orders with auto-calculated charges, admins configure zones and rate cards and assign delivery agents, and everyone tracks the order through a live status timeline.

## Live URLs

- **Frontend:** https://delivery-tracker-pied.vercel.app
- **Backend API:** https://delivery-tracker-4prz.onrender.com
- **API docs (Swagger):** https://delivery-tracker-4prz.onrender.com/docs

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy (async), PostgreSQL, Alembic, Celery, Redis
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Infra:** Vercel (frontend), Render (API + background worker), Neon (Postgres), Upstash (Redis), Resend (email)

## Project Structure
delivery-tracker/
├── backend/                FastAPI application
│   ├── app/
│   │   ├── api/v1/         Route handlers
│   │   ├── core/           Config, security, state machine
│   │   ├── db/              Session, Alembic migrations
│   │   ├── models/         SQLAlchemy models
│   │   ├── schemas/        Pydantic request/response schemas
│   │   ├── services/       Business logic (rate engine, assignment, zones)
│   │   └── workers/        Celery tasks (email, SMS)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                Next.js application
│   ├── app/                 Pages (customer, agent, admin, auth)
│   ├── components/         Shared UI (Navbar, RoleGuard)
│   └── lib/                  API client, auth context, types
└── docker-compose.yml      Local Postgres + Redis

## Running Locally

### Prerequisites
- Python 3.12+
- Node.js 18+
- Docker Desktop

### 1. Clone and start local services
```bash
git clone https://github.com/Shreyeshshinde/delivery-tracker.git
cd delivery-tracker
docker compose up -d postgres redis
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
# Edit .env — set SECRET_KEY to any random string for local dev
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```
Backend runs at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### 3. Frontend setup
Open a new terminal:
```bash
cd frontend
npm install
```
Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```
```bash
npm run dev
```
Frontend runs at `http://localhost:3000`.

### 4. (Optional) Run the background worker for real notification processing
Open a third terminal:
```bash
cd backend
celery -A app.workers.celery_app worker --loglevel=info --pool=solo
```
Without this running, orders still create successfully — notifications just won't be processed (they'll queue in Redis and process once a worker starts).

### 5. Seed initial data
Register an admin account via `POST /api/v1/auth/register` (role: `admin`), then use the admin dashboard or API directly to:
1. Create at least two zones
2. Assign pincodes to each zone
3. Create a rate card for each order type (B2B/B2C) between zone pairs
4. Optionally configure a COD surcharge

See the [API docs](#api-documentation) section below for the exact endpoints.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (asyncpg driver) | `postgresql+asyncpg://user:pass@host/db` |
| `REDIS_URL` | Redis connection string, used as Celery broker | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT signing secret — any random string | `change-this-to-something-random` |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiry in minutes | `60` |
| `SMTP_HOST` | Email provider SMTP host (unused if using Resend HTTP API) | `smtp.resend.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `resend` |
| `SMTP_PASSWORD` | SMTP password / API key — also used as the Resend API key for the HTTP-based sender | `re_xxxxxxxx` |
| `SMTP_FROM` | From address for outgoing email | `onboarding@resend.dev` |
| `TWILIO_ACCOUNT_SID` | Twilio SID (SMS is currently simulated — see note below) | *(unused)* |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | *(unused)* |
| `TWILIO_FROM_NUMBER` | Twilio sending number | *(unused)* |
| `ENVIRONMENT` | `development` or `production` | `development` |

A template is provided at `backend/.env.example` — copy it to `.env` and fill in real values.

### Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API, including `/api/v1` | `http://localhost:8000/api/v1` |

## Notification Delivery — Implementation Notes

- **Email** is sent via [Resend](https://resend.com)'s HTTP API (not SMTP). Render's free tier blocks outbound traffic on SMTP ports (587/465), so the email task calls `https://api.resend.com/emails` directly over HTTPS instead of using `smtplib`. The `SMTP_PASSWORD` variable holds the Resend API key for this purpose.
- On Resend's free tier without a verified custom domain, email delivery is restricted to the account owner's own address — a standard anti-abuse measure used by all transactional email providers. In production with a verified domain, this restriction is lifted.
- **SMS** is currently simulated (logged, not actually sent) — real SMS via Twilio requires phone number verification and billing setup that was out of scope for this build. The code path for real Twilio integration is already written in `app/workers/tasks/send_sms.py` and activates automatically once `TWILIO_ACCOUNT_SID` is set.

## Database Schema

| Table | Purpose |
|---|---|
| `users` | All accounts — customer, agent, admin (role-based) |
| `zones` | Named delivery zones (e.g. "North Zone") |
| `zone_pincodes` | Maps a pincode to a zone — admin-configurable, no hardcoding |
| `rate_cards` | Zone-pair pricing per order type (B2B/B2C), with `effective_from`/`effective_to` for scheduled rate changes |
| `cod_surcharge_config` | COD surcharge amount per order type (flat or percentage) |
| `agents` | Delivery agent profiles — current zone, availability, active order count |
| `orders` | Core order record — addresses, dimensions, weight, charge, current status |
| `status_history` | **Append-only** audit trail — every status change is a new row with actor and timestamp. `orders.current_status` is just a cached pointer to the latest entry here. |
| `reschedule_requests` | Captures reschedule date/reason after a failed delivery |
| `notifications_log` | Tracks email/SMS delivery attempts per order, with retry count |

Full column definitions live in `backend/app/models/`. Migrations are in `backend/app/db/migrations/versions/`.

### Why status_history is append-only
Rather than updating `orders.current_status` directly, every transition writes a new row to `status_history`. This makes the audit trail tamper-evident and gives a complete timeline for free — the customer-facing tracking view and the admin's "full history" view both just read this table in order.

## Rate Calculation Logic

Given a pickup pincode, drop pincode, package dimensions, weight, order type, and payment type, the rate engine (`backend/app/services/rate_engine.py`) computes the charge in five steps:

1. **Zone detection** — pickup and drop pincodes are each resolved to a zone via the `zone_pincodes` lookup table (`zone_detector.py`). If a pincode has no zone assigned, the request fails with a clear error rather than guessing.

2. **Volumetric weight** — `(length_cm × breadth_cm × height_cm) / 5000`.

3. **Billable weight** — `max(actual_weight_kg, volumetric_weight_kg)`. The higher of the two is always billed, standard practice for courier pricing since large-but-light packages still take up truck space.

4. **Rate card lookup** — the engine looks up the `rate_cards` row matching `(pickup_zone, drop_zone, order_type)` where today's date falls within `[effective_from, effective_to]`. This means admins can schedule a future rate change (insert a new row with a future `effective_from`) without any code deploy, and old orders remain priced correctly against whatever rate card was active when they were placed.

5. **Charge assembly**:
The full itemized breakdown (not just the total) is returned by `POST /orders/quote` and shown to the customer before they confirm — the same calculation is re-run server-side at actual order creation, so the client never supplies or can tamper with the final charge.

## Auto-Assignment Logic

`backend/app/services/assignment_engine.py` handles both manual and automatic agent assignment:

- **Candidate filtering** — agents in the order's pickup zone with `is_available = true`.
- **Scoring** — candidates are ranked by a simple load-balancing score (fewer active orders wins). Agent records include `current_lat`/`current_lng` fields for a future true-distance scoring upgrade; the current implementation uses zone + load as a deliberate scope decision documented further in the system design write-up.
- **Concurrency safety** — assignment uses a single atomic conditional `UPDATE agents SET is_available = false WHERE id = ? AND is_available = true`, checking the affected row count. If two requests race for the same agent, only one succeeds; the other automatically falls through to the next candidate. This avoids the classic read-then-write race condition of a separate `SELECT` followed by `UPDATE`.

## Order Status Lifecycle

Enforced by a state machine in `backend/app/core/state_machine.py`:
Illegal transitions (e.g. `delivered` → `picked_up`) are rejected with a 400 error before touching the database. On `failed`, the assigned agent is automatically released (`is_available` reset to `true`) so they're immediately eligible for reassignment — including the same order's eventual reschedule.

## API Documentation

Full interactive API documentation (all endpoints, request/response schemas, try-it-out) is auto-generated by FastAPI and available at:

**https://delivery-tracker-4prz.onrender.com/docs**

Or locally at `http://localhost:8000/docs` once the backend is running.

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploys from `main` branch, root directory `frontend` |
| Backend API | Render (Web Service) | Root directory `backend`, Docker runtime |
| Background worker | Render (Web Service) | Same repo/root, overridden start command runs Celery instead of Uvicorn — see note below |
| Database | Neon (Postgres) | Pooled connection string used for both services |
| Redis | Upstash | TLS (`rediss://`) connection |
| Email | Resend | HTTP API, not SMTP (see Notification Delivery notes above) |

**Worker deployment note:** Render's free tier only offers a Web Service option (Background Worker requires a paid plan), so the Celery worker runs disguised as a Web Service — `app/worker_entrypoint.py` starts a minimal HTTP health-check server in a background thread purely to satisfy Render's port-binding requirement, while Celery's actual consumer runs in the main thread. An external uptime monitor pings this service every 5 minutes to prevent Render's inactivity-based spin-down from silently stopping the consumer.
