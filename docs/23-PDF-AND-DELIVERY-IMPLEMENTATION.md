# 23 — Private PDFs and quote delivery

## Generate the frozen document

[The issue endpoint](../backend/src/modules/quotes/routes.ts) updates the draft and writes a document row and a `GENERATE_PDF` outbox job in one transaction. The document stores the quote ID, quote mutation version at issue, offer revision, MIME type, creation timestamp, and, once ready, a storage key, byte length and SHA-256 digest. A later staff action can increment the quote version while the PDF's issue version stays fixed.

[The PDF worker](../backend/src/modules/quotes/jobs.ts) leases the job and reads the immutable snapshot. [The PDFKit template](../backend/src/modules/quotes/pdf.ts) renders text, A4 page flow, Royal Blue and Soft Blue, the agency name, both official numbers, offer terms and fixed-point MAD pricing. It excludes internal notes and decision evidence. The renderer does not interpret text as HTML or fetch links and images. PDFKit handles standard fonts and paragraph wrapping. [PDFKit text documentation](https://pdfkit.org/docs/text.html)

## Read from a private directory

Set `QUOTE_PDF_DIR` to an absolute directory outside the project and any web root. The API and worker use the same directory. It must belong to the process user and be private (mode 0700). [The file module](../backend/src/modules/quotes/files.ts) writes a new 0600 temporary file, synchronizes it, and publishes it atomically without replacing an existing file. The basename comes from the document UUID and must match the allowed PDF pattern. Reopening uses no-follow file handling and checks the type, size and digest. A worker retry after publication can reconcile the existing frozen file with the database.

The download URL uses the document UUID instead of a raw file path. Express requires a staff session, checks the document's quote parent and readiness, audits the read, and sends `application/pdf` with `Cache-Control: no-store`. The **Aperçu PDF** link requests inline presentation in a separate tab. **Télécharger le PDF** requests an attachment. Missing or corrupt storage yields a safe error. Generated PDFs belong in private storage and backups, never in Git.

## Delivery and retries

1. An administrator selects **Envoyer le devis**. The endpoint checks validity, customer verification, the frozen email, the source request and the ready PDF. A transaction queues one delivery job per document. Concurrent or repeated clicks cannot create another job.
2. [The existing worker](../backend/src/worker.ts) uses the same leasing and SMTP setup as the other notifications. It rechecks conditions and digest, then sends the exact bytes as a PDF attachment through the configured loopback test transport.
3. SMTP acceptance updates the job, quote and linked request in a transaction. The status means the configured mail server accepted the message. The service does not infer that the intended person received, opened or read it.
4. SMTP or storage errors leave the quote and request intact. The job retries with capped exponential backoff, and a final failure is visible in the staff screen. A manual retry reuses the same database job and stable SMTP message ID. If a worker loses its database connection after SMTP has accepted a message, a retry can yield a duplicate at the transport. SMTP cannot supply an exactly-once guarantee.

## Local setup and production gate

Create a private directory with `mkdir -m 700 /path/to/private-quote-pdfs`, set `QUOTE_PDF_DIR` in `backend/.env`, and start the API and worker. Mailpit must be on loopback with `SMTP_MODE=local`. Keep only synthetic customers and carrier records in local verification. See [Backend setup](../backend/README.md).

An approved standalone logo and complete production proposal information were unavailable. All generated PDFs use the agency name and label every page as a test document. B8 prevents issuance in production and permits delivery only via loopback Mailpit or equivalent local SMTP. Production enablement requires approved identity assets and offer wording, private durable storage, an approved sender and relay, and review of the release configuration.

B9 reuses the same private storage for [insurer-provided contract attachments](24-CONTRACTS-IMPLEMENTATION.md). Contract documents are download-only. The B8 quote issuance gate remains in force.

B11 provides [centralized document management](27-DOCUMENT-MANAGEMENT-IMPLEMENTATION.md) with the same private file directory and download URL. It links directly to each generated revision and preserves inline preview for generated quote PDFs.

B13 includes approved agency details and versioned proposal wording in new issuance snapshots. Historical documents and checksums stay intact. [Agency settings](30-AGENCY-SETTINGS-IMPLEMENTATION.md)

## Verification

[Integration tests](../backend/tests/issued-quotes.integration.ts) cover PDF authorization, invalid document paths, symbolic-link rejection, revision snapshots, exact attachment bytes, retry and request synchronization. The browser exercises the workflow with Mailpit. PDF layout is reviewed using Poppler renders and text extraction. [Implementation status](15-IMPLEMENTATION-STATUS.md)
