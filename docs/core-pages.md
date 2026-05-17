# Finn's Procurement Platform — Pages Documentation

> Comprehensive reference for every page, panel, data point, action, and flow.
> Each page follows the three-panel cognitive layout: **Left** (catalog/list) · **Center** (active task/journey) · **Right** (intelligence/Atlas).
>
> This is the canonical implementation spec. For the high-level platform map (topology, edges, hash contract, glossary), read `PLATFORM-MAP.md` first. For the right-panel rules, read `RIGHT-PANEL-MAP.md`.

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
9. [Shared Patterns](#9-shared-patterns)

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

### Single order approval flow

1. PO at `stage: 2` lands in Triage with Spend Watchdog flag
2. User opens the order → reviews Atlas reasoning + quote details
3. **Approve & Execute** → Stage 3 advances → PO sent to vendor
4. Atlas chat posts "PO-XXXX issued to {supplier}"

### Batch approval flow

1. User multi-selects multiple orders in Triage (cmd-click or checkbox)
2. Center morphs to Batch Console
3. **Execute Batch** → all selected orders advance their relevant stage
4. Batch Complete splash

### Manual Takeover flow

1. User toggles the order to Manual mode (journey detail card)
2. Right panel swaps to Manual Takeover Copilot
3. Each stage opens in Task Module Sheet (Execute mode)
4. User saves & marks complete per stage
5. Optional: Resume Agent at any point

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
- Stage band dropdown (Any / Pre-PO / Fulfillment / Closeout)
- Agent dropdown (A-01 … A-05)
- Venue dropdown (BC / RC / ST / SP / Multi)
- Workflow dropdown (WF-STD / WF-RSH / WF-REC)
- Clear filters

### Table view (default)

Uses **Archetype A — Selection Data Grid** (see DESIGN.md). Row click on a live order → exits Audit Mode and loads journey. Row click on a historical order → Quick Journey appears in right panel, Audit Mode persists.

### Grid view

Toggle in the audit header. Cards instead of rows; same data.

### Right Panel — Audit Mode

See § 1.4 Right Panel — Audit Mode subsections (Operations Insights / Quick Journey).

### Audit-Mode state (component-local)

- `auditOpen: boolean`
- `auditFilters: { status, date, supplier, stage, agent, venue, workflow, search }`
- `auditSelected: Set<orderId>` (for export)
- `auditViewMode: 'table' | 'grid'`

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

The Orders page (the cockpit) must be fully usable in `Off` mode — a Procurement Manager with no agents running needs to be able to progress every PO from Request through Delivered & Checked. See `PLATFORM-MAP.md § 3a` for the global model.

### Sensing surfaces + manual mechanics (always on)

- **Left panel order groupings** (NEEDS YOUR ACTION / AUTONOMOUS FLOW) — derived from PO state, not agent decisions.
- **5-stage DAG rendering** on every order — pure state display per stage.
- **All Audit Mode filters** (status, date, supplier, stage band, agent, venue, workflow, search). Pure data filtering.
- **⌘K command palette** — search across POs / suppliers / agents / venues.
- **Source Bridge** (right-panel takeover for WhatsApp / Telegram supplier comms) — user types the message, hits send. Pure manual UI, no agent draft pre-fill by default.
- **Stage Trace** modal (read-only history per stage).
- **Export CSV** in Audit Mode.
- **Track Shipment / Message Supplier / Repeat Order** ⋯ menu actions — all user-initiated.
- **Atlas right panel** — header, page-context subtitle ("Agent model · PO-3041" / "Batch analysis · 3 orders"), data summaries (Venue Consumption Split, Batch Logic counts, Operations Insights KPIs in Audit Mode, Quick Journey card), chat input. Never gated.

### Atlas-curated data layer (always on)

- **Venue Consumption Split** card for multi-venue POs — pure data calc from PO `venues` field.
- **Batch Logic Summary** (Cold-Chain Verified / Pricing Confidence / Exceptions Flagged) when ≥2 POs selected — counts are sensing.
- **Operations Insights** in Audit Mode (4 KPI cards + top suppliers + status mix + venue mix) — aggregate stats from PO data.
- **Quick Journey card** for historical rows in Audit Mode.

Per-PO **Agent Reasoning** card surfaces in the right panel **only when an operating agent is actively driving the PO** (`laborMode: 'agent'` AND global mode is not Off). In Off mode this slot is empty by design — fix is to replace it with a user-fillable "Notes" surface, not to fake content.

### Mode-aware CTAs (action layer)

| Surface | Auto | Assist | Off |
|---------|------|--------|-----|
| Stage 2 "Quote Received" advance | A-04 auto-approves if under spend cap | "Approve PO-3041" with A-01's reasoning + Approve / Defer / Decline | Manual review modal: user enters quote details (amount, lead time, vendor) + approval reason |
| Stage 3 PO Approved → Stage 4 In Transit | A-05 auto-dispatches confirmation, polls carrier API | "A-05 has carrier ready — send dispatch confirmation?" | Manual Task Module: user enters carrier name, tracking number, ETA |
| Stage 4 In Transit → Stage 5 Delivered | A-05 auto-marks Delivered when ETA + carrier signal confirm | "Carrier signal says delivered — confirm receipt?" | Manual QC: photo upload, qc_outcome (pass/fail), receiving staff name typed by hand |
| Stage 5 QC fail | A-05 auto-fires `finns-qc-failure` → Suppliers gets alert | Suggests opening dispute | Manual dispute creation via Activity & Governance |
| **Approve & Execute** primary CTA | One-click, fires agent execution | One-click, fires confirmation flow | Opens Review modal capturing reason + notes before advancing |
| **"Managed by · Agent A-NN →"** header chip | Routes to Activity & Governance | Same | **Hidden** or "Self-managed" — no agent assigned |
| **Resume Agent** button (in Manual Takeover mode) | Returns control to A-NN | Returns to "suggest" mode for this PO | **Hidden** (no agent to return to globally) |
| Per-PO **Labor Switch** | Agent / Manual toggle | Same | **Hidden / read-only** (global Off already locks to manual) |
| Right-panel **Manual Takeover Copilot** ("I am standing by") | Appears only when laborMode=manual | Same | **Always shown** when a PO is selected (every PO is in manual mode) |
| **Batch Console "Execute Batch"** | One-click fires agent execution across all selected | One-click confirms suggestions | Opens batch review modal — user steps through each PO's approval reason |

### Real gaps (open backlog)

1. **PO `laborMode` is hardcoded `'agent'`** for every new PO created from RequestPanel's `handleSubmit`. In Off / Assist mode the PO should land as `'manual'` so it doesn't auto-progress. Fix: read `useAutonomyMode()` + `defaultLaborMode()` from `lib/autonomy.ts`.
2. **The "Managed by · Agent A-NN →" header chip** assumes an operating agent is assigned to every PO. In Off mode there's no agent — chip should either hide or render "Self-managed."
3. **Task Module Sheet copy** uses agent-flavored hints (`"Atlas will mirror to ERP"` / `"Atlas is drafting the PO from the last accepted quote"`). In Off mode the Active Handshake delegation buttons should hide entirely; copilot hints should switch to plain reference info ("Vendor's preferred channel: WhatsApp · last contact 3 days ago").
4. **`synthesizeStageHistory` attributes every stage to an agent** when generating completed stage records. POs progressed manually should record `actor: 'user'` + free-text note instead of fabricated agent activity.
5. **Stage 2 "Quote received" has no multi-quote entry surface.** Today the Task Module captures only `channel + lead_time + quote_amt` (single quote). In Off mode the user needs a UX for "I received quotes from 3 vendors, here's the winner" — table of received quotes + winner radio.
6. **No multi-vendor RFQ composer at Stage 2.** Source Bridge is 1-on-1 only. In Off mode a user at Stage 2 needs to gather quotes from 3 vendors — today they'd open Source Bridge 3 times. Should be a single RFQ composer reachable from the Stage 2 Task Module that broadcasts to selected vendors. **Same gap as § 4.7 New Request.**
7. **Batch Console "Execute Batch"** fires agent execution. In Off mode "Execute Batch" should open a batch review modal where the user steps through each PO's approval reason in sequence.
8. **Right-panel "Agent Reasoning" slot empties in Off mode** with no fallback. Should become a user-fillable "Notes" surface so the audit trail isn't lost.

### Proposed fix shape

- **Mode-aware Task Module hints**: hide Active Handshake delegation in Off mode; replace agent-flavored copilot hints with raw reference data.
- **Stage 2 multi-quote entry**: split the Task Module into "Received Quotes" (table: vendor, amount, lead time, notes) + "Selected Winner" radio.
- **RFQ Composer modal** reachable from Stage 2 Task Module ("Send RFQ to vendors") — pre-fills items, lets user multi-select vendors, composes one message broadcast to all. Routes through Source Bridge under the hood. Auto mode auto-fires this; Off requires user-click Send.
- **Unified Action Log** (same fix as Overview / Inventory) — actor-tagged: `you | A-01 | A-02 | ...`. Right panel filters by mode.
- **`synthesizeStageHistory` actor**: when manual mode, set `actor: 'user'` + capture the user's free-text note in the Task Module.
- **`handleSubmit` in RequestPanel** reads `useAutonomyMode()` + sets new PO `laborMode = defaultLaborMode(mode)`.
- **"Notes" surface in right panel** replaces the empty Agent Reasoning slot for manual-mode POs.

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

The 5-step sourcing wizard. The center panel morphs entirely per step. Express modes (re-order / restock) pre-fill state and may jump straight to Review.

---

## 4.1 Data Model

### Request draft

```ts
type RequestDraft = {
  id: string;                    // "REQ-DRAFT-001"
  items: LineItem[];
  vendors: string[];             // supplier ids
  delivery: {
    venues: VenueTag[];
    targetDate: ISODate;
    windowDays: number;
  };
  urgency: 'standard' | 'urgent' | 'recurring';
  workflowTemplate: 'WF-STD' | 'WF-RSH' | 'WF-REC';
  notes?: string;
  expressMode?: 'reorder' | 'restock' | 'blank';
  expressSource?: { from?: string; vendor?: string; sku?: string };
};

type LineItem = {
  sku?: string;                   // optional — new items may not exist in catalog yet
  name: string;
  category: Category;
  qty: number;
  uom: string;
  venues: VenueTag[];
};
```

### Express mode hash inputs

| Hash | Behavior |
|------|----------|
| `#restock=SKU&items=...&vendor=...` | Restock express. Pre-fills items, sets urgency=urgent, skips to Step 1 with banner. |
| `#intent=express&mode=reorder&from=PO-XXXX&vendor=...&items=...` | Re-order express. Pre-fills the lot, jumps to Step 4 (Review). |
| `#intent=express&mode=blank` | Manual express. Empty state, single-step authorize available from Step 4. |

---

## 4.2 Left Panel

Compact step indicator + workflow badge + draft summary card. Click a previous step to jump back.

---

## 4.3 Center Panel — 5 Steps

### Step 1 — Items

- Line items table (add / remove / qty / uom / category / venue chips)
- Suggested category tags (clickable filters)
- Budget framing widget (right side, inline): shows monthly category budget remaining and where this request lands
- Express-restock banner (when entered via `#restock=...`)

### Step 2 — Vendors

- Vendor cards from the directory, filterable by category and venue capability
- Multi-select with primary-vendor radio (one vendor leads if multiple selected)
- Sourcing Agent (A-01) suggestions surface in the right panel
- Vendor reliability metrics inline (composite / on-time / cold-chain)

### Step 3 — Delivery

- Target venue chips (multi-select)
- Date window picker (target date + flex window)
- Logistics risk surfaces in the right panel (lane risk map)

### Step 4 — Review

- Pre-submit summary: items list, vendors, delivery, urgency, projected total, savings vs market
- 6-row audit checklist (vendor trust, spend cap, par alignment, etc.)
- **Authorize** primary CTA (sage)
- "Back to edit" tertiary

### Step 5 — Done

- Big sage check icon
- "PO-XXXX created" headline
- Workflow assigned (WF-STD / WF-RSH / WF-REC)
- Auto-routes to Orders with `#order=PO-XXXX` after 1.4s

---

## 4.4 Right Panel — Atlas Copilot

See `RIGHT-PANEL-MAP.md § 4`. Subtitle is `"Step N · {step name}"`. Content morphs per step:

| Step | Card |
|------|------|
| 1 | Strategic Intent (sage) — "Describe **why** — not just **what**." |
| 2 | Vendor Reliability — 3 metrics for primary vendor + Recurring vendor card (if applicable) |
| 3 | Logistics Risk Map — 3 risk items (e.g. monsoon, port congestion, all-clear) + Venue lane preferences |
| 4 | Audit Summary — 6-row pre-authorize checklist + Spending Pulse (this request vs monthly category budget) |
| 5 | Hand-off complete — quick links to Orders + Inventory |

Express-mode opening line on first Atlas message:

| `expressMode` | Atlas line |
|---------------|------------|
| `reorder` | *"I've validated this re-order from {source}. Prices stable, vendor reliability holding at {N}, Agent A-01 ready to deploy. Skip to authorization when you're ready."* |
| `restock` | *"I've validated this restock. Critical SKU items locked, vendor pre-selected, urgency set to urgent. Pick your autonomy tier and deploy."* |
| `blank` | *"Express lane open. Add line items below — I'll validate prices against the 30-day market median in real time."* |

---

## 4.5 Actions

| Action | Where | Effect |
|--------|-------|--------|
| Next / Back | Step navigation | Advances or reverts step |
| Step indicator click | Left panel | Jump to a prior step |
| Add item / Remove item | Step 1 | Line item mutation |
| Suggested category tag | Step 1 | Filter line items |
| Venue tag selector | Step 1 / Step 3 | Assigns target venue(s) |
| Vendor checkbox | Step 2 | Toggle vendor selection |
| Primary vendor radio | Step 2 | Sets the lead vendor |
| Date / window picker | Step 3 | Sets delivery window |
| Authorize | Step 4 | Creates PO, advances to Step 5 |
| Atlas chat send | Right panel | Question to Atlas |
| Dismiss restock banner | Step 1 (when express=restock) | Dispatches `finns-restock-intent-failed` |

---

## 4.6 Flows

### Standard flow (no express)

1. User clicks "New Request" → Step 1 Items
2. Fills items, picks vendors, sets delivery
3. Step 4 Review → Authorize
4. Step 5 Done → routes to Orders

### Restock express flow

1. From Inventory: Restock Now → routes here with `#restock=...`
2. Wizard lands on Step 1 with items pre-filled and `urgency: urgent`
3. User confirms vendor (Step 2) or skips if pre-selected
4. Step 4 → Authorize → Done

### Re-order express flow

1. From Orders: Re-order on a completed PO → routes here with `#intent=express&mode=reorder&...`
2. Wizard jumps to Step 4 with all fields pre-filled
3. User reviews → Authorize → Done

### Restock dismissed (data edge out)

1. In Step 1 of a restock-express run, user dismisses the inventory banner
2. `finns-restock-intent-failed` dispatched
3. Inventory page shows amber alert on that SKU on next visit

---

## 4.7 Mode-Awareness · Manual Baseline Audit

New Request is the entry point for every procurement. It must work end-to-end in `Off` mode — every input typed by hand, no agent recommendations, the resulting PO landing in manual mode on Orders. See `PLATFORM-MAP.md § 3a` for the global model.

### Sensing surfaces + manual mechanics (always on)

- The 5-step wizard mechanics: every input (request name, line items, venue tags, vendor checkbox, date picker, recurring frequency) is typed/clicked by the user. No autopilot path through the wizard.
- **Vendor cards** in Step 2 — `finnsSuppliers` data, reliability scores from data.
- **Spending Pulse** card on Step 1 (right panel) — budget bar showing this-request impact. Data calc.
- **Logistics Risk Map** on Step 3 — known monsoon / port-congestion / Bali-local conditions. Observation.
- **Venue Lane Preferences** (BC receives 06:00–10:00, ST evening only) — static rules per venue.
- **Step 4 audit checklist** rows (spend cap headroom, vendor trust floor, par alignment) — threshold checks against current state.
- **Express-mode hash deep links** (#restock=, #intent=express&mode=reorder, #intent=express&mode=blank) — user-initiated from another page; always work.
- **Atlas right panel** — header, step-aware subtitle ("Step 2 · Vendors"), data summaries (vendor metrics, risk map, audit checklist), chat input. Never gated.

### Mode-aware CTAs (action layer)

| Surface | Auto | Assist | Off |
|---------|------|--------|-----|
| Step 1 Strategic Intent card | "Describe why — A-01 picks vendors / playbook downstream" | Same | "Describe why — clearer intent → clearer follow-up tasks for your team" |
| Step 2 Recurring Vendor card | "PT Indo Sayur runs your weekly produce — switch to WF-REC?" | Same prompt | **Hidden** (A-01 recommendation, not raw data) |
| Step 4 Mission Brief Active | "5 stages mapped, A-01 will start at Stage 2 on authorize" | "A-01 will surface the quote for your approval at each gate" | "5 stages mapped — you'll progress them manually from Orders" |
| Step 4 Authorize CTA | "Authorize · Deploy Agent →" | "Authorize · Queue for review →" | **"Authorize · Create PO →"** (no deployment language) |
| Step 5 Done splash | "PO routed to Orders. A-01 on Stage 2 now." | "PO routed to Orders. A-01 will surface the quote for your approval." | "PO created. Continue manually from Orders." |
| Express-mode opening Atlas message | "I've validated this re-order. Prices stable. A-01 ready to deploy." | "I've validated this re-order. Recommend reviewing." | "Re-ordering from PO-XXXX. Inputs cloned — review and submit." |
| New PO `laborMode` after Authorize | `'agent'` | `'manual'` (so Orders surfaces it for human progression) | `'manual'` |

### Real gaps (open backlog)

1. **`agentNotes` / "Sourcing Agent" language is hardcoded throughout the wizard's right panel** (Strategic Intent, Mission Brief, Step 5 confirmation). No mode-awareness yet. Fix: read `useAutonomyMode()` + flip copy strings.
2. **`handleSubmit` hardcodes new PO `laborMode: 'agent'`.** Should use `defaultLaborMode(mode)` from `lib/autonomy.ts` so POs created in Off/Assist land as manual.
3. **No "manual continuation" guidance after Authorize.** In Off mode, the user is routed to Orders but has no breadcrumb explaining the next manual steps. Add an Off-mode "what to do next" card on Step 5.
4. **No RFQ dispatch surface inside the wizard.** Step 2 picks vendors but doesn't compose the RFQ. In Auto mode A-01 auto-fires it; in Off mode the user has no way to ask vendors for a quote from inside New Request. Either inline composer in Step 2 or routed to Suppliers → Source Bridge after Authorize. **Biggest manual gap on this page.**
5. **Mission Brief preview** (`deployedWorkflow` flag) is a half-feature even in Auto mode — needs proper wiring or removal.

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

## 9.10 Removed Patterns (do not reintroduce)

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
