# 33 — Performance, SEO and accessibility

B14 used compiled Vite assets, Node 24, headless Chrome and local PostgreSQL with synthetic catalog entries. The baseline used Vite preview and proxied the same local API. The after measurements used the optional Express web host. Each route had three fresh 390 px contexts. The JavaScript column counts decoded bytes observed by the browser and includes dynamic imports used by that route. Timings are local medians.

| Page | Baseline JS bytes | B14 JS bytes | Baseline / B14 TTFB | Baseline / B14 DOM ready |
| --- | ---: | ---: | ---: | ---: |
| Home | 350,330 | 329,496 | 2 / 3 ms | 46 / 51 ms |
| Catalog | 350,330 | 329,496 | 2 / 3 ms | 46 / 48 ms |
| Quote form | 350,330 | 343,597 | 2 / 2 ms | 43 / 45 ms |
| Contact | 350,330 | 336,857 | 2 / 2 ms | 47 / 46 ms |
| Staff sign-in | 512,632 | 353,282 | 2 / 2 ms | 44 / 45 ms |

The build emits the shared index and breadcrumb/dependency chunks at approximately 79.8 KB and 23.7 KB gzip. CSS is about 35 KB uncompressed. Inter uses local WOFF2 subsets. The base Latin asset is about 48 KB. No approved production photography was available, so the findings do not estimate the impact of future imagery. Public forms and protected admin pages are split into route chunks. Company and catalog loads are shared by components within a route. Navigation still refreshes the catalog to preserve publication freshness. Large staff records are paginated. The dashboard uses bounded recent-record selections and a set of aggregate queries whose cost should be measured against a representative dataset. Public API requests observed in the final measurements took 2–24 ms on loopback.

Single mobile Lighthouse 13.6.0 runs on loopback gave Home and Catalog Performance 100, Accessibility 100, and SEO 63. Both had LCP 0.9 s and total blocking time 10 ms. Home CLS was 0.001. Reserving the catalog results area reduced catalog CLS from 0.457 to 0 in the local retest. The SEO audit correctly flagged the deliberate noindex gate. Treat timings and scores as laboratory samples.

## Indexing and browser headers

- Use `FRONTEND_DIST_DIR` to serve the built site and API under one origin. HTML includes escaped page titles and descriptions. An eligible production origin adds canonical, Open Graph and Twitter tags and the XML sitemap. The project has no approved social image or structured agency markup.
- Development, staging and raw Vite preview stay noindex. The runtime gate also requires an explicit flag, production HTTPS origin, published and approved company information, published legal/privacy/cookie/quote wording and an active published product. Admin pages stay excluded and no-store. Unpublished product details and unknown public paths return HTTP 404. Missing assets and API paths retain their own 404 responses. The sitemap lists active published categories only.
- Crawlers receive metadata but React still renders the body on the client. Social preview image and structured agency data await approved assets and information. Confirm crawling, redirects, response headers and canonical URLs at the actual origin before enabling indexing.

## Accessibility

The audit used axe WCAG tags, Lighthouse and Chrome keyboard interactions. B14 fixed a skipped catalog heading level, visible labels that disagreed with accessible names and initial route focus that kept keyboard users from finding the first skip link. Mobile navigation keeps its action sizes when the published agency name wraps. Browser coverage includes reduced-motion preference, form labels and errors, focus visibility and modal Escape behavior. See [the test report](36-FINAL-TEST-REPORT.md) for tested routes and states.

Automated tests sample rendered states. Complete screen reader behavior, localized content, every contrast combination, target spacing and third-party or future visual assets require separate evaluation before making a WCAG conformance claim. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
