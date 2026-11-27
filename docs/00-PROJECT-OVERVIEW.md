# 00 — Project overview

Zahraoui Cover is a Moroccan insurance brokerage. The site presents six insurance categories, lets visitors request a quote or contact the agency in French, and gives authorized staff a private workspace to handle enquiries and clients.

| Approved identity | Value |
| --- | --- |
| Brand | Zahraoui Cover · ascending ZC mark · ASSURANCE lockup |
| Colors | Royal Blue #1B378A · Soft Blue #6485BC |
| Interface | Inter · French |
| APPELEZ-NOUS | +212 523 281 585 |
| ASSISTANCE | +212 522 542 323 |

The original ZIP contains 73 HTML prototypes. All 19 public pages have two references. The 19 admin desktop pages have 15 distinct mobile counterparts plus one shared mobile assistance/messages screen. Two admin quote screens have no mobile reference. See the [file-by-file audit](14-DESIGN-AUDIT.md).

**MVP.** French public site, catalog and six product pages, anonymous quote/contact/assistance intake, admin login and recovery, admin request processing and client management, transactional email. **Version 2.** Issued quotes, contracts, private PDFs, partner and catalog administration, renewals, richer stats, dedicated inbox layouts and settings.

Routes, DTOs, schema, statuses, permission split and operating thresholds are proposals. The project remains at the analysis stage. Owner review covers missing mobile layouts, approved assets, company content and privacy obligations.

| Document | Content |
| --- | --- |
| [01 Requirements](01-REQUIREMENTS.md) | Scope and owner decisions |
| [02 Architecture](02-ARCHITECTURE.md) | System and future project layout |
| [03 Frontend](03-FRONTEND.md) | Pages, behaviors and states |
| [04 Backend](04-BACKEND.md) | Modules and transactions |
| [05 Database](05-DATABASE.md) | Schema, keys, indexes, ER diagram and retention |
| [06 API](06-API-ENDPOINTS.md) | Routes and typed contracts |
| [07 Authentication](07-AUTHENTICATION.md) | Credentials, sessions, reset and roles |
| [08 Security](08-SECURITY.md) | Controls and protection of personal data |
| [09 User flows](09-USER-FLOWS.md) | Journeys and transitions |
| [10 Design system](10-DESIGN-SYSTEM.md) | Brand, tokens and reusable UI |
| [11 Deployment](11-DEPLOYMENT.md) | Compose, TLS, configuration and recovery |
| [12 Testing](12-TESTING.md) | Verification matrix |
| [13 Roadmap](13-DEVELOPMENT-ROADMAP.md) | Dependencies and acceptance criteria |
| [14 Design audit](14-DESIGN-AUDIT.md) | Archive evidence and gaps |
