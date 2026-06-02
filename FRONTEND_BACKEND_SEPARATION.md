# Frontend & Backend Separation Guide

## Overview
This document explains how to securely separate your frontend (for developers) and backend (private).

---

## 🎯 What Developers Get: Frontend Repository

Developers will receive a **frontend-only repository** with:
- ✅ All UI components (`/components`)
- ✅ All pages (`/app`) - **EXCEPT** `/app/api`
- ✅ Frontend hooks (`/hooks`)
- ✅ Frontend utilities (`/lib`)
- ✅ Public assets (`/public`)

**What they DON'T get:**
- ❌ `/app/api` (all backend code)
- ❌ Backend environment variables
- ❌ Database credentials
- ❌ Private keys/secrets
- ❌ `.env.local` (private file)

---

## 🔐 What You Keep Private: Backend

Your backend stays on your own infrastructure:
- Private Next.js API routes (currently in `/app/api`)
- Database connections
- All sensitive credentials
- Security middleware
- Authentication verification

---

## 🚀 How It Works

### 1. Frontend Connects via Environment Variables

The frontend uses `NEXT_PUBLIC_API_URL` to connect to your backend:

**File: `.env.local` (FRONTEND - Shared with developers)**
```bash
NEXT_PUBLIC_API_URL=https://api.yourbackend.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
```

**File: `.env.local` (BACKEND - Private, only on your server)**
```bash
# Backend-only secrets (NOT shared)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
DATABASE_URL=...
```

### 2. API Calls From Frontend

All API calls use the environment variable:

```typescript
// Example: lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchInventory() {
  const response = await fetch(`${API_URL}/api/products`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}
```

### 3. CORS Setup

Your backend needs to allow requests from the frontend domain:

```typescript
// Backend: app/api/middleware.ts
const ALLOWED_ORIGINS = [
  'https://app.yourdomain.com',
  'http://localhost:3000', // for local development
];

export function cors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get('origin');
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  return res;
}
```

---

## 📁 File Structure After Separation

### FRONTEND Repository (Share with developers)
```
frontend/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── categories/
│   ├── inventory/
│   ├── sales/
│   ├── debts/
│   ├── reports/
│   ├── login/
│   ├── profile/
│   ├── settings/
│   └── (NO /api folder!)
├── components/
├── hooks/
├── lib/
│   ├── api.ts (uses NEXT_PUBLIC_API_URL)
│   ├── apiClient.ts
│   └── (frontend utilities only)
├── public/
├── .env.example (public example)
├── next.config.ts
├── package.json
└── README.md
```

### BACKEND Repository (Private, on your server)
```
backend/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── products/
│   │   ├── sales/
│   │   ├── debts/
│   │   ├── custom-fields/
│   │   └── (all backend routes)
│   └── (backend logic)
├── lib/
│   ├── (backend utilities)
│   ├── auth.ts
│   ├── database.ts
│   └── validation.ts
├── .env.local (private!)
├── .env.example (public example without secrets)
└── README.md
```

---

## 🛠️ Step-by-Step Separation Process

### Step 1: Create Frontend Repository

1. Create new folder: `frontend/`
2. Copy from your current repo:
   ```
   - /app (without /api)
   - /components
   - /hooks
   - /lib (keep only frontend utilities)
   - /public
   - /types
   - /scripts
   - package.json
   - tsconfig.json
   - next.config.ts
   - eslint.config.mjs
   ```

### Step 2: Update API Calls

In **lib/api.ts**, all calls should use the environment variable:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = {
  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: await getHeaders(),
    });
    return response.json();
  },

  async post(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return response.json();
  },
  // ... other methods
};
```

### Step 3: Create .env.example (Frontend)

```bash
# Frontend Environment Variables
# Copy this to .env.local and fill in your values

NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=https://...
```

### Step 4: Keep Backend Private

- Don't commit `.env.local` to git
- Use `.env.example` in git (without secrets)
- Your backend runs on your infrastructure
- Share `.env` setup with your team separately

---

## 🔑 Environment Variables Reference

### Frontend (NEXT_PUBLIC_* are visible in browser)
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_SENTRY_DSN=...
```

### Backend (Private, never exposed to frontend)
```bash
# Database
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...

# Authentication
JWT_SECRET=...
ENCRYPTION_KEY=...

# API Keys
STRIPE_SECRET_KEY=...
SENDGRID_API_KEY=...
```

---

## 🚦 Development Workflow

### Frontend Developers
```bash
# Clone frontend repo
git clone https://github.com/yourcompany/frontend.git
cd frontend

# Setup
npm install
cp .env.example .env.local

# Edit .env.local with backend API URL
# (you provide this to them)

# Run
npm run dev
# Frontend runs on http://localhost:3000
```

### Backend (You Only)
```bash
# Your private backend
npm run dev
# Backend API runs on https://api.yourdomain.com (or your server)
```

---

## 🔒 Security Checklist

- [ ] Remove `/app/api` from frontend repository
- [ ] Remove database credentials from `.env.example`
- [ ] Add `.env.local` to `.gitignore`
- [ ] Set CORS headers on backend
- [ ] Use `NEXT_PUBLIC_*` prefix only for safe frontend variables
- [ ] Validate all API requests on backend
- [ ] Use JWT/Auth tokens for API authentication
- [ ] Keep backend on separate domain (not same domain as frontend)

---

## 📝 Sample Setup Instructions for Developers

Create a `SETUP.md` for your frontend repository:

```markdown
# Frontend Development Setup

## Prerequisites
- Node.js 18+
- npm or yarn

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy environment file: `cp .env.example .env.local`
4. Update `NEXT_PUBLIC_API_URL` in `.env.local` to your backend API URL
5. Start development: `npm run dev`

The app will run on `http://localhost:3000`

## Important Notes
- Do NOT modify files in the backend API (`/app/api`)
- All API communication goes through `NEXT_PUBLIC_API_URL`
- Contact your backend team for API documentation
```

---

## 🔗 API Communication Flow

```
┌─────────────────┐
│  Frontend App   │
│  (Developer)    │
└────────┬────────┘
         │
         │ Uses NEXT_PUBLIC_API_URL
         │ (https://api.yourdomain.com)
         │
         ▼
┌─────────────────┐
│  Backend API    │
│  (Your Server)  │
│  - Authentication
│  - Database
│  - Business Logic
└─────────────────┘
```

---

## ✅ Next Steps

1. Create a `frontend/` directory with frontend code only
2. Update all API calls to use `process.env.NEXT_PUBLIC_API_URL`
3. Create `.env.example` without secrets
4. Deploy backend to your infrastructure
5. Give developers the frontend repo with setup instructions
6. Share the `NEXT_PUBLIC_API_URL` with developers

---

## Questions?

- **Can developers see the backend code?** No, it's not in their repository
- **Can they modify the backend?** No, it's on your infrastructure
- **Can they access the database?** No, only through your API
- **Is their development secure?** Yes, they only work with frontend code
- **How do they test with the backend?** You provide the API URL in `.env.local`

