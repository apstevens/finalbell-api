# UAT (User Acceptance Testing) Setup Guide

This guide explains how to expose your Final Bell API for UAT testing with password protection.

## Overview

The API includes built-in HTTP Basic Authentication that can be enabled for UAT environments. When enabled, all API requests (except `/health`) will require authentication credentials.

## Setup Instructions

### 1. Local Testing (Optional)

To test UAT mode locally:

1. Add these variables to your `.env` file:
   ```env
   UAT_ENABLED=true
   UAT_USERNAME=your_username
   UAT_PASSWORD=your_secure_password
   ```

2. Start your development server:
   ```bash
   npm run dev
   ```

3. Test the authentication:
   ```bash
   # This should return 401 Unauthorized
   curl http://localhost:8080/

   # This should work
   curl -u your_username:your_secure_password http://localhost:8080/
   ```

### 2. Railway Deployment for UAT

#### Step 1: Deploy to Railway

If you haven't already deployed to Railway:

```bash
# Login to Railway
railway login

# Link to your project (or create new one)
railway link

# Deploy
railway up
```

#### Step 2: Set Environment Variables in Railway

Go to your Railway dashboard and add these environment variables:

**Required Variables:**
- `UAT_ENABLED=true`
- `UAT_USERNAME=<choose_a_username>`
- `UAT_PASSWORD=<choose_a_strong_password>` (minimum 8 characters)

**Other Required Variables** (if not already set):
- `DATABASE_URL` - Provided automatically by Railway if you have PostgreSQL
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `REFRESH_TOKEN_SECRET` - Generate with: `openssl rand -base64 32`
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret
- `ADMIN_API_KEY` - Generate with: `openssl rand -base64 32`
- `ALLOWED_ORIGINS` - Your frontend URLs (comma-separated)
- `CLIENT_URL` - Your main client URL

#### Step 3: Deploy

After setting the environment variables, Railway will automatically redeploy. You can also manually trigger a deployment:

```bash
railway up
```

#### Step 4: Get Your Railway URL

```bash
railway domain
```

Or check the Railway dashboard for your deployment URL (e.g., `https://your-project.up.railway.app`)

### 3. Share Access with UAT Testers

Share the following with your testers:

**API URL:** `https://your-project.up.railway.app`

**Credentials:**
- Username: `<your_chosen_username>`
- Password: `<your_chosen_password>`

**How to access:**

1. **Via Browser:**
   - Navigate to the API URL
   - Browser will prompt for credentials
   - Enter username and password
   - Browser will remember credentials for the session

2. **Via API Clients (Postman, Insomnia, etc.):**
   - Set Authorization Type to "Basic Auth"
   - Enter username and password
   - Make requests as normal

3. **Via cURL:**
   ```bash
   curl -u username:password https://your-project.up.railway.app/endpoint
   ```

4. **Via JavaScript/Frontend:**
   ```javascript
   const credentials = btoa('username:password');

   fetch('https://your-project.up.railway.app/api/endpoint', {
     headers: {
       'Authorization': `Basic ${credentials}`
     }
   });
   ```

### 4. Disable UAT Mode (Go Live)

When you're ready to go live:

1. In Railway dashboard, set: `UAT_ENABLED=false`
2. Or remove the `UAT_ENABLED` variable entirely
3. Railway will automatically redeploy
4. API will now be accessible without authentication (normal operation)

## Testing UAT Authentication

### Test that auth is working:

```bash
# Should return 401 Unauthorized
curl https://your-project.up.railway.app/

# Should return API info
curl -u username:password https://your-project.up.railway.app/
```

### Health check is always accessible:

```bash
# Always works (no auth required)
curl https://your-project.up.railway.app/health
```

## Security Notes

1. **Use Strong Passwords:** Choose a password with at least 8 characters
2. **Share Securely:** Send credentials via secure channels (not email)
3. **Temporary Access:** Consider changing credentials after UAT is complete
4. **HTTPS Only:** Railway provides HTTPS by default - never use HTTP for basic auth
5. **Monitor Access:** Check Railway logs for authentication attempts

## Troubleshooting

### "Environment validation failed" error
- Make sure `UAT_USERNAME` and `UAT_PASSWORD` are set when `UAT_ENABLED=true`
- Password must be at least 8 characters

### Authentication not working
- Verify `UAT_ENABLED=true` is set in Railway
- Check Railway logs for authentication errors
- Ensure you're using the correct username and password

### "Invalid credentials" error
- Double-check username and password
- Check for extra spaces or special characters
- Verify environment variables are saved in Railway

### Browser keeps prompting for credentials
- This is normal behavior for Basic Auth
- Credentials are cached per session
- Clear browser cache to reset

## Alternative: Quick Local Testing with ngrok

For quick, temporary UAT sessions without deploying:

1. Start your local server:
   ```bash
   npm run dev
   ```

2. Install and run ngrok:
   ```bash
   npm install -g ngrok
   ngrok http 8080
   ```

3. Share the ngrok URL (e.g., `https://abc123.ngrok.io`)

**Note:** ngrok URLs change on each restart (use Railway for stable URLs)

## Railway CLI Commands Reference

```bash
# Check deployment status
railway status

# View logs
railway logs

# View environment variables
railway variables

# Open Railway dashboard
railway open
```

## Support

If you encounter issues, check:
1. Railway logs: `railway logs`
2. Environment variables: `railway variables`
3. Server health: `https://your-project.up.railway.app/health`
