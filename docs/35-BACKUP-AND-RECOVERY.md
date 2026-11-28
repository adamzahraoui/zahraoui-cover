# 35 — Backup and recovery

PostgreSQL holds document IDs, parent quote or contract IDs, storage keys, lengths and SHA-256 digests. Private storage holds the PDF bytes. Back up both at a consistent point, together with the application and migration revision and references to the configuration used.

## Make a backup

1. Coordinate a write pause or consistent database and storage snapshots. Pause writes and the worker as needed. PostgreSQL's logical dump is consistent within the database. It cannot coordinate a separate filesystem.
2. Use a dedicated backup role. Run `pg_dump --format=custom --file=database.dump` with the verified source DSN supplied through protected configuration. Snapshot the complete private directory with relative paths. Include archived files according to approved retention.
3. Record the cutoff, environment, release, migrations and both archive SHA-256 checksums. Keep secrets in the approved secret store. Encrypt and restrict offsite copies. Keep archives and customer manifests outside Git.
4. Check both archives after transfer. Cross-check ready document keys, digests and lengths against the private volume. Alert on incomplete or stale backups.

## Restore into isolation

1. Create a separate empty database and private volume on an isolated network. Verify the destination explicitly. Disable SMTP, incoming traffic and the worker. Never restore over development or production during a drill.
2. Verify archive digests. Use `pg_restore --exit-on-error --no-owner --dbname=<confirmed-isolated-target> database.dump`. Restore paths into a directory restricted to the runtime account. Restore configuration from secure references and review any keys needed for pending encrypted jobs.
3. Run Prisma validation and a drift check against the matching release. Verify business record counts, migration status and each ready document's relation, size and digest through the application PDF reader. Compare a captured historical PDF byte-for-byte.
4. Before serving traffic after a real incident, reconcile pending jobs, sessions, reset requests, removals and writes made after the backup cutoff. Restored jobs may otherwise replay a notification, and a restored record may have been removed since the cutoff.

## B14 synthetic drill

Four generated quote PDFs were stored by the application. With the isolated services stopped, `pg_dump -Fc` produced a 120,003-byte database archive. The private file archive was 20,480 bytes. Both archive digests passed. The database was restored to a separate empty audit database using `pg_restore --exit-on-error --no-owner`. Private files were restored into a new directory.

The application PDF reader verified all four ready files with their parent quote IDs, lengths and digests, totaling 11,302 bytes. One previously downloaded historical quote PDF retained SHA-256 `88ad44b4bed3e8653c16565647e2c520989b64cede3eb8566fc070408a3f9a16`. The worker and mail delivery were absent from the restore. Backup and restore each completed within the first two seconds of the local measurement. The drill copied the files associated with ready records. Production procedure covers the complete approved volume and requires provisioned encryption and offsite copies.

Proposed targets are 24 hours of data-loss exposure (RPO) and four hours to recover service (RTO). Approve these with the operator and rehearse on the eventual hosting and storage before relying on them.

## B15A container operations

The [staging runbook](40-OPERATIONS-RUNBOOK.md) documents the Compose backup and restore scripts. They pause staging writers and verify a disposable recovery project without starting its web or mail services. The scripts are exercised with synthetic staging data.
