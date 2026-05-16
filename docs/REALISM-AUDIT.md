# Buyamia — Realism Audit (for developers)

> Source-of-truth list of every place this prototype shows behavior that a real procurement operation would not survive. Use this as a spec for production work.

**Status: 2026-05-15**
**Total flags: 138 across 25+ files**

---

## How to use this doc

The prototype is being shipped to a real enterprise customer AND serving as the UX/flow reference for the developers building production. **Missing UI surfaces, flow states, failure modes, and misleading copy in this prototype = missing features in production** unless explicitly built around them.

The audit categorises every flag as:

- **Acceptable** (not flagged): mocked data, hardcoded seed values, arbitrary numeric defaults. These can stay.
- **Not acceptable** (flagged): missing inbound events from external actors, async actions modeled as instant success, missing config/settings/audit surfaces, misleading copy, downstream-state booleans hardcoded with no UI representing what flips them, missing failure/empty/error states, single-tenant/single-region/single-currency/single-timezone assumptions, missing RBAC.

Each flag below carries **file path + line number** and **fix shape**.

---

## Pre-demo pass — already done (2026-05-15)

The 11 ship-blocker decoration buttons + the worst overpromising copy + the 2 most misleading Atlas claims have been fixed in the prototype. **The fixes are demo-safe — they preserve visuals and only address things that were broken or misleading.** Each fixed item is annotated below with `[DONE: demo-pass]` and the placeholder behaviour shipped — but the underlying production work (a real lifecycle, a real surface) is still required and is described in the fix-shape column.

### Decoration buttons wired with informative toast placeholders

| Where | Old | New |
|---|---|---|
| `governance/DecisionLedger.tsx:146` `Override` | inert | `toast.info` describes the production override lifecycle (reason capture, co-signer for L4+, signed audit log) |
| `governance/DisputePanel.tsx:99` `Reject` | inert | `toast.info` describes reject lifecycle (reason code, raiser notification, appeal SLA) |
| `governance/DisputePanel.tsx:107` `Escalate` | inert | `toast.info` describes escalate lifecycle (assigned reviewer, evidence panel, SLA clock with auto-page) |
| `workflows/DagFlowPath.tsx:466` `Execute Workflow` | inert | `toast.info` describes Run lifecycle (queued / running / step-failed / retrying / succeeded / failed / cancelled / awaiting-approval) |
| `workflows/DagFlowPath.tsx:470` `Schedule` | inert | `toast.info` describes cron + fiscal-day + holiday-calendar awareness |
| `workflows/DagFlowPath.tsx:474` `Clone` | inert | `toast.info` describes fork-as-draft + version tracking + publish approval |
| `SuppliersPage.tsx:3355` `Open Human Review Queue` | inert | `toast.info` describes the parked-task queue (original prompt / draft action / accept-edit-reject controls) |
| `NewInventoryPage.tsx:2067` `Call Supplier` | inert | `toast.info` describes channel-of-record open + audit log of attempt |
| `NewInventoryPage.tsx:2068` `Retry Agent` | inert | `toast.info` describes RetryHistory + escalation policy |
| `SpendingPage.tsx:799` `Invoice` | inert | `toast.info` describes three-way match grid + variance + credit memo |
| `NewOrdersPage.tsx:2886` `Report an Issue` | inert | `toast.info` describes per-line receipt modal + GoodsReceipt event + dispute routing |
| `RequestPanel.tsx:1037` `Save Draft` | inert | persists to `sessionStorage` + `toast.success`; production note about server-side persistence + optimistic concurrency |
| `infrastructure/InfrastructurePage.tsx:740` `View Full Audit Log` | inert | `toast.info` describes paginated signed-entry table + verify-seals + signed-CSV export |

### Overpromising copy rewritten

| File | Old | New |
|---|---|---|
| `AIActivityPage.tsx:1449` | "Reversible with no penalty. After the window closes, rollback requires vendor approval." | "Reversible — vendor confirmation required. Fees and lead-time impact depend on vendor cancellation policy. After the window closes, rollback requires manual vendor coordination." |
| `OverviewPage.tsx:421` | "`${id}` approved. $X saving locked." | "`${id}` submitted. $X saving estimated — pending vendor acknowledgement." |
| `OverviewPage.tsx:468` | "$X saving locked in." | "$X saving estimated — pending downstream confirmation (payment / compliance / receipt depending on event type)." |
| `infrastructure/InfrastructurePage.tsx:683` (+ tour title + tooltip + seal-status copy) | "Tamper-Proof Audit Log" / "Tamper-proof seal intact" | "Append-Only Audit Log" / "Sealing coverage 87% (rollout in progress)" — honest about hardening item `h7` being still in-progress |
| `SuppliersPage.tsx:1672-1677` | Grade-A "Relationship Hardened" burst on click | "Renegotiation Initiated · agent drafting opening offer" (no premature grade) |
| `SuppliersPage.tsx:3378` | "Execute Renegotiation · Agent #XX" | "Initiate Renegotiation · Agent #XX" |

### Atlas claims softened (referenced surfaces that did not exist)

| File | Old | New |
|---|---|---|
| `SpendingPage.tsx:204` | "...automatic switch threshold is >5% gap with ≥95% quality parity confirmed..." | "...the switch fell within Agent #6's policy envelope for this category — exact thresholds are managed in Governance → Agent Policies..." |
| `SpendingPage.tsx:214` | "...Agent #6 will now apply a higher quality-score filter (≥97%)..." | "...the override pattern has been noted; future quality-sensitive switches will be surfaced for your review before Agent #6 acts. Adjust the policy directly in Governance → Agent Policies..." |

---

## The 10 cross-cutting patterns

Fixing the patterns clears most of the 138-flag list. Prioritise these over individual flags.

### 1. Sovereign / async actions modeled as one-click instant success
**Most damaging pattern in the codebase. Touches every page.**

Examples: Approve PO (Orders), Confirm Delivery (Orders), Pause Auto-orders (Intelligence), Authorize Pivot (Intelligence), Hard-Lock signal sensitivity (Workflows), Cool Down (Nerve Center), Build Phase Authorize (Infrastructure), Connect Payment Rail (Infrastructure), Commit Savings (Spending), Renegotiate (Suppliers), Approve Today's Ledger (AI Activity), Harden Policy (Governance), Adjust Stock (Inventory), Manual Floor Save (Inventory), Join Group Buy (Request).

**Production design (one shape for all):** every async action transitions through `requested → in_flight → confirmed | partial | rejected | fee_applied`, with the in-flight state visible on the page, a cancel affordance, and an `AuditEvent` on every transition. Pick one canonical case (recommend Approve PO) and model it end-to-end first, then propagate.

### 2. No RBAC / role / permission surface anywhere
Anyone with the page open can do anything. Specifically: change Global Autonomy Cap, accept system-wide Cool Down, Hard-Lock workflow signals, Authorize Build Phases, Connect/disconnect Payment Rails, approve KYC, set up vendor banking, terminate vendor contracts, change budgets, commit any-size savings, sign ledger close, suspend agents, simulate tamper.

**Production design:** user context with `role: 'buyer' | 'approver' | 'finance' | 'admin' | 'compliance' | 'auditor'`; role pill in header; per-action role gates; two-person rules on sovereign actions; "Requires: Platform Admin" tooltips on disabled buttons; segregation-of-duties enforced (KYC entrant cannot be the verifier; budget approver cannot be the budget submitter).

### 3. No real audit / event log — most "ledgers" are render-time synthesis
Decision Ledger has no signatures, no hash, no retention banner. Infrastructure claims "Tamper-Proof Audit Log" while the hardening item that would make it tamper-proof is still `in-progress` (this copy has been corrected — see pre-demo pass). Orders and Inventory each synthesise their own MBL / carrier strings from different hashes and claim to be the same source. Override stack absent. Atlas messages auto-clear with no history.

**Production design:** append-only `AuditEvent` store with `{actor, role, timestamp, signature, prevHash, evidenceRef}`. Trail UIs render the store; they don't synthesise from a blueprint. Override stack is queryable and replayable.

### 4. External actors (vendor, bank, regulator, carrier) missing as event sources
Vendor never appears as an actor anywhere. No `po_received_at_vendor`, `pick_started`, `partial_quantity_offered`, `vendor_rejected_with_reason`. Payment rail confirmations absent. Regulator filing async absent. Carrier cold-chain breach events absent (Stage 11 auto-increments stock with no quarantine path). Webhook delivery state, EDI ack, supplier portal status — none of it modeled.

**Production design:** inbound event types per external actor, rendered as nested timeline rows beneath the agentStep on the relevant card. A "vendor portal pending" empty state. Hard-60 reacts to vendor events (not wall-clock). A "Vendor Portal Status" surface on every supplier card.

### 5. Agent/AI copy promises behaviour the prototype has no surface for
**Most dangerous category for a developer reading this as a spec.** Examples (partly fixed in pre-demo pass): "Reversible with no penalty" (FIXED), "saving locked" before vendor ack (FIXED), "Tamper-Proof Audit Log" while sealing in-progress (FIXED), Atlas claims about ≥95%/≥97% thresholds (FIXED). Still outstanding: Atlas claims about pre-qualified alternatives with no data model behind them; Workflow page implies it runs workflows but has no Run object; many narrative agent claims throughout Spending, Suppliers, Intelligence, Overview.

**Production design:** for every piece of agent narrative, either build the surface it references, or rewrite to measured, source-attributed language. Audit Atlas/agent responses against "does this surface exist?" before shipping.

### 6. Single-tenant / single-site / single-currency / single-timezone / single-region assumptions
`TODAY = new Date(2026, 3, 10)` hardcoded (Overview). `'en-US'` locale. `Asia/Jakarta` hardcoded (Orders). Single global `localStorage` key `buyamia-gov-tour-seen` (Governance) — user B never sees the tour because user A dismissed it. All amounts USD despite IDR/THB/AUD/VND/PHP vendors. Single warehouse on every SKU. Daily ledger close assumes a daily business. `regulatoryStatus` collapses GDPR/PDPA/customs/e-invoice/sanctions/halal into one enum.

**Production design:** tenant + user + locale context; namespace storage keys (`buyamia:${tenantId}:${userId}:...`); per-region working-day + holiday calendars; currency/FX/rate-as-of per ledger entry; per-jurisdiction compliance matrix; per-site / per-warehouse stock; per-tenant fiscal-day alignment for ledger close.

### 7. Compliance / finance / regulatory surfaces collapsed
No three-way match anywhere (PO ↔ GR ↔ Invoice). No payment-run lifecycle. No fiscal calendar / period close. No GL coding / chart-of-accounts. No tax/VAT/PPN/GST/withholding. No spend-authority limits. No compliance-doc expiry (HACCP, halal, USDA/AQIS, insurance). No sanctions screening lifecycle. No budget vs commit vs accrual vs paid. No early-pay discount surface. No invoice-mismatch / credit-memo flow.

**Production design:** these aren't UI polish — they're missing first-class entities. `Invoice`, `GoodsReceipt`, `PaymentRun`, `BudgetPeriod`, `TaxLine`, `ComplianceDoc`, `SanctionsCheck`, `Dispute`, `CreditMemo`, `EarlyPayOffer` need to exist with their own lifecycles before the UI can represent them.

### 8. AI provenance / explainability missing
Every numeric AI claim renders as fact: `96% confidence`, trust score `58`, `+4.2%`, `$48,200 saved`, `94 reliability`. No model version, no features used, no data window, no weights, no last-refresh, no drift detection, no model-degraded banner, no learning-phase / cold-start handling, no human-in-the-loop feedback capture, no A/B comparison, no dispute path ("my supplier disagrees with this score").

**Production design:** reusable provenance modal per recommendation (`agent v3.4.1`, features + weights, data window, confidence, "Was this right?" thumbs). Status enum per metric: `healthy | degraded | drift-detected | learning | stale`.

### 9. No system-health / ops-readiness surfaces
Overview has no agent health, no data-freshness, no model-degraded banner. Nerve Center agent status is a single dot colour — no heartbeat lag, queue depth, error rate, last successful action timestamp. No integration health panel for ERP / supplier APIs / bank / identity. No observability deep-links (logs / metrics / traces). Hardening list is cosmetic. Cold-chain temperature/dispatch events from carriers absent.

**Production design:** System Health strip on Overview ("Sensing 6/6 · Reasoning 4/4 · POS feed 12s old"). Per-agent health detail sheet. Integrations panel with last-sync / error-rate / auth-expired / "Test" / "Rotate credential" / "Reconnect" actions. Deep-links to logs/traces on every failed item.

### 10. Failure / empty / error states absent on success-only flows
Every page assumes the click succeeds. No network error, no permission denied, no conflict, no stale-data, no vendor unreachable, no payment failed, no QC fail, no period-close lockdown, no over-budget rejection. The Stream Switcher `LINKED_PO_META` is hardcoded to stage 8 even if Orders advances it.

**Production design:** error envelopes on every action (`{ kind: 'idle' | 'pending' | 'success' | 'network_error' | 'stale' | 'permission_denied' | 'conflict' }`); inline error pill with retry/refresh; empty states for cold-start tenants.

---

## Per-page flags (138 total)

### AI Activity (9 flags) — `AIActivityPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | Hard-60 is wall-clock, not vendor-state | No vendor events (`po_received`, `acknowledged`, `pick_started`, `staged`, `dispatched`) in the feed; Hard-60 doesn't react to anything | Add vendor-side events as event types in timeline; show window responding to them |
| 2 | No per-vendor cancellation policy | Vendor's own cancellation terms invisible anywhere | Surface vendor policy on event card and in Rollback Modal |
| 3 | "Reversible with no penalty" copy | `[DONE: demo-pass]` Now says "Reversible — vendor confirmation required..." | Production: still need to show per-vendor cancellation fee + condition when present |
| 4 | Ledger-Close cadence is hardcoded daily | No tenant config surface for fiscal-day alignment | Add cadence row in Undo Window Policy card with edit affordance |
| 5 | `rollbackable: false` hardcoded in seed data | Downstream state that *causes* irreversibility (shipped, paid, customs-filed) is invisible | `rollbackable` becomes a derived selector over event-type + linked downstream states; show those state events in the feed |
| 6 | Ledger close = single boolean | No audit log surface for closes (who/when/scope) | `LedgerClose { id, approvedBy, approvedAt, eventIdsInScope, signature }` appended to immutable log; "Ledger close history" link |
| 7 | Rollback is instant success | No `requested → vendor_ack → confirmed/partial/rejected/fee_applied` lifecycle | Rollback Modal needs intermediate "awaiting vendor confirmation" state and rejection/partial branches |
| 8 | "Fix & Re-run" can double-fire | If external side effects exist, re-run duplicates them | Gate behind `rollbackable && externalSideEffects.reverted`; warning state otherwise |
| 9 | Confidence has no provenance UI | No "how was 96% computed" surface | "Explain confidence" expansion: model version, features, score breakdown |

### Orders (14 flags) — `NewOrdersPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | No PO sub-state between buyer-ack and vendor-action | `dagStage: number` has no `submitted → vendor_received → acknowledged → confirmed → partial_confirmed → rejected` | Replace with `dagState: { stage, subState }`; render sub-state on OrderCard and Vertical DAG |
| 2 | Vendor-side inbound events absent | Stage 2 "Vendor Confirmed" has only one agentStep; no `po_received_at_vendor`, `vendor_clicked_acknowledge`, `partial_quantity_offered`, etc. | Add `VendorEvent` type; render as nested timeline rows beneath agentStep |
| 3 | "Approve & Execute" is one-click instant success | `executeAction` flips `completedIds` + posts saving toast synchronously | Approve transitions to `submitted_awaiting_ack`; show inbound event "AUS Meats acknowledged at 2:14pm" or "partial-confirmed (90% / +2d lead)" |
| 4 | "Confirm Delivery" no rejection / partial / damaged branch | "Report an Issue" was inert (`[DONE: demo-pass]` toast wired) | Per-line receipt modal: condition radio + photo upload; emits `GoodsReceipt` event |
| 5 | Rollback / cancel a submitted PO missing entirely | No `cancellation_requested → vendor_ack → confirmed | fee_applied | rejected_already_shipped` lifecycle | "Cancel PO" action on live orders pre-Stage 8 + Rollback Modal with vendor-specific terms |
| 6 | Per-vendor policy / per-tenant config / per-category override surfaces missing | `requiresHumanAuthorization` hardcodes stages 0+11 globally | Settings/Policy surface exposing per-tenant HITL gate config, per-vendor terms, per-category approvers |
| 7 | Multi-approver / role-based permissions missing | No `currentApprover`, `approvalThreshold`, `escalationPath` | Role context + spend-authority limits; pending-approver name on order card |
| 8 | No multi-site / multi-warehouse / multi-timezone | `Asia/Jakarta` hardcoded; single address per order | Add `siteId`, `deliveryWarehouse`; per-site timezone drives Stage 11 timestamps |
| 9 | Stage failures are decorative | `failureReason` is free-text; "Resolve Issue" just calls same `executeAction` | `StageFailure` type with `{stageIdx, reason, retryCount, escalatedTo, resolution}`; retry/escalate/swap-supplier branches |
| 10 | Network / permission / stale-data error states absent | Every click assumes success | Error envelopes `{ kind: idle | pending | success | network_error | stale | permission_denied | conflict }` |
| 11 | Recurring drafts fire without forward-state | No "skipped: budget exhausted" / "skipped: holiday" / "previous cycle awaiting close-out" history | `cadenceHistory` with per-cycle outcome; fiscal-calendar-aware "next run" with skip-this-cycle |
| 12 | Decision Attribution Trail is render-time synthesis | No append-only event log; shifts if seeds change | Stored `AuditEvent[]` per order with signing chain |
| 13 | Source Bridge messages have no delivery states | Bridge panel has no `sent → delivered → read → replied` lifecycle | Per-message state machine + bounce/queue/retry; reply thread inline in timeline |
| 14 | Currency / FX / tax surfaces missing | Bare `$X` amounts; no FX rate, no PPN/VAT, no incoterm | `Order` carries `currency`, `fxRateAtQuote`, `taxes`, `incoterm`; render in detail card + Stage 7 Customs |

### Inventory (14 flags) — `NewInventoryPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | `onHand` is a single integer | No reserved / available / in-transit / quarantined split; ATP not computed | `Stock { physical, reserved, inTransit, quarantined, expired }`; Available-to-Promise drives Agent Watch |
| 2 | No batch / lot / expiry tracking | Lamb / Beef / Prawns are perishables with no batches; Adjust Stock writes one number | Per-SKU `Batch[]`; Adjust Stock per-batch; "Writeoff expired" / "Quarantine batch X" actions |
| 3 | Single warehouse / single site assumption | No `warehouseId` / `storageLocation`; no transfer-between-sites | Per-SKU `locations[]`; aggregate + per-location view; transfer-between-warehouses lifecycle |
| 4 | Stock-take / cycle-count variance invisible | Manual count overwrites seeded `onHand`; no variance log, no shrinkage | `CycleCount[]` history with `{counted, expected, variance, reason, approvedBy}`; aggregate shrinkage % |
| 5 | `daysRemaining`, `dailyBurn` are static numbers | No CI, no recompute, no seasonality, `velocityData` is `Math.random()` (jitters between renders) | `burnModel { weekday, weekend, trend, confidence, basedOnDays }`; persist `velocityData` as real time-series |
| 6 | "Mirror of Orders" is parallel synthesis, not a join | `synthesizeRestockHistory` and Orders' `synthesizeStageHistory` produce different MBLs for the same PO id | Lift into a shared module / live read from Orders kernel |
| 7 | `linkedOrderId` is a static string | `LINKED_PO_META` hardcoded; doesn't update if Orders advances PO | Live subscribe to PO state via event bus |
| 8 | Pipeline bundling has no commit / lock / approval flow | `handleAddToDraft` instantly appends; no `Draft.lockState`; no audit entry | `Draft.lockState: editable | awaiting_vendor_quote | sent_to_vendor | frozen`; per-add/remove `AuditEvent` |
| 9 | No supplier-side state on incoming SKUs | Stage 11 auto-increments `onHand`; no `pending_receipt`, no quarantine, no cold-chain breach | Stage 11 creates `pending_receipt` batch → quarantine → QC → `available` |
| 10 | "Manual Fixed" par floor has no policy / sign-off / expiry | Buyer can lock par at 0 with no approval, no expiry | Reason code + optional expiry + role check + `ParOverrideEvent` |
| 11 | Failed-stage card has no real resolution UI | "Call Supplier" / "Retry Agent" were inert (`[DONE: demo-pass]` toasts wired) | Real `RetryHistory[]` (attempt, channel, outcome, nextRetryAt); auto-switch-to-backup requires sign-off if more expensive |
| 12 | Failed inbound webhook half-modeled | `buyamia-restock-intent-failed` carries no reason | Add `reason: user_dismissed | budget_exceeded | approver_rejected | vendor_unreachable`; render reason + remediation |
| 13 | Catalog modal: no validation / de-dupe / archive impact | Add SKU has no uniqueness check; Archive is soft delete with no audit | Archive queries open POs/reservations; requires reassignment; appends `CatalogEvent` |
| 14 | `velocityData` jitter leaks into UI | `Math.random()` at module load — different chart on every reload | Deterministic seeded random keyed off `item.id`, or persist time-series |

### New Request / Sourcing Wizard (15 flags) — `RequestPanel.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | "Strategic Sourcing Portal" skips entire RFQ → quote → negotiate → award flow | Wizard goes from "select vendors" directly to "Authorize & Deploy Agent" → mints `PO-2026-0147` instantly | Insert Step 4.5 (Quote Collection) and Step 4.7 (Bid Comparison & Award); PO only mints after Award |
| 2 | "Authorize & Deploy Agent" instant success; hardcoded PO id | `handleSubmit` shows toast + sets step 7 + redirects; no approver routing | `pending_approval → routed_to → approved | rejected | held`; real sequence service for PO id |
| 3 | "Save Draft" was unwired | `[DONE: demo-pass]` writes to `sessionStorage` + toast | Production: real `RequestDraft` persistence with owner, lock-by, lock-expires-at, version; optimistic concurrency |
| 4 | Group Buy commitment instant + irreversible | No `pool_state: forming | window_locked | pricing_locked | closed`; no withdraw, no member-list inbound events | `Pool.state` lifecycle + member-list events (`member_joined`, `member_dropped`, `pricing_finalized`) |
| 5 | No vendor / supplier portal handshake | 3 hardcoded vendors with no `portalState` (onboarded, lastResponded, currentRFQs, declineRate, credentialExpiry) | Per-vendor `portalState`; expired creds block selection until re-verify |
| 6 | URL-hash deep-link prefill has no validation, no error surface | SKU might be archived / vendor delisted / source PO cancelled / user permission revoked | Validate each param vs current source-of-truth; render error banner explaining what changed with safe fallback |
| 7 | Budget / spend pulse is cosmetic | `monthlyBudget`/`spentSoFar` hardcoded inline; no per-category / FY / period / department; no budget-owner approver for over-budget | Pull from `BudgetService { category, period, allocated, committed, spent, available, owner }`; over-budget routes to approver |
| 8 | Logistics Risk Map hardcoded copy | Java monsoon / port congestion / Australia clear are string literals; not pinned to PO at authorize-time for audit | `LogisticsRisk[]` records `{id, region, kind, validFrom, validUntil, source, confidence}`; pin to PO at authorize |
| 9 | Autonomy tier no per-policy / per-spend / per-category gating | User can pick L5 for first-trial vendor $4,100 with no policy guard | Filter tier options against `OrgPolicy` (vendor maturity, amount, cross-border, category); grey disallowed with tooltip |
| 10 | HITL gates hardcoded to stages 1+12 | No per-tenant config / per-category override | Lift gate definitions into per-tenant config visible from Policy/Settings |
| 11 | Template deploy is silent | No diff vs standard 12-stage kernel; no version capture | Show template's exact stage list inline before deploy; capture `deployedWorkflowVersion` on submit |
| 12 | No contract terms / MSA / NDA / payment terms / incoterm capture | Despite "Strategic Sourcing" framing | Step 5.5 captures `ContractTerms`; pre-fill from vendor's master agreement |
| 13 | No quote expiry / quote-vs-PO drift | Quotes have no `expiresAt`; re-order assumes old prices | Each quote `{quoteId, expiresAt, lockedUnitPrice}`; expired quotes block Authorize with "request new quote" CTA |
| 14 | Atlas chat has no permission / privacy scoping | Hardcoded per-step responses with no data-scope tags, no audit | Data-scope tags per response; permission-check; "this conversation is logged to your audit trail" footer |
| 15 | Currency / tax / multi-currency line items missing | Bare `$` budget; no FX context; no PPN/VAT line | `currency` per request; `taxLines` per item; FX rate at quote |

### Suppliers (14 flags) — `SuppliersPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | Onboarding lifecycle is admin-only data entry | 12 stages all admin-uploadable; no `invited → vendor_accepted → portal_logged_in → kyc_submitted → docs_uploaded_by_vendor → verifier_reviewed → certified` | Per-stage inbound-event sub-timeline; "Vendor Portal Status" surface on supplier card |
| 2 | `journeyStage` is a single integer | No actor / role / evidence / approver / signature / timestamp on stage advance | Immutable `{stageFromTo, actor, role, timestamp, evidence_doc_id, approver_id}`; "Compliance Trail" tab |
| 3 | KYC, sanctions, banking modeled as checkboxes | Sanctions = select with 3 options; banking = file upload; no re-screening schedule | State machines: `screening_in_progress → matched → cleared (re-screen Q)`; `bank_verification: awaiting_micro_deposit → verified → failed` |
| 4 | No document expiry tracking | NIB, NPWP, halal cert, HACCP, USDA/AQIS, insurance, ISO — all expiring docs absent | `compliance_docs[]` with `{type, doc_id, issued, expires, status}`; expiring auto-flips to Watchlist; expired blocks POs |
| 5 | Contract = single `contractExpiresIn: number` | No `renewal_in_progress`, `auto_renewal_clause`, `current_term_start`, `prior_amendments[]` | `RenewalDeal` object with `renewal_window_open → drafted → vendor_responded → counter_round_N → signed_buyer → signed_vendor → effective` |
| 6 | Performance score has no source visibility | `score: 94` ground truth; no methodology, weighting, time window | "Score Methodology" drawer + per-order contribution + last-recomputed timestamp + audit_trail of formula changes |
| 7 | Disputes are a row-status tag, not a workflow | No `Dispute` entity with `{reason, vendor_response, evidence[], credit_memo, resolution_owner, sla_clock, closed_by}` | Click `disputed` row opens Dispute Workspace + state machine + SLA clock + credit-memo |
| 8 | No alternate-supplier / single-source-risk mapping | "Agent #03 has pre-qualified 2 vetted Produce alternatives" is narrative text | "Coverage Map" view: rows = categories, columns = vendor count by tier; single-source highlighted; per-supplier `is_only_source_for_skus[]` |
| 9 | "Execute Renegotiation" was confetti animation | `[DONE: demo-pass]` button renamed "Initiate Renegotiation"; burst now says "Renegotiation Initiated · agent drafting opening offer" | Replace burst with `RenegotiationDeal` workspace: opening position, vendor responses, rounds, red-line, signed amendment; "Hardened" grade flips only on signed amendment |
| 10 | Broadcast send is fire-and-forget | No per-recipient `sent → delivered → read → replied → bounced` | Broadcast record with per-recipient `{sent_at, delivered_at, read_at, replied_at, bounce_reason}` |
| 11 | No permission / role surface | Same anonymous "Admin" can approve KYC, banking, terminate contract — SOX/SOD violation | Gate per stage; show active user role; require approver for stages 5, 7, 8, 12; block self-approval |
| 12 | QC failure alert lacks workflow back to vendor | Dismiss-X only; "consider trust-score adjustment" copy with no surface to do it | Three actions: Open Dispute / Hold Next PO / Adjust Score (gated) |
| 13 | "Onboard New Vendor" routes to unrelated New Request page | Misleading CTA — handleOnboardVendor → `'request'` | Build vendor self-service intake portal OR downgrade copy to "Log New Vendor Lead" |
| 14 | Pause Agent / Manual Takeover has no parked-task UI | Right-panel "Open Human Review Queue" was inert (`[DONE: demo-pass]` toast) | Build the actual Human Review Queue: parked tasks per vendor, original prompt, draft action, accept/reject/edit, audit trail |

### Spending (14 flags) — `SpendingPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | No three-way match anywhere | `invoiceRef` is free-text string; Invoice button was inert (`[DONE: demo-pass]` toast wired) | Real `Invoice` entity: `{po_ref, gr_ref, invoice_num, vendor_invoice_date, match_state, variance_qty, variance_price, ap_status}`; click opens three-way comparison grid + match-exception workflow |
| 2 | No payment-run lifecycle | No `scheduled → approved → released → in_flight (ACH/SWIFT) → cleared → reconciled`; no FX-lock; no bank confirmation | Payments tab: scheduled runs, per-payment state, bank confirmation, retry on failure, FX rate locked-on date |
| 3 | "Commit $X — Unlock Capital" is one-click confetti | Button sets a Set entry + confetti; no vendor renegotiation request, no `actual_savings` vs `projected_savings` | `SavingsCommitment`: `proposed → renegotiation_request_sent → vendor_response (accepted|counter|rejected) → terms_agreed → first_PO_at_new_price → realized_savings_tracking_started` |
| 4 | No budget vs commit vs accrual vs actual | Just `spend` vs `budget` | Add `committed`, `accrued`, `paid`, `forecast_end_of_period`; four-band stacked bar |
| 5 | No fiscal calendar / period close | Months are calendar months; no `period_closed`, no late-post review | `period_status: open | closing | closed | reopened`; close timer; late-post review queue |
| 6 | Single-currency USD despite IDR/THB/AUD/VND/PHP vendors | No FX rate, no rate-as-of, no exposure, no hedge | `currency` per entry; `fx_rate_used`, `fx_rate_as_of`; "FX Exposure by Currency" widget; separate drift-from-FX vs drift-from-price |
| 7 | No tax / VAT / GST / withholding | Zero hits in file | `tax_breakdown {jurisdiction, rate, amount, recoverable}` per entry; "Show Net / Show Gross" toggle |
| 8 | No GL coding / chart-of-accounts | `categoryId` is a procurement category, not a GL account | Add `gl_account`, `cost_center`, `entity`, `project`; "GL Mapping" config screen |
| 9 | No early-pay-discount visibility despite Atlas claiming it | Data model has no `payment_terms`, `early_pay_discount_threshold`, `take_discount | pass` | "Discounts in Window" widget: vendor × invoice × discount % × deadline × take/pass |
| 10 | No invoice-mismatch / dispute / credit-memo flow | No `dispute_open`, `credit_memo`, `chargeback`, `short_pay` states | "Invoice Exceptions" view + dispute records (cross-page join with Suppliers Dispute Workspace) |
| 11 | Budget setup modal has no version history / approval / effective-date | "Save Budgets" instant + anonymous | `budget_version[]` history with effective_date + approver; require approver role for changes > X% |
| 12 | Atlas claims thresholds + filters that don't exist | `[DONE: demo-pass]` Two worst claims softened (≥95% threshold, ≥97% filter) | Build the Agent Policy surface (per-agent switch thresholds, quality floors, learned-preference history, approval limits) that Atlas can link to |
| 13 | No failure / empty states | Atlas, Trade-off Engine, Capital-Unlocked celebration all happy-path only | Explicit states: Atlas offline, savings-commit failed (vendor declined), payment-run failed, invoice-fetch unavailable; retry + contact owner |
| 14 | No permission / role on financial actions | Anyone can change budgets, commit savings, override agent | Gate by role + amount tier; "You are signed in as: Buyer (limit $5K)" badge; above-limit routes to approver queue |

### Overview (6 flags) — `OverviewPage.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | KPIs unsourced, unexplainable, frozen | No "as of" timestamp, no source attribution, no click-through to audit | "as of HH:MM" + fiscal-period selector; click-through to Metric Audit Trail |
| 2 | PO Approve is instant success | `handlePoApprove` fires saving-float + removes from queue + posts "saving locked" message in 380ms (`[DONE: demo-pass]` copy now "estimated · pending vendor ack") | `pending-vendor-ack` state with price-lock countdown; `confirmed | partial | vendor-rejected | price-expired` branches; approved PO sits in "awaiting confirmation" bin |
| 3 | `handleClearDeadline` collapses payment + compliance + delivery into one 850ms animation | Each has wildly different real lifecycles; failure branches missing | Per-event-type handlers: payment → `queued → rail-ack → cleared|bounced`; compliance → `submitted → regulator-pending → accepted|rejected`; delivery → `arrived → QC-pass|QC-fail → received` |
| 4 | Autonomy upgrade is hardcoded counter | "8 more approvals" auto-promotes from L3 → L4; no governance gate, no two-person, no per-category | Breakdown: "8 approvals + Ops Manager sign-off + Compliance ack"; gate behind two-person ratification modal; link to Governance history |
| 5 | No system health surface | Atlas LIVE_PULSES rotate every 4s regardless of state; no agent health, no model degraded, no data staleness | System Health strip: "Sensing 6/6 · Reasoning 4/4 · POS feed 12s old · ERP feed 4m old"; degraded-model banner state |
| 6 | Single-tenant / single-timezone baked in | `TODAY = new Date(2026, 3, 10)` literal; `'en-US'`; "Logistics Calendar — April 2026" hardcoded | Tenant/locale context + per-event timezone + fiscal-day boundary |

### Governance (11 flags) — `governance/*.tsx`

| # | Flag | What's missing | Fix shape |
|---|---|---|---|
| 1 | Per-control-plane stats hardcoded | `CP_WEEK_STATS` frozen; no window scope, no drill-down | Surface date window; click-through to filtered Decision Ledger; "export this week's blocks" CSV |
| 2 | Policy creation is instant — no preview, no diff, no shadow-mode, no two-person | "Create Rule" pure dismiss; same for "Harden Policy" | New-rule wizard: draft → impact preview vs last 30 days → shadow-run N days → ratification → enacted; every transition logged |
| 3 | No agent suspension surface | If GOV-005 goes rogue, no way to pause from Governance | Per-agent "Suspend / Resume" + permission gate + mandatory reason + two-person rule for governance-class agents + audit |
| 4 | No agent versioning / change-management | Agents referenced by ID with no version, no timeline, no rollback, no canary | Per-agent version pill + change-history modal (rev, deployed-by, deployed-at, rollback) |
| 5 | No agent SLA / health for governing agents | No "is the audit-trail recorder running?" surface | Governance health strip: GOV n/n healthy, last successful audit-log write, error rate |
| 6 | Decision Ledger: no immutability / signing / retention / export | No entry hash, no signature, no "sealed at" per row, no Export-for-Audit | Per-row signature/hash chip; "tamper-proof seal · last verified" header; signed CSV export; retention policy footer |
| 7 | Override button was no-op (`[DONE: demo-pass]` toast) | Even when wired: no override stack, no reason, no un-override path, no two-person for L5 decisions | Modal with mandatory reason + co-sign-required-if-L5; row shows attribution; override stack viewable per decision |
| 8 | Dispute lifecycle collapsed | Reject + Escalate were inert (`[DONE: demo-pass]` toasts wired); no assignment, no evidence, no appeal | Full `open → assigned → evidence-gathering → ruling → closed → appeal`; assign-to selector, evidence area, ruling text, appeal window |
| 9 | "Harden Policy" is instant boolean | No preview of downstream effect, no expiry/sunset, no rollback | Modal: scope selector + impact preview + sunset selector (30/90/365/permanent) + two-person sign-off; "Standing Precedents" panel with rollback |
| 10 | Control Plane status is 3-state literal | No surface for what flips CP-SIM from `active → warning`; no incident history, no per-role permission to disable | Status hover/click reveals reason + last transition + incident log; disable requires two-person + compliance + audit |
| 11 | First-run tour + trail-return marker bare-keyed in localStorage | `buyamia-gov-tour-seen` is global; multi-user kiosk breaks | Namespace `buyamia:${tenantId}:${userId}:...` |

### Nerve Center + Workflows + Infrastructure (26 flags)

Files: `nerve-center/NerveCenterPage.tsx`, `nerve-center/AgentGrid.tsx`, `nerve-center/DagVisualization.tsx`, `workflows/WorkflowsPage.tsx`, `workflows/WorkflowTemplateList.tsx`, `workflows/DagFlowPath.tsx`, `workflows/AutonomyLadder.tsx`, `infrastructure/InfrastructurePage.tsx`.

Dominant patterns (see full list at the end of this section):
- **Sovereign actions as one-click booleans** with no actor capture / audit / approval / rollback: autonomy cap, cool down, hard-lock, build-phase authorize, payment-rail connect, lockdown clear (flags #5, #6, #11, #20, #21).
- **Missing async lifecycles**: workflow runs (#9), agent lifecycle (#2), bottleneck interventions (#4), tune-logic apply (#11), rail connect (#18), build phase (#20).
- **Missing external/inbound state**: event bus lag, DLQ, integration health, webhook delivery, secret rotation, observability deep-links (#7, #18, #23).
- **No RBAC on runtime-sensitive surfaces** (#22).

| # | Flag | Fix shape |
|---|---|---|
| 1 | Agent health = single `status` enum | Add `lastHeartbeatAt`, `queueDepth`, `errorRate1m`, `p95LatencyMs`, `version`; mini-stat strip + detail sheet |
| 2 | Agent lifecycle has only 3 states | `deploying → running → degraded → suspended → retired` with per-agent action menu (Suspend / Drain / Restart / Roll back / Retire) |
| 3 | No incident / on-call surface | Incidents strip + per-agent "raise incident" |
| 4 | Bottleneck interventions instant success | `requested → executing → succeeded/failed` with cancel + audit |
| 5 | Cool Down = single boolean | Ledger entry (actor / prior level / new level / reason / expiry); banner with active window + "Release Cool Down" |
| 6 | Global Autonomy Cap is a single boolean | Confirmation modal with reason + two-person above L3 + audit log; "last changed by X at T" inline |
| 7 | No event-bus state, lag, throughput, DLQ, replay | Event Bus telemetry card: per-topic lag, DLQ with "Inspect & Replay", throughput, consumer health |
| 8 | Stage 5 bottleneck hardcoded text | Status derived from metrics with timestamps; "Acknowledge / Open Incident / Mark Resolved" with audit |
| 9 | Workflow execute / schedule / clone inert (`[DONE: demo-pass]` toasts wired) | Production: real Run object + Recent Runs panel + Inspector (retry / cancel / dead-letter) |
| 10 | Workflow versioning / draft / published / deployed states absent | Version pill (`v3.2 · deployed`) + Versions tab with diff & rollback; "Save as draft → Submit → Publish" gate for Tune Logic |
| 11 | Tune Logic Apply mutates global `constraintStore` with no gate, no audit | Record `{actor, stage, prior, new, reason, approver}`; ≥90% requires second approver; "Constraint History" view |
| 12 | Simulate flow only happy paths | `pending → running → succeeded → failed → cancelled`; simulator engine health; runs list; persisted results |
| 13 | Retry policy / DLQ / approval-gate timers invisible on DAG | Per-stage row exposes items in-flight / retrying / dead-lettered / awaiting-approval with click-through inspectors |
| 14 | Autonomy Ladder has no mechanism for *how* autonomy changes | Make interactive: promotion criteria (success-rate threshold, dwell time), approval gate, downgrade-on-incident, history line |
| 15 | Workflow templates have no governance | Per-template `{author, version, scope, install_state}`; Marketplace / Library tab with publish + install + RBAC |
| 16 | `workflowAutonomy` derived silently from complexity strings | Make rule explicit (a Policy in Governance); link "View policy that sets this level"; override path |
| 17 | Hardening list cosmetic; "Tamper-Proof" while `h7` in-progress (`[DONE: demo-pass]` copy now "Append-Only · Sealing coverage 87%") | Each hardening row needs deep-link to runtime surface; reconcile audit-log "Grade A" with `h7` state; per-secret rotation deadlines |
| 18 | No integration health surface | "Integrations" panel: each external system with status (connected / auth-expired / degraded / disconnected), last sync, error rate, Test/Rotate/Reconnect; rail connect needs `requested → verifying → live` |
| 19 | Single-region / single-tenant assumptions throughout | Region/tenant selector at top; per-region health; primary/secondary failover; data-residency badge |
| 20 | Build-phase authorization no two-person / no rollback / no failure path | Capture reason + approver; `requested → approved → provisioning → running → completed/failed`; Rollback action; audit log |
| 21 | Tamper-Proof Audit Log is a number + Simulate Tamper button | Inline log table (paginated, filterable); "Verify seals" returns verification report; lockdown banner requires actor sign-off ("ack with reason") to clear |
| 22 | RBAC entirely absent on runtime-sensitive actions | Role pill in header; gate destructive/sovereign actions behind explicit permission checks |
| 23 | No observability deep-links | "View Logs / Traces / Metrics" deep-links on every stage and integration row; trace-id selectable on any failed item |
| 24 | Misleading "Sealed by GOV-001/003/004" chip row (`[DONE: demo-pass]` parent header copy fixed) | Show real signer-per-entry; reconcile with `h7` state |
| 25 | Auto-clearing intervention feedback hides real history | Persist interventions in "Recent actions on this stage" strip with timestamp + actor + outcome; pipe to global audit log |
| 26 | Workflow page deep-link is one-way and silently swallows failures | Use non-destructive query param (`?workflow=…`); show inline "did you mean WF-STD?" on miss |

### Intelligence (Transformation) (9 flags) — `transformation/*.tsx`

| # | Flag | Fix shape |
|---|---|---|
| 1 | AUDIT_TRAILS show "what" + impact but no provenance | Each row needs: agent version, features, data window, confidence, per-feature contribution; "Explain in detail" expansion |
| 2 | Misleading "AI knows" copy throughout tour and headers | Replace certainty with measured language ("auto-decision rate vs human-override rate over 30/60/90d") |
| 3 | Pause auto-orders / Authorize Pivot = instant local state | `pending → applied | failed`; show "X open POs will be honored / blocked"; require role; produce Decision Ledger entry |
| 4 | Sensitivity slider has no audit / review / preview | Live preview ("At 65%, last 30d would have suppressed 14 of 22 exceptions, $3,400 in flagged spend"); Save with confirmation; audit; role check |
| 5 | Trust Score has no provenance UI | Click trust score → features used, weights, last refresh, model version; dispute mechanism |
| 6 | No model-degraded / drift / cold-start / low-confidence states | Per-metric status: `healthy | degraded | drift-detected | learning | stale`; remediation CTA |
| 7 | TimeRange selector (7D/30D/90D/1Y) does not filter data | Wire to data window; comparison-period overlay |
| 8 | Right-panel → center events have no permission / role / audit | Gate by role; show diff preview; produce `DEC-XXXX` entry; allow revoke |
| 9 | No human-in-the-loop feedback capture | Per agent action: accept / reject / dispute + comment; writes to feedback queue; shows on agent's next decision |

### Global Ops (6 flags) — `global-ops/*.tsx`

| # | Flag | Fix shape |
|---|---|---|
| 1 | No per-region operational health | Connector status, p50/p95 latency, throughput, last incident, data residency zone |
| 2 | `regulatoryStatus` collapses GDPR/PDPA/customs/e-invoice/sanctions/halal into one enum | Compliance matrix per country: GDPR/PDPA, customs/HS, e-invoice regime, sanctions, halal; each with evidence + last-checked |
| 3 | Single-currency display; no FX exposure / hedging | Per-country GMV in local + consolidated; FX exposure by payable currency; last-rate timestamp; FX policy |
| 4 | No regional SLA / working-day / holiday calendar / locale | Per-region calendar + holidays affecting cutoffs; SLA targets; locale config (language, paper, Incoterms default); outage feed |
| 5 | No cross-region failover / sanctions/embargo / regional incident | Region Status strip: health + incidents + failover decisions + last sanctions-list refresh + "Tenant under regulatory hold" banner |
| 6 | No permission / role on a multi-region admin page | Role-scoped region access list; "Read-only in AU" indicator; view-access audit; approval-required for region-level config change |

---

## Recommended fix order (post-demo)

By leverage × ship-risk:

1. **Pattern 1 (async lifecycles)** — model one canonical case end-to-end (Approve PO), then propagate. Highest leverage.
2. **Pattern 5 (misleading copy)** — pure copy fix in most cases; cheap.
3. **Pattern 4 (vendor-as-actor events)** — plugs into Pattern 1.
4. **Pattern 2 (RBAC)** — design role context once, gates dropped throughout.
5. **Pattern 3 (audit log)** — needs a real entity but unlocks Governance + Decision Ledger + Override Stack at once.
6. **Pattern 8 (AI provenance)** — same provenance modal reused everywhere.
7. **Pattern 7 (compliance / finance entities)** — biggest scope. `Invoice`, `GoodsReceipt`, `PaymentRun`, `BudgetPeriod`, `TaxLine`, `ComplianceDoc`.
8. **Patterns 9, 10, 6** — pervasive but lower per-fix complexity.

---

## Maintenance

When a flag is addressed in production, change its row's "Fix shape" to `[DONE: <commit/PR ref>]` so this doc tracks actual progress. Do not delete flags — they form the historical record of the spec.
