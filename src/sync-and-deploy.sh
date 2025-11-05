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