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
4. Register the webhook at
   `https://<your-public-service-host>/webhooks/waafipay` and configure the
   returned signing secret as `WAAFIPAY_WEBHOOK_SECRET`. Checkout readiness
   requires this secret so pending EVC approvals and rejections can be recorded.
5. Complete WaafiPay's approved production validation process before allowing
   real customer use.

The service records an attempt before contacting WaafiPay. The provider may
send an EVC approval prompt to the payer's wallet; the browser itself does not
display that prompt. A response is recorded as successful only when WaafiPay
returns response code `2001` and state `approved`. The database RPC records
that result and activates the subscription atomically. Explicit declined,
failed, or cancelled states are recorded as failed without activating the
subscription. Uncertain responses remain pending; do not retry them with a new
reference until they have been reconciled with WaafiPay.

Webhook events are authenticated with the registered HMAC-SHA256 webhook
secret, timestamp, and event ID. The database validates the webhook against
the stored merchant, amount, currency, and payment reference, and deduplicates
events. The customer UI polls the payment record while it is pending. The
browser never grants access based on its own state; activation is performed by
the database RPC after a confirmed provider approval.

The `/ready` response and configuration-related checkout errors list missing
environment-variable names only. After a provider request is attempted, the
checkout response includes a sanitized payload preview with credentials and
the payer's full account number redacted.

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
