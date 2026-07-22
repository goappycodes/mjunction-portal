# Application Documentation — Gifting Fulfilment & VOC Admin Panel

**Phase 1 · Next.js 16 + Supabase · telephony-decoupled (mock provider today)**

This document describes every page, what each feature does, the filters available,
the underlying data flow, and the moving parts (roles, status lifecycle, telephony
abstraction). It complements the two source specs in `docs/`:

- `PRD_IVR_Language_Selection_and_Provider_Evaluation.md`
- `TECH_SPEC_Admin_Panel_NextJS_Supabase.md`

---

## 1. What this app is

An internal admin panel that runs the **full recipient lifecycle** for reward-gifting
campaigns end-to-end — **without any live telephony**. All calling goes through a single
`TelephonyProvider` interface backed today by a `MockTelephonyProvider`; a real provider
(Exotel / MyOperator / Ozonetel) drops in later with **no UI, schema, RLS or reporting
changes**.

The lifecycle:

```
import → order-confirm (IVR) → dispatch → delivered → delivery-confirm (IVR/VOC) → close
```

Every automated call starts with a **language-selection step** (1 = Hindi, 2 = English by
default, configurable per campaign); the chosen language is stored on the recipient, reused
on later calls, and surfaced in dashboards, the VOC vault and the client export.

---

## 2. Roles & access

| Role | Can do |
|---|---|
| **Admin** | Everything — import, create campaigns, configure language, launch call batches, enter dispatch, retrieve VOC, export reports, manage users. |
| **Telecaller / agent** | Handle escalations (press-2), retry unreachable recipients, capture corrected addresses manually, place manual (mock) calls, view recipients & timelines. **No** campaign creation, dispatch, import, language config or user management. |

Enforced at **three layers**:
1. **Route gating** — `requireUser()` / `requireAdmin()` in each Server Component (redirects).
2. **Nav gating** — admin-only items hidden in the sidebar.
3. **RLS** — Postgres Row Level Security on every table is the source of truth. Role is read
   from `profiles.role` via a `SECURITY DEFINER` helper (`is_admin()` / `current_app_role()`).

Verification uses `supabase.auth.getUser()` (revalidates the token) — never `getSession()`.

---

## 3. Navigation map

The dark sidebar is grouped:

- **Overview** — Dashboard, Campaigns
- **Telecaller queues** — Escalations, Unreachable
- **Administration** — Users & roles *(admin only)*

Campaign-scoped pages live under a tabbed campaign shell: **Overview · Recipients · Import ·
Calls · Dispatch · VOC vault · Language · Reports** (Import / Dispatch / Language are
admin-only tabs).

---

## 4. Pages & features

Every list page has a **filter bar** (styled GET form: change fields → **Apply filters**,
or **Reset**). Filters are applied server-side and reflected in the URL, so filtered views
are shareable/bookmarkable.

### 4.1 Login — `/login`
Email/password sign-in via the cookie-based `@supabase/ssr` browser client. On success the
session cookie is set (readable server-side) and the user is routed to the dashboard.
`proxy.ts` (Next.js 16's renamed middleware) refreshes the session on every request and
redirects unauthenticated users here.

### 4.2 Dashboard (Overview) — `/`
Cross-campaign health at a glance.
- **Stat cards**: Campaigns, Recipients, Order-confirm rate, Delivery rate, VOC (delivery)
  rate, Sealed VOCs, plus Open escalations / Unreachable / Confirmed.
- **Charts** (Recharts): pipeline by status (bar) and language distribution (pie).
- **Filter**: **Campaign scope** — scope all metrics/charts to one campaign or all campaigns.
- Metrics are computed in `lib/domain/metrics.ts` from live rows.

### 4.3 Campaigns list — `/campaigns`
Card grid of campaigns with recipient count and sealed-VOC count per campaign.
- **Filters**: Search (brand / order reference), Sort (newest / name A–Z).
- **Admin**: *New campaign* button.

### 4.4 New campaign — `/campaigns/new` *(admin)*
Create a campaign: Calling From (brand), order reference, start/end dates, default language.
Language config can be tuned in detail afterwards on the Language tab.

### 4.5 Campaign → Overview — `/campaigns/[id]`
Per-campaign version of the dashboard: stat cards (recipients, order-confirm/delivery/VOC
rates, sealed VOCs, unreachable) + pipeline-by-status and language-distribution charts.

### 4.6 Campaign → Recipients — `/campaigns/[id]/recipients`
The recipient pipeline table (TanStack Table; sortable columns: customer, contact, product,
status, language, updated). **Server-side pagination** (25/page) and filtering.
- **Filters**: Search (name / phone / product), Status, Language (incl. "Not captured").
- Click any row → the per-recipient timeline.

### 4.7 Campaign → Import — `/campaigns/[id]/import` *(admin)*
Excel/CSV import wizard:
1. **Upload** `.xlsx`/`.csv` (parsed in-browser via SheetJS / papaparse).
2. **Validate** (`lib/domain/import.ts` + zod): maps mjunction columns (Calling From, Tele
   Caller name, Contact No, Customer Name, Address, Product Name, [Product Delivery Date]),
   normalises phones to **E.164** (India, libphonenumber-js), flags missing address/product,
   detects **duplicates** within the campaign.
3. **Preview** with per-row error/duplicate highlighting and valid/duplicate/error counts.
4. **Commit** → writes an `import_batches` row + `recipients` (status `imported`) +
   an `imported` timeline event each. The server **re-checks duplicates** against the DB.

### 4.8 Campaign → Calls — `/campaigns/[id]/calls`
The (mock) IVR runner + call log.
- **Admin**: *Run order-confirm batch* and *Run delivery-confirm batch* — each processes all
  eligible recipients through the `TelephonyProvider`. A result banner shows Placed /
  Confirmed / Escalated / Unreachable.
- **Recent call attempts** table: when, type, caller (IVR/agent), **language** (with a
  "defaulted" flag when the recipient gave no input), DTMF key, outcome.
- **Filters**: Call type, Outcome, Caller (IVR/agent).
- Telecallers see the log but launch retries from the Unreachable queue instead.

**What a mock call simulates** (`MockTelephonyProvider`): language selection (respecting
skip-menu-if-known / known language, else weighted default, plus a ~12% "no input →
campaign default" case), a weighted DTMF outcome, and a placeholder WAV recording uploaded
to the **private VOC bucket** for answered calls. It then writes `call_attempts`, updates
the recipient's language, advances status, and (on a confirmed delivery call) seals a VOC.

### 4.9 Campaign → Dispatch — `/campaigns/[id]/dispatch` *(admin)*
Manual dispatch entry.
- **Ready to dispatch**: recipients with a confirmed/corrected address — enter courier, AWB,
  dispatch date → status `dispatched`.
- **Awaiting delivery**: dispatched recipients — mark delivered (date) → status `delivered`,
  which **auto-enqueues** the delivery-confirmation call (`delivery_confirm_pending`).
- **Filter**: Search by customer name.

### 4.10 Campaign → VOC vault — `/campaigns/[id]/voc`
Sealed VOC recordings for the campaign, retained indefinitely in a **private** Storage
bucket. Each row shows the sealed VOC id, recipient, product, language, DTMF, duration and
sealed timestamp. **Play** mints a **short-lived signed URL** (10 min) server-side and loads
an inline audio player + Download link.
- **Filters**: Search (sealed VOC id / product), Language.

### 4.11 Campaign → Language — `/campaigns/[id]/language` *(admin)*
Configure the IVR language menu (per PRD §5.2):
- **DTMF → language map** — add/remove rows (e.g. 1=Hindi, 2=English, 3=Bengali). Backed by
  the `languages` lookup table so regional languages are enabled without redesigning the flow.
- **Default (fallback) language** — used after N no-input retries.
- **Retry limit** — no-input/invalid attempts before fallback.
- **Skip menu if known** — on repeat calls, play directly in the stored language (press 9 to
  change). Editing this changes what the mock call simulates and what reports show.

### 4.12 Campaign → Reports — `/campaigns/[id]/reports`
The client report artefact sent to mjunction.
- Preview table: recipient-wise status, language, delivered/confirmed dates and the
  **sealed VOC id**.
- **Filter**: Status (scopes both the preview and the export).
- **Export Excel** (SheetJS) and **Export PDF** (`@react-pdf/renderer`, generated in-browser)
  — both contain all rows matching the current filter.

### 4.13 Escalations queue — `/queue/escalations`
Press-2 transfers awaiting an agent:
- **Order — address change**: order-confirm calls where the recipient pressed 2, still
  pending (address captured **manually** by the agent — per Ritesh's note, no STT).
- **Delivery — issue raised**: recipients in `issue_raised`.
- **Filter**: Type (order / delivery). "Handle →" opens the recipient.

### 4.14 Unreachable queue — `/queue/unreachable`
No-answer / not-reachable recipients (`order_unreachable`, `delivery_unreachable`) awaiting a
retry. Each row has a **Retry call** button that re-runs the appropriate IVR call.
- **Filters**: Search (name / phone), Stage (order / delivery).

### 4.15 Recipient timeline — `/recipients/[id]`
The full per-recipient history and agent workspace:
- **Details** (contact, product, delivery date, address, language source), **Dispatch** and
  **Sealed VOC** cards when present.
- **Agent actions** panel (contextual):
  - Order escalation → capture corrected address (or confirm unchanged).
  - Delivery `issue_raised` → resolution note → resolve & close.
  - Unreachable → retry call.
- **Timeline**: every event in reverse-chronological order — imported, call attempts (with
  language/DTMF/outcome), status changes, dispatch stages, agent edits, VOC sealed — each
  tagged with the actor (system / ivr / agent / admin).

### 4.16 Users & roles — `/admin/users` *(admin)*
Create users (email/password + role) via the service-role admin API; change a user's role
inline (you can't demote yourself).
- **Filters**: Search (name), Role (admin / telecaller).

---

## 5. Recipient status lifecycle

Transitions are validated by the status machine (`lib/domain/status.ts`); every transition
writes a `status_change` event and updates `recipients.status`.

```
imported
  └─ order_confirm_pending
        ├─ address_confirmed ─┐
        ├─ address_corrected ─┤→ dispatched → delivered → delivery_confirm_pending
        └─ order_unreachable ─┘                                  ├─ confirmed ─→ closed
                                                                 ├─ issue_raised ─→ closed
                                                                 └─ delivery_unreachable
```

- **Order-confirm outcomes**: press-1 → `address_confirmed`; press-2 → stays pending and
  appears in **Escalations** (agent resolves to `address_corrected`/`address_confirmed`);
  no-answer/wrong-number → `order_unreachable`.
- **Delivery-confirm outcomes**: press-1 → `confirmed` **and a VOC is sealed**; press-2 →
  `issue_raised`; no-answer/not-reachable → `delivery_unreachable`.
- Marking **delivered** auto-enqueues `delivery_confirm_pending`.

---

## 6. Telephony abstraction (the decoupling contract)

```
lib/telephony/
  types.ts          TelephonyProvider interface + PlaceCallInput/PlaceCallResult DTOs
  mock-provider.ts  MockTelephonyProvider (language pick, weighted outcomes, mock WAV)
  mock-audio.ts     generates a valid placeholder WAV
  index.ts          factory — reads TELEPHONY_PROVIDER (mock today)
app/api/telephony/webhook/route.ts   provider status-callback STUB
```

**To swap in a real provider** (post IVR decision):
1. Add `lib/telephony/<provider>-provider.ts` implementing `TelephonyProvider`.
2. Register it in `lib/telephony/index.ts`.
3. Implement the webhook route to consume status callbacks and pull `RecordingUrl` into the
   same private `voc` bucket with the same metadata.
4. Flip `TELEPHONY_PROVIDER` from `mock`. **No schema / UI / RLS / reporting changes.**

The shared call-flow logic (`lib/domain/call-flow.ts`) — writing `call_attempts`, storing the
chosen language, sealing VOCs, advancing status — is provider-agnostic and reused by both the
batch runner and the seed.

---

## 7. Data model (summary)

| Table | Purpose |
|---|---|
| `profiles` | User + role (mirrors `auth.users`). |
| `languages` | Lookup (hi/en/bn/mr/ta/te/kn…); add rows to enable languages. |
| `campaigns` | Brand/order batch + language config (map, default, retry, skip-if-known). |
| `import_batches` | One row per import with valid/error/duplicate counts. |
| `recipients` | Imported people + pipeline status + captured language + hygiene flags. |
| `call_attempts` | Every (mock) call — type, caller, language, DTMF, outcome, timestamps. |
| `dispatches` | Courier / AWB / dispatch & delivered dates (structured for Phase-2 API). |
| `voc_recordings` | Sealed VOCs — human `sealed_voc_id`, storage path, metadata. |
| `recipient_events` | Per-recipient audit timeline (who/what/when). |

RLS is enabled on all tables. The private `voc` Storage bucket is accessed only via
short-lived signed URLs minted server-side.

---

## 8. Filters reference (quick table)

| Page | Filters |
|---|---|
| Dashboard | Campaign scope |
| Campaigns | Search, Sort |
| Recipients | Search, Status, Language |
| Calls | Call type, Outcome, Caller |
| Dispatch | Search |
| VOC vault | Search, Language |
| Reports | Status |
| Escalations | Type (order / delivery) |
| Unreachable | Search, Stage (order / delivery) |
| Users | Search, Role |

---

## 9. Project structure (code)

```
src/
  app/(auth)/login              login
  app/(dashboard)               authed shell (dark sidebar + role gating)
    page.tsx                    overview dashboard
    campaigns/[id]/…            overview · recipients · import · calls · dispatch · voc · language · reports
    queue/{escalations,unreachable}
    recipients/[id]             per-recipient timeline + agent actions
    admin/users                 user & role management (admin)
  app/actions                   Server Actions (campaigns, import, calls, dispatch, voc, agent, users, auth)
  app/api/telephony/webhook     provider callback stub
  components                    Nav, PageHeader, StatCard, charts, status badge, VOC player, report export
  components/ui                 button, primitives (Card/Input/Select/Badge…), filter-bar
  lib/supabase                  @supabase/ssr browser/server + service-role clients
  lib/telephony                 provider interface + MockTelephonyProvider + factory
  lib/domain                    status machine, audit, call-flow, import/phone validation, metrics, languages
  lib/exports                   client report (xlsx + pdf)
supabase/migrations             schema, RLS, JWT hook, storage bucket
supabase/seed                   deterministic faker seed + mock WAV generator
```

---

## 10. UI / theme

- **Dark slate sidebar** (grouped nav, active accent, user avatar) with a **light content
  area** and soft, rounded cards.
- Design tokens live in `src/app/globals.css`; a small shadcn-style UI kit
  (`components/ui`) provides Button, Card, Input, Select, Badge, and the shared `FilterBar`.
- Charts use Recharts. Theme is a single light content theme by design (internal tool).
