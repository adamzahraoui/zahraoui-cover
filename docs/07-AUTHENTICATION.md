# 07 — Authentication and authorization

Provision named staff accounts through an operator-controlled backend command with short-lived password setup links. Disable departed users and revoke their sessions immediately.

The implemented operator command, API and frontend behavior are described in [16 Backend implementation](16-BACKEND-IMPLEMENTATION.md). The first-admin command queues a setup link and does not accept passwords. Staff can change their password from the top bar by verifying the current password. This operation revokes the current and other sessions and sends the user back to login.

| Permission | ANONYMOUS | ADVISOR | ADMIN |
| --- | --- | --- | --- |
| Public catalog, intake, login and recovery | Yes | Yes | Yes |
| Staff dashboard, request read/update/assign/link/notes, client read/create/update/verify, assistance read/update/notes/link, contact read/update/archive | — | Yes | Yes |
| Partner list and detail | — | Yes | Yes |
| Client archive, catalog or partner writes (including verification and publication), agency settings | — | — | Yes |
| B8 quote read, draft create/update and private PDF access | — | Yes | Yes |
| B8 quote issue, delivery, cancellation, revision and decisions | — | — | Yes |
| Contract read, draft preparation, renewal preparation and supporting PDF handling | — | Yes | Yes |
| Document inventory, metadata, ready download and local approved PDF attachment | — | Yes | Yes |
| Archive eligible supporting documents | — | — | Yes |
| Insurer confirmation, activation and cancellation | — | — | Yes |

ADVISOR and ADMIN are individually authorized back-office staff. The proposal assumes one brokerage team with shared caseload and assignment for routing. Review this before granting access. Resolve active account and permission on each request. A missing or expired session yields 401 and an authenticated user lacking permission receives 403. Check the target record and its scope on reads and downloads.

## Session

Generate a random 32-byte opaque token, store its hash in PostgreSQL and set `__Host-zc_session` with `Secure; HttpOnly; SameSite=Lax; Path=/` and no Domain. Rotate after login and privilege changes. Start with 30 minutes idle and 12 hours absolute expiry. Throttle last-seen writes while enforcing both limits. Logout revokes the session and clears the cookie. Account disablement, role and password changes revoke existing sessions. Use no-store on auth and personal-data responses. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

For local HTTP only, the cookie is named `zc_session` and signed-in state continues to come from PostgreSQL. Credentials are revoked through the database trigger in the same transaction as the account change.

Use Argon2id with automatic per-password salts and a baseline of 19 MiB, two iterations and parallelism one, calibrated under load. Accept 15–128 characters including spaces. Allow paste and password managers. Limit login by source and normalized account identifier. Use generic credential failures and comparable password work for unknown accounts. [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

For unsafe browser requests validate the exact Origin with exact-origin Referer fallback. Reject requests with neither signal. Require JSON for JSON endpoints and disable cross-origin credentials. Authenticated mutations also require a session-bound token in X-CSRF-Token. Return it on login and session inspection and keep it in memory.

## Recovery

1. Receive normalized email, apply abuse limits, and return the same 202 independent of account existence.
2. For an active account, generate a random 32-byte single-use token, store its hash and queue a reset email. Invalidate previous tokens. Start with 30 minutes validity.
3. Build the link from the configured HTTPS origin and put the token in the URL fragment. Read it into page memory and remove the fragment. Use no-referrer and keep third-party scripts off auth screens.
4. Submit token and password by POST. In one transaction consume the token, update the hash and revoke sessions. On failure show a generic invalid/expired message and offer a fresh link. Require login after reset.
