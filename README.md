# Gifting Fulfilment & VOC — Admin Panel (Phase 1)

Internal admin panel for the recipient lifecycle (import → order-confirm → dispatch →
delivery-confirm/VOC → close), built **telephony-decoupled**: all calling goes through a
`TelephonyProvider` interface with a `MockTelephonyProvider` today. Exotel / MyOperator /
Ozonetel drop in later with **no UI, schema, RLS or reporting changes**.

Built per [`docs/TECH_SPEC_Admin_Panel_NextJS_Supabase.md`](docs/TECH_SPEC_Admin_Panel_NextJS_Supabase.md)
and [`docs/PRD_IVR_Language_Selection_and_Provider_Evaluation.md`](docs/PRD_IVR_Language_Selection_and_Provider_Evaluation.md).

**→ Full page-by-page feature guide: [`docs/APP_DOCUMENTATION.md`](docs/APP_DOCUMENTATION.md)**

## Stack

- **Next.js 16** (App Router, Server Components + Server Actions, Turbopack; `middleware.ts` → `proxy.ts`)
- **TypeScript** (strict) · **Tailwind CSS v4** · lightweight shadcn-style UI kit
- **Supabase** — Postgres + Auth + Storage (private VOC bucket), `@supabase/ssr` clients, **RLS on every table**
- TanStack Table · react-hook-form + zod · SheetJS + papaparse · libphonenumber-js · @react-pdf/renderer · Recharts · faker

## Setup

1. `npm install`
2. Copy env into `.env.local` (already present in this workspace):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only), `TELEPHONY_PROVIDER=mock`
3. Apply migrations (already applied to the linked project):
   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_auth_rls.sql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_storage.sql
   ```
4. Seed demo data (users, 3 campaigns, ~260 recipients, a full mock lifecycle):
   ```bash
   npm run seed
   ```
5. `npm run dev` → http://localhost:3000

## Demo logins

| Role       | Email                     | Password     |
|------------|---------------------------|--------------|
| Admin      | `admin@mjunction.test`    | `Admin@12345`|
| Admin      | `mjunction@appycodes.com` | `Admin@12345`|
| Telecaller | `agent@mjunction.test`    | `Agent@12345`|

## Structure

```
src/
  app/(auth)/login            login (cookie-based SSR auth)
  app/(dashboard)             authed shell + role gating
    campaigns/[id]/…          overview · recipients · import · calls · dispatch · voc · language · reports
    queue/{escalations,unreachable}
    recipients/[id]           per-recipient timeline + agent actions
    admin/users               user & role management (admin only)
  app/actions                 Server Actions (campaigns, import, calls, dispatch, voc, agent, users, auth)
  app/api/telephony/webhook   provider callback STUB (Phase 2)
  lib/supabase                @supabase/ssr browser/server + service-role clients
  lib/telephony               TelephonyProvider interface + MockTelephonyProvider + factory
  lib/domain                  status machine, audit, call-flow, import/phone validation, metrics, languages
  lib/exports                 client report (xlsx + pdf)
supabase/migrations           schema, RLS, JWT hook, storage bucket
supabase/seed                 deterministic faker seed + mock WAV recording generator
```

## Swapping in a real provider (post IVR decision)

1. Add `lib/telephony/<provider>-provider.ts` implementing `TelephonyProvider`.
2. Register it in `lib/telephony/index.ts`.
3. Implement `app/api/telephony/webhook/route.ts` to consume status callbacks and pull
   `RecordingUrl` into the same private `voc` bucket.
4. Flip `TELEPHONY_PROVIDER` from `mock` to the provider. No schema/UI/RLS/reporting changes.

## Scripts

- `npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run seed`
