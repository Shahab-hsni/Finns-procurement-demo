# Finn's Procurement Platform — Pages Documentation

> Comprehensive reference for every page, panel, data point, action, and flow.
> Each page follows the three-panel cognitive layout: **Left** (catalog/list) · **Center** (active task/journey) · **Right** (intelligence/Atlas).
>
> This is the canonical implementation spec. For the high-level platform map (topology, edges, hash contract, glossary), read `PLATFORM-MAP.md` first. For the right-panel rules, read `RIGHT-PANEL-MAP.md`.

> ⚠ **Phase 6 note — autonomy model changed.** Per-page "Mode-Awareness · Manual Baseline Audit" subsections written during Phase 4 (and referenced from `RIGHT-PANEL-MAP.md`) describe a 3-tier global `Off · Assist · Auto` model that no longer exists. The current model is **per-entity `manual` | `auto`** + a system-wide pause on Activity & Governance → Agents tab. Smart features (autocomplete, vendor ranking, similar-past-POs, Atlas chat) are always on; only agent *actions* are gated. Read those audit subsections with that translation: "Off mode" ≈ "Manual entity OR system paused"; "Assist" collapses into Manual; "Auto" is unchanged. The manual-baseline rule still applies — every flow must be completable on a Manual entity. See `PLATFORM-MAP.md § 3a` for the canonical model.

---

## Table of Contents

1. [Orders Page](#1-orders-page) *(cockpit)*
2. [Overview Page](#2-overview-page)
3. [Inventory Page](#3-inventory-page)
4. [New Request Page](#4-new-request-page)
5. [Suppliers Page](#5-suppliers-page)
6. [Spending Page](#6-spending-page)
7. [Activity & Governance Page](#7-activity--governance-page)
8. [Workflows Page](#8-workflows-page)
9. [Shared Patterns](#9-shared-patterns) — Atlas · ⌘K · Source Bridge · Audit Mode · Hash-Context · Toasts · Tooltips · Tours · Venue Tags · **Unified Action Log** · Removed Patterns

---

# 1. Orders Page

The Orders page is the **cockpit** — the morphologically most complex page in the platform. Every purchase order's full lifecycle is visible and actionable here. Triage Mode is the default surface; Audit Mode is a panel-expansion takeover for historical investigation.

---

## 1.1 Data Model

### Order object

```ts
type Order = {
  id: string;                       // "PO-3041"
  supplier: string;                 // "PT Bali Seafood Lestari"
  supplierAgent: string;            // "A-03"  (Vendor Comms ref)
  managedBy: string;                // "A-01" — A-05  (assigned operating agent)
  amount: number;                   // IDR
  amountUsd?: number;               // USD-equivalent at booking FX
  currency: 'IDR' | 'USD';
  venues: VenueTag[];               // one or more of BC / RC / ST / SP
  category: Category;               // Protein / Seafood / Produce / Dry Goods / Dairy / Beverages / Other
  workflowTemplate: 'WF-STD' | 'WF-RSH' | 'WF-REC';
  stage: 1 | 2 | 3 | 4 | 5;         // 1-Request, 2-Quote/Vendor Confirmed, 3-PO Approved, 4-In Transit, 5-Delivered & Checked
  status: 'live' | 'completed' | 'disputed' | 'cancelled' | 'on-hold';
  laborMode: 'agent' | 'manual';
  trace: StageTrace[];              // per-stage outcome history
  humanDescription: string;         // plain-English one-liner for the cockpit
  createdAt: ISODate;
  eta?: ISODate;                    // expected delivery
  deliveredAt?: ISODate;
  recurring?: { frequency: 'weekly'|'biweekly'|'monthly'; nextRun: ISODate };
  qcOutcome?: 'pass' | 'fail';      // populated when stage = 5
  override?: { actor: 'user'|'agent'; reason: string; at: ISODate };
};

type StageTrace = {
  stage: 1|2|3|4|5;
  outcome: 'pending'|'in-progress'|'complete'|'failed';
  agent?: string;                   // A-01 … A-05
  startedAt?: ISODate;
  completedAt?: ISODate;
  dataPoints?: Record<string, string|number>;
  alternatives?: { label: string; rejectedBecause: string }[];
};

type VenueTag = 'BC' | 'RC' | 'ST' | 'SP';
type Category = 'Protein' | 'Seafood' | 'Produce' | 'Dry Goods' | 'Dairy' | 'Beverages' | 'Other';
```

### Historical order ledger (`HISTORICAL_ORDERS`)

A seeded pool of 40 completed POs spread across the prior 90 days. Each carries the same `Order` shape with `status: 'completed' | 'disputed' | 'cancelled'`. The ledger surfaces only in Audit Mode.

### Live order data

7 seeded live orders cover the full stage spectrum:

| ID | Supplier | Venue | Stage | Status | Workflow | Note |
|----|----------|-------|-------|--------|----------|------|
| PO-3041 | PT Bali Seafood Lestari | BC, ST | 2 | live | WF-STD | Quote awaiting Spend Watchdog approval |
| PO-3042 | CV Indo Sayur | BC, SP | 3 | live | WF-REC | Recurring weekly produce — auto-approved |
| PO-3043 | Krakatoa Coldstore | ST | 1 | live | WF-RSH | Urgent protein — par floor breached |
| PO-3044 | Bintang Distribusi | BC, SP, RC | 4 | live | WF-STD | In transit, Logistics Agent monitoring |
| PO-3045 | Sumber Dairy | BC, RC | 5 | live | WF-STD | Delivered, awaiting QC checkin |
| PO-3046 | PT Wine Cellar Nusa | RC, ST | 4 | live | WF-STD | Imported wine — extended transit |
| PO-3047 | Eka Packaging | SP | 2 | disputed | WF-STD | Quote flagged 18% above market by Spend Watchdog |

### The 5-Stage DAG

Every order flows through these 5 stages. Stages 1–2 are "Pre-PO" (no commitment yet). Stages 3–4 are "Fulfillment" (PO live, vendor committed). Stage 5 is "Closeout" (delivery + QC).

| # | Stage | Owning agent | Plain-English description |
|---|-------|--------------|---------------------------|
| 1 | Request | A-02 Restock (when system-initiated) / human (when manual) | Demand signal raised — par breach, scheduled recurring trigger, or human request. |
| 2 | Quote / Vendor Confirmed | A-01 Sourcing | RFQ sent (WF-STD), direct vendor confirmation (WF-RSH), or recurring vendor (WF-REC). Quote received, validated against 30d market median. |
| 3 | PO Approved | A-04 Spend Watchdog | Policy gates checked (spend cap, vendor trust, duplicate detection). PO issued to vendor. |
| 4 | In Transit | A-05 Logistics | Vendor confirms shipment. ETA tracked. Late/risk signals surfaced. |
| 5 | Delivered & Checked | A-05 Logistics + human (QC) | Delivery received at target venue. QC check: pass → completed; fail → dispute. |

### Task Modules (one per DAG stage)

Each stage has an interactive Task Module — opened from the journey rail in agent mode (Review) or manual mode (Execute). Schema-driven inputs vary by stage:

| Stage | Task Module inputs (Manual / Execute) |
|-------|--------------------------------------|
| 1 — Request | Reason, items list, urgency, target venue, suggested vendor (optional). |
| 2 — Quote / Vendor Confirmed | Vendor selected, quote amount, lead time, payment terms, deviation from market. |
| 3 — PO Approved | Policy checks passed, approval actor, approval notes. |
| 4 — In Transit | Tracking number, carrier, ETA, custody-of-goods checkpoint notes. |
| 5 — Delivered & Checked | Received quantity vs ordered, QC outcome (pass/fail), photo/note, venue receiving staff name. |

---

## 1.2 Left Panel — Order List (Triage Mode)

### Header

- **Title**: `Orders` + InfoTooltip
- **⌘K trigger button**: opens the Command Palette
- **Maximize2 button**: enters Audit Mode

### NEEDS YOUR ACTION section

Section Label Badge — Amber. Lists orders where the user must do something:
- `status: 'live'` AND any of: `stage = 3 AND awaiting human approval`, `stage = 5 AND qcOutcome = 'fail'`, `laborMode = 'manual'`, `status: 'disputed'`.
- Each row is an **OrderCard** (see DESIGN.md). Status communication lives in the title row's icon + color — never on card border or background.

### AUTONOMOUS FLOW section

Section Label Badge — Sage. Lists orders running cleanly on agent labor:
- `status: 'live'` AND `laborMode: 'agent'` AND not in the action list above.

### OrderCard

```
┌─────────────────────────────────────────────┐
│ [⚠ Approve] Spend Watchdog flagged    [⋯]  │  ← title row icon+text colored by status
├─────────────────────────────────────────────┤
│ PT Bali Seafood Lestari                     │  text-xs font-medium
│ Rp 14.2M · BC + ST · WF-STD                 │  text-[10px] muted
│ Stage 2/5 — Quote received                  │  text-[10px]
├─────────────────────────────────────────────┤
│ [BC] [ST]              Agent · A-04         │  venue chips + steering badge
└─────────────────────────────────────────────┘
```

⋯ menu items (stage-gated):
- **Track Shipment** — visible only when `stage ≥ 4`
- **Message Supplier** — always
- **Repeat Order** — visible only when `stage = 5 AND status: 'completed'`

---

## 1.3 Center Panel

The center morphs through 5 states.

### State 1: Default (no order selected)

Header strip: "Scheduled & Autonomous". Two segmented tabs:
- **Scheduled** — recurring orders + upcoming triggers (Restock Agent forecasts).
- **Autonomous flow** — currently-running agent-driven orders.

Each row shows the same data as an OrderCard but in a wider format with an inline ETA bar.

### State 2: Single Order Journey

Triggered by clicking any order. Two columns:

**Left column — Detail Card**
- Supplier name + venue chips + workflow badge (`WF-STD` / `WF-RSH` / `WF-REC`)
- Amount (large, IDR primary, USD secondary if applicable)
- Tertiary row: `Managed by · Agent A-NN →` (navigates to Activity & Governance)
- Primary CTA (varies by stage):
  - Stage 2 + needs approval → **Approve & Execute** (sage)
  - Stage 5 + qc pending → **Confirm Delivery** (sage)
  - Stage 5 + qc fail → **Contact Supplier** (red)
  - Manual takeover → **Resume Agent**
- Secondary text link (centered, below primary): contextual — "Decline" / "Report Issue" / "Reschedule"
- Tertiary action row (border-top, gap-5): Track · Repeat · Message supplier (stage-gated)

**Right column — 5-Stage DAG**

Vertical rail with one row per stage. Each row:
- Node dot (sage/amber/red/gray per state)
- Stage label
- Inline status pill ("In Progress" / "You're driving" / "Failed")
- Group-hover "View Trace" affordance

Below failed stages: a **DAG Failure Callout** with "Call Supplier" / "Retry Agent" actions.

### State 3: Batch Transformation Console

Triggered when ≥2 orders are multi-selected from the left panel. Center shows:
- 3 large counts: **Approve** · **Confirm** · **Resolve** (number of selected orders in each bucket)
- **Execute Batch** primary CTA — runs the appropriate action across all selected orders at once
- Per-order strip listing the selected POs with their assigned actions

### State 4: Journey Complete (single)

Splash after a single order's final stage is marked complete:
- Big sage check icon
- "PO-XXXX delivered" headline
- 2-stat row: Cost saved · Labor hours saved
- Back-to-orders button (auto-clears after 4s)

### State 5: Batch Complete

Same shape as Journey Complete but aggregated across the executed batch.

---

## 1.4 Right Panel — Atlas Intelligence

Reactive to center selection. See `RIGHT-PANEL-MAP.md § 6` for the rules. Summary here:

### Persistent base sections

- **Atlas header** — name + sparkle + green pulse + adaptive subtitle ("Logistics intelligence · Live" / "Agent model · PO-XXXX" / "Batch analysis · N orders")
- **Context Questions** — 3 buttons adapting to selection
- **Chat thread** + **Chat input** (pinned bottom)

### Contextual sections (appear/disappear by context)

| Section | When it appears |
|---------|-----------------|
| **Manual Takeover Copilot** | `laborMode: 'manual'`. Header "I am standing by" + Resume Agent button + Copilot Stage-Aware Hint + Manual Audit Trail badges. |
| **Digital Twin Simulation** | New-supplier orders. Cost reduction (% or Rp) + Lead time delta (days) comparing new vs existing. |
| **Agent Reasoning** | Single order selected. The `managedBy` agent's natural-language explanation. |
| **Embedded Finance** | Finance insight available. *"Factor this invoice →"* link. |
| **Batch Logic Summary** | Batch mode. 3 cards: Cold-Chain Verified · Pricing Confidence · Exceptions flagged. |
| **Batch ROI Estimate** | Batch mode. Labor hours saved · Manual steps eliminated · Projected savings. |
| **Venue Consumption Split** | Single order, multi-venue. Bar: how the delivery splits across BC/RC/ST/SP. |

### Context Question adaptive copy

| Context | Question examples |
|---------|-------------------|
| Batch selected | *"What's the risk profile of this batch?"* / *"Which orders can be auto-approved right now?"* / *"Summarize the exceptions"* |
| Single order | *"Why did you choose this logistics provider?"* / *"What's the backup plan if delivery fails?"* / *"How does {supplier} compare to alternatives?"* |
| No selection | *"Which order needs my attention most urgently?"* / *"What value is arriving today?"* / *"Any cost-saving opportunities I'm missing?"* |

### Full takeovers (replace the entire right panel)

#### Source Bridge

**Trigger:** Click "Message Supplier" from the center's tertiary action row or the ⋯ card menu.

| Element | Behavior |
|---------|----------|
| Header | "Message {supplier}" + ArrowLeft back button + channel-label subtitle |
| Channel selector | Segmented WhatsApp (#25D366) / Telegram (#0088cc); active half fills with channel color |
| Message textarea | Fills all vertical space; auto-grows |
| Send button | Channel-colored; "Send via WhatsApp" / "Send via Telegram" |
| Auto-dismiss | Closes automatically when a different order is selected |

Owned by **Vendor Comms Agent (A-03)** in narrative.

#### Audit Mode — Operations Insights

**Trigger:** Audit Mode active AND no row selected.

| Section | Contents |
|---------|----------|
| **4 KPI cards** | Processed (count + Rp spend) · On-time % · Avg cycle time (hours, PO → Delivered) · Recovered savings (Rp) |
| **Status mix bars** | Horizontal bar per status (live / completed / disputed / cancelled / on-hold) with pct fill + count |
| **Top suppliers · spend** | Top 5 suppliers ranked by total spend. **Clicking a card sets the supplier filter** on the audit list |
| **Disputes · top sources** | Suppliers with ≥1 disputed order, ranked descending (red-tinted cards) |
| **Venue mix** | Per-venue spend pie/bars (BC / RC / ST / SP / Multi) |

All insights scope to the current filter window — change any filter and the right panel re-aggregates.

#### Audit Mode — Quick Journey

**Trigger:** Audit Mode active AND a row is selected.

| Element | Behavior |
|---------|----------|
| Header | "Quick Journey" + PO id · supplier |
| Order detail card | Amount (large) · Stage `N/5` · `humanDescription` |
| Compact 5-stage dot rail | Done (sage) · Current (amber pulsing) · Upcoming (gray) |
| **Open Full Workspace** button | Snaps out of Audit Mode and loads the Single Order Journey |
| **Message Supplier** button | Opens the Source Bridge for that supplier |

---

## 1.5 Task Module Sheet (Modal)

Opened by clicking a stage node in the journey rail (agent mode = Review; manual mode = Execute).

### Modes

- **Review** (read-only) — agent already completed this stage. Shows data points, agent reasoning, alternatives rejected, outcome. No edits.
- **Execute** (form) — human is driving this stage in manual mode. Shows the schema for that stage (see § 1.1 Task Modules table).

### Header

| Element | Description |
|---------|-------------|
| Icon circle | Sage (agent mode) or Amber (manual mode) |
| Title | "Stage N · {Stage Name}" |
| Subtitle | PO id + supplier |
| Close button | Top-right |

### Copilot / Audit Strip (below header)

Sage bar with Sparkles icon + plain-English assistance from Atlas for this stage.

### Form Fields

Driven by the stage schema (see Task Modules table in § 1.1). Common patterns: text inputs, numeric steppers, vendor dropdowns, date pickers, photo upload (Stage 5 QC).

### Active Handshake (Delegation)

When an order is in manual mode and the user delegates a single stage back to the agent: an inline sage card appears in the form area — "Agent A-NN will handle this stage. You'll be notified when complete." Cancellable until the agent picks up the task.

### Footer Actions

| Button | Description |
|--------|-------------|
| Cancel | Closes modal without saving |
| Save Draft | Persists inputs but does not mark complete |
| Save & Mark Complete | Persists + advances the stage state |

---

## 1.6 Draft Sheet (Modal)

Opened from: Re-order action on a completed PO, or "New Draft" from the ⌘K palette.

### Modes

- **New** — empty form
- **Re-order** — pre-filled from a completed PO

### Form Fields

- Vendor (locked when re-ordering)
- Line items (table)
- Target venue (multi-select chip)
- Recurring? (checkbox → reveals frequency dropdown + next-run date)
- Labor mode (Agent / Manual)
- Notes

### HITL Gate Notice

When `recurring: true`, a sage callout: "Recurring orders run autonomously under the **Recurring (WF-REC)** playbook until the active spend cap is hit. You can pause anytime."

### Validation

- At least 1 line item required
- Target venue required
- If recurring, frequency + next-run required

### Footer Actions

| Button | Description |
|--------|-------------|
| Cancel | Closes modal |
| Submit | Creates the order and routes the user to its journey view |

---

## 1.7 ⌘K Command Palette

Fuzzy search across:
- Live orders (PO id, supplier, item name)
- Historical orders (same)
- Suppliers
- Agents (A-01 … A-05)
- Venues (BC / RC / ST / SP)

Selecting an order opens its journey. Selecting a supplier deep-links to Suppliers. Selecting an agent deep-links to Activity & Governance.

---

## 1.8 Labor Switch

Per-order toggle between **Agent** and **Manual** mode. Available from:
- Order Journey detail card (mode pill in the header)
- ⋯ menu

Switching to Manual freezes the assigned agent and routes all stage decisions to the human (via Task Module Sheet in Execute mode). The Right Panel surfaces the Manual Takeover Copilot.

Switching back to Agent ("Resume Agent") syncs any in-progress stage state and resumes autonomous operation. The Atlas chat posts a "Synced N manual inputs" confirmation.

---

## 1.9 All Admin Actions — Summary

Compiled list of every mutating action on this page (excludes navigation, filter, and read-only actions).

| Action | Where | Effect |
|--------|-------|--------|
| Approve & Execute | Center primary CTA | Advances Stage 3 → 4. |
| Confirm Delivery | Center primary CTA | Marks Stage 5 complete, runs QC outcome. |
| Contact Supplier | Center primary CTA (red) | Stage 5 fail path — opens Source Bridge pre-filled with issue context. |
| Resume Agent | Manual mode | Returns order to agent labor. |
| Advance Stage | Stage rail (manual mode) | Steps the DAG forward. |
| Stage module — Save Draft | Task Module | Saves partial manual inputs. |
| Stage module — Save & Mark Complete | Task Module | Commits and advances. |
| Override | Stage rail (long-press / ⋯) | Records `override` on the StageTrace. |
| Execute Batch | Batch Console | Runs action across all selected orders. |
| Draft Sheet — Submit | Draft Sheet | Creates a new order. |
| Repeat Order | ⋯ menu | Opens Draft Sheet in re-order mode. |
| Track Shipment | ⋯ menu | Stage-gated; selects the order's tracking state. |
| Message Supplier | ⋯ menu | Opens Source Bridge. |
| Add to Draft | ⌘K → action | Appends a SKU to the current draft. |
| Suspend per-order autonomy | (via Activity & Governance) | Out of scope here; documented in § 7. |

---

## 1.10 Flows

### New Order flow

1. User clicks "New Request" in global nav → routes to New Request wizard.
2. (See § 4 for the wizard's 5 steps.)
3. Authorize → PO lands in Orders with `stage: 1` and the right `workflowTemplate`.

### Draft Order flow

1. ⌘K → "New Draft" → Draft Sheet opens
2. User fills form, optionally toggles Recurring → Submit
3. PO created in Orders with `stage: 1`

### Re-order flow

1. User selects a completed PO in Orders
2. ⋯ → "Repeat Order" → Draft Sheet opens pre-filled with the original line items + vendor
3. User edits if needed → Submit, OR clicks **Re-order** in the journey detail card → routes to New Request Step 4 (Review) pre-filled

### Auto-mode autonomous flow (default)

Auto orders **ride the journey end-to-end without admin clicks**. The auto-progress engine (`NewOrdersPage` useEffect, 8s cadence) walks each Auto order through stages 0 → 1 → 2 → 3 → 4, halting only at real HITL gates.

**The journey detail card respects this** (Phase 6x). The action zone on a selected Auto order reads `derivedActionKind(order, effectiveStage)` — NOT the seeded `actionKind` (the wizard hard-codes `'approve'` at PO creation). So sub-cap Auto orders with no perishable QC do **not** render an Approve & Execute button. Instead they show a sage status pill:

> **A-XX · Auto** · *Driving this PO end-to-end. Currently at Stage N (label). Next advance in a few seconds.*

The five action-zone states on the journey card:

| Condition | What renders |
|---|---|
| `completedIds.has(order)` | Sage "Closed out" pill — terminal |
| `live === 'resolve-issue'` (disputed) | Red Resolve in A&G button + failure reason context |
| `live === 'approve'` (cap rule active + above threshold) | Green Approve & Execute button + red Decline |
| `live === 'confirm-delivery'` (Stage 4 perishable) | Blue Confirm Delivery button → opens Stage 4 Task Module |
| Manual mode + no gate | Amber Continue manually button → opens current stage's Task Module |
| Auto + no gate (the common case) | Sage "Agent driving · Auto" status pill — NO CTA |

`live` is `derivedActionKind(order, stage)` after gating on `actionTakenIds` (admin already cleared the gate) and `completedIds` (terminal). Each advance:

1. Writes realistic stage artifacts to `agentStageData` (policy ref, carrier, tracking, POD filename, real receiving-lead names).
2. Stamps `stageCompletedAt[orderId][fromStage]`.
3. Posts a stage-specific Atlas chat narration ("A-04 cleared the policy stack on PO-XXXX. Policy ref POL-2026-YYYYY. PO PO-XXXX_PO_v1.pdf issued to {supplier}.").
4. Logs an `auto: true` action entry to the action log.

When the order reaches Stage 4 on a **non-perishable** basket, the engine auto-clears it (auto-QC pass → `completedIds`). Zero clicks end-to-end.

### Auto-mode HITL gates

Auto orders **only halt** at one of three gates:

| Gate | Trigger | What the admin does |
|------|---------|---------------------|
| **Stage 1 — Spend cap approval** | Cap rule (`finnsPolicyRules[id=RUL-001]`) is **active** AND `order.amount > threshold`. Default state is INACTIVE — the demo flows end-to-end. Admin enables it from A&G → Policy tab if they want segregation-of-duties for material spend. | Click **Approve** → **Approval Confirmation modal** opens (one-screen review: quote summary + policy posture + agent reasoning). Confirm → agent rides from Stage 2 onward. Cancel / Switch to Manual also available. |
| **Stage 4 — Perishable QC** | Basket contains a keyword from `PERISHABLE_KEYWORDS` (`wagyu`, `sashimi`, `burrata`, `foie`, `oyster`, `mb7`). | Click **Confirm Delivery** → Stage 4 Task Module opens. Admin uploads POD photo, sets QC outcome (pass / fail / conditional), names the receiving staff, then Mark Complete → order goes terminal. |
| **Disputed orders** | `order.status === 'disputed'`. | Click **Resolve Issue** → routes to Activity & Governance with `#dispute=PO-XXXX`. Dispute panel governs the resolution. |

The priority feed (left panel "Needs Your Action" card) is **derived from current state, not seeded group**. An order shows up there iff `derivedActionKind(order, effectiveStage)` returns a non-null value. Once the admin clears the gate, the order leaves the priority feed via `actionTakenIds` (Approve) or `completedIds` (Confirm Delivery / terminal).

### Single order approval flow (cap rule active)

1. PO at Stage 1 above the cap threshold → priority feed surfaces with **Approve** CTA.
2. User clicks Approve → **Approval Confirmation modal** opens.
3. Modal shows: order id + supplier + amount, the Stage 1 quote details (channel, lead time), the policy gate detail (which rule, how much over), and the agent's reasoning.
4. Confirm Approval → `executeAction(id)` runs:
   - `forceCompleteStage(id, currentStage)` advances Stage 1 → 2.
   - Order moves into `actionTakenIds` (leaves priority feed, no false "Completed" badge).
   - The auto-progress engine takes it from Stage 2 onwards.
5. Switch to Manual button (in the modal footer) — flips the entity to Manual and opens the Stage 1 Task Module so the admin fills the form themselves.

### Batch approval flow

1. User multi-selects multiple orders in Triage (cmd-click or checkbox).
2. Center morphs to Batch Console.
3. **Execute Batch** → all selected orders advance their relevant stage.
4. Batch Complete splash. (Note: the Approval Confirmation modal is per-order; batch execute still uses the bulk path.)

### Manual Takeover flow

1. User toggles the order to Manual mode (labor switch on the order card or in the modal).
2. Right panel swaps to Manual Takeover Copilot.
3. The priority-feed CTA changes from "Approve" to **"Continue manually"** → click opens the Stage 1 Task Module in Execute mode.
4. Admin fills the inputs (channel, lead time, quote amount — pre-filled from RFQ runtime when available per Phase 6p), saves → stage advances.
5. Repeats per stage. Stage 2: PDF + policy ref. Stage 3: carrier + tracking + ETA. Stage 4: POD + QC outcome + receiver.
6. Optional: Resume Auto at any point. The agent picks up the next un-touched stage.

### Confirm Delivery flow (Stage 4 QC)

1. Order arrives at Stage 4 with perishable items (Auto) OR admin has been driving in Manual all along.
2. Priority feed shows **Confirm Delivery** CTA.
3. Click → Stage 4 Task Module opens with the inputs: POD file upload, QC outcome (pass / fail / conditional), receiving staff name.
4. Mark Complete → `forceCompleteStage(id, 4)` + `completedIds` add → terminal.
5. On QC fail, a `finns-qc-failure` window event fires so the Suppliers page trust panel can react.

### Active Handshake (delegation within manual mode)

While in manual mode, user can delegate a single stage back to the agent without leaving manual mode entirely. Task Module shows the sage delegation card. Agent completes that one stage and returns control.

### Resumption Handshake (Manual → Agent)

When toggling back to Agent: Atlas presents "Synced N manual inputs — resuming Agent A-NN" + confirmation toast.

### Stage trace / audit flow (agent mode)

1. User clicks any complete stage node → Task Module Sheet opens in Review mode
2. User sees: agent that ran the stage, decision summary, data points used, alternatives rejected, outcome
3. Close → returns to journey

### Audit Mode — historical investigation flow

1. User clicks Maximize2 in left panel header → Audit Mode engages
2. Center collapses, left expands full-width, right shows Operations Insights
3. User filters (status / date / supplier / stage / agent / venue / workflow)
4. Clicks a historical row → Quick Journey appears in right panel (Audit Mode persists)
5. Open Full Workspace → exits Audit Mode and loads the journey

### Audit Mode — bulk export flow

1. User filters in Audit Mode
2. Selects rows (or none, for full filtered set)
3. Export CSV → downloads `orders-audit-YYYY-MM-DD.csv`

### Correction flow (Review Mode + Manual Mode)

1. Agent-mode stage shows wrong data point → user clicks Override on the stage
2. Modal: reason + corrected value
3. Save → `StageTrace.override` recorded, agent re-runs downstream if needed

---

## 1.11 Audit Mode

### Entering / Exiting

- Enter: Maximize2 button in the left panel header
- Exit: Minimize2 button OR Escape (when no row selected)
- Transition: 380ms cubic-bezier spring; left panel expands to full width, center collapses to 0 width, right panel content swaps

### Left Panel — Audit ledger

Full-width ledger combining live + historical orders. Columns: PO id · Supplier · Venue · Workflow · Category · Stage · Status · Agent · Amount · Created · ETA / Delivered.

**Secondary filter row** (above the table):
- Search input (auto-focus)
- Status chips (All / Live / Completed / Disputed / Cancelled / On-Hold) with live counts
- Date range presets (7d / 30d / 90d / All)
- Supplier dropdown
- **Stage band dropdown** (5-stage DAG, keyed to data range 0–4):
  - `Procurement · Stages 1–2` → dagStage 0–1 (Request + Quote/Vendor Confirmed)
  - `Fulfillment · Stages 3–4` → dagStage 2–3 (PO Approved + In Transit)
  - `Receiving · Stage 5` → dagStage 4 (Delivered & Checked)
- Agent dropdown (A-01 … A-05)
- Venue dropdown (BC / RC / ST / SP / Multi)
- Workflow dropdown (WF-STD / WF-RSH / WF-REC)
- Clear filters

### Table view (default)

Uses **Archetype A — Selection Data Grid** (see DESIGN.md).

**Row click behaviour (Phase 6u)**: Any row click — live OR historical — keeps Audit Mode expanded and surfaces the Quick Journey card in the right panel. The Quick Journey carries a **status-aware primary action button** so the admin can act without leaving the audit context:

| Row status | Primary action | What it does |
|------------|----------------|--------------|
| `completed` | Re-order this PO | Carbon-copies into New Request with `#intent=express&mode=reorder&from=...` |
| `disputed` | Resolve in A&G | `#dispute=PO-XXXX` → Activity & Governance dispute panel |
| `on-hold` | Review hold in A&G | Same route as disputed for the demo |
| `cancelled` | Re-order from scratch | Same carbon-copy route as completed |
| `live` | Open Full Workspace | Collapses Audit Mode and loads the Single Order Journey |

Secondary actions always available:
- **View reasoning** — opens the **Reasoning Chain modal** locally. Shows top-level agent narrative, per-stage logic up to current effective stage (Trigger / Proof / Verified-at), and the unified action-log entries filtered to this PO. Closes back to Quick Journey + Audit Mode intact. No navigation away. Available on the non-audit Single Order Journey too (Phase 6w) — sits in the tertiary action row next to Track / Message supplier / Repeat order.
- **Message Supplier** — opens the Source Bridge thread as a right-panel takeover. Works in Audit Mode (right-panel render condition handles the bridge takeover in either mode).

The previous behaviour — live rows silently collapsed Audit Mode, historical rows had a broken Quick Journey, View reasoning navigated to a context-less A&G page, Message Supplier did nothing — is fixed.

**Reasoning Chain modal — action-log dedupe (Phase 6w)**: The action log can carry multiple `po-stage-advance` entries for the same `(poId, fromStage→toStage)` pair when the auto-progress engine re-fired across sessions (pre-6w, `forceCompletedStages` didn't persist). The modal deduplicates on event signature — stage-advances dedupe on `kind::fromStage->toStage`, other events dedupe on `kind::summary` — so the user sees the canonical timeline rather than a wall of repeats. Persisted state in 6w prevents the duplicates from accumulating going forward.

### Grid view

Toggle in the audit header. Cards instead of rows; same data.

### Right Panel — Audit Mode

See § 1.4 Right Panel — Audit Mode subsections (Operations Insights / Quick Journey).

### Audit-Mode state (component-local)

- `auditOpen: boolean`
- `auditFilters: { status, date, supplier, stage, agent, venue, workflow, search }`
- `auditSelected: Set<orderId>` (for export)
- `auditViewMode: 'table' | 'grid'`

### Orders page persisted state (Phase 6w)

Order-lifecycle state survives page reload via `localStorage` (via `usePersistedJSON` / `usePersistedSet` hooks in `NewOrdersPage.tsx`). Without persistence the auto-progress engine RE-FIRED on every mount: seeded `dagStage` was the starting point each time, so PO-3041 walked 1→2→3→4 again and logged three new `po-stage-advance` entries per session. Now the engine reads the already-advanced state and halts at the appropriate gate (perishable QC, dispute, etc.) so the action log doesn't pollute.

Persisted keys:

| Key | Shape | Purpose |
|---|---|---|
| `finns-orders-completedIds` | `string[]` | Terminal orders (sage Completed badge sticks). |
| `finns-orders-actionTakenIds` | `string[]` | Auto orders where the admin cleared the gate; they've left the priority feed but aren't terminal. |
| `finns-orders-laborMode` | `Record<orderId, 'auto' \| 'manual'>` | Per-PO labor switch. |
| `finns-orders-forceCompletedStages` | `Record<orderId, stageIndex>` | Furthest stage marked complete (by user or engine). |
| `finns-orders-manualStageData` | `Record<orderId, Record<stage, Record<field, value>>>` | Admin Task Module entries. |
| `finns-orders-agentStageData` | `Record<orderId, Record<stage, Record<field, value>>>` | Auto-progress engine artifacts (PO PDF, policy ref, carrier, etc.). |
| `finns-orders-stageCompletedAt` | `Record<orderId, Record<stage, ISO>>` | Real timestamps for the audit Paper Trail. |

---

## 1.12 Deep-Link Hash Reader

On mount and on every `hashchange`, Orders inspects `window.location.hash`:

| Hash form | Effect |
|-----------|--------|
| `order=PO-XXXX` (real id, live or historical) | Sets `selectedOrderId`. If live → loads Single Order Journey. If historical → enters Audit Mode and surfaces Quick Journey. Hash is cleared. |
| `order=PO-XXXX` (unknown id) | Amber `toast.warning("{id} isn't a known order")`. Hash is cleared. |

> The `#decision=DEC-XXX` hash and the sessionStorage `buyamia-trail-return` marker pattern from earlier iterations are **not** read by this page. Decision Attribution Trail and TrailReturnPill are deprecated.

---

## 1.13 Mode-Awareness · Manual Baseline Audit

> ⚠ The 3-tier `Off · Assist · Auto` model is gone. Current model is **per-entity `manual` | `auto`** + a system-wide pause (Activity & Governance → Agents tab). Atlas chat, smart features, the Auto-progress engine — all are always on at the **platform** level; the per-PO labor switch decides what runs on each order.

### Auto vs Manual at the order level (current behaviour)

| | **Auto (default for new POs)** | **Manual** |
|---|---|---|
| Stage advance | Auto-progress engine rides 0 → 4 on an 8s demo cadence. Halts only at HITL gates. | Admin clicks the stage dot or the priority-feed CTA → Task Module opens → admin fills inputs → Mark Complete advances the stage. |
| Stage artifacts (Stage 1: channel/lead/amt, Stage 2: PO PDF/policy ref, etc.) | Agent writes to `agentStageData` at advance time. Trace modal shows real values attributed to the agent. | Admin writes to `manualStageData` in the Task Module. Trace modal shows real values attributed to "Admin Verified". |
| HITL gates that pause Auto | Cap rule (if active) + perishable QC at Stage 4 + disputed orders. Nothing else. | N/A — every stage is admin-driven by definition. |
| Priority-feed CTA | "Approve" → Approval Confirmation modal (sign-off only). "Confirm Delivery" → Stage 4 Task Module. "Resolve Issue" → A&G. | "Continue manually" → opens the next stage's Task Module. "Confirm Delivery" → Stage 4 module (same as Auto). "Resolve Issue" → A&G. |
| System-wide pause (`agentsPaused`) | Halts auto-progress for this PO. Resumes when the admin un-pauses. | Unaffected — Manual entities don't depend on the agent runtime. |

### The spend-cap gate is a configurable policy rule, not hard-coded

- `finnsPolicyRules[id=RUL-001]` — template `spend-cap`, scope `all`, threshold `Rp 12M`, **`active: false`** by default.
- The Orders page reads it dynamically via `activeSpendCapRule()` in `NewOrdersPage.tsx`. When inactive, no PO is gated for above-cap approval; the Auto engine rides Stage 1 → 2 without admin input.
- Admin enables the rule from Activity & Governance → Policy tab to add a Stage 1 sign-off requirement for material spend. When active, every Auto PO above the threshold lands in the priority feed with an **Approve** CTA. Clicking it opens the Approval Confirmation modal.

### Sensing surfaces + manual mechanics (always on)

- Left panel order groupings (Needs Your Action / Autonomous Flow) — derived from current state via `derivedActionKind()`, not seeded.
- 5-stage DAG rendering on every order.
- All Audit Mode filters (status, date, supplier, stage band, agent, venue, workflow, search).
- ⌘K command palette across POs / suppliers / agents / venues.
- Source Bridge (full conversation thread per PO; WhatsApp / Email channels per the Bali rule — no Telegram).
- Stage Trace modal (read-only when reviewing past stages; editable when admin switches to Manual).
- Export CSV in Audit Mode.
- Track Shipment / Message Supplier / Repeat Order ⋯ menu actions.
- Atlas right panel (header subtitle, Quote source card, Agent Reasoning, Manual Notes, Embedded Finance, Batch Logic Summary, Batch ROI, Context Questions, chat input). Never gated.

### Resolved gaps (Phase 6)

- ✅ **PO `laborMode` honours the per-PO autonomy picker** from the New Request wizard (Phase 6d). New POs land with `'auto'` or `'manual'` per the user's choice on Step 1.
- ✅ **Approve button is no longer silent**. In Auto with the cap gate active, it opens the Approval Confirmation modal (Phase 6s). In Manual, it opens the Stage 1 Task Module.
- ✅ **Confirm Delivery opens the Stage 4 Task Module** (Phase 6s) so the admin uploads the POD photo and sets QC outcome before the order goes terminal.
- ✅ **Resolve Issue routes to Activity & Governance** (Phase 6p) — disputes are governed there, not silently resolved in Orders.
- ✅ **Auto-progress engine writes real stage artifacts** to `agentStageData` (Phase 6r). Trace modal shows actual values with proper Agent attribution, not hash-synthesised data.
- ✅ **Stage 1 Task Module pre-fills from RFQ runtime** when the PO has `fromRfqId` (Phase 6p).
- ✅ **Source Bridge as full conversation thread** (Phase 6p) — inbound quote + admin messages + synthesized vendor replies, persisted per PO.

### Open backlog

1. **Batch Console** still fires agent execution per order. No per-order Approval Confirmation modal in batch mode — bulk Execute is one click for the whole batch. Could be an option for material-spend batches.
2. **`synthesizeStageHistory` is still the fallback** for historical orders that never had agent writes. Realistic enough for the demo, but the audit narrative is generic — could be enriched with category + workflow context.
3. **Manual stage forms** still ask the admin to type values that are derivable (carrier defaults per category, ETA defaults to seven days out, etc.). Pre-fill with editable defaults rather than blanks.
4. **No "downgrade to Manual mid-journey" preserves agent data** — when the admin flips an Auto PO to Manual at Stage 3, the agent-written Stage 1/2 data is shown read-only in Review mode, but Stage 3 onwards starts blank. The admin has to re-derive carrier/tracking. Could carry forward the agent's defaults.

---

# 2. Overview Page

The Overview page is the **morning landing** — the first thing the Procurement Manager sees on opening the platform. It surfaces what needs attention today and lets the user drill into critical actions or browse the logistics calendar.

---

## 2.1 Data Model

### Critical action item

```ts
type CriticalAction = {
  id: string;
  kind: 'po-needs-approval' | 'sku-stockout-imminent' | 'qc-fail' | 'dispute-open' | 'recurring-due';
  poId?: string;
  skuId?: string;
  venue: VenueTag[];
  message: string;        // plain-English one-liner
  urgency: 'high' | 'medium' | 'low';
  agentId?: string;       // recommending agent
  savingsAtRisk?: number; // optional IDR value
};
```

### Calendar event

```ts
type CalendarEvent = {
  id: string;
  type: 'delivery' | 'expiration' | 'restock-deadline' | 'recurring-trigger' | 'budget-checkpoint';
  date: ISODate;
  title: string;
  poId?: string;
  venue: VenueTag[];
  status: 'upcoming' | 'today' | 'past';
};
```

### KPI cards (top of Analytics state)

| KPI | Source |
|-----|--------|
| Spend MTD | Rolling sum across all venues |
| Open POs | Count of `status: 'live'` orders |
| Savings locked | Sum of confirmed savings across closed POs this month |
| Autonomous % | % of POs running without manual intervention |

### Monthly Spending Trend

12-month line chart with confidence band on the next 2 months (Spend Watchdog forecast). Hover for monthly breakdown.

---

## 2.2 Left Panel — Triage Queue

Compact card list of today's critical actions, sorted by urgency. Each row is a small OrderCard variant:
- Status icon + headline ("Approve PO-3041" / "Stockout: Yellowfin Tuna (BC)" / "QC Fail on PO-3045")
- Venue chips
- Recommended agent badge
- Click → opens the PO Workspace state in the center

Header: "Action queue" + count badge. Section Label Badge (amber).

---

## 2.3 Center Panel

Morphs through 4 states.

### State 1: Analytics (default)

- 4 KPI cards (see § 2.1)
- Monthly Spending Trend chart
- Below the chart: **Top supplier spend** mini-bar chart (top 5)
- **Per-venue spend split** mini-bar (BC / RC / ST / SP)

### State 2: Calendar — Month / Week / Agenda

Toggle in the center panel header switches between Analytics and Calendar. Sub-toggle within Calendar switches Month / Week / Agenda.

- Month: standard 7-column grid, event dots in cells
- Week: 7 day rows with event entries
- Agenda: chronological list of upcoming events

### State 3: Event Detail

Triggered by clicking any calendar event. Center morphs to:
- Event header (title, date, venue chips, type)
- Mini 5-stage DAG for the linked PO (if applicable)
- Atlas reasoning snippet
- Clear Deadline button (if action required)

### State 4: PO Workspace

Triggered by clicking a critical action in the left queue. Center loads a compact PO journey view (same shape as Orders' Single Order Journey but with a "Open in Orders" link at top).

---

## 2.4 Right Panel — Atlas

See `RIGHT-PANEL-MAP.md § 1`. Summary:

**Always there:** Atlas header (subtitle adapts) · Live Agent Activity (rotating pulse list) · Context Questions (3 buttons, adapt to context) · Autonomous Actions Today (6 entries with savings attribution) · This Week's Impact card · Atlas chat pinned bottom.

**Morphs:**
- **No selection (default)** — adds Temporal Alerts (next 7 days) + Savings in Calendar card
- **Calendar event selected** — subtitle "Analyzing: {event}"; event-specific questions
- **PO card selected** — subtitle "Analyzing {PO ID}"; auto-posts agent reasoning

---

## 2.5 All Admin Actions — Summary

| Action | Where | Effect |
|--------|-------|--------|
| Quick Approve | Critical action card | Approves the linked PO without entering Orders |
| Clear Deadline | Event detail | Confirms / closes the deadline |
| Open in Orders | Event detail / PO Workspace header | Routes to Orders with `#order=PO-XXXX` |
| Atlas chat send | Right panel | Sends a question to Atlas |
| Toggle view (Analytics ↔ Calendar) | Center header | Swaps state |
| Calendar sub-toggle (Month / Week / Agenda) | Calendar header | Swaps calendar layout |

---

## 2.6 Flows

### Morning triage flow

1. User opens platform → Overview loads, Analytics state visible
2. Left panel shows the action queue
3. User clicks the top item → center morphs to PO Workspace
4. User clicks Quick Approve → confirmation toast, PO advances, item drops from queue

### Calendar drill-in flow

1. User toggles Calendar view → month grid
2. Clicks a delivery event → center shows Event Detail
3. Clicks "Open in Orders" → routes to Orders with `#order=PO-XXXX`

---

## 2.7 Mode-Awareness · Manual Baseline Audit

Overview is the morning landing — it must be useful in `Off` mode for a Procurement Manager who is driving everything manually. See `PLATFORM-MAP.md § 3a` for the global model.

### Sensing surfaces (always on)

- **Triage Queue** (Requires Review) — derived from threshold checks (POs needing approval, QC-fail orders, disputed POs, manual-takeover POs). Never empty just because agents are off.
- **System Alerts** — par breaches, expiring compliance docs, payment due, cold-chain SLA dips. Pure data thresholds.
- **Calendar** + all event types + Event Detail morph — observation only.
- **Monthly Spending Trend** chart with confidence band — historical data + forecast (forecast is sensing, not action).
- **4 KPI cards** — Month's Spend, Active Orders, Low Stock, Savings MTD. Even Savings MTD is a backward-looking metric; always shown.
- **Atlas right panel** — header, page-context subtitle, Atlas data summaries (Spending Pulse, Venue Mix, Forecast Confidence cards), chat input. Never gated.

### Mode-aware CTAs (action layer)

| Surface | Auto | Assist | Off |
|---------|------|--------|-----|
| Critical action card primary CTA | "Auto-approve queued in 4 min · cancel" | "Suggested: Approve PO-3041" with Approve / Defer | Manual review modal with action buttons |
| Low-stock alert | "Auto-restock queued · A-02 dispatching in 30 min" | "Suggested restock: 12kg from PT Bali Seafood" + Approve / Defer | "Stock below par — **Open New Request**" |
| Quick Approve button on system alert | One-click | One-click (confirms agent's proposal) | Opens a small confirm sheet (human is the source of truth) |
| Right-panel **Live Agent Activity** | Always rotating | Always rotating | **Empty** (no agents acting) |
| Right-panel **Autonomous Actions Today** | Shown | Shown | **Empty** |
| Right-panel **Autonomy Goal** | Shown ("8 more approvals until higher autonomy") | Shown | **Hidden** (no ladder in Off mode) |
| Right-panel **This Week's Impact** | Manual + agent actions | Same | Manual-only count + hours saved |

### Real gaps (open backlog)

1. **Right panel has no "Recent activity" feed** that includes manual actions. In Off mode the Live Agent Activity / Autonomous Actions sections go empty even though the user has been working. Fix: a unified Action Log tagged with actor (`'you' | 'A-01' | ...`), rendered with mode-aware filtering.
2. **Quick Approve assumes auto-execute.** In Assist/Off mode it should open a small confirm sheet capturing the human's reasoning rather than firing instantly.
3. **CTA copy on every flagged item is hardcoded** to "auto-restock queued" / agent-flavored language. Should switch based on `useAutonomyMode()`.
4. **No manual-source for Triage Queue items.** Today the queue is filled from `CRITICAL_ACTIONS` mock data that assumes agent-flagged origin. Should derive from raw conditions (par breach, compliance expiry, deadline approaching) so the same items show in all modes.
5. **No "Pin this" / "Add to today's priorities"** affordance — the user can't curate their own queue.

---

# 3. Inventory Page

The Inventory page is the **stock heartbeat** — the operational backbone for kitchen and bar restock. Two modes (Triage / Audit) and a SKU workspace that morphs from the velocity map.

---

## 3.1 Data Model

### SKU

```ts
type SKU = {
  id: string;                  // "SKU-0421"
  name: string;                // "Yellowfin Tuna, sashimi grade"
  category: Category;
  venues: VenueTag[];          // which venues consume this
  uom: string;                 // "kg" / "L" / "case"
  onHand: number;
  par: number;                 // target floor
  parFloor?: number;           // hardened safety threshold (>par when set)
  burnRate: number;            // units consumed per day (rolling 14d avg)
  daysOfCover: number;         // onHand / burnRate
  agent: string;               // assigned restock agent (typically A-02)
  laborMode: 'agent' | 'manual';
  latestPO?: string;           // most recent PO id for this SKU
  archived?: boolean;
  failedIntent?: {             // when a restock was dismissed via data edge
    at: ISODate;
    reason: string;
  };
};
```

### Stage Trace per SKU

The Stage Trace modal renders the 5-stage journey of the SKU's latest PO (`latestPO`).

### Heartbeat Group (Audit Mode)

Groups SKUs by category × venue for macro-portfolio insights:
```ts
type HeartbeatGroup = {
  category: Category;
  venue: VenueTag | 'Multi';
  skuCount: number;
  totalValueIdr: number;
  burnRateAvg: number;
  daysOfCoverAvg: number;
  health: 'green' | 'amber' | 'red';
};
```

---

## 3.2 Left Panel — Triage Mode (Stock Heartbeat)

- **Header**: "Inventory" + InfoTooltip + ⌘K trigger + Maximize2 (enter Audit Mode)
- **Search input** (filters by name / SKU / venue)
- **Critical Stock** section (Section Label Badge — Red) — SKUs where `daysOfCover ≤ 1`
- **Watch List** section (Section Label Badge — Amber) — `daysOfCover ≤ 3` and `onHand < par`
- **Healthy** section (Section Label Badge — Sage) — collapsed by default; everything else

Each row: SKU name + venue chips + onHand/par ratio + sparkline + burn-rate bar.

---

## 3.3 Left Panel — Audit Mode

Full-width SKU ledger. Columns: SKU · Name · Category · Venue · Burn rate · Days of cover · On hand · Par · Agent · Status.

Filters: Category, Venue, Status (Critical / Watch / Healthy / All), Agent.

---

## 3.4 Center Panel — Default (No Item Selected)

**Velocity Map**: bar chart of consumption forecast vs actual for the top 12 SKUs across the prior 14 days. Each bar is split by venue color (BC sage / RC blue / ST amber / SP teal).

Below the chart: **Failed Intents** strip — amber cards for any `failedIntent` SKUs (cleared by Dismiss action).

---

## 3.5 Center Panel — Item Selected Workspace

When a SKU is selected, center morphs to:

- **Item Journey** — 5-stage DAG of the latest PO
- **PAR Watch** — visual onHand / par / parFloor with a digital twin slider
- **Restock Decision Tree** — Atlas's recommendation logic in plain English ("Burn rate +18% this week, par breach in 2.3 days → recommend Rush playbook")
- **Pipeline Visibility** — list of open POs for this SKU + their stages
- **Venue Consumption Split** — donut: which venues consumed the last delivery
- **Restock Now** primary CTA (sage)
- **Add to Draft** secondary
- **Adjust** + **AI/Manual** toggle in header

---

## 3.6 Modals

### Adjust Stock

Manual count input with +/- stepper, note field, validation. Saves to `onHand`.

### Stage Trace

Read-only 5-stage journey for `latestPO`. Each stage card: agent, decision, data points, alternatives rejected, outcome. **Open PO in Orders** link at bottom (sets `#order=PO-XXXX`).

### Catalog Management

Archetype B table (DESIGN.md) — inline edit / archive / restore. New rows: SKU id, name, category, venues, uom, par.

### ⌘K Command Palette

Fuzzy search across all SKUs.

---

## 3.7 Right Panel — Atlas Intelligence

See `RIGHT-PANEL-MAP.md § 3`. Three distinct modes:

| Mode | Trigger | Content |
|------|---------|---------|
| **Triage — Item Intelligence** (default) | Normal mode | Action Log (newest pulses) · Why This Happened (agent reasoning + forecast confidence) · Market Signal card · ROI of Autonomy · Ask Atlas (3 context questions) · Chat |
| **Audit Mode + Item Selected — Quick Journey Viewer** | Click row in Audit Mode | Item summary · Full Journey button · Compact 5-stage dot rail · Quick Actions (Emergency Restock / Call Supplier / WhatsApp / Open Full Workspace) · Forecast confidence + Market Signal |
| **Audit Mode + No Item — Macro Portfolio Insights** | Open Audit Mode, nothing selected | Dead Stock Alert (red, capital tied up) · Spend Concentration (Pareto, top 3 categories) · Supply Chain Weather (4 region cards) · Per-venue dead-stock split |

---

## 3.8 Key State

- `selectedSkuId: string | null`
- `auditMode: boolean`
- `auditFilters: { category, venue, status, agent, search }`
- `parFloorPreview: number | null` (digital twin slider)
- `failedIntents: Record<skuId, FailedIntent>`

---

## 3.9 Actions

| Action | Effect |
|--------|--------|
| Restock Now | Navigates to New Request with `#restock=SKU&items=...&vendor=...`, urgency=urgent |
| Adjust | Opens Adjust Stock modal |
| Add to Draft | Appends to current ⌘K draft |
| AI / Manual mode toggle | Switches laborMode for this SKU |
| Resume Agent | Sets laborMode back to agent |
| Open Stage Trace | Opens Stage Trace modal |
| Full Journey | Exits Audit Mode, loads SKU workspace in center |
| Open PO in Orders | Sets `#order=PO-XXXX`, navigates to Orders |
| Dismiss Failed Intent | Clears the failedIntent banner |
| Set as Par Floor | Persists slider value as new `parFloor`, shows Hardened Banner (3.2s) |
| Catalog Add Row / Edit / Archive | Catalog Management mutations |
| New Request | Navigates to New Request wizard |
| Open Activity (per agent) | Sets `#agent-NN`, navigates to Activity & Governance |

---

## 3.10 Flows

### Restock flow (agent-initiated)

1. Restock Agent (A-02) detects par breach → SKU surfaces in Critical Stock
2. Atlas Item Intelligence recommends Rush playbook
3. User clicks Restock Now → routes to New Request Step 1 with prefilled items
4. Wizard runs → PO lands in Orders

### Manual restock flow

1. User notices SKU stockout risk before agent → clicks SKU → Item Workspace
2. **Add to Draft** → ⌘K Draft Sheet
3. Submit → PO created

### Restock dismissed flow (data edge in)

1. User starts a restock from Inventory
2. In the wizard, dismisses the inventory-prefilled banner
3. Wizard dispatches `finns-restock-intent-failed`
4. Inventory shows amber banner on that SKU next time it's opened
5. User clicks Dismiss → banner clears

### Par hardening flow

1. User opens Item Workspace, drags the par slider higher
2. Sees risk preview update
3. **Set as Par Floor** → Hardened Banner appears (3.2s auto-dismiss)
4. `parFloor` updates; future Restock Agent recommendations use the new floor

---

## 3.11 Mode-Awareness · Manual Baseline Audit

Inventory must be fully usable in `Off` mode — every SKU adjustment, par floor change, restock decision must be doable without an operating agent. See `PLATFORM-MAP.md § 3a` for the global model.

### Sensing surfaces (always on)

- **Stock Heartbeat groupings** (Critical / Watch / Healthy) — threshold-based, pure data.
- **Velocity Map** chart (consumption forecast vs actual, burn-rate bars, venue split).
- **PAR Watch** widget on Item Workspace (digital twin slider).
- **Item Journey** 5-stage DAG of the latest PO — read-only state display.
- **Pipeline Visibility** — list of open POs for the selected SKU.
- **Failed Intent banner** — when a restock-from-Inventory got dismissed, the SKU surfaces an amber alert. Pure data signal.
- **Audit Mode** + all filters + ⌘K palette.
- **Atlas right panel** — header, page-context subtitle, data summaries (Market Signal observation card, ROI of Autonomy backward-looking metric, venue consumption split), chat input. Never gated.

### Pure manual UIs (always work)

- Adjust Stock modal (manual count, +/-, note).
- Set as Par Floor (digital twin slider → lock).
- Catalog Management modal (Add / Edit / Archive SKUs).
- Restock Now button — opens New Request prefilled.
- Add to Draft — append a SKU to the current draft PO.
- Open PO in Orders deep link.

### Mode-aware CTAs (action layer)

| Surface | Auto | Assist | Off |
|---------|------|--------|-----|
| Critical SKU card | "Auto-restock queued by A-02 · ETA 30 min" | "Suggested restock: 12kg · A-02 drafted PO" + Approve / Defer | "Stock below par. **Open New Request →**" — pure manual CTA |
| Restock Decision Tree | A-02 reasoning ends "→ auto-queued" | Reasoning ends "→ proposed for review" | Reasoning **hidden**; only raw facts shown (burn rate, par, days of cover) |
| Right-panel Action Log | Agent actions ("A-02 restocked SKU-0421") | Mix: agent suggestions + your approvals | Your actions only ("You adjusted SKU-0421 to 8kg") |
| **Auto-Reordered** badge on SKU card | Shown when applicable | Hidden (suggestions don't get badges) | Hidden |
| Per-SKU labor mode toggle (Agent / Manual) | Useful override | Useful override | **Hidden** — global mode already enforces manual |

### Real gaps (open backlog)

1. **Right-panel Action Log is agent-only.** Doesn't log manual actions. Same fix shape as Overview: unified actor-tagged log filtered by mode.
2. **Stage Trace modal synthesizes agent-attributed history.** For POs progressed manually, stage rows should show user actor + free-text note rather than fabricated agent activity.
3. **Critical SKU card hardcoded copy** ("auto-restock queued") doesn't switch based on mode.
4. **Per-SKU labor toggle visible in Off mode** even though it has no effect.
5. **"Auto-Reordered" badge** drops silently in Off mode without alternative status indicator.

---

# 4. New Request Page

The 5-step sourcing wizard. The center panel morphs entirely per step. Express modes (re-order / restock) pre-fill state and may jump straight to Review. The wizard supports three sourcing patterns (single-vendor direct, multi-vendor manual split, multi-vendor RFQ award) and can mint **one or N POs** in a single authorization.

---

## 4.1 Data Model

### Wizard local state

```ts
// Step 1 — basket
interface LineItem {
  id: string;                  // stable client-side id (Date.now() based)
  name: string;
  category: FinnsCategory;
  qty: number;
  unit: string;                // free-text; defaults to detected unit
  unitPriceIdr: number;        // 0 if user left it blank — budget hint, not invoice price
  venues: VenueTag[];          // BC / RC / ST / SP; multi-tag allowed
}

// Step 1 — per-PO autonomy choice (locks before Step 2's auto-pre-pick)
type PoAutonomy = 'auto' | 'manual';   // default = system autonomy, overridable

// Step 2 — sourcing path
type SourcingPath = 'pick' | 'rfq';
// selectedVendors: string[]  — multi-select on Path A
// wizardRfqId: string | null — points at the in-flight RFQ on Path B

// Step 2 — Path B award outcomes (one entry per awarded vendor)
interface AwardedQuote {
  vendorId: string;
  vendorName: string;
  itemIds: string[];           // items locked to this vendor by this award
  totalIdr: number;
  leadTimeDays: number;
  channel: 'whatsapp' | 'email';
  receivedAt: string;
  rfqId: string;
  poId: string;                // mint-time id; updated again at Step 5 Submit
  amContact: string;
  note?: string;
}
// awardedQuotes: AwardedQuote[]
```

### Express mode hash inputs

| Hash | Behavior |
|------|----------|
| `#restock=SKU&items=...&vendor=...` | Restock express. Pre-fills items, sets urgency=urgent, lands on Step 1 with banner. |
| `#intent=express&mode=reorder&from=PO-XXXX&vendor=...&items=...` | Re-order express. Pre-fills everything, jumps to Step 4 (Review). |
| `#intent=express&mode=blank` | Manual express. Empty state. |

---

## 4.2 Left Panel — Draft Summary

Compact draft summary that updates as the wizard progresses. Sections:

- **Request** name
- **Items** (first 5; +N more chip if longer)
- **Playbook** badge + name
- **Target venues** chips (when set on Step 3)
- **Primary vendor** name + region + composite (when one is selected on Path A)
- **Subtotal** in IDR

The header carries `Step N/5 · {step label}`. The step indicator at the top of the center panel (sage dots + amber pulse on current step) is the real navigation control — click any completed step to jump back.

---

## 4.3 Center Panel — 5 Steps

### Step 1 — Items

**Inputs**
- Request name (required) + free-text Context
- Line items table — each row carries name + category + qty + unit + budget hint + venue chips
- Add-line panel with smart-detect autocomplete (A-01 fills category / unit / typical venues as the user types — always on, not gated by autonomy)
- **Per-PO autonomy picker** — `Auto · AI agent` vs `Manual · you drive`. Default reads the system-level autonomy; the user can override per PO. This setting drives:
  - whether Step 2 auto-pre-picks the top-suggested vendor
  - whether the Step 5 success copy says "A-04 takes Stage 3" vs "Route to Orders"
  - whether new POs land with `laborMode: 'auto'` or `'manual'`
- Playbook selector — `WF-STD` / `WF-RSH` / `WF-REC` (one chip per row, sage badges)

**Inline Atlas insights (always on, in the center column)**
- **Atlas · Market Price Trends** banner at the very top of Step 1 — synthesized 30d trend across the basket. Per-item ↓/↑ chips + a recommendation ("Lock pricing now to capture the dip" / "Pricing pressure on the upside — lock now to cap risk"). Hidden when the basket is empty.
- **Atlas · Suggested Items** card between Line Items and the autonomy picker — items that frequently co-occur with the current basket categories. Each row has `[+ Add]` that drops the item into the basket. Hidden when there are no remaining suggestions.

### Step 2 — Vendors

**Sourcing path picker** (two big buttons at the top, only visible before an RFQ is in flight):
- `I know my vendor` → **Path A**, the approved directory.
- `Compare quotes (RFQ)` → **Path B**, opens the multi-vendor RFQ composer.

#### Cross-category guard

When the basket spans ≥2 categories AND no single vendor in the directory covers them all, an **amber banner** mints above the directory before any vendor is picked. Three CTAs:

1. **Auto-split into N POs →** flips `splitMode` on and skips straight to Step 3. A-01 has greedily grouped items by top-suggested vendor.
2. **Send a multi-vendor RFQ** opens the RFQ Composer with the basket pre-filled.
3. **Pick vendors manually →** dismisses the banner — the directory below supports multi-select; the user can compose the same vendor-set themselves.

#### Path A — Direct vendor pick (multi-select)

- The approved directory ranks by category overlap + composite + SLA (handled by `suggestVendorsForItems()`). "Match" badges flag A-01's top hits; a divider separates them from the rest.
- Each row shows composite + on-time % + cold-chain % + lead time + categories + venues served.
- **Coverage chip** (only when items span ≥2 categories): `✓ Covers all` (sage) or `Covers X/Y` (amber).
- **Team Note chip** appears when an admin has left a note on that vendor (read-only here; editable on Suppliers).
- **Multi-vendor selection** — clicking a vendor toggles them in/out. With 2+ vendors picked, a **Vendor Assignment card** mints below the directory:
  - Each picked vendor (in pick order) greedily claims items in categories they cover. Picks are labeled `Selected #1`, `Selected #2`, ….
  - Per-PO breakdown rows show the items each vendor will receive (qty + unit + name).
  - **Unassigned bucket** flags items no picked vendor can supply — these block Authorize on Step 4 until the user picks a vendor that covers them.
  - Selecting a vendor on Path A while `splitMode` was on auto-clears `splitMode` (the user's manual pick wins over the auto-split).
- **Atlas inline insight** when exactly one vendor is selected: `A-01 · {vendor name}` summarizes past interaction count + on-time % + a recommended buffer.

#### Path B — RFQ composer + tracker

- **RFQ Composer modal** (Phase 6j category-aware) — vendors are grouped into tiers:
  - *Tier 1: Cover all categories* (when the basket spans 2+ and any vendor covers them).
  - *Tier 2: Per-category lists* — one section per missing category.
  - Each row carries a `Quotes on N/M` chip and a "Will quote on: …" item list so the user knows what each vendor will be asked to bid on.
- On send, the composer creates an `RFQRecord` and the wizard transitions to a **waiting view** in place of the directory:
  - Per-vendor quote rows arrive live (mock latency 10–30s). Each shows price, lead time, channel pill (WhatsApp / email), and the "Quote covers: …" item list.
  - **Progress meter** at the top: `X/Y items awarded` + sage progress bar.
- **Award** mints a PO immediately at Stage 1 with the awarded items only. The wizard supports **multi-award**: each vendor's quote can be awarded independently, locking only the items in that quote (already-awarded items are filtered out). Once every item has an award, the wizard auto-advances to Step 3. Until then it stays on Step 2 so the user can award the remaining vendors.
- **Cancel RFQ** is disabled once any award has minted a PO draft.

### Step 3 — Delivery

- Target venue chips (multi-select; default `BC + RC`).
- Delivery window — target date + flex days (number input).
- Receiving contact + special instructions.
- For `WF-REC` only: Recurring schedule toggle + frequency (weekly / biweekly / monthly).

**Award context banner** (when arrived via Path B):
- Single award: vendor name + amount + lead time + channel (WhatsApp / email) + AM contact.
- Multi-award: header `N vendors · N PO drafts · total Rp X.XM` + per-PO rows listing items each draft will carry. *"Delivery details below apply to **all drafts**."*

**Atlas · Logistics Intel** (`A-05`):
- **Single-vendor** flow: day-of-week + catalog lead + on-time / cold-chain % + flex-window assessment chip (`tight` / `ok` / `comfortable`). Surfaces conflicts when other POs are already landing the same date.
- **Multi-vendor** flow (any of multi-award, auto-split, or manual split): header `A-05 · Logistics Intel · N vendors` + per-vendor mini-summaries (one card per leg) + a top-level "tight on N legs" warning if any leg has zero flex.

### Step 4 — Review

**Atlas · Ready to Launch / Review Before Launch** banner at the top — green when every policy check passes, amber when any check is `review` or `warn`. Includes spend-cap headroom (`Cap headroom after this PO: Rp X.XM`) or excess line (`This PO exceeds the cap by Rp Y.YM`).

**Authorize Procurement summary card** — 7 rows:
- Request name
- Items (count + IDR subtotal; uses multi-award total when applicable)
- Playbook
- Vendor / Vendors (label adapts: `Primary Vendor` for single, `Vendors` + `N vendors · N PO drafts` for multi-PO modes)
- Target venues
- Target date + flex window
- Recurring (yes/no + frequency)

**Per-vendor breakdown** — minted under the summary in any of the three multi-PO modes:
- *Multi-award RFQ* — one row per `awardedQuotes` entry (PO id, vendor, total, lead time, items).
- *Auto-split* — one row per `proposedSplits` group (`PO N`, vendor, total, item count, items).
- *Manual split* — one row per `manualAssignments.groups` entry (`PO N`, vendor, total, item count, items) **plus** a separate warning row if any items remain unassigned.

**Single-vendor coverage warning** (amber card) — fires only on Path A when the picked vendor doesn't cover every category in a cross-category basket. CTAs: "Switch to auto-split" or "Back to vendor pick".

**Auto-split / combine toggle** (amber→sage card) — when `proposedSplits.length > 1`, lets the user pick between "Split into N POs" and "Send as one combined PO". The split detection runs against the basket continuously.

**Audit Checklist** — sage card with 6 ticks (display-only; the real checks run on `policyPreview`):
1. Vendor trust score above floor (70)
2. Spend cap headroom available for this category
3. Par alignment with current inventory state
4. Venue receiving windows respected
5. FX lock applied to USD line items (where applicable)
6. No conflict with active recurring schedule

**Authorize gate** — the Authorize button is **disabled** in two cases, with an amber "Authorize blocked" banner:
- *Manual multi-vendor with unassigned items* — pick a vendor that covers the missing categories, or remove those items.
- *Single vendor on a cross-category basket without full coverage* — pick another vendor or switch to auto-split.

Authorize button copy adapts:
- Multi-award RFQ → `Authorize · Finalize N POs`
- Auto-split → `Authorize · Create N POs`
- Manual multi-vendor → `Authorize · Create N POs`
- Single vendor, `auto` autonomy → `Authorize · Hand off to A-04`
- Single vendor, `manual` autonomy → `Authorize · Route to Orders`

### Step 5 — Done

- Sage check icon + headline (`PO Authorized` for single, `N POs Authorized` for multi-PO modes)
- Subline adapts: multi-award routes "from RFQ X · N vendors", auto/manual split says "Each PO is at Stage 2 awaiting your Approve & Execute", single-vendor `manual` says "You drive every downstream stage", single-vendor `auto` says "{Agent} picks it up at Stage 2 within policy"
- Auto-routes to Orders with `#order={first PO id}` after 1.4s

---

## 4.4 Right Panel — Atlas Copilot

See `RIGHT-PANEL-MAP.md § 3`. Subtitle is `"Step N · {step name}"`. Content morphs per step (the right panel still holds the slower-burn cards — the *fast* per-step insights that shape the choice the user is making are inline in the center, per Pillar 3 Proximity of Action):

| Step | Cards |
|------|-------|
| 1 | **Strategic Intent** (sage AgentCTA — "Describe why…") + **Spending Pulse** mini bar + **Category mix** (when items exist) + **Similar past POs** (when matching action-log entries exist) |
| 2 | **Vendor Reliability** card for the primary vendor (composite / on-time / cold-chain bars + AM WhatsApp) + **VendorNotePanel** (read-only team note from `entityNotes`) |
| 3 | **Logistics Risk Map** (Java monsoon · Tanjung Priok · Bali-local) + **Venue Lane Preferences** reminder |
| 4 | **Audit Summary** (6-row mini-summary) + **Policy preview** card listing each active rule's status (`pass` / `review` / `warn`) — this is what A-04 will run at Stage 3 |
| 5 | **Hand-off complete** — playbook agent + Stage 2 reminder |

Express-mode opening line on first Atlas message:

| `expressMode` | Atlas line |
|---------------|------------|
| `reorder` | *"I've validated this re-order from {source}. Prices stable, vendor reliability holding at {N}, Agent A-01 ready to deploy. Skip to authorization when you're ready."* |
| `restock` | *"I've validated this restock. Critical SKU items locked, vendor pre-selected, urgency set to urgent."* |
| `blank` | *"Express lane open. Add line items below — I'll validate prices against the 30-day market median in real time."* |

---

## 4.5 Actions

| Action | Where | Effect |
|--------|-------|--------|
| Next / Back | Step navigation | Advances or reverts step |
| Step indicator click | Stepper | Jump back to a prior step |
| Add item / Remove item | Step 1 | Line item mutation |
| `[+ Add]` on Atlas suggestion | Step 1 complementary card | Drops the suggested item into the basket |
| Smart-detect chip click | Step 1 add panel | Accepts A-01's category/unit/venue autofill |
| Per-PO autonomy button | Step 1 | Sets `poAutonomy` for this PO (`auto` / `manual`) |
| Playbook chip | Step 1 | Sets playbook (WF-STD / WF-RSH / WF-REC) |
| Path picker (Pick / RFQ) | Step 2 | Sets `sourcingPath` |
| Cross-category CTA — Auto-split | Step 2 banner | Sets `splitMode = true`, jumps to Step 3 |
| Cross-category CTA — Send RFQ | Step 2 banner | Opens RFQ Composer |
| Cross-category CTA — Pick manually | Step 2 banner | Dismisses banner; multi-select directory remains active |
| Vendor row click | Step 2 (Path A) | Toggles the vendor in/out of `selectedVendors`. Clears `splitMode`. |
| Open RFQ Composer | Step 2 (Path B) | Opens the composer modal |
| Send RFQ | RFQ Composer | Creates an `RFQRecord`, dispatches mock vendor replies, returns to Step 2 waiting view |
| Award (per quote) | Step 2 waiting view | Appends an `AwardedQuote`, mints a PO, advances to Step 3 only when every item is covered |
| Cancel RFQ | Step 2 waiting view | Cancels the RFQ (hidden once any award has minted a PO) |
| Venue chip | Step 3 | Toggles target venue |
| Date / flex pickers | Step 3 | Sets delivery window |
| Receiving contact / special instructions | Step 3 | Free-text inputs |
| Recurring toggle + frequency | Step 3 (WF-REC only) | Sets recurring schedule |
| Authorize | Step 4 | Mints the PO(s), advances to Step 5. **Disabled** by the Authorize gate in two cases (see § 4.3 Step 4). |
| Atlas chat send | Right panel | Question to Atlas |
| Dismiss restock banner | Step 1 (express=restock) | Dispatches `finns-restock-intent-failed` |

---

## 4.6 Flows

### Standard flow — single vendor (Path A)

1. Step 1 — add items, pick playbook, set per-PO autonomy
2. Step 2 — pick a single vendor from the directory
3. Step 3 — set delivery
4. Step 4 — review summary → Authorize · Route to Orders (manual) **or** Hand off to A-04 (auto)
5. Step 5 → routed to Orders deep-linked to the new PO

### Manual multi-vendor flow (Path A, ≥2 vendors)

1. Step 1 — add items spanning 2+ categories
2. Step 2 — directory shows the cross-category banner. User clicks "Pick vendors manually" (or just ignores the banner) and picks 2+ vendors. Vendor Assignment card mints with greedy item-to-vendor assignment.
3. Step 3 — same delivery details apply to all drafts. Logistics Intel branches into per-vendor mini-summaries.
4. Step 4 — per-vendor breakdown shows the items each PO will carry; Authorize button reads `Create N POs`.
5. Step 5 → N POs minted, routed to Orders (deep-link goes to the first PO id; user navigates between them from Orders).

### Auto-split flow (cross-category, system-picked vendors)

1. Step 1 — add items spanning 2+ categories
2. Step 2 — cross-category banner shows. User clicks "Auto-split into N POs". `splitMode` flips on; wizard jumps to Step 3.
3. Step 3 — same delivery details for all auto-split POs.
4. Step 4 — per-vendor breakdown (one row per `proposedSplits` group); Authorize reads `Create N POs`.
5. Step 5 → N POs minted, routed to Orders.

### Multi-vendor RFQ flow (Path B)

1. Step 1 — add items.
2. Step 2 — pick `Compare quotes (RFQ)`. RFQ Composer opens with the basket pre-filled and vendors grouped by category coverage.
3. Send the RFQ → wizard transitions to the waiting view (live quote arrivals via `rfqStore.scheduleMockQuotes`).
4. As each quote arrives, the user can Award. Each award mints a PO immediately at Stage 1 with the awarded items only. Multi-award allowed — the wizard stays on Step 2 until every item is covered.
5. Once `allItemsAwarded` is true, auto-advance to Step 3 with the award context banner.
6. Step 3 + Step 4 + Step 5 as above; Authorize re-stamps the drafted POs with the delivery details and routes to Orders.

### Restock express flow

1. From Inventory: Restock Now → `#restock=...` → Step 1 with items pre-filled and `urgency: urgent`.
2. User confirms vendor (Step 2) or skips if pre-selected.
3. Step 4 → Authorize → Done.

### Re-order express flow

1. From Orders: Re-order on a delivered PO → `#intent=express&mode=reorder&...` → wizard jumps to Step 4 with all fields pre-filled.
2. User reviews → Authorize → Done.

### Restock dismissed (data edge out)

1. In Step 1 of a restock-express run, user dismisses the inventory banner.
2. `finns-restock-intent-failed` dispatched.
3. Inventory page shows amber alert on that SKU on next visit.

---

## 4.7 Mode-Awareness · Manual Baseline Audit

> ⚠ See the global note at the top of this doc. The 3-tier `Off · Assist · Auto` model is gone — current model is **per-entity `manual` | `auto`** + a system-wide pause. Atlas chat, Atlas inline insights, smart-detect, vendor relevance ranking, and similar-past-PO summaries are **always on**. Only *agent actions* (auto-pre-pick, auto-execute, A-04 hand-off) are gated by `poAutonomy`.

### Sensing surfaces + manual mechanics (always on, regardless of autonomy)

- The 5-step wizard mechanics: every input is typed/clicked by the user. There is no path through the wizard that skips human inputs.
- Smart-detect autocomplete (A-01) — fills category / unit / venues as the user types an item name. Always on.
- Vendor relevance ranking — `suggestVendorsForItems()` reorders the directory by category overlap + composite. Always on.
- Inline Atlas insights (Market Price Trends, Suggested Items, Vendor Intel, Vendor History, Logistics Intel, Ready to Launch). Always on.
- Cross-category detection + coverage chips on Step 2. Always on.
- Step 4 policy preview (right panel). Always on.
- Express-mode hash deep links. Always on.
- Atlas right panel — header, step-aware subtitle, step-specific cards, chat input. Never gated.

### Per-PO autonomy choices (action layer)

The Step 1 per-PO autonomy picker flips three things:

| Surface | `auto` | `manual` |
|---------|--------|----------|
| Step 2 auto-pre-pick of top-suggested vendor on Path A | Runs (when `selectedVendors.length === 0`) | Does not run — user picks every vendor |
| Step 4 Authorize button copy (single-vendor case) | `Authorize · Hand off to A-04` | `Authorize · Route to Orders` |
| Step 5 success splash copy | "{Agent} picks it up at Stage 2 within policy" | "You drive every downstream stage — agents observe + surface insights" |
| New PO `laborMode` after Authorize | `'auto'` | `'manual'` |

System-wide pause (set on Activity & Governance → Agents tab) freezes Auto entities everywhere — including any wizard-minted POs that landed with `laborMode: 'auto'`. Manual POs are unaffected.

### Resolved gaps (Phase 5 + Phase 6)

- ✅ **RFQ dispatch from inside the wizard** — Path B + RFQ Composer + tracker shipped (Phase 5a + 6j + 6k). Was the biggest open gap.
- ✅ **Multi-award RFQ** — `awardedQuotes[]` + per-quote `itemIds` + `partially-awarded` RFQ status + multi-PO submit (Phase 6k).
- ✅ **Cross-category basket detection** at Step 2 + Authorize gate at Step 4 (Phase 6i + 6m).
- ✅ **Manual multi-vendor split** on Path A (Phase 6m) — closes the loophole where a single vendor could be picked for a cross-category basket.
- ✅ **Inline Atlas insights** restored across all 4 steps (Phase 6l) — were stripped during the Buyamia → Finn's reshape; now back in the center column where they belong.

### Open backlog

1. **Atlas chat is canned.** `sendAtlas()` posts a fixed placeholder response. The cards on the right panel are real; the chat isn't yet wired to an LLM.
2. **Mid-RFQ edit lock** — user can still go back to Step 1 and mutate `items` while an RFQ is in flight. The RFQ snapshot doesn't update. Should either lock the back navigation or warn.
3. **Express-mode `restock=...` interaction with the autonomy picker.** Restock express jumps to Step 1; the per-PO autonomy picker defaults to system mode regardless of "urgency: urgent". Worth a UX pass — urgent restocks may want `manual` by default.

---

# 5. Suppliers Page

Vendor relationship center. The Fortress banner sits permanently at top — Onboard New Vendor is the only path for new vendors into the platform.

---

## 5.1 Data Model

### Supplier

```ts
type Supplier = {
  id: string;                    // "SUP-014"
  name: string;                  // "PT Bali Seafood Lestari"
  type: 'local' | 'regional' | 'import';
  region: string;                // "Bali" / "Java" / "Australia"
  categories: Category[];
  venuesServed: VenueTag[];
  laborMode: 'agent' | 'manual';
  agent: string;                 // typically A-01 (Sourcing) or A-03 (Vendor Comms)
  accountManager: { name: string; whatsapp: string; telegram?: string };
  metrics: {
    composite: number;           // 0–100
    onTime: number;              // %
    coldChain: number;           // % SLA
    quality: number;             // 0–100
    leadTimeDays: number;
    annualContractIdr: number;
  };
  status: 'active' | 'watchlist' | 'paused';
  qcAlerts: QcAlert[];           // pushed from Orders via data edge
};

type QcAlert = {
  poId: string;
  at: ISODate;
  failureNote: string;
  dismissed: boolean;
};
```

---

## 5.2 Fortress Sourcing Banner

Permanent sage banner at the very top of the page (above the three-panel layout). One-liner: "Humans are the sole gateway for new vendor data. The agent workforce cannot ingest new suppliers autonomously." CTA: **Onboard New Vendor** → routes to New Request as Manual Discovery Portal.

---

## 5.3 Left Panel — Normal Mode (Vendor Pulse, 280px)

- Header: "Suppliers" + ⌘K + Maximize2
- Search input
- **Needs Attention** section (Section Label Badge — Amber) — vendors with `status: 'watchlist'` or `qcAlerts.length > 0`
- **Active** section (sage) — `status: 'active'`
- **Paused** section (muted)

Each card: vendor name + region flag + category chips + composite score + venuesServed chip row.

---

## 5.4 Left Panel — Audit Mode (expanded, full-width)

Full ledger of all suppliers. Columns: Name · Region · Categories · Venues · Composite · On-time % · Quality · Annual Rp · Status · Agent · Kebab.

Filters: Category, Region, Venue, Status, Agent.

---

## 5.5 Center Panel — Ecosystem Hub (no vendor, no comparison)

- 4 KPI cards (Total active, Composite avg, Annual contract sum, At-risk count)
- Performance matrix scatter (composite vs on-time, color-coded by category)
- Category bar chart (vendor count per category)
- Status distribution donut
- **Venues-served distribution** mini-bars per venue

QC Failure Alerts (when active, at the top of the center): dismissible amber cards pushed from Orders.

---

## 5.6 Center Panel — Relationship Workspace (vendor selected)

- Vendor header: name, region flag, account manager, agent badge
- **Dossier toggle** (top-right) — expand/collapse the full dossier panel
- **Venues served** chips
- **Journey track** — 5-stage relationship lifecycle (Discovery → Pricing → Pilot → Active → Renewal)
- **Metrics radar** — composite, on-time, cold-chain, quality, lead-time, savings
- **Negotiation status** card
- Action row: Renegotiate Terms · Trigger Compare · Bulk Compare · New Request (from vendor) · Open Activity (Agent) · Labor Mode toggle

---

## 5.7 Center Panel — Comparison Matrix (2 vendors selected + Compare active)

Two-column matrix. Each row is a metric (composite, lead time, annual cost, savings, on-time, cold-chain). Winner highlighted per row.

---

## 5.8 Peek Sheet (Audit Mode + vendor selected)

A compact card in the right panel (instead of the full Relationship Workspace) when audit mode is active. Shows: name, score, key metrics, Open Activity link, Full Workspace button.

---

## 5.9 Journey Stage Module Modal (Manual Takeover)

When the vendor is in manual mode and the user clicks a journey stage node: schema-driven inputs for that relationship stage. Save Draft / Save & Mark Complete footer.

---

## 5.10 Right Panel — Atlas Intelligence

See `RIGHT-PANEL-MAP.md § 5`. Four distinct modes:

| Mode | Trigger | Content |
|------|---------|---------|
| **Network Overview** (default) | No vendor selected | "Monitoring N vendors across M regions. Total annual: Rp X." + Atlas insight + chat |
| **Relationship ROI** | Single vendor selected | Relationship ROI (savings YTD) · Market Benchmarking (lead time + quality vs regional avg) · Account Manager card · **Open Secure Bridge** button |
| **Bulk Action Summary** | 2+ vendors selected | Selected vendor cards · Combined Reach (total contract value + avg score) · Broadcast Announcement button |
| **Comparative Delta** | Compare active on exactly 2 vendors | "Comparative Delta · {A} vs {B}" header · Auto-narrative ("A is 2 days faster but Rp 35M/yr more expensive") · Metric Deltas (4 rows) · Message Both / Message Winner buttons |

---

## 5.11 Messaging Drawer (1-on-1 Secure Bridge)

Opens from Relationship ROI bottom. WhatsApp/Telegram toggle + transcript + compose textarea. Routes via Finn's Gateway.

---

## 5.12 Broadcast Drawer (Multi-Vendor Announcement)

Opens from Bulk Action or Comparative Delta. Target vendor pills + channel toggle + compose. "Send to N Vendors" button.

---

## 5.13 Key State

- `selectedSupplierId: string | null`
- `compareIds: [string, string] | null`
- `auditMode: boolean`
- `dossierOpen: boolean`
- `messagingOpen: boolean`
- `broadcastOpen: boolean`
- `qcAlerts: QcAlert[]` (per supplier)

---

## 5.14 Actions

| Action | Effect |
|--------|--------|
| Onboard New Vendor (banner) | Navigates to New Request |
| Vendor card click | Selects supplier, loads Relationship Workspace |
| Bulk Compare | Activates multi-select |
| Trigger Compare | Activates Comparison Matrix |
| Renegotiate Terms | Opens renegotiation flow (out of scope here) |
| Dossier toggle | Open/close dossier panel |
| Metric filter buttons | Toggle radar metrics |
| Labor mode toggle (Agent / Manual) | Switches relationship to manual |
| Resume Agent | Returns to agent mode |
| Journey stage node click (manual mode) | Opens Journey Stage Module Modal |
| Send message | Sends 1-on-1 via Messaging Drawer |
| Send broadcast | Sends to multiple via Broadcast Drawer |
| New Request from vendor | Navigates to New Request pre-filled with this vendor |
| Open Activity (per agent) | Navigates to Activity & Governance with `#agent-NN` |
| Dismiss QC Alert | Marks `qcAlerts[i].dismissed = true` |

---

## 5.15 Flows

### Vendor relationship review flow

1. User opens Suppliers → Ecosystem Hub
2. Sees vendor in Needs Attention
3. Clicks → Relationship Workspace
4. Reviews metrics, journey, account manager
5. Optional: Open Secure Bridge → sends WhatsApp / Telegram message

### Vendor comparison flow

1. User multi-selects 2 vendors → Trigger Compare
2. Center morphs to Comparison Matrix
3. Right panel shows Comparative Delta with recommendation
4. User clicks Message Winner → Messaging Drawer

### Vendor onboarding flow (Manual Discovery Portal)

1. User clicks **Onboard New Vendor** in Fortress banner
2. Routes to New Request wizard with `mode=onboard` (Step 1 pre-populated with vendor onboarding fields)
3. User completes the wizard
4. New vendor lands in the directory after manual review

### QC failure inbound flow (data edge in)

1. Orders Stage 5 dispatches `finns-qc-failure` on QC fail
2. Suppliers pushes `qcAlerts` for the affected vendor
3. Next time the user opens Suppliers, an amber alert card shows at the top of the center
4. Click → opens the vendor's Relationship Workspace pre-scrolled to the alert

---

## 5.16 Mode-Awareness · Manual Baseline Audit

The Suppliers page must be fully usable in `Off` mode — a Procurement Manager must be able to view, message, compare, broadcast, and (gap, see below) onboard vendors without any agent participation. See `PLATFORM-MAP.md § 3a` for the global model.

### Sensing + manual mechanics (always on)

- **Vendor cards** in the left panel — name, region flag, composite score, categories, status badge, venues served. All data.
- **Sidebar status groupings** (Needs Attention / Active / Paused) — derived from `vendorStatus` + `qcAlerts.length`.
- **Search input** filters cards by name / category / venue.
- **Audit Mode** + all filters.
- **Ecosystem Hub** (center default) — KPI cards, performance matrix, category bar chart, status distribution, venues-served distribution.
- **Relationship Workspace** (vendor selected) — dossier, journey track (5-stage relationship lifecycle), metrics radar, account manager card, venues served, recent orders.
- **Comparison Matrix** (2 vendors + Compare active).
- **Messaging Drawer** (1-on-1) — empty composer, user types, hits Send.
- **Broadcast Drawer** (multi-vendor) — target pills + message field.
- **QC Failure Alerts** banner at top of center panel — fires from Orders Stage 5 outcome=fail via `finns-qc-failure` data edge. Always shown.
- **Fortress Sourcing Banner** — "Onboard New Vendor" CTA always visible.
- **Atlas right panel** — header, page-context subtitle, data summaries (Relationship ROI savings YTD, Market Benchmarking lead time + quality vs regional avg, Direct Comparison narrative in Comparative Delta mode), chat input. Never gated.

### Atlas-curated data layer (always on)

- **Relationship ROI** card — savings YTD + tier narrative + grade badge (A/B+/B/C). Computed from `metrics.composite`.
- **Market Benchmarking** card — lead time vs regional avg + quality vs regional avg. Pure delta from `REGIONAL_BENCH`.
- **Direct Comparison narrative** in Comparative Delta — auto-generated from metric deltas.

### Mode-aware CTAs (action layer)

| Surface | Auto | Assist | Off |
|---------|------|--------|-----|
| **Per-vendor Labor Mode toggle** (Agent / Manual) | Useful override | Useful override | **Hidden** — global Off already locks everything to manual |
| **Open Secure Bridge** (in Relationship ROI) | Opens Messaging Drawer; A-03 may pre-draft a contextual message | Same; A-03 drafts but requires user click Send | Opens Messaging Drawer with **empty composer** |
| **Broadcast Drawer compose** | A-03 pre-fills draft based on bulk-action context | A-03 drafts, user reviews + sends | Empty composer; user writes from scratch |
| **Renegotiate Terms** button | Fires renegotiation flow (when wired) | "A-01 has drafted the opening offer — review?" | Opens a manual renegotiation workspace; user enters offer position |
| **"Initiate Renegotiation"** confirmation | Sage burst + "Agent drafting opening offer" | Same | "Renegotiation Initiated" without agent narrative |
| **Comparative Delta Recommendation card** | "Recommend: Vendor A (faster, +Rp 35M cost)" — A-01 editorial | Same — surfaced for human decision | **Hidden** (A-01 editorial; only the data deltas remain) |
| **"Message Winner"** CTA (Comparative Delta) | A-03 drafts message | A-03 drafts message | Opens Messaging Drawer with empty composer |
| **Right-panel "Recommendations"** section | A-01's recommendation text on the relationship | Same | **Hidden** — no agent recommendation |

### Real gaps (open backlog)

1. **No proper Vendor Onboarding form.** The "Onboard New Vendor" Fortress banner routes to New Request — wrong page (it's a procurement wizard, not vendor intake). Vendor onboarding needs its own 4-step manual flow: Lead → KYC docs → Banking → First-PO terms. (Already flagged in REALISM-AUDIT.md § 5 #12.) **Biggest gap on this page.**
2. **Per-vendor `agentNotes` field is the only narrative on the dossier.** Reads like agent-authored ("A-01 detected a 6.2% price gap..."). In Off mode this should fall back to user-entered notes or hide entirely. Today it renders agent narrative regardless of mode.
3. **`assignedAgent` is required on every Supplier** — no concept of "manually-managed vendor with no agent assigned." In Off mode every supplier still shows `A-NN · Role` chip. Should hide chip in Off, or render "Self-managed."
4. **Journey Stage Module modal in Manual Takeover** has copy assuming Active Handshake (agent picks up from human). In Off mode no Active Handshake should exist; the modal should be pure form input.
5. **No "Manual Action Log" per vendor** alongside `messageHistory`. Other manual actions (vendor onboarded, terms renegotiated, contract signed, score adjusted) don't get logged. Audit trail incomplete in Off mode.
6. **Manual QC-fail event dispatch unverified.** `qcAlerts` come from Orders Stage 5 failure firing `finns-qc-failure`. When a user manually marks Stage 5 as `qcOutcome: fail` (no agent involved), this event needs to fire the same way. Today this path may or may not dispatch — needs verification. **Bug-risk gap.**
7. **"Initiate Renegotiation"** is a one-click animation today; no actual renegotiation workspace exists (REALISM-AUDIT § 5 #9). In Off mode this gap is starker because there's no agent to fake the work.

### Proposed fix shape

- **Vendor Onboarding mini-wizard** (4 steps) replaces the broken "Onboard New Vendor" → New Request redirect. Manual-first design; agents (A-01) optionally enrich in Auto.
- **Mode-aware `agentNotes` fallback**: when global mode is Off, render a "Notes" surface (user-editable) instead of agent narrative.
- **`assignedAgent` becomes optional on Supplier** — type allows `null` for self-managed; chip hides when null OR when mode is Off.
- **Unified Action Log per vendor** alongside messageHistory — actor-tagged (`you | A-01 | A-03`), captures every state change on the relationship.
- **Manual QC-fail event dispatch verification**: confirm Orders' manual Stage 5 advance with `qcOutcome: fail` fires the `finns-qc-failure` event identically to the agent path. If not, add it.
- **Renegotiation workspace**: proper modal/page with opening position, vendor response field, rounds, red-line, signed amendment. Manual-first; A-01 can pre-draft in Assist/Auto.

---

# 6. Spending Page

Category grid → category detail ledger. Per-venue spend split surfaces inline.

---

## 6.1 Data Model

### Category spend

```ts
type CategorySpend = {
  category: Category;
  spentMtd: number;          // IDR
  budgetMtd: number;
  forecastMonthEnd: number;
  savingsLocked: number;
  variancePct: number;       // vs prior month
  byVenue: Record<VenueTag, number>;
  topSuppliers: { id: string; name: string; spent: number }[];
};
```

### Budget setup

```ts
type CategoryBudget = {
  category: Category;
  monthly: number;
  perVenue: Partial<Record<VenueTag, number>>;
};
```

### Locked savings ledger

```ts
type LockedSaving = {
  category: Category;
  poId: string;
  amount: number;
  lockedAt: ISODate;
};
```

---

## 6.2 Left Panel — Optimization Queue

- Header: "Spending" + InfoTooltip
- **Top opportunities** section (Section Label Badge — Sage) — categories where Spend Watchdog flagged actionable savings ("Switch Tuna sourcing to PT Bali Seafood saves Rp 4.2M/mo")
- **Watch list** section (Amber) — categories over budget or trending overspend
- Each card: category icon + headline + savings estimate + agent badge

---

## 6.3 Center Panel — Global View (No Category Selected)

7-category grid:

| Card | Color |
|------|-------|
| Protein | Crimson |
| Seafood | Cyan |
| Produce | Green |
| Dry Goods | Brown |
| Dairy | Pale-yellow |
| Beverages | Purple |
| Other | Gray |

Each card: category icon + spent MTD + budget bar (with venue mini-split below) + variance arrow + savings locked.

Below the grid: **Per-venue spend split** chart (BC / RC / ST / SP horizontal bars).

---

## 6.4 Center Panel — Category Detail View (Category Selected)

- Category header (icon, name, spent MTD, budget bar, savings locked)
- Time range toggle (1M / 3M / 6M / 1Y)
- **Per-venue spend split** for this category (bar chart)
- Ledger table: Date · PO · Supplier · Items · Venue chip · Amount · Saved
- **Lock Savings** button — accumulates verified savings into the locked tally

Back to all button (top-left).

---

## 6.5 Right Panel — Atlas Intelligence

See `RIGHT-PANEL-MAP.md § 7`. Always-on:

- **Autonomy Balance** — % agent autonomous vs % admin intervention, with progress bars
- **Agent Efficacy** — top agent per category (or focused on selected category)
- **Forecast Confidence** — 4 metrics (next month spend / savings estimate / drift detection / stockout probability)
- **Venue mix** — current month's per-venue spend split (mini bar)
- Atlas chat pinned bottom

**Morph: Category selected** — adds 3 Atlas suggested prompts (category-specific), Agent Efficacy collapses to that category only.

---

## 6.6 Key State

- `selectedCategory: Category | null`
- `timeRange: '1M' | '3M' | '6M' | '1Y'`
- `budgetModalOpen: boolean`
- `lockedSavings: LockedSaving[]`

---

## 6.7 Actions

| Action | Effect |
|--------|--------|
| Category card click | Opens Category Detail |
| Back to all | Returns to grid |
| Time range toggle | Filters ledger |
| Lock Savings | Persists saving to ledger |
| Budget Setup | Opens Category Budgets modal |
| Atlas prompt suggestion | Pre-fills chat |
| Atlas chat send | Sends question |

---

## 6.8 Key Flows

### Monthly budget setup flow

1. User clicks Budget Setup → modal opens with 7 category fields + per-venue allocation
2. Fill values → Save → budget tracked for the month

### Category investigation flow

1. User sees Protein over budget (red variance arrow)
2. Clicks card → Category Detail
3. Sees ledger, identifies the spike (e.g. one PO 28% above market)
4. Atlas suggests "Why did this happen?" → reveals reasoning chain
5. Optional: Lock Savings on a confirmed underspend elsewhere

### Locked savings flow

1. User reviews a delivered PO that came in 12% under quote (renegotiation success)
2. Clicks Lock Savings → modal asks for amount
3. Confirms → savings added to monthly tally + Locked Savings ledger entry

---

## 6.9 Mode-Awareness · Manual Baseline Audit

The Spending page must be fully usable in `Off` mode — a Procurement Manager must be able to view spend, drift, and savings without any agent participation, AND record savings *they themselves* achieved. See `PLATFORM-MAP.md § 3a` for the global model.

### Sensing + manual mechanics (always on)

- **7 category cards** — spend MTD, budget bar, variance arrow, savings locked, per-venue mini-bar. Pure data.
- **Per-venue spend split** chart under the grid (BC / RC / ST / SP).
- **Category Detail view** — time-range toggle (1M / 3M / 6M / 1Y), per-venue split, **LEDGER table** (date / PO / supplier / items / venue / amount / saved).
- **Monthly Spending Trend** chart — 12-month rolling window of actual vs budget.
- **Budget Setup modal** — per-category + per-venue budget allocation. Manual entry.
- **Time range toggle** — pure data filter.
- **Back to all** button — clears category selection.
- **Atlas right panel** — header, page-context subtitle, data summaries (Autonomy Balance backward-looking metric, Forecast Confidence 4 metrics, Venue Mix bars, Scope 3 Carbon CO2 per category), chat input. Never gated.

### Atlas-curated data layer (always on)

- **Autonomy Balance** bars — historical % handled autonomously vs manually. Backward-looking; always rendered (even if Off mode means future bars all read 0% agent).
- **Forecast Confidence** card — 4 metrics (next month spend, savings estimate, drift detection, stockout probability). Sensing.
- **Venue Mix** — per-venue spend mini-bar. Pure data.
- **Scope 3 Carbon** — CO2 per category. Pure data.

### Mode-aware CTAs (action layer)

| Surface | Auto | Assist | Off |
|---------|------|--------|-----|
| **Lock Savings** button (category detail) | One-click commits saving | Same | Opens confirm modal capturing reason + verification source ("renegotiated PT Bali Seafood quote, saved Rp 590k vs Q1 baseline") |
| **Atlas prompt suggestions** (3 buttons when category selected) | Reference A-01 / A-02 / A-04 actions | Same | Reframed: ask about *facts* not agent actions ("Why is Seafood under budget?" instead of "Why did A-01 switch suppliers?") |
| **Agent Efficacy** card (right panel) | Top agent per category with % contribution | Same | **Hidden** — no agent contribution to attribute. Replace with "Action mix" showing manual approvals vs recurring schedule fires. |
| **Atlas response engine** (`getAtlasResponse`) | Cites agent actions ("A-01 switched suppliers because...") | Same | Cites *outcomes* without agent narrative ("Supplier switched on May 15 — locked 4% lower price") |
| **LEDGER entries with `actorType: 'agent'`** | Show "A-01 negotiated bulk commitment" | Same | Historical entries still display; future Off-mode actions land with `actorType: 'admin'` |
| **LEDGER `overrideOf`** field | "Override of A-04 (Spend Watchdog)" | Same | Shown for historical overrides; future overrides are pure manual decisions, no `overrideOf` |
| **Budget Setup → Save** | Instant save | Same | Opens confirm modal: "Apply these budgets from May 16? Notify F&B Director?" |

### Real gaps (open backlog)

1. **"Locked Savings" attribution is purely agent-driven.** Today every LEDGER saving ties back to an agent action. In Off mode the user achieves savings *themselves* (manually renegotiated terms) but has **no way to record that saving in the ledger.** Missing manual surface: "Add a manual saving entry" modal (category, vendor, amount, reason, evidence note). **Biggest gap on this page.**
2. **`Autonomy Balance` card is awkward when system has always been in Off mode.** Shows 0% agent / 100% admin which is technically correct but visually empty. Should switch copy framing in Off mode ("All transactions are manually authored" instead of "Agents handled 0%").
3. **`Agent Efficacy` per-category card has no manual fallback.** In Off mode goes empty. Replace with "Action mix" showing manual approvals vs recurring schedule fires (recurring schedule = standing policy, not agent decision).
4. **`Atlas prompt suggestions`** still reference agent actions. In Off mode reframe to data-only questions.
5. **No "Manual savings calculator"** for the PM who wants to model "if I switch from X vendor to Y, here's the saving." Currently the simulation is implicit in Atlas reasoning; in Off mode it should be an explicit modal.
6. **No "Export budget vs actual" CSV** — useful for manual reporting to F&B Director / GM. No export from Spending today.
7. **Budget Setup is "save and forget"** — no version history, no effective-date, no approver capture. (REALISM-AUDIT § 6 #9.) More critical in Off mode where audit trail relies on user action records.

### Proposed fix shape

- **"Add Manual Saving" entry button** on Category Detail — opens a modal: category, vendor (from `finnsSuppliers`), amount, reason, evidence note, optional invoice ref. Adds a row to LEDGER with `actorType: 'admin'` + `actorLabel: 'You'`.
- **`Agent Efficacy` card becomes "Action Mix"** in Off mode: manual approvals / recurring auto-approvals / overrides. Same shape, different source.
- **Mode-aware `atlasPrompts`** in CATEGORIES — alternate question sets for Off mode.
- **Manual savings calculator** ("what-if") modal: pick a SKU, pick a candidate vendor, see projected delta. Works in all modes.
- **Export CSV** on Category Detail + Categories Grid.
- **Budget Setup audit trail** — version history sub-table with effective_date + actor + reason.

---

# 7. Activity & Governance Page

The merged "receipts + HR + policy office" for the AI workforce. This single page replaces the prior Buyamia AI Activity and Governance pages.

---

## 7.1 Data Model

### Event (activity feed entry)

```ts
type ActivityEvent = {
  id: string;                    // "evt-001"
  type: 'auto-order' | 'restock-forecast' | 'vendor-rejection' | 'spend-flag' | 'qc-event' | 'override' | 'rule-trigger';
  agentId: string;               // A-01 … A-05
  at: ISODate;
  category?: Category;
  venue: VenueTag | 'Multi';
  poId?: string;
  skuId?: string;
  supplierId?: string;
  confidence: number;            // 0–100
  outcome: 'success' | 'pending' | 'failed' | 'overridden';
  reasoning: {
    why: string;
    dataPoints: { label: string; value: string; delta?: number }[];
    alternatives: { label: string; rejectedBecause: string }[];
  };
  undoWindow: { mode: 'hard-60' | 'ledger-close' | 'per-class'; expiresAt?: ISODate };
  override?: { actor: 'user' | 'agent'; reason: string; at: ISODate };
};
```

### Agent profile

```ts
type AgentProfile = {
  id: string;                    // "A-01"
  name: string;
  role: string;
  description: string;
  status: 'active' | 'suspended';
  tasksCompletedToday: number;
  recentDecisions: ActivityEvent[];
  performanceBand: 'green' | 'amber' | 'red';
};
```

### Policy rule

```ts
type PolicyRule = {
  id: string;                    // "RUL-001"
  template: 'spend-cap' | 'vendor-trust-floor' | 'fraud-hold' | 'delivery-sla';
  name: string;                  // human label
  config: Record<string, unknown>;
  scope: 'all' | 'category' | 'venue' | 'vendor' | 'agent';
  active: boolean;
  createdBy: string;             // user
  createdAt: ISODate;
  triggers: number;              // count of times this rule has fired
};
```

### Dispute

```ts
type Dispute = {
  id: string;                    // "DSP-001"
  raisedBy: string;
  refEventId: string;
  refPoId?: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'resolved' | 'escalated';
  resolution?: {
    action: 'approve' | 'reject' | 'escalate';
    hardenedAsPrecedent: boolean;
    at: ISODate;
  };
};
```

---

## 7.2 Left Panel — Tabbed Catalog

A segmented control at the top of the left panel switches between 4 tabs:

| Tab | Contents |
|-----|----------|
| **Activity** (default) | Event feed list, filterable by confidence / type / venue / category |
| **Agents** | Roster: Atlas (no profile, just card) + A-01…A-05 with status + performance band |
| **Policy** | Active rule list with template badges + trigger counts |
| **Disputes** | Open + resolved dispute cards, priority dot |

The selected tab reshapes both the left list and the center panel.

---

## 7.3 Center Panel — Activity Feed

Default state when Activity tab is selected.

- **Capital Efficiency** card (sage, top): "Working capital preserved today" + Rp value + 2-col breakdown (direct savings / auto-orders count)
- **Learning Phase banner** (amber, when total events < 25): "System is calibrating — confidence will improve"
- **Filter bar**: Confidence band chips · Event type chips · Venue chips · Clear filters
- **Undo Window Policy** section (sage card): 3 modes — Hard 60-min · Ledger-close · Per-class. Click a mode to switch.
- **Approve Today's Ledger** button (right of filter bar, sage)
- **Event feed** — vertically stacked event cards:
  - Agent identity row (color-coded by agent)
  - Event type chip + category chip + venue chip + relative time
  - Plain-English summary
  - Confidence bar
  - Outcome badge
  - Hover: ✎ Edit data point affordances
  - Click → right panel opens Reasoning Chain

---

## 7.4 Center Panel — Agent Profile

Triggered by clicking an agent in the Agents tab.

- Agent header (color-coded background, icon, name, role, ID, performance band)
- **Suspend / Resume** control (red border button)
- "Tasks completed today" stat
- Recent decisions list (last 10 events handled by this agent) — same card shape as Activity feed
- "View all decisions" link → filters Activity feed to this agent only

Atlas (no profile beyond a description card — Atlas is the chat copilot, not an operating agent).

---

## 7.5 Center Panel — Policy Rules

Triggered by Policy tab.

- **+ Add Rule** button (top-right)
- **Empty state** (when no rules): dashed-border card with Shield icon, "No rules yet" + Add First Rule CTA
- **Rules table** (Archetype B):
  - Columns: Name · Template · Scope · Active · Triggers (count) · Last fired · Created by · Actions
  - Toggle Active/Inactive inline
  - Edit / Delete actions

### Policy Creator Modal

| Section | Inputs |
|---------|--------|
| Templates (radio) | Spend Cap · Vendor Trust Floor · Fraud Hold · Delivery SLA |
| Rule Type | Threshold / Pattern Match / Time Window / Score Ceiling |
| Threshold/Value | Text input |
| Scope | All / Category / Venue / Vendor / Agent |
| Footer | Cancel · Create Rule |

---

## 7.6 Center Panel — Disputes

Triggered by Disputes tab.

- **Open Disputes** section — cards with priority dot, status badge, reason, "Raised by X · Ref: PO-XXXX"
  - 3 action buttons per card: ✅ Approve · ✗ Reject · ↗ Escalate
- **Resolved** section — collapsed list of past disputes
- **Post-Approval Harden** sage callout (after Approve): "Lock this in as standing policy?" + **Harden Policy — Set as Precedent** button + **Resume Order → PO-XXXX** button (when refPoId set)
- **Precedent Set** confirmation bar after harden

---

## 7.7 Right Panel — Atlas / Transparency Copilot

Reactive to center selection.

### When Activity tab is active

| Mode | Trigger | Content |
|------|---------|---------|
| **Empty state** | No event selected | "Select an event in the ledger to inspect the agent's reasoning chain" + Capital Efficiency card + Atlas chat |
| **Event selected — Reasoning Chain** | Event card click | Agent identity card · Suspend/Resume controls · "Why was this done?" block · Data used block (with inline ✎ edit affordances) · Alternatives rejected · Safe-to-Cancel Window |

### When Agents tab is active

- Selected agent's reasoning style summary
- Recent overrides chart
- Performance band trend sparkline
- Atlas chat

### When Policy tab is active

- Active rule coverage gauge
- Suggested rule (Atlas recommendation based on recent overrides)
- Atlas chat

### When Disputes tab is active

- Selected dispute's full reasoning chain
- "Compare against similar past disputes" card
- Atlas chat

Atlas chat is **always pinned to the bottom** regardless of tab.

---

## 7.8 Modals

### Rollback & Intervene

Triggered by "Rollback" action on an event within its undo window.

| Option | Description |
|--------|-------------|
| Fix & Re-run | Reverts the action and re-runs the agent with corrected inputs |
| Manual Takeover | Reverts and switches the entity (PO / SKU / vendor) to manual mode |

### Policy Creator

See § 7.5.

---

## 7.9 Key State

- `activeTab: 'activity' | 'agents' | 'policy' | 'disputes'`
- `selectedEventId: string | null`
- `selectedAgentId: string | null`
- `selectedDisputeId: string | null`
- `feedFilters: { confidence, type, venue, category }`
- `undoMode: 'hard-60' | 'ledger-close' | 'per-class'`
- `editedDataPoints: Record<eventId, Record<label, value>>`
- `suspendedAgents: Set<agentId>`
- `policyCreatorOpen: boolean`
- `rollbackModalOpen: boolean`
- `hardenedDecisions: Set<eventId>`

---

## 7.10 Actions

| Action | Effect |
|--------|--------|
| Tab switch | Reshapes left + center |
| Filter chips (Confidence / Type / Venue / Category) | Filter the feed |
| Clear filters | Resets all filters |
| Adjust autonomy per category | Adjusts category-level autonomy floor |
| Approve Today's Ledger | Locks the day's ledger; events become immutable |
| Undo mode toggle (Hard 60 / Ledger-close / Per-class) | Switches global undo policy |
| Event card click | Selects event, opens Reasoning Chain in right panel |
| View Source | Navigates to originating page (Orders / Suppliers / Inventory) |
| Rollback | Opens Rollback & Intervene modal |
| Suspend Agent | Marks agent suspended; in-flight actions pause |
| Resume Agent | Clears suspension |
| Edit data point (✎) | Inline edit on a reasoning chain row; toast on save |
| Add Rule / Add First Rule | Opens Policy Creator |
| Policy template select | Picks the rule template |
| Create Rule | Adds rule to active list |
| Override decision | Manual override on a decision row |
| Approve / Reject / Escalate dispute | Closes the dispute with that resolution |
| Harden Policy — Set as Precedent | Locks the override as a permanent rule |
| Resume Order (Dispute) | Navigates to Orders for the disputed PO |

---

## 7.11 Key Flows

### Daily approval flow

1. User opens Activity & Governance → Activity tab
2. Scans events (filterable by confidence band — focus on the < 85% band)
3. Selects an event → reviews reasoning, data points, alternatives
4. Optional: edits a data point (✎) to recalibrate the agent
5. **Approve Today's Ledger** at end of day → locks all events

### Override + harden flow

1. User opens a dispute → reviews the agent's reasoning
2. Disagrees with the decision → Approves the dispute (siding with the requester)
3. Sage Post-Approval Harden card appears
4. Clicks **Harden Policy — Set as Precedent** → new policy rule auto-created from the override pattern
5. Confirmation bar: "Precedent Set"
6. Optional: clicks **Resume Order → PO-XXXX** → navigates to Orders

### Agent suspension flow

1. User notices an agent making bad calls (e.g. A-04 Spend Watchdog flagging too many false positives)
2. Opens Agent Profile → clicks Suspend Agent
3. All in-flight actions for that agent pause
4. User adjusts the relevant policy rule (e.g. raises spend cap threshold)
5. Clicks Resume Agent → suspension cleared

### Policy creation flow

1. Policy tab → Add Rule
2. Picks Spend Cap template
3. Configures: Threshold = Rp 50M, Scope = Vendor (PT Wine Cellar Nusa)
4. Create Rule → rule active
5. Next time A-04 sees a PO from that vendor > Rp 50M, the rule fires and the PO needs human approval

### Rollback flow

1. User spots a bad auto-order in the feed
2. Within the undo window → clicks Rollback
3. Modal: Fix & Re-run (preferred) or Manual Takeover
4. Fix & Re-run → user adjusts data point → agent re-runs → new event posted

---

## 7.12 Deep-Link Hash Reader

On mount and on every `hashchange`, Activity & Governance inspects `window.location.hash`:

| Hash form | Effect |
|-----------|--------|
| `agent-NN` (e.g. `agent-04`) | Switches to Agents tab, opens that agent's profile. Fires `toast.info("Opened Agent A-NN")`. Hash cleared. |
| `evt=eventId` (real id) | Switches to Activity tab, selects the event, scroll-flashes the card. Hash cleared. |
| `evt=eventId` (unknown id) | Amber `toast.warning("{id} isn't in this ledger")`. Falls back to Activity tab. Hash cleared. |

> The `decision=DEC-XXX` hash and the sessionStorage `buyamia-trail-return` marker from earlier iterations are **not** read by this page.

---

## 7.13 Mode-Awareness · Manual Baseline Audit

Activity & Governance is the most architecturally important page for the manual baseline. Without it, the manual workflow has no canonical "audit trail of my own actions" surface, which means *every other page's* mode-awareness work is missing its destination. See `PLATFORM-MAP.md § 3a` for the global model.

### Sensing + manual mechanics (always on)

- **Activity Feed** — unified center timeline. Always shown; every event renders with category / venue / event-type chips + relative timestamp.
- **Activity filters** — confidence band / event type / venue / category / clear. Pure data filtering.
- **Capital Efficiency** card (top, sage-tinted) — historical "working capital preserved today" + breakdown. Backward-looking; always shown.
- **Undo Window Policy** section — Hard 60-min / Ledger-close / Per-class radio. Manual config.
- **Approve Today's Ledger** button — manual lock action, always available.
- **Reasoning Chain** (right panel, on event select) — historical reasoning record. Always displays for events that already exist.
- **Inline ✎ Edit data point** — pure manual override.
- **Rollback button** + **Rollback & Intervene modal** — manual action.
- **Policy Creator modal** — template picker + rule config. Manual entry.
- **Atlas right panel** — header, page-context subtitle, data summaries, chat input. Never gated.

### Atlas-curated data layer (always on)

- **Capital Efficiency** card — historical Rp value + direct savings + auto-orders count.
- **Reasoning Chain display** — the chain recorded *at the time the event happened*. If the event was an agent decision (under past Auto/Assist), the chain shows agent reasoning. If a manual override, it shows user reason. **What's gated is the production of NEW agent reasoning, not the display of past records.**
- **"Why was this done?"** narrative — read-only display.

### Mode-aware CTAs (action layer)

| Surface | Auto | Assist | Off |
|---------|------|--------|-----|
| **Activity Feed contents** (new events) | Agents generate events rapidly | Same — agents propose, events land `outcome: 'pending'` until human confirms | Only **manual events** land: your approvals, rollbacks, policy creates, overrides. Agent **observation** events (par breach, ETA slip, compliance expiry) still land — sensing — but agent **action** events don't. |
| **Event confidence score** | Agent 0-100 | Same | Manual events get `confidence: 100` (or `null` — design choice needed) |
| **Suggested rule** card (Policy tab, when built) | "You've overridden A-04 4× — recommend Spend Cap rule…" — A-01 editorial | Same | **Hidden** — no agent recommendation |
| **Atlas Recommendation card** on dispute view | "Of 3 similar disputes, 2 were approved + hardened" | Same | **Hidden** — agent editorial |
| **Suspend Agent** button | Suspends agent globally | Same | **Hidden / no-op** — agents already aren't acting |
| **Resume Agent** button | Returns agent to active | Same | **Hidden / no-op** |
| **Rollback Modal "Fix & Re-run"** | Reverts + re-runs agent | Same | **Hidden / disabled** — no agent to re-run; only "Manual Takeover" applies |
| **Approve Today's Ledger** | Locks day's events | Same | Same — works regardless of mode |
| **Policy Creator → Create Rule** | Adds rule; agents enforce at next event | Same | Adds rule to active list; functions as record-of-intent the user manually applies (no agent enforcement) |

### Real gaps (open backlog)

1. **No tabbed left panel** (Activity / Agents / Policy / Disputes) as docs spec at § 7.2. Currently only the Activity feed renders. **Without this**: agent suspend/resume only reachable per-event (can't suspend an agent who hasn't acted yet); policy rules have no list view; disputes have no panel. **Biggest structural gap on the page** — Phase 4d.
2. **Activity Feed in Off mode is sparse but should still be useful.** Today the feed is dominated by agent events; in Off mode it'd be near-empty. **Missing: manual events log.** Every approve / restock / override / rule-create / dispute action should land in the feed with `actorType: 'admin'` + actor name. **The canonical "Recent Activity" log that every other page (Overview, Inventory, Suppliers, Spending) should consume.**
3. **Reasoning Chain assumes agent attribution** for every event. Agent identity card has color-coded accent + agent icon + agent ID + confidence. For manual events, render a **User identity card**: your name, role badge, no confidence score (or "100% — you decided").
4. **Suspend Agent has no roster view.** Reachable only by clicking an event that agent generated. If A-04 hasn't acted recently, no path to suspend it preventively. Needs the Agents tab from Phase 4d.
5. **No "Renaming agents" surface anywhere.** Agent IDs / names hardcoded in `lib/mockData.ts`. Prototype scope: allow inline rename on the Agents tab. (Cosmetic.)
6. **Suggested Rule + Atlas Recommendation cards** — A-01 editorial; need to hide in Off mode. Pending Phase 4d build but spec'd here.
7. **Audit log of Off-mode user actions is the primary surface** but doesn't exist as a focused view. Today's feed mixes everything. **Missing: actor filter chip** (You / Atlas / Agents / All / System events).

### Proposed fix shape

- **Unified Action Log architecture**: single store, `actorType: 'agent' | 'admin' | 'system'`, fed by every page's mutating action. Activity Feed reads this store. **Every other page's "Recent activity" / "Action Log" surface consumes the same store with appropriate filters.** Foundation for the manual-baseline audit story.
- **Tabbed left panel** (Phase 4d): Activity / Agents / Policy / Disputes segmented control. Each tab reshapes center + right panel per RIGHT-PANEL-MAP § 7.
- **Agents tab** renders all 6 (Atlas + A-01..A-05) as cards: name (inline editable, prototype scope), role, performance band, suspend/resume, tasks-completed-today count.
- **Mode-aware reasoning chain renderer**: when `event.actorType === 'admin'`, render User identity card; when `'agent'`, render Agent identity card. Same component, different actor shape.
- **Suggested Rule + Atlas Recommendation cards** in Policy tab: hide via `useAutonomyMode() === 'off'` check.
- **Activity Feed filter chip**: add "Actor" filter (You / Atlas / Agents / All / System events). Joins existing filters by confidence + event type + venue + category.

---

# 8. Workflows Page

Light reference page. 3 playbooks rendered as 5-stage flow paths. **No tuning. No simulation. No hard-locks.** This page exists to answer "what does Rush actually do that Standard doesn't?" — not to configure anything.

---

## 8.1 Data Model

### Playbook

```ts
type Playbook = {
  id: 'WF-STD' | 'WF-RSH' | 'WF-REC';
  name: 'Standard' | 'Rush' | 'Recurring';
  description: string;
  whenItRuns: string;
  stages: PlaybookStage[];
  activeOrderCount: number;       // live count
  avgDurationHours: number;
  savingsVsBaseline: number;      // % saved compared to manual flow
};

type PlaybookStage = {
  stage: 1|2|3|4|5;
  name: string;
  owningAgent: string;            // A-01 … A-05
  description: string;
  throughputPerHour?: number;
};
```

### The 3 playbooks

#### `WF-STD` — Standard

| Stage | Agent | Behavior |
|-------|-------|----------|
| 1 — Request | A-02 / human | Demand signal raised |
| 2 — Quote / Vendor Confirmed | A-01 | RFQ sent to ≥3 vendors, quotes received, validated against 30d median |
| 3 — PO Approved | A-04 | Spend cap + vendor trust + duplicate checks. Above-threshold → human gate. |
| 4 — In Transit | A-05 | Vendor confirms, ETA tracked |
| 5 — Delivered & Checked | A-05 + human | QC at receiving venue |

#### `WF-RSH` — Rush

| Stage | Agent | Behavior |
|-------|-------|----------|
| 1 — Request | A-02 / human | Urgency=urgent, par floor breach |
| 2 — Quote / Vendor Confirmed | A-01 | **Skips RFQ** — direct to preferred vendor; price tolerated up to 12% over market |
| 3 — PO Approved | A-04 | Streamlined policy check; auto-approves under standard spend cap |
| 4 — In Transit | A-05 | Expedited shipping flag set |
| 5 — Delivered & Checked | A-05 + human | Standard QC |

#### `WF-REC` — Recurring

| Stage | Agent | Behavior |
|-------|-------|----------|
| 1 — Request | A-02 | Scheduled trigger (weekly / biweekly / monthly) |
| 2 — Quote / Vendor Confirmed | A-01 | Existing vendor contract — no RFQ |
| 3 — PO Approved | A-04 | Auto-approved up to active spend cap; pause if cap hit |
| 4 — In Transit | A-05 | Standard tracking |
| 5 — Delivered & Checked | A-05 + human | Standard QC |

---

## 8.2 Left Panel — Playbook List

3 cards, one per playbook:
- Icon + name + complexity badge (simple / medium / standard)
- One-line description
- 3-stat strip: active orders · avg duration · savings vs baseline
- Selected card highlighted sage

Header: "Workflows" + InfoTooltip + search input (filters by name).

---

## 8.3 Center Panel — Playbook Flow Path

When a playbook is selected:

- **Hero card**: Icon, name, description, 4 stats (active orders, stage count, avg duration, savings)
- **Flow Path** section: vertical list of 5 stages
  - Each stage: status icon (always ✓ — no live state on this read-only page) · stage name · assigned agent chip · plain-English description · throughput
  - No Tune Logic buttons. No sliders.
- **When-it-runs** card: plain-English description of the trigger conditions

No execute / schedule / clone buttons. This is a reference page, not a control surface.

---

## 8.4 Right Panel — Atlas (Workflow Reference)

- Atlas header (subtitle "Workflow reference · Selected: {name}")
- **Selected playbook stats** card: total POs run this month, success rate, avg cycle time
- **Recent POs on this playbook** — 5 PO chips (PO id + venue + status), click → Orders with `#order=...`
- Atlas chat (pinned bottom)

The right panel does **not** offer tuning, simulation, or any mutating action. It is informational only.

---

## 8.5 Key State

- `selectedPlaybook: 'WF-STD' | 'WF-RSH' | 'WF-REC' | null` (defaults to WF-STD)

---

## 8.6 Actions

| Action | Effect |
|--------|--------|
| Select a playbook (left) | Loads its flow path in the center |
| Atlas chat send | Sends question |
| Recent PO chip click (right) | Navigates to Orders with `#order=PO-XXXX` |

---

## 8.7 Deep-Link Hash Reader

On mount and on every `hashchange`:

| Hash form | Effect |
|-----------|--------|
| `workflow=WF-XXX` (real id) | Sets `selectedPlaybook`. Center loads the flow path. Hash cleared. |
| `workflow=WF-XXX` (unknown id) | Amber `toast.warning("{id} isn't a known playbook")`. Falls back to default (`WF-STD`). Hash cleared. |

---

## 8.8 Mode-Awareness · Manual Baseline Audit

Workflows is a read-only reference page. **Almost nothing changes per mode** — the page describes what each playbook is, not what the system is currently doing with it. See `PLATFORM-MAP.md § 3a` for the global model.

### Sensing + reference content (always on)

- **3 playbook cards** in left panel (icon, name, complexity badge, 3-stat strip).
- **Search input** filters playbook cards.
- **Hero card** for selected playbook (icon, complexity, description, 4 stats, "when it runs" note).
- **Flow Path** vertical 5-stage list (stage name, owning-agent chip, plain-English description, throughput).
- **Read-only banner** at bottom directs config to Activity & Governance policy rules.
- **Atlas right panel** — playbook stats, recent POs on this playbook (deep-link chips), stage agent reference list, Atlas insight one-liner. Never gated.
- **Hash deep-link reader** for `#workflow=WF-XXX`.

### Mode-aware surfaces (action layer)

**The page is fundamentally read-only** — it describes playbook semantics, not live state. Per-mode differences are cosmetic:

| Surface | Auto | Assist | Off |
|---------|------|--------|-----|
| Stage card description copy | Describes agent role in playbook concept | Same | Same — describes the role; doesn't depend on agent currently acting |
| "Owning Agent" chip on each stage | Shows A-01..A-05 / Human | Same | Same — descriptive of the role, not action |
| Recent POs chip list | Lists POs that ran on playbook | Same | Same — historical, mode-agnostic |
| Atlas insight one-liner | Describes playbook design | Same | Same |

### Real gaps (open backlog)

1. **"Owning Agent" chip might confuse Off-mode users** — each stage shows "A-04 · Spend Watchdog" but no agent is acting. **Fix**: small mode-aware caveat under the Flow Path — "In Off mode you fulfill these roles yourself." Or hover state on the chip explains the role.
2. **No "Manual Workflow Guide" content for Off mode.** A user in Off mode may want a checklist of "Here's what each stage requires you to do manually" — items expanded with actual manual inputs (matches Orders' Task Module Sheet fields). Today the stage descriptions are agent-flavored.
3. **`activeOrderCount` per playbook is misleading in Off mode** — if 0 POs are on Rush because no agent has fired Rush, the card says "Active: 0" which is correct but unhelpful. **Fix**: tooltip explaining how to start a Rush PO manually (via New Request → set urgency to urgent).

### Proposed fix shape

- **Stage card "Owning Agent" → "Owning Role"** label in Off mode, with descriptor: "In Off mode, this role is yours to fulfill." Same visual chip, mode-aware label.
- **Stage card expandable** in Off mode to reveal the manual inputs needed (mirrors Orders Task Module Sheet schema for that stage). Gives the user a concrete "here's what I need to do at this stage" checklist.
- **"How to start a Rush PO manually"** popover tooltip on the WF-RSH playbook hero card. Same shape for WF-REC.

---

# 9. Shared Patterns

Cross-page patterns that surface on multiple pages. Document once; reference from per-page sections.

---

## 9.1 Atlas Chat

Pinned to the bottom of the right panel on every page. Insights scroll above in a single unified scroll area — **NOT** split into two scroll containers. See `RIGHT-PANEL-MAP.md § Cross-Page Pattern Index` for the full rules.

Storage keys for tour state:
- `finns-orders-tour-seen`
- `finns-inventory-tour-seen`
- `finns-request-tour-seen`
- `finns-suppliers-tour-seen`
- `finns-spending-tour-seen`
- `finns-activity-tour-seen`
- `finns-workflows-tour-seen`
- `finns-overview-tour-seen`

Delete any key from localStorage to re-trigger that page's tour.

---

## 9.2 ⌘K Command Palette

Available on Orders, Inventory, and Suppliers (the catalog-heavy pages). Fuzzy search scope varies by page.

| Page | Search scope |
|------|--------------|
| Orders | Live POs, historical POs, suppliers, agents (A-01…A-05), venues |
| Inventory | All SKUs (active + archived), categories, venues |
| Suppliers | All suppliers, categories, regions, account managers |

Always opens with the same modal shape: full-width search input at top, grouped results below, keyboard navigation, Esc to close.

---

## 9.3 Source Bridge

Right-panel takeover used for WhatsApp / Telegram supplier messaging. Available from:
- Orders → ⋯ menu → Message Supplier
- Suppliers → Open Secure Bridge button in Relationship ROI

Routed via the Finn's Gateway in narrative. Owned by **Vendor Comms Agent (A-03)**.

See DESIGN.md "Source Bridge Panel" section for the exact component spec.

---

## 9.4 Audit Mode

Panel-expansion pattern. Used on Orders and Inventory (and informally on Suppliers via the left-panel expand). Behavior:

- Maximize2 button in left-panel header → engages Audit Mode
- Left panel expands to full width (380ms cubic-bezier spring)
- Center collapses to 0 width
- Right panel content swaps to mode-specific insights (Operations Insights / Macro Portfolio Insights)
- Selecting a row opens a Quick Journey card in the right panel (Audit Mode persists)
- Escape (when no row selected) or Minimize2 collapses back

---

## 9.5 Hash-Context Contract Summary

| Hash | Receiver page | Purpose |
|------|---------------|---------|
| `order=PO-XXXX` | Orders | Auto-select PO |
| `agent-NN` | Activity & Governance | Open agent profile, fire toast |
| `evt=eventId` | Activity & Governance | Select event, scroll-flash |
| `workflow=WF-XXX` | Workflows | Select playbook |
| `restock=SKU&items=...&vendor=...` | New Request | Wizard restock express mode |
| `intent=express&mode=reorder&...` | New Request | Wizard re-order express mode |
| `intent=express&mode=blank` | New Request | Wizard manual express mode |

All unknown ids fall back to an amber toast. Hashes are cleared after consumption.

> Deprecated (do **not** add):
> - `decision=DEC-XXX`
> - `sessionStorage['buyamia-trail-return']` marker
> - `buyamia-navigate-page` event (replaced by `finns-navigate-page` if/when re-added; currently no event-kind edges in the live system)

---

## 9.6 Toast / Floating Notification

Used across all pages for ephemeral confirmations. See DESIGN.md "Toast / Floating Notification" for the spec. Common usages:

| Toast | When |
|-------|------|
| `toast.success("PO-XXXX issued to {supplier}")` | Order approval |
| `toast.success("Recalibration saved")` | Data point edit |
| `toast.warning("{id} isn't a known order")` | Unknown hash fallback |
| `toast.info("Opened Agent A-NN")` | Agent deep link arrival |
| `toast.warning("{agent} suspended — all in-flight autonomous actions paused")` | Agent suspension |
| `toast.success("{agent} resumed — Performance Review cleared")` | Agent resume |

---

## 9.7 Information Tooltip (InfoTooltip)

Every section header carries an `ⓘ` icon. Hover opens a plain-English explanation of what the section is for and what to do next. Tooltips never contain interactive controls — read-only context only.

---

## 9.8 Take a Tour

Each page has a guided driver.js tour that auto-starts on first visit and can be replayed via the "Take a tour" button in the page header. Tour storage keys listed in § 9.1.

---

## 9.9 Venue Tag Visual

`BC` / `RC` / `ST` / `SP` chips render with consistent color + abbreviation across every page:

| Tag | Color | Full name |
|-----|-------|-----------|
| `BC` | Sage | Beach Club |
| `RC` | Blue | Recreation Club |
| `ST` | Amber | Stake |
| `SP` | Teal | Splash Waterpark |

`Multi` chip (gray) is used in filters and on POs that span more than one venue.

---

## 9.10 Unified Action Log

Single shared store of every mutating action across the platform. Lives at `src/lib/actionLog.ts`. Foundation for the manual baseline — without one log of admin + agent + system actions, Off-mode users have no audit trail of their own work, and Assist/Auto users have no record of which agent did what.

**Full architectural spec in `PLATFORM-MAP.md § 6a`** (schema, storage, API, mode-aware filters, Atlas integration). This entry covers only how individual pages interact with it.

### Emitters — every page that mutates state must call one

| Page | Action | Emit via | Kind |
|------|--------|----------|------|
| Orders | Approve & Execute | `logUserAction` (Off) or `logAgentAction('A-01', …)` (Auto) | `po-approve` |
| Orders | Hold / Cancel | `logUserAction` | `po-hold` / `po-cancel` |
| Orders | Resolve dispute | `logUserAction` | `dispute-resolve` |
| Inventory | Adjust on-hand | `logUserAction` | `sku-adjust` |
| Inventory | Edit par / lead time / etc. | `logUserAction` | `sku-edit` |
| Inventory | Archive SKU | `logUserAction` | `sku-archive` |
| New Request | Submit request | `logUserAction` | `request-submit` |
| Suppliers | Add vendor | `logUserAction` | `vendor-add` |
| Suppliers | Send message via Source Bridge | `logUserAction` or `logAgentAction('A-03', …)` | `vendor-message` |
| Suppliers | Negotiate / accept terms | `logUserAction` | `vendor-negotiate` |
| Spending | Lock saving | `logUserAction` | `savings-lock` |
| Spending | Manual saving entry | `logUserAction` | `savings-manual-add` |
| Activity & Governance | Create / edit / disable policy rule | `logUserAction` | `rule-create` / `rule-edit` / `rule-disable` |
| Activity & Governance | Open / resolve dispute | `logUserAction` | `dispute-open` / `dispute-resolve` |
| Workflows | Save playbook edit | `logUserAction` | `playbook-edit` |
| App header | Autonomy mode change | `logUserAction` | `autonomy-mode-change` |

System-emitted (always-on sensing layer, no actor gating): `alert-raised`, `eta-slip-detected`, `compliance-expiry`, `par-breach`, `vendor-sla-dip`.

### Consumers — every page's "recent activity" reads from the log

| Page | Reads | Filter |
|------|-------|--------|
| Overview | Right-panel "Recent activity" | last 10, no filter (all 3 actorTypes) |
| Inventory | Right-panel "Recent activity for {SKU}" | `entity: { type: 'sku', id }` |
| Suppliers | "Vendor activity" tab in Storefront / Intel panel | `entity: { type: 'supplier', id }` |
| Spending | LEDGER merges saving entries | `kind: ['savings-lock', 'savings-manual-add']`, filtered by `category` |
| Activity & Governance | Canonical Activity Feed | actor-filter chip drives `actorType` filter |
| Atlas chat | Page-context queries ("what did I do today?") | filtered by page entity + last N hours |

### Mode-aware view defaults

| Mode | Activity & Governance default filter | Overview "Recent activity" default |
|------|--------------------------------------|------------------------------------|
| Off | `actorType: 'admin'` (Your actions) | `actorType: 'admin'` |
| Assist | All actorTypes | All |
| Auto | All actorTypes | All |

The store itself is mode-agnostic — every action is logged regardless of mode. Mode only shapes the **default view**; the user can always switch the filter chip to see other actors.

### Persistence

- `localStorage` key: `finns-action-log`
- Change event: `finns-action-log-changed` (CustomEvent on `window`)
- Capped at 200 entries; older silently dropped
- Seeded with 18 historical entries (May 7–16, 2026) so consumers have data on first load

### Don't

- ❌ Do **not** read or write the underlying localStorage key directly — go through `actionLog.ts`
- ❌ Do **not** call `logAction` from a render path; only from event handlers / effects
- ❌ Do **not** persist the entry list in component state — use `useActionLog(filter)`
- ❌ Do **not** add a new `ActionKind` without updating the table above

---

## 9.11 Removed Patterns (do not reintroduce)

The following patterns existed in the earlier Buyamia iteration and have been removed for Finn's. Documented here so they aren't re-added by accident.

- ❌ **Decision Attribution Trail** — full-screen modal sheet listing all 12 stages with cross-page chips
- ❌ **TrailReturnPill** + `sessionStorage['buyamia-trail-return']` marker
- ❌ **12-stage DAG** — replaced with 5 stages
- ❌ **8 workflow playbooks** — replaced with 3 (Standard / Rush / Recurring)
- ❌ **7-step request wizard** — replaced with 5 steps
- ❌ **Control planes** (CP-POL / CP-ECO / CP-TRU / CP-SIM) — replaced with flat policy rule list
- ❌ **5-cohort agent taxonomy** (SEN / REA / EXE / GOV / MET) — replaced with flat 5-agent roster + Atlas
- ❌ **40-agent control room (Nerve Center page)**
- ❌ **L0–L5 master autonomy ladder**
- ❌ **Global Operations page**
- ❌ **Intelligence page** (TM-01…TM-08)
- ❌ **Infrastructure page** (DAG kernel schematic, deployment phase queue, payment rail connector)
- ❌ **Tamper-proof audit kernel** with GOV seal chips
- ❌ **Simulation sandbox**
- ❌ **Hard-lock signal sensitivity** (Workflows tune logic)
- ❌ **Group Buy** playbook + pool confirmation modal
- ❌ **Capex / Production / Maintenance / Blanket PO / Emergency** playbooks
