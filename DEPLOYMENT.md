# Deployment Guide (Staging + Production)

This guide documents our **current working VPS setup** for DMS.

- **Staging:** `https://staging.caw-dms.com`
- **Production:** `https://caw-dms.com` and `https://www.caw-dms.com`

We keep staging online as a fallback while production is the primary domain.

## TL;DR (current state)

1. **DNS**
   - `staging` **A** → `<VPS_IP>`
   - `@` (root) **A** → `<VPS_IP>`
   - `www` **CNAME** → `caw-dms.com`
2. **Backend**: systemd + Gunicorn bound to `127.0.0.1:8000`
3. **Frontend**: CRA build served from `/var/www/dms-frontend`
4. **Nginx**
   - Staging site: `/etc/nginx/sites-available/dms` (`staging.caw-dms.com`) (optionally Basic Auth gated)
   - Prod site: `/etc/nginx/sites-available/dms-prod` (`caw-dms.com`, `www.caw-dms.com`) (no Basic Auth)
   - Both proxy `/api/` → `http://127.0.0.1:8000`
   - Both serve `/media/` from `/srv/dms/app/backend/media/`
5. **TLS**
   - Staging cert: `certbot --nginx -d staging.caw-dms.com`
   - Prod cert: `certbot --nginx -d caw-dms.com -d www.caw-dms.com`

---

## 0) Prereqs

- **VPS:** Ubuntu 24.04 LTS
- **Domain:** `caw-dms.com` with DNS access
- Shell access as a sudo-capable user (we use `dms`)

---

## 1) DNS records

Keep staging and add production (do not remove staging):

- `staging.caw-dms.com` → **A** → `<VPS_IP>`
- `caw-dms.com` (`@`) → **A** → `<VPS_IP>`
- `www.caw-dms.com` → **CNAME** → `caw-dms.com`

Verify:

```bash
nslookup caw-dms.com
nslookup staging.caw-dms.com
nslookup www.caw-dms.com
```

---

## 2) One-time server bootstrap

```bash
# As root (first login)
apt update && apt -y upgrade

# Timezone (pick one; doesn't affect functionality)
timedatectl set-timezone Asia/Singapore

# Non-root user
adduser dms && usermod -aG sudo dms

# Firewall
apt install -y ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Switch user
su - dms

# Core packages
sudo apt install -y git python3-pip python3-venv python3-dev build-essential \
  nginx nodejs npm certbot python3-certbot-nginx apache2-utils

# (Optional on 1–2 GB RAM)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile \
  && sudo mkswap /swapfile && sudo swapon /swapfile \
  && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3) App checkout & Python setup

```bash
sudo mkdir -p /srv/dms && sudo chown -R dms:dms /srv/dms
cd /srv/dms

# Clone your repo
git clone https://github.com/CuangWilliamOOP/DMS.git app
cd app

# Python venv
python3 -m venv .venv
source .venv/bin/activate

# Install backend deps
pip install --upgrade pip wheel
pip install -r backend/requirements.txt
```

---

## 4) Environment file (/etc/dms.env)

We keep **all secrets and deployment-specific values** in `/etc/dms.env` (never commit this file).

```bash
sudo nano /etc/dms.env
sudo chmod 640 /etc/dms.env
sudo chown root:dms /etc/dms.env
```

Minimum template:

```env
# Django
DJANGO_SETTINGS_MODULE=backend.settings
DJANGO_SECRET_KEY=<strong-random-secret>
DJANGO_ALLOWED_HOSTS=staging.caw-dms.com,caw-dms.com,www.caw-dms.com,127.0.0.1,localhost
DJANGO_CSRF_TRUSTED_ORIGINS=https://staging.caw-dms.com,https://caw-dms.com,https://www.caw-dms.com
DJANGO_HSTS_SECONDS=1209600

# Database (example: Supabase Postgres)
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<secret>
DB_HOST=<project>.supabase.co
DB_PORT=5432

# Keys
# OPENAI_API_KEY=<secret>
```

Load it for ad-hoc commands:

```bash
set -a; source /etc/dms.env; set +a
```

---

## 5) Initialise Django

```bash
cd /srv/dms/app/backend
source /srv/dms/app/.venv/bin/activate

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

---

## 6) Frontend build (CRA)

```bash
cd /srv/dms/app/dms-frontend
npm install
npm run build

sudo mkdir -p /var/www/dms-frontend
sudo rsync -a --delete build/ /var/www/dms-frontend/
```

Frontend API base uses **same-origin** `'/api'` behind Nginx.

---

## 7) Gunicorn via systemd (TCP on localhost)

Create `/etc/systemd/system/dms.service`:

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
  --workers 3 --bind 127.0.0.1:8000 --timeout 600 --access-logfile - --error-logfile -
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable/start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dms
sudo systemctl status dms --no-pager
sudo ss -tlnp | grep 8000
```

---

## 8) Nginx site configs (staging + production)

We run **two Nginx sites** pointing to the same deployment.

> If you ever want staging to run a different backend build, run a second Gunicorn service on a different port and point the staging vhost to that port.

### 8.1 Staging site: `staging.caw-dms.com`

Create `/etc/nginx/sites-available/dms`:

```nginx
server {
    listen 80;
    server_name staging.caw-dms.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.caw-dms.com;

    # Optional: Basic Auth gate for the SPA (keep /api public)
    auth_basic "Private";
    auth_basic_user_file /etc/nginx/.htpasswd;

    root /var/www/dms-frontend;
    index index.html;

    # ACME challenge must bypass auth
    location ^~ /.well-known/acme-challenge/ {
        auth_basic off;
        default_type "text/plain";
        root /var/www/html;
    }

    # 1) MEDIA first
    location ^~ /media/ {
        alias /srv/dms/app/backend/media/;
        try_files $uri =404;
    }

    # 2) Django static (admin etc.)
    location /backend-static/ {
        alias /srv/dms/app/backend/staticfiles/;
    }

    # 3) API (no Basic Auth)
    location /api/ {
        auth_basic off;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 25m;
    }

    # 4) SPA fallback last
    location / { try_files $uri /index.html; }
}
```

### 8.2 Production site: `caw-dms.com` + `www.caw-dms.com`

Create `/etc/nginx/sites-available/dms-prod`:

```nginx
server {
    listen 80;
    server_name caw-dms.com www.caw-dms.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name caw-dms.com www.caw-dms.com;

    root /var/www/dms-frontend;
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/html;
    }

    location ^~ /media/ {
        alias /srv/dms/app/backend/media/;
        try_files $uri =404;
    }

    location /backend-static/ {
        alias /srv/dms/app/backend/staticfiles/;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 25m;
    }

    location / { try_files $uri /index.html; }
}
```

Enable & reload:

```bash
sudo ln -s /etc/nginx/sites-available/dms /etc/nginx/sites-enabled/dms
sudo ln -s /etc/nginx/sites-available/dms-prod /etc/nginx/sites-enabled/dms-prod
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9) HTTPS (Let’s Encrypt)

Staging:

```bash
sudo certbot --nginx -d staging.caw-dms.com --agree-tos -m you@caw-dms.com --redirect -n
```

Production:

```bash
sudo certbot --nginx -d caw-dms.com -d www.caw-dms.com --agree-tos -m you@caw-dms.com --redirect -n
```

Sanity:

```bash
sudo certbot renew --dry-run
```

---

## 10) Basic Auth users (staging gate)

If you gate staging with Basic Auth (recommended), create users:

```bash
sudo htpasswd -c /etc/nginx/.htpasswd WilliamASN
sudo htpasswd /etc/nginx/.htpasswd SiskaASN
sudo htpasswd /etc/nginx/.htpasswd SubardiASN
sudo nginx -t && sudo systemctl reload nginx
```

Keep `auth_basic off;` for `/api/` and the ACME challenge location.

---

## 11) Staging sunset warning (UI)

If you want a visible reminder in staging:

- Show a dialog/banner **only** when `window.location.hostname` is `staging.caw-dms.com`.
- Message: `"Domain website ini akan dihentikan dalam 14 hari, silahkan pindah ke caw-dms.com"`.

Implementation approach (React): add a component like `StagingSunsetDialog.jsx` and mount it globally in `App.js`.

---

## 12) Django users & groups (optional)

```bash
cd /srv/dms/app/backend
source /srv/dms/app/.venv/bin/activate

# Create or reset passwords
yes | python manage.py createsuperuser --username WilliamASN --email william@example.com || true
yes | python manage.py createsuperuser --username SubardiASN --email subardi@example.com || true

python manage.py changepassword SiskaASN
python manage.py changepassword WilliamASN
python manage.py changepassword SubardiASN

# Assign groups: admin (employee), boss (higher-up), owner (owner)
python manage.py shell <<'PY'
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
U = get_user_model()

g_admin,_=Group.objects.get_or_create(name='admin')
g_boss,_ =Group.objects.get_or_create(name='boss')
g_owner,_=Group.objects.get_or_create(name='owner')

mapping = {
  'SiskaASN': g_admin,
  'SubardiASN': g_boss,
  'WilliamASN': g_owner,
}
for uname, grp in mapping.items():
    try:
        u = U.objects.get(username=uname)
        u.is_active = True
        u.groups.clear()
        u.groups.add(grp)
        u.save()
        print(uname, '→', [g.name for g in u.groups.all()])
    except U.DoesNotExist:
        print('User missing:', uname)
PY
```

---

## 13) Deploy script (one-command updates)

`/srv/dms/deploy.sh` (committed as `scripts/deploy.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/dms/app"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/dms-frontend"
VENV="$APP_DIR/.venv"

echo "==> Pulling latest code"
cd "$APP_DIR"
git pull --ff-only

echo "==> Activating venv"
source "$VENV/bin/activate"

echo "==> Installing Python deps"
if [[ -f "$BACKEND_DIR/requirements.txt" ]]; then
  pip install -r "$BACKEND_DIR/requirements.txt"
fi

echo "==> Django migrate & collectstatic"
cd "$BACKEND_DIR"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "==> Building frontend"
cd "$FRONTEND_DIR"
if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
npm run build
sudo rsync -a --delete build/ /var/www/dms-frontend/

echo "==> Restarting services"
sudo systemctl restart dms
sudo systemctl reload nginx

echo "==> Done at $(date)"
```

Use it:

```bash
ssh dms@<VPS_IP>
/srv/dms/deploy.sh
```

---

## 14) Verification checklist

Backend listener:

```bash
sudo ss -tlnp | grep 8000
```

API and media:

```bash
curl -I https://caw-dms.com/api/
curl -I https://www.caw-dms.com/api/
curl -I https://staging.caw-dms.com/api/

FILE=$(find /srv/dms/app/backend/media -type f \( -name '*.pdf' -o -name '*.jpg' -o -name '*.png' \) | head -1)
URL="/media${FILE#/srv/dms/app/backend/media}"
curl -I "https://caw-dms.com$URL"
```

---

## 15) Logs & troubleshooting

Logs:

- Backend (Gunicorn): `journalctl -u dms -f`
- Nginx errors: `sudo tail -f /var/log/nginx/error.log`
- Nginx access: `sudo tail -f /var/log/nginx/access.log`

Common issues:

- **502 on `/api/`**
  - Check which port Gunicorn is listening on:
    ```bash
    sudo ss -tlnp | egrep ':8000|:8001'
    ```
  - Check Nginx is proxying to the same port.
  - Error log usually shows `connect() failed (111: Connection refused)` when the port is wrong.

- **`/media/...` returns `text/html`**
  - Your `/media/` block is missing or comes after the SPA fallback.

- **`DisallowedHost` / CSRF errors**
  - Add production + staging domains to `DJANGO_ALLOWED_HOSTS` and `DJANGO_CSRF_TRUSTED_ORIGINS` in `/etc/dms.env` and restart:
    ```bash
    sudo systemctl restart dms
    ```

---

## 16) Optional: move to local Postgres (not required if using Supabase)

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser -P dms
sudo -u postgres createdb -O dms dms
```

Example env:

```env
DB_NAME=dms
DB_USER=dms
DB_PASSWORD=strongpass
DB_HOST=127.0.0.1
DB_PORT=5432
```

---

## 17) Repo hygiene

Never commit:

- `/etc/dms.env`
- TLS certs/keys (`/etc/letsencrypt/...`)
- `/etc/nginx/.htpasswd`
- `backend/db.sqlite3`
- `backend/media/`

---

## 18) Reproducing on a fresh server

1. Bootstrap server (Section 2), point DNS (Section 1).
2. Clone repo to `/srv/dms/app` and create venv.
3. `pip install -r backend/requirements.txt`
4. Create `/etc/dms.env`.
5. `python manage.py migrate && python manage.py collectstatic --noinput`
6. Build frontend and rsync to `/var/www/dms-frontend/`.
7. Install `/etc/systemd/system/dms.service`, enable it.
8. Create Nginx sites: `/etc/nginx/sites-available/dms` and `/etc/nginx/sites-available/dms-prod`, enable them.
9. Run certbot for staging + prod.
10. (Optional) Add Basic Auth users for staging.
11. Verify `/api/` and `/media/`.
