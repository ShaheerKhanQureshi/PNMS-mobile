# Patient Non-Compliance Monitoring System 

## Quick start (one command for the database)

```powershell
npm install
npm run setup          # asks once for your MySQL admin login, then creates everything below
npm run create-admin   # first Super Admin (prompts for a password)
npm start
```

`npm run setup` creates the `patient_noncompliance` database and the restricted `app_user` / `pnms_migrator`
accounts with random passwords, writes `.env` (git-ignored; an existing `.env` is never overwritten), applies all
migrations and seeds the ten categories. The MySQL admin password is used for that run only and is not stored.
Add `npm run setup:test` to also create the `*_test` database and `.env.test` for the test suite.
Non-interactive: set `MYSQL_ADMIN_USER` / `MYSQL_ADMIN_PASSWORD` first. (Status: `npm run migrate:status`.)

> Status: `setup.js` has been syntax-checked only; it has not been run against a real MySQL server.


Node.js (ES modules) + Express + MySQL 8 REST API. Head Nurses and Pharmacists record non-compliance observations
(by MR Number, with role-specific categories); Super Admins get analytics, staff management, exports and audit logs.
**Backend only** - no frontend is included.

> **Verification status:** this codebase was written in an environment where `npm install` and a MySQL server were
> not available, so the server, migrations and integration tests have **not been executed yet**. Only syntax checks,
> the dependency-free unit tests, and an OpenAPI parse check were run. See [docs/IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md)
> for the exact status of every requirement and [Verify it](#verify-it-first-run) below for the commands to run.

## Stack

Node.js >= 22 - Express 4 - MySQL 8 (`mysql2/promise`) - `express-session` + `express-mysql-session` - Argon2id (`argon2`) -
Zod - Helmet - `express-rate-limit` - `cors` - PDFKit - ExcelJS - Pino - Swagger UI (OpenAPI 3) - `node:test` + Supertest.

## Quick start

```bash
# 1. dependencies
npm install                      # creates package-lock.json (commit it); Windows PowerShell: npm.cmd install

# 2. database (as a MySQL admin, once) - edit the CHANGE_ME_* passwords first
mysql -u root -p < database/setup/create_database_and_users.sql

# 3. configuration
cp .env.example .env             # PowerShell: Copy-Item .env.example .env   -> fill DB_PASSWORD, SESSION_SECRET, ...

# 4. schema, categories, first Super Admin
npm run migrate
npm run seed
npm run create-admin

# 5. run
npm run dev                      # or: npm start
curl http://localhost:3000/health/ready
# API docs (non-production): http://localhost:3000/api-docs
```

If PowerShell blocks `npm.ps1`: use `npm.cmd ...` or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Verify it (first run)

```bash
npm run check                    # syntax check of every .js file (no dependencies needed)
npm run test:unit                # unit tests (need `npm install`; no database)

# integration tests are DESTRUCTIVE (TRUNCATE) and refuse to run unless NODE_ENV=test and the DB name ends in _test
mysql -u root -p -e "CREATE DATABASE patient_noncompliance_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; \
  CREATE USER 'pnms_test_user'@'%' IDENTIFIED BY '<password>'; GRANT ALL ON patient_noncompliance_test.* TO 'pnms_test_user'@'%';"
cp .env.test.example .env.test   # fill DB_PASSWORD / MIGRATION_DB_PASSWORD
npm test                         # unit + integration (applies migrations + seed to the test DB)
npm run audit                    # npm audit --omit=dev
docker compose config -q         # validates the compose file (needs the env vars from docs/DEPLOYMENT.md)
```

## npm scripts

| Script | What it does |
|---|---|
| `npm start` / `npm run dev` | start the API / start with `--watch` |
| `npm run migrate` / `migrate:status` | apply pending migrations / show status (uses `MIGRATION_DB_*` if set) |
| `npm run migrate:down -- --steps 1 --yes` | **destructive** rollback (blocked in production unless `ALLOW_PRODUCTION_ROLLBACK=yes`) |
| `npm run seed` | idempotent seed of the ten categories (never overwrites admin edits) |
| `npm run create-admin` | secure first Super Admin (interactive, hidden password) |
| `npm run check` | `node --check` over src/, scripts/, tests/ |
| `npm test`, `test:unit`, `test:integration` | tests |
| `npm run audit` | dependency vulnerability audit |

## Roles and categories

| Role | May do | Categories (seeded, exactly ten) |
|---|---|---|
| `HEAD_NURSE` | record a patient check (compliant, or non-compliant with categories); view own reports and own analytics | BME, Medicine Administration, IV Cannulation, Infection Control Practice, Patient Safety |
| `PHARMACIST` | same | ADR Identified, Drug Interaction, Frequency / Timing Intervention, 5R, Crash Cart |
| `SUPER_ADMIN` | all reports, dashboard, users, exports, audit logs (cannot submit reports) | sees all categories |

All permissions are enforced on the server from the session; role/user ids sent by the client are never trusted.

## Project layout

```
src/
  app.js, server.js, container.js     app factory, process entry (graceful shutdown), dependency wiring
  config/        env validation, logger, MySQL pool + transactions, session store
  constants/     roles, categories, error codes, audit actions
  routes/ controllers/ services/ repositories/    HTTP -> business rules -> SQL (parameterized)
  middleware/    auth (requireAuth/requireRole), csrf, validateRequest, errorHandler, rate limiters, request id, logging
  validators/    Zod schemas (strict)
  utils/         dates, MR policy, Excel formula safety, crypto, pagination, sanitising
  database/      migration + seed runner
database/        migrations/ (+down/), seeds/, setup/, queries/examples.sql, schema.sql, seed.sql
scripts/         migrate.js, seed.js, create-admin.js, check-syntax.js
tests/           unit/ and integration/ (real MySQL)
docs/            API.md, openapi.yaml, ER_DIAGRAM.md, SECURITY.md, DEPLOYMENT.md, BACKUP_RESTORE.md, QR_INTEGRATION.md,
                 IMPLEMENTATION_CHECKLIST.md, PROGRESS.md
```

## Configuration

All settings come from environment variables (validated at startup; the process exits naming any invalid variable, never printing values).
See [.env.example](.env.example). Notable: `MR_NUMBER_REGEX` (default `^[0-9]{5,20}$` - **set it to the hospital's real format**),
`REPORT_UTC_OFFSET` (reporting time zone for "today", date filters and trends), `EXPORT_MAX_ROWS`, session timeouts, lockout, rate limits.

## Documentation

- [API.md](docs/API.md) and [openapi.yaml](docs/openapi.yaml) - endpoints, schemas, status codes
- [ER_DIAGRAM.md](docs/ER_DIAGRAM.md) - Mermaid ER diagram, indexes; [database/queries/examples.sql](database/queries/examples.sql)
- [SECURITY.md](docs/SECURITY.md) - decisions, limitations, audit policy, production checklist
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - production, Docker, HTTPS/reverse proxy, monitoring
- [BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) - backups, restore, migrations and rollback
- [QR_INTEGRATION.md](docs/QR_INTEGRATION.md) - frontend contract for QR / MR Number entry

## Design notes

- Column names use snake_case (`must_change_password`, `failed_login_attempts`, `last_login_at`, `actor_user_id`); the specification's un-separated names were normalised.
- Extra columns beyond the specification: `users.locked_until`, `reports.submitter_role`, `reports.submitter_login_at` (migration 0006); extra tables: `idempotency_keys`, `schema_migrations`.
- Super Admins cannot submit reports; staff only see their own reports (the specification did not define staff read access - least privilege was chosen).
- No hospital system integration exists; `src/services/patientDirectoryService.js` is the isolated placeholder for a future, authorised one.

## Frontend developers
See `docs/FRONTEND_INTEGRATION.md` (auth/CSRF flow, filters, report submission and idempotency, dashboard semantics, exports) and `docs/openapi.yaml`.
#   P N M S - m o b i l e  
 