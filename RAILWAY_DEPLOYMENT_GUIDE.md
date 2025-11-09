# Railway Deployment Guide for Final Bell API

This guide walks you through deploying your Final Bell API to Railway with proper security.

## Why Railway is Great for Security

- ✅ **Automatic HTTPS/SSL** - No configuration needed
- ✅ **Environment variables** securely stored
- ✅ **Private networking** for database
- ✅ **Automatic deployments** from GitHub
- ✅ **Built-in monitoring**

---

## Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin master
```

### 2. Create Railway Account & Project

1. Go to https://railway.app/
2. Sign up with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your `final-bell-api` repository

### 3. Add MySQL Database

In Railway:
1. Click **"+ New"** in your project
2. Select **"Database"** → **"MySQL"**
3. Railway will automatically create a MySQL database
4. Copy the `DATABASE_URL` (it will be automatically set as an environment variable)

### 4. Configure Environment Variables

In Railway, go to your API service → **Variables** tab and add these:

#### Required Variables (CRITICAL):

```bash
# Node Environment
NODE_ENV=production

# Database (automatically set by Railway when you add MySQL)
# DATABASE_URL=mysql://... (already set)

# JWT Secrets - GENERATE NEW ONES
JWT_SECRET=<generate_with_command_below>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<generate_with_command_below>
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS - Your Frontend Domains
ALLOWED_ORIGINS=https://finalbell.co.uk,https://www.finalbell.co.uk,https://app.finalbell.co.uk

# Client URL
CLIENT_URL=https://finalbell.co.uk

# Admin API Key
ADMIN_API_KEY=<generate_with_command_below>
```

#### Generate Secrets:
Run these commands locally to generate secure secrets:

```bash
# Generate JWT_SECRET
openssl rand -base64 64

# Generate REFRESH_TOKEN_SECRET
openssl rand -base64 64

# Generate ADMIN_API_KEY
openssl rand -base64 32
```

Copy each output and paste into Railway variables.

#### Optional Variables (if using):

```bash
# Stripe (for payments)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=eu-west-2
AWS_S3_BUCKET=your_bucket

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=noreply@finalbell.co.uk

# Playwell FTP
PLAYWELL_FTP_HOST=161.35.45.163
PLAYWELL_FTP_USER=your_user
PLAYWELL_FTP_PASSWORD=your_password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# IP Blacklist
IP_BLACKLIST_ENABLED=true
IP_BLACKLIST_UPDATE_INTERVAL_HOURS=24

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/uploads
```

### 5. Configure Build Settings

Railway should auto-detect your Node.js app, but verify:

1. Go to **Settings** tab
2. Check **Build Command**: `npm install && npm run build`
3. Check **Start Command**: `npm start`
4. **Root Directory**: `/` (leave empty if repo root)

### 6. Add Custom Domain (Optional but Recommended)

Instead of `your-app.up.railway.app`, use your own domain:

1. In Railway, go to **Settings** → **Domains**
2. Click **"Generate Domain"** (gets you a railway.app subdomain)
3. Or click **"Custom Domain"** to add your own:
   - Example: `api.finalbell.co.uk`
   - Add the CNAME record to your DNS:
     ```
     CNAME: api.finalbell.co.uk → your-app.up.railway.app
     ```
4. **SSL is automatic** - Railway handles this for you!

### 7. Run Database Migrations

After deployment, you need to run Prisma migrations:

#### Option A: Using Railway CLI (Recommended)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run migrations
railway run npx prisma migrate deploy
```

#### Option B: Using Railway Dashboard
1. Go to your service → **Settings** → **Deploy Triggers**
2. Add a deployment hook that runs:
   ```bash
   npx prisma migrate deploy
   ```

### 8. Test Your Deployment

Once deployed, test your API:

```bash
# Get your Railway URL (e.g., your-app.up.railway.app)
RAILWAY_URL="your-app.up.railway.app"

# Test health endpoint
curl https://$RAILWAY_URL/health

# Should return:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

### 9. Configure Stripe Webhooks (If Using Stripe)

1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Add endpoint: `https://your-app.up.railway.app/stripe/webhook`
3. Select events to listen for (e.g., `checkout.session.completed`)
4. Copy the **Webhook Secret** (`whsec_...`)
5. Add to Railway environment variables as `STRIPE_WEBHOOK_SECRET`

---

## Railway-Specific Security Features

### 1. Private Networking
Your MySQL database is automatically private - only your API service can access it. No public internet access.

### 2. Automatic HTTPS
Railway provides SSL certificates automatically. Your API is served over HTTPS with no configuration needed.

### 3. Environment Variables
All secrets are encrypted at rest in Railway. Never commit them to Git.

### 4. Network Security
Railway provides DDoS protection and automatic scaling.

---

## Post-Deployment Security Checklist

After deploying to Railway, verify:

- [ ] **HTTPS is working**: Visit `https://your-app.up.railway.app/health`
- [ ] **Database connected**: Check health endpoint shows `"database":"connected"`
- [ ] **Environment variables set**: All required variables configured
- [ ] **CORS working**: Test from your frontend application
- [ ] **Rate limiting active**: Make 101+ requests, should get rate limited
- [ ] **IP blacklist loaded**: Check deployment logs for "IP Blacklist loaded: X IPs"
- [ ] **Stripe webhooks working** (if using): Test a payment
- [ ] **No secrets in code**: Run `git log` and check no sensitive data committed

### Test CORS from Frontend:
```javascript
// In your frontend app (finalbell.co.uk)
fetch('https://your-app.up.railway.app/health')
  .then(res => res.json())
  .then(data => console.log('API connected:', data))
  .catch(err => console.error('CORS error:', err));
```

---

## Monitoring & Logs

### View Logs in Railway:
1. Go to your service
2. Click **"Deployments"** tab
3. Click on latest deployment
4. View real-time logs

### Important Logs to Monitor:
- `✓ Server running on port 8080`
- `✓ Environment variables validated`
- `✓ IP Blacklist loaded: X IPs`
- Any error messages

### Set Up Alerts:
Railway has built-in monitoring. You can also integrate:
- **Sentry** for error tracking
- **LogRocket** for session replay
- **UptimeRobot** for uptime monitoring

---

## Automatic Deployments

Railway automatically deploys when you push to GitHub:

```bash
# Make changes
git add .
git commit -m "Update API"
git push origin master

# Railway automatically:
# 1. Detects push
# 2. Builds your app
# 3. Runs tests (if configured)
# 4. Deploys new version
# 5. Keeps old version until new one is healthy
```

### Rollback if Needed:
1. Go to **Deployments** tab
2. Find a previous working deployment
3. Click **"Redeploy"**

---

## Updating Your Frontend

After deploying your API to Railway, update your frontend to use the new API URL:

### In Your Frontend `.env`:
```bash
# Before (development)
VITE_API_URL=http://localhost:8080

# After (production)
VITE_API_URL=https://your-app.up.railway.app
# Or with custom domain:
VITE_API_URL=https://api.finalbell.co.uk
```

---

## Cost Optimization

Railway offers:
- **$5/month** of free usage (Hobby plan)
- **Pay-as-you-go** after that

### Tips to Reduce Costs:
1. Use Railway's sleep feature for staging environments
2. Optimize your Docker image size
3. Monitor your usage in Railway dashboard
4. Set up usage alerts

---

## Troubleshooting

### Issue: Database connection fails
**Solution**: Check that `DATABASE_URL` environment variable is set. Railway sets this automatically when you add MySQL.

### Issue: CORS errors from frontend
**Solution**:
1. Check `ALLOWED_ORIGINS` includes your frontend domain
2. Make sure it uses `https://` not `http://`
3. Don't include trailing slashes

### Issue: IP Blacklist not loading
**Solution**:
1. Check logs for blacklist errors
2. Make sure `IP_BLACKLIST_ENABLED=true`
3. Check Railway has internet access (it should by default)

### Issue: Prisma migrations fail
**Solution**:
```bash
# Run migrations manually using Railway CLI
railway run npx prisma migrate deploy

# Or generate Prisma Client
railway run npx prisma generate
```

### Issue: Build fails
**Solution**:
1. Check **Settings** → **Build Command** is correct
2. Make sure all dependencies are in `package.json`
3. Check build logs for specific errors

---

## Security Best Practices on Railway

1. **Never commit secrets** - Use Railway environment variables
2. **Use private networking** - Database should not be publicly accessible
3. **Enable Railway's security features**:
   - Go to **Settings** → **Security**
   - Consider enabling IP allowlisting if needed
4. **Rotate secrets regularly** - Update JWT secrets every few months
5. **Monitor logs** - Check for suspicious activity
6. **Keep dependencies updated** - Run `npm audit` regularly

---

## Next Steps After Deployment

1. ✅ API deployed to Railway
2. ✅ Database connected
3. ✅ HTTPS working
4. ✅ Environment variables configured
5. ⬜ Update frontend to use Railway API URL
6. ⬜ Test full user flow (registration, login, etc.)
7. ⬜ Set up monitoring (Sentry, UptimeRobot)
8. ⬜ Configure custom domain (optional)
9. ⬜ Set up staging environment (optional)

---

## Useful Railway Commands

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Run commands in Railway environment
railway run <command>

# Example: Run migrations
railway run npx prisma migrate deploy

# Example: Open database shell
railway run npx prisma studio

# Deploy current directory
railway up
```

---

## Support Resources

- **Railway Docs**: https://docs.railway.app/
- **Railway Discord**: https://discord.gg/railway
- **This Project's Checklist**: See [PRODUCTION_SECURITY_CHECKLIST.md](PRODUCTION_SECURITY_CHECKLIST.md)

---

**Last Updated**: 2025-01-09
**Railway Plan**: Hobby / Pro
