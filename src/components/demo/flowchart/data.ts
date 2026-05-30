/**
 * Finn's Beach Club — System Map data.
 *
 * Every entry here is verified against the actual React component source.
 * 8 pages, 14 cross-page edges. Last audit: 2026-05-29.
 *
 * ACCURACY POLICY: only include states/actions/modals that exist in
 * rendered JSX. Do not document future plans here.
 */

// ── Type definitions ──────────────────────────────────────────────────

type PageGroup = 'core' | 'agents';

interface PageState   { id: string;  label: string; description: string }
interface PageAction  { label: string; description: string; navigatesTo?: string }
interface PageModal   { id: string;  label: string; description: string }

export interface PageNodeData {
  id:       string;
  group:    PageGroup;
  label:    string;
  route:    string;
  oneLine:  string;
  purpose:  string;
  states:   PageState[];
  actions:  PageAction[];
  modals:   PageModal[];
  pos:      { x: number; y: number };
}

interface FlowEdgeData {
  id:     string;
  source: string;
  target: string;
  kind:   'nav' | 'data' | 'event';
  label:  string;
  detail: string;
}

// ── Layout ───────────────────────────────────────────────────────────
// Topology mirrors PLATFORM-MAP.md § 1:
//   Row 0 (top):     Overview
//   Row 1 (inputs):  Inventory · New Request · Suppliers · Workflows
//   Row 2 (cockpit): Orders
//   Row 3 (outputs): Spending · Activity & Governance

const COL = [0, 300, 600, 900];   // 4 columns, 300px stride
const ROW = [0, 260, 520, 780];   // 4 rows, 260px stride

// ── Pages ────────────────────────────────────────────────────────────

export const PAGES: PageNodeData[] = [

  // ════ Row 0 — morning landing ════════════════════════════════════
  {
    id: 'overview',
    group: 'core',
    label: 'Overview',
    route: '/overview',
    oneLine: 'Morning dashboard — triage queue, analytics, logistics calendar.',
    purpose:
      'Top-of-funnel landing page. Left panel: Triage Queue (critical actions requiring decision) + System Alerts (threshold-based). Center: morphs between Analytics (KPI cards + spending trend chart), Logistics Calendar (month / week / agenda), Event Detail, and PO Workspace. Right panel: Atlas with Live Agent Activity, context questions, Autonomous Actions Today, and chat pinned bottom. Quick Approve on system alerts has a "Queuing…" pending state (1.2s) before confirming. PO Workspace Approve transitions to "Submitted · Pending vendor ack" in the triage queue for 2s before fully resolving.',
    states: [
      { id: 'analytics',    label: 'Analytics (default)',   description: '4 KPI cards (Month\'s Spend, Active Orders, Low Stock, AI Savings MTD) + Monthly Spending Trend chart with Spend Watchdog confidence band.' },
      { id: 'calendar-m',   label: 'Calendar — Month',      description: 'Month grid of logistics events (deliveries, expirations, restock deadlines).' },
      { id: 'calendar-w',   label: 'Calendar — Week',       description: 'Week view with event rows.' },
      { id: 'calendar-a',   label: 'Calendar — Agenda',     description: 'Chronological list of upcoming events.' },
      { id: 'event-detail', label: 'Event Detail',          description: 'Event header + mini 5-stage DAG for the linked PO + Atlas reasoning snippet + Clear Deadline button.' },
      { id: 'po-workspace', label: 'PO Workspace',          description: 'Compact PO journey view. Approve transitions to "Submitted · Pending vendor ack" amber state (2s) before fully clearing.' },
    ],
    actions: [
      { label: 'Performance toggle',       description: 'Switch center to Analytics view.' },
      { label: 'Logistics Calendar toggle',description: 'Switch center to Calendar view.' },
      { label: 'Calendar sub-toggle (Month / Week / Agenda)', description: 'Switch calendar layout.' },
      { label: 'Event card',               description: 'Opens Event Detail in center.' },
      { label: 'Clear Deadline',           description: 'Confirms / closes the deadline.' },
      { label: 'PO card (Triage Queue)',   description: 'Opens PO Workspace in center.' },
      { label: 'Quick Approve (system alert)', description: 'Adds to pendingQuickIds for 1.2s (shows amber "Queuing restock…" with bouncing dots), then confirms green "Queued ✓".' },
      { label: 'Approve (PO Workspace)',   description: 'Brief fly-out animation → "Submitted · Pending vendor ack" amber card for 2s → card disappears. Atlas posts "Pending vendor acknowledgement via WhatsApp."' },
      { label: 'Atlas chat send',          description: 'Sends a message to Atlas.' },
    ],
    modals: [],
    pos: { x: COL[1] + 150, y: ROW[0] },
  },

  // ════ Row 1 — input surfaces ══════════════════════════════════════
  {
    id: 'inventory',
    group: 'core',
    label: 'Inventory',
    route: '/inventory',
    oneLine: 'Stock heartbeat + SKU workspace + audit mode + catalog management.',
    purpose:
      'Two-mode workspace. Default center: Velocity Map (consumption forecast vs actual, burn-rate bars, venue split). SKU selected: Item Journey (5-stage DAG of latest PO), PAR Watch with digital-twin slider, Restock Decision Tree, Pipeline Visibility, venue consumption split. Audit Mode expands the SKU ledger full-width.',
    states: [
      { id: 'velocity-map',    label: 'Velocity Map (default)',  description: 'No SKU selected — consumption forecast chart, burn-rate bars, venue split.' },
      { id: 'sku-workspace',   label: 'SKU Workspace',          description: 'Item Journey (5-stage DAG), PAR Watch slider, Restock Decision Tree, Pipeline Visibility, venue consumption split.' },
      { id: 'audit-mode',      label: 'Audit Mode',             description: 'Full-width SKU ledger with category / venue / status / agent filters. Right panel: Macro Portfolio Insights (no SKU selected) or Quick Journey Viewer (SKU selected).' },
      { id: 'hardened-banner', label: 'Hardened Banner',        description: 'Auto-dismissing "System Hardened — new safety threshold locked" banner after Set as Par Floor.' },
    ],
    actions: [
      { label: 'Burn-rate bar click',     description: 'Selects a SKU.' },
      { label: 'Restock Now',             description: 'Routes to New Request prefilled.', navigatesTo: 'request' },
      { label: 'Adjust Stock',            description: 'Opens Adjust Stock modal.' },
      { label: 'Add to Draft',            description: 'Appends SKU to current draft PO.' },
      { label: 'AI / Manual mode toggle', description: 'Switches labor mode for the SKU.' },
      { label: 'Set as Par Floor',        description: 'Locks slider value as new parFloor. Shows Hardened Banner for 3.2s.' },
      { label: 'Open Stage Trace',        description: 'Opens Stage Trace modal.' },
      { label: 'Open PO in Orders',       description: 'Sets #order=PO-XXXX, navigates to Orders.', navigatesTo: 'orders' },
      { label: 'Open Activity (per-agent)', description: 'Sets #agent-NN, navigates to Activity & Governance.', navigatesTo: 'activity' },
      { label: 'New Request',             description: 'Starts new procurement request.', navigatesTo: 'request' },
    ],
    modals: [
      { id: 'adjust-stock', label: 'Adjust Stock',          description: 'Manual count form with +/- stepper, note field, validation.' },
      { id: 'stage-trace',  label: 'Stage Trace',           description: 'Read-only 5-stage journey for the SKU\'s latest PO. "Open PO in Orders" link at bottom.' },
      { id: 'catalog',      label: 'Catalog Management',    description: 'Add / edit / archive SKU records. Inline edit, soft-delete with audit.' },
      { id: 'cmd-k',        label: '⌘K Command Palette',   description: 'Fuzzy search across all SKUs.' },
    ],
    pos: { x: COL[0], y: ROW[1] },
  },

  {
    id: 'request',
    group: 'core',
    label: 'New Request',
    route: '/request',
    oneLine: '5-step sourcing wizard. Quick Pick catalog, Atlas Quantity Check on Step 4.',
    purpose:
      'Sourcing wizard with 5 steps. Step 1: line items with smart-detect autocomplete + Quick Pick catalog (browsable grid of finnsSKUs with par-gap default qty). Step 2: vendor directory (Path A direct, Path B RFQ). Step 3: delivery details. Step 4: review with Atlas Quantity Check (fuzzy-matches basket to SKUs, surfaces quantity suggestions ≥20% above ordered qty, Accept per item or Accept all). Step 5: confirmation. Per-PO autonomy picker on Step 1 drives auto/manual label on Step 4 Authorize button.',
    states: [
      { id: 'step-1', label: 'Step 1 — Items',    description: 'Request name + line items table with smart-detect autocomplete (A-01 fills category/unit/venues). Quick Pick catalog grid below (filterable by item name, adds at par-gap qty). Per-PO autonomy picker. Playbook selector. Atlas inline: Market Price Trends + Suggested Items.' },
      { id: 'step-2', label: 'Step 2 — Vendors',  description: 'Path A: approved directory with relevance ranking, coverage chips, "PO Hold" warning on held vendors. Path B: RFQ Composer + waiting view with live quote arrivals and Award per vendor.' },
      { id: 'step-3', label: 'Step 3 — Delivery', description: 'Target venue chips, delivery window, receiving contact. Atlas Logistics Intel inline.' },
      { id: 'step-4', label: 'Step 4 — Review',   description: 'Atlas Quantity Check card (per-item Accept/Dismiss/Accept all, collapses to "All quantities reviewed" pill when done). Atlas Ready to Launch/Review Before Launch banner. Authorize Procurement summary. Audit Checklist. Authorize button copy adapts to autonomy choice.' },
      { id: 'step-5', label: 'Step 5 — Done',     description: 'Confirmation splash. Routes to Orders after 1.4s.' },
    ],
    actions: [
      { label: 'Add Item',                  description: 'Step 1: adds a line item to the basket.' },
      { label: 'Quick Pick tile click',     description: 'Step 1: adds the catalog SKU to basket at par-gap qty. Disabled if already in basket (shows "✓ added").' },
      { label: '+/- qty stepper (basket)',  description: 'Step 1: increments/decrements item qty on existing basket rows.' },
      { label: 'Smart-detect chip click',   description: 'Accepts A-01\'s category/unit/venue autofill.' },
      { label: 'Per-PO autonomy button',    description: 'Sets poAutonomy (auto / manual) for this PO.' },
      { label: 'Playbook chip',             description: 'Sets WF-STD / WF-RSH / WF-REC.' },
      { label: 'Path picker (Pick / RFQ)',  description: 'Sets sourcingPath on Step 2.' },
      { label: 'Atlas Quantity Check — Accept', description: 'Updates the line item qty to suggested value. "Accept all ✓" bulk-accepts all.' },
      { label: 'Atlas Quantity Check — Dismiss', description: 'Hides that item\'s suggestion row.' },
      { label: 'Authorize',                 description: 'Mints PO(s), advances to Step 5. Routes to Orders.', navigatesTo: 'orders' },
    ],
    modals: [
      { id: 'rfq-composer', label: 'RFQ Composer',      description: 'Category-aware vendor picker, sends RFQ via WhatsApp/email.' },
      { id: 'rfq-tracker',  label: 'RFQ Tracker',       description: 'Standalone in-flight RFQ list with multi-award flow.' },
    ],
    pos: { x: COL[1], y: ROW[1] },
  },

  {
    id: 'suppliers',
    group: 'core',
    label: 'Suppliers',
    route: '/suppliers',
    oneLine: 'Vendor ecosystem hub — QC alerts with Hold/Adjust, Atlas right panel.',
    purpose:
      'Vendor relationship center. Center morphs from Ecosystem Hub (default — KPIs, performance matrix, category bars) to Relationship Workspace (single supplier) to Comparison Matrix. QC failure alerts from Orders appear at the top of the center with three action buttons. Supplier sidebar cards show "HOLD" chip and adjusted score when applicable. Right panel: Atlas with Network Overview / Relationship ROI / Bulk Action / Comparative Delta modes + context questions + chat pinned bottom.',
    states: [
      { id: 'ecosystem',    label: 'Ecosystem Hub (default)', description: '4 KPI cards + performance matrix scatter + category reliability bars.' },
      { id: 'relationship', label: 'Relationship Workspace',  description: 'Single supplier — dossier, journey track, metrics radar, negotiation status, venues served. Red "PO Hold active" banner if supplier is held.' },
      { id: 'comparison',   label: 'Comparison Matrix',       description: 'Dual-supplier comparison overlay.' },
      { id: 'qc-alerts',    label: 'QC Failure Alerts',       description: 'Dismissible amber alert cards at top of center with three actions: Hold Next PO (toggleable, persisted to localStorage), Adjust Score (inline -5/-10/-15 picker + reason field), Dismiss.' },
    ],
    actions: [
      { label: 'Hold Next PO',             description: 'Adds supplier to heldSuppliers (localStorage). HOLD chip appears on sidebar card. Red "PO Hold active" banner shows in Relationship Workspace. New Request Step 2 shows "PO Hold" warning chip on held vendors.' },
      { label: 'Adjust Score ▼',           description: 'Expands inline form — deduct preset (-5/-10/-15), reason field. Apply logs vendor-renegotiate, updates sidebar score badge.' },
      { label: 'Dismiss (QC alert)',       description: 'Removes the alert card.' },
      { label: 'Remove Hold',             description: 'Lifts the PO hold from the workspace banner. Logs vendor-resume.' },
      { label: 'Open Secure Bridge',       description: 'Opens Messaging Drawer (WhatsApp/Email).' },
      { label: 'Trigger Compare',          description: 'Activates Comparison Matrix.' },
      { label: 'Renegotiate Terms',        description: 'Opens Renegotiation Modal (5-step).' },
      { label: 'Open Activity (agent)',    description: 'Navigates to Activity & Governance for the vendor\'s assigned agent.', navigatesTo: 'activity' },
      { label: 'New Request (from vendor)',description: 'Starts a new procurement request with this vendor.', navigatesTo: 'request' },
      { label: 'Onboard New Vendor',       description: 'Fortress banner — routes to New Request as Manual Discovery Portal.', navigatesTo: 'request' },
    ],
    modals: [
      { id: 'messaging',   label: 'Messaging Drawer',  description: 'Secure 1-on-1 channel (WhatsApp/Email). Transcript + compose.' },
      { id: 'broadcast',   label: 'Broadcast Drawer',  description: 'Multi-vendor announcement composer.' },
      { id: 'renegotiate', label: 'Renegotiation Modal', description: '5-step lean modal: Prep brief → Opening offer → Counter rounds → Red-line summary → Sign.' },
    ],
    pos: { x: COL[2], y: ROW[1] },
  },

  {
    id: 'workflows',
    group: 'core',
    label: 'Workflows',
    route: '/workflows',
    oneLine: '3 playbooks rendered as flow paths. Read-only reference.',
    purpose:
      'Light reference page. Shows the 3 playbooks Finn\'s runs orders through: Standard (WF-STD), Rush (WF-RSH), Recurring (WF-REC). Each playbook is a vertical 5-stage flow with assigned agents, plain-English stage descriptions, and current active-order count. No tuning, no simulation. #workflow=WF-XXX hash auto-selects the matching playbook; unknown ids → amber toast.',
    states: [
      { id: 'playbook', label: 'Playbook Selected', description: 'Vertical 5-stage flow with agent chips. Hero card: complexity, active count, avg duration, savings vs baseline.' },
    ],
    actions: [
      { label: 'Select a playbook',         description: 'Loads its flow path in the center.' },
      { label: 'Hash reader #workflow=WF-XXX', description: 'On mount + hashchange, auto-selects WF-STD / WF-RSH / WF-REC. Unknown id → amber toast.' },
      { label: 'Atlas chat send',           description: 'Sends a message to Atlas.' },
    ],
    modals: [],
    pos: { x: COL[3], y: ROW[1] },
  },

  // ════ Row 2 — cockpit ═════════════════════════════════════════════
  {
    id: 'orders',
    group: 'core',
    label: 'Orders',
    route: '/orders',
    oneLine: 'Cockpit — 5-stage journey, 3-way match at receiving, dispute draft.',
    purpose:
      'The most morphologically complex page. Auto-progress engine walks Auto POs from Stage 0→4 on an 8s cadence writing per-stage artifacts to agentStageData. State persists to localStorage. HITL gates: perishable QC, disputed status, optional spend-cap rule (default INACTIVE). Stage 5 Task Module widens to max-w-2xl and prepends a 3-way match table (PO Ordered vs Received vs Invoice Qty per line item, live colour-coded variance, QC auto-derived). QC fail → seedDisputeDraft → Source Bridge auto-opens with A-03 WhatsApp dispute draft + "Send Dispute via WhatsApp" / "Waive dispute — accept as-is" (mandatory reason + due date confirmation step).',
    states: [
      { id: 'default',       label: 'Order Dashboard (default)', description: 'KPI strip (Total Active Value, Hours Reclaimed, Savings, Agent-Managed). Labor Mix bar. Arriving Next 48h list.' },
      { id: 'single',        label: 'Single Order Journey',     description: 'Two-column: detail card (primary CTA + tertiary row) + 5-stage DAG with trace modals per stage. CTA adapts: Approve / Confirm Delivery / Resolve Issue / "Agent driving · Auto".' },
      { id: 'batch',         label: 'Batch Console',            description: '≥2 orders multi-selected. Shows Approve/Confirm/Resolve counts. Execute Batch CTA.' },
      { id: 'complete',      label: 'Journey Complete',         description: 'Sage check + "PO-XXXX delivered" + cost/labor savings stats. Auto-clears after 4s.' },
      { id: 'audit-mode',    label: 'Audit Mode',               description: 'Left expands full-width, center collapses. Table/Grid view of live + historical orders. Filters: status, date, supplier, stage band (procurement/fulfillment/receiving), agent, venue, workflow. Right: Operations Insights (no row) or Quick Journey (row selected).' },
      { id: 'stage-5-modal', label: 'Stage 5 Task Module (widened)', description: '3-way match table at top: per line item — PO Ordered (read-only), Received (input), Invoice Qty (input), live variance colour-coding (green=match, red=short, amber=excess). QC outcome auto-derived (all match→pass, mixed→conditional, shorts→fail/conditional). Overridable. POD upload + receiving staff below.' },
      { id: 'source-bridge', label: 'Source Bridge',            description: 'Right-panel takeover. WhatsApp (primary) / Email. Full conversation thread per PO. Auto-opens on Stage 5 QC fail with A-03 dispute-draft (editable Bahasa Indonesia WhatsApp message). Footer: Send Dispute via WhatsApp → sends draft. "Waive dispute — accept as-is" → mandatory reason + due date confirmation step → optionally sends WhatsApp payment notification.' },
    ],
    actions: [
      { label: 'Approve & Execute',         description: 'Advances cap-gated Auto PO → opens Approval Confirmation modal.' },
      { label: 'Confirm Delivery',          description: 'Opens Stage 5 Task Module (widened: 3-way match table + QC outcome + POD upload + receiver).' },
      { label: 'Resolve Issue',             description: 'Routes to Activity & Governance disputes panel via #dispute=PO-XXXX.', navigatesTo: 'activity' },
      { label: 'Send Dispute via WhatsApp', description: 'Source Bridge (dispute draft active). Converts A-03 draft to sent reply. Logs po-dispute-send.' },
      { label: 'Waive dispute — accept as-is', description: 'Source Bridge. Opens payment confirmation step (mandatory reason + due date + notify toggle). Confirm logs po-payment-approve with waiveReason in meta.' },
      { label: 'Re-order',                  description: 'Carbon-copies a delivered PO into New Request.', navigatesTo: 'request' },
      { label: 'Message Supplier',          description: 'Opens Source Bridge full conversation thread.' },
      { label: 'Managed by · Agent A-NN',  description: 'Routes to Activity & Governance agent profile. Sets #agent-NN.', navigatesTo: 'activity' },
      { label: 'Export CSV (Audit Mode)',   description: 'Downloads orders-audit-YYYY-MM-DD.csv.' },
      { label: 'Open Full Workspace (Quick Journey)', description: 'Collapses Audit Mode and loads Single Order Journey.' },
    ],
    modals: [
      { id: 'task-module',    label: 'Stage Task Module',         description: 'Per-stage form (Execute / Edit / Plan). Stage 5 widens to max-w-2xl with 3-way match table prepended.' },
      { id: 'approval-modal', label: 'Approval Confirmation',     description: 'Auto + cap-gate sign-off: order summary + quote details + policy posture + agent reasoning. Confirm / Cancel / Switch to Manual.' },
      { id: 'draft-sheet',    label: 'Draft Sheet',               description: 'New / re-order draft form (recurring, frequency, labor assignment, target venue).' },
      { id: 'cmd-k',          label: '⌘K Command Palette',        description: 'Fuzzy search across live + historical orders.' },
      { id: 'reasoning-modal',label: 'Reasoning Chain modal',     description: 'Agent narrative + per-stage logic + filtered action log. Opened from "View reasoning" in Quick Journey or tertiary row.' },
    ],
    pos: { x: COL[1], y: ROW[2] },
  },

  // ════ Row 3 — outputs ═════════════════════════════════════════════
  {
    id: 'spending',
    group: 'core',
    label: 'Spending',
    route: '/spending',
    oneLine: 'Category grid → ledger. CSV export for accounting handoff.',
    purpose:
      'Default center: 7-category grid (Protein, Seafood, Produce, Dry Goods, Dairy, Beverages, Other). Selecting a category morphs to a category-detail view with time-range filter (1M/3M/6M/1Y), Decision Ledger, Lock Savings, and Export CSV. Budget Setup modal. Export CSV downloads the visible (filtered) ledger as a CSV file formatted for Xero / accounting import (columns: Date, Invoice Ref, Supplier, Category, Description, Savings IDR, Actor). Add Manual Saving inline form for logging manual savings. Right panel: Atlas Intelligence always-on (Autonomy Balance, Agent Efficacy, Forecast Confidence, Venue Mix, chat).',
    states: [
      { id: 'grid',     label: 'Categories Grid (default)', description: '7 category cards with semantic colors and venue-split mini-bars.' },
      { id: 'category', label: 'Category Detail',           description: 'Decision Ledger + time-range controls + Lock Savings + Export CSV + Add Manual Saving inline form.' },
    ],
    actions: [
      { label: 'Category card',       description: 'Opens Category Detail.' },
      { label: 'Back to all',         description: 'Returns to the grid.' },
      { label: 'Time range (1M / 3M / 6M / 1Y)', description: 'Filter the ledger.' },
      { label: 'Lock Savings',        description: 'Accumulates locked savings value.' },
      { label: 'Export CSV',          description: 'Downloads finns-spending-{category}-{date}.csv for Xero / accounting import. Respects active category + time-range filter.' },
      { label: 'Add Manual Saving',   description: 'Toggle inline form — amount + supplier + action + invoice ref. Logs savings-manual-add to action log.' },
      { label: 'Budget Setup',        description: 'Opens Budget modal.' },
      { label: 'Atlas chat send',     description: 'Sends a message to Atlas.' },
    ],
    modals: [
      { id: 'budget', label: 'Category Budgets', description: 'Per-category budget inputs (7 fields) + per-venue allocation — Cancel / Save.' },
    ],
    pos: { x: COL[0], y: ROW[3] },
  },

  {
    id: 'activity',
    group: 'core',
    label: 'Activity & Governance',
    route: '/activity',
    oneLine: 'Unified feed + agents + policy + disputes with full lifecycle.',
    purpose:
      'The merged "receipts + HR + policy office". Left panel: 4 tabs — Activity (default), Agents, Policy, Disputes. Center morphs per tab. Disputes tab: open + resolved cards with three actions: Approve Payment (logs dispute-approve), Request Credit Note (inline form — amount + note, logs dispute-reject with creditAmount in meta), Escalate to Director (logs dispute-escalate). Cards mutate visibly on action. #dispute=PO-XXXX hash deep-link switches to Disputes tab and highlights matching card. finns-qc-failure event auto-creates a dispute card and switches tab. Right panel: Transparency Copilot — event reasoning chains, agent profiles, rule coverage, dispute Atlas recommendation.',
    states: [
      { id: 'activity-feed', label: 'Activity Feed (default)', description: 'Unified event timeline. Filters: confidence, event type, venue, actor (You/Atlas/Agents/All/System). Capital Efficiency card always visible. Undo Window Policy section.' },
      { id: 'agent-profile', label: 'Agent Profile',          description: 'Selected agent dossier — current tasks, recent decisions, performance band, suspend/resume controls.' },
      { id: 'policy-rules',  label: 'Policy Rules',           description: 'Active rule list with template badges + trigger counts. Policy Creator modal.' },
      { id: 'disputes-open', label: 'Disputes — Open',        description: 'Open dispute cards. Three actions per card: Approve Payment / Request Credit Note (inline form) / Escalate to Director. Dynamic disputes created by finns-qc-failure. #dispute=PO-XXXX hash highlights matching card.' },
      { id: 'disputes-resolved', label: 'Disputes — Resolved', description: 'Resolved cards with status badge (✓ Payment approved / ↩ Credit requested / ↑ Escalated). Collapsed below open cards.' },
    ],
    actions: [
      { label: 'Tab switch (Activity / Agents / Policy / Disputes)', description: 'Switches left panel and reshapes center.' },
      { label: 'Approve Payment (dispute card)', description: 'Closes dispute as payment approved. Logs dispute-approve. Card moves to Resolved.' },
      { label: 'Request Credit Note (dispute card)', description: 'Expands inline form (credit amount Rp + optional note). On submit: logs dispute-reject with meta.creditAmount. Card moves to Resolved.' },
      { label: 'Escalate to Director (dispute card)', description: 'Logs dispute-escalate. Card moves to Resolved with ↑ Escalated badge.' },
      { label: 'Suspend / Resume Agent', description: 'Toggles agent suspension.' },
      { label: 'Add Rule',             description: 'Opens Policy Creator modal.' },
      { label: 'Override decision',    description: 'Manual override on a decision row.' },
      { label: 'Rollback',             description: 'Opens Rollback & Intervene modal.' },
      { label: 'View Source (event)',  description: 'Jumps to originating page (Orders/Suppliers/Inventory) by event type.', navigatesTo: 'orders' },
      { label: 'Resume Order (dispute panel)', description: 'Routes to Orders for the disputed PO. Sets #order=PO-XXXX.', navigatesTo: 'orders' },
      { label: 'Pause all agents (kill switch)', description: 'Agents tab — sets agentsPaused=true. All Auto entities freeze.' },
    ],
    modals: [
      { id: 'rollback',        label: 'Rollback & Intervene', description: 'Choose "Fix & Re-run" or "Manual Takeover" for an event.' },
      { id: 'policy-creator',  label: 'Policy Creator',       description: 'Template picker (Spend Cap / Vendor Trust Floor / Fraud Hold / Delivery SLA) + rule config form.' },
    ],
    pos: { x: COL[2], y: ROW[3] },
  },
];

// ── Edges ─────────────────────────────────────────────────────────────
// EDGE TAXONOMY:
//   nav  (sage)  — user clicks → onNavigate(page). May carry hash context.
//   data (blue)  — system silently pushes state via CustomEvent. No nav.
//   event (amber)— system fires a navigate CustomEvent; App.tsx promotes
//                  payload to URL hash before flipping pages.
//
// HASH CONTRACT (receivers read on mount + hashchange):
//   #order=PO-XXXX      → Orders auto-selects the PO
//   #agent-NN           → Activity & Governance opens agent profile, toast
//   #evt=eventId        → Activity & Governance selects event, scroll-flashes
//   #dispute=PO-XXXX    → Activity & Governance switches to Disputes tab,
//                          highlights the matching card (amber ring 2.4s)
//   #workflow=WF-XXX    → Workflows selects WF-STD / WF-RSH / WF-REC
//   #restock=...        → New Request: prefilled Step 1, urgency=urgent
//   #intent=express&mode=reorder&from=... → New Request: jumps to Step 4

export const EDGES: FlowEdgeData[] = [

  // ── From Orders
  {
    id: 'or-rq', source: 'orders', target: 'request', kind: 'nav',
    label:  'Re-order',
    detail: 'Re-order button on a delivered PO. Sets #intent=express&mode=reorder&from=PO-XXXX&vendor=...&items=... — New Request jumps to Step 4 pre-filled.',
  },
  {
    id: 'or-su', source: 'orders', target: 'suppliers', kind: 'data',
    label:  'QC Failure',
    detail: 'Stage 5 QC outcome=fail dispatches finns-qc-failure CustomEvent. SuppliersPage: adds amber alert card with Hold Next PO / Adjust Score / Dismiss actions. No navigation — alert surfaces next time the user visits Suppliers.',
  },
  {
    id: 'or-ac', source: 'orders', target: 'activity', kind: 'nav',
    label:  'Resolve in A&G',
    detail: '"Resolve Issue" on a disputed PO. Sets #dispute=PO-XXXX — Activity & Governance switches to Disputes tab and highlights the matching card with an amber ring.',
  },
  {
    id: 'or-ac2', source: 'orders', target: 'activity', kind: 'nav',
    label:  'Managed by agent',
    detail: 'Tertiary "Managed by · Agent A-NN →" link on the order journey. Sets #agent-NN — Activity & Governance opens that agent\'s profile and fires a confirmation toast.',
  },

  // ── From Inventory
  {
    id: 'in-or', source: 'inventory', target: 'orders', kind: 'nav',
    label:  'Open PO',
    detail: '"Open [PO-XXXX] in Orders" buttons (stream switcher, Stage Trace modal). Sets #order=PO-XXXX — Orders auto-selects the PO on mount.',
  },
  {
    id: 'in-rq', source: 'inventory', target: 'request', kind: 'nav',
    label:  'Restock Now',
    detail: 'Restock Now / Quick Restock action. Sets #restock=SKU&items=...&vendor=... — New Request reads the hash, jumps to Step 1, sets urgency=urgent.',
  },
  {
    id: 'in-ac', source: 'inventory', target: 'activity', kind: 'nav',
    label:  'Agent profile',
    detail: 'Per-SKU agent link routes to that SKU\'s assigned agent in Activity & Governance. Sets #agent-NN.',
  },

  // ── From Suppliers
  {
    id: 'su-ac', source: 'suppliers', target: 'activity', kind: 'nav',
    label:  'Open Activity',
    detail: 'Peek-sheet "Managed by Agent A-NN · Role" link and kebab navigations. Sets #agent-NN.',
  },
  {
    id: 'su-rq', source: 'suppliers', target: 'request', kind: 'nav',
    label:  'Onboard Vendor',
    detail: 'Fortress banner "Onboard New Vendor" — routes to New Request as the Manual Discovery Portal. Humans are the sole gateway for new vendor data.',
  },

  // ── From New Request
  {
    id: 'rq-or', source: 'request', target: 'orders', kind: 'nav',
    label:  'Authorize PO',
    detail: 'Step 4 "Authorize". Mints PO(s), advances to Step 5, then after 1.4s sets #order=PO-XXXX and navigates to Orders.',
  },
  {
    id: 'rq-in', source: 'request', target: 'inventory', kind: 'data',
    label:  'Restock dismissed',
    detail: 'Dismissing the inventory-prefilled banner dispatches finns-restock-intent-failed CustomEvent. Inventory shows amber banner on the affected SKU. No navigation.',
  },

  // ── From Activity & Governance
  {
    id: 'ac-or', source: 'activity', target: 'orders', kind: 'nav',
    label:  'Resume Order',
    detail: '(1) Dispute Panel "Resume Order → PO-XXXX" button after a dispute is resolved. (2) "View Source" on auto-order events. Sets #order=PO-XXXX.',
  },
  {
    id: 'ac-su', source: 'activity', target: 'suppliers', kind: 'nav',
    label:  'View · sourcing',
    detail: '"View Source" on sourcing / vendor-rejection events. Navigates to Suppliers.',
  },
  {
    id: 'ac-in', source: 'activity', target: 'inventory', kind: 'nav',
    label:  'View · forecast',
    detail: '"View Source" on forecast / restock events. Navigates to Inventory.',
  },
];
