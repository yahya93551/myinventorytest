# Phase 2: Compliance & Authentication (SKELETON - Next Week)

**Status**: 🟡 Not Started (Ready to Begin)  
**Duration**: 6 days  
**Risk Level**: 🟡 MEDIUM (auth changes)  
**Security Improvement**: 🟡 (5/10) → 🟢 (7/10)

---

## 📋 Phase 2 Tasks (In Order)

### Task 1: 2FA/MFA Database Schema
- [ ] Add `mfa_enabled` boolean to `profiles` table
- [ ] Add `mfa_method` text to `profiles` (enum: 'totp', 'sms', 'email')
- [ ] Add `mfa_backup_codes` jsonb to `profiles`
- [ ] Create new `user_mfa_attempts` table for rate limiting

### Task 2: 2FA/MFA Enrollment UI
- [ ] Create `app/settings/mfa/page.tsx` component
- [ ] Add MFA settings button to `app/settings/page.tsx`
- [ ] QR code generator for TOTP setup
- [ ] Backup codes generation and download

### Task 3: 2FA/MFA Enforcement
- [ ] Update login flow to check if 2FA required
- [ ] Create `app/auth/verify-2fa/page.tsx`
- [ ] Add TOTP verification logic to auth

### Task 4: GDPR Data Deletion
- [ ] Create `app/api/account/delete-data/route.ts` endpoint
- [ ] Password verification before deletion
- [ ] Delete all user data cascade
- [ ] Archive before deleting (optional)

### Task 5: Data Export (GDPR)
- [ ] Create `app/api/account/export-data/route.ts` endpoint
- [ ] Export as JSON/CSV
- [ ] Email export link to user
- [ ] 7-day expiration on export link

### Task 6: Password Reset Flow
- [ ] Create `app/auth/forgot-password/page.tsx`
- [ ] Create `app/auth/reset-password/page.tsx`
- [ ] Email verification link
- [ ] Password validation requirements

### Task 7: Session Management
- [ ] Create `user_sessions` table
- [ ] Track active sessions per user
- [ ] "Logout from all devices" feature
- [ ] Session timeout (30 min idle)

### Task 8: Legal Documents
- [ ] Create `app/legal/privacy/page.tsx`
- [ ] Create `app/legal/terms/page.tsx`
- [ ] Add links to footer

---

## 📁 Files to Create (Phase 2)

```
NEW FILES:
├─ app/auth/forgot-password/page.tsx
├─ app/auth/reset-password/page.tsx
├─ app/auth/verify-2fa/page.tsx
├─ app/settings/mfa/page.tsx
├─ app/legal/privacy/page.tsx
├─ app/legal/terms/page.tsx
├─ app/api/account/delete-data/route.ts
├─ app/api/account/export-data/route.ts
├─ app/api/auth/verify-2fa/route.ts
├─ app/api/auth/enroll-mfa/route.ts
├─ lib/mfa.ts
├─ lib/password.ts
├─ types/mfa.ts
├─ supabase/migrations/*_add_mfa_schema.sql
├─ supabase/migrations/*_add_user_sessions.sql
├─ docs/PHASE2_DEPLOYMENT_GUIDE.md

MODIFY:
├─ app/login/page.tsx
├─ app/settings/page.tsx
├─ types/index.ts
└─ next.config.ts
```

---

## 🔐 Phase 2 Security Features

### 2FA/MFA (Multi-Factor Authentication)
**Supports**:
- TOTP (Google Authenticator, Authy)
- SMS (via Twilio)
- Email magic links

**Implementation**:
```typescript
// User enables TOTP
1. Generate secret
2. Show QR code
3. User scans with app
4. User enters 6-digit code to verify
5. Generate backup codes
6. Store backup codes encrypted

// On login
1. Username + password
2. If MFA enabled: Show 2FA screen
3. User enters code from authenticator app
4. Verify and create session
```

### GDPR Data Deletion
**What it does**:
- User requests account deletion
- Verify password
- Delete all data (products, sales, logs)
- Delete user account
- Send confirmation email

**Implementation**:
```typescript
// GET /api/account/delete-data?token=xxx
// Returns delete form

// POST /api/account/delete-data
// { password, confirmation: true }
// Deletes everything
```

### Session Management
**Features**:
- See all active sessions (device, location, last seen)
- Logout from specific session
- Logout from all sessions
- Session timeout (30 min idle)

### Password Reset
**Flow**:
1. User clicks "Forgot Password"
2. Enters email
3. Gets reset link (valid 24 hours)
4. Clicks link, enters new password
5. Password reset, can login

---

## ✅ Success Criteria (Phase 2)

- [ ] User can enable TOTP 2FA
- [ ] Users can request data deletion
- [ ] GDPR data export works
- [ ] Password reset flow complete
- [ ] Session management UI working
- [ ] Privacy policy page exists
- [ ] All existing features still work
- [ ] No breaking changes

---

## 🚀 Estimated Timeline

```
Day 1-2: 2FA/MFA Database + Enrollment UI
Day 3:   2FA/MFA Enforcement + Login Flow
Day 4:   GDPR Data Deletion + Export
Day 5:   Password Reset + Session Management
Day 6:   Legal Documents + Testing
```

---

## 📝 Notes for Phase 2 Implementation

### Dependencies Needed
```bash
npm install speakeasy qrcode
# TOTP support
```

### Environment Variables
```env
# Phase 2 additions:
TWILIO_ACCOUNT_SID=xxx          # For SMS 2FA
TWILIO_AUTH_TOKEN=xxx
ENCRYPTION_KEY=xxx              # For backup codes
ENABLE_MFA=true
ENABLE_GDPR=true
```

### Database Migrations
- `20260516000002_add_mfa_schema.sql` - MFA tables
- `20260516000003_add_user_sessions.sql` - Session tracking

---

## ⚠️ Phase 2 Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Users locked out by 2FA | Backup codes + recovery flow |
| Rate limit bypass on 2FA | Limit attempts (3/min per user) |
| Session hijacking | IP + user agent validation |
| Unencrypted backup codes | Encrypt with master key |
| Data deletion bugs | Dry-run first, archive before delete |

---

## 🎯 After Phase 2 Complete

**Security score**: 🟡 → 🟢 (5/10 → 7/10)

**Production Ready For**:
- ✅ 10k-50k users
- ✅ EU users (GDPR compliant)
- ✅ Enterprise customers (audit-ready)

**Still Needed**:
- ⚠️ Load testing (Phase 3)
- ⚠️ Infrastructure & DevOps (Phase 4)

---

## 📚 Phase 2 Documentation (To Be Created)

1. `docs/PHASE2_DEPLOYMENT_GUIDE.md` - Step-by-step
2. `docs/MFA_SETUP.md` - MFA implementation guide
3. `docs/GDPR_COMPLIANCE.md` - GDPR requirements
4. `docs/SESSION_MANAGEMENT.md` - Session handling

---

## ✋ This is Just the Skeleton

**Phase 2 will start next week** after Phase 1 is deployed and tested.

All the code structure is planned. You'll implement it step-by-step with the same safety and clarity as Phase 1.

---

## 🔗 Related Files

- Phase 1 Summary: `docs/PHASE1_SUMMARY.md`
- Implementation Phases: `IMPLEMENTATION_PHASES.md`
- Production Review: `PRODUCTION_READINESS_REVIEW_100K_USERS.md`
