#!/bin/bash

###############################################################################
# CSV Sync to Frontend Script
# This script automates the process of syncing CSV data from the backend
# to the frontend marketing site
###############################################################################

set -e # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="${API_DIR}/../final-bell-marketing"
CSV_FILE="playwell-stock-shopify-b.csv"
LOG_FILE="${API_DIR}/logs/csv-sync.log"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create logs directory if it doesn't exist
mkdir -p "${API_DIR}/logs"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

###############################################################################
# Step 1: Trigger backend CSV sync from FTP
###############################################################################
log "Step 1: Triggering backend CSV sync..."

if [ -z "$ADMIN_API_KEY" ]; then
    error "ADMIN_API_KEY environment variable is not set"
    exit 1
fi

API_URL="${API_URL:-http://localhost:8080}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/admin/csv/sync-cron" \
    -H "X-API-Key: ${ADMIN_API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    log "✓ Backend CSV sync completed successfully"
else
    error "Backend CSV sync failed with HTTP code: $HTTP_CODE"
    error "Response: $BODY"
    exit 1
fi

###############################################################################
# Step 2: Wait for sync to complete
###############################################################################
log "Step 2: Waiting for sync to stabilize..."
sleep 5

###############################################################################
# Step 3: Copy CSV to frontend assets
###############################################################################
log "Step 3: Copying CSV to frontend..."

SOURCE="${API_DIR}/data/${CSV_FILE}"
DEST="${FRONTEND_DIR}/src/assets/${CSV_FILE}"

if [ ! -f "$SOURCE" ]; then
    error "Source CSV file not found: $SOURCE"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    error "Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

# Create assets directory if it doesn't exist
mkdir -p "${FRONTEND_DIR}/src/assets"

# Copy CSV file
cp "$SOURCE" "$DEST"
log "✓ CSV copied to frontend assets"

# Get file size for logging
FILE_SIZE=$(du -h "$DEST" | cut -f1)
log "  File size: $FILE_SIZE"

###############################################################################
# Step 4: Run frontend import script
###############################################################################
log "Step 4: Running frontend product import..."

cd "$FRONTEND_DIR"

if [ ! -f "scripts/importProducts.mjs" ]; then
    error "Frontend import script not found: scripts/importProducts.mjs"
    exit 1
fi

# Run the import script
if node scripts/importProducts.mjs >> "$LOG_FILE" 2>&1; then
    log "✓ Product import completed successfully"
else
    error "Product import failed"
    exit 1
fi

###############################################################################
# Step 5: Build frontend (optional, comment out if not needed)
###############################################################################
log "Step 5: Building frontend..."

if npm run build >> "$LOG_FILE" 2>&1; then
    log "✓ Frontend build completed successfully"
else
    warn "Frontend build failed (this may be expected in development)"
fi

###############################################################################
# Step 6: Git commit changes (optional)
###############################################################################
if [ "${GIT_AUTO_COMMIT:-false}" = "true" ]; then
    log "Step 6: Committing changes to git..."

    if git diff --quiet src/data/products-generated.ts src/assets/${CSV_FILE}; then
        log "  No changes to commit"
    else
        git add src/data/products-generated.ts src/assets/${CSV_FILE}
        git commit -m "Auto-update: Product data from CSV sync $(date +'%Y-%m-%d %H:%M:%S')"
        log "✓ Changes committed to git"

        if [ "${GIT_AUTO_PUSH:-false}" = "true" ]; then
            git push
            log "✓ Changes pushed to remote"
        fi
    fi
else
    log "Step 6: Skipping git commit (GIT_AUTO_COMMIT not enabled)"
fi

###############################################################################
# Completion
###############################################################################
log "========================================="
log "CSV sync to frontend completed successfully!"
log "========================================="
log ""
log "Summary:"
log "  - CSV synced from FTP"
log "  - Products imported: $(grep -o 'export const products' "${FRONTEND_DIR}/src/data/products-generated.ts" | wc -l)"
log "  - CSV file size: $FILE_SIZE"
log "  - Log file: $LOG_FILE"
log ""
