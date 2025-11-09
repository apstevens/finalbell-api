# Production Security Checklist - Railway Edition

This checklist ensures your Final Bell API is secure before launching to production on Railway.

**📖 For detailed Railway deployment steps, see [RAILWAY_DEPLOYMENT_GUIDE.md](RAILWAY_DEPLOYMENT_GUIDE.md)**

## Pre-Launch Security Checklist

### 1. Environment Variables (CRITICAL)
- [ ] **Change all default secrets** in production `.env`
  - [ ] `JWT_SECRET` - Generate: `openssl rand -base64 64`
  - [ ] `REFRESH_TOKEN_SECRET` - Generate: `openssl rand -base64 64`
  - [ ] `ADMIN_API_KEY` - Generate: `openssl rand -base64 32`
  - [ ] All secrets must be at least 32 characters
- [ ] **Stripe keys** configured with production keys (not test keys)
- [ ] **Database URL** points to production database (not local)
- [ ] **ALLOWED_ORIGINS** set to production domains only
  ```
  ALLOWED_ORIGINS=https://finalbell.co.uk,https://www.finalbell.co.uk,https://app.finalbell.co.uk
  ```
- [ ] **NODE_ENV** set to `production`
- [ ] **CLIENT_URL** set to production URL
- [ ] Never commit `.env` file to git (should be in `.gitignore`)

### 2. HTTPS/SSL Configuration (CRITICAL)

#### ✅ Railway Users (You!):
SSL is **automatic** on Railway - nothing to configure! Railway provides:
- Free SSL certificates
- Automatic HTTPS
- HTTP → HTTPS redirects
- Certificate auto-renewal

#### SSL Verification Steps:
- [ ] Test your API URL shows HTTPS (🔒): `https://your-app.up.railway.app/health`
- [ ] Test SSL configuration: https://www.ssllabs.com/ssltest/
- [ ] Verify HSTS header is working (already configured in code)

#### If using other hosting:
- **Vercel/Netlify**: SSL is automatic
- **DigitalOcean/AWS/Azure**: Use their SSL certificate manager
- **Custom server**: Use Let's Encrypt (free SSL certificates)

### 3. Database Security

#### ✅ Railway Users (You!):
When you add MySQL in Railway:
- Database is **automatically private** (not publicly accessible)
- Strong password auto-generated
- Only your API service can access it (private networking)
- `DATABASE_URL` automatically set as environment variable

#### Database Checklist:
- [ ] MySQL database added to Railway project
- [ ] `DATABASE_URL` environment variable is set (automatic)
- [ ] Run Prisma migrations: `railway run npx prisma migrate deploy`
- [ ] Database backups configured (Railway Pro plan has automatic backups)

#### If using external database:
- [ ] Database uses strong password (20+ characters)
- [ ] Database is NOT publicly accessible
- [ ] Only your API server IP can access the database
- [ ] Connection uses SSL/TLS

### 4. IP Blacklist Configuration
- [ ] `IP_BLACKLIST_ENABLED=true` in production `.env`
- [ ] Verify blacklist loaded on startup (check server logs)
- [ ] Test that blacklisted IPs are blocked
- [ ] Auto-update interval configured (default: 24 hours)

### 5. Rate Limiting
Your rate limiting is already configured. Verify settings in production:
- [ ] General API: 100 requests per 15 minutes (configurable via `RATE_LIMIT_MAX_REQUESTS`)
- [ ] Authentication: 5 attempts per 15 minutes (protects against brute force)
- [ ] Checkout: 20 requests per 15 minutes
- [ ] Adjust limits based on expected traffic

### 6. CORS Configuration
- [ ] `ALLOWED_ORIGINS` contains ONLY production domains
- [ ] Remove localhost/development URLs from production
- [ ] Test cross-origin requests work from your frontend
- [ ] Verify unauthorized origins are blocked

### 7. Monitoring & Logging
- [ ] Set up error monitoring (Sentry, LogRocket, or similar)
- [ ] Log suspicious activities (already implemented in code)
- [ ] Monitor rate limit hits
- [ ] Set up alerts for:
  - Multiple failed authentication attempts
  - IP blacklist blocks
  - Server errors (500s)
  - Database connection issues

### 8. Stripe Security (If using payments)
- [ ] Use production Stripe keys (starts with `pk_live_` and `sk_live_`)
- [ ] `STRIPE_WEBHOOK_SECRET` configured for production webhook endpoint
- [ ] Webhook endpoint registered in Stripe Dashboard
- [ ] Test payment flow in production (use Stripe test cards)
- [ ] Verify webhook signature validation is working

### 9. API Security Headers
Your app already implements these headers. Verify they're working:
- [ ] Test headers: https://securityheaders.com/
  - Content-Security-Policy
  - Strict-Transport-Security (HSTS)
  - X-Frame-Options (Clickjacking protection)
  - X-Content-Type-Options (MIME sniffing protection)
  - Permissions-Policy
  - Referrer-Policy

### 10. Server Configuration
- [ ] Server OS is up-to-date with security patches
- [ ] Only necessary ports are open (typically 443 for HTTPS, 22 for SSH)
- [ ] SSH key-based authentication (disable password login)
- [ ] Firewall configured (UFW, Security Groups, etc.)
- [ ] Root login disabled
- [ ] Fail2ban or similar intrusion prevention installed

### 11. Dependency Security
- [ ] Run `npm audit` and fix vulnerabilities
  ```bash
  npm audit
  npm audit fix
  ```
- [ ] Keep dependencies updated regularly
- [ ] Use `npm outdated` to check for updates
- [ ] Subscribe to security advisories for critical packages

### 12. Testing Before Launch
- [ ] Test authentication flow (login, register, token refresh)
- [ ] Test rate limiting (make repeated requests)
- [ ] Test CORS from your frontend
- [ ] Test error handling (what users see when errors occur)
- [ ] Test database connection failure scenarios
- [ ] Load test your API (use tools like Artillery, k6, or Apache Bench)
- [ ] Verify health check endpoint: `GET /health`

### 13. Backup & Disaster Recovery
- [ ] Database automated backups configured
- [ ] Backup restoration tested
- [ ] Environment variables backed up securely (use password manager)
- [ ] Deployment rollback procedure documented
- [ ] Incident response plan documented

---

## Quick Security Test Commands

### Test SSL Configuration
```bash
curl -I https://api.yourdomain.com/health
# Should see 'Strict-Transport-Security' header
```

### Test Rate Limiting
```bash
# Make 101+ requests quickly to test rate limiter
for i in {1..105}; do curl https://api.yourdomain.com/health; done
# Should get "Too many requests" after 100
```

### Test CORS
```bash
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS https://api.yourdomain.com/health
# Should NOT return Access-Control-Allow-Origin header
```

### Check for Vulnerabilities
```bash
npm audit
npm outdated
```

---

## Production Environment Variables Template

Create a production `.env` file with these values:

```bash
# Server Configuration
NODE_ENV=production
PORT=8080

# Database Configuration - CHANGE THIS
DATABASE_URL="mysql://prod_user:STRONG_PASSWORD_HERE@your-db-host:3306/final_bell_prod"

# JWT Configuration - GENERATE NEW SECRETS
JWT_SECRET=GENERATE_WITH_openssl_rand_base64_64
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=GENERATE_WITH_openssl_rand_base64_64
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS Configuration - PRODUCTION DOMAINS ONLY
ALLOWED_ORIGINS=https://finalbell.co.uk,https://www.finalbell.co.uk,https://app.finalbell.co.uk

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Cloud Storage (Choose AWS S3 or Cloudinary)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=eu-west-2
AWS_S3_BUCKET=your_bucket_name

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_specific_password
EMAIL_FROM=noreply@finalbell.co.uk

# Stripe Configuration - PRODUCTION KEYS
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Client URL
CLIENT_URL=https://finalbell.co.uk

# Playwell FTP Configuration
PLAYWELL_FTP_HOST=161.35.45.163
PLAYWELL_FTP_USER=your_ftp_user
PLAYWELL_FTP_PASSWORD=your_ftp_password

# Admin API Configuration
ADMIN_API_KEY=GENERATE_WITH_openssl_rand_base64_32

# IP Blacklist Configuration
IP_BLACKLIST_ENABLED=true
IP_BLACKLIST_UPDATE_INTERVAL_HOURS=24
```

---

## Security Resources

- **SSL Test**: https://www.ssllabs.com/ssltest/
- **Security Headers Test**: https://securityheaders.com/
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Let's Encrypt SSL**: https://letsencrypt.org/
- **npm Security Best Practices**: https://docs.npmjs.com/packages-and-modules/securing-your-code

---

## Emergency Contacts & Procedures

### If you detect a security breach:
1. **Immediately rotate all secrets** (JWT_SECRET, REFRESH_TOKEN_SECRET, API keys)
2. **Force logout all users** (can be done by rotating JWT secrets)
3. **Check logs** for suspicious activity
4. **Update IP blacklist** to block attacker IPs
5. **Notify affected users** if data was compromised
6. **Review and patch** the vulnerability

### Monitoring Checklist
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure error alerts (email/Slack notifications)
- Review logs weekly for suspicious patterns
- Update dependencies monthly

---

**Last Updated**: 2025-01-09
**API Version**: 1.0.0
