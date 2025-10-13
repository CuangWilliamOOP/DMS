# Staging Deployment Guide — Refresh (October 2025)

This updates and complements the existing deployment doc. It captures fixes we applied during the 2025‑10 incident (media not serving, cache issues, wrong Python package), and standardizes Nginx + systemd so a fresh VPS reproduces the working state quickly.

---

## 0) Quick checklist for a fresh VPS

1. Point DNS `staging.caw-dms.com` → VPS IP.
2. Install: `git python3-venv python3-pip nginx nodejs npm certbot python3-certbot-nginx apache2-utils build-essential`.
3. Create `/srv/dms/app`, clone repo, create and activate venv.
4. `pip install -r backend/requirements.txt` (ensure **PyMuPDF** is installed; see Appendix A).
5. Create `/etc/dms.env` with real values (see Section 2) and `chmod 640; chown root:dms`.
6. `python manage.py migrate && python manage.py collectstatic --noinput`.
7. Build frontend → `npm run build` → `rsync build/ → /var/www/dms-frontend/`.
8. Install `dms.service` (Gunicorn), enable and start it.
9. Install Nginx site (includes `/media/`, `/api/`, and SPA fallback in the **right order**), test and reload.
10. Issue TLS with Certbot. Verify.

---

## 1) Canonical Nginx site (HTTPS)

> Put this at `/etc/nginx/sites-available/dms`, symlink to `sites-enabled`.

```nginx
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
        proxy_pass http://127.0.0.1:8001;
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
```

### 1.1 Cache behavior

* Prevent stale HTML: add `add_header Cache-Control "no-store, must-revalidate" always;` inside `location /` if the browser keeps old bundles.
* Cache static assets hard: serve `/static/` and CRA build assets with `Cache-Control: public, max-age=31536000, immutable`.

Example blocks:

```nginx
location /static/ { alias /var/www/dms-frontend/static/; add_header Cache-Control "public, max-age=31536000, immutable" always; }
location = /index.html { add_header Cache-Control "no-store, must-revalidate" always; }
```

### 1.2 Single TLS vhost rule

Ensure only **one** active `server { listen 443 … server_name staging.caw-dms.com; }` exists. Duplicate vhosts cause the SPA to capture `/media/` and return `index.html`.

---

## 2) Environment file `/etc/dms.env` (staging template)

```ini
# Django
DJANGO_SETTINGS_MODULE=backend.settings
DJANGO_SECRET_KEY=<strong-random-secret>
DJANGO_ALLOWED_HOSTS=staging.caw-dms.com,127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=https://staging.caw-dms.com
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
```

> Load env for ad‑hoc Django commands: `set -a; source /etc/dms.env; set +a`

---

## 3) Gunicorn systemd unit

`/etc/systemd/system/dms.service`:

```ini
[Unit]
Description=DMS Django via Gunicorn
After=network.target

[Service]
User=dms
Group=www-data
WorkingDirectory=/srv/dms/app/backend
EnvironmentFile=/etc/dms.env
ExecStart=/srv/dms/app/.venv/bin/gunicorn backend.wsgi:application \
  --workers 3 --bind 127.0.0.1:8001 --timeout 600 --access-logfile - --error-logfile -
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Commands:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dms
sudo systemctl status dms --no-pager
```

---

## 4) Frontend build & deploy

```bash
cd /srv/dms/app/dms-frontend
npm install
npm run build
sudo rsync -a --delete build/ /var/www/dms-frontend/
sudo systemctl reload nginx
```

**API base URL**: same‑origin `/api` in staging/production. Override with `REACT_APP_API_BASE_URL` if needed.

**Login refresh tip**: after login, prefer `window.location.replace('/home?v='+Date.now())` to avoid stale bundles.

---

## 5) Verifications

* **Media path**: pick a real file and confirm MIME type is image/pdf, not `text/html`.

  ```bash
  FILE=$(find /srv/dms/app/backend/media -type f \( -name '*.pdf' -o -name '*.jpg' -o -name '*.png' \) | head -1)
  URL="/media${FILE#/srv/dms/app/backend/media}"
  curl -I "https://staging.caw-dms.com$URL"
  ```

* **API**: `curl -I https://staging.caw-dms.com/api/` should return 301/405 from Django, not Nginx 404.

* **Service**: `journalctl -u dms -f` while hitting endpoints.

---

## 6) One‑command deploy script

`/srv/dms/deploy.sh` (committed in `scripts/`): pulls, installs backend deps, migrates, builds frontend, rsyncs, restarts Gunicorn and reloads Nginx.

Usage:

```bash
ssh dms@<VPS_IP>
/srv/dms/deploy.sh
```

---

## 7) Infra in Git (repeatable setup)

Track configs in the repo and apply with a script:

```
infra/
  nginx/
    dms.conf          # full site config (this doc’s Nginx)
  systemd/
    dms.service       # unit above
  env/
    .env.example      # placeholders only
scripts/
  apply-configs.sh    # copies infra → /etc, tests, reloads
```

**Do not commit**: real `/etc/dms.env`, TLS keys/certs, or `.htpasswd`.

---

## 8) Troubleshooting quick refs

* **/media returns text/html** → `/media` missing or overshadowed by SPA fallback. Ensure the `/media/` block exists **inside the active TLS server** and appears **before** `location /`.
* **504 / long parses** → raise Gunicorn `--timeout` and Nginx `proxy_read_timeout` as above.
* **CSRF or SECRET_KEY errors** → run management commands with env loaded; ensure `/etc/dms.env` is present.
* **Static not updating** → rebuild, rsync, and reload Nginx; consider no‑store on `index.html`.

---

## Appendix A — Python packages

* Use **PyMuPDF** to provide the `fitz` module. Do **not** install the `fitz` stub from PyPI.

  ```bash
  pip uninstall -y fitz
  pip install PyMuPDF==1.23.17
  python -c "import fitz; print(fitz.__doc__[:40])"  # sanity check
  ```

---

## Appendix B — Minimal health checks

* Add `/api/health/` Django view that returns 200 JSON. Point uptime monitor at `/` and `/api/health/`.

---

Keep this file authoritative. If you tweak live configs or timeouts, reflect them here and commit under `infra/` for full reproducibility.

