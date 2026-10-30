# QR / MR Number Integration Contract

The hospital's existing QR code contains **only an MR Number**. This backend treats it as an ordinary, sensitive string.

## Backend guarantees

- Manual entry and QR scan use the **same** validation: the frontend sends the text as `mrNumber` to `POST /api/reports`.
- The format is validated by the configurable policy `MR_NUMBER_REGEX` (default `^[0-9]{5,20}$`, max 64 chars). Invalid values -> `400 VALIDATION_ERROR`.
- MR Numbers are stored as `VARCHAR(64)`, so leading zeros are preserved (`00012345` stays `00012345`).
- An MR Number **never authenticates anyone** and is never accepted in place of a session.
- **Nothing is submitted by a scan.** A report exists only after an authenticated Head Nurse/Pharmacist explicitly calls `POST /api/reports`.
- Complete MR Numbers are not logged: access logs omit query strings, pino redacts `mrNumber`, audit entries for reports contain only ids, and audit filters for exports store a masked value.
- No patient names, wards or units are returned or invented. `src/services/patientDirectoryService.js` is the single, isolated place where a future hospital API could be integrated; today it reports `isConfigured() === false` and is not called by any route.

## Frontend responsibilities (not implemented here)

1. **Camera permission and HTTPS** - browsers expose the camera only in secure contexts (HTTPS or `localhost`).
2. **Duplicate-scan prevention** - debounce/lock the scanner after a successful read so one scan does not populate or submit twice.
3. **Confirm before submit** - show the scanned MR Number, let the user correct it, then require an explicit submit.
4. **Use the idempotency contract for retries** - generate one `Idempotency-Key` (UUID) per *submission attempt* and reuse it only when retrying that same submission after a network failure. Create a **new** key for a genuinely new report (the same MR Number may be reported again).
5. **Send the CSRF token** (`X-CSRF-Token`) on every POST; obtain it from `GET /api/auth/csrf-token`, the login response or `GET /api/auth/me`.
6. Send cookies (`credentials: 'include'` / `withCredentials: true`) and call the API from an origin listed in `APP_ORIGIN`.
7. Trim whitespace/newlines that some scanners append (the backend also trims).

## Example

```http
POST /api/reports HTTP/1.1
Content-Type: application/json
X-CSRF-Token: <token>
Idempotency-Key: 6f1c2d1e-9b7a-4d3e-8a55-0c2b9a7d4f10
Cookie: pnms.sid=...

{ "mrNumber": "23260022844", "categoryIds": [1, 3], "remarks": "Observation recorded" }
```

Responses: `201` created; `200` + `Idempotent-Replayed: true` for an identical retry; `409 IDEMPOTENCY_KEY_REUSED` if the key was used with a different payload; `400` invalid MR Number/body; `403` category not permitted for the role; `422` unknown or inactive category.
