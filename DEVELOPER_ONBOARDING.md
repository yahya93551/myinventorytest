# Developer Onboarding Guide - Frontend Only

Welcome to the team! Here's how to set up the **frontend** development environment.

## ⚠️ Important
This is a **frontend-only** repository. The backend is hosted separately and managed by the core team. Your job is to build amazing UI and frontend features.

---

## 🚀 Quick Start (5 minutes)

### 1. Clone & Install
```bash
git clone https://github.com/yourcompany/frontend.git
cd frontend
npm install
```

### 2. Environment Setup
```bash
# Copy the example file
cp .env.example .env.local

# Your team lead will provide you the backend API URL
# It will look like: https://api.yourdomain.com
# or https://api-dev.yourdomain.com for development

# Edit .env.local and add:
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 3. Start Development
```bash
npm run dev
```

The app will run on `http://localhost:3000`

---

## 📋 What You Can/Cannot Do

### ✅ What You CAN Work On
- Creating new components (`/components`)
- Building new pages (`/app`)
- Adding frontend hooks (`/hooks`)
- Frontend styling and design
- Form validation and UI logic
- Client-side state management
- Testing frontend code
- API integration (calling the backend API)

### ❌ What You CANNOT Access
- Backend API code (`/app/api` - doesn't exist in this repo)
- Database credentials
- Private configuration
- Server-side secrets
- Anything related to backend infrastructure

---

## 🔌 How to Use the Backend API

All API calls go through `NEXT_PUBLIC_API_URL`. Here's an example:

### Example 1: Fetch Products
```typescript
// pages/inventory.tsx
import { useEffect, useState } from 'react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/products`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              // Add authorization token if needed
              'Authorization': `Bearer ${getToken()}`
            }
          }
        );
        
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {products.map(product => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

### Example 2: Create Product
```typescript
async function createProduct(productData) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/products`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(productData)
    }
  );
  
  return response.json();
}
```

### Example 3: Using a Helper Function
```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function apiCall(
  endpoint: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// Usage:
const products = await apiCall('/api/products');
const newProduct = await apiCall('/api/products', {
  method: 'POST',
  body: JSON.stringify({ name: 'New Product' })
});
```

---

## 🔐 Authentication

You'll receive an authentication token. Add it to API requests:

```typescript
// Get token from localStorage (or wherever it's stored)
const token = localStorage.getItem('auth_token');

const response = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/api/products`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);
```

---

## 🧪 Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Type checking
npm run typecheck

# Run tests (if configured)
npm test
```

---

## 📚 Backend API Documentation

Ask your team lead for the **API Documentation** which should include:
- [ ] Available endpoints
- [ ] Request/Response formats
- [ ] Authentication requirements
- [ ] Error codes
- [ ] Rate limiting
- [ ] Example cURL commands

---

## ❓ FAQ

### Q: Where is the backend code?
**A:** The backend is deployed on our servers. You only have the frontend code.

### Q: How do I connect to the database?
**A:** You don't! All database access goes through the API endpoints. Call the API from your frontend code.

### Q: What if I find a backend issue?
**A:** Report it to the core team. They manage the backend.

### Q: Can I modify API endpoints?
**A:** No, the API endpoints are already defined. You can only call them from the frontend.

### Q: How do I test API calls locally?
**A:** Set `NEXT_PUBLIC_API_URL` in `.env.local` to point to the development backend URL provided by your team.

### Q: What if the API URL changes?
**A:** Update it in `.env.local`. Different environments (dev, staging, production) have different URLs.

### Q: How do I handle errors from the API?
**A:** Wrap API calls in try-catch and check the response status:
```typescript
try {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/...`);
  if (!response.ok) {
    // Handle error
    console.error('API Error:', response.status);
  }
  const data = await response.json();
} catch (error) {
  // Handle network error
  console.error('Network Error:', error);
}
```

---

## 🤝 Getting Help

- **Frontend Questions:** Ask in #frontend channel
- **API Questions:** Ask in #backend channel
- **Deployment:** Ask your team lead
- **Environment Setup:** Ask your team lead

---

## 📝 Before Your First Commit

1. [ ] Run `npm run lint` - check for style issues
2. [ ] Run `npm run typecheck` - check for TypeScript errors
3. [ ] Run `npm run build` - verify the build succeeds
4. [ ] Test your changes on `http://localhost:3000`
5. [ ] Push to your feature branch

---

## 🎯 Remember

- ✅ You're building the frontend UI
- ✅ Call the API for data
- ✅ Follow the component structure
- ✅ Keep components reusable
- ❌ Don't try to access backend code
- ❌ Don't commit `.env.local`
- ❌ Don't hardcode API URLs

---

## Next Steps

1. Ask your team lead for the backend API URL
2. Add it to `.env.local`
3. Run `npm run dev`
4. Start building! 🚀

