# 10 — Design system

The source of truth for the interface is the exported design-system Markdown and its matching embedded Tailwind tokens, read alongside the brand board. Use the original visual identity and approved French content. See [asset inventory](14-DESIGN-AUDIT.md).

## Color and brand

| Role | Value and usage |
| --- | --- |
| Royal Blue | #1B378A · primary CTA, selected navigation, admin sidebar and footer. White foreground. |
| Royal Blue dark | #0F2463 · hover/dark variants, matches all embedded configs and design-system Markdown. |
| Soft Blue | #6485BC · accent and secondary brand mark. Dark on-soft-blue #001B3D for labels on this surface. |
| Secondary | #3D5F93 · readable links or a secondary action with white text. |
| Primary / secondary tint | #EFF0FF / #ECF0FF · container surfaces, foregrounds #04287C / #013062. |
| Background / surface / raised tint | #F5F7FB / #FFFFFF / #EEF2F8 |
| Ink / secondary ink | #1E293B / #475569 |
| Outline / strong outline | #E2E8F0 / #CBD5E1 · separators and nonessential borders. Verify functional focus and controls independently. |
| Success | #15803D · tint #DCFCE7, tint ink #14532D. |
| Error | #DC2626 · tint #FEE2E2, tint ink #7F1D1D. |

Use the ascending ZC mark and the Zahraoui Cover / ASSURANCE lockup. Use the approved two-tone logo on light surfaces and white monochrome on Royal Blue. The brand board identifies Aktiv Grotesk Medium and Myriad Pro in the lockup. Use Inter for UI copy. Preserve APPELEZ-NOUS : +212 523 281 585 and ASSISTANCE : +212 522 542 323, and their tel:+212523281585 and tel:+212522542323 targets. Photography should follow the source's editorial style and must be approved for use.

## Typography, spacing and motion

| Token | Font / line / weight |
| --- | --- |
| display-lg / mobile | 44 / 52 / 700 · 30 / 38 / 700 |
| headline-lg / mobile | 32 / 40 / 700 · 24 / 32 / 700 |
| headline-md | 24 / 32 / 600 |
| title-lg / title-md | 20 / 28 / 600 · 16 / 24 / 600 |
| body-lg / body-md / body-sm | 18 / 28 / 400 · 16 / 24 / 400 · 14 / 20 / 400 |
| label-lg / label-sm | 14 / 20 / 600 · 12 / 16 / 600 |

Use an 8px spacing grid with 4/8/16/24/32px gutters and 64/80px sections. The desktop container baseline is 1440px with 32px horizontal padding and the mobile baseline 390px with 16px padding. Prefer 4/6/8px radii and round shapes only for icon/status treatments seen in reference. Use subtle 1px borders and restrained elevation. Use 150ms state transitions and 200ms surface entry, respectful of reduced motion. Preserve French diacritics and sentence case. Use tabular figures for the phone and MAD display. Convert Material Symbols to Lucide icons with equivalent meaning and accessible names on icon-only controls.

## Component reuse and behavior

| Pattern | Reuse | States to cover |
| --- | --- | --- |
| LogoZC, UtilityBar, Header, Footer, AdminSidebar | Public and admin shells | Light/dark mark, current page, accessible mobile drawer |
| Button, IconButton, Link | CTA, tables, forms and dialogs | Default, hover, focus, disabled, pending |
| Card, ProductCard, RecordCard | Product grids, dashboards, mobile records | Default, interactive, selected, loading |
| FormField, Select, Checkbox, TextArea | Intake, login, business records | Help, required, invalid, disabled, pending |
| Accordion and FilterChips | FAQ, detail and catalog | Expanded, selected, empty result |
| Modal, Stepper, StatusBanner, Badge | Preferences, wizard, feedback and domain status | Keyboard focus, close, active step, success/error, text with color |
| DataTable, Pagination, EmptyState, PageSkeleton | Admin lists and reports | Paged, sorted, fetching, empty, unavailable |

Use the native control and keyboard behavior where possible. Verify text and focus contrast to WCAG AA, preserve focus on dialogs, label icons and show the same required actions at mobile widths. Keep light and dark surface variants to the uses visible in the references.
