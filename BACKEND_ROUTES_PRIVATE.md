# Backend API Routes (What Developers DON'T See)

This document shows what's in the backend `/app/api` folder that developers will NOT have in their frontend-only repository.

---

## 🔒 Private Backend Routes

All routes in `/app/api/` are private and run only on your backend server.

### Authentication & Account Routes
```
/api/auth/login              - User login
/api/auth/logout             - User logout
/api/auth/register           - User registration
/api/auth/refresh-token      - Refresh JWT token
/api/auth/verify-email       - Email verification
/api/auth/forgot-password    - Password reset request
/api/auth/reset-password     - Password reset execution
/api/account/verify-mfa      - Multi-factor authentication
```

### Product & Inventory Routes (Backend)
```
/api/products/bulk-upload    - Server-side bulk import
/api/products/export         - Export data from database
/api/categories/sync         - Sync categories with DB
```

### Subscription & Billing Routes
```
/api/subscriptions/create    - Create subscription (Stripe)
/api/subscriptions/cancel    - Cancel subscription
/api/subscriptions/webhook   - Stripe webhooks
/api/subscriptions/upgrade   - Handle upgrades
```

### Admin & Internal Routes
```
/api/admin/users             - Manage users (admin only)
/api/admin/subscriptions     - View subscriptions (admin)
/api/admin/analytics         - Server-side analytics
/api/admin/audit-log         - Audit logging
```

### Tenant & Multi-tenancy Routes
```
/api/tenant/context          - Get tenant context
/api/tenant/switch           - Switch between tenants
/api/tenant/invite           - Invite team members
```

### Data Processing & Webhooks
```
/api/webhooks/stripe         - Stripe payment webhooks
/api/webhooks/email          - Email service webhooks
/api/cron/cleanup            - Scheduled cleanup tasks
/api/cron/billing            - Automated billing
```

### Sensitive Data Routes
```
/api/settings/business       - Business settings (with DB access)
/api/settings/encryption     - Encryption key management
/api/settings/integrations   - Third-party API keys
```

### Custom Fields Management (Backend)
```
/api/custom-fields/validate  - Server-side validation
/api/custom-fields/migrate   - Data migration
```

### Search & Analytics (Backend)
```
/api/search/index            - Search indexing
/api/analytics/compute       - Server-side calculations
/api/reports/generate        - Generate PDF reports (server)
```

---

## 🔐 Why These Routes Are Private

### Security Reasons
- ✅ Contains authentication logic
- ✅ Handles JWT tokens
- ✅ Manages payment processing
- ✅ Controls database access
- ✅ Handles data encryption/decryption

### Business Logic Reasons
- ✅ Complex calculations
- ✅ Multi-step workflows
- ✅ Third-party API integrations
- ✅ Subscription management
- ✅ Billing operations

### Infrastructure Reasons
- ✅ Scheduled tasks (cron jobs)
- ✅ Webhooks from external services
- ✅ Database migrations
- ✅ Server-side caching
- ✅ Background job processing

---

## ✅ What Developers CAN See (Frontend)

Developers get:
- All components in `/components`
- All pages in `/app` (except no `/api` routes!)
- All UI hooks in `/hooks`
- Frontend utilities in `/lib`
- TypeScript types in `/types`
- Public assets in `/public`

---

## 🔗 How Frontend Communicates With Backend

Instead of having backend code, developers call **API endpoints**:

```typescript
// Frontend (developers have this)
async function getProducts() {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/products`
  );
  return response.json();
}

// Backend (you keep this private)
// app/api/products/route.ts
export async function GET(req: Request) {
  // Only you see this code
  const products = await db.query('SELECT * FROM products');
  return Response.json(products);
}
```

---

## 📊 Frontend vs Backend Separation

| Aspect | Frontend (Developers) | Backend (You) |
|--------|----------------------|--------------|
| **Location** | Separate repository | Your infrastructure |
| **Code Access** | Can see & modify | Only you |
| **Database Access** | NO - only through API | YES |
| **Environment Variables** | NEXT_PUBLIC_* only | All variables |
| **Secrets** | NONE | All API keys, creds |
| **Authentication** | Calls API with token | Validates token |
| **External APIs** | Calls through backend | Direct access |
| **Payments** | Shows UI, calls API | Processes actual payments |

---

## 🎯 Communication Flow Example

### Developers Create Product (Frontend)
```typescript
// frontend/pages/products.tsx
await fetch(`${NEXT_PUBLIC_API_URL}/api/products`, {
  method: 'POST',
  body: JSON.stringify({ name: 'New Product' }),
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Your Backend Processes It (Private)
```typescript
// backend/app/api/products/route.ts
export async function POST(req: Request) {
  // Validate request
  // Check user permissions
  // Insert into database
  // Log audit trail
  // Return response
}
```

---

## 🛡️ Security Benefits

1. **Code Isolation** - Developers can't see your business logic
2. **Secret Protection** - All credentials stay on your server
3. **Access Control** - Only you can modify critical systems
4. **Audit Trail** - You control all database access
5. **Data Protection** - Encryption/decryption on server only

---

## ⚠️ What Happens If Developers Get Backend Code

If they accidentally received the `/app/api` folder, they would see:
- ❌ Database credentials
- ❌ API keys (Stripe, SendGrid, etc.)
- ❌ JWT secrets
- ❌ Encryption keys
- ❌ Authentication logic
- ❌ Payment processing code
- ❌ Admin functions
- ❌ Business logic

**This would compromise your entire SaaS!**

---

## ✅ Verification Checklist

Before giving frontend repo to developers:

- [ ] `/app/api` folder does NOT exist in frontend repo
- [ ] No backend route files in frontend
- [ ] No `.env.local` with secrets included
- [ ] No database credentials anywhere
- [ ] All API calls use `NEXT_PUBLIC_API_URL` variable
- [ ] `.env.example` has NO secret values
- [ ] Developer onboarding guide created
- [ ] API documentation provided separately
- [ ] CORS configured on backend
- [ ] Rate limiting configured on backend

---

## 📝 API Endpoint Documentation

Create a separate document (for your team) listing all API endpoints:

```markdown
# API Endpoints - Backend Only

## Products

### GET /api/products
Returns list of products
Auth: Required (Bearer token)
Response: [{ id, name, price, ... }]

### POST /api/products
Create new product
Auth: Required
Body: { name, price, ... }
Response: { id, name, price, ... }

### PATCH /api/products/:id
Update product
Auth: Required
Body: { name?, price?, ... }
Response: { id, name, price, ... }

### DELETE /api/products/:id
Delete product
Auth: Required
Response: { success: true }
```

---

## 🔑 Summary

The separation is simple:
- **Frontend**: UI code, components, pages, API calls
- **Backend**: API endpoints, database, business logic, secrets

Developers get the frontend. You keep the backend. Your backend stays safe.

