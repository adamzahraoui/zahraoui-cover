# Zahraoui Cover · Frontend

React, TypeScript, Vite, Tailwind CSS, React Router and Lucide React. The workspace contains the public site and an authenticated staff console. Business records and actions in the console are labeled demonstrations.

## Run locally

Use Node.js 22.12 or newer and npm.

```sh
cd frontend
npm ci
npm run dev
```

Open the local address printed by Vite. The public site starts at `/`. Start the [backend and local database](../backend/README.md) and create a staff account before opening `/admin/login`. Vite proxies `/api` to the local Express server. The browser URL must match the backend’s `PUBLIC_ORIGIN`.

```sh
npm run typecheck
npm run lint
npm run build
npm run preview
```

## How to find and edit a page

- `src/pages/public/PublicRoutes.tsx` and `src/pages/admin/AdminRoutes.tsx` connect URLs to page components.
- Each page has a folder. The six insurance details pass a typed category to the same `ProductDetail` component.
- `src/components/ui` contains reusable controls. `src/components/public` and `src/components/admin` contain patterns specific to the corresponding layout.
- `src/config/company.ts` holds the official brand name and phone numbers. `src/index.css` holds the Tailwind tokens and shared CSS.
- `src/data/insurance.ts`, `faq.ts` and `demo.ts` hold the reference content and fictional records. Admin changes live in React memory and reset when the demo is unmounted or reloaded.

For example, an insurance page can reuse the same layout with a different key.

```tsx
export default function AutoInsurance() {
  return <ProductDetail slug="automobile" />
}
```

`src/components/admin/auth/AdminSession.tsx` restores the authenticated session through `/api/auth/session` and gates console routes. `src/services/api.ts` calls authentication over the same origin, with the session in an HttpOnly cookie and the CSRF value in React memory. The public catalog and four-step quote flow use the backend, as do the staff dashboard, request list, request details and catalog editor. CRM pages, public contact and assistance forms, and the staff inboxes also use the API. Issued quotes, PDFs, contracts and the other unfinished administrative screens remain demonstrations. For local setup, privacy and email configuration see [Backend setup](../backend/README.md).

See the [page specifications](../docs/03-FRONTEND.md) and [implementation status](../docs/15-IMPLEMENTATION-STATUS.md) for file paths, behaviors, test coverage and outstanding integration work.
