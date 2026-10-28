#!/bin/bash
# MonoFinance deployment script to Oracle Cloud VPS
# Run this script inside WSL

SERVER_IP="${SERVER_IP:-finance.swiftapps.cloud}"
SSH_KEY="${SSH_KEY:-/home/user/ssh-key-2026-07-11.key}"
REMOTE_USER="ubuntu"
REMOTE_DIR="/home/ubuntu/MonoFinance"

echo "=== Deploying MonoFinance to Oracle Cloud ==="

# 1. Create remote directory
echo "Creating remote directory $REMOTE_DIR..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $REMOTE_USER@$SERVER_IP "mkdir -p $REMOTE_DIR"

# 2. Upload files
echo "Uploading files to server..."
scp -o StrictHostKeyChecking=no -i $SSH_KEY index.html styles.css app.js app_server.py manifest.json favicon.svg sw.js setup_https.sh $REMOTE_USER@$SERVER_IP:$REMOTE_DIR/

# 3. Setup virtual environment and configure services
echo "Configuring environment and services on server..."
ssh -o StrictHostKeyChecking=no -i $SSH_KEY $REMOTE_USER@$SERVER_IP "bash -s" << 'EOF'
  cd /home/ubuntu/MonoFinance

  # Create virtual environment if it doesn't exist
  if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
  fi

  # Install Flask, gunicorn and requests
  echo "Installing Python dependencies..."
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install flask gunicorn requests

  # Create systemd service file
  echo "Creating systemd service..."
  sudo tee /etc/systemd/system/monofinance.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=MonoFinance Dashboard Standalone Gunicorn Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/MonoFinance
EnvironmentFile=-/home/ubuntu/MonoFinance/.env
Environment="GROQ_API_KEY=${GROQ_API_KEY:-}"
ExecStart=/home/ubuntu/MonoFinance/venv/bin/gunicorn --workers 1 --threads 4 --bind 127.0.0.1:5001 --timeout 120 app_server:app
Restart=always

[Install]
WantedBy=multi-user.target
SERVICE_EOF

  # Reload systemd and start service
  echo "Enabling and restarting monofinance service..."
  sudo systemctl daemon-reload
  sudo systemctl enable monofinance
  sudo systemctl restart monofinance

  # Update Nginx config
  echo "Updating Nginx configuration..."
  sudo tee /etc/nginx/sites-available/monofinance > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    server_name finance.swiftapps.cloud _;

    location = /monofinance {
        return 301 /monofinance/;
    }

    location /monofinance/ {
        proxy_pass http://127.0.0.1:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_path / /;
    }

    location / {
        proxy_pass http://127.0.0.1:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_path / /;
    }
}

server {
    listen 443 ssl;
    server_name finance.swiftapps.cloud;

    ssl_certificate /etc/letsencrypt/live/finance.swiftapps.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/finance.swiftapps.cloud/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_path / /;
    }

    location /monofinance/ {
        proxy_pass http://127.0.0.1:5001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_path / /;
    }
}
NGINX_EOF

  sudo ln -sf /etc/nginx/sites-available/monofinance /etc/nginx/sites-enabled/monofinance

  # Test Nginx and reload
  echo "Testing and reloading Nginx..."
  sudo nginx -t && sudo systemctl reload nginx

  echo "Server configuration done!"
EOF

echo "=== Deployment Complete ==="
echo "You can access the dashboard at: https://finance.swiftapps.cloud/"
