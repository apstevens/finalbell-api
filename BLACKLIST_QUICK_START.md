# IP Blacklist - Quick Start

## 🚀 Get Started in 3 Steps

### 1. Add Environment Variables (Optional)

Add to `.env` file:
```bash
IP_BLACKLIST_ENABLED=true
IP_BLACKLIST_UPDATE_INTERVAL_HOURS=24
```

### 2. Fetch the Blacklist

```bash
npx ts-node scripts/updateBlacklist.ts
```

### 3. Start Your Server

```bash
npm run dev
```

That's it! Your API is now protected. ✅

---

## 📝 Common Commands

```bash
# Manual update
npx ts-node scripts/updateBlacklist.ts

# View blacklist file
cat blacklist.txt | head -n 20

# Count IPs in blacklist
cat blacklist.txt | wc -l

# Disable blacklist temporarily
# In .env: IP_BLACKLIST_ENABLED=false
```

---

## 🔍 What Gets Blocked?

- Botnet IPs
- Malware command & control servers
- Known attackers
- SSH/FTP brute force sources
- Spam sources
- DDoS sources

**Source**: IPsum (aggregates 30+ threat feeds)

---

## 💡 How It Works

**Fetch** → **Parse** → **Validate** → **Store** → **Block**

```
External .txt file
    ↓
Parse lines into IP strings
    ↓
Validate IP format (0-255.0-255.0-255.0-255)
    ↓
Store in Set<string> (fast lookup)
    ↓
Middleware blocks matching IPs
```

---

## 📚 Full Documentation

See [IP_BLACKLIST_GUIDE.md](./IP_BLACKLIST_GUIDE.md) for complete details.
