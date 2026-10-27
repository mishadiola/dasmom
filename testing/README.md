# Testing

## Local checks

- `npm test` runs the existing Node.js unit tests.
- `npm run test:component` runs the Vitest/jsdom component tests.
- `npm run build` validates the Vite production build.
- `npx eslint src` runs the configured ESLint checks.
- `npm audit` checks the complete dependency tree; `npm audit --omit=dev` checks production dependencies.
- `python testing/generate_test_report.py` builds the PDF from `test-results/test-summary.json` (requires ReportLab).
- The local-only bundle load script is `testing/loadtest-local.js`; it does not call Supabase and is not representative of authenticated/database workload.

The component tests use Vitest, React Testing Library, `user-event`, `jest-dom`, and jsdom. Vitest is restricted to `*.component.test.jsx` so the existing `node:test` files continue to run under their original test runner.

## Safety and scope

Do not run integration, end-to-end, load, or database mutation tests against the linked Supabase project. Use a dedicated test project, synthetic records, and test-only accounts before adding those tests. Do not copy production credentials or patient records into test fixtures.

The report in `test-results/` records the checks run for this assessment. Browser workflows, Supabase RLS/integration, Android/offline behavior, notifications, and load testing remain unverified where an isolated environment, test accounts, supported device tooling, or an authorized target was unavailable.
