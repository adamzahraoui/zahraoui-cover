# 17 — Backend beginner guide

Use the [backend README](../backend/README.md) to start PostgreSQL, the API and the mail worker. The frontend then uses the existing pages to sign in. Start by tracing one login request from the browser to the database and back.

## 1. From a React form to Express

[Login.tsx](../frontend/src/pages/admin/Login/Login.tsx) reads the form values. It calls `api.login` from [api.ts](../frontend/src/services/api.ts), which uses fetch with the relative URL `/api/auth/login`. Because the URL is relative, the browser treats it as part of the same site. In local development Vite forwards that path to Express. Cookies continue to belong to the browser’s site.

[server.ts](../backend/src/server.ts) checks environment settings, connects to PostgreSQL and starts listening. [app.ts](../backend/src/app.ts) attaches shared middleware before registering routes.

```ts
app.use('/api', sameOrigin(config.PUBLIC_ORIGIN))
app.use('/api', express.json({ limit: '32kb', strict: true }))
app.use('/api/auth', authRoutes(database, config, dummyHash))
```

The `/api/auth` mount works like a prefix. Inside [routes.ts](../backend/src/modules/auth/routes.ts), `routes.post('/login', ...)` handles the rest of the path.

## 2. Middleware handles shared checks

Middleware runs in registration order. `trackRequest` creates a correlation ID. Helmet sets browser security headers. `sameOrigin` guards state-changing requests. The JSON parser limits body size before the individual route sees the payload. A protected route adds middleware that loads the session, checks the staff role when required and validates CSRF before changing anything.

A route handler can throw an `ApiError`. Express 5 forwards errors from async handlers to the central error middleware. [Express error handling](https://expressjs.com/en/5x/guide/error-handling/)

## 3. Zod turns untrusted JSON into typed data

[contracts.ts](../backend/src/modules/auth/contracts.ts) describes the expected fields and their rules. `jsonBody` checks the JSON media type, then asks Zod to parse the body.

```ts
const input = jsonBody(request, loginInput)
const staff = await database.staffUser.findUnique({
  where: { email: input.email },
})
```

After this line TypeScript knows that `input.email` and `input.password` are strings. The email has been trimmed and lowercased. Unknown fields and invalid input receive a controlled 422 error.

## 4. Prisma reads and writes PostgreSQL

[Prisma Client](../backend/src/database/prisma.ts) provides typed methods for database models. The schema defines which columns exist and how tables connect. For example, the TypeScript method `database.staffUser.findUnique` queries the PostgreSQL table `staff_users`. Named constraints such as the reset digest length live in the migration because the database needs to enforce them regardless of which tool writes the row.

Several changes need to succeed together. The reset handler consumes the single-use link, writes the new password hash and records an audit event in one transaction. A database trigger revokes the account’s other credentials as part of that transaction. If the transaction fails, its changes roll back together.

## 5. Passwords, cookies and CSRF have different jobs

Argon2id hashes the password using a random salt. Login verifies the entered password against the stored hash. After verification the API generates a separate random session token and stores a digest. The browser receives the opaque value as an HttpOnly cookie and sends it back automatically on same-origin requests. React does not read that cookie.

The `GET /api/auth/session` call returns display information and a CSRF value derived from the session. React keeps the CSRF value in memory. The change-password and logout forms send it in `X-CSRF-Token`. The API compares it to the server’s session-derived value before any write. After a refresh the browser still has the cookie, so the app can restore the session and obtain its CSRF value again.

Recovery uses a different one-time secret. The database stores its digest and the mail queue briefly stores an encrypted copy. The worker sends a link to the frontend. The reset page reads the link fragment into memory and removes it from the address bar. Only the reset request body carries the token back to the API.

## 6. Authentication and roles are separate checks

Authentication answers who is signed in. Authorization answers what the signed-in user may do. [session.ts](../backend/src/modules/auth/session.ts) verifies a session against PostgreSQL and attaches a public staff view to the response context. `requireRole('ADMIN')` checks that view for the private access probe. An anonymous caller receives 401. A signed-in advisor receives 403 for the administrator-only probe.

[AdminSession.tsx](../frontend/src/components/admin/auth/AdminSession.tsx) controls what React displays while it checks a session, then renders the route or redirects to login. Every private business endpoint added later must enforce its own server-side checks even when its React page is protected.

## 7. Reading an error

An API error has a stable machine code, a French message and a request ID. Validation errors can include field names.

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Adresse email ou mot de passe incorrect.",
    "requestId": "generated-request-id"
  }
}
```

The API client turns this into an `ApiError`. The UI uses its code to show appropriate text. If something fails locally, check first that the website runs on the exact `PUBLIC_ORIGIN`, the API health probes answer and the database is migrated. For account setup or recovery, confirm that the worker is running alongside Mailpit in development. Use the request ID to find the matching redacted server event.
