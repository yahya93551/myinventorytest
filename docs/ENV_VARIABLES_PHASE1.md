# Environment Variables - Phase 1 Security Setup

Add these to your `.env.local` file for Phase 1 security features:

## Existing Variables (Already set)
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
UPSTASH_REDIS_REST_URL=your-upstash-redis-rest-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-rest-token
```

## NEW Phase 1 Variables (Add these)

### CORS Configuration
```env
# Comma-separated list of allowed origins
# Format: https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Sentry Error Tracking
```env
# Get DSN from https://sentry.io/settings/projects/{project}/
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
NEXT_PUBLIC_APP_VERSION=0.1.0
```

### Security Headers
```env
# Set to 'production' for strict security
NODE_ENV=production
```

## Optional: Phase 2 Variables (Not yet needed)
```env
# 2FA/MFA - Will be added in Phase 2
# ENABLE_MFA=true

# GDPR - Will be added in Phase 2
# ENABLE_GDPR_EXPORT=true
```

## How to Get Sentry DSN

1. Go to https://sentry.io
2. Create an account (free tier available)
3. Create a new project → Select "Next.js"
4. Copy the DSN from the setup page
5. Paste it into `NEXT_PUBLIC_SENTRY_DSN`

## Verification Checklist

After adding these environment variables:

- [ ] `ALLOWED_ORIGINS` contains your production domain
- [ ] `NEXT_PUBLIC_SENTRY_DSN` is valid (test by visiting `/api/test-sentry` in production)
- [ ] `NODE_ENV=production` in production deployment
- [ ] All URLs use HTTPS in production

## Testing Sentry Setup

Test that Sentry is working:

```typescript
// In a component or API route:
import { captureException } from '@/lib/sentry';

// Trigger an error to test
try {
  throw new Error('Test error from Sentry');
} catch (error) {
  captureException(error as Error);
}
```

Check your Sentry dashboard to see the error appear.
