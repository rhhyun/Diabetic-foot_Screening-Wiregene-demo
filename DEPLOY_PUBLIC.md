# Public Deployment Guide

This project has three practical deployment shapes.

- `GitHub Pages`: static demo only
- `Render + Supabase`: full evaluation version with central DB and server session login
- `GitHub Pages + Render + Supabase`: same public Pages URL, with Render used as the remote API server

If outside evaluators need to use the existing GitHub Pages address and still save to a central DB, use `GitHub Pages + Render + Supabase`.

## 1. Prepare Supabase

1. Sign in to [Supabase](https://supabase.com/).
2. Create a new project.
3. Open `SQL Editor`.
4. Paste the full contents of [supabase-schema.sql](/C:/dev/Diabetic-foot_Screening-Wiregene-demo/supabase-schema.sql).
5. Run the SQL.

After that, collect these two values from `Project Settings` -> `API`.

- `Project URL`
- `service_role` key

## 2. Prepare Render

1. Sign in to [Render](https://render.com/).
2. Click `New` -> `Blueprint`.
3. Connect the GitHub repository that contains this project.
4. Select the repository root that contains [render.yaml](/C:/dev/Diabetic-foot_Screening-Wiregene-demo/render.yaml).
5. Continue with the default web service definition.

Render reads these settings from [render.yaml](/C:/dev/Diabetic-foot_Screening-Wiregene-demo/render.yaml).

- Runtime: `node`
- Build command: `npm install`
- Start command: `node server.mjs`
- Health check: `/api/health`
- Public web service URL: `https://<service-name>.onrender.com`

## 3. Enter environment variables

During the initial Blueprint setup, Render prompts you for the variables marked with `sync: false`.

Set them like this:

- `ADMIN_USERNAME`: your admin login ID
- `ADMIN_PASSWORD`: your admin login password
- `SUPABASE_URL`: your Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: your Supabase `service_role` key

These values are already defined in [render.yaml](/C:/dev/Diabetic-foot_Screening-Wiregene-demo/render.yaml) or can be adjusted later in the Render dashboard.

- `HOST=0.0.0.0`
- `PORT=10000`
- `ADMIN_DISPLAY_NAME=Wiregene Demo Admin`
- `SESSION_TTL_HOURS=12`
- `CORS_ALLOWED_ORIGINS=https://rhhyun.github.io`

## 4. Keep the GitHub Pages address

If you want the existing public address

- `https://rhhyun.github.io/Diabetic-foot_Screening-Wiregene-demo/`

to remain the entry point, keep GitHub Pages enabled and make it call the Render API.

In the GitHub repository settings:

1. Open `Settings` -> `Secrets and variables` -> `Actions`.
2. Open the `Variables` tab.
3. Add a repository variable named `PAGES_REMOTE_API_BASE`.
4. Set its value to your Render API base URL.

Example:

- `https://wiregene-diabetic-foot-demo.onrender.com/api`

Then re-run the GitHub Pages workflow. The deployed Pages site will write that value into `runtime-config.js` during deployment.

## 5. Deploy and test

When the first deployment finishes, open:

- `https://rhhyun.github.io/Diabetic-foot_Screening-Wiregene-demo/`
- `https://<service-name>.onrender.com/`
- `https://<service-name>.onrender.com/admin.html`
- `https://<service-name>.onrender.com/clinician.html`
- `https://<service-name>.onrender.com/sensor.html`
- `https://<service-name>.onrender.com/api/health`

Expected health response:

- `"ok": true`
- `"storage.kind": "remote"` when Supabase is connected
- `"authenticated": false` on first load until admin login

## 6. What to give evaluators

For outside evaluation, share:

- Main URL: `https://rhhyun.github.io/Diabetic-foot_Screening-Wiregene-demo/`
- Admin URL: `https://rhhyun.github.io/Diabetic-foot_Screening-Wiregene-demo/admin.html`
- Test admin ID/password
- Short note that the UI is hosted on GitHub Pages and records are stored through the Render API into Supabase

## 7. Important operational notes

- GitHub Pages is static-only, so it cannot run this Node API server.
- GitHub Pages can still be used as the visible public address if it calls a separate Render API server.
- Render free web services can spin down after 15 minutes of no traffic and may take about 1 minute to wake up again.
- For a smoother formal evaluation, a paid Render instance is safer than the free tier.
- Admin sessions are currently stored in server memory, so a deploy or restart logs the admin out.
- Patient data stays in Supabase even if the Render service restarts.

## 8. Recommended evaluation setup

Use this combination for evaluation:

- Public frontend URL: GitHub Pages
- API hosting: Render web service
- Central database: Supabase

## 9. Quick troubleshooting

If `api/health` shows `"storage.kind": "local"`:

- `SUPABASE_URL` is missing, or
- `SUPABASE_SERVICE_ROLE_KEY` is missing, or
- the Render service was not redeployed after updating env vars

If the GitHub Pages site opens but cannot log in:

- confirm `PAGES_REMOTE_API_BASE` points to `https://<service-name>.onrender.com/api`
- confirm Render has `CORS_ALLOWED_ORIGINS=https://rhhyun.github.io`
- confirm the Render service is awake and `https://<service-name>.onrender.com/api/health` opens

If admin login works locally but not on Render:

- check `ADMIN_USERNAME`
- check `ADMIN_PASSWORD`
- redeploy after saving env vars

If the page opens but record list is empty:

- confirm the SQL in [supabase-schema.sql](/C:/dev/Diabetic-foot_Screening-Wiregene-demo/supabase-schema.sql) ran successfully
- confirm `api/health` reports `"storage.kind": "remote"`
