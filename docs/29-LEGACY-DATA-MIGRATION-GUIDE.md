# 29 — Legacy data migration guide

Use the downloadable templates as examples of the fields the app can accept. Keep the agency’s original workbooks in approved storage. Work on a copy, and use synthetic examples for local tests. Confirm the real worksheet structure, encoding and column meanings before any production migration.

## 1. Prepare categories and references

Use the catalog slugs `automobile`, `habitation`, `sante`, `voyage`, `professionnelle` and `responsabilite-civile`. Supported French labels and a few unambiguous aliases, such as “Assurance santé” and “RC,” map to these values. Use the slugs where possible. Set only categories that already exist in the catalog. Use `|` to list multiple partner categories in one cell.

Keep customer, partner and policy references as text, including the leading zeros. A legacy reference is optional when creating a record. It is unique and case-sensitive within its dataset. When more than one legacy system used the same identifier, define a stable prefix for each system before import, and keep it consistent in the relationship columns. Contracts require a customer and partner reference. Use a previously imported legacy reference or an existing UUID from an authorized export. A name, email address or telephone number cannot establish a contract relationship.

## 2. Import and review partner records

| Required | Optional |
| --- | --- |
| Raison sociale | Nom d’affichage, Contact, Téléphone, Email, Site web, Adresse, Catégories, Référence historique |

A synthetic example is `Compagnie de test` with reference `000CIE-001` and categories `automobile | habitation`. Use HTTPS for a website. Review partner identity and scope through **Partenaires**, record the approved verification reference and activate the partner before importing linked contracts. Publishing stays a separate action and is unnecessary for migration.

## 3. Import customer records and review duplicates

| Required | Optional |
| --- | --- |
| Profil, Téléphone, and an appropriate name | Prénom, Email, Ville, Référence historique |

A synthetic example is profil `Particulier`, nom complet `Nadia Exemple`, téléphone `0600012345`, ville `Fès` and référence `000CLI-001`. Use one complete name, a family name with optional first name, or the company name for an enterprise. The CRM stores a display name. It has no approved dedicated street-address field at this phase.

Use `Particulier` or `Entreprise` in the profile column. Keep imported customers provisional until an authorized staff member reviews their identity. Compare duplicate reports against the existing CRM record. For legitimate shared phone or email cases, use the existing manual duplicate-review workflow. If a duplicate already exists under another ID, use its approved UUID for migration links.

## 4. Import external contracts as drafts

| Required | Optional |
| --- | --- |
| Numéro de police, Référence client, Référence compagnie, Catégorie, Date d’effet, Date d’échéance | Référence historique, Prime MAD, Garanties |

A synthetic row can use `000POL-001`, customer `000CLI-001`, partner `000CIE-001`, category `automobile`, dates `2026-11-27` and `2027-11-27`, and premium `1420,95`. Enter the insurer’s actual exclusive end date. If a date such as `03/04/2025` could be read in two ways, use an ISO date. An unresolved or ambiguous link must be corrected in the source.

After importing, review the policy and customer, confirm insurer evidence and activate only through **Contrats**. Review whether renewal reminders should be enabled before confirmation. Import creates drafts without sending mail or queuing reminders.

## Backup, recovery and release

1. Take and validate matched PostgreSQL and private file backups before a real migration. Rehearse the restore in an isolated environment with outbound mail disabled.
2. Use small batches. Download and resolve errors before confirming. Keep the committed job ID and counts for reconciliation.
3. If confirmation fails because data changed, validate again using the same source and mapping. After an interrupted request, check the history before starting another import. An unchanged confirmed request returns its saved receipt, and fresh jobs still review rows for duplicates.
4. Reconcile source counts and representative customer, partner and policy links against licensed business records. Escalate unexpected committed results to the database operator for an approved correction or backup recovery.
5. Secure templates and exports on approved storage, restrict access and apply the agency’s retention policy. Production imports require reviewed legacy structure, approved file handling, malware scanning, a migration and retention policy, and a tested backup and restore. See [deployment and recovery](11-DEPLOYMENT.md) and the [implementation guide](28-EXCEL-IMPORT-EXPORT-IMPLEMENTATION.md).
