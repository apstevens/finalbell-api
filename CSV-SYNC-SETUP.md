# CSV Sync Setup Guide

This guide explains how to set up and use the automatic CSV synchronization system for Playwell products.

## Overview

The CSV sync system automatically downloads the latest product data from Playwell's FTP server daily. It includes:

- **Automatic daily sync** via scheduler
- **Manual sync endpoint** for immediate updates
- **Backup system** to preserve historical data
- **Admin authentication** for secure access
- **API key support** for cron jobs

## Installation

### 1. Install FTP Client Dependency

```bash
npm install basic-ftp
```

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Playwell FTP Configuration
PLAYWELL_FTP_HOST=161.35.45.163
PLAYWELL_FTP_USER=your-ftp-username
PLAYWELL_FTP_PASSWORD=your-ftp-password

# Admin API Configuration
ADMIN_API_KEY=your-secure-api-key-here
```

**Generate a secure API key:**
```bash
openssl rand -base64 32
```

### 3. Create Data Directories

The system will automatically create these directories, but you can create them manually:

```bash
mkdir -p data/backups
```

## Usage

### Automatic Daily Sync

The scheduler runs automatically when the server starts:
- **Initial sync**: 1 minute after server startup
- **Recurring sync**: Every 24 hours
- **Backup**: Creates backup before each sync
- **Retention**: Keeps backups for 30 days

### Manual Sync via Admin Panel

**Endpoint:** `POST /admin/csv/sync`

**Authentication:** Requires admin JWT token

```bash
curl -X POST http://localhost:8080/admin/csv/sync \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "CSV sync completed successfully",
  "timestamp": "2025-11-04T10:30:00.000Z",
  "fileSize": 4554682
}
```

### Manual Sync via API Key (For Cron Jobs)

**Endpoint:** `POST /admin/csv/sync-cron`

**Authentication:** Requires API key in header

```bash
curl -X POST http://localhost:8080/admin/csv/sync-cron \
  -H "X-API-Key: YOUR_ADMIN_API_KEY"
```

This endpoint is useful for external cron jobs or CI/CD pipelines.

### Check CSV Status

**Endpoint:** `GET /admin/csv/status`

**Authentication:** Requires admin JWT token

```bash
curl http://localhost:8080/admin/csv/status \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "status": {
    "fileExists": true,
    "lastModified": "2025-11-04T10:30:00.000Z",
    "fileSize": 4554682
  }
}
```

### Get System Status

**Endpoint:** `GET /admin/system/status`

**Authentication:** Requires admin JWT token

```bash
curl http://localhost:8080/admin/system/status \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

## File Locations

### CSV File
```
data/playwell-stock-shopify-b.csv
```

### Backups
```
data/backups/playwell-stock-2025-11-04T10-30-00-000Z.csv
data/backups/playwell-stock-2025-11-03T10-30-00-000Z.csv
...
```

## Security

### Admin Authentication

Two authentication methods are supported:

1. **JWT Token (for admin users):**
   - Admin users must log in via `/auth/login`
   - Include token in Authorization header: `Bearer {token}`
   - Only users with role `ADMIN` or `SUPER_ADMIN` can access

2. **API Key (for automated systems):**
   - Set `ADMIN_API_KEY` in environment variables
   - Include in header: `X-API-Key: {key}`
   - Useful for cron jobs and CI/CD

### Best Practices

1. **Use strong, unique credentials:**
   - FTP password should be complex
   - API key should be randomly generated
   - JWT secrets should be long and random

2. **Rotate credentials regularly:**
   - Change FTP password quarterly
   - Rotate API keys annually
   - Update JWT secrets on security events

3. **Restrict network access:**
   - Only allow admin endpoints from trusted IPs
   - Use HTTPS in production
   - Enable firewall rules

4. **Monitor logs:**
   - Check for failed sync attempts
   - Review backup retention
   - Watch for authentication failures

## Troubleshooting

### Sync Fails: "Connection refused"

**Cause:** Cannot connect to FTP server

**Solutions:**
1. Verify FTP host is correct: `PLAYWELL_FTP_HOST=161.35.45.163`
2. Check firewall allows outbound FTP (port 21)
3. Verify network connectivity: `ping 161.35.45.163`

### Sync Fails: "Authentication failed"

**Cause:** Invalid FTP credentials

**Solutions:**
1. Verify username and password in `.env`
2. Check for typos or extra spaces
3. Contact Playwell support to verify credentials

### Sync Fails: "File not found"

**Cause:** Remote CSV file missing or moved

**Solutions:**
1. Verify file path: `/playwell-stock-shopify-b.csv`
2. Check Playwell email for file location updates
3. Contact Playwell support

### Backups Fill Up Disk Space

**Cause:** Too many old backups

**Solutions:**
1. Backups auto-delete after 30 days
2. Manually clean old backups:
   ```bash
   rm data/backups/playwell-stock-2025-10-*.csv
   ```
3. Adjust retention period in `csvSyncService.ts`

### Scheduler Not Running

**Cause:** Server restarted or crashed

**Solutions:**
1. Check server logs for errors
2. Verify scheduler started: Look for `[Scheduler] Starting scheduled tasks...`
3. Manually trigger sync to test: `POST /admin/csv/sync`

## Integration with Frontend

After CSV sync completes on the backend, you need to update the frontend:

### Option 1: Manual Frontend Update

1. Backend syncs CSV from FTP
2. Copy updated CSV to frontend:
   ```bash
   cp data/playwell-stock-shopify-b.csv ../final-bell-marketing/src/assets/
   ```
3. Run frontend import script:
   ```bash
   cd ../final-bell-marketing
   npm run import:products
   ```

### Option 2: Automated Pipeline (Recommended)

Create a script `sync-and-deploy.sh`:

```bash
#!/bin/bash
# Trigger backend CSV sync
curl -X POST http://localhost:8080/admin/csv/sync-cron \
  -H "X-API-Key: $ADMIN_API_KEY"

# Wait for sync to complete
sleep 5

# Copy CSV to frontend
cp data/playwell-stock-shopify-b.csv ../final-bell-marketing/src/assets/

# Run frontend import
cd ../final-bell-marketing
node scripts/importProducts.mjs

# Build frontend
npm run build

# Deploy (example: copy to web server)
# rsync -avz dist/ user@server:/var/www/html/
```

### Option 3: Webhook Notification

Add webhook support to notify frontend when sync completes:

```typescript
// In csvSyncService.ts, add after successful sync:
if (result.success && env.WEBHOOK_URL) {
  await fetch(env.WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'csv_sync_complete', timestamp: result.timestamp })
  });
}
```

## Monitoring

### Health Checks

The system logs all sync operations:

```
[CSV Sync] Starting CSV sync...
[CSV Sync] Connecting to FTP server: 161.35.45.163
[CSV Sync] Connected to FTP server
[CSV Sync] Downloaded CSV: 4554682 bytes
[CSV Sync] Backup created: data/backups/playwell-stock-2025-11-04T10-30-00-000Z.csv
[CSV Sync] Sync completed in 2345ms
```

### Metrics to Monitor

1. **Sync success rate** - Should be close to 100%
2. **File size** - Should be ~4.5MB (watch for significant changes)
3. **Sync duration** - Usually 2-5 seconds
4. **Backup count** - Should maintain ~30 backups

## Production Deployment

### Using PM2 (Recommended)

```bash
# Start server with PM2
pm2 start npm --name "final-bell-api" -- run dev

# View logs
pm2 logs final-bell-api

# Restart
pm2 restart final-bell-api
```

### Using systemd

Create `/etc/systemd/system/final-bell-api.service`:

```ini
[Unit]
Description=Final Bell API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/final-bell-api
ExecStart=/usr/bin/node dist/server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable final-bell-api
sudo systemctl start final-bell-api
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

## Support

For issues with:
- **CSV format**: Contact Playwell support
- **FTP access**: Check Playwell email for credentials
- **Sync system**: Review logs and this documentation
- **Backend API**: Check server logs and health endpoint

---

**Last Updated:** 2025-11-04
**Version:** 1.0.0
