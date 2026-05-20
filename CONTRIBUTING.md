# Contributing to Inventory

Thank you for helping improve this project — below are safe, non-destructive steps to get started.

## Quick Start
- Install dependencies: `npm install`
- Run dev server: `npm run dev`

## Branching
- Use `feature/<short-desc>`, `fix/<issue-id>-<short-desc>`, or `chore/<desc>`.
- Open small PRs focused on a single change.

## Commit messages
- Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.

## Pull Request Checklist
- Summary of changes and reason
- How to run and test locally
- Screenshots for UI changes
- All TypeScript errors resolved (`npm run typecheck`)
- Lint passed (`npm run lint`)

## Running locally
1. Copy `.env.local` from the owner or use `env.example` as a template.
2. Install: `npm install`
3. Dev: `npm run dev`

## Tests, Linting, Formatting
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm run test` (placeholder until tests are added)

## Environment & Secrets
- Never commit secrets. Use `.env.local` for local secrets and add them to your CI secrets.
- See `env.example` for required variables.

## Proposing changes
- Small bugfixes: open a PR and reference an issue.
- Design/architecture changes: open an issue first to discuss.

## Contact
- For questions, open an issue and tag @maintainers.
