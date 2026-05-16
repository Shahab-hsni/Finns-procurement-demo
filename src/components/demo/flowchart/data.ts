/**
 * Flowchart data — every page in the platform plus its states, actions,
 * modals, and the navigation edges between them.
 *
 * ACCURACY POLICY: every entry in this file must be verifiable in the
 * actual React component code (not docs, not comments about future
 * plans). If something is added here, it must exist in rendered JSX.
 * If unsure, leave it out.
 *
 * Last audit pass: cross-checked against
 *   - OverviewPage.tsx, NewOrdersPage.tsx, NewInventoryPage.tsx,
 *     SpendingPage.tsx, SuppliersPage.tsx, AIActivityPage.tsx,
 *     RequestPanel.tsx, nerve-center/NerveCenterPage.tsx,
 *     workflows/WorkflowsPage.tsx, global-ops/GlobalOpsPage.tsx,
 *     transformation/TransformationPage.tsx,
 *     governance/GovernancePage.tsx + DisputePanel.tsx + DecisionLedger.tsx,
 *     infrastructure/InfrastructurePage.tsx
 *   - core-pages.md, agent-pages.md (both already aligned with the source).
 *
 * Latest sync (2026-05-13):
 *   - Hash-readers wired on Orders / AI Activity / Governance + the
 *     `buyamia-navigate-page` → hash bridge in App.tsx. Edge labels
 *     now note which hash key each `nav` edge sets.
 *   - Added missing cross-page edges: Orders → Suppliers
 *     (`buyamia-qc-failure`), Request → Inventory
 *     (`buyamia-restock-intent-failed`), Governance → AI Activity
 *     (external-link icon on Decision Ledger rows).
 *   - Corrected Spending category count (6 → 7).
 *   - Inventory "Full Journey" is internal — no cross-page nav. Split
 *     into "Full Journey" (intra-page) and "Open PO in Orders" (cross).
 *   - Suppliers Fortress-banner "Onboard New Vendor" now records its
 *     `navigatesTo: 'request'`.
 *   - Added Inventory "Restock Intent Dismissed" state.
 *   - Edge taxonomy reconciled with the rendered legend:
 *       • `data` edges (blue) — cross-page CustomEvents that silently
 *         push state into the target page (or-su QC Failure, rq-in
 *         Restock Intent Dismissed). The user does not navigate.
 *       • `event` edges (amber) — the global `buyamia-navigate-page`
 *         CustomEvent which App.tsx promotes to a URL hash and uses
 *         to flip pages (go-ai External-link).
 *       • `nav` edges (sage) — direct `onNavigate(page)` calls.
 *     Previously `rq-or` and `go-or` were mislabeled `event` (both are
 *     plain `onNavigate` calls and now read `nav`).
 *
 * Sync 2026-05-13 (Orders Audit Mode):
 *   - Added Orders `audit-mode` state and ~14 new audit actions
 *     (Maximize2 toggle, filters, view toggle, export, row-open
 *     dispatch). Mirrors the Suppliers + Inventory Audit Mode pattern
 *     so the three pages now share the same shell vocabulary.
 *   - Order purpose + oneLine updated to call out Audit Mode.
 *   - No new edges — Audit Mode is intra-page; deep-link arrivals via
 *     `#order=PO-XXXX` continue to collapse Audit Mode and load the
 *     full journey (handled in NewOrdersPage's hash-reader).
 *
 * Sync 2026-05-14 (Decision Attribution Trail + Trail-Return loop):
 *   - Added Orders `attribution-trail` state + `attribution-trail`
 *     modal, plus ~9 new Trail-related actions (entry points, chip
 *     clicks, expand-stage, TrailReturnPill).
 *   - NEW EDGE `or-ai` (Orders → AI Activity, nav) — surfaced by the
 *     Trail's "AI Activity · evt-XXX" chip. Pool: real seeded ids
 *     evt-001..evt-012.
 *   - Updated `or-go` detail — now also driven by the Trail's
 *     "Agent in Governance" and "Decision · DEC-XXX" chips. Pool:
 *     real seeded ids DEC-001..DEC-008.
 *   - Documented the TRAIL-RETURN CONTRACT and the receiver-side
 *     scroll-flash + amber-toast-on-unknown behavior in the EDGES
 *     header. Implementation lives in `src/lib/trailReturn.ts` and
 *     `src/components/TrailReturnPill.tsx`.
 *
 * Sync 2026-05-14b (Workflow templates — Concern 2):
 *   - Every Order now carries a `workflowTemplate` (one of 8 ids from
 *     lib/mockData.ts workflowTemplates). All 7 live + 40 historical
 *     orders seeded; pickWorkflow() drives the distribution.
 *   - NEW EDGE `or-wf` (Orders → Workflows, nav) — surfaced by the
 *     Trail header's "🧭 Workflow · {name}" chip. Sets #workflow=WF-XXX
 *     and drops the trail-return marker.
 *   - Workflows node gains a `trail-return` state and two hash-reader
 *     actions. Workflows now accepts `onNavigate` (App.tsx wires it).
 *   - Orders node gains three workflow-related actions (Trail chip,
 *     Audit Mode filter, Audit Mode column).
 *   - HASH-CONTEXT CONTRACT comment updated with the #workflow= row.
 */

export type PageGroup = 'core' | 'agents';

export interface PageState {
  id: string;
  label: string;
  description: string;
}

export interface PageAction {
  label: string;
  description: string;
  navigatesTo?: string;
}

export interface PageModal {
  id: string;
  label: string;
  description: string;
}

export interface PageNodeData {
  id: string;
  group: PageGroup;
  label: string;
  route: string;
  oneLine: string;
  purpose: string;
  states: PageState[];
  actions: PageAction[];
  modals: PageModal[];
  pos: { x: number; y: number };
}

export interface FlowEdgeData {
  id: string;
  source: string;
  target: string;
  /** Short label rendered on the canvas (≤24 chars to avoid overlaps). */
  label?: string;
  /** Full description shown in the DetailPanel side sheet. */
  detail?: string;
  kind: 'nav' | 'data' | 'event';
}

// ───────────────────────────────────────────────────────────
// NODES — hand-positioned
// ───────────────────────────────────────────────────────────

// LAYOUT GRID — wide stride so the 240px nodes have room for edge labels
// and ReactFlow's smoothstep routing can lay multiple edges into the same
// node without stacking. Don't shrink these below the current values —
// the system map has 14 cross-page edges and label readability is the
// gating constraint, not real estate.
const COL = { 0: 0, 1: 420, 2: 840, 3: 1260, 4: 1680 };
const ROW = { 0: 0, 1: 400, 2: 800, 3: 1200, 4: 1600 };

export const PAGES: PageNodeData[] = [
  // ════ Row 0 ═══════════════════════════════════════════════
  {
    id: 'overview',
    group: 'core',
    label: 'Overview',
    route: '/overview',
    oneLine: 'Morning dashboard — analytics, logistics calendar, critical actions.',
    purpose:
      'Top-of-funnel dashboard. The center panel morphs between an Analytics view (metrics + spending trend), a Logistics Calendar (month/week/agenda), an Event Detail view when an event is clicked, and a PO Workspace when a critical action is selected.',
    states: [
      { id: 'analytics',     label: 'Analytics',        description: '4 metric cards + Monthly Spending Trend chart with confidence band.' },
      { id: 'cal-month',     label: 'Calendar — Month', description: 'Month grid of logistics events.' },
      { id: 'cal-week',      label: 'Calendar — Week',  description: 'Week view with event rows.' },
      { id: 'cal-agenda',    label: 'Calendar — Agenda',description: 'Agenda list of upcoming events.' },
      { id: 'event-detail',  label: 'Event Detail',     description: '12-stage DAG + agent reasoning when an event is clicked.' },
      { id: 'po-workspace',  label: 'PO Workspace',     description: 'Critical-action detail when a PO item is selected.' },
    ],
    actions: [
      { label: 'Performance',         description: 'Toggle center to Analytics view.' },
      { label: 'Logistics Calendar',  description: 'Toggle center to Calendar view.' },
      { label: 'Calendar view toggle',description: 'Switch Month / Week / Agenda.' },
      { label: 'Event card',          description: 'Opens the Event Detail state in the center panel.' },
      { label: 'View Journey',        description: 'Same as event click — opens event detail.' },
      { label: 'Clear Deadline',      description: 'Approve / confirm action on an event.' },
      { label: 'Atlas (on event)',    description: 'Opens an Atlas action on that event.' },
      { label: 'PO card',             description: 'Opens the PO Workspace.' },
      { label: 'Quick Approve',       description: 'Quick-approves a system alert.' },
      { label: 'Chat send',           description: 'Sends a message in the Atlas chat.' },
    ],
    modals: [],
    pos: { x: COL[2], y: ROW[0] },
  },

  // ════ Row 1 — inputs ═════════════════════════════════════
  {
    id: 'workflows',
    group: 'agents',
    label: 'Workflows & Kernel',
    route: '/workflows',
    oneLine: '8 playbooks + demand signals → DagFlowPath with inline tuning + simulation.',
    purpose:
      'Library of 8 purchase playbooks (Standard, Rush, Blanket PO, Group Buy, Emergency, Production, Maintenance, Capex). Left panel: WorkflowTemplateList with template cards and Demand Signals feed. Center: Workflow Hero + Flow Path with per-stage Tune Logic. Right panel offers a Simulation Workspace when Simulate is engaged. Reached from Orders via the Decision Attribution Trail\'s 🧭 Workflow chip (deep-links into the order\'s `workflowTemplate`).',
    states: [
      { id: 'flow-path',     label: 'Flow Path (default)',     description: 'Selected workflow rendered as a vertical stage list with agent chips + throughput.' },
      { id: 'signal-trace',  label: 'Signal Trace',            description: 'A selected demand signal lights up its path through the stages.' },
      { id: 'tune-logic',    label: 'Tune Logic open',         description: 'Inline per-stage tuner panel with slider + Apply / Apply & Lock / Cancel.' },
      { id: 'hard-lock',     label: 'Hard-lock active',        description: 'Amber banner when Stage 1 signal-sensitivity is hard-locked at ≥90%.' },
      { id: 'simulation',    label: 'Simulation mode',         description: 'Workflow Hero shows "Simulating" — right panel surfaces scenarios and Apply Fix.' },
      { id: 'correlation',   label: 'Active Correlation Banner', description: 'Sage banner when 2+ high-strength signals (>70%) share a workflow.' },
      { id: 'trail-return',  label: 'Trail Return Pill',       description: 'Fixed pill at top:64px shown when the page is reached from the Orders Decision Attribution Trail (sessionStorage marker). Click → onNavigate("orders") and the Trail re-opens at the same stage.' },
    ],
    actions: [
      { label: 'Take a tour',          description: 'Starts the driver.js onboarding tour.' },
      { label: 'Load a workflow',      description: 'Selects a template card.' },
      { label: 'Trace a signal',       description: 'Highlights the signal\'s path through the DAG.' },
      { label: 'Clear active signal',  description: 'Resets the signal selection.' },
      { label: 'Tune Logic',           description: 'Opens the inline tuner for a stage.' },
      { label: 'Apply / Apply & Lock', description: 'Applies a tuning; "& Lock" hard-locks Stage 1 sensitivity.' },
      { label: 'Release hard-lock',    description: 'Clears the Stage 1 sensitivity hard-lock.' },
      { label: 'Simulate',             description: 'Enters simulation mode (right panel surfaces scenarios).' },
      { label: 'Select scenario',      description: 'Picks a simulation scenario in the right panel.' },
      { label: 'Apply Fix',            description: 'Applies the recommended fix for a simulated bottleneck.' },
      { label: 'Exit Simulation',      description: 'Leaves simulation mode.' },
      { label: 'Execute Workflow',     description: 'Triggers the workflow.' },
      { label: 'Schedule Workflow',    description: 'Schedules the workflow.' },
      { label: 'Clone Workflow',       description: 'Clones the workflow.' },
      // ── Hash reader + return pill (Concern 2) ──
      { label: 'Hash reader · #workflow=WF-XXX', description: 'On mount + hashchange, reads the workflow id from window.location.hash. Real id → selects that template. Unknown id → amber toast fallback. Hash cleared after read.' },
      { label: 'Click TrailReturnPill', description: 'Navigates back to Orders. The Trail re-opens on the same order and the same stage stays expanded.' },
    ],
    modals: [],
    pos: { x: COL[0], y: ROW[1] },
  },
  {
    id: 'inventory',
    group: 'core',
    label: 'Inventory',
    route: '/inventory',
    oneLine: 'Stock heartbeat + SKU workspace + audit mode + catalog.',
    purpose:
      'Two-mode workspace. Default center shows a Velocity Map. When a SKU is selected the center renders the Item Journey (with PAR watch, restock decision tree, pipeline visibility). Audit Mode expands this with a heartbeat group view and failure-intent surface. Catalog management lives behind a modal.',
    states: [
      { id: 'velocity-map', label: 'Velocity Map (default)', description: 'No SKU selected — consumption forecast vs actual, burn-rate bars.' },
      { id: 'sku',          label: 'SKU Selected',           description: 'Item Journey, PAR watch, restock decision tree.' },
      { id: 'sku-audit',    label: 'SKU + Audit Mode',       description: 'Expanded audit view with heartbeat groups + failure intents.' },
      { id: 'hardened',     label: 'Hardened Banner',        description: 'Floating "System Hardened — new safety threshold locked" banner after Set as Par Floor (3.2s auto-dismiss).' },
      { id: 'restock-dismissed', label: 'Restock Intent Dismissed', description: 'Amber alert on the selected SKU when RequestPanel dispatches `buyamia-restock-intent-failed` (user dismissed an inventory-prefilled restock).' },
    ],
    actions: [
      { label: 'Burn-rate bar', description: 'Selects a SKU.' },
      { label: 'Restock Now',   description: 'Triggers restock for the selected SKU.' },
      { label: 'Adjust',        description: 'Opens the Adjust Stock modal.' },
      { label: 'Add to Draft',  description: 'Adds the SKU to a draft PO.' },
      { label: 'Remove from Draft', description: 'Removes the SKU from the current draft.' },
      { label: 'Pipeline menu', description: 'Toggles the pipeline action menu.' },
      { label: 'AI / Manual mode toggle', description: 'Switches labor mode for the item.' },
      { label: 'Resume Agent',  description: 'Sets labor mode back to agent.' },
      { label: 'Open Stage Trace', description: 'Opens the Stage Trace modal.' },
      { label: 'Full Journey',  description: 'Exits Audit Mode and loads the full SKU workspace in the center panel (no cross-page nav).' },
      { label: 'Open PO in Orders', description: 'Deep-links the linked PO into Orders via `#order=PO-XXXX` hash; Orders\' hash-reader auto-selects the order on mount.', navigatesTo: 'orders' },
      { label: 'Dismiss Failed Intent', description: 'Clears a failed-intent banner.' },
      { label: 'Back to map',   description: 'Clears SKU selection.' },
      { label: 'Catalog Add Row', description: 'Opens Catalog management modal.' },
      { label: 'Catalog row edit/archive', description: 'Inline catalog mutations.' },
      { label: 'Open Governance (per-agent)', description: 'Jumps to Governance for the assigned agent.', navigatesTo: 'governance' },
      { label: 'New Request',   description: 'Starts a new procurement request.', navigatesTo: 'request' },
    ],
    modals: [
      { id: 'adjust-stock',     label: 'Adjust Stock',       description: 'Manual count form with +/-, note, validation.' },
      { id: 'stage-trace',      label: 'Stage Trace',        description: 'Read-only 12-stage journey history for the SKU.' },
      { id: 'catalog',          label: 'Catalog Management', description: 'Add / edit / archive SKU records.' },
      { id: 'command-palette',  label: '⌘K Command Palette', description: 'Search / select items.' },
    ],
    pos: { x: COL[1], y: ROW[1] },
  },
  {
    id: 'request',
    group: 'core',
    label: 'New Request',
    route: '/request',
    oneLine: '7-step wizard: Details → Items → Budget → Vendors → Delivery → Review → Done.',
    purpose:
      'Sourcing wizard. The center panel morphs entirely through 7 steps. On the Review step, "Authorize a new procurement" submits and routes the user to Orders. If a Group Buy pool matches, a confirmation modal appears.',
    states: [
      { id: 'step-1', label: 'Step 1 — Details',  description: 'Intent / context for the request.' },
      { id: 'step-2', label: 'Step 2 — Items',    description: 'Add line items with categories.' },
      { id: 'step-3', label: 'Step 3 — Budget',   description: 'Budget framing for the request.' },
      { id: 'step-4', label: 'Step 4 — Vendors',  description: 'Pick vendors from the internal directory.' },
      { id: 'step-5', label: 'Step 5 — Delivery', description: 'Logistics + delivery preferences.' },
      { id: 'step-6', label: 'Step 6 — Review',   description: 'Pre-submit summary; Authorize button lands here.' },
      { id: 'step-7', label: 'Step 7 — Done',     description: 'Confirmation; PO lands in Orders.' },
    ],
    actions: [
      { label: 'Step indicator', description: 'Backward step navigation.' },
      { label: 'Next',           description: 'Advance to the next step.' },
      { label: 'Back',           description: 'Return to the previous step.' },
      { label: 'Add item',       description: 'Adds a line item.' },
      { label: 'Remove item',    description: 'Removes a line item.' },
      { label: 'Suggested category tag', description: 'Filters by category.' },
      { label: 'Vendor checkbox', description: 'Toggle vendor selection.' },
      { label: 'Join Pool',      description: 'Opens the Group Buy Confirmation modal.' },
      { label: 'Authorize a new procurement', description: 'Submits the request and routes to Orders.', navigatesTo: 'orders' },
      { label: 'Atlas send',     description: 'Sends a message in the Atlas chat.' },
    ],
    modals: [
      { id: 'group-buy', label: 'Group Buy Confirmation', description: 'Pool details + Cancel / Confirm.' },
    ],
    pos: { x: COL[3], y: ROW[1] },
  },
  {
    id: 'suppliers',
    group: 'core',
    label: 'Suppliers',
    route: '/suppliers',
    oneLine: 'Ecosystem hub, relationship workspace, side-by-side comparison.',
    purpose:
      'Vendor relationship center. The center panel morphs from Ecosystem Hub (default — KPIs, performance matrix, distribution charts) to a Relationship Workspace when one supplier is selected, to a Comparison Matrix when comparison mode is active. A 12-stage Journey Task Module opens for per-relationship stage edits in manual mode.',
    states: [
      { id: 'hub',        label: 'Ecosystem Hub',          description: '4 KPI cards + performance matrix + category bar chart + status distribution.' },
      { id: 'workspace',  label: 'Relationship Workspace', description: 'One supplier selected — dossier, journey track, metrics radar, negotiation status.' },
      { id: 'compare',    label: 'Comparison Matrix',      description: 'Dual-supplier matrix overlay when comparison is active.' },
      { id: 'qc-alerts',  label: 'QC Failure Alerts',      description: 'Dismissible alerts at top of center panel when QC failures fire.' },
    ],
    actions: [
      { label: 'Category bar', description: 'Filters by category.' },
      { label: 'Onboard New Vendor (Fortress banner)', description: 'Routes to New Request as the Manual Discovery Portal — humans are the sole gateway for new vendor data.', navigatesTo: 'request' },
      { label: 'Full Workspace', description: 'Expands the relationship workspace.' },
      { label: 'Open Governance', description: 'Jumps to Governance for the relationship\'s agent.', navigatesTo: 'governance' },
      { label: 'Labor mode toggle (Agent / Manual)', description: 'Switches labor mode for the relationship.' },
      { label: 'Renegotiate Terms', description: 'Executes a renegotiation flow.' },
      { label: 'Trigger Compare',   description: 'Activates comparison mode.' },
      { label: 'Back to Ecosystem', description: 'Clears supplier selection.' },
      { label: 'Dossier toggle',    description: 'Opens / closes the dossier panel.' },
      { label: 'Metric filter buttons', description: 'Toggles radar-metric filters.' },
      { label: 'Bulk Compare', description: 'Multi-select comparison.' },
      { label: 'Broadcast',    description: 'Opens the Broadcast Drawer.' },
      { label: 'Export',       description: 'Exports selected suppliers.' },
      { label: 'Clear Selection', description: 'Clears audit checkboxes.' },
      { label: 'Kebab → View Journey / Compare / Broadcast / Download Dossier', description: 'Per-supplier kebab menu.' },
      { label: 'Journey stage node (manual)', description: 'Opens the Journey Stage Task Module.' },
      { label: 'Resume Agent', description: 'Returns relationship to agent mode.' },
      { label: 'Messaging channel toggle (WhatsApp / Telegram)', description: 'Switches messaging channel.' },
      { label: 'Send message', description: 'Sends a 1-on-1 message via the Messaging Drawer.' },
      { label: 'Send broadcast', description: 'Sends a multi-vendor announcement.' },
      { label: 'New Request (from vendor)', description: 'Starts a new procurement request with this vendor.', navigatesTo: 'request' },
    ],
    modals: [
      { id: 'journey-stage',  label: 'Journey Stage Task Module', description: 'Schema-driven inputs for a per-relationship stage.' },
      { id: 'messaging',      label: 'Messaging Drawer',          description: 'Secure 1-on-1 channel (WhatsApp / Telegram).' },
      { id: 'broadcast',      label: 'Broadcast Drawer',          description: 'Multi-vendor announcement composer.' },
    ],
    pos: { x: COL[4], y: ROW[1] },
  },

  // ════ Row 2 — cockpit ════════════════════════════════════
  {
    id: 'orders',
    group: 'core',
    label: 'Orders',
    route: '/orders',
    oneLine: 'The cockpit. Order lists, single-order journey, batch console, Audit Mode ledger.',
    purpose:
      'Cockpit for every PO. Left panel groups orders by status (Triage Mode) or expands to a historical ledger (Audit Mode). Center panel morphs through Default (scheduled / autonomous list), Single Order Journey (with 12-stage DAG), Batch Console (multi-select), and post-execute splashes — and collapses to 0 width while Audit Mode is active. Right panel hosts Atlas chat, the Source Bridge takeover, or — in Audit Mode — Operations Insights / Quick Journey.',
    states: [
      { id: 'default',          label: 'Default',              description: 'Scheduled + autonomous orders list.' },
      { id: 'single',           label: 'Single Order Journey', description: 'Two-column: detail card (with primary CTA + tertiary row) + 12-stage DAG.' },
      { id: 'batch',            label: 'Batch Selected',       description: 'Batch Console — approve / confirm / resolve counts across selected orders.' },
      { id: 'journey-complete', label: 'Journey Complete',     description: 'Single-order success splash with cost / labor savings.' },
      { id: 'batch-complete',   label: 'Batch Complete',       description: 'Batch finalization splash.' },
      { id: 'audit-mode',       label: 'Audit Mode',           description: 'Left panel expands to full width and surfaces the combined ledger of all 7 live + 40 historical orders. Center collapses. Right panel swaps to Operations Insights (no row selected) or Quick Journey (row selected). 380ms cubic-bezier spring transition. Escape collapses back when no row is selected.' },
      { id: 'attribution-trail',label: 'Decision Attribution Trail', description: 'Full-screen modal sheet listing all 12 stages with agent attribution, decision summary, confidence, data used, alternatives rejected, outcome, and any human override. Cross-page chips deep-link to Governance (Agent / Decision · DEC-XXX) and AI Activity (evt-XXX) — each chip drops a sessionStorage `buyamia-trail-return` marker so the destination renders a TrailReturnPill that brings the user back to the same stage. Entry points: Decision Trail button in the Single Order Journey header · Decision Trail button in the Audit Mode Quick Journey panel · direct click on a historical row in Audit Mode (historical orders have no live journey).' },
    ],
    actions: [
      { label: 'Clear selection', description: 'Clears the multi-select set.' },
      { label: '⌘K trigger',       description: 'Opens the Command Palette.' },
      { label: 'Track Shipment (⋯ menu)', description: 'Stage-gated; sets selection state — no live tracking integration yet.' },
      { label: 'Message Supplier (⋯ menu)', description: 'Opens the Source Bridge in the right panel.' },
      { label: 'Repeat Order (⋯ menu)', description: 'Stage-gated; opens the Draft Sheet pre-filled.' },
      { label: 'Re-order',         description: 'Carbon-copies a delivered order into New Request.', navigatesTo: 'request' },
      { label: 'Resume Agent',     description: 'Returns the order from Manual Takeover to agent mode.' },
      { label: 'Back to orders',   description: 'Clears single-order selection.' },
      { label: 'Advance Stage',    description: 'Advances the 12-stage DAG.' },
      { label: 'Execute Batch',    description: 'Runs the action across all selected orders.' },
      { label: 'Stage module — Save Draft',          description: 'Saves manual-mode stage entries.' },
      { label: 'Stage module — Save & Mark Complete',description: 'Saves and closes the stage module.' },
      { label: 'Draft Sheet — Submit', description: 'Creates a new order from the draft.' },
      { label: 'Chat send', description: 'Sends a message in the Atlas chat.' },
      { label: 'Managed by · Agent #XX', description: 'Tertiary link — jumps to that agent\'s Governance profile.', navigatesTo: 'governance' },
      // ── Audit Mode ──
      { label: 'Expand to Audit Mode', description: 'Maximize2 button in the left-panel header — expands the left panel to full width, collapses the center, swaps the right panel to Operations Insights.' },
      { label: 'Collapse Audit Mode',  description: 'Minimize2 button in the Audit header (or Escape key with no row selected) — returns to Triage Mode.' },
      { label: 'Audit search',         description: 'Search PO id / supplier / item / agent across all live + historical orders. Auto-focuses on entering Audit Mode.' },
      { label: 'Status filter chip',   description: 'Filter chips: All · Live · Completed · Disputed · Cancelled · On Hold — each shows a live count.' },
      { label: 'Date range preset',    description: 'Pill toggle: 7 days · 30 days · 90 days · All time. Filters against completedAt (or createdAt fallback).' },
      { label: 'Supplier filter',      description: 'Dropdown of every supplier present in the ledger.' },
      { label: 'Stage band filter',    description: 'Dropdown: Any stage · Procurement (0–3) · Processing (4–7) · Logistics (8–11).' },
      { label: 'Agent filter',         description: 'Dropdown of every assigned agent in the ledger.' },
      { label: 'Clear filters',        description: 'Resets all audit filters and search query at once.' },
      { label: 'Audit Select All',     description: 'Checkbox in the Audit toolbar — selects/clears all currently filtered rows.' },
      { label: 'Audit view toggle',    description: 'Switches the Audit content between Table and Grid layouts.' },
      { label: 'Export CSV',           description: 'Downloads orders-audit-YYYY-MM-DD.csv. Acts on the current selection if any rows are checked, otherwise exports the full filtered set.' },
      { label: 'Open audit row · live',       description: 'Clicking a live row collapses Audit Mode and loads the Single Order Journey in the center panel.' },
      { label: 'Open audit row · historical', description: 'Clicking a historical row keeps Audit Mode and surfaces a compact Quick Journey card in the right panel.' },
      { label: 'Top-supplier card · filter', description: 'Clicking a supplier in the Operations Insights right panel sets the supplier filter on the audit list.' },
      { label: 'Open Full Workspace (Quick Journey)', description: 'Snaps out of Audit Mode and loads the selected order\'s full journey in the center.' },
      // ── Decision Attribution Trail ──
      { label: 'Decision Trail (Journey header)',  description: 'Opens the Decision Attribution Trail sheet for the currently-selected live order. Button sits next to Re-order / LaborSwitch / ← All.' },
      { label: 'Decision Trail (Quick Journey)',   description: 'Same sheet, opened from the Audit Mode Quick Journey right panel when a live order is selected from the audit ledger.' },
      { label: 'Decision Trail (historical row)',  description: 'Clicking a historical row in Audit Mode opens the Trail directly — historical orders have no live single-order journey.' },
      { label: 'Expand stage card',                description: 'Click any stage header in the Trail to reveal its data points, alternatives rejected, override (if any), and cross-page deep-link chips.' },
      { label: 'Agents Involved chip',             description: 'Top-of-Trail chip per distinct agent. Click sets sessionStorage marker + navigates to Governance with #agent-NN; the TrailReturnPill renders on Governance for a one-click return.' },
      { label: 'Decision · DEC-XXX chip',          description: 'Per-stage chip. Sets sessionStorage marker + navigates to Governance with #decision=DEC-XXX (pool DEC-001..DEC-008). Governance scroll-flashes the matching ledger row.' },
      { label: 'AI Activity · evt-XXX chip',       description: 'Per-stage chip. Sets sessionStorage marker + navigates to AI Activity with #evt=evt-XXX (pool evt-001..evt-012). AI Activity scroll-flashes the matching event card.' },
      { label: 'Agent in Governance chip',         description: 'Per-stage chip — same destination as the Agents Involved chip but scoped to the stage\'s acting agent.' },
      { label: 'TrailReturnPill (on destination)', description: 'Floating "← Return to PO-XXXX · Stage N Trail" pill that appears on Governance / AI Activity / Workflows when the trail-return marker is present. Click → navigates back to Orders and re-opens the Trail at the same stage.' },
      // ── Workflow template surface (Concern 2) ──
      { label: 'Trail · Workflow chip',        description: 'Header chip "🧭 Workflow · {name}" on the Decision Attribution Trail. Drops trail-return marker → Workflows with #workflow=WF-XXX. Every order carries a workflowTemplate (8 ids: WF-STD / WF-RSH / WF-BPO / WF-GRP / WF-EMR / WF-PRD / WF-MNT / WF-CPX).' },
      { label: 'Audit Workflow filter',        description: 'Dropdown in the Audit Mode secondary filter row. Scopes the ledger to a single template id. Lives next to Supplier / Stage / Agent dropdowns.' },
      { label: 'Audit Workflow column',        description: 'New column in the Audit Mode table — blue pill per row with the template name; hover reveals the template description from workflowTemplates.' },
    ],
    modals: [
      { id: 'task-module',         label: 'Task Module Sheet',          description: '12-stage interactive sheet — Review or Execute mode.' },
      { id: 'draft-sheet',         label: 'Draft Sheet',                description: 'New / re-order draft form (recurring, frequency, labor assignment).' },
      { id: 'command-palette',     label: '⌘K Command Palette',         description: 'Fuzzy search across orders.' },
      { id: 'source-bridge',       label: 'Source Bridge',              description: 'Right-panel takeover — WhatsApp / Telegram supplier composer.' },
      { id: 'attribution-trail',   label: 'Decision Attribution Trail', description: 'Full-screen sheet — agents involved + 12 stage cards with agent attribution, decision, confidence, data points, alternatives rejected, outcome, override callout, and cross-page deep-link chips that drop a trail-return marker.' },
    ],
    pos: { x: COL[2], y: ROW[2] },
  },

  // ════ Row 3 — outputs ═══════════════════════════════════
  {
    id: 'spending',
    group: 'core',
    label: 'Spending',
    route: '/spending',
    oneLine: 'Category grid → category detail ledger. Budget setup modal.',
    purpose:
      'Default center is a 6-category grid. Selecting a category morphs to a category-detail view with a time-range filter (1M / 3M / 6M / 1Y), a ledger, and a "Lock Savings" action. Budget Setup modal walks first-time setup.',
    states: [
      { id: 'grid',     label: 'Categories Grid (default)', description: '7 category cards (Protein, Seafood, Produce, Dry Goods, Dairy, Beverages, Other), each with semantic color.' },
      { id: 'category', label: 'Category Detail',           description: 'Filtered ledger + time-range controls + Lock Savings.' },
    ],
    actions: [
      { label: 'Category card',    description: 'Opens Category Detail.' },
      { label: 'Back to all',      description: 'Returns to the grid.' },
      { label: 'Time range (1M / 3M / 6M / 1Y)', description: 'Filter the ledger.' },
      { label: 'Lock Savings',     description: 'Accumulates locked savings value.' },
      { label: 'Budget Setup',     description: 'Opens the Budget modal.' },
      { label: 'Atlas prompt suggestion', description: 'Pre-fills the chat with a question.' },
      { label: 'Atlas chat send',  description: 'Sends a message.' },
    ],
    modals: [
      { id: 'budget-setup', label: 'Category Budgets', description: 'Per-category budget inputs (6 fields) — Cancel / Save.' },
    ],
    pos: { x: COL[1], y: ROW[3] },
  },
  {
    id: 'ai-activity',
    group: 'core',
    label: 'AI Activity',
    route: '/ai-activity',
    oneLine: 'Unified activity feed. Capital efficiency, undo window, rollback modal.',
    purpose:
      'The receipts page. Single unified Activity Feed (no center morphing — the right panel changes on event selection). Capital Efficiency cards, the Undo Window Policy section (3 modes), and a Learning Phase banner when calibration is active. Rollback opens an intervene modal.',
    states: [
      { id: 'feed',     label: 'Activity Feed',  description: 'Unified center — event timeline + always-visible KPI cards + undo policy.' },
      { id: 'warmup',   label: 'Learning Phase', description: 'Banner shown when isWarmingUp (events < 25).' },
    ],
    actions: [
      { label: 'Confidence filter', description: 'Filter the feed by confidence band.' },
      { label: 'Event type filter', description: 'Filter by event type.' },
      { label: 'Clear filters',     description: 'Resets confidence / type filters.' },
      { label: 'Adjust autonomy per category', description: '+/- the per-category autonomy.' },
      { label: 'Approve Today\'s Ledger', description: 'Locks the day\'s ledger.' },
      { label: 'Undo mode (Hard 60-min / Ledger-close / Per-class)', description: 'Switches the global undo policy.' },
      { label: 'Event card',        description: 'Selects the event — right panel updates.' },
      { label: 'Agent Governance',  description: 'Opens the agent\'s Governance profile.', navigatesTo: 'governance' },
      { label: 'View Source',       description: 'Jumps to the originating page (orders / suppliers / governance / inventory) depending on event type.' },
      { label: 'Explain Logic',     description: 'Focuses the right panel on the event.' },
      { label: 'Rollback',          description: 'Opens the Rollback & Intervene modal.' },
      { label: 'Suspend / Resume Agent', description: 'Toggles agent suspension.' },
      { label: 'Edit data point',   description: 'Inline edit on an event data point.' },
      { label: 'Save / Cancel edit',description: 'Commit or discard the inline edit.' },
    ],
    modals: [
      { id: 'rollback', label: 'Rollback & Intervene', description: 'Choose "Fix & Re-run" or "Manual Takeover" for an event.' },
    ],
    pos: { x: COL[2], y: ROW[3] },
  },
  {
    id: 'governance',
    group: 'agents',
    label: 'Governance',
    route: '/governance',
    oneLine: 'Control planes, decision ledger, disputes, policy creator.',
    purpose:
      'The HR + policy office for the agent workforce. Center surfaces a Control Plane Detail, a Reasoning Chain Panel (when a decision is opened), the Decision Ledger, and the Dispute Panel. Policy Creator modal authors system-wide rules. Dispute Panel can route the user back to Orders ("Resume Order").',
    states: [
      { id: 'ledger',          label: 'Decision Ledger',          description: 'Reverse-chronological list of decisions; rows open Reasoning Chain.' },
      { id: 'control-plane',   label: 'Control Plane Detail',     description: '4 control planes (CP-POL / CP-ECO / CP-TRU / CP-SIM) with stats + governing agents.' },
      { id: 'empty-rules',     label: 'Empty Rules (first-run)',  description: 'Dashed-border card when ruleCount === 0 — "Add First Rule" CTA.' },
      { id: 'reasoning-chain', label: 'Reasoning Chain Panel',    description: 'Inline panel — step-by-step trace for one decision.' },
      { id: 'disputes-open',   label: 'Open Dispute',             description: 'Dispute card with Approve / Reject / Escalate buttons.' },
      { id: 'disputes-harden', label: 'Post-Approval Harden',     description: 'Sage callout offering "Harden Policy — Set as Precedent" + "Resume Order".' },
      { id: 'disputes-precedent', label: 'Precedent Set',         description: '"Precedent Set — policy hardened" confirmation bar.' },
    ],
    actions: [
      { label: 'Take a tour',          description: 'Starts the driver.js onboarding tour.' },
      { label: 'Control plane select', description: 'Opens the Control Plane Detail in center.' },
      { label: 'Add Rule / Add First Rule', description: 'Opens the Policy Creator modal.' },
      { label: 'Policy template select',description: 'Picks Spend Cap / Vendor Trust Floor / Fraud Hold / Delivery SLA inside the Policy Creator.' },
      { label: 'Create Rule',          description: 'Closes the Policy Creator (UI-only — no backend wire yet).' },
      { label: 'Loss category filter chips', description: 'LC-FRD / LC-WST / LC-ERR / LC-DLY / LC-NCO filter the ledger.' },
      { label: 'Decision ledger row',  description: 'Click underlined agent name → opens Reasoning Chain Panel.' },
      { label: 'Override decision',    description: 'Override button in the Action column.' },
      { label: 'External link icon',   description: 'Navigates to AI Activity scoped to that decision.' },
      { label: 'Approve / Reject / Escalate dispute', description: 'Three buttons on an open dispute card.' },
      { label: 'Harden Policy — Set as Precedent', description: 'Locks the override in as a standing policy rule.' },
      { label: 'Resume Order (Dispute Panel)', description: 'Routes back to Orders for the disputed order.', navigatesTo: 'orders' },
    ],
    modals: [
      { id: 'policy-creator', label: 'Policy Creator', description: 'Template picker + rule config form.' },
    ],
    pos: { x: COL[3], y: ROW[3] },
  },

  // ════ Row 4 — engine room ═══════════════════════════════
  {
    id: 'nerve-center',
    group: 'agents',
    label: 'Nerve Center',
    route: '/nerve-center',
    oneLine: 'Control room: 40 agents, 12-stage DAG, stress gauges, autonomy ceiling.',
    purpose:
      'Real-time control room for the entire AI workforce. Left panel: AgentGrid with 5 cohorts (SEN, REA, EXE, GOV, MET) and a System Status Bar (HEALTH + STRESS gauges). Center: 12-stage Logic DAG with bottleneck highlighting, Active Thinking Panel, Live Metrics, and the global L0–L5 autonomy slider. Right panel: AgentClassSheet when a class is selected.',
    states: [
      { id: 'dag-default',    label: 'DAG Default',          description: '12-stage DAG with sage pulse + Live Metrics + Autonomy Cap.' },
      { id: 'class-filter',   label: 'Class Filtered',       description: 'A cohort is selected — non-relevant stages ghost; class-specific metrics show.' },
      { id: 'thinking-panel', label: 'Active Thinking Panel',description: 'Opens beneath a clicked stage — description, signal chips, INTERVENTIONS row.' },
      { id: 'soft-stress',    label: 'Soft Stress',          description: 'Amber banner when stress > 85% and anomalies ≤ 300 — dismissible Cool Down offer.' },
      { id: 'urgent-stress',  label: 'Urgent Stress',        description: 'Red banner when stress > 85% AND anomalies > 300 — non-dismissible.' },
      { id: 'user-constrained',label: 'User Constrained',    description: 'SEN-001/002/003 cards show "User Constrained · Signal Sensitivity X%" when hard-locked.' },
    ],
    actions: [
      { label: 'Take a tour',        description: 'Starts the driver.js onboarding tour.' },
      { label: 'Filter cohort',      description: 'Click cohort name to filter all panels.' },
      { label: 'Expand / collapse cohort', description: 'Chevron toggle on a cohort row.' },
      { label: 'Open Agent Class Sheet', description: 'Click a cohort filter to take over the right panel.' },
      { label: 'Inspect stage',      description: 'Click a DAG node → opens the Active Thinking Panel.' },
      { label: 'Force Approval',     description: 'Bottleneck intervention — overrides current block.' },
      { label: 'Scale Workforce',    description: 'Spin up more agents at a bottleneck.' },
      { label: 'Cool Down Stage',    description: 'Pause a single stage.' },
      { label: 'Pre-emptive Cool Down', description: 'Cool the whole system from the soft banner.' },
      { label: 'Emergency Cool Down',   description: 'Forced system-wide cooldown via the urgent banner.' },
      { label: 'Dismiss soft banner',   description: 'Closes the amber stress banner.' },
      { label: 'Set global autonomy',description: 'Click any L0–L5 segment on the master slider.' },
    ],
    modals: [
      { id: 'class-sheet', label: 'Agent Class Sheet', description: 'Right-panel takeover showing detailed class information.' },
    ],
    pos: { x: COL[0], y: ROW[4] },
  },
  {
    id: 'global-ops',
    group: 'agents',
    label: 'Global Operations',
    route: '/global-ops',
    oneLine: 'Regional drill-down with country / industry view toggle.',
    purpose:
      'Single RegionalDrillDown rendering driven by a viewMode toggle (country vs industry) in the left CountryIndustryList.',
    states: [
      { id: 'regional', label: 'Regional Drill-down', description: 'Single center rendering — viewMode toggles between country and industry.' },
    ],
    actions: [
      { label: 'View toggle (country / industry)', description: 'Switches the regional view.' },
      { label: 'Select id',                        description: 'Selects a country or industry to focus.' },
    ],
    modals: [],
    pos: { x: COL[1], y: ROW[4] },
  },
  {
    id: 'intelligence',
    group: 'agents',
    label: 'Intelligence',
    route: '/intelligence',
    oneLine: '8 AI-performance KPIs with full audit trails + supplier promise tracker.',
    purpose:
      'AI procurement performance dashboard. 8 metric cards (TM-01 → TM-08, Autonomous Spend %, Auto-Execution Rate, Manual Touches, Labor Hours, Stockouts, Realized Savings, Working Capital, Exception Trend). Clicking a card opens the Metric Audit Trail panel (which agent moved which number). TM-08 has an inline Sensitivity Slider. Supplier Promise Engine table with Stop/Resume Auto-Orders. Logistics History Panel shows the 12-stage order journey for a supplier when their delivery/quality score is clicked.',
    states: [
      { id: 'metrics',     label: 'Metric Grid (default)',  description: '8 metric cards + sparklines + TM-08 sensitivity slider.' },
      { id: 'metric-audit',label: 'Metric Audit Trail',     description: 'Inline panel — 4 agent entries showing what drove the metric.' },
      { id: 'promise',     label: 'Supplier Promise Engine',description: 'Always-visible table with delivery/quality scores + Stop/Resume.' },
      { id: 'logistics',   label: 'Logistics History',      description: 'Inline panel — 12-stage order journey for a selected supplier.' },
    ],
    actions: [
      { label: 'Take a tour',         description: 'Starts the onboarding tour.' },
      { label: 'Open metric audit',   description: 'Click a metric card → opens the audit trail panel.' },
      { label: 'Close audit / logistics', description: 'Closes the inline panel.' },
      { label: 'Sensitivity slider',  description: 'TM-08 — drag between "Catch Everything" and "Only Major Issues".' },
      { label: 'Open supplier journey', description: 'Click a delivery/quality score → opens Logistics History.' },
      { label: 'Stop Auto-Orders',    description: 'Pauses AI auto-ordering from a supplier (e.g. GreenHarvest).' },
      { label: 'Resume Auto-Orders',  description: 'Re-enables AI auto-ordering.' },
      { label: 'Investigate (right panel)', description: 'Right-panel CTA → opens GreenHarvest logistics history in center.' },
      { label: 'Authorize Pivot (right panel)', description: 'Right-panel CTA → pauses GreenHarvest auto-orders system-wide.' },
    ],
    modals: [],
    pos: { x: COL[2], y: ROW[4] },
  },
  {
    id: 'infrastructure',
    group: 'agents',
    label: 'Infrastructure',
    route: '/infrastructure',
    oneLine: 'DAG kernel schematic, deployment queue, audit log, rail connector.',
    purpose:
      'Four sections: DAG Kernel Schematic (5 nodes), Deployment Queue (5 build phases with auth state), Tamper-Proof Audit Log, and a conditional Lockdown Banner. Payment Rail Connector modal selects which payment rails route which spend.',
    states: [
      { id: 'dag',         label: 'DAG Kernel Schematic', description: '5-node schematic with action levers.' },
      { id: 'queue',       label: 'Deployment Queue',     description: '5 build-phase timeline (complete / active / needs-auth / authorized / locked).' },
      { id: 'audit-log',   label: 'Tamper-Proof Audit Log', description: 'Stats + seal status + actions.' },
      { id: 'lockdown',    label: 'Lockdown Banner',      description: 'Conditional banner when tamper is simulated.' },
    ],
    actions: [
      { label: 'DAG node click',       description: 'Toggles the node action panel.' },
      { label: 'Overclock / Rebalance / Scale / Audit', description: 'Per-node intervention buttons.' },
      { label: 'Start Build Phase N',  description: 'Authorizes the next deployment phase.' },
      { label: 'Simulate Tamper',      description: 'Triggers the lockdown state.' },
      { label: 'Connect / Manage Payment Rails', description: 'Opens the Rail Connector modal.' },
    ],
    modals: [
      { id: 'rail-connector', label: 'Payment Rail Connector', description: 'Multi-select payment-rail provider list.' },
    ],
    pos: { x: COL[3], y: ROW[4] },
  },
];

// ───────────────────────────────────────────────────────────
// EDGES — every entry verified against actual onNavigate calls.
// ───────────────────────────────────────────────────────────

// EDGE TAXONOMY:
//   nav  (sage)  — user clicks something that calls `onNavigate(page)` directly.
//                  May carry hash context picked up by the target's hash-reader.
//   data (blue)  — system silently pushes state into a target page's listener.
//                  No route change. Target page just absorbs the new state
//                  and surfaces it the next time the user visits.
//   event (amber)— system fires the global `buyamia-navigate-page` CustomEvent;
//                  App.tsx promotes any payload (decisionId / evtId / agentId
//                  / orderId) into the matching URL hash before flipping pages.
//
// HASH-CONTEXT CONTRACT — receivers read on mount + `hashchange`:
//   • `#order=PO-XXXX`     — Orders auto-selects the PO (NewOrdersPage)
//   • `#agent-NN`          — Governance fires a toast + stores `incomingAgentId`
//   • `#decision=DEC-XXX`  — Governance opens the Reasoning Chain panel,
//                            scroll-into-views the matching row in the
//                            Decision Ledger, and flashes it sage (real ids).
//                            Unknown ids → amber toast fallback.
//   • `#evt=eventId`       — AI Activity selects the event, scroll-into-views
//                            the card, and flashes it sage (real ids).
//                            Unknown ids → amber toast fallback.
//   • `#workflow=WF-XXX`   — Workflows sets `selectedWorkflow` to that template
//                            (one of WF-STD / WF-RSH / WF-BPO / WF-GRP / WF-EMR
//                            / WF-PRD / WF-MNT / WF-CPX). Unknown ids → amber
//                            toast fallback.
//   • `#restock=...` / `#intent=express&mode=...` — RequestPanel jumps step
//
// TRAIL-RETURN CONTRACT (sessionStorage `buyamia-trail-return`, 30-min TTL):
//   When the Orders Decision Attribution Trail dispatches a cross-page
//   chip (Agent in Governance / Decision · DEC-XXX / AI Activity · evt-XXX),
//   it persists `{ orderId, stageIdx, savedAt }` to sessionStorage BEFORE
//   navigating. The destination page reads the marker on mount and renders
//   a fixed-position `TrailReturnPill` ("← Return to PO-XXXX · Stage N
//   Trail"). Clicking the pill calls `onNavigate('orders')`; NewOrdersPage
//   reads the marker on mount, re-opens the Trail on the same order with
//   the same stage expanded, and clears the marker. Lives in
//   `src/lib/trailReturn.ts` + `src/components/TrailReturnPill.tsx`.
export const EDGES: FlowEdgeData[] = [
  // ── From Orders
  { id: 'or-go', source: 'orders',     target: 'governance', kind: 'nav',
    label:  'Managed by · Trail',
    detail: 'Two sources: (1) tertiary "Managed by · Agent #XX →" link on the order journey header — sets #agent-NN; (2) Decision Attribution Trail chips ("Agent in Governance" and "Decision · DEC-XXX") — set #agent-NN or #decision=DEC-XXX from the real seeded pool DEC-001..DEC-008. The Trail chips also drop the sessionStorage marker so Governance renders the TrailReturnPill back to the Trail.' },
  { id: 'or-ai', source: 'orders',     target: 'ai-activity', kind: 'nav',
    label:  'Trail · evt chip',
    detail: 'Decision Attribution Trail "AI Activity · evt-XXX" chip. Sets #evt=evt-XXX picked deterministically from the real seeded pool evt-001..evt-012 and drops the trail-return sessionStorage marker. AI Activity scroll-flashes the matching event card and renders the return pill.' },
  { id: 'or-wf', source: 'orders',     target: 'workflows',   kind: 'nav',
    label:  'Trail · Workflow chip',
    detail: 'Decision Attribution Trail header "🧭 Workflow · {name}" chip. Sets #workflow=WF-XXX (one of WF-STD / WF-RSH / WF-BPO / WF-GRP / WF-EMR / WF-PRD / WF-MNT / WF-CPX from lib/mockData.ts workflowTemplates) and drops the trail-return marker. Workflows auto-selects that template; the TrailReturnPill renders for a one-click return.' },
  { id: 'or-rq', source: 'orders',     target: 'request',    kind: 'nav',
    label:  'Re-order',
    detail: 'Re-order button on a delivered PO (or Stage 12 trace). Sets #intent=express&mode=reorder&from=...&vendor=...&items=... — RequestPanel jumps to Step 6 pre-filled.' },
  { id: 'or-su', source: 'orders',     target: 'suppliers',  kind: 'data',
    label:  'QC Failure',
    detail: 'Stage 5 (Quality Check) outcome=fail dispatches the buyamia-qc-failure CustomEvent. SuppliersPage listens and pushes an amber alert card into qcFailureAlerts state. No navigation — the alert surfaces next time the user visits Suppliers.' },

  // ── From Inventory
  { id: 'in-or', source: 'inventory',  target: 'orders',     kind: 'nav',
    label:  'Open PO',
    detail: 'Inventory Phase 2 "Open [PO-XXXX] in Orders" buttons (stream switcher, Stage Trace modal). Sets #order=PO-XXXX and calls onNavigate("orders") — Orders auto-selects the PO on mount.' },
  { id: 'in-rq', source: 'inventory',  target: 'request',    kind: 'nav',
    label:  'Restock Now',
    detail: 'Restock Now / Quick Restock action. Sets #restock=SKU&items=...&vendor=... and navigates — RequestPanel reads the hash, jumps to Step 4, sets urgency=urgent.' },
  { id: 'in-go', source: 'inventory',  target: 'governance', kind: 'nav',
    label:  'Agent profile',
    detail: 'Per-SKU Governance link routes to that SKU\'s assigned agent. Sets #agent-NN.' },

  // ── From Suppliers
  { id: 'su-go', source: 'suppliers',  target: 'governance', kind: 'nav',
    label:  'Open Governance',
    detail: 'Peek-sheet "Managed by Agent #XX · Role" link and audit-mode kebab navigations. Sets #agent-NN.' },
  { id: 'su-rq', source: 'suppliers',  target: 'request',    kind: 'nav',
    label:  'Onboard Vendor',
    detail: 'Fortress banner "Onboard New Vendor" button — routes to New Request as the Manual Discovery Portal (humans are the sole gateway for new vendor data).' },

  // ── From New Request
  { id: 'rq-or', source: 'request',    target: 'orders',     kind: 'nav',
    label:  'Authorize PO',
    detail: 'Step 6 "Authorize & Deploy Agent". Toasts the new PO, advances to Step 7, then after a 1.4s celebratory delay sets #order=PO-XXXX and calls onNavigate("orders").' },
  { id: 'rq-in', source: 'request',    target: 'inventory',  kind: 'data',
    label:  'Restock Dismissed',
    detail: 'Dismissing the inventory-prefilled banner on RequestPanel dispatches the buyamia-restock-intent-failed CustomEvent. NewInventoryPage listens and pushes an amber banner onto the affected SKU\'s restock DAG. No navigation.' },

  // ── From AI Activity (event-source mapping by event type)
  { id: 'ai-or', source: 'ai-activity', target: 'orders',     kind: 'nav',
    label:  'View · auto-order',
    detail: '"View Source" button on auto-order / group-buy events. Sets #evt=eventId and calls onNavigate("orders").' },
  { id: 'ai-su', source: 'ai-activity', target: 'suppliers',  kind: 'nav',
    label:  'View · sourcing',
    detail: '"View Source" button on sourcing / rejection events. Navigates to Suppliers.' },
  { id: 'ai-go', source: 'ai-activity', target: 'governance', kind: 'nav',
    label:  'Agent Governance',
    detail: '"Open in Governance" / agent ID button on any event. Sets #agent-NN.' },
  { id: 'ai-in', source: 'ai-activity', target: 'inventory',  kind: 'nav',
    label:  'View · forecast',
    detail: '"View Source" button on forecast events. Navigates to Inventory.' },

  // ── From Governance
  { id: 'go-or', source: 'governance', target: 'orders',     kind: 'nav',
    label:  'Resume Order',
    detail: 'DisputePanel "Resume Order → PO-XXXX" button shown after a dispute is approved. Direct onNavigate("orders") — no hash.' },
  { id: 'go-ai', source: 'governance', target: 'ai-activity', kind: 'event',
    label:  'External link',
    detail: 'Decision Ledger row external-link icon dispatches the buyamia-navigate-page CustomEvent with { page: "ai-activity", decisionId }. App.tsx promotes the payload to #decision=DEC-XXX before flipping pages.' },
];
