# Finn's — Realism Audit (for developers)

> Source-of-truth list of every place this prototype shows behavior that a real Finn's procurement operation would not survive. Use this as a spec for future production work.

**Status: 2026-05-16**
**Total flags: 95 across the 8 pages (re-audited against the Finn's 8-page model)**

---

## How to use this doc

This prototype is a **demo and UX/flow reference** for Finn's Beach Club (Bali) procurement — a single buyer running 4 venues (Beach Club, Recreation Club, Stake, Splash Waterpark). It is not production-bound. But because the prototype will be referenced by anyone who later builds the real system, **misleading UI surfaces, missing flow states, and one-click instant success on async actions will calcify into missing features unless explicitly built around them.**

The audit categorises every flag as:

- **Acceptable** (not flagged): mocked data, hardcoded seed values, arbitrary numeric defaults. These can stay.
- **Not acceptable** (flagged): missing inbound events from external actors (vendors, banks, regulators, carriers), async actions modeled as instant success, missing config/settings/audit surfaces, misleading copy, downstream-state booleans with no UI representing what flips them, missing failure/empty/error states, single-currency-where-imports-exist assumptions, missing role separation between Procurement Manager and Staff, missing venue-aware behaviour.

Each flag below carries the page area and a fix shape. File paths are approximate — the codebase is mid-restructure to match the 8-page model, so paths will shift.

---

## What's no longer in scope (and why)

The original Buyamia audit had 138 flags across a 13-page platform. The following entire categories were dropped when scoping down to Finn's:

| Removed audit area | Reason |
|--------------------|--------|
| Nerve Center (40-agent control room) | Cut from platform. No longer applicable. |
| Global Operations | Cut. Finn's is single-region (Bali). |
| Intelligence / Transformation (TM-01…TM-08) | Cut. Some KPIs absorbed into Overview + Spending. |
| Infrastructure (DAG kernel, deployment queue, payment rail connector, tamper seals) | Cut. Platform-vendor scaffolding, not customer surface. |
| Decision Attribution Trail (12-stage full-screen modal + cross-page chips) | Cut. Audit lineage lives inline on event cards in Activity & Governance. |
| Control planes (CP-POL / CP-ECO / CP-TRU / CP-SIM) | Replaced with a flat policy rule list. |
| Group Buy pool + Capex/Production/Maintenance/Blanket PO/Emergency playbooks | Cut. Reduced to 3 playbooks: Standard / Rush / Recurring. |
| Multi-tenant / multi-region / multi-currency-equally architecture | Out of scope. Finn's is single-tenant. IDR primary; USD only for imports. |

These cuts retire ~50 flags from the original audit. The other ~88 were re-audited against the new model — some still apply, some changed shape, some were folded into the cross-cutting patterns. New venue-specific flags were added.

---

## The 10 cross-cutting patterns

Fixing the patterns clears most of the per-page list. Prioritise these over individual flags.

### 1. Sovereign / async actions modeled as one-click instant success
**Most damaging pattern in the codebase. Touches every page.**

Examples in Finn's: Approve PO (Orders), Confirm Delivery (Orders), Pause / Suspend Agent (Activity & Governance), Commit Savings (Spending), Renegotiate (Suppliers), Approve Today's Ledger (Activity & Governance), Harden Policy as Precedent (Activity & Governance), Adjust Stock (Inventory), Set as Par Floor (Inventory), Override Decision (Activity & Governance), Send Broadcast (Suppliers).

**Production design (one shape for all):** every async action transitions through `requested → in_flight → confirmed | partial | rejected | fee_applied`, with the in-flight state visible on the page, a cancel affordance, and an `AuditEvent` on every transition. Pick one canonical case (recommend Approve PO) and model it end-to-end first, then propagate.

### 2. No role separation between Procurement Manager and Staff
Finn's persona model declares two roles (Procurement Manager primary + Procurement/Inventory Staff) but the prototype treats them identically. Anyone with the page open can do anything: commit savings of any size, suspend an agent, harden a policy, override decisions, sign the daily ledger.

**Production design:** user context with `role: 'manager' | 'staff'`; role pill in header; per-action role gates; "Requires: Procurement Manager" tooltips on disabled buttons; segregation-of-duties enforced (e.g. staff can raise a request but cannot approve their own; cannot harden policy; cannot sign daily ledger close).

### 3. No real audit / event log — most "ledgers" are render-time synthesis
The Activity & Governance feed has no signatures, no hash chain, no retention banner. Override stack is absent — there is no way to see "this decision was overridden 3 times by this user across the last quarter". Atlas chat history auto-clears with no retention.

**Production design:** append-only `AuditEvent` store with `{actor, role, timestamp, signature, prevHash, evidenceRef, venue}`. Activity & Governance feed renders the store; it does not synthesise from a render-time blueprint. Override stack is queryable and replayable.

### 4. External actors (vendor, bank, carrier) missing as event sources
Vendor never appears as an actor anywhere. No `po_received_at_vendor`, `pick_started`, `partial_quantity_offered`, `vendor_rejected_with_reason`. Payment rail confirmations (BCA Virtual Account / SWIFT for imports) absent. Carrier cold-chain breach events absent (Stage 5 Delivered & Checked auto-passes QC with no quarantine path). WhatsApp / Telegram delivery / read receipts absent on Source Bridge.

**Production design:** inbound event types per external actor, rendered as nested timeline rows beneath the agentStep on the relevant card. A "Vendor portal pending" empty state. A "Vendor Portal Status" surface on every supplier card. Source Bridge messages carry `sent → delivered → read → replied → bounced` state machine.

### 5. Agent/AI copy promises behaviour the prototype has no surface for
**Most dangerous category for a developer reading this as a spec.** Atlas messages frequently reference policy envelopes, learned preferences, switch thresholds, savings projections that the data model has no representation for. Examples:
- *"Sourcing Agent (A-01) auto-switches suppliers when the gap exceeds 5% with ≥95% quality parity"* — no policy envelope surface to verify or edit.
- *"Spend Watchdog (A-04) noted the override pattern; future switches will be surfaced for your review"* — no learned-preference history.
- *"Restock Agent (A-02) recommends Rush playbook because par floor breach in 2.3 days"* — no forecast confidence breakdown.

**Production design:** for every piece of agent narrative, either build the surface it references (Agent Policies under Activity & Governance), or rewrite to measured, source-attributed language. Audit Atlas/agent responses against "does this surface exist?" before shipping.

### 6. Single-warehouse / venue-aware behaviour decorative-only
Finn's runs 4 venues but the prototype treats inventory and orders as a single pool with venue *labels*. No per-venue receiving windows, no per-venue stockouts (only global), no per-venue par levels, no inter-venue transfer, no venue-specific approver routing, no Stake-specific quality grade requirement (Stake is fine dining and needs different sourcing tier than Splash QSR).

**Production design:** per-venue `Stock` records with `{onHand, par, parFloor, receivingWindow, qualityTier}`. Inter-venue transfer lifecycle. Per-venue approver chain (e.g. Stake POs > Rp 25M routed to F&B Director). Per-venue spend authority limits. Per-SKU venue-tier configuration (e.g. yellowfin tuna must be sashimi-grade for ST, food-grade is fine for BC / SP).

### 7. Compliance / finance / regulatory surfaces collapsed
No three-way match anywhere (PO ↔ GR ↔ Invoice). No payment-run lifecycle. No fiscal calendar / period close. No GL coding / chart-of-accounts. No PPN (Indonesian VAT) line items. No spend-authority limits. No compliance-doc expiry (HACCP, halal, USDA/AQIS for imported beef, insurance, NIB, NPWP for vendors). No PT-PT transaction tax. No invoice-mismatch / credit-memo flow. No FX-lock on USD imports (wine, beef).

**Production design:** these aren't UI polish — they're missing first-class entities. `Invoice`, `GoodsReceipt`, `PaymentRun`, `BudgetPeriod`, `TaxLine` (PPN-aware), `ComplianceDoc`, `Dispute`, `CreditMemo`, `FxLock` need to exist with their own lifecycles before the UI can represent them.

### 8. AI provenance / explainability missing
Every numeric AI claim renders as fact: `96% confidence`, trust score `58`, `+4.2%`, `Rp 4.2M saved`, `94 reliability`. No model version, no features used, no data window, no weights, no last-refresh, no drift detection, no model-degraded banner, no learning-phase / cold-start handling (despite the Activity & Governance Learning Phase banner that fires when events < 25 — there's no surface explaining what the system is learning), no human-in-the-loop feedback capture beyond the `editedDataPoints` inline edit.

**Production design:** reusable provenance modal per recommendation (`agent v3.4.1`, features + weights, data window, confidence, "Was this right?" thumbs). Status enum per metric: `healthy | degraded | drift-detected | learning | stale`.

### 9. No system-health / ops-readiness surfaces
Overview has no agent health, no data-freshness, no model-degraded banner. Activity & Governance Agents tab shows pulse dots and "tasks completed today" but no heartbeat lag, queue depth, error rate, last successful action timestamp. No integration health panel for the POS feed (Finn's POS sources daily consumption), bank rails (BCA / SWIFT), or supplier WhatsApp gateway. No observability deep-links.

**Production design:** System Health strip on Overview ("Sourcing 1/1 · Restock 1/1 · POS feed 12s old · WhatsApp gateway healthy"). Per-agent health detail sheet in the Activity & Governance Agents tab. Integrations panel with last-sync / error-rate / auth-expired / "Test" / "Rotate credential" / "Reconnect" actions.

### 10. Failure / empty / error states absent on success-only flows
Every page assumes the click succeeds. No network error, no permission denied, no conflict, no stale-data, no vendor unreachable, no payment failed, no QC fail (Stage 5 has a `qcOutcome: 'fail'` data shape but the only UI for it is an amber banner pushed to Suppliers via data edge — no on-Orders resolution flow), no period-close lockdown, no over-budget rejection.

**Production design:** error envelopes on every action (`{ kind: 'idle' | 'pending' | 'success' | 'network_error' | 'stale' | 'permission_denied' | 'conflict' }`); inline error pill with retry/refresh; empty states for cold-start situations.

### 11. Manual baseline incomplete — operator can't drive without an agent in the loop
**The hidden cost of an agent-first prototype.** Every page was built assuming agents are the default actor; manual flows exist as escape hatches (per-entity labor mode, Manual Takeover) but the **default** UI surfaces, copy, attributions, and action receipts all assume autonomous agent involvement. With the 3-mode Autonomy switch (`Off` / `Assist` / `Auto`, see `PLATFORM-MAP.md § 3a`), this becomes a first-class problem: in `Off` mode the system must work without any A-01..A-05 participation, only Atlas (chat copilot, never gated) and the sensing layer (warnings, alerts, watch-lists, ETA tracking — always on).

**The audit lives in `core-pages.md` as a "Mode-Awareness · Manual Baseline Audit" subsection at the end of each page section** (§ 1.13 Orders, § 2.7 Overview, § 3.11 Inventory, § 4.7 New Request, § 5.16 Suppliers, § 6.9 Spending, § 7.13 Activity & Governance, § 8.8 Workflows). Per-page gaps + proposed fix shapes are documented there in full.

**Cross-cutting fix shapes** (build once, reused across pages):
- **Unified Action Log** — single store, `actorType: 'agent' | 'admin' | 'system'`, fed by every mutating action. Consumed by Activity Feed (canonical) + every other page's "Recent activity" / "Action Log" surface with appropriate filters. **Foundation for the manual baseline.**
- **Mode-aware CTA component** — wraps action buttons; renders "Auto-execute queued" / "Suggested · Approve | Defer | Decline" / "Manual review" copy based on `useAutonomyMode()`. Same component on Overview's Triage Queue cards, Inventory's Critical SKU cards, Orders' Approve & Execute, Spending's Lock Savings, etc.
- **Mode-aware Reasoning Chain renderer** — when `event.actorType === 'admin'`, render User identity card; when `'agent'`, render Agent identity card. Same shape, different actor.
- **`assignedAgent` becomes optional** on `Order` / `FinnsSKU` / `FinnsSupplier` interfaces — allows `null` for self-managed entities. Chip hides when null OR when mode is Off.
- **`handleSubmit` patterns read `useAutonomyMode()` + `defaultLaborMode()`** — new POs / restock requests / vendor onboardings created in Off/Assist land with `laborMode: 'manual'`.
- **`finns-qc-failure` event dispatch parity** — the manual Stage-5-fail path on Orders must fire the same CustomEvent as the agent path, so Suppliers' QC Alerts banner lands consistently in all modes.

**Concrete missing manual surfaces** that the audit surfaces:
1. ~~**Vendor Onboarding mini-wizard**~~ — **shipped in Phase 4i** (`VendorOnboardingModal.tsx`). 4 steps: Lead → KYC → Banking → First-PO terms. Triggered from the existing "Onboard New Vendor" CTA on Suppliers (which previously redirected to New Request — the wrong page). Submission logs `kind: 'vendor-onboard'` with full draft as meta. Still pending: actual append to the live directory (4i.2), KYC document upload (mocked as text fields today), per-vendor "review queue" page that admins use to approve onboarded vendors before first PO.
2. ~~**Multi-vendor RFQ Composer** modal~~ — **shipped in Phase 4h** + **4h.2 (tracker + simulated quote ingestion + Award)**. `RFQComposerModal.tsx` + `RFQTrackerModal.tsx` + `lib/rfqStore.ts`. Composer triggers from the New Request header; tracker sits behind a "Your RFQs" button next to it with a live count badge. Submission persists an RFQ to localStorage and schedules per-vendor `setTimeout` callbacks (5–15s) that emit `rfq-quote-received` action log entries with mocked-but-plausible quote totals + lead-time variance. 15% no-bid rate. Tracker shows status (Awaiting / Partial / Received / Awarded / Cancelled), highlights the lowest bid, and an Award button per quote that calls `awardRFQ` → emits `rfq-award` + a synthesised `po-create` action log entry. Still pending (4h.3): real PO creation in NewOrdersPage, awarded-vendor → directory write-back, trigger duplicates on Orders/Suppliers.
3. ~~**"Add Manual Saving" entry**~~ — **shipped in Phase 4j**. Inline form on the Spending Category Detail page (toggled from a button in the Decision Ledger header). Amount + supplier + action + optional invoice ref; on submit prepends to the visible ledger and emits `kind: 'savings-manual-add'` to the action log. Local state (`manualEntries`) — survives within the session but doesn't persist across reloads beyond the action log entry itself.
4. ~~**Renegotiation Workspace**~~ — **shipped in Phase 4k** (`RenegotiationModal.tsx`). 5-step lean modal: Prep brief (current terms / target / walk-away) → Opening offer → Counter rounds (add as many as needed, vendor / you authoring) → Red-line summary → Sign. Replaces the one-click confetti CTA. Submission logs `kind: 'vendor-renegotiate'` with the full transcript (prep, opening, all rounds, final terms) as meta — durable audit record. Still pending (4k.2): per-vendor persistence across sessions, directory sync that actually updates the vendor's contract terms.
5. ~~**Tabbed Activity & Governance left panel**~~ — **shipped in Phase 4d**. Left panel now has 4 tabs: Activity (existing Control Plane content) · Agents (5-agent roster + suspend/resume) · Policy (rule list + edit/disable toggles, stubbed) · Disputes (open + escalated, with Approve / Reject / Escalate actions). Tab strip surfaces counts (5 agents · 3 rules · open dispute count). Full Rule Composer + dispute resolution flows stubbed as toasts — those land in follow-up phases.
6. ~~**Manual-mode "Notes" surface**~~ — **shipped in Phase 4l**. New `src/lib/entityNotes.ts` store (localStorage map keyed by `${type}:${id}`) + `ManualNotes.tsx` component (textarea + Save/Cancel + relative-time last-edited label). Wired into the right panels of Orders (selected PO), Inventory (selected SKU), and Suppliers (full workspace). Every save emits an `entity-note-edit` action log entry as an audit row; the note body itself lives in the dedicated store, not the action log. Available in every Autonomy mode — admins can drop a note whenever they want.

---

## Per-page flags

### Overview (5 flags) — `OverviewPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | KPIs unsourced, unexplainable, frozen | No "as of" timestamp, no source attribution, no click-through | "as of HH:MM" + fiscal-period selector; click-through to Activity & Governance event filtered by what drove the metric |
| 2 | Quick Approve is instant success | Critical-action card collapses approval into one click with saving toast | `pending-vendor-ack` state with price-lock countdown; `confirmed | partial | vendor-rejected | price-expired` branches; approved PO sits in "awaiting confirmation" bin |
| 3 | Clear Deadline collapses payment + compliance + delivery into one animation | Each has wildly different real lifecycles; failure branches missing | Per-event-type handlers: payment → `queued → BCA-ack → cleared\|bounced`; compliance → `submitted → regulator-pending → accepted\|rejected`; delivery → `arrived → QC-pass\|QC-fail → received` |
| 4 | No system health surface | Atlas Live Agent Activity rotates regardless of actual state | System Health strip with per-agent pulse, POS feed freshness, WhatsApp gateway status |
| 5 | Single-timezone / single-locale baked in | `Asia/Makassar` (Bali) is correct for venues but no per-vendor timezone (Australian beef supplier is `Australia/Melbourne`) | Per-event-source timezone; surface in event detail |

### Inventory (12 flags) — `NewInventoryPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | `onHand` is a single integer per SKU | No reserved / available / in-transit / quarantined split; ATP not computed | `Stock { physical, reserved, inTransit, quarantined, expired }` per **venue**; Available-to-Promise drives Restock Agent watch |
| 2 | No batch / lot / expiry tracking | Yellowfin / beef / prawns / dairy are perishables; Adjust Stock writes one number | Per-SKU `Batch[]` per venue; Adjust Stock per-batch; "Writeoff expired" / "Quarantine batch X" actions |
| 3 | Venue tagging decorative — no per-venue par or burn-rate | SKU `venues: [BC, ST]` means "both can consume" but no per-venue thresholds | Per-venue `{par, parFloor, burnRate, onHand}`. Restock Agent should recommend per-venue restocks. |
| 4 | No inter-venue transfer surface | Beach Club has surplus prawns, Stake is out — no way to model the transfer | `Transfer { from: venue, to: venue, sku, qty, requestedBy, approvedBy, completedAt }` with lifecycle |
| 5 | Stock-take / cycle-count variance invisible | Manual count overwrites seeded `onHand`; no variance log, no shrinkage tracking | `CycleCount[]` history per venue with `{counted, expected, variance, reason, approvedBy}`; aggregate shrinkage % per venue |
| 6 | `daysRemaining`, `dailyBurn` are static numbers | No confidence interval, no recompute on burn change, `velocityData` is `Math.random()` (jitters between renders) | `burnModel { weekday, weekend, season, eventCalendar, confidence, basedOnDays }`; persist `velocityData` as real time-series |
| 7 | Pipeline bundling has no commit / lock / approval flow | `handleAddToDraft` instantly appends; no `Draft.lockState`; no audit entry | `Draft.lockState: editable | awaiting_vendor_quote | sent_to_vendor | frozen`; per-add/remove `AuditEvent` |
| 8 | No supplier-side state on incoming SKUs | Stage 5 auto-increments `onHand` on QC pass; no `pending_receipt` per batch, no cold-chain breach event | Stage 5 creates `pending_receipt` batch → quarantine → QC → `available`. Per-venue receiving. |
| 9 | "Set as Par Floor" has no policy / sign-off / expiry | Anyone can lock par at 0 with no approval, no expiry | Reason code + optional expiry + role check (Manager only) + `ParOverrideEvent` |
| 10 | Failed-stage card has no real resolution UI | "Call Supplier" / "Retry Agent" wired to toasts in the upstream demo pass | Real `RetryHistory[]` (attempt, channel — WhatsApp/Telegram/phone, outcome, nextRetryAt); auto-switch-to-backup requires Manager sign-off |
| 11 | Failed inbound webhook half-modeled | `finns-restock-intent-failed` carries no reason | Add `reason: user_dismissed | budget_exceeded | approver_rejected | vendor_unreachable`; render reason + remediation |
| 12 | Catalog modal: no validation / de-dupe / archive impact | Add SKU has no uniqueness check; Archive is soft delete with no audit | Archive queries open POs/reservations; requires reassignment; appends `CatalogEvent` |

### New Request (10 flags) — `RequestPanel.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | 5-step wizard still skips RFQ → quote → negotiate → award flow | Step 2 "Vendors" presents pre-selected vendors with no quote collection cycle | Insert Step 2.5 (Quote Collection) and Step 2.7 (Bid Comparison & Award); PO only mints after Award. Skip these for `WF-RSH` and `WF-REC`. |
| 2 | "Authorize" instant success; hardcoded PO id | `handleSubmit` shows toast + sets step 5 + redirects; no approver routing | `pending_approval → routed_to → approved | rejected | held`; real sequence service for PO id |
| 3 | No `RequestDraft` persistence | "Save Draft" wired to sessionStorage but no server-side, no owner, no lock | Real `RequestDraft` with owner, lock-by, lock-expires-at, version; optimistic concurrency |
| 4 | No vendor / supplier portal handshake | Vendor list has no `portalState` (onboarded, lastResponded, currentRFQs, declineRate, credentialExpiry) | Per-vendor `portalState`; expired creds block selection until re-verify |
| 5 | URL-hash deep-link prefill has no validation, no error surface | SKU might be archived / vendor delisted / source PO cancelled | Validate each param vs current source-of-truth; render error banner with safe fallback |
| 6 | Budget / spend pulse is cosmetic | `monthlyBudget`/`spentSoFar` hardcoded; no per-category / per-venue budget; no budget-owner approver for over-budget | Pull from `BudgetService { category, venue, period, allocated, committed, spent, available, owner }`; over-budget routes to Procurement Manager queue |
| 7 | Logistics Risk Map hardcoded copy | Java monsoon / Tanjung Priok / Bali-local clear are string literals; not pinned to PO at authorize-time for audit | `LogisticsRisk[]` records `{id, region, kind, validFrom, validUntil, source, confidence}`; pin to PO at authorize |
| 8 | Workflow selection (Standard / Rush / Recurring) implicit only | Wizard infers playbook from `urgency` field; no per-tenant config of when Rush is allowed | Lift playbook selection into per-tenant policy; surface "This will run as Rush because par breached" with override path |
| 9 | No contract terms / payment terms / incoterm capture | Despite handling imports (wine, beef) | Step 3.5 captures `ContractTerms`; pre-fill from vendor's master agreement; incoterm matters for USD imports |
| 10 | No FX-lock or multi-currency line items on imports | Bare IDR; USD-priced imports converted at render time | Per-line `currency`; FX lock at quote time; render both currencies on review step |

### Orders (12 flags) — `NewOrdersPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | No PO sub-state between buyer-ack and vendor-action | `stage: 1..5` has no `submitted → vendor_received → acknowledged → confirmed → partial_confirmed → rejected` | Replace with `stage: { num, subState }`; render sub-state on OrderCard and 5-stage DAG |
| 2 | Vendor-side inbound events absent | Stage 2 "Quote / Vendor Confirmed" has only one agentStep; no `po_received_at_vendor`, `vendor_clicked_acknowledge`, `partial_quantity_offered`, etc. | Add `VendorEvent` type; render as nested timeline rows beneath agentStep |
| 3 | "Approve & Execute" is one-click instant success | `executeAction` flips stage + posts saving toast synchronously | Approve transitions to `submitted_awaiting_ack`; show inbound event "PT Bali Seafood acknowledged at 14:14" or "partial-confirmed (90% / +2d lead)" |
| 4 | "Confirm Delivery" no rejection / partial / damaged branch | Stage 5 QC pass auto-increments inventory; QC fail dispatches a data edge to Suppliers but has no resolution UI on Orders | Per-line receipt modal: condition radio + photo upload + receiving venue staff name; emits `GoodsReceipt` event; routes failures to dispute |
| 5 | Rollback / cancel a submitted PO missing entirely | No `cancellation_requested → vendor_ack → confirmed \| fee_applied \| rejected_already_shipped` lifecycle | "Cancel PO" action on live orders pre-Stage 4 + Rollback Modal with vendor-specific terms |
| 6 | Per-vendor policy / per-venue config / per-category override surfaces missing | `requiresHumanAuthorization` likely hardcoded globally | Settings/Policy surface exposing per-tenant HITL gate config, per-vendor terms, per-category approvers, per-venue thresholds |
| 7 | No role-based approval gating | Anyone can approve any PO regardless of amount | Role context + spend-authority limits (Manager Rp 100M, Staff Rp 10M); pending-approver name on order card; above-limit routes to Manager queue |
| 8 | Multi-venue PO has no per-venue receiving | Multi-venue PO (e.g. BC+ST split) marks Stage 5 complete with one click; reality is separate receiving at each venue at different times | Stage 5 splits per-venue with individual QC outcomes; PO completes only when all venues confirm |
| 9 | Stage failures are decorative | `failureReason` is free-text; "Resolve Issue" just re-runs same action | `StageFailure` type with `{stageIdx, reason, retryCount, escalatedTo, resolution}`; retry/escalate/swap-supplier branches |
| 10 | Network / permission / stale-data error states absent | Every click assumes success | Error envelopes `{ kind: idle \| pending \| success \| network_error \| stale \| permission_denied \| conflict }` |
| 11 | Recurring (WF-REC) drafts fire without forward-state | No "skipped: budget exhausted" / "skipped: venue closed for renovation" / "previous cycle awaiting close-out" history | `cadenceHistory` with per-cycle outcome; calendar-aware "next run" with skip-this-cycle |
| 12 | Source Bridge messages have no delivery states | WhatsApp / Telegram panel has no `sent → delivered → read → replied` lifecycle | Per-message state machine + bounce/queue/retry; reply thread inline in timeline |

### Suppliers (12 flags) — `SuppliersPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | Onboarding lifecycle is admin-only data entry | No `invited → vendor_accepted → portal_logged_in → kyc_submitted → docs_uploaded_by_vendor → verifier_reviewed → certified` | Per-stage inbound-event sub-timeline; "Vendor Portal Status" surface on supplier card |
| 2 | `journeyStage` is a single integer | No actor / role / evidence / approver / signature / timestamp on stage advance | Immutable `{stageFromTo, actor, role, timestamp, evidence_doc_id, approver_id}`; "Compliance Trail" tab |
| 3 | KYC, sanctions, banking modeled as checkboxes | No re-screening schedule; no micro-deposit verification flow | State machines: `screening_in_progress → matched → cleared (re-screen Q)`; `bank_verification: awaiting_micro_deposit → verified → failed` |
| 4 | No document expiry tracking | NIB, NPWP, halal cert, HACCP, USDA/AQIS (for imported beef from AUS), insurance, ISO — all expiring docs absent | `compliance_docs[]` with `{type, doc_id, issued, expires, status}`; expiring auto-flips to Watchlist; expired blocks POs |
| 5 | Contract = single `contractExpiresIn: number` | No renewal-in-progress lifecycle | `RenewalDeal` object with `renewal_window_open → drafted → vendor_responded → counter_round_N → signed_buyer → signed_vendor → effective` |
| 6 | Performance score has no source visibility | `score: 94` is ground truth; no methodology, weighting, time window | "Score Methodology" drawer + per-order contribution + last-recomputed timestamp + audit trail of formula changes |
| 7 | Disputes are a row-status tag, not a workflow | No `Dispute` entity with `{reason, vendor_response, evidence[], credit_memo, resolution_owner, sla_clock, closed_by}` | Click `disputed` row opens Dispute Workspace + state machine + SLA clock + credit-memo |
| 8 | No alternate-supplier / single-source-risk mapping | "Sourcing Agent has pre-qualified 2 alternatives" is narrative text | "Coverage Map" view: rows = categories × venues, columns = vendor count by tier; single-source highlighted; per-supplier `is_only_source_for_skus[]` |
| 9 | "Initiate Renegotiation" → no real renegotiation workspace | Burst animation says "Renegotiation Initiated" but there's no surface to track rounds | `RenegotiationDeal` workspace: opening position, vendor responses, rounds, red-line, signed amendment; "Hardened" grade flips only on signed amendment |
| 10 | Broadcast send is fire-and-forget | No per-recipient `sent → delivered → read → replied → bounced` | Broadcast record with per-recipient state + bounce reason |
| 11 | QC failure alert lacks workflow back to vendor | Dismiss-X only; no surface to take action | Three actions: Open Dispute / Hold Next PO / Adjust Score (gated to Manager) |
| 12 | "Onboard New Vendor" routes to unrelated New Request page | Misleading CTA — currently routes to wizard with no vendor-onboarding step | Build vendor self-service intake portal OR a dedicated 4-step onboarding wizard (Lead → KYC docs → Banking → First-PO terms) |

### Spending (10 flags) — `SpendingPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | No three-way match anywhere | No `Invoice` entity, no `GoodsReceipt`, no variance | Real `Invoice` entity: `{po_ref, gr_ref, invoice_num, vendor_invoice_date, match_state, variance_qty, variance_price, ap_status}`; click opens three-way comparison grid |
| 2 | No payment-run lifecycle | No `scheduled → approved → released → in_flight (BCA/SWIFT) → cleared → reconciled`; no FX-lock for USD imports | Payments tab: scheduled runs, per-payment state, bank confirmation, retry on failure, FX rate locked-on-date |
| 3 | "Lock Savings" is one-click confetti | Button sets a Set entry + confetti; no vendor confirmation, no `actual_savings` vs `projected_savings` | `SavingsCommitment`: `proposed → renegotiation_request_sent → vendor_response → terms_agreed → first_PO_at_new_price → realized_savings_tracking_started` |
| 4 | No budget vs commit vs accrual vs actual | Just `spend` vs `budget`; no per-venue split in the data model | Add `committed`, `accrued`, `paid`, `forecast_end_of_period` per category × venue; four-band stacked bar |
| 5 | No fiscal calendar / period close | Months are calendar months; no `period_closed`, no late-post review | `period_status: open \| closing \| closed \| reopened`; close timer; late-post review queue |
| 6 | IDR-primary but no FX surface for USD imports | Wine, AUS beef, some dairy come in USD — converted at render time with no rate-as-of | `currency` per entry; `fx_rate_used`, `fx_rate_as_of`; "FX Exposure by Currency" widget; separate drift-from-FX vs drift-from-price |
| 7 | No tax / PPN (Indonesian VAT) / GST / withholding | Zero hits in file | `tax_breakdown {jurisdiction, rate, amount, recoverable}` per entry; "Show Net / Show Gross" toggle; PPN aware on Indonesian vendors |
| 8 | No invoice-mismatch / dispute / credit-memo flow | No `dispute_open`, `credit_memo`, `chargeback`, `short_pay` states | "Invoice Exceptions" view + dispute records (cross-page join with Suppliers Dispute Workspace) |
| 9 | Budget setup modal has no version history / approval / effective-date | "Save Budgets" instant + anonymous | `budget_version[]` history with effective_date + approver; require Manager role for changes; per-venue budgets surface |
| 10 | No role / spend-authority on financial actions | Anyone can change budgets, commit savings, override agent | Gate by role + amount tier; "You are signed in as: Staff (limit Rp 10M)" badge; above-limit routes to Manager |

### Activity & Governance (14 flags) — `governance/*.tsx` + `AIActivityPage.tsx`

The merged page absorbs the original AI Activity + Governance audit. Many flags collapse since the control-plane and Decision Attribution Trail concepts are gone.

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | Activity feed has no signing / hash chain / retention | No `signature`, `prevHash`, `sealed_at` per event | Append-only `AuditEvent` store; per-row signature/hash chip; "sealed at" header; signed CSV export; retention policy footer |
| 2 | Override is instant boolean | No reason capture, no co-sign for high-value, no un-override path | Modal with mandatory reason + co-sign-required-if-Manager-only (e.g. spend > Rp 50M); row shows attribution; override stack viewable per decision |
| 3 | Dispute lifecycle collapsed | No assignment, no evidence area, no appeal window | Full `open → assigned → evidence-gathering → ruling → closed → appeal`; assign-to selector, evidence area, ruling text, appeal window |
| 4 | "Harden Policy — Set as Precedent" is instant boolean | No preview of downstream effect, no expiry/sunset, no rollback | Modal: scope selector + impact preview vs last 30 days + sunset selector (30/90/365/permanent) + Manager sign-off; "Standing Precedents" panel with rollback |
| 5 | Policy creation has no preview / diff / shadow-mode / two-person | Create Rule pure dismiss | New-rule wizard: draft → impact preview vs last 30 days → shadow-run N days → Manager ratification → enacted; every transition logged |
| 6 | Suspend Agent has no parked-task UI | Suspending A-01 mid-RFQ leaves the in-flight RFQ orphaned with no surface | Build the Parked Task Queue: per-agent tasks paused on suspension, original prompt, draft action, Resume / Reassign / Cancel; audit trail |
| 7 | No agent versioning / change-management | Agents referenced by ID with no version, no timeline, no rollback, no canary | Per-agent version pill + change-history modal (rev, deployed-by, deployed-at, rollback) |
| 8 | Hard-60 undo window is wall-clock, not vendor-state | No vendor events (`po_received`, `acknowledged`, `pick_started`, `staged`, `dispatched`) in feed; Hard-60 doesn't react to anything | Add vendor-side events as event types in feed; show undo window responding to them |
| 9 | No per-vendor cancellation policy | Vendor's own cancellation terms invisible | Surface vendor policy on event card and in Rollback modal |
| 10 | Ledger close = single boolean per day | No audit log surface for closes (who/when/scope) | `LedgerClose { id, approvedBy, approvedAt, eventIdsInScope, signature }` appended to immutable log; "Ledger close history" link |
| 11 | Rollback is instant success | No `requested → vendor_ack → confirmed/partial/rejected/fee_applied` lifecycle | Rollback Modal needs intermediate "awaiting vendor confirmation" state and rejection/partial branches |
| 12 | "Fix & Re-run" can double-fire | If external side effects exist, re-run duplicates them | Gate behind `rollbackable && externalSideEffects.reverted`; warning state otherwise |
| 13 | Confidence has no provenance UI | No "how was 96% computed" surface | "Explain confidence" expansion: model version, features, score breakdown |
| 14 | Tour storage keys not namespaced | `finns-activity-tour-seen` is global; multi-user staff terminal breaks | Namespace `finns:${userId}:tour-seen:${page}` |

### Workflows (3 flags) — `workflows/WorkflowsPage.tsx`

The Workflows page is reference-only — read-only flow paths for the 3 playbooks. Most upstream Buyamia Workflows flags (tune logic, simulation, hard-lock) are dropped because the surfaces no longer exist.

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | "Active orders" count is render-time, not subscribed | The number shown for each playbook is derived from a snapshot, doesn't update if Orders changes | Live subscribe to Orders state; update via event bus |
| 2 | Playbook stage descriptions hardcoded | Plain-English text per stage is a string literal; no link to actual policy that enforces it | Each stage description should link to the policy rule(s) that govern its behaviour (e.g. WF-RSH Stage 2 → "skips RFQ" → links to the policy that defines "skip RFQ when urgency=urgent") |
| 3 | No recurring schedule editor for WF-REC | Recurring orders run on a schedule the user can't see or edit; appears in Orders as "next run: …" with no way to pause / resume / change cadence | Per-recurring-pattern editor: cadence, skip-this-cycle, change-vendor, pause/resume — needs role gate (Manager only) |

---

## Recommended fix order (post-demo)

By leverage × ship-risk for the Finn's scope:

1. **Pattern 1 (async lifecycles)** — model one canonical case end-to-end (Approve PO), then propagate. Highest leverage. Use multi-venue PO as the canonical case to surface the venue-aware lifecycle (#6 simultaneously).
2. **Pattern 5 (misleading copy)** — pure copy fix in most cases; cheap. Sweep all Atlas responses for surfaces that don't exist.
3. **Pattern 4 (vendor-as-actor events)** — plugs into Pattern 1. Source Bridge `sent → delivered → read → replied` is a good warmup case before tackling vendor PO acknowledgement.
4. **Pattern 2 (role separation)** — design Manager vs Staff role context once, gates dropped throughout. Smaller scope than Buyamia's 6-role design.
5. **Pattern 3 (audit log)** — needs a real `AuditEvent` entity but unlocks Activity & Governance feed + Override Stack + Dispute Workspace at once.
6. **Pattern 6 (venue-aware behaviour)** — biggest Finn's-specific scope. Per-venue `Stock`, per-venue receiving, per-venue approver chain, inter-venue transfer. Touches Inventory, Orders, Suppliers, Spending.
7. **Pattern 8 (AI provenance)** — same provenance modal reused everywhere.
8. **Pattern 7 (compliance / finance entities)** — `Invoice`, `GoodsReceipt`, `PaymentRun`, `BudgetPeriod`, `TaxLine` (PPN-aware), `ComplianceDoc`. Especially important for the USD-import edge cases (wine, AUS beef) where FX exposure becomes real.
9. **Patterns 9, 10** — pervasive but lower per-fix complexity.

---

## Maintenance

When a flag is addressed in production, change its row's "Fix shape" to `[DONE: <commit/PR ref>]` so this doc tracks actual progress. Do not delete flags — they form the historical record of the spec.

When a new Finn's-specific pattern surfaces (e.g. an event-calendar-driven burn-rate spike for waterpark public holidays), add it as a new flag with its venue/scope and the fix shape.
