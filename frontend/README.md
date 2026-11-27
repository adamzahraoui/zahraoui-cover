# Zahraoui Cover · Frontend

React, TypeScript, Vite, Tailwind CSS, React Router and Lucide React. This workspace contains a local preview of the public site and administration interface.

## Run locally

Use Node.js 22.12 or newer and npm.

```sh
cd frontend
npm ci
npm run dev
```

Open the local address printed by Vite. The public site starts at `/`. Go to `/admin/login` and select **Ouvrir la démonstration** to review the administrative interface.

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

For the future backend, `src/types/api.ts` defines the initial typed contracts and `src/services/api.ts` provides same-origin calls for catalog, intake and authentication. The current preview runs without network calls to those endpoints. Quote confirmation is a UI preview. Login, password recovery, PDFs and administrative edits are demonstrations. Use fictional data only.

See the [page specifications](../docs/03-FRONTEND.md) and [implementation status](../docs/15-IMPLEMENTATION-STATUS.md) for file paths, behaviors, test coverage and outstanding integration work.
