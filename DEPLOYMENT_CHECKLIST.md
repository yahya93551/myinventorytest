# Deployment checklist & rollback plan

This document documents a safe, repeatable deployment and rollback process for the project.

## Preconditions
- All tests pass: `npx vitest -c vitest.config.ts --run`
- Typecheck clean: `npx tsc --noEmit`
- Production build succeeds locally: `npm run build`
- Have a fresh DB backup and migration plan ready
- Deployment approver(s) identified (owner/admin)

## Quick commands
```bash
# Full CI check
npm run ci

# Typecheck
npx tsc --noEmit

# Run tests
npx vitest -c vitest.config.ts --run

# Build
npm run build

# Create DB backup (Postgres example)
pg_dump -Fc -h $DB_HOST -U $DB_USER -d $DB_NAME -f backups/predeploy-$(date +%Y%m%d%H%M).dump
```

## Deployment steps
1. Create a release branch: `git checkout -b release/<version>` and push.
2. Ensure CI checks (lint, typecheck, tests) pass for the branch.
3. Tag the release (optional): `git tag -a vX.Y.Z -m "release vX.Y.Z"` and push tags.
4. Prepare environment variables in the host (Vercel/Netlify): copy from staging or update from `env.example`.
5. Take DB backup (see Quick commands).
6. Run migrations (if applicable): `npm run migrate` or `supabase db push` (follow project-specific migration steps).
7. Deploy via host (push to main, or trigger deployment in hosting UI/CI).
   - For Netlify, verify build command is `npm run build` and publish directory is `.next`.
8. Run smoke tests:
   - Health check endpoint: `GET /api/health` or `/api/_status`.
   - Log in and perform 2-3 critical flows: create product, record sale, view sales/report.
9. Monitor logs and metrics for at least 30 minutes.
10. Announce release and monitor customer-facing channels.

## Post-deploy verification checklist
- [ ] Frontend loads without JS console errors
- [ ] API endpoints return 200 for key routes
- [ ] Sales, inventory and invoice flows work end-to-end
- [ ] Background jobs / webhooks (if any) processed successfully
- [ ] Error rate and latency within acceptable bounds

## Rollback plan (critical failures)
1. If deployment failed but DB migrations were NOT applied:
   - Revert to previous deploy via hosting UI (Vercel/Netlify rollback) or redeploy previous commit: `git checkout main && git reset --hard <previous-commit> && git push --force`.
2. If DB migrations were applied and caused data loss:
   - Restore DB from pre-deploy backup:
     ```bash
     pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c backups/predeploy-YYYYMMDDHHMM.dump
     ```
   - Notify team and affected users immediately.
3. For quick bug fixes (non-DB):
   - Create a patch branch from `main`, apply hotfix, run tests and deploy patch.
4. Communication:
   - Post incident notes in the team channel and tag stakeholders.
   - Open an incident ticket with timeline, actions taken, and follow-ups.

## Roles & approvals
- Deployment approver: `owner` or `admin` (must approve release branch merge)
- Backup owner: person responsible for DB backups (coordinate before migrations)
- On-call contact: person to alert for immediate rollback and communication

## Notes & cautions
- Always take DB backups before running migrations.
- Prefer backward-compatible migrations (additive) when possible.
- If in doubt, stop and consult the team lead.

---
Recorded by automation during Phase 6 of the migration plan.
