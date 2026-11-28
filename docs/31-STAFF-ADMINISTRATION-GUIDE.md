# 31 — Staff administration

Administrators manage team access from **Paramètres → Gestion du personnel**. Search by the start of a staff name or professional email address. Open an account to view its role, active state, setup status, session count and recent authentication or administrative activity.

## Invite and manage a staff account

1. Choose **Inviter un membre**, enter the authorized professional email and display name, and select **Conseiller** or **Administrateur**. A successfully saved account starts without a password. The invitation is queued for the local test SMTP worker. Delivery can be checked in Mailpit.
2. The recipient opens the 30-minute single-use link and sets their own password through the existing reset screen. No password is returned to the administrator or included in the invitation. A repeat invitation for an active account still awaiting setup supersedes the earlier setup link.
3. Open the account to edit the display name, role or active state. The role and active-state changes revoke existing sessions and unused reset links in the same database transaction. Staff who are deactivated cannot sign in.
4. Choose **Révoquer les sessions** and confirm to end all active sessions for that account. The staff member can sign in again if the account is still active. Revocation leaves password recovery and setup under their existing controls.

Advisors have no access to these endpoints. There is no public registration or account deletion endpoint. Creation and resending are limited to loopback test mail. The first-admin operator command and existing password recovery remain available under their existing configuration. This phase exposes no SMTP secrets or setup links through the admin API.

## Keep an administrator available

Demoting or deactivating an active administrator is allowed only if another active administrator has completed password setup. A pending invitation does not count. Staff mutations serialize with first-admin provisioning, and each mutation rechecks the actor’s current administrator role and session inside its transaction. If an administrator changes their own role, the current session is revoked as well.

## Endpoints

| Method and path | Behavior |
| --- | --- |
| `GET /api/admin/staff` | Administrator list with `q`, `role`, `active`, `page` and `limit`. |
| `GET /api/admin/staff/:id` | Authorized account metadata, session count and redacted history. |
| `POST /api/admin/staff` | Create and queue a local test invitation with display name, professional email and role. |
| `PATCH /api/admin/staff/:id` | Current version plus changed display name, role or active state. The professional login address is fixed in this workflow. |
| `POST /api/admin/staff/:id/invite` | Current version. Reissue a setup link for an active account that still has no password. |
| `POST /api/admin/staff/:id/revoke-sessions` | Current version. Revoke every session belonging to the account. |

All writes require CSRF and administrator authorization. Invites are limited to 15 attempts per administrator per hour, with at most three resend attempts per account per hour. The existing outbox stores only an encrypted copy of the delivery token and erases it when the job finishes. Audit events contain action, actor, target and selected status information. They exclude passwords, hashes, links, session tokens and SMTP credentials.

See [StaffManagement.tsx](../frontend/src/pages/admin/Settings/StaffManagement.tsx), the [existing authentication model](07-AUTHENTICATION.md) and the [verification report](15-IMPLEMENTATION-STATUS.md).
