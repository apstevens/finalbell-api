# Automation Scripts

This directory contains scripts for automating various tasks in the Final Bell API.

## CSV Sync to Frontend

Automates the complete pipeline for syncing product data from muaythai-boxing.com FTP to the frontend marketing site.

### Linux/Mac (Bash)

```bash
# Set environment variables
export ADMIN_API_KEY="your-api-key-here"
export API_URL="http://localhost:8080"  # Optional, defaults to localhost:8080

# Run the script
./scripts/sync-csv-to-frontend.sh

# With git auto-commit
GIT_AUTO_COMMIT=true ./scripts/sync-csv-to-frontend.sh

# With git auto-commit and push
GIT_AUTO_COMMIT=true GIT_AUTO_PUSH=true ./scripts/sync-csv-to-frontend.sh
```

### Windows (PowerShell)

```powershell
# Set environment variable
$env:ADMIN_API_KEY = "your-api-key-here"

# Run the script
.\scripts\sync-csv-to-frontend.ps1

# With options
.\scripts\sync-csv-to-frontend.ps1 -ApiUrl "http://localhost:8080" -GitCommit -GitPush
```

## Schedule with Cron (Linux/Mac)

Add to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 2 AM
0 2 * * * cd /path/to/final-bell-api && ADMIN_API_KEY=your-key ./scripts/sync-csv-to-frontend.sh >> /var/log/csv-sync.log 2>&1
```

## Schedule with Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., Daily at 2 AM)
4. Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "C:\path\to\final-bell-api\scripts\sync-csv-to-frontend.ps1"`
5. Set environment variables in task properties

## What the Script Does

1. **Triggers backend CSV sync** - Calls the API endpoint to download latest CSV from muaythai-boxing.com FTP
2. **Waits for completion** - Allows time for the sync to finish
3. **Copies CSV to frontend** - Copies the CSV file to frontend assets directory
4. **Runs frontend import** - Executes `importProducts.mjs` to parse CSV and generate product data
5. **Builds frontend** - Optionally builds the frontend application
6. **Git commit** - Optionally commits changes to version control

## Logs

Logs are stored in `logs/csv-sync.log` and include:
- Timestamps for each step
- Success/error messages
- File sizes
- Import statistics

## Troubleshooting

### Script fails at Step 1
- Check that ADMIN_API_KEY is set correctly
- Verify API_URL is accessible
- Check backend logs for FTP connection issues

### Script fails at Step 3
- Verify CSV file exists in `data/mtb-product-export.csv`
- Check that frontend directory path is correct
- Ensure write permissions on frontend assets directory

### Script fails at Step 4
- Verify `scripts/importProducts.mjs` exists in frontend
- Check frontend directory has node_modules installed
- Review CSV format for parsing errors

## GitHub Actions Integration

The scripts can also be triggered from GitHub Actions:

```yaml
- name: Sync CSV to Frontend
  env:
    ADMIN_API_KEY: ${{ secrets.ADMIN_API_KEY }}
    API_URL: ${{ secrets.API_URL }}
  run: ./scripts/sync-csv-to-frontend.sh
```
