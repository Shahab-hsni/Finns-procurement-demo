# Buyamia Platform — Core Pages Documentation

> Comprehensive reference for every page, panel, data point, action, and flow.
> Each page follows the three-panel cognitive layout: **Left** (catalog/list) · **Center** (active task/journey) · **Right** (intelligence/Atlas).

---

## Table of Contents

1. [Orders Page](#1-orders-page)
2. [Overview Page](#2-overview-page)
3. [Inventory Page](#3-inventory-page)
4. [Spending Page](#4-spending-page)
5. [Suppliers Page](#5-suppliers-page)
6. [AI Activity Page](#6-ai-activity-page)
7. [New Request Page](#7-new-request-page)

---

---

# 1. Orders Page

**File:** `src/components/NewOrdersPage.tsx`
**Nav label:** Orders
**Purpose:** The primary fulfillment cockpit. The admin manages every purchase order across its full 12-stage DAG lifecycle — approving agent proposals, resolving exceptions, monitoring autonomous flow, and optionally taking manual control of any individual stage.

---

## 1.1 Data Model

### Order object

| Field | Type | Description |
|---|---|---|
| `id` | string | PO identifier (e.g. `PO-2855`) |
| `supplier` | string | Supplier name |
| `items` | string[] | Line items in the PO |
| `amount` | number | Total PO value in USD |
| `group` | string | Internal category/group |
| `actionKind` | `'approve' \| 'resolve-issue' \| 'confirm-delivery' \| undefined` | Whether this order requires human action, and what kind |
| `humanAction` | string | Short label for the required action (e.g. "Needs approval") |
| `humanStatus` | string | Human-readable status (e.g. "Arriving in 10 min") |
| `humanDescription` | string | One-line description of the order |
| `eta` | string | ETA string (e.g. "10 min", "In Transit") |
| `etaMinutes` | number? | ETA in minutes, used to highlight imminent arrivals |
| `dagStage` | number | Current stage index (0–11) from the 12-stage DAG |
| `agentReasoning` | string | Natural-language explanation from the assigned agent |
| `agentAgent` | string | Display name of the responsible AI model |
| `assignedAgent` | `{id, role}` | The agent object assigned to this order |
| `financeInsight` | string? | Invoice factoring or cash-flow note from Agent #28 |
| `saving` | `{cost, time}?` | Estimated cost saving ($) and labor time saved |
| `failureReason` | string? | Reason for delivery failure (resolve-issue orders) |
| `negotiating` | boolean? | Whether the agent is already handling re-negotiation |
| `isNewSupplier` | boolean? | Whether the supplier is new (triggers Digital Twin) |
| `digitalTwin` | `{recommendation, switchSaving, leadTimeDelta}?` | AI simulation result for new suppliers |
| `createdAt` | string | ISO timestamp the PO was created (used by Audit Mode date filters) |
| `completedAt` | string? | ISO timestamp of delivery / cancellation. Absent on `live` / `on-hold` rows. |
| `status` | `'live' \| 'completed' \| 'disputed' \| 'cancelled' \| 'on-hold'` | Terminal lifecycle label used by Audit Mode |
| `resolution` | string? | Human reason for terminal disputed / cancelled / on-hold / late rows |
| `workflowTemplate` | string | The playbook this PO ran through. One of the 8 ids from `lib/mockData.ts workflowTemplates` — `WF-STD` Standard · `WF-RSH` Rush · `WF-BPO` Blanket PO · `WF-GRP` Group Buy · `WF-EMR` Emergency · `WF-PRD` Production-Driven · `WF-MNT` Maintenance · `WF-CPX` Project/Capex. Drives stage cadence, autonomy ceiling, and which agents own which stages. |

#### Workflow template seeding

All 47 orders carry a `workflowTemplate`. Live orders use hand-picked templates that match their narrative (e.g. PO-2851 Thai Fresh "Friday window" → `WF-RSH`, PO-2830 long-term PT Maju → `WF-BPO`). Historical orders use a deterministic `pickWorkflow(seed, hint?)` helper:

| Roll | Template |
|---|---|
| 0–59  | `WF-STD` Standard |
| 60–74 | `WF-RSH` Rush |
| 75–84 | `WF-GRP` Group Buy |
| 85–89 | `WF-BPO` Blanket PO |
| 90–94 | `WF-PRD` Production-Driven |
| 95–99 | `WF-MNT` Maintenance |

Hints override the roll: the 4 late-delivery historicals are forced to `WF-RSH`, one cancelled order to `WF-EMR`, two on-hold orders to `WF-PRD` and `WF-BPO`. Result: every template is represented in the historical pool for filter / aggregation demos.

### Historical order ledger (`HISTORICAL_ORDERS`)

In addition to the 7 live orders, the Orders page seeds **40 historical records** (`makeHistoricalOrders()` in `NewOrdersPage.tsx`) that surface only in Audit Mode. Distribution over the last 90 days:

| Count | Status | Notes |
|---|---|---|
| 28 | `completed` | On-time delivery. `completedAt` set; `saving` populated. |
| 4  | `completed` | Late delivery — `resolution` describes the cause (port congestion, etc.). |
| 3  | `disputed`  | QC fail / cold-chain breach / short shipment. `actionKind: 'resolve-issue'`. |
| 2  | `cancelled` | Halted before dispatch — `resolution` carries the reason. |
| 3  | `on-hold`   | Awaiting external clearance — credit line, compliance docs, QC re-test. |

Historical records reuse the **same agents** (#5, #7, #9, #13, #18, #28, #33) and a broader **supplier pool** (16 vendors including AUS Meats, Indo Seafood, PT Maju Bersama, Thai Fresh Co, VN Supply Ltd, Metro Bakehouse, Fresh Valley Farms, Premium Dairy Direct, Urban Greens Collective, Alpine Cheese Factory, Seafood Masters Inc, City Spice Co, Bali Fresh Farms, Oceanic Harvest, PT Sumber Daging, PH Agri Corp).

The combined dataset is exposed as `ALL_ORDERS = [...ORDERS, ...HISTORICAL_ORDERS]` and is **only** consumed by Audit Mode — Triage Mode, Batch Console, and the Journey states continue to use the 7-row `ORDERS` constant so existing flows are unaffected.

### Live order data (7 seeded orders)

| ID | Supplier | Action Required | Stage | Amount |
|---|---|---|---|---|
| PO-2855 | Seafood Masters Inc | **Approve** (new supplier) | PO Created (0) | $3,840 |
| PO-2857 | Metro Bakehouse | **Resolve Issue** (delivery failed) | Delivered attempt (11) | $1,290 |
| PO-2847 | Fresh Valley Farms | **Confirm Delivery** (arriving now, 10 min) | Out for Delivery (10) | $2,150 |
| PO-2851 | City Spice Co | Autonomous | Out for Delivery (10) | $890 |
| PO-2853 | Premium Dairy Direct | Autonomous | In Transit (8) | $3,100 |
| PO-2830 | Urban Greens Collective | Autonomous | Delivered (11) | $1,820 |
| PO-2828 | Alpine Cheese Factory | Autonomous | Delivered (11) | $2,640 |

### The 12-Stage DAG

| # | Stage Label | Assigned Agent | HITL Gate |
|---|---|---|---|
| 0 | PO Created | — | ✅ Review & Authorize PO |
| 1 | Vendor Confirmed | Agent #5 | — |
| 2 | Payment Sent | Agent #28 | — |
| 3 | ERP Sync | Agent #18 | — |
| 4 | Vendor Processing | — | — |
| 5 | Quality Check | Agent #9 | — |
| 6 | Dispatched | — | — |
| 7 | Customs Clearance | Agent #33 | — |
| 8 | In Transit | — | — |
| 9 | Regional Hub | Agent #7 | — |
| 10 | Out for Delivery | — | — |
| 11 | Delivered | — | ✅ Review & Authorize Delivery |

**HITL (Human-in-the-Loop) gates:** Stage 0 (PO approval) and Stage 11 (delivery confirmation) always require the admin to "Review & Authorize" regardless of whether the order is in Agent Active or Manual Takeover mode.

### Task Modules (one per DAG stage)

Each stage has a Task Module — a structured form the admin fills out when in Manual Takeover mode, or which the agent fills autonomously. Fields per stage:

| Stage | Action | Key Inputs |
|---|---|---|
| 0 · PO Created | Review the auto-generated PO | PO number (text), Items summary (textarea), Authorized amount (text, Atlas can pull from vetted catalogue), Payment terms (select: NET-30 / NET-60 / Immediate / On Delivery) |
| 1 · Vendor Confirmed | Log vendor acknowledgement | Confirmation method (select), Vendor reference number (text), Contact name (text, Atlas can pull from supplier directory), Scheduled pickup date (date) |
| 2 · Payment Sent | Log payment dispatch | Payment reference (text), Amount sent (text), Payment method (select), Payment receipt (file upload) |
| 3 · ERP Sync | Confirm ERP entry | ERP PO number (text), Sync status (select), Sync timestamp (date), ERP system name (text) |
| 4 · Vendor Processing | Confirm vendor started processing | Vendor processing ref (text), Expected completion date (date), Processing notes (textarea) |
| 5 · Quality Check | Log QC findings | QC report (file upload, required), QC Outcome (select: pass / fail / conditional, required). **If outcome = "fail," a `buyamia-qc-failure` CustomEvent is dispatched containing `{ orderId, supplier }` — Suppliers page listens and shows an amber alert card for the affected supplier.** |
| 6 · Dispatched | Log dispatch | Carrier/logistics provider (text, Atlas can pull from approved logistics), Tracking number (text), Dispatch date (date), Dispatch note (textarea) |
| 7 · Customs Clearance | Log customs processing | Customs reference number (text), Clearance status (select), Clearance date (date), Customs documents (file upload) |
| 8 · In Transit | Log transit status | Current location (text), ETA update (date), Carrier update notes (textarea) |
| 9 · Regional Hub | Log hub arrival | Hub name (text, Atlas can pull from regional hubs directory), Arrival time (date), Hub reference number (text) |
| 10 · Out for Delivery | Log out-for-delivery | Driver/courier name (text), Estimated arrival time (date), Delivery vehicle (text) |
| 11 · Delivered | Confirm delivery receipt | Received by (text), Delivery condition (select: Good / Damaged / Partial), Delivery notes (textarea), Delivery receipt (file upload, required) |

Each Task Module also has:
- **`copilotHint`** — Atlas's contextual suggestion shown while the admin fills the form.
- **`delegationLabel`** — Label for the "hand back to Atlas" button (Active Handshake).
- **`delegationLockedCopy`** — Message shown when Atlas is handling the sub-task.
- **`delegationDependsOn`** — List of field keys that must be filled before delegation is enabled.

---

## 1.2 Left Panel — Order List (Triage Mode)

**Purpose:** Priority feed of orders needing action + monitoring feed of autonomous orders. This is the default mode of the left panel; Audit Mode (§ 1.11) is the parallel mode for historical lookups.

### Header

| Element | Data / Action |
|---|---|
| "Orders" title | Static |
| Count summary | "{N} need action · {N} autonomous" |
| "Clear (N)" button | Appears when ≥1 order selected; clears all selections |
| **Maximize2 button** | Expand to Audit Mode — full historical ledger across all 47 live + historical orders (see § 1.11) |
| Search bar | Displays "Search orders … ⌘K"; click opens ⌘K Command Palette |

### NEEDS YOUR ACTION section

| Element | Data / Action |
|---|---|
| Section label | "NEEDS YOUR ACTION" + amber count badge |
| Select All / Deselect All checkbox | Toggles multi-select on all action orders simultaneously |
| "All clear" state | Shown when no orders need action: "All clear — agents handling everything" |
| OrderCards | One card per order with `actionKind` set |

### AUTONOMOUS FLOW section

| Element | Data / Action |
|---|---|
| Section label | "AUTONOMOUS FLOW" + green count badge + Bot icon |
| OrderCards | One card per fully-autonomous order |

### OrderCard

| Element | Data |
|---|---|
| Order ID | e.g. `PO-2855` |
| Supplier name | e.g. `Seafood Masters Inc` |
| Items | Truncated comma-joined list of line items |
| Amount | `$X,XXX` |
| ETA / status | Human-readable e.g. `Arriving in 10 min` |
| Agent badge | Green sage: `Bot #XX (agent active)` · Amber: `User (manual mode)` |
| "Proposed by Agent #X" | Shown on `approve` orders only — gatekeeper framing |
| Action badge | Color-coded: Approve (green) / Confirm Delivery (blue) / Resolve Issue (red) |

#### OrderCard interactions

| Action | How | Result |
|---|---|---|
| Select order | Click anywhere on card | Loads single-order journey in center panel |
| Multi-select | Ctrl+click (or ⌘+click on Mac) | Adds order to batch selection; loads Batch Console in center |
| Open context menu | Hover → click ⋯ button (top-right of card header) | Opens stage-gated dropdown; closes on outside click or order change |
| Track shipment | ⋯ menu → "Track Shipment" | Visible only for orders at stage ≥ 7 (Dispatched) and not yet completed |
| Message supplier | ⋯ menu → "Message Supplier" | Always visible. Switches right panel to Source Bridge; auto-closes when a different order is selected |
| Repeat order | ⋯ menu → "Repeat Order" | Visible only on completed orders; opens draft sheet pre-filled with same items |

> **Visual rule:** OrderCards use a single gray border (`#e5e5e0` light / `border-gray-800` dark) regardless of status. The status signal — red / amber / blue / green — lives only in the card's title icon and label text. No status-driven colored borders, background tints, or rings. Selected cards gain a sage tint + ring; that is *selection* state, not *status* state.

---

## 1.3 Center Panel

The center panel has **five distinct states** depending on context.

---

### State 1: Default (no order selected)

Shown when no OrderCard is selected. Displays the macro dashboard view.

#### New Order button

| Element | Data / Action |
|---|---|
| "New Order" button | Navigates to the New Request page (Step 1 of 7-step wizard) |

#### Pending Drafts & Schedules

Shown only if drafts were created this session.

| Element | Data |
|---|---|
| Section title | "Pending Drafts & Schedules" + "{N} this session" |
| Draft entry | Icon (FileUp for one-off, Repeat for recurring) + label + cadence (weekly/monthly/one-off) + assignment (Agent #XX or Manual) + next run date |
| Status badge | "Awaits Authorization" (amber) on all drafts |

#### Workforce Vitals (4 metric cards)

| Metric | What it shows |
|---|---|
| Total Active Value | Sum of all order amounts not yet delivered |
| Human Hours Reclaimed | Total labor hours attributed to agents this week |
| Savings This Week | Total cost savings from agent-driven orders |
| Agent-Managed | Count of orders the agent is running autonomously |

#### Labor Mix

| Element | Data |
|---|---|
| Bar chart | Visual split: sage green = Agent-led %, amber = Human-led % |
| Legend | "Agent-led N (X%)" · "Human-led N (X%)" |
| Note | If any orders are in Human Review mode, explains how to release them |

#### Arriving Next 48 Hours

Lists orders at stages 6–10 (dispatched through out-for-delivery).

| Element | Data / Action |
|---|---|
| Delivery card | Truck icon + supplier name + ETA (right-aligned, green if ≤15 min) + description |
| Imminent highlight | Green background when `etaMinutes ≤ 15` |
| Click | Selects that order and opens its journey |

---

### State 2: Single Order Journey

Shown when exactly one order is selected.

#### Order Journey Header

| Element | Data / Action |
|---|---|
| Order ID | e.g. `Order Journey — PO-2855` |
| Status badge | Color-coded: Arriving / Delivered / In Transit / Delayed / Manual / Awaiting Approval |
| Pulse dot | Animated green dot for actively-moving orders |
| "Managed by: Agent #XX →" link | Navigates to Governance page, filtered to that agent |
| Supplier name | Text label |
| "Internal Directory" badge | Shows locked/Walled Garden — AI restricted to vetted suppliers |
| LaborSwitch | Two-state toggle: "Agent #XX Active" (sage) ↔ "Manual Takeover" (amber) |
| "Re-order" button | Appears when order is delivered (stage ≥ 11); pre-fills New Request with same items and vendor |
| "← All" button | Deselects and returns to default center panel |

#### Manual Takeover Banner (conditional)

Shown when Manual Takeover is active.

| Element | Data / Action |
|---|---|
| Alert banner | Amber border + "Manual Takeover Active: You are now driving PO-XXXX" |
| Description | Lists assigned agent as "in Standby" + instruction to open stage modules |
| "Resume Agent" button | Switches labor mode back to Agent Active |

#### Order Detail Card

| Element | Data |
|---|---|
| Amount | Large `$X,XXX` heading |
| Description | `order.humanDescription` |
| Estimated saving | `$X saved` (right-aligned, green) — shown when > $0 |
| Items section | Each item on its own row with generous padding |

#### Action CTAs (conditional by `actionKind`)

Three-tier visual hierarchy — primary dominant CTA → quiet secondary text link → tertiary utility row.

**`resolve-issue` orders:**

| Tier | Element | Result |
|---|---|---|
| Primary | "Contact Supplier" (red, full-width `h-11 rounded-xl`) | Marks order actioned; triggers journey-complete state |
| Secondary | "Reschedule" (centered text link, no border) | Alternate resolution path (placeholder) |

Also shows: failure reason text + agent negotiation status (if `negotiating === true`).

**`approve` orders:**

| Tier | Element | Result |
|---|---|---|
| Primary | "Approve & Execute" (sage, full-width `h-11 rounded-xl`) | Marks order actioned; triggers journey-complete state |
| Secondary | "Decline" (centered text link, no border) | Decline the agent's proposal (placeholder) |

**`confirm-delivery` orders:**

| Tier | Element | Result |
|---|---|---|
| Primary | "Confirm Delivery" (sage, full-width `h-11 rounded-xl`) | Marks order actioned; triggers journey-complete state |
| Secondary | "Report Issue" (centered text link, no border) | Flags a delivery problem (placeholder) |

**Tertiary utility row (stage-gated, shown below all action types):**

| Action | Visibility condition |
|---|---|
| Track | Only when stage ≥ 6 (order has been dispatched) |
| Message supplier | Always shown |
| Repeat | Only when order is completed (in `completedIds`) |

Clicking "Message supplier" or the ⋯ menu equivalent opens the **Source Bridge** in the right panel.

#### Center-panel layout (State 2)

State 2 uses a **two-column body** below the order header:

| Column | Width | Content |
|---|---|---|
| Left (`flex-1`) | Fills remaining width | Order detail card (amount, items, primary CTA, tertiary action row), then Live Tracking stacked below |
| Right | `260px` fixed | 12-Stage Kernel Journey card — title sits **inside** the card box, not floating above it |

Both columns are top-aligned. The DAG card grows with the stage list; the left column grows with item count and (when visible) the Live Tracking panel.

#### Vertical 12-Stage DAG

Each stage shown as a node on a vertical timeline with connector line.

| Stage State | Visual | Interactivity |
|---|---|---|
| Done (agent mode) | Sage green dot with checkmark | Click → opens Task Module in **View Trace** (Review Mode) |
| Done (manual mode) | Sage green dot (hover: amber) | Click → opens Task Module in **Edit** mode |
| Current (agent mode) | Animated pulse + amber dot | Click → opens Task Module in **Execute** / "Authorize" mode (HITL gates) |
| Current (manual mode) | Amber dot | Click → opens Task Module in **Execute** mode |
| Upcoming (agent mode) | Gray dot | Not interactive |
| Upcoming (manual mode) | Gray dot | Click → opens Task Module in **Plan ahead** mode |

Stage row indicators:

| Indicator | Condition | Meaning |
|---|---|---|
| "manual" amber badge | Stage has manual data saved | Admin manually completed this stage |
| "Atlas-delegated" green badge | Stage delegated via Active Handshake | Atlas is monitoring this sub-task |
| Expand/collapse chevron | Agent sub-step exists + stage done/current (agent mode) | Reveals the agent's sub-step detail text |

#### Live Tracking

Placeholder GPS skeleton with animated MapPin and pulse bars (design intent: real GPS embed).

**Visibility:** Live Tracking only appears once the order is at **Stage 7 (Dispatched) or later**. Before dispatch the goods are still at the supplier — there is nothing to track on a map — so the panel is hidden entirely rather than showing an empty map. The Live Tracking card lives directly under the order detail card in the left column of the two-column layout.

---

### State 3: Batch Transformation Console

Shown when 2+ orders are Ctrl+clicked.

#### Batch Header

| Element | Data / Action |
|---|---|
| "Batch Transformation Console" | Static title |
| Count + value | "{N} orders · ${total} total" |
| "Exit batch" button | Clears selection, returns to default state |

#### Summary cards (3 types, conditional)

| Card | Color | Shows |
|---|---|---|
| To Approve | Green | Count of `approve` orders in batch |
| To Confirm Receipt | Blue | Count of `confirm-delivery` orders |
| To Resolve | Red | Count of `resolve-issue` orders |

#### Per-order table

Each order row shows: ID · Supplier · Description · Amount · Action label + individual action button (green for approve/confirm, red for resolve).

#### Execute Batch button

Oversized sticky button at the bottom of the panel. Label: `Execute Batch — N Orders · $X,XXX`. Executes all selected orders in one action.

---

### State 4: Journey Complete (single)

Shown after the admin executes an action on a single order.

| Element | Data |
|---|---|
| Large checkmark circle | Visual confirmation |
| "Journey Complete — PO-XXXX" | Order ID |
| Supplier + action description | Subtitle |
| Cost saved card | `$X,XXX saved` (green) |
| Labor saved card | `Xh labor saved` |
| DAG stages completed card | Always `12` |
| "← Back to orders" button | Returns to default state |

---

### State 5: Batch Complete

Shown after `Execute Batch` is triggered.

| Element | Data |
|---|---|
| Large checkmark circle | Visual confirmation |
| "Batch Finalized — N Orders" | Count |
| Total saved card | `$X,XXX` (green) |
| Labor saved card | `Xh` |
| Orders processed card | Count |
| "← Back to orders" button | Returns to default state |

---

## 1.4 Right Panel — Atlas Intelligence

**Purpose:** Context-aware AI copilot pinned to the right. Provides reasoning, finance intelligence, and an always-live chat. Responds to what is selected in the center panel.

> **AI-exclusive rule:** The right panel contains only AI-generated content and the Atlas chat. No action buttons (Approve, Decline, etc.) live here — all order actions belong in the center panel.

### Source Bridge mode (supplier messaging)

When the user selects "Message Supplier" from the center panel's tertiary action row (or the ⋯ card menu), the right panel switches entirely to **Source Bridge** mode. Normal AI content is hidden until the bridge is dismissed.

| Element | Behavior |
|---|---|
| Header | "Message {supplier}" title + ArrowLeft back button |
| Channel selector | Segmented control: WhatsApp (`#25D366`) / Telegram (`#0088cc`) — active half fills with channel color |
| Message textarea | Fills all available vertical space; auto-grows |
| Send button | Channel-colored; label changes to "Send via WhatsApp" or "Send via Telegram" |
| Auto-dismiss | Bridge closes automatically when a different order is selected in the left panel |

### Header

| Element | Data |
|---|---|
| Atlas name + sparkle icon | Static |
| Green pulse dot | Live indicator |
| Subtitle | Adapts: "Batch analysis · N orders" / "Agent model · PO-XXXX" / "Logistics intelligence · Live" |

### Contextual sections (appear/disappear by context)

#### Immutable Record notice (single order, agent mode, viewing completed stage trace)

| Element | Action |
|---|---|
| "Immutable Record · Stage X" notice | Explains this is an autonomous action log, not editable |
| "Switch to Manual Takeover" button | Switches labor mode on the order |

#### Manual Takeover Copilot section (when manual mode active)

| Element | Data / Action |
|---|---|
| Standby header | "Manual Takeover Active · Copilot Mode" + "I am standing by" message |
| "Resume Agent · Sync Manual Inputs" button | Returns order to Agent Active, carrying any manual data forward |
| Copilot Stage-Aware Hint | "I noticed you're handling Stage X (Name). {copilotHint text}" |
| "Open Stage X task module" link | Directly opens the Task Module for the current stage |
| Manual Audit Trail | If any stages touched: clickable badges for each touched stage → click to reopen that module |
| Sync note | "These will be synced when you Resume Agent — I will not redo or re-verify them." |

#### Digital Twin Simulation (new supplier orders only)

| Element | Data |
|---|---|
| Recommendation | Agent's assessment text comparing new vs existing supplier |
| Cost reduction | Estimated % or $ saving by switching |
| Lead time delta | Days faster or slower |

#### Agent Reasoning

Shows the assigned agent's natural-language explanation for its decisions on this order.

#### Embedded Finance

Shows when `financeInsight` is available (Agent #28 / Finance Agent).

| Element | Action |
|---|---|
| Finance insight text | Agent #28's cash-flow or invoice recommendation |
| "Factor this invoice →" link | Invoice factoring CTA (placeholder) |

#### Batch Logic Summary (batch mode only — 3 cards)

| Card | Content |
|---|---|
| Cold-Chain Verified | Compliance check across all batch orders |
| Pricing Confidence | Cross-reference against Group Buying pool; aggregate savings estimate |
| Exceptions flagged | Count of resolve-issue orders; indicates whether batch can fully execute |

#### Batch ROI Estimate (batch mode only)

| Row | Data |
|---|---|
| Labor hours saved by batch | Estimated hours |
| Manual steps eliminated | Count (N orders × 3) |
| Projected savings | Total $ saving |

#### Context Questions (always present — 3 buttons)

Questions adapt to context:

| Context | Question examples |
|---|---|
| Batch selected | "What's the risk profile of this batch?" / "Which orders can be auto-approved right now?" / "Summarize the exceptions and how to fix them" |
| Single order selected | "Why did you choose this logistics provider?" / "What's the backup plan if delivery fails?" / "How does {supplier} compare to alternatives?" |
| No selection | "Which order needs my attention most urgently?" / "What value is arriving today?" / "Any cost-saving opportunities I'm missing?" |

Clicking a question appends it to the chat thread and triggers an Atlas response.

#### Chat Thread

| Element | Behavior |
|---|---|
| Atlas messages | Left-aligned; Sparkles avatar circle + `rounded-2xl rounded-tl-sm` bubble; `text-[11px]`; sage-ash background |
| User messages | Right-aligned; `rounded-2xl rounded-tr-sm` bubble; sage green background (`#87986a`) + white text |
| Starts with | Atlas greeting message |
| Input field | Auto-growing textarea (not a single-line input); send button disabled when empty |
| Placeholder | "Ask about this batch…" or "Ask about logistics, ETAs, costs…" |

> **Memory rule:** Chat widget is always pinned to the bottom of the right panel. Insights scroll above it in a single unified scroll area — the panel is NOT split into two separate scroll containers.

---

## 1.5 Task Module Sheet (Modal)

Opens as a centered overlay when a stage node is clicked on the vertical DAG.

### Modes

| Mode | When | Header color |
|---|---|---|
| **Execute** (Manual) | Current stage, manual mode | Amber |
| **Edit** (Manual) | Completed stage, manual mode | Amber |
| **Plan ahead** (Manual) | Future stage, manual mode | Amber |
| **View Trace / Review Mode** | Any completed stage (agent or manual mode) | Sage green |

### Header

| Element | Data |
|---|---|
| Stage number badge | Number (1–12) in amber (input mode) or checkmark in sage (review mode) |
| Mode label | "Execute · Manual Task" / "Edit · Manual Task" / "History & Trace Record" |
| Order ID + stage index | "PO-XXXX · Stage X/12" |
| Attribution badge | "Admin" (amber) or "Agent #XX" (sage) — Review Mode only |
| "Atlas-delegated" badge | Green — when Active Handshake is active |
| Stage name | e.g. "Vendor Confirmed" |
| Cleared at / Action description | Timestamp (Review Mode) or action label (Input Mode) |

### Copilot / Audit Strip (below header)

**Input Mode:**

| State | Content |
|---|---|
| Active Handshake OFF | "Atlas · Copilot Hint" + `copilotHint` text + delegation button |
| Active Handshake ON | "Atlas · Sub-task Active" + `delegationLockedCopy` + "You will be alerted on updates" + "Release back to me" button |

**Review Mode:**

| Section | Content |
|---|---|
| Atlas Audit Summary | Logic field from the synthesized stage history |
| Immutable record banner | Shown in Agent Active mode; explains fields are read-only |
| Paper Trail | Trigger: what event started this stage. Proof: what verified it. Verified at: ISO timestamp |

### Form Fields

| Input type | Rendered as |
|---|---|
| `text` | Single-line text input |
| `date` | `datetime-local` input |
| `textarea` | Multi-line textarea (3 rows) |
| `select` | Pill toggle-group buttons (amber when selected) |
| `file` | Styled upload label with filename display |

In **Review Mode** fields are shown as read-only value boxes (or file download links for file fields).  
In **Manual Mode + Review Mode**, each field label shows a per-field Edit pencil → click to flip just that field back to input mode. Cancel restores saved value.

Each field label shows:
- Red asterisk if `required` and in Input Mode
- Attribution chip (Admin / Agent #XX) in Review Mode
- "Required" error badge if validation failed
- Atlas Fortress Lookup note (if `fortressLookup` is set and field has an error) — "Atlas can pull this from the internal directory (source)"

### Active Handshake (Delegation)

The delegation button appears in Input Mode, in the Copilot strip.

| State | Condition | Button |
|---|---|---|
| Locked | `delegationDependsOn` fields not yet filled | Disabled; shows "Needs: Field A · Field B" |
| Available | All dependency fields filled | "{delegationLabel}" — click to hand sub-task to Atlas |
| Active | Delegation toggled on | "Atlas · Sub-task Active" strip; form fields disabled; "Release back to me" button |

When delegated, form fields are grayed out (`opacity-60 pointer-events-none`) — Atlas owns this sub-task until released.

### Footer Actions

**Input Mode:**

| Button | Action |
|---|---|
| Cancel | Closes modal without saving |
| Save Draft | Saves form data without marking stage complete |
| Mark Stage Complete | Saves + advances the order's DAG stage |
| Review & Authorize PO | HITL gate label for Stage 0 |
| Review & Authorize Delivery | HITL gate label for Stage 11 |
| Save & Pre-stage | Label for future stages (Plan ahead mode) |

**Review Mode (no active edits):**

| Button | Condition | Action |
|---|---|---|
| Done | Always | Closes modal |
| Re-order This PO | Stage 12 (Delivered) only | Opens Re-order Draft Sheet pre-filled with this PO's items and vendor |

**Review Mode (field edits active):**

| Button | Action |
|---|---|
| Cancel | Discards in-progress field edits |
| "{N} fields being edited" | Info label |
| Save Edits | Saves all open field edits and closes modal |

---

## 1.6 Draft Sheet (Modal)

Opens when the admin clicks "New Order" (center panel) or "Repeat" (OrderCard hover). Also opened for Re-orders via the Re-order button in the order journey header or Stage 12 trace modal.

### Modes

| Mode | Trigger | Header |
|---|---|---|
| New Order | "New Order" button | "New Order · Manual Discovery Portal" |
| Re-order | Re-order button or Stage 12 "Re-order This PO" | "Re-order · From PO-XXXX" — pre-filled with original vendor + items |

### Form Fields

| Field | Description |
|---|---|
| Vendor | Pill-button grid from vetted directory (all unique suppliers currently in the system). ShieldCheck icon on each pill. |
| Items | Textarea (one item per line). Counter shows item count live. |
| Recurring | Checkbox: "Make this a recurring scheduled order". When checked, shows frequency picker (Weekly / Monthly). |
| Assignment | Two-option card grid: "Assign to Agent" (Bot icon, sage) or "Handle Manually" (Hand icon, amber). When "Assign to Agent" selected, shows agent picker (all unique agents in system by role + ID). |

### HITL Gate Notice

Always shown at the bottom of the form: "Stage 1 (PO Approval) and Stage 12 (Delivery Confirmation) always require your Review & Authorize — even when an agent is driving."

### Validation

- `canSubmit = vendor selected AND at least 1 item line`
- Submit button disabled and grayed out until valid

### Footer Actions

| Button | Condition | Action |
|---|---|---|
| Cancel | Always | Closes sheet without saving |
| Create PO Draft | One-off, non-recurring | Creates entry in Pending Drafts; Atlas posts confirmation to chat |
| Create Re-order Draft | Re-order mode | Same as above; pre-seeded from source PO |
| Schedule weekly PO | Recurring + Weekly | Creates recurring schedule entry |
| Schedule monthly PO | Recurring + Monthly | Creates recurring schedule entry |

After submit: draft appears in "Pending Drafts & Schedules" section in center panel default state, with an "Awaits Authorization" badge.

---

## 1.7 ⌘K Command Palette

Triggered by: clicking the search bar in the left panel header, or pressing ⌘K / Ctrl+K.

| Element | Data / Behavior |
|---|---|
| Search input | Auto-focused; filters orders by ID or supplier name (case-insensitive) |
| Results list | Up to all 7 orders; icon indicates status (red alert = resolve-issue, green check = delivered, blue truck = in transit/dispatched, amber clock = early stages) |
| Result row | Shows order ID + humanStatus + supplier + ETA |
| Click result | Selects that order + closes palette + opens its journey in center panel |
| Close | Click X button or click outside modal |

---

## 1.8 Labor Switch

The LaborSwitch component appears in the single-order journey header. It is a two-button pill toggle.

| Button | Label | State | Color |
|---|---|---|---|
| Left | "Agent #XX Active" | Agent mode (default) | Sage green |
| Right | "Manual Takeover" | Manual mode | Amber |

**Toggling to Manual Takeover:**
1. LaborSwitch highlights the "Manual Takeover" button amber.
2. Order Journey header turns amber-tinted.
3. A full-width amber banner appears: "Manual Takeover Active: You are now driving PO-XXXX."
4. All DAG stages become interactive Task Modules (Edit / Execute / Plan).
5. Right panel switches to Copilot Mode with standby message.
6. DAG stage labels show hover affordances: "Execute" (current) · "Edit" (done) · "Plan" (upcoming).

**Resumption Handshake (returning to Agent):**
The agent resumes from the current effective stage and inherits all manual data as immutable history. It will not re-do or re-verify manually-completed stages.

Accessible via: LaborSwitch, the Manual banner's "Resume Agent" button, or the right panel's "Resume Agent · Sync Manual Inputs" button.

---

## 1.9 All Admin Actions — Summary

| Action | Where | Notes |
|---|---|---|
| Select order | Left panel — click OrderCard | Loads single journey in center |
| Multi-select orders (batch) | Left panel — Ctrl+click OrderCards | Loads Batch Console in center |
| Select all / Deselect all | Left panel — "Select all" checkbox | Selects/deselects all action orders at once |
| Clear selection | Left panel — "Clear (N)" button | Returns to default center |
| Search / filter | Left panel search bar → ⌘K palette | Filter by ID or supplier |
| Open order journey | Click any OrderCard | |
| Toggle Labor Switch | Order journey header | Switch between Agent Active and Manual Takeover |
| Resume Agent | Manual banner / right panel / LaborSwitch | Ends manual takeover, syncs data to agent |
| Approve & Execute | Center panel, approve orders | Moves order to Journey Complete |
| Decline | Center panel, approve orders | Rejects agent's PO proposal |
| Contact Supplier | Center panel, resolve-issue orders | Resolves delivery failure |
| Reschedule | Center panel, resolve-issue orders | Alternative resolution |
| Confirm Delivery | Center panel, confirm-delivery orders | Completes final HITL gate |
| Report Issue | Center panel, confirm-delivery orders | Flags delivery problem |
| Execute Batch | Batch Console — sticky button | Processes all selected orders at once |
| Re-order | Order journey header (delivered orders) | Opens Draft Sheet pre-filled |
| New Order | Center panel default → "New Order" button | Navigates to New Request wizard |
| Open Stage Module | Click any interactive DAG stage node | Opens Task Module sheet |
| Fill Task Module form | Task Module sheet — various field types | Enter manual data for a stage |
| Save Draft (stage) | Task Module footer | Saves without advancing stage |
| Mark Stage Complete | Task Module footer | Advances DAG stage |
| Review & Authorize PO | Task Module footer — Stage 0 HITL | Approves the PO |
| Review & Authorize Delivery | Task Module footer — Stage 11 HITL | Confirms delivery received |
| Save & Pre-stage | Task Module footer — future stages | Plans ahead in manual mode |
| Edit field (Review Mode) | Per-field "Edit" pencil in Task Module | Flips single field to editable |
| Save Edits | Task Module footer (review, editing) | Saves corrected field data |
| Re-order from Stage 12 trace | Task Module footer — Stage 12 review | Shortcut to create re-order draft |
| Delegate sub-task (Active Handshake) | Task Module Copilot strip | Hands a stage sub-task to Atlas |
| Release Active Handshake | Task Module Copilot strip — "Release back to me" | Takes sub-task back from Atlas |
| View Stage Trace (agent mode) | Click done stage in DAG (agent mode) | Opens read-only history with paper trail |
| Expand agent sub-step | DAG stage chevron (agent mode, done/current) | Shows agent's detailed action text |
| Navigate to Governance | "Managed by: Agent #XX" link | Opens Governance page for that agent |
| Ask Atlas (quick questions) | Right panel — 3 context question buttons | Appends to Atlas chat thread |
| Chat with Atlas | Right panel — chat input | Free-form logistics/ETA/cost questions |
| Factor invoice | Right panel — Embedded Finance "Factor" link | Invoice factoring (placeholder) |
| New Order (Draft Sheet) | Center default panel → New Order button | Draft Sheet — manual discovery portal |
| Re-order (Draft Sheet) | Order header Re-order button or Stage 12 modal | Draft Sheet — pre-filled carbon copy |
| Submit draft | Draft Sheet → "Create PO Draft" / "Schedule" button | Creates Pending Drafts entry |
| Toggle recurring | Draft Sheet — Recurring checkbox | Adds weekly/monthly schedule |
| Pick frequency | Draft Sheet — Weekly / Monthly buttons | Sets recurrence cadence |
| Assign to agent | Draft Sheet — Assignment cards | Picks which agent runs the PO |
| Pick agent | Draft Sheet — agent pill buttons | Selects specific agent by role |
| Handle manually | Draft Sheet — Assignment cards | Admin drives from the start |
| Search ⌘K | Left panel search bar or keyboard shortcut | Opens command palette |
| Select via ⌘K | ⌘K result click | Selects order + opens journey |
| Expand to Audit Mode | Left panel header — Maximize2 icon | Expands left to full width, collapses center, swaps right panel to Operations Insights |
| Collapse Audit Mode | Audit header Minimize2 · OR Escape with no row selected | Returns to Triage Mode |
| Audit search | Audit header — search input (auto-focused) | Filters across PO id, supplier, items, agent |
| Audit status filter | Status filter chips | Filter by Live / Completed / Disputed / Cancelled / On Hold |
| Audit date range | Filter row — preset pills | 7 / 30 / 90 days / All time |
| Audit supplier filter | Filter row — dropdown | Scope ledger to a single supplier |
| Audit stage filter | Filter row — dropdown | Scope to Procurement (0-3) / Processing (4-7) / Logistics (8-11) |
| Audit agent filter | Filter row — dropdown | Scope to a single assigned agent |
| Clear audit filters | "Clear filters" link | Resets search + all dropdowns |
| Audit Select All | Toolbar checkbox | Selects/clears all filtered rows |
| Audit view toggle | Toolbar — Table/Grid | Switches the audit content layout |
| Export CSV | Toolbar — Export button | Downloads `orders-audit-YYYY-MM-DD.csv` (selection if any, else full filtered set) |
| Open audit row · live | Click a live row | Collapses Audit Mode and loads Single Order Journey |
| Open audit row · historical | Click a historical row | Keeps Audit Mode open; surfaces Quick Journey on the right |
| Filter to top supplier | Click a supplier card in Operations Insights | Sets the supplier filter on the audit list |
| Open Full Workspace (Quick Journey) | Audit right panel — sage button | Snaps out of Audit Mode and loads the selected order's full journey |
| Decision Trail (Journey header) | Single Order Journey header | Opens the Decision Attribution Trail sheet for the selected live order |
| Decision Trail (Quick Journey) | Audit Mode Quick Journey right panel | Same sheet, opened from the audit ledger after picking a live row |
| Decision Trail (historical row click) | Audit Mode table — non-Live row | Trail opens directly; historical orders have no live journey |
| Trail · Agents Involved chip | Top of Trail sheet | Drops trail-return marker → Governance (`#agent-NN`) |
| Trail · Agent in Governance chip | Per stage card (expanded) | Drops trail-return marker → Governance (`#agent-NN`) |
| Trail · Decision · DEC-XXX chip | Per stage card (expanded) | Drops trail-return marker → Governance (`#decision=DEC-XXX` from real pool DEC-001..DEC-008) |
| Trail · AI Activity · evt-XXX chip | Per stage card (expanded) | Drops trail-return marker → AI Activity (`#evt=evt-XXX` from real pool evt-001..evt-012) |
| TrailReturnPill | Governance / AI Activity / Workflows (when marker present) | Fixed pill at `top: 64px`. Click → navigate back to Orders → Trail re-opens at the same stage |
| Trail · Workflow chip | Trail header — blue 🧭 pill | Drops trail-return marker → Workflows (`#workflow=WF-XXX`); Workflows auto-selects that template |
| Audit Workflow filter | Audit Mode secondary filter row | Dropdown of all 8 templates — scopes the audit list to a single playbook |
| Audit Workflow column | Audit Mode table | Blue pill per row showing the order's `workflowTemplate`; hover reveals the template description |

---

## 1.10 Flows

### New Order flow

1. Admin clicks **New Order** in center panel → navigates to New Request page (7-step wizard, Step 1).

### Draft Order flow (from Orders page)

1. Admin clicks **New Order** → Draft Sheet opens.
2. Admin picks vendor from vetted directory pills.
3. Admin types items (one per line).
4. (Optional) Admin toggles recurring + sets weekly/monthly frequency.
5. Admin picks assignment: Agent #XX or Handle Manually.
6. Admin clicks **Create PO Draft** (or **Schedule weekly/monthly PO** if recurring).
7. Entry appears in "Pending Drafts & Schedules" with "Awaits Authorization" badge.

### Re-order flow

1. Admin opens delivered order (stage ≥ 11) OR opens Stage 12 trace modal.
2. Clicks **Re-order** button.
3. Draft Sheet opens pre-filled with original vendor + items.
4. Admin confirms/modifies items, sets assignment.
5. Submits → creates new Pending Draft entry.
*(Alternatively: navigates to New Request page in "carbon-copy" mode at Step 6/Review.)*

### Single order approval flow

1. Admin sees order in "Needs Your Action" (approve kind).
2. Clicks card → Order Journey loads in center.
3. Reviews agent reasoning (right panel) + agent proposal.
4. Clicks **Approve & Execute** (or **Decline**).
5. Journey Complete screen appears with cost/labor savings.

### Batch approval flow

1. Admin Ctrl+clicks multiple orders from "Needs Your Action".
2. Batch Console appears with summary (approve/confirm/resolve counts).
3. Reviews per-order details + right-panel Batch Logic Summary.
4. Clicks **Execute Batch** — all orders processed at once.
5. Batch Complete screen appears with aggregate savings.

### Manual Takeover flow

1. Admin selects an order and clicks **Manual Takeover** on LaborSwitch.
2. Amber banner appears — agent suspended.
3. Admin clicks any stage node on the vertical DAG.
4. Task Module sheet opens for that stage.
5. Admin fills form fields, optionally delegates sub-tasks back to Atlas (Active Handshake).
6. Admin clicks **Save Draft** (save without advancing) or **Mark Stage Complete** (advances stage).
7. Repeat for each stage needed.
8. When done, admin clicks **Resume Agent** — agent re-enters from current stage, inheriting all manual data.

### Active Handshake (delegation within manual mode)

1. Admin is in Manual Takeover on an order, has opened a Task Module.
2. Admin fills the dependency fields for this stage (e.g. provides tracking number).
3. **Delegation button** becomes active (was grayed out before deps filled).
4. Admin clicks delegation button (e.g. "Ask Atlas to verify carrier compliance").
5. Copilot strip switches to "Atlas · Sub-task Active" state — form fields disabled.
6. Right panel shows "You will be alerted on updates."
7. To take back: admin clicks **Release back to me** — form re-enables.

### Resumption Handshake (Manual → Agent)

1. Admin clicks **Resume Agent** (anywhere it appears).
2. LaborSwitch returns to sage Agent Active state.
3. All manually-entered data is preserved as immutable history.
4. Agent resumes from the effective stage; skips any manually-completed stages.

### Stage trace / audit flow (agent mode)

1. Admin opens an order in Agent Active mode.
2. Clicks a completed stage on the DAG → "View Trace" affordance.
3. Task Module opens in Review Mode (sage header).
4. Admin sees: Atlas Audit Summary (logic), Paper Trail (trigger + proof + verified-at timestamp), all field data with per-field agent attribution.
5. Right panel shows "Immutable Record" notice + "Switch to Manual Takeover" shortcut.

### Audit Mode — historical investigation flow

1. Admin opens Orders → clicks **Maximize2** in the left header.
2. Left expands; right panel switches to Operations Insights (4 KPI cards + status mix + top suppliers).
3. Admin sets Status = `Disputed` and Date range = `90 days` — 3 historical disputes surface.
4. In the right-panel Disputes card, admin clicks the top source — the audit list re-filters to that supplier.
5. Admin clicks a disputed row → Quick Journey loads on the right showing the failure stage.
6. Admin clicks **Open Full Workspace** → Audit Mode collapses and the full Single Order Journey loads in the center.

### Audit Mode — bulk export flow

1. Admin enters Audit Mode, applies a filter (e.g. Supplier = `Thai Fresh Co`, Date range = `90 days`).
2. Clicks the **Select All** checkbox in the toolbar → all filtered rows are checked.
3. Clicks **Export** → browser downloads `orders-audit-YYYY-MM-DD.csv` with PO ID · Supplier · Status · Items · Amount · Agent · Created · Completed · Resolution columns.
4. Audit Mode stays open for further drill-downs.

### Correction flow (Review Mode + Manual Mode)

1. Admin is in Manual Takeover, opens a completed stage → Review Mode.
2. Clicks **Edit pencil** on a specific field.
3. That field flips to an editable input (others remain read-only).
4. Admin enters corrected value.
5. Clicks **Save Edits** → correction saved to `manualStageData`; field re-renders with "Admin" attribution chip.

---

## 1.11 Audit Mode

**File:** `src/components/NewOrdersPage.tsx` · **Pattern peers:** Inventory § 3.3, Suppliers § 5.4

A parallel left-panel mode that exposes the combined **live + historical ledger** of all orders for review, filtering, bulk export, and journey lookup. Audit Mode is intra-page — it does not navigate elsewhere. Triage Mode (§ 1.2) is unaffected and remains the default.

### Entering / Exiting

| Action | How |
|---|---|
| Enter Audit Mode | Click the **Maximize2** icon in the Triage header (next to "Clear (N)") |
| Exit Audit Mode | Click the **Minimize2** icon in the Audit header · OR press **Escape** with no row selected · OR a cross-page deep-link arriving via `#order=PO-XXXX` (Hash Reader, § 1.12) automatically collapses Audit Mode and loads the journey |

The layout transitions via a 380ms cubic-bezier spring on flex values: left panel `0 0 280px` → `1 1 0%`, center `1 1 0%` → `0 0 0px` with opacity fade. Right panel stays 280px and swaps content.

### Left Panel — Audit ledger

**Header**
- `History` icon + "Orders Audit" title
- Sub-line: "{filtered}/{total} orders · Agent #10 (Ops Analytics)"
- Minimize2 collapse button

**Search input** (auto-focused on entering Audit Mode): matches against PO id, supplier name, item text, and agent label.

**Status filter chips** (each with a live count from `auditStatusCounts`):
- All · Live · Completed · Disputed · Cancelled · On Hold

**Secondary filter row** (`FilterIcon` prefix):
- **Date range preset** — 7 days · 30 days · 90 days · All time. Cuts against `completedAt` when present, else `createdAt`.
- **Supplier dropdown** — every unique supplier in `ALL_ORDERS` (16 vendors).
- **Stage band dropdown** — Any stage · Procurement (0–3) · Processing (4–7) · Logistics (8–11).
- **Agent dropdown** — every unique `assignedAgent` in the ledger.
- **Workflow dropdown** — every template id from `workflowTemplates`. Scopes the ledger to a single playbook.
- **Clear filters** link — appears when any filter is active.

**Toolbar**
- Select-All checkbox (selects/clears all currently filtered rows)
- Table / Grid view toggle (`List` / `LayoutGrid` icons)
- **Export CSV** button — downloads `orders-audit-YYYY-MM-DD.csv`. When ≥1 row is checked, exports only the selection; otherwise exports the full filtered set.

### Table view (default)

12 columns: ☐ checkbox · PO id (monospace) · Supplier · Items (truncated) · Amount · Status pill · Stage badge (`N/11`) · **Workflow pill** (blue, hover-tooltip shows the template description) · Agent · Created · Completed · Savings.

Row interactions:
- **Click a live row** → collapses Audit Mode and loads the Single Order Journey in the center panel (§ 1.3 State 2).
- **Click a historical row** → keeps Audit Mode open and surfaces the Quick Journey card on the right panel.
- **Click checkbox** → toggles the row in `auditSelected` without selecting it.

### Grid view

Card per order: PO id + checkbox · supplier name · items (line-clamp) · status pill + amount · mini 12-stage progress bar (color-coded by status — sage for live, green for completed, red for disputed, gray for cancelled) · agent badge + created date.

### Right Panel — Audit Mode

**No row selected → Operations Insights (Agent #10)**

| Section | Contents |
|---|---|
| 4 KPI cards | Processed (count + $ spend) · On-time % · Avg cycle time (hours, PO → Delivered) · Recovered savings ($) |
| Status mix bars | Horizontal bar per status (live / completed / disputed / cancelled / on-hold) with pct fill + count |
| Top suppliers · spend | Top 5 suppliers ranked by total spend. Clicking a card **sets the supplier filter** on the audit list. |
| Disputes · top sources | Suppliers with ≥1 disputed order, ranked descending (red-tinted cards) |

All insights are scoped to the current filter window — change any filter and the right panel re-aggregates.

**Row selected → Quick Journey**

| Element | Behavior |
|---|---|
| Header | "Quick Journey" + PO id · supplier |
| Order detail card | Amount (large) · Stage `N/11` · `humanDescription` |
| Compact 12-stage dot rail | Done (sage) · Current (amber pulsing) · Upcoming (gray) |
| **Open Full Workspace** button | Snaps out of Audit Mode and loads the Single Order Journey |
| **Message Supplier** button | Opens the Source Bridge for that supplier |

### Audit-Mode state (component-local)

| State | Type | Default |
|---|---|---|
| `auditMode` | boolean | `false` |
| `auditView` | `'table' \| 'grid'` | `'table'` |
| `auditSearch` | string | `''` |
| `auditStatusFilter` | `'all' \| OrderStatus` | `'all'` |
| `auditDateRange` | `'7d' \| '30d' \| '90d' \| 'all'` | `'30d'` |
| `auditSupplierFilter` | `string \| null` | `null` |
| `auditStageFilter` | `'all' \| 'procurement' \| 'processing' \| 'logistics'` | `'all'` |
| `auditAgentFilter` | `number \| null` | `null` |
| `auditSelected` | `Set<string>` | empty |
| `auditSearchRef` | `RefObject<HTMLInputElement>` | — |

### Flow — Historical lookup

1. Admin opens Orders — Triage Mode shows the 7 live orders.
2. Admin clicks **Maximize2** → left panel expands; right panel switches to Operations Insights.
3. Sets Status = `Disputed`, Date range = `90 days` → 3 disputed historical orders surface.
4. Right panel Disputes card lists the top sources; admin clicks one to filter to that supplier.
5. Admin opens a disputed row → Quick Journey shows the failure stage; admin clicks **Open Full Workspace** to dig in.

### Flow — Bulk export

1. Admin enters Audit Mode, applies filter (e.g. Supplier = `Thai Fresh Co`, Date range = `90 days`).
2. Clicks **Select All** → all filtered rows checked.
3. Clicks **Export** → browser downloads `orders-audit-YYYY-MM-DD.csv` with columns: PO ID · Supplier · Status · Items · Amount · Agent · Created · Completed · Resolution.

> **Out of scope (v1):** Bulk Cancel, Bulk Re-order, Bulk Compare overlay, and Mark-Resolved are not yet wired. Agent-decision attribution per stage per order is planned as a follow-up surface.

---

## 1.12 Decision Attribution Trail

**Files:** `src/components/NewOrdersPage.tsx` (Trail JSX + `synthesizeAttribution` / `buildAttributionTrail`) · `src/lib/trailReturn.ts` (sessionStorage helpers) · `src/components/TrailReturnPill.tsx` (floating pill rendered on destinations)

**Purpose:** A consolidated audit-trail surface that, for any order, lays out **all 12 stages with full agent attribution**: who acted, what they decided, with what confidence, against what data, ruling out which alternatives, with what outcome, and whether a human override applied. Designed as the bridge between Orders and the Governance / AI Activity story.

### Entry points

| From | How |
|---|---|
| Single Order Journey header | Click the **`Decision Trail`** button (History icon) — sits between `Re-order` and `LaborSwitch`. |
| Audit Mode Quick Journey | When a live order is selected from the audit ledger, the right panel shows three buttons; **`Decision Trail`** is the second one. |
| Audit Mode historical row | Clicking any non-`Live` row in the audit table opens the Trail directly — historical orders have no single-order journey, so the Trail is their inspection surface. |

### Shell

Renders as a full-screen modal sheet (max-width `5xl`, max-height `90vh`) — matches the Task Module / Draft Sheet pattern.

| Region | Contents |
|---|---|
| Header | `History` icon · "Decision Attribution Trail" label · `PO-XXXX · supplier · $amount` · **🧭 Workflow chip** (blue, clickable — drops trail-return marker, navigates to Workflows with `#workflow=WF-XXX`) · summary line "{N} agents · 12 stages · {M} human overrides" · close button |
| Agents Involved | Chip row, top of body. One chip per distinct agent on this order: `🤖 #07 · Logistics · 5 decisions · ↗`. Click → drops the trail-return marker and navigates to that agent's Governance profile. |
| Override callout | Purple banner shown when ≥1 stage carries a human override |
| Stage-by-stage timeline | 12 collapsible cards, one per DAG stage |
| Footer | Caption: "Attribution is the bridge between Orders and the Governance / AI Activity story…" + Done button |

### Stage card

Collapsed header row:
- Stage number circle (color-coded by outcome: sage = success, purple = overridden, red = failed, amber = flagged, gray = pending)
- Stage name (e.g. "PO Created")
- Agent badge (e.g. `🤖 #07 · Logistics`)
- Outcome chip (`✓ Success` / `⚠ Flagged` / `✗ Failed` / `✋ Overridden` / `⏱ Pending`)
- Confidence percentage (color-coded — green ≥90, amber 70-89, red <70)
- One-line decision summary

Expanded body:
- **Override callout** (purple-bordered, only when present) — "Human override · Admin · {reason} · timestamp"
- **Data used** — key/value rows pulled from `synthesizeStageHistory` (verified-at, proof, plus 2 stage-specific data fields)
- **Alternatives rejected** — list of `× option — italic rationale` cards
- **Cross-page deep-link chips:**
  - `🤖 Agent in Governance` (always)
  - `📊 Decision · DEC-XXX` (stages 0-3 only)
  - `⚡ AI Activity · evt-XXX` (auto-order / compliance / monitor stages only)
  - Each chip drops a `sessionStorage` trail-return marker before navigating.

The Trail **header** also carries the **🧭 Workflow** chip (one per order) that deep-links into Workflows & Kernel with the same trail-return contract.

### Trail-return contract

The crux of the audit-trail loop:

1. User clicks a cross-page chip in the Trail.
2. `setTrailReturn(orderId, stageIdx)` writes `{ orderId, stageIdx, savedAt }` to `sessionStorage['buyamia-trail-return']` (30-min TTL).
3. Trail closes; `onNavigate('governance' | 'ai-activity' | 'workflows')` flips the page.
4. The destination page reads the marker on mount and renders a fixed-position **TrailReturnPill** at `top: 64px` (below the top nav, centered).
5. The destination also picks up the URL hash payload:
   - `#decision=DEC-XXX` → scroll-into-views the row in the Decision Ledger and flashes it sage (2.2s `flash-row` keyframe). Unknown ids → amber `toast.warning` fallback.
   - `#evt=evt-XXX` → scroll-into-views the event card and flashes it sage (2.2s `flash-event` keyframe). Unknown ids → amber toast fallback.
   - `#agent-NN` → Governance fires a "Opened Governance for Agent #NN" info toast.
   - `#workflow=WF-XXX` → Workflows page sets `selectedWorkflow` to that template. Unknown ids → amber toast fallback.
6. User clicks the pill → `onNavigate('orders')`. The marker stays in sessionStorage.
7. `NewOrdersPage` mount effect reads the marker, re-opens the Trail at the same order, expands the same stage, and **clears the marker**.

### Synthetic data scheme

`synthesizeAttribution(order, stageIdx)` is deterministic:
- **Agents per stage** — `ATTRIBUTION_BLUEPRINT` blueprint (Stage 0 → #7 Logistics, Stage 1 → #5 Vendor Comms, Stage 2 → #28 Payments, etc.). The order's own `assignedAgent` overrides the blueprint when the ids match.
- **Confidence** — 78-99% base, dipped by ~30pts on the failure stage of `disputed` orders and capped at 0 on stages beyond `dagStage` for `cancelled` orders.
- **Outcome** — derived from `order.status × stageIdx × dagStage`.
- **Overrides** — synthesized on ~6% of historicals on stages 1-7, with realistic reason strings.
- **Deep-link ids** — picked from the **real seeded pools**: `DEC-001..DEC-008` (mockData.ts) and `evt-001..evt-012` (AIActivityPage). Many-to-one mapping by design.

`buildAttributionTrail(order)` returns all 12 stages as a `StageAttribution[]`.

### Out of scope (v1)

- Editing data points inline (that's AI Activity's job).
- Per-stage rollback from the Trail (also AI Activity).
- Workflow template attribution (planned next — see Concern 2 in the implementation history).

---

## 1.13 Deep-Link Hash Reader

On mount and on every `hashchange`, Orders inspects `window.location.hash`:

| Hash form | Effect |
|---|---|
| `order=PO-XXXX` | If the PO exists in `ORDERS`, sets `selectedIds` to that single order (loading the Order Journey center state), clears `journeyCompleteId` and `batchComplete`, **collapses Audit Mode**, and clears the hash. |

Dispatchers known to set this hash:
- Inventory "Open PO-XXXX in Orders" buttons in Phase 2 stream switchers and Stage Trace modals.
- RequestPanel after `Authorize & Deploy Agent` (`#order=PO-2026-0147`).
- Any caller dispatching `buyamia-navigate-page` with `{ page: 'orders', orderId: 'PO-XXXX' }` — `App.tsx` promotes the payload to the hash before flipping pages.

The hash is consumed once per visit (cleared after read) so subsequent renders or hashchange events don't re-trigger selection. Historical orders are intentionally **not** addressable by hash — only the 7-row `ORDERS` set is deep-linkable, matching the cross-page navigation contract.

**Trail-return marker** (separate from URL hash, lives in sessionStorage): when the marker is present on Orders mount, the Decision Attribution Trail is auto-re-opened on the saved order + stage. See § 1.12 for the full contract.

---

---

# 2. Overview Page

**File:** `src/components/OverviewPage.tsx`
**Nav label:** Overview
**Purpose:** The command hub and first screen. The admin sees everything that needs a decision (triage queue), the business financial pulse (performance analytics), and the full logistics calendar — all with Atlas available for instant analysis. Zero navigation needed to start working on the most critical items.

---

## 2.1 Data Model

### Metrics (4 KPI cards)

| Metric | Value | Change | Detail |
|---|---|---|---|
| Month's Spend | $47,820 | -8.2% (favorable) | vs $52,080 last month |
| Active Orders | 23 | +12% | 5 arriving today |
| Low Stock | 4 items | — | 2 auto-reorders sent |
| AI Savings | $3,075 | — | 12 actions today |

### Critical Actions / Triage Queue (3 POs)

| PO | Supplier | Amount | Type | Urgency | Why | Estimated Saving |
|---|---|---|---|---|---|---|
| PO-2847 | PT Maju Bersama | $12,400 | High-Value PO | High | New supplier — first order over $10k threshold | $1,120 |
| PO-2851 | Thai Fresh Co | $3,200 | Rush Order | High | Client #4021 needs Friday delivery | $240 |
| PO-2855 | AUS Meats Pty | $8,900 | New Supplier Trial | Medium | Scored 88/100 — trial order with quality hold clause | $680 |

Each PO also carries:
- **`aiReasoning`** — Atlas analysis posted to chat when PO is opened
- **`contextQuestions`** — 3 preset questions to ask Atlas about this PO
- **`negotiationLog`** — Timestamped log of agent actions taken (agent badge + action text)

### System Alerts (3)

| Alert | Severity | Quick-Approve? | Saving |
|---|---|---|---|
| Lamb Rack at 12% — auto-reorder queued | Warning | Yes | $85 |
| Vietnam import cert expires in 5 days | Warning | No | — |
| VN Supply reliability score fell to 82 | Info | No | — |

### Autonomous Actions Today (6)

| Time | Action | Agent | Class | Saving |
|---|---|---|---|---|
| 2m ago | Auto-ordered 500kg rice from PT Maju Bersama | #14 | Execution | $240 |
| 18m ago | Rejected VN Supply quote — 15% above market rate | #6 | Reasoning | $1,200 |
| 45m ago | Joined shared purchase pool for cooking oil | #14 | Execution | $680 |
| 1h ago | Updated demand forecast for seafood category | #26 | Sensing | — |
| 2h ago | Generated import compliance docs for Indonesia | #33 | Governance | — |
| 3h ago | Auto-ordered cleaning supplies — below threshold | #14 | Execution | $85 |

Agent classes: **Sensing** (Radar, blue) · **Reasoning** (Brain, purple) · **Execution** (Zap, green) · **Governance** (Scale, amber).

### Live Pulses (4, auto-rotates every 4 seconds)

| Agent | Current task |
|---|---|
| #6 (Pricing) | Analyzing 14 quotes for PO-2855... |
| #26 (Forecast) | Updating protein demand model... |
| #5 (Sourcing) | Scanning 3 new vendor listings... |
| #33 (Compliance) | Verifying Indonesia import cert... |

### Spending Trend Chart

12 months of data. Jan–Oct: actual spend. Nov–Dec: AI forecast by Agent #26.
- Solid line = actual spend
- Dashed line = forecast
- Shaded confidence band = predHigh / predLow range

### Autonomy Goal

| Field | Value |
|---|---|
| Current level | 3 |
| Target level | 4 |
| Progress | 72% |
| Remaining approvals | 8 |
| Next label | Semi-Autonomous |
| Category | Seafood |

### This Week's ROI

| Metric | Value |
|---|---|
| Manual steps eliminated | 14 |
| Labor hours saved | 3.5h |
| Working capital freed | $4,200 |

### Temporal Alerts (calendar mode only)

| Severity | Title | Agent | Saving |
|---|---|---|---|
| High | Cash-Flow Crunch — Apr 12–13: 3 payments totaling $15.8K due in 48h. Pay Thai Fresh today (2% discount), defer Oceanic Harvest | #28 (Payments) | $640 |
| Medium | Logistics Bottleneck — Apr 12: 2 deliveries + 1 payment converge. Port monsoon delay risk on Tiger Prawn cold-chain | #7 (Logistics) | — |
| Low | Compliance Window Closing: Indonesia cert expires Apr 14. Agent #33 has pre-filled renewal — needs signature only | #33 (Compliance) | — |

### Calendar Savings Summary (calendar mode only)

| Category | Amount | Agent |
|---|---|---|
| Early-payment discounts | $640 | #28 |
| Group buy volume locks | $506 | #14 |
| Pre-locked price windows | $1,450 | #6 |
| **Total available** | **$2,596** | |

### Calendar Events (14)

| ID | Title | Date | Time | Type | Status | Supplier | Amount | Saving |
|---|---|---|---|---|---|---|---|---|
| EVT-001 | Lamb Rack Delivery | Apr 11 | 14:00 | Delivery | In Transit | AUS Meats Pty | $12,400 | $420 |
| EVT-002 | Tiger Prawn Arrival | Apr 12 | 08:00 | Delivery | Pending | Indo Seafood Corp | $4,650 | $520 |
| EVT-003 | Pay Thai Fresh Co | Apr 12 | 17:00 | Payment | **Action Needed** | Thai Fresh Co | $3,200 | $640 |
| EVT-004 | Salmon Fillet Restock | Apr 12 | 16:00 | Restock | **Action Needed** | Oceanic Harvest | $2,800 | — |
| EVT-005 | Indonesia Import Cert Renewal | Apr 14 | — | Compliance | Pending | — | — | — |
| EVT-006 | Beef Tenderloin Delivery | Apr 13 | 10:00 | Delivery | Pending | PT Sumber Daging | $8,900 | $380 |
| EVT-007 | Cooking Oil Group Buy Window | Apr 11 | 23:59 | Payment | **Action Needed** | — | $1,800 | $216 |
| EVT-008 | Chicken Breast PO Decision | Apr 11 | 20:00 | Restock | Pending | PT Maju Bersama | $2,080 | $290 |
| EVT-009 | Seafood Quality Audit | Apr 15 | — | Compliance | Pending | — | — | — |
| EVT-010 | Rice Delivery — PT Maju | Apr 10 | 11:00 | Delivery | Completed | PT Maju Bersama | $3,500 | $240 |
| EVT-011 | Bell Pepper Pre-Order | Apr 10 | 15:00 | Restock | Completed | Bali Fresh Farms | $960 | $90 |
| EVT-012 | VN Supply Invoice Overdue | Apr 8 | — | Payment | **Overdue** | VN Supply Co | $5,400 | — |
| EVT-013 | Herb Supplier Meeting | Apr 16 | 10:00 | Meeting | Pending | Bali Fresh Farms | — | — |
| EVT-014 | Coconut Milk Bulk Restock | Apr 17 | — | Restock | Pending | — | $1,275 | $70 |

Event types: **delivery** (Truck) · **payment** (CreditCard) · **compliance** (FileText) · **restock** (Package) · **meeting** (MessageCircle).

Event statuses: **pending** (blue) · **in-transit** (purple) · **action-needed** (amber) · **completed** (green) · **overdue** (red).

### DAG Kernel Stages (12, used in Calendar Event Journey)

| # | Stage | Agent Step |
|---|---|---|
| 0 | Demand Forecast | Agent #25 (POS Intelligence) calculated 7-day consumption velocity from live sales data |
| 1 | Par Level Check | Agent #8 (Restock) detected depletion below par threshold |
| 2 | Supplier Match | Agent #21 (Market Intel) cross-referenced suppliers against price + reliability |
| 3 | Price Lock | Agent #14 (Pricing) locked volume discount |
| 4 | PO Generated | Agent #1 (PO Engine) generated PO with quality hold clause |
| 5 | ERP Sync | Agent #14 (ERP) synced inventory reservation to accounting ledger |
| 6 | Compliance Check | Agent #22 (Compliance) verified certifications + PPN tax calculation |
| 7 | Payment Queued | Agent #28 (Payments) queued payment with governance rules applied |
| 8 | Dispatched | Agent #12 (Logistics) confirmed dispatch from supplier warehouse |
| 9 | In Transit | Agent #7 (Logistics) monitoring GPS + cold-chain temperature sensors |
| 10 | Regional Hub | Agent #7 confirmed cold-chain integrity at regional hub |
| 11 | Delivered & Verified | Agent #9 (Quality) ran QC inspection against specs |

---

## 2.2 Left Panel — Triage Queue

**Purpose:** Surface all items requiring the admin's decision. Admin clears this list before it grows.

### Progress Bar

| Element | Data |
|---|---|
| "{N}/{total} Tasks Cleared" | Counts approved POs + quick-approved alerts vs 6 total |
| "{N} remaining" | Inverse |
| Progress fill | Sage green, animates on each clear |

### REQUIRES REVIEW section

| Element | Data / Action |
|---|---|
| Empty state | "All reviews complete" + green checkmark |
| PO button | PO ID + urgency icon (Zap=high red / AlertTriangle=medium amber / Info=low blue) + reason + amount |
| Click | Loads PO Workspace in center; Atlas posts reasoning to chat |
| Selected state | Sage-tinted border highlight |
| Fly-out on approve | Card slides right and fades (380ms) |

### SYSTEM ALERTS section

| Element | Data / Action |
|---|---|
| Alert card | Icon + label + severity color (warning=amber, info=blue) |
| Quick-approve button | Small green check button — only on `canQuickApprove: true` alerts |
| Quick-approve | Turns card green + "Approved" label + saving float badge |

---

## 2.3 Center Panel

Four states driven by mode toggle and selection.

---

### State 1: Analytics Mode (default)

#### Mode Toggle Header

Two-button pill: **Performance** (BarChart3) | **Logistics Calendar** (Calendar).

#### 4 Metric Cards

Each shows: icon + label + value + trend arrow (TrendDown = green, TrendUp = red) + detail sub-label.

#### Monthly Spending Trend Chart (Recharts AreaChart)

| Element | Data |
|---|---|
| Solid area (sage) | Actual spend Jan–Oct |
| Dashed area (sage) | AI forecast Nov–Dec |
| Shaded band | Agent #26 confidence interval (predHigh/predLow) |
| X-axis | Month abbreviations |
| Y-axis | Dollar values formatted as $XK |
| Tooltip | Month + actual/forecast value |

---

### State 2: Calendar Mode

#### Calendar Header

- "Logistics Calendar — April 2026"
- "{N} items need action" count (action-needed + overdue, excluding cleared)
- Daily Savings badge (accumulated from cleared events this session)
- View switcher: **Month** | **Week** | **Agenda**

#### Month View

Full April 2026 grid (7 columns Sun–Sat).

| Element | Behavior |
|---|---|
| Today (Apr 10) | Sage circle around date number |
| Event count badge | Amber if any action-needed/overdue; sage otherwise |
| Status dots | Up to 4 colored dots: red (overdue), amber (action-needed), purple (in-transit), green (completed), blue (pending) |
| "+N" overflow | Shown when >4 events on a day |
| Click dot | Opens that event's journey |

#### Week View

One card per day, Apr 6–12 2026.

| Element | Data |
|---|---|
| Date column | Weekday + large day number; "Today" on Apr 10 |
| Today card | Sage-tinted border |
| Event cards | Full event details with hover micro-actions |
| Empty day | "No scheduled events" |

#### Agenda View

All non-cleared events sorted chronologically, grouped by date dividers.
Date divider shows: date label + "Today" badge (Apr 10) + event count.

#### CalendarEvent Card (all calendar views)

| Element | Data |
|---|---|
| Type icon | In status color |
| Title + status icon | |
| Time + supplier + amount | Sub-row detail |
| Estimated saving | "saves $X" in green |

Hover micro-actions:

| Button | Action |
|---|---|
| View Journey | Opens event in center; posts reasoning to chat |
| Pay Now / Execute / Complete | Clears deadline: amber flash animation → event removed → saving accumulated → Atlas confirms |
| Atlas | Posts event reasoning directly to chat |

---

### State 3: Calendar Event Journey

Opens when any calendar event is clicked.

#### Journey Header

| Element | Data / Action |
|---|---|
| Type icon + title | e.g. Truck + "Lamb Rack Delivery" |
| Status badge | Color-coded |
| Date/time/supplier/PO ref | Meta row |
| "← Calendar" button | Returns to calendar |

#### Amount + Action Card

| Element | Data / Action |
|---|---|
| Amount | Large `$X,XXX` with label ("Payment due" / "Order value" / "Estimated cost") |
| Potential saving | Green `$X` if available |
| Primary CTA | "Approve Payment" (payment) / "Sign & Submit" (compliance) / "Confirm Receipt" (delivery) / "Mark Complete" (other) |
| Message button | Contact supplier (placeholder) |
| Atlas button | Sends Atlas query to chat |

Clicking the primary CTA: event animates out (amber flash → fade), saving float appears, dailySavings increments, Atlas confirms in chat.

#### 12-Stage DAG Kernel (read-only)

| State | Visual |
|---|---|
| Complete | Green dot + checkmark |
| Active | Sage pulsing dot + "In Progress" badge |
| Failed | Red dot + X + "Failed" badge |
| Pending | Gray dot |

Click any stage with an agent step to expand its detail text.

#### Agent Reasoning

Full `agentReasoning` text block (same text auto-posted to chat when event is opened).

---

### State 4: PO Workspace

Opens when a triage PO is clicked.

#### PO Header

PO ID + supplier + type + "← Back" button.

#### PO Detail Card

| Element | Data / Action |
|---|---|
| Amount | Large `$X,XXX` |
| Urgency badge | High (red) / Medium (amber) / Low (blue) |
| Reason | Why this needs review |
| Estimated saving | Green `$X` |
| Approve | Green button — fly-out, removes from queue, saving float, Atlas confirms |
| Decline | Outline — declines the proposal |
| View | Eye icon — inspect mode (placeholder) |

#### Live Agent Negotiation Log

Live log with green pulse dot. Shows each agent's action in sequence (agent badge + text). Animated dots at the bottom indicate agents are still working.

#### Menu Engineering Insight

Amber card with a proactive AI recommendation tied to cost impact. Example: "Poultry prices rising 8% this week. Swap Chicken Sate → Tuna Sate to maintain 32% food cost and avoid a $2,100 overrun."

---

## 2.4 Right Panel — Atlas

### Header

Atlas name + green pulse + subtitle that adapts: "Analyzing: {event}" / "Analyzing {PO ID}" / "Operations copilot · Always on".

### Temporal Alerts (calendar mode, no event selected)

3 cards (high/medium/low severity) covering risk clusters in the next 7 days. Each shows: title + detail + responsible agent + potential saving.

### Savings in Calendar (calendar mode, no event selected)

$2,596 total savings available in upcoming calendar events. Breakdown: early-payment $640 (Agent #28) + group buy $506 (Agent #14) + price windows $1,450 (Agent #6).

### Live Agent Activity

Rotates every 4 seconds through 4 live pulses: agent name + current task (e.g. "Agent #6 (Pricing) — Analyzing 14 quotes for PO-2855...").

### Context Questions (3 buttons)

| Context | Question examples |
|---|---|
| Calendar event selected | "Why is '{event}' at stage X/12?" / "What are the risks for this {type}?" / "Show alternatives for {supplier}" |
| PO selected | PO-specific (e.g. "Why is PT Maju 8% below market average?") |
| Default | "What needs my attention most urgently?" / "Run a buy-vs-make analysis for PO-2847" / "What's blocking the Level 4 autonomy upgrade?" |

### Autonomous Actions Today

6 entries: action text + agent + class icon + time + saving attributed.

### Autonomy Goal

Level 3 → 4 progress bar (72%), "8 more approvals until Level 4 (Semi-Autonomous) unlocks for Seafood."

### This Week's Impact

Manual steps: 14 · Hours saved: 3.5h · Capital freed: $4,200. Tagline: "The system is making you money — not just saving time."

### Chat

Thread + input. Opens with: "Select a PO or calendar event to see my analysis, or ask me anything."

---

## 2.5 All Admin Actions — Summary

| Action | Where | Notes |
|---|---|---|
| Select triage PO | Left panel — click PO card | Loads PO Workspace; Atlas posts reasoning |
| Quick-approve alert | Left panel — green check button | Approves without expanding |
| Switch to Analytics | Center toggle — "Performance" | Shows metrics + spend chart |
| Switch to Calendar | Center toggle — "Logistics Calendar" | Shows logistics calendar |
| Change calendar sub-view | Center — Month / Week / Agenda | Changes calendar layout |
| Click calendar dot (month) | Month view day cell | Opens event journey |
| Click event card | Week / Agenda view | Opens event journey |
| Hover event → View Journey | Event hover | Same as click |
| Hover event → Pay Now / Execute / Complete | Event hover | Clears deadline; animates out; accumulates savings |
| Hover event → Atlas | Event hover | Posts reasoning to chat |
| Clear event from journey | Journey CTA button | Same as hover clear; returns to calendar |
| Expand DAG stage | Journey — click stage row | Reveals agent step detail |
| Approve PO | PO Workspace — Approve | Fly-out; removes from queue; saving float; Atlas confirms |
| Decline PO | PO Workspace — Decline | Declines proposal |
| View PO | PO Workspace — Eye button | Inspect mode (placeholder) |
| Back from PO | PO Workspace — "← Back" | Returns to analytics mode |
| Back from event | Event journey — "← Calendar" | Returns to calendar |
| Ask Atlas (quick questions) | Right panel — 3 question buttons | Appends to chat |
| Chat with Atlas | Right panel — text input | Free-form |

---

## 2.6 Flows

### Daily triage flow

1. Admin opens Overview — left panel shows "REQUIRES REVIEW" with 3 POs.
2. Admin clicks PO-2847 → PO Workspace opens.
3. Atlas auto-posts its reasoning to chat.
4. Admin reviews: amount, urgency, live negotiation log, menu engineering insight.
5. Clicks **Approve** → fly-out animation, saving float "$1,120 saved", progress bar advances.
6. Repeats for PO-2851 and PO-2855.
7. All 3 cleared → "All reviews complete" state.

### Quick-approve flow

1. Admin sees "Lamb Rack at 12% — auto-reorder queued" alert.
2. Clicks green check directly → approved, "$85 saved" float.

### Logistics calendar resolution

1. Admin switches to Logistics Calendar.
2. Sees amber "Pay Thai Fresh Co" event with "saves $640" tag.
3. Hovers → clicks **Pay Now** → deadline-cleared animation, "$640 Saved" float, daily savings counter shows $640.
4. Atlas confirms: "Thai Fresh payment cleared. $640 saving estimated — pending downstream confirmation." (Realism note: payment-rail confirmation lifecycle is part of post-demo work — see `REALISM-AUDIT.md` flag Overview #3.)

### Calendar investigation flow

1. Clicks "Lamb Rack Delivery" (in-transit) → Event Journey.
2. Atlas auto-posts GPS/cold-chain status reasoning.
3. Admin reads: $12,400 value, $420 saving, DAG at Stage 10 (Regional Hub, In Progress).
4. Expands Stage 9 to see Agent #7 cold-chain confirmation detail.
5. Clicks "Confirm Receipt" when ready → clears event.

### Autonomy goal monitoring

Admin reads right panel Autonomy Goal: 72% to Level 4 for Seafood, 8 more approvals needed. Every PO approval in triage contributes to this counter.

---

---

# 4. Spending Page

**File:** `src/components/SpendingPage.tsx`
**Nav label:** Spending
**Purpose:** Financial command center for procurement spend. The admin monitors budget drift across 7 categories, runs the Trade-off Engine to balance cost savings against supply resilience, locks committed savings, and audits every agent and admin decision through the Decision Ledger. Right panel surfaces autonomy analytics, agent efficacy, and Scope 3 carbon tracking.

---

## 4.1 Data Model

### Category object

| Field | Type | Description |
|---|---|---|
| `id` | string | Category slug (e.g. `protein`, `seafood`) |
| `name` | string | Display name |
| `spend` | number | Actual spend this period in USD |
| `budget` | number | Budget for this period in USD |
| `drift` | number | Percentage over/under budget (positive = over) |
| `driftStatus` | `'over' \| 'on-track' \| 'under'` | Computed tier |
| `color` | string | Semantic hex color (fixed; used consistently across all charts, icons, badges) |
| `Icon` | ElementType | Lucide icon component for this category |
| `savingsUnlocked` | number | Max recoverable savings available ($) |
| `agentActions` | number | Count of agent-driven decisions this period |
| `co2Kg` | number | kg CO2e emitted by this category's procurement this period |
| `trend6` | number[] | 6-month spend history array |
| `stockoutRisk` | number | Current stockout risk percentage |
| `topAgent` | `{id, name, contribution}` | Agent with highest savings attribution for this category |
| `atlasPrompts` | string[] | 3 context-specific suggested Atlas questions |

### Semantic color palette (fixed — used across every chart, badge, and icon)

| Category | Color | Semantic meaning |
|---|---|---|
| Protein | `#991b1b` (Deep Maroon) | Meat & core energy |
| Seafood | `#075985` (Deep Sea Blue) | Cold-chain & water |
| Produce | `#166534` (Forest Green) | Freshness & agriculture |
| Dry Goods | `#334155` (Slate/Charcoal) | Packaging & stability |
| Dairy | `#0e7490` (Cyan/Teal) | Dairy & cold |
| Beverages | `#92400e` (Amber/Gold) | Liquids & glass |
| Other | `#64748b` (Neutral Gray) | Miscellaneous |

### Live category data (7 categories)

| Category | Spend | Budget | Drift | Savings Unlockable | Stockout Risk | Top Agent |
|---|---|---|---|---|---|---|
| Protein | $14,200 | $13,000 | +9.2% over | $1,840 | 12% | Agent #6 (Pricing, 52%) |
| Seafood | $7,800 | $8,500 | −8.2% under | $2,100 | 6% | Agent #18 (Group Buying, 45%) |
| Produce | $8,400 | $8,200 | +2.4% on-track | $620 | 8% | Agent #18 (Group Buying, 38%) |
| Dry Goods | $6,900 | $7,000 | −1.4% on-track | $410 | 4% | Agent #6 (Pricing, 61%) |
| Dairy | $5,200 | $4,800 | +8.3% over | $780 | 22% | Agent #3 (Demand Forecast, 44%) |
| Beverages | $3,100 | $3,200 | −3.1% on-track | $320 | 3% | Agent #6 (Pricing, 70%) |
| Other | $2,220 | $2,500 | −11.2% under | $150 | 2% | Agent #29 (Sustainability, 55%) |

**Totals:** Total spend $47,820 · Total budget $45,200 · Overall drift +5.8% · Total unlockable savings $6,220

### LedgerEntry object

| Field | Type | Description |
|---|---|---|
| `id` | string | Entry ID |
| `actorType` | `'agent' \| 'admin' \| 'override'` | Who made the decision |
| `agentId` | number? | Agent number if actorType is agent |
| `actorLabel` | string | Display label (e.g. `Agent #6`, `Admin`) |
| `action` | string | Full description of the decision taken |
| `saving` | number | Dollar impact (positive = saving, negative = cost) |
| `supplier` | string | Supplier affected |
| `date` | string | Human date (e.g. `20 Apr`) |
| `invoiceRef` | string | Invoice reference (e.g. `INV-2024-8821`) |
| `categoryId` | string | Which category this belongs to |
| `overrideOf` | string? | If actorType is override, which agent was overridden |

### Decision Ledger (9 entries)

| Actor | Action | Impact | Category | Date | Invoice |
|---|---|---|---|---|---|
| Agent #6 | Switched to PT Maju for lamb shoulder — 6.2% price gap, quality parity confirmed | +$840 | Protein | 20 Apr | INV-2024-8821 |
| Agent #18 | Joined consortium order — Atlantic salmon, 6 operators, tier-3 volume discount | +$1,200 | Seafood | 19 Apr | INV-2024-8815 |
| Admin OVERRIDE | Kept preferred local dairy supplier despite Agent #3 lower-cost rec | −$120 | Dairy | 18 Apr | INV-2024-8810 |
| Agent #3 | Reduced dairy PO by 12% — 8-day surplus window predicted (87% confidence) | +$380 | Dairy | 18 Apr | INV-2024-8809 |
| Agent #29 | Rerouted dry goods via low-emission carrier — 3.1t CO2 reduction, +$8 cost | +$120 | Dry Goods | 18 Apr | INV-2024-8807 |
| Agent #6 | Negotiated Q2 bulk commitment on chuck roll — 490 kg at locked price | +$490 | Protein | 17 Apr | INV-2024-8801 |
| Admin | Manual PO for heritage tomatoes — local farm relationship, no agent sourcing | $0 | Produce | 16 Apr | INV-2024-8798 |
| Agent #18 | Pooled produce order across 6 operators — volume tier 3, 8.4% blended discount | +$310 | Produce | 16 Apr | INV-2024-8794 |
| Admin OVERRIDE | Rejected Agent #6 lower-cost beverage supplier — quality concern flagged | −$60 | Beverages | 15 Apr | INV-2024-8789 |

**Autonomy ratio:** 6/9 entries agent-driven = 67% autonomous · 3 admin interventions (2 overrides + 1 manual PO)

### Temporal data

12-month spend history (`ALL_MONTHS`) covering May 2025 – Apr 2026, actual vs budget per month.

Time range configs:
- **1M** — Apr 1–20, 2026 · 23 agent actions
- **3M** — Feb 1–Apr 20, 2026 · 74 actions
- **6M** — Nov 1, 2025–Apr 20, 2026 · 148 actions (default)
- **1Y** — May 1, 2025–Apr 20, 2026 · 312 actions

---

## 4.2 Left Panel — Optimization Queue

### Header

- "Optimization Queue" title · "Ranked by drift severity" subtitle
- **"All" button** (appears only when a category is selected) — `handleBackToAll()` with 180ms cross-fade
- **Settings icon button** (gear icon) — always visible in header right side. Opens the Budget Setup modal.

### Budget Setup Modal

Opens via the Settings header button or the first-run CTA card.

**Modal fields:** 7 rows, one per spending category. Each row:
- Category icon (semantic color)
- Category name (fixed 96px label)
- Dollar-prefixed number input — pre-filled with current budget value

**State:**
- `budgetSetupOpen: boolean` — controls modal visibility
- `categoryBudgets: Record<string, string>` — initialized to each category's seeded `budget` value. Edits here are stored as strings for controlled input and displayed as live override values.

**Buttons:** Cancel (closes without saving) · Save Budgets (closes and persists entered values).

### First-Run CTA Card

Shown between the Surplus Capital card and the Category Queue **only when all `categoryBudgets` entries still match the seeded defaults** (i.e., budgets have never been customized).

- Sage background, border
- Bold: "Set your category budgets"
- Sub-text: "AI is using default budgets. Customise limits so the guardrails match your actual targets."
- **"Configure Budgets →"** sage button — opens Budget Setup modal.

### Surplus Capital Available card

Located just below the header. Computed as `totalBudget − totalSpend + totalLocked`.

- **Positive value** (sage background): "$X,XXX · ready for redeployment"
- **Negative value** (red background): "$X,XXX · over budget — action needed"
- Updates live as savings are locked

### Category queue

Categories sorted descending by `Math.abs(drift)` — most off-budget items surface first regardless of direction.

Each card shows:
- **Semantic icon** (Beef/Fish/Apple/Package/Milk/Wine/Archive) in its fixed semantic color
- Category name
- **Drift badge** — `▲ +9.2%` (red) / `▼ −8.2%` (green) / `● ±2.4%` (gray)
- **Lock icon** (sage) if savings have been committed for this category
- **Spend bar** — actual vs budget; bar color is red if over budget, else semantic category color
- `$14.2K / $13K` budget label
- Eye icon appears on hover (does not trigger action — visual affordance only)

Clicking a card triggers `handleSelectCat(id)`:
1. Center panel fades out (opacity → 0, 180ms)
2. `selectedCat` updates
3. `tradeoff` slider resets to 30
4. Center panel fades in (opacity → 1)

---

## 4.3 Center Panel — Global View (No Category Selected)

### Breadcrumb + Temporal toggle

- Breadcrumb: "Spending · All Categories"
- Time range toggle: `1M` / `3M` / `6M` / `1Y` — active tab gets sage background; clicking updates chart data

### Macro summary cards (3)

| Card | Value | Notes |
|---|---|---|
| Total Spend | `$47.8K` + drift vs budget | Red if over, green if under |
| Locked Savings | Sum of `computeTradeoff` for locked categories | Sage color · "X/7 optimized" |
| Still Unlockable | `totalSavings − totalLocked` | Amber · "potential remaining" |

### Total Spend Trend (AreaChart)

- Recharts `AreaChart` with `globalFill` gradient (sage, 30% → 0% opacity)
- X-axis: months for selected time range
- Y-axis: dollar amounts formatted as `$XK`
- Lines: **Actual Spend** (sage, solid, 2.5px) + **Budget** (slate, dashed, 1.5px)
- Legend below chart
- Hover tooltip shows exact values
- Date range and action count shown above chart

### Spend by Category (horizontal BarChart)

- Recharts `BarChart` with `layout="vertical"`
- 7 bars, each with its **semantic color** via `<Cell fill={cat.color} />`
- X-axis: dollar amounts; Y-axis: category names
- Clicking a bar does **not** select the category (selection only via left panel cards)

### Capital Unlocked burst animation

When `showCapital = true` (triggered after locking savings):
- Full-center overlay with backdrop blur
- Large gradient text: `+$XXX` in sage gradient
- "Capital Unlocked" subtitle
- 5 floating Sparkles icons with staggered animation
- Auto-dismisses after 2800ms (`capitalBurst` keyframe animation)

---

## 4.4 Center Panel — Category Detail View (Category Selected)

### Breadcrumb

"← All Categories > [Semantic Icon] [Category Name]" — clicking "← All Categories" calls `handleBackToAll()`.

### Trade-off Engine card

The core decision instrument for this category. Powered by Agent #28 (Finance Intelligence).

**Slider**
- Range: 0 (pure cost optimization) → 100 (pure supply resilience)
- Visual gradient: sage (left, cost) → blue (right, resilience)
- Custom thumb with scale-on-hover animation
- Default position: 30 (lean toward cost savings)

**Live gauges** (update in real time as slider moves)

| Gauge | Formula | Color |
|---|---|---|
| Projected Savings | `savingsUnlocked × ((100 − slider) / 100) × 0.9` | Sage |
| Stockout Risk | `baseline − (stockoutRisk × (slider / 100) × 0.7)` | Blue (red if >15%) |

Each gauge shows a progress bar filling to the current value plus a reference line to the potential maximum.

**"Commit — Unlock Capital" button**
- Label: `Lock $XXX — Unlock Capital` (sage, active)
- Clicking: `handleLockSavings()`:
  1. Adds category to `lockedSavings` set
  2. Sets `capitalAmt` to current `projectedSavings`
  3. Sets `showCapital = true` → Capital Unlocked burst animation fires for 2800ms
  4. Left panel Surplus Capital card updates
- Once locked: button becomes `Capital Unlocked — Savings Committed` (disabled, gray)

### Category Spend Trend chart

Same `AreaChart` format as global view, but scoped to the selected category's 6-month `trend6` data vs monthly budget slice.

### Decision Ledger (filtered)

When a category is selected, ledger shows only entries with `categoryId === selectedCat`. In global view, all 9 entries appear.

**Table columns:**
- **Actor** — color-coded badge:
  - Agent: emerald badge with `Bot` icon + `#N` number
  - Admin: blue badge with `User` icon
  - Override: amber badge with `User` icon + "OVERRIDE" sub-label below badge
- **Action** — full description text; override entries also show "Overrode: [Agent #N (Role)]" in amber below
- **Impact** — `+$840` (green) / `−$120` (amber) / `—` (muted)
- **Date + Invoice** — date label always visible; invoice button (`FileText` icon + ref) rendered always but `opacity: 0` until row hover — no layout shift on appear

---

## 4.5 Right Panel — Atlas Intelligence

### Autonomy Balance section (Zap icon)

- "Agents handled **67% of transactions** autonomously. You intervened on **33%** — primarily to maintain local vendor relationships and quality standards."
- Two progress bars: Agent Autonomous (emerald) · Admin Intervention (blue)
- "[N] overrides recorded — system learning from your expertise"

### Agent Efficacy section (Bot icon)

- Global view: shows top agent for first 4 categories
- Category selected: shows only that category
- Each entry: semantic icon + category name + "Agent #N (Role Name) contributed **X%** of savings" + progress bar in semantic color

### Scope 3 Carbon section (Leaf icon) — Agent #29

- Row per category (top 5): semantic icon + name + CO2 kg value + amber warning triangle if >200 kg
- Summary card: "Total **940 kg CO2e** · ↓ −12% vs last month" + "Agent #29 rerouted 3 orders to low-emission carriers"

### Forecast Confidence section (ShieldCheck icon)

4 confidence metrics (each with value bar):

| Metric | Confidence | Forecast |
|---|---|---|
| Next month spend | 92% | $47.2K |
| Savings estimate | 87% | $6,200 |
| Drift detection | 95% | Category drift % or "All cats." |
| Stockout probability | 78% | Category risk or "Avg 8%" |

### Atlas suggested prompts (shown when category selected)

3 category-specific questions. Clicking immediately fires as Atlas chat message (no typing needed).

Examples (Protein): "Why did Agent #6 switch suppliers?", "Alternative beef suppliers?", "What is the Protein forecast?"
Examples (Dairy): "Why is Dairy over budget?", "Reduce dairy stockout risk?", "Carbon impact of dairy"

### Atlas chat history

Scrollable message log (max-h-48, auto-scrolls to latest):
- User messages: sage background
- Atlas messages: dark card with Sparkles icon + "Atlas" label in sage

### Atlas chat input (pinned to bottom)

- "Ask Atlas about [category]" or "Ask Atlas about spending" label
- Placeholder adapts: `e.g. "[first atlasPrompt for category]"` or generic example
- Enter key or Send button → `handleAtlasSubmit()` → 320ms delay → `getAtlasResponse()`

**Atlas AI engine** (`getAtlasResponse`) handles:
- Agent-specific: Agent #6 supplier switch, Agent #18 group buying, Agent #29 sustainability/carbon, override history
- Category-specific: budget drift explanation, alternative suppliers, forecast, stockout risk
- Global: total savings, trend/next-month forecast, optimization priority ranking

---

## 4.6 Key State

| State | Type | Purpose |
|---|---|---|
| `selectedCat` | string? | Currently selected category ID |
| `tradeoff` | number | Trade-off Engine slider position (0–100, default 30) |
| `lockedSavings` | Set\<string\> | Category IDs with committed savings |
| `showCapital` | boolean | Triggers Capital Unlocked burst animation |
| `capitalAmt` | number | Dollar amount shown in burst animation |
| `hoveredRow` | string? | Ledger row ID with visible invoice button |
| `timeRange` | TimeRange | Active chart window (default `'6M'`) |
| `centerOpacity` | number | 0→1 during cross-fade category transitions |
| `atlasInput` | string | Current chat draft |
| `atlasMsgs` | AtlasMessage[] | Chat history |

---

## 4.7 Actions

| Action | Location | What happens |
|---|---|---|
| Click category card | Left panel | 180ms fade → loads category detail view in center |
| Click "All" button | Left panel header | 180ms fade → returns to global view |
| Change time range | Center top-right toggle | Updates charts and date range label |
| Drag Trade-off slider | Center Trade-off Engine | Recalculates Projected Savings + Stockout Risk live |
| Click "Commit — Unlock Capital" | Center Trade-off Engine | Locks savings, fires Capital Unlocked burst animation |
| Hover ledger row | Center Decision Ledger | Reveals invoice reference button |
| Click invoice button | Center Decision Ledger row | (Design intent: opens invoice; currently no-op) |
| Click "← All Categories" breadcrumb | Center breadcrumb | Returns to global view with fade |
| Click Atlas suggested prompt | Right panel | Fires question directly to Atlas, appends response |
| Send Atlas chat | Right panel chat input | Appends message; 320ms → Atlas responds |

---

## 4.8 Key Flows

### Category budget overrun triage flow

1. Admin opens Spending — left panel shows Optimization Queue sorted by drift severity.
2. Protein (+9.2%) and Dairy (+8.3%) appear at the top in red.
3. Admin clicks Protein — center cross-fades (180ms) into category detail view.
4. Trade-off slider at 30 (default lean toward cost): Projected Savings = $1,656, Stockout Risk = 9.5%.
5. Admin reads Decision Ledger for Protein: Agent #6 switched to PT Maju (+$840, INV-2024-8821) and locked chuck roll at bulk price (+$490).
6. Admin hovers INV-2024-8821 row — invoice button appears — clicks to reference the invoice.
7. Admin clicks "Commit $1,656 — Unlock Capital" — Capital Unlocked burst animation fires.
8. Left panel Surplus Capital Available updates; category shows lock icon.

### Trade-off Engine optimization flow

1. Admin selects Dairy (22% stockout risk, +8.3% over budget).
2. Slider at 30: Projected Savings = $702, Stockout Risk = 17.4% (still high, red).
3. Admin drags slider right to 65: Projected Savings drops to $245, Stockout Risk drops to 6.8% (blue).
4. Admin decides 65 is too resilience-heavy — settles at 45: Savings = $351, Stockout Risk = 14.6%.
5. Clicks "Commit $351" — savings locked; Surplus Capital updates.
6. Right panel Autonomy Balance still shows 2 overrides on Dairy — admin reads: "system learning from your quality standards."

### Override audit flow

1. Admin selects Dairy — Decision Ledger shows 2 entries for Dairy.
2. Row for 18 Apr shows Admin OVERRIDE badge (amber) — "Kept preferred local dairy supplier despite Agent #3 lower-cost recommendation · Overrode: Agent #3 (Demand Forecast)" · −$120.
3. Row below shows Agent #3 entry from same day — "Reduced dairy PO by 12% — 8-day surplus predicted" · +$380.
4. Admin asks Atlas (right panel): "Why is Dairy over budget?" — Atlas responds: "+8.3% drift; primary drivers: seasonal price increase +4.1%, spot buy Apr 14 +$420. Agent #3 has $780 in recoverable savings — activate Trade-off Engine."
5. Admin reconsiders and adjusts Trade-off Engine accordingly.

### Carbon intelligence flow

1. Admin opens Spending, no category selected.
2. Right panel shows Scope 3 Carbon: Protein 320 kg (warning triangle) and Dairy 210 kg (warning triangle).
3. Admin types "sustainability" in Atlas chat — Atlas responds: "Agent #29 rerouted 3 dry-goods orders to low-emission carriers, cutting 3.1t CO2 at +$8 marginal cost. Total: 940 kg CO2e, down 12% vs last month."
4. Admin selects Protein, clicks Atlas prompt "Alternative beef suppliers?" — Atlas lists 3 pre-qualified alternatives within 5km, quality ≥92%, potential −[X]% spend.

---

# 3. Inventory Page

**File:** `src/components/NewInventoryPage.tsx`
**Nav label:** Inventory
**Purpose:** Stock-level command center. The admin monitors every SKU across three urgency tiers, reviews AI-driven restock forecasts, manages par levels, triggers manual counts, and watches the 12-stage restock journey from demand forecast through to physical delivery — with Phase 2 (execution) mirrored read-only from Orders.

---

## 3.1 Data Model

### InventoryItem object

| Field | Type | Description |
|---|---|---|
| `id` | string | Internal ID (e.g. `lamb-rack`) |
| `name` | string | SKU display name |
| `sku` | string | Stock-keeping unit code (e.g. `SKU-4821`) |
| `category` | string | Category (e.g. `Premium Proteins`, `Seafood`) |
| `group` | `'critical' \| 'watch' \| 'autonomous'` | Heartbeat tier |
| `onHand` | number | Current system stock count |
| `parLevel` | number | Par (floor) level that triggers restock |
| `unit` | string | Unit of measure (e.g. `kg`, `liters`, `bags`) |
| `burnRate` | number | Daily consumption rate |
| `daysRemaining` | number | Computed days until stock hits par |
| `unitCostRp` | number | Unit cost in Rupiah |
| `supplierName` | string? | Primary supplier name |
| `supplierPhone` | string? | Supplier phone/WhatsApp number |
| `restockDag` | `{stage, failedStage?, failureReason?}?` | Current DAG position |
| `linkedOrderId` | string? | PO ID if an active execution stream exists (e.g. `PO-2855`) |
| `executionStreams` | `ExecutionStream[]?` | All active and draft PO streams for this SKU |
| `agentReasoning` | string? | Natural-language explanation from the assigned agent |
| `confidenceScore` | number? | Forecast confidence percentage (0–100) |
| `marketSignal` | string? | Agent #21 market intelligence note |
| `monthlySaving` | number? | Monthly cost saving from autonomous operation |
| `hoursEliminated` | number? | Weekly manual hours eliminated |
| `eta` | string? | Expected restock arrival (e.g. `May 15`) |
| `trend` | `number[]` | 7-day velocity sparkline values |

### Live SKU catalog (18 items)

**Critical tier (4 items)**

| Name | SKU | On Hand / Par | Days Left | Notes |
|---|---|---|---|---|
| Lamb Rack | SKU-4821 | 4 kg / 15 kg | 1 day | Linked to PO-2855; confidence 72%; Norway supply disruption |
| Beef Tenderloin | SKU-3847 | 6 kg / 20 kg | 2 days | Agent #8 alert; confidence 88%; market-signal: contract lock available |
| Tiger Prawns | SKU-5592 | 0 kg / 12 kg | 0 days (stockout) | Stockout; emergency reorder triggered |
| Salmon Fillet | SKU-2103 | 3 kg / 10 kg | 3 days | Stage 2 (Supplier Match) failed; agent retrying |

**Watch tier (4 items)**

| Name | SKU | On Hand / Par | Days Left | Notes |
|---|---|---|---|---|
| Chicken Breast | SKU-1045 | 22 kg / 30 kg | 5 days | Group-buy pending; Agent #21 |
| Fresh Tomatoes | SKU-6704 | 18 kg / 25 kg | 6 days | Indonesia caution region |
| Squid | SKU-7823 | 8 kg / 12 kg | 5 days | Bali clear |
| Bell Peppers | SKU-3312 | 14 kg / 20 kg | 6 days | — |

**Autonomous tier (10 items)** — AI fully manages restock with no human input required. Includes: Jasmine Rice, Cooking Oil, Coconut Milk, Sugar, Basmati Rice, Fresh Herbs, Soy Sauce, Flour, Milk, Butter.

### ExecutionStream object

| Field | Type | Description |
|---|---|---|
| `id` | string | PO/Draft ID (e.g. `PO-2855`, `DR-2858`) |
| `kind` | `'active' \| 'draft'` | Whether this is a live shipment or a staged future PO |
| `vendor` | string | Vendor name for this stream |
| `agent` | AssignedAgent | Agent driving execution |
| `stage` | number | Current DAG stage index within Phase 2 |
| `failedStage` | number? | Stage that failed, if any |
| `eta` | string? | ETA for this stream |

Open draft POs in the system: `DR-2858` (AUS Meats Pty, stage 5) and `DR-2861` (AUS Meats Pty, stage 4).

### RESTOCK_DAG_TEMPLATE — 12-Stage Restock Journey

**Phase 1: The Decision (4 stages — Inventory-owned)**

| # | Label | Agent | Description |
|---|---|---|---|
| 0 | Demand Forecast | Agent #25 (POS Intelligence) | Calculates 7-day consumption velocity from live sales data |
| 1 | Par Level Check | Agent #08 (Restock) | Detects depletion below par threshold |
| 2 | Supplier Match | Agent #21 (Market Intel) | Cross-references vetted suppliers against price + reliability + cold-chain |
| 3 | Price Lock | Agent #14 (Pricing) | Locks volume discount |

**Phase 2: The Execution (8 stages — execution mirror of Orders)**

| # | Label | Agent | Description |
|---|---|---|---|
| 4 | PO Created | Agent #01 (PO Engine) | Generates PO with quality hold clause |
| 5 | Vendor Confirmed | Agent #05 | Vendor acknowledgement received |
| 6 | Payment Sent | Agent #28 | Payment initiated |
| 7 | ERP Sync | Agent #18 | Record synced to ERP ledger |
| 8 | Dispatched | (vendor webhook) | Vendor ERP webhook fires DISPATCH event |
| 9 | Customs Clearance | Agent #33 | Pre-files import docs |
| 10 | In Transit | Agent #07 (Logistics) | Monitors GPS + cold-chain temperature sensors |
| 11 | Delivered | Agent #09 (Quality) | Runs QC inspection against specs |

### Supply Chain Weather (4 regions)

| Region | Status | Detail |
|---|---|---|
| Australia | Clear | All lanes operating normally |
| Indonesia | Caution | Port congestion; 1–2 day delay risk |
| Bali | Clear | Local distribution unaffected |
| Norway | Disrupted | Fisheries strike; 5–7 day delay on seafood shipments |

### Computed aggregates

- `TOTAL_INVENTORY_VALUE` — sum of `onHand x unitCostRp` across all 18 SKUs
- `CATEGORY_VALUES` — array of `{category, valueRp}` sorted descending (for Pareto analysis)
- `DEAD_STOCK` — items with burn rate ≤ 1.5 units/day and on-hand above par (capital lock alert)
- `DEAD_STOCK_VALUE` — Rp total tied up in dead-stock SKUs

---

## 3.2 Left Panel — Triage Mode (Stock Heartbeat)

### Header bar

- **"Stock Heartbeat"** title + "N critical · N watch · N flowing" subtitle
- **Manage Catalog button** (Database icon) — opens the Master SKU Catalog modal (see below)
- **Expand to Audit Mode button** (Maximize2) — switches the entire page into Audit Mode (left panel expands to full width, center collapses, CSS spring transition over 380ms)

### Master SKU Catalog Modal

Opens via the Database icon button in the left panel header.

**State:**
- `catalogOpen: boolean`
- `catalogRows: CatalogRow[]` — initialized from `ITEMS` (id, name, sku, category, unitCost, archived)
- `catalogDraftRow: Partial<CatalogRow> | null` — tracks the inline "Add SKU" form
- `catalogEditId: string | null` — which row's Name field is in edit mode

**Modal layout:**
- Header: "Master SKU Catalog" title + "N active SKUs" subtitle · **+ Add SKU** button · X close
- **Draft row** (appears when "Add SKU" is clicked): three text inputs (Name, SKU, Category) + Save / Cancel inline
- **Scrollable table:** columns Name (inline-editable when `catalogEditId` matches), SKU (monospace), Category, Actions
  - **Actions per row:** Edit / Done toggle (inline name edit) · Archive / Restore toggle
  - Archived rows shown at 40% opacity

### Health Progress Bar

A horizontal progress bar showing percentage of SKUs in healthy status. Color shifts from red (critical-heavy) toward green as the ratio improves.

### Three Heartbeat Groups (Miller's Law — max 7±2 per group)

**Group: CRITICAL ATTENTION (red)**
- Count badge (e.g. "4 items")
- Cards sorted by `daysRemaining` ascending (most urgent first)

**Group: WATCH (amber)**
- Count badge
- Cards sorted by `daysRemaining`

**Group: AUTONOMOUS FLOW (sage/green)**
- Count badge
- Cards collapsed by default; expandable to show all 10 items

### Sidebar card

Each card shows:
- Group icon (Flame/Eye/Check) in group color
- SKU name + SKU code
- **Stock bar** — segmented bar: on-hand (green/amber/red by `daysRemaining`) vs par level gap (unfilled)
- `{onHand} {unit} / {parLevel} par` ratio label
- `{daysRemaining}d` remaining pill
- **Steering badge** — inline toggle: `Agent #X` (sage pill) / `Manual` (amber pill) — clicking toggles per-SKU `laborMode`
- **Hover micro-actions** (revealed on hover):
  - Quick Restock (Zap) — triggers `handleRestockNow`, deep-links to New Request prefilled with SKU data
  - View Forecast (TrendingUp) — scrolls center to velocity chart
  - WhatsApp (MessageCircle) — opens WhatsApp link to supplier phone

Selected state: card gets sage left border + background highlight.

---

## 3.3 Left Panel — Audit Mode

When `auditMode = true`, the left panel expands to occupy the full available width (center collapses to 0px with opacity 0).

### Audit Mode toolbar

- **Back to Triage** button — exits audit mode, re-expands center panel
- **Search input** — filters catalog by SKU name or code in real time
- **Filter chips** — toggleable: All / Critical / Watch / Autonomous / Needs Restock
- **Table / Grid view toggle** — switches between dense table and card grid
- **Select All checkbox** — selects all visible filtered items
- **Batch Restock button** — triggers restock for all selected items (active when ≥1 selected)

### Table view columns

SKU Name · SKU Code · Category · On Hand · Par Level · Days Remaining · Burn Rate · Status · Actions

### Grid view

2-column card grid; each card identical to the sidebar card layout but wider.

### Batch restock

Multi-select rows → "Restock X items" button → calls `handleRestockNow` for each selected ID, firing a `toast` per item.

---

## 3.4 Center Panel — Default (No Item Selected)

### Metric cards (3)

| Metric | Value Source | Notes |
|---|---|---|
| Total Inventory Value | `TOTAL_INVENTORY_VALUE` in Rp | Sum of all SKUs |
| Active SKUs | Count of items with `onHand > 0` | Excludes stockouts |
| Avg Days Cover | Mean `daysRemaining` across non-autonomous items | Proxy for overall health |

### Consumption Velocity Map (AreaChart)

- Recharts `AreaChart` with gradient fill
- X-axis: last 7 days
- Y-axis: units consumed
- One line/area per critical + watch item, color-coded by group
- Hover tooltip shows per-item daily burn on that day

### Highest Burn Rates list

Top 5 SKUs by `burnRate`, each row showing: SKU name · burn rate value + unit · 7-day sparkline · group color dot.

---

## 3.5 Center Panel — Item Selected Workspace

Clicking any sidebar card loads the full item workspace in center.

### Manual Takeover banner

When `laborMode[id] = 'manual'`: amber banner with "Manual Takeover Active — You are driving [SKU Name]" + **"Hand back to Atlas"** button.

**Resumption Handshake:** On switching back to agent, if `manualCounts[id]` or `manualParFixed[id]` have been modified, a sync-check toast fires: "Atlas syncing your manual counts / par floor before resuming." Agent restarts forecast from the new baseline.

### SKU Header

**Row A — Identity + Governance**
- Group icon · SKU name (large bold) · SKU code pill
- **"Governance"** link (shield icon) → `openGovernance(item.id)` — opens compliance overlay

**Row B — Meta + Mode toggle**
- Category tag · on-hand count · par floor label · days-remaining pill (red ≤2d, amber ≤5d)
- **Par Mode toggle** — "AI Recommended" (sage) vs "Manual Fixed" (amber)
  - `ai → manual`: copies current AI par into `manualParFixed[id]` as starting value
  - `manual → ai`: discards manual floor, reverts to agent calculation

**Row C — Action toolbar**

| Button | Action |
|---|---|
| Restock Now (Zap) | `handleRestockNow(item)` — New Request with SKU prefilled |
| Adjust Stock (ClipboardEdit) | Opens Adjust Stock modal |
| Add to Draft (Package) | Opens Pipeline Menu — choose DR-2858 or DR-2861 |
| Remove from Draft | `handleRemoveFromDraft(item.id)` |
| View Orders (ExternalLink) | `onNavigate('orders')` with hash `order={linkedOrderId}` |

### Agent Watch strip

Horizontal strip of agent pills watching this SKU (Agent #4, #8, #21, #28). Active agent (current stage) pulses.

### Consumption Velocity chart

Per-SKU 7-day area chart scoped to this one item.

### Par Level Digital Twin card

Interactive simulator — previews risk impact of changing par level without committing.

- Draggable slider (range: 0 to `parLevel × 2`)
- Live preview updates: days cover change · restock trigger shift · estimated annual cost delta
- **"Set as Par Floor"** button (Manual Par Mode only) — commits slider value to `manualParFixed[id]`
- Simulation lives in `parOverride[id]`; not persisted until "Set as Par Floor" is clicked

### Failed Restock Intent Banner (cross-page signal)

When the user starts a restock from Inventory (Restock Now → New Request), then dismisses the restock context in RequestPanel, a `buyamia-restock-intent-failed` CustomEvent is dispatched containing `{ skuId, skuName }`. NewInventoryPage listens and adds the SKU to `failedIntentIds` Set.

**Appearance:** Amber alert banner above the Restock Journey card (only when the selected SKU's ID is in `failedIntentIds`):
- AlertTriangle icon (amber)
- Bold: "Restock Intent Dismissed"
- Sub-text: "A restock request for this SKU was started but dismissed. Restock DAG may be stale — review and re-trigger if needed."
- Dismiss (X) button — removes the alert from `failedIntentIds`.

### Restock Journey card

12-stage DAG as a vertical timeline.

**Phase 1: The Decision** (stages 0–3)
- Stage rows: status dot (complete=green check, active=pulsing sage, failed=red X, pending=gray) + label + agent badge
- Clicking a row → opens Stage Trace modal

**Handoff Divider**
- If linked order exists: **"View [PO-XXXX] in Orders"** button (ExternalLink)
- If no order yet: tooltip "Execution will begin once Phase 1 completes"

**Phase 2: The Execution** (stages 4–11)
- "Read-only mirror" lock badge with tooltip: "To drive a stage forward, open the PO in Orders"
- **Stream Switcher** (when `streams.length > 0`): pill tabs per stream
  - `[Active | Draft]` kind badge · PO ID · ETA
  - "Soonest" badge on earliest ETA stream
  - Clicking a tab: `setSelectedStreamId` — swaps stage state below without replacing the stream
  - **"Open [stream.id] in Orders"** button → `window.location.hash = order=...` + `onNavigate('orders')`
- Same stage rows as Phase 1; clicking → Stage Trace modal with stream context

**ETA footer** — Clock icon + "Expected: [eta]" (if `selected.eta` set)

---

## 3.6 Modals

### Adjust Stock Modal — "Physical Truth"

Opened by: "Adjust Stock" in Row C.

| Section | Content |
|---|---|
| Header | Amber theme · ClipboardEdit icon · "Physical Truth · Adjust Stock" · item name + SKU |
| Atlas Hint | "I am tracking [N] [unit] on the books. Enter the floor count — I will recalculate your burn rate and restock urgency." |
| Manual Count field | Numeric input + stepper buttons (−/+) · live delta preview below ("↑ 3 kg vs system (+15%)") |
| Note field | Optional textarea; placeholder: "e.g. Found 2kg behind walk-in cooler · weighed at 3:42 PM" |
| Footer | Cancel · **Save Manual Count** (amber, disabled until count valid) → saves to `manualCounts[id]`, fires toast, closes |

### Stage Trace Modal — "History & Trace Record"

Opened by: clicking any stage row in the Restock Journey.

| Section | Content |
|---|---|
| Header | Stage number circle (green/amber/red) · "History & Trace Record" · phase + stage label · attribution badge (Bot/User) · item name + status |
| Stream context (Phase 2) | "Window into [stream.id]" · kind badge · "same MBL, carrier & tracking as Orders" · "Open in Orders" button |
| Atlas Audit Summary | Logic explanation — or manual par override message if stage 1 in manual mode |
| Immutable record banner | Lock icon + "Switch to Manual Takeover to override this stage." (hidden in manual mode) |
| Paper Trail | Trigger (Zap) · Proof (ShieldCheck) · Verified at (Clock) + "API timestamp" |
| Verified Data | Scrollable key-value list from `synth.data`; file values render as download links |
| Footer | Phase 2: "Open [ordersLinkId] in Orders" (blue) · **Done** (sage) |

### ⌘K Command Palette

Opened by: ⌘K button or `Cmd+K` / `Ctrl+K` keyboard shortcut.

- Backdrop blur overlay
- Search input (magnifier icon + ESC badge)
- Results list (max-h-64, scrollable): group icon · name + SKU code · on-hand / days remaining · arrow
- Clicking a result: `handleSelect(item.id)` + closes palette
- Empty state: "No items match '[query]'"

---

## 3.7 Right Panel — Atlas Intelligence

### Mode 1: Audit Mode + Item Selected → Quick Journey Viewer

Header subtitle: "Quick Journey · Slide-Sheet"

- Item name + SKU summary
- **"Full Journey"** button → `handleFullJourney()` — exits audit mode, loads full workspace
- Compact 12-stage DAG dot-list
- Agent reasoning snippet (4-line clamp)
- **Quick Actions** (large tap targets):
  - Emergency Restock (Zap) — sage → amber "Reordering..." after trigger; only for non-autonomous items
  - Call [Supplier] (PhoneCall)
  - WhatsApp [Supplier] (MessageCircle)
  - Open Full Workspace (Maximize2)
- Forecast Confidence percentage + Market Signal card (blue)

### Mode 2: Audit Mode + No Item Selected → Macro Portfolio Insights

Header subtitle: "Macro-Portfolio Insights · Agent #10"

- **Dead Stock Alert** — red card: "[N] items tying up capital · Rp [X] locked in SKUs with burn ≤1.5/day and stock above par" · top 4 items with locked Rp
- **Spend Concentration (Pareto)** — sage card: "Top 3 categories = [N]% of inventory value" · progress bars per category · total value footer
- **Supply Chain Weather** — 4 region cards (green/amber/red): region icon + status + detail text

### Mode 3: Normal Triage Mode → Item Intelligence

Header subtitle: "Stock intelligence · Restock copilot"

- **Action Log** — recent agent actions; newest row pulses with `animate-pulse`
- **Why This Happened** — agent reasoning + forecast confidence bar (green/amber/red by score)
- **Agent #21 Market Signal** — blue card with Radar icon + signal text
- **ROI of Autonomy** — "X hours eliminated · $Y/mo saving" + 2-column stat grid
- **Ask Atlas** — 3 context-sensitive suggested questions (item-specific when selected; general otherwise)
  - Clicking appends question to chat + 600ms Atlas response
- **Chat history** — user messages (sage, right-indented) · Atlas messages (gray, Bot icon)
- **Chat input** (pinned to bottom) — placeholder: "Ask about stock, agents, forecasts..." · Enter or Send button

---

## 3.8 Key State

| State | Type | Purpose |
|---|---|---|
| `selectedId` | string? | Currently selected SKU ID |
| `laborMode` | `Record<string, LaborMode>` | Per-SKU agent/manual mode |
| `parMode` | `Record<string, ParMode>` | Per-SKU AI/manual par setting |
| `manualParFixed` | `Record<string, number>` | Per-SKU manually fixed par floor value |
| `manualCounts` | `Record<string, {count, note}>` | Saved physical count adjustments |
| `parOverride` | `Record<string, number>` | Digital Twin slider position (uncommitted) |
| `auditMode` | boolean | Whether full-catalog audit view is active |
| `auditView` | `'table' \| 'grid'` | Display mode within audit |
| `auditSearch` | string | Search query in audit mode |
| `auditFilter` | string | Active filter chip in audit mode |
| `auditSelected` | Set\<string\> | Selected item IDs for batch restock |
| `forceCompletedRestock` | `Record<string, number>` | Manually forced stage completions per SKU |
| `openStageTrace` | `{skuId, stageIdx}?` | Stage Trace modal target |
| `adjustOpen` | string? | SKU ID for Adjust Stock modal |
| `adjustDraft` | `{count, note}` | Current values in Adjust Stock modal |
| `draftPOs` | `DraftPO[]` | Open draft POs available for bundling |
| `bundledIntoDraftIds` | Set\<string\> | SKU IDs already added to a draft |
| `selectedStreamId` | `Record<string, string>` | Which stream tab is active per SKU |
| `pipelineMenuOpen` | string? | SKU ID with open Pipeline (Add to Draft) menu |
| `cmdkOpen` | boolean | Whether ⌘K palette is open |
| `emergencyTriggered` | Set\<string\> | SKU IDs with in-flight emergency reorders |
| `chatMessages` | `{role, text}[]` | Atlas chat history |

---

## 3.9 Actions

| Action | Location | What happens |
|---|---|---|
| Click SKU card (triage) | Left panel | Selects item, loads full workspace in center |
| Click SKU card (audit) | Left panel | Loads Quick Journey Viewer in right panel |
| Toggle Steering Badge | Left panel card | Switches per-SKU `laborMode` agent ↔ manual |
| Click ⌘K | Left panel header | Opens command palette |
| Search in ⌘K | Command palette | Filters all 18 SKUs; click result to select |
| Toggle Audit Mode | Left panel header | CSS spring transition — left expands, center collapses |
| Search in Audit | Audit toolbar | Real-time SKU name/code filter |
| Filter chip (Audit) | Audit toolbar | Filters by tier or needs-restock |
| Select All (Audit) | Audit toolbar | Checks all visible items |
| Table/Grid toggle (Audit) | Audit toolbar | Switches display mode |
| Batch Restock (Audit) | Audit toolbar | Calls `handleRestockNow` for each selected SKU |
| Restock Now | Center Row C | Navigates to New Request with SKU prefilled |
| Adjust Stock | Center Row C | Opens Physical Truth modal |
| Add to Draft | Center Row C | Opens Pipeline Menu (choose DR-2858 or DR-2861) |
| Remove from Draft | Center Row C | Removes SKU from draft bundle |
| View Orders | Center Row C | Navigates to Orders, deep-links to linked PO |
| Par Mode toggle | Center Row B | Switches par calculation mode; pivots current value |
| Digital Twin slider | Center workspace | Previews par level impact live (uncommitted) |
| Set as Par Floor | Digital Twin card | Commits slider value to `manualParFixed[id]` |
| Click DAG stage row | Center Restock Journey | Opens Stage Trace modal |
| Click Stream tab | Center Phase 2 | Switches selected execution stream |
| Open [PO] in Orders | Center stream / Phase 2 | Deep-links to Orders page |
| Hand back to Atlas | Center Manual Takeover banner | Sets mode to agent; triggers Resumption Handshake |
| Save Manual Count | Adjust Stock modal | Updates `manualCounts`, fires toast, closes modal |
| Open in Orders | Stage Trace modal footer | Deep-link for Phase 2 stages |
| Emergency Restock | Right panel Quick Actions | Adds to `emergencyTriggered`; fires toast |
| Call Supplier | Right panel Quick Actions | Opens phone dialer link |
| WhatsApp Supplier | Right panel Quick Actions | Opens WhatsApp link |
| Open Full Workspace | Right panel Quick Journey | `handleFullJourney()` — exits audit, loads full workspace |
| Click Ask Atlas question | Right panel | Appends question + 600ms Atlas reply to chat |
| Send chat message | Right panel chat input | Appends to `chatMessages`; fires Atlas reply |

---

## 3.10 Key Flows

### Critical item restock flow

1. Admin opens Inventory — left panel shows Lamb Rack at 1 day remaining (red stock bar).
2. Admin clicks Lamb Rack — center workspace loads; agent mode active.
3. Restock Journey shows Phase 1 complete (stage 3 done), linked to PO-2855.
4. Stream Switcher shows PO-2855 as Active; admin clicks "Open PO-2855 in Orders."
5. Orders page loads with PO-2855 pre-selected — admin tracks execution from there.
6. Back on Inventory, right panel shows Norway disruption + Agent #21 market signal (contract lock advice).
7. Admin acts on market signal → clicks "Restock Now" → New Request opens prefilled.

### Manual takeover + resumption handshake flow

1. Admin clicks Steering Badge on Beef Tenderloin — badge switches to "Manual" (amber).
2. Manual Takeover banner appears; admin switches Par Mode to Manual Fixed.
3. Admin drags Digital Twin slider to 25 kg — preview shows "would trigger restock 2 days earlier."
4. Admin clicks "Set as Par Floor" — `manualParFixed['beef-tenderloin'] = 25`.
5. Admin clicks "Adjust Stock" — enters physical count 7 kg (system: 6 kg) — saves. Toast: "Manual count saved."
6. Admin clicks "Hand back to Atlas" — Resumption Handshake fires, syncing 7 kg count and 25 kg floor.
7. Steering Badge returns to "Agent #8" (sage); agent restarts forecast from new baseline.

### Audit mode batch restock flow

1. Admin clicks "Audit Mode" — CSS spring transition; left expands, center collapses.
2. Right panel shows Macro Portfolio: Dead Stock Alert (3 items, Rp 4.2M locked).
3. Admin clicks filter chip "Needs Restock" — list narrows to 6 items.
4. Admin clicks "Select All" — all 6 checked.
5. Admin clicks "Batch Restock" — 6 toast notifications fire, one per SKU.
6. Admin clicks a row — right panel Quick Journey loads. Clicks "Full Journey" to exit audit and load full workspace.

### Stage trace audit flow

1. Admin selects Tiger Prawns (stockout) — Restock Journey shows stage 0 complete.
2. Admin clicks stage 0 — Stage Trace modal opens.
3. Modal shows Paper Trail: Trigger "on-hand = 0, par = 12 kg", Proof "burn rate 3.2 kg/day confirmed", Verified at "May 9, 08:14".
4. Admin clicks "Done." Clicks stage 2 (Supplier Match — failed) — modal shows failure reason.

### Supply chain disruption response flow

1. Right panel Macro Portfolio shows Norway as Disrupted.
2. Admin selects Salmon Fillet (Norwegian supplier, stage 2 failed).
3. Stage Trace for stage 2 shows: "Fisheries strike — no viable price lock from Norwegian suppliers."
4. Admin switches to Manual Takeover — clicks "Restock Now" — New Request opens with alternative (Australian) supplier.
5. New order placed; admin hands back to Atlas. Agent adopts new vendor and resumes from stage 3.

### Digital Twin par optimization flow

1. Admin selects Cooking Oil (autonomous) — Digital Twin shows par = 50 liters.
2. Admin drags slider to 40 liters — preview: "Saves $340/year, adds 0.4 stockout-days risk."
3. Admin adjusts to 45 liters — preview: "Neutral — $0 cost change, same safety margin."
4. Admin clicks "Set as Par Floor" — `manualParFixed['cooking-oil'] = 45`.
5. Par Mode badge shows "Manual Fixed"; agent still drives ordering timing but respects the 45 L floor.

---

---

# 5. Suppliers Page

**File:** `src/components/SuppliersPage.tsx`
**Nav label:** Suppliers
**Purpose:** Vendor relationship command center. The admin monitors the health of 6 vetted suppliers across 3 tiers, manages per-vendor AI agents via the Labor Switch, tracks each supplier through a 12-stage Relationship Journey, compares suppliers side-by-side, and communicates via a secure encrypted messaging bridge — all within a Fortress Sourcing doctrine that locks Atlas to the internal directory only.

---

## 5.1 Data Model

### Supplier object

| Field | Type | Description |
|---|---|---|
| `id` | string | Internal ID (e.g. `s-001`) |
| `name` | string | Supplier name |
| `initials` | string | Two-letter initials for avatar |
| `country` | string | Country of origin |
| `flag` | string | Emoji flag |
| `vendorStatus` | `'action' \| 'watchlist' \| 'stable'` | Current operational tier |
| `score` | number | Current composite score (0–100) |
| `prevScore` | number | Previous period score (for trend) |
| `reliability` | number | Delivery reliability score |
| `quality` | number | Quality score |
| `price` | number | Price competitiveness score |
| `sustainability` | number | Sustainability score |
| `co2Score` | number | CO2/emissions score |
| `trend` | `'up' \| 'flat' \| 'down'` | Score direction |
| `sparkline` | number[] | 6-period score history |
| `orders` | number | Total order count |
| `contractValue` | number | Annual contract value in USD |
| `contractExpiresIn` | number | Days until contract expiry |
| `categories` | string[] | Supply categories (e.g. `['Protein', 'Dry Goods']`) |
| `leadDays` | number | Average lead time in days |
| `lastOrder` | string | Date of last order |
| `savingsYTD` | number | Agent-attributed savings year-to-date ($) |
| `journeyStage` | number | Current stage in the 12-stage Relationship Journey (1-based) |
| `accountManager` | string | Vendor account manager name |
| `waPhone` | string | WhatsApp phone number |
| `agentNotes` | string | Current intelligence note from assigned agent |
| `recentOrders` | `RecentOrder[]` | Last 2–4 orders with status and metric tags |
| `actionReason` | string? | Short reason string shown on Action/Watchlist cards |
| `address` | string | Physical address |
| `nib` | string | Business registration number |
| `npwp` | string | Tax ID |
| `contacts` | `ContactInfo[]` | 3 contacts: Sales, Finance, Logistics |
| `messageHistory` | `ChatMessage[]` | Seeded message history |
| `assignedAgent` | `AssignedAgent` | AI agent managing this vendor |

### AssignedAgent object

| Field | Type | Description |
|---|---|---|
| `id` | number | Agent number (e.g. `6` → "Agent #06") |
| `role` | string | Role label (e.g. "Pricing", "Compliance") |
| `activeTasks` | number | Currently open tasks for this vendor |

### Live supplier data (6 vendors)

| Vendor | Country | Status | Score | Categories | Agent | Contract | Lead | Savings YTD | Journey |
|---|---|---|---|---|---|---|---|---|---|
| PT Maju Bersama | Indonesia | Stable | 94 (+2) | Protein, Dry Goods | #06 Pricing (2 tasks) | $184K / 142d | 2d | $12,400 | Stage 11 |
| Thai Fresh Co. | Thailand | Stable | 91 (+2) | Seafood, Produce | #18 Group Buying (1 task) | $142K / 231d | 3d | $8,200 | Stage 10 |
| AUS Meats Pty | Australia | Watchlist | 88 (flat) | Protein | #21 Benchmarking (3 tasks) | $98K / **28d** | 5d | $4,100 | Stage 12 |
| VN Supply Ltd | Vietnam | Action | 82 (−3) | Produce, Dry Goods | #03 Compliance (4 tasks) | $61K / 89d | 4d | $2,100 | Stage 11 |
| Indo Seafood | Indonesia | Action | 79 (−2) | Seafood | #06 Pricing (2 tasks) | $44K / **18d** | 2d | $1,400 | Stage 11 |
| PH Agri Corp | Philippines | Stable | 86 (+2) | Produce, Beverages | #29 Sustainability (1 task) | $78K / 178d | 3d | $5,600 | Stage 10 |

**Action reasons:** VN Supply Ltd — "Score dropped 3pts · 3 compliance incidents"; Indo Seafood — "Contract expires in 18 days · 2 SLA breaches"; AUS Meats Pty — "Contract expires in 28 days"

### 12-Stage Relationship Journey

| # | Stage | Description |
|---|---|---|
| 1 | Discovery | Initial candidate logging |
| 2 | RFQ Issued | Request for quote sent |
| 3 | Proposal Received | Their pricing and terms received |
| 4 | Evaluation | Scoring the proposal |
| 5 | KYC Verification | Legal and financial identity check |
| 6 | Contract Draft | Commercial terms locked before legal |
| 7 | Legal Review | Counsel sign-off on risk language |
| 8 | Onboarding | ERP IDs, banking, account setup |
| 9 | First Order | Trial PO with quality holdback |
| 10 | Active | Trial passed — in regular rotation |
| 11 | Performance Review | Quarterly scoring vs baseline |
| 12 | Renewal | Renew, renegotiate, or part ways |

### Regional benchmarks (Agent #21)

| Country | Avg Lead Time | Avg Quality |
|---|---|---|
| Indonesia | 2.5d | 88 |
| Thailand | 3.0d | 90 |
| Australia | 4.5d | 93 |
| Vietnam | 3.8d | 82 |
| Philippines | 3.2d | 85 |

---

## 5.2 Fortress Sourcing Banner (permanent, top of page)

A persistent top bar above the three-panel layout. Not dismissable.

- **ShieldCheck icon** + "AI Sourcing Mode: Locked to Internal Directory" badge (sage pill with Lock icon) + "Secure" status (green dot)
- Subtext: "Atlas optimizes only the 6 vetted vendors below — no global discovery, no internet sourcing."
- Live counter: "[N] agent tasks executing · [N] on Manual" (dynamically computed)
- **"Onboard New Vendor"** button (sage, prominent) → `handleOnboardVendor()` → `onNavigate('request')` — routes to New Request page (Manual Discovery Portal; humans are the sole gateway for new vendor data)

---

## 5.3 Left Panel — Normal Mode (Vendor Pulse, 280px)

### Header bar

- "Vendor Pulse" · "6 vendors · 3 tiers"
- **Globe button** — back to Ecosystem (appears when vendor selected, comparison active, or select mode on)
- **Users button** — toggles Selection Mode (for compare/broadcast across vendors)
- **Maximize2 button** — expands to Audit Mode (CSS spring transition, same as Inventory)

### Search input

Filters by vendor name or country in real time.

### Selection Mode panel (when active)

- "[N] selected" or "Select vendors to compare or broadcast" instruction label
- **Compare button** — requires exactly 2 selected; if not, auto-enables select mode and shows tooltip "Select 2 vendors to initiate a side-by-side comparison" (auto-dismisses after 2600ms)
- **Broadcast button** — requires ≥ 2 selected; opens Broadcast Drawer

### Three tiers (grouped lists)

**Action Required (red)** · **Watchlist (amber)** · **Stable (green)**

Each group: section icon + label + count badge, then vendor cards.

**Vendor card:**
- Flag emoji + vendor name + composite score (color-coded: green ≥90, amber ≥80, red below) + trend icon (TrendingUp/TrendingDown/Minus)
- Action/Watchlist cards: show `actionReason` text in red/amber
- Stable cards: show 6-period sparkline chart (sage if up-trend, red if down-trend)
- Selection mode: checkbox per card (sage when checked)
- Clicking: `handleSelect(id)` — 160ms cross-fade to load relationship workspace in center

---

## 5.4 Left Panel — Audit Mode (expanded, full-width)

Triggered by Maximize2 button. Left panel expands to fill the full width; center collapses (same spring transition as Inventory Audit Mode).

### Audit header

- "Vendor Audit" · "X of 6 vendors · Agent #10 · Agent #21"
- Table/Grid view toggle
- **Minimize2 button** — collapses back to normal mode

### Audit search

Filters by vendor name, country, or category.

### Filter Ribbon

**Status chips:** All(N) / Action Required(N) / Watchlist(N) / Stable(N) — active chip fills with status color

**Category facets:** All Categories + one chip per category with semantic color background

**Advanced Filter dropdown:**
- Min. Composite Score slider (0–100, step 5)
- Contract Expiry ≤ slider (14–365 days, step 7)
- Reset button · Apply button
- Active filters shown with "● Filtered" label on trigger button

### Table view columns

| Column | Notes |
|---|---|
| Checkbox | Select-all in header; individual per row |
| Vendor | Flag + name + country |
| Categories | Semantic color badges per category |
| Status | Color-coded pill (red/amber/green) |
| Steering | Compact `LaborSwitch` — one-tap agent/manual toggle per row |
| Score | Color-coded number |
| Lead ↕ | Lead days with trend icon |
| Annual $ | Contract value in $K |
| Renewal | Red badge ≤30d / amber "Review" ≤60d / green "OK" >180d / plain days otherwise |
| Kebab menu | Per-row dropdown |

**Kebab menu options:** View Journey · Compare (if <2 checked) · Broadcast Message · (divider) · Download Dossier (exports single-vendor CSV)

### Grid view

2–4 column card grid; each card: category color banner header + flag + initials avatar + name + score + categories + status + contract days.

### Bulk Action Bar (appears when ≥1 checked)

"[N] vendors selected" + **Pause/Resume Agents** (toggles all selected between manual/agent) + **Compare** (if exactly 2 checked) + **Broadcast** + **Export** (CSV of all filtered vendors) + **Clear (X)**

---

## 5.5 Center Panel — Ecosystem Hub (no vendor, no comparison)

### QC Failure Alerts (cross-page signal)

When a QC failure is logged on the Orders page (Stage 5 · Quality Check, outcome = "fail"), a `buyamia-qc-failure` CustomEvent is dispatched. SuppliersPage listens and appends an alert to `qcFailureAlerts` state.

**Appearance:** One amber card per failure at the very top of the center panel (above Ecosystem Hub content):
- AlertTriangle icon (amber)
- Bold: "QC Failure — [Supplier Name]"
- Sub-text: "Order PO-XXXX failed Quality Check. Review vendor profile and consider trust-score adjustment."
- Dismiss (X) button — removes that card from the list.

**Left panel:** The matching supplier's card gains an amber background + a small amber dot `•` next to the supplier name for the duration of the alert.

---

**"Supply Chain Ecosystem · Operational Risk Overview"**

### 4 metric cards

| Metric | Value | Color |
|---|---|---|
| Network Health | Avg composite score across all 6 vendors | Sage |
| Action Items | Count of vendors in action tier | Red |
| Agent Savings YTD | Sum of `savingsYTD` in $K | Green |
| Renewals <60d | Count of vendors with `contractExpiresIn ≤ 60` | Amber |

### Performance Matrix (ScatterChart)

2D bubble chart: X = Annual Spend ($K) · Y = Reliability Score · Bubble size = Order count.

- Each bubble uses semantic category color (primary category of the vendor)
- Reference lines: X = $100K (spend threshold) and Y = 88 (quality threshold)
- Hover tooltip: vendor flag + name + Spend + Reliability + Orders + Score
- Quadrant legend: "Champions · High-spend, high-reliability" (top-right) / "Review · High-spend, low-reliability" (bottom-right)

### Category Reliability (horizontal BarChart)

5 categories with semantic colors and avg reliability score. **Clicking a bar** triggers `setSearch(d.name)` + `setExpandedSidebar(true)` — filters to that category in Audit Mode.

### Vendor Status Distribution

3 cards (Action Required / Watchlist / Stable) with count and first-name list of vendors.

---

## 5.6 Center Panel — Relationship Workspace (vendor selected)

`renderRelationshipWorkspace()` — loads with 160ms cross-fade.

### Breadcrumb + Score strip

- "← All Vendors > [vendor name]" (back → `handleBackToEcosystem()`)
- 5 metric score cards: Delivery · Quality · Price · Sustain. · CO₂ (each color-coded)

### Relationship Journey kernel (12-stage vertical DAG)

- Complete stages: green filled circle with checkmark + solid sage connector line
- Active stage: pulsing sage ring
- Upcoming stages: gray dashed connector
- Clicking any stage in agent mode: no-op (read-only)
- **In Manual Takeover mode:** all stages become clickable → opens Journey Stage Module modal

### Company Dossier (expandable)

- Building2 icon header, toggle open/closed
- Address + Map link button → opens Google Maps
- NIB (business registration) + NPWP (tax ID)
- 3 contact rows (Sales, Finance, Logistics): name + email (Mail icon) + phone (Phone icon)

### Recent Orders section

- Metric filter chips: All / Delivery / Quality / Price / Sustainability / CO₂ — clicking filters the order list
- Order rows: date + item description + status badge + value + metric tags
- Order statuses: delivered (green) / in-transit (blue) / pending (gray) / late (amber) / disputed (red)

### Agent Notes card

- Agent number + role + full intelligence note text (sage background)
- Example (AUS Meats): "Within your approved directory, contract expires in 28 days. Premium quality (94) but price index lags vetted peers."

### "Renegotiate" action button

`handleExecuteRenegotiate()` → **"Relationship Hardened" burst animation** (2.8s):
- Full-center overlay with backdrop blur
- Large gradient "A" in sage gradient
- "Grade: Relationship Hardened" + vendor name
- 5 Award icons with staggered float animation

---

## 5.7 Center Panel — Comparison Matrix (2 vendors selected + Compare active)

`renderComparison()` / `renderExpandedMatrix()` — shown when `isComparing = true`.

- 5-metric radar chart overlaying both vendors
- Side-by-side score breakdown table
- Recent orders from both vendors
- (In expanded audit mode: full-screen expanded matrix via `renderExpandedMatrix`)

---

## 5.8 Peek Sheet (Audit Mode + vendor selected)

A 25% width (300–380px) panel that slides in alongside the audit list when a vendor is clicked in expanded mode. Does not replace the audit list.

### Peek Sheet header

- Vendor initials avatar (category color) + name + country + "Stage X/12"
- **"Full"** button → `handleOpenFullWorkspace()` — exits audit mode, loads full Relationship Workspace

### Labor Switch (full two-segment pill)

- Agent side: "Agent #XX" + active task count badge (sage when active)
- Manual Takeover side: "Manual Takeover" (amber when active)
- "Managed by: Agent #XX · Role" governance link → `openGovernance(agentId)` → navigates to Governance page with agent pre-selected
- AgentStatusLine below: pulsing green dot "Executing · N open tasks · Tune in Governance" (agent mode) OR PauseCircle "Agent in Standby · N tasks → Human Review queue" (manual mode)

### Score grid

5 cells (Delivery/Quality/Price/Sustain./CO₂), each with score + color-coded number.

### Compact Relationship Journey

- 12 stages as vertical dot-list with labels
- **Agent mode:** view-only; active stage shows "current" tag
- **Manual mode:** all stages clickable → opens Journey Stage Module
  - Completed: hover turns amber for edit; "execute now" tag on active
  - Manually advanced stages: amber "manual" badge
- Progress percentage badge in top-right corner

### Agent Intelligence / Human Review panel

- **Agent mode** (sage bg): full `agentNotes` text
- **Manual mode** (amber bg): "Agent #XX suspended. N tasks parked for manual sign-off."

**Bottom:** "Open Full Workspace" button (sage, full-width) → `handleOpenFullWorkspace()`

---

## 5.9 Journey Stage Module Modal (Manual Takeover)

Opened by: clicking any stage row in Manual Takeover mode (Peek Sheet or Relationship Workspace).

Each of the 12 stages has a dedicated typed form.

**Header**
- Stage number circle (amber) + `{verb}: {module.action}` where verb = "Execute" (active) / "Edit" (complete) / "Plan ahead" (upcoming)
- Module rationale: one-line explanation of why the stage exists
- Stage name + supplier name

**Form fields** (schema-driven per stage)

Stage-by-stage inputs:

| Stage | Key inputs |
|---|---|
| 1. Discovery | Vendor Name, How Found (select), Country, Primary Contact, Discovery Notes |
| 2. RFQ Issued | RFQ document (file), Channel (select), Sent on (date), Deadline (date), Scope summary |
| 3. Proposal Received | Proposal doc (file), Quoted unit price, Lead time, Payment terms (select), Caveats |
| 4. Evaluation | Quality score, Price score, Reliability proxy, Recommendation (select), Rationale |
| 5. KYC Verification | NIB/Business Registration, Tax ID/NPWP, Incorporation date, KYC packet (file), Sanctions check (select) |
| 6. Contract Draft | Contract draft (file), Term length, Payment terms (select), Volume commitment, Special clauses |
| 7. Legal Review | Legal reviewer, Redlines (file), Approval status (select), Notes |
| 8. Onboarding | ERP supplier ID, Account manager, Their contact, Banking form (file), Kickoff notes |
| 9. First Order | PO number, Items, PO value, Delivery date, Risk notes |
| 10. Active | First-order outcome (select), Baseline quality score, Baseline lead time, Performance notes |
| 11. Performance Review | Quality, Reliability, Price scores; Recommendation (select), Review summary |
| 12. Renewal | Decision (select), New contract (file), New term length, Closing notes |

**Validation:** Required fields highlighted in red if empty when "Advance to Next Stage" is clicked.

**Footer buttons:**
- **Save Draft** — saves form data to `manualJourneyEntries[supplierId][stageIdx]` without advancing stage
- **Advance to Next Stage** (amber) — validates required fields, saves, increments `forceCompletedJourneyStages[supplierId]`, closes modal

---

## 5.10 Right Panel — Atlas Intelligence

The right panel has 4 distinct mode-driven states.

### Mode 1: Comparison active → Comparative Delta

- "Comparative Delta" header · "Atlas synthesis · [A flag] vs [B flag]"
- **Direct Comparison** — auto-generated narrative: "[Vendor A] is 2 days faster but $35K/yr more expensive than [Vendor B]."
- **Recommendation** (sage card with Award icon) — budget vs speed priority analysis + suggested winner
- **Metric Deltas** strip — 4 rows: Composite Score / Lead Time / Annual Cost / Savings YTD with winner highlighted

**Bottom (Secure Messaging Portal):**
- "Message Both" (sage) → opens Broadcast Drawer for both vendors
- "Message Winner · [name]" (outline) → opens Messaging Drawer for winning vendor

### Mode 2: Selection Mode ready (≥2 vendors selected) → Bulk Action Summary

- Selected vendor cards with flag + name + score
- Combined Reach: total contract value + avg score
- **Broadcast Announcement** button at bottom

### Mode 3: Single supplier active → Relationship ROI

**Relationship ROI** (Award icon)
- Savings YTD value (sage, large)
- Narrative based on savings tier: high-value partner / moderate / low-savings
- Partner grade badge: A (≥90) / B+ (≥85) / B (≥80) / C

**Market Benchmarking** (Activity icon — Agent #21)
- Lead Time: vendor days vs regional avg, delta labeled ▲/▼
- Quality Score: vendor vs regional avg, "Top quartile" or "Below threshold" note

**Account Manager** (MessageCircle icon)
- Account manager name + WhatsApp phone number

**Bottom (Secure Bridge):**
- "Open Secure Bridge" button (outline) → opens Messaging Drawer
- "Routes to [Account Manager] · encrypted" label

### Mode 4: No supplier → Network Overview

- "Monitoring 6 vendors across N regions. Total annual contract: $607K."
- "[N] vendors need attention. Select a vendor to view their Relationship Journey."

---

## 5.11 Messaging Drawer (1-on-1 Secure Bridge)

Opened via "Open Secure Bridge" in right panel bottom zone. Overlays the right panel (`z-20`, `absolute inset-0`).

- "Secure Messaging Portal" header + account manager name
- **WhatsApp / Telegram** channel toggle + pulsing green "live" status
- Transcript: seeded `messageHistory` + session messages combined
  - Vendor messages: gray left-aligned bubbles
  - Admin messages: sage right-aligned bubbles + timestamp
- Compose textarea (Enter to send, Shift+Enter for newline) + Send button
- "Routed via Buyamia Gateway → [channel]" footer

`handleSendMessage()`: appends new `ChatMessage` to `sessionMessages[vendorId]`, clears draft.

---

## 5.12 Broadcast Drawer (Multi-Vendor Announcement)

Opened via Broadcast button in bulk action bar or right panel. Overlays the right panel.

- "Broadcast Announcement" header + "[N] vendors targeted"
- Target vendor pills (flag + first name)
- WhatsApp / Telegram channel toggle
- Compose textarea + "Sent to each vendor's [channel] via Buyamia Gateway" label
- **"Send to N Vendors"** button (sage, disabled until draft non-empty) → clears draft and closes drawer

---

## 5.13 Key State

| State | Type | Purpose |
|---|---|---|
| `laborMode` | `Record<string, LaborMode>` | Per-vendor agent/manual mode |
| `selectedId` | string? | Currently selected vendor ID |
| `expandedSidebar` | boolean | Audit Mode active |
| `auditView` | `'table' \| 'grid'` | Display mode in audit |
| `comparisonActive` | boolean | Side-by-side comparison active |
| `sidebarSelectMode` | boolean | Multi-select mode in normal left panel |
| `sidebarSelected` | Set\<string\> | Selected vendor IDs (normal mode) |
| `auditChecked` | Set\<string\> | Checked vendor IDs (audit mode) |
| `matrixVisible` | boolean | Expanded comparison matrix shown |
| `metricFilter` | RadarMetric | Active metric filter on recent orders |
| `dossierOpen` | boolean | Company dossier section expanded |
| `messagingOpen` | boolean | 1-on-1 messaging drawer open |
| `messagingChannel` | `'whatsapp' \| 'telegram'` | Messaging channel |
| `broadcastOpen` | boolean | Broadcast drawer open |
| `openJourneyStage` | `{supplierId, stageIdx}?` | Journey Stage Module modal target |
| `forceCompletedJourneyStages` | `Record<string, number>` | Manually advanced stages per vendor |
| `manualJourneyEntries` | `Record<string, Record<number, Record<string, string>>>` | Form data per vendor per stage |
| `showHardened` / `hardenedName` | boolean / string | "Relationship Hardened" animation state |
| `search` | string | Search query |
| `auditStatusFilter` | `'all' \| VendorStatus` | Status filter chip |
| `auditCategoryFilter` | string? | Category facet filter |
| `scoreMin` | number | Advanced filter: min composite score |
| `contractMaxDays` | number | Advanced filter: max contract expiry days |
| `kebabOpenId` | string? | Which row's kebab menu is open |

---

## 5.14 Actions

| Action | Location | What happens |
|---|---|---|
| Click "Onboard New Vendor" | Fortress banner | `onNavigate('request')` — New Request (Manual Discovery Portal) |
| Click vendor card (normal) | Left panel | 160ms fade → Relationship Workspace in center |
| Toggle Users (select mode) | Left panel header | Enables multi-select checkboxes |
| Click Compare (2 selected) | Left panel select mode | Activates comparison; center → Comparison Matrix |
| Click Broadcast (≥2 selected) | Left panel select mode | Opens Broadcast Drawer |
| Click Globe (back) | Left panel header | Returns to Ecosystem Hub |
| Click Maximize2 | Left panel header | Expands to Audit Mode |
| Toggle LaborSwitch (compact) | Audit table Steering col | Toggles per-vendor agent/manual |
| Kebab → View Journey | Audit table/grid | Selects vendor, loads Relationship Workspace |
| Kebab → Compare | Audit table/grid | Adds to `auditChecked` for comparison |
| Kebab → Broadcast Message | Audit table/grid | Opens Broadcast Drawer for that vendor |
| Kebab → Download Dossier | Audit table/grid | Downloads single-vendor CSV |
| Bulk → Pause/Resume Agents | Audit bulk bar | Sets all checked vendors to manual/agent |
| Bulk → Compare (exactly 2) | Audit bulk bar | Shows comparison matrix |
| Bulk → Broadcast | Audit bulk bar | Opens Broadcast Drawer |
| Bulk → Export | Audit bulk bar | Downloads CSV of all filtered vendors |
| Click Category bar | Ecosystem category chart | Filters audit by that category + expands audit |
| Click "← All Vendors" | Center breadcrumb | Returns to Ecosystem Hub (160ms fade) |
| Click journey stage (manual) | Relationship Workspace / Peek Sheet | Opens Journey Stage Module modal |
| Click "Renegotiate" | Relationship Workspace | Fires "Relationship Hardened" burst animation |
| Click Map link | Company Dossier | Opens Google Maps for vendor address |
| Save Draft (modal) | Journey Stage Module | Saves form data without advancing stage |
| Advance to Next Stage (modal) | Journey Stage Module | Validates, saves, increments journey stage |
| Click "Full" (Peek Sheet) | Peek Sheet header | Exits audit, loads full Relationship Workspace |
| Open Secure Bridge | Right panel bottom | Opens Messaging Drawer overlay |
| Send message | Messaging Drawer | Appends to session messages, clears draft |
| Message Both | Right panel (comparison) | Opens Broadcast Drawer for both vendors |
| Message Winner | Right panel (comparison) | Opens Messaging Drawer for winning vendor |
| Send Broadcast | Broadcast Drawer | Clears draft, closes drawer |
| Governance link | Peek Sheet / LaborSwitch | Navigates to Governance page, hash-selects agent |

---

## 5.15 Key Flows

### Action vendor triage flow

1. Admin opens Suppliers — left panel shows VN Supply Ltd and Indo Seafood in Action Required tier.
2. Admin clicks VN Supply Ltd — 160ms fade — Relationship Workspace loads.
3. Agent Notes: "Declining quality trend. 3 compliance incidents this quarter. 2 vetted Produce alternatives pre-qualified."
4. Admin clicks stage 11 (Performance Review) — Manual Takeover is off so it is read-only.
5. Admin switches Labor Switch to Manual Takeover — stage 11 becomes clickable.
6. Admin opens Journey Stage Module for stage 11 — enters scores (quality 75, reliability 82) — selects "Probation" as recommendation — clicks "Advance to Next Stage."
7. Admin opens Secure Bridge — composes message to Nguyen Van Thanh: "Running internal quality audit — 3 compliance incidents this quarter. Please investigate."

### Contract renewal flow

1. Admin opens Suppliers — AUS Meats Pty shows "Contract expires in 28 days" in Watchlist.
2. Admin clicks AUS Meats Pty — right panel shows Market Benchmarking: lead time 5d vs 4.5d regional avg (amber ▲0.5d).
3. Agent Notes: "Q3 renegotiation window opens in 42 days — consider proactive terms."
4. Admin opens Secure Bridge — message history shows prior renewal negotiation — composes: "Contract renewal in 28 days — open to revised pricing?"
5. Vendor replies: "Open to a call this week."
6. Admin switches to Manual Takeover — opens stage 12 (Renewal) module — selects "Renew — new terms" — uploads amendment PDF — enters "18 months" new term — clicks "Advance."

### Side-by-side vendor comparison flow

1. Admin clicks Users icon — selection mode activates.
2. Admin checks PT Maju Bersama and Thai Fresh Co. — both cards get checkmarks.
3. Admin clicks Compare — `comparisonActive = true` — center panel cross-fades to Comparison Matrix.
4. Right panel shows Comparative Delta: "PT Maju is $42K/yr more expensive but 1 day faster than Thai Fresh."
5. Recommendation: "If budget is the priority, Thai Fresh is the strategic choice."
6. Admin clicks "Message Both" → Broadcast Drawer opens targeting both vendors.

### Audit + bulk agent pause flow

1. Admin clicks Maximize2 — Audit Mode expands. Right panel shows Relationship ROI for first vendor.
2. Admin applies Advanced Filter: Contract Expiry ≤ 60d — list narrows to 2 vendors (AUS Meats, Indo Seafood).
3. Admin checks both — Bulk Action Bar appears.
4. Admin clicks "Pause Agents" — both vendors switch to manual mode. Counter in Fortress banner updates.
5. Admin clicks "Broadcast" — Broadcast Drawer opens targeting AUS Meats + Indo Seafood.
6. Admin composes: "Contract renewal review underway. Standby for updated terms." → sends.
7. Admin clicks "Resume Agents" — both return to agent mode.

---

## 6. AI Activity Page

The AI Activity page is the platform's oversight cockpit — a real-time audit surface where admins inspect every autonomous action the agent fleet has taken, understand why each decision was made, override evidence, rollback actions within a time window, and throttle autonomy at the category level without stopping the system.

---

### 6.1 Data Model

#### Agent Directory (`AGENTS`)

9 named agents in 3 role classes:

| ID | Name | Role | Icon accent |
|---|---|---|---|
| EXE-001 | Agent #1 | Order Executor | blue-400 |
| EXE-002 | Agent #2 | Procurement Runner | cyan-400 |
| EXE-005 | Agent #5 | Group Buy Coordinator | violet-400 |
| REA-003 | Agent #3 | Quote Reviewer | pink-400 |
| SEN-001 | Agent #6 | Demand Sensor | emerald-400 |
| SEN-002 | Agent #7 | Forecast Engine | orange-400 |
| SEN-004 | Agent #4 | Sourcing Scout | yellow-400 |
| GOV-001 | Agent #8 | Compliance Officer | indigo-400 |
| GOV-002 | Agent #9 | Certification Bot | purple-400 |

#### Event Ledger (`EVENTS`)

12 fixed `ActivityEvent` records. Each event carries:

| Field | Type | Notes |
|---|---|---|
| `id` | string | `evt-001` … `evt-012` |
| `type` | `EventType` | `auto-order` \| `sourcing` \| `group-buy` \| `rejection` \| `compliance` \| `forecast` |
| `minutesAgo` | number | Drives undo window countdown |
| `category` | string | One of the 7 semantic categories |
| `description` | string | Human-readable action summary |
| `agent` | string | AGENTS key |
| `confidence` | number | 0–100; drives confidence bar color and guardrail interception |
| `saving` | number \| null | Direct dollar saving; null if no saving (e.g. compliance, forecast) |
| `capitalPreserved` | number | Working capital avoided being tied up |
| `rollbackable` | boolean | `false` once action is irreversible (shipped, paid, certified) |
| `reasoning` | `ReasoningChain` | `why` string + `dataPoints[]` + `alternatives[]` |

`ReasoningChain.dataPoints`: each has `label`, `value`, optional `delta`, optional `tone` (`positive | negative | neutral`). These are the editable fields for Evidence Override.

`ReasoningChain.alternatives`: each has `label` + `rejectedBecause` — alternatives the agent explicitly ruled out before acting.

#### Loaded events summary

| ID | Type | Category | Agent | Confidence | Saving | Rollbackable |
|---|---|---|---|---|---|---|
| evt-001 | auto-order | Dry Goods | EXE-001 | 96% | $240 | yes |
| evt-002 | rejection | Seafood | REA-003 | 92% | $1,200 | yes |
| evt-003 | group-buy | Dry Goods | EXE-005 | 88% | $680 | yes |
| evt-004 | forecast | Seafood | SEN-002 | 74% | — | yes |
| evt-005 | compliance | Other | GOV-001 | 99% | — | no |
| evt-006 | auto-order | Other | EXE-001 | 94% | $85 | no |
| evt-007 | sourcing | Protein | SEN-004 | 81% | $720 | yes |
| evt-008 | auto-order | Dairy | EXE-002 | 91% | $150 | no |
| evt-009 | rejection | Produce | REA-003 | 68% | — | yes |
| evt-010 | forecast | Protein | SEN-001 | 82% | — | yes |
| evt-011 | group-buy | Dry Goods | EXE-005 | 71% | — | yes |
| evt-012 | compliance | Other | GOV-002 | 97% | — | no |

#### Color palettes

Two separate, non-mixing palettes:

**Layer 1 — Category stripe** (matches Spending + Suppliers):

| Category | Color |
|---|---|
| Protein | `#991b1b` (dark red) |
| Seafood | `#075985` (dark blue) |
| Produce | `#166534` (dark green) |
| Dry Goods | `#334155` (slate) |
| Beverages | `#92400e` (brown) |
| Dairy | `#0e7490` (teal) |
| Other | `#64748b` (gray) |

**Layer 2 — Action icon** (event type badge and icon background):

| Event type | Color | Semantic meaning |
|---|---|---|
| auto-order | `#334155` Slate | Transactional order flow |
| sourcing | `#4338ca` Indigo | Vendor search |
| group-buy | `#7e22ce` Purple | Pooled buying |
| rejection | `#b45309` Amber | Guardrail enforcement |
| compliance | `#15803d` Green | Regulatory seal |
| forecast | `#0e7490` Cyan | Prediction/sensing |

#### Undo Window modes (`UndoMode`)

```
'hard-60'      — Fixed 60-minute real-world timer (external commit physics)
'ledger-close' — Window stays open until admin clicks "Approve Today's Ledger"
'per-class'    — Default hybrid: external-bound events (auto-order, group-buy) get hard-60; all others use ledger-close
```

#### Sparkline data

- `SAVINGS_24H`: 24 hourly samples, cumulative $0 → $3,075 direct savings
- `CAPITAL_24H`: 24 hourly samples, cumulative $0 → $7,640 capital preserved

#### Default per-category autonomy levels

```
Protein: L2,  Seafood: L2,  Produce: L3
Dry Goods: L4, Beverages: L4, Dairy: L2, Other: L3
```

Global autonomy: fixed display `L3` with "72% progress to L4" readout.

---

### 6.2 Left Panel — Control Plane

**Header:** Gauge icon + "Control Plane" title + "Throttle · Triage · Trust" subtitle.

**Confidence Guardrail** (top section):

- Range slider: 50–99%, default 85%.
- Intercepted count badge (amber pill) showing how many events fall below the current threshold.
- Explanation copy: "Below this threshold, autonomous actions are intercepted and routed to Needs Your Action."
- When `event.confidence < confidenceGuardrail`, the event gets the "Intercepted · Probationary" chip in the timeline.

**Confidence Triage** (filter by confidence band):

4 buttons, stacked vertically. Active button has sage-tinted background.

| Band ID | Label | Range |
|---|---|---|
| all | All Confidence | 0–100% |
| high | High | ≥ 90% |
| medium | Medium | 80–89% |
| low | Low Confidence | < 80% |

Percent icon color: green for high, amber for medium, red for low. Badge shows event count per band. If any low-confidence events exist, a red "N flagged" badge appears in the section header.

**Event Type filter:**

7 buttons (All Events, Auto-Orders, Sourcing, Group Buys, Rejections, Compliance, Forecasts). Badge shows count per type. Active = sage background.

**Autonomy Throttle** (per-category):

One row per category (7 total). Each row shows:
- Category icon in a category-colored 16×16 square
- Category name + current level `L0`–`L5`
- 6-pip bar (pips filled up to current level in category color)
- `−` and `+` buttons (ChevronDown/ChevronUp); clamp at 0 and 5
- `AUTONOMY_LABELS[level]` text below the bar (e.g., "Confirm before act", "Notify only", "Full autonomy")
- **Calibration badge** (shown only when `isWarmingUp = true`): right-aligned badge next to the label.
  - `Calibrated` (teal) — category has ≥3 events in history, confidence scores are reliable
  - `Learning` (amber) — fewer than 3 events; throttle and confidence may still shift

**Global Autonomy readout:**

Fixed at L3. Shows label, progress bar at 60% fill, "72% progress to L4: [label]" copy.

---

### 6.3 Center Panel — Autonomous Event Ledger

#### Learning Phase Banner

`WARMUP_THRESHOLD = 25`. When `EVENTS.length < 25`, `isWarmingUp = true` and a teal banner appears at the very top of the center panel:

- Gauge icon (teal)
- Bold: "Learning Phase — X% calibrated (N/25 events)"
- Sub-text: "The AI is still building its confidence baseline. Throttle settings and confidence scores may shift as more events are recorded. Categories marked 'Calibrated' in the left panel have enough data to be trusted."
- Teal progress bar: `warmupPct = Math.round((EVENTS.length / 25) * 100)%`

The banner disappears automatically once the platform has logged ≥25 events.

#### Capital Efficiency summary

4-card grid:

| Card | Data | Extra |
|---|---|---|
| Actions Executed | `EVENTS.length` (12) | Zap icon |
| Direct Savings | `$3,075` | Green sparkline (24h cumulative) |
| Capital Preserved | `$13,480` | Sage sparkline (24h cumulative) |
| In Undo Window | count of events currently within their undo window | Mode badge: "60-min" \| "ledger" \| "mixed" |

#### Undo Window Policy card

Below the summary cards. 3-option grid:

| Option | Label | Subtitle |
|---|---|---|
| hard-60 | Hard 60-min timer | Real-world commit physics |
| ledger-close | Until ledger close | Daily Approve gate |
| per-class (default) | Per-class (default) | External 60m · Internal until close |

"Approve Today's Ledger" CTA button appears when `undoMode !== 'hard-60'` and ledger not yet approved. Clicking it sets `ledgerApproved = true` and closes all reversible windows. If already approved, shows green "Ledger approved · windows closed" badge.

#### Activity Timeline

Header: "Activity Timeline" + active-filter clear chips (XCircle "Clear confidence filter" / "Clear type filter").

Empty state: "No events match your filters."

Each event card is a bordered rounded card with:

**Left stripe:** 4px vertical bar in category color (Layer 1).

**Status chips** (row 1, above main content):
- "Reversed by Admin · working capital restored" (gray, strikethrough on entire row)
- "Intercepted · Probationary (below N% guardrail)" (amber bold)
- "[Agent Name] Suspended" (red bold)

**Content row 1** — event type + agent + confidence + time:
- Action icon in Layer 2 action-color rounded square
- Action type label badge (action color bg at 10% opacity)
- Agent button (agent accent icon + agent ID mono + role label + ExternalLink icon) — clicking navigates to `governance` page with `window.location.hash = agent-NN`
- Confidence % (color-coded green/amber/red) + relative time ("2 min ago", "1h ago")

**Content row 2** — description + deep-link:
- Event description text
- Source page button (blue, ExternalLink icon) — routing map:
  - `auto-order`, `group-buy` → Orders
  - `sourcing`, `rejection` → Suppliers
  - `compliance` → Governance
  - `forecast` → Inventory

**Content row 3** — confidence bar + savings (hidden if reversed):
- Thin progress bar, color = green ≥90%, amber 80–89%, red <80%
- "+$NNN direct" (green) if `saving` is non-null
- "$NNN capital preserved" (sage) if `capitalPreserved > 0`

**Content row 4** — undo window + actions (hidden if reversed):
- If within undo window: amber Timer icon + amber progress bar (decays linearly 0→60 min) + "Safe-to-Cancel · Xm left" text
- If undo window expired: CheckCircle + "Undo window expired" or "Action finalized"
- "Explain Logic" button (Eye icon) — selects this event
- "Rollback" button (Undo2 icon, amber border) — active only if `withinUndo`; opens Rollback Modal. If not within window, shows "Locked" in muted gray.

Events connected by a vertical slate-colored hairline connector between cards (System Heartbeat indicator).

Clicking any non-reversed card selects the event and updates the right panel.

---

### 6.4 Right Panel — Transparency Copilot

Split into scrollable top + fixed-bottom chat.

#### Empty state (no event selected)

"Select an event in the ledger to inspect the agent's reasoning chain — why it acted, what data it used, and which alternatives it rejected."

#### Event selected: Agent Reasoning Chain

**Agent identity card:**
- Agent accent-colored background (12% opacity) with matching border
- Agent icon in accent-colored 28×28 square
- Agent name + role (clickable → Governance deep-link with ExternalLink badge)
- Agent ID in monospace
- Confidence % (color-coded) at right

**Suspend / Resume controls** (within the agent card):
- Default: "Performance review available" text + "Suspend Agent" button (red border, PauseCircle icon)
- Suspended: "Globally Suspended" label (red, PauseCircle) + "Clear Suspension" button (sage bg)
- Suspension is global across the app — `toast.warning("[name] suspended — all in-flight autonomous actions paused"`
- Resume: `toast.success("[name] resumed — Performance Review cleared")`

**Category + type chips** row: category chip (category color), event type chip (gray), relative time stamp at right.

**"Why was this done?" block:**
- Bot icon + "WHY WAS THIS DONE?" label
- Agent's `reasoning.why` narrative

**"Data used" block — Evidence Override:**
- Layers icon + "DATA USED" label + "Click ✎ to recalibrate" hint
- One row per `dataPoint`: label (left) + value + delta (right)
- Delta tinted: positive = green, negative = red, neutral = muted
- On hover: pencil icon (opacity-0 → opacity-100) appears next to value
- Clicking pencil opens inline edit: input pre-filled with current value, Enter/✓ saves, Escape/✗ cancels
- On save: `editedDataPoints[eventId][label]` updated; amber "⚠ overridden" badge appears on that row; `toast.success("Recalibration saved — agent will use this value on next run")`
- Overridden rows get amber background tint

**"Alternatives rejected" block:**
- AlertTriangle icon + "ALTERNATIVES REJECTED" label
- Each alternative: label in bold + italic `rejectedBecause` beneath

#### Safe-to-Cancel Window (below reasoning chain)

- If within undo window: amber border card, "X minutes left", progress bar, "Reversible — vendor confirmation required. Fees and lead-time impact depend on vendor cancellation policy. After the window closes, rollback requires manual vendor coordination." (Realism note: copy revised to be honest about real-world cancellation cost — see `REALISM-AUDIT.md` AI Activity #3.)
- If expired: muted card, "Undo window expired" or "Action finalized"

#### Capital Efficiency section (always visible, below event or empty state)

Sage-tinted card showing:
- "Working capital preserved today" label
- `$13,480` value in bold sage
- Narrative: "Buyamia agents avoided tying up $13,480 in premature orders... in addition to $3,075 in direct savings."
- 2-column breakdown: Direct savings / Auto-orders count

#### Always-on Atlas Chat (pinned to right panel bottom)

Fixed at the bottom of the right panel regardless of selected event. Chat messages scroll above. Textarea + sage Send button. Response template: "Pulling the audit trail relevant to '[query]'. Open the event in the timeline for the full reasoning chain."

---

### 6.5 Rollback Modal

Triggered by clicking the Rollback button on any event within its undo window (`rollbackable = true` and undo window open).

**Structure:**
- Full-screen backdrop (`rgba(0,0,0,0.55)`), click-outside to dismiss
- Amber-accented modal (max-width 512px)
- Header: amber Undo2 icon + "Rollback & Intervene" label + event description + agent ID/role/confidence

**Two-choice grid:**

| Choice | Icon | Description | Best for |
|---|---|---|---|
| Fix & Re-run | RotateCcw (sage bg) | Revert action, admin edits data points in Reasoning Chain, agent retries on save | AI used stale or wrong data |
| Manual Takeover | Hand (amber bg) | Revert action, flip related order/SKU to Manual Mode, admin completes by hand | AI's whole approach was wrong |

**On choice:**
- `Fix & Re-run`: `toast.success("Rolled back · queued for AI re-run")` with description "Edit data points in the Reasoning Chain — agent will retry on save."
- `Manual Takeover`: `toast.warning("Rolled back · Manual Takeover engaged")` with description "Related order/SKU flipped to Manual mode."
- In both cases: event added to `reversedIds` set, card shows gray "Reversed by Admin · working capital restored" chip and full strikethrough.

---

### 6.6 Key State

| State variable | Type | Purpose |
|---|---|---|
| `typeFilter` | `EventType` | Active event-type filter in timeline |
| `confFilter` | `ConfidenceBand` | Active confidence-band filter |
| `selectedEventId` | `string \| null` | Drives right panel content |
| `categoryAutonomy` | `Record<string, AutonomyLevel>` | Per-category throttle (L0–L5) |
| `suspendedAgents` | `Set<string>` | Globally suspended agent keys |
| `confidenceGuardrail` | `number` | Threshold (50–99%) below which events are intercepted |
| `editedDataPoints` | `Record<string, Record<string, string>>` | Admin overrides: `{ eventId: { fieldLabel: newValue } }` |
| `editingField` | `{ eventId, label } \| null` | Which data-point field is in edit mode |
| `fieldDraft` | `string` | Current value in the edit input |
| `rollbackPromptId` | `string \| null` | Event ID whose rollback modal is open |
| `undoMode` | `UndoMode` | Undo window policy: hard-60, ledger-close, or per-class |
| `ledgerApproved` | `boolean` | Whether admin has closed today's undo window |
| `reversedIds` | `Set<string>` | Events that have been rolled back (shown as struck through) |

---

### 6.7 Actions

| Action | Location | Effect |
|---|---|---|
| Adjust confidence guardrail slider | Left panel | Recalculates intercepted-count badge; events below threshold show amber "Intercepted" chip |
| Click confidence band | Left panel | Filters timeline to that band; activates sage highlight |
| Click event type | Left panel | Filters timeline to that type |
| Click `−` / `+` on category autonomy | Left panel | Decrements/increments that category's AutonomyLevel (clamp 0–5) |
| Click event card | Center timeline | Sets `selectedEventId`; right panel loads reasoning chain |
| Click agent ID button on event | Center timeline | Navigates to Governance page with `#agent-NN` hash |
| Click source page button ("Open in Orders" etc.) | Center timeline | Navigates to target page with `#evt=eventId` hash |
| Click "Explain Logic" | Center timeline | Selects event (same as card click) |
| Click "Rollback" | Center timeline | Opens Rollback Modal (only when within undo window) |
| Click "Approve Today's Ledger" | Center Undo Window Policy | Sets `ledgerApproved = true`; closes all reversible windows |
| Select undo mode (hard-60 / ledger-close / per-class) | Center Undo Window Policy | Changes how undo windows are calculated |
| Click agent name/role in right panel | Right panel | Navigates to Governance page deep-link |
| Click "Suspend Agent" | Right panel agent card | Globally suspends agent; all cards for that agent show red "Suspended" chip; `toast.warning` |
| Click "Clear Suspension" | Right panel agent card | Resumes agent; `toast.success` |
| Hover data point row → click pencil | Right panel Evidence Override | Opens inline edit for that field |
| Enter / click ✓ in edit input | Right panel Evidence Override | Saves override value; sets amber "⚠ overridden" badge; `toast.success("Recalibration saved")` |
| Escape / click ✗ in edit input | Right panel Evidence Override | Cancels edit |
| Click "Fix & Re-run" in Rollback Modal | Rollback Modal | Marks event reversed; `toast.success`; admin can edit data points for agent re-run |
| Click "Manual Takeover" in Rollback Modal | Rollback Modal | Marks event reversed; flips related order/SKU to Manual Mode; `toast.warning` |
| Send message in Atlas Chat | Right panel (pinned bottom) | Appends user message; 600ms later Atlas responds with audit trail pointer |

---

### 6.8 Key Flows

#### Evidence override + agent re-run flow

1. Admin reviews the Activity Timeline — sees evt-004 (forecast) at 74% confidence marked "Intercepted."
2. Admin clicks evt-004 — right panel loads the reasoning chain for SEN-002.
3. Data Points block shows: "3yr historical uptick: +11% avg", "Ramadan proximity: 8 days", etc.
4. Admin hovers "Ramadan proximity" row — pencil icon appears.
5. Admin clicks pencil — inline edit opens, pre-filled with "8 days."
6. Admin types "3 days" (e.g., Ramadan is closer than the agent thought) — clicks ✓.
7. `editedDataPoints["evt-004"]["Ramadan proximity"] = "3 days"` saved. Amber "⚠ overridden" badge appears.
8. `toast.success("Recalibration saved — agent will use this value on next run.")`
9. Agent SEN-002 will use the admin-supplied value the next time it evaluates this forecast.

#### Rollback + manual takeover flow

1. Admin sees evt-001 (Auto-ordered 500kg Jasmine Rice) at 2 min ago — undo window open.
2. Admin clicks "Rollback" — Rollback Modal opens.
3. Admin reads description: EXE-001 placed the order. Confidence 96%.
4. Admin decides the AI's approach was wrong (e.g., vendor relationship has a dispute).
5. Admin clicks "Manual Takeover" — modal closes.
6. `toast.warning("Rolled back · Manual Takeover engaged — related order/SKU flipped to Manual mode.")`
7. evt-001 card shows gray strikethrough + "Reversed by Admin · working capital restored."
8. Inventory and Orders pages: the relevant SKU/PO is now in Manual Mode.

#### Agent suspension flow

1. Admin sees two rejections (evt-002, evt-009) both assigned to REA-003.
2. Admin clicks evt-002 — right panel shows REA-003 (Quote Reviewer) identity card.
3. Admin clicks "Suspend Agent" — `suspendedAgents.add("REA-003")`.
4. `toast.warning("Agent #3 suspended — all in-flight autonomous actions paused until cleared.")`
5. All event cards in the timeline with agent REA-003 now show red "Agent #3 Suspended" chip.
6. Admin investigates both rejections (reads Reasoning Chain, checks alternatives).
7. Satisfied, admin clicks "Clear Suspension" — `suspendedAgents.delete("REA-003")`.
8. `toast.success("Agent #3 resumed — Performance Review cleared. Autonomous actions resume across the app.")`

#### Category autonomy throttle flow

1. Admin notices 3 Seafood events in the timeline — all auto-orders triggering faster than expected.
2. Admin locates "Seafood" row in Autonomy Throttle section (left panel) — currently L2.
3. Admin clicks `−` once — Seafood drops to L1. Pip bar updates to 1 filled pip.
4. `AUTONOMY_LABELS[1]` label updates below the bar (e.g., "Confirm before act").
5. Going forward, all Seafood auto-orders require admin confirmation before executing.

#### Confidence guardrail triage flow

1. Admin adjusts Confidence Guardrail slider from 85% to 75%.
2. "2 intercepted" badge on the guardrail section updates to "4 intercepted."
3. Events evt-004 (74%), evt-009 (68%), evt-011 (71%) now show amber "Intercepted · Probationary" chips.
4. Admin clicks "Low Confidence" filter in Confidence Triage — timeline narrows to 3 events.
5. Admin reviews each, decides evt-009 is correct (7-day lead time rejection is valid).
6. Admin raises guardrail back to 80% — evt-009 is no longer intercepted (68% < 80% still, so it remains).
7. Admin uses Evidence Override on evt-004 to correct the Ramadan proximity value.

---

### 6.9 Deep-Link Hash Reader

On mount and on every `hashchange`, AI Activity inspects `window.location.hash`:

| Hash form | Effect |
|---|---|
| `evt=eventId` (real id, `evt-001..evt-012`) | Sets `selectedEventId` (right-panel Transparency Copilot loads the reasoning chain) **and** scroll-into-views the matching event card in the timeline via `data-event-id` **and** applies the 2.2s sage `flash-event` keyframe. Hash is cleared. |
| `evt=eventId` (unknown id) | Fires an amber `toast.warning("{id} isn't in this ledger — the activity timeline is open for browsing")`. Falls back to default state. Hash is cleared. |

This pairs with `App.tsx`'s `buyamia-navigate-page` bridge: anywhere a caller fires the event with `{ page: 'ai-activity', evtId: 'evt-XXX' }` or `{ page: 'ai-activity', decisionId: 'DEC-XXX' }`, the payload is promoted to a hash so the receiver sees it on mount. Note: `decisionId` is preserved verbatim in the hash even though AI Activity's event IDs use the `evt-XXX` scheme — the receiver only auto-selects when the hash is in `evt=` form.

### 6.10 TrailReturnPill (Decision Attribution Trail breadcrumb)

When AI Activity is mounted and `sessionStorage['buyamia-trail-return']` is present (set by the Orders Decision Attribution Trail's "AI Activity · evt-XXX" chip), a fixed-position pill renders at `top: 64px`:

> **← 🕓 Return to PO-XXXX · Stage N Trail**

Clicking the pill calls `onNavigate('orders')` — the sessionStorage marker stays so `NewOrdersPage` consumes it on mount and re-opens the Trail on the same order with the same stage expanded. The marker has a 30-min TTL. See § 1.12 Decision Attribution Trail for the full contract.

---

## 7. New Request Page

The New Request page is the platform's Strategic Sourcing Portal — a 7-step wizard that guides an admin from stating procurement intent through authorizing a new purchase order. It also serves as the single entry point for vendor onboarding, restock deep-links, and carbon-copy re-orders. On completion the new PO is routed directly to the Orders page.

---

### 7.1 Data Model

#### Line Items (`LineItem`)

Each line item in the wizard:

| Field | Type |
|---|---|
| `id` | string |
| `name` | string |
| `category` | string |
| `qty` | number |
| `unit` | string |
| `unitPrice` | number |

Default pre-filled items on fresh load: Baby Spinach (20 bags @ $4.50), Cherry Tomatoes (15 punnets @ $3.80), Fresh Basil Bunch (10 bunches @ $2.20).

#### Autonomy Tiers (`AUTONOMY_TIERS`)

6 levels (L0–L5) with explicit agent assignment:

| Value | Label | Agent | Desc | Scope |
|---|---|---|---|---|
| L0 | Manual | none | You approve every step | No agent assigned |
| L1 | Suggest | Agent #07 · Logistics | AI recommends, you decide | Drafts proposals + collects quotes. Won't commit anything |
| L2 | Auto | Agent #33 · Compliance | AI acts, you review | Executes within guardrails. Surfaces low-confidence calls |
| L3 | Full | Agent #01 · PO Engine | AI handles end-to-end | Full autonomy except HITL-gated stages |
| L4 | Supervised Full | Agent #01 · PO Engine | AI runs all stages, weekly digest | Full execution + weekly briefing summary. HITL gates at Stage 1 and Stage 12 remain |
| L5 | Full Autonomy | Agent Fleet (EXE-001, EXE-002, SEN-001, SEN-002) | Full agent fleet, no check-ins | Agent fleet operates end-to-end. Legal HITL gates only |

**Governance Guardrail (always):** Even at L5, Stage 1 (PO Approval) and Stage 12 (Delivery Confirmation) require manual human authorization.

#### Group Buy Pool (`SIMULATED_POOL_MATCH`)

Single seeded match for food-beverage requests:

```
id: 'DR-2864'
members: ['Indo Seafood Corp', 'Thai Fresh Co', 'PT Maju Bersama']
estDiscountPct: 12
windowDays: 4
category: 'Protein'
```

#### Vendor Directory (`VENDOR_DIRECTORY`)

3 vendors rendered in Step 4:

| ID | Name | Composite | On-Time | Cold-Chain | Lane |
|---|---|---|---|---|---|
| fresh-farm | Fresh Farm Supply Co. | 96 | 98 | 94 | Local · Bay Area |
| green-valley | Green Valley Organics | 88 | 91 | 89 | CA · 1-day |
| metro-produce | Metro Produce Ltd. | 82 | 85 | 78 | Same-day in-city |

#### Step labels

```
1: Details  2: Items  3: Budget  4: Vendors  5: Delivery  6: Review  7: Done
```

#### Discovery content

Two filtered lists in the left panel (Steps 2+):

- `FEATURED_VIDEOS`: 8 seeded titles with `categories[]` tags. Step 1 shows first 3 unfiltered; Steps 2+ filter to current `activeCategoryTags`.
- `POPULAR_PRODUCTS`: 7 seeded SKUs with name/price/velocity and `categories[]`. Same filtering logic.

`activeCategoryTags`: derived from `productType` + item categories (protein/seafood/produce keywords parsed from item names).

#### Strategic History

Generated from `items[0]` (first line item): 3 prior PO records (PO-2855 Delivered, PO-2830 Delivered, PO-2802 Late by 6h). Shown in left panel Steps 3–6.

#### Express deep-link modes

Three `ExpressMode` values read from `window.location.hash` on mount:

| Hash pattern | `ExpressMode` | Behavior |
|---|---|---|
| `#intent=express&mode=blank` | `'blank'` | Auto-names with timestamp; jumps to Step 2 |
| `#intent=express&mode=reorder&from=…&vendor=…&items=…` | `'reorder'` | Pre-fills name/items from prior PO; jumps to Step 6 |
| `#restock=SKU_ID&items=…&vendor=…` | `'restock'` | Pre-fills from inventory SKU; sets urgency=urgent; jumps to Step 4 |

---

### 7.2 Left Panel

#### Step 1: ProductSidebar

Full `ProductSidebar` component renders unchanged — the founder's ad/discovery space. Contains featured vendor showcases, editorial content, and trending product cards. No wizard-aware filtering at this stage.

#### Step 2: Discovery panel

Header: Sparkles icon + "Discovery" + "Plan" badge + "Filtered to · [active categories]" subtitle.

Sections:
1. **Group Buy Alert** (appears when `groupBuyMatch` exists and productType is food-beverage): sage-tinted card showing pool ID, member count, estimated discount, "Surfaces in Step 4 (Labor)."
2. **Featured** section: Up to 3 category-filtered video cards. Each shows a colored thumbnail square + title + duration. Empty state if no content for category.
3. **Popular this week** section: Up to 4 category-filtered SKU rows. Each shows ShoppingCart icon + name + price + velocity. Empty state with "Pick a product category to see relevant SKUs."

#### Steps 3–6: Strategic History panel

Header: Clock icon + "Strategic History" + "Execute" badge + "Last 3 times you bought these items." subtitle.

Content: 3 PO cards for `items[0]` (first line item):
- PO ID + date (right)
- Vendor name
- Qty × unit price
- Status badge (Delivered = green, Late = amber)
- If `issue` is not null: amber AlertTriangle + issue text (e.g., "Late by 6h")
- Empty state if no items yet: "Add line items to see prior orders for these SKUs."

---

### 7.3 Center Panel

The center panel has a persistent **Sovereign Header** and a step-specific scrollable content area.

#### Sovereign Header (always visible)

- "Strategic Sourcing Portal" pill badge (sage, ShieldCheck icon)
- "Internal Directory" lock badge (amber, Lock icon)
- Title: "Authorize a new procurement" (Steps 1–6) or "PO Authorized · Routing to Orders" (Step 7)
- Subtitle: step-specific hint text
- `SourcingDAG`: 6-node horizontal stepper connecting Steps 1–6:
  - Done nodes: sage circle with CheckCircle — clickable to go back
  - Active node: amber circle with ring
  - Future nodes: gray circle with number
  - Connector line between nodes: sage (done) or gray (future)

**Express Mode banner** (if `expressMode` is `blank` or `reorder`, and step < 7):
- Blue tinted, ⚡ "Express Lane" chip
- "Carbon copy of [PO name] · jumped to Step 6 (Review)" or "Blank canvas · jumped to Step 2 (Items)"
- "← Restart from Step 1" link resets to fresh start

**Inventory deep-link banner** (if `inventoryContext` exists, and step < 7):
- Red tinted, Flame icon
- "Pre-filled from Inventory · [SKU_ID]"
- "[SKU name] fell below par · auto-set urgency to urgent · vendor [name] pre-selected"
- **"Dismiss" button**: clears `inventoryContext`. Also dispatches `buyamia-restock-intent-failed` CustomEvent with `{ skuId, skuName }` — Inventory page listens and shows an amber "Restock Intent Dismissed" banner on the affected SKU's restock DAG section.

**Step slide-in animation:** `wizard-slide-in` keyframe — `translateX(12px) → 0` at 280ms cubic-bezier spring.

#### Step 1: Request Details

Form card containing:
- **Request Name** (required text input)
- **Description** (optional textarea)
- **Procurement type** (RadioGroup: Products / Services (coming soon) / Products & Services (coming soon)) — sage border highlight on active
- **Product Category** (visible when Products selected): 2×2 grid RadioGroup: Food & Beverage / Equipment / Office Supplies / Other

Bottom blue info box: "After this step you'll add items, set a budget, choose vendors, and configure delivery — then your request goes live."

Navigation: "Save Draft" button (no-op) + "Continue" button (disabled until name + category filled).

#### Step 2: Items

**Intelligence banner** (top of step area): Atlas · Market Price Trends — "Across N line items, 30d median moves: 2 trending ↓ 4.2%, 1 trending ↑ 3.1%."

Form card containing:
- **Line Items table**: list of current items — each shows Package icon + name + category + qty + unit + line total + Trash2 delete button
- **Add Item row**: 3 inputs (name, qty, $price) + Plus button; Enter key submits
- Item count + est. total shown in card header

**AI Suggestions block** (below card): Sparkles icon + "Based on your last 3 orders, you typically also order Romaine Lettuce and Mixed Peppers." + "Add suggested items" link — adds 2 items, `toast.success("Added 2 AI-suggested items")`.

Navigation: "Back" + "Continue" (disabled if no items).

**Safety Buffer card** (right panel, only if `inventoryContext`): amber tinted — "I've added a 10kg safety buffer because your current shipment PO-2855 is delayed by 4 hours."

#### Step 3: Budget & Timeline

Form card containing:
- **Total Budget** (number input with $ prefix; hint shows est. total from items)
- **Budget Type** (RadioGroup: Fixed "Cannot exceed this amount" / Flexible "Allow up to 10% over budget")
- **Needed By** (date input)
- **Urgency** (3-option grid: Flexible "+2 days OK" / Standard "On date" / Urgent "ASAP")

Navigation: Back + Continue.

#### Step 4: Vendors & Labor

**Intelligence banner**: Atlas · Vendor Reliability — "Top-3 vendors scored against last 90 days... All from your vetted internal directory."

Form card sections:

**AI-Recommended Vendors**: 3 vendor buttons (checkboxes). Each shows:
- Checkbox (sage check when selected)
- Name + tag badge (Best Match / Eco-Certified / Fast Delivery)
- Description
- Composite score (sage) + savings % (muted)

**Autonomy Matrix · Labor Assignment**: section header with current level badge. 6 radio buttons (L0–L5). Each shows:
- Radio button
- Level code + description
- Agent badge (sage, Bot icon, "Agent #NN · Role") or "Human-led" (amber)
- Scope description beneath

**Governance Guardrail** (amber callout): even at L5, Stage 1 (PO Approval) and Stage 12 (Delivery Confirmation) require manual human authorization.

**Group Buy section**: Header + Atlas match handshake card (sage, if pool found and not yet joined) + Switch toggle. Toggling ON opens Group Buy Confirmation Modal. Toggling OFF is immediate (`toast.info("Left group buy pool · solo PO")`). When joined: green confirmation strip.

**Mission Brief · Kernel Workflow**: 2-column grid of `workflowTemplates`. Each shows name + icon + complexity + stage count. Clicking deploys/undeploys. When deployed: "Mission Brief deployed: [name] — N DAG stages · M agent classes briefed · Stage 1 triggers on authorization · avg [duration]" card.

Navigation: Back + Continue (disabled if no vendor selected).

#### Step 5: Delivery & Shipping

**Intelligence banner** (amber): Atlas · Logistics Risk Map — "2 active risks on this lane: monsoon advisory adding ~1d to Java seafood routes · port congestion at Tanjung Priok adding ~6h to inbound. Build a +1.5 day buffer."

Form card containing:
- **Delivery Address** (text input)
- **Delivery Contact** (text input, "Name — phone")
- **Preferred Delivery Window** (3-option grid: Morning 6am–12pm / Afternoon 12pm–5pm / Anytime)
- **Special Instructions** (textarea, access codes/loading dock details)
- **Set as Recurring Order** (Switch toggle) — when on: shows Weekly/Bi-weekly/Monthly frequency selector

Navigation: Back + "Review Request."

#### Step 6: Review & Confirm

5 summary cards (one per prior step):
- Request Details, Items (with est. total), Budget & Timeline, Vendors (with autonomy + group buy status), Delivery
- Each card has an "Edit" button (Edit2 icon) that jumps back to that step
- **Atlas Audit Summary** (right panel): 6-row checklist:
  - Items vetted: "N SKUs · all in directory" ✓
  - Vendor selection: "N vetted · [score]" ✓/✗
  - Labor assigned: agent or "Manual" ✓
  - Group Buy: pool ID + discount, or "Solo PO" ✓
  - Mission Brief: workflow name + stage count, or "No template deployed" ✓/—
  - HITL gates: "Stage 1 + Stage 12 require manual auth" ⚠ (amber)

Navigation: Back + **"Authorize & Deploy Agent"** (Zap icon, sage, full-width intent button).

On click: `handleSubmit()`:
1. `toast.success("PO-2026-0147 authorized · routed to Orders")` — description names agent and notes HITL gates
2. `setStep(7)`
3. After 1.4 seconds: `window.location.hash = 'order=PO-2026-0147'` + `onNavigate('orders')`

#### Step 7: Done (success state)

- Sage CheckCircle in sage circle
- "Request Submitted!" h2 + request name + `BUY-2026-0147` badge
- "What happens next" card: 3 numbered steps (Vendors notified, Review quotes, Order confirmed with delivery date/window)
- "View in Orders" button (sage, navigates to Orders + toast)
- "Start New Request" button (outline, resets all state back to Step 1)

---

### 7.4 Right Panel — Reactive Atlas Copilot

**Header:** Sparkles + "Atlas Copilot" + "Step N · [step name]" badge. Subtitle changes per step:
- Step 1: "Frame the strategic intent."
- Step 2: "Live market price validation."
- Step 3: "Budget against monthly category pulse."
- Step 4: `primaryVendor ? "Reliability for [name]" : "Vendor reliability + group buy."`
- Step 5: "Logistics risk on this lane."
- Step 6: "Final audit summary before deploy."
- Step 7: "Hand-off complete."

**Step-reactive intelligence cards** (top of scrollable right panel):

| Step | Card | Description |
|---|---|---|
| 1 | Strategic Intent | Sage card: "Describe *why* — not just *what*. The clearer your intent, the better I can recommend agents and pools downstream." |
| 2 | Market Price Trends | "Estimated total $X · 30d median puts you 3.2% under market." + Safety Buffer (amber, only when `inventoryContext`) |
| 3 | Spending Pulse | Budget progress bar: spent-so-far (sage) + this-request (amber or red if over). Over-budget triggers red tint + red label |
| 4 | Mission Brief Active (if deployed) | "N DAG stages mapped, M agent classes briefed. Stage 1 will trigger immediately on authorization." |
| 4 | Vendor Reliability | 3 metrics for `primaryVendor`: Composite / On-time / Cold-chain — each with progress bar |
| 4 | Group Buy card | Amber: "Pool DR-2864 available · est. −12%." → Green: "You're in Pool DR-2864. Volume locked for 4 days." |
| 5 | Logistics Risk Map | 3 risk items: 🌧️ Java Monsoon (+1d) amber · ⚠ Tanjung Priok Port congestion (+6h, +12h) red · ✓ Australia (all clear) green |
| 6 | Audit Summary | 6-row checklist (described above in Step 6 section) |

**Express validation message** (if `expressMode`, seeded as first Atlas message):
- `reorder`: "I've validated this re-order from [source]. Prices stable, vendor ([name]) reliability holding at 96, Agent #07 ready to deploy. Skip to authorization when you're ready."
- `restock`: "I've validated this restock. Critical SKU items locked, vendor pre-selected, urgency set to urgent. Pick your autonomy tier and deploy."
- `blank`: "Express lane open. Add line items below — I'll validate prices against the 30-day market median in real time."

**Atlas conversation transcript**: Message bubbles (user right/sage, Atlas left/gray). Shown whenever `atlasMessages.length > 0`.

**Always-on chat input** (pinned to bottom of right panel):
- Textarea + ChevronRight send button
- Placeholder: "Ask Atlas about [step name]…"
- Enter (no shift) submits
- Step-aware responses:
  - Step 1: "Frame the intent. The clearer the 'why', the better I can map agents downstream."
  - Step 2: "Live 30-day median for these items lands you ~3.2% under market."
  - Step 3: Budget utilization sentence
  - Step 4: Primary vendor composite score + lane
  - Step 5: "+1.5d buffer recommended for this lane (Java monsoon, Tanjung Priok congestion)."
  - Step 6: "Final audit looks clean. Stage 1 + Stage 12 still gated to your manual authorization."

---

### 7.5 Group Buy Confirmation Modal

Triggered by toggling the Group Buy switch to ON in Step 4.

**Structure:**
- Full-screen backdrop, click-outside dismisses
- Sage-accented modal (max-width 448px)
- Header: sage Users icon + "Confirm Volume Share" + "Join Pool DR-2864?" + "Sharing your volume is a commercial decision that affects your competitive posture. This is logged to the audit trail."

**Content:**
- Pool members list: 3 vetted directory members (ShieldCheck icon each)
- 2-column stat grid: "Estimated Savings −12%" (green) + "Binding Window 4 days" (amber, "can't withdraw mid-cycle")
- Warning callout (amber): "Pool members will see your participation by name & volume. Your competitive posture changes once you commit."

**Actions:**
- "Cancel · Stay Solo" — closes modal, leaves `groupBuying = false`
- "Confirm · Share Volume" — `confirmJoinPool()`: sets `groupBuying = true`, closes modal, `toast.success("Joined Pool DR-2864 — 3 operators · −12% est. unit cost · binding for 4-day window.")`

---

### 7.6 Draft Persistence

`sessionStorage.setItem('newRequestDraft', JSON.stringify({ step, name, items, ts }))` is written on every change when:
- `step >= 1 && step < 7`
- `requestName.trim().length > 0 || items.length > 0 || inventoryContext != null`

On Step 7 the entry is cleared. A `newRequestDraftChanged` CustomEvent is dispatched every time the draft changes — the top-bar pill in the app shell listens for this to show/hide a "Draft in progress" indicator.

---

### 7.7 Key State

| State variable | Type | Purpose |
|---|---|---|
| `step` | number 1–7 | Current wizard step |
| `requestName` | string | Step 1 input |
| `description` | string | Step 1 input |
| `procurementType` | string | `'products' \| 'services' \| 'both'` |
| `productType` | string | `'food-beverage' \| 'equipment' \| 'office-supplies' \| 'other'` |
| `items` | `LineItem[]` | Line items |
| `budget` | string | Dollar amount |
| `budgetType` | string | `'fixed' \| 'flexible'` |
| `neededBy` | string | Date string |
| `urgency` | string | `'flexible' \| 'standard' \| 'urgent'` |
| `selectedVendors` | `string[]` | Checked vendor IDs |
| `autonomy` | string | `'L0' \| 'L1' \| 'L2' \| 'L3'` |
| `groupBuying` | boolean | Whether pool has been joined |
| `groupBuyConfirmOpen` | boolean | Whether confirmation modal is open |
| `deployedWorkflow` | `string \| null` | ID of selected Mission Brief template |
| `deliveryAddress` | string | Step 5 |
| `deliveryWindow` | string | `'morning' \| 'afternoon' \| 'anytime'` |
| `specialInstructions` | string | Step 5 |
| `recurring` | boolean | Recurring order toggle |
| `expressMode` | `ExpressMode \| null` | `'blank' \| 'reorder' \| 'restock' \| null` |
| `expressContext` | `{ from?, vendor? } \| null` | Source PO and vendor for reorder mode |
| `inventoryContext` | object \| null | SKU prefill from inventory deep-link |
| `atlasInput` | string | Current chat draft |
| `atlasMessages` | message[] | Chat history for right panel |

---

### 7.8 Actions

| Action | Location | Effect |
|---|---|---|
| Type request name | Step 1 | Updates `requestName`; enables Continue button |
| Select procurement type | Step 1 | Sets `procurementType`; shows/hides category selector |
| Select product category | Step 1 | Sets `productType`; filters Discovery content from Step 2 onward |
| Click "Save Draft" | Step 1 | No-op (outline button placeholder) |
| Click "Continue" / step back | Any step | Increments/decrements `step`; triggers slide-in animation |
| Click done DAG node | SourcingDAG | Jumps back to that step |
| Add item (name + qty + price + Plus) | Step 2 | Appends to `items`; updates est. total |
| Press Enter in item name field | Step 2 | Same as clicking Plus |
| Click Trash2 on item | Step 2 | Removes from `items` |
| Click "Add suggested items" | Step 2 | Appends Romaine Lettuce + Mixed Peppers; `toast.success` |
| Set budget / budget type / urgency | Step 3 | Updates corresponding state |
| Toggle vendor card | Step 4 | Adds/removes from `selectedVendors`; updates right panel vendor reliability |
| Select autonomy tier | Step 4 | Sets `autonomy`; updates agent badge |
| Toggle Group Buy ON | Step 4 | Opens Group Buy Confirmation Modal |
| "Confirm · Share Volume" in modal | Modal | Sets `groupBuying = true`; `toast.success` |
| Toggle Group Buy OFF | Step 4 | `groupBuying = false`; `toast.info("Left group buy pool · solo PO")` |
| Click Mission Brief template | Step 4 | Deploys or undeploys that workflow; updates right panel |
| Set delivery address/contact/window/instructions | Step 5 | Updates delivery state |
| Toggle Recurring | Step 5 | Shows frequency selector |
| Click Edit button in review | Step 6 | Jumps back to that step |
| Click "Authorize & Deploy Agent" | Step 6 | `handleSubmit()` → toast + Step 7 + redirect to Orders after 1.4s |
| "View in Orders" | Step 7 | `onNavigate('orders')` + toast |
| "Start New Request" | Step 7 | Resets all form state; returns to Step 1 |
| Send Atlas message | Right panel | Appends user message + step-aware Atlas response after 600ms |
| Click "← Restart from Step 1" | Express Mode banner | Clears `expressMode`; returns to Step 1 |
| Click "Dismiss" | Inventory context banner | Clears `inventoryContext` |

---

### 7.9 Key Flows

#### Standard new-request flow (no deep-link)

1. Admin clicks "New Request" in nav — page loads at Step 1 with pre-filled demo values.
2. Admin updates name to "Q2 Protein Restock" and selects "Food & Beverage."
3. Clicks Continue → Step 2. Left panel switches to Discovery, filtered to food-beverage.
4. Admin reviews 3 pre-filled items. AI Suggestions box recommends Romaine + Peppers — admin clicks "Add suggested items."
5. Continues → Step 3. Right panel shows Spending Pulse: $500 consumes 4.2% of $12,000 monthly budget.
6. Sets budget to $480, Needed By 2026-05-20, urgency Standard. Continues.
7. Step 4: Left panel switches to Strategic History for Baby Spinach.
8. Admin selects Fresh Farm Supply (score 96) + checks the Group Buy toggle → modal opens.
9. Admin confirms pool join (DR-2864, −12%). Green confirmation strip appears.
10. Sets autonomy to L1 (Agent #07 Logistics). Deploys "Standard Procurement" Mission Brief.
11. Continues → Step 5. Right panel shows Logistics Risk Map with Java monsoon warning.
12. Confirms delivery address + morning window. Continues → Step 6 (Review).
13. Right panel shows Audit Summary: 5 items ✓, Fresh Farm ✓, Agent #07 ✓, Pool DR-2864 ✓, Mission Brief ✓, HITL gates ⚠.
14. Clicks "Authorize & Deploy Agent" → toast "PO-2026-0147 authorized · routed to Orders."
15. Step 7 shown. After 1.4s: navigates to Orders page with `#order=PO-2026-0147`.

#### Restock deep-link flow (from Inventory)

1. Admin clicks "Restock Now" on a Seafood SKU in Inventory — hash set to `#restock=SKU-SF-001&items=Salmon+Fillet+40kg&vendor=AUS+Meats+Pty`.
2. RequestPanel mounts, reads hash: `expressMode = 'restock'`, `inventoryContext` set.
3. Page jumps directly to Step 4. Request name auto-filled "Restock — Salmon Fillet." Items pre-loaded.
4. Red Flame banner: "Pre-filled from Inventory · SKU-SF-001 — Salmon Fillet fell below par · auto-set urgency to urgent · vendor AUS Meats Pty pre-selected."
5. Right panel Atlas message: "I've validated this restock. Critical SKU items locked, vendor pre-selected, urgency set to urgent. Pick your autonomy tier and deploy."
6. Admin selects L2 autonomy, confirms vendor, clicks Continue → Step 5 → Step 6.
7. Authorizes → PO routed to Orders.

#### Carbon-copy re-order flow (from Orders)

1. Admin clicks "Re-order This PO" on PO-2855 in Orders — hash set to `#intent=express&mode=reorder&from=PO-2855&vendor=AUS+Meats+Pty&items=Salmon+Fillet,Baby+Spinach`.
2. RequestPanel mounts: `expressMode = 'reorder'`, pre-fills name "Re-order of PO-2855" + items.
3. Page jumps to Step 6 (Review). Blue Express Lane banner: "Carbon copy of PO-2855 · jumped to Step 6 (Review). Discovery and intent steps skipped — Atlas pre-validated."
4. Right panel Atlas: "I've validated this re-order from PO-2855. Prices stable, vendor (AUS Meats Pty) reliability holding at 96, Agent #07 ready to deploy. Skip to authorization when you're ready."
5. Admin reviews Step 6 summary, clicks "Authorize & Deploy Agent."
6. Toast + redirect to Orders.

#### Blank canvas express flow (from Orders)

1. Admin clicks "+ New Order" in Orders → hash `#intent=express&mode=blank`.
2. Page jumps to Step 2 with auto-timestamped request name and Express Lane banner.
3. Atlas: "Express lane open. Add line items below — I'll validate prices against the 30-day market median in real time."
4. Admin adds items and proceeds normally from Step 2.

---

