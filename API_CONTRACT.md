# CampusFlow API contract

This contract is implemented for the authenticated backend foundation. The browser prototype remains available while its local-storage adapter is replaced with these endpoints.

## Request rules

- All API responses use JSON.
- All authenticated requests use an httpOnly secure session cookie.
- The server derives `user_id` and `organization_id` from the session; clients never choose the organization for authorization.
- Every database query must include the authenticated `organization_id`.
- Mutating requests require a CSRF token when cookie sessions are enabled.
- Payment creation requires an `Idempotency-Key` header.

## Authentication

### `POST /api/auth/register`

Creates the first owner and organization.

```json
{
  "organizationName": "Greenfield College",
  "displayName": "Administrator",
  "email": "admin@example.edu",
  "password": "strong-password"
}
```

Returns `201` with the sanitized user and organization. Never return password hashes.

### `POST /api/auth/login`

Starts a session. Return `401` for invalid credentials without revealing whether the email exists.

### `POST /api/auth/logout`

Revokes the current session and clears the cookie.

### `GET /api/me`

Returns the current user and organization memberships.

## Core resources

All resource endpoints require an authenticated organization membership.

- `GET /api/students`
- `POST /api/students`
- `PATCH /api/students/:id`
- `DELETE /api/students/:id`
- `GET /api/faculty`
- `POST /api/faculty`
- `PATCH /api/faculty/:id`
- `DELETE /api/faculty/:id`
- `GET /api/courses`
- `POST /api/courses`
- `PATCH /api/courses/:id`
- `DELETE /api/courses/:id`
- `GET /api/attendance?date=YYYY-MM-DD`
- `PUT /api/attendance/:date`
- `GET /api/payments`
- `POST /api/payments`

The student, faculty, and course endpoints are tenant-scoped and support list, create, update, and delete operations. Attendance supports date-filtered reads and date-based upserts. Payments require `Idempotency-Key` on creation.

## Permissions

- `owner`: organization, membership, and all workspace administration.
- `administrator`: students, faculty, courses, attendance, and workspace operations.
- `faculty`: assigned courses and attendance; read-only student details needed for teaching.
- `accountant`: payments and read-only student/course details.
- `read_only`: read-only access to permitted workspace data.

The permission check must run on the server before the SQL query or mutation.

## Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Course code is required.",
    "requestId": "request-id"
  }
}
```

Never return SQL errors, stack traces, password data, or cross-tenant existence information to clients.

## Delivery order

1. Sessions and registration/login.
2. Organization membership and role middleware.
3. Students and courses API.
4. Faculty and attendance API.
5. Payments with idempotency and audit logging.
6. Replace frontend local-storage reads/writes with these endpoints.
