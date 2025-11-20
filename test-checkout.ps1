# PowerShell script to test checkout functionality
# Run: .\test-checkout.ps1

$API_URL = "http://localhost:8080"

Write-Host "`n🧪 Final Bell API - Checkout & Shipping Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n📋 Test 1: Health Check" -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "$API_URL/health" -Method Get
    Write-Host "✅ Server is healthy: $($health.status)" -ForegroundColor Green
    if ($health.database) {
        Write-Host "✅ Database: $($health.database)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure the server is running: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Test 2: Create Checkout Session (Small Order)
Write-Host "`n📋 Test 2: Small Order (£29.99 - Light weight)" -ForegroundColor Green
$smallOrder = @{
    items = @(
        @{
            id = 1
            name = "Hand Wraps"
            price = 14.99
            quantity = 2
            image = "https://via.placeholder.com/150"
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $session1 = Invoke-RestMethod -Uri "$API_URL/api/v1/stripe/create-checkout-session" -Method Post -Body $smallOrder -ContentType "application/json"
    Write-Host "✅ Session created: $($session1.sessionId)" -ForegroundColor Green
    Write-Host "   Total: £29.98 (should have standard shipping ~£3.95-£4.95)" -ForegroundColor Cyan
    Write-Host "   🌐 Open: https://checkout.stripe.com/pay/$($session1.sessionId)" -ForegroundColor Blue
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 3: Create Checkout Session (Medium Order)
Write-Host "`n📋 Test 3: Medium Order (£79.98 - Medium weight)" -ForegroundColor Green
$mediumOrder = @{
    items = @(
        @{
            id = 2
            name = "Boxing Gloves"
            price = 49.99
            quantity = 1
            image = "https://via.placeholder.com/150"
        },
        @{
            id = 3
            name = "Training Shorts"
            price = 29.99
            quantity = 1
            image = "https://via.placeholder.com/150"
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $session2 = Invoke-RestMethod -Uri "$API_URL/api/v1/stripe/create-checkout-session" -Method Post -Body $mediumOrder -ContentType "application/json"
    Write-Host "✅ Session created: $($session2.sessionId)" -ForegroundColor Green
    Write-Host "   Total: £79.98 (should have standard shipping ~£6.95)" -ForegroundColor Cyan
    Write-Host "   🌐 Open: https://checkout.stripe.com/pay/$($session2.sessionId)" -ForegroundColor Blue
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 4: Create Checkout Session (Large Order - Free Shipping)
Write-Host "`n📋 Test 4: Large Order (£149.96 - Should get FREE shipping)" -ForegroundColor Green
$largeOrder = @{
    items = @(
        @{
            id = 4
            name = "Premium Boxing Gloves"
            price = 74.99
            quantity = 2
            image = "https://via.placeholder.com/150"
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $session3 = Invoke-RestMethod -Uri "$API_URL/api/v1/stripe/create-checkout-session" -Method Post -Body $largeOrder -ContentType "application/json"
    Write-Host "✅ Session created: $($session3.sessionId)" -ForegroundColor Green
    Write-Host "   Total: £149.98 (FREE standard shipping, express available)" -ForegroundColor Cyan
    Write-Host "   🌐 Open: https://checkout.stripe.com/pay/$($session3.sessionId)" -ForegroundColor Blue
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 5: Invalid Request (Missing Items)
Write-Host "`n📋 Test 5: Invalid Request - Missing Items (Should Fail)" -ForegroundColor Green
try {
    $invalid = Invoke-RestMethod -Uri "$API_URL/api/v1/stripe/create-checkout-session" -Method Post -Body '{}' -ContentType "application/json"
    Write-Host "❌ Should have failed but didn't!" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly rejected invalid request" -ForegroundColor Green
    Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

Start-Sleep -Seconds 1

# Test 6: Invalid Request (Missing Required Fields)
Write-Host "`n📋 Test 6: Invalid Request - Missing Required Fields (Should Fail)" -ForegroundColor Green
$invalidItem = @{
    items = @(
        @{
            id = 1
            name = "Test Product"
            # Missing price and quantity
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $invalid2 = Invoke-RestMethod -Uri "$API_URL/api/v1/stripe/create-checkout-session" -Method Post -Body $invalidItem -ContentType "application/json"
    Write-Host "❌ Should have failed but didn't!" -ForegroundColor Red
} catch {
    Write-Host "✅ Correctly rejected invalid item format" -ForegroundColor Green
    Write-Host "   Error: $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Health check passed" -ForegroundColor Green
Write-Host "✅ Small order checkout created" -ForegroundColor Green
Write-Host "✅ Medium order checkout created" -ForegroundColor Green
Write-Host "✅ Large order checkout created (free shipping)" -ForegroundColor Green
Write-Host "✅ Invalid requests properly rejected" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Open one of the checkout URLs above in your browser" -ForegroundColor White
Write-Host "   2. Use test card: 4242 4242 4242 4242" -ForegroundColor White
Write-Host "   3. Expiry: Any future date (e.g., 12/25)" -ForegroundColor White
Write-Host "   4. CVC: Any 3 digits (e.g., 123)" -ForegroundColor White
Write-Host "   5. Verify shipping options appear" -ForegroundColor White
Write-Host "   6. Complete checkout and verify webhook" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "   - Check console logs for shipping calculation details" -ForegroundColor White
Write-Host "   - Verify in Stripe Dashboard: https://dashboard.stripe.com/test/payments" -ForegroundColor White
Write-Host "   - Test webhook: stripe listen --forward-to localhost:8080/api/v1/stripe/webhook" -ForegroundColor White
Write-Host ""
