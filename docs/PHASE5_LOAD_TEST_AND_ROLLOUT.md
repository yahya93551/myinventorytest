# Phase 5: Staging Load Test and Rollout

This is a staging-only procedure. Do not use production credentials or production data. The companion k6 script is read-only and fails closed unless `STAGING_BASE_URL` is a canonical HTTPS origin whose exact hostname is included in `STAGING_ALLOWED_HOSTNAMES`. The repository does not define an approved staging hostname; obtain the exact staging hostname from the deployment owner and set it in both variables. The allowlist must contain only verified staging hostnames and must never contain the production hostname (`myinventoryuse.com`) or any production alias. The script rejects the known production hostname, disables automatic redirects, and fails if a response is a redirect. It requires explicit staging confirmation and limits each run to at most 50 virtual users.

## Before the Test

- Provision a separate staging deployment and Supabase project with production-equivalent database plan, connection limits, indexes, RLS, migrations, and API configuration.
- Deploy the Phase 1-4 changes to staging in dependency order. Apply and inspect migrations only in staging.
- Seed synthetic, non-sensitive data at representative sizes: small, expected median, and largest expected tenant. Include products, sales history, activity logs, debts, inventory allocations, and mixed converted/base-unit sales.
- Use a dedicated staging owner account with an active subscription and a short-lived bearer token. Never paste token values into source files, shell history, tickets, or logs.
- Confirm backups/restore point, database monitoring, application logs, and a named operator who can stop the test.
- Agree target service-level objectives first. The script's default thresholds (less than 1% request failures, p95 below 2 seconds, p99 below 5 seconds) are provisional safety gates, not validated product SLOs.

## Read-Only k6 Smoke/Load Profile

From the repository root, with k6 installed, provide the four required environment variables in the operator's secure local shell or CI secret store:

- `STAGING_BASE_URL`: canonical staging HTTPS origin, exactly `https://<approved-staging-hostname>` (no port, path, query, fragment, credentials, or trailing slash).
- `STAGING_ALLOWED_HOSTNAMES`: comma-separated list of exact, lowercase, verified staging hostnames; no wildcard or suffix entries. The base URL hostname must exactly match one entry. Do not include production hostnames or aliases.
- `STAGING_OWNER_BEARER_TOKEN`: temporary owner token for the staging tenant.
- `CONFIRM_STAGING_TARGET=YES`: explicit operator confirmation.

Optional `TARGET_VUS` defaults to 10 and must remain at or below 50 for this script. Start with `TARGET_VUS=1`, then 5, 10, 25, and 50 in separate runs only after reviewing each run. Example invocation (the command itself is intentionally not run here):

```sh
k6 run scripts/load/staging-read-only.js
```

The script mixes bounded product listing with product analytics, 30-day sales analytics, and 30-day product metrics. It uses GET only and does not create sales, modify stock, or change account state. Redirects are not followed; any 3xx response fails the current iteration. Host validation is based on the explicit hostname allowlist, not URL redirects or suffix matching. Do not run it against production.

## Separate Transaction Correctness Test

The read-only k6 test does not validate sale writes. In staging only, prepare isolated synthetic products with known stock and allocation rows, then test concurrent sales against the same item, including:

- Competing base-unit sales whose combined quantity is greater than stock.
- Competing converted-unit sales at a conversion boundary with a nonzero remainder.
- Sales-user requests consuming the same allocation rows.
- A multi-item unpaid order that creates a debt.
- A forced failure after reservation/insertion to verify the transaction leaves no partial stock, allocation, sale, or debt changes.

Record initial and final product stock/remainder, allocation balances, sale rows, debt rows, response status, and order IDs. Run each scenario on fresh staging fixtures and verify exactly one success when competing demand exceeds availability.

## Stop/Abort Conditions

Stop the current run immediately if any of these occur:

- Any cross-tenant or role-authorization response/data anomaly.
- Stock, allocation, sale, or debt mismatch in the staging transaction tests.
- Request failure rate reaches 1% or exceeds the agreed SLO.
- p95 or p99 latency exceeds the agreed gate for two consecutive measurement windows.
- Database CPU, memory, connections, locks, disk, or queue pressure crosses the staging operator's safety threshold.
- Error rates, memory, or latency continue rising after load is reduced.

Capture request rate, concurrency, p50/p95/p99, error rate by endpoint, server CPU/memory, database CPU/connections/locks, query latency, and the exact dataset sizes for each run. Never include bearer tokens or customer data in captured artifacts.

## Rollout Gates

1. Complete functional, authorization, RLS, and concurrency checks in staging.
2. Run read-only k6 profiles at 1, 5, 10, 25, and 50 VUs; review each step before proceeding.
3. Compare results across small, median, and maximum expected tenant data sizes. Identify the first saturation point and preserve headroom; do not extrapolate to 100k concurrent users from a small-VU test.
4. Deploy to a small internal/canary cohort. Monitor errors, request latency, database load, and stock consistency.
5. Expand in measured cohorts only while all gates hold. Keep the previous application release and a documented, tested database rollback strategy available.
6. Treat 100k registered accounts separately from peak concurrent activity. Before claiming 100k readiness, define expected peak concurrency, requests per user, tenant-size distribution, regional latency, and recovery objectives, then test to that model.

## Results Record

For each run, record date/revision, staging deployment and database tier, seeded row counts per table, `TARGET_VUS`, request rate, endpoint p50/p95/p99, error rate, database metrics, observed bottleneck, outcome, and operator approval to continue. This is a runbook only; no load test or deployment has been executed as part of Phase 5 preparation.
