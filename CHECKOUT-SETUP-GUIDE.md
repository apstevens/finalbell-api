# Guest Checkout & Email Configuration Guide

## Current Status ✅

Your backend **already supports guest checkout perfectly**! The implementation is complete and includes:

- ✅ Guest email parameter handling in `/stripe/create-checkout-session`
- ✅ Proper customer identification in Stripe sessions
- ✅ Order creation with guest vs authenticated user distinction
- ✅ Email notifications (order confirmation + admin notification)
- ✅ Database schema supports both order types

## Why Emails Aren't Being Sent

The email service is working correctly, but emails are only being **logged to console** instead of actually sent because **SMTP is not configured**.

### Current Behavior

When an order is placed:
1. ✅ Order is created successfully in database
2. ✅ Email service is called
3. ⚠️ Email is logged to console (not sent)
4. ⚠️ No actual email reaches customer or admin

### Console Output You'll See

```
[Email Service] Would send email (SMTP not configured):
  To: customer@example.com
  Subject: Order Confirmation - FB-2025-0001
  Body: ...
```

## Solution: Configure SMTP for Email Sending

You have **two options** for sending emails:

### Option 1: Gmail SMTP (Easiest for Testing)

**Step 1: Enable App Passwords in Gmail**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Go to https://myaccount.google.com/apppasswords
4. Generate an "App Password" for "Mail"
5. Copy the 16-character password

**Step 2: Add to Railway Environment Variables**

In your Railway dashboard for the API, add these environment variables:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
EMAIL_FROM=Final Bell <your-email@gmail.com>
ADMIN_EMAIL=admin@finalbell.co.uk
```

**Step 3: Redeploy**
- Railway will automatically redeploy with new environment variables
- Emails will now be sent!

### Option 2: Professional Email Service (Production Recommended)

For production, use a transactional email service:

#### Recommended Services:

**A. SendGrid (Free tier: 100 emails/day)**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=Final Bell <hello@finalbell.co.uk>
ADMIN_EMAIL=admin@finalbell.co.uk
```

**B. Mailgun (Free tier: 5,000 emails/month for 3 months)**
```bash
SMTP_HOST=smtp.eu.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=your-mailgun-smtp-password
EMAIL_FROM=Final Bell <hello@finalbell.co.uk>
ADMIN_EMAIL=admin@finalbell.co.uk
```

**C. AWS SES (Very low cost: $0.10 per 1000 emails)**
```bash
SMTP_HOST=email-smtp.eu-west-2.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-aws-access-key
SMTP_PASSWORD=your-aws-secret-key
EMAIL_FROM=Final Bell <hello@finalbell.co.uk>
ADMIN_EMAIL=admin@finalbell.co.uk
```

## Testing Email Configuration

### 1. Local Testing

If testing locally, create a `.env` file in your API root:

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and add SMTP settings
nano .env
```

### 2. Test Order Flow

1. Place a test order on your frontend
2. Check your email for order confirmation
3. Check admin email for order notification
4. Check Railway logs for confirmation:

```
[Email Service] Email sent successfully to customer@example.com
[Email Service] Email sent successfully to admin@finalbell.co.uk
```

### 3. If Emails Still Don't Send

Check Railway logs:
```bash
railway logs
```

Look for:
- `[Email Service] SMTP transporter initialized` ✅ Good
- `[Email Service] SMTP not configured` ⚠️ Environment variables missing
- `[Email Service] Failed to send email` ❌ SMTP credentials wrong

## Email Templates Included

Your backend already has beautiful HTML email templates for:

### 1. Order Confirmation (Customer)
- Personalized greeting
- Order number and date
- Full item list with prices
- Subtotal, shipping, tax, total
- Shipping address
- **Guest-specific:** Save order number message + tracking link
- **Authenticated:** Dashboard link
- Professional HTML layout

### 2. Admin Order Notification
- Order type indicator (Guest 🛒 / Registered 👤)
- Customer details
- Order items
- Shipping address
- Total amount
- Action required callout

### 3. Shipping Notification (for later use)
- Order shipped confirmation
- Tracking number/URL
- Carrier information
- Estimated delivery
- Shipping address

## Verifying Guest Checkout Works

### Test Case 1: Guest Checkout

1. **Frontend:** Go to `/checkout/auth`
2. **Choose:** Guest Checkout
3. **Enter:** test-guest@example.com
4. **Complete:** Stripe checkout with test card: `4242 4242 4242 4242`
5. **Expected Result:**
   - Order created in database with `orderType = 'guest'`
   - `guestEmail` field populated
   - `userId` field is NULL
   - Email sent to test-guest@example.com
   - Admin email sent

### Test Case 2: Authenticated Checkout

1. **Frontend:** Sign in first
2. **Go to:** `/checkout/auth` (will auto-redirect to `/checkout/payment`)
3. **Complete:** Stripe checkout
4. **Expected Result:**
   - Order created with `orderType = 'authenticated'`
   - `userId` field populated
   - `guestEmail` field is NULL
   - Email sent to user's account email
   - Admin email sent

## Database Verification

Check orders in your database:

```sql
-- View all orders with customer type
SELECT
  order_number,
  order_type,
  customer_email,
  guest_email,
  user_id,
  total,
  created_at
FROM "Order"
ORDER BY created_at DESC
LIMIT 10;

-- Count guest vs authenticated orders
SELECT
  order_type,
  COUNT(*) as count,
  SUM(total) as total_revenue
FROM "Order"
GROUP BY order_type;
```

## Current Backend Implementation Details

### Stripe Checkout Endpoint

**Location:** `src/controllers/stripeController.ts` (lines 9-67)

```typescript
POST /stripe/create-checkout-session

Body:
{
  "items": [...],
  "guestEmail": "optional-for-guests@example.com"
}

Response:
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Authentication Detection:**
- If JWT token present → Authenticated user
- If `guestEmail` in body → Guest user
- Validates that guests provide email

**Metadata Stored in Stripe:**
```typescript
{
  userId: user?.id || 'guest',
  orderType: 'guest' | 'authenticated',
  customerEmail: email
}
```

### Webhook Handler

**Location:** `src/controllers/stripeController.ts` (lines 69-203)

**Event:** `checkout.session.completed`

**Flow:**
1. Verify webhook signature
2. Retrieve full session with line items
3. Check for duplicate orders (prevent double-processing)
4. Extract customer information
5. Determine order type from metadata
6. Calculate totals (subtotal, shipping, tax)
7. Create order in database
8. Send customer confirmation email (async, non-blocking)
9. Send admin notification email (async, non-blocking)

**Error Handling:**
- Email failures don't block webhook response
- Order creation errors logged but don't fail webhook
- Stripe receives successful response even if emails fail

### Email Service

**Location:** `src/services/emailService.ts`

**Singleton Service:** One instance shared across application

**Methods:**
- `sendOrderConfirmation(order)` - Customer confirmation
- `sendShippingNotification(order)` - Shipping update
- `sendAdminNewOrderNotification(order)` - Admin alert

**Fallback Mode:**
- If SMTP not configured, logs emails to console
- Application continues to function
- No errors thrown

## Production Checklist

Before going live, ensure:

- [ ] SMTP configured in Railway
- [ ] `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` set
- [ ] `EMAIL_FROM` set (e.g., `Final Bell <hello@finalbell.co.uk>`)
- [ ] `ADMIN_EMAIL` set (e.g., `admin@finalbell.co.uk`)
- [ ] Test guest checkout on staging
- [ ] Test authenticated checkout on staging
- [ ] Verify emails received by customer
- [ ] Verify emails received by admin
- [ ] Check spam folders if emails missing
- [ ] Monitor Railway logs for email errors
- [ ] Test with real Stripe (not test mode)
- [ ] Verify order appears in admin panel
- [ ] Verify correct customer identification in orders

## Troubleshooting

### Problem: Emails not received

**Solutions:**
1. Check Railway environment variables are set
2. Check spam/junk folder
3. Verify SMTP credentials are correct
4. Check Railway logs: `railway logs`
5. Test SMTP credentials with a mail client
6. Ensure email domain isn't blacklisted

### Problem: Gmail blocking sign-in

**Solutions:**
1. Enable 2-Step Verification
2. Use App Password (not regular password)
3. Allow less secure apps (not recommended)
4. Use a dedicated email service instead

### Problem: SendGrid emails not sending

**Solutions:**
1. Verify sender email in SendGrid dashboard
2. Wait for domain verification
3. Check API key permissions
4. Review SendGrid activity logs

### Problem: Admin emails not received

**Solutions:**
1. Verify `ADMIN_EMAIL` environment variable is set
2. Check admin email spam folder
3. Verify admin email is valid
4. Check Railway logs for send errors

## Next Steps

1. **Choose an email provider** (Gmail for testing, SendGrid/Mailgun for production)
2. **Add SMTP credentials** to Railway environment variables
3. **Redeploy** (automatic with Railway)
4. **Test guest checkout** with test card
5. **Verify emails** are received
6. **Go live!**

## Support

If you encounter issues:

1. **Check Railway logs:** `railway logs`
2. **Test SMTP locally:** Use the same credentials in your local .env
3. **Verify Stripe webhook:** Check Stripe Dashboard > Webhooks
4. **Review this guide:** All common issues are covered above

Your backend is fully functional for guest checkout - you just need to configure SMTP to enable email sending! 🚀
