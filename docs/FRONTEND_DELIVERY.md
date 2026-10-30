# ChildLife frontend delivery

## Status

The React/TypeScript frontend is implemented against the existing Express/MySQL contracts. It is not accepted for production rollout: no live test backend, database credentials, authorized synthetic accounts, or official logo asset were supplied. Camera/device compatibility and authenticated end-to-end acceptance remain unverified. No mock API, fabricated statistics, localStorage, or client-only authentication is included in production code.

## Architecture

- Vite 7, React 19, React Router 7, TypeScript, Tailwind 4.
- SWR manages ephemeral server state; this is an explicit deviation from the prompt's TanStack Query preference to follow this workspace's required SWR convention.
- React Hook Form with Zod and compatible resolver 3 for the existing Zod 3 dependency.
- Recharts for server-backed analytics, ZXing for actual QR decoding.
- Native modal dialogs, semantic forms, keyboard focus styles, responsive cards/tables.
- Frontend files are isolated in `frontend/`; existing backend routes, database implementation, and authorization rules are unchanged.
- Screens are lazy-loaded. Camera and chart libraries are excluded from the initial login chunk.
- No analytics, external font requests, or patient images.

## Install, start, and build (maintainer instructions)

Use the connected GitHub repository to obtain the source. Run with Node 22+ and npm using the committed lockfile.

```sh
npm ci
npm run dev:api
# In a separate terminal:
npm run dev
```

`npm start` still runs the original Express backend. `npm run dev:api` runs the existing API on port 3001; `npm run dev` runs Vite on port 3000. Configure the existing backend's MySQL and session variables first according to `.env.example` and `docs/DEPLOYMENT.md`. No database provisioning or migrations were performed in this task.

Copy the public settings in `frontend/.env.example` to the repository-root `.env.local` as appropriate. Never put credentials in VITE-prefixed variables.

- `VITE_API_URL`: empty for the local same-origin proxy; otherwise the trusted HTTPS API base including `/api` (https://pnms-backend.onrender.com/api).
- `FRONTEND_API_PROXY`: development-only upstream, defaults to `http://127.0.0.1:3001`.
- `VITE_MR_NUMBER_REGEX`: must match backend `MR_NUMBER_REGEX`; default is the backend example's 5–20 digits, not an inferred format from the example QR.
- `VITE_REMARKS_MAX_LENGTH`: must match the backend; defaults to 1000.
- `VITE_ALLOW_MANUAL_MR`, `VITE_ALLOW_REMARKS`: disabled until approved. These are UI controls, not security authorization policies.

The backend has no public policy-discovery endpoint; deployment must synchronize these settings manually. Rebuild the frontend after public build-time configuration changes.

```sh
npm run build
npm run preview
npm run test:frontend
npm run test:e2e
```

The build outputs `dist/frontend`. Vercel configuration in `vercel.json` serves the SPA and sets security headers. It does not provision or deploy the existing MySQL/Express backend. API and health URLs are excluded from the SPA fallback. Until a backend origin or explicit reverse proxy is configured, requests correctly fail instead of returning fake data.

For production, prefer one HTTPS origin with a reverse proxy forwarding `/api/*` and `/health/*` to Express. A separate API origin requires backend `APP_ORIGIN` to include the exact frontend origin, credentialed CORS, cookie settings compatible with the site relationship, and access to `Content-Disposition` for export filenames. Browser third-party-cookie policies may prevent embedded cross-site sessions even when SameSite=None/Secure are configured. Validate on the actual deployment, not just in a preview iframe. The existing `FRONTEND_ORIGIN` variable does not replace the backend's verified `APP_ORIGIN` contract.

The QR scanner needs HTTPS, camera permission, and parent-frame camera delegation if embedded. The deployed header allows camera use on the site's own origin. Do not deploy the app behind a camera-denying permissions policy.

## Integration coverage matrix

All entries below indicate implemented client coverage, not live acceptance evidence.

| Method / route | Frontend consumer |
| --- | --- |
| GET /api/auth/csrf-token | Central client before mutations, deduplicated token acquisition |
| POST /api/auth/login | Username/password login, cookie session and rotated token |
| GET /api/auth/me | Session restoration and authoritative profile/role |
| POST /api/auth/change-password | Mandatory and voluntary password change |
| POST /api/auth/logout | Server session destruction followed by cache clearing |
| GET /api/categories | Role-scoped reporting categories and filter options; activeOnly supported |
| POST /api/reports | Confirmed MR, multi-category observation, idempotency key |
| GET /api/reports | Clinical history and administrator reports, server paging/filtering/sorting |
| GET /api/reports/:id | Authorized detail dialog |
| GET /api/dashboard/summary | Six authoritative summary cards and role totals |
| GET /api/dashboard/categories | Category counts and distinct-report denominator |
| GET /api/dashboard/trends | Daily/weekly/monthly trends and accessible data table |
| GET /api/exports/reports.pdf | Filtered binary PDF, no page/limit |
| GET /api/exports/reports.xlsx | Filtered binary spreadsheet, no page/limit |
| GET /api/users | Filtered, sorted, paginated staff directory |
| POST /api/users | Account creation, optional password, one-time generated-password display |
| GET /api/users/:id | Fresh staff profile before editing |
| PATCH /api/users/:id | Full-name / role editing, no protected internal fields |
| PATCH /api/users/:id/status | Confirmed activation/deactivation, self-action disabled |
| POST /api/users/:id/reset-password | Confirmed reset, optional password, one-time credential display |
| GET /api/audit-logs | Read-only filters, paging, metadata details |
| GET /health/live | Administrator-only status page |
| GET /health/ready | Administrator-only status page |

## Contract and privacy decisions

- Backend source took precedence over conflicting SRS examples. MySQL, numeric IDs, `username`, `/api/users`, `/api/audit-logs`, `page`/`limit`, and envelope structures are retained.
- Read the full set of 108 Postman scenarios. The collection was not executed: it creates and changes accounts/reports and must only run in an approved synthetic test environment.
- User controller flattens `{ user, temporaryPassword }` from its service into the response `data`; the frontend follows the controller, not the service's intermediate shape.
- Category analytics use `categoryId`, not `id`; report category display values are strings.
- Invalid-credential responses are not used to distinguish unknown, locked, or disabled accounts.
- CSRF is held only in memory, rotated from server responses, and refreshed/retried only once on explicit `CSRF_INVALID`. Network failures and other mutations are not automatically replayed.
- A report's uncertain outcome freezes its fields and retains the exact key/body for an explicit retry. Keep the page open until the outcome is resolved; a full reload cannot preserve pending patient data because there is deliberately no persistent browser storage.
- MR Numbers remain strings and are confirmed by staff. There is no patient lookup or inferred clinical information.
- Summary today/month counters deliberately exclude date filters according to backend semantics. Active staff is global, not filtered. Trend buckets use the backend's returned time-zone/range. Record timestamps are explicitly labeled UTC.
- Report filters stay in memory rather than browser navigation URLs. The optional report detail URL contains a numeric report ID, not an MR Number.
- Logout or session-expiration signals abort in-flight requests and clear SWR data. Session timeouts also hide the workspace locally. Backend authorization remains authoritative.
- Official logo missing: organization text is displayed, not a fabricated official emblem. Replace with the supplied official asset only after it is provided.

## Verification evidence — 2026-10-19

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed: manifest and lockfile reproducible; install lifecycle scripts were intentionally not run in this check |
| TypeScript (`npm run build`) | Passed |
| Vite production build | Passed; separate clinical scanner and dashboard bundles |
| Frontend ESLint (`npx eslint frontend vite.config.ts vitest.config.ts playwright.config.ts`) | Passed |
| `npm run test:frontend` | 28 tests passed across 3 files |
| `npm run check` | 90/90 existing backend JS syntax checks passed |
| `git diff --check` | Passed before documentation addition |
| Full repository ESLint | Blocked by pre-existing unused `createCsrf` import in `src/routes/index.js` and `prefer-const` errors in two existing integration tests; two existing unused-disable warnings also remain |
| Existing backend unit suite | 36/38 passed; two password tests fail because their fixture uses Argon2 `timeCost=1`, below the installed library's minimum of 2. Backend code/test fixtures were not silently changed |
| Playwright desktop/tablet/mobile | Not executed successfully: Chromium runtime missing; one install recovery failed because the sandbox lacks apt-get/system dependency support |
| agent-browser visual check | Blocked: preview returned `502 SANDBOX_NOT_LISTENING`; no visual success claimed |
| Backend integration suite / Postman | Not run without a configured dedicated MySQL test database; destructive tests require names ending `_test` |
| Live role logins, real persistence, PDF/XLSX contents, account mutation and revocation | Not verified without an authorized test backend and synthetic accounts |
| Physical camera / Android Chrome / iOS Safari | Not verified; requires actual hospital devices |

Frontend tests cover cookie credentials, CSRF lifecycle/one-time retry, no automatic uncertain mutation replay, safe server/network/rate-limit errors, required-password signals, export MIME checks and pagination exclusion, MR leading zeros/invalid payloads, password validation, safe text rendering, field associations, visibility controls, category role filtering, explicit MR confirmation, disabled empty submission, unknown-outcome retry key/body preservation, confirmation/reset, and an administrator route gate. Test doubles exist only under tests, not application services. These tests are not substitutes for live backend acceptance.

`npm audit` after replacing the newly added vulnerable test runner reports four remaining advisories (three moderate, one high) in existing backend dependency chains: nested mysql2 under express-mysql-session and uuid under exceljs. Do not dismiss these as production-safe; review and remediate with backend regression testing before rollout. No forced major backend upgrades were applied.

## Outstanding acceptance prerequisites

1. Supply the dedicated non-production API URL and configure its frontend origin/cookie settings. Do not paste passwords or database secrets into chat.
2. Provide an authorized synthetic account per role and a synthetic MySQL test environment through approved secure configuration.
3. Supply the official ChildLife logo asset.
4. Confirm the exact MR policy, manual-entry permission, remarks policy, reporting timezone, supported devices, and record-access/retention approvals.
5. Resolve the existing backend test/lint/dependency findings and rerun the complete test suite.
6. Run authenticated browser journeys, binary export checks, camera permission/scan/switch/cleanup tests, accessibility review, and organizational security review.

No production-readiness, hardware-compatibility, or complete live-acceptance claim is made.
