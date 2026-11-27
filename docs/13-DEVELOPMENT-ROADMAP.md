# 13 — Development roadmap

All tasks below begin after architecture review. Milestones depend on agreed scope, availability of owner-approved content and verified regulatory and operational requirements.

## MVP

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| M00 | Approve baseline and resolve design/content gates | Architecture and source audit | Owner approves API/model, staff access, mobile parity and delivery phases. Verified logo/imagery and legal/privacy copy, hosting, carrier wording, contact policies and notification destinations are recorded for release. |
| M01 | Establish repo and deployment foundation | M00 architecture approval | Proposed folder structure is created, CI builds and typechecks frontend/backend, Compose staging boots, migration succeeds and proxy TLS works. |
| M02 | Build shared layout and design components | M01, M00 brand approvals | Public and admin shells plus responsive controls match approved references at 390px/1440px. Keyboard navigation, visible focus, error/empty/loading states and French copy pass review. |
| M03 | Implement public site and catalog | M01, M02, M00 content approvals | All 19 public route types resolve with the six stable categories and correct audience/quote links. Official numbers, FAQ, policy routes and branded 404 work. Only approved content is visible. |
| M04 | Implement intake forms and persistence | M01–M03, approved notice | Anonymous four-step quote and contact/assistance forms work on both layouts. Server validates and stores one record per submission key, and shows reference after commit. No medical/identity attachments collected. |
| M05 | Implement staff access and recovery | M01, M02 | Named staff login, session inspection, logout and emailed reset work. Disabled or anonymous access to records fails. Role gates and cookie/CSRF behavior pass negative tests. Reset case closes after M08. |
| M06 | Implement quote request management and dashboard | M04, M05 | Staff can filter, page, assign, update and append notes. Dashboard shows live counts. Concurrent updates report conflicts without data loss. |
| M07 | Implement client management and request linkage | M05, M06 | Staff can find, view and edit clients and link a request explicitly. Admin can archive eligible records. Relationship constraints and history are verified. |
| M08 | Deliver SMTP and minimal contact/assistance handling | M04, M05 | Alert jobs deliver reference-only messages and authorized staff can open and process an enquiry. Retry and terminal failure are observable. Generic acknowledgements follow policy. Recovery link consumes once through M05. |
| M09 | Verify and release MVP | M00–M08 | End-to-end, permissions, privacy, accessibility, responsive and restore checks pass. Signed content/notice and operator procedures exist. No demo data or unsupported links reach production. |

M05 can start alongside M03/M04. M08 worker integration can start alongside the admin screens once outbox and auth interfaces are agreed. The production release waits on closing M00's business/asset and privacy decisions. B6–B7 delivered CRM and public contact/assistance with staff inboxes, support reporting and local SMTP verification. Advanced customer merges remain deferred.

## Version 2

| ID | Task | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| V01 | Advanced admin workflows and missing mobile layout approval | M09 | Product owner signs off mobile quote create/detail, shared inbox navigation, partner data, actual quote/contract terms and approved PDF template. |
| V02 | Partner and settings management | V01 | Admin can edit approved values with audit and conflict handling. Catalog management was delivered in B4 with six reserved public slugs. Partner management was delivered in B10. Carrier deactivation preserves linked records. Agency settings remain pending. |
| V03 | Advanced quote management | V01, V02, M06–M07 | Staff can create/edit compatible drafts, Admin can issue and record decisions, and list/detail show actual history on both widths. Document queue integrates with V05. |
| V04 | Contract management | V02, V03 | Authorized users can draft, activate/cancel by role and link accepted quotes correctly. Policy uniqueness and term checks hold. PDF and renewal integration complete with V05–V06. |
| V05 | Private PDF generation and retrieval | V01, V03/V04 snapshot contracts | Approved templates generate PDFs in the worker. State is visible, retries preserve revisions, and unauthorized or unavailable downloads fail safely. Test restored database/file pairs. |
| V06 | Renewal reminder jobs | V04, M08 | Approved lead time and internal destination send one reminder job per active contract/cycle. Cancellation/expiry and retries are handled with observable results. |
| V07 | Advanced statistics and dedicated inboxes | M08, V01, V03, V04 | Date/category breakdowns reflect real records. Support and contact inboxes offer list/detail/action parity at authorized widths. |
| V08 | Verify and release V2 | V02–V07 | End-to-end issued quote/contract/PDF/renewal, migrations, updated privacy review and restore rehearsal pass. Validate all 19 admin page types and the approved mobile plan. |

B8 implements V03 and the quote portion of V05 for local verification. Approved production assets, offer wording and SMTP delivery remain release prerequisites. B9 adds contract registration, private insurer-supplied PDFs and internal reminders. Malicious document scanning, approved production notification wording and relay configuration remain release prerequisites. B11 adds the private document inventory, approved local PDF uploads and supporting-document archival to V05. The MVP admin controls stay usable during the V2 migration.
