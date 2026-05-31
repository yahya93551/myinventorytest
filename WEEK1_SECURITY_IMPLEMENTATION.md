# 🎯 WEEK 1 IMPLEMENTATION GUIDE: Critical Security Setup
**Goal**: Eliminate production security risks  
**Effort**: ~12 hours this week  
**Timeline**: Day-by-day breakdown

---

## 📅 WEEK 1 SCHEDULE

### DAY 1 (Monday) - CSRF Protection (2 hours)

#### 1.1 Create CSRF Token Generator
Create new file: `lib/csrf.ts`

```typescript
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

/**
 * Generate a CSRF token and store it in HTTP-only cookie
 * Call this in any form that makes state-changing requests (POST/PATCH/DELETE)
 */
export async function generateCSRFToken(): Promise<string> {
  const token = randomUUID();
  const cookieJar = await cookies();
  
  cookieJar.set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60, // 1 hour
    path: '/',
  });
  
  return token;
}

/**
 * Validate CSRF token from request
 * Call this in API routes before processing state-changing requests
 */
export async function validateCSRFToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  
  const cookieJar = await cookies();
  const storedToken = cookieJar.get('csrf-token')?.value;
  
  return token === storedToken && !!storedToken;
}
```

#### 1.2 Add CSRF to Form Components
Update forms that POST/PATCH/DELETE data.

Example for adding a product:

```typescript
// components/AddProductForm.tsx (UPDATE existing)

'use client';

import { useEffect, useState } from 'react';
import { generateCSRFToken } from '@/lib/csrf';

export function AddProductForm() {
  const [csrfToken, setCSRFToken] = useState('');

  // Get CSRF token on mount
  useEffect(() => {
    const getToken = async () => {
      const token = await generateCSRFToken();
      setCSRFToken(token);
    };
    getToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken, // Add CSRF token header
      },
      body: JSON.stringify({
        name: 'Product Name',
        // ... other fields
      }),
    });

    // Handle response
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

#### 1.3 Add CSRF Validation to API Routes
Update all state-changing endpoints:

```typescript
// app/api/products/route.ts (UPDATE existing POST handler)

import { validateCSRFToken } from '@/lib/csrf';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // 1. Validate CSRF token FIRST
  const csrfToken = req.headers.get('x-csrf-token');
  const isValidCSRF = await validateCSRFToken(csrfToken);
  
  if (!isValidCSRF) {
    return NextResponse.json(
      { error: 'CSRF validation failed. Please refresh and try again.' },
      { status: 403 }
    );
  }

  // 2. Continue with existing validation
  const tenantContext = await getServerTenantContext(req);
  if ('error' in tenantContext) {
    return jsonError(tenantContext.error, tenantContext.status);
  }

  // 3. Rest of handler...
}
```

**Apply CSRF validation to**:
- [ ] `/api/products` (POST, PATCH, DELETE)
- [ ] `/api/sales` (POST)
- [ ] `/api/categories` (POST, PATCH, DELETE)
- [ ] `/api/subusers` (POST, DELETE)
- [ ] Any other state-changing endpoint

#### 1.4 Test CSRF Protection
```bash
# Test CSRF failure (should reject)
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{"name":"Test"}' \
  # Should get 403 CSRF validation failed

# Test CSRF success (get token first, then use it)
# This is handled by your forms automatically
```

**Status for Day 1**: ✅ CSRF Protection Added

---

### DAY 2 (Tuesday) - CORS Configuration (1 hour)

#### 2.1 Create CORS Headers Middleware
Create new file: `lib/cors.ts`

```typescript
import { NextResponse, NextRequest } from 'next/server';

/**
 * Add CORS headers to API response
 * Prevents unauthorized cross-origin requests
 */
export function addCORSHeaders(request: NextRequest, response: NextResponse) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  // If no origins configured, don't set CORS headers (be restrictive)
  if (!allowedOrigins.length) {
    return response;
  }

  const origin = request.headers.get('origin');
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.includes('*') || 
                    (origin && allowedOrigins.includes(origin));

  if (isAllowed) {
    response.headers.set(
      'Access-Control-Allow-Origin', 
      origin || allowedOrigins[0]
    );
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods', 
      'GET, POST, PATCH, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-CSRF-Token'
    );
  }

  return response;
}
```

#### 2.2 Add Environment Variable
Edit `.env.local`:

```env
# CORS - only your domain(s) allowed
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# For development:
# ALLOWED_ORIGINS=http://localhost:3000

# RESTRICT: Don't use * in production
```

#### 2.3 Apply CORS to API Routes
Update your main API middleware or apply to routes:

```typescript
// app/api/products/route.ts (UPDATE GET handler)

import { addCORSHeaders } from '@/lib/cors';

export async function GET(req: NextRequest) {
  // ... existing code ...
  
  const response = jsonSuccess(products);
  return addCORSHeaders(req, response);
}

// Do the same for POST, PATCH, DELETE handlers
```

**Or create a wrapper for all API routes**:
```typescript
// lib/withCORS.ts
export function withCORS(handler: Function) {
  return async (req: NextRequest) => {
    const response = await handler(req);
    return addCORSHeaders(req, response);
  };
}
```

**Status for Day 2**: ✅ CORS Protection Added

---

### DAY 3 (Wednesday) - Error Tracking Setup (2 hours)

#### 3.1 Install Sentry
```bash
npm install @sentry/nextjs
```

#### 3.2 Create Sentry Account & Get DSN
1. Go to [sentry.io](https://sentry.io)
2. Sign up (free tier: $0/month for up to 5k errors)
3. Create new project: Select "Next.js"
4. Copy your DSN (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/123456`)

#### 3.3 Configure Sentry in Your App
Create: `lib/sentry.server.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1, // 10% of requests (adjust as needed)
      debug: process.env.NODE_ENV === 'development',
      integrations: [
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
    });
  }
}
```

Update `app/layout.tsx`:

```typescript
import * as Sentry from '@sentry/nextjs';
import { initSentry } from '@/lib/sentry.server';

// Initialize Sentry
if (process.env.NODE_ENV === 'production') {
  initSentry();
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

#### 3.4 Add Environment Variable
Add to `.env.local`:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

#### 3.5 Capture Errors in API Routes
```typescript
// app/api/products/route.ts (UPDATE to add error handling)

import * as Sentry from '@sentry/nextjs';

export async function POST(req: NextRequest) {
  try {
    // ... existing code ...
  } catch (error) {
    // Send to Sentry
    Sentry.captureException(error, {
      tags: {
        endpoint: 'POST /api/products',
      },
    });

    return jsonError('Failed to create product', 500);
  }
}
```

#### 3.6 Test Sentry
Add temporary test error:

```typescript
// In any API route or component
if (process.env.NODE_ENV === 'development') {
  throw new Error('Test Sentry error - remove this');
}
```

Then check your Sentry dashboard - error should appear within seconds.

**Status for Day 3**: ✅ Error Tracking Live

---

### DAY 4 (Thursday) - Audit Logging Setup (4 hours)

#### 4.1 Create Database Migration
Create: `supabase/migrations/20260602000000_enhance_audit_logging.sql`

```sql
-- Add missing audit logging columns
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address inet;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS http_method text;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS status_code int;

-- Create indexes for fast audit queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_ip 
  ON activity_logs(ip_address, created_at DESC) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_action 
  ON activity_logs(action, tenant_id, created_at DESC);

-- Update activity_logs table to ensure proper constraints
ALTER TABLE activity_logs 
  ALTER COLUMN created_at SET DEFAULT now();
```

#### 4.2 Create Helper Function
Create: `lib/auditLog.ts`

```typescript
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface AuditLogEntry {
  tenantId: string;
  performedBy: string;
  action: string; // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
  entity: string; // 'product', 'sale', 'user', etc.
  entityId?: string;
  statusCode: number;
  request: NextRequest;
  details?: Record<string, any>;
}

export async function logAudit({
  tenantId,
  performedBy,
  action,
  entity,
  entityId,
  statusCode,
  request,
  details,
}: AuditLogEntry) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || '';

    await supabaseAdmin.from('activity_logs').insert({
      tenant_id: tenantId,
      performed_by: performedBy,
      action,
      entity,
      entity_id: entityId,
      ip_address: ip,
      user_agent: userAgent,
      http_method: request.method,
      status_code: statusCode,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    // Log audit failure but don't break the request
    console.error('Failed to log audit:', err);
  }
}

function getClientIp(request: NextRequest): string {
  // Check X-Forwarded-For first (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Fallback to direct connection IP
  return request.ip || '0.0.0.0';
}
```

#### 4.3 Add Audit Logging to Key Endpoints
Update your API routes to log actions:

```typescript
// app/api/products/route.ts (UPDATE POST handler)

import { logAudit } from '@/lib/auditLog';

export async function POST(req: NextRequest) {
  const tenantContext = await getServerTenantContext(req);
  if ('error' in tenantContext) {
    await logAudit({
      tenantId: 'unknown',
      performedBy: 'unknown',
      action: 'CREATE_PRODUCT_FAILED',
      entity: 'product',
      statusCode: tenantContext.status,
      request: req,
    });
    return jsonError(tenantContext.error, tenantContext.status);
  }

  try {
    // ... existing product creation code ...

    await logAudit({
      tenantId: tenantContext.tenantId,
      performedBy: tenantContext.userId,
      action: 'CREATE',
      entity: 'product',
      entityId: newProduct.id,
      statusCode: 201,
      request: req,
      details: { name: productData.name, price: productData.price },
    });

    return jsonSuccess({ product: newProduct }, 201);
  } catch (err) {
    await logAudit({
      tenantId: tenantContext.tenantId,
      performedBy: tenantContext.userId,
      action: 'CREATE_PRODUCT_ERROR',
      entity: 'product',
      statusCode: 500,
      request: req,
    });
    return jsonError('Failed to create product', 500);
  }
}
```

**Add to these endpoints** (priority order):
1. [ ] POST /api/products (create)
2. [ ] PATCH /api/products (update)
3. [ ] DELETE /api/products (delete)
4. [ ] POST /api/sales (create)
5. [ ] POST /api/auth/login
6. [ ] POST /api/auth/logout

#### 4.4 Run Database Migration
```bash
cd supabase
npx supabase db push
# Or manually run the SQL in Supabase dashboard
```

**Status for Day 4**: ✅ Audit Logging Active

---

### DAY 5 (Friday) - Testing & Validation (1.5 hours)

#### 5.1 Test All Security Features
```bash
# Start dev server
npm run dev

# In another terminal:

# 1. Test CSRF (should fail)
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test_token" \
  -d '{"name":"Test"}'
# Expected: 403 CSRF validation failed

# 2. Test CORS (should fail from wrong origin)
curl -X GET http://localhost:3000/api/products \
  -H "Origin: https://evil.com"
# Expected: No CORS headers in response

# 3. Visit app and create a product
# Check Sentry dashboard for no errors
# Check activity_logs table for IP and user agent logged
```

#### 5.2 Verify Database
```sql
-- Check that audit logging columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'activity_logs'
ORDER BY ordinal_position;

-- Should see: ip_address (inet), user_agent (text), http_method (text), status_code (int)

-- Check recent audit logs
SELECT id, tenant_id, action, entity, http_method, status_code, ip_address, created_at
FROM activity_logs
ORDER BY created_at DESC
LIMIT 10;
```

#### 5.3 Run TypeScript Check
```bash
npm run typecheck
# Should pass with exit code 0
```

**Status for Day 5**: ✅ All Security Features Tested & Working

---

## 📊 WEEK 1 SUMMARY

### Completed
- ✅ CSRF Protection (prevents cross-origin attacks)
- ✅ CORS Configuration (controls who can access your API)
- ✅ Error Tracking (know when things break in production)
- ✅ Audit Logging (see who did what when)

### Impact
- 🔴 Production Risk: **HIGH** → 🟡 **MEDIUM**
- Security Score: **3/10** → **7/10**

### Time Invested
- **~12 hours** implementation
- **2-3 hours** testing

### Deliverables
- ✅ 2 new files (csrf.ts, cors.ts)
- ✅ 1 migration file
- ✅ Updated API routes (all endpoints now validated)
- ✅ Sentry error tracking live

### Next Week
Week 2 will focus on:
- Legal pages (Terms, Privacy, Support)
- 2FA/MFA setup
- GDPR compliance

---

## 🚨 IMPORTANT REMINDERS

1. **Update all POST/PATCH/DELETE endpoints** - Don't miss any
2. **Test CSRF token generation** - Forms need to call `generateCSRFToken()`
3. **Save environment variables** - Add ALLOWED_ORIGINS and SENTRY_DSN
4. **Run database migration** - activity_logs needs new columns
5. **Don't break existing code** - All changes are additive

---

## ❓ TROUBLESHOOTING

**CSRF token not working?**
- Check that forms are calling `generateCSRFToken()`
- Verify token is in X-CSRF-Token header
- Check browser cookies for csrf-token cookie

**CORS not working?**
- Verify ALLOWED_ORIGINS env variable is set
- Remember to add https:// prefix
- Test with your actual domain, not localhost

**Errors not in Sentry?**
- Check NEXT_PUBLIC_SENTRY_DSN is set
- Verify DSN is correct
- Errors might take a few seconds to appear

**Audit logs not appearing?**
- Check migration ran successfully
- Verify API routes are calling logAudit()
- Check Supabase activity_logs table directly

---

## ✅ COMPLETION CHECKLIST

- [ ] CSRF protection implemented on all forms
- [ ] CSRF validation in all POST/PATCH/DELETE endpoints
- [ ] CORS headers configured in middleware
- [ ] ALLOWED_ORIGINS environment variable set
- [ ] Sentry account created and DSN added
- [ ] Error tracking tested
- [ ] Database migration run successfully
- [ ] Audit logging integrated in key endpoints
- [ ] All tests passing (`npm run typecheck`)
- [ ] Manual testing completed

**When all checked: WEEK 1 COMPLETE ✅**

---

Ready to start? Begin with Day 1 (CSRF Protection). Good luck! 🚀
