# PNMS frontend (React + Vite)

Single-page app / installable PWA. Talks to the API only through `src/lib/api.ts` (base URL from `VITE_API_URL`,
`credentials: "include"`, CSRF token handling unchanged).

## Commands

```bash
cd frontend
npm install
cp .env.example .env.local     # optional for local dev
npm run dev        # http://localhost:3000  (backend must run separately on :3001)
npm run build      # type-check (tsc) + production build into dist/
npm run preview    # serve dist/ locally
npm test           # vitest (jsdom) unit/component tests
npm run test:pwa   # node:test static checks of manifest, icons and service worker
npm run lint       # eslint (TypeScript)
npm run test:e2e   # Playwright (needs `npx playwright install` and the dev server)
```

## Environment variables (`.env.local` locally, Netlify UI in production)

All `VITE_*` values are compiled into the public bundle - **never put secrets in them**.

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Full API base including `/api`: `https://pnms-backend.onrender.com/api` (set in `.env.production` and in the host's env settings). **Empty** = same-origin `/api` (local dev via the Vite proxy). Code paths such as `/api/auth/me` are mapped onto it by `apiUrl()` in `src/lib/api.ts` (no duplicate `/api`). |
| `FRONTEND_API_PROXY` | Dev-server proxy target (default `http://127.0.0.1:3001`). Not bundled; ignored by `npm run build`. |
| `VITE_MR_NUMBER_REGEX`, `VITE_REMARKS_MAX_LENGTH` | UI validation hints; keep in sync with the backend values. |
| `VITE_ALLOW_MANUAL_MR`, `VITE_ALLOW_REMARKS` | UI policy toggles (server remains authoritative). |

Optional: `frontend/certs/dev-key.pem` + `dev-cert.pem` (git-ignored) make the dev server use HTTPS, needed for camera
scanning on phones. They are only read if present, so builds never depend on them.

## Deploy to Render (Static Site) - current target

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |
| Environment variable | `VITE_API_URL=https://pnms-backend.onrender.com/api` |
| Redirects/Rewrites | `/*` -> `/index.html` (**Rewrite**, not Redirect) - already in `render.yaml`; add it in the dashboard if you create the site manually |

All requests then go to `https://pnms-backend.onrender.com/api/...` (e.g. `/api/auth/me`) with `credentials: "include"`.
Health checks go to `https://pnms-backend.onrender.com/health/...`. Vite reads `VITE_API_URL` at **build** time: changing it needs a rebuild.

**Backend CORS/cookie settings required on the Render backend service** (exact origin = your static site URL, e.g.
`https://pnms-frontend.onrender.com`; no wildcard, no trailing path): `FRONTEND_URL=<that origin>`, `NODE_ENV=production`,
`COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `TRUST_PROXY=1`. `onrender.com` is on the Public Suffix List, so the two services are
cross-site (third-party cookie limits for Safari/iOS apply; a shared custom domain with `lax` avoids this).
If the site URL changes, update `FRONTEND_URL` and redeploy the backend.

## Alternative: deploy to Netlify

1. Netlify -> *Add new site -> Import from Git*; **Base directory: `frontend`**. Build command `npm run build`, publish
   directory `dist` (already set in `netlify.toml`; Node 22).
2. Site settings -> Environment variables: `VITE_API_URL=https://<your-railway-url>` (+ the other `VITE_*` values).
3. Deploy. `netlify.toml` and `public/_redirects` provide the SPA fallback (`/* -> /index.html 200`, so refresh and deep
   links such as `/staff` work), security headers, and correct caching for `sw.js` and the manifest.
4. Copy the final site origin into the backend's `FRONTEND_URL` on Railway (CORS/CSRF allowlist) and redeploy the API.

### Cookies across Netlify and Railway - read this

`*.netlify.app` and `*.up.railway.app` are different registrable domains, so the session cookie set by the API is a
**third-party (cross-site) cookie**. It works only with `SameSite=None; Secure; HttpOnly` (backend env) and only in browsers
that still allow third-party cookies. **Safari/iOS (ITP) and browsers/profiles that block third-party cookies will fail to
keep the login.** Pick one of these robust options:

* **Option A - same registrable domain (best):** custom domains such as `app.example.org` (Netlify) and
  `api.example.org` (Railway). Cookies become first-party; use `COOKIE_SAME_SITE=lax`.
* **Option B - same-origin proxy on Netlify:** leave `VITE_API_URL` empty and enable the commented `/api/*` and
  `/health/*` rewrite rules in `netlify.toml` pointing at Railway. The browser then talks only to Netlify. Limits: Netlify
  proxy requests time out at ~26 s (large PDF/Excel exports may fail) and the rule needs your real Railway URL.
* **Option C - default `*.netlify.app` + `*.up.railway.app` with `SameSite=None`:** works in Chrome/Edge/Firefox with default
  settings; not reliable on Safari/iOS. This is the configuration the task asked for; it is documented, not guaranteed.

## Layout

`src/` app code (`auth/ components/ features/ lib/ tests/ main.tsx styles.css`), `public/` static assets + PWA files
(`sw.js`, `manifest.webmanifest`, icons, `_redirects`), `e2e/` Playwright specs, `tests/` node:test PWA checks,
`docs/` frontend notes (PWA, integration, QR scanner).

## Current production API
`https://pnms-backend.onrender.com` (Render) is baked into production builds via `.env.production`. The backend must have
`FRONTEND_URL=<your Netlify origin>`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `TRUST_PROXY=1` and `NODE_ENV=production`;
otherwise login cookies and CORS/CSRF will fail. Changing the API host later means editing `.env.production` and the CSP `connect-src` in `netlify.toml`.

## Current hosting: both services on Render
Frontend `https://pnms-mobile.onrender.com` (Render Static Site, settings above) -> API `https://pnms-backend.onrender.com`.
`.env.production` therefore sets `VITE_API_URL=https://pnms-backend.onrender.com/api` (the Netlify proxy in `netlify.toml` does not exist on Render).
On the API service set `FRONTEND_URL=https://pnms-mobile.onrender.com`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none` (`TRUST_PROXY` defaults to 1 on Render).
Rebuild the static site after changing any `VITE_*` value.
