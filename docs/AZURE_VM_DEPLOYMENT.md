# Azure VM Deployment Guide

This guide walks you step-by-step through deploying the **Student Club & Society Management Platform** on an **Azure Virtual Machine** using Docker Compose.

---

## Architecture on Azure VM

On a single Azure VM, Docker Compose manages the complete application stack:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 Azure Virtual Machine                   │
                  │                                                         │
  Browser         │   ┌───────────────────┐       ┌─────────────────────┐   │
  ───────────────►│   │  Frontend (Nginx) │       │ Backend (Spring)    │   │
  (Port 80/8080)  │   │  Serves SPA dist  │       │ Port 5000           │   │
                  │   └───────────────────┘       └──────────┬──────────┘   │
  Browser (API)   │                                          │              │
  ───────────────►│──────────────────────────────────────────┘              │
  (Port 5000)     │                                          │ (Flyway &    │
                  │                                          ▼  JPA)        │
                  │                       ┌─────────────────────┐           │
                  │                       │  MySQL 8.4 Database │           │
                  │                       │  (Volume storage)   │           │
                  │                       └──────────▲──────────┘           │
                  │                                  │ (Automated dumps)    │
                  │                       ┌──────────┴──────────┐           │
                  │                       │  Backup Service     │           │
                  │                       └─────────────────────┘           │
                  └─────────────────────────────────────────────────────────┘
```

---

## Step 1: Create an Azure Virtual Machine

1. Log in to the [Azure Portal](https://portal.azure.com/).
2. Search for **Virtual Machines** and click **Create** > **Azure virtual machine**.
3. Configure the VM basics:
   - **Subscription / Resource Group**: Select or create a resource group (e.g. `rg-club-management`).
   - **Virtual machine name**: e.g. `vm-club-management`.
   - **Region**: Choose a region near you or your users (e.g., `East US`, `Southeast Asia`).
   - **Image**: **Ubuntu Server 22.04 LTS - x64** or **Ubuntu Server 24.04 LTS**.
   - **Size**: **Standard_B2s** (2 vCPUs, 4 GiB memory) or **Standard_B2ms** (2 vCPUs, 8 GiB memory).
     *(Tip: 4GB+ RAM is strongly recommended because building the Spring Boot Java backend and Vite frontend requires memory).*
   - **Authentication type**: **SSH public key** (recommended) or **Password**.
   - **Username**: `azureuser`
4. **Networking (Inbound Port Rules)**:
   Under **Inbound port rules**, allow:
   - **SSH (22)**
   - **HTTP (80)**
   - **HTTPS (443)** *(if planning SSL)*
   *(We will open Port 5000 / 8080 in the Network Security Group next).*
5. Click **Review + create** and launch the VM.

---

## Step 2: Configure Azure Network Security Group (NSG)

Your frontend and backend need their network ports opened in Azure:

1. In the Azure Portal, navigate to your Virtual Machine.
2. In the left menu, select **Networking** (or **Network settings**).
3. Under **Inbound port rules**, click **Add inbound port rule**:
   - **Service**: Custom
   - **Destination port ranges**: `5000` (Backend API)
   - **Protocol**: Any or TCP
   - **Action**: Allow
   - **Priority**: `1010`
   - **Name**: `Allow-Backend-5000`
   - Click **Add**.
4. If keeping the default frontend port `8080` (instead of standard `80`):
   - Add another rule for Port `8080`, Priority `1020`, Name `Allow-Frontend-8080`.
5. *(Optional but Recommended)* Configure a DNS name:
   - On the VM **Overview** page, click the link next to **DNS name** (or on the Public IP address).
   - Set a **DNS name label** (e.g., `myclubapp`), giving you:
     `myclubapp.<region>.cloudapp.azure.com`.

---

## Step 3: Connect to the VM and Install Docker

1. Open your terminal (PowerShell, WSL, or Command Prompt) and connect via SSH:
   ```bash
   ssh azureuser@<YOUR_VM_PUBLIC_IP>
   ```

2. **Add Swap Space** (Essential to prevent out-of-memory errors during Docker builds on burstable VMs):
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

3. **Install Docker and Docker Compose Plugin**:
   ```bash
   sudo apt-get update
   sudo apt-get install -y ca-certificates curl gnupg git
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   sudo chmod a+r /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo usermod -aG docker $USER
   ```

4. Apply the Docker group changes without logging out:
   ```bash
   newgrp docker
   ```
   Verify installation:
   ```bash
   docker --version
   docker compose version
   ```

---

## Step 4: Clone the Project and Configure Environment

1. Clone your repository:
   ```bash
   git clone <YOUR_GIT_REPOSITORY_URL>
   cd student-club-society-management
   ```

2. Create the production `.env` file:
   ```bash
   cp .env.example .env
   nano .env
   ```

3. Fill in the values in `.env`:
   ```dotenv
   # Strong database passwords
   MYSQL_ROOT_PASSWORD=ChooseAStrongRootPassword123!
   DB_USERNAME=club_app
   DB_PASSWORD=ChooseAStrongDbPassword123!

   # Random 32+ character JWT secret (generate using: openssl rand -hex 32)
   JWT_SECRET=paste_your_generated_random_secret_here

   # Public addresses (replace with your Azure VM public IP or Azure DNS name)
   # If frontend is on port 8080:
   FRONTEND_URL=http://<VM_PUBLIC_IP_OR_DNS>:8080
   # Specify all origins accessing the API (comma-separated, supports DNS and IP):
   CORS_ALLOWED_ORIGINS=http://<VM_DNS>:8080,http://<VM_PUBLIC_IP>:8080
   VITE_API_BASE_URL=http://<VM_PUBLIC_IP_OR_DNS>:5000/api

   # If mapping frontend to port 80:
   # FRONTEND_URL=http://<VM_PUBLIC_IP_OR_DNS>
   # CORS_ALLOWED_ORIGINS=http://<VM_DNS>,http://<VM_PUBLIC_IP>
   # VITE_API_BASE_URL=http://<VM_PUBLIC_IP_OR_DNS>:5000/api

   # Initial Super Admin creation on first startup
   SEED_DEMO_DATA=false
   JPA_DDL_AUTO=validate
   REQUIRE_EMAIL_VERIFICATION=false
   TRUST_FORWARDED_HEADERS=false
   BOOTSTRAP_ADMIN_EMAIL=admin@yourclub.com
   BOOTSTRAP_ADMIN_PASSWORD=AdminStrongPassword123!

   # Optional email credentials (Gmail app password or SMTP)
   MAIL_USERNAME=
   MAIL_PASSWORD=

   # Automated daily database backup retention
   BACKUP_INTERVAL_SECONDS=86400
   BACKUP_KEEP=14
   ```
   Save and exit `nano` (`Ctrl + O`, `Enter`, `Ctrl + X`).

---

## Step 5: (Optional) Serve Frontend on Standard Port 80

By default, `docker-compose.yml` serves the frontend on port `8080`. If you prefer accessing the site directly on `http://<VM_PUBLIC_IP>` without typing `:8080`:

Open `docker-compose.yml`:
```bash
nano docker-compose.yml
```
Under `services:` -> `frontend:` -> `ports:`, change:
```yaml
    ports:
      - "80:80"   # was "8080:80"
```
And make sure `FRONTEND_URL` in `.env` is `http://<VM_PUBLIC_IP_OR_DNS>`.

---

## Step 6: Build and Launch the Application

1. Run the build and start all containers in detached mode:
   ```bash
   docker compose up -d --build
   ```
   *(The first build takes 3–5 minutes as Maven downloads dependencies and builds the JAR, and Vite builds the React bundle).*

2. Check the container status:
   ```bash
   docker compose ps
   ```
   You should see:
   - `mysql` (healthy)
   - `backend` (healthy)
   - `frontend` (running)
   - `backup` (running)

3. Inspect live logs:
   ```bash
   docker compose logs -f backend
   ```
   Look for: `Started ClubManagementApplication in ... seconds`. Press `Ctrl + C` to exit logs.

4. Verify backend health endpoint locally on the VM:
   ```bash
   curl http://localhost:5000/api/health
   ```
   Expected response:
   `{"status":"UP","database":"UP",...}`

---

## Step 7: Access the Application

1. Open your browser and navigate to:
   - **Frontend**: `http://<VM_PUBLIC_IP_OR_DNS>:8080` (or port `80` if changed)
   - **Backend API**: `http://<VM_PUBLIC_IP_OR_DNS>:5000/api/health`
2. Log in using the `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` you defined.
3. Once logged in, edit `.env` on the VM and clear `BOOTSTRAP_ADMIN_PASSWORD` for safety:
   ```bash
   nano .env
   # Set BOOTSTRAP_ADMIN_PASSWORD=
   ```

---

## Step 8: Automated CI/CD with Container Images (GHCR)

The automated workflow [.github/workflows/deploy-azure-vm.yml](file:///.github/workflows/deploy-azure-vm.yml) uses a **pure container-image architecture**:

1. **Job 1 (Build & Push)**:
   - GitHub Actions runners compile the Spring Boot backend and Vite frontend in the cloud.
   - Pushes immutable, version-tagged Docker container images to **GitHub Container Registry (GHCR)**:
     - `ghcr.io/<owner>/student-club-society-management-backend:latest`
     - `ghcr.io/<owner>/student-club-society-management-frontend:latest`
2. **Job 2 (Deploy to Azure VM)**:
   - Connects to your Azure VM over SSH.
   - Pulls the pre-built images with `docker compose -f docker-compose.prod.yml pull`.
   - Starts containers immediately without any compiling or Maven/npm overhead on the VM.
   - Verifies health check on `/api/health`.

### 1. Add Secrets to GitHub

In your GitHub repository:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add the following:

| Secret Name | Value | Description |
|---|---|---|
| `AZURE_VM_HOST` | `<VM_PUBLIC_IP_OR_DNS>` | Your Azure VM Public IP (e.g. `20.xxx.xxx.xxx`) |
| `AZURE_VM_USERNAME` | `azureuser` | The SSH username you use to log into the VM |
| `AZURE_VM_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY...` | Contents of your private key `.pem` file *(Leave empty if using password)* |
| `AZURE_VM_PASSWORD` | `<VM_PASSWORD>` | *(Only needed if you use password auth instead of an SSH key)* |

### 2. Routine Updates
Every time you `git push origin main`, GitHub Actions automatically builds the new container images, pushes them to GHCR, and updates the running containers on your VM within seconds.

---

## Routine Operations & Maintenance

### Pulling Updates / Redeploying
When you push code updates to Git:
```bash
cd ~/student-club-society-management
git pull origin main
docker compose up -d --build
```

### Checking Backups
Automated dumps are created daily in `./backups/`:
```bash
ls -lh backups/
```
To run an immediate manual backup:
```bash
docker compose exec backup sh /backup.sh
```

### Restoring Database
To restore from a dump:
```bash
./scripts/restore.sh backups/club_management-<timestamp>.sql.gz
```

### Viewing Logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql
```

---

## Troubleshooting

### CORS errors when accessing via Azure DNS or IP
If you see errors such as:
`Access to XMLHttpRequest at 'http://<VM_IP>:5000/api/auth/login' from origin 'http://<VM_DNS>:8080' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.`

1. Open `.env` on your Azure VM:
   ```bash
   nano ~/student-club-society-management/.env
   ```
2. Update `CORS_ALLOWED_ORIGINS` to include both your Azure DNS domain and public IP:
   ```dotenv
   CORS_ALLOWED_ORIGINS=http://<VM_DNS>:8080,http://<VM_PUBLIC_IP>:8080,http://localhost:8080
   FRONTEND_URL=http://<VM_DNS>:8080
   ```
3. Restart the backend container:
   ```bash
   docker compose -f docker-compose.prod.yml up -d backend
   ```
