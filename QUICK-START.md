# Quick Start Guide

Get your Final Bell API up and running in 5 minutes!

## Prerequisites

- Node.js 20+
- MySQL 8.0
- Git

## Step 1: Environment Setup (2 minutes)

```bash
# Clone and install
git clone <your-repo-url>
cd final-bell-api
npm install

# Create environment file
cp .env.example .env
```

## Step 2: Generate Secrets (1 minute)

```bash
# Generate JWT secrets
openssl rand -base64 64  # Copy to JWT_SECRET
openssl rand -base64 64  # Copy to REFRESH_TOKEN_SECRET
openssl rand -base64 32  # Copy to ADMIN_API_KEY
```

Update `.env`:
```env
DATABASE_URL="mysql://root:password@localhost:3306/final_bell_db"
JWT_SECRET=<paste-first-secret>
REFRESH_TOKEN_SECRET=<paste-second-secret>
ADMIN_API_KEY=<paste-third-secret>
```

## Step 3: Database Setup (1 minute)

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE final_bell_db;"

# Run migrations
npx prisma migrate dev
```

## Step 4: Start Development Server (30 seconds)

```bash
npm run dev
```

✅ **Done!** API running at http://localhost:8080

---

## Quick Test

```bash
# Test health endpoint
curl http://localhost:8080/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-01-05T...",
  "database": "connected"
}
```

---

## Using Docker? Even Easier!

```bash
# One command to rule them all
docker-compose up -d

# Check logs
docker-compose logs -f

# Run migrations
docker-compose exec api npx prisma migrate deploy
```

---

## Next Steps

1. **Add Stripe Keys** (for payments)
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. **Add FTP Credentials** (for CSV sync)
   ```env
   PLAYWELL_FTP_USER=your-username
   PLAYWELL_FTP_PASSWORD=your-password
   ```

3. **Test Endpoints**
   - Health: `GET /health`
   - Register: `POST /auth/register`
   - Login: `POST /auth/login`

4. **Deploy to Production**
   - See [DEPLOYMENT.md](DEPLOYMENT.md)

---

## Troubleshooting

### Database connection failed
```bash
# Check MySQL is running
mysql -u root -p

# Verify DATABASE_URL in .env
```

### Port 8080 already in use
```bash
# Change port in .env
PORT=3000
```

### Prisma errors
```bash
# Regenerate Prisma Client
npx prisma generate
```

---

## Useful Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Run production build
npm test             # Run tests
npx prisma studio    # Open database GUI
docker-compose logs  # View Docker logs
```

---

**Need help?** Check [README.md](README.md) for full documentation.
