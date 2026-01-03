# Secrets Management - Quick Start Guide

## 🚀 TL;DR - How to Never Expose Secrets

### For Local Development

```bash
# 1. Copy the example file
cp .env.example .env

# 2. Generate development secrets
npm run generate-secrets

# 3. Fill in .env with LOCAL values only
# NEVER use production secrets in .env

# 4. NEVER commit .env
# (it's already in .gitignore)
```

### For Production (Railway)

```bash
# 1. Generate NEW production secrets
npm run generate-secrets

# 2. Copy output and paste into Railway Dashboard
# Go to: Railway Dashboard → Your Project → Variables

# 3. NEVER create .env.production file
# Use ONLY Railway Dashboard for production secrets
```

## ⚠️ Golden Rules

1. **NEVER commit** files containing secrets
2. **NEVER create** `.env.production` file
3. **ALWAYS generate** fresh secrets for production
4. **ALWAYS use** Railway Dashboard for production secrets
5. **CHECK before commit**: `npm run check-secrets`

## 🛠️ Commands

```bash
# Generate new secrets
npm run generate-secrets

# Check for secrets before commit
npm run check-secrets

# Check git history for secrets
git log --all --full-history -- .env
```

## ✅ Before Every Commit

```bash
# 1. Check what you're committing
git status

# 2. Run secret check
npm run check-secrets

# 3. Verify no .env files staged
git diff --cached --name-only | grep .env

# 4. If all clear, commit
git commit -m "Your message"
```

## 📁 File Structure

```
✅ .env.example      → Safe to commit (no real secrets)
✅ .env              → NEVER commit (local development only)
❌ .env.production   → NEVER create (use Railway Dashboard)
✅ scripts/          → Safe to commit (helper scripts)
✅ SECURITY_GUIDE.md → Safe to commit (documentation)
```

## 🔒 What Goes Where

| Secret Type | Local (.env) | Production (Railway) |
|-------------|--------------|---------------------|
| DATABASE_URL | Local PostgreSQL | `${{Postgres.DATABASE_URL}}` |
| JWT_SECRET | Generated dev secret | Generated prod secret |
| STRIPE_SECRET_KEY | Test key (sk_test_) | Live key (sk_live_) |
| SMTP_PASSWORD | Personal app password | Production app password |
| ADMIN_API_KEY | Generated dev key | Generated prod key |

## 🚨 If You Accidentally Committed Secrets

```bash
# 1. IMMEDIATELY rotate all secrets
npm run generate-secrets

# 2. Update Railway with new secrets
# Go to Railway Dashboard → Variables

# 3. Remove from git history (if committed)
git rm --cached .env
git commit -m "Remove .env from tracking"

# 4. If already pushed, contact security team
# Secrets in git history are permanently exposed!
```

## 📚 Full Documentation

- Complete guide: [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)
- Railway setup: [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)
- Secret patterns: `scripts/check-secrets.js`

## 🆘 Quick Help

**Q: Can I commit `.env.example`?**
A: Yes! It contains no real secrets, only examples.

**Q: Where do I put production secrets?**
A: ONLY in Railway Dashboard → Variables tab.

**Q: What if I need to share secrets with teammates?**
A: Use Railway Dashboard (team access) or password manager. NEVER send via email/Slack.

**Q: How often should I rotate secrets?**
A: JWT secrets every 6 months, database password every 3 months, or immediately if exposed.

**Q: What's the difference between .env and .env.production?**
A: `.env` is for local development. `.env.production` should NEVER exist - use Railway instead.

---

**Remember**: When in doubt, use Railway Dashboard for production secrets!
