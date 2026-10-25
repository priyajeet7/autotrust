# AutoTrust — Car Dealership Inventory System

A full-stack inventory system for a car dealership. Customers register, sign in, browse and search
the inventory and purchase vehicles. Administrators also add, edit, restock and delete vehicles.
Stock levels are updated transactionally, so a vehicle can never be oversold, even under concurrent
purchases.

| Layer    | Technology                                                                    |
| -------- | ----------------------------------------------------------------------------- |
| API      | Node.js 22+, TypeScript, Express 5, zod validation                            |
| Database | PostgreSQL (developed on 18.6), Prisma 7.10.1 with the `pg` driver adapter    |
| Auth     | JWT (HS256, 8 h expiry) via `jsonwebtoken`; passwords hashed with scrypt      |
| UI       | React 19, Tailwind CSS 4, Vite 8                                              |
| Tests    | Vitest, Supertest (API against a real Postgres test DB), Testing Library (UI) |

![Customer dashboard](docs/screenshots/03-dashboard-customer.png)

## Features

- **Accounts**: register and log in; every self-registered account is a `USER`. Admins are created
  by the seed script.
- **Vehicles** (any signed-in user): list, search by make / model (partial, case-insensitive),
  category and price range, create, and update.
- **Admin only**: delete vehicles and restock them.
- **Purchases** (any signed-in user): buy one or more units. Stock is decremented and a `Purchase`
  record (buyer, quantity, unit price at time of sale) is written in one database transaction.
- **UI**: responsive dashboard (1 to 4 columns), search bar, stock badges, Purchase buttons disabled
  and labelled "Out of stock" at zero quantity, and admin controls (Add, Edit, Restock, two-step
  Delete) that are only shown to admins.

## Project structure

```
backend/
  prisma/schema.prisma            User, Vehicle, Purchase models
  prisma/migrations/              committed SQL migration
  prisma/seed.ts                  idempotent demo admin + sample vehicles
  src/app.ts                      createApp({ prisma, jwtSecret }), no listen()
  src/server.ts                   entrypoint: load .env, validate, listen, graceful shutdown
  src/config/env.ts               zod-validated environment
  src/http/errors.ts              HttpError, validation → 400, 404 and 500 handlers
  src/modules/auth/               password hashing, JWTs, middleware, /api/auth routes
  src/modules/vehicles/           schemas + /api/vehicles CRUD and search
  src/modules/inventory/          purchase and restock
  src/testing/assertTestDatabase  guard: tests only ever touch a *_test database
  tests/unit, tests/integration   Vitest + Supertest
frontend/
  src/api/                        typed fetch client
  src/auth/AuthContext.tsx        session state (token in localStorage, verified via /me)
  src/pages/                      AuthPage, Dashboard
  src/components/                 VehicleCard, VehicleForm, SearchBar
  scripts/capture-screenshots.mjs Playwright script used to take the screenshots below
docs/                             screenshots and full test reports
```

## Setup

### Prerequisites

- Node.js 22.13+ (see `.nvmrc`)
- PostgreSQL 15+ running locally (developed with PostgreSQL 18.6 on Windows)

### 1. Create the databases

You need a role and two databases **owned by that role**: one for development and one for tests,
whose name must end in `_test`. Run as the `postgres` superuser, for example with
`psql -U postgres`:

```sql
CREATE ROLE autotrust LOGIN PASSWORD 'autotrust';
CREATE DATABASE autotrust OWNER autotrust;
CREATE DATABASE autotrust_test OWNER autotrust;
```

> **Database ownership matters.** On PostgreSQL 15+, only the database owner can create tables in
> the `public` schema. If the database already exists but is owned by `postgres`, migrations fail
> with `permission denied for schema public`. Fix it with
> `ALTER DATABASE autotrust OWNER TO autotrust;`.

Docker alternative: `docker compose up -d` starts PostgreSQL 16 with both databases already
created.

### 2. Backend

```bash
cd backend
npm install                 # also runs `prisma generate`
cp .env.example .env        # then set JWT_SECRET: see below
npm run db:deploy           # apply migrations to the dev database
```

**Set your own `JWT_SECRET` before starting the API.** It signs every login token, so it must be a
unique random value of at least 32 characters. Never reuse an example value. `.env.example` leaves
it empty on purpose, and the server refuses to start until it is set. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Seed an admin account and 8 sample vehicles. This is idempotent; vehicles are only added to an
empty inventory. You can put the two variables in `backend/.env` instead of the shell:

```bash
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='choose-a-password' npm run db:seed
```

Start the API on <http://localhost:4000>:

```bash
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

Open <http://localhost:5173> and either sign in as the seeded admin or create a customer account.

### Environment variables (`backend/.env`)

| Variable                                  | Required | Description                                       |
| ----------------------------------------- | -------- | ------------------------------------------------- |
| `DATABASE_URL`                            | yes      | `postgresql://user:pass@host:5432/autotrust`      |
| `JWT_SECRET`                              | yes      | your own random secret, 32+ characters; signs tokens |
| `PORT`                                    | no       | default `4000`                                    |
| `NODE_ENV`                                | no       | `development` (default), `test` or `production`   |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | seed     | only used by `npm run db:seed`                    |

The server validates these at start-up and exits with a list of every problem, without echoing
secret values. Tests read `backend/.env.test` instead (test-only, non-secret values).

### Migrations without CREATEDB

`prisma migrate dev` needs to create a temporary "shadow" database. If your role lacks `CREATEDB`
(as the local role used here does), generate a new migration's SQL directly and apply it:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
  -o prisma/migrations/<timestamp>_<name>/migration.sql
npm run db:deploy
```

## API

All responses use `{ "data": ... }` on success or
`{ "error": { "code", "message", "details"? } }` on failure. Every `/api/vehicles` route
requires `Authorization: Bearer <token>`.

| Method | Path                         | Access | Description                                                     |
| ------ | ---------------------------- | ------ | --------------------------------------------------------------- |
| GET    | `/api/health`                | public | liveness check                                                  |
| POST   | `/api/auth/register`         | public | `{ name, email, password }` → `201 { token, user }`             |
| POST   | `/api/auth/login`            | public | `{ email, password }` → `{ token, user }`                       |
| GET    | `/api/auth/me`               | user   | current user (role read from the database)                      |
| GET    | `/api/vehicles`              | user   | list, ordered by make then model                                |
| GET    | `/api/vehicles/search`       | user   | `?make=&model=&category=&minPrice=&maxPrice=` (AND-combined)    |
| POST   | `/api/vehicles`              | user   | `{ make, model, year, category, price, quantity? }` → `201`     |
| PUT    | `/api/vehicles/:id`          | user   | partial update; `quantity` is rejected (use purchase/restock)   |
| DELETE | `/api/vehicles/:id`          | admin  | `204`; purchase history is kept (`vehicleId` set to null)       |
| POST   | `/api/vehicles/:id/purchase` | user   | `{ quantity? = 1 }` → `201 { purchase, vehicle }`; `409` if short |
| POST   | `/api/vehicles/:id/restock`  | admin  | `{ quantity }` (1 to 10,000) → `{ vehicle }`                    |

Categories: `SEDAN, SUV, TRUCK, COUPE, HATCHBACK, CONVERTIBLE, VAN, WAGON`.

### Key design decisions

- **No overselling.** A purchase runs
  `UPDATE vehicles SET quantity = quantity - n WHERE id = ? AND quantity >= n` and inserts the
  `Purchase` in the same transaction. PostgreSQL row-locks and re-checks the condition for
  concurrent buyers, so stock can't go negative. A test fires 10 simultaneous purchases at a stock
  of 3 and asserts exactly 3 succeed. Restock is a single atomic increment.
- **Authoritative roles.** The JWT only identifies the user. `requireAuth` reloads the user on
  every request, so demoting or deleting an account takes effect immediately.
- **Login enumeration resistance.** Unknown email and wrong password return identical 401 bodies,
  and both paths run a scrypt verification.
- **Money** is stored as `Decimal(12,2)`, validated to at most 2 decimal places, and returned as a
  JSON number.
- **Test safety.** Test helpers refuse to run unless `NODE_ENV=test` and the database name ends in
  `_test`.

## Screenshots

All screenshots were taken from the real running app (backend + seeded local PostgreSQL + Vite)
on 2026-10-25 by `frontend/scripts/capture-screenshots.mjs`.

| Sign in                                    | Register                                      |
| ------------------------------------------ | --------------------------------------------- |
| ![Sign in](docs/screenshots/01-login.png)  | ![Register](docs/screenshots/02-register.png) |

| Customer dashboard (zero stock → disabled)                     | Search: make "toyota", max price 30000  |
| --------------------------------------------------------------- | --------------------------------------- |
| ![Customer dashboard](docs/screenshots/03-dashboard-customer.png) | ![Search](docs/screenshots/04-search.png) |

| Purchase (stock 6 → 5)                       | Admin dashboard                                             |
| -------------------------------------------- | ----------------------------------------------------------- |
| ![Purchase](docs/screenshots/05-purchase.png) | ![Admin dashboard](docs/screenshots/06-dashboard-admin.png) |

| Admin: add vehicle                                    | Mobile (390 px)                           |
| ----------------------------------------------------- | ----------------------------------------- |
| ![Add vehicle](docs/screenshots/07-admin-add-vehicle.png) | ![Mobile](docs/screenshots/08-mobile.png) |

## Tests

```bash
cd backend  && npm test               # or: npm run test:coverage
cd frontend && npm test
```

Backend integration tests use a real PostgreSQL database (`autotrust_test`). Vitest's global setup
applies the committed migrations to it, and each test starts from truncated tables. Frontend tests
render the real components with a stubbed `fetch`.

### Test report

These results are from runs on 2026-10-25. The full outputs are in
[`docs/backend-test-report.txt`](docs/backend-test-report.txt) and
[`docs/frontend-test-report.txt`](docs/frontend-test-report.txt).

**Backend:** `npx vitest run --coverage` → **8 files, 135 tests passed**

| Test file                                 | Covers                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| `tests/unit/env.test.ts`                  | environment validation, including `JWT_SECRET`                  |
| `tests/unit/assertTestDatabase.test.ts`   | test-database safety guard                                      |
| `tests/unit/password.test.ts`             | scrypt hashing and verification                                 |
| `tests/unit/tokens.test.ts`               | JWT round trip, expiry, tampering, `alg: none`                  |
| `tests/integration/health.test.ts`        | `GET /api/health`                                               |
| `tests/integration/auth.test.ts`          | register, login, me, 404 envelope                               |
| `tests/integration/vehicles.test.ts`      | auth on every route, CRUD, search filters, admin-only delete    |
| `tests/integration/inventory.test.ts`     | purchase, restock, concurrency, 400/403/404/409 cases           |

```
Statements   : 95.63% ( 219/229 )
Branches     : 90.65% ( 97/107 )
Functions    : 100% ( 58/58 )
Lines        : 96.69% ( 205/212 )
```

**Frontend:** `npx vitest run` → **3 files, 25 tests passed** (API client, `VehicleCard`, and
app-level auth and dashboard flows).

Also passing at the time of writing: backend `npm run lint`, `npm run typecheck`,
`npm run format:check` and `npm run build`; frontend `npm run typecheck`, `npm run build` and
`npm run format:check`.

### Development workflow (TDD)

Most features were developed test-first. A `test:` commit adds failing tests (its message records
the actual failing count), then a `feat:` commit makes them pass. This applies to environment
validation, the test-database guard, the health endpoint, authentication, vehicles, inventory and the
frontend.

Not everything followed a strict Red → Green → Refactor sequence. The repository scaffold
(`914d6a8`), the server entrypoint (`41de392`), the Prisma setup (`d0ad130`), the database schema and
migration (`dc30fa7`), the seed script (`ab65d49`) and the screenshot script were written without
failing tests first. They were checked by running them, as their commit messages record. Refactoring
mostly happened inside the green commits; there is one separate refactor commit (`fcf2ef2`). See
`git log --oneline`.

## My AI Usage

**Tools used:** Claude (Anthropic) through **Claude Code**, the CLI coding agent. The session that
built the features in this README ran on the Claude Opus 5.5 model. Every commit Claude helped with
has a `Co-authored-by: Claude` trailer. The prompts are in [PROMPTS.md](PROMPTS.md).

**How I used it:**

- **Scaffolding and foundation (earlier sessions):** repository setup, environment validation, the
  test-database guard and the health endpoint were written with Claude in test-first steps; their
  commit messages describe what Claude wrote.
- **Feature implementation (this session):** I gave Claude the assessment requirements and asked it
  to work autonomously. It inspected the repository, committed my pending Prisma setup, then wrote
  the schema and migration, auth, vehicle CRUD and search, purchase and restock, the React/Tailwind
  UI, the tests for each (failing test commit first, then the implementation), the seed script, the
  screenshot script and a draft of this README.
- **My part:** I defined the requirements, stack and constraints (including strict TDD, truthful
  commit attribution and no fabricated results), installed and configured PostgreSQL, created the
  role and databases, and ran the superuser command to fix database ownership when migrations
  failed. I am responsible for the final review before submission.
- **Verification:** Claude ran the real test suites, linters, type checks and builds after each
  step. The test report above is copied from actual runs, and the screenshots come from the running
  application.

**Reflection:**

- **Speed:** AI did most of the typing. In one session it took the project from an empty Prisma
  schema to a tested API, a React UI, screenshots and documentation. Doing that by
  hand would likely have taken considerably longer, especially the test cases.
- **Constraints shaped the result.** Asking for test-first commits and truthful attribution up front
  kept the history honest and reviewable: every feature has a failing-test commit with the real
  failure count, followed by the commit that makes it pass.
- **The tests caught real problems.** A frontend test failed because the password hint was inside
  the `<label>`, so the field's accessible name was wrong. That was a genuine accessibility bug, and
  the fix was to the UI, not the test. Strict TypeScript and ESLint settings also caught issues
  (optional properties passed to Prisma, untyped request parameters) that were fixed before each
  commit.
- **AI output still needs checking.** In one commit message Claude guessed which red tests were
  already passing. It then checked with a verbose test run, found the guess was wrong, and corrected
  the message before moving on. Claims about results should come from actual runs, not from what
  sounds plausible.
- **Some steps needed me.** The local `autotrust` role could not create a shadow database or tables
  in a database owned by `postgres`. The AI worked around the first (generating migration SQL with
  `prisma migrate diff`), but the ownership fix needed my superuser password, so I ran it myself.
  Environment and permission problems were where my involvement mattered most.
- **Next time:** I would set up database ownership and privileges correctly before starting, and
  save every AI chat (or its share link) as I go, so `PROMPTS.md` is complete without
  reconstruction.

## Known limitations

- No pagination on vehicle listing or search; fine for a single dealership's stock, not for very
  large inventories.
- The JWT is stored in `localStorage`. An httpOnly cookie would resist XSS better, but would need
  CSRF protection.
- No rate limiting on the login endpoint.
- Admin accounts are created with the seed script; there is no UI to promote users.
- Purchase history is recorded but not yet shown in the UI.
