# Buyamia — Agent Pages Admin Documentation

There are **6 agent pages** accessed via the "Agents" dropdown in the top navigation bar. Each follows the three-panel cognitive layout: left = catalog/options, center = active workspace, right = Atlas intelligence panel.

---

## 1. Nerve Center

**Nav label:** Nerve Center  
**Route:** `nerve-center`  
**Component:** `NerveCenterPage`

**Purpose:** Real-time control room for the entire AI workforce. The admin can monitor every agent's health and current task, inspect the 12-stage purchase pipeline, drill into bottlenecks and intervene directly, and set the master trust ceiling for the whole system.

---

### Left Panel — "Labor" (AgentGrid)

**What the admin sees:**

- **Header:** "Labor" with an InfoTooltip and a "Take a tour" button.
- **Search input:** Filters agents by ID or description text.
- **System Status Bar** (always visible above the agent list):
  - *SYSTEM HEALTH* gauge: percentage of Governance + Metrology agents running correctly, with individual GOV x/x and MET x/x breakdowns and a total x/x agents count.
  - *SYSTEM STRESS* gauge: oscillating live stress %, a threshold marker at 85%, and a contextual label — "operating within normal range" / "monitor closely" / "Cool Down suggested" depending on value.
- **Agent Cohorts (5 groups):**
  - SEN — Sensing agents
  - REA — Reasoning agents
  - EXE — Execution agents
  - GOV — Governance agents
  - MET — Metrology agents
  - Each group header shows an abbreviation badge, group name, and active/total count.
  - When expanded, each agent card shows: agent ID (monospace), pulsing live status dot (green = active, amber = idle, red = error), tier, tasks-completed count, last action, and current focus.
  - If the admin previously set a signal-sensitivity hard-lock on the Workflows page at ≥90%, Stage 1 sensing agents (SEN-001, SEN-002, SEN-003) show a "👤 User Constrained · Signal Sensitivity X%" amber badge.

**Actions:**

| Action | How |
|---|---|
| Filter all cohorts by type | Click the cohort name/badge row (click again to clear) |
| Expand / collapse a cohort | Click the chevron toggle on the left of the cohort row |
| Search agents | Type in the search box |
| Open agent class detail sheet | Click the cohort filter (replaces right panel) |
| Take a tour | Button in the header |

---

### Center Panel — DAG Visualization (DagVisualization)

**What the admin sees:**

- **Soft stress banner** (amber, dismissible): appears when system stress exceeds 85% but anomaly count is ≤ 300. Shows current stress % and a pre-emptive Cool Down offer.
- **Urgent stress banner** (red): appears when *both* stress > 85% and anomalies > 300. Cannot be dismissed — only resolved by accepting Cool Down.
- **"12-Stage Logic DAG — Decision Kernel"** section with InfoTooltip:
  - 12 stage nodes in two rows of 6, connected by animated neural arrows (sage pulse overlay).
  - Each node: stage number, stage name, active/total agent count, throughput (ops/min), status color (green = active, red = bottleneck, gray = waiting/idle).
  - Red bottleneck nodes pulse with a red shadow.
  - When a class filter is active from the left panel, non-relevant stages ghost to 25% opacity.
- **Active Thinking Panel** (appears below the DAG when a stage is clicked):
  - Stage name, Bottleneck badge (if applicable), throughput.
  - A plain-English description of exactly what the AI agents in that stage are doing right now.
  - SIGNALS PROCESSING chips: the specific data signals being processed at that stage.
  - If the stage is a bottleneck: an INTERVENTIONS row with three action buttons.
  - Intervention confirmation message auto-clears after 5 seconds.
- **"LIVE METRICS"** section with InfoTooltip:
  - Default: 5 sparkline cards — Active Agents, Events/Sec, Autonomous Spend %, Entities, Realized Savings.
  - When a class is filtered: 5 class-specific metrics (e.g. Signals/Min + Feed Latency + Accuracy for Sensing; Orders/Hr + Success Rate + Queue Depth for Execution).
  - Each card shows current value + a mini sparkline history.
- **"GLOBAL AUTONOMY CAP"** section with InfoTooltip:
  - Current level label: L0 ("Full Human Control") through L5 ("Full Autonomy").
  - If any historical decisions would be re-blocked by the current cap: "⚠️ X decisions capped" amber note.
  - 6-segment slider: each segment is a clickable button.

**Actions:**

| Action | How |
|---|---|
| Inspect a pipeline stage | Click any stage node in the DAG |
| Close the thinking panel | Click the X on the Active Thinking Panel, or click the same stage again |
| Force Approval on a bottleneck | Click "⚖️ Force Approval" in the INTERVENTIONS row |
| Scale AI workforce on a bottleneck | Click "🚀 Scale Workforce" |
| Cool Down a single bottleneck stage | Click "⏸️ Cool Down Stage" |
| Pre-emptive Cool Down (whole system) | Click "Cool Down" in the amber soft banner |
| Dismiss the soft banner | Click X on the soft banner |
| Emergency Cool Down (whole system) | Click "Accept" in the red urgent banner |
| Change the global autonomy ceiling | Click any L0–L5 button on the slider |

---

### Right Panel — IntelligencePanel or AgentClassSheet

- **Default (no class selected):** IntelligencePanel with `context="nerve-center"` — Atlas insights, quick access actions, and an AI chat labeled "AI Assistant".
- **When a cohort class is selected:** The full-page `AgentClassSheet` slides in, showing detailed class information. A close button returns to IntelligencePanel.

**Actions:** Chat with Atlas, take quick actions, close class sheet.

---

---

## 2. Workflows & Kernel

**Nav label:** Workflows & Kernel  
**Route:** `workflows`  
**Component:** `WorkflowsPage`

**Purpose:** Library of purchase playbooks and the step-by-step logic behind each one. The admin can inspect any workflow type, see its full AI-executed route, tune how strict or relaxed each step is, trace a live market signal through the route, and run load simulations.

---

### Left Panel — WorkflowTemplateList

**What the admin sees:**

- **Header:** "Workflows" with InfoTooltip and "Take a tour" button.
- **Search input:** Filters both templates and demand signals simultaneously.
- **TEMPLATES** section with InfoTooltip:
  - 8 workflow cards: Standard, Rush, Blanket PO, Group Buy, Emergency, Production, Maintenance, Capex.
  - Each card: icon, name, complexity badge (simple / medium / complex), one-line description, and a 3-stat strip (active orders / avg time / savings).
  - Selected card is highlighted in its complexity color.
- **DEMAND SIGNALS** section with InfoTooltip:
  - Explanatory label: "Click a signal to trace its path through the DAG."
  - **Active Correlation Banner:** if 2+ high-strength signals (>70%) share a workflow, a sage banner lists them as simultaneous groupings.
  - Signal cards: pulsing radio icon (green/amber/gray by strength), signal name, mini sparkline, source, strength %, strength bar, related workflow IDs, correlated signal tag.

**Actions:**

| Action | How |
|---|---|
| Load a workflow | Click any template card |
| Search templates / signals | Type in the search box |
| Trace a demand signal through stages | Click any signal card (click again to deselect) |
| Clear an active signal | Click "clear" link next to the DEMAND SIGNALS header |
| Take a tour | Button in the header |

---

### Center Panel — DagFlowPath

**What the admin sees:**

- **Hard-lock notice** (amber, when active): shown if a Stage 1 signal-sensitivity hard-lock is in effect. Displays the locked % and a "Release" link.
- **Workflow Hero card:**
  - Icon, name, complexity badge, Simulate button (or "Simulating"/"Sim Ready" indicator when active).
  - Description.
  - 4 stats: active orders, stage count, avg duration, savings.
  - Signal banner (when a signal is selected): "⚡ [Signal Name] — lit stages highlighted below."
- **FLOW PATH section** with InfoTooltip:
  - Vertical list of all stages that belong to the selected workflow.
  - Each stage row: status icon (✓ / ⏱ / ⚠), stage name (S1: Signal Intake … S12: Learning & Memory), assigned agent chips (🤖 Agent #N (ID) · description), throughput (ops/min).
  - Badge overlay: ⚡ signal-lit highlight, ⚠ Predicted Bottleneck (during simulation), ⚙ Tuned (after tuning applied), 👤 User Constrained (if Stage 1 hard-locked).
  - **Tune Logic button** on each configurable stage.
  - **Inline Tune Logic panel** (when opened): slider + current value, parameter description, Apply and Cancel buttons. Stage 1 shows "↑90% = hard-lock" annotation; if slider reaches 90%, an amber "Hard-lock threshold reached — agents will show User Constrained in Nerve Center" warning appears.
  - Stages with an active signal are highlighted sage. Simulation bottleneck stages pulse sage. Non-relevant simulation stages fade to 35% opacity.
- **WORKFLOW AUTONOMY section** with InfoTooltip:
  - AutonomyLadder component showing the trust level for this workflow type (L4 for simple, L3 for medium, L2 for complex).
- **Action buttons row:**
  - ▶ Execute Workflow
  - 📅 Schedule
  - 🗒 Clone

**Actions:**

| Action | How |
|---|---|
| Enter simulation mode | Click "Simulate" on the Workflow Hero |
| Select a simulation scenario | Click a scenario card in the right panel |
| Apply fix for a simulated bottleneck | Click "Apply Fix" in the right panel |
| Exit simulation | Click "Exit Simulation" in the right panel |
| Open Tune Logic for a stage | Click the "Tune Logic" button on that stage |
| Adjust stage parameter | Drag the slider |
| Apply tuning (with optional hard-lock) | Click "Apply" or "Apply & Lock" |
| Cancel tuning | Click "Cancel" |
| Release a signal-sensitivity hard-lock | Click "Release" in the hard-lock banner |
| Execute Workflow | Click "▶ Execute Workflow" |
| Schedule Workflow | Click "📅 Schedule" |
| Clone Workflow | Click "🗒 Clone" |

---

### Right Panel — IntelligencePanel (context="workflows")

Labeled "Workflow Architect."

- **Normal mode:** Savings velocity sparkline for the selected workflow, quick actions, insights, chat.
- **Stage tuning mode** (when Tune Logic is open): Stage Reasoning panel — the agent for that stage, what it does, and its current confidence.
- **Simulation mode** (after clicking Simulate):
  - Simulation Workspace replaces the normal panel.
  - Scenario selector cards (e.g. Demand Spike, Supplier Failure, Audit Trigger).
  - Each scenario shows predicted bottleneck stages and overstressed agents.
  - "Apply Fix" and "Exit Simulation" buttons.

**Actions:** Select simulation scenario, apply fix, exit simulation, chat with Atlas.

---

### Deep-Link Hash Reader

On mount and on every `hashchange`, Workflows inspects `window.location.hash`:

| Hash form | Effect |
|---|---|
| `workflow=WF-XXX` (real id, one of `WF-STD` / `WF-RSH` / `WF-BPO` / `WF-GRP` / `WF-EMR` / `WF-PRD` / `WF-MNT` / `WF-CPX`) | Sets `selectedWorkflow` to that template. Center panel auto-loads the `DagFlowPath` for that workflow; right-panel IntelligencePanel re-scopes. Hash is cleared. |
| `workflow=WF-XXX` (unknown id) | Amber `toast.warning("{id} isn't a known workflow template")`. Falls back to default state. Hash is cleared. |

Dispatcher: the Orders Decision Attribution Trail's **🧭 Workflow** chip in the Trail header — every PO carries a `workflowTemplate` and the chip deep-links into Workflows scoped to that playbook.

### TrailReturnPill (Decision Attribution Trail breadcrumb)

When Workflows is mounted and `sessionStorage['buyamia-trail-return']` is present, a fixed-position pill renders at `top: 64px`:

> **← 🕓 Return to PO-XXXX · Stage N Trail**

Clicking the pill calls `onNavigate('orders')` — the sessionStorage marker stays so `NewOrdersPage` consumes it on mount and re-opens the Trail on the same order with the same stage expanded. The marker has a 30-min TTL. See `core-pages.md § 1.12 Decision Attribution Trail` for the full contract.

---

---

## 3. Global Operations

**Nav label:** Global Operations  
**Route:** `global-ops`  
**Component:** `GlobalOpsPage`

**Purpose:** Geographic and industry-sector view of procurement operations. Shows how AI agents are deployed across 5 countries and 5 industry verticals — including GMV, regulatory compliance status, payment rails, and demand signals per market.

---

### Left Panel — CountryIndustryList

**What the admin sees:**

- **Header:** "Global Ops."
- **View toggle:** Two buttons — Countries / Industries — that switch the list and center panel.
- **Countries view** (5 cards):
  - Flag emoji, country name, active agent count, supplier count, regulatory status badge (compliant / review / blocked).
- **Industries view** (5 cards):
  - Icon emoji, industry name, transaction volume (formatted), growth % (green if positive, red if negative).

**Actions:**

| Action | How |
|---|---|
| Switch to country view | Click "Countries" toggle |
| Switch to industry view | Click "Industries" toggle |
| Load a country's detail | Click a country card |
| Load an industry's detail | Click an industry card |

---

### Center Panel — RegionalDrillDown

**Country view:**
- Country header: flag, name, country code.
- 6 stat cards: Currency, Active Agents, Suppliers, GMV, Regulatory Status, Tax Regime.
- PAYMENT RAILS: list of available payment methods (e.g. SWIFT, local rail names).

**Industry view:**
- Industry header: icon, name, transaction volume + growth %.
- BOM TYPES: applicable bill-of-materials categories.
- COMPLIANCE RULES: list of active regulations for this industry.
- DEMAND SIGNALS: live signals relevant to this industry.
- TOP SUPPLIERS: ranked list.

No admin actions in the center panel — it is an information display only.

---

### Right Panel — IntelligencePanel (context="global-ops")

Atlas with global-ops context — insights, quick actions, chat. No page-specific workspace.

**Actions:** Chat with Atlas.

---

---

## 4. Intelligence

**Nav label:** Intelligence  
**Route:** `intelligence` (renders `TransformationPage`)  
**Component:** `TransformationPage`

**Purpose:** AI procurement performance dashboard. Shows 8 live KPIs with full AI audit trails (which agents moved each number and how), a supplier promise tracker, and a 12-step order journey drilldown. The admin can tune exception sensitivity and pause AI auto-ordering from underperforming suppliers.

---

### Left Panel — MetricCategoryList

**What the admin sees:**

- List of 8 performance categories with their current values and trend indicators.
- Selected category is highlighted.

**Actions:** Click any category to cross-highlight it in the center metrics grid.

---

### Center Panel

**What the admin sees:**

- **Page header:** "AI Procurement Performance" with InfoTooltip and "Take a tour" button.
- **8 Metric Cards:**
  - TM-01: Autonomous Spend %
  - TM-02: Auto-Execution Rate %
  - TM-03: Manual Touches (count, lower is better)
  - TM-04: Labor Hours (lower is better)
  - TM-05: Stockouts (count, lower is better)
  - TM-06: Realized Savings $
  - TM-07: Working Capital $
  - TM-08: Exception Trend (count) — this card has an inline **Sensitivity Slider**: drag between "Catch Everything" and "Only Major Issues" to control how many exceptions the AI flags for review.
  - Each card: metric name, current value, sparkline, trend arrow, InfoTooltip. Clicking a card opens the Metric Audit Trail panel below.
- **Metric Audit Trail panel** (appears when a card is clicked):
  - Header: "WHAT DROVE THIS NUMBER" with InfoTooltip.
  - Headline summary for the metric.
  - 4 agent entries, each showing: agent ID, class badge (Reasoning/Execution/Governance/Sensing/Metrology), action taken in plain English, measurable result (e.g. "+4.2% autonomous coverage").
  - Close (X) button.
- **Supplier Promise Engine:** supplier promise tracker table.
  - Columns: name, Delivery score (clickable), Quality score (clickable), status badge, Stop/Resume Auto-Orders button.
  - GreenHarvest row: highlighted amber — this supplier is in breach of delivery and quality promises.
- **Logistics History Panel** (appears when a Delivery or Quality score is clicked):
  - Header: "ORDER JOURNEY — EVERY STEP TRACKED" with InfoTooltip.
  - Supplier name.
  - 12-step grid: Requirement Detected → RFQ Issued → Quote Received → Vendor Evaluated → PO Generated → Compliance Approved → Order Confirmed → Pick & Pack → Dispatched → In Transit → Customs/Gate → Delivered.
  - Each tile: step name, timestamp, status icon (✓ done / ⚠ late / ⏱ pending), agent note if relevant. Late steps highlighted amber.
  - Close button.

**Actions:**

| Action | How |
|---|---|
| Open an AI audit trail | Click any metric card |
| Close the audit trail | Click the X on the panel |
| Adjust exception sensitivity | Drag the TM-08 slider left (more flags) or right (fewer) |
| Open a supplier's order journey | Click their Delivery or Quality score |
| Close the order journey | Click the X on the panel |
| Pause AI auto-orders from a supplier | Click "Stop Auto-Orders" on that supplier row |
| Resume AI auto-orders | Click "Resume Auto-Orders" |
| Investigate GreenHarvest (from Atlas) | Click "Investigate" in the right panel |
| Authorize a pivot away from GreenHarvest | Click "Authorize Pivot" in the right panel |
| Take a tour | Button in the page header |
| Chat with Atlas | Chat in the right panel |

---

### Right Panel — IntelligencePanel (context="transformation")

Labeled "Your AI Advisor (Atlas)."

- GreenHarvest breach alert with an **"Investigate" action** (triggers the logistics history panel for GreenHarvest in the center).
- **"Authorize Pivot"** button: pauses GreenHarvest auto-orders system-wide.
- Insights, quick actions, chat.

---

---

## 5. Governance

**Nav label:** Governance  
**Route:** `governance`  
**Component:** `GovernancePage`

**Purpose:** AI self-regulation oversight and dispute resolution. Shows the 4 rule supervisors (control planes), a full filterable decision ledger with per-decision reasoning chains, and an active disputes queue where the admin can override AI decisions and lock them in as permanent policy.

---

### Left Panel — ControlPlaneList

**What the admin sees:**

- **Header:** "Governance" with InfoTooltip.
- **4 Control Plane cards:**
  - **CP-POL — Policy Integrity** (Shield): enforces spend limits, approval chains, and compliance rules.
  - **CP-ECO — Economic Intelligence** (Dollar): monitors budgets, ROI thresholds, and unusual cost spikes.
  - **CP-TRU — Trust Framework** (Eye): tracks trustworthiness of agents, suppliers, and transactions.
  - **CP-SIM — Simulation Sandbox** (Flask): safely tests new AI decisions before they go live.
  - Each card: icon, name, status badge (active / warning / disabled), plain-English description, active rule count, coverage % with a color-coded progress bar.

**Actions:** Click a control plane card to load its detail in the center and pivot the right panel workspace to match.

---

### Center Panel

**What the admin sees:**

- **Page header:** "Governance & Trust" with InfoTooltip and "Take a tour" button.
- **Control Plane Detail:** loaded when a control plane is selected.
  - Icon, name, status badge, "Last updated" time.
  - **+ Add Rule button** (right of header) — opens the Policy Creator modal.
  - Description.
  - **First-run empty state** (only when `ruleCount === 0`): dashed-border card with Shield icon, "No rules yet" copy, and **"Add First Rule"** button that also opens the Policy Creator modal. Stats row and coverage bar are hidden in this state.
  - Stats row (when `ruleCount > 0`): active rule count, coverage %, decisions per week, blocks this week, overrides this week (if any).
  - Coverage progress bar (green ≥90%, amber ≥70%, red <70%).
  - GOVERNING AGENTS: chips listing every agent ID + role that this control plane oversees.
- **Policy Creator Modal** (opened via "+ Add Rule" or "Add First Rule"):
  - Header: "Add Policy Rule" + control plane name subtitle + X close
  - 4 Template presets (single-select buttons):
    - **Spend Cap** — Block any PO above a threshold without manual approval
    - **Vendor Trust Floor** — Reject quotes from vendors below a minimum trust score
    - **Fraud Hold** — Auto-hold invoices matching duplicate-amount patterns until reviewed
    - **Delivery SLA Breach** — Escalate to Ops Manager if estimated delivery exceeds contracted SLA
  - Rule configuration: Rule Type (select: Threshold / Pattern Match / Time Window / Score Ceiling) · Threshold/Value (text input) · Scope (select: All Vendors / Specific Vendor / Category / Agent)
  - Buttons: Cancel · Create Rule (both close the modal)
- **Reasoning Chain Panel:** appears when the admin clicks an agent name in the Decision Ledger.
  - "REASONING CHAIN — [DEC-XXX]" header, agent name, decision type.
  - Step-by-step chain with: step label, plain-English detail of what the AI checked, confidence bar, status badge (Passed / Done / Flagged).
  - Close (X) button.
- **Decision Ledger section** with InfoTooltip:
  - **Loss Category Filter chips:** clickable badges for each incident category:
    - LC-FRD (Fraud Detection), LC-WST (Waste), LC-ERR (Errors), LC-DLY (Delays), LC-NCO (Non-Compliance)
    - Each chip shows name + incident count + trend color.
    - Active filter shows how many decisions are linked. Clicking active chip deselects it (X on chip).
  - **Decision Ledger table:** Time, Agent (underlined, clickable → reasoning chain), Decision type, Confidence % (mini bar + number), Autonomy Level (L0–L5), Outcome, Action column.
    - Outcomes: ✓ success (green), ⏱ pending (amber), ✗ failed (red), ↺ overridden (purple), ⚖ Precedent Set (sage — after a dispute is hardened).
    - Override button (visible unless outcome is already overridden).
    - External link icon: navigates to AI Activity page scoped to that decision.
- **Disputes Panel** with InfoTooltip:
  - Dispute cards: dispute ID, priority dot (red = high, amber = medium, green = low), status badge (open / resolved / escalated), reason text, "Raised by X · Ref: DEC-XXX".
  - **Open disputes:** three action buttons — ✅ Approve, ✗ Reject, ↗ Escalate.
  - **Post-approval state:** sage "Harden Policy" prompt:
    - "This override resolved the dispute. Lock it in as a standing policy rule so the AI won't repeat this decision in the same scenario?"
    - ⚖️ **Harden Policy — Set as Precedent** button.
    - **Resume Order → PO-XXXX** button (secondary, ghost style): appears when the dispute's decision ref maps to a known PO. Clicking it navigates directly to the Orders page to continue the affected order.
  - **Hardened state:** "⚖️ Precedent Set — policy hardened for [DEC-XXX]" confirmation bar.

**Actions:**

| Action | How |
|---|---|
| Select a control plane | Click any card on the left |
| Add a new policy rule | Click "+ Add Rule" in Control Plane Detail header, or "Add First Rule" in empty state |
| Open a decision's reasoning chain | Click the underlined agent name in the Decision Ledger |
| Close the reasoning chain | Click X on the panel |
| Filter ledger by loss category | Click a loss category chip |
| Clear loss category filter | Click the active chip again |
| Override a decision | Click "Override" in the Action column |
| Navigate to AI Activity for a decision | Click the external-link icon in the Action column |
| Approve a dispute | Click "✅ Approve" on an open dispute |
| Reject a dispute | Click "✗ Reject" |
| Escalate a dispute | Click "↗ Escalate" |
| Lock an override as permanent policy | Click "⚖️ Harden Policy — Set as Precedent" after approving |
| Resume the affected order after approval | Click "Resume Order → PO-XXXX" in the post-approval block (navigates to Orders) |
| Take a tour | Button in the page header |
| Chat with Atlas | Chat in the right panel |

---

### Right Panel — IntelligencePanel (context="governance")

**Governance Workspace** — content pivots based on which control plane is selected:

| Control Plane | Workspace Content |
|---|---|
| CP-POL — Policy Integrity | Rule compliance ring gauge + Rule Coverage Map + Atlas suggestion "Update Rule #14" |
| CP-ECO — Economic Intelligence | Budget Utilization gauge (78%) + department spend bars + Atlas suggestion "Propose Seasonal Budget Exception" |
| CP-TRU — Trust Framework | Vendor Trust score gauge (87/100) + tier breakdown + recent trust changes + Atlas suggestion "Place Indo Seafood on Watchlist" |
| CP-SIM — Simulation Sandbox | Simulation stats (3 complete / 2 running / 1 queued) + last result + pending simulation + Atlas suggestion "Run PT Maju Contract Simulation" |

**Actions:** Use Atlas workspace suggestions, chat with Atlas.

---

### Deep-Link Hash Reader

On mount and on every `hashchange`, Governance inspects `window.location.hash`:

| Hash form | Effect |
|---|---|
| `agent-NN` (e.g. `agent-06`) | Stores the numeric ID in `incomingAgentId` state and fires a `toast.info("Opened Governance for Agent #NN")`. The toast confirms cross-page navigation from Orders / Suppliers / Inventory / AI Activity arrived correctly. Hash is cleared. |
| `decision=DEC-XXX` (real id, `DEC-001..DEC-008`) | Sets `reasoningChainId`, scroll-into-views the matching row in the Decision Ledger via `data-decision-id`, and applies the 2.2s sage `flash-row` keyframe. Hash is cleared. |
| `decision=DEC-XXX` (unknown id) | Fires an amber `toast.warning("{id} isn't in this ledger — the ledger is open for browsing")`. Falls back to default state. Hash is cleared. |

The hash is consumed at most once per visit. The `DecisionLedger.handleActivityDeepLink` callback dispatches `buyamia-navigate-page` with `{ page: 'ai-activity', decisionId }`; `App.tsx` promotes that to `#decision=DEC-XXX` before navigating, so the same hash contract carries Governance ↔ AI Activity round-trips.

### TrailReturnPill (Decision Attribution Trail breadcrumb)

When Governance is mounted and `sessionStorage['buyamia-trail-return']` is present (set by the Orders Decision Attribution Trail's cross-page chips), a fixed-position pill renders at `top: 64px`:

> **← 🕓 Return to PO-XXXX · Stage N Trail**

Clicking the pill calls `onNavigate('orders')` — the sessionStorage marker stays so `NewOrdersPage` consumes it on mount and re-opens the Trail on the same order with the same stage expanded. The marker has a 30-min TTL. See `core-pages.md § 1.12 Decision Attribution Trail` for the full contract.

---

---

## 6. Infrastructure

**Nav label:** Infrastructure  
**Route:** `infrastructure`  
**Component:** `InfrastructurePage`

**Purpose:** Platform engineering oversight and security control. Shows the live system architecture as a clickable schematic, the AI infrastructure reform roadmap with human authorization gates (the admin is the final approver for each build phase), and an append-only audit log of every agent action ever taken. (Cryptographic tamper-proof sealing is rolling out under hardening item `h7` — once complete, alterations trigger detection and lockdown. See `REALISM-AUDIT.md` Infrastructure #17/#21.)

---

### Left Panel

**What the admin sees:**

- **Header:** "Infrastructure" with InfoTooltip.
- **Infrastructure Reforms / Hardening initiatives:** cards listing active rebuild and hardening programs with status indicators, descriptions, and progress metrics.

**Actions:** Click a reform card to inspect it.

---

### Center Panel

**What the admin sees:**

- **Page header:** title with InfoTooltip and "Take a tour" button.
- **Live System Schematic** with InfoTooltip:
  - 5 node cards in a DAG layout: **Event Bus**, **DAG Kernel**, **Graph Memory**, **Compliance Engine**, **Payment Rails**.
  - Each node: name, live active agent count, status badge, activity bars (CSS height animation showing throughput live).
  - Clicking a node selects it and reveals lever actions:
    - Event Bus: **⚡ Overclock Throughput** button.
    - Graph Memory (when degraded): **✅ Scale MET #004** button.
    - Scaled nodes show a "Scaled ✓" confirmation badge.
    - **Payment Rails** (always status `degraded` until rails are connected): shows a **🔌 Connect Payment Rail** / **Manage Payment Rails** button that opens the Rail Connector Modal.
  - When security lockdown is active (after tamper simulation), nodes show a locked/red state.
- **Rail Connector Modal** (opened via Payment Rails node action):
  - Header: "Payment Rail Connector" + "N of 5 rails active" subtitle.
  - 5 rail rows — each row shows: name, region badge, short description, **Connect** / **Disconnect** toggle button.
    - SWIFT (International) · BCA Virtual Account (Indonesia) · PayNow (Singapore) · PromptPay (Thailand) · GCash (Philippines)
  - Connected rails are highlighted sage; disconnected rails are neutral.
  - Connected rail name chips appear in the Payment Rails lever area once connected.
  - State: `connectedRails: Set<string>` · `railConnectorOpen: boolean`
- **Deployment Queue** with InfoTooltip:
  - Phase list (Phase 1 through Phase 5), sequential.
  - Each phase has one of five states:
    - **complete** — checkmark, muted.
    - **active** — green pulsing badge.
    - **needs-auth** — amber pulsing "Ready for Human Authorization" badge + "Authorize Phase N" button.
    - **authorized** — confirmation indicator.
    - **locked** — lock icon with "Authorize Phase N-1 first" (Phase 5 cannot be authorized until Phase 4 is authorized — a hard sequential gate).
  - **🚀 Start Build Phase** global go button at the bottom.
- **Append-Only Audit Log** with InfoTooltip (copy revised — cryptographic tamper-proof sealing is rolling out per `h7`):
  - **Grade: A** badge.
  - Total entry count (12,847 log entries).
  - GOV agent seal chips: GOV-001, GOV-003, GOV-004.
  - **"Simulate Tamper"** button — triggers full security lockdown state across the page and right panel.
  - **"View Audit Log"** link — navigates to the AI Activity page.

**Actions:**

| Action | How |
|---|---|
| Select a DAG node to inspect | Click any node in the schematic |
| Overclock Event Bus throughput | Click "⚡ Overclock Throughput" on the Event Bus node |
| Scale a degraded memory agent | Click "✅ Scale MET #004" on the Graph Memory node (or from the right panel) |
| Connect / disconnect payment rails | Click the Payment Rails node → "🔌 Connect Payment Rail" → Rail Connector Modal |
| Authorize a deployment phase | Click "Authorize Phase N" on a `needs-auth` phase |
| Sequential gate: Phase 5 requires Phase 4 | Authorize Phase 4 first, then Phase 5 unlocks |
| Trigger security lockdown simulation | Click "Simulate Tamper" in the audit log section |
| Navigate to AI Activity audit log | Click "View Audit Log" |
| Take a tour | Button in the page header |
| Chat with Atlas | Chat in the right panel |

---

### Right Panel — IntelligencePanel (context="infrastructure")

- **Security Lockdown Banner** (full-width red, when tamper is detected): "🔴 SECURITY LOCKDOWN — Tamper event detected" with pulse animation. Appears between the header and workspace.
- **Infrastructure Workspace** (normal state):
  - **Latency diagnosis card** (amber): root cause description + **"Scale MET #004"** action button (also updates the node in the center schematic).
  - **Audit log status card:** Grade A, GOV seal chips, **"View Audit Log"** button.
  - **Atlas suggestion:** "Pre-authorize Phase 4."
- Insights, quick actions, chat.

**Actions:** Scale MET #004 from the panel, view audit log, use Atlas suggestions, chat with Atlas.

---

---

## Shared Patterns Across All 6 Pages

| Pattern | Description |
|---|---|
| Three-panel layout | Left = catalog/options, Center = active workspace (scrolls independently), Right = Atlas intelligence |
| InfoTooltip (ℹ icon) | Every section header has a plain-English tooltip explaining what that section is for |
| "Take a tour" button | Each page has a guided driver.js tour that auto-starts on first visit and can be replayed |
| Tour storage keys | `buyamia-nc-tour-seen`, `buyamia-wf-tour-seen`, `buyamia-gov-tour-seen`, `buyamia-infra-tour-seen`, `buyamia-transform-tour-seen` — delete any key from localStorage to re-trigger that page's tour |
| Atlas chat | Every page's right panel includes a chat input at the bottom — accepts plain-English questions about the current page context |
| Cross-page deep links | Pages fire a `buyamia-navigate-page` CustomEvent with an optional context payload (`decisionId` / `evtId` / `agentId` / `orderId`). `App.tsx` promotes that payload to a URL hash (`#decision=...` / `#evt=...` / `#agent-NN` / `#order=...`) before flipping the active page, so the receiver's hash-reader picks up the context on mount. Direct hash assignment (`window.location.hash = ...`) followed by `onNavigate(page)` works the same way. |
| Hash receivers | Orders reads `#order=PO-XXXX`; AI Activity reads `#evt=eventId` (scroll-flash on hit, amber toast on miss); Governance reads `#agent-NN` (shows a toast) and `#decision=DEC-XXX` (Reasoning Chain panel + scroll-flash); Workflows reads `#workflow=WF-XXX`. Each receiver clears the hash after consuming it to avoid re-triggers. RequestPanel already reads `#intent=express…` and `#restock=…`. |
| Dark / light mode | All 6 pages respect the global theme toggle in the top-right corner of the app |
