# 🚀 Quick Start: Adding Legal Pages & Support

Your new pages are ready! Here's where to add them to your navigation.

---

## ✅ NEW PAGES CREATED

| Page | URL | Purpose |
|------|-----|---------|
| Terms of Service | `/legal/terms` | Legal terms for using the app |
| Privacy Policy | `/legal/privacy` | Data privacy and GDPR compliance |
| Support Center | `/support` | Help center with FAQ and contact info |

---

## 📍 WHERE TO ADD LINKS

### 1. **User Settings Menu** (Best Place)
In `/app/settings/page.tsx`, add links at the bottom of the settings page:

```typescript
<div className="mt-8 pt-8 border-t border-theme-input space-y-2">
  <a 
    href="/support" 
    className="block text-cyan-600 hover:text-cyan-700 text-sm"
  >
    📞 Support Center
  </a>
  <a 
    href="/legal/terms" 
    className="block text-cyan-600 hover:text-cyan-700 text-sm"
  >
    📋 Terms of Service
  </a>
  <a 
    href="/legal/privacy" 
    className="block text-cyan-600 hover:text-cyan-700 text-sm"
  >
    🔒 Privacy Policy
  </a>
</div>
```

### 2. **Footer** (If you add one)
Create a new footer component:

```typescript
// components/Footer.tsx
export function Footer() {
  return (
    <footer className="mt-12 border-t border-theme-input py-8 px-4 text-center text-sm text-theme-secondary">
      <div className="flex justify-center gap-6 mb-4">
        <a href="/support" className="hover:text-theme-primary">Support</a>
        <a href="/legal/terms" className="hover:text-theme-primary">Terms</a>
        <a href="/legal/privacy" className="hover:text-theme-primary">Privacy</a>
      </div>
      <p>© 2026 My Inventory. All rights reserved.</p>
    </footer>
  );
}
```

### 3. **Sidebar Navigation** (If applicable)
Add to your sidebar/navigation menu:

```typescript
// In Sidebar or Navigation component
{
  icon: '❓',
  label: 'Support',
  href: '/support',
  hidden: false // Only show for authenticated users if needed
},
{
  icon: '⚙️',
  label: 'Legal',
  children: [
    { label: 'Terms', href: '/legal/terms' },
    { label: 'Privacy', href: '/legal/privacy' },
  ]
}
```

### 4. **Login Page** (Optional)
Add links to terms/privacy on login page:

```typescript
<div className="text-center text-xs text-gray-500 mt-4">
  By signing in, you agree to our{' '}
  <a href="/legal/terms" className="hover:underline">Terms of Service</a>
  {' '}and{' '}
  <a href="/legal/privacy" className="hover:underline">Privacy Policy</a>
</div>
```

---

## 🔧 CUSTOMIZATION NEEDED

### 1. Update Contact Information
All pages currently show:
- **Email**: support@yourdomain.com
- **WhatsApp**: +252686859656
- **Hours**: 9 AM - 5 PM GMT+3

**To customize**, search and replace in these files:
- `/app/legal/terms/page.tsx`
- `/app/legal/privacy/page.tsx`
- `/app/support/page.tsx`

### 2. Update Company Name
Replace "My Inventory" with your actual business name in:
- Metadata titles (already in page.tsx files)
- Footer copyright text
- Legal document references

### 3. Add to Environment Variables (Optional)
```env
# .env.local
NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
NEXT_PUBLIC_SUPPORT_PHONE=+252686859656
NEXT_PUBLIC_SUPPORT_WHATSAPP=+252686859656
```

Then reference in components:
```typescript
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
```

---

## 🧪 TESTING THE PAGES

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Visit each page**:
   - http://localhost:3000/legal/terms
   - http://localhost:3000/legal/privacy
   - http://localhost:3000/support

3. **Verify**:
   - ✅ Pages load without errors
   - ✅ Links work correctly
   - ✅ Contact info is correct
   - ✅ FAQ items are expandable
   - ✅ WhatsApp link opens correctly

---

## ✅ COMPLIANCE CHECKLIST

After adding these pages:

- [ ] Terms of Service accessible from app
- [ ] Privacy Policy accessible from app
- [ ] Support contact info clearly visible
- [ ] GDPR rights explained (in Privacy Policy)
- [ ] Data deletion option documented (Settings)
- [ ] WhatsApp link working
- [ ] Email contact working

---

## 📱 MOBILE RESPONSIVENESS

All pages are mobile-responsive with:
- ✅ Readable font sizes
- ✅ Proper spacing
- ✅ Clickable links
- ✅ Expandable FAQ items
- ✅ Contact card layout

---

## 🔐 GDPR & LEGAL NOTES

**These pages cover**:
- ✅ Terms of Service requirements
- ✅ Privacy Policy (GDPR compliant)
- ✅ Data rights and user choices
- ✅ Security practices
- ✅ Contact/support procedures

**Not covered** (you may need legal review):
- Cookies policy (if using cookies beyond essential)
- Liability insurance details
- Specific country regulations

---

## 🔄 NEXT STEPS

1. **Add links** to navigation/settings/footer
2. **Customize** contact information
3. **Update** company name and branding
4. **Review** content for accuracy
5. **Test** all links and mobile display
6. **Deploy** with confidence

---

## 📝 NOTES

- No existing code was modified
- All pages use your theme system (theme-primary, theme-secondary, etc.)
- TypeScript validated ✅
- Fully responsive design ✅
- No breaking changes ✅

Ready to add these to your navigation? They're now live at:
- `/legal/terms`
- `/legal/privacy`
- `/support`

Good luck! 🚀
