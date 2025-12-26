#!/bin/bash

# Configuration
APP_DIR="/var/www/inventory"
REPO_DIR="$APP_DIR/ResortApp"
FRONTEND_DIR="$APP_DIR/build"
USER="www-data"
GROUP="www-data"

echo "=== Starting Inventory Deployment Setup ==="

# 1. Update System and Install Dependencies
echo "[1/7] Installing System Dependencies..."
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv nginx acl libpq-dev

# 2. Create Directory Structure
echo "[2/7] Creating Directories..."
sudo mkdir -p $APP_DIR
sudo mkdir -p /var/log/inventory_resort
sudo chown -R $USER:$GROUP /var/log/inventory_resort

# 3. Setup Files (Assumes files are already uploaded to /tmp/inventory_deploy or current dir)
# We assume the user runs this script from the directory containing the uploaded files
echo "[3/7] Copying Files..."
# Create dirs if they don't exist
sudo mkdir -p $REPO_DIR
sudo mkdir -p $FRONTEND_DIR

# Copy Backend
if [ -d "ResortApp" ]; then
    sudo cp -r ResortApp/* $REPO_DIR/
    echo "Backend files copied."
else
    echo "WARNING: ResortApp directory not found in current location."
fi

# Frontend Setup
if [ -d "frontend_build" ]; then
    # Case 1: Pre-built artifacts (from local upload)
    echo "Found pre-built frontend. Copying..."
    sudo cp -r frontend_build/* $FRONTEND_DIR/
elif [ -d "dasboard" ]; then
    # Case 2: Source code (from Git)
    echo "Found frontend source. Installing Node.js and Building..."
    
    # Install Node.js if missing
    if ! command -v npm &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Build
    cd dasboard
    # Install dependencies carefully
    echo "Installing frontend dependencies..."
    npm install --legacy-peer-deps
    
    echo "Building frontend..."
    npm run build
    
    # Copy build artifacts
    echo "Copying build artifacts..."
    # Ensure target is clean
    sudo rm -rf $FRONTEND_DIR/*
    sudo cp -r build/* $FRONTEND_DIR/
    
    # VERIFICATION
    if [ ! -f "$FRONTEND_DIR/index.html" ]; then
        echo "CRITICAL ERROR: index.html not found in $FRONTEND_DIR after copy!"
        echo "Build directory contents:"
        ls -la build/
        exit 1
    else
        echo "SUCCESS: index.html found."
    fi
    
    cd ..
else
    echo "WARNING: No frontend source or build found."
fi

# Copy Configs
# If running from git, configs might be in root
if [ -f "inventory-resort.service" ]; then
    sudo cp inventory-resort.service /etc/systemd/system/
fi
if [ -f "nginx_inventory.conf" ]; then
    sudo cp nginx_inventory.conf /etc/nginx/sites-available/inventory
fi

# 4. Setup Python Environment
echo "[4/7] Setting up Python Virtual Environment..."
cd $APP_DIR
if [ ! -d "venv" ]; then
    sudo python3 -m venv venv
fi

# Fix permissions for venv so we can use it
sudo chown -R $USER:$USER venv

# Install Requirements
echo "Installing Python requirements..."
sudo -u $USER $APP_DIR/venv/bin/pip install --upgrade pip
if [ -f "$REPO_DIR/requirements.txt" ]; then
    sudo -u $USER $APP_DIR/venv/bin/pip install -r $REPO_DIR/requirements.txt
fi
# Ensure gunicorn and uvicorn are installed
sudo -u $USER $APP_DIR/venv/bin/pip install gunicorn uvicorn

# 5. Permissions & Env
echo "[5/7] Setting Permissions & Env..."

# Ensure .env exists to prevent service failure
if [ ! -f "$REPO_DIR/.env" ]; then
    echo "Creating default .env file..."
    # You might want to populate this with actual defaults
    echo "DATABASE_URL=sqlite:///./orchid.db" > $REPO_DIR/.env
    echo "SECRET_KEY=change_this_secret_key" >> $REPO_DIR/.env
    sudo chown $USER:$GROUP $REPO_DIR/.env
fi

sudo chown -R $USER:$GROUP $APP_DIR
# Ensure directories are executable (traversable)
sudo find $APP_DIR -type d -exec chmod 755 {} \;
# Ensure files are readable
sudo find $APP_DIR -type f -exec chmod 644 {} \;

# Ensure uploads directory is writable
sudo mkdir -p $REPO_DIR/uploads
sudo chown -R $USER:$GROUP $REPO_DIR/uploads
sudo chmod -R 775 $REPO_DIR/uploads

# 6. Configure Systemd
echo "[6/7] Configuring Systemd Service..."
sudo systemctl daemon-reload
sudo systemctl enable inventory-resort
sudo systemctl restart inventory-resort

# 7. Configure Nginx
echo "[7/7] Configuring Nginx..."
if [ -f "/etc/nginx/sites-available/inventory" ]; then
    # Link if not exists (assuming we are replacing default or adding new)
    # Note: If you want to merge with existing config, manual action might be needed.
    # This script assumes 'inventory' is a separate file or we replace the main one.
    # Given the complex nginx setup provided earlier, the user likely manually updates nginx.conf
    # or uses sites-enabled.
    
    # Check if we should enable it
    if [ ! -f "/etc/nginx/sites-enabled/inventory" ]; then
        sudo ln -s /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/
    fi
    
    sudo nginx -t && sudo systemctl reload nginx
else
    echo "Nginx config file not found in sites-available. Skipping Nginx reload."
fi

echo "=== Deployment Complete ==="
echo "Check status:"
echo "Backend: sudo systemctl status inventory-resort"
echo "Nginx: sudo systemctl status nginx"
