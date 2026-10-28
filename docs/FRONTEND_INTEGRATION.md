# Frontend Integration Guide

This is the contract a frontend (or QR-scanner screen) must follow. The authoritative machine-readable version is
`docs/openapi.yaml` (Swagger UI at `/api-docs` outside production).

## 0. Contract decisions (finalized names)

The PDF specification is the source of truth. These names are final and are used consistently in the database, validators,
API and docs. **Do not rename them without changing the OpenAPI file, validators and tests together.**

| Topic | Final decision |
|---|---|
| Staff user routes | `/api/users` (there is **no** `/api/admin/users`) |
| Audit routes | `GET /api/audit-logs` |
| Staff login identifier | `username` (column `users.username`, request field `username`, lower-cased, 3-50 chars `A-Z a-z 0-9 . _ -`). There is no `staffIdentifier`. |
| Pagination request | `page` (default 1) and `limit` (default 20, max 100). There is no `pageSize`. |
| Pagination response | `meta: { page, limit, total, totalPages }` next to `data: [...]` |
| Sorting | `sortBy` (allow-listed per endpoint) + `sortOrder` = `asc` \| `desc` |
| JSON field names | camelCase everywhere (`mrNumber`, `categoryIds`, `submittedAt`) |
| Timestamps | ISO-8601 UTC strings with `Z` (e.g. `2026-03-02T08:00:00.000Z`); dashboard buckets are `YYYY-MM-DD` in the hospital reporting time zone |
| Success body | `{ "success": true, "message": "...", "data": ..., "meta"?: ... }` |
| Error body | `{ "success": false, "error": { "code", "message", "details": [{path, message}], "requestId" } }` |

If your frontend was written against `pageSize`, `staffIdentifier` or `/api/admin/*`, change the frontend, not the backend.

## 1. Authentication, session and CSRF

All requests must send cookies: `fetch(url, { credentials: 'include' })` (axios: `withCredentials: true`).
Your frontend origin must be listed in `APP_ORIGIN`.

1. `GET /api/auth/csrf-token` -> `data.csrfToken` (also creates the anonymous session).
2. `POST /api/auth/login` with header `X-CSRF-Token: <token>` and body `{ "username", "password" }`.
   Success returns `data: { user: { id, fullName, username, role, mustChangePassword }, csrfToken }`.
   **Replace your stored token with the one in the login response** (the session id is regenerated at login).
3. Send `X-CSRF-Token` on every `POST`, `PATCH` (and any other state-changing request). `GET` needs no token.
4. After a page refresh call `GET /api/auth/me` -> `data: { user, csrfToken, session: { idleTimeoutMinutes, absoluteExpiresAt } }`.
   `401` means signed out: show the login screen.
5. `POST /api/auth/logout` destroys the server session. `POST /api/auth/change-password` returns a fresh `csrfToken`.

Login failures are deliberately identical (`401 INVALID_CREDENTIALS`, "Invalid username or password") for unknown users,
wrong passwords, disabled and locked accounts. Do not try to distinguish them in the UI.

Status handling: `401 UNAUTHENTICATED | SESSION_EXPIRED` -> go to login. `403 PASSWORD_CHANGE_REQUIRED` -> force the
change-password screen (`mustChangePassword: true`). `403 CSRF_INVALID` -> re-fetch the token and retry once.
`403 FORBIDDEN` -> the role may not use this endpoint. `429 RATE_LIMITED` -> back off.

## 2. Roles

`HEAD_NURSE`, `PHARMACIST` (submit and view their own reports) and `SUPER_ADMIN` (dashboard, all reports, users, exports,
audit). The role always comes from the server session; any `role`/`userId` you send in a body is rejected (`400`).

## 3. Categories and report submission (QR and manual entry)

`GET /api/categories` returns only the **active categories permitted for the signed-in role** (five each). Use those ids.

`POST /api/reports`
```
Headers: X-CSRF-Token: <token>, Idempotency-Key: <uuid, 8-128 chars of A-Z a-z 0-9 _ . : ->
Body:    { "mrNumber": "23260022844", "categoryIds": [1, 3], "remarks": "optional" }
```
- **QR scan and manual entry use this exact endpoint and validation.** The QR payload is just an MR Number string. A scan
  must only fill the form; the user must still press Submit. The backend never creates a report because of a scan.
- Send `mrNumber` as a **string** (leading zeros are preserved). Do not convert to a number.
- Generate **one `Idempotency-Key` per submit attempt** (when the user presses Submit) and reuse that same key if you retry
  after a network error/timeout. Do **not** reuse it for a new, deliberate report (the same MR Number may legitimately have
  several reports). Keep the key until you get a definitive response.
- `201` = created. `200` + header `Idempotent-Replayed: true` = this retry was already processed (same report returned).
  `409 IDEMPOTENCY_KEY_REUSED` = same key with a different payload.
- Errors: `400 VALIDATION_ERROR` (bad MR Number / empty or duplicate `categoryIds` / unknown field), `422 INVALID_CATEGORY`
  (unknown or inactive), `403 CATEGORY_NOT_PERMITTED` (other role's category). Nothing is saved on any error.

`GET /api/reports/:id` and `GET /api/reports` (staff see **only their own**; Super Admin sees all).

## 4. Filtering (reports, dashboard and exports share one filter set)

`from`, `to` (`YYYY-MM-DD`, whole days in the hospital reporting time zone, `to` inclusive; or ISO datetime with offset),
`mrNumber` (exact), `staffId`, `role` (`HEAD_NURSE|PHARMACIST`), `categoryId`.
The report table (`GET /api/reports`), `GET /api/dashboard/summary|categories|trends` and
`GET /api/exports/reports.pdf|xlsx` all accept these and apply them identically. **Pass the same query string to all of
them and the numbers will agree.**

Report table extras: `page`, `limit`, `sortBy` (`submittedAt|id|mrNumber|staffName|role`), `sortOrder`.
Exports accept the filters plus `sortBy`/`sortOrder` but **not** `page`/`limit` (sending them is a `400`); they return the complete filtered result (up to `EXPORT_MAX_ROWS`, else `422 EXPORT_LIMIT_EXCEEDED`).

## 5. Dashboard semantics (Super Admin)

| Card / chart | Endpoint + field | Rule |
|---|---|---|
| Total / Head Nurse / Pharmacist reports | `summary.totalReports / headNurseReports / pharmacistReports` | distinct reports under the filters |
| Today / this month | `summary.reportsToday / reportsThisMonth` | hospital time zone; honour non-date filters; **ignore** `from`/`to` |
| Active staff | `summary.activeStaffAccounts` | active Head Nurse + Pharmacist accounts; independent of report filters |
| Category selections | `summary.totalCategorySelections` | **not** the same as reports |
| Category chart | `categories.categories[].selectionCount` | filtered reports containing each category; all 10 listed |
| Role chart | `summary.headNurseReports`, `pharmacistReports` | |
| Trend chart | `trends.points[]` `{ bucket, reportCount, categorySelectionCount }` | `interval=daily|weekly|monthly`, zero-filled, weeks start Monday; `from`/`to` must be date-only |

A report with three categories counts as **1 report and 3 category selections**; label the two numbers differently in the UI.
With a `categoryId` filter, the category chart shows the categories of the reports that contain that category.
Empty results return zeros and complete empty series (never an error).

## 6. Exports

`GET /api/exports/reports.pdf` / `.xlsx` (Super Admin). Download with credentials and save the blob:
```js
const res = await fetch('/api/exports/reports.xlsx?' + params, { credentials: 'include' });
if (!res.ok) { const err = await res.json(); /* show err.error.message */ }
else { const blob = await res.blob(); /* filename from Content-Disposition */ }
```
Errors are JSON (`401/403/422/429/500`); success is the file (`application/pdf` or the OOXML spreadsheet type).
The file is generated in memory and sent whole (no partial downloads). Exports are rate limited (`429`).

## 7. Users and audit logs (Super Admin)

`/api/users`: `GET` (filters `q`, `role`, `isActive`; `page`, `limit`, `sortBy`, `sortOrder`), `POST`, `GET /:id`,
`PATCH /:id` (`fullName`, `role`), `PATCH /:id/status` (`{ isActive }`), `POST /:id/reset-password`.
A generated `temporaryPassword` is returned **once** in the create/reset response; show it to the admin and never store it.
`409 LAST_SUPER_ADMIN` when deactivating/demoting the last active Super Admin; `409 SELF_ACTION_NOT_ALLOWED` for self
deactivation/role change. `GET /api/audit-logs` filters: `from`, `to`, `actorUserId`, `action`, `entityType`, `outcome`, `page`, `limit`, `sortOrder`.

## 8. Health

`GET /health/live` and `GET /health/ready` (no auth, no sensitive details; `503` when the database is unreachable).
