# AutoTrust — Car Dealership Inventory System

> Work in progress. This README is expanded as milestones land; the full project
> description, screenshots, test report and the **My AI Usage** section arrive in the final milestone.

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- Docker (for the local PostgreSQL container)

## Local setup (backend)

```bash
# 1. Start PostgreSQL (creates the `autotrust` and `autotrust_test` databases)
docker compose up -d

# 2. Install dependencies and create your env file
cd backend
npm install
cp .env.example .env

# 3. Run the API in watch mode
npm run dev
# → GET http://localhost:4000/api/health
```

## Backend scripts

| Command | What it does |
| --- | --- |
| `npm test` | Run the test suite once (uses `.env.test`) |
| `npm run test:coverage` | Run tests with a coverage report |
| `npm run lint` | ESLint (type-aware) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run format:check` | Prettier check |
| `npm run build` / `npm start` | Compile to `dist/` and run it |

## Test-database safety

Test helpers call `assertTestDatabase()` before touching the database. It refuses to run unless
`NODE_ENV=test` **and** the database name in `DATABASE_URL` ends with `_test`, so tests can never
wipe your development data.
