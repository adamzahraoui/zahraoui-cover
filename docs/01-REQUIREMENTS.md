# 01 — Requirements

| ID | Phase | Requirement |
| --- | --- | --- |
| P01 | MVP | Provide all 19 public page types, in French, with working navigation, phone links, keyboard input and mobile layouts. |
| P02 | MVP | Present six approved catalog categories and audience filtering. Link details to the quote flow with a recognized product preselection. |
| P03 | MVP | Accept anonymous quote requests through a four-step wizard with review, privacy acknowledgement and confirmation reference. Support equivalent steps on mobile. |
| P04 | MVP | Accept contact and assistance requests. Keep the official click-to-call assistance option prominent. |
| A01 | MVP | Authenticate named staff accounts with revocable sessions, password recovery and server-enforced permissions. |
| A02 | MVP | List, filter and review quote requests, update status, assign active staff, append notes and explicitly link a client. |
| A03 | MVP | Search, view, create, edit and archive clients. Display linked requests. Enable issued quote and contract sections in V2. |
| A04 | MVP | Show dashboard counts and recent requests from authorized operational data. |
| O01 | MVP | Persist submissions and email jobs together. Route contact and assistance alerts to an approved recipient. Provide minimal authorized record review and completion for these forms. |
| A05 | V2 | Manage issued quotes, partners, contracts, lifecycle transitions, private PDF download and renewal reminders. |
| A06 | B4 / V2 | Manage the live catalog in B4. Deliver approved agency settings, advanced dashboard statistics and dedicated assistance/contact inboxes in later phases. |
| S01 | Both | Enforce validation, least privilege, secure cookies, CSRF, rate limits, authorized document lookup, audit trails and recovery drills. |
| S02 | Both | Limit intake to operational contact and case information. Exclude CIN/ICE, medical details, document uploads and public client accounts. |
| D01 | Both | Preserve the original Stitch ZIP and visual identity. Publish verified company information and approved imagery and content. |

## Business decisions to confirm

| Decision | Proposed baseline |
| --- | --- |
| Catalog governance | Start with approved French product copy and six seeded slugs. Keep slugs stable in V2. Coverage language stays conditional and needs approval. |
| Mobile parity | Bring required fields and actions into existing mobile component styles. Review missing quote form/detail layouts and the merged inbox. |
| Client identity | Each new anonymous quote request creates a provisional client. Staff check candidate duplicates using contact search and explicitly relink to the verified record. Shared household/business contact details are supported. |
| Intake routing | Confirm an internal operator and SMTP destination before launch. Authorized staff can open the alert link by reference lookup on the support view and mark the case handled. |
| Privacy | Approve notice language, controller contact, lawful basis, hosting/processor arrangement, record retention and rights handling before launch. |
| Company content | Confirm official email, address, hours, map, hosting, registration/authorization identifiers, legal/privacy texts, actual partners and approved images. Omit unverified content from release. |
| V2 workflow | Confirm PDF template, quote approval rights, carrier terms, policy data, renewal timing and recipients. |
