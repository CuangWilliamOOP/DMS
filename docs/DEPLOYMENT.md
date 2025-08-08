# Staging Deployment Guide

This guide reproduces our working staging setup for **staging.caw-dms.com** on a Singapore VPS. It captures all the decisions we made so a fresh server can be brought online quickly and safely.

> TL;DR flow: create VPS → point DNS `staging` A record → bootstrap server → clone repo → Python venv → install deps → build frontend → systemd (Gunicorn) → Nginx (serve CRA + proxy `/api`) → Let’s Encrypt → **Basic Auth gate** (off for `/api`) → test → deploy script.

---

## 0) Prereqs

* **VPS:** Ubuntu 24.04 LTS (1–2 GB RAM is fine for staging).
* **Domain:** `caw-dms.com` with DNS access.
* **Subdomain:** `staging.caw-dms.com` → **A record** to your VPS IP.
* Shell access as a sudo-capable user (we use `dms`).

---

## 1) One‑time server bootstrap

```bash
# As root (first login)
apt update && apt -y upgrade

# Timezone
timedatectl set-timezone Asia/Jakarta

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

## 2) App checkout & Python setup

```bash
sudo mkdir -p /srv/dms && sudo chown -R dms:dms /srv/dms
cd /srv/dms
# Clone your repo
git clone https://github.com/CuangWilliamOOP/DMS.git app
cd app

# Python venv
python3 -m venv .venv
source .venv/bin/activate

# Install backend deps (we committed requirements.txt)
pip install --upgrade pip wheel
pip install -r backend/requirements.txt
```

**Django settings that matter (already committed):**

* `DEBUG = False`
* `ALLOWED_HOSTS = ["staging.caw-dms.com", "127.0.0.1", "localhost"]`
* `CSRF_TRUSTED_ORIGINS = ["https://staging.caw-dms.com"]`
* `STATIC_URL = "/backend-static/"` (to avoid clashing with CRA’s `/static/`)
* `STATIC_ROOT = BASE_DIR / "staticfiles"`
* `MEDIA_URL = "/media/"` and `MEDIA_ROOT` set

---

## 3) Initialise Django

```bash
cd /srv/dms/app/backend
source /srv/dms/app/.venv/bin/activate

# One-time env so management commands don't explode on import
echo 'OPENAI_API_KEY=dummy' | sudo tee /etc/dms.env >/dev/null
sudo chmod 640 /etc/dms.env && sudo chown root:dms /etc/dms.env

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

> Later: put your real key in `/etc/dms.env` → `OPENAI_API_KEY=sk-...` → `sudo systemctl restart dms`.

---

## 4) Frontend build (CRA)

```bash
cd /srv/dms/app/dms-frontend
npm install
npm run build   # output to build/

# Deploy build to an nginx-served directory
sudo mkdir -p /var/www/dms-frontend
sudo rsync -a build/ /var/www/dms-frontend/
```

**Frontend API base (committed):** `src/services/api.js` automatically uses:

* Dev: `http://127.0.0.1:8000/api`
* Staging/Prod: `'/api'` (same-origin behind Nginx)
* Optional override: `REACT_APP_API_BASE_URL`

---

## 5) Gunicorn via systemd (TCP, not socket)

Create `/etc/systemd/system/dms.service` (already captured in `infra/systemd/dms.service`):

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
  --workers 3 --bind 127.0.0.1:8001 --access-logfile - --error-logfile -
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dms
sudo systemctl status dms --no-pager
sudo ss -tlnp | grep 8001   # confirm listening
```

---

## 6) Nginx site config

Create `/etc/nginx/sites-available/dms` (template in `infra/nginx/dms.sample.conf`).

```nginx
server {
    listen 80;
    server_name staging.caw-dms.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name staging.caw-dms.com;

    # Basic Auth gate for the SPA
    auth_basic "Private";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # React build
    root /var/www/dms-frontend;
    index index.html;

    # Let’s Encrypt challenge must bypass auth
    location ^~ /.well-known/acme-challenge/ {
        auth_basic off;
        default_type "text/plain";
        root /var/www/html;
    }

    # CRA assets (from React build)
    location /static/ { alias /var/www/dms-frontend/static/; }

    # Django static (admin etc.) on a different prefix
    location /backend-static/ { alias /srv/dms/app/backend/staticfiles/; }

    # Media uploads
    location /media/ { alias /srv/dms/app/backend/media/; }

    # API proxied to Gunicorn (no Basic Auth here!)
    location /api/ {
        auth_basic off;
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        client_max_body_size 25m;
    }

    # SPA fallback
    location / { try_files $uri /index.html; }

    # SSL (Certbot will manage these once issued)
    ssl_certificate /etc/letsencrypt/live/staging.caw-dms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.caw-dms.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

Enable & reload:

```bash
sudo ln -s /etc/nginx/sites-available/dms /etc/nginx/sites-enabled/dms
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7) HTTPS (Let’s Encrypt)

```bash
# Ensure DNS A record: staging.caw-dms.com → <VPS_IP>
sudo certbot --nginx -d staging.caw-dms.com --agree-tos -m you@caw-dms.com --redirect -n
```

**If it times out:**

* Check UFW allows `Nginx Full`.
* Confirm Nginx is listening on :80.
* Ensure there isn’t a provider-level firewall blocking 80/443.

---

## 8) Basic Auth users (Nginx gate)

```bash
sudo htpasswd -c /etc/nginx/.htpasswd WilliamASN
sudo htpasswd /etc/nginx/.htpasswd SiskaASN
sudo htpasswd /etc/nginx/.htpasswd SubardiASN
sudo nginx -t && sudo systemctl reload nginx
```

> Keep `auth_basic off;` for `/api/` and the ACME challenge location.

---

## 9) Django users & groups (to mirror your local roles)

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

## 10) Deploy script (one-command updates)

`/srv/dms/deploy.sh` (already created and committed to `scripts/deploy.sh`):

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
sudo rsync -a build/ /var/www/dms-frontend/

echo "==> Restarting services"
sudo systemctl restart dms
sudo systemctl reload nginx

echo "==> Done at $(date)"
```

**Use it:**

```bash
ssh dms@<VPS_IP>
/srv/dms/deploy.sh
```

---

## 11) Logs & troubleshooting

* Backend (Gunicorn): `journalctl -u dms -f`
* Nginx errors: `sudo tail -f /var/log/nginx/error.log`
* Nginx access: `sudo tail -f /var/log/nginx/access.log`

**Common issues:**

* **White screen / 404 on main.\*.js** → Make sure `root /var/www/dms-frontend;` and `location /static/ { alias /var/www/dms-frontend/static/; }`. Rebuild + rsync.
* **502 on /api/** → Ensure Gunicorn is on `127.0.0.1:8001` and Nginx `proxy_pass http://127.0.0.1:8001;`.
* **401 on /api/token/** → Django user credentials are wrong or user inactive. Use `createsuperuser` / `changepassword`. Remember: Nginx gate creds are separate.
* **Certbot DNS error** → Create `A` record for `staging` → VPS IP; wait a few minutes.
* **Certbot timeout** → Open ports 80/443 in UFW + provider firewall; ensure Nginx listening on :80.

---

## 12) Optional: move to Postgres later

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser -P dms
sudo -u postgres createdb -O dms dms
```

Django settings via env (example):

```env
DB_NAME=dms
DB_USER=dms
DB_PASSWORD=strongpass
DB_HOST=127.0.0.1
DB_PORT=5432
```

Then update `DATABASES` in settings (or use `dj-database-url`), run `python manage.py migrate`, and consider `pg_dump` for backups.

---

## 13) Repo hygiene

We committed:

* `backend/requirements.txt`
* `backend/backend/settings.py` changes
* `dms-frontend/src/services/api.js` (same-origin `/api` in staging/prod)
* Infra templates: `infra/nginx/dms.sample.conf`, `infra/systemd/dms.service`
* `scripts/deploy.sh`
* `.env.example`, `.gitignore`

**Never commit:** `/etc/dms.env`, TLS certs/keys, `/etc/nginx/.htpasswd`, `backend/db.sqlite3`, `backend/media/`.

---

## 14) Reproducing on a fresh server

1. Bootstrap server (Section 1), point DNS.
2. Clone repo to `/srv/dms/app` and create venv.
3. `pip install -r backend/requirements.txt`
4. Build frontend and rsync to `/var/www/dms-frontend/`.
5. Copy `infra/systemd/dms.service` → `/etc/systemd/system/` (edit paths/domain if needed), enable it.
6. Copy `infra/nginx/dms.sample.conf` → `/etc/nginx/sites-available/dms`, symlink to sites-enabled, test & reload.
7. `certbot --nginx -d staging.<domain> --redirect -m you@<domain> -n`.
8. Create `/etc/nginx/.htpasswd` users; keep `/api` and ACME public.
9. Create Django users and groups.
10. Test. Deploy updates via `/srv/dms/deploy.sh`.

---

*End of guide*
