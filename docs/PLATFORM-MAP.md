# Buyamia Platform Map — Product Designer Onboarding

> A complete walkthrough of every page in the platform: what it is, what states it can be in, what the user can do, what modals it opens, and where the user can go next.
>
> Read this before you touch any UI. The 14 pages here are everything that ships.

---

## Table of Contents

1. [Platform Topology](#1-platform-topology)
2. [Edge Taxonomy — How Pages Talk to Each Other](#2-edge-taxonomy--how-pages-talk-to-each-other)
3. [Hash-Context Contract](#3-hash-context-contract)
4. [Trail-Return Contract](#4-trail-return-contract)
5. [The Pages](#5-the-pages)
   - [5.1 Overview](#51-overview)
   - [5.2 Workflows & Kernel](#52-workflows--kernel)
   - [5.3 Inventory](#53-inventory)
   - [5.4 New Request](#54-new-request)
   - [5.5 Suppliers](#55-suppliers)
   - [5.6 Orders](#56-orders) *(cockpit)*
   - [5.7 Spending](#57-spending)
   - [5.8 AI Activity](#58-ai-activity)
   - [5.9 Governance](#59-governance)
   - [5.10 Nerve Center](#510-nerve-center)
   - [5.11 Global Operations](#511-global-operations)
   - [5.12 Intelligence](#512-intelligence)
   - [5.13 Infrastructure](#513-infrastructure)
6. [Cross-Page Navigation Index](#6-cross-page-navigation-index)

---

## 1. Platform Topology

The platform has **13 pages** grouped into two families:

- **Core pages** (7): Day-to-day operator surfaces — Overview, Inventory, New Request, Suppliers, Orders, Spending, AI Activity.
- **Agent pages** (6): Where the AI workforce is configured, audited, and monitored — Workflows & Kernel, Governance, Nerve Center, Global Operations, Intelligence, Infrastructure.

The center of gravity is **Orders** (the "cockpit"). Most flows either land in Orders or originate from it.

### Spatial layout of the canvas (how pages relate)

```
Row 0:                       [Overview]
                                 │
Row 1: [Workflows]──[Inventory]──[Request]──[Suppliers]
                         │           │           │
                         ╰───────────┼───────────╯
                                     ▼
Row 2:                          [ORDERS]  ← cockpit
                                     │
                         ╭───────────┼───────────╮
                         ▼           ▼           ▼
Row 3:               [Spending] [AI Activity] [Governance]

Row 4: [Nerve Center]──[Global Ops]──[Intelligence]──[Infrastructure]
```

- **Row 0**: top-of-funnel landing.
- **Row 1**: input surfaces (where requests are created, vendors are managed, stock is monitored, playbooks live).
- **Row 2**: the cockpit — every purchase order's lifecycle.
- **Row 3**: output surfaces (spend reporting, activity ledger, policy + disputes).
- **Row 4**: the engine room (workforce control, regional view, AI KPIs, infrastructure schematic).

---

## 2. Edge Taxonomy — How Pages Talk to Each Other

There are **three** ways pages connect. Every cross-page interaction is one of these.

| Kind | Color | Behavior |
|------|-------|----------|
| **nav** | sage | User clicks something that calls `onNavigate(page)` directly. The user moves. May carry hash context (e.g. `#order=PO-XXXX`). |
| **data** | blue | System silently pushes state into a target page's listener. **No route change.** The target absorbs the new state and surfaces it next time the user opens it. |
| **event** | amber | System fires the global `buyamia-navigate-page` CustomEvent. The app promotes the payload (decisionId / evtId / agentId / orderId) into the matching URL hash, then flips pages. |

> Designers: treat `data` edges with care. They are deferred notifications — the user might not see the effect for hours. Always pair a `data` push with a clear, dismissible surface on the receiving page.

---

## 3. Hash-Context Contract

Some pages deep-link with a URL hash. Receivers read the hash on mount **and** on `hashchange`.

| Hash | Receiver | Behavior |
|------|----------|----------|
| `#order=PO-XXXX` | Orders | Auto-selects the PO. |
| `#agent-NN` | Governance | Fires a toast; stores `incomingAgentId`. |
| `#decision=DEC-XXX` | Governance | Opens the Reasoning Chain panel, scroll-into-views the matching Decision Ledger row, flashes it sage. Unknown id → amber toast fallback. |
| `#evt=eventId` | AI Activity | Selects the event, scroll-flashes the card. Unknown id → amber toast fallback. |
| `#workflow=WF-XXX` | Workflows | Selects that template (WF-STD / WF-RSH / WF-BPO / WF-GRP / WF-EMR / WF-PRD / WF-MNT / WF-CPX). Unknown id → amber toast fallback. |
| `#restock=...` / `#intent=express&mode=...` | New Request | RequestPanel jumps to the relevant step pre-filled. |

> Every "unknown id" path falls back to an **amber toast** — never a silent failure. Always preserve this.

---

## 4. Trail-Return Contract

When the user opens the **Decision Attribution Trail** on an Order and clicks a cross-page chip (e.g. "Agent in Governance", "Decision · DEC-XXX", "AI Activity · evt-XXX", "🧭 Workflow · {name}"), the system:

1. Persists `{ orderId, stageIdx, savedAt }` to `sessionStorage` (key: `buyamia-trail-return`, 30-min TTL) **before** navigating.
2. The destination page reads the marker on mount and renders a fixed-position **TrailReturnPill** at top:64px: `"← Return to PO-XXXX · Stage N Trail"`.
3. Clicking the pill calls `onNavigate('orders')`. Orders reads the marker on mount, re-opens the Trail on the same order, expands the same stage, and clears the marker.

Pages that render the TrailReturnPill: **Governance**, **AI Activity**, **Workflows**.

> This is the platform's hallmark "spatial return" pattern. Preserve the feeling of "papers on a desk" — when the user follows a thread, they can always get back to where they were standing.

---

## 5. The Pages

### 5.1 Overview

- **Route**: `/overview`
- **Group**: Core
- **One-line**: Morning dashboard — analytics, logistics calendar, critical actions.

**Purpose**

Top-of-funnel dashboard. The center panel morphs between an Analytics view (metrics + spending trend), a Logistics Calendar (month / week / agenda), an Event Detail view when an event is clicked, and a PO Workspace when a critical action is selected.

**States**

| State | Description |
|-------|-------------|
| Analytics | 4 metric cards + Monthly Spending Trend chart with confidence band. |
| Calendar — Month | Month grid of logistics events. |
| Calendar — Week | Week view with event rows. |
| Calendar — Agenda | Agenda list of upcoming events. |
| Event Detail | 12-stage DAG + agent reasoning when an event is clicked. |
| PO Workspace | Critical-action detail when a PO item is selected. |

**Actions**

| Action | Description |
|--------|-------------|
| Performance | Toggle center to Analytics view. |
| Logistics Calendar | Toggle center to Calendar view. |
| Calendar view toggle | Switch Month / Week / Agenda. |
| Event card | Opens the Event Detail state in the center panel. |
| View Journey | Same as event click — opens event detail. |
| Clear Deadline | Approve / confirm action on an event. |
| Atlas (on event) | Opens an Atlas action on that event. |
| PO card | Opens the PO Workspace. |
| Quick Approve | Quick-approves a system alert. |
| Chat send | Sends a message in the Atlas chat. |

**Modals**: *(none)*

**Outgoing navigation**: *(none — Overview is a hub; the user navigates out via the global nav.)*

---

### 5.2 Workflows & Kernel

- **Route**: `/workflows`
- **Group**: Agents
- **One-line**: 8 playbooks + demand signals → DagFlowPath with inline tuning + simulation.

**Purpose**

Library of 8 purchase playbooks: **Standard, Rush, Blanket PO, Group Buy, Emergency, Production, Maintenance, Capex**.

- **Left panel**: WorkflowTemplateList with template cards and a Demand Signals feed.
- **Center**: Workflow Hero + Flow Path with per-stage Tune Logic.
- **Right panel**: Simulation Workspace when Simulate is engaged.

Reached from Orders via the Decision Attribution Trail's 🧭 Workflow chip (deep-links into the order's `workflowTemplate`).

**States**

| State | Description |
|-------|-------------|
| Flow Path (default) | Selected workflow rendered as a vertical stage list with agent chips + throughput. |
| Signal Trace | A selected demand signal lights up its path through the stages. |
| Tune Logic open | Inline per-stage tuner panel with slider + Apply / Apply & Lock / Cancel. |
| Hard-lock active | Amber banner when Stage 1 signal-sensitivity is hard-locked at ≥90%. |
| Simulation mode | Workflow Hero shows "Simulating" — right panel surfaces scenarios and Apply Fix. |
| Active Correlation Banner | Sage banner when 2+ high-strength signals (>70%) share a workflow. |
| Trail Return Pill | Fixed pill at top:64px shown when the page is reached from the Orders Decision Attribution Trail. Click → returns to Orders + re-opens the Trail at the same stage. |

**Actions**

| Action | Description |
|--------|-------------|
| Take a tour | Starts the driver.js onboarding tour. |
| Load a workflow | Selects a template card. |
| Trace a signal | Highlights the signal's path through the DAG. |
| Clear active signal | Resets the signal selection. |
| Tune Logic | Opens the inline tuner for a stage. |
| Apply / Apply & Lock | Applies a tuning; "& Lock" hard-locks Stage 1 sensitivity. |
| Release hard-lock | Clears the Stage 1 sensitivity hard-lock. |
| Simulate | Enters simulation mode. |
| Select scenario | Picks a simulation scenario in the right panel. |
| Apply Fix | Applies the recommended fix for a simulated bottleneck. |
| Exit Simulation | Leaves simulation mode. |
| Execute Workflow | Triggers the workflow. |
| Schedule Workflow | Schedules the workflow. |
| Clone Workflow | Clones the workflow. |
| Hash reader · `#workflow=WF-XXX` | On mount + hashchange, reads the workflow id. Real id → selects that template. Unknown id → amber toast. Hash cleared after read. |
| Click TrailReturnPill | Navigates back to Orders. The Trail re-opens on the same order with the same stage expanded. |

**Modals**: *(none)*

**Outgoing navigation**

- **→ Orders** (via TrailReturnPill, when arriving from an Order's Trail)

---

### 5.3 Inventory

- **Route**: `/inventory`
- **Group**: Core
- **One-line**: Stock heartbeat + SKU workspace + audit mode + catalog.

**Purpose**

Two-mode workspace. Default center shows a Velocity Map. When a SKU is selected the center renders the Item Journey (with PAR watch, restock decision tree, pipeline visibility). Audit Mode expands this with a heartbeat group view and failure-intent surface. Catalog management lives behind a modal.

**States**

| State | Description |
|-------|-------------|
| Velocity Map (default) | No SKU selected — consumption forecast vs actual, burn-rate bars. |
| SKU Selected | Item Journey, PAR watch, restock decision tree. |
| SKU + Audit Mode | Expanded audit view with heartbeat groups + failure intents. |
| Hardened Banner | Floating "System Hardened — new safety threshold locked" banner after Set as Par Floor (3.2s auto-dismiss). |
| Restock Intent Dismissed | Amber alert on the selected SKU when RequestPanel dispatches `buyamia-restock-intent-failed` (user dismissed an inventory-prefilled restock). |

**Actions**

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Burn-rate bar | Selects a SKU. | — |
| Restock Now | Triggers restock for the selected SKU. | — |
| Adjust | Opens the Adjust Stock modal. | — |
| Add to Draft | Adds the SKU to a draft PO. | — |
| Remove from Draft | Removes the SKU from the current draft. | — |
| Pipeline menu | Toggles the pipeline action menu. | — |
| AI / Manual mode toggle | Switches labor mode for the item. | — |
| Resume Agent | Sets labor mode back to agent. | — |
| Open Stage Trace | Opens the Stage Trace modal. | — |
| Full Journey | Exits Audit Mode and loads the full SKU workspace in the center panel (no cross-page nav). | — |
| Open PO in Orders | Deep-links the linked PO into Orders via `#order=PO-XXXX`. | **Orders** |
| Dismiss Failed Intent | Clears a failed-intent banner. | — |
| Back to map | Clears SKU selection. | — |
| Catalog Add Row | Opens Catalog management modal. | — |
| Catalog row edit/archive | Inline catalog mutations. | — |
| Open Governance (per-agent) | Jumps to Governance for the assigned agent. | **Governance** |
| New Request | Starts a new procurement request. | **New Request** |

**Modals**

| Modal | Description |
|-------|-------------|
| Adjust Stock | Manual count form with +/-, note, validation. |
| Stage Trace | Read-only 12-stage journey history for the SKU. |
| Catalog Management | Add / edit / archive SKU records. |
| ⌘K Command Palette | Search / select items. |

**Outgoing navigation**

- **→ Orders** (Open PO; sets `#order=PO-XXXX`)
- **→ New Request** (Restock Now; sets `#restock=SKU&items=...&vendor=...`, jumps to Step 4, sets urgency=urgent)
- **→ Governance** (per-SKU agent link; sets `#agent-NN`)

---

### 5.4 New Request

- **Route**: `/request`
- **Group**: Core
- **One-line**: 7-step wizard: Details → Items → Budget → Vendors → Delivery → Review → Done.

**Purpose**

Sourcing wizard. The center panel morphs entirely through 7 steps. On the Review step, "Authorize a new procurement" submits and routes the user to Orders. If a Group Buy pool matches, a confirmation modal appears.

**States**

| State | Description |
|-------|-------------|
| Step 1 — Details | Intent / context for the request. |
| Step 2 — Items | Add line items with categories. |
| Step 3 — Budget | Budget framing for the request. |
| Step 4 — Vendors | Pick vendors from the internal directory. |
| Step 5 — Delivery | Logistics + delivery preferences. |
| Step 6 — Review | Pre-submit summary; Authorize button lands here. |
| Step 7 — Done | Confirmation; PO lands in Orders. |

**Actions**

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Step indicator | Backward step navigation. | — |
| Next | Advance to the next step. | — |
| Back | Return to the previous step. | — |
| Add item | Adds a line item. | — |
| Remove item | Removes a line item. | — |
| Suggested category tag | Filters by category. | — |
| Vendor checkbox | Toggle vendor selection. | — |
| Join Pool | Opens the Group Buy Confirmation modal. | — |
| Authorize a new procurement | Submits the request and routes to Orders. | **Orders** |
| Atlas send | Sends a message in the Atlas chat. | — |

**Modals**

| Modal | Description |
|-------|-------------|
| Group Buy Confirmation | Pool details + Cancel / Confirm. |

**Outgoing navigation**

- **→ Orders** (Authorize; sets `#order=PO-XXXX` after a 1.4s celebratory delay on Step 7)
- **→ Inventory** *(data edge)* — Dismissing the inventory-prefilled restock banner dispatches `buyamia-restock-intent-failed`. Inventory shows an amber alert on the affected SKU next time the user visits.

---

### 5.5 Suppliers

- **Route**: `/suppliers`
- **Group**: Core
- **One-line**: Ecosystem hub, relationship workspace, side-by-side comparison.

**Purpose**

Vendor relationship center. Center morphs from Ecosystem Hub (default — KPIs, performance matrix, distribution charts) to a Relationship Workspace when one supplier is selected, to a Comparison Matrix when comparison mode is active. A 12-stage Journey Task Module opens for per-relationship stage edits in manual mode.

**States**

| State | Description |
|-------|-------------|
| Ecosystem Hub | 4 KPI cards + performance matrix + category bar chart + status distribution. |
| Relationship Workspace | One supplier selected — dossier, journey track, metrics radar, negotiation status. |
| Comparison Matrix | Dual-supplier matrix overlay when comparison is active. |
| QC Failure Alerts | Dismissible alerts at the top of the center panel when QC failures fire from Orders. |

**Actions**

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Category bar | Filters by category. | — |
| Onboard New Vendor (Fortress banner) | Routes to New Request as the Manual Discovery Portal — humans are the sole gateway for new vendor data. | **New Request** |
| Full Workspace | Expands the relationship workspace. | — |
| Open Governance | Jumps to Governance for the relationship's agent. | **Governance** |
| Labor mode toggle (Agent / Manual) | Switches labor mode for the relationship. | — |
| Renegotiate Terms | Executes a renegotiation flow. | — |
| Trigger Compare | Activates comparison mode. | — |
| Back to Ecosystem | Clears supplier selection. | — |
| Dossier toggle | Opens / closes the dossier panel. | — |
| Metric filter buttons | Toggles radar-metric filters. | — |
| Bulk Compare | Multi-select comparison. | — |
| Broadcast | Opens the Broadcast Drawer. | — |
| Export | Exports selected suppliers. | — |
| Clear Selection | Clears audit checkboxes. | — |
| Kebab → View Journey / Compare / Broadcast / Download Dossier | Per-supplier kebab menu. | — |
| Journey stage node (manual) | Opens the Journey Stage Task Module. | — |
| Resume Agent | Returns relationship to agent mode. | — |
| Messaging channel toggle (WhatsApp / Telegram) | Switches messaging channel. | — |
| Send message | Sends a 1-on-1 message via the Messaging Drawer. | — |
| Send broadcast | Sends a multi-vendor announcement. | — |
| New Request (from vendor) | Starts a new procurement request with this vendor. | **New Request** |

**Modals**

| Modal | Description |
|-------|-------------|
| Journey Stage Task Module | Schema-driven inputs for a per-relationship stage. |
| Messaging Drawer | Secure 1-on-1 channel (WhatsApp / Telegram). |
| Broadcast Drawer | Multi-vendor announcement composer. |

**Outgoing navigation**

- **→ Governance** (Open Governance; sets `#agent-NN`)
- **→ New Request** (Onboard New Vendor; New Request from vendor)

---

### 5.6 Orders

- **Route**: `/orders`
- **Group**: Core
- **One-line**: The cockpit. Order lists, single-order journey, batch console, Audit Mode ledger.

**Purpose**

Cockpit for every PO. The most morphologically complex page in the platform.

- **Left panel**: Groups orders by status (Triage Mode) or expands to a historical ledger (Audit Mode).
- **Center panel**: Morphs through Default (scheduled / autonomous list), Single Order Journey (with 12-stage DAG), Batch Console (multi-select), and post-execute splashes — and **collapses to 0 width** while Audit Mode is active.
- **Right panel**: Hosts Atlas chat, the Source Bridge takeover, or — in Audit Mode — Operations Insights / Quick Journey.

**States**

| State | Description |
|-------|-------------|
| Default | Scheduled + autonomous orders list. |
| Single Order Journey | Two-column: detail card (with primary CTA + tertiary row) + 12-stage DAG. |
| Batch Selected | Batch Console — approve / confirm / resolve counts across selected orders. |
| Journey Complete | Single-order success splash with cost / labor savings. |
| Batch Complete | Batch finalization splash. |
| Audit Mode | Left panel expands to full width and surfaces the combined ledger of all 7 live + 40 historical orders. Center collapses. Right panel swaps to Operations Insights (no row selected) or Quick Journey (row selected). 380ms cubic-bezier spring transition. Escape collapses back when no row is selected. |
| Decision Attribution Trail | Full-screen modal sheet listing all 12 stages with agent attribution, decision summary, confidence, data used, alternatives rejected, outcome, and any human override. Cross-page chips deep-link to Governance and AI Activity — each chip drops a `buyamia-trail-return` marker. **Entry points**: Decision Trail button on the Single Order Journey header · Decision Trail button in the Audit Mode Quick Journey panel · direct click on a historical row in Audit Mode (historical orders have no live journey). |

**Actions**

General journey + chat:

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Clear selection | Clears the multi-select set. | — |
| ⌘K trigger | Opens the Command Palette. | — |
| Track Shipment (⋯ menu) | Stage-gated; sets selection state — no live tracking integration yet. | — |
| Message Supplier (⋯ menu) | Opens the Source Bridge in the right panel. | — |
| Repeat Order (⋯ menu) | Stage-gated; opens the Draft Sheet pre-filled. | — |
| Re-order | Carbon-copies a delivered order into New Request. | **New Request** |
| Resume Agent | Returns the order from Manual Takeover to agent mode. | — |
| Back to orders | Clears single-order selection. | — |
| Advance Stage | Advances the 12-stage DAG. | — |
| Execute Batch | Runs the action across all selected orders. | — |
| Stage module — Save Draft | Saves manual-mode stage entries. | — |
| Stage module — Save & Mark Complete | Saves and closes the stage module. | — |
| Draft Sheet — Submit | Creates a new order from the draft. | — |
| Chat send | Sends a message in the Atlas chat. | — |
| Managed by · Agent #XX | Tertiary link — jumps to that agent's Governance profile. | **Governance** |

Audit Mode:

| Action | Description |
|--------|-------------|
| Expand to Audit Mode | Maximize2 button in the left-panel header — expands the left panel to full width, collapses the center, swaps the right panel to Operations Insights. |
| Collapse Audit Mode | Minimize2 button (or Escape with no row selected) — returns to Triage Mode. |
| Audit search | Search PO id / supplier / item / agent across all live + historical orders. Auto-focuses on entering Audit Mode. |
| Status filter chip | All · Live · Completed · Disputed · Cancelled · On Hold — each shows a live count. |
| Date range preset | 7 days · 30 days · 90 days · All time. |
| Supplier filter | Dropdown of every supplier in the ledger. |
| Stage band filter | Any stage · Procurement (0–3) · Processing (4–7) · Logistics (8–11). |
| Agent filter | Dropdown of every assigned agent. |
| Clear filters | Resets all audit filters and search at once. |
| Audit Select All | Checkbox — selects/clears all currently filtered rows. |
| Audit view toggle | Switches between Table and Grid layouts. |
| Export CSV | Downloads `orders-audit-YYYY-MM-DD.csv`. Acts on current selection if any, otherwise full filtered set. |
| Open audit row · live | Collapses Audit Mode and loads the Single Order Journey. |
| Open audit row · historical | Keeps Audit Mode; surfaces a compact Quick Journey card in the right panel. |
| Top-supplier card · filter | Clicking a supplier in Operations Insights sets the supplier filter. |
| Open Full Workspace (Quick Journey) | Snaps out of Audit Mode and loads the selected order's full journey. |

Decision Attribution Trail:

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Decision Trail (Journey header) | Opens the Trail for the currently-selected live order. | — |
| Decision Trail (Quick Journey) | Same sheet, opened from the Audit Mode right panel. | — |
| Decision Trail (historical row) | Clicking a historical row opens the Trail directly. | — |
| Expand stage card | Click any stage header to reveal data points, alternatives rejected, override, and deep-link chips. | — |
| Agents Involved chip | Top-of-Trail chip per agent. Sets marker + navigates to Governance with `#agent-NN`. | **Governance** |
| Decision · DEC-XXX chip | Per-stage chip. Sets marker + navigates to Governance with `#decision=DEC-XXX` (pool DEC-001..DEC-008). | **Governance** |
| AI Activity · evt-XXX chip | Per-stage chip. Sets marker + navigates to AI Activity with `#evt=evt-XXX` (pool evt-001..evt-012). | **AI Activity** |
| Agent in Governance chip | Per-stage chip — same destination as Agents Involved but scoped to the stage's acting agent. | **Governance** |
| TrailReturnPill (on destination) | The floating pill that appears on Governance / AI Activity / Workflows. Click → back to Orders + re-opens the Trail at the same stage. | — |
| Trail · Workflow chip | Header chip "🧭 Workflow · {name}". Drops marker → Workflows with `#workflow=WF-XXX`. | **Workflows** |
| Audit Workflow filter | Dropdown in the Audit Mode secondary filter row. Scopes the ledger to a single template id. | — |
| Audit Workflow column | New column in Audit Mode — blue pill per row with the template name. | — |

**Modals**

| Modal | Description |
|-------|-------------|
| Task Module Sheet | 12-stage interactive sheet — Review or Execute mode. |
| Draft Sheet | New / re-order draft form (recurring, frequency, labor assignment). |
| ⌘K Command Palette | Fuzzy search across orders. |
| Source Bridge | Right-panel takeover — WhatsApp / Telegram supplier composer. |
| Decision Attribution Trail | Full-screen sheet — agents involved + 12 stage cards with agent attribution, decision, confidence, data points, alternatives rejected, outcome, override callout, and cross-page deep-link chips. |

**Outgoing navigation**

- **→ Governance** (Managed by · Agent link; Agents Involved chip; Decision chip)
- **→ AI Activity** (Trail · AI Activity chip; sets `#evt=evt-XXX`)
- **→ Workflows** (Trail · Workflow chip; sets `#workflow=WF-XXX`)
- **→ New Request** (Re-order; sets `#intent=express&mode=reorder&from=...&vendor=...&items=...`, jumps to Step 6 pre-filled)
- **→ Suppliers** *(data edge)* — Stage 5 (Quality Check) outcome=fail dispatches `buyamia-qc-failure`. Suppliers pushes an amber alert card into its alert state. No navigation.

---

### 5.7 Spending

- **Route**: `/spending`
- **Group**: Core
- **One-line**: Category grid → category detail ledger. Budget setup modal.

**Purpose**

Default center is a 7-category grid. Selecting a category morphs to a category-detail view with a time-range filter (1M / 3M / 6M / 1Y), a ledger, and a "Lock Savings" action. Budget Setup modal walks first-time setup.

**States**

| State | Description |
|-------|-------------|
| Categories Grid (default) | 7 category cards (Protein, Seafood, Produce, Dry Goods, Dairy, Beverages, Other), each with semantic color. |
| Category Detail | Filtered ledger + time-range controls + Lock Savings. |

**Actions**

| Action | Description |
|--------|-------------|
| Category card | Opens Category Detail. |
| Back to all | Returns to the grid. |
| Time range (1M / 3M / 6M / 1Y) | Filter the ledger. |
| Lock Savings | Accumulates locked savings value. |
| Budget Setup | Opens the Budget modal. |
| Atlas prompt suggestion | Pre-fills the chat with a question. |
| Atlas chat send | Sends a message. |

**Modals**

| Modal | Description |
|-------|-------------|
| Category Budgets | Per-category budget inputs (6 fields) — Cancel / Save. |

**Outgoing navigation**: *(none)*

---

### 5.8 AI Activity

- **Route**: `/ai-activity`
- **Group**: Core
- **One-line**: Unified activity feed. Capital efficiency, undo window, rollback modal.

**Purpose**

The receipts page. A single unified Activity Feed (no center morphing — the right panel changes on event selection). Capital Efficiency cards, the Undo Window Policy section (3 modes), and a Learning Phase banner when calibration is active. Rollback opens an intervene modal.

**States**

| State | Description |
|-------|-------------|
| Activity Feed | Unified center — event timeline + always-visible KPI cards + undo policy. |
| Learning Phase | Banner shown when isWarmingUp (events < 25). |

**Actions**

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Confidence filter | Filter the feed by confidence band. | — |
| Event type filter | Filter by event type. | — |
| Clear filters | Resets confidence / type filters. | — |
| Adjust autonomy per category | +/- the per-category autonomy. | — |
| Approve Today's Ledger | Locks the day's ledger. | — |
| Undo mode (Hard 60-min / Ledger-close / Per-class) | Switches the global undo policy. | — |
| Event card | Selects the event — right panel updates. | — |
| Agent Governance | Opens the agent's Governance profile. | **Governance** |
| View Source | Jumps to the originating page (orders / suppliers / governance / inventory) depending on event type. | varies |
| Explain Logic | Focuses the right panel on the event. | — |
| Rollback | Opens the Rollback & Intervene modal. | — |
| Suspend / Resume Agent | Toggles agent suspension. | — |
| Edit data point | Inline edit on an event data point. | — |
| Save / Cancel edit | Commit or discard the inline edit. | — |

**Modals**

| Modal | Description |
|-------|-------------|
| Rollback & Intervene | Choose "Fix & Re-run" or "Manual Takeover" for an event. |

**Outgoing navigation**

- **→ Orders** (View Source on auto-order / group-buy events; sets `#evt=eventId`)
- **→ Suppliers** (View Source on sourcing / rejection events)
- **→ Governance** (Agent Governance / Agent ID button; sets `#agent-NN`)
- **→ Inventory** (View Source on forecast events)

---

### 5.9 Governance

- **Route**: `/governance`
- **Group**: Agents
- **One-line**: Control planes, decision ledger, disputes, policy creator.

**Purpose**

The HR + policy office for the agent workforce. Center surfaces a Control Plane Detail, a Reasoning Chain Panel (when a decision is opened), the Decision Ledger, and the Dispute Panel. Policy Creator modal authors system-wide rules. The Dispute Panel can route the user back to Orders ("Resume Order").

**States**

| State | Description |
|-------|-------------|
| Decision Ledger | Reverse-chronological list of decisions; rows open Reasoning Chain. |
| Control Plane Detail | 4 control planes (CP-POL / CP-ECO / CP-TRU / CP-SIM) with stats + governing agents. |
| Empty Rules (first-run) | Dashed-border card when ruleCount === 0 — "Add First Rule" CTA. |
| Reasoning Chain Panel | Inline panel — step-by-step trace for one decision. |
| Open Dispute | Dispute card with Approve / Reject / Escalate buttons. |
| Post-Approval Harden | Sage callout offering "Harden Policy — Set as Precedent" + "Resume Order". |
| Precedent Set | "Precedent Set — policy hardened" confirmation bar. |

**Actions**

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Take a tour | Starts the driver.js onboarding tour. | — |
| Control plane select | Opens the Control Plane Detail in center. | — |
| Add Rule / Add First Rule | Opens the Policy Creator modal. | — |
| Policy template select | Picks Spend Cap / Vendor Trust Floor / Fraud Hold / Delivery SLA. | — |
| Create Rule | Closes the Policy Creator (UI-only — no backend wire yet). | — |
| Loss category filter chips | LC-FRD / LC-WST / LC-ERR / LC-DLY / LC-NCO filter the ledger. | — |
| Decision ledger row | Click underlined agent name → opens Reasoning Chain Panel. | — |
| Override decision | Override button in the Action column. | — |
| External link icon | Navigates to AI Activity scoped to that decision. | **AI Activity** |
| Approve / Reject / Escalate dispute | Three buttons on an open dispute card. | — |
| Harden Policy — Set as Precedent | Locks the override in as a standing policy rule. | — |
| Resume Order (Dispute Panel) | Routes back to Orders for the disputed order. | **Orders** |

**Modals**

| Modal | Description |
|-------|-------------|
| Policy Creator | Template picker + rule config form. |

**Outgoing navigation**

- **→ Orders** (Resume Order; direct `onNavigate("orders")` — no hash)
- **→ AI Activity** *(event edge)* — Decision Ledger row external-link icon dispatches `buyamia-navigate-page` with `{ page: "ai-activity", decisionId }`. App.tsx promotes payload to `#decision=DEC-XXX` before flipping pages.

---

### 5.10 Nerve Center

- **Route**: `/nerve-center`
- **Group**: Agents
- **One-line**: Control room: 40 agents, 12-stage DAG, stress gauges, autonomy ceiling.

**Purpose**

Real-time control room for the entire AI workforce.

- **Left panel**: AgentGrid with 5 cohorts (SEN, REA, EXE, GOV, MET) and a System Status Bar (HEALTH + STRESS gauges).
- **Center**: 12-stage Logic DAG with bottleneck highlighting, Active Thinking Panel, Live Metrics, and the global L0–L5 autonomy slider.
- **Right panel**: AgentClassSheet when a class is selected.

**States**

| State | Description |
|-------|-------------|
| DAG Default | 12-stage DAG with sage pulse + Live Metrics + Autonomy Cap. |
| Class Filtered | A cohort is selected — non-relevant stages ghost; class-specific metrics show. |
| Active Thinking Panel | Opens beneath a clicked stage — description, signal chips, INTERVENTIONS row. |
| Soft Stress | Amber banner when stress > 85% and anomalies ≤ 300 — dismissible Cool Down offer. |
| Urgent Stress | Red banner when stress > 85% AND anomalies > 300 — non-dismissible. |
| User Constrained | SEN-001/002/003 cards show "User Constrained · Signal Sensitivity X%" when hard-locked. |

**Actions**

| Action | Description |
|--------|-------------|
| Take a tour | Starts the driver.js onboarding tour. |
| Filter cohort | Click cohort name to filter all panels. |
| Expand / collapse cohort | Chevron toggle on a cohort row. |
| Open Agent Class Sheet | Click a cohort filter to take over the right panel. |
| Inspect stage | Click a DAG node → opens the Active Thinking Panel. |
| Force Approval | Bottleneck intervention — overrides current block. |
| Scale Workforce | Spin up more agents at a bottleneck. |
| Cool Down Stage | Pause a single stage. |
| Pre-emptive Cool Down | Cool the whole system from the soft banner. |
| Emergency Cool Down | Forced system-wide cooldown via the urgent banner. |
| Dismiss soft banner | Closes the amber stress banner. |
| Set global autonomy | Click any L0–L5 segment on the master slider. |

**Modals**

| Modal | Description |
|-------|-------------|
| Agent Class Sheet | Right-panel takeover showing detailed class information. |

**Outgoing navigation**: *(none — Nerve Center is a control surface, not a routing hub.)*

---

### 5.11 Global Operations

- **Route**: `/global-ops`
- **Group**: Agents
- **One-line**: Regional drill-down with country / industry view toggle.

**Purpose**

Single RegionalDrillDown rendering driven by a viewMode toggle (country vs industry) in the left CountryIndustryList.

**States**

| State | Description |
|-------|-------------|
| Regional Drill-down | Single center rendering — viewMode toggles between country and industry. |

**Actions**

| Action | Description |
|--------|-------------|
| View toggle (country / industry) | Switches the regional view. |
| Select id | Selects a country or industry to focus. |

**Modals**: *(none)*

**Outgoing navigation**: *(none)*

---

### 5.12 Intelligence

- **Route**: `/intelligence`
- **Group**: Agents
- **One-line**: 8 AI-performance KPIs with full audit trails + supplier promise tracker.

**Purpose**

AI procurement performance dashboard. 8 metric cards (TM-01 → TM-08, Autonomous Spend %, Auto-Execution Rate, Manual Touches, Labor Hours, Stockouts, Realized Savings, Working Capital, Exception Trend). Clicking a card opens the Metric Audit Trail panel (which agent moved which number). TM-08 has an inline Sensitivity Slider. Supplier Promise Engine table with Stop/Resume Auto-Orders. Logistics History Panel shows the 12-stage order journey for a supplier when their delivery/quality score is clicked.

**States**

| State | Description |
|-------|-------------|
| Metric Grid (default) | 8 metric cards + sparklines + TM-08 sensitivity slider. |
| Metric Audit Trail | Inline panel — 4 agent entries showing what drove the metric. |
| Supplier Promise Engine | Always-visible table with delivery/quality scores + Stop/Resume. |
| Logistics History | Inline panel — 12-stage order journey for a selected supplier. |

**Actions**

| Action | Description |
|--------|-------------|
| Take a tour | Starts the onboarding tour. |
| Open metric audit | Click a metric card → opens the audit trail panel. |
| Close audit / logistics | Closes the inline panel. |
| Sensitivity slider | TM-08 — drag between "Catch Everything" and "Only Major Issues". |
| Open supplier journey | Click a delivery/quality score → opens Logistics History. |
| Stop Auto-Orders | Pauses AI auto-ordering from a supplier (e.g. GreenHarvest). |
| Resume Auto-Orders | Re-enables AI auto-ordering. |
| Investigate (right panel) | Right-panel CTA → opens GreenHarvest logistics history in center. |
| Authorize Pivot (right panel) | Right-panel CTA → pauses GreenHarvest auto-orders system-wide. |

**Modals**: *(none)*

**Outgoing navigation**: *(none)*

---

### 5.13 Infrastructure

- **Route**: `/infrastructure`
- **Group**: Agents
- **One-line**: DAG kernel schematic, deployment queue, audit log, rail connector.

**Purpose**

Four sections: DAG Kernel Schematic (5 nodes), Deployment Queue (5 build phases with auth state), Tamper-Proof Audit Log, and a conditional Lockdown Banner. Payment Rail Connector modal selects which payment rails route which spend.

**States**

| State | Description |
|-------|-------------|
| DAG Kernel Schematic | 5-node schematic with action levers. |
| Deployment Queue | 5 build-phase timeline (complete / active / needs-auth / authorized / locked). |
| Tamper-Proof Audit Log | Stats + seal status + actions. |
| Lockdown Banner | Conditional banner when tamper is simulated. |

**Actions**

| Action | Description |
|--------|-------------|
| DAG node click | Toggles the node action panel. |
| Overclock / Rebalance / Scale / Audit | Per-node intervention buttons. |
| Start Build Phase N | Authorizes the next deployment phase. |
| Simulate Tamper | Triggers the lockdown state. |
| Connect / Manage Payment Rails | Opens the Rail Connector modal. |

**Modals**

| Modal | Description |
|-------|-------------|
| Payment Rail Connector | Multi-select payment-rail provider list. |

**Outgoing navigation**: *(none)*

---

## 6. Cross-Page Navigation Index

All 14 edges in the system. Read this as "from → to: when and how."

### Outbound from Orders (the cockpit)

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Governance | `or-go` | nav | (1) Tertiary "Managed by · Agent #XX →" on order journey header. (2) Decision Attribution Trail "Agent in Governance" and "Decision · DEC-XXX" chips. Sets `#agent-NN` or `#decision=DEC-XXX` (pool DEC-001..DEC-008). Trail chips also drop the trail-return marker. |
| AI Activity | `or-ai` | nav | Decision Attribution Trail "AI Activity · evt-XXX" chip. Sets `#evt=evt-XXX` (pool evt-001..evt-012). Drops trail-return marker. |
| Workflows | `or-wf` | nav | Decision Attribution Trail header "🧭 Workflow · {name}" chip. Sets `#workflow=WF-XXX`. Drops trail-return marker. |
| New Request | `or-rq` | nav | Re-order button on a delivered PO. Sets `#intent=express&mode=reorder&...` — RequestPanel jumps to Step 6 pre-filled. |
| Suppliers | `or-su` | **data** | Stage 5 (Quality Check) outcome=fail dispatches `buyamia-qc-failure`. Suppliers pushes an amber alert card. **No navigation.** |

### Outbound from Inventory

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Orders | `in-or` | nav | "Open [PO-XXXX] in Orders" buttons (stream switcher, Stage Trace modal). Sets `#order=PO-XXXX`. |
| New Request | `in-rq` | nav | Restock Now / Quick Restock action. Sets `#restock=SKU&items=...&vendor=...` — RequestPanel jumps to Step 4, urgency=urgent. |
| Governance | `in-go` | nav | Per-SKU Governance link routes to that SKU's assigned agent. Sets `#agent-NN`. |

### Outbound from Suppliers

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Governance | `su-go` | nav | Peek-sheet "Managed by Agent #XX · Role" link and audit-mode kebab navigations. Sets `#agent-NN`. |
| New Request | `su-rq` | nav | Fortress banner "Onboard New Vendor" — routes as the Manual Discovery Portal (humans are the sole gateway for new vendor data). |

### Outbound from New Request

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Orders | `rq-or` | nav | Step 6 "Authorize & Deploy Agent". Toasts the new PO, advances to Step 7, then after a 1.4s celebratory delay sets `#order=PO-XXXX`. |
| Inventory | `rq-in` | **data** | Dismissing the inventory-prefilled banner dispatches `buyamia-restock-intent-failed`. Inventory shows an amber banner on the affected SKU. **No navigation.** |

### Outbound from AI Activity

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Orders | `ai-or` | nav | "View Source" on auto-order / group-buy events. Sets `#evt=eventId`. |
| Suppliers | `ai-su` | nav | "View Source" on sourcing / rejection events. |
| Governance | `ai-go` | nav | "Open in Governance" / agent ID button. Sets `#agent-NN`. |
| Inventory | `ai-in` | nav | "View Source" on forecast events. |

### Outbound from Governance

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Orders | `go-or` | nav | DisputePanel "Resume Order → PO-XXXX" button. Direct `onNavigate("orders")` — no hash. |
| AI Activity | `go-ai` | **event** | Decision Ledger row external-link icon dispatches `buyamia-navigate-page` with `{ page: "ai-activity", decisionId }`. App.tsx promotes payload to `#decision=DEC-XXX` before flipping pages. |

---

## Appendix — Glossary

- **DAG**: Directed Acyclic Graph. The 12-stage purchase journey every order flows through.
- **Atlas**: The platform's AI chat assistant, surfaced on multiple pages.
- **PO**: Purchase Order. Format: `PO-XXXX`.
- **SKU**: Stock-keeping unit. The atomic unit in Inventory.
- **DEC-XXX**: Governance decision id. Real seeded pool: DEC-001..DEC-008.
- **evt-XXX**: AI Activity event id. Real seeded pool: evt-001..evt-012.
- **WF-XXX**: Workflow template id. Eight ids: WF-STD / WF-RSH / WF-BPO / WF-GRP / WF-EMR / WF-PRD / WF-MNT / WF-CPX.
- **Audit Mode**: A panel-expansion pattern used on Orders, Inventory, and Suppliers where the left panel takes over and the center collapses.
- **Trail-Return Pill**: The floating "← Return to PO-XXXX · Stage N Trail" pill that appears when the user navigated from an Order's Decision Attribution Trail.
- **Hash-reader**: The pattern where a destination page reads `window.location.hash` on mount + `hashchange` to deep-link state.
