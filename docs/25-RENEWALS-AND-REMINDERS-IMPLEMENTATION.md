# 25 — Renewals and reminders
B11 adds links from each renewal history entry to its [document inventory](27-DOCUMENT-MANAGEMENT-IMPLEMENTATION.md).

A renewal is a separate linked draft. Staff can start one from a confirmed active or expired contract with no live successor, then correct the inherited premium and coverage and record a new insurer reference. The successor may start at the old exclusive expiration date or later. It requires a new insurer confirmation before activation. The original dates, snapshot and PDF files remain intact. A cancelled unconfirmed renewal can be replaced. A successor that was confirmed keeps its historical relationship even if later cancelled.

## Scheduling

The [renewal module](../backend/src/modules/contracts/reminders.ts) uses the shared PostgreSQL outbox. The activation transaction creates reminder jobs using `RENEWAL_REMINDER_DAYS`, which defaults to `30,15,7,1`. The date is the contract expiration date minus that many **Casablanca calendar days**. PostgreSQL converts 09:00 on that day to a UTC timestamp. Using calendar dates avoids shifting the business day when the time zone changes offset. Expiration itself is exclusive and begins at Casablanca midnight.

The contract's **Planifier les rappels internes d’échéance** preference is set in the draft. After confirmation the terms are frozen. Changes made while still in draft naturally use the final expiry date. If a job's stored expiry differs from the current term, the worker makes the job obsolete. A separately confirmed replacement receives its own reminder schedule.

- Each job has a unique key containing the contract ID, expiration date and offset. Scheduling the same term twice cannot create duplicate jobs.
- Late activation queues only the most recent elapsed reminder, plus future reminders. If the worker was unavailable across several windows, it coalesces earlier due jobs before delivering the latest due reminder.
- Jobs use the existing lease and retry mechanism with a stable message ID and up to five attempts. Confirmation of the successor and cancellation of a contract make the original's pending jobs obsolete. If a send already holds a valid lease, retry the administrative action after it finishes.
- The worker persists expiry and audit events. The API derives current status from the date before the next worker sweep. Expired and superseded contracts are excluded from renewal sends.
- The console displays planned, running, SMTP-accepted, failed and obsolete outcomes. SMTP acceptance cannot prove receipt. A crash between acceptance and database commit can lead to a duplicate at the SMTP transport.

## Local notifications

The current phase sends internal renewal alerts only. It uses the configured `RENEWAL_NOTIFY_EMAIL` and works only with `SMTP_MODE=local` outside production. The message includes the internal reference, expiry and a staff-only link. It omits customer contact information and attachments. No customer notification preference is inferred. Customer-facing renewal messages would require a separate opt-in policy and approved wording.

For a local test, start Mailpit, configure a synthetic internal recipient such as `renewals@example.invalid`, and run the existing worker. Confirm a synthetic contract with a near-term end date to exercise a due window. The mail copy explains that the reminder does not confirm a renewal. An insurer must provide fresh confirmation before the successor can become effective. [Development setup](../backend/README.md)

## Verification

The [contract integration suite](../backend/tests/contracts.integration.ts) covers confirmation, reminder creation and idempotency, downtime recovery, retries, cancellation, changed-term cleanup and preserved original documents. The [date unit test](../backend/tests/contract-dates.test.ts) covers date-only math, the exclusive boundary and Casablanca offset changes. [Implementation status](15-IMPLEMENTATION-STATUS.md) records the browser and Mailpit results.
