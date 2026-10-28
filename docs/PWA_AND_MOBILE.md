# Installable PWA, mobile UI and daily first-login: guide

## What was built
- **PWA** (no new dependency): `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`, icons `public/pwa-192.png`, `pwa-512.png`,
  `pwa-maskable-512.png`, `apple-touch-icon.png` (180x180), `favicon.png`, generated from `public/images/clf-logo.webp` with its proportions preserved
  (white background, padded). `index.html` links the manifest and the Apple home-screen metadata and uses `viewport-fit=cover`.
  Registration and the update flow: `frontend/lib/pwa.ts`, `frontend/components/pwa-status.tsx` (production builds only).
- **Why not `vite-plugin-pwa`:** the package could not be installed in the build environment (npm registry unreachable) and adding it to `package.json` without
  an updated lockfile would break `npm ci`. A small hand-written service worker gives the required security policy with no new dependency. If you prefer the
  plugin later: `npm i -D vite-plugin-pwa`, move the manifest into the plugin options and keep the same rules (no `/api` caching, update prompt).
- **Caching policy** (`public/sw.js`): only same-origin hashed bundles under `/assets/`, the icons, the manifest, the logo and the generic offline page are cached.
  `/api/*`, `/health/*`, every non-GET request, cross-origin requests and HTML documents are never cached (not even intercepted). Page loads are network-only;
  without a connection a generic "Connection required" page appears. No offline report creation, no background sync, no patient data in any cache.
- **Updates:** a new service worker waits. A banner offers "Refresh"; nothing reloads by itself, so a scan or a report in progress is never lost.
  Pull-to-refresh is disabled in standalone mode (`overscroll-behavior`). An offline banner says reports cannot be submitted until you are back online.
- **Mobile UI:** bottom navigation (Head Nurse / Pharmacist: Dashboard, Scan Patient, My Reports, Account; Super Admin: Overview, Reports, Staff, Audit; drawer
  keeps the rest), hidden while the keyboard is open; safe-area insets; 44-46 px touch targets on touch devices; 16 px inputs (no iOS zoom); larger full-width
  camera preview; scanner torch toggle (where supported), camera switching, permission guidance, duplicate-scan guard, manual MR entry (when enabled);
  stacked dashboard cards and charts; reduced-motion respected. Dark mode was intentionally not added (it would change the approved design).
- **Daily first login:** migration `0009` creates `daily_first_logins (user_id, login_date PKT, first_login_at UTC)` with `PRIMARY KEY (user_id, login_date)`.
  At every genuine successful login of a Head Nurse / Pharmacist the server runs one atomic `INSERT ... ON DUPLICATE KEY UPDATE user_id = user_id`, so the first
  login of the Pakistan day is kept and later or simultaneous logins change nothing. Each report/check shows the first login of the **Pakistan date of its
  submission** (`firstLoginAt`, joined at read time): the same value for every report that day, an independent value on the next day, and "Not Available" when no
  login is recorded for that date (a session kept open past midnight never reuses yesterday's value; nothing is created at midnight). Failed logins, logout and
  password changes never touch the table. Super Admin tables, details and PDF/Excel exports have separate **First Login Time (PKT)** and **Submission Time (PKT)**
  columns. The per-session sign-in time (`submitterLoginAt`) is still stored and returned by the API but is no longer what the UI shows.
- **Historical data:** the table starts empty, so older reports show "Not Available". An OPTIONAL backfill from `audit_logs` (real `LOGIN_SUCCESS` records) is in
  `database/manual/optional_backfill_first_login_from_audit.sql`; run it only if you accept the audit trail as complete (it skips the first, possibly partial, audit day).

## Deploy order
1. Back up. 2. Apply migration `0009` (and 0006-0008 if missing; `database/manual/apply_pending_migrations_0006_0008.sql` contains all four, or `npm run migrate`).
3. Deploy the API, then the frontend. 4. Users must sign in once on a day for that day's first login to exist.

## Local HTTPS testing on a phone (same Wi-Fi)
1. `npm run dev` serves the frontend on `https://<computer-LAN-IP>:3000` (certificates in `certs/`, git-ignored) and proxies `/api` and `/health` to the backend on 3001.
   Always use relative API URLs (the app does); `localhost` on a phone is the phone.
2. The phone must trust the certificate: install your mkcert root CA (`rootCA.pem`, never the key) on the device and enable full trust
   (iOS: Settings > General > About > Certificate Trust Settings). The certificate must include the LAN IP or hostname you type.
3. The service worker is registered only in production builds. To test installation locally: `npm run build` then `npm run preview` (HTTPS reuses the dev certificate)
   and open `https://<LAN-IP>:3000`. In `npm run dev` the app is not installable by design (dev modules must never be cached).
4. Camera access needs HTTPS (or localhost); allow it when prompted.

## Android (Chrome)
Open the HTTPS address, sign in once, then menu (three dots) > **Install app** / **Add to Home screen**. The app opens standalone without the address bar.
Chrome may also show an install prompt automatically once the installability criteria are met (manifest, icons, service worker, HTTPS).

## iPhone / iPad (Safari)
Open the address in **Safari**, tap **Share** > **Add to Home Screen** > Add. iOS has no install prompt and may clear service-worker storage after long inactivity;
the app simply reloads from the network. Camera access in a home-screen app is available on current iOS versions; if it is denied, re-enable it in
Settings > Safari/Apps > Camera, or use manual entry when it is enabled (`VITE_ALLOW_MANUAL_MR=true`).

## Production deployment checklist
- Public domain with a **publicly trusted TLS certificate** (e.g. Let's Encrypt); never disable certificate validation. HSTS is already sent by `vercel.json`.
- Serve the frontend and the API on the **same site** (e.g. `https://pnms.example.org` and `/api` routed by the reverse proxy to the API), so cookies stay first-party.
  Route `/api/*` and `/health/*` to Node; everything else to `index.html` (see `vercel.json` rewrites).
- API environment: `NODE_ENV=production`, `APP_ORIGIN=https://pnms.example.org` (the CORS allowlist; list only real origins), `COOKIE_SECURE=true`,
  `COOKIE_SAME_SITE=lax` (use `none` only for a cross-site API, with Secure), `TRUST_PROXY` set to the number of proxies in front, a long random `SESSION_SECRET`,
  `REPORT_UTC_OFFSET=+05:00`, `ENABLE_API_DOCS=false`, rate limits tuned.
- CSRF: keep the synchronizer token flow unchanged; the PWA uses the same cookies and `X-CSRF-Token` header as the browser app.
- **Database:** MySQL reachable only from the API host/private network (security group / firewall; never a public port); dedicated least-privilege app user and a
  separate migration user; TLS to MySQL with certificate verification (`DB_SSL_ENABLED`, `DB_SSL_CA_PATH`); backups before every migration.
- Service-worker hosting: `/sw.js` must be served from the site root with `Cache-Control: no-cache`; `/assets/*` immutable (configured in `vercel.json`; replicate in nginx).
- Rotate the secrets that were present in the delivered `.env`, and remove the private keys shipped in `certs/` and `mkcert andriod/` from the repository.

## Verification status (honest)
Executed in the build environment: the dependency-free unit tests (dates, MR, utils, Excel safety, and the new `tests/unit/pwa.test.js`: manifest, icon sizes, service-worker
policy in a sandbox) all pass. NOT executed (packages, database and devices are unavailable here): `npm run build`, `npm run check`, `npm run test:frontend`, the integration
tests (including `dailyFirstLogin.test.js`, `compliance.test.js`), migrations, Lighthouse/installability checks, and **any physical Android or iPhone test**. Run them
before deployment. Known limits: the supplied logo is only 180x110 px, so the 512 px icon is an upscaled version (supply a larger source for crisper icons);
iOS install prompts and background capabilities are limited by Safari; the service worker does not make the app usable offline by design.
