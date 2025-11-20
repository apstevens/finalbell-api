# Deployment Readiness Testing Guide

This guide helps you verify that your Final Bell API is ready for production deployment.

## ✅ Quick Testing Checklist

Run through these tests in order before deploying:

### 1. Build Test
```bash
# Clean build from scratch
npm run build
```
**Expected Result**: No TypeScript errors, build completes successfully

### 2. Environment Configuration Test
```bash
# Check that all required environment variables are set
node -e "
const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'STRIPE_SECRET_KEY',
  'ADMIN_API_KEY',
  'ALLOWED_ORIGINS',
  'CLIENT_URL'
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing);
  process.exit(1);
}
console.log('✅ All required environment variables are set');
"
```

### 3. Database Connection Test
```bash
# Test database connectivity
npx prisma db pull --force
```
**Expected Result**: Successfully connects and pulls schema from database

### 4. Database Migration Test
```bash
# Check migration status
npx prisma migrate status
```
**Expected Result**: All migrations applied, no pending migrations

### 5. Production Start Test
```bash
# Test production build locally
npm run start:prod
```
**Expected Result**: Server starts without errors on the configured PORT

### 6. API Health Check Test
```bash
# In a new terminal, test the health endpoint
curl http://localhost:8080/health
```
**Expected Result**:
```json
{
  "status": "ok",
  "database": "connected"
}
```

### 7. Security Headers Test
```bash
# Test security headers are properly set
curl -I http://localhost:8080/health
```
**Expected Result**: Headers include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (if HTTPS)

### 8. Rate Limiting Test
```bash
# Test rate limiting works (run multiple times quickly)
for i in {1..10}; do curl http://localhost:8080/health; done
```
**Expected Result**: Should see rate limit messages after hitting the limit

### 9. CORS Test
```bash
# Test CORS headers
curl -H "Origin: https://finalbell.co.uk" -I http://localhost:8080/health
```
**Expected Result**: Should see `Access-Control-Allow-Origin` header

### 10. Error Handling Test
```bash
# Test 404 handling
curl http://localhost:8080/nonexistent
```
**Expected Result**: Proper JSON error response, not HTML

---

## 🔍 Detailed Testing Procedures

### A. Database Testing

#### Test 1: Connection Pool
```bash
# Create test file
cat > test-db-connection.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`✅ Database query successful. Users: ${userCount}`);

    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
EOF

node test-db-connection.js
```

#### Test 2: Migration Integrity
```bash
# Verify all tables exist
npx prisma db pull --force
npx prisma generate
```

### B. Security Testing

#### Test 1: SQL Injection Protection
```bash
# Test with SQL injection attempt (should be sanitized)
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com'\'' OR 1=1--","password":"test"}'
```
**Expected**: Should NOT allow SQL injection, proper error handling

#### Test 2: XSS Protection
```bash
# Test XSS attempt
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<script>alert(\"xss\")</script>","password":"test"}'
```
**Expected**: Script tags should be sanitized/rejected

#### Test 3: Authentication Required
```bash
# Test protected endpoints without token
curl http://localhost:8080/api/v1/users/profile
```
**Expected**: 401 Unauthorized response

### C. Performance Testing

#### Test 1: Response Time
```bash
# Create performance test file
cat > curl-format.txt << 'EOF'
time_namelookup:  %{time_namelookup}s\n
time_connect:     %{time_connect}s\n
time_pretransfer: %{time_pretransfer}s\n
time_starttransfer: %{time_starttransfer}s\n
time_total:       %{time_total}s\n
EOF

curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8080/health
```
**Expected**: time_total < 0.5s for health check

#### Test 2: Concurrent Requests
```bash
# Test handling multiple concurrent requests
for i in {1..50}; do
  curl -s http://localhost:8080/health &
done
wait
```
**Expected**: All requests complete successfully

### D. Docker Testing

#### Test 1: Docker Build
```bash
# Build Docker image
docker build -t final-bell-api:test .
```
**Expected**: Build completes without errors

#### Test 2: Docker Run
```bash
# Run container locally
docker run -p 8080:8080 --env-file .env final-bell-api:test
```
**Expected**: Container starts and responds to health checks

#### Test 3: Docker Compose
```bash
# Test full stack with docker-compose
docker-compose up -d
docker-compose ps
docker-compose logs api
```

### E. Environment Variable Testing

Create a test script to validate all variables:

```bash
cat > test-env.js << 'EOF'
require('dotenv').config();

const requiredVars = {
  'NODE_ENV': 'Should be "production" for deployment',
  'PORT': 'Application port (typically 8080)',
  'DATABASE_URL': 'PostgreSQL/MySQL connection string',
  'JWT_SECRET': 'Should be at least 32 characters',
  'REFRESH_TOKEN_SECRET': 'Should be at least 32 characters',
  'STRIPE_SECRET_KEY': 'Should start with sk_live_ for production',
  'ADMIN_API_KEY': 'Should be at least 32 characters',
  'ALLOWED_ORIGINS': 'Comma-separated list of allowed origins',
  'CLIENT_URL': 'Frontend application URL'
};

const optionalVars = {
  'STRIPE_WEBHOOK_SECRET': 'Required if using Stripe webhooks',
  'PLAYWELL_FTP_HOST': 'Required if using CSV sync',
  'PLAYWELL_FTP_USER': 'Required if using CSV sync',
  'PLAYWELL_FTP_PASSWORD': 'Required if using CSV sync'
};

console.log('🔍 Checking Required Environment Variables:\n');

let hasErrors = false;

for (const [key, description] of Object.entries(requiredVars)) {
  const value = process.env[key];
  if (!value) {
    console.error(`❌ ${key}: MISSING - ${description}`);
    hasErrors = true;
  } else {
    // Check specific requirements
    if (key === 'NODE_ENV' && value !== 'production') {
      console.warn(`⚠️  ${key}: "${value}" (should be "production" for deployment)`);
    } else if ((key.includes('SECRET') || key.includes('API_KEY')) && value.length < 32) {
      console.error(`❌ ${key}: TOO SHORT (${value.length} chars, needs 32+)`);
      hasErrors = true;
    } else if (key === 'STRIPE_SECRET_KEY' && !value.startsWith('sk_live_')) {
      console.warn(`⚠️  ${key}: Not using production key (starts with "${value.substring(0, 8)}...")`);
    } else {
      console.log(`✅ ${key}: SET`);
    }
  }
}

console.log('\n🔍 Checking Optional Environment Variables:\n');

for (const [key, description] of Object.entries(optionalVars)) {
  const value = process.env[key];
  if (!value) {
    console.log(`ℹ️  ${key}: NOT SET - ${description}`);
  } else {
    console.log(`✅ ${key}: SET`);
  }
}

if (hasErrors) {
  console.error('\n❌ Environment validation failed. Fix errors before deploying.');
  process.exit(1);
} else {
  console.log('\n✅ Environment validation passed!');
}
EOF

node test-env.js
```

### F. Stripe Integration Testing

```bash
# Test Stripe connection
cat > test-stripe.js << 'EOF'
require('dotenv').config();
const Stripe = require('stripe');

async function testStripe() {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Test API connection
    const account = await stripe.accounts.retrieve();
    console.log('✅ Stripe connection successful');
    console.log(`   Account ID: ${account.id}`);
    console.log(`   Type: ${account.type}`);

    // Verify using live mode for production
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
        console.error('❌ WARNING: Using test Stripe key in production!');
        process.exit(1);
      }
      console.log('✅ Using Stripe live mode');
    }
  } catch (error) {
    console.error('❌ Stripe connection failed:', error.message);
    process.exit(1);
  }
}

testStripe();
EOF

node test-stripe.js
```

---

## 📋 Pre-Deployment Checklist

Complete this checklist before deploying:

### Code Quality
- [ ] All TypeScript builds without errors
- [ ] No console.log statements in production code
- [ ] Error handling implemented for all routes
- [ ] Input validation on all user inputs
- [ ] SQL injection protection verified

### Security
- [ ] All secrets are stored in environment variables (not hardcoded)
- [ ] JWT secrets are at least 32 characters long
- [ ] Using production Stripe keys (sk_live_)
- [ ] CORS configured with specific origins (not "*")
- [ ] Rate limiting enabled
- [ ] Helmet.js security headers configured
- [ ] HTTPS enforced in production

### Database
- [ ] All migrations applied successfully
- [ ] Database connection tested
- [ ] Backup strategy in place
- [ ] Connection pooling configured
- [ ] Database indexes optimized

### Environment
- [ ] NODE_ENV=production
- [ ] All required environment variables set
- [ ] Environment variables validated
- [ ] Secrets properly secured (AWS Secrets Manager, etc.)

### Monitoring
- [ ] Health check endpoint working
- [ ] Error logging configured
- [ ] Performance monitoring setup (optional)
- [ ] Uptime monitoring configured

### Testing
- [ ] Health endpoint returns 200 OK
- [ ] Database queries execute successfully
- [ ] API responds within acceptable time (<500ms for health check)
- [ ] Rate limiting works
- [ ] CORS headers present
- [ ] 404 errors handled properly

### Deployment Platform
- [ ] Docker image builds successfully
- [ ] Container runs without errors
- [ ] Environment variables configured in platform
- [ ] Database URL configured
- [ ] Domain/subdomain configured
- [ ] SSL certificate configured (automatic with Railway/Render)

### Documentation
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Rollback procedure documented

---

## 🚀 Final Pre-Deployment Commands

Run these commands right before deployment:

```bash
# 1. Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# 2. Run linting (if configured)
npm run lint

# 3. Build for production
npm run build

# 4. Test production build locally
npm run start:prod

# 5. In another terminal, test health endpoint
curl http://localhost:8080/health

# 6. Check for outdated packages
npm outdated

# 7. Security audit
npm audit

# 8. Verify Prisma schema
npx prisma validate

# 9. Check migration status
npx prisma migrate status
```

---

## ⚠️ Common Issues and Solutions

### Issue: Build fails with TypeScript errors
**Solution**: Fix TypeScript errors shown in build output

### Issue: Database connection fails
**Solution**:
- Check DATABASE_URL format
- Verify database is accessible from deployment environment
- Check firewall/security group settings

### Issue: Environment variables not loading
**Solution**:
- Verify .env file exists (local)
- Verify variables are set in deployment platform
- Check variable names match exactly (case-sensitive)

### Issue: CORS errors in browser
**Solution**:
- Add your frontend domain to ALLOWED_ORIGINS
- Format: `ALLOWED_ORIGINS=https://finalbell.co.uk,https://www.finalbell.co.uk`

### Issue: Stripe webhooks not working
**Solution**:
- Verify STRIPE_WEBHOOK_SECRET is set
- Configure webhook endpoint in Stripe dashboard
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:8080/webhooks/stripe`

---

## 📊 Performance Benchmarks

Your API should meet these benchmarks:

- **Health Check**: < 100ms
- **Authentication**: < 200ms
- **Database Queries**: < 500ms
- **API Endpoints**: < 1000ms
- **Concurrent Requests**: Handle 50+ simultaneous requests

---

## 🎯 Ready to Deploy?

If all tests pass and checklist items are complete:

1. **Railway Deployment**: Follow [DEPLOYMENT.md - Railway Section](DEPLOYMENT.md#railway-recommended-for-easy-deployment)
2. **AWS RDS + Railway**: Follow [DEPLOYMENT.md - AWS RDS Section](DEPLOYMENT.md#aws-rds--railway-deployment-production-grade)
3. **Docker**: Follow [DEPLOYMENT.md - Docker Section](DEPLOYMENT.md#option-1-docker-compose-recommended-for-single-server)

---

## 📞 Need Help?

- Review [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions
- Check [README.md](README.md) for project documentation
- Review error logs for specific issues

Good luck with your deployment! 🚀
