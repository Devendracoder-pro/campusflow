# CampusFlow startup roadmap

## What is ready now

- Empty workspace with no fake records.
- Validated student, faculty, course, attendance, payment, import, and export flows.
- Browser persistence for local prototyping.
- HTTP health endpoint at `/health`.
- Security headers and method restrictions on the static server.
- Automated core and server tests through `npm test`.
- PostgreSQL migration schema for organizations, users, memberships, students, faculty, courses, payments, attendance, and audit logs.
- Database migration runner through `npm run migrate`.
- Database-aware readiness endpoint at `/api/health`.
- Windows PostgreSQL setup instructions in [DB_SETUP.md](DB_SETUP.md).
- Authenticated, tenant-scoped API contract in [API_CONTRACT.md](API_CONTRACT.md).
- PostgreSQL session migration and password-hashed authentication endpoints.

## Production MVP required before real colleges use it

1. **Backend and database**
   - Move the current UI records out of `localStorage` into the PostgreSQL API.
   - Add backup automation and server-side CRUD validation on top of the migration schema.
   - Keep tenant ownership on every table and enforce it in every query so one college can never read another college's data.

2. **Identity and permissions**
   - Add email/password or an OAuth provider. Email/password registration and login foundation is now implemented.
   - Use secure, httpOnly sessions or short-lived access tokens with rotation. The current session foundation uses an httpOnly cookie with server-side hashed tokens.
   - Roles should include owner, administrator, faculty, accountant, and read-only staff.
   - Enforce permissions on the server, not only by hiding buttons in the browser. Resource-level role middleware is the next implementation slice.

3. **Operational safety**
   - Add audit logs for edits, deletes, imports, payments, and permission changes.
   - Add idempotency for payment creation and rate limits for authentication and imports.
   - Encrypt backups and sensitive data in transit and at rest.
   - Define retention, deletion, and recovery policies.

4. **Product workflows**
   - College onboarding and workspace invitations.
   - Bulk student import with a preview and row-level error report.
   - Timetables, announcements, documents, exams, and reports based on customer interviews.
   - Payment receipts and a real payment provider only after reconciliation rules are defined.

5. **Quality and delivery**
   - Add API contract tests, browser tests for every critical workflow, and accessibility checks.
   - Add CI for lint, type checking, tests, dependency audits, and build artifacts.
   - Deploy behind HTTPS with environment-specific configuration, monitoring, error tracking, and backups.
   - Add privacy policy, terms, support contact, and a data-processing agreement before onboarding institutions.

## Recommended build order

1. Choose the target customer and one paid workflow, such as student records plus fee collection.
2. Configure PostgreSQL with `.env`, run `npm run migrate`, then implement the authenticated CRUD APIs defined in [API_CONTRACT.md](API_CONTRACT.md) while preserving the current UI.
3. Add authentication, tenant isolation, roles, audit logs, and migration tooling.
4. Pilot with one college using real data and written recovery procedures.
5. Add billing, onboarding, analytics, and broader modules only after pilot feedback.

The current app is a strong local prototype with a PostgreSQL schema foundation, not yet a production SaaS. The biggest technical decision still needed is the authentication provider and the first customer workflow to monetize.

DATABASE_URL=postgres://campusflow:YOUR_PASSWORD@localhost:5432/campusflow
DB_POOL_MAX=10
