# Right Panel ("Intelligence Panel") Reference — Finn's

> Everything that lives in the right panel, across every page in the platform — what it contains, what triggers each state, and what it morphs into.
>
> The right panel is **Pillar 3** of the Finn's Design Philosophy: *"What should I know about it?"* — the context surface adjacent to the user's active task.

---

## The Rules — Read This First

These rules apply to **every** right panel in the platform. If you propose a design that breaks one, it will be rejected.

1. **AI-exclusive surface.** The right panel contains only AI-generated content, intelligence, and the Atlas chat. **No action buttons** that mutate primary domain data (Approve PO, Decline, Submit) live here — those belong in the center panel, adjacent to their data. The right panel may contain *secondary* actions that orient the user (Investigate, Open Secure Bridge, View Source, Resume Order).
2. **Chat pinned to the bottom.** The Atlas chat widget is **always** fixed at the bottom of the right panel. Insights scroll above it in a single unified scroll area. The panel is **NOT** split into two separate scroll containers.
3. **No hover responses.** The right panel only responds to **clicks**, never hover. Insights should not change on mouse-over.
4. **Reactive to the center.** The right panel's content morphs based on what is selected/active in the center panel — not based on left-panel selection alone. Center is the trigger; right is the reaction. *(Exception: Activity & Governance, where the left panel's tab choice reshapes both center and right.)*
5. **Header subtitle adapts.** Every right panel has an Atlas/agent header whose subtitle reflects context (e.g. "Agent model · PO-XXXX", "Comparative Delta · A vs B", "Step 2 · Vendors").
6. **No standalone navigation.** The right panel never owns primary page navigation. Cross-page links from the right panel always carry hash context and are AI-suggested (e.g. "Open in Activity", "View Source").
7. **Atlas is never gated. Smart features are never gated. Agent *actions* are.** Atlas's header, page-context subtitle, data summaries (vendor metrics, spending pulse, logistics risk map, supply weather, etc.), and chat input are **always rendered**. Smart features (autocomplete / category detection on item entry, vendor relevance ranking, similar-past-POs insights, AgentCTA reasoning cards) are also always rendered — they're UX, not agent actions. What's gated by per-entity Manual / Auto + the system-wide pause is **agent action**: auto-pre-pick of vendor, auto-execute below cap, auto-restock on par breach, auto-issue the PO to the vendor channel. On a Manual entity, A-01..A-05 still surface reasoning (chip reads "Insight" instead of "Auto"), but never act without sign-off.

---

## Quick Index

| Page | Default state | Number of distinct morphs |
|------|---------------|---------------------------|
| [Overview](#1-overview) | Atlas — operations copilot | 4 |
| [Inventory](#2-inventory) | Item Intelligence | 3 |
| [New Request](#3-new-request) | Atlas Copilot — Step 1 | 5 (one per step) |
| [Orders](#4-orders) — *the cockpit* | Atlas Intelligence | 6+ |
| [Suppliers](#5-suppliers) | Network Overview | 4 |
| [Spending](#6-spending) | Atlas Intelligence | 2 (global / category) |
| [Activity & Governance](#7-activity--governance) | Transparency Copilot — empty | 4 (one per tab) |
| [Workflows](#8-workflows) | Workflow Reference | 1 |

---

## 1. Overview

**Right panel name:** Atlas
**Header subtitle:** Adapts — `"Analyzing: {event}"` · `"Analyzing {PO ID}"` · `"Operations copilot · Always on"`

### What's always there

- **Atlas name + sparkle icon + green pulse dot** (header)
- **Live Agent Activity** — rotates every 4 seconds through 4 live pulses: agent name + current task (e.g. "Sourcing Agent (A-01) — Validating 9 quotes for PO-3041…")
- **Context Questions** — 3 buttons; content adapts to context
- **Autonomous Actions Today** — 6 entries: action text + agent + time + Rp saving attributed
- **This Week's Impact** — Manual steps · Hours saved · Capital freed. Tagline: *"The system is making you money — not just saving time."*
- **Atlas chat** — pinned to bottom. Opens with *"Select a PO or calendar event to see my analysis, or ask me anything."*

### Morphs

| Trigger | What appears |
|---------|--------------|
| **Default (no selection)** | Adds **Temporal Alerts** (3 cards covering risk clusters next 7 days: title + detail + agent + Rp saving) + **Savings in Calendar** (total available; early-payment / recurring lock-in / price windows) |
| **Calendar event selected** | Header switches to "Analyzing: {event}". Context Questions become event-specific: *"Why is '{event}' at stage X/5?"* / *"What are the risks for this {type}?"* / *"Show alternatives for {supplier}"* |
| **PO card selected (PO Workspace)** | Header switches to "Analyzing {PO ID}". Atlas auto-posts reasoning for the PO. Context Questions become PO-specific (e.g. *"Why is PT Bali Seafood 8% below market average?"*). **Venue Consumption Split** card appears if the PO serves more than one venue. |
| **Clear selection** | Returns to default |

---

## 2. Inventory

**Right panel name:** Atlas
**Header subtitle:** Adapts — `"Stock intelligence · Restock copilot"` · `"Quick Journey · Slide-Sheet"` · `"Macro-Portfolio Insights · Spend Watchdog"`

### Three distinct modes

| Mode | Trigger | Content |
|------|---------|---------|
| **Triage — Item Intelligence** (default) | Normal mode (Audit Mode off) | **Action Log** (newest row pulses `animate-pulse`) · **Why This Happened** (Restock Agent reasoning + forecast confidence bar) · **Market Signal** (sage card with Radar icon — Sourcing Agent A-01's read on supply/demand) · **ROI of Autonomy** (hours eliminated · Rp/mo saved · 2-column stat grid) · **Venue Consumption Split** (where this SKU is being burned, when SKU selected) · **Ask Atlas** (3 context-sensitive questions — item-specific when SKU selected, general otherwise) · **Chat history** · **Chat input** (placeholder: *"Ask about stock, agents, forecasts…"*) |
| **Audit Mode + Item Selected — Quick Journey Viewer** | Click any row inside Audit Mode | Item name + SKU summary · Venue chips · **"Full Journey"** button (exits audit, loads full workspace) · Compact 5-stage DAG dot-list · Agent reasoning snippet (4-line clamp) · **Quick Actions** (large tap targets): Emergency Restock (Zap → amber "Reordering…" after trigger) · Call [Supplier] · WhatsApp [Supplier] · Open Full Workspace · Forecast Confidence % + Market Signal card |
| **Audit Mode + No Item — Macro Portfolio Insights** | Open Audit Mode with nothing selected | **Dead Stock Alert** (red): *"[N] items tying up capital · Rp [X] locked in SKUs with burn ≤1.5/day and stock above par"* + top 4 items with locked Rp · **Spend Concentration (Pareto)** (sage): *"Top 3 categories = [N]% of inventory value"* + progress bars per category + total value · **Supply Chain Weather**: 4 region cards (Bali / Java / SE Asia imports / Global) — green/amber/red — region icon + status + detail · **Per-venue Dead Stock Split**: bar chart of dead stock by BC / RC / ST / SP |

---

## 3. New Request

**Right panel name:** Atlas Copilot
**Header subtitle:** `"Step N · {step name}"` — content morphs **completely** per step.

> **Inline Atlas insights are in the CENTER, not the right.** Phase 6l restored the Buyamia-style inline banners (Market Price Trends, Suggested Items, Vendor Intel, Vendor History, Logistics Intel, Ready to Launch) inline next to the data they shape — Pillar 3 Proximity of Action. The right panel still holds the slower-burn step-reactive cards documented below. Rule 1 (AI-exclusive surface) bans **mutate actions** from the right panel, not AI in the center.

### Header subtitle by step

| Step | Subtitle |
|------|----------|
| 1 | Items + venue targets + playbook. |
| 2 | `primaryVendor ? "Reliability for [name]" : "Vendor reliability + alternatives."` |
| 3 | Logistics risk on this lane. |
| 4 | Final audit summary before deploy. |
| 5 | Hand-off complete. |

### Step-reactive intelligence cards (right panel)

| Step | Card | Description |
|------|------|-------------|
| 1 | **Strategic Intent** | Sage AgentCTA card — *"Describe **why** — not just **what**. The clearer your intent, the better A-01 (Sourcing) can recommend vendors and playbooks."* + **Spending pulse** mini-row (this-request preview vs the Rp 12jt monthly budget anchor) |
| 1 | **Category mix** | Per-category line counts + sage progress bars (when basket is non-empty) |
| 1 | **Similar past POs** | Up to 3 cards from the action log filtered by category overlap (when matches exist) |
| 2 | **Vendor Reliability** | Composite / on-time / cold-chain bars for the primary vendor + AM WhatsApp line |
| 2 | **VendorNotePanel** | Read-only team note from `entityNotes` for the primary vendor (editable on Suppliers) |
| 3 | **Logistics Risk Map** | 3 risk items: 🌧️ Java monsoon · ⚠ Tanjung Priok port · ✓ Bali local |
| 3 | **Venue Lane Preferences** | Per-venue receiving window reminder ("BC kitchen 06:00–10:00, ST evening only") |
| 4 | **Audit Summary** | 6-row mini-summary (items, subtotal, playbook, vendor, venues, recurring) |
| 4 | **Policy preview** | Per-rule pass/review/warn card list — same checks A-04 will run at Stage 3. The Step 4 Authorize gate (center) reads from this. |
| 5 | **Hand-off complete** | One-line confirmation + playbook agent + Stage 2 reminder |

### Inline Atlas insights (center column, for cross-reference)

> The right panel cards above complement these — they don't duplicate them. The inline banners are where the user is making the decision; the right panel cards are the deeper read.

| Step | Inline banner | Where |
|------|----|-------|
| 1 | **Atlas · Market Price Trends** | Above the Request Name card. Per-item ↓/↑ trend chips + recommendation. |
| 1 | **Atlas · Suggested Items** | Between Line Items and the autonomy picker. Each suggestion has `[+ Add]` to drop into the basket (mutate — center only). |
| 2 | **Atlas · Vendor Intel** | Above the directory. Directory summary (`N vendors cover this basket, X above trust floor, top match …`). |
| 2 | **A-01 · {vendor}** history | Below the directory when one vendor is picked. Past interactions + on-time % + buffer recommendation. |
| 3 | **A-05 · Logistics Intel** | Above the Delivery Window card. Day-of-week + flex assessment chip; branches to per-vendor mini-summaries on multi-vendor flows. |
| 4 | **Atlas · Ready to Launch / Review Before Launch** | At the top of Step 4. Green when all policy checks pass, amber otherwise. |

### Express-mode validation (seeded as first Atlas message)

| `expressMode` | Atlas opening line |
|---------------|--------------------|
| `reorder` | *"I've validated this re-order from [source]. Prices stable, vendor ([name]) reliability holding at [N], Sourcing Agent ready to deploy. Skip to authorization when you're ready."* |
| `restock` | *"I've validated this restock. Critical SKU items locked, vendor pre-selected, urgency set to urgent."* |
| `blank` | *"Express lane open. Add line items below — I'll validate prices against the 30-day market median in real time."* |

### Always-on chat input (pinned bottom)

Placeholder adapts to current step (`Ask Atlas about {step label}…`). Currently the chat is canned — sendAtlas posts a fixed reply. Backlog item.

---

## 4. Orders (the cockpit)

**Right panel name:** Atlas Intelligence
**Header subtitle:** Adapts — `"Batch analysis · N orders"` · `"Agent model · PO-XXXX"` · `"Logistics intelligence · Live"`

> Orders has the most morph states of any page in the platform. The right panel orchestrates the cockpit experience and can be entirely taken over by Source Bridge or swapped to Operations Insights in Audit Mode.

### AI-exclusive rule applies hardest here

> The right panel contains **only** AI-generated content and the Atlas chat. **No action buttons** (Approve, Decline, Confirm, Resolve) live here — all order actions belong in the center panel.

### Persistent base sections

- **Atlas header** — name + sparkle + green pulse + adaptive subtitle
- **Context Questions** — always present (3 buttons, content adapts to selection)
- **Chat thread** + **Chat input** — pinned to bottom. Placeholder: *"Ask about this batch…"* or *"Ask about logistics, ETAs, costs…"*

### Contextual sections (appear/disappear by context)

| Section | When it appears |
|---------|-----------------|
| **Manual Takeover Copilot** | Manual mode active. Standby header ("I am standing by") + *"Resume Auto"* button + Copilot Stage-Aware Hint + *"Open Stage X task module"* link + Manual Audit Trail (clickable badges for touched stages) + sync note |
| **Quote Source · Bali Channel Context** | Single order, RFQ-sourced PO. Channel pill (WhatsApp / Email) + AM contact + RFQ id link. The actual inbound quote bubble lives inside the Source Bridge thread now (Phase 6p). |
| **Agent Reasoning** | Single order selected. Assigned agent's natural-language explanation. Renders via `<AgentCTA>` with `forceMode={getMode(order.id)}` so the chip respects this PO's labor switch. |
| **Manual Notes** | Per-PO `ManualNotes` surface — admin's typed notes outside the structured stage forms. |
| **Embedded Finance** | `financeInsight` available (Spend Watchdog A-04). Insight text + *"Factor this invoice →"* link (currently decoration — no handler). |
| **Batch Logic Summary** | Batch mode (≥2 orders selected). 3 cards: **Cold-Chain Verified** · **Pricing Confidence** (validated against 30-day market median; aggregate IDR savings) · **Exceptions flagged** (count of resolve-issue orders) |
| **Batch ROI Estimate** | Batch mode. Labor hours saved · Manual steps eliminated · Projected Rp savings |

**Approval Confirmation modal — NOT a right-panel state.** When the user clicks Approve on a cap-gated Auto PO (Phase 6s), a dedicated centre-anchored modal pops, not a right-panel takeover. The right panel keeps whatever it was showing (typically the Agent Reasoning + Quote Source for the selected order). The modal handles the sign-off; once confirmed, executeAction runs and the user can switch focus back to the right panel.

### Context Question adaptive copy

| Context | Question examples |
|---------|-------------------|
| Batch selected | *"What's the risk profile of this batch?"* / *"Which orders can be auto-approved right now?"* / *"Summarize the exceptions and how to fix them"* |
| Single order | *"Why did you choose this logistics provider?"* / *"What's the backup plan if delivery fails?"* / *"How does {supplier} compare to alternatives?"* |
| No selection | *"Which order needs my attention most urgently?"* / *"What value is arriving today?"* / *"Any cost-saving opportunities I'm missing?"* |

### Full takeovers (replace the entire right panel)

#### Source Bridge

**Trigger:** Click "Message Supplier" from the center panel's tertiary action row (or the ⋯ card menu).

A **full conversation thread per PO** (Phase 6p), backed by `lib/sourceBridgeStore.ts`. The panel structure:

| Element | Behavior |
|---------|----------|
| Header | Lock icon + *"Source Bridge"* + ArrowLeft back button. Subtitle: `{supplier} · {AM name} · {PO id}`. |
| Channel selector | Segmented WhatsApp (`#25D366`) / **Email** (blue). **Telegram removed** — Bali vendor channel rule says WhatsApp (primary) / email (formal). |
| Thread | Scrolling history seeded on first open from the RFQ runtime + the order's effective stage. Includes: inbound quote bubble, PO-sent system notice, vendor's dispatch confirmation when stage ≥ 3, any prior admin replies. |
| Compose | Pinned bottom — textarea + Send button. Sending **appends to the thread** and the panel stays open (no auto-close). Encryption footer reads "Routed via Finn's Gateway". |
| Auto-dismiss | Closes when a different order is selected. The thread state persists in localStorage. |

Owned by **Vendor Comms Agent (A-03)** in narrative. Normal AI content is hidden until the bridge is dismissed.

#### Audit Mode — Operations Insights

**Trigger:** Enter Audit Mode (Maximize2 in the left-panel header) with **no row selected**.

| Section | Contents |
|---------|----------|
| **4 KPI cards · headline** | Processed (count + Rp spend) · On-time % · Avg cycle time (hours, PO → Delivered) · Recovered savings (Rp). All amounts use `fmtIdrShort` — no `$` prefix. |
| **2 KPI cards · labor (Phase 6t)** | **Labor mix** — split bar showing Auto vs Manual counts within the filtered set. **Auto-cleared** — count of completed orders the auto-progress engine closed end-to-end without admin clicks. Phase 6 punchline. |
| **Status mix bars** | Horizontal bar per status (live / completed / disputed / cancelled / on-hold) with pct fill + count |
| **Top suppliers · spend** | Top 5 suppliers ranked by total spend. **Clicking a card sets the supplier filter** on the audit list |
| **Disputes · top sources** | Suppliers with ≥1 disputed order, ranked descending (red-tinted cards) |

All insights scope to the current filter window — change any filter and the right panel re-aggregates.

#### Audit Mode — Quick Journey

**Trigger:** Audit Mode is active and a row is clicked. Works for **both live and historical** rows (Phase 6u — was previously live-only because `selectedOrder` resolved against `ORDERS` not `ALL_ORDERS`, and live-row clicks silently collapsed Audit Mode). Click on a row now keeps Audit Mode expanded — the user explicitly exits via the primary action button.

| Element | Behavior |
|---------|----------|
| Header | *"Quick Journey"* + PO id · supplier + status pill (live / completed / disputed / cancelled / on-hold) |
| Order detail card | Amount (large, `fmtIdrShort`) · Stage `N/5` · `humanDescription` · Items list (first 3, then `+N more`) · Resolution / failure reason line for historical disputes/cancellations |
| Compact 5-stage dot rail | Done (sage) · Current (amber pulsing) · Upcoming (gray). Reads `effectiveStage(order)` not raw `dagStage` so live orders the auto-progress engine has advanced render at their CURRENT position (Phase 6w). Terminal orders (in `completedIds`) render every stage filled sage. |
| **Status-aware primary action** | Adapts per `order.status`: completed/cancelled → **Re-order** (carbon-copy to New Request with `#intent=express&mode=reorder&from=...`); disputed → **Resolve in A&G** (`#dispute=PO-XXXX`); on-hold → **Review hold in A&G** (`#dispute=...`); live → **Open Full Workspace** (collapses Audit Mode). Single button — no duplicate "Open in journey" secondary. |
| **View reasoning** button (Phase 6v) | Opens the **Reasoning Chain modal** locally — no navigation. Modal shows: top-level agent narrative (`agentReasoning`), per-stage logic walking the DAG up to effective stage (Trigger / Proof / Verified-at synthesised from `synthesizeStageHistory` + actual `stageCompletedAt` stamps when present), and the unified action log filtered to this PO's entries. Closing the modal drops back into Quick Journey + Audit Mode intact. Replaced the earlier "View reasoning in A&G" link that navigated to an A&G page that didn't actually read the `#po=` hash — user landed on a generic page with no context and no way back. |
| **Message Supplier** button (Phase 6v) | Opens the Source Bridge thread as a right-panel takeover. Works in Audit Mode now — the right-panel render condition is `{auditMode ? (bridgeTarget ? bridgePanel : auditRightPanel) : rightPanel}`, so the bridge takes over whether the user is in Triage or Audit. Closing the bridge drops back into the Quick Journey. Previously did nothing in Audit Mode because `bridgePanel` only rendered through the non-audit `rightPanel` path. |

---

## 5. Suppliers

**Right panel name:** Atlas (Comparative Delta / Bulk Action / Relationship ROI / Network Overview)
**Header subtitle:** Adapts per mode

### Four distinct modes

| Mode | Trigger | Content |
|------|---------|---------|
| **Network Overview** (default) | No supplier selected | *"Monitoring N vendors across M regions. Total annual contract: Rp [X]."* · *"[N] vendors need attention. Select a vendor to view their Relationship Journey."* · **Venue coverage** mini-card: how many vendors serve each Finn's venue |
| **Relationship ROI** | Single supplier selected | **Relationship ROI** (Award icon): Savings YTD (sage, large) + tier narrative + partner grade badge (A ≥90 / B+ ≥85 / B ≥80 / C) · **Market Benchmarking** (Activity icon, Sourcing Agent A-01): Lead Time vs regional avg with ▲/▼ delta · Quality Score vs regional avg + *"Top quartile"* or *"Below threshold"* · **Account Manager** (MessageCircle): name + WhatsApp phone number · **Venues Served** chips · **Bottom (Secure Bridge):** *"Open Secure Bridge"* button → opens Messaging Drawer · *"Routes to [Account Manager] · encrypted via Finn's Gateway"* label |
| **Bulk Action Summary** | ≥2 vendors selected in sidebar select mode | Selected vendor cards with region flag + name + score · **Combined Reach**: total contract value + avg score + total venues covered · **Broadcast Announcement** button at bottom |
| **Comparative Delta** | Comparison mode active (Trigger Compare on 2 vendors) | Header: *"Comparative Delta · Atlas synthesis · [A region] vs [B region]"* · **Direct Comparison** auto-narrative: *"[Vendor A] is 2 days faster but Rp 35M/yr more expensive than [Vendor B]."* · **Recommendation** (sage card with Award icon): budget vs speed analysis + winner · **Metric Deltas** strip (4 rows: Composite Score / Lead Time / Annual Cost / Savings YTD — winner highlighted) · **Venue Fit** row: which venues each vendor serves best · **Bottom**: *"Message Both"* (sage → Broadcast Drawer) · *"Message Winner · [name]"* (outline → Messaging Drawer) |

### Drawer overlays (z-20, absolute inset-0)

- **Messaging Drawer** — opened from Relationship ROI bottom. WhatsApp/Telegram toggle + transcript + compose textarea. Routed via Finn's Gateway.
- **Broadcast Drawer** — opened from Bulk Action or Comparative Delta. Target vendor pills + channel toggle + compose. *"Send to N Vendors"* button.

---

## 6. Spending

**Right panel name:** Atlas Intelligence

### Always-on sections

- **Autonomy Balance** (Zap icon): *"Agents handled **67% of transactions** autonomously. You intervened on **33%** — primarily to maintain local vendor relationships and quality standards."* · Two progress bars (Agent Autonomous sage / Admin Intervention blue) · *"[N] overrides recorded — system learning from your expertise"*
- **Agent Efficacy** (Bot icon):
  - Global view: top agent for first 4 categories
  - Category selected: only that category
  - Each entry: semantic icon + category name + *"Agent A-NN (Role Name) contributed **X%** of savings"* + progress bar in semantic color
- **Forecast Confidence** (ShieldCheck icon): 4 metrics each with value bar:

  | Metric | Confidence | Forecast |
  |--------|-----------|----------|
  | Next month spend | 92% | Rp [X]M |
  | Savings estimate | 87% | Rp [Y]M |
  | Drift detection | 95% | Category drift % or "All cats." |
  | Stockout probability | 78% | Category risk or "Avg 8%" |
- **Venue Mix** (Building icon): current month's per-venue spend split mini-bar (BC / RC / ST / SP)
- **Atlas chat history** (auto-scrolls to latest) + **Atlas chat input** (pinned bottom). Label: *"Ask Atlas about [category]"* or *"Ask Atlas about spending"*

### Morphs

| Trigger | What appears |
|---------|--------------|
| **Category selected** | Adds **Atlas suggested prompts** — 3 category-specific questions (e.g. Protein: *"Why did Sourcing Agent switch suppliers?"* / Dairy: *"Why is Dairy over budget?"*). Clicking immediately fires as Atlas chat message (no typing). Agent Efficacy collapses to that category only. Venue Mix re-scopes to this category's per-venue spend. |

### Atlas AI engine (`getAtlasResponse`) handles

- Agent-specific: Sourcing supplier switch · Spend Watchdog flag history · override history
- Category-specific: budget drift · alternative suppliers · forecast · stockout risk
- Venue-specific: per-venue category overspend · cross-venue volume opportunities
- Global: total savings · trend/next-month forecast · optimization priority ranking

---

## 7. Activity & Governance

**Right panel name:** Transparency Copilot
**Structure:** Scrollable top + fixed-bottom chat. Reactive to **both** the active tab (Activity / Agents / Policy / Disputes) and the selected item in the center.

### Four modes — one per tab

#### Mode A — Activity tab

##### Empty state — no event selected

*"Select an event in the ledger to inspect the agent's reasoning chain — why it acted, what data it used, and which alternatives it rejected."*

Plus the **Capital Efficiency** card (see below) and the **Atlas chat** (pinned bottom).

##### Event selected — Agent Reasoning Chain

**Agent identity card:**
- Agent accent-colored background (12% opacity) + matching border
- Agent icon in accent-colored 28×28 square
- Agent name + role (clickable → opens Agents tab for that agent)
- Agent ID in monospace (A-01 … A-05)
- Confidence % (color-coded) at right

**Suspend / Resume controls** (within the agent card):
- Default: *"Performance review available"* + **Suspend Agent** button (red border, PauseCircle)
- Suspended: *"Globally Suspended"* (red, PauseCircle) + **Clear Suspension** button (sage bg)
- Suspension is global — `toast.warning("[name] suspended — all in-flight autonomous actions paused")` / Resume: `toast.success("[name] resumed — Performance Review cleared")`

**Category + venue + type chips row:** category chip (category color) · event-type chip (gray) · venue chip (BC/RC/ST/SP/Multi) · relative time stamp at right.

**"Why was this done?" block:** Bot icon + label + agent's `reasoning.why` narrative.

**"Data used" block — Evidence Override:**
- Layers icon + *"DATA USED"* + hint *"Click ✎ to recalibrate"*
- One row per `dataPoint`: label (left) + value + delta (right). Delta tinted: positive=green, negative=red, neutral=muted.
- On hover: pencil icon appears (opacity-0 → opacity-100) next to value. *(Hover is allowed here per the field-edit pattern — it is a tooltip-style affordance, not a content morph.)*
- Click pencil → inline edit: input pre-filled with current value · Enter/✓ saves · Escape/✗ cancels
- On save: `editedDataPoints[eventId][label]` updated + amber *"⚠ overridden"* badge appears + `toast.success("Recalibration saved — agent will use this value on next run")`. Overridden rows get amber background tint.

**"Alternatives rejected" block:** AlertTriangle icon + label · Each alternative: bold label + italic `rejectedBecause` beneath.

**Safe-to-Cancel Window** (below reasoning chain):
- Within undo window: amber border card · *"X minutes left"* · progress bar · *"Reversible — vendor confirmation required. Fees and lead-time impact depend on vendor cancellation policy."*
- Expired: muted card · *"Undo window expired"* or *"Action finalized"*

##### Always-on Capital Efficiency card (Activity tab)

Sage-tinted card showing:
- *"Working capital preserved today"*
- `Rp 13,480,000` value in bold sage
- Narrative: *"Agents avoided tying up Rp 13.48M in premature orders… in addition to Rp 3.08M in direct savings."*
- 2-column breakdown: Direct savings / Auto-orders count

#### Mode B — Agents tab

##### When no agent selected

- **Roster status grid** — 5 small cards (A-01 … A-05) showing pulse dot + tasks-today count + performance band
- **Atlas note**: *"Click an agent to inspect their reasoning style, recent overrides, and performance band trend."*
- Atlas chat (pinned bottom)

##### When an agent is selected

- **Agent identity card** (same shape as Activity mode)
- **Performance Band Trend** sparkline (last 30 days)
- **Recent Overrides** mini-list (last 5 user overrides on this agent's decisions)
- **Top 3 categories operated** (by transaction count)
- **Suspend / Resume** controls
- Atlas chat (pinned bottom)

#### Mode C — Policy tab

##### When no rule selected

- **Active rule coverage gauge**: % of categories / venues / vendors with at least one rule
- **Suggested rule** card (Atlas recommendation based on recent overrides): *"You've overridden Spend Watchdog 4× on Wine PO above Rp 50M. Recommend: Spend Cap rule, Vendor=PT Wine Cellar Nusa, Threshold=Rp 50M, scope=Vendor."* + **Create from suggestion** link → opens Policy Creator pre-filled
- Atlas chat (pinned bottom)

##### When a rule is selected

- **Rule explanation card** — what it does, when it fires, sample triggers from history
- **Trigger heatmap** — when this rule fires across the week
- **Conflict check** — flags overlapping rules (e.g. two spend caps on the same vendor)
- Atlas chat (pinned bottom)

#### Mode D — Disputes tab

##### When no dispute selected

- *"Open disputes appear in the center. Click any card to see the agent's full reasoning chain and compare against similar past disputes."*
- Atlas chat (pinned bottom)

##### When a dispute is selected

- **Reasoning chain** for the referenced event (same shape as Activity mode)
- **Similar Past Disputes** card — 3 past resolutions with same template (e.g. spend-cap breach, vendor below trust floor)
- **Atlas Recommendation**: *"Of 3 similar disputes, 2 were approved + hardened. Aligning with that pattern keeps Sourcing Agent's autonomy band stable."*
- Atlas chat (pinned bottom)

### Always-on Atlas chat (pinned bottom)

Fixed at the bottom regardless of selected tab or selected item. Textarea + sage Send button. Response template: *"Pulling the audit trail relevant to '[query]'. Open the event in the timeline for the full reasoning chain."*

---

## 8. Workflows

**Right panel name:** Workflow Reference
**Header subtitle:** `"Workflow reference · Selected: {name}"`

> Workflows is a **read-only reference page**. The right panel does **not** offer tuning, simulation, or any mutating action. It is informational only.

### Single mode

- **Selected playbook stats** card: total POs run this month, success rate, avg cycle time, Rp savings vs manual baseline
- **Recent POs on this playbook** — 5 PO chips (PO id + venue + status), click → Orders with `#order=...`
- **Stage agent reference** — a vertical list of the 5 stages with their owning agent — *not interactive* (the same list appears in the center; the right panel restates it as a compact reference)
- **Atlas insight** — one-line context (e.g. WF-RSH: *"Rush bypasses RFQ — only used when par floor is breached or human marks urgency=urgent. Cost premium up to 12% tolerated."*)
- Atlas chat (pinned bottom)

### What's NOT in the right panel

The following were in Buyamia's Workflows right panel and are **removed**:
- ❌ Stage Reasoning panel triggered by Tune Logic (no tuning UI)
- ❌ Simulation Workspace with scenario cards (no simulation)
- ❌ Apply Fix / Exit Simulation buttons
- ❌ TrailReturnPill (no Decision Attribution Trail in Finn's)

---

## Cross-Page Pattern Index

These behaviors appear in multiple right panels — keep them consistent.

### Always-on chat (every page)

| Property | Rule |
|----------|------|
| Position | Fixed to the **bottom** of the right panel |
| Scroll behavior | Insights scroll above in **one** unified scroll area — NOT a second scroll container |
| Send trigger | Enter (no shift) submits. Shift+Enter for newline |
| Bubble style | User: sage background (`#87986a`) right-aligned `rounded-2xl rounded-tr-sm` + white text · Atlas: gray/sage-ash background left-aligned `rounded-2xl rounded-tl-sm` + Sparkles avatar |
| Empty state | Each page has a tailored greeting (see per-page sections) |

### Header subtitle adapts to context

| Page | Default subtitle | Example morphed subtitle |
|------|------------------|--------------------------|
| Overview | *"Operations copilot · Always on"* | *"Analyzing: {event}"* / *"Analyzing {PO ID}"* |
| Orders | *"Logistics intelligence · Live"* | *"Agent model · PO-XXXX"* / *"Batch analysis · N orders"* |
| New Request | *"Step 1 · Items + budget framing"* | *"Step 2 · Reliability for [vendor]"* |
| Suppliers | *"Network Overview"* | *"Comparative Delta · [A] vs [B]"* |
| Inventory | *"Stock intelligence · Restock copilot"* | *"Quick Journey · Slide-Sheet"* / *"Macro-Portfolio Insights · Spend Watchdog"* |
| Activity & Governance | *"Transparency Copilot"* | *"Reasoning chain · evt-NNN"* / *"Agent profile · A-NN"* |
| Workflows | *"Workflow reference"* | *"Selected: {Standard / Rush / Recurring}"* |

### Venue chip awareness

Right-panel intel cards that quote consumption, spend, or stock should surface a **venue badge or split** whenever the underlying data is venue-tagged. The Procurement Manager sees all venues at once — never assume single-venue context.

Examples:
- Inventory **Quick Actions** card includes venue chips next to the SKU summary.
- Orders **Venue Consumption Split** card shows which venues a multi-venue PO will deliver to.
- Spending **Venue Mix** card mirrors the center grid's per-venue split.
- Activity & Governance event cards carry a venue chip in the chip row.

### Autonomy mode awareness in the right panel

(Per Rule 7. See `PLATFORM-MAP.md § 3a` for the per-entity + system-pause model.)

**Always rendered regardless of per-entity mode** (Atlas + smart features):
- Atlas header + page-context subtitle on every page.
- Atlas data summaries: Spending Pulse (New Request), Venue Consumption Split (Orders), Venue Mix (Spending), Vendor Reliability metrics (Suppliers + New Request), Market Benchmarking (Suppliers), Forecast Confidence (Spending), Capital Efficiency (Activity & Governance), Market Signal observation (Inventory), Logistics Risk Map (New Request).
- Smart features visible regardless of mode: category mix, similar past POs (insight), vendor relevance ranking, AgentCTA "Insight" reasoning cards.
- Atlas chat input at the bottom.
- Reasoning Chain display for historical events (Activity & Governance) — the chain stored at the time the event happened, regardless of current mode.

**Manual-entity behaviour (entity carries `laborMode = 'manual'`)**:
- AgentCTA reasoning chip reads **"Insight"** instead of "Auto" — same reasoning text, framed as reference material, not as a recommendation to approve.
- No defer / decline tri-row (Phase 6 collapsed those — they were always toast-stubbed anyway).
- Auto-pre-pick of vendor in the wizard does not run.
- New Request Step 4 Authorize button copy adapts: single-vendor manual reads `"Authorize · Route to Orders"`, single-vendor auto reads `"Authorize · Hand off to A-04"`. Multi-PO modes (multi-award RFQ, auto-split, manual multi-vendor) read `"Authorize · Create N POs"` / `"Authorize · Finalize N POs"`.

**System pause (`agentsPaused === true`)**:
- All Auto entities behave as if Manual until resumed.
- Activity & Governance Agents tab shows the red "All agents paused" status card.
- Atlas + insight surfaces stay live.

**Per-page mode-awareness audit lives in `core-pages.md`** under each page's section. The legacy 3-tier "Off / Assist / Auto" audit subsections (added during the 5c experiment) are stale — they reference a mode model that no longer exists. The 2-tier reality is: smart features always on, agent action gated per-entity.

### Center-morph from right-panel action (rare pattern)

A few right-panel actions trigger a **center** morph rather than a navigation:

- Suppliers: Top-supplier card click in Operations Insights → sets supplier filter on the audit list (left)
- Orders Operations Insights: Top-supplier card click → same supplier-filter behavior
- Activity & Governance Policy tab: "Create from suggestion" → opens Policy Creator modal in center

This pattern is reserved for AI-suggested actions where the right panel is "pointing at" something in the center. **Do not** introduce primary actions (Approve / Submit / etc.) here — that violates the AI-exclusive rule.

### Drawer overlays (z-20, absolute inset-0)

- **Suppliers — Messaging Drawer** (1-on-1) and **Broadcast Drawer** (multi-vendor)
- **Orders — Source Bridge** (full right-panel takeover, not a drawer)

Drawers obscure the panel until dismissed. The Source Bridge is a full takeover, not an overlay.

### Removed patterns (do not reintroduce)

The Buyamia right-panel pattern catalog had several elements that **do not apply** to Finn's. Do not add them back without explicit design approval.

- ❌ **TrailReturnPill** at `top: 64px` on Governance / AI Activity / Workflows — Decision Attribution Trail is removed
- ❌ **Control-plane workspace pivots** on Governance (CP-POL / CP-ECO / CP-TRU / CP-SIM)
- ❌ **Tune Logic Stage Reasoning panel** on Workflows
- ❌ **Simulation Workspace** with scenario selector + Apply Fix on Workflows
- ❌ **AgentClassSheet** right-panel takeover (no Nerve Center)
- ❌ **GreenHarvest breach alert + Authorize Pivot** card (no Intelligence page)
- ❌ **Latency diagnosis + Scale MET #004** card (no Infrastructure page)
- ❌ **Security Lockdown Banner** with pulse animation (no Infrastructure page)
- ❌ **Group Buy card** on New Request Step 4 (no Group Buy playbook)
- ❌ **Scope 3 Carbon** card on Spending (no sustainability agent in roster)

---

## Appendix — What goes in the right panel vs. center panel

Use this as a quick check before placing any element.

| Place in **right panel** if it… | Place in **center panel** if it… |
|---------------------------------|----------------------------------|
| Is AI-generated reasoning, forecast, or recommendation | Is a primary action that mutates the domain (Approve PO, Submit Request, Execute Batch) |
| Is an insight ABOUT the active item, not a control OF it | Is the item itself (the PO, the SKU, the request, the vendor) |
| Is a context question or Atlas chat | Is a stage-level action on the DAG (Advance Stage, Save Draft) |
| Is a secondary AI-suggested action (Investigate, Open Bridge, Resume Order, View Source) | Is a filter, view toggle, search, or pagination control |
| Is a benchmark, comparison, or risk forecast | Is a form field or input collecting user data |
| Is a cross-page suggestion (Open in Activity, View Source) | Is the primary navigation between page-internal states |

If you're unsure, ask: *"Is this telling the user something, or is it doing something to their data?"* Telling → right. Doing → center.
