# Production Deployment Guide

This guide covers deploying the Final Bell API to production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Deployment Options](#deployment-options)
4. [Database Setup](#database-setup)
5. [Security Considerations](#security-considerations)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup Strategy](#backup-strategy)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying to production, ensure you have:

- [ ] **Production database** provisioned (MySQL 8.0+)
- [ ] **Domain name** configured with DNS
- [ ] **SSL certificate** (Let's Encrypt, Cloudflare, or purchased)
- [ ] **Stripe account** set up with live keys
- [ ] **FTP credentials** for Playwell (if using CSV sync)
- [ ] **Environment variables** configured
- [ ] **Git repository** pushed to GitHub/GitLab
- [ ] **Tests passing** (`npm test`)
- [ ] **Build successful** (`npm run build`)

---

## Environment Setup

### Required Environment Variables

Create a `.env` file with production values:

```env
# Server
NODE_ENV=production
PORT=8080

# Database
DATABASE_URL="mysql://user:password@your-db-host:3306/final_bell_db"

# JWT Secrets (Generate with: openssl rand -base64 64)
JWT_SECRET=<your-super-secret-jwt-key-64-bytes>
REFRESH_TOKEN_SECRET=<your-super-secret-refresh-token-key-64-bytes>

# CORS
ALLOWED_ORIGINS=https://finalbell.co.uk,https://www.finalbell.co.uk,https://app.finalbell.co.uk

# Client URL
CLIENT_URL=https://finalbell.co.uk

# Stripe (Live keys from dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Playwell FTP
PLAYWELL_FTP_HOST=161.35.45.163
PLAYWELL_FTP_USER=<your-ftp-username>
PLAYWELL_FTP_PASSWORD=<your-ftp-password>

# Admin API Key (Generate with: openssl rand -base64 32)
ADMIN_API_KEY=<your-secure-api-key>

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Optional: Email (if configured)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your-email>
SMTP_PASSWORD=<your-password>
EMAIL_FROM=noreply@finalbell.co.uk
```

### Generate Secrets

```bash
# JWT Secret (64 bytes)
openssl rand -base64 64

# Refresh Token Secret (64 bytes)
openssl rand -base64 64

# Admin API Key (32 bytes)
openssl rand -base64 32
```

---

## Deployment Options

### Option 1: Docker Compose (Recommended)

**Best for:** VPS servers, dedicated servers

#### Step 1: Prepare Server

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

#### Step 2: Clone Repository

```bash
git clone <your-repo-url>
cd final-bell-api
```

#### Step 3: Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with production values
```

#### Step 4: Deploy

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

#### Step 5: Run Migrations

```bash
docker-compose exec api npx prisma migrate deploy
```

### Option 2: Railway

**Best for:** Quick deployment, automatic scaling

#### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

#### Step 2: Initialize Project

```bash
railway init
railway link
```

#### Step 3: Add MySQL Database

```bash
railway add mysql
```

#### Step 4: Set Environment Variables

```bash
# Set each variable
railway variables set JWT_SECRET=your-secret
railway variables set STRIPE_SECRET_KEY=your-key
# ... etc
```

#### Step 5: Deploy

```bash
railway up
```

### Option 3: DigitalOcean App Platform

**Best for:** Managed infrastructure, auto-scaling

#### Step 1: Connect GitHub

1. Go to DigitalOcean App Platform
2. Create new app
3. Connect your GitHub repository

#### Step 2: Configure Build

- **Build Command**: `npm run build`
- **Run Command**: `npm start`
- **Dockerfile**: Use existing `Dockerfile`

#### Step 3: Add MySQL Database

1. Add a managed MySQL database component
2. Copy connection string to environment variables

#### Step 4: Set Environment Variables

Add all required variables in the App Platform dashboard.

#### Step 5: Deploy

Click "Deploy" - automatic deployments on git push.

### Option 4: AWS EC2 + RDS

**Best for:** Enterprise deployments, full control

#### Step 1: Launch EC2 Instance

```bash
# Ubuntu 22.04 LTS, t3.medium or larger
# Security group: Allow ports 22, 80, 443, 8080
```

#### Step 2: Set Up RDS MySQL

```bash
# Create RDS MySQL instance
# Note the connection string
```

#### Step 3: Configure EC2

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Clone repository
git clone <your-repo-url>
cd final-bell-api

# Install dependencies
npm install

# Build
npm run build
```

#### Step 4: Configure & Start

```bash
# Set up .env
nano .env

# Run migrations
npx prisma migrate deploy

# Start with PM2
pm2 start dist/server.js --name final-bell-api
pm2 save
pm2 startup  # Follow instructions
```

#### Step 5: Set Up Nginx

```nginx
server {
    listen 80;
    server_name api.finalbell.co.uk;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Database Setup

### Run Migrations

```bash
# Docker
docker-compose exec api npx prisma migrate deploy

# Direct
npx prisma migrate deploy
```

### Seed Data (Optional)

```bash
# Create seed script at prisma/seed.ts
npx prisma db seed
```

### Backup Database

```bash
# MySQL dump
mysqldump -u user -p final_bell_db > backup_$(date +%Y%m%d).sql

# Restore
mysql -u user -p final_bell_db < backup_20250101.sql
```

---

## Security Considerations

### 1. SSL/TLS Certificate

```bash
# Using Certbot (Let's Encrypt)
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.finalbell.co.uk
```

### 2. Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

### 3. Environment Variable Security

- **Never commit** `.env` files
- Use **secrets management** (AWS Secrets Manager, Vault)
- **Rotate secrets** regularly

### 4. Database Security

- Use **strong passwords**
- Enable **SSL connections**
- **Whitelist IPs** only
- Regular **backups**

### 5. API Security

- **Rate limiting** enabled ✅
- **CORS** configured ✅
- **Helmet** security headers ✅
- **Input validation** on all endpoints

---

## Monitoring & Logging

### Health Checks

```bash
# Test health endpoint
curl https://api.finalbell.co.uk/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "database": "connected"
}
```

### Log Aggregation

**Option 1: PM2 Logs**

```bash
pm2 logs final-bell-api
pm2 logs --lines 100
```

**Option 2: Docker Logs**

```bash
docker-compose logs -f --tail=100
```

**Option 3: External Services**

- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **DataDog** - Full observability
- **New Relic** - APM

### Uptime Monitoring

- **UptimeRobot** - Free tier available
- **Pingdom** - Advanced monitoring
- **StatusCake** - Global monitoring

---

## Backup Strategy

### Automated Backups

```bash
# Cron job for daily backups
0 2 * * * /usr/bin/mysqldump -u user -p'password' final_bell_db | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz

# Keep only last 30 days
0 3 * * * find /backups -name "db_*.sql.gz" -mtime +30 -delete
```

### CSV Backups

The API automatically backs up CSV files in `data/backups/` with 30-day retention.

### Code Backups

- Git repository on GitHub/GitLab
- Regular commits and tags
- Release branches for production

---

## CI/CD Pipeline

### GitHub Actions (Included)

The repository includes CI/CD workflows:

- **`.github/workflows/ci.yml`** - Tests on every push
- **`.github/workflows/deploy.yml`** - Deploy on merge to master

### Manual Deployment

```bash
# Pull latest code
git pull origin master

# Install dependencies
npm install

# Build
npm run build

# Run migrations
npx prisma migrate deploy

# Restart service
pm2 restart final-bell-api
# OR
docker-compose restart api
```

---

## Stripe Webhook Setup

### 1. Create Webhook Endpoint

In Stripe Dashboard:
1. Go to Developers → Webhooks
2. Add endpoint: `https://api.finalbell.co.uk/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### 2. Copy Webhook Secret

Add to `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Test Webhook

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:8080/stripe/webhook
```

---

## Troubleshooting

### Issue: Database Connection Failed

```bash
# Check connection string
echo $DATABASE_URL

# Test connection
mysql -h host -u user -p database

# Check firewall
telnet host 3306
```

### Issue: FTP Sync Fails

```bash
# Test FTP connection
ftp 161.35.45.163

# Check credentials in .env
echo $PLAYWELL_FTP_USER

# View logs
docker-compose logs api | grep FTP
```

### Issue: High Memory Usage

```bash
# Check memory
free -h

# Restart API
pm2 restart final-bell-api

# Monitor
pm2 monit
```

### Issue: Rate Limiting Too Strict

Adjust in `.env`:
```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=200   # Increase limit
```

---

## Post-Deployment Checklist

- [ ] Health endpoint responding
- [ ] Database migrations applied
- [ ] SSL certificate valid
- [ ] CORS configured for production domains
- [ ] Stripe webhooks receiving events
- [ ] CSV sync running (check logs after 24h)
- [ ] Monitoring/alerting configured
- [ ] Backup jobs scheduled
- [ ] Documentation updated
- [ ] Team notified

---

## Support

For deployment issues:
- Check logs: `docker-compose logs -f` or `pm2 logs`
- Review environment variables
- Test health endpoint
- Check database connectivity
- Verify Stripe configuration

---

**Happy Deploying! 🚀**
