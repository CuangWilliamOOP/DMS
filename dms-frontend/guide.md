# DMS Staging & Production Ops Guide (VPS + Nginx + Django + Supabase)

> **Goal:** A single, practical reference for how your app is laid out on the VPS, how to deploy, and how to diagnose issues. Includes staging→production differences and a quick replication guide for a new server.

---

## 1) Big Picture

```
Browser ──▶ Nginx (reverse proxy)
             ├─ serves React build from /var/www/dms-frontend/
             └─ proxies /api/* → Gunicorn → Django (in .venv)
                                        └→ Supabase Postgres (remote)
```

**Key locations on the VPS**

* App code (repo root): **`/srv/dms/app/`**

  * Django backend: **`/srv/dms/app/backend/`**
  * Python virtualenv: **`/srv/dms/app/.venv/`** (isolated Python + pip packages)
* Deployed frontend (what Nginx serves): **`/var/www/dms-frontend/`**
* Environment variables (secrets & settings): **`/etc/dms.env`**
* System service (Gunicorn + Django): **`dms.service`** (systemd)
* Nginx logs: **`/var/log/nginx/access.log`**, **`/var/log/nginx/error.log`**
* Service logs: **`journalctl -u dms -f`**

**Glossary**

* **Venv**: an isolated Python environment your app runs in (so system Python changes don’t break your app).
* **`src/` vs `/var/www/…`**: `src/` is human-editable React source. `npm run build` compiles it to `build/`. You then rsync the compiled assets to **`/var/www/dms-frontend/`**—that’s what Nginx serves.

---

## 2) Environment & Security

All sensitive settings live in **`/etc/dms.env`** and are loaded by systemd when `dms.service` starts.

**Required keys (staging)**

```ini
# Django
DJANGO_SETTINGS_MODULE=backend.settings
DJANGO_SECRET_KEY=<strong-random-secret>
DJANGO_ALLOWED_HOSTS=staging.caw-dms.com,127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=https://staging.caw-dms.com

# Database (Supabase)
DB_NAME=postgres
DB_USER=<db_user>
DB_PASSWORD=<db_password>
DB_HOST=<project>.supabase.co
DB_PORT=5432

# Optional: psql convenience (for manual queries)
PGHOST=<pooler or host>
PGPORT=<pooler_port>
PGDATABASE=postgres
PGUSER=<psql_user>
PGPASSWORD=<psql_password>
PGSSLMODE=require
```

> **Never** commit secrets. Use placeholders in the repo (e.g. `.env.example`). Rotate keys you’ve ever pasted into chat or terminals.

**Security flags set in `backend/settings.py`**

* `DEBUG = False`
* Cookie security: `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, SameSite=Lax
* HTTPS enforcement: `SECURE_SSL_REDIRECT`, `SECURE_PROXY_SSL_HEADER`
* HSTS enabled (14 days by default via `DJANGO_HSTS_SECONDS`)
* Framing protected: `X_FRAME_OPTIONS = "SAMEORIGIN"`
* DRF throttling for anon & authenticated users

---

## 3) Deploying the Frontend (React)

From your React project directory (where `package.json` lives):

```bash
npm run build
sudo rsync -a build/ /var/www/dms-frontend/
sudo systemctl reload nginx
```

That’s it. The browser now downloads the new static files from `/var/www/dms-frontend/`.

---

### 3.1 Live Frontend Edits (Option A — Auto-deploy on save)

**Project root:** `/srv/dms/app/dms-frontend`

**One-time setup**

```bash
sudo apt-get update && sudo apt-get install -y entr
cd /srv/dms/app/dms-frontend
npm install   # or: npm ci
sudo -v       # cache sudo so the watcher won't prompt
```

**Start the watcher (keep this running in a terminal, e.g. tmux)**

```bash
cd /srv/dms/app/dms-frontend
find src public -type f | entr -cd sh -c '
  echo "[$(date +%H:%M:%S)] Building…";
  npm run build &&
  sudo rsync -a --delete build/ /var/www/dms-frontend/ &&
  sudo systemctl reload nginx &&
  echo "[$(date +%H:%M:%S)] Deployed!"
'
```

* `-c` clears the screen each run; `-d` also reacts to new/removed files.
* On every **save**, it builds → deploys to `/var/www/dms-frontend/` → reloads Nginx.

**What “edit” and “save” mean**

* **Edit** files under: `/srv/dms/app/dms-frontend/src/...` or `/srv/dms/app/dms-frontend/public/...` using VS Code Remote‑SSH, `nano`, or `vim`.
* **Save** (write to disk): VS Code (Ctrl/Cmd+S), `nano` (Ctrl+O, Enter), `vim` (`:w`).
* Don’t edit `/var/www/dms-frontend/` — it’s compiled output and gets overwritten.

**Example — change wording in `AddDocumentPage.jsx`**

```bash
cd /srv/dms/app/dms-frontend
# locate the file
FILE=$(find src -type f -name 'AddDocumentPage.jsx' | head -n1)

# quick in-place change:
sed -i 's/Tambahkan dokumen/Tambahkan dokument/g' "$FILE"

# or edit manually:
# nano "$FILE"   # edit → Ctrl+O → Enter → Ctrl+X
# vim "$FILE"    # edit → :w → :q
```

## 4) Deploying the Backend (Django)

Typical steps after you edit backend code:

```bash
# (Optional) Activate venv if you need pip
source /srv/dms/app/.venv/bin/activate

# Restart the service (pulls env from /etc/dms.env)
sudo systemctl restart dms

# Watch logs if something looks off
journalctl -u dms -f
```

**Schema changes?**

```bash
# With env loaded for this shell
set -a; source /etc/dms.env; set +a
source /srv/dms/app/.venv/bin/activate
cd /srv/dms/app/backend
python manage.py makemigrations
python manage.py migrate
sudo systemctl restart dms
```

> **Tip:** Create a wrapper so you never forget env or paths:

```bash
sudo tee /usr/local/bin/dms-manage >/dev/null <<'BASH'
#!/usr/bin/env bash
set -a; source /etc/dms.env; set +a
exec /srv/dms/app/.venv/bin/python /srv/dms/app/backend/manage.py "$@"
BASH
sudo chmod +x /usr/local/bin/dms-manage
```

Then use:

```bash
dms-manage check --deploy
dms-manage migrate
dms-manage shell
```

---

## 5) Database: Supabase Postgres

* **Remote**; nothing runs locally on the VPS.
* Django connects using `DB_*` from `/etc/dms.env` (TLS via `sslmode=require`).
* Use a **least-privilege** DB user for the app (avoid superuser in production).
* Backups are handled by Supabase; perform a test restore periodically.

**Quick connectivity test**

```bash
set -a; source /etc/dms.env; set +a
PGPASSWORD="$DB_PASSWORD" psql "host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME sslmode=require" -c "select now();"
```

---

## 6) Nginx (conceptual)

Nginx serves the frontend and proxies API calls to Gunicorn. Your existing config already does this; below is a sketch for reference only (match it to your live config):

```nginx
server {
  listen 80;
  listen 443 ssl http2; # if TLS is enabled
  server_name staging.caw-dms.com;

  # Frontend (static build)
  root /var/www/dms-frontend;
  index index.html;

  location / {
    try_files $uri /index.html;  # SPA routing
  }

  # API → Gunicorn
  location /api/ {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # choose one that matches your service:
    # proxy_pass http://127.0.0.1:8000;           # if gunicorn binds to 127.0.0.1:8000
    # proxy_pass http://unix:/run/gunicorn.sock;  # if gunicorn uses a unix socket
  }

  # Basic security headers (also set in Django)
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  # Consider a CSP that fits your app
}
```

> After frontend deploys: `sudo systemctl reload nginx`

---

## 7) Staging vs Production

| Area       | Staging                                         | Production                           |
| ---------- | ----------------------------------------------- | ------------------------------------ |
| Domains    | `staging.caw-dms.com`                           | `app.<your-domain>` (or main domain) |
| DB         | Supabase Project A                              | **Separate** Supabase Project B      |
| Secrets    | `DJANGO_SECRET_KEY`, DB creds in `/etc/dms.env` | Different values and keys            |
| DEBUG      | False                                           | False                                |
| HSTS       | Shorter (2 weeks)                               | Longer (6–12 months) once stable     |
| Admin      | Accessible via VPN/IP allowlist                 | Strongly restricted                  |
| Monitoring | Optional                                        | Required (Sentry/Uptime checks)      |

---

## 8) Security Checklist (pre-public)

* [ ] `DEBUG = False`
* [ ] `ALLOWED_HOSTS` & `CSRF_TRUSTED_ORIGINS` set to your domain(s)
* [ ] `DJANGO_SECRET_KEY` set in `/etc/dms.env` and rotated once
* [ ] HTTPS enforced; HSTS enabled
* [ ] X-Frame-Options SAMEORIGIN (no clickjacking)
* [ ] DRF throttling configured
* [ ] `/admin/` locked down (IP allowlist or Basic Auth)
* [ ] File upload types & size validated server-side
* [ ] Use least-privilege DB user for Django
* [ ] Sentry (or similar) hooked up for error reporting
* [ ] `python manage.py check --deploy` is clean

---

## 9) Troubleshooting Cheatsheet

* **502/504 from Nginx** → Check Gunicorn:

  ```bash
  journalctl -u dms -n 200 -f
  ```
* **403/CSRF** → Confirm `DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS` in `/etc/dms.env` match the URL.
* **"SECRET_KEY must not be empty"** → You ran `manage.py` without loading env; do:

  ```bash
  set -a; source /etc/dms.env; set +a
  ```
* **DB auth/conn errors** → Test with `psql` one-liner in section 5.
* **Static not updating** → Did you `npm run build` → `rsync` → `reload nginx`?

---

## 10) Replicating to a New VPS (quick start)

1. **Provision server** (Ubuntu), set hostname & firewall, install: git, python3, venv, node/npm, nginx.
2. **Clone repo** to `/srv/dms/app`.
3. **Create venv & install deps**

   ```bash
   cd /srv/dms/app
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```
4. **Create `/etc/dms.env`** (production values!).
5. **Migrate DB**

   ```bash
   set -a; source /etc/dms.env; set +a
   /srv/dms/app/.venv/bin/python /srv/dms/app/backend/manage.py migrate
   ```
6. **Build and publish frontend**

   ```bash
   npm run build
   sudo rsync -a build/ /var/www/dms-frontend/
   sudo systemctl reload nginx
   ```
7. **Start backend service** (configure `dms.service` pointing to your venv & app). Then:

   ```bash
   sudo systemctl start dms
   sudo systemctl status dms --no-pager
   ```
8. **Smoke test**: open site, login, basic CRUD; watch logs.

---

## 11) SQLite → Supabase Migration (what you already did)

* Install Postgres driver in venv (`psycopg2-binary`).
* Stop service → backup SQLite → `dumpdata` (exclude system tables).
* Switch `DATABASES` to env-driven Postgres (`sslmode=require`).
* Migrate against Supabase → load cleaned JSON → reset sequences.
* Start service → verify counts & app flows.

---

## 12) Day‑2 Ops

* **Logs**: `journalctl -u dms -f` and Nginx logs for HTTP layer.
* **Updates**: pin requirements, upgrade deliberately in venv, restart service.
* **Backups**: ensure Supabase backups; test restore occasionally.
* **Monitoring**: Sentry DSN in env; uptime monitor hitting `/` and `/api/healthz` (add a simple health endpoint if you like).

---

## 13) Appendix

**Example `dms.service` (illustrative; adapt to your actual unit):**

```ini
[Unit]
Description=DMS Django via Gunicorn
After=network.target

[Service]
User=dms
Group=dms
WorkingDirectory=/srv/dms/app/backend
EnvironmentFile=/etc/dms.env
ExecStart=/srv/dms/app/.venv/bin/gunicorn backend.wsgi:application \
  --workers 3 --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

> If you bind to a Unix socket instead, adjust Nginx `proxy_pass` accordingly.

**Rotating secrets**

* Generate new Django secret:

  ```bash
  python3 - <<'PY'
  ```

import secrets; print(secrets.token_urlsafe(64))
PY

````
- Update `/etc/dms.env`, then `sudo systemctl restart dms`.

**Least-privilege DB user (sketch)**
```sql
-- Run in Supabase SQL editor
CREATE USER dms_app WITH PASSWORD 'REPLACE_ME';
GRANT CONNECT ON DATABASE postgres TO dms_app;
GRANT USAGE ON SCHEMA public TO dms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO dms_app;
````

---

**Keep this doc close.** If anything in your live config differs, annotate it here so this stays your single source of truth. ✅
