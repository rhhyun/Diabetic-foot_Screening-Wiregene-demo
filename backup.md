# Diabetic Foot Screening Wiregene Demo Backup

## 2026-07-07 initial repository and webpage audit

### Repository state

- Working directory: `C:\Users\rhhyu\Documents\GitHub\Diabetic-foot_Screening-Wiregene-demo`
- Remote: `https://github.com/rhhyun/Diabetic-foot_Screening-Wiregene-demo.git`
- Branch: `main`
- Pull result: `git pull --ff-only` returned `Already up to date.`
- Current HEAD after pull: `713763a Trigger Vercel deployment`
- Local and remote were aligned: `git rev-list --left-right --count HEAD...origin/main` returned `0 0`

### Current web application structure

The app is not a Next.js or React build project. It is a static HTML plus vanilla JavaScript module app served by a small Node API server.

- `index.html` loads `app.mjs`: public patient questionnaire.
- `admin.html` loads `admin.mjs`: admin login, DB import/export, record editing, risk and prediction dashboard.
- `clinician.html` loads `clinician.mjs`: clinician measurement entry. Requires admin session.
- `sensor.html` loads `sensor.mjs`: sensor feature entry and CSV upload. Requires admin session.
- All pages share `styles.css` and `runtime-config.js`.
- `runtime-config.js` sets `window.WIREGENE_REMOTE_API_BASE` to `/api` by default.
- `server.mjs` serves static files and the Node API.
- `storage.mjs` prefers the remote API when available and falls back to browser `localStorage`.
- `auth.mjs` supports server-session admin auth and a static demo fallback.
- `models.mjs` contains rule-based risk and prediction summary logic.

### API and storage shape

The Node server exposes these main endpoints:

- `GET /api/health`
- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/records`
- `POST /api/records`
- `GET /api/records/:recordId`
- `PUT /api/records/:recordId`
- `DELETE /api/records/:recordId`
- `GET /api/database/export`
- `POST /api/database/import`

The current local run had no `.env`, so `/api/health` reported:

- `ok: true`
- `auth.kind: server-session`
- `storage.kind: local`
- detail: missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`, therefore local fallback mode.

### Verification performed

- `npm run check`: passed.
- Local server: `npm run start`
- Local health URL: `http://127.0.0.1:3000/api/health`
- Static assets checked with HTTP 200:
  - `/`
  - `/admin.html`
  - `/clinician.html`
  - `/sensor.html`
  - `/styles.css?v=20260511a`
  - `/app.mjs?v=20260511a`
  - `/admin.mjs?v=20260511a`
  - `/clinician.mjs?v=20260511a`
  - `/sensor.mjs?v=20260511a`

Browser-rendered page checks:

- Patient page rendered a 13-step questionnaire starting with `당뇨발 위험평가연구 문진`.
- Admin page rendered the login screen before authentication.
- Clinician page rendered an admin-session-required screen before authentication.
- Sensor page rendered an admin-session-required screen before authentication.
- After local demo admin login, the admin workspace rendered with 0 records and a new record draft form.
- After the same login, clinician page rendered the demo clinician measurement entry form.
- After the same login, sensor page rendered the demo sensor input form with CSV upload support.
- Browser console error count during the verified checks: 0.

### Deployment notes already present in repo

`DEPLOY_PUBLIC.md` documents three deployment shapes:

- GitHub Pages: static demo only.
- Render + Supabase: full central DB and server-session version.
- GitHub Pages + Render + Supabase: GitHub Pages as public frontend with Render as remote API.

For a real central DB run, configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `CORS_ALLOWED_ORIGINS`

### Next recommended work

1. Decide target runtime: GitHub Pages static demo, Render + Supabase, Synology-hosted Node server, or a hybrid.
2. If Synology deployment is needed, add a repository script and DSM Task Scheduler command instead of relying on manual shell steps.
3. If this is moving toward real clinical use, replace the demo single-admin password flow with proper user and role management.
4. Separate clinical/patient data storage policy before entering real patient information.
5. Add an operational version label visible in the UI before the next functional deployment.
