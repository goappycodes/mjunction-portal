# Technical Requirements — Admin Panel (Next.js + Supabase, Mock Data)

**Product:** Gifting Fulfilment & VOC Platform
**Component:** Internal Admin Panel (Phase 1, telephony-decoupled)
**Companion doc:** *PRD — IVR Language Selection & Provider Selection* (features are driven by that PRD + the base Software Brief)
**Status:** Draft for build
**Prepared:** 22 July 2026

---

## 1. Objective

Build the internal admin panel **now**, before the telephony/IVR provider is finalised, using mock data and a mocked "IVR" layer. The panel must let Admin and Telecaller users run the full recipient lifecycle end-to-end (import → order-confirm → dispatch → delivery-confirm/VOC → close) so the workflow, dashboards and exports are demonstrable and testable without any live calling.

The single most important architectural rule: **all telephony behaviour sits behind one provider interface with a mock implementation today**, so Exotel/MyOperator/Ozonetel can be dropped in later with no changes to the UI, data model or business logic.

---

## 2. Guiding principles

1. **PRD-driven** — every screen, status and field traces back to the base brief or the IVR PRD. No feature invented outside that scope.
2. **Mock-first, provider-decoupled** — a `TelephonyProvider` interface with a `MockTelephonyProvider`; real providers implement the same contract later.
3. **Real data model, fake calls** — the Supabase schema is production-shaped from day one (including the language add-on fields and structured courier fields for Phase 2). Only the *call execution* is simulated.
4. **VOC integrity from the start** — recordings (mock files now) are stored in our own private storage with full metadata, retained indefinitely, exactly as the real system will.
5. **Auditable** — every status change, call attempt, DTMF outcome and edit is written to a per-recipient timeline.

---

## 3. Tech stack (pinned + rationale)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.x, App Router** | Server Components + Server Actions; Turbopack default. Note: v16 renames `middleware.ts` → **`proxy.ts`**. |
| Language | **TypeScript** (strict) | |
| Runtime data | **Supabase** — Postgres + Auth + Storage | Postgres for data, Auth for users, Storage (private bucket) for the VOC vault. |
| Supabase client | **`@supabase/supabase-js` + `@supabase/ssr`** | Use `@supabase/ssr` (browser + server clients). The legacy `auth-helpers` package is deprecated — do **not** use it. |
| Auth verification | `supabase.auth.getUser()` / `getClaims()` in server code | Never trust `getSession()` user object for authorization. |
| Authorization | **Row Level Security (RLS)** on every table | Role-based (admin/telecaller) via `profiles.role` + JWT claims. |
| UI | **Tailwind CSS + shadcn/ui** | Accessible primitives, fast to assemble an internal tool. |
| Tables/grids | **TanStack Table** | Recipient lists, sortable/filterable pipelines. |
| Forms/validation | **react-hook-form + zod** | Shared zod schemas for import validation and forms. |
| File import | **SheetJS (xlsx)** + **papaparse (CSV)** | Parse mjunction Excel/CSV. |
| Phone normalisation | **libphonenumber-js** | Normalise `Contact No` to E.164, flag invalid. |
| Excel export | **SheetJS (xlsx)** | Client report export. |
| PDF export | **@react-pdf/renderer** (or server `pdf-lib`) | Client report PDF. |
| Mock data | **@faker-js/faker** + seed scripts | Deterministic seed for demos. |
| Charts | **Recharts** | Dashboard metrics. |

Environment keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new publishable key format; anon key still works), and server-only `SUPABASE_SERVICE_ROLE_KEY` (never exposed to the browser), plus `TELEPHONY_PROVIDER=mock`.

---

## 4. Architecture & folder structure

```
src/
  app/
    (auth)/login/
    (dashboard)/
      layout.tsx                # authed shell (nav, role gating)
      page.tsx                  # overview dashboard
      campaigns/
        page.tsx                # list
        new/page.tsx
        [campaignId]/
          page.tsx              # campaign detail + metrics
          recipients/page.tsx   # recipient pipeline table
          import/page.tsx       # Excel/CSV import wizard
          language/page.tsx     # per-campaign language config
          calls/page.tsx        # (mock) call batch runner + monitor
          dispatch/page.tsx     # manual dispatch entry / bulk update
          voc/page.tsx          # VOC vault for this campaign
          reports/page.tsx      # export client report
      queue/
        escalations/page.tsx    # telecaller: press-2 escalations
        unreachable/page.tsx    # telecaller: retries
      recipients/[recipientId]/page.tsx  # per-recipient timeline
      admin/users/page.tsx      # user & role management (admin only)
    api/
      telephony/webhook/route.ts # stub now; real provider callback later
  lib/
    supabase/{client.ts,server.ts}   # @supabase/ssr clients
    telephony/
      types.ts                  # TelephonyProvider interface + DTOs
      mock-provider.ts          # MockTelephonyProvider (current)
      index.ts                  # provider factory (reads TELEPHONY_PROVIDER)
    domain/                     # status machine, import validation (zod), normalisation
    exports/                    # xlsx + pdf builders
  proxy.ts                      # Supabase session refresh (was middleware.ts)
supabase/
  migrations/                   # SQL schema (section 6)
  seed/                         # faker seed + mock recording generator
```

Data flow: **Server Components** read via the server Supabase client (RLS-enforced); **Server Actions** perform mutations (import, status transitions, dispatch, "run mock calls"); the browser client is used only where interactivity needs it (realtime status, forms).

---

## 5. Roles & access (Phase 1: internal only)

| Role | Access |
|---|---|
| **Admin** | Everything: import, create campaigns, configure language, launch mock call batches, enter dispatch, retrieve VOC, export reports, manage users. |
| **Telecaller / agent** | Handle escalations (press-2), retry unreachable, review/clean agent-captured corrected addresses, place manual (mock) calls, view assigned recipients & timelines. No user management, no campaign creation. |

Enforced at three layers: route gating in the dashboard layout, Server Action role checks, and **RLS policies** (source of truth).

---

## 6. Data model (Supabase / Postgres)

Production-shaped schema. Language add-on fields and structured courier fields are included now. Use a **`languages` lookup table** (not an enum) so new languages are added as rows, per the PRD's "add languages without redesigning the flow."

```sql
-- ===== Enums =====
create type user_role as enum ('admin','telecaller');

create type recipient_status as enum (
  'imported',
  'order_confirm_pending',
  'address_confirmed',
  'address_corrected',
  'order_unreachable',
  'dispatched',
  'delivered',
  'delivery_confirm_pending',
  'confirmed',
  'issue_raised',
  'delivery_unreachable',
  'closed'
);

create type call_type    as enum ('order_confirmation','delivery_confirmation');
create type caller_type  as enum ('ivr','agent');
create type call_outcome as enum (
  'confirmed','corrected','no_answer','wrong_number',
  'issue_raised','transferred_to_agent','not_reachable'
);
create type language_source as enum
  ('recipient_selected','defaulted','region_inferred','agent_set');

-- ===== Users =====
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'telecaller',
  created_at  timestamptz not null default now()
);

-- ===== Languages (lookup) =====
create table languages (
  code         text primary key,      -- 'hi','en','bn','mr','ta','te','kn'
  display_name text not null,
  is_active    boolean not null default true
);

-- ===== Campaigns =====
create table campaigns (
  id                uuid primary key default gen_random_uuid(),
  calling_from      text not null,     -- Company/Brand ("Calling From")
  order_reference   text,
  start_date        date,
  end_date          date,
  -- language add-on config (per PRD §5.2, §8)
  default_language  text not null references languages(code) default 'hi',
  retry_limit       int  not null default 2,
  skip_menu_if_known boolean not null default false,
  language_config   jsonb not null default
      '[{"dtmf":"1","lang":"hi"},{"dtmf":"2","lang":"en"}]',
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now()
);

-- ===== Recipients =====
create table recipients (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references campaigns(id) on delete cascade,
  -- mjunction import columns (Appendix C of brief)
  calling_from        text,
  telecaller_name     text,
  contact_no          text,
  contact_no_e164     text,           -- normalised (libphonenumber-js)
  customer_name       text,
  address             text,
  product_name        text,
  product_delivery_date date,         -- delivery file only
  -- pipeline
  status              recipient_status not null default 'imported',
  -- language add-on (per PRD §8)
  preferred_language  text references languages(code),
  language_source     language_source,
  -- import hygiene flags
  missing_address     boolean not null default false,
  missing_product     boolean not null default false,
  dedupe_key          text,           -- campaign_id + contact_no_e164
  import_batch_id     uuid references import_batches(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on recipients (campaign_id, status);
create unique index on recipients (campaign_id, contact_no_e164)
  where contact_no_e164 is not null;

-- ===== Import batches =====
create table import_batches (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references campaigns(id) on delete cascade,
  file_name     text,
  row_count     int,
  valid_count   int,
  error_count   int,
  duplicate_count int,
  uploaded_by   uuid references profiles(id),
  created_at    timestamptz not null default now()
);

-- ===== Call attempts (mock now, real later — same shape) =====
create table call_attempts (
  id                uuid primary key default gen_random_uuid(),
  recipient_id      uuid not null references recipients(id) on delete cascade,
  campaign_id       uuid not null references campaigns(id) on delete cascade,
  call_type         call_type not null,
  attempt_number    int not null default 1,
  provider          text not null default 'mock',   -- 'mock' | 'exotel' | ...
  caller_type       caller_type not null default 'ivr',
  agent_id          uuid references profiles(id),    -- when caller_type='agent'
  -- language add-on
  language          text references languages(code),
  language_defaulted boolean not null default false,
  dtmf_response     text,             -- '1','2','9', null
  outcome           call_outcome,
  agent_note        text,
  started_at        timestamptz,
  ended_at          timestamptz,
  created_at        timestamptz not null default now()
);
create index on call_attempts (recipient_id, call_type);

-- ===== Dispatch (structured for Phase-2 courier API) =====
create table dispatches (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null unique references recipients(id) on delete cascade,
  courier_name   text,
  awb_number     text,
  dispatch_date  date,
  delivered_date date,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);

-- ===== VOC vault =====
create table voc_recordings (
  id              uuid primary key default gen_random_uuid(),
  sealed_voc_id   text unique not null,            -- human-facing id for client report
  recipient_id    uuid not null references recipients(id),
  campaign_id     uuid not null references campaigns(id),
  call_attempt_id uuid not null references call_attempts(id),
  call_type       call_type not null,
  product_name    text,
  caller_type     caller_type not null,
  language        text references languages(code),
  dtmf_outcome    text,
  storage_path    text not null,      -- private Storage object key (mock file now)
  duration_seconds int,
  created_at      timestamptz not null default now()
  -- retained indefinitely; no delete policy
);
create index on voc_recordings (campaign_id);

-- ===== Timeline / audit (who/what/when) =====
create table recipient_events (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references recipients(id) on delete cascade,
  event_type    text not null,        -- 'imported','call_attempt','status_change','dispatch','edit','voc_sealed'
  actor_type    text not null,        -- 'system','ivr','agent','admin'
  actor_id      uuid references profiles(id),
  payload       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index on recipient_events (recipient_id, created_at);
```

**Status machine.** Encode the allowed transitions (per PRD §3.1 pipeline) in `lib/domain/status.ts`; every transition writes a `recipient_events` row and updates `recipients.status`. Marking a recipient `delivered` (from dispatch) auto-enqueues them for the delivery-confirmation call (`status → delivery_confirm_pending`).

---

## 7. Row Level Security (outline)

Enable RLS on all tables. Representative policies:

- `profiles`: a user reads their own row; admins read all.
- `campaigns`, `recipients`, `call_attempts`, `dispatches`, `voc_recordings`, `recipient_events`:
  - **admin** → full read/write.
  - **telecaller** → read; write limited to escalation/retry actions (create `call_attempts` with `caller_type='agent'`, add `agent_note`, set corrected address, transition within allowed agent states). No campaign create, no user management.
- `languages`: read for all authed; write admin only.
- VOC Storage bucket is **private**; access only via short-lived signed URLs generated in Server Actions after an RLS-passing check.

Role is read from `profiles.role` (mirror into a JWT claim via a Supabase Auth hook for policy checks). Never rely on client-passed role.

---

## 8. Telephony abstraction (the decoupling contract)

All calling goes through one interface. Today only the mock exists.

```typescript
// lib/telephony/types.ts
export interface PlaceCallInput {
  recipientId: string;
  campaignId: string;
  callType: 'order_confirmation' | 'delivery_confirmation';
  languageConfig: { dtmf: string; lang: string }[];
  defaultLanguage: string;
  retryLimit: number;
  skipMenuIfKnown: boolean;
  knownLanguage?: string | null;
}

export interface PlaceCallResult {
  providerCallRef: string;
  language: string;           // chosen or defaulted
  languageDefaulted: boolean;
  dtmfResponse: string | null;
  outcome:
    | 'confirmed' | 'corrected' | 'no_answer' | 'wrong_number'
    | 'issue_raised' | 'transferred_to_agent' | 'not_reachable';
  recording?: { storagePath: string; durationSeconds: number };
  startedAt: string;
  endedAt: string;
}

export interface TelephonyProvider {
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
}
```

- **`MockTelephonyProvider`** (current): simulates the PRD call flow. It picks a language (respecting `skipMenuIfKnown`/`knownLanguage`, else weighted random or a demo distribution), simulates a language default on "no input", assigns a weighted outcome (e.g. ~70% press-1 confirmed, ~15% press-2 → escalation, ~15% no-answer/unreachable), and generates a **mock recording** object placed in the private Storage bucket (a short placeholder/generated WAV). It writes the `call_attempts`, `voc_recordings` (on confirm) and `recipient_events` rows and advances status via the status machine.
- **`index.ts`** is a factory reading `TELEPHONY_PROVIDER`. When Exotel/MyOperator is chosen, add `exotel-provider.ts` implementing the same interface (real Connect API + `StatusCallback` webhook feeding `api/telephony/webhook/route.ts`, real `RecordingUrl` pulled into the same Storage bucket). **No UI or schema change required.**

This is what lets you build fully now and swap providers after the IVR decision.

---

## 9. Feature modules (mapped to the PRD)

Each module lists pages, key Server Actions and acceptance criteria.

### 9.1 Auth & user management
- Supabase email/password login via `@supabase/ssr`; session refresh in `proxy.ts`; server verification with `getUser()`.
- Admin can invite/create users and set role. Telecallers see a restricted nav.
- **Done when:** role gating works at route, action and RLS levels.

### 9.2 Campaign management
- Create campaign (brand/"Calling From", order reference, dates). List with per-campaign metrics.
- **Done when:** a campaign can be created and opened to its recipient pipeline.

### 9.3 Recipient import (Excel/CSV)
- Wizard: upload → parse (SheetJS/papaparse) → map mjunction columns (Calling From, Tele Caller name, Contact No, Customer Name, Address, Product Name, [Product Delivery Date]) → **validate (zod)**: normalise phone to E.164, detect duplicates (within campaign), flag rows missing address/product → preview with error highlighting → commit.
- Writes `import_batches` + `recipients` (status `imported`) + `recipient_events`.
- **Done when:** a real mjunction-shaped file imports with visible counts of valid/duplicate/error rows.

### 9.4 Recipient pipeline & timeline
- TanStack Table of recipients filterable by status; per-recipient page shows the full chronological timeline (imports, every call attempt, DTMF, status change, edits, dispatch, VOC).
- **Done when:** the complete pipeline and per-recipient history render from real rows.

### 9.5 Order Confirmation call (mocked IVR + language)
- Admin selects recipients (or whole "order_confirm_pending" set) and clicks **Run batch** → calls `MockTelephonyProvider` per recipient.
- Simulates: language selection (1=Hindi/2=English default map), read address, press-1 confirm / press-2 → escalation, no-answer → retry then `order_unreachable`.
- Stores chosen language on the recipient (`preferred_language`, `language_source`).
- Press-2 lands the recipient in the **escalations queue**; agent captures the corrected address **manually** (per Ritesh's note — no STT).
- **Done when:** running a batch advances statuses, records language + outcome, and populates the escalation/unreachable queues.

### 9.6 Dispatch (manual)
- Enter courier name / AWB / dispatch date per recipient (single or bulk Excel update). Marking a recipient **delivered** auto-enqueues them into the delivery-confirm queue (`delivery_confirm_pending`).
- **Done when:** dispatch + delivered transitions work and auto-feed the VOC queue.

### 9.7 Delivery Confirmation / VOC (mocked)
- Auto-populated queue. Mock IVR names product + expected date (in the recipient's known language, press-9 to change), asks "received on time, in good condition and running ok?": press-1 = confirmed → seals a VOC; press-2 = issue → escalation (`issue_raised`); no-answer → retry then `delivery_unreachable`.
- **Done when:** confirmations seal a `voc_recordings` row with a `sealed_voc_id`, language and mock audio in the vault.

### 9.8 VOC vault
- Private Storage bucket; per-campaign list of sealed VOCs with metadata (recipient, brand, campaign, product, attempt, caller, DTMF outcome, language, timestamp); playback via signed URL. Indefinite retention.
- **Done when:** every confirmed delivery has a retrievable recording + full metadata.

### 9.9 Language configuration (per campaign)
- Manage the campaign `language_config` (DTMF→language map, default language, retry limit, skip-menu-if-known), backed by the `languages` lookup so regional languages can be enabled per order.
- **Done when:** editing config changes what the mock call simulates and what reports show.

### 9.10 Reporting & dashboards
- Campaign dashboard (Recharts): counts per status, order-confirmation rate, delivery rate, delivery-confirmation (VOC) rate, escalation/issue rate, pending queues, plus **language distribution** (new). Daily productivity view: calls placed vs connected, DTMF outcomes, agent escalations handled.
- **Done when:** metrics compute from real rows and update after a mock batch.

### 9.11 Exports (client report)
- Per-campaign Excel + PDF: recipient-wise status, confirmation dates, language, and the **sealed VOC id** — the artefact sent to mjunction.
- **Done when:** an export downloads with one row per recipient including the sealed VOC id.

---

## 10. Non-functional requirements
- **VOC durability:** recordings in our own private bucket, no delete policy, signed-URL access only. (Mock files now; identical handling for real `RecordingUrl` later.)
- **Auditability:** every mutation writes a `recipient_events` row with actor + payload.
- **Security:** RLS on all tables; service-role key server-only; `getUser()`/`getClaims()` for verification; no secrets in client bundles.
- **Performance:** server-side pagination/filtering on recipient lists (campaigns can be large); indexes as defined.
- **Config:** `TELEPHONY_PROVIDER` env switches mock↔real with no code branching in features.

---

## 11. Mock-data & seed strategy
- `supabase/seed/`: faker-generated languages, 2–3 brands/campaigns, a few hundred recipients per campaign with realistic Indian names/addresses/phones, and a **mock recording generator** that writes short placeholder WAVs to the private bucket.
- A `seed:demo` script runs a full lifecycle for one campaign (import → order-confirm batch → dispatch → delivered → delivery-confirm batch) so dashboards, queues, VOC vault and exports are all populated for demos.
- Deterministic seed (fixed faker seed) so demos are reproducible.

---

## 12. Build sequence (milestones)
1. **Foundation** — Next.js 16 app, Supabase project, `@supabase/ssr` clients, `proxy.ts` session refresh, auth + roles + RLS scaffolding.
2. **Schema & seed** — migrations (section 6) + languages/faker seed.
3. **Campaigns + recipient import** — wizard, validation, dedupe, pipeline table.
4. **Telephony interface + MockProvider** — status machine, mock call execution.
5. **Order-confirm flow** — batch runner, language capture, escalation/unreachable queues.
6. **Dispatch + delivery-confirm/VOC** — manual dispatch, auto-queue, VOC sealing + vault.
7. **Dashboards + exports** — metrics, Excel/PDF client report.
8. **Polish** — per-recipient timeline, language config screen, demo seed script.

---

## 13. Definition of done (Phase 1 panel)
- An admin can run a **complete mock lifecycle** for a campaign from a real mjunction-shaped import through to a sealed VOC and an exported client report — with **zero live telephony**.
- All telephony is behind `TelephonyProvider`; swapping to a real provider requires only a new implementation + webhook route + env change.
- Language is captured, stored, reused, reported and exported per the IVR PRD.
- RLS enforces admin vs telecaller access; every action is audited in the timeline.

---

## 14. Migration path → real telephony (post IVR decision)
1. Add `lib/telephony/<provider>-provider.ts` implementing `TelephonyProvider` (real outbound call + IVR flow reference).
2. Implement `api/telephony/webhook/route.ts` to consume the provider's status callbacks and map them to `call_attempts`/status transitions.
3. Pull the provider's recording (`RecordingUrl`) into the existing private VOC bucket with the same metadata.
4. Register DLT/language audio with the provider (see IVR PRD §11).
5. Flip `TELEPHONY_PROVIDER` from `mock` to the chosen provider. **No schema, UI, RLS or reporting changes.**
