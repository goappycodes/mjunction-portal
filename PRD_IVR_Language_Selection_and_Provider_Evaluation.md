# PRD — IVR Language Selection & Telephony Provider Selection

**Product:** Gifting Fulfilment & VOC Platform
**Module:** IVR Calling (Order Confirmation + Delivery Confirmation / VOC)
**Document type:** Product Requirements Document (add-on requirement)
**Phase:** Phase 1
**Status:** Draft for review
**Prepared:** 22 July 2026

---

## 1. Purpose of this document

This PRD covers two connected asks:

1. **New add-on requirement** — let the recipient choose the call language at the start of every automated IVR call (*"Hindi ke liye 1 dabaye, for English press 2…"*), and define how that choice drives the rest of the call, gets stored, and shows up in reports.
2. **Provider decision** — evaluate Exotel, MyOperator and other cloud-telephony providers against our full requirement set (from the base brief plus this add-on) and recommend one to configure.

This document assumes the base Software Brief (campaigns, recipient pipeline, two IVR calls, VOC vault, reporting) as the parent scope and only elaborates the parts the language add-on and provider choice touch.

> **Key design input carried from the brief:** Ritesh's note — *"Address change should be handled by human and not speech-to-text."* This PRD therefore treats corrected-address capture as an **agent task**, not a telephony STT feature. That removes real-time speech-to-text from the Phase-1 provider must-haves and simplifies the selection.

---

## 2. Problem & rationale

The dealer/retailer base that redeems reward products spans multiple regions and is not uniformly comfortable in one language. A single-language IVR:

- lowers press-1/press-2 completion rates (recipients hang up when they don't follow the prompt),
- pushes avoidable calls to human telecallers (unreachable/retry load), and
- weakens the VOC as dispute evidence if the recipient didn't actually understand what they confirmed.

Letting the recipient pick their language up front raises comprehension, lifts confirmation rates on both call types, and produces a cleaner, defensible VOC recording.

---

## 3. Goals & success metrics

| Goal | Metric | Target (initial) |
|---|---|---|
| Higher self-serve confirmation | Order-confirm + delivery-confirm rate via IVR (no agent) | Uplift vs single-language baseline |
| Lower escalation to humans | % calls needing telecaller follow-up | Reduce vs baseline |
| Correct-language delivery | % calls where prompts played in recipient's chosen/known language | ≥ 95% |
| Defensible VOC | % confirmations with full recording + captured language + DTMF outcome | 100% |

---

## 4. Scope

**In scope (this PRD)**
- Language-selection step at the start of both IVR calls (Order Confirmation and Delivery Confirmation/VOC).
- Configurable language menu per campaign (default: 1 = Hindi, 2 = English).
- Storing the chosen/known language on the recipient record and reusing it on later calls.
- Language visible in the per-recipient timeline, dashboards and client export.
- Provider requirement definition, evaluation matrix and recommendation.
- Provider configuration plan for the language IVR.

**Out of scope (this PRD)**
- Conversational AI voice agent (Phase 2).
- Speech-to-text address capture (dropped per Ritesh's note; addresses handled by agents).
- Courier API auto-tracking (Phase 2 candidate from base brief).
- Client-facing portal (Phase 1 is internal-only).

---

## 5. Requirement detail — Language selection in IVR

### 5.1 Behaviour

1. Every automated outbound IVR call (both Order Confirmation and Delivery Confirmation) **begins with a bilingual language-selection prompt** before any script content is read:
   > *"Namaste. Hindi ke liye 1 dabaiye. For English, press 2."*
   The selection prompt itself is played in both languages so a recipient of either language understands it.
2. **DTMF captures the choice:** `1 → Hindi`, `2 → English`. The rest of the call — greeting, address read-out or product/date read-out, confirm/flag options, agent-transfer message, closing — is then played in the **selected language**.
3. **Recording covers the whole call**, including the language-selection step (recording starts before the prompt).
4. The selected language is **stored on the recipient record** and reused as the default on any subsequent call to that recipient (e.g. Order Confirmation choice pre-selects language for the later Delivery Confirmation call), while still allowing the recipient to change it.

### 5.2 Configurability

- The language menu is **configurable per campaign** (brand/order). Default map is `1 = Hindi, 2 = English`.
- The design must allow **adding more languages** without re-engineering the flow, because the dealer base spans regions. Recommended near-term optional set: Bengali, Marathi, Tamil, Telugu, Kannada — enabled per campaign based on the order's region. (Open question 9.1 confirms the first order's languages.)
- Each language needs its own audio for every prompt in the script — supplied as **pre-recorded, human-voiced audio** (preferred for a professional VOC) or **multilingual TTS** where recording all variants isn't practical.

### 5.3 Fallback & edge handling

| Situation | Behaviour |
|---|---|
| No key pressed | Re-play selection prompt; after **N retries (configurable, default 2)** fall back to the **campaign default language (default: Hindi)** and continue |
| Invalid key | "Invalid input" prompt, then re-play selection (counts toward retry limit) |
| Known language on record | Optionally **skip the menu** and play directly in the stored language, with a short "press 9 to change language" escape (config toggle per campaign) |
| Region hint from address | Pre-set the *default* language from the recipient's state/region so the fallback lands on the most likely language |

### 5.4 Data captured per call

Chosen language (or "defaulted"), DTMF path, retry count, plus all existing fields (confirm/flag outcome, recording id, timestamp, caller = IVR/agent).

---

## 6. IVR call-flow design (with language layer)

**Order Confirmation (pre-dispatch)**
```
Recording ON
  → Language select: "Hindi=1 / English=2"  (retry→default)
    → [chosen language] Greeting + "this call is recorded…"
    → Read address on record
       → Press 1 = address confirmed        → status: Address Confirmed
       → Press 2 = there is a change/problem → transfer to live agent
                                              (agent captures corrected address — human, not STT)
       → No input / invalid                 → retry → Unreachable (manual follow-up)
  → Close
```

**Delivery Confirmation / VOC (post-delivery)**
```
Recording ON
  → Language select: default = language from Order-Confirm call (press 9 to change)
    → [chosen language] Greeting + product name + expected delivery date
    → "Received on time, in good condition and running ok?"
       → Press 1 = received & OK  → status: Confirmed (VOC done)
       → Press 2 = any issue      → "our agent will connect you shortly" → transfer to agent → Issue Raised
       → No input / invalid       → retry → Unreachable
  → Close  → recording pulled into VOC vault
```

The language step is an added **first branch**; everything downstream in the base brief (DTMF confirm/flag, agent transfer, recording, status pipeline, VOC vault) is unchanged except that prompts are language-aware.

---

## 7. Functional requirements

| # | Requirement |
|---|---|
| F-1 | Play a bilingual language-selection prompt at the start of both IVR call types. |
| F-2 | Capture language via DTMF (1=Hindi, 2=English by default); map is configurable per campaign. |
| F-3 | Render all subsequent prompts of the call in the selected language. |
| F-4 | Support ≥2 languages now with the ability to add more per campaign without redesigning the flow. |
| F-5 | Retry the selection on no-input/invalid; fall back to campaign default language after N attempts. |
| F-6 | Persist chosen language on the recipient record; reuse as default on later calls; allow change. |
| F-7 | Optionally pre-set default language from recipient region/state. |
| F-8 | Record the full call including the language-selection step. |
| F-9 | Store language (+ defaulted flag) in the per-recipient timeline and in the VOC metadata. |
| F-10 | Surface language in the campaign dashboard and in the client export (per-recipient row). |
| F-11 | Manual/agent calls also log the language used, for consistent reporting. |
| F-12 | Admin can upload/manage per-language audio (or TTS text) for every prompt, per campaign. |

---

## 8. Data-model additions

- `recipient.preferred_language` (enum; nullable until first known)
- `recipient.language_source` (`recipient_selected` | `defaulted` | `region_inferred` | `agent_set`)
- `call_attempt.language` + `call_attempt.language_defaulted` (bool)
- `campaign.language_config` (ordered list of `{dtmf_key, language, audio_set_ref}` + `default_language` + `retry_limit` + `skip_menu_if_known` toggle)
- VOC metadata extended to include `language` alongside recipient/brand/campaign/product/attempt/caller/outcome/timestamp.

Keep language as **structured enum values**, not free text, so reporting and any Phase-2 AI agent can consume it directly.

---

## 9. Telephony provider — requirement checklist

Derived from the base brief **plus** this add-on, with STT de-scoped per Ritesh's note. The provider **must** support:

1. **Programmatic outbound calling** (API-triggered) for campaign batches.
2. **Visual/API IVR flow builder** with nested/multi-level menus (needed for the language branch → script branch).
3. **DTMF capture** (press 1 / 2 / 9) reliable on mobile.
4. **Multi-language prompts** — per-branch audio (pre-recorded upload) and/or multilingual TTS.
5. **Language-based routing** — route to the correct language sub-flow from the caller's DTMF selection.
6. **Call transfer to a live agent** on "press 2".
7. **Full-call recording** with **API/webhook-retrievable audio** (so we copy into our own VOC vault — never rely on the operator's retention).
8. **Status webhooks / callbacks** (queued, in-progress, completed, failed, busy, no-answer) for the pipeline and retries.
9. **Retry / scheduling / campaign** controls (attempts, callback windows, unreachable threshold).
10. **India compliance** — DLT/TRAI transactional calling, DND handling.
11. *(Nice-to-have, Phase-2 readiness)* real-time media streaming to plug in a conversational AI agent later.
12. *(Not required Phase 1)* built-in speech-to-text — de-scoped, since addresses are captured by agents.

---

## 10. Provider evaluation

### 10.1 Summary matrix

| Capability (from §9) | **Exotel** | **MyOperator** | **Ozonetel** |
|---|---|---|---|
| Programmatic outbound API | Strong, API-first | Available; API depth lighter | Strong |
| IVR builder + multi-level menus | Yes (App Bazaar, IVR Menu applet) | Yes (no-code) | Yes (no-code drag-and-drop) |
| DTMF capture (1/2/9) | Yes | Yes | Yes |
| Multi-language prompts | Yes (recorded audio / TTS; pairs with Sarvam TTS for Indian languages) | Yes — IVR menus in ~10 Indian languages | Yes — 11 regional languages |
| Language-based routing | Yes (menu → applet branch) | Yes | Yes |
| Agent transfer on press-2 | Yes | Yes | Yes |
| Recording + API-retrievable audio | Yes (RecordingUrl via API/passthru) | Recorded & cloud-stored; export/API depth to verify | Yes |
| Status webhooks/callbacks | Yes (StatusCallback, terminal events) | Available | Yes |
| Retry / scheduling / campaign | Yes (outbound campaign APIs) | Yes (voice broadcast: scheduling, retry, pacing) | Yes |
| India DLT/TRAI/DND | Yes | Yes | Yes |
| Built-in speech recognition | Via AgentStream streaming (external STT) | Limited / needs customisation | Yes (Speech API, ~92% accuracy) |
| Phase-2 conversational-AI readiness | Strong (AgentStream real-time media) | Weaker | Strong |
| Best-fit profile | API-first mid-market with DLT hand-holding | SMB, fast no-code setup | Full contact-centre / speech-first |

*Provider capabilities per each vendor's own documentation and independent 2026 comparisons; verify current pricing and exact API limits directly with the vendor during procurement.*

### 10.2 Reading of each provider

**Exotel.** India's largest cloud-telephony player with an explicitly API-first stack: programmatic outbound (`/calls/connect`), an IVR-menu applet for multi-level DTMF flows, `StatusCallback` webhooks with the exact call states our pipeline needs, recordings exposed as a retrievable `RecordingUrl` (so copying into our own VOC vault is clean), and DLT/DND compliance handling. Multilingual prompts are handled via recorded audio or TTS, and it integrates with Indian-language TTS engines (e.g. Sarvam) if we want natural Hindi/regional voices. Its AgentStream real-time media gives a clean runway to the Phase-2 conversational agent without switching providers. Independent teardowns note it doesn't do "built-in" AI STT — which we don't need in Phase 1.

**MyOperator.** Strong on speed-to-launch and no-code: cloud IVR with menus in ~10 Indian languages, voice-broadcast outbound campaigns with scheduling/retry/pacing, and automatic cloud call recording. The gaps for us: multiple independent reviews describe its **outbound-IVR depth, custom DTMF flow logic and developer/API control as limited or needing significant customisation**. For a workflow where we must *pull recordings into our own vault*, drive batches by API, and consume granular status webhooks, that API depth matters. Good fit if we prioritise a fast no-code rollout over programmatic control.

**Ozonetel.** A strong contact-centre platform: 11 regional languages, real DTMF + speech recognition, no-code flow builder, outbound campaigns, agent handoff and good APIs. It's arguably the best if we wanted built-in speech recognition — but since address STT is de-scoped, much of that strength is surplus, and its contact-centre bundle can feel over-built/expensive for our comparatively simple two-call flow.

**Others considered.** Plivo (engineering-led, cost-efficient at high outbound volume, but more DIY on DLT hand-holding), Knowlarity (established IVR, less API-modern), Twilio (global, strong APIs but weaker India DLT/local-voice fit and cost), and newer AI-first stacks (EnableX, Sarvam for TTS, Caller Digital for Phase-2 conversational). These are viable but none beats Exotel on the specific Phase-1 combination of *API control + recording retrieval + DLT compliance + Phase-2 path*.

### 10.3 Recommendation

**Primary: Exotel.** It satisfies every Phase-1 must-have, is the strongest on the two things our VOC model depends on — **retrievable recordings** and **granular status webhooks** — handles DLT/DND, makes the language menu a straightforward multi-level IVR branch, and keeps a no-switch path to the Phase-2 conversational agent via AgentStream. For Indian-language prompts, pair Exotel with pre-recorded audio (preferred for a defensible VOC) or a multilingual TTS such as Sarvam.

**Fast-track alternative: MyOperator**, if the priority is a no-code launch this quarter and the team accepts lighter API/recording-export control (validate recording-export API and outbound-DTMF flow depth in a paid pilot first).

**Choose Ozonetel** only if built-in speech recognition and heavier contact-centre features become in-scope again.

**Next step to lock it in:** run a 1-week paid pilot on Exotel with one real campaign — build the bilingual language menu, confirm DTMF on real mobile networks, verify recording pull into our vault via API, and confirm DLT template approval turnaround.

---

## 11. Provider configuration plan (Exotel, language IVR)

1. **Numbers & compliance:** provision ExoPhone(s); complete KYC; register DLT transactional templates/headers for the prompts in each language.
2. **Audio assets:** upload human-recorded prompts per language for every line (selection prompt, greeting+recording notice, address read-out / product+date read-out, confirm/flag options, transfer message, close). Fall back to TTS only where recording all variants isn't feasible.
3. **Call flow (App Bazaar):**
   - Greeting/Gather applet → **language IVR Menu** (`1=Hindi flow`, `2=English flow`, timeout/invalid → retry then default).
   - Under each language: the script applets (read-out → **IVR Menu** `1=confirm`, `2=connect-to-agent`) → Connect applet for transfer.
   - Passthru applet(s) to POST DTMF + language + outcome to our backend.
4. **Outbound trigger:** our backend calls the Connect/campaign API per recipient with `statuscallback` set to our webhook (subscribe to terminal + progress events).
5. **Recording:** enable recording on the flow; on call completion, read `RecordingUrl` from the callback/API and **copy the file into our VOC vault** with full metadata (recipient/brand/campaign/product/attempt/caller/DTMF/language/timestamp).
6. **Retries:** implement attempt count + callback scheduling in our backend off the call-status webhook; mark `Unreachable` after the configured threshold.
7. **Agent transfer:** Connect applet to the telecaller queue on press-2; log agent handling and (for Order Confirmation) the manually corrected address.

---

## 12. Non-functional requirements

- **VOC durability:** recordings copied to our own storage, retained **indefinitely**, retrievable on demand; never dependent on the operator's retention window.
- **Traceability:** every call attempt logged with language, DTMF, outcome, timestamp, caller.
- **Compliance:** transactional calling within TRAI/DND norms; DLT-registered content per language.
- **Scale:** support campaign-burst outbound concurrency for a full order's recipient list.
- **Configurability:** language map, retry limits, default language and audio sets settable per campaign without code changes.

---

## 13. Open questions / decisions needed

1. **First-order languages** — confirmed set beyond Hindi/English for the first campaign's dealer regions (drives which audio to record). *(Ties to base-brief open question on languages.)*
2. **Skip-menu-if-known** — do we skip the language menu on repeat calls when a language is already on record (with press-9 to change), or always ask?
3. **Default language** — Hindi as the global fallback, or set per campaign from the order's region?
4. **Retry policy** — attempts and window before "unreachable" (also a base-brief open question) — applies to the language step too.
5. **Provider pilot sign-off** — approve the Exotel pilot, or evaluate MyOperator in parallel?
6. **Recorded audio vs TTS** — budget/time for professional recordings per language vs multilingual TTS for the VOC.

---

## 14. Phasing

- **Phase 1 (this PRD):** bilingual (Hindi/English) DTMF language selection on both IVR calls, per-campaign config, language stored + reported, Exotel configured, recordings pulled to VOC vault. Addresses handled by agents.
- **Phase 1.x:** enable additional regional languages per campaign as orders require.
- **Phase 2:** conversational AI voice agent (natural-language language handling and free-form responses) on the same telephony provider; courier API auto-tracking.
