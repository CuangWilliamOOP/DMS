# Deployment Notes — Staging + Production (Oct 2025, updated Jan 2026)
This updates and complements the existing deployment doc. It captures fixes we applied during the 2025‑10 incident (media not serving, cache issues, wrong Python package), and standardizes Nginx + systemd so a fresh VPS reproduces the working state quickly.

## Table of Contents
- [Update (Jan 2026): Production domain enabled (keep staging)](#update-jan-2026-production-domain-enabled-keep-staging)
- [0) Quick checklist for a fresh VPS](#0-quick-checklist-for-a-fresh-vps)
- [1) Canonical Nginx site (HTTPS)](#1-canonical-nginx-site-https)
  - [1.1 Cache behavior](#11-cache-behavior)
  - [1.2 Single TLS vhost rule](#12-single-tls-vhost-rule)
- [2) Environment file /etc/dms.env (staging template)](#2-environment-file-etcdmsenv-staging-template)
- [3) Gunicorn systemd unit](#3-gunicorn-systemd-unit)
- [4) Frontend build & deploy](#4-frontend-build--deploy)
- [5) Verifications](#5-verifications)
- [6) One‑command deploy script](#6-onecommand-deploy-script)
- [7) Infra in Git (repeatable setup)](#7-infra-in-git-repeatable-setup)
- [8) Troubleshooting quick refs](#8-troubleshooting-quick-refs)
- [Appendix A — Python packages](#appendix-a--python-packages)
- [Appendix B — Minimal health checks](#appendix-b--minimal-health-checks)
- [DMS Guide — Async parsing & Redis progress (Oct 2025)](#dms-guide--async-parsing--redis-progress-oct-2025)

## Summary

We moved parsing off the web tier and added a determinate progress UI.

## Update (Jan 2026): Production domain enabled (keep staging)

We enabled production on the **same VPS** while keeping staging online.

**DNS (Exabytes):**
- `@` (root) **A** → `<VPS_IP>`
- `www` **CNAME** → `caw-dms.com`
- `staging` **A** → `<VPS_IP>`

**Nginx:**
- Staging vhost: `/etc/nginx/sites-available/dms` (`server_name staging.caw-dms.com`)
- Prod vhost: `/etc/nginx/sites-available/dms-prod` (`server_name caw-dms.com www.caw-dms.com`)
- Both proxy `/api/` → `http://127.0.0.1:8000` and serve `/media/` via `alias` **before** the SPA fallback.

**TLS:**
```bash
sudo certbot --nginx -d caw-dms.com -d www.caw-dms.com --redirect --agree-tos -m <email> -n
```

**Env (/etc/dms.env):** add production domains, then restart:
```bash
sudo systemctl restart dms
```

**Common pitfall:** `502` on prod `/api/` happens if Nginx proxies to the wrong port (was mistakenly `8001`). Always confirm:
```bash
sudo ss -tlnp | egrep ":8000|:8001"
sudo tail -n 50 /var/log/nginx/error.log
```

**Optional UI:** show a staging decommission warning dialog/banner when the hostname is `staging.caw-dms.com` (link users to `caw-dms.com`).


## New/changed environment

```

## Request flow

1. **POST** `/api/parse-and-store/` with `X-Job-ID` and file ⇒ HTTP **202** `{ job_id }`.

## Progress semantics

* **0–20%**: parse table + build items.

## Deploy steps

```

## Scaling

* Web: `gunicorn ... --workers 3 --worker-class gthread --threads 8`.

## Troubleshooting

* **Progress stuck at 1%**: ensure Gunicorn uses `gthread`; confirm Celery running; check Redis `PING`.

## Rollback

* Stop Celery: `sudo systemctl stop dms-celery`.

## Changelog snippet (Oct 2025)

* Add Celery async pipeline and Redis progress store.

0) Quick checklist for a fresh VPS
Point DNS staging.caw-dms.com and caw-dms.com/www.caw-dms.com → VPS IP.
Install: git python3-venv python3-pip nginx nodejs npm certbot python3-certbot-nginx apache2-utils build-essential.
Create /srv/dms/app, clone repo, create and activate venv.
pip install -r backend/requirements.txt (ensure PyMuPDF is installed; see Appendix A).
Create /etc/dms.env with real values (see Section 2) and chmod 640; chown root:dms.
python manage.py migrate && python manage.py collectstatic --noinput.
Build frontend → npm run build → rsync build/ → /var/www/dms-frontend/.
Install dms.service (Gunicorn), enable and start it.
Install Nginx site (includes /media/, /api/, and SPA fallback in the right order), test and reload.
Issue TLS with Certbot. Verify.
1) Canonical Nginx site (HTTPS)
Staging: put this at /etc/nginx/sites-available/dms, symlink to sites-enabled.
Production: create a second vhost /etc/nginx/sites-available/dms-prod with server_name caw-dms.com www.caw-dms.com (same locations, same upstream).

server {
    listen 80;
    server_name staging.caw-dms.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.caw-dms.com;

    # React build
    root  /var/www/dms-frontend;
    index index.html;

    # 1) MEDIA must take precedence over SPA fallback
    location ^~ /media/ {
        alias /srv/dms/app/backend/media/;
        try_files $uri =404;
    }

    # 2) API → Gunicorn (timeouts sized for long parses)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host               $host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 25m;
    }

    # 3) SPA fallback (last)
    location / { try_files $uri /index.html; }

    # TLS (managed by Certbot once issued)
    ssl_certificate     /etc/letsencrypt/live/staging.caw-dms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.caw-dms.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
1.1 Cache behavior
Prevent stale HTML: add add_header Cache-Control "no-store, must-revalidate" always; inside location / if the browser keeps old bundles.
Cache static assets hard: serve /static/ and CRA build assets with Cache-Control: public, max-age=31536000, immutable.
Example blocks:

location /static/ { alias /var/www/dms-frontend/static/; add_header Cache-Control "public, max-age=31536000, immutable" always; }
location = /index.html { add_header Cache-Control "no-store, must-revalidate" always; }
1.2 Single TLS vhost rule
Ensure only one active server { listen 443 … server_name staging.caw-dms.com; } exists. Duplicate vhosts cause the SPA to capture /media/ and return index.html.

2) Environment file /etc/dms.env (staging template)
# Django
DJANGO_SETTINGS_MODULE=backend.settings
DJANGO_SECRET_KEY=<strong-random-secret>
DJANGO_ALLOWED_HOSTS=staging.caw-dms.com,caw-dms.com,www.caw-dms.com,127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=https://staging.caw-dms.com,https://caw-dms.com,https://www.caw-dms.com
DJANGO_HSTS_SECONDS=1209600

# Database (Supabase Postgres)
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<secret>
DB_HOST=<project>.supabase.co
DB_PORT=5432

# Optional: Sentry, etc.
# SENTRY_DSN=

# OpenAI and other keys live here only; never in repo
# OPENAI_API_KEY=<secret>
Load env for ad‑hoc Django commands: set -a; source /etc/dms.env; set +a

3) Gunicorn systemd unit
/etc/systemd/system/dms.service:

[Unit]
Description=DMS Django via Gunicorn
After=network.target

[Service]
User=dms
Group=www-data
WorkingDirectory=/srv/dms/app/backend
EnvironmentFile=/etc/dms.env
ExecStart=/srv/dms/app/.venv/bin/gunicorn backend.wsgi:application \
  --workers 3 --bind 127.0.0.1:8000 --timeout 600 --access-logfile - --error-logfile -
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
Commands:

sudo systemctl daemon-reload
sudo systemctl enable --now dms
sudo systemctl status dms --no-pager
4) Frontend build & deploy
cd /srv/dms/app/dms-frontend
npm install
npm run build
sudo rsync -a --delete build/ /var/www/dms-frontend/
sudo systemctl reload nginx
API base URL: same‑origin /api in staging/production. Override with REACT_APP_API_BASE_URL if needed.

Login refresh tip: after login, prefer window.location.replace('/home?v='+Date.now()) to avoid stale bundles.

5) Verifications
Media path: pick a real file and confirm MIME type is image/pdf, not text/html.

FILE=$(find /srv/dms/app/backend/media -type f \( -name '*.pdf' -o -name '*.jpg' -o -name '*.png' \) | head -1)
URL="/media${FILE#/srv/dms/app/backend/media}"
curl -I "https://staging.caw-dms.com$URL"
API: curl -I https://staging.caw-dms.com/api/ should return 301/405 from Django, not Nginx 404.

Service: journalctl -u dms -f while hitting endpoints.

6) One‑command deploy script
/srv/dms/deploy.sh (committed in scripts/): pulls, installs backend deps, migrates, builds frontend, rsyncs, restarts Gunicorn and reloads Nginx.

Usage:

ssh dms@<VPS_IP>
/srv/dms/deploy.sh
7) Infra in Git (repeatable setup)
Track configs in the repo and apply with a script:

infra/
  nginx/
    dms.conf          # full site config (this doc’s Nginx)
  systemd/
    dms.service       # unit above
  env/
    .env.example      # placeholders only
scripts/
  apply-configs.sh    # copies infra → /etc, tests, reloads
Do not commit: real /etc/dms.env, TLS keys/certs, or .htpasswd.

8) Troubleshooting quick refs
/media returns text/html → /media missing or overshadowed by SPA fallback. Ensure the /media/ block exists inside the active TLS server and appears before location /.
504 / long parses → raise Gunicorn --timeout and Nginx proxy_read_timeout as above.
CSRF or SECRET_KEY errors → run management commands with env loaded; ensure /etc/dms.env is present.
Static not updating → rebuild, rsync, and reload Nginx; consider no‑store on index.html.
Appendix A — Python packages
Use PyMuPDF to provide the fitz module. Do not install the fitz stub from PyPI.

pip uninstall -y fitz
pip install PyMuPDF==1.23.17
python -c "import fitz; print(fitz.__doc__[:40])"  # sanity check
Appendix B — Minimal health checks
Add /api/health/ Django view that returns 200 JSON. Point uptime monitor at / and /api/health/.
Keep this file authoritative. If you tweak live configs or timeouts, reflect them here and commit under infra/ for full reproducibility.


# DMS Guide — Async parsing & Redis progress (Oct 2025)

## Summary

We moved parsing off the web tier and added a determinate progress UI.



* **Frontend:** determinate circular progress, polls `/api/progress/<job_id>/`, accepts **202** from `/api/parse-and-store/`.
* **Backend:** Celery worker executes parsing; progress stored in Redis with TTL; web view enqueues and returns.
* **Infra:** Threaded Gunicorn for concurrent GET/POST; new `dms-celery` systemd unit; infra configs committed.

## New/changed environment

```
REDIS_URL=redis://127.0.0.1:6379/0
CELERY_BROKER_URL=${REDIS_URL}
CELERY_RESULT_BACKEND=${REDIS_URL}
DJANGO_ALLOWED_HOSTS=staging.caw-dms.com,43.229.85.46,localhost,127.0.0.1
```

## File changes (by path)

### Backend

* `backend/settings.py`

  * Add `REDIS_URL` and `CACHES['default']` via `django-redis`.
* `backend/celery.py` (new)

  * Celery app bootstrap, imports `backend.tasks`, timezone `Asia/Jakarta`, soft/hard time limits.
* `backend/__init__.py` (new)

  * Exposes `celery_app` for Django import side‑effects.
* `backend/tasks.py`

  * `@shared_task(name="parse_job", queue="parse")` calls `_parse_and_store_core(...)` and cleans temp file.
* `documents/views.py`
  * Marker detection & OCR improvements (Nov 2025)
    - Purpose: make ALPHA/BETA corner marker detection faster, cheaper, and more deterministic.
    - Behavior changes (views.py):
      - Probe only the first supporting page (fast text) to decide marker mode; fallback to original GPT per-page classifier if no markers.
      - While in an ALPHA-x counting group, stop running marker detection entirely and attach the next x-1 pages at disk speed.
      - For plain ALPHA (no numeric x) the default policy remains a single-page attachment; optionally enable open-ended grouping until BETA via env `ALPHA_PLAIN_POLICY=until_beta`.
      - Reuse a single rendered PNG per page for both OCR detection and preview image to avoid double renders.
    - OCR gating and budget (views.py):
      - OCR fallback is budgeted and tiny: `OCR_MARKER_BUDGET` (default 2) controls how many GPT OCR fallbacks are allowed per parse.
      - OCR fallback is only attempted in a small probe window (first two supporting pages) or at rare escalation points when using `until_beta` policy.
    - Local OCR attempt: try `pytesseract` first on the page PNG, then crop the top-right and call the GPT vision helper only if local OCR fails.
    - Implementation notes: detection helpers added — `_detect_marker_on_page` (fast text), `_detect_from_existing_png` (local OCR → GPT crop), and `_detect_marker_on_page_smart` (reduced-DPI render for one-off OCR).

  * Marker OCR helper changes (gpt_parser.py)
    - `gpt_detect_corner_marker(b64_image)` now uses a lighter default model and fewer tokens for the small crop to reduce latency and cost:
      - Default model via `OPENAI_MARKER_MODEL` or fallback `gpt-4o-mini`.
      - `max_tokens=30` for concise JSON responses.
    - `extract_json_from_markdown` improved to robustly extract JSON from markdown/code fences.
    - The `gpt_*` helpers remain as fallbacks for per-page classification and rekap detection.

  * Env vars introduced / used
    - `ALPHA_PLAIN_POLICY` = "one" (default) or "until_beta" — controls plain ALPHA behavior.
    - `OCR_MARKER_BUDGET` = 2 (default) — how many GPT OCR fallbacks are allowed per parse.
    - `OPENAI_MARKER_MODEL` — override the model used for corner-marker detection (defaults to `gpt-4o-mini`).

  * Testing notes
    - Test ALPHA-x PDFs: confirm only the ALPHA page triggers detection then the next x-1 pages attach without detection.
    - Test plain ALPHA default: ensure single-page attachment unless `ALPHA_PLAIN_POLICY=until_beta` is set.
    - Verify OCR budget behavior by setting `OCR_MARKER_BUDGET=0` to disable GPT OCR fallbacks.


  * **New** `progress_update(job_id, percent, stage, **extra)` using `django.core.cache.cache` with TTL (no in‑memory dict).
  * `@api_view(["GET"]) progress_view(job_id)` reads from Redis and returns JSON. `@never_cache` and `IsAuthenticated`.
  * `@api_view(["POST"]) parse_and_store_view` now:

    * Saves upload to a temp path.
    * Emits early progress ticks (2→20%).
    * Enqueues `parse_job` via Celery and returns **202** + `job_id`.
  * `_parse_and_store_core(...)` does the actual parse + DB writes and per‑item progress 20→100.

### Frontend

* `src/AddDocumentForm.jsx`

  * Sends `X-Job-ID: crypto.randomUUID()`.
  * Uses Axios `onUploadProgress` **for label only** (no forced percent).
  * Polls `/api/progress/<job_id>/` every ~500 ms; updates `percent`, `stage` and shows counts when present.
  * Closes overlay and navigates on `percent >= 100`.
  * Fix `Slide` props: `<Slide {...props} direction="up" />`.
* `src/api.js`

  * `getProgress(jobId)` helper.

### Infra (committed under `infra/`)

* `infra/systemd/dms.service`

  * Gunicorn with `--worker-class gthread --threads 8`; start with `--workers 1` (dev) or `--workers 3` (prod) and `--timeout 600`.
* `infra/systemd/dms-celery.service` (new)

  * Celery worker: `celery -A backend worker -Q parse -l info --concurrency=2`.
* `infra/nginx/dms.nginx.conf`

  * Keep `proxy_read_timeout 600s;`, `client_max_body_size` as needed.
* `infra/env/dms.env.example`

  * Non‑secret keys, includes `REDIS_URL`, Celery URLs, `DJANGO_ALLOWED_HOSTS`.

## Request flow

1. **POST** `/api/parse-and-store/` with `X-Job-ID` and file ⇒ HTTP **202** `{ job_id }`.
2. Celery worker picks the job, writes progress to Redis (`progress:<job_id>`).
3. Frontend polls **GET** `/api/progress/<job_id>/` until `percent==100`.

## Progress semantics

* **0–20%**: parse table + build items.
* **20–100%**: per‑item: “Mulai isi dokumen pendukung: item k/total”.
* Payload fields: `percent`, `stage`, `mode` (`pdf|table_only`), `total_items`, `current_item`.
* Keys expire via TTL (1h). Do not delete immediately after 100% to avoid flicker.

## Deploy steps

```
# backend
source /srv/dms/app/.venv/bin/activate
pip install -r backend/requirements.txt
sudo systemctl restart dms

# celery worker
sudo systemctl restart dms-celery

# frontend
cd /srv/dms/app/dms-frontend
npm run build
sudo rsync -a --delete build/ /var/www/dms-frontend/
sudo systemctl reload nginx
```

## Scaling

* Web: `gunicorn ... --workers 3 --worker-class gthread --threads 8`.
* Worker: `--concurrency` tuned to CPU and model throughput.
* Progress is Redis‑backed, so multiple web workers are safe.

## Limits and timeouts

* Nginx: `client_max_body_size 50m; proxy_read_timeout 600s;`.
* Gunicorn: `--timeout 600`.
* Celery: `task_soft_time_limit 1700`, `task_time_limit 1800`.
* App: reject huge PDFs or page counts early with a clear message.

## Troubleshooting

* **Progress stuck at 1%**: ensure Gunicorn uses `gthread`; confirm Celery running; check Redis `PING`.
* **`pending` responses**: no Redis key yet. Verify view emits early ticks and queue is not saturated.
* **`DisallowedHost`**: set `DJANGO_ALLOWED_HOSTS` in `/etc/dms.env` and restart.
* **Auth errors**: both endpoints require JWT; ensure frontend includes token.

## Rollback

* Stop Celery: `sudo systemctl stop dms-celery`.
* Switch Gunicorn back (optional): multiple sync workers.
* Revert `parse_and_store_view` to synchronous implementation.

## Changelog snippet (Oct 2025)

* Add Celery async pipeline and Redis progress store.
* Add `dms-celery` systemd unit.
* Convert `/api/parse-and-store/` to enqueue + 202.
* Update progress UI to determinate circular with stage text and counts.
* Commit Nginx and systemd configs to `infra/`.


## Changelog — Image display efficiency (Nov 2025)

### Summary

We significantly reduced bytes and improved perceived performance for document previews:

- Introduced a streamed preview endpoint that serves right-sized WebP/JPEG thumbnails with strong client caching.
- Frontend now uses these thumbnails for images and PDFs; the original file is fetched only on demand (zoom/open).
- Forced small previews for images by limiting responsive sizes to 480/640 widths.

### Backend: streamed preview endpoint

- Endpoint: `GET /api/sdoc/<id>/preview`
- Query params:
  - `w` (number): target width in pixels; clamped server-side to a maximum.
  - `fmt` (string, optional): `webp` or `jpeg`. If omitted, format is negotiated via the request's `Accept` header with WebP preferred.
- Behavior:
  - For image sources: resizes to requested width and encodes to WebP (or JPEG fallback).
  - For PDF sources: renders the first page and returns the resized thumbnail in the requested/negotiated format.
  - Sends strong caching headers with `ETag`; clients will revalidate efficiently.

Configuration notes:

- Defaults are tuned for quality vs. size (e.g., max width ≈1200px, quality ≈75) and may be configured via environment if exposed in your settings.

### Frontend: thumbnails, no reader by default

- Images: `DocumentTableParts.jsx` now requests small thumbnails only (480w/640w) using `srcSet` and `sizes`. This avoids large downloads on initial paint.
- PDFs: treated like images — we show a preview thumbnail from `/api/sdoc/<id>/preview?w=…` (no `<iframe>`). A button opens the original PDF in a new tab if needed.
- Zoom: `react-medium-image-zoom` is configured with `data-zoom-src={doc.file}` so the original asset is fetched only when the user zooms.

Developer tips:

- You can explicitly request formats in the browser for sanity checks:
  - `/api/sdoc/123/preview?w=640&fmt=webp`
  - `/api/sdoc/123/preview?w=640&fmt=jpeg`
- In DevTools Network tab, confirm only 480/640-size images are loaded while scrolled in the table; the original file should appear only on zoom or when clicking “Buka file asli/Buka PDF asli”.

Known behavior:

- For PDFs we preview the first page only in the table. Opening the original loads the full PDF in the browser.
