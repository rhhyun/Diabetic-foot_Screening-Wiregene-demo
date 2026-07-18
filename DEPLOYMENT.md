# Synology NAS Deployment Standard

Version: `0.2.2`

Target NAS: Synology DS918+ (`linux/amd64`)

Target site: `dmfoot.wiregene.com`

This document is the authoritative deployment path for this repository. The DSM
Task Scheduler must run the finite deployment script; it must never run the Node
server, a log follower, or an attached Compose process directly.

## Audit result

Before version `0.2.2`, the repository had no Dockerfile, Compose file, Synology
script, lock, timeout, log rotation, image CI, rollback, or DSM command. The only
foreground server commands were `node server.mjs` and `npm run start`. Those are
valid as a container's main process but never terminate when entered directly in
Task Scheduler.

The actual command currently saved in DSM is outside this Git repository and
could not be inspected from this workstation. Before enabling the new task, open
`Control Panel -> Task Scheduler`, inspect every task for this site, and disable
any task that runs one of the following:

- `node server.mjs`, `npm start`, `npm run dev`, or `next dev`
- `docker compose up` without `-d`
- `docker logs -f` or `tail -f`
- `npm install`, `npm run build`, or `docker compose build` on the NAS
- a deploy task scheduled every minute or another short recurring interval

Do not delete the old task until its command and schedule have been recorded.
Disable it first so rollback information is preserved.

## Before and after

| Area | Before `0.2.2` | After `0.2.2` |
|---|---|---|
| Image build | No container pipeline | GitHub Actions builds `linux/amd64` and pushes GHCR |
| NAS work | Unspecified | Image `pull` plus detached `up` only; `--no-build` enforced |
| Scheduler lifetime | Could run a foreground server forever | Inner 15-minute deadline plus outer finite timeout |
| Duplicate runs | No protection | Atomic directory lock with PID and stale-lock recovery |
| Interrupted run | No cleanup | `HUP`, `INT`, `TERM`, and normal exit traps release the lock |
| Failure | No rollback contract | Previous running image is retagged locally and restored on failure |
| Docker logs | Unlimited defaults | `json-file`, `max-size: 10m`, `max-file: 3` |
| Deploy logs | Undefined | `.deploy/logs/deploy.log`, rotated at 10 MiB, three archives |
| Restart | Undefined | `unless-stopped`; no unbounded `restart: always` crash loop policy |
| Health | HTTP route only | Docker healthcheck plus post-deploy HTTP verification |
| Data | External Supabase/Google Drive | No volume deletion, `down`, or prune operations added |
| Long jobs | No worker/migration found | Kept outside the deploy task by policy |

## Reusable Wiregene boundary

The common engine is `deploy/synology/common-deploy.sh`. Do not fork its lock,
timeout, pull/up, rollback, logging, or health logic per site. A site's
`deploy/synology/site.env` may define only these values:

| Variable | Site-specific meaning |
|---|---|
| `APP_NAME` | Lowercase Compose project and lock namespace |
| `APP_DIR` | Absolute repository path on the NAS |
| `APP_IMAGE` | GHCR image and desired tag |
| `APP_PORT` | Loopback host port used by DSM reverse proxy |
| `HEALTH_URL` | Post-deploy health URL, preferably loopback |
| `APP_ENV_FILE` | Absolute production secret/environment file path |
| `REQUIRED_ENV_VARS` | Environment names that must be nonempty for this site |

Copy the committed example once:

```sh
cp /volume1/docker/diabetic-foot-screening/repo/deploy/synology/site.env.example /volume1/docker/diabetic-foot-screening/repo/deploy/synology/site.env
```

Edit `site.env` for the actual reverse-proxy port and storage backend. It is
ignored by Git. The example requires Supabase. For Google Drive storage, replace
the two Supabase names in `REQUIRED_ENV_VARS` with
`GOOGLE_DRIVE_CLIENT_ID GOOGLE_DRIVE_CLIENT_SECRET GOOGLE_DRIVE_REFRESH_TOKEN`.

The production file referenced by `APP_ENV_FILE` must be outside the image and
must not contain the committed demo password or placeholder secret. The deploy
script rejects missing, duplicate, quoted-empty, placeholder, and known demo
values before it touches a container.

The lock is derived from `APP_NAME`, not the checkout path, and lives at
`/volumeN/docker/.wiregene-deploy-locks/<APP_NAME>.lock`. Old and new checkouts
therefore cannot deploy the same Compose project concurrently. Lock ownership is
validated with PID, Linux process start fingerprint, config path, and command
identity before a stale lock is reclaimed or removed.

## CI-built image

`.github/workflows/publish-container.yml` runs on `main`. It validates the Node
sources and deployment contract, creates the static build outside the NAS, then
builds and publishes these GHCR tags:

- `ghcr.io/rhhyun/diabetic-foot-screening-wiregene-demo:main`
- `ghcr.io/rhhyun/diabetic-foot-screening-wiregene-demo:0.2.2`
- `ghcr.io/rhhyun/diabetic-foot-screening-wiregene-demo:sha-<full-commit>`

For the strongest production reproducibility, put an immutable `sha-...` tag in
`site.env`. The committed example deliberately contains a replacement marker and
the deploy script refuses to run until it is changed to a real published tag. A
`main` or version tag is convenient but mutable.

If the GHCR package is public, the NAS can pull it anonymously. If it remains
private, authenticate once with a classic GitHub token limited to
`read:packages`; never store that token in this repository or in Task Scheduler
output.

## First migration without downtime

As verified from this workstation on 2026-07-18, `dmfoot.wiregene.com` currently
resolves to Vercel (`76.76.21.21`) and returns HTTP 200 with Google Drive remote
storage. It is not currently serving from the NAS. This makes a parallel NAS
first deployment possible without interrupting the live Vercel service.

The script can automatically roll back only after it finds an existing `app`
container in the same Compose project. If the current production container was
started manually or under a different project, do the first deployment on an
unused loopback port (the example uses `8300`), verify it, and only then change
the DSM reverse proxy for `dmfoot.wiregene.com` to that port. Keep the old
container untouched until the public endpoint has been verified.

The Compose file has no local database volume. Patient/research data remains in
the configured Supabase or Google Drive backend. A container replacement logs
out in-memory admin sessions but does not delete remote records.

## DSM Task Scheduler

Use a `User-defined script` task running as `root`. Set it to manual execution
only. Container Manager's `unless-stopped` policy handles NAS reboots; do not run
the deploy task every minute or use it as a process supervisor.

Final Task Scheduler command (one line):

```sh
/bin/sh /volume1/docker/diabetic-foot-screening/repo/deploy/synology/deploy.sh deploy
```

The entrypoint finds Docker, curl, timeout, and `setsid` through fixed Synology-safe paths
and a restricted `command -v` fallback. It refuses to run if a kill-capable
`timeout`, process-group-capable `setsid`, or Docker Compose v2 is unavailable.

## What one deploy does

1. Acquires an atomic cross-checkout lock and rejects an initializing or live
   deployment with exit code 75; only proven-stale ownership is reclaimed.
2. Rotates the bounded deploy log and validates site/env/Compose policy.
3. Checks Docker and Compose under finite per-command timeouts.
4. Tags the currently running image as `wiregene-local/<app>:previous`.
5. Runs `docker compose pull app`.
6. Runs `docker compose up -d --remove-orphans --no-build`.
7. Waits for Docker `healthy`, verifies readiness, image reference/version, and
   scans shell jobs plus `/proc` for remaining Compose processes.
8. Records image/container IDs in `.deploy/last-success.env` and removes the lock.

If step 6 or 7 fails or the task receives a termination signal, the exit trap
terminates and waits for the active timeout/process group before attempting to
restore the preserved image. It never runs `down` or deletes a volume. Every
command failure returns a non-zero task result.

## Rollback

Rollback command (one line):

```sh
/bin/sh /volume1/docker/diabetic-foot-screening/repo/deploy/synology/deploy.sh rollback
```

This uses the bounded local `previous` tag recorded immediately before the most
recent deployment. For a longer rollback window, set `APP_IMAGE` in `site.env`
to a known immutable `sha-...` GHCR tag and run the normal `deploy` action.

## Verification

Repository-managed runtime verification (one line):

```sh
/bin/sh /volume1/docker/diabetic-foot-screening/repo/deploy/synology/deploy.sh verify
```

Read the bounded deploy log without starting a follower:

```sh
tail -n 200 /volume1/docker/diabetic-foot-screening/repo/.deploy/logs/deploy.log
```

Direct Docker and local readiness checks:

```sh
/usr/local/bin/docker compose --env-file /volume1/docker/diabetic-foot-screening/repo/deploy/synology/site.env -p wiregene-diabetic-foot -f /volume1/docker/diabetic-foot-screening/repo/docker-compose.synology.yml ps
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:8300/api/ready
```

After the DSM reverse proxy points to the verified port, also check:

```sh
curl --fail --silent --show-error --max-time 15 https://dmfoot.wiregene.com/api/ready
```

Expected JSON includes `"ok":true`, `"version":"0.2.2"`, and a remote storage
description. Docker checks `/api/health` as a process liveness probe; deployment
success uses `/api/ready`, which performs a bounded remote repository metadata or
single-row probe. The probe has an eight-second upstream timeout, deduplicates
concurrent requests, caches success for 30 seconds, and throttles repeated
failures for five seconds; it never downloads the full production database.

## Explicitly forbidden operations

The deployment scripts do not and must not contain:

- `docker system prune -a` or any volume prune
- `docker compose down`, especially `down -v`
- wildcard container deletion
- NAS-side `npm install`, `npm run build`, or `docker compose build`
- foreground log following or server processes
- worker, queue, data migration, or other long-running batch work

Run database schema changes as a separately reviewed, separately locked task
with its own backup and rollback plan. No migration is part of this deployment.
