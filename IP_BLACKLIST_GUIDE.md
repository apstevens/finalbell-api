# IP Blacklist Automation Guide

## Overview

This guide explains how to use the automated IP blacklist system to protect your API from malicious traffic. The system automatically fetches and updates lists of known malicious IPs from external sources.

---

## 📋 Table of Contents

1. [How It Works](#how-it-works)
2. [Files Created](#files-created)
3. [Configuration](#configuration)
4. [Usage Instructions](#usage-instructions)
5. [Manual Operations](#manual-operations)
6. [Understanding the .txt to String Conversion](#understanding-the-txt-to-string-conversion)

---

## 🔧 How It Works

### Architecture

```
External Sources (IPsum, etc.)
         ↓
   Fetch .txt file
         ↓
   Parse IPs (validate format)
         ↓
   Convert to string literals (array of strings)
         ↓
   Store in Set<string> (in memory)
         ↓
   Save to blacklist.txt (local backup)
         ↓
   Block requests via middleware
```

### Automatic Process

1. **On Server Startup**: Loads existing `blacklist.txt` or fetches fresh data
2. **Every N Hours**: Automatically updates the blacklist (configurable)
3. **On Request**: Middleware checks incoming IP against the blacklist Set

---

## 📁 Files Created

### 1. **Service Layer**
- **`src/services/ipBlacklistService.ts`**
  - Fetches IP lists from URLs (uses HTTPS)
  - Parses raw text into validated IP strings
  - Stores IPs in a Set for O(1) lookup
  - Manages local file persistence

### 2. **Middleware**
- **`src/middleware/ipBlacklist.ts`**
  - Intercepts all incoming requests
  - Extracts client IP (handles IPv6 prefix)
  - Blocks blacklisted IPs with 403 response

### 3. **Manual Script**
- **`scripts/updateBlacklist.ts`**
  - Manually trigger blacklist updates
  - Shows statistics after update

### 4. **Configuration**
- **`src/config/env.ts`** (updated)
  - `IP_BLACKLIST_ENABLED`: Enable/disable feature
  - `IP_BLACKLIST_UPDATE_INTERVAL_HOURS`: Update frequency

### 5. **Data File**
- **`blacklist.txt`** (auto-generated in project root)
  - Plain text file, one IP per line
  - Used for persistence across restarts

---

## ⚙️ Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# IP Blacklist Settings
IP_BLACKLIST_ENABLED=true
IP_BLACKLIST_UPDATE_INTERVAL_HOURS=24
```

**Options:**
- `IP_BLACKLIST_ENABLED`: `true` or `false` (default: `true`)
- `IP_BLACKLIST_UPDATE_INTERVAL_HOURS`: Number (default: `24`)

### Customizing Sources

Edit `src/services/ipBlacklistService.ts` to add/remove sources:

```typescript
private readonly SOURCES = {
    // IPsum - Most dangerous IPs (Level 1)
    ipsum: 'https://raw.githubusercontent.com/stamparm/ipsum/master/levels/1.txt',

    // Add more sources:
    // blocklist_de: 'https://lists.blocklist.de/lists/all.txt',
    // feodo: 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt',
};
```

**Popular Sources:**
- **IPsum Level 1**: Most dangerous (recommended)
- **IPsum Level 2-8**: Progressively less strict
- **Blocklist.de**: SSH/mail/web attacks
- **Feodo Tracker**: Botnet C&C servers
- **Emerging Threats**: Categorized threats

---

## 🚀 Usage Instructions

### First Time Setup

1. **Run the manual update script**:
   ```bash
   npx ts-node scripts/updateBlacklist.ts
   ```

   This will:
   - Fetch IPs from configured sources
   - Parse and validate them
   - Save to `blacklist.txt`
   - Show statistics

2. **Start your server**:
   ```bash
   npm run dev
   ```

   You'll see:
   ```
   ✓ Loaded 15234 IPs from local blacklist
   ✓ IP Blacklist loaded: 15234 IPs
   ```

### Automatic Updates

Once running, the server will:
- ✅ Load blacklist on startup
- ✅ Auto-update every 24 hours (configurable)
- ✅ Log update attempts and results

**Console Output:**
```
Updating IP blacklist...
Fetching IP blacklists from external sources...
  Fetching from ipsum...
  ✓ Fetched 15234 IPs from ipsum
Total unique IPs collected: 15234
✓ Saved 15234 IPs to c:\...\blacklist.txt
✓ Blacklist updated successfully
```

### Blocking in Action

When a blacklisted IP tries to access your API:

**Server logs:**
```
Blocked request from blacklisted IP: 203.0.113.42
```

**Client receives:**
```json
{
  "error": "Access denied",
  "message": "Your IP address has been blocked due to suspicious activity"
}
```

---

## 🛠️ Manual Operations

### Update Blacklist Manually

```bash
npx ts-node scripts/updateBlacklist.ts
```

### Check Blacklist Statistics

Add this endpoint to your server for monitoring (optional):

```typescript
// In server.ts
app.get('/admin/blacklist/stats', (req, res) => {
    const stats = ipBlacklistService.getStats();
    res.json(stats);
});
```

Response:
```json
{
  "count": 15234,
  "lastUpdate": "2025-11-09T10:30:00.000Z",
  "filePath": "c:\\...\\blacklist.txt"
}
```

### Add/Remove IPs Programmatically

```typescript
import { ipBlacklistService } from './services/ipBlacklistService';

// Add a single IP
ipBlacklistService.addIP('192.168.1.100');

// Remove an IP
ipBlacklistService.removeIP('192.168.1.100');

// Check if IP is blacklisted
const isBlocked = ipBlacklistService.isBlacklisted('192.168.1.100');
```

### Manually Edit blacklist.txt

You can add IPs directly to the file:

```txt
192.168.1.100
10.0.0.50
203.0.113.42
# Comments are ignored
```

Restart the server to load changes.

---

## 📚 Understanding the .txt to String Conversion

### The Parsing Process

**Input (.txt file from external source):**
```txt
# IPsum daily feed - malicious IPs
203.0.113.42    10
198.51.100.23   8
# Another comment
192.0.2.1       15

```

**Step 1: Split into lines**
```javascript
const lines = rawText.split('\n');
// ['# IPsum daily feed...', '203.0.113.42    10', ...]
```

**Step 2: Filter and extract IPs**
```javascript
for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Extract IP using regex
    const ipMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);

    if (ipMatch) {
        const ip = ipMatch[1]; // '203.0.113.42'

        // Validate IP format
        if (isValidIP(ip)) {
            ips.push(ip); // Add to array
        }
    }
}
```

**Step 3: Validate IP format**
```javascript
private isValidIP(ip: string): boolean {
    const parts = ip.split('.');

    if (parts.length !== 4) return false;

    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}
```

**Output (TypeScript string array):**
```typescript
const ips: string[] = [
    '203.0.113.42',
    '198.51.100.23',
    '192.0.2.1'
];
```

**Step 4: Store in Set for fast lookup**
```typescript
this.blacklistedIPs = new Set(ips);
// Set { '203.0.113.42', '198.51.100.23', '192.0.2.1' }
```

### Why Use a Set?

**Performance Benefits:**
- **Lookup**: O(1) constant time
- **No Duplicates**: Automatically deduplicates
- **Memory Efficient**: Only stores unique values

**Comparison:**
```typescript
// Array lookup: O(n) - slow for large lists
const isBlacklisted = ips.includes(clientIP); // Scans entire array

// Set lookup: O(1) - instant
const isBlacklisted = blacklistedIPs.has(clientIP); // Hash lookup
```

### Example with 15,000 IPs

**Memory Usage:**
- Array: ~600 KB
- Set: ~600 KB (similar)

**Lookup Speed (15,000 IPs):**
- Array: ~0.15ms per check
- Set: ~0.0001ms per check (1500x faster!)

---

## 🔍 Testing the System

### Test 1: Check if service works

```bash
npx ts-node scripts/updateBlacklist.ts
```

Expected output:
```
Starting IP blacklist update...
Fetching IP blacklists from external sources...
  ✓ Fetched 15234 IPs from ipsum
✓ Blacklist updated successfully
Total IPs: 15234
```

### Test 2: Verify blacklist.txt exists

```bash
cat blacklist.txt | head -n 10
```

Should show IPs:
```
203.0.113.42
198.51.100.23
192.0.2.1
...
```

### Test 3: Server startup

```bash
npm run dev
```

Should show:
```
✓ IP Blacklist loaded: 15234 IPs
```

### Test 4: Disable the blacklist

In `.env`:
```bash
IP_BLACKLIST_ENABLED=false
```

Restart server - all IPs will be allowed.

---

## 🎓 Key Concepts Summary

1. **.txt file** → Downloaded from external sources
2. **Parsing** → Extract IP addresses using regex
3. **Validation** → Ensure proper IPv4 format (0-255 range)
4. **String literals** → Plain JavaScript strings (`'192.168.1.1'`)
5. **Set storage** → Fast O(1) lookup performance
6. **Persistence** → Save to local `blacklist.txt`
7. **Middleware** → Automatic blocking on every request

---

## 📞 Support

If you need to:
- Add more sources → Edit `ipBlacklistService.ts` SOURCES
- Change update frequency → Edit `.env` IP_BLACKLIST_UPDATE_INTERVAL_HOURS
- Disable feature → Set IP_BLACKLIST_ENABLED=false
- Manual update → Run `npx ts-node scripts/updateBlacklist.ts`

---

**Congratulations!** You now have a fully automated IP blacklist system protecting your API. 🎉
