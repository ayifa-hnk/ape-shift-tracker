#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_PATH="$(which node)"

echo "==> Using Node at $NODE_PATH"

echo "==> Building frontend..."
cd "$PROJECT_DIR/client"
npm install
npm run build

echo "==> Installing systemd service..."
sed -e "s|NODE_PATH|$NODE_PATH|g" \
    -e "s|PROJECT_DIR|$PROJECT_DIR|g" \
    "$PROJECT_DIR/ape-shift-tracker.service.template" > /tmp/ape-shift-tracker.service
sudo cp /tmp/ape-shift-tracker.service /etc/systemd/system/ape-shift-tracker.service
sudo systemctl daemon-reload
sudo systemctl enable ape-shift-tracker
sudo systemctl restart ape-shift-tracker
sudo systemctl status ape-shift-tracker --no-pager

echo "==> Generating SSL certificate..."
if [ ! -f /etc/ssl/certs/ape-shift-tracker.crt ]; then
    sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/ssl/private/ape-shift-tracker.key \
      -out /etc/ssl/certs/ape-shift-tracker.crt \
      -subj "/CN=ape-shift-tracker"
    sudo cp /etc/ssl/certs/ape-shift-tracker.crt /usr/local/share/ca-certificates/ape-shift-tracker.crt
    sudo update-ca-certificates
else
    echo "Certificate already exists, skipping."
fi

echo "==> Trusting certificate in Firefox..."
CERT_FILE=/etc/ssl/certs/ape-shift-tracker.crt
# find all Firefox profile directories for the current user
for PROFILE_DIR in ~/.mozilla/firefox/*.default* ~/.mozilla/firefox/*.esr*; do
    if [ -d "$PROFILE_DIR" ]; then
        certutil -A -n "ape-shift-tracker" -t "CT,," -i "$CERT_FILE" -d "sql:$PROFILE_DIR"
        echo "    Added to profile: $PROFILE_DIR"
    fi
done

echo "==> Installing nginx config..."
sudo cp "$PROJECT_DIR/ape-shift-tracker.nginx" /etc/nginx/sites-available/ape-shift-tracker
sudo ln -sf /etc/nginx/sites-available/ape-shift-tracker /etc/nginx/sites-enabled/ape-shift-tracker
sudo nginx -t
sudo systemctl reload nginx

echo "==> Adding hostname..."
if ! grep -q "ape-shift-tracker" /etc/hosts; then
    echo "127.0.0.1 ape-shift-tracker" | sudo tee -a /etc/hosts
else
    echo "Hostname already in /etc/hosts, skipping."
fi

echo ""
echo "Done. Open https://ape-shift-tracker in your browser."