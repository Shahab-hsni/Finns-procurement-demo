# Finn's Procurement Platform Map — Product Designer Onboarding

> A complete walkthrough of every page in the platform: what it is, what states it can be in, what the user can do, what modals it opens, and where the user can go next.
>
> Read this before you touch any UI. The 8 pages here are everything that ships.

---

## Table of Contents

1. [Platform Topology](#1-platform-topology)
2. [Personas](#2-personas)
3. [The Agent Roster](#3-the-agent-roster)
3a. [Autonomy Model (per-entity + system pause)](#3a-autonomy-model-phase-6--per-entity--system-pause)
4. [Venue Tagging](#4-venue-tagging)
5. [Edge Taxonomy — How Pages Talk to Each Other](#5-edge-taxonomy--how-pages-talk-to-each-other)
6. [Hash-Context Contract](#6-hash-context-contract)
7. [The Pages](#7-the-pages)
   - [7.1 Overview](#71-overview)
   - [7.2 Inventory](#72-inventory)
   - [7.3 New Request](#73-new-request)
   - [7.4 Orders](#74-orders) *(cockpit)*
   - [7.5 Suppliers](#75-suppliers)
   - [7.6 Spending](#76-spending)
   - [7.7 Activity & Governance](#77-activity--governance)
   - [7.8 Workflows](#78-workflows)
8. [Cross-Page Navigation Index](#8-cross-page-navigation-index)
9. [Appendix — Glossary](#9-appendix--glossary)

---

## 1. Platform Topology

The platform has **8 pages**, all in one family — no "core" vs "agent" split. Every page is operator-facing.

The center of gravity is **Orders** (the "cockpit"). Most flows either land in Orders or originate from it.

### Spatial layout of the canvas (how pages relate)

```
Row 0:                          [Overview]
                                    │
Row 1: [Inventory]──[New Request]──[Suppliers]──[Workflows]
                         │
Row 2:                [ORDERS]  ← cockpit
                         │
                 ╭───────┴────────╮
Row 3:       [Spending]   [Activity & Governance]
```

- **Row 0**: morning landing — what needs attention today.
- **Row 1**: input surfaces — where stock is monitored, requests created, vendors managed, playbooks browsed.
- **Row 2**: the cockpit — every purchase order's lifecycle.
- **Row 3**: output surfaces — spend reporting and the unified audit + policy ledger.

---

## 2. Personas

The platform is built for **one primary persona** plus their team:

| Persona | Job | What they need |
|---------|-----|----------------|
| **Procurement Manager** (primary) | Owns sourcing, vendor relationships, daily ordering, and spend control across all Finn's venues. | Fast triage of what needs action, one-click approval / reorder, vendor performance at a glance, monthly spend visibility, override audit trail. |
| **Procurement / Inventory Staff** | Run day-to-day SKU monitoring, restock requests, vendor coordination, and delivery check-in. | Inventory heartbeat, simple restock requests, supplier chat, "where is this PO" answers. |

The Procurement Manager has full access. Staff use the same UI; permissions are not modeled in the prototype (single-tenant single-role).

---

## 3. The Agent Roster

Finn's runs on **6 named agents** (flat roster, no cohorts).

| ID | Name | Role |
|----|------|------|
| — | **Atlas** | The chat copilot. Present on every page in the right panel. **Never gated by Autonomy mode** — Atlas always reads page context, summarizes data, and answers questions in chat. Atlas does not generate independent recommendations or take actions; that's the role of A-01..A-05. |
| A-01 | **Sourcing Agent** | Picks vendors for new requests, validates quotes against market prices, surfaces alternative suppliers. |
| A-02 | **Restock Agent** | Watches par levels and consumption velocity, proposes restocks before stockout, prioritizes by venue demand. |
| A-03 | **Vendor Comms Agent** | Drafts and sends WhatsApp / Telegram messages to suppliers via the Source Bridge. Handles 1-on-1 and broadcast announcements. |
| A-04 | **Spend Watchdog** | Flags overspend, unusual cost spikes, duplicate invoices, and gates POs against active policy rules. |
| A-05 | **Logistics Agent** | Owns the In Transit → Delivered & Checked stages. Tracks shipments, surfaces delivery risk, escalates late or failed deliveries. |

Agents appear by ID in the order journey (`Managed by · Agent A-02`), in the Activity & Governance ledger, in inventory cards, on vendor dossiers, and as chip mentions in Atlas reasoning.

Hash format for deep links: `#agent-01` … `#agent-05` (zero-padded). Atlas has no profile page and no hash.

---

## 3a. Autonomy Model (Phase 6 — per-entity + system pause)

Finn's autonomy lives at **two levels**:

1. **Per-entity autonomy** — every PO, SKU, and vendor carries its own `manual` | `auto` flag (the labor switch on Orders / Inventory / Suppliers). The New Request wizard sets it on **Step 1** for a new PO; the per-entity switch is the truth after creation. Default for new entities is `auto` — Finn's treats AI as the feature that's on unless flipped.
2. **System-wide pause** — `agentsPaused: boolean` (localStorage key: `finns-agents-paused`). When `true`, every Auto entity is frozen platform-wide regardless of its labor switch. Manual entities are unaffected. Lives on **Activity & Governance → Agents tab** ("Pause all agents" toggle). Rare admin action: audit period, cost pause, vacation handoff.

Persistence:
- Default mode: `localStorage` key `finns-autonomy-mode`, event `finns-autonomy-changed` (seeds the wizard's per-PO picker).
- Pause: `localStorage` key `finns-agents-paused`, event `finns-agents-paused-changed`.

No global header pill — that 3-tier Off/Assist/Auto control was removed in Phase 6 because:
- "Off" duplicated what Manual on every entity already meant, and the kill-switch use case is rare enough to deserve a different home.
- "Assist" was Manual + always-on smart features, and smart features are always on now — collapsing Assist into Manual was the natural simplification.

### The principle

**Smart features are always on. Agent actions are gated by per-entity setting + system pause.**

- **Smart features** (always on; UX, not agent action):
  - Autocomplete / smart-detect on item entry (category, unit, venues from keyword)
  - Vendor relevance ranking (item-category overlap + composite)
  - Similar-past-POs insights
  - Atlas chat + page-context summaries
  - Threshold checks, watch-lists, "Needs Action" queues, compliance expiry, SLA dips
  - Recommendation cards on AgentCTA (chip reads "Insight" on Manual, "Auto" on Auto)

- **Agent actions** (gated by per-entity Manual / Auto AND not paused):
  - Auto-pre-pick of vendor in the wizard
  - Auto-approving POs under spend cap (A-04)
  - Auto-restock when par breached (A-02)
  - Auto-issuing the PO PDF to a vendor via WhatsApp/email
  - Auto-advancing journey stages (A-05)

### Per-entity values

| Value | Behaviour |
|-------|-----------|
| **manual** | User drives every stage. Agents observe + surface insights (reasoning cards, suggestions, ranked vendors), but never act without sign-off. |
| **auto** | Agents take action within policy rules (spend cap, vendor trust floor, fraud hold). User reviews exceptions. |

### System pause behaviour

When `agentsPaused === true`:
- All Auto entities behave as if Manual.
- The Activity & Governance Agents tab shows a red "All agents paused" card with a green "Resume all" button.
- Per-entity Manual entities are unaffected (they already require user action).
- Atlas chat + insight surfaces stay live.

### Atlas exemption

Atlas is **never gated**. Regardless of per-entity setting or system pause, Atlas:
- Reads the current page context
- Pulls relevant data summaries (vendor metrics, spending pulse, logistics risk map, etc.)
- Responds to chat queries

Atlas is read-only by design — never recommends action, never executes.

### Manual baseline rule

Every flow on every page must be completable on a **Manual** entity (and with `agentsPaused === true`). If a user cannot finish a procurement-related task without an agent taking an action, that's a missing manual surface (a gap, not a design choice). See `core-pages.md` per-page sections for the current audit.

---

## 4. Venue Tagging

Finn's operates **4 venues** in this prototype. Every SKU and every PO carries a venue tag. There is **no scope switcher** in the global nav — the Procurement Manager sees all venues at once. Tags surface in:

- Inventory rows (which venue consumes this SKU)
- PO cards in Orders (which venue this delivery is for)
- Spending breakdowns (per-venue spend bars)
- Activity feed (event-level venue badge)
- Right-panel intel cards (e.g. "Beach Club consumed 62% of last month's protein")

| Tag | Venue | Type |
|-----|-------|------|
| `BC` | **Beach Club** | Flagship beach club — high-volume bar, casual F&B, large daily covers. |
| `RC` | **Recreation Club** | Member-only club — F&B + retail, multi-day events. |
| `ST` | **Stake** | Fine-dining restaurant — premium proteins, smaller volumes, higher-spec sourcing. |
| `SP` | **Splash Waterpark** | Waterpark concessions — high-volume QSR, beverages, packaged goods. |

A single PO may serve multiple venues (e.g. a bulk protein order split across BC and ST). The PO card shows all venue tags it serves. Multi-venue POs use the `Multi` chip in filters.

---

## 5. Edge Taxonomy — How Pages Talk to Each Other

There are **three** ways pages connect. Every cross-page interaction is one of these.

| Kind | Color | Behavior |
|------|-------|----------|
| **nav** | sage | User clicks something that calls `onNavigate(page)` directly. The user moves. May carry hash context (e.g. `#order=PO-XXXX`). |
| **data** | blue | System silently pushes state into a target page's listener. **No route change.** The target absorbs the new state and surfaces it next time the user opens it. |
| **event** | amber | System fires the global `finns-navigate-page` CustomEvent. The app promotes the payload (evtId / agentId / orderId) into the matching URL hash, then flips pages. |

> Designers: treat `data` edges with care. They are deferred notifications — the user might not see the effect for hours. Always pair a `data` push with a clear, dismissible surface on the receiving page.

---

## 6. Hash-Context Contract

Some pages deep-link with a URL hash. Receivers read the hash on mount **and** on `hashchange`.

| Hash | Receiver | Behavior |
|------|----------|----------|
| `#order=PO-XXXX` | Orders | Auto-selects the PO. |
| `#agent-NN` | Activity & Governance | Opens that agent's profile panel. Fires a confirmation toast. |
| `#evt=eventId` | Activity & Governance | Selects the event in the feed, scroll-flashes the card. Unknown id → amber toast fallback. |
| `#workflow=WF-XXX` | Workflows | Selects that playbook (`WF-STD` / `WF-RSH` / `WF-REC`). Unknown id → amber toast fallback. |
| `#restock=...` / `#intent=express&mode=...` | New Request | Wizard jumps to the relevant step pre-filled. |

> Every "unknown id" path falls back to an **amber toast** — never a silent failure. Always preserve this.

> **Note on deprecated patterns:** Earlier iterations supported a `#decision=DEC-XXX` hash and a sessionStorage **Trail-Return Pill** marker for a Decision Attribution Trail. Finn's drops both — the audit lineage now lives inline on event cards in Activity & Governance (no full-screen trail sheet, no return-pill round trip).

---

## 6a. Unified Action Log

Single source of truth for every mutating action across the platform. Lives at `src/lib/actionLog.ts`. Foundation for the manual baseline (`REALISM-AUDIT.md` pattern 11) — without a single log of actions, Off-mode users have no audit trail of their own work.

### Schema

Every entry carries:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `act-NNNNNN` | Auto-generated, monotonic. |
| `at` | ISO string | Action timestamp. |
| `actorType` | `'agent' \| 'admin' \| 'system'` | Who took the action. |
| `actorId` | `'admin' \| 'A-01'..'A-05' \| 'system'` | Discriminator within actorType. |
| `actorLabel` | string | Display name: 'You' / 'Sourcing Agent' / 'System'. |
| `kind` | `ActionKind` (closed union) | Canonical action name (e.g. `po-approve`, `sku-adjust`, `rule-create`, `vendor-message`). |
| `entity?` | `{ type, id }` | What the action operated on, when applicable. |
| `summary` | string | One-line for feed display. |
| `category?` | `FinnsCategory` | For category-filtered views. |
| `venue?` | `VenueTag \| 'Multi'` | For venue-filtered views. |
| `outcome` | `'success' \| 'pending' \| 'failed' \| 'overridden'` | |
| `details?` | string | Longer text or structured note. |
| `meta?` | `Record<string, unknown>` | Free-form metadata (prior value, amount, etc.). |

### Storage

- In-memory module-level array + `localStorage` backing (key: `finns-action-log`).
- Capped at 200 most recent entries; older silently dropped from the tail.
- Module-level (not React state) so agent dispatchers, timer-based emitters, and event handlers can write without a component being mounted.
- Components subscribe via `useActionLog(filter?)` — re-renders on the `finns-action-log-changed` CustomEvent.

### API

```ts
// Emitters
logUserAction(input)              // shorthand: actorType 'admin' + actorId 'admin' + label 'You'
logAgentAction(agentId, label, input)
logSystemAction(input)
logAction(input)                  // lower-level: fully-specified actor

// Readers
readActionLog(filter?)            // synchronous one-shot read
useActionLog(filter?)             // React hook; subscribes to changes

// Dev / testing
resetActionLog()                  // re-seed to the SEEDED_HISTORY fixture
```

### Consumers

| Page | What it reads |
|------|---------------|
| **Activity & Governance** | Canonical Activity Feed. No filter (all 3 actorTypes). Adds the actor-filter chip (You / Atlas / Agents / All / System). |
| **Overview** | "Recent activity" section in the right panel — most recent N entries, mode-aware filtering. |
| **Inventory** | Right-panel Action Log scoped to `entityType: 'sku'`. |
| **Suppliers** | Per-vendor Action Log scoped to `entityType: 'supplier', entityId: <SUP-NNN>`. |
| **Spending** | LEDGER merge: entries with `kind: 'savings-lock' \| 'savings-manual-add'` join the existing ledger view, filtered by `category`. |

### Mode-aware filters

The actor filter is the primary mode-awareness lens:

- **Off mode** primary view: `actorType: 'admin'` — your own work.
- **Assist mode** primary view: all three actorTypes — see what agents proposed + what you approved + raw system events.
- **Auto mode** primary view: all three — agent-driven activity dominates.

The store itself is mode-agnostic; mode only changes which slice each page surfaces by default.

### Atlas + chat

Atlas reads the action log when answering "What did I do today?" / "Show me recent agent activity" / "What's the audit trail for PO-3041?" — filtered by the page-context entity. Never gated.

---

## 7. The Pages

### 7.1 Overview

- **Route**: `/overview`
- **One-line**: Morning dashboard — today's critical actions, logistics calendar, spend pulse.

**Purpose**

Top-of-funnel dashboard. The center panel morphs between an Analytics view (4 KPI cards + monthly spend trend), a Logistics Calendar (month / week / agenda), an Event Detail view when an event is clicked, and a PO Workspace when a critical action is selected.

**States**

| State | Description |
|-------|-------------|
| Analytics | 4 metric cards + Monthly Spending Trend chart with confidence band. |
| Calendar — Month | Month grid of logistics events (deliveries, expirations, restock deadlines). |
| Calendar — Week | Week view with event rows. |
| Calendar — Agenda | Agenda list of upcoming events. |
| Event Detail | 5-stage DAG + Atlas reasoning when an event is clicked. |
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
| PO card | Opens the PO Workspace. |
| Quick Approve | Quick-approves a system alert. |
| Atlas chat send | Sends a message to Atlas in the right panel. |

**Modals**: *(none)*

**Outgoing navigation**: *(none — Overview is a hub; the user navigates out via the global nav.)*

---

### 7.2 Inventory

- **Route**: `/inventory`
- **One-line**: Stock heartbeat + SKU workspace + audit mode + catalog.

**Purpose**

Two-mode workspace. Default center shows a Velocity Map. When a SKU is selected the center renders the Item Journey (with PAR watch, restock decision tree, pipeline visibility, per-venue consumption split). Audit Mode expands this with a heartbeat group view and failure-intent surface. Catalog management lives behind a modal.

**States**

| State | Description |
|-------|-------------|
| Velocity Map (default) | No SKU selected — consumption forecast vs actual, burn-rate bars, venue split. |
| SKU Selected | Item Journey, PAR watch, restock decision tree, venue consumption split. |
| SKU + Audit Mode | Expanded audit view with heartbeat groups + failure intents. |
| Hardened Banner | Floating "System Hardened — new safety threshold locked" banner after Set as Par Floor (3.2s auto-dismiss). |
| Restock Intent Dismissed | Amber alert on the selected SKU when RequestPanel dispatches `finns-restock-intent-failed` (user dismissed an inventory-prefilled restock). |

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
| Open Activity (per-agent) | Jumps to the assigned agent's profile in Activity & Governance. | **Activity & Governance** |
| New Request | Starts a new procurement request. | **New Request** |

**Modals**

| Modal | Description |
|-------|-------------|
| Adjust Stock | Manual count form with +/-, note, validation. |
| Stage Trace | Read-only 5-stage journey history for the SKU's latest PO. |
| Catalog Management | Add / edit / archive SKU records (including venue tag assignment). |
| ⌘K Command Palette | Search / select items. |

**Outgoing navigation**

- **→ Orders** (Open PO; sets `#order=PO-XXXX`)
- **→ New Request** (Restock Now; sets `#restock=SKU&items=...&vendor=...`, jumps to Step 1, sets urgency=urgent)
- **→ Activity & Governance** (per-SKU agent link; sets `#agent-NN`)

---

### 7.3 New Request

- **Route**: `/request`
- **One-line**: 5-step wizard: Items → Vendors → Delivery → Review → Done.

**Purpose**

Sourcing wizard. The center panel morphs entirely through 5 steps. On the Review step, "Authorize" submits and routes the user to Orders.

**States**

| State | Description |
|-------|-------------|
| Step 1 — Items | Add line items with categories and venue tags. Budget framing surfaces inline. |
| Step 2 — Vendors | Pick vendors from the internal directory; Sourcing Agent suggestions surface in the right panel. |
| Step 3 — Delivery | Logistics + delivery preferences, target venue(s), date window. |
| Step 4 — Review | Pre-submit summary; Authorize button lands here. |
| Step 5 — Done | Confirmation; PO lands in Orders. |

**Actions**

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Step indicator | Backward step navigation. | — |
| Next | Advance to the next step. | — |
| Back | Return to the previous step. | — |
| Add item | Adds a line item. | — |
| Remove item | Removes a line item. | — |
| Suggested category tag | Filters by category. | — |
| Venue tag selector | Assigns one or more venues to a line item. | — |
| Vendor checkbox | Toggle vendor selection. | — |
| Authorize | Submits the request and routes to Orders. | **Orders** |
| Atlas chat send | Sends a message to Atlas. | — |

**Modals**: *(none)*

**Outgoing navigation**

- **→ Orders** (Authorize; sets `#order=PO-XXXX` after a 1.4s celebratory delay on Step 5)
- **→ Inventory** *(data edge)* — Dismissing the inventory-prefilled restock banner dispatches `finns-restock-intent-failed`. Inventory shows an amber alert on the affected SKU next time the user visits.

---

### 7.4 Orders

- **Route**: `/orders`
- **One-line**: The cockpit. Order lists, single-order journey, batch console, Audit Mode ledger.

**Purpose**

Cockpit for every PO. The most morphologically complex page in the platform.

- **Left panel**: Groups orders by status (Triage Mode) or expands to a historical ledger (Audit Mode).
- **Center panel**: Morphs through Default (scheduled / autonomous list), Single Order Journey (with 5-stage DAG), Batch Console (multi-select), and post-execute splashes — and **collapses to 0 width** while Audit Mode is active.
- **Right panel**: Hosts Atlas chat, the Source Bridge takeover, or — in Audit Mode — Operations Insights / Quick Journey.

**States**

| State | Description |
|-------|-------------|
| Default | Scheduled + autonomous orders list. |
| Single Order Journey | Two-column: detail card (with primary CTA + tertiary row) + 5-stage DAG. |
| Batch Selected | Batch Console — approve / confirm / resolve counts across selected orders. |
| Journey Complete | Single-order success splash with cost / labor savings. |
| Batch Complete | Batch finalization splash. |
| Audit Mode | Left panel expands to full width and surfaces the combined ledger of live + historical orders. Center collapses. Right panel swaps to Operations Insights (no row selected) or Quick Journey (row selected). 380ms cubic-bezier spring transition. Escape collapses back when no row is selected. |

**Actions**

General journey + chat:

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Clear selection | Clears the multi-select set. | — |
| ⌘K trigger | Opens the Command Palette. | — |
| Track Shipment (⋯ menu) | Stage-gated; sets selection state. Visible when stage ≥ 4 (In Transit). | — |
| Message Supplier (⋯ menu) | Opens the Source Bridge in the right panel. | — |
| Repeat Order (⋯ menu) | Stage-gated; opens the Draft Sheet pre-filled. Visible when stage = 5 (Delivered & Checked). | — |
| Re-order | Carbon-copies a delivered order into New Request. | **New Request** |
| Resume Agent | Returns the order from Manual Takeover to agent mode. | — |
| Back to orders | Clears single-order selection. | — |
| Advance Stage | Advances the 5-stage DAG. | — |
| Execute Batch | Runs the action across all selected orders. | — |
| Stage module — Save Draft | Saves manual-mode stage entries. | — |
| Stage module — Save & Mark Complete | Saves and closes the stage module. | — |
| Draft Sheet — Submit | Creates a new order from the draft. | — |
| Atlas chat send | Sends a message to Atlas. | — |
| Managed by · Agent A-NN | Tertiary link — jumps to that agent's profile in Activity & Governance. | **Activity & Governance** |

Audit Mode:

| Action | Description |
|--------|-------------|
| Expand to Audit Mode | Maximize2 button in the left-panel header — expands the left panel to full width, collapses the center, swaps the right panel to Operations Insights. |
| Collapse Audit Mode | Minimize2 button (or Escape with no row selected) — returns to Triage Mode. |
| Audit search | Search PO id / supplier / item / agent / venue across all live + historical orders. Auto-focuses on entering Audit Mode. |
| Status filter chip | All · Live · Completed · Disputed · Cancelled · On Hold — each shows a live count. |
| Date range preset | 7 days · 30 days · 90 days · All time. |
| Supplier filter | Dropdown of every supplier in the ledger. |
| Stage band filter | Any stage · Pre-PO (1–2) · Fulfillment (3–4) · Closeout (5). |
| Agent filter | Dropdown of every assigned agent (A-01 … A-05). |
| Venue filter | Dropdown — BC · RC · ST · SP · Multi. |
| Workflow filter | Dropdown of playbook ids (`WF-STD` / `WF-RSH` / `WF-REC`). |
| Clear filters | Resets all audit filters and search at once. |
| Audit Select All | Checkbox — selects/clears all currently filtered rows. |
| Audit view toggle | Switches between Table and Grid layouts. |
| Export CSV | Downloads `orders-audit-YYYY-MM-DD.csv`. Acts on current selection if any, otherwise full filtered set. |
| Open audit row · live | Collapses Audit Mode and loads the Single Order Journey. |
| Open audit row · historical | Keeps Audit Mode; surfaces a compact Quick Journey card in the right panel. |
| Top-supplier card · filter | Clicking a supplier in Operations Insights sets the supplier filter. |
| Open Full Workspace (Quick Journey) | Snaps out of Audit Mode and loads the selected order's full journey. |

**Modals**

| Modal | Description |
|-------|-------------|
| Task Module Sheet | 5-stage interactive sheet — Review or Execute mode. |
| Draft Sheet | New / re-order draft form (recurring, frequency, labor assignment, target venue). |
| ⌘K Command Palette | Fuzzy search across orders. |
| Source Bridge | Right-panel takeover — WhatsApp / Telegram supplier composer. |

**Outgoing navigation**

- **→ Activity & Governance** (Managed by · Agent link)
- **→ New Request** (Re-order; sets `#intent=express&mode=reorder&from=...&vendor=...&items=...`, jumps to Step 4 pre-filled)
- **→ Suppliers** *(data edge)* — Stage 5 (Delivered & Checked) outcome=fail dispatches `finns-qc-failure`. Suppliers pushes an amber alert card into its alert state. No navigation.

---

### 7.5 Suppliers

- **Route**: `/suppliers`
- **One-line**: Vendor ecosystem hub, relationship workspace, side-by-side comparison.

**Purpose**

Vendor relationship center. Center morphs from Ecosystem Hub (default — KPIs, performance matrix, distribution charts) to a Relationship Workspace when one supplier is selected, to a Comparison Matrix when comparison mode is active. A 5-stage Journey Task Module opens for per-relationship stage edits in manual mode.

**States**

| State | Description |
|-------|-------------|
| Ecosystem Hub | 4 KPI cards + performance matrix + category bar chart + venue-served distribution. |
| Relationship Workspace | One supplier selected — dossier, journey track, metrics radar, negotiation status, venues served. |
| Comparison Matrix | Dual-supplier matrix overlay when comparison is active. |
| QC Failure Alerts | Dismissible alerts at the top of the center panel when QC failures fire from Orders. |

**Actions**

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Category bar | Filters by category. | — |
| Onboard New Vendor (Fortress banner) | Routes to New Request as the Manual Discovery Portal — humans are the sole gateway for new vendor data. | **New Request** |
| Full Workspace | Expands the relationship workspace. | — |
| Open Activity (per-agent) | Jumps to the relationship's assigned agent's profile in Activity & Governance. | **Activity & Governance** |
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

- **→ Activity & Governance** (Open Activity; sets `#agent-NN`)
- **→ New Request** (Onboard New Vendor; New Request from vendor)

---

### 7.6 Spending

- **Route**: `/spending`
- **One-line**: Category grid → category detail ledger. Budget setup modal. Venue spend split.

**Purpose**

Default center is a 7-category grid. Selecting a category morphs to a category-detail view with a time-range filter (1M / 3M / 6M / 1Y), a ledger, a per-venue spend split, and a "Lock Savings" action. Budget Setup modal walks first-time setup.

**States**

| State | Description |
|-------|-------------|
| Categories Grid (default) | 7 category cards (Protein, Seafood, Produce, Dry Goods, Dairy, Beverages, Other), each with semantic color and venue split mini-bar. |
| Category Detail | Filtered ledger + time-range controls + venue split bars + Lock Savings. |

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
| Category Budgets | Per-category budget inputs (7 fields) + per-venue budget allocation — Cancel / Save. |

**Outgoing navigation**: *(none)*

---

### 7.7 Activity & Governance

- **Route**: `/activity`
- **One-line**: Unified activity feed + agent oversight + policy rules + disputes.

**Purpose**

The merged "receipts + HR + policy office" for the AI workforce. Replaces what Buyamia called "AI Activity" and "Governance" as separate pages.

- **Left panel**: Tabbed segmented control — **Activity** (default, the event feed) / **Agents** (the 5-agent roster + Atlas) / **Policy** (active rules) / **Disputes** (open + resolved).
- **Center panel**: Morphs based on left-panel selection — Activity Feed by default; Agent Profile when an agent row is opened; Policy Rules list when Policy tab is active; Dispute card when a dispute is opened.
- **Right panel**: Atlas with context-aware reasoning chain for the selected event / agent / dispute.

**States**

| State | Description |
|-------|-------------|
| Activity Feed (default) | Unified center — event timeline + always-visible KPI cards + undo policy section. |
| Agent Profile | Selected agent's dossier — current tasks, recent decisions, suspend / resume controls, performance band. |
| Policy Rules | Active rule list with template-driven creation (Spend Cap / Vendor Trust Floor / Fraud Hold / Delivery SLA). |
| Disputes Panel | Open + resolved dispute cards with Approve / Reject / Escalate. |
| Post-Approval Harden | Sage callout offering "Harden Policy — Set as Precedent" + "Resume Order". |
| Precedent Set | "Precedent Set — policy hardened" confirmation bar. |
| Learning Phase | Banner shown when isWarmingUp (events < 25). |

**Actions**

| Action | Description | Navigates to |
|--------|-------------|--------------|
| Tab switch (Activity / Agents / Policy / Disputes) | Switches the left panel and reshapes the center. | — |
| Confidence filter | Filter the feed by confidence band. | — |
| Event type filter | Filter by event type. | — |
| Venue filter | Filter the feed by venue (BC / RC / ST / SP / Multi). | — |
| Clear filters | Resets confidence / type / venue filters. | — |
| Adjust autonomy per category | +/- the per-category autonomy. | — |
| Approve Today's Ledger | Locks the day's ledger. | — |
| Undo mode (Hard 60-min / Ledger-close / Per-class) | Switches the global undo policy. | — |
| Event card | Selects the event — right panel updates with reasoning. | — |
| View Source | Jumps to the originating page (Orders / Suppliers / Inventory) depending on event type. | varies |
| Explain Logic | Focuses the right panel on the event. | — |
| Rollback | Opens the Rollback & Intervene modal. | — |
| Suspend / Resume Agent | Toggles agent suspension. | — |
| Edit data point | Inline edit on an event data point. | — |
| Save / Cancel edit | Commit or discard the inline edit. | — |
| Add Rule | Opens the Policy Creator modal. | — |
| Policy template select | Picks Spend Cap / Vendor Trust Floor / Fraud Hold / Delivery SLA. | — |
| Create Rule | Closes the Policy Creator and adds the rule to the active list. | — |
| Override decision | Override button on a decision row. | — |
| Approve / Reject / Escalate dispute | Three buttons on an open dispute card. | — |
| Harden Policy — Set as Precedent | Locks the override in as a standing policy rule. | — |
| Resume Order (Dispute Panel) | Routes back to Orders for the disputed order. | **Orders** |

**Modals**

| Modal | Description |
|-------|-------------|
| Rollback & Intervene | Choose "Fix & Re-run" or "Manual Takeover" for an event. |
| Policy Creator | Template picker + rule config form. |

**Outgoing navigation**

- **→ Orders** (Resume Order from a resolved dispute; View Source on auto-order events; sets `#order=PO-XXXX`)
- **→ Suppliers** (View Source on sourcing / vendor-rejection events)
- **→ Inventory** (View Source on forecast / restock events)

---

### 7.8 Workflows

- **Route**: `/workflows`
- **One-line**: 3 playbooks rendered as flow paths. Read-only reference.

**Purpose**

Light reference page. Shows the 3 playbooks Finn's runs orders through: **Standard**, **Rush**, **Recurring**. Each playbook is a vertical 5-stage flow with assigned agents, plain-English stage descriptions, and current active-order count. **No tuning sliders. No simulation. No hard-locks.** This page exists to answer "what does Rush actually do that Standard doesn't?" — not to configure anything.

**States**

| State | Description |
|-------|-------------|
| Playbook Selected | Selected playbook rendered as a vertical stage list with agent chips + throughput. Hero card shows complexity, active count, avg duration, savings vs baseline. |

**Actions**

| Action | Description |
|--------|-------------|
| Select a playbook (left) | Loads its flow path in the center. |
| Hash reader · `#workflow=WF-XXX` | On mount + hashchange, reads the workflow id. Real id → selects that playbook. Unknown id → amber toast. Hash cleared after read. |
| Atlas chat send | Sends a message to Atlas. |

**Playbooks (IDs)**

| ID | Name | When it runs |
|----|------|--------------|
| `WF-STD` | Standard | Default for every non-urgent, non-recurring request. Includes RFQ + vendor selection. |
| `WF-RSH` | Rush | Marked urgent at request time, or auto-promoted by Restock Agent when par floor is breached. Skips RFQ — goes direct to preferred vendor. |
| `WF-REC` | Recurring | Standing orders for high-velocity SKUs (e.g. weekly produce delivery from PT Indo Sayur for Beach Club kitchen). Runs on a schedule, requires no human approval until spend cap hit. |

**Modals**: *(none)*

**Outgoing navigation**: *(none — Workflows is reference, not a routing surface. Selecting a playbook does not jump to Orders.)*

---

## 8. Cross-Page Navigation Index

All cross-page edges in the system. Read this as "from → to: when and how."

### Outbound from Orders (the cockpit)

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Activity & Governance | `or-ac` | nav | Tertiary "Managed by · Agent A-NN →" on order journey header. Sets `#agent-NN`. |
| New Request | `or-rq` | nav | Re-order button on a delivered PO. Sets `#intent=express&mode=reorder&...` — wizard jumps to Step 4 pre-filled. |
| Suppliers | `or-su` | **data** | Stage 5 (Delivered & Checked) outcome=fail dispatches `finns-qc-failure`. Suppliers pushes an amber alert card. **No navigation.** |

### Outbound from Inventory

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Orders | `in-or` | nav | "Open [PO-XXXX] in Orders" buttons (stream switcher, Stage Trace modal). Sets `#order=PO-XXXX`. |
| New Request | `in-rq` | nav | Restock Now / Quick Restock action. Sets `#restock=SKU&items=...&vendor=...` — wizard jumps to Step 1, urgency=urgent. |
| Activity & Governance | `in-ac` | nav | Per-SKU agent link routes to that SKU's assigned agent. Sets `#agent-NN`. |

### Outbound from Suppliers

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Activity & Governance | `su-ac` | nav | Peek-sheet "Managed by Agent A-NN · Role" link and audit-mode kebab navigations. Sets `#agent-NN`. |
| New Request | `su-rq` | nav | Fortress banner "Onboard New Vendor" — routes as the Manual Discovery Portal. |

### Outbound from New Request

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Orders | `rq-or` | nav | Step 4 "Authorize". Toasts the new PO, advances to Step 5, then after a 1.4s celebratory delay sets `#order=PO-XXXX`. |
| Inventory | `rq-in` | **data** | Dismissing the inventory-prefilled banner dispatches `finns-restock-intent-failed`. Inventory shows an amber banner on the affected SKU. **No navigation.** |

### Outbound from Activity & Governance

| → | Edge | Kind | Trigger |
|---|------|------|---------|
| Orders | `ac-or` | nav | (1) Dispute Panel "Resume Order → PO-XXXX" button. (2) "View Source" on auto-order events. Sets `#order=PO-XXXX`. |
| Suppliers | `ac-su` | nav | "View Source" on sourcing / vendor-rejection events. |
| Inventory | `ac-in` | nav | "View Source" on forecast / restock events. |

### Outbound from Workflows, Overview, Spending

*(None — these pages are reference / dashboard / reporting surfaces and do not own cross-page navigation.)*

---

## 9. Appendix — Glossary

- **DAG**: Directed Acyclic Graph. The 5-stage purchase journey every order flows through.
- **Atlas**: The platform's AI chat assistant, surfaced on every page in the right panel. Not a numbered agent — it has no profile and no hash.
- **PO**: Purchase Order. Format: `PO-XXXX`.
- **SKU**: Stock-keeping unit. The atomic unit in Inventory.
- **Agent ID**: `A-01` … `A-05`. Hash form: `#agent-01` … `#agent-05`.
- **Venue tag**: `BC` / `RC` / `ST` / `SP` / `Multi` — applied to every SKU and PO.
- **evt-XXX**: Activity & Governance event id.
- **WF-XXX**: Workflow playbook id. Three ids: `WF-STD` / `WF-RSH` / `WF-REC`.
- **Audit Mode**: A panel-expansion pattern used on Orders and Inventory where the left panel takes over and the center collapses.
- **Hash-reader**: The pattern where a destination page reads `window.location.hash` on mount + `hashchange` to deep-link state.
- **Source Bridge**: The right-panel takeover used to send WhatsApp / Telegram messages to suppliers. Owned by Vendor Comms Agent (A-03).
- **Manual Discovery Portal**: Naming convention for the Onboard New Vendor flow — humans (not agents) are the sole gateway for new vendor data entering the platform.

### Removed concepts (from earlier Buyamia iteration)

These concepts existed in the prior 13-page platform and do **not** apply to Finn's. Do not reintroduce them.

- ❌ Decision Attribution Trail (full-screen modal sheet listing 12 stages with cross-page chips)
- ❌ TrailReturnPill / `sessionStorage['buyamia-trail-return']` marker
- ❌ Control planes (CP-POL / CP-ECO / CP-TRU / CP-SIM)
- ❌ 5-cohort agent taxonomy (SEN / REA / EXE / GOV / MET)
- ❌ Nerve Center, Global Operations, Intelligence, Infrastructure pages
- ❌ L0–L5 global autonomy ladder
- ❌ Tamper-proof audit kernel with GOV seal chips
- ❌ Deployment phase queue / build authorization
- ❌ Payment rail connector
- ❌ Simulation sandbox / `CP-SIM`
- ❌ 12-stage DAG (replaced with 5 stages)
- ❌ 8 workflow playbooks (replaced with 3)
- ❌ 7-step request wizard (replaced with 5 steps)
