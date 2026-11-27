# 14 — Stitch design export audit

## Evidence and scope

Inspected the workspace recursively and enumerated and integrity-tested the original ZIP. Reviewed all 73 HTML files for headings and sections, navigation targets, forms and controls, responsive conventions, Tailwind and CSS, embedded SVG, asset references and browser scripts. Read the complete design-system and handoff Markdown files and visually inspected the local PNG brand board. This is a source audit of the screen HTML and local artwork. Remote image availability and browser screenshot parity were not verified.

| Source | Verified |
| --- | --- |
| Workspace | ZIP is the only original file. The workspace has no usable Git metadata or application scaffold. |
| Archive | 151 entries: 76 regular files and 75 directories. Integrity check passed. |
| Contents | 73 × code.html, 2 × Markdown, 1 × PNG. The outer archive directory is stitch_zahraoui_cover_insurance_platform/. |
| Brand board | image_ca7443.png/screen.png · 1131 × 1600 RGB PNG. Shows a handshake hero example, ZC lockup and mark treatments, typography and palette examples. |
| Design system | zahraoui_cover_design_system.md, with colors, typography, spacing, motion, voice and references to separate component sheets. |
| Handoff | 09_developer_handoff_final_audit.md, with sitemap, stack, assets and pending business facts. Some files named there belong to the described canvas/export structure and are absent. |

| HTML category | Desktop | Mobile | Page types |
| --- | ---: | ---: | ---: |
| Public | 19 | 19 | 19 |
| Administration | 19 | 16 | 19 |
| Total | 38 | 35 | 38 |

The admin mobile inventory has 15 individually paired screens plus one screen with shared assistance/messages content. The mobile quote creation and quote detail prototypes are absent. The combined contract creation/detail design and the client add/edit design each count as one page type with two route modes.

## Screen inventory

Every filename in the table is relative to the top-level directory inside the ZIP. Each screen file is named code.html. Several directory names drop accented letters.

### Public

| ID | Page | Desktop | Mobile |
| --- | --- | --- | --- |
| P01 | Accueil | `accueil_desktop_1440px/code.html` | `accueil_mobile_390px/code.html` |
| P02 | Nos assurances | `nos_assurances_desktop_1440px/code.html` | `nos_assurances_mobile_390px/code.html` |
| P03 | Assurance automobile | `assurance_automobile_desktop_1440px/code.html` | `assurance_automobile_mobile_390px/code.html` |
| P04 | Assurance habitation | `assurance_habitation_desktop_1440px/code.html` | `assurance_habitation_mobile_390px/code.html` |
| P05 | Assurance santé | `assurance_sant_desktop_1440px/code.html` | `assurance_sant_mobile_390px/code.html` |
| P06 | Assurance voyage | `assurance_voyage_desktop_1440px/code.html` | `assurance_voyage_mobile_390px/code.html` |
| P07 | Assurance professionnelle | `assurance_professionnelle_desktop_1440px/code.html` | `assurance_professionnelle_mobile_390px/code.html` |
| P08 | Responsabilité civile | `responsabilit_civile_desktop_1440px/code.html` | `responsabilit_civile_mobile_390px/code.html` |
| P09 | Demande de devis | `demande_de_devis_desktop_1440px/code.html` | `demande_de_devis_mobile_390px/code.html` |
| P10 | Particuliers | `particuliers_desktop_1440px/code.html` | `particuliers_mobile_390px/code.html` |
| P11 | Professionnels | `professionnels_desktop_1440px/code.html` | `professionnels_mobile_390px/code.html` |
| P12 | À propos | `propos_desktop_1440px/code.html` | `propos_mobile_390px/code.html` |
| P13 | Contact | `contact_desktop_1440px/code.html` | `contact_mobile_390px/code.html` |
| P14 | Assistance | `assistance_desktop_1440px/code.html` | `assistance_mobile_390px/code.html` |
| P15 | FAQ | `faq_desktop_1440px/code.html` | `faq_mobile_390px/code.html` |
| P16 | Mentions légales | `mentions_l_gales_desktop_1440px/code.html` | `mentions_l_gales_mobile_390px/code.html` |
| P17 | Politique de confidentialité | `politique_de_confidentialit_desktop_1440px/code.html` | `politique_de_confidentialit_mobile_390px/code.html` |
| P18 | Politique de cookies | `politique_de_cookies_desktop_1440px/code.html` | `politique_de_cookies_mobile_390px/code.html` |
| P19 | Page introuvable | `page_404_desktop_1440px/code.html` | `page_404_mobile_390px/code.html` |

### Administration

| ID | Page | Desktop | Mobile |
| --- | --- | --- | --- |
| A01 | Connexion | `admin_connexion_1440px/code.html` | `admin_connexion_mobile/code.html` |
| A02 | Mot de passe oublié | `admin_mot_de_passe_oubli/code.html` | `admin_mot_de_passe_oubli_mobile/code.html` |
| A03 | Réinitialisation du mot de passe | `admin_r_initialisation_du_mot_de_passe/code.html` | `admin_r_initialisation_du_mot_de_passe_mobile/code.html` |
| A04 | Tableau de bord | `admin_tableau_de_bord_1440px/code.html` | `admin_tableau_de_bord_mobile/code.html` |
| A05 | Demandes de devis | `admin_liste_des_demandes_de_devis_1440px/code.html` | `admin_demandes_de_devis_mobile/code.html` |
| A06 | Détails d’une demande | `admin_d_tails_d_une_demande_de_devis/code.html` | `admin_d_tails_d_une_demande_de_devis_mobile/code.html` |
| A07 | Clients | `admin_gestion_des_clients/code.html` | `admin_clients_mobile/code.html` |
| A08 | Profil client | `admin_profil_client/code.html` | `admin_profil_client_mobile/code.html` |
| A09 | Ajouter / modifier un client | `admin_ajouter_et_modifier_un_client/code.html` | `admin_ajouter_et_modifier_un_client_mobile/code.html` |
| A10 | Devis | `admin_gestion_des_devis/code.html` | `admin_devis_mobile/code.html` |
| A11 | Création de devis | `admin_cr_ation_d_un_devis/code.html` | Absent |
| A12 | Détails d’un devis | `admin_d_tails_d_un_devis/code.html` | Absent |
| A13 | Contrats | `admin_gestion_des_contrats/code.html` | `admin_contrats_mobile/code.html` |
| A14 | Création / détails d’un contrat | `admin_cr_ation_et_d_tails_d_un_contrat/code.html` | `admin_cr_ation_et_d_tails_d_un_contrat_mobile/code.html` |
| A15 | Demandes d’assistance | `admin_gestion_des_demandes_d_assistance/code.html` | `admin_assistance_messages_mobile/code.html` |
| A16 | Catalogue des assurances | `admin_gestion_des_assurances/code.html` | `admin_gestion_des_assurances_mobile/code.html` |
| A17 | Partenaires | `admin_gestion_des_partenaires/code.html` | `admin_gestion_des_partenaires_mobile/code.html` |
| A18 | Messages reçus | `admin_messages/code.html` | `admin_assistance_messages_mobile/code.html` |
| A19 | Paramètres | `admin_param_tres/code.html` | `admin_param_tres_mobile/code.html` |

## Asset and component gaps

| Evidence in export | Finding and proposed handling |
| --- | --- |
| Tailwind config is embedded in every page, identical across all 73. All load Tailwind through its browser CDN. 48 files have a style element, including empty tags. All load external font CSS. | No standalone tailwind.config.js, CSS file, or font binaries. Use the embedded/design-system tokens through the build pipeline after approval. All embedded configs use #0F2463 for primary-dark. The handoff text says #122662. |
| 30 img references resolve to nine distinct Google-hosted image URLs in source. | No local images/ directory or JPGs named in the handoff. Request approved originals and use locally hosted derivatives. Source references alone cannot establish availability or usage rights. |
| 65 inline SVG elements, including repeated ZC marks. The brand PNG is a composite board. | No standalone approved vector logo or lockup asset. Compare sampled inline mark geometry with the brand board and obtain approval of the production vector and lockup. The handoff's uploads/image-ca7443.png path is absent. |
| data-component-id appears in three pages and UI patterns recur across the export. | No components/ sticker sheets or separate state gallery. Derive Button, Card, Accordion, Badge and InputField from the inline examples and document functional states. |
| No source manifests, dependencies, backend, SQL schema, environment files or infrastructure config. | ZIP contains prototype materials and design documentation. Route targets need a real router and form actions need an application layer. |

The image URLs correspond to recurring adviser, family and business editorial images plus automobile, habitation, health, travel and professional detail imagery and a separate habitation catalog image. URL comparison shows that the desktop travel catalog card reuses the home/Particuliers family image and the liability card reuses the adviser image. Review those pairings and their alternative text with the approved assets.

## Functional and content inconsistencies

| Area | Source behavior | Implementation decision to review |
| --- | --- | --- |
| Public navigation | Desktop homepage has a nested insurance navigation and official phone links. Mobile homepage and catalog have local menu controls. Secondary mobile views use several compact headers. Root-relative application URLs do not resolve by opening individual HTML files. | Use a coherent route map and preserve device-level access to the catalog, quote, contact and assistance journeys. |
| Catalog and FAQ | Both layouts have local filtering scripts. Native details/summary disclosures appear in FAQ and selected detail screens. Product audience associations are encoded in HTML attributes. | Carry approved copy and matching product groupings forward and implement keyboard-accessible states. |
| Quote request | Desktop script switches panels and gates demo confirmation on a checkbox. No submit request or populated review from live entries was found. Mobile displays “Étape 1 sur 4”, shows a phone field, and Continuer links back to /devis. | Implement a shared wizard, actual review, and server-confirmed success. Handoff mentions shorthand type=auto, pro, rc; product links use automobile, professionnelle, responsabilite-civile. Accept aliases, generate full slugs. |
| Contact and assistance | Contact desktop toggles simulated consent/success. Assistance desktop toggles mock confirmation. Mobile contact omits subject and privacy acknowledgement, mobile assistance omits category, and the desktop assistance form has no equivalent acknowledgement. | Use the approved common request schema on both widths. Preserve call access if forms are unavailable. |
| Legal and cookie controls | Legal pages reference incomplete company disclosures. Preferences button has a local modal reveal. No storage or analytics integration found. | Confirm production disclosures, use approved notices and ship essential-only cookies in MVP. |
| Admin login and recovery | Desktop login always exposes a demo error on submit, mobile login links to the dashboard, and recovery forms have no application action. | Protected staff routes and real session/password endpoints are required at every viewport. |
| Admin request status and reference | List has Acceptée and Refusée, detail has Clôturée, mobile detail has three choices. Static data uses different identifiers between desktop and mobile. | Use one request status map and UUID route identifiers, independent of display references. |
| Admin workflows | Sidebar/logout links and sample detail records are static; dashboard stats and carriers are demos. Mobile admin client form omits email/notes; settings omits hours; some list filters are omitted on mobile. Some desktop detail/history sections are abbreviated on mobile. | Reconcile functionality with existing component styles. Use real record state and suppress incomplete or unauthorized controls. |
| Quotes, contracts and inbox | Missing mobile quote create/detail, mobile quote list titled “Devis & Contrats” even with a separate contracts screen, and two desktop inboxes share one mobile screen. Admin client form includes CIN / ICE. | Keep separate quote/contract routes and logical inbox records. Review shared mobile navigation and absent layouts. Exclude CIN/ICE under current requirements. |
| Organization and product claims | Demo identities, amounts, partner placeholders, mock credentials and incomplete official facts occur in the export. Handoff calls out email, physical address/map, hours, carrier names/logos, registration, hosting, social channels and WhatsApp. | Use only owner-confirmed company facts and approved conditional coverage copy, with production placeholders omitted. |

All 73 HTML documents include a viewport declaration. The only custom script blocks beyond Tailwind configuration are in the two catalog screens, two FAQ screens and desktop quote wizard, with further inline event handlers used for local behavior. No fetch or XMLHttpRequest usage was found. Browser filtering, menus, quote panels, simulated form banners and cookie dialog display are prototype behavior.

## Review gates

1. Obtain approval for this architecture, API and retention proposals.
2. Confirm the production logo, image assets and publication-ready French content, including legal notices and conditional coverage examples.
3. Review the desktop-to-mobile functional gaps and approve V2 mobile quote form/detail and inbox navigation before their implementation.
4. Confirm hosting, privacy process, internal workflows and SMTP destinations before staging with production-like personal data.

Original ZIP verified SHA-256: 57386b5bd70c503e335e8c9752081d749d4ea3d5b925c498b6d16fe671d63583.
