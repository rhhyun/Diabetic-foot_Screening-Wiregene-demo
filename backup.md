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

## 2026-07-07 patent application guideline note

### Work completed

- Added `patent_application_guideline.txt` for patent attorney review.
- The document is a concise Korean technical disclosure guide, not a legal opinion.
- It summarizes the invention candidate as a multi-input diabetic-foot risk screening and management workflow.
- It highlights patient questionnaire, clinician measurements, sensor/time-series features, rule-fusion signals, endpoint-specific risk scoring, data completeness, and recommended action output.
- It asks the patent attorney to review novelty, inventive step, publication/public-disclosure impact, software claim type, medical workflow boundaries, and filing strategy.

### Version

- Updated package version from `0.2.0` to `0.2.1` for this documentation handoff.

### References checked

- KIPO/MOIP computer-related invention guidance.
- KIPO/MOIP PCT invention-description structure guidance.
- KIPO/MOIP patent application examination manual section on specification contents.

### Google Drive handoff status

- Attempted to upload `patent_application_guideline.txt` to Google Drive as a raw `text/plain` file.
- Upload was blocked by Google Drive API permissions: `403 Forbidden`, `ACCESS_TOKEN_SCOPE_INSUFFICIENT`, `DriveFiles.Create`.
- Do not retry the same connector upload until Google Drive write/create scope is re-authorized.

## 2026-07-18 Synology finite-deployment standard v0.2.3

### Audit outcome

- The repository previously had no Dockerfile, Compose file, DSM script, lock,
  timeout, log rotation, container CI, or rollback contract.
- The actual command saved in DSM is external to Git and could not be inspected
  from this workstation. The DSM operator must record and disable the old task
  before enabling the new one.
- `node server.mjs` and `npm run start` are foreground web servers. They are now
  allowed only as the container command and are explicitly forbidden in DSM Task
  Scheduler.
- No Docker prune, volume deletion, worker, queue, or migration task was present.
  The new path also contains none of those operations.
- Existing user work in `patent_application_guideline.txt` was preserved and is
  intentionally outside this deployment change.

### Implemented deployment boundary

- Version: `0.2.3`
- Working branch: `agent/synology-deploy-safety`
- Draft pull request: `https://github.com/rhhyun/Diabetic-foot_Screening-Wiregene-demo/pull/1`
- GitHub Actions `Publish Synology Container` and all Vercel pull-request checks
  passed on 2026-07-18. The CI run built the `linux/amd64` image, reached Docker
  healthy state, and confirmed a bounded graceful stop with container exit code 0.
- The pull request remains intentionally unmerged. GHCR production tags are only
  published from `main`, so the NAS deploy must wait for review, merge, image
  publication, repository synchronization, and the site-specific `site.env` setup.
- `Dockerfile`: non-root Node 22 runtime, `linux/amd64` CI target, built-in healthcheck,
  dependency installation inside external CI image build, and graceful `SIGTERM`
  handling through `server.mjs`.
- `docker-compose.synology.yml`: image-only service, loopback port, read-only root,
  `restart: unless-stopped`, Docker healthcheck, and `json-file` rotation at
  `10m` x 3.
- `deploy/synology/common-deploy.sh`: reusable lock/trap/deadline/PATH/log/rollback/
  health engine shared across Wiregene sites.
- `deploy/synology/emergency-diagnose.sh`: scheduler-independent, read-only
  stdout-only incident collector with a 60-second soft limit and five-second kill
  grace for Task ID/PID/type, disk/inode, scheduler-log match counts, lock, and
  Docker-state triage. It writes no file, does not print raw process arguments,
  redacts task Command values, and queries at most three discovered running IDs.
- `deploy/synology/site.env.example`: the only site-specific values are app name,
  NAS path, image, port, health URL, environment file, and required environment names.
- `.github/workflows/publish-container.yml`: GitHub Actions validates, builds, and
  publishes `main`, `0.2.3`, and immutable commit-SHA GHCR tags. The NAS only pulls
  and starts the image detached.
- `scripts/validate-synology-deploy.mjs`: rejects NAS builds, attached server/log
  commands, dangerous cleanup commands, missing log rotation, or expansion of the
  site-variable boundary.
- `DEPLOYMENT.md`: authoritative before/after comparison, migration, scheduler,
  rollback, verification, and forbidden-operation guide.

### 2026-07-18 live DSM scheduler incident

- The user reported that DSM Task Scheduler could no longer save new commands
  after repeated Wiregene task executions. No new repository deploy script had
  been merged, published, synchronized, or run on the NAS, so version 0.2.2 was
  not the cause of the already-running state.
- The attached GitHub email referred to old commit `bcaf85c`. Its version-output
  quoting failure was fixed by `d548daa`; current PR head `73ff494` and its
  `linux/amd64` container checks were successful before this incident update.
- `wiregene.com:22` was reachable and identified as `OpenSSH_5.3`, but this
  workstation's non-interactive key authentication was rejected. No NAS command,
  process termination, service restart, scheduler mutation, Docker mutation, or
  reboot was performed.
- The immediate safe boundary is read-only host SSH diagnosis. Generic shell,
  `synoschedtask`, cron, Docker, Compose, or Node termination is forbidden until
  the exact Task ID, PID, PPID, and redacted command are captured.
- Synology documents that DSM 7.2.1-69057 Update 2 could prevent Task Scheduler
  create/edit operations and says it was fixed in Update 3. The NAS version must
  be captured before deciding whether this is a live process or DSM maintenance
  issue.

### Production safety behavior

- An atomic cross-checkout lock under `/volumeN/docker/.wiregene-deploy-locks`
  rejects initializing or active runs with exit 75. PID, Linux start fingerprint,
  config path, and command identity prevent PID-reuse and lock-ownership mistakes.
- Exit/HUP/INT/TERM traps remove the lock; an outer kill-capable timeout prevents
  DSM from retaining an indefinitely running task.
- The normal deploy deadline is 12 minutes, with a reserved rollback window and a
  15-minute inner ceiling. The DSM entrypoint has an additional finite outer guard.
- The current running image is retagged locally before pull/up. A failed start or
  health check attempts automatic restoration without `down`, prune, or volume deletion.
- Docker liveness uses `/api/health`; deployment readiness uses `/api/ready`, which
  performs an eight-second, cached Supabase single-row or Google Drive metadata
  probe without downloading the full production database.
- Deploy logs rotate in `.deploy/logs`; Docker logs use `10m` and three files.
- Timed commands run in a tracked process group. Signal cleanup sends TERM, waits
  for a bounded period, sends KILL if necessary, waits for the child, and scans
  `/proc` for remaining Compose processes before reporting success.
- The first migration from an externally managed container must use an unused
  loopback port and reverse-proxy cutover only after health verification, so the
  current production container remains untouched.

### NAS operator handoff

After this branch is merged and the repository is synchronized to the NAS, copy
`deploy/synology/site.env.example` to the ignored `site.env`, confirm the actual
port/storage environment, then use DSM `Control Panel -> Task Scheduler ->
User-defined script` as root. Keep the task manual-only.

Final deploy command:

```sh
/bin/sh /volume1/docker/diabetic-foot-screening/repo/deploy/synology/deploy.sh deploy
```

Rollback command:

```sh
/bin/sh /volume1/docker/diabetic-foot-screening/repo/deploy/synology/deploy.sh rollback
```

Verification command:

```sh
/bin/sh /volume1/docker/diabetic-foot-screening/repo/deploy/synology/deploy.sh verify
```

### Remaining live boundary

- Live read-only verification on 2026-07-18 found `dmfoot.wiregene.com` resolving
  to `76.76.21.21`, returning `Server: Vercel`, HTTP 200, and Google Drive remote
  storage from `/api/health`. The current public service is therefore not yet the
  new Synology container and was not interrupted.
- No command was run on the DS918+ from this workstation, so current task state,
  Container Manager version, port ownership, reverse-proxy target, and live data
  backend remain unverified.
- Do not run the new deploy task until the GHCR workflow has succeeded on `main`,
  `site.env` and the production `.env` are present, and the first-deploy port is
  confirmed unused.
- The exact runtime checklist and bounded log locations are in `DEPLOYMENT.md`.

### Local validation completed

- `npm ci`: passed, 0 vulnerabilities.
- `npm run check`: passed.
- `npm run check:deploy`: passed.
- `npm run test:readiness`: passed for Supabase single-row, Google Drive known-file,
  and Google Drive read-only file-discovery paths with shared timeout signals.
- `npm run build`: passed, 14 static files prepared.
- `bash -n deploy/synology/deploy.sh`: passed through Git for Windows Bash.
- `bash -n deploy/synology/common-deploy.sh`: passed through Git for Windows Bash.
- Compose and GitHub workflow YAML parsing: passed.
- `git diff --check`: passed.
- Local `/api/health`: HTTP 200 with `version=0.2.3`.
- Local `/api/ready` without remote storage: expected HTTP 503, confirming a
  misconfigured local fallback cannot pass deployment readiness.
- Docker CLI is unavailable on this workstation. The pull request workflow is
  therefore responsible for real `linux/amd64` image build, container health,
  zero-exit graceful stop, and Compose config verification before any image tag
  can be published to GHCR.
