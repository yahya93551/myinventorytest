# Subscription payment service

The standalone service owns WaafiPay subscription checkout. Manual subscription
requests and admin approval remain available. The web app defaults to manual
payment; WaafiPay checkout must be enabled explicitly.

## Local development

1. Copy `.env.example` to `.env`.
2. Keep `SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED=false`.
3. Run `npm start`; `/health` is available, but `/checkout` only accepts
   requests in a production runtime with explicit production configuration.

## Production setup

Production checkout is disabled unless `NODE_ENV=production` and
`SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED=true`. The service also requires all
production values in `.env.example`, a deployed Supabase database with migration
`20261109000000_add_waafipay_production_payments.sql` applied, and a reachable
public HTTPS service URL. The service uses the fixed endpoint
`https://api.waafipay.net/asm`; clients cannot override it.

The direct `API_PURCHASE` credentials (`merchantUid`, `apiUserId`, `apiKey`)
are separate from the HPP credentials (`storeId`, `hppKey`) required for the
documented `HPP_GETTRANINFO` verification call. The API key shown in the request
was masked and must not be copied as a real value. Set the complete values only
in the service's secret environment; never put them in the web app, browser,
logs, or source control.

Before enabling checkout:

1. Configure the production and webhook environment variables in the
   subscription service, and `SUBSCRIPTION_PAYMENT_SERVICE_URL`,
   `SUBSCRIPTION_PAYMENT_SERVICE_TOKEN`, and
   `SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED=true` in the web app.
2. Use the same random 32+ character service token in the web app and
   `SUBSCRIPTION_SERVICE_SHARED_SECRET` in the service.
3. Apply the additive Supabase migration.
4. Register the default WaafiPay webhook at
   `https://<your-public-service-host>/webhooks/waafipay`, and store the returned
   webhook secret as `WAAFIPAY_WEBHOOK_SECRET`. The endpoint accepts WaafiPay's
   unsigned `webhook.test` ping, then requires HMAC-SHA256 signatures and a
   timestamp within five minutes for transaction events.
5. Complete WaafiPay's approved production validation process before allowing
   real customer use.

The service records an attempt before contacting WaafiPay. A timeout or
unconfirmed result remains pending. Use **Check payment status** to query
`HPP_GETTRANINFO`; this reconciliation path never starts another charge, and an
unresolved payment for the tenant is recovered even if the browser lost its
original reference. Do not retry with a new reference. A successful direct
purchase is verified with `HPP_GETTRANINFO`, checking the final approved status,
amount, and currency.
The signed webhook is also verified server-side and deduplicated by event ID.
Only a verified `APPROVED` authorization updates the subscription, atomically
with its payment record. The browser never grants access.

The payment ledger is stored in Supabase. Database credentials are service-side
only; the checkout path is production-only.

## Deploying the service to Railway

1. Create a Railway service from this repository and set its **Root Directory**
   to `/subscription-service`. Railway should build and start this directory
   with `npm start` (Node.js 22 or newer).
2. Set `NODE_ENV=production`. Leave `HOST` unset; the service binds to
   `0.0.0.0` in production and listens on Railway's injected `PORT`.
3. Configure the service variables listed below, initially keeping
   `SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED=false`. Add a Railway public domain
   so WaafiPay can reach `/webhooks/waafipay` over HTTPS.
4. Confirm Railway's `/health` check succeeds. `/ready` should remain
   `not_configured` until all service credentials, database setup, and the
   explicit enable flag are complete.
5. Apply the Supabase migration, register the WaafiPay webhook, then store its
   returned signing secret in Railway. Do not enable checkout until production
   verification is complete.

Subscription service variables (set only on the private service):

- `NODE_ENV=production`
- `SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED=false` until go-live
- `SUBSCRIPTION_SERVICE_SHARED_SECRET` (random secret, at least 32 characters)
- `WAAFIPAY_MERCHANT_UID`
- `WAAFIPAY_API_USER_ID`
- `WAAFIPAY_API_KEY`
- `WAAFIPAY_HPP_STORE_ID`
- `WAAFIPAY_HPP_KEY`
- `WAAFIPAY_WEBHOOK_SECRET` (from webhook registration)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The web app needs only `SUBSCRIPTION_PAYMENT_SERVICE_URL`,
`SUBSCRIPTION_PAYMENT_SERVICE_TOKEN` (the same value as
`SUBSCRIPTION_SERVICE_SHARED_SECRET`), and
`SUBSCRIPTION_WAAFIPAY_PRODUCTION_ENABLED`. Never put WaafiPay API/HPP secrets
or the Supabase service-role key in the web app's public/client environment.

Run `npm test` for service, request-verification, webhook-signature, and
idempotency tests. Node.js 22 or newer is required.
