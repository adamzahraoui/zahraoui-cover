# 21 — Contact and assistance

## From form to saved reference

[Contact](../frontend/src/pages/public/Contact/Contact.tsx) uses the shared [IntakeForm](../frontend/src/components/public/IntakeForm.tsx) to collect name, phone, email, subject, message and privacy acknowledgement. [Assistance](../frontend/src/pages/public/Assistance/Assistance.tsx) uses the same component with name, phone, a published insurance category, an optional contract reference, a description and acknowledgement. It displays **+212 522 542 323** and directs emergencies to emergency services.

1. React loads the form's approved privacy text and version. The form reads the draft with `FormData` and sends a UUID v4 `Idempotency-Key` through [the typed API service](../frontend/src/services/api.ts).
2. [The Express intake router](../backend/src/modules/support/intake.ts) rejects unknown fields, checks lengths and phone/email syntax, and requires a current notice and acknowledgement. It limits each form to ten submissions per source every 15 minutes. Every JSON body shares the API's 32 KB cap. Assistance locks and checks the selected category for published and active state.
3. The optional assistance reference is stored as submitted text. Public validation never checks that text against contracts or discloses whether a contract exists. Neither form creates a customer.
4. A Prisma transaction stores the submission, a redacted audit event, the idempotency key and any enabled notification jobs. An identical retry within 24 hours returns the same public receipt. Reusing a key for a different payload returns 409.
5. The response contains only `{data: {reference, receivedAt}}`. React shows the confirmation after success. If delivery of the response is uncertain, the form retains the draft and retries the same payload. If the notice changes, it refreshes the wording and requires another acknowledgement.

## API endpoints

Staff endpoints need a valid session, and staff mutations require CSRF and the last-read version. Staff list responses include `meta: {page, limit, total}`. The `from` and `to` filters are inclusive Casablanca calendar dates.

| Endpoint | Input and response |
| --- | --- |
| `GET /api/contact/notice` and `GET /api/assistance/notice` | 200 with `{noticeVersion, text}`. Both fields are null when that form is disabled. |
| `POST /api/contact` | `ContactIn` and idempotency key. Returns a 201 receipt with an `MSG-` reference after commit. |
| `POST /api/assistance` | `AssistanceIn` and idempotency key. Returns a 201 receipt with an `ASS-` reference after commit. |
| `GET /api/admin/messages` | Paged list. Search by reference, name or subject. Optional status, exact reference, date and archive filters. |
| `GET /api/admin/messages/:id` | Full message with submitted fields, status, archive date and version. |
| `PATCH /api/admin/messages/:id` | `{version, status}`. Returns the current message. `UNREAD` and `READ` can transition to each other or to `PROCESSED`. |
| `POST /api/admin/messages/:id/archive` | `{version}`. Archives a processed message and keeps its history. |
| `GET /api/admin/assistance` | Paged list. Search by reference, name or phone. Optional status, priority, exact reference, assignee, category and date filters. |
| `GET /api/admin/assistance/:id` | The original snapshot, linked client/contract, assigned staff, allowed statuses, up to 50 internal notes and 20 activity events. |
| `PATCH /api/admin/assistance/:id` | Last-read `version` plus changed `status`, `priority`, `assignedTo`, `clientId` or `contractId`. A link or assignment may be cleared with null. A verified, active client is required for a new link. A contract must belong to that client, match the case category and have a non-draft status. |
| `POST /api/admin/assistance/:id/notes` | `{version, body}` with 1–1000 characters. Returns the updated detail with 201. |
| `GET /api/admin/assistance/:id/contract-options` | `clientId` and optional prefix search and paging. Returns IDs and references of eligible existing contracts. |
| `GET /api/admin/dashboard` | Extends existing quote metrics with total customers (including archived), active provisional customers, unread messages and new/in-progress assistance cases. Recent activity links to the relevant record. |

[SupportInbox](../frontend/src/components/admin/SupportInbox.tsx) shares the responsive lists, filters and independent detail fetches. [MessageDetails](../frontend/src/pages/admin/Messages/MessageDetails.tsx) changes inbox state explicitly. [AssistanceDetails](../frontend/src/pages/admin/AssistanceInbox/AssistanceDetails.tsx) keeps the selected links and note draft in React state. The server controls allowable transitions from `NEW` to `IN_PROGRESS` or `RESOLVED` and from `IN_PROGRESS` to `RESOLVED`. Both screens render submitted text as text. The inbox records processing state. It has no send-reply action or internal note field.

## Storage and delivery

[Migration 20261127020000](../backend/prisma/migrations/20261127020000_crm_support/migration.sql) adds a nullable archive timestamp to messages and nullable foreign keys for assistance assignee, customer and contract. It extends the existing notes table so each row belongs to exactly one quote request or assistance case. Archived messages must be processed. The existing eighteen tables remain in use.

Configure `CONTACT_NOTICE_TEXT` and `ASSISTANCE_NOTICE_TEXT` independently under `PRIVACY_NOTICE_VERSION`, with the existing `IDEMPOTENCY_KEY_SECRET`. For local mail, start the worker and Mailpit. An explicitly configured `INTAKE_NOTIFY_EMAIL` enables internal alerts, and `CONTACT_ACK_EMAIL=true` enables contact acknowledgements. Assistance collects no email, so visitors receive the reference on screen. The [worker](../backend/src/modules/notifications/mail-jobs.ts) uses the existing lease and retry rules and sends only a reference and, for staff, a protected link. SMTP failure leaves the submission available in the console.

## Verification

The [support integration tests](../backend/tests/support.integration.ts) exercise validation, idempotent replay, staff status changes, audit events, approved links and mail retries. They also verify that the public assistance response does not disclose whether a supplied contract reference exists. Chrome exercised contact and assistance from submission to staff processing at 390, 768, 1024 and 1440 px. The local Mailpit run captured four contact acknowledgements, four contact alerts and four assistance alerts.

See [Backend setup](../backend/README.md) for development commands and [implementation status](15-IMPLEMENTATION-STATUS.md) for browser and local mail results. Production needs approved wording, SMTP settings and recipient addresses. Contract creation and delivery belong to a later phase.
