# Quick Reference: Frontend/Backend Separation

## 📊 Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│              YOUR SAAS APPLICATION FLOW                   │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────┐
│   FRONTEND (Developer Repository)    │
│                                      │
│  • UI Components (/components)      │
│  • Pages (/app - NO /api!)          │
│  • Hooks (/hooks)                   │
│  • Utilities (/lib - frontend only) │
│                                      │
│  Environment: NEXT_PUBLIC_API_URL   │
│  Runs on: http://localhost:3000     │
└──────────────────┬──────────────────┘
                   │
                   │ API Calls
                   │ (HTTP/HTTPS)
                   ▼
┌─────────────────────────────────────┐
│    BACKEND (Your Private Server)     │
│                                      │
│  • API Routes (/app/api)            │
│  • Database Access                  │
│  • Business Logic                   │
│  • Secrets & Credentials            │
│                                      │
│  Environment: .env.local (private)  │
│  Runs on: Your Infrastructure       │
└─────────────────────────────────────┘
```

---

## 🎯 What Goes Where

| Item | Frontend Repo | Backend Server | Shared | 
|------|:---:|:---:|:---:|
| Components | ✅ | ❌ | ❌ |
| Pages | ✅ | ❌ | ❌ |
| `/app/api` Routes | ❌ | ✅ | ❌ |
| UI Hooks | ✅ | ❌ | ❌ |
| TypeScript Types | ✅ | ✅ | ✅ |
| Database Credentials | ❌ | ✅ | ❌ |
| API Keys | ❌ | ✅ | ❌ |
| JWT Secrets | ❌ | ✅ | ❌ |
| Frontend Utils | ✅ | ❌ | ❌ |
| Backend Utils | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_API_URL` | ✅ | ❌ | ❌ |
| `.env.local` | ❌ | ✅ | ❌ |

---

## 🔐 Environment Variables

### Frontend (Safe to Commit)
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=...
```

### Backend (Private)
```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
JWT_SECRET=...
STRIPE_SECRET_KEY=...
(and all other secrets)
```

---

## 📁 Directory Structure

### ✅ Frontend (Developers Get This)
```
frontend/
├── app/
│   ├── categories/
│   ├── inventory/
│   ├── sales/
│   ├── debts/
│   ├── reports/
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── hooks/
├── lib/ (frontend utils only)
├── public/
├── .env.example
└── package.json
```

### ❌ Excluded from Frontend
```
frontend/
└── app/
    └── api/              ← NOT INCLUDED!
        ├── auth/
        ├── products/
        ├── sales/
        └── ...
```

### ✅ Backend (You Keep This)
```
backend/
├── app/
│   └── api/              ← ALL ROUTES HERE
│       ├── auth/
│       ├── products/
│       ├── sales/
│       └── ...
├── lib/
│   ├── database.ts       ← Backend only
│   ├── auth.ts           ← Backend only
│   └── middleware.ts     ← Backend only
└── .env.local            ← Private!
```

---

## 🚀 Quick Start Commands

### For Developers (Frontend)
```bash
# Clone
git clone https://github.com/yourcompany/frontend.git
cd frontend

# Setup
npm install
cp .env.example .env.local

# Development
npm run dev
# Runs on http://localhost:3000

# Build
npm run build
npm start
```

### For You (Backend)
```bash
# Your private repo
npm install
npm run dev
# Runs on your infrastructure
```

---

## 🔌 How API Calls Work

### Frontend Code (Developers Write This)
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL;

const response = await fetch(
  `${API_URL}/api/products`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
```

### Backend Code (You Keep This Private)
```typescript
// app/api/products/route.ts
export async function GET(req: Request) {
  // You write this
  // Database queries
  // Business logic
  // Return response
}
```

---

## ✅ Security Checklist

Before Sharing Frontend with Developers:

**Repository Setup**
- [ ] `/app/api` folder removed
- [ ] `.env.local` not in repo
- [ ] `.gitignore` includes `.env.local`

**Environment Variables**
- [ ] `.env.example` has NO secrets
- [ ] All API URLs use `NEXT_PUBLIC_API_URL`
- [ ] No database credentials anywhere

**Dependencies**
- [ ] npm install succeeds
- [ ] npm run build succeeds
- [ ] npm run lint succeeds
- [ ] npm run typecheck succeeds

**Documentation**
- [ ] `DEVELOPER_ONBOARDING.md` provided
- [ ] API documentation provided
- [ ] Backend URL provided separately

**Backend Security**
- [ ] CORS configured for frontend URL
- [ ] Authentication/JWT enabled
- [ ] Rate limiting configured
- [ ] `.env.local` NOT committed to git

---

## 🎯 Development Workflow

```
Developer Day 1:
├── Clone frontend repo
├── npm install
├── cp .env.example .env.local
├── Add NEXT_PUBLIC_API_URL (you provide)
└── npm run dev ✅

Developer's Work:
├── Modify components/
├── Create new pages/
├── Call API endpoints
├── Push to git
└── ✅ Frontend is safe, backend is safe!

Your Work:
├── Manage backend at your server
├── Update API endpoints
├── Manage database
├── Handle payments
└── ✅ Keep everything private!
```

---

## 🔗 Communication Between Frontend & Backend

### Call Flow
```
Frontend makes request:
fetch('https://api.yourdomain.com/api/products')
        ↓
Browser sends HTTP request
        ↓
Your backend receives request
        ↓
Backend queries database
        ↓
Backend returns JSON response
        ↓
Frontend displays data
```

### Authentication Flow
```
Developer logs in:
1. Frontend sends login credentials to backend
2. Backend validates and returns JWT token
3. Frontend stores token in localStorage
4. Frontend includes token in API calls
5. Backend validates token on each request
6. Access granted/denied based on validation
```

---

## 📊 Repository Access Matrix

| Who | Can See | Cannot See |
|-----|---------|-----------|
| **Frontend Developers** | UI Code, Components, Pages | Backend code, /app/api, Secrets |
| **Backend Developers** | Full codebase (if on backend team) | Only if in separate backend repo |
| **You** | Everything (your infrastructure) | Developers don't interfere |
| **Public** | Nothing (repository is private) | Everything stays safe |

---

## 🚨 What Happens If They Get Backend Code

**If developers accidentally receive `/app/api/`:**
- ❌ They see database connection strings
- ❌ They see Stripe secret keys
- ❌ They see JWT signing secrets
- ❌ They see admin functions
- ❌ They could modify critical systems
- ❌ Your SaaS is compromised!

**Prevention:**
- ✅ Don't include `/app/api` in frontend repo
- ✅ Don't share `.env.local`
- ✅ Use separate repositories
- ✅ Follow this guide exactly

---

## 📞 Common Questions

**Q: Can frontend developers access the backend?**
- A: No, they don't have the code. Only API endpoints.

**Q: How do they test their code?**
- A: They run `npm run dev` and call the backend API.

**Q: What if they find a bug in the backend?**
- A: They report it. You fix it. Backend stays with you.

**Q: How do they deploy frontend?**
- A: You handle deployment. Or use Vercel/Netlify directly.

**Q: Can they see database?**
- A: No, only through API endpoints you created.

**Q: How do they know what API endpoints exist?**
- A: You provide API documentation.

---

## 🎉 Result

✅ Frontend and backend are completely separated
✅ Developers can only modify frontend code
✅ Your backend remains secure
✅ Your secrets remain private
✅ Developers have limited access/responsibility
✅ Your SaaS infrastructure is protected

---

## 📚 Documentation Files Created

1. `FRONTEND_BACKEND_SEPARATION.md` - Complete strategy
2. `FRONTEND_SEPARATION_CHECKLIST.md` - Migration checklist
3. `IMPLEMENTATION_STEPS.md` - Step-by-step guide
4. `DEVELOPER_ONBOARDING.md` - Developer setup guide
5. `BACKEND_ROUTES_PRIVATE.md` - Backend routes explanation
6. `env.example.frontend` - Frontend .env template

---

## 🚀 Next Steps

1. ✅ Read all documentation
2. ✅ Create frontend repository using `IMPLEMENTATION_STEPS.md`
3. ✅ Test the build locally
4. ✅ Push to Git repository
5. ✅ Share frontend repo with developers
6. ✅ Share `DEVELOPER_ONBOARDING.md` with team
7. ✅ Provide API documentation
8. ✅ Keep backend private on your infrastructure

**You're all set! Your SaaS is now secure from developer interference.** 🛡️

