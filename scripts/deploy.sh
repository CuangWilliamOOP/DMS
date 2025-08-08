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
if [[ -f "$APP_DIR/requirements.txt" ]]; then
  pip install -r "$APP_DIR/requirements.txt"
elif [[ -f "$BACKEND_DIR/requirements.txt" ]]; then
  pip install -r "$BACKEND_DIR/requirements.txt"
else
  # Fallback for now – keep until you add a requirements.txt to your repo
  pip install -U django djangorestframework gunicorn whitenoise django-cors-headers python-dotenv django-fsm openai
fi

echo "==> Django migrate & collectstatic"
cd "$BACKEND_DIR"
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "==> Building frontend"
cd "$FRONTEND_DIR"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
npm run build

echo "==> Restarting services"
sudo systemctl restart dms
sudo systemctl reload nginx

echo "==> Done at $(date)"
