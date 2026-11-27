# 09 — User flows and status transitions

## Public journeys

1. **Discover coverage.** Navigation → audience or catalog → filter → product detail → quote. Use canonical type values matching the product slugs. Accept the handoff aliases auto → automobile, pro → professionnelle, rc → responsabilite-civile. Support profil=professionnel and allow correction. Ignore unrecognized preselection and leave the choice open.
2. **Request a quote.** Select profile/product → give general needs without sensitive details → add contact details → review actual values and acknowledge the privacy notice → submit. Validate at each step and on the server. Keep the form in memory. On a timeout, reuse the original idempotency key until the outcome is resolved. A stale notice refreshes the displayed acknowledgement and requires renewed confirmation. An explicitly started new request receives a new key. Show the saved reference and next-contact wording only after success.
3. **Contact and assistance.** Go to Contact or Assistance → use the relevant official phone or submit the form → see reference. Keep assistance phone reachable when the form errors. Staff receive a reference link and handle the enquiry through A15 or A18 after authorization.
4. **Browse FAQ and policies.** Filter FAQ by category/text, expand an answer and open Contact if needed. Read legal/privacy/cookie pages through navigation. Unknown routes offer Accueil, Nos assurances and Demander un devis.

## Staff journeys

1. **Session.** Visit protected page → sign in → load role-filtered navigation and permitted target → log out. On expiry return to sign-in and recover an allowlisted same-origin admin route. For recovery, submit email → receive generic ack → open single-use link → choose/confirm password → sign in again.
2. **Process intake.** Dashboard → request list → apply filters → detail → assign active advisor → verify the provisional customer and relink to the correct existing client when needed → progress and add operational notes. Linking never overwrites the submitted snapshot. Version conflict prompts reload and review before resubmission.
3. **Maintain clients.** Search before create → review any matching contact details → create, edit or explicitly verify → view linked quote and assistance history → archive through an Admin after checking open work. Archived clients stay visible in authorized history and are unavailable for new assignments/links.
4. **Support.** Open an alert or inbox → find by reference → review → contact the requester through approved channels → mark progress or completion. Messages support marking read, marking unread, processing and archiving. Assistance supports assignment, priority and notes. Staff can attach a verified customer and an eligible existing contract after checking the identity and category. Preserve a route back to each list at mobile widths.
5. **Issue a quote in V2.** Use an eligible client/product/carrier → save draft → Admin issues and PDF is queued → wait for ready PDF → download privately and communicate through the approved workflow → Admin records an actual decision. The issue action creates a document and does not imply external delivery. Staff mark a linked intake QUOTE_SENT only after actual communication.
6. **Track policy in V2.** Start from an accepted quote or from an approved independent client policy → validate carrier, number and dates → save draft → Admin activates. Queue a private PDF and internal renewal reminders. Show renewable work from active status and term dates. Confirm actions against the current version. Send reminders only for eligible active policies and cancel pending reminders when the contract ceases to qualify.

## Status rules

| Record | Allowed production transitions and rules |
| --- | --- |
| Quote request | NEW → IN_REVIEW or CLOSED; IN_REVIEW → CLOSED. Historical QUOTE_SENT → ACCEPTED, DECLINED or CLOSED. Recording a newly sent quote requires a completed delivery operation, which belongs to a later phase. Terminal states set closedAt. |
| Assistance | NEW → IN_PROGRESS or RESOLVED; IN_PROGRESS → RESOLVED. Priority NORMAL by default, staff can set URGENT. |
| Contact message | UNREAD ↔ READ. Both can transition to PROCESSED. Staff can archive processed messages. |
| Issued quote | DRAFT → ISSUED → ACCEPTED or DECLINED. Only DRAFT is editable. ISSUED freezes business terms and queues the PDF. |
| Contract | DRAFT → ACTIVE or CANCELLED; ACTIVE → CANCELLED or EXPIRED. Activation rejects already-ended terms. The carrier/policy number uniqueness rule applies at draft creation and edit. The worker marks expired contracts at or after the start of the local expiresOn date (proposed exclusive end) and increments versions. A contract activated after its scheduled reminder date and before expiry queues a reminder for the next run. Treat an expired or cancelled policy as ineligible for reminders even before queued work is processed. |
| Document | QUEUED → READY or FAILED. The worker retries transient processing under lease. A terminal failure is visible to authorized staff and operators can requeue the same revision if the snapshot is intact. |
| Client | Normal → archived after checking no NEW, IN_REVIEW or QUOTE_SENT quote request, no NEW or IN_PROGRESS assistance case and no ACTIVE contract. Retention purge is a separate maintenance operation. |

Public request IDs are never used to authorize reads. Use UUIDs for admin detail paths and separate public confirmation references. Prevent invalid state races by checking lifecycle and links inside locked transactions.
