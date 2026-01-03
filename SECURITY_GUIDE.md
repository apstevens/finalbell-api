# Security Guide: Protecting Secrets

## 🔒 Current Security Status

✅ **GOOD**: Your `.env` files are in `.gitignore`
✅ **GOOD**: No `.env` files found in git history
⚠️ **WARNING**: `.env.production` contains real production secrets

## 🚨 Critical Actions Required

### 1. Remove `.env.production` from Local Repository

The `.env.production` file should **NEVER** exist in your repository, even if it's in `.gitignore`.

**Why?**:
- It can accidentally be committed
- It can be exposed in git history
- Team members might copy real secrets

**Action**: Delete it and use Railway environment variables instead

```bash
# Delete the file (it's already in .gitignore, so won't be committed)
rm .env.production

# Or move it outside the repository
mv .env.production ../secrets-backup/.env.production.backup
```

### 2. Verify Git History is Clean

Check if secrets were ever committed:

```bash
# Check for .env files in history
git log --all --full-history -- .env .env.production

# If any commits found, you MUST clean git history
# Use BFG Repo-Cleaner or git-filter-repo
```

### 3. Rotate All Production Secrets

Since secrets were in `.env.production`, you should rotate them:

**Generate New Secrets:**
```bash
node scripts/generate-secrets.js
```

**What to Rotate:**
- ✅ JWT_SECRET
- ✅ REFRESH_TOKEN_SECRET
- ✅ ADMIN_API_KEY
- ✅ Database password (if possible)
- ✅ SMTP_PASSWORD (create new Gmail app password)
- ✅ Stripe webhook secret (regenerate in Stripe)

## 📋 Proper Secret Management

### Development (Local)

**Use `.env` for local development only:**

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in **development** values:
   ```bash
   # .env (local development only)
   NODE_ENV=development
   PORT=8080
   DATABASE_URL="postgresql://localhost:5432/final_bell_dev"
   JWT_SECRET="local-dev-secret-not-for-production"
   # ... etc
   ```

3. **NEVER commit `.env`** - it's already in `.gitignore`

### Production (Railway)

**ONLY use Railway Dashboard for production secrets:**

1. Go to Railway Dashboard → Your Project → Variables
2. Add each secret individually
3. Use Railway's variable references:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```

4. **NEVER** create `.env.production` file

## 🛡️ Security Best Practices

### 1. Environment Files

```
✅ .env.example        → Commit to git (no secrets, only examples)
✅ .env                → Never commit (local development)
❌ .env.production     → NEVER create this file
❌ .env.local          → Never commit
❌ .env.*.local        → Never commit
```

### 2. Gitignore Configuration

Your `.gitignore` should include:

```gitignore
# Environment variables
.env
.env.local
.env.*.local
.env.development
.env.production
.env.test

# Backup files that might contain secrets
*.backup
*.bak
secrets/
.secrets/
```

### 3. Secret Generation

**Always generate cryptographically secure secrets:**

```bash
# Use the provided script
node scripts/generate-secrets.js

# Or use Node.js crypto
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Or use OpenSSL
openssl rand -base64 64
```

**NEVER use:**
- ❌ Simple passwords like "password123"
- ❌ Predictable strings like "my-secret-key"
- ❌ Short secrets (minimum 32 characters)
- ❌ Secrets copied from examples or tutorials

### 4. Secret Rotation Schedule

| Secret Type | Rotation Frequency | Priority |
|-------------|-------------------|----------|
| JWT Secrets | Every 6 months | High |
| Database Password | Every 3 months | Critical |
| API Keys | Every 6 months | High |
| SMTP Password | When compromised | Medium |
| Webhook Secrets | When compromised | High |

### 5. Team Collaboration

**Sharing secrets securely:**

1. **NEVER** send secrets via:
   - ❌ Email
   - ❌ Slack/Discord
   - ❌ Git commits
   - ❌ Screenshots

2. **Use secure methods:**
   - ✅ Password managers (1Password, LastPass, Bitwarden)
   - ✅ Encrypted messaging (Signal with disappearing messages)
   - ✅ Railway Dashboard (team members can access)
   - ✅ In-person transfer

## 🔍 Detecting Exposed Secrets

### Check if Secrets are Exposed

```bash
# Check git history
git log --all --full-history --pretty=format:"%H %s" -- .env .env.production

# Search for potential secrets in commits
git log -p -S "JWT_SECRET" --all

# Use git-secrets tool
git secrets --scan --history
```

### Automated Secret Scanning

Install `git-secrets`:

```bash
# Install
npm install -g git-secrets

# Initialize
git secrets --install

# Add patterns to scan for
git secrets --register-aws
git secrets --add 'JWT_SECRET.*'
git secrets --add 'API_KEY.*'
git secrets --add 'PASSWORD.*'

# Scan repository
git secrets --scan
```

### GitHub Secret Scanning

If your repo is on GitHub:
1. Go to Settings → Security → Secret scanning
2. Enable secret scanning
3. GitHub will alert you if secrets are detected

## 🚨 If Secrets are Exposed

### Immediate Actions

1. **Rotate ALL exposed secrets immediately**
   ```bash
   # Generate new secrets
   node scripts/generate-secrets.js

   # Update Railway Dashboard with new secrets
   # Update local .env with new development secrets
   ```

2. **Revoke compromised credentials**
   - Change database password
   - Regenerate Stripe keys
   - Create new Gmail app password
   - Regenerate admin API key

3. **Clean git history** (if secrets were committed)
   ```bash
   # Install BFG Repo-Cleaner
   brew install bfg  # macOS
   # Or download from: https://rtyley.github.io/bfg-repo-cleaner/

   # Remove .env files from history
   bfg --delete-files .env
   bfg --delete-files .env.production

   # Clean up
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive

   # Force push (⚠️ WARNING: Coordinate with team)
   git push --force
   ```

4. **Monitor for unauthorized access**
   - Check Railway logs for suspicious activity
   - Review database access logs
   - Check Stripe dashboard for unusual transactions
   - Monitor email for unauthorized sends

## ✅ Security Checklist

### Before Every Commit

- [ ] Run `git status` to check for `.env` files
- [ ] Run `git diff --staged` to verify no secrets
- [ ] Ensure only `.env.example` is staged (if modified)

### Before Production Deployment

- [ ] All secrets generated fresh (not copied from local)
- [ ] `.env.production` file deleted
- [ ] All secrets stored in Railway Dashboard
- [ ] Database password rotated
- [ ] Stripe webhook secret configured
- [ ] SMTP credentials tested
- [ ] Admin API key rotated
- [ ] Git history verified clean

### Monthly Security Review

- [ ] Review Railway environment variables
- [ ] Check for exposed secrets in git history
- [ ] Verify team access to Railway
- [ ] Review API access logs
- [ ] Test secret rotation process

## 📚 Additional Resources

### Tools
- **git-secrets**: Prevent committing secrets
- **BFG Repo-Cleaner**: Remove secrets from history
- **TruffleHog**: Find secrets in git history
- **GitGuardian**: Automated secret detection

### Services
- **1Password**: Team password manager
- **Railway Secrets**: Built-in secret management
- **HashiCorp Vault**: Enterprise secret management
- **AWS Secrets Manager**: Cloud-based secrets

### Reading
- [OWASP Secret Management](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

## 🆘 Support

If you believe secrets were exposed:
1. Rotate all secrets immediately
2. Contact Railway support if database was compromised
3. Monitor logs for 30 days
4. Consider security audit

---

**Remember**: The best way to protect secrets is to never put them in files that could be committed to git. Always use environment variables and platform-provided secret management.
