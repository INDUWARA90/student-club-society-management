#!/usr/bin/env bash
#
# Azure Ubuntu VM Quick Setup Script for Student Club & Society Management
# Installs Docker, Docker Compose, sets up swap, and configures permissions.
#
set -euo pipefail

echo "=========================================================="
echo " Starting Azure Ubuntu VM Setup for Club Management System "
echo "=========================================================="

# 1. Setup 2GB Swap (prevents out-of-memory errors on small burstable VMs)
if [ ! -f /swapfile ]; then
    echo "Creating 2GB swap space..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap enabled successfully."
else
    echo "Swapfile already exists. Skipping."
fi

# 2. Update package lists and install pre-requisites
echo "Updating apt repositories and installing tools..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg git lsb-release

# 3. Add official Docker repository and key
echo "Configuring Docker repository..."
sudo install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
fi

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker CE and Docker Compose
echo "Installing Docker and Docker Compose..."
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Start and enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# 6. Add current user to docker group
if ! groups "$USER" | grep -q '\bdocker\b'; then
    echo "Adding $USER to docker group..."
    sudo usermod -aG docker "$USER"
fi

echo "=========================================================="
echo " Setup Complete! "
echo " Docker: $(docker --version)"
echo " Compose: $(docker compose version)"
echo "=========================================================="
echo "NEXT STEPS:"
echo "1. Run: newgrp docker"
echo "2. Copy .env.example to .env and configure secrets & Azure VM IP:"
echo "   cp .env.example .env && nano .env"
echo "3. Start the application:"
echo "   docker compose up -d --build"
echo "=========================================================="
