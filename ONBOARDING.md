# mjunction — Gifting Fulfilment & VOC Admin Panel

> **AI onboarding context.** Read this first. It tells a coding assistant (and a
> human) what this app is, how it's built, and the non-obvious rules to follow so
> you can be productive immediately. Pair it with the repo's `AGENTS.md`.

---

## 1. What the product is

An internal **admin panel** that runs the fulfilment + "Voice of Customer" (VOC)
lifecycle for **mjunction** gifting campaigns. A brand uploads a batch of gift
recipients; the system confirms orders and deliveries by (mock) **IVR phone
calls**, tracks dispatch/delivery, seals a **VOC recording** when a customer
confirms delivery, and produces client **reports/exports**.

### The pipeline (recipient lifecycle)
```
imported
  → order_confirm_pending        (enqueued for order-confirmation IVR call)
      → address_confirmed | address_corrected   (press 1 / press 2 handled)
      → order_unreachable         (no answer → retry queue)
  → dispatched                    (admin records courier + AWB)
  → delivered                     (admin marks delivered)
  → delivery_confirm_pending      (auto-enqueued for delivery-confirmation call)
      → confirmed                 (press 1 → a VOC recording is SEALED)
      → issue_raised              (press 2 → escalations queue)
      → delivery_unreachable      (no answer → retry queue)
  → closed
```
The canonical transition rules live in `src/lib/domain/status.ts`
(`STATUS_TRANSITIONS`, `canTransition`). **Never** set `recipients.status`
directly — always go through `transitionStatus()` in `src/lib/domain/audit.ts`,
which validates the transition and writes a `recipient_events` audit row.

### Roles
- **admin** — everything (import, dispatch, run call batches, manage users).
- **telecaller** — works the Escalations / Unreachable queues, retries calls,
  makes agent calls. Cannot import or dispatch.
Authorization source of truth is `profiles.role`, enforced in RLS via
`public.is_admin()` / `public.current_app_role()`.

---

## 2. Tech stack

| Area | Choice |
|---|---|
| Framework | **Next.js 16.2** (App Router, React 19) |
| DB / Auth / Storage | **Supabase** (hosted Postgres + Auth + Storage), RLS **on** |
| Styling | **Tailwind v4** + CSS design tokens (see §5) |
| Tables | `@tanstack/react-table` (client, sortable) + a server `DataTable` |
| Forms / validation | `react-hook-form` + **zod** |
| Files | `xlsx` + `papaparse` (import), `@react-pdf/renderer` + `xlsx` (export) |
| Charts | `recharts` |
| Phone | `libphonenumber-js` (normalise to E.164, IN) |

### ⚠️ Critical gotchas — read before writing code
1. **This is a modified Next.js.** Per `AGENTS.md`: *"APIs, conventions, and
   file structure may differ from your training data. Read the relevant guide in
   `node_modules/next/dist/docs/` before writing any code."* Don't assume.
2. **`searchParams` / `params` are Promises** — `await` them in every page.
3. **RLS is enabled on every table.** App code uses two Supabase clients:
   - `createClient()` (`src/lib/supabase/server.ts`) — the **authenticated**
     user (cookie/JWT); subject to RLS. Use for normal reads/writes.
   - `createServiceClient()` — **service role, bypasses RLS**. Use only for
     trusted server jobs (call batches, seed).
4. **DB migrations are applied by hand via `psql`** against `SUPABASE_DB_URL`
   (the Supabase migration-tracking table is intentionally empty). After any raw
   DDL, run `notify pgrst, 'reload schema';` or `supabase-js` throws
   `PGRST204 (column … not in schema cache)` until PostgREST reloads.
5. **`src/lib/database.types.ts` is hand-maintained** — keep it in sync with SQL
   migrations when you change the schema.
6. Pages are `export const dynamic = 'force-dynamic'` (data is always fresh);
   mutations generally **don't** need `revalidatePath` for list pages.

---

## 3. Run it locally

```bash
npm install
npm run dev          # Next dev server on :3000
npm run seed         # wipe + reseed demo data (idempotent)
npm run typecheck    # tsc --noEmit  (run before committing)
npm run lint         # eslint
```
`.env.local` holds the Supabase keys + `SUPABASE_DB_URL` (ask a teammate; not in
git). Seeded demo logins (shown on the login screen, testing only):
`admin@mjunction.test / Admin@12345` and `…@mjunction.test` telecaller accounts
(`Agent@12345`).

Apply a migration to the remote DB:
```bash
PGSSLMODE=require psql -d "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/000X_*.sql
```

---

## 4. Repository map

```
src/
  app/
    (auth)/login/                      Sign-in
    (dashboard)/
      layout.tsx                       Sidebar (fixed) + content shell
      page.tsx                         Dashboard (metrics + charts)
      campaigns/                       List, [campaignId] overview, /language (IVR menu), /new
      import/                          Bulk-import recipients (Excel/CSV wizard)
      recipients/                      ★ Recipients + Calls + Dispatch (merged) + detail
      voc/                             ★ VOC & Reports (recordings + client report + exports)
      queue/escalations, queue/unreachable
      admin/users/                     User & role management
    actions/                           Server actions: auth, calls, campaigns, dispatch,
                                       import, users, voc, agent
  components/
    ui/                                Design system: button, primitives (Card/Input/Select/
                                       Badge/Label), data-table, table-filters, pagination,
                                       modal, empty-state, filter-bar, skeleton, spinner
    nav, page-header, status-badge, campaign-selector, stat-card, charts,
    report-export, report-pdf, voc-player
  lib/
    supabase/ (server, client)         Supabase client factories
    domain/                            audit, status, call-flow, labels, languages, phone,
                                       metrics, campaigns, import
    database.types.ts                  Hand-maintained DB types
    exports/types.ts, utils.ts (cn, formatDate, buildQuery)
supabase/
  migrations/ 0001_init … 0004_recipient_unique_id
  seed/seed.ts                         Deterministic demo seed
```

★ = the two most feature-rich pages.

---

## 5. Conventions & reusable building blocks

**Prefer these components over hand-rolled markup** (they enforce one look):

- `Button` (`components/ui/button.tsx`) — variants: `primary` (indigo, for
  **Apply / Submit / Create**), `secondary`, `ghost`, `success` (green, **Export
  Excel / confirm**), `danger` (red, **Export PDF / destructive**), `warning`
  (amber, **Reset**). `loading` prop shows a snake spinner. Keep the
  variant→action mapping consistent app-wide.
- `TableFilters` (`components/ui/table-filters.tsx`) — the shared filter panel:
  live **debounced search** (updates the `q` param via `router.replace` in a
  transition), plus staged selects (Campaign / Language / Status / Sort by) that
  apply on **Apply**; **Reset** clears. Pass export buttons etc. as `children`.
- `DataTable` (`components/ui/data-table.tsx`) — server table shell (sticky
  header, bordered scroll container, built-in `EmptyState`). Column = `{ header,
  cell, className }`. For sortable/clickable tables use the client
  `RecipientsTable` (TanStack) pattern instead.
- `Pagination` — Prev/Next via `<Link>`; the route-level `loading.tsx` shows the
  shimmer during navigation. Build URLs with `buildQuery(base, params)`.
- `EmptyState`, `Modal` (accessible; backdrop/Esc close; bottom-sheet on mobile),
  `Skeleton*` (route `loading.tsx` shimmers), `StatusBadge`.

**Design tokens** (CSS vars in `globals.css`): `--primary`, `--surface`,
`--muted`, `--border`, `--success/danger/warning`, sidebar tokens. Use
`text-[var(--muted)]` etc., not raw hex. Buttons get `cursor-pointer` globally.

**Data-fetch pattern:** server component `page.tsx` awaits `searchParams`, calls
Supabase, and renders. Filtering/sorting/pagination are **URL-param driven**
(`campaign`, `q`, `status`, `lang`, `sort`, `page`).

**Mutations:** server action → on success, update **only the affected row's**
local state client-side (see the dispatch/deliver flow in
`recipients/recipient-row-actions.tsx` + `recipients-table.tsx`). Avoid full-page
`router.refresh()` for single-row changes; do refresh after bulk operations.

**Server-component streaming caveat:** do **not** pass a server-rendered subtree
as `children` into a `'use client'` wrapper that sits inside an async server
component's Suspense boundary — it can hang the stream (we hit this and reverted
a `PaginatedTable` wrapper). Keep client wrappers as leaves.

---

## 6. Domain glossary

- **VOC** — Voice of Customer: the sealed audio recording proving a customer
  confirmed delivery. Stored in `voc_recordings`, retained indefinitely, played
  via short-lived signed URLs (`voc-player.tsx`, `app/actions/voc.ts`).
- **Sealed VOC id** — human-readable id like `VOC-20260722-J3X7` minted on
  delivery confirmation.
- **DTMF** — the key the customer pressed on the IVR (1 = confirm, 2 = issue).
- **Call batch** — admin-launched run of the mock telephony provider over all
  eligible recipients (`app/actions/calls.ts`, `lib/telephony/*`).
- **unique_id** — external/stable id on each recipient. Supplied in the import
  file if present, else auto-generated (uuid). Used to match rows on **bulk
  dispatch / delivery** updates. Globally unique.

---

## 7. Quick "where do I…?"

| Task | Start here |
|---|---|
| Change the recipient list / filters / actions | `app/(dashboard)/recipients/recipient-calls-view.tsx`, `recipients-table.tsx`, `recipient-row-actions.tsx` |
| Dispatch / delivery / bulk-import logic | `app/actions/dispatch.ts`, `recipients/bulk-import.tsx` |
| Call flow & status transitions | `lib/domain/call-flow.ts`, `lib/domain/status.ts`, `lib/domain/audit.ts` |
| VOC vault + client report + exports | `app/(dashboard)/voc/`, `components/report-export.tsx`, `report-pdf.tsx` |
| Recipient import wizard | `app/(dashboard)/import/`, `lib/domain/import.ts`, `app/actions/import.ts` |
| Schema change | add `supabase/migrations/000X_*.sql`, apply via psql, update `lib/database.types.ts`, reload PostgREST |

**Before you finish any change:** `npm run typecheck` **and** `npm run lint` must
pass. Verify UI changes in the browser (the dev server is at `:3000`).
