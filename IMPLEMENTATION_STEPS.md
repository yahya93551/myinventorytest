# Implementation Guide: Creating Frontend Repository

Step-by-step instructions to extract and create your frontend-only repository.

---

## 📋 Prerequisites

- Your current monorepo (with both frontend and backend)
- A new empty directory for the frontend repo
- Git (for version control)

---

## 🚀 Step 1: Create Frontend Directory Structure

```bash
# Create new directory
mkdir frontend
cd frontend

# Initialize git (start fresh without history)
git init
```

---

## 📁 Step 2: Copy Core Files

Copy these files from your current repo to `frontend/`:

```bash
# Copy package.json
cp ../inventory/package.json ./

# Copy TypeScript config
cp ../inventory/tsconfig.json ./

# Copy Next.js config
cp ../inventory/next.config.ts ./

# Copy ESLint config
cp ../inventory/eslint.config.mjs ./

# Copy PostCSS config
cp ../inventory/postcss.config.mjs ./

# Copy other config files
cp ../inventory/postcss.config.mjs ./
```

---

## 📂 Step 3: Copy Directories

```bash
# Copy UI components
cp -r ../inventory/components ./

# Copy custom hooks
cp -r ../inventory/hooks ./

# Copy TypeScript types
cp -r ../inventory/types ./

# Copy public assets
cp -r ../inventory/public ./

# Copy build scripts
cp -r ../inventory/scripts ./

# Copy globals.css
cp ../inventory/app/globals.css ./app/

# Copy layout and main pages (but NOT /api!)
cp ../inventory/app/layout.tsx ./app/
cp ../inventory/app/page.tsx ./app/
cp ../inventory/app/providers.tsx ./app/

# Copy all page directories
cp -r ../inventory/app/categories ./app/
cp -r ../inventory/app/inventory ./app/
cp -r ../inventory/app/sales ./app/
cp -r ../inventory/app/debts ./app/
cp -r ../inventory/app/reports ./app/
cp -r ../inventory/app/login ./app/
cp -r ../inventory/app/profile ./app/
cp -r ../inventory/app/settings ./app/
cp -r ../inventory/app/support ./app/
cp -r ../inventory/app/activity ./app/

# DO NOT copy /app/api - this is backend only!
# ❌ SKIP: cp -r ../inventory/app/api ./app/
```

---

## 📚 Step 4: Copy Frontend Libraries

```bash
# Create lib directory
mkdir -p lib

# Copy ONLY frontend-safe utilities
cp ../inventory/lib/api.ts ./lib/
cp ../inventory/lib/apiClient.ts ./lib/
cp ../inventory/lib/cache.ts ./lib/
cp ../inventory/lib/utils.ts ./lib/
cp ../inventory/lib/validation.ts ./lib/

# DO NOT copy these backend files:
# ❌ SKIP: cp ../inventory/lib/database.ts ./lib/
# ❌ SKIP: cp ../inventory/lib/auth.ts ./lib/
# ❌ SKIP: cp ../inventory/lib/middleware.ts ./lib/
# ❌ SKIP: cp ../inventory/lib/csrf.ts ./lib/
# ❌ SKIP: cp ../inventory/lib/audit.ts ./lib/
# ❌ SKIP: cp ../inventory/lib/gdpr.ts ./lib/
```

---

## 🔧 Step 5: Update API Configuration

Edit `lib/api.ts` to use environment variable:

```typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = {
  async get(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    return response.json();
  },

  async post(endpoint: string, data: any, options?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async put(endpoint: string, data: any, options?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async delete(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    return response.json();
  },
};
```

---

## 📝 Step 6: Create .env.example

Create `.env.example`:

```bash
cat > .env.example << 'EOF'
# ============================================
# Frontend Environment Variables
# ============================================
# Copy to .env.local and fill in your values

# Backend API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Frontend Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Error Tracking (Optional)
NEXT_PUBLIC_SENTRY_DSN=

# Do NOT add secrets, database credentials, or API keys!
EOF
```

---

## 📄 Step 7: Create .gitignore

Create `.gitignore`:

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Environment
.env
.env.local
.env.*.local

# Build
.next/
out/
dist/
build/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Testing
coverage/
.nyc_output/

# Misc
.turbo
EOF
```

---

## 📚 Step 8: Copy Documentation

```bash
# Copy documentation files
cp ../inventory/DEVELOPER_ONBOARDING.md ./
cp ../inventory/README.md ./
cp ../inventory/CONTRIBUTING.md ./

# Optional: Create setup instructions
cat > SETUP.md << 'EOF'
# Setup Instructions

## Prerequisites
- Node.js 18+
- npm or yarn

## Installation
1. Clone repository
2. Run: npm install
3. Copy .env.example to .env.local
4. Add NEXT_PUBLIC_API_URL to .env.local
5. Run: npm run dev

The app runs on http://localhost:3000
EOF
```

---

## ✅ Step 9: Verify Structure

Your `frontend/` directory should look like:

```
frontend/
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── DEVELOPER_ONBOARDING.md
├── README.md
├── SETUP.md
├── next.config.ts
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── providers.tsx
│   ├── categories/
│   ├── inventory/
│   ├── sales/
│   └── (other pages)
│   └── (NO /api folder!)
├── components/
├── hooks/
├── lib/
│   ├── api.ts
│   ├── apiClient.ts
│   ├── cache.ts
│   ├── utils.ts
│   └── validation.ts
├── public/
├── scripts/
└── types/
```

---

## 🧪 Step 10: Test the Build

```bash
# Install dependencies
npm install

# Check for TypeScript errors
npm run typecheck

# Run linter
npm run lint

# Build the project
npm run build

# If all pass ✅, you're ready!
```

---

## 🚀 Step 11: Initialize Git Repository

```bash
# Add all files
git add .

# Create initial commit
git commit -m "Initial frontend repository"

# Add remote (replace with your actual repo)
git remote add origin https://github.com/yourcompany/frontend.git

# Push to GitHub/GitLab
git push -u origin main
```

---

## 📋 Step 12: Update .env.local for Development

```bash
# Create local development environment file
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

---

## 🔍 Step 13: Verification Checklist

Before sharing with developers:

- [ ] ✅ `/app/api` directory does NOT exist
- [ ] ✅ No `.env.local` file in repo (only `.env.example`)
- [ ] ✅ All imports work without backend dependencies
- [ ] ✅ `npm run build` succeeds
- [ ] ✅ `npm run typecheck` succeeds
- [ ] ✅ `npm run lint` succeeds
- [ ] ✅ No database credentials in any file
- [ ] ✅ `.gitignore` includes `.env.local`
- [ ] ✅ `lib/api.ts` uses `NEXT_PUBLIC_API_URL`
- [ ] ✅ `DEVELOPER_ONBOARDING.md` is clear

---

## 🎯 Step 14: Share with Developers

1. Push to Git repository
2. Create private repo if needed
3. Add developers as collaborators
4. Send setup instructions
5. Provide backend API URL

---

## 📝 Backend Repository (Keep Private)

Your backend repository stays private with:

```
backend/
├── app/
│   └── api/
│       ├── auth/
│       ├── products/
│       ├── sales/
│       └── (all backend routes)
├── lib/
│   ├── database.ts
│   ├── auth.ts
│   ├── middleware.ts
│   └── (backend utilities)
├── .env.local (private!)
└── (rest of backend)
```

---

## ✅ Final Checklist

Frontend Repository:
- [ ] ✅ Has all UI components
- [ ] ✅ Has all pages (except /api)
- [ ] ✅ Has hooks and utilities
- [ ] ✅ Uses NEXT_PUBLIC_API_URL
- [ ] ✅ No secrets in files
- [ ] ✅ .env.example is safe to commit
- [ ] ✅ Builds successfully
- [ ] ✅ Documentation is clear

Backend Repository (Private):
- [ ] ✅ Has all /app/api routes
- [ ] ✅ Has database access
- [ ] ✅ Has secrets and credentials
- [ ] ✅ Has .env.local (not committed)
- [ ] ✅ CORS configured for frontend domain
- [ ] ✅ API authentication enabled

---

## 🎉 Success!

Your frontend and backend are now separated:
- ✅ Developers work on frontend safely
- ✅ Your backend is protected
- ✅ Secrets remain private
- ✅ Code is organized clearly

Frontend developers can now work without access to your backend infrastructure!

