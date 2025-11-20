# Production Deployment Guide

Complete guide for deploying the Final Bell API to production environments.

## Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Deployment Methods](#deployment-methods)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Monitoring and Logging](#monitoring-and-logging)
8. [Backup Strategy](#backup-strategy)
9. [Scaling Considerations](#scaling-considerations)
10. [Security Hardening](#security-hardening)
11. [Troubleshooting](#troubleshooting)

---

## Quick Start Guide

Choose your deployment path based on your needs:

### 🚀 Railway (Recommended for Most Users)

**Best for**: Small to medium projects, startups, quick deployments

- **Pros**: Zero-config deployment, automatic HTTPS, built-in PostgreSQL, $5 free credits/month
- **Cons**: Limited to Railway's infrastructure, less control over database configuration
- **Cost**: ~$10-20/month (includes app + database)
- **Setup Time**: 10-15 minutes

**Quick Steps**:
1. Push your code to GitHub
2. Connect GitHub repo to Railway
3. Add PostgreSQL database in Railway dashboard
4. Set environment variables
5. Deploy automatically

👉 [Jump to Railway Guide](#railway-recommended-for-easy-deployment)

---

### 🏢 AWS RDS + Railway (Production-Grade)

**Best for**: Production applications, enterprise clients, compliance requirements

- **Pros**: Enterprise-grade database, full control, automatic backups, high availability, scalability
- **Cons**: More complex setup, higher cost, requires AWS knowledge
- **Cost**: ~$30-100/month (RDS: $15-80/month, Railway: $10-20/month)
- **Setup Time**: 30-45 minutes

**Quick Steps**:
1. Create AWS RDS PostgreSQL database
2. Configure security groups for Railway access
3. Deploy application to Railway
4. Point Railway app to RDS database
5. Configure backups and monitoring

👉 [Jump to AWS RDS + Railway Guide](#aws-rds--railway-deployment-production-grade)

---

### 📊 Deployment Comparison

| Feature | Railway Only | AWS RDS + Railway |
|---------|--------------|-------------------|
| Setup Complexity | ⭐ Easy | ⭐⭐⭐ Moderate |
| Database Control | Limited | Full Control |
| Backups | Automatic (7 days) | Customizable (1-35 days) |
| High Availability | Single region | Multi-AZ support |
| Performance Monitoring | Basic | Advanced (CloudWatch, Performance Insights) |
| Scalability | Automatic | Manual + Auto-scaling |
| SSL/TLS | Automatic | Configurable |
| Cost (monthly) | $10-20 | $30-100 |
| Best For | MVP, Startups | Production, Enterprise |

---

### 🔧 Other Deployment Options

- **Docker Compose (Self-Hosted)**: Full control, requires server management → [Guide](#option-1-docker-compose-recommended-for-single-server)
- **Kubernetes**: Large-scale deployments with auto-scaling → [Guide](#option-2-kubernetes-recommended-for-large-scale)
- **Render.com**: Similar to Railway with different pricing → [Guide](#rendercom)
- **DigitalOcean App Platform**: Managed deployment with DigitalOcean → [Guide](#digitalocean-app-platform)

---

## Pre-Deployment Checklist

Before deploying to production, ensure you have:

- [ ] Production database provisioned (PostgreSQL 15+ or MySQL 8.0+)
- [ ] Domain name configured with DNS pointing to your server
- [ ] SSL/TLS certificates (Let's Encrypt recommended)
- [ ] All required environment variables documented
- [ ] Backup strategy in place
- [ ] Monitoring tools configured
- [ ] Security audit completed
- [ ] Load testing performed
- [ ] CI/CD pipeline tested
- [ ] Rollback plan documented

---

## Environment Configuration

### Required Environment Variables

Create a production `.env` file with the following variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=8080

# Database Configuration (PostgreSQL or MySQL)
# PostgreSQL (recommended)
DATABASE_URL="postgresql://username:password@host:5432/database_name?schema=public"
# MySQL (alternative)
# DATABASE_URL="mysql://username:password@host:3306/database_name"

# JWT Configuration (CRITICAL - Generate strong secrets)
JWT_SECRET=<generate-with-openssl-rand-base64-64>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<generate-with-openssl-rand-base64-64>
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS Configuration
ALLOWED_ORIGINS=https://finalbell.co.uk,https://www.finalbell.co.uk,https://app.finalbell.co.uk
CLIENT_URL=https://finalbell.co.uk

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# FTP Configuration (for CSV sync)
PLAYWELL_FTP_HOST=161.35.45.163
PLAYWELL_FTP_USER=your-ftp-username
PLAYWELL_FTP_PASSWORD=your-ftp-password

# Admin API Key
ADMIN_API_KEY=<generate-with-openssl-rand-base64-32>

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Optional: Cloud Storage (AWS S3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-west-2
AWS_S3_BUCKET=

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@finalbell.co.uk

# IP Blacklist
IP_BLACKLIST_ENABLED=true
IP_BLACKLIST_UPDATE_INTERVAL_HOURS=24
```

### Generating Secure Secrets

```bash
# Generate JWT secrets (minimum 64 characters recommended)
openssl rand -base64 64

# Generate API keys (32 characters)
openssl rand -base64 32

# Generate hex secrets
openssl rand -hex 32
```

---

## Database Setup

The Final Bell API supports both **PostgreSQL** (recommended) and **MySQL**. Choose based on your requirements:

- **PostgreSQL**: Better for complex queries, JSON support, and modern features
- **MySQL**: Wider hosting support, potentially lower cost

### Option 1: Managed PostgreSQL (Recommended)

Use a managed PostgreSQL service for production:

- **AWS RDS PostgreSQL** - Enterprise-grade, highly configurable
- **Railway PostgreSQL** - Easy setup, included with Railway deployment
- **Render PostgreSQL** - Simple managed service
- **DigitalOcean Managed PostgreSQL** - Good balance of features and cost
- **Google Cloud SQL PostgreSQL** - GCP integration
- **Azure Database for PostgreSQL** - Azure integration
- **Supabase** - PostgreSQL with additional features

#### Configuration Steps (AWS RDS PostgreSQL):

1. **Provision Database**
   ```bash
   # AWS RDS PostgreSQL configuration
   - Engine: PostgreSQL 15 or higher
   - Instance class: db.t3.micro (free tier) or db.t3.small (production)
   - Storage: 20GB minimum (auto-scaling enabled)
   - Multi-AZ: Enabled for high availability (production)
   - Backup retention: 7-30 days
   ```

2. **Configure Security Groups**
   - Allow inbound traffic on port 5432 from your application servers
   - For Railway: Allow 0.0.0.0/0 (Railway uses dynamic IPs)
   - Enable SSL/TLS connections

3. **Update Connection String**
   ```bash
   DATABASE_URL="postgresql://username:password@rds-endpoint.region.rds.amazonaws.com:5432/final_bell_db?schema=public&sslmode=require"
   ```

### Option 2: Managed MySQL (Alternative)

Use a managed MySQL service for production:

- **AWS RDS MySQL**
- **PlanetScale** - MySQL-compatible with built-in scaling
- **DigitalOcean Managed MySQL**
- **Google Cloud SQL MySQL**
- **Azure Database for MySQL**

#### Configuration Steps (AWS RDS MySQL):

1. **Provision Database**
   ```bash
   # Example: AWS RDS MySQL
   - Engine: MySQL 8.0 or higher
   - Instance class: db.t3.medium or higher
   - Storage: 100GB minimum (auto-scaling enabled)
   - Multi-AZ: Enabled for high availability
   - Backup retention: 7-30 days
   ```

2. **Configure Security Groups**
   - Allow inbound traffic on port 3306 from your application servers only
   - Enable SSL/TLS connections

3. **Update Connection String**
   ```bash
   DATABASE_URL="mysql://username:password@rds-endpoint.region.rds.amazonaws.com:3306/final_bell_db?sslaccept=strict"
   ```

4. **Update Prisma Schema**

   Change the datasource in [prisma/schema.prisma](prisma/schema.prisma):

   ```prisma
   datasource db {
     provider = "mysql"  // Change from "postgresql" to "mysql"
     url      = env("DATABASE_URL")
   }
   ```

### Option 3: Self-Hosted PostgreSQL

If hosting your own PostgreSQL server:

```bash
# Install PostgreSQL 15
sudo apt update
sudo apt install postgresql-15 postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE final_bell_db;
CREATE USER finalbell WITH PASSWORD 'strong-password-here';
GRANT ALL PRIVILEGES ON DATABASE final_bell_db TO finalbell;
\q
```

### Option 4: Self-Hosted MySQL

If hosting your own MySQL server:

```bash
# Install MySQL 8.0
sudo apt update
sudo apt install mysql-server

# Secure MySQL installation
sudo mysql_secure_installation

# Create database and user
sudo mysql -u root -p
```

```sql
CREATE DATABASE final_bell_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'finalbell'@'%' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON final_bell_db.* TO 'finalbell'@'%';
FLUSH PRIVILEGES;
```

### Database Migrations

Run migrations on production database:

```bash
# Deploy pending migrations (safe for production)
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status

# Generate Prisma Client
npx prisma generate
```

**IMPORTANT**: Never use `prisma migrate dev` in production. Always use `migrate deploy`.

### Database Optimization

```sql
-- Enable slow query log for monitoring
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- Configure connection pooling
SET GLOBAL max_connections = 500;
SET GLOBAL wait_timeout = 600;

-- Optimize InnoDB settings
SET GLOBAL innodb_buffer_pool_size = 2G;
SET GLOBAL innodb_log_file_size = 512M;
```

---

## Deployment Methods

### Option 1: Docker Compose (Recommended for Single Server)

**Best for**: Small to medium deployments on a single server or VPS.

#### 1. Install Docker

```bash
# Install Docker on Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin
```

#### 2. Prepare Server

```bash
# Create application directory
sudo mkdir -p /opt/final-bell-api
cd /opt/final-bell-api

# Clone repository
git clone <your-repo-url> .

# Create production .env file
sudo nano .env
# Add all production environment variables
```

#### 3. Deploy with Docker Compose

```bash
# Build and start services
sudo docker compose up -d

# View logs
sudo docker compose logs -f api

# Check status
sudo docker compose ps

# Stop services
sudo docker compose down

# Update deployment
git pull
sudo docker compose build
sudo docker compose up -d
```

#### 4. Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/final-bell-api
```

Add the following configuration:

```nginx
upstream final_bell_api {
    server 127.0.0.1:8080;
    keepalive 64;
}

server {
    listen 80;
    server_name api.finalbell.co.uk;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.finalbell.co.uk;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.finalbell.co.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.finalbell.co.uk/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size (for file uploads)
    client_max_body_size 10M;

    # Logging
    access_log /var/log/nginx/final-bell-api-access.log;
    error_log /var/log/nginx/final-bell-api-error.log;

    # Proxy settings
    location / {
        proxy_pass http://final_bell_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no auth required)
    location /health {
        proxy_pass http://final_bell_api;
        access_log off;
    }
}
```

Enable the site:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/final-bell-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

### Option 2: Kubernetes (Recommended for Large Scale)

**Best for**: Large-scale deployments requiring auto-scaling and high availability.

#### Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or self-hosted)
- kubectl configured
- Helm installed (optional but recommended)

#### 1. Create Kubernetes Manifests

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: final-bell-api
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: final-bell-api
  template:
    metadata:
      labels:
        app: final-bell-api
        version: v1
    spec:
      containers:
      - name: api
        image: your-registry/final-bell-api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "8080"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: final-bell-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: final-bell-secrets
              key: jwt-secret
        - name: REFRESH_TOKEN_SECRET
          valueFrom:
            secretKeyRef:
              name: final-bell-secrets
              key: refresh-token-secret
        - name: STRIPE_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: final-bell-secrets
              key: stripe-secret-key
        - name: ALLOWED_ORIGINS
          value: "https://finalbell.co.uk,https://www.finalbell.co.uk"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
      imagePullSecrets:
      - name: registry-credentials
```

Create `k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: final-bell-api
  namespace: production
spec:
  type: ClusterIP
  selector:
    app: final-bell-api
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
```

Create `k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: final-bell-api
  namespace: production
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.finalbell.co.uk
    secretName: final-bell-api-tls
  rules:
  - host: api.finalbell.co.uk
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: final-bell-api
            port:
              number: 80
```

Create `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: final-bell-secrets
  namespace: production
type: Opaque
stringData:
  database-url: "mysql://user:pass@host:3306/db"
  jwt-secret: "your-jwt-secret"
  refresh-token-secret: "your-refresh-token-secret"
  stripe-secret-key: "sk_live_xxxxx"
```

Create `k8s/hpa.yaml` (Horizontal Pod Autoscaler):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: final-bell-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: final-bell-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### 2. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace production

# Apply secrets (do this first!)
kubectl apply -f k8s/secrets.yaml

# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n production
kubectl get services -n production
kubectl get ingress -n production

# View logs
kubectl logs -f deployment/final-bell-api -n production

# Scale manually
kubectl scale deployment final-bell-api --replicas=5 -n production

# Rollout status
kubectl rollout status deployment/final-bell-api -n production

# Rollback if needed
kubectl rollout undo deployment/final-bell-api -n production
```

---

### Option 3: Platform-as-a-Service (Easiest)

**Best for**: Quick deployments with minimal DevOps overhead.

---

#### Railway (Recommended for Easy Deployment)

Railway is an excellent choice for deploying the Final Bell API with minimal configuration. It provides automatic HTTPS, zero-config deployments, and seamless database integration.

##### Step 1: Create Railway Account and Install CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

##### Step 2: Deploy via Railway Dashboard (Recommended)

1. **Create New Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account and select the `final-bell-api` repository
   - Railway will automatically detect the Dockerfile

2. **Add PostgreSQL Database**
   - In your Railway project, click "New"
   - Select "Database" → "Add PostgreSQL"
   - Railway automatically provisions a PostgreSQL database
   - The `DATABASE_URL` environment variable is automatically set

3. **Configure Environment Variables**
   - Click on your service → "Variables" tab
   - Add the following environment variables:

   ```bash
   NODE_ENV=production
   PORT=8080

   # Database (automatically set by Railway, but verify)
   DATABASE_URL=${{Postgres.DATABASE_URL}}

   # JWT Configuration (generate strong secrets)
   JWT_SECRET=<generate-with-openssl-rand-base64-64>
   JWT_EXPIRES_IN=15m
   REFRESH_TOKEN_SECRET=<generate-with-openssl-rand-base64-64>
   REFRESH_TOKEN_EXPIRES_IN=7d

   # CORS Configuration
   ALLOWED_ORIGINS=https://finalbell.co.uk,https://www.finalbell.co.uk,https://app.finalbell.co.uk
   CLIENT_URL=https://finalbell.co.uk

   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_live_xxxxx
   STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx

   # FTP Configuration (for CSV sync)
   PLAYWELL_FTP_HOST=161.35.45.163
   PLAYWELL_FTP_USER=your-ftp-username
   PLAYWELL_FTP_PASSWORD=your-ftp-password

   # Admin API Key
   ADMIN_API_KEY=<generate-with-openssl-rand-base64-32>

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # File Upload
   MAX_FILE_SIZE=10485760
   UPLOAD_DIR=uploads
   ```

4. **Deploy Application**
   - Railway automatically builds and deploys your application
   - Monitor the build logs in the "Deployments" tab
   - Once deployed, Railway provides a public URL: `https://your-app.up.railway.app`

5. **Run Database Migrations**
   - After first deployment, run migrations manually:
   - Click on your service → "Settings" → "One-off Commands"
   - Or use Railway CLI:

   ```bash
   railway run npx prisma migrate deploy
   ```

6. **Setup Custom Domain (Optional)**
   - Go to "Settings" → "Domains"
   - Click "Add Domain"
   - Add your custom domain: `api.finalbell.co.uk`
   - Update your DNS records as shown by Railway
   - Railway automatically provisions SSL certificates

##### Step 3: Deploy via Railway CLI (Alternative)

```bash
# Initialize Railway project
cd final-bell-api
railway init

# Link to existing project (if already created)
railway link

# Add PostgreSQL database
railway add --database postgresql

# Set environment variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(openssl rand -base64 64)
railway variables set REFRESH_TOKEN_SECRET=$(openssl rand -base64 64)
# ... set all other variables

# Deploy
railway up

# Run migrations
railway run npx prisma migrate deploy

# View logs
railway logs

# Open in browser
railway open
```

##### Step 4: Configure Automatic Deployments

Railway automatically deploys on every push to your main branch:

1. Go to "Settings" → "Service"
2. Configure deployment settings:
   - **Watch Paths**: Leave default (all files)
   - **Root Directory**: Leave blank
   - **Build Command**: Automatic (uses Dockerfile)
   - **Start Command**: Automatic (uses Dockerfile CMD)

##### Step 5: Monitoring and Scaling

**View Metrics:**
- Click on your service → "Metrics" tab
- Monitor CPU, Memory, and Network usage

**Scaling:**
- Railway automatically scales based on usage
- For custom scaling, go to "Settings" → "Resources"
- Adjust memory and CPU limits as needed

**Health Checks:**
- Railway automatically monitors your `/health` endpoint
- Configure custom health checks in "Settings" → "Health Checks"

##### Railway Pricing

- **Free Tier**: $5 of usage credits per month
- **Hobby Plan**: $5/month + usage-based pricing
- **Pro Plan**: $20/month + usage-based pricing
- PostgreSQL database: ~$5-10/month based on usage

---

#### AWS RDS + Railway Deployment (Production-Grade)

For production deployments requiring enterprise-grade database reliability, use AWS RDS for the database and Railway for the application.

##### Step 1: Setup AWS RDS PostgreSQL Database

1. **Login to AWS Console**
   - Navigate to [AWS RDS Console](https://console.aws.amazon.com/rds/)
   - Select your preferred region (e.g., `us-east-1` or `eu-west-2`)

2. **Create Database**
   - Click "Create database"
   - Choose database creation method: **Standard create**

   **Engine options:**
   - Engine type: **PostgreSQL**
   - Version: **PostgreSQL 15** or latest

   **Templates:**
   - For development/testing: **Free tier** (limited availability)
   - For production: **Production** (recommended)

   **Settings:**
   - DB instance identifier: `final-bell-db`
   - Master username: `finalbell_admin`
   - Master password: Create a strong password and save it securely
   - Confirm password

   **DB Instance Configuration:**
   - DB instance class:
     - Dev/Test: `db.t3.micro` (free tier eligible)
     - Production: `db.t3.small` or `db.t3.medium`
   - Storage type: **General Purpose SSD (gp3)**
   - Allocated storage: **20 GB** minimum (can auto-scale)
   - Enable storage autoscaling: ✓ (max 100 GB)

   **Connectivity:**
   - Compute resource: **Don't connect to an EC2 compute resource**
   - VPC: Default VPC or create new
   - Subnet group: Default or create new
   - Public access: **Yes** (for Railway to connect)
   - VPC security group: Create new
     - Name: `final-bell-db-sg`
   - Availability Zone: No preference
   - Database port: **5432**

   **Database authentication:**
   - Authentication: **Password authentication**

   **Additional configuration:**
   - Initial database name: `final_bell_db`
   - Backup:
     - Enable automated backups: ✓
     - Backup retention period: 7 days (production: 30 days)
     - Backup window: Choose off-peak hours
   - Encryption: Enable encryption at rest ✓
   - Monitoring:
     - Enable Enhanced Monitoring: ✓ (production)
     - Granularity: 60 seconds
   - Maintenance:
     - Enable auto minor version upgrade: ✓
     - Maintenance window: Choose off-peak hours
   - Deletion protection: ✓ (Enable for production)

3. **Configure Security Group**
   - After database is created, click on the DB instance
   - Go to "Connectivity & security" tab
   - Click on the VPC security group
   - Click "Edit inbound rules"
   - Add rule:
     - Type: **PostgreSQL**
     - Protocol: **TCP**
     - Port: **5432**
     - Source:
       - For Railway: **0.0.0.0/0** (allow from anywhere - Railway uses dynamic IPs)
       - For specific IPs: Add your application server IPs
     - Description: `Railway application access`
   - **Important**: For production, restrict to specific IP ranges or use VPC peering

4. **Get Connection Details**
   - In RDS console, click on your database instance
   - Under "Connectivity & security":
     - **Endpoint**: `final-bell-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com`
     - **Port**: `5432`

   - Create connection string:
   ```bash
   DATABASE_URL="postgresql://finalbell_admin:YOUR_PASSWORD@final-bell-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com:5432/final_bell_db?schema=public&connection_limit=10&pool_timeout=20"
   ```

5. **Test Connection**
   ```bash
   # Using psql
   psql "postgresql://finalbell_admin:YOUR_PASSWORD@final-bell-db.xxxxxxxxxx.us-east-1.rds.amazonaws.com:5432/final_bell_db"

   # Or using Prisma
   npx prisma db pull
   ```

6. **Setup Connection Pooling (Optional but Recommended)**

   For production, use Amazon RDS Proxy for connection pooling:

   - In RDS console, click "Proxies" → "Create proxy"
   - Proxy identifier: `final-bell-proxy`
   - Engine family: PostgreSQL
   - Target group: Select your RDS instance
   - Connection pool configuration:
     - Max connections percentage: 100%
     - Max idle connections: 50%
   - IAM authentication: Optional
   - Secrets Manager: Select existing or create new secret

   Update connection string to use proxy endpoint:
   ```bash
   DATABASE_URL="postgresql://finalbell_admin:PASSWORD@final-bell-proxy.proxy-xxxxxxxxxx.us-east-1.rds.amazonaws.com:5432/final_bell_db"
   ```

##### Step 2: Deploy Application to Railway

1. **Create Railway Project** (as described in Railway section above)

2. **Configure Environment Variables**
   - Set the AWS RDS `DATABASE_URL` from Step 1
   - Add all other required environment variables

3. **Deploy Application**
   ```bash
   railway up
   ```

4. **Run Database Migrations**
   ```bash
   # Connect to AWS RDS and run migrations
   railway run npx prisma migrate deploy

   # Verify migration
   railway run npx prisma migrate status
   ```

##### Step 3: AWS RDS Best Practices

**Security:**
- Enable SSL/TLS connections:
  ```bash
  DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
  ```
- Rotate passwords regularly
- Use AWS Secrets Manager for credential management
- Enable VPC peering for Railway (contact Railway support)

**Performance:**
- Enable Performance Insights
- Monitor slow queries in RDS console
- Configure appropriate instance size based on load
- Use read replicas for high-read workloads

**Backup & Recovery:**
- Test restore process monthly
- Enable automated backups with 30-day retention
- Create manual snapshots before major changes
- Consider cross-region backup replication

**Cost Optimization:**
- Use Reserved Instances for production (up to 60% savings)
- Enable storage autoscaling to avoid over-provisioning
- Schedule dev/test databases to stop during off-hours
- Monitor CloudWatch metrics to right-size instances

---

#### Render.com

1. **Connect Repository**
   - Go to Render dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service**
   ```
   Name: final-bell-api
   Environment: Docker
   Region: Choose closest to users
   Instance Type: Standard or higher
   ```

3. **Add PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Name: `final-bell-db`
   - Database: `final_bell_db`
   - User: `finalbell`
   - Region: Same as web service
   - Plan: Starter ($7/month) or higher

4. **Add Environment Variables**
   - In your web service, go to "Environment"
   - Add `DATABASE_URL` (Render provides this automatically if you link the database)
   - Add all other variables from your `.env.example`

5. **Deploy**
   - Render automatically builds and deploys on git push
   - Access your app at: `https://final-bell-api.onrender.com`

---

#### Heroku (Legacy Platform)

**Note**: Heroku ended its free tier. Consider Railway or Render for better pricing.

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Create App**
   ```bash
   heroku create final-bell-api

   # Add PostgreSQL addon
   heroku addons:create heroku-postgresql:mini
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=$(openssl rand -base64 64)
   heroku config:set REFRESH_TOKEN_SECRET=$(openssl rand -base64 64)
   # ... set all other variables
   ```

4. **Deploy**
   ```bash
   git push heroku master

   # Run migrations
   heroku run npx prisma migrate deploy

   # Check logs
   heroku logs --tail
   ```

---

#### DigitalOcean App Platform

1. **Create App**
   - Go to DigitalOcean App Platform
   - Click "Create App"
   - Connect GitHub repository

2. **Configure**
   - Select Dockerfile deployment
   - Add environment variables
   - Choose instance size:
     - Basic: $5/month (512MB RAM)
     - Professional: $12/month (1GB RAM)

3. **Add Database**
   - Click "Add Resource" → "Database"
   - Choose PostgreSQL
   - Plan: Basic ($15/month) or higher
   - Copy connection string to `DATABASE_URL`

4. **Deploy**
   - Automatic deployment on git push
   - Access at: `https://final-bell-api-xxxxx.ondigitalocean.app`

---

## SSL/TLS Configuration

### Option 1: Let's Encrypt (Free, Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.finalbell.co.uk

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

### Option 2: Cloudflare (Free, with CDN)

1. Add your domain to Cloudflare
2. Update nameservers
3. Set SSL/TLS mode to "Full (strict)"
4. Enable "Always Use HTTPS"
5. Configure Firewall Rules

### SSL Best Practices

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;

# HSTS
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/api.finalbell.co.uk/chain.pem;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

---

## Monitoring and Logging

### Application Monitoring

#### Option 1: PM2 (Node.js Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start application with PM2
pm2 start dist/server.js --name final-bell-api

# Enable startup script
pm2 startup
pm2 save

# Monitoring commands
pm2 status
pm2 logs final-bell-api
pm2 monit
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'final-bell-api',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G'
  }]
};
```

#### Option 2: Application Performance Monitoring (APM)

**New Relic:**

```bash
npm install newrelic

# Add to server.ts at the very top
require('newrelic');
```

**Datadog:**

```bash
npm install dd-trace

# Add to server.ts
const tracer = require('dd-trace').init();
```

**Sentry (Error Tracking):**

```bash
npm install @sentry/node

# Add to server.ts
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### Log Management

#### Centralized Logging with ELK Stack

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: elasticsearch:8.10.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"
    volumes:
      - es_data:/usr/share/elasticsearch/data

  logstash:
    image: logstash:8.10.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:8.10.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  es_data:
```

#### Simple File-Based Logging

Add Winston logger:

```bash
npm install winston winston-daily-rotate-file
```

Create `src/utils/logger.ts`:

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
```

### Health Checks

The API includes a `/health` endpoint. Monitor it with:

```bash
# Simple health check script
#!/bin/bash
HEALTH_URL="https://api.finalbell.co.uk/health"

if curl -f -s "$HEALTH_URL" > /dev/null; then
  echo "API is healthy"
  exit 0
else
  echo "API is down!"
  exit 1
fi
```

Set up cron job:

```bash
# Edit crontab
crontab -e

# Add health check every 5 minutes
*/5 * * * * /opt/final-bell-api/health-check.sh || /opt/final-bell-api/alert.sh
```

### Uptime Monitoring Services

Free options:
- **UptimeRobot** - 50 monitors free
- **Pingdom** - Free tier available
- **StatusCake** - Unlimited free checks
- **Better Uptime** - Free tier

---

## Backup Strategy

### Database Backups

#### Automated MySQL Backups

Create `/opt/scripts/backup-db.sh`:

```bash
#!/bin/bash

# Configuration
DB_HOST="localhost"
DB_USER="finalbell"
DB_PASS="your-password"
DB_NAME="final_bell_db"
BACKUP_DIR="/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  "$DB_NAME" | gzip > "$BACKUP_DIR/backup_${DATE}.sql.gz"

# Remove old backups
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: backup_${DATE}.sql.gz"
```

Set up cron job:

```bash
# Daily backups at 2 AM
0 2 * * * /opt/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
```

#### Backup to S3

```bash
#!/bin/bash

# ... previous backup script ...

# Upload to S3
aws s3 cp "$BACKUP_DIR/backup_${DATE}.sql.gz" \
  s3://your-bucket/backups/final-bell-api/ \
  --storage-class STANDARD_IA

echo "Backup uploaded to S3"
```

### Application Data Backups

```bash
# Backup CSV data and uploads
tar -czf /backups/data_${DATE}.tar.gz /app/data /app/uploads

# Upload to S3
aws s3 cp /backups/data_${DATE}.tar.gz s3://your-bucket/backups/
```

### Disaster Recovery Plan

1. **Regular Testing**
   - Test restore process monthly
   - Document restore procedures
   - Verify backup integrity

2. **Restore Process**

```bash
# Restore from backup
gunzip < backup_20250110_020000.sql.gz | mysql -u finalbell -p final_bell_db

# Verify restoration
mysql -u finalbell -p -e "SELECT COUNT(*) FROM User;" final_bell_db

# Restart application
docker compose restart api
```

3. **RTO/RPO Targets**
   - **RTO (Recovery Time Objective)**: 4 hours
   - **RPO (Recovery Point Objective)**: 24 hours

---

## Scaling Considerations

### Vertical Scaling (Scale Up)

Upgrade server resources:

```
Small:  2 CPU, 4GB RAM  (100 users)
Medium: 4 CPU, 8GB RAM  (500 users)
Large:  8 CPU, 16GB RAM (2000+ users)
```

### Horizontal Scaling (Scale Out)

#### Load Balancer Configuration

```nginx
# /etc/nginx/nginx.conf
upstream api_backend {
    least_conn;  # Load balancing method

    server 10.0.1.10:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 max_fails=3 fail_timeout=30s;

    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.finalbell.co.uk;

    location / {
        proxy_pass http://api_backend;
        # ... other proxy settings
    }
}
```

#### Session Management

Use Redis for session storage across multiple instances:

```bash
npm install connect-redis redis
```

```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

### Database Scaling

#### Read Replicas

```typescript
// Multiple database connections
const primaryDB = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
});

const replicaDB = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_REPLICA_URL }
  }
});

// Use replica for reads
const users = await replicaDB.user.findMany();

// Use primary for writes
await primaryDB.user.create({ data: {...} });
```

#### Connection Pooling

```typescript
// prisma/schema.prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")

  // Connection pool settings
  relationMode = "prisma"
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}

// In production
DATABASE_URL="mysql://user:pass@host:3306/db?connection_limit=20&pool_timeout=30"
```

### Caching Strategy

#### Redis Caching

```bash
npm install ioredis
```

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache middleware
const cacheMiddleware = (duration: number) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    const cached = await redis.get(key);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    res.originalJson = res.json;
    res.json = (data) => {
      redis.setex(key, duration, JSON.stringify(data));
      res.originalJson(data);
    };

    next();
  };
};

// Use in routes
app.get('/api/v1/exercises', cacheMiddleware(300), getExercises);
```

---

## Security Hardening

### Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Limit SSH attempts
sudo ufw limit 22/tcp
```

### SSH Hardening

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Recommended settings:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2

# Restart SSH
sudo systemctl restart sshd
```

### Security Headers

Already configured in the application with Helmet.js. Verify at:
- [securityheaders.com](https://securityheaders.com)
- [Mozilla Observatory](https://observatory.mozilla.org)

### Dependency Security

```bash
# Regular security audits
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

### Secrets Management

#### AWS Secrets Manager

```bash
npm install @aws-sdk/client-secrets-manager
```

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'eu-west-2' });

async function getSecret(secretName: string) {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const data = await client.send(command);
  return JSON.parse(data.SecretString);
}
```

#### HashiCorp Vault

```bash
npm install node-vault
```

```typescript
import vault from 'node-vault';

const vaultClient = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN
});

const secrets = await vaultClient.read('secret/final-bell-api');
```

### Rate Limiting (Already Configured)

The API includes rate limiting. For additional protection, use Cloudflare or AWS WAF.

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check database connectivity
mysql -h host -u user -p -e "SELECT 1;"

# Check Prisma connection
npx prisma db pull

# View connection pool stats
SELECT * FROM information_schema.PROCESSLIST;
```

#### 2. High Memory Usage

```bash
# Check memory usage
docker stats

# Check Node.js heap usage
node --inspect dist/server.js

# Increase memory limit
NODE_OPTIONS=--max-old-space-size=4096 node dist/server.js
```

#### 3. Slow API Response

```bash
# Check database slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;

# Enable query logging in Prisma
DATABASE_URL="...?connection_limit=10&pool_timeout=20&query_timeout=5"

# Add APM for detailed performance metrics
```

#### 4. SSL Certificate Issues

```bash
# Renew certificates
sudo certbot renew

# Test SSL configuration
openssl s_client -connect api.finalbell.co.uk:443

# Check certificate expiry
echo | openssl s_client -connect api.finalbell.co.uk:443 2>/dev/null | openssl x509 -noout -dates
```

#### 5. Docker Issues

```bash
# Clean up Docker
docker system prune -a

# View container logs
docker compose logs -f api

# Restart container
docker compose restart api

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Debug Mode

Enable debug logging:

```bash
# .env
NODE_ENV=production
LOG_LEVEL=debug

# Check logs
tail -f logs/combined-2025-11-10.log
```

### Performance Profiling

```bash
# Install clinic.js
npm install -g clinic

# Profile application
clinic doctor -- node dist/server.js

# Flame graph
clinic flame -- node dist/server.js
```

### Database Performance

```sql
-- Identify slow queries
SELECT * FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC LIMIT 10;

-- Check index usage
SHOW INDEX FROM User;

-- Analyze query
EXPLAIN SELECT * FROM User WHERE email = 'test@example.com';
```

---

## Post-Deployment Verification

After deployment, verify:

```bash
# 1. Health check
curl https://api.finalbell.co.uk/health

# 2. API response
curl -X POST https://api.finalbell.co.uk/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# 3. Database connection
mysql -h host -u user -p -e "SHOW TABLES;" final_bell_db

# 4. Check logs for errors
docker compose logs -f api | grep ERROR

# 5. Monitor resource usage
docker stats

# 6. SSL check
curl -I https://api.finalbell.co.uk

# 7. Response time
curl -w "@curl-format.txt" -o /dev/null -s https://api.finalbell.co.uk/health
```

Create `curl-format.txt`:

```
time_namelookup:  %{time_namelookup}s\n
time_connect:     %{time_connect}s\n
time_appconnect:  %{time_appconnect}s\n
time_pretransfer: %{time_pretransfer}s\n
time_redirect:    %{time_redirect}s\n
time_starttransfer: %{time_starttransfer}s\n
----------\n
time_total:       %{time_total}s\n
```

---

## Deployment Checklist

Use this checklist before each production deployment:

- [ ] All tests passing
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Backup completed
- [ ] Monitoring alerts configured
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Dependencies updated
- [ ] Documentation updated
- [ ] Rollback plan ready
- [ ] Team notified
- [ ] Maintenance window scheduled (if needed)

---

## Support and Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check application logs
- Monitor error rates
- Verify backups completed

**Weekly:**
- Review security logs
- Check disk space
- Update dependencies

**Monthly:**
- Security audit
- Performance review
- Backup restoration test
- SSL certificate check

**Quarterly:**
- Disaster recovery drill
- Capacity planning review
- Security penetration test

### Getting Help

- **Documentation**: [README.md](README.md)
- **Issues**: GitHub Issues
- **Support**: support@finalbell.co.uk

---

## Additional Resources

- [Express.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Prisma Production Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Production Checklist](https://www.joyent.com/node-js/production)

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintained by**: Final Bell Development Team
