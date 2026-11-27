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
5. **Issue a quote in B8.** Use an eligible client, product and carrier → save the draft → Admin freezes the offer and queues the PDF → preview or download it → Admin queues test delivery to the verified email → SMTP acceptance marks the proposal and linked request as sent → Admin records a verified decision. Contracts remain separate.
6. **Register a policy in B9.** Convert an eligible accepted proposal or register an existing external policy as a draft. An administrator records the insurer's verified confirmation. A future start stays scheduled in the interface. Staff can attach a local insurer-provided PDF, review scheduled internal reminders and prepare a separate successor. Activation of the successor cancels obsolete predecessor alerts.

## Status rules

| Record | Allowed production transitions and rules |
| --- | --- |
| Quote request | NEW → IN_REVIEW or CLOSED; IN_REVIEW → CLOSED. Historical QUOTE_SENT → ACCEPTED, DECLINED or CLOSED. For B8 offers the worker records QUOTE_SENT after accepted SMTP delivery. Decisions on those offers are recorded through the issued quote and synchronize to the request. Terminal states set closedAt. |
| Assistance | NEW → IN_PROGRESS or RESOLVED; IN_PROGRESS → RESOLVED. Priority NORMAL by default, staff can set URGENT. |
| Contact message | UNREAD ↔ READ. Both can transition to PROCESSED. Staff can archive processed messages. |
| Issued quote | DRAFT → ISSUED → SENT → ACCEPTED or DECLINED. ISSUED freezes the terms and queues the PDF. DRAFT, ISSUED and SENT may be cancelled outside an active delivery. An effective date limit protects against decisions on expired offers. A correction creates a successor draft and preserves earlier PDFs. |
| Contract | DRAFT → ACTIVE or CANCELLED; ACTIVE → CANCELLED or EXPIRED. Only a documented insurer confirmation activates a record. Confirmed future periods display scheduled and the exclusive expiry takes effect at Casablanca midnight. Cancellation requires a reason. Renewal creates a separate draft and preserves the original policy and PDFs. |
| Document | QUEUED → READY or FAILED. The worker retries transient processing under lease. A terminal failure is visible to authorized staff and operators can requeue the same revision if the snapshot is intact. |
| Client | Normal → archived after checking no NEW, IN_REVIEW or QUOTE_SENT quote request, no NEW or IN_PROGRESS assistance case and no ACTIVE contract. Retention purge is a separate maintenance operation. |

Public request IDs are never used to authorize reads. Use UUIDs for admin detail paths and separate public confirmation references. Prevent invalid state races by checking lifecycle and links inside locked transactions.
