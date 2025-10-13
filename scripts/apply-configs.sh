#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.."; pwd)"

# nginx
sudo install -m 644 "$ROOT/infra/nginx/dms.conf" /etc/nginx/sites-available/dms
sudo install -m 644 "$ROOT/infra/nginx/dms-media.conf" /etc/nginx/snippets/dms-media.conf
sudo ln -sfn /etc/nginx/sites-available/dms /etc/nginx/sites-enabled/dms
sudo nginx -t
sudo systemctl reload nginx

# systemd
sudo install -m 644 "$ROOT/infra/systemd/dms.service" /etc/systemd/system/dms.service
sudo systemctl daemon-reload
sudo systemctl restart dms
