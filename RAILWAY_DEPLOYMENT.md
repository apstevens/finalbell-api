# Railway PostgreSQL Deployment Guide

## Prerequisites

- Railway account
- GitHub repository connected to Railway
- Stripe account (for webhooks)

## Step 1: Generate New Secrets

**IMPORTANT**: Never use the secrets from `.env` or `.env.production` in production!

Run this command to generate new secrets:

```bash
node scripts/generate-secrets.js
```

Copy the output - you'll need it for Railway.

## Step 2: Add PostgreSQL Database to Railway

1. Go to [railway.app](https://railway.app)
2. Open your project
3. Click **+ New** button
4. Select **Database** → **Add PostgreSQL**
5. Railway will provision a PostgreSQL database

✅ Railway automatically creates these variables:
- `DATABASE_URL`
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

## Step 3: Configure Environment Variables

Go to your Railway service → **Variables** tab

Add all these variables (use the secrets you generated in Step 1):

### Required Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=8080

# Database (Railway auto-injects this)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# JWT Configuration (Use generated secrets!)
JWT_SECRET=<paste-your-generated-jwt-secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<paste-your-generated-refresh-token-secret>
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS Configuration
ALLOWED_ORIGINS=https://finalbell.co.uk,https://www.finalbell.co.uk,https://app.finalbell.co.uk

# Client Configuration
CLIENT_URL=https://finalbell.co.uk

# Stripe Configuration (IMPORTANT: Use LIVE keys for production!)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=hello@finalbell.co.uk
SMTP_PASSWORD=<your-gmail-app-password>
EMAIL_FROM=hello@finalbell.co.uk
ADMIN_EMAIL=apstevens@finalbell.co.uk

# Admin Configuration (Use generated secret!)
ADMIN_API_KEY=<paste-your-generated-admin-api-key>

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# IP Blacklist
IP_BLACKLIST_ENABLED=true
IP_BLACKLIST_UPDATE_INTERVAL_HOURS=24

# Product CSV URL
MTB_CSV_URL=https://app.matrixify.app/files/hx1kg2-jn/a9c39b060fb5c913dcb623116952f087/mtb-product-export.csv
```

### Optional Variables (if using)

```bash
# FTP Configuration (if syncing from FTP)
PLAYWELL_FTP_HOST=161.35.45.163
PLAYWELL_FTP_USER=<your-ftp-username>
PLAYWELL_FTP_PASSWORD=<your-ftp-password>

# AWS S3 (if using for file storage)
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=eu-west-2
AWS_S3_BUCKET=<your-bucket-name>
```

## Step 4: Configure Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Enter your Railway URL + webhook path:
   ```
   https://<your-railway-app>.up.railway.app/api/checkout/webhook
   ```
4. Select events to listen to:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to Railway as `STRIPE_WEBHOOK_SECRET`

## Step 5: Deploy to Railway

### Option A: Automatic Deployment (Recommended)

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Configure for Railway PostgreSQL deployment"
   git push origin main
   ```

2. Railway will automatically:
   - Build your application (`npm run build`)
   - Run Prisma migrations (`npx prisma migrate deploy`)
   - Start your server (`npm run start:prod`)

### Option B: Manual Deployment via Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Deploy
railway up
```

## Step 6: Verify Deployment

### Check Build Logs

1. Go to Railway Dashboard → Deployments
2. Click on the latest deployment
3. Check logs for:
   - ✅ Build completed successfully
   - ✅ Prisma migrations applied
   - ✅ Server started on port 8080
   - ✅ Environment variables validated

### Test Health Endpoint

```bash
curl https://<your-railway-app>.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected"
}
```

### Test API Endpoints

```bash
# Test CORS
curl -i https://<your-railway-app>.up.railway.app/api/products

# Should return proper CORS headers
```

## Step 7: Run Database Migrations

If migrations didn't run automatically, you can run them manually via Railway CLI:

```bash
# Connect to your Railway project
railway link

# Run migrations
railway run npx prisma migrate deploy

# Generate Prisma Client (if needed)
railway run npx prisma generate
```

## Step 8: Seed Initial Data (Optional)

If you have a seed script:

```bash
railway run npx prisma db seed
```

## Troubleshooting

### Database Connection Failed

**Error**: `Can't reach database server`

**Solution**:
1. Verify `DATABASE_URL` is set correctly
2. Check if Railway PostgreSQL service is running
3. Ensure connection string format is correct

### Build Fails

**Error**: `Failed to build`

**Solution**:
1. Check Railway build logs
2. Verify all dependencies in `package.json`
3. Ensure TypeScript compiles locally: `npm run build`

### Migrations Fail

**Error**: `Prisma migrate failed`

**Solution**:
```bash
# Reset database (DANGER: deletes all data!)
railway run npx prisma migrate reset

# Or create new migration
railway run npx prisma migrate dev --name init
```

### Health Check Failing

**Error**: `Health check timeout`

**Solution**:
1. Verify server is starting correctly in logs
2. Check if port 8080 is exposed
3. Ensure `/health` endpoint returns 200 status

### Environment Variables Not Loaded

**Error**: `Missing required environment variable: XXX`

**Solution**:
1. Go to Railway → Variables tab
2. Verify all required variables are set
3. Click **Redeploy** to apply changes

## Security Checklist

Before going live:

- [ ] All secrets generated fresh (not copied from local `.env`)
- [ ] Stripe LIVE keys configured (not test keys)
- [ ] `ALLOWED_ORIGINS` includes only production domains
- [ ] `STRIPE_WEBHOOK_SECRET` configured correctly
- [ ] `.env` and `.env.production` NOT committed to git
- [ ] Gmail app password configured (not regular password)
- [ ] Database backups configured
- [ ] Health check endpoint working
- [ ] SSL/TLS enabled (Railway provides this automatically)

## Monitoring

### View Logs

```bash
# Real-time logs
railway logs

# Last 100 lines
railway logs --tail 100
```

### Monitor Database

```bash
# Connect to PostgreSQL
railway connect Postgres

# View tables
\dt

# View users
SELECT * FROM "User" LIMIT 10;
```

### Metrics

Go to Railway Dashboard → Metrics to view:
- CPU usage
- Memory usage
- Network I/O
- Request count

## Backup and Recovery

### Manual Backup

```bash
# Dump database
railway connect Postgres -- pg_dump > backup-$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
# Restore database
railway connect Postgres -- psql < backup-20240101.sql
```

## Useful Commands

```bash
# View environment variables
railway variables

# Open Railway dashboard
railway open

# Connect to PostgreSQL
railway connect Postgres

# Run one-off command
railway run <command>

# View service status
railway status
```

## Next Steps

1. Set up monitoring (Sentry, LogRocket, etc.)
2. Configure custom domain
3. Set up automated database backups
4. Add application performance monitoring
5. Configure alerts for downtime

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Prisma Docs: https://www.prisma.io/docs

---

**Last Updated**: January 2024
**Railway Plan Required**: Hobby or Pro (for PostgreSQL)
