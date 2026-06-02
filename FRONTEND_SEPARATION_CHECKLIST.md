# Files to Include/Exclude When Creating Frontend Repository

## ✅ FILES TO INCLUDE (Share with developers)

### Root Level
- [ ] `package.json`
- [ ] `next.config.ts`
- [ ] `tsconfig.json`
- [ ] `eslint.config.mjs`
- [ ] `postcss.config.mjs`
- [ ] `.env.example` (no secrets!)
- [ ] `.gitignore`
- [ ] `README.md`
- [ ] `CONTRIBUTING.md`
- [ ] `SETUP.md` (new frontend setup instructions)

### Directories to Include Completely
- [ ] `/app` **EXCEPT** `/app/api` (exclude API routes!)
- [ ] `/components` (all UI components)
- [ ] `/hooks` (all frontend hooks)
- [ ] `/public` (images, assets)
- [ ] `/scripts` (frontend build scripts)
- [ ] `/types` (TypeScript types)
- [ ] `/styles` (if exists)

### From /lib (Frontend Utilities Only)
- [ ] `lib/api.ts` - API client (update to use env variable)
- [ ] `lib/apiClient.ts` - API client wrapper
- [ ] `lib/cache.ts` - Frontend caching
- [ ] `lib/utils.ts` - Utility functions
- [ ] `lib/validation.ts` - Form validation
- [ ] `lib/hooks.ts` - Custom hooks

---

## ❌ FILES TO EXCLUDE (Keep Private)

### Root Level Files
- [ ] `.env.local` (contains secrets)
- [ ] `.env.development.local`
- [ ] `.env.production.local`
- [ ] Private documentation
- [ ] CLAUDE.md
- [ ] AGENTS.md

### Entire Directories
- [ ] `/app/api` - **All backend API routes** - VERY IMPORTANT!
- [ ] `/docs` (internal documentation)
- [ ] `/PATCHES` (internal patches)
- [ ] `/supabase` (database migrations)
- [ ] `.git` (create fresh repo)

### Backend Utilities in /lib (if any)
- [ ] `lib/database.ts` - Database connection
- [ ] `lib/auth.ts` - Backend authentication logic
- [ ] `lib/middleware.ts` - Backend middleware
- [ ] `lib/csrf.ts` - CSRF tokens (keep on backend only)
- [ ] `lib/audit.ts` - Audit logging
- [ ] `lib/gdpr.ts` - Data handling
- [ ] `lib/mfa.ts` - MFA logic (backend verification)

---

## 🔄 File-by-File Migration Checklist

For each file you're considering including, ask:
- [ ] Does it contain API endpoint definitions? → EXCLUDE
- [ ] Does it contain database queries? → EXCLUDE
- [ ] Does it contain secrets or credentials? → EXCLUDE
- [ ] Does it reference `process.env` without `NEXT_PUBLIC_`? → EXCLUDE
- [ ] Is it a frontend component/hook/utility? → INCLUDE
- [ ] Is it used by multiple frontend pages? → INCLUDE

---

## 📋 .env.example (Frontend Version)

**Location:** `.env.example` (in frontend repo)

```bash
# ============================================
# Frontend Environment Variables
# ============================================
# Copy this file to .env.local and fill in the values

# Backend API Configuration
# The URL of your backend API server
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Frontend Application URL
# Used for redirects and callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Monitoring and Error Tracking
# Optional: Sentry DSN for error tracking
NEXT_PUBLIC_SENTRY_DSN=

# Feature Flags (if using)
NEXT_PUBLIC_FEATURES_ENABLED=

# DO NOT add any of these to frontend:
# - Database credentials
# - API secret keys
# - JWT secrets
# - Private API keys (Stripe, SendGrid, etc.)
# - Supabase service role keys
# - Encryption keys
```

---

## 📋 .env.example (Backend Version - KEEP PRIVATE)

**Location:** `.env.example` (in backend repo)

```bash
# ============================================
# Backend Environment Variables - PRIVATE!
# ============================================
# These should NEVER be shared with frontend developers
# These should NEVER be committed to a public repository

# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ENCRYPTION_KEY=your-encryption-key-min-32-chars

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Service
SENDGRID_API_KEY=SG.xxx...

# External APIs
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Session & Security
SESSION_SECRET=random-secret-key
CSRF_TOKEN_SECRET=random-secret-key
```

---

## 🎯 Step-by-Step Migration Process

### Phase 1: Preparation
1. [ ] Read this document completely
2. [ ] Create new directory: `frontend/`
3. [ ] Initialize new git repository in `frontend/`
4. [ ] Copy `package.json` and update if needed

### Phase 2: Core Files
1. [ ] Copy `/app` (excluding `/app/api`)
2. [ ] Copy `/components`
3. [ ] Copy `/hooks`
4. [ ] Copy `/types`
5. [ ] Copy `/public`
6. [ ] Copy config files (`next.config.ts`, `tsconfig.json`, etc.)

### Phase 3: Library Files
1. [ ] Copy frontend-safe files from `/lib`
2. [ ] **Review each file** to ensure no backend code
3. [ ] Update API calls to use `NEXT_PUBLIC_API_URL`

### Phase 4: Cleanup
1. [ ] Delete `/app/api` from frontend
2. [ ] Delete backend utilities from `/lib`
3. [ ] Create `.env.example` with only frontend variables
4. [ ] Ensure `.env.local` is in `.gitignore`
5. [ ] Create `SETUP.md` for developers

### Phase 5: Testing
1. [ ] [ ] `npm install` - check for missing dependencies
2. [ ] [ ] `npm run build` - verify build succeeds
3. [ ] [ ] `npm run lint` - check for errors
4. [ ] [ ] `npm run typecheck` - verify TypeScript

---

## 🚀 Running the Separated Repositories

### Frontend (for developers)
```bash
git clone https://github.com/yourcompany/frontend.git
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with API URL
npm run dev
# Runs on http://localhost:3000
```

### Backend (your private server)
```bash
# Your private repo/server
npm install
# Use private .env.local with all secrets
npm run dev
# Runs on your infrastructure
```

---

## ✅ Final Security Checklist

Before giving frontend repo to developers:
- [ ] No `/app/api` folder exists
- [ ] No `.env.local` file included
- [ ] No database credentials anywhere
- [ ] All API calls use `NEXT_PUBLIC_API_URL`
- [ ] `.env.example` has NO secret values
- [ ] `.gitignore` includes `.env.local`
- [ ] No private documentation included
- [ ] No backend-specific utilities exposed
- [ ] CORS is configured on backend
- [ ] API authentication uses tokens/JWT

