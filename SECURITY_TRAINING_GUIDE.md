# 🔐 API Security Training Guide: Final Bell API

**Created**: 2025-11-07
**Purpose**: Educational guide to understand the security implementations in this API
**Audience**: Developers learning security best practices

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Session Management](#2-session-management)
3. [Password Security](#3-password-security)
4. [Rate Limiting & DDoS Protection](#4-rate-limiting--ddos-protection)
5. [Security Headers](#5-security-headers)
6. [Input Validation & Sanitization](#6-input-validation--sanitization)
7. [Error Handling & Information Disclosure](#7-error-handling--information-disclosure)
8. [Database Security](#8-database-security)
9. [Environment & Secrets Management](#9-environment--secrets-management)
10. [Testing Your Security](#10-testing-your-security)

---

## 1. Authentication & Authorization

### 🎯 What We Implemented

#### JWT-Based Authentication
**Location**: `src/utils/jwt.ts`

**Why JWT?**
- Stateless: No server-side session storage needed
- Scalable: Works across multiple servers
- Self-contained: Contains user info and expiration

**How It Works**:
```typescript
// Access Token (short-lived: 15 minutes)
const accessToken = generateAccessToken({
  userId: user.id,
  email: user.email,
  role: user.role
});

// Refresh Token (long-lived: 7 days)
const refreshToken = generateRefreshToken({
  userId: user.id,
  email: user.email,
});
```

**Security Pattern**: Two-token system
- **Access Token**: Short expiration (15 min) - used for API requests
- **Refresh Token**: Longer expiration (7 days) - used to get new access tokens

**Why Two Tokens?**
- If access token is stolen, it expires quickly
- Refresh token is stored in HTTP-only cookie (harder to steal)
- Can revoke refresh tokens by checking database

---

#### Token Rotation
**Location**: `src/controllers/authController.ts` (refresh function, lines 204-217)

**What Is Token Rotation?**
Every time a refresh token is used, we issue a NEW refresh token and invalidate the old one.

```typescript
export const refresh = async (req: Request, res: Response): Promise<void> => {
  // 1. Verify old refresh token
  const payload = verifyRefreshToken(refreshToken);

  // 2. Generate NEW refresh token (this is the rotation)
  const newRefreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
  });

  // 3. Send new refresh token (old one is now useless)
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};
```

**Why Rotate?**
- **Stolen Token Protection**: If attacker steals refresh token, they can only use it once
- **Replay Attack Prevention**: Old tokens don't work anymore
- **Security Window**: Limits exposure time of any single token

**Real-World Scenario**:
```
Day 1: User logs in → Gets Token A
Day 2: User refreshes → Gets Token B (Token A now invalid)
Day 3: Attacker steals Token B → Uses it once → Gets Token C
Day 3: Real user tries Token B → FAILS (we know something is wrong!)
```

---

#### Admin Authentication with Database Verification
**Location**: `src/middleware/adminAuth.ts` (lines 45-72)

**The Problem We Solved**:
```typescript
// ❌ BAD: Only check token payload
if (decoded.role === 'ADMIN') {
  next(); // What if admin was deactivated?
}

// ✅ GOOD: Check database too
const user = await prisma.user.findUnique({
  where: { id: decoded.userId },
  select: { id: true, email: true, role: true, isActive: true }
});

if (!user || !user.isActive) {
  res.status(401).json({ message: 'User not found or inactive' });
  return;
}

// Use DATABASE role, not token role
if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
  res.status(403).json({ message: 'Admin access required' });
  return;
}
```

**Why Database Verification?**
- **Immediate Revocation**: Admin account disabled? Access denied immediately
- **Role Changes**: Admin demoted to user? New role applies instantly
- **No Stale Tokens**: Token says "admin" but DB says "user"? DB wins
- **Account Status**: Inactive accounts can't use valid tokens

**Performance Note**:
- Yes, this adds a database query to each admin request
- But security > speed for admin operations
- Could add Redis caching if this becomes a bottleneck

---

### 🔑 Key Takeaways

1. **Never trust JWT alone** - Always verify with database for sensitive operations
2. **Rotate refresh tokens** - Limits damage from token theft
3. **Short access tokens** - Reduces exposure window
4. **HTTP-only cookies** - Protects refresh tokens from XSS

---

## 2. Session Management

### 🍪 Cookie Security Configuration
**Location**: `src/controllers/authController.ts` (lines 148-154)

```typescript
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,    // ← JavaScript cannot access this cookie
  secure: true,      // ← Only sent over HTTPS
  sameSite: 'lax',   // ← CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  domain: process.env.NODE_ENV === 'production' ? '.finalbell.co.uk' : undefined
});
```

**Let's Break Down Each Setting**:

#### `httpOnly: true`
**What It Does**: Prevents JavaScript from accessing the cookie via `document.cookie`

**Attack It Prevents**: XSS (Cross-Site Scripting)
```javascript
// ❌ Without httpOnly:
// Attacker injects: <script>steal(document.cookie)</script>
// They get your refresh token!

// ✅ With httpOnly:
// Attacker tries: console.log(document.cookie)
// Result: "" (empty - cookie is invisible to JS)
```

#### `secure: true`
**What It Does**: Cookie only sent over HTTPS connections

**Attack It Prevents**: Man-in-the-Middle attacks
```
❌ Without secure (HTTP connection):
Client → [Cookie: refreshToken=abc123] → Server
            ↑ Attacker can intercept this!

✅ With secure (HTTPS only):
Client → [Encrypted: Cookie=***] → Server
         Attacker sees encrypted gibberish
```

**Why Always True?**
Originally we had: `secure: process.env.NODE_ENV === 'production'`

**Problem**: In development, cookies worked fine. In production, they suddenly broke because we forgot HTTPS setup!

**Solution**: Always require HTTPS. Use a tool like `ngrok` for local HTTPS testing.

#### `sameSite: 'lax'`
**What It Does**: Controls when cookies are sent with cross-origin requests

**Options Explained**:
- `strict`: Cookie NEVER sent on any cross-site request
- `lax`: Cookie sent on top-level navigation (clicking links)
- `none`: Cookie sent on all requests (requires `secure: true`)

**Why `lax` Instead of `strict`?**
```
Scenario: User clicks email link to finalbell.co.uk/dashboard

With sameSite: 'strict'
→ Cookie not sent
→ User appears logged out
→ Bad UX!

With sameSite: 'lax'
→ Cookie IS sent (top-level navigation)
→ User stays logged in
→ Good UX!
```

**Attack It Prevents**: CSRF (Cross-Site Request Forgery)
```html
<!-- Attacker's website -->
<form action="https://finalbell.co.uk/admin/delete" method="POST">
  <input type="hidden" name="userId" value="123">
</form>
<script>document.forms[0].submit()</script>

❌ Without sameSite: Cookie sent → Admin action executed!
✅ With sameSite: Cookie NOT sent → Attack fails!
```

#### `domain` Setting
```typescript
domain: process.env.NODE_ENV === 'production' ? '.finalbell.co.uk' : undefined
```

**What This Does**:
- Production: Cookie works on `finalbell.co.uk` AND `api.finalbell.co.uk`
- Development: Cookie works only on `localhost`

**The Dot Prefix**:
- `.finalbell.co.uk` (with dot) → Works on all subdomains
- `finalbell.co.uk` (no dot) → Only exact domain

---

### 🔑 Key Takeaways

1. **httpOnly** = Protects from XSS
2. **secure** = Protects from MITM
3. **sameSite** = Protects from CSRF
4. **Always use all three** = Defense in depth!

---

## 3. Password Security

### 🔒 Strong Password Requirements
**Location**: `src/controllers/authController.ts` (lines 27-40)

```typescript
// Minimum length
if (password.length < 12) {
  res.status(400).json({ error: 'Password must be at least 12 characters long' });
  return;
}

// Complexity requirements
const hasUppercase = /[A-Z]/.test(password);
const hasLowercase = /[a-z]/.test(password);
const hasNumber = /[0-9]/.test(password);
const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

if (!(hasUppercase && hasLowercase && hasNumber && hasSpecialChar)) {
  res.status(400).json({
    error: 'Password must include uppercase, lowercase, number, and special character'
  });
  return;
}
```

**Why 12 Characters?**

Let's do the math:

```
8 characters (lowercase only):
26^8 = 208,827,064,576 combinations
Time to crack: ~2 hours with modern hardware

12 characters (all types):
94^12 = 475,920,314,814,253,376,475,136 combinations
Time to crack: ~34,000 years!
```

**Character Set Size**:
- Lowercase (a-z): 26 characters
- Uppercase (A-Z): 26 characters
- Numbers (0-9): 10 characters
- Special (!@#$...): 32 characters
- **Total**: 94 possible characters per position

---

### 🔐 Password Hashing with Bcrypt
**Location**: `src/utils/password.ts`

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
```

**What Is Bcrypt?**
A password hashing algorithm designed to be **intentionally slow**.

**Why Slow Is Good?**
```
Fast hash (MD5):
Attacker tries 1,000,000 passwords/second
→ Cracks 8-char password in minutes

Slow hash (Bcrypt):
Attacker tries 100 passwords/second
→ Cracks 8-char password in years
```

**What Are Salt Rounds?**
The number of times bcrypt processes the password.

```
Salt Rounds = 10: ~10 hashes per second (~100ms per password)
Salt Rounds = 12: ~2.5 hashes per second (~400ms per password)
Salt Rounds = 14: ~0.6 hashes per second (~1600ms per password)
```

**Why 12 Rounds?**
- **10 rounds**: Fast enough but getting weak (computers are faster now)
- **12 rounds**: Sweet spot - secure but not annoyingly slow
- **14 rounds**: Very secure but user waits 1.6 seconds per login

**What Is a Salt?**
A random value added to password before hashing.

```
Without salt:
hash("password123") = "abc123def456" (same for everyone!)
→ Attacker builds "rainbow table" of common password hashes
→ Instant crack!

With salt:
user1: hash("password123" + "x7f9k2") = "xyz789..."
user2: hash("password123" + "a2m5q8") = "abc123..."
→ Same password, different hashes
→ Rainbow tables useless!
```

**Bcrypt Auto-Salts**: No need to generate salt yourself, bcrypt does it!

---

### 🔑 Key Takeaways

1. **12+ characters** - Exponentially harder to crack
2. **Complexity required** - Prevents dictionary attacks
3. **Bcrypt, not MD5/SHA** - Slow = secure for passwords
4. **12 salt rounds** - Balance of security and performance
5. **Never store plain passwords** - ALWAYS hash!

---

## 4. Rate Limiting & DDoS Protection

### 🚦 Rate Limiting Strategy
**Location**: `src/middleware/rateLimiter.ts`

We implement **multiple layers** of rate limiting:

```typescript
// Layer 1: General API protection
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests from this IP',
});

// Layer 2: Strict auth endpoint protection
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // Only 5 attempts
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Layer 3: CSV sync protection
export const csvSyncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,                    // 10 syncs per hour
});

// Layer 4: Checkout protection
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                    // 20 checkout attempts
});
```

**Why Different Limits?**

| Endpoint Type | Limit | Reasoning |
|--------------|-------|-----------|
| General API | 100/15min | Normal browsing generates ~10-20 requests/min |
| Auth | 5/15min | Brute force protection - legitimate users don't fail 5 times |
| Refresh | 5/15min | Should rarely be called (only every 15min), prevents token farming |
| CSV Sync | 10/hour | Resource-intensive operation |
| Checkout | 20/15min | Legitimate users might retry, but not 20 times |

---

### 🎯 Understanding `skipSuccessfulRequests`

**Location**: Auth limiter configuration

```typescript
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // ← This is important!
});
```

**How It Works**:

```
Scenario 1: Legitimate user forgets password
────────────────────────────────────────────
Attempt 1: wrong password → Count: 1
Attempt 2: wrong password → Count: 2
Attempt 3: wrong password → Count: 3
Attempt 4: wrong password → Count: 4
Attempt 5: wrong password → Count: 5
Attempt 6: wrong password → BLOCKED! ✋

Scenario 2: Legitimate user gets it right
────────────────────────────────────────────
Attempt 1: wrong password → Count: 1
Attempt 2: RIGHT PASSWORD → Count: RESET to 0! ✅
Attempt 3: logged in, no issue

Scenario 3: Attacker brute force
────────────────────────────────────────────
Attempt 1-5: all wrong → Count: 5
Attempt 6: BLOCKED (even if correct password)
```

**Why This Matters**:
- **False Positives Reduced**: Real users who successfully log in aren't rate-limited
- **Brute Force Still Blocked**: Attackers can't keep guessing
- **Better UX**: Legitimate users can log in multiple times if needed

---

### ⚡ Attack Scenarios Prevented

#### 1. Brute Force Login Attack
```bash
# Attacker tries common passwords
POST /auth/login {"email": "admin@finalbell.co.uk", "password": "password123"}
POST /auth/login {"email": "admin@finalbell.co.uk", "password": "admin123"}
POST /auth/login {"email": "admin@finalbell.co.uk", "password": "qwerty"}
POST /auth/login {"email": "admin@finalbell.co.uk", "password": "letmein"}
POST /auth/login {"email": "admin@finalbell.co.uk", "password": "123456"}
POST /auth/login {"email": "admin@finalbell.co.uk", "password": "password"}
Response: 429 Too Many Requests ✅
```

#### 2. Token Farming Attack
```bash
# Attacker tries to generate many tokens
POST /auth/refresh (valid refresh token)
POST /auth/refresh (valid refresh token)
POST /auth/refresh (valid refresh token)
POST /auth/refresh (valid refresh token)
POST /auth/refresh (valid refresh token)
POST /auth/refresh (valid refresh token)
Response: 429 Too Many Requests ✅
```

#### 3. Credential Stuffing
```bash
# Attacker uses leaked email/password combos from other breaches
POST /auth/login {"email": "user1@gmail.com", "password": "leaked123"}
POST /auth/login {"email": "user2@gmail.com", "password": "leaked456"}
POST /auth/login {"email": "user3@gmail.com", "password": "leaked789"}
# ... 1000 more attempts
After 5 attempts per IP: 429 Too Many Requests ✅
```

#### 4. API Resource Exhaustion
```bash
# Attacker floods expensive endpoint
GET /users/search?q=a
GET /users/search?q=b
GET /users/search?q=c
# ... 200 requests
After 100 requests: 429 Too Many Requests ✅
```

---

### 🔑 Key Takeaways

1. **Layer your limits** - Different endpoints need different limits
2. **Skip successful requests** - Don't punish legitimate users
3. **Protect refresh endpoint** - Often forgotten but critical!
4. **Balance security and UX** - Too strict = frustrated users

---

## 5. Security Headers

### 🛡️ Helmet Middleware Configuration
**Location**: `src/server.ts` (lines 26-49)

```typescript
app.use(helmet({
  contentSecurityPolicy: { /* CSP rules */ },
  hsts: { /* HTTPS enforcement */ },
  frameguard: { /* Clickjacking protection */ },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

Let's understand each header:

---

#### Content Security Policy (CSP)

**What It Does**: Controls which resources the browser can load

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],  // Only load from our domain
    styleSrc: ["'self'", "'unsafe-inline'", "https://googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", 'data:', "https:"],
    scriptSrc: ["'self'", "https://js.stripe.com"],
    frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
    connectSrc: ["'self'", "https://api.stripe.com"]
  },
}
```

**Attack Prevented**: XSS (Cross-Site Scripting)

**Real-World Example**:
```html
<!-- Attacker injects this into your site -->
<script src="https://evil.com/steal-data.js"></script>

❌ Without CSP: Script loads and executes
✅ With CSP: Browser blocks script and logs error:
"Refused to load script from 'https://evil.com'
because it violates the Content-Security-Policy"
```

**Why `'unsafe-inline'` for Styles?**
```
Many CSS frameworks (like styled-components) use inline styles:
<div style="color: red;">

'unsafe-inline' allows this, but it's a calculated risk:
- Inline styles are less dangerous than inline scripts
- Alternative would break lots of UI frameworks
```

**Why Allow Stripe Domains?**
```
scriptSrc: ["'self'", "https://js.stripe.com"]
→ Need Stripe.js for payment processing

frameSrc: ["https://js.stripe.com"]
→ Stripe checkout opens in iframe

connectSrc: ["https://api.stripe.com"]
→ API calls to Stripe backend
```

---

#### HSTS (HTTP Strict Transport Security)

```typescript
hsts: {
  maxAge: 31536000,      // 1 year in seconds
  includeSubDomains: true,
  preload: true
}
```

**What It Does**: Forces browsers to always use HTTPS

**Attack Prevented**: SSL Stripping / Downgrade Attacks

**Real-World Attack**:
```
Step 1: User types "finalbell.co.uk" (no https://)
Step 2: Browser tries http://finalbell.co.uk first
Step 3: Attacker intercepts and serves fake page
Step 4: User enters password on HTTP ❌

With HSTS:
Step 1: User types "finalbell.co.uk"
Step 2: Browser remembers "Always HTTPS for this domain!"
Step 3: Browser uses https://finalbell.co.uk automatically
Step 4: Attacker can't intercept ✅
```

**Why 1 Year?**
```
Too short (1 day): User vulnerable between visits
Too long (10 years): Can't undo if you need to disable HTTPS
1 year: Standard recommendation - long enough to be effective
```

**What Is `preload`?**
```
preload: true means your site can be added to the
"HSTS Preload List" - a hardcoded list in browsers.

Result: EVEN FIRST VISIT is protected!
(Submit your domain at hstspreload.org)
```

---

#### Frameguard (X-Frame-Options)

```typescript
frameguard: {
  action: 'deny'  // Site cannot be loaded in iframe
}
```

**Attack Prevented**: Clickjacking

**Clickjacking Explained**:
```html
<!-- Attacker's evil.com page -->
<iframe src="https://finalbell.co.uk/admin/delete-account"
        style="opacity: 0; position: absolute; top: 0;">
</iframe>

<button style="position: absolute; top: 0;">
  CLICK HERE FOR FREE IPHONE! 🎁
</button>

User thinks they're clicking "Free iPhone" button
Actually clicking invisible "Delete Account" button ❌
```

**With Frameguard**:
```
Browser refuses to load finalbell.co.uk in iframe
Attacker's trick fails ✅
```

**Exceptions**: Stripe iframes are allowed via CSP frameSrc

---

#### noSniff (X-Content-Type-Options)

```typescript
noSniff: true
```

**What It Does**: Prevents MIME type sniffing

**Attack Prevented**: MIME Confusion attacks

**Real-World Attack**:
```
Attacker uploads image.jpg to your site
But it's actually JavaScript disguised as image!

Without noSniff:
Browser: "This says .jpg but looks like JavaScript...
          I'll execute it as JavaScript!"
→ Attacker code runs ❌

With noSniff:
Browser: "This says .jpg, I'll treat it ONLY as image"
→ No execution, safe ✅
```

---

#### XSS Filter

```typescript
xssFilter: true
```

**What It Does**: Enables browser's built-in XSS protection

**Modern Status**: Mostly deprecated in favor of CSP
- Chrome/Edge: Removed (CSP is better)
- Firefox: Never had it
- Safari: Still has it

**Why Include It?**
```
Defense in depth - doesn't hurt to enable
Works as backup for old browsers
```

---

#### Referrer Policy

```typescript
referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
```

**What It Does**: Controls what information is sent in Referer header

**Policy Explained**:
```
User on: https://finalbell.co.uk/dashboard?token=secret123
Clicks link to: https://external-site.com

strict-origin-when-cross-origin:
→ Referer sent: https://finalbell.co.uk
→ Query params (token) NOT included ✅
→ Full path (/dashboard) NOT included ✅

Without this policy:
→ Referer sent: https://finalbell.co.uk/dashboard?token=secret123
→ external-site.com now has your token ❌
```

---

#### Permissions Policy

**Location**: `src/server.ts` (lines 51-59)

```typescript
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self), ' +
    'usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  next();
});
```

**What It Does**: Controls which browser features can be used

**Why Disable Camera/Microphone?**
```
Your API doesn't need camera access
Prevents malicious scripts from:
- Spying through webcam
- Recording audio
- Tracking location
```

**Why `payment=(self)`?**
```
payment=(self) means only OUR domain can use Payment APIs
Needed for Stripe integration
Prevents third-party scripts from initiating payments
```

---

### 🔑 Key Takeaways

1. **CSP** = Whitelist allowed resources
2. **HSTS** = Force HTTPS always
3. **Frameguard** = Prevent clickjacking
4. **noSniff** = No MIME confusion
5. **Referrer Policy** = Don't leak URLs
6. **Permissions Policy** = Minimize browser permissions

---

## 6. Input Validation & Sanitization

### ✅ Validation Strategy

**Location**: Throughout `src/controllers/authController.ts`

```typescript
// 1. Check required fields exist
if (!email || !password || !firstName || !lastName) {
  res.status(400).json({ error: 'Required fields missing' });
  return;
}

// 2. Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  res.status(400).json({ error: 'Invalid email format' });
  return;
}

// 3. Validate password strength
if (password.length < 12) {
  res.status(400).json({ error: 'Password must be at least 12 characters' });
  return;
}

// 4. Validate enum values
const validRoles = ['CLIENT', 'TRAINER', 'ADMIN'];
if (!validRoles.includes(userRole)) {
  res.status(400).json({ error: 'Invalid role' });
  return;
}
```

**The Validation Pyramid**:
```
                    ▲
                   ╱ ╲
                  ╱   ╲
                 ╱     ╲
                ╱ Logic ╲        ← Business rules (age > 18, etc)
               ╱─────────╲
              ╱           ╲
             ╱  Format     ╲      ← Structure (valid email, phone)
            ╱───────────────╲
           ╱                 ╲
          ╱    Type Check     ╲    ← Data type (string, number)
         ╱─────────────────────╲
        ╱                       ╲
       ╱     Presence Check      ╲  ← Field exists and not empty
      ╱─────────────────────────────╲

Validate from bottom to top!
```

---

### 🧹 Sanitization vs Validation

**Validation**: Check if input is acceptable
**Sanitization**: Clean/modify input to make it safe

```typescript
// ❌ Dangerous: No sanitization
app.post('/search', (req, res) => {
  const query = req.body.searchTerm;
  const results = await db.query(`SELECT * FROM users WHERE name = '${query}'`);
  // SQL Injection vulnerability!
});

// ✅ Safe: Prisma ORM sanitizes automatically
app.post('/search', (req, res) => {
  const query = req.body.searchTerm;
  const results = await prisma.user.findMany({
    where: { name: query }  // Prisma handles escaping
  });
});
```

---

### 🛡️ SQL Injection Prevention

**We Use**: Prisma ORM (Object-Relational Mapping)

**How Prisma Protects Us**:

```typescript
// ❌ Raw SQL (DANGEROUS)
const userId = req.params.id;
const query = `SELECT * FROM users WHERE id = ${userId}`;
// Attacker sends: id = "1 OR 1=1" → Returns all users!

// ✅ Prisma (SAFE)
const userId = req.params.id;
const user = await prisma.user.findUnique({
  where: { id: userId }
});
// Prisma escapes: id = "1 OR 1=1" → Looks for literal string "1 OR 1=1"
// No user found, returns null, safe!
```

**Parameterized Queries** (What Prisma does internally):
```sql
-- Bad: String concatenation
SELECT * FROM users WHERE email = '" + userInput + "'

-- Good: Parameterized
SELECT * FROM users WHERE email = $1
-- Database treats $1 as data, never as SQL code
```

---

### 📧 Email Validation

```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  res.status(400).json({ error: 'Invalid email format' });
  return;
}
```

**Regex Breakdown**:
```
^           Start of string
[^\s@]+     One or more chars that aren't space or @
@           Literal @ symbol
[^\s@]+     One or more chars that aren't space or @
\.          Literal dot (escaped)
[^\s@]+     One or more chars that aren't space or @
$           End of string

Examples:
✅ user@example.com
✅ user.name@example.co.uk
❌ user@example (no TLD)
❌ @example.com (no username)
❌ user @example.com (space)
```

**Why Not More Complex Regex?**

```
Full email validation regex is 100+ characters long!
Examples:
✅ user+tag@example.com
✅ "user name"@example.com
✅ user@[192.168.1.1]

Our simple regex catches 99% of typos
Edge cases are rare in real-world usage
Keep it simple!
```

---

### 🔑 Key Takeaways

1. **Validate early** - At the controller level, before business logic
2. **Fail securely** - Invalid input = reject request
3. **Use ORMs** - Prisma prevents SQL injection automatically
4. **Simple is better** - Don't over-engineer validation regex
5. **Never trust client data** - Validate EVERYTHING from requests

---

## 7. Error Handling & Information Disclosure

### 🚨 The Problem: Information Leakage

**Location**: `src/middleware/errorHandler.ts`

**Bad Example** (What we DON'T do):
```typescript
// ❌ DANGEROUS: Leaks sensitive info
app.post('/login', async (req, res) => {
  try {
    const user = await db.findUser(req.body.email);
    if (!user) {
      return res.status(404).json({
        error: 'User not found in database'  // ❌ Tells attacker email doesn't exist!
      });
    }

    if (!bcrypt.compare(req.body.password, user.passwordHash)) {
      return res.status(401).json({
        error: 'Password incorrect for user@example.com'  // ❌ Confirms email exists!
      });
    }
  } catch (err) {
    return res.status(500).json({
      error: err.message,  // ❌ "Database connection failed at 192.168.1.50:3306"
      stack: err.stack     // ❌ Full file paths, line numbers
    });
  }
});
```

**Why This Is Dangerous**:
1. **Email Enumeration**: Attacker knows which emails are registered
2. **Stack Traces**: Reveals code structure, file paths, technologies used
3. **Database Info**: Connection strings, table names, internal IPs

---

### ✅ Our Solution: Sanitized Error Logging

```typescript
// SECURITY: Sanitize request body for logging
const sanitizeBody = (body: any): any => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'pin'
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};
```

**How It Works**:

```typescript
// Original error log (UNSAFE):
console.error({
  body: {
    email: "user@example.com",
    password: "SuperSecret123!"  // ❌ Password visible in logs!
  }
});

// Sanitized error log (SAFE):
console.error({
  body: {
    email: "user@example.com",
    password: "[REDACTED]"  // ✅ Password hidden
  }
});
```

---

### 🎭 Generic Error Messages

```typescript
// Good login error handling
export const login = async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // ❌ DON'T: "User not found"
    // ✅ DO: Generic message
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    // ❌ DON'T: "Password incorrect"
    // ✅ DO: Same generic message
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
};
```

**Why Generic Messages?**

**Attacker's Perspective**:
```
Try login with test1@example.com:
→ "User not found"
→ Attacker knows: Email not registered ✅

Try login with test2@example.com:
→ "Password incorrect"
→ Attacker knows: Email IS registered! ✅

Result: Attacker can enumerate all registered emails
```

**With Generic Messages**:
```
Try ANY email:
→ "Invalid email or password"
→ Attacker learns: Nothing! Can't tell if email exists or not ✅
```

---

### 📊 Environment-Based Error Detail

```typescript
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log everything internally (for developers)
  console.error('[Error Handler]', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    statusCode: err.statusCode || 500,
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    body: env.NODE_ENV === 'development' ? sanitizeBody(req.body) : undefined,
  });

  // Send minimal info to client
  res.status(statusCode).json({
    error: {
      message: err.message,  // Generic user-friendly message only
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      // Only include stack in development
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
```

**Development vs Production**:

| Environment | Logs | Response to Client |
|-------------|------|-------------------|
| Development | Everything (stack, body, etc) | Everything (helps debugging) |
| Production | Everything (for devs to debug) | Minimal (no sensitive data) |

---

### 🔒 Operational vs Programming Errors

```typescript
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;  // ← This flag matters!
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;  // ← Expected error
  return error;
};
```

**Two Types of Errors**:

1. **Operational Errors** (Expected, safe to handle):
   - User enters wrong password
   - Email already registered
   - Invalid input format
   - Rate limit exceeded

2. **Programming Errors** (Unexpected, might indicate attack):
   - Database connection lost
   - Undefined variable
   - Out of memory
   - Null pointer exception

**Why Distinguish?**

```typescript
if (error.isOperational) {
  // Safe to show user
  res.status(error.statusCode).json({
    error: error.message  // "Email already registered"
  });
} else {
  // Programming error - show generic message
  res.status(500).json({
    error: 'Internal server error'  // Don't reveal technical details
  });

  // Alert developers
  logger.critical('Unexpected error', error);
}
```

---

### 🔑 Key Takeaways

1. **Sanitize logs** - Never log passwords/tokens
2. **Generic messages** - Don't reveal if emails exist
3. **Environment-aware** - Stack traces only in dev
4. **Distinguish errors** - Operational vs programming
5. **Log everything internally** - But share nothing externally

---

## 8. Database Security

### 🛡️ Prisma ORM: Built-in Protection

**Location**: `src/config/database.ts`

**What Prisma Gives Us**:

1. **Parameterized Queries** (SQL Injection Protection)
2. **Type Safety** (Can't query non-existent fields)
3. **Connection Pooling** (Prevents connection exhaustion)
4. **Automatic Escaping** (Special characters handled safely)

---

### 🔐 Connection Security

```typescript
// DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@localhost:5432/finalbell?schema=public"
```

**Production Checklist**:

```
✅ Use SSL/TLS for database connection
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

✅ Use strong database password (same rules as user passwords)
❌ password123
✅ x8#mK9$pL2@vN4&qR6

✅ Restrict database user permissions
❌ GRANT ALL PRIVILEGES (admin access)
✅ GRANT SELECT, INSERT, UPDATE, DELETE ON specific tables

✅ Database firewall rules
❌ Allow 0.0.0.0/0 (everyone)
✅ Allow only API server IP

✅ Keep database on private network
❌ Public IP: 54.123.45.67:5432
✅ Private IP: 10.0.1.50:5432 (not routable from internet)
```

---

### 👁️ Selective Data Exposure

**Location**: `src/middleware/auth.ts` (lines 36-44)

```typescript
const user = await prisma.user.findUnique({
  where: { id: payload.userId },
  select: {
    id: true,
    email: true,
    role: true,
    isActive: true,
    // ❌ NOTE: passwordHash is NOT selected!
  },
});
```

**Why `select` Instead of Fetching Everything?**

```typescript
// ❌ BAD: Returns everything
const user = await prisma.user.findUnique({
  where: { id: userId }
});

console.log(user);
// {
//   id: "123",
//   email: "user@example.com",
//   passwordHash: "$2b$12$...",  ← Should never leave database!
//   stripeCustomerId: "cus_...",  ← Sensitive payment info
//   // ... everything
// }

// ✅ GOOD: Only what we need
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    role: true
  }
});

console.log(user);
// {
//   id: "123",
//   email: "user@example.com",
//   role: "USER"
// }
// passwordHash never even loaded from DB!
```

**Benefits**:
1. **Security**: Sensitive fields can't accidentally leak
2. **Performance**: Less data transferred from database
3. **Clarity**: Explicit about what data is needed

---

### 🔒 Row-Level Authorization

```typescript
// ❌ BAD: No authorization check
app.delete('/users/:id', async (req, res) => {
  await prisma.user.delete({
    where: { id: req.params.id }
  });
  // User could delete ANY account!
});

// ✅ GOOD: Check ownership
app.delete('/users/:id', authenticateToken, async (req, res) => {
  const requestedId = req.params.id;
  const currentUserId = req.user.userId;

  // Only allow users to delete their own account
  if (requestedId !== currentUserId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await prisma.user.delete({
    where: { id: requestedId }
  });
});
```

---

### 🔑 Key Takeaways

1. **Use ORM** - Prisma prevents SQL injection
2. **Secure connection** - SSL, strong passwords, firewall
3. **Select specific fields** - Don't expose passwordHash
4. **Check ownership** - Users should only access their own data
5. **Private network** - Database not publicly accessible

---

## 9. Environment & Secrets Management

### 🔐 Environment Variable Validation
**Location**: `src/config/env.ts` (lines 170-192)

```typescript
export const validateEnv = (): void => {
  // 1. Check required variables exist
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    throw new Error('Environment validation failed');
  }

  // 2. SECURITY: Validate secret strength
  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  if (env.REFRESH_TOKEN_SECRET.length < 32) {
    throw new Error('REFRESH_TOKEN_SECRET must be at least 32 characters long');
  }

  console.log('✓ Environment variables validated');
};
```

---

### 🎯 Why Validate Secret Length?

**Weak Secret Attack**:

```
Weak Secret (10 chars):
JWT_SECRET="myapp12345"

Attacker brute-forces:
Try "myapp12345" → ✅ Works!
Time taken: ~1 second
→ Attacker can forge any JWT token!

Strong Secret (32+ chars):
JWT_SECRET="x7#mK9$pL2@vN4&qR6!tY8^wZ3*sF5%h"

Attacker brute-forces:
Try all combinations...
Time taken: ~1,000,000,000 years
→ Practically impossible!
```

**Secret Length Math**:
```
32 characters (alphanumeric + special)
94 possible characters per position
94^32 = 6.3 × 10^63 combinations

For perspective:
Atoms in universe: ~10^80
Strong enough? Yes! 😅
```

---

### 📁 .gitignore Configuration
**Location**: `.gitignore`

```gitignore
# Environment variables - Keep out of version control
.env
.env.local
.env.*.local
.env.development
.env.production

# Secrets
*.pem
*.key
*.cert
```

**Why This Matters**:

**Real-World Disaster Scenario**:
```bash
# Developer commits .env file
git add .env
git commit -m "Fix config"
git push origin main

# .env contains:
DATABASE_URL="postgresql://admin:SuperSecret123@db.example.com:5432/prod"
JWT_SECRET="myweaksecret"
STRIPE_SECRET_KEY="sk_live_..."

# Repository is public on GitHub
# Within minutes:
# 1. GitHub secret scanning detects keys
# 2. Bots scrape for credentials
# 3. Database is compromised
# 4. Stripe account charged $50,000
# 5. Customer data stolen
# 6. Company faces lawsuit

All because .env wasn't in .gitignore! 😱
```

**How to Fix Committed Secrets**:
```bash
# ⚠️ Not enough to just delete file:
git rm .env
git commit -m "Remove .env"
# Secret is still in git history!

# Must rewrite history (DESTRUCTIVE):
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Then rotate ALL secrets:
# - New database password
# - New JWT secrets
# - New API keys
# Everything was exposed!
```

---

### 🔑 Environment Variable Types

```typescript
interface EnvConfig {
  // Public (can be shown in logs)
  NODE_ENV: string;  // "development" or "production"
  PORT: number;      // 3000
  CLIENT_URL: string; // "https://finalbell.co.uk"

  // Private (NEVER log these)
  DATABASE_URL: string;           // Contains password!
  JWT_SECRET: string;             // Used to sign tokens
  REFRESH_TOKEN_SECRET: string;   // Used for refresh tokens
  STRIPE_SECRET_KEY: string;      // Payment processing
  STRIPE_WEBHOOK_SECRET: string;  // Webhook verification

  // API Keys (also private)
  AWS_SECRET_ACCESS_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ADMIN_API_KEY: string;
}
```

---

### 🏭 Production Secrets Management

**DON'T**:
```bash
# ❌ Hardcoded in code
const JWT_SECRET = "myapp12345";

# ❌ Stored in code repository
# ❌ Sent via email
# ❌ Stored in Slack/Discord
# ❌ Written on sticky note 😅
```

**DO**:
```bash
# ✅ Environment variables (Railway, Heroku, etc)
Railway Dashboard → Variables → Add Variable
JWT_SECRET=<paste 32+ char secret>

# ✅ Secret management services
AWS Secrets Manager
HashiCorp Vault
Google Secret Manager

# ✅ Encrypted at rest
# ✅ Rotated regularly (every 90 days)
# ✅ Access logged and monitored
```

---

### 🔐 Generating Strong Secrets

**Method 1: OpenSSL**
```bash
openssl rand -base64 32
# Output: x7#mK9$pL2@vN4&qR6!tY8^wZ3*sF5%h
```

**Method 2: Node.js**
```javascript
require('crypto').randomBytes(32).toString('hex')
// Output: 4f8a2b1c9d3e7f6a5b8c2d1e9f7a3b6c...
```

**Method 3: Password Manager**
```
1Password → Generate Password
- Length: 32
- Include: Letters, Numbers, Symbols
- Copy to .env
```

---

### 🔑 Key Takeaways

1. **Validate secrets** - Check length and format on startup
2. **.gitignore .env** - Never commit secrets to git
3. **32+ characters** - For cryptographic secrets
4. **Use secret managers** - In production (AWS Secrets Manager, etc)
5. **Rotate regularly** - Change secrets every 90 days
6. **Leaked secret?** - Rotate immediately and audit access logs

---

## 10. Testing Your Security

### 🧪 Manual Security Testing

#### Test 1: Rate Limiting
```bash
# Test auth endpoint rate limit (should block after 5 attempts)
for i in {1..10}; do
  curl -X POST http://localhost:8080/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo "Attempt $i"
done

# Expected:
# Attempts 1-5: 401 Unauthorized
# Attempts 6-10: 429 Too Many Requests ✅
```

#### Test 2: Password Validation
```bash
# Should reject weak password
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"weak",
    "firstName":"Test",
    "lastName":"User"
  }'

# Expected: 400 Bad Request
# "Password must be at least 12 characters long"

# Try password without special char
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"Password123",
    "firstName":"Test",
    "lastName":"User"
  }'

# Expected: 400 Bad Request
# "Password must include special character"
```

#### Test 3: Token Expiration
```bash
# 1. Login and save token
TOKEN=$(curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"ValidPass123!"}' \
  | jq -r '.accessToken')

# 2. Use token immediately (should work)
curl -X GET http://localhost:8080/users/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK

# 3. Wait 16 minutes (access token expires after 15 min)
sleep 960

# 4. Try again (should fail)
curl -X GET http://localhost:8080/users/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: 401 Unauthorized
# "Invalid or expired token" ✅
```

#### Test 4: SQL Injection
```bash
# Try SQL injection in login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"admin@example.com OR 1=1--",
    "password":"anything"
  }'

# Expected: 401 Unauthorized
# "Invalid email or password"
# (Prisma prevents SQL injection) ✅
```

#### Test 5: XSS Prevention
```bash
# Try injecting script in name
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"attacker@example.com",
    "password":"ValidPass123!",
    "firstName":"<script>alert(\"XSS\")</script>",
    "lastName":"Test"
  }'

# Expected: 201 Created
# But when data is returned, script tags should be:
# 1. Escaped in JSON response
# 2. Blocked by CSP headers when rendered in browser
```

#### Test 6: Cookie Security
```bash
# Check cookie security flags
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"ValidPass123!"}' \
  -v 2>&1 | grep -i "set-cookie"

# Expected in response:
# Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Lax ✅
```

#### Test 7: Security Headers
```bash
# Check security headers
curl -I http://localhost:8080/

# Expected headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Referrer-Policy: strict-origin-when-cross-origin
# Permissions-Policy: camera=(), microphone=(), ...
# Content-Security-Policy: default-src 'self'; ...
```

#### Test 8: Admin Authorization
```bash
# 1. Login as regular user
USER_TOKEN=$(curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"ValidPass123!"}' \
  | jq -r '.accessToken')

# 2. Try to access admin endpoint
curl -X GET http://localhost:8080/admin/users \
  -H "Authorization: Bearer $USER_TOKEN"

# Expected: 403 Forbidden
# "Admin access required" ✅
```

---

### 🤖 Automated Security Testing Tools

#### 1. OWASP ZAP (Zed Attack Proxy)
```bash
# Install
docker pull owasp/zap2docker-stable

# Run automated scan
docker run -t owasp/zap2docker-stable \
  zap-baseline.py -t http://localhost:8080

# Checks for:
# - SQL injection
# - XSS vulnerabilities
# - Security header issues
# - Cookie security
# - SSL/TLS configuration
```

#### 2. npm audit
```bash
# Check for vulnerable dependencies
npm audit

# Fix automatically (if possible)
npm audit fix

# Example output:
# ┌───────────────┬──────────────────────────────────────┐
# │ High          │ Prototype Pollution                  │
# ├───────────────┼──────────────────────────────────────┤
# │ Package       │ lodash                               │
# ├───────────────┼──────────────────────────────────────┤
# │ Patched in    │ >=4.17.21                            │
# └───────────────┴──────────────────────────────────────┘
```

#### 3. Snyk
```bash
# Install
npm install -g snyk

# Authenticate
snyk auth

# Test project
snyk test

# Monitor continuously
snyk monitor
```

#### 4. Bearer CLI (Security Scanner)
```bash
# Install
npm install -g @bearer/cli

# Scan for security issues
bearer scan .

# Checks for:
# - Hardcoded secrets
# - Insecure dependencies
# - Security misconfigurations
```

---

### 🎯 Security Checklist

Before deploying to production, verify:

```
Authentication & Authorization
✅ JWT secrets are 32+ characters
✅ Access tokens expire in 15 minutes
✅ Refresh tokens rotate on use
✅ Admin endpoints verify user in database
✅ Rate limiting on auth endpoints

Passwords
✅ Minimum 12 characters required
✅ Complexity requirements enforced
✅ Bcrypt with 12 salt rounds
✅ Passwords never logged

Session Management
✅ Cookies have httpOnly flag
✅ Cookies have secure flag
✅ Cookies have sameSite=lax
✅ Refresh tokens in HTTP-only cookies
✅ Access tokens short-lived

Security Headers
✅ Content-Security-Policy configured
✅ HSTS enabled (1 year)
✅ X-Frame-Options: DENY
✅ X-Content-Type-Options: nosniff
✅ Referrer-Policy set
✅ Permissions-Policy configured

Input Validation
✅ Email format validated
✅ Password strength validated
✅ Enum values validated
✅ Prisma ORM prevents SQL injection

Error Handling
✅ Passwords not logged
✅ Generic error messages (no enumeration)
✅ Stack traces only in development
✅ Sensitive fields sanitized in logs

Database
✅ Connection uses SSL
✅ Database password strong
✅ Only necessary fields selected
✅ Row-level authorization checks

Environment
✅ .env in .gitignore
✅ Secrets not committed to git
✅ Environment validation on startup
✅ Secret strength validated

Rate Limiting
✅ General API: 100/15min
✅ Auth endpoints: 5/15min
✅ Refresh endpoint: 5/15min
✅ CSV sync: 10/hour
✅ Checkout: 20/15min
```

---

### 🔑 Key Takeaways

1. **Test manually** - Understand each security feature
2. **Automate scans** - Use OWASP ZAP, npm audit, Snyk
3. **Monitor continuously** - Security is ongoing, not one-time
4. **Use checklist** - Don't rely on memory
5. **Red team test** - Have someone try to break your API

---

## 📚 Additional Resources

### Books
- **"Web Security for Developers"** by Malcolm McDonald
- **"OWASP Top 10"** (Free online)
- **"The Web Application Hacker's Handbook"** by Dafydd Stuttard

### Websites
- [OWASP.org](https://owasp.org) - Security best practices
- [JWT.io](https://jwt.io) - JWT debugger and documentation
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)

### Tools
- **Postman** - API testing
- **Burp Suite** - Security testing
- **OWASP ZAP** - Automated vulnerability scanning
- **Snyk** - Dependency vulnerability scanning

### Online Courses
- [PortSwigger Web Security Academy](https://portswigger.net/web-security) (Free)
- [OWASP WebGoat](https://owasp.org/www-project-webgoat/) (Free practice)

---

## 🎓 Final Thoughts

Security is a **journey**, not a destination. This API implements industry best practices, but security landscapes evolve constantly.

**Remember**:
1. **Defense in Depth** - Multiple layers of security
2. **Principle of Least Privilege** - Minimum necessary access
3. **Fail Securely** - When in doubt, deny access
4. **Keep Learning** - New vulnerabilities discovered daily
5. **Security by Design** - Build it in from the start

**You've now learned**:
- ✅ How JWT authentication works
- ✅ Why token rotation prevents theft
- ✅ How to secure cookies properly
- ✅ Why password hashing is critical
- ✅ How rate limiting prevents brute force
- ✅ What security headers protect against
- ✅ How to prevent SQL injection
- ✅ Why generic error messages matter
- ✅ How to manage secrets safely
- ✅ How to test your security

---

**Happy Secure Coding! 🔐**

*Last Updated: 2025-11-07*
*API Version: 1.0.0*
*Security Score: 9/10*
