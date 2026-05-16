# Finn's Procurement Platform

A scaled-down, agent-driven procurement prototype for **Finn's Beach Club (Bali)** — a single procurement operation serving 4 venues (Beach Club, Recreation Club, Stake, Splash Waterpark).

**Status:** Prototype / demo. Not production-bound. Primary persona: Procurement Manager + inventory & procurement staff.

## Mandatory: Finn's Design Philosophy

**Before writing, modifying, or proposing ANY UI component, layout, page, or screen, you MUST evaluate your work against the Finn's Design Philosophy.** This is non-negotiable.

Core mantra: **"Stop designing pages meant to be read, and start designing instruments meant to be played."**

Every UI decision must transition from "Information Radiator" (passive dashboard) to "Action Operator" (spatial workspace/cockpit).

### The 4 Pillars (always enforce)

1. **Layout as Context** - Use a three-panel cognitive layout:
   - Left: "What am I looking at?" (Catalog/Options)
   - Center: "What am I doing with it?" (Journey/Active task)
   - Right: "What should I know about it?" (Intelligence/Context)

2. **Meaningful Space** - White space is a functional tool, not waste. Use generous padding and large typography to isolate decisions, group actions, and reduce cognitive load. Never cram data above the fold.

3. **Proximity of Action** - Actions live adjacent to the data they affect. Use inline buttons, quick actions, and toggle groups. Never hide actions in global nav or contextual menus far from their data.

4. **Asynchronous Independence** - Panels scroll independently (`min-h-0`, `overflow-auto`). Users must be able to scrub one list while keeping their place in another, like papers on a physical desk.

### Enforcement

- When creating or editing UI code, silently verify all 4 pillars are satisfied.
- If a proposed change violates any pillar, fix it before presenting the code.
- When asked to review a screen, use the full audit format from `.claude/skills/buyamia-design-philosophy.md` (file name retained from the upstream prototype — the principles are unchanged).

## Mandatory: Right Panel Rules

The right panel ("Intelligence Panel") has 6 invariant rules that apply on every page. These are documented in `docs/RIGHT-PANEL-MAP.md` under "The Rules — Read This First":

1. AI-exclusive surface (no mutate actions)
2. Chat pinned to the bottom (single unified scroll)
3. No hover responses (clicks only)
4. Reactive to the center (center is the trigger; right is the reaction)
5. Header subtitle adapts to context
6. No standalone navigation (cross-page links are AI-suggested + hash-carried)

Violations of these rules are rejected at review time. When updating any right-panel surface, re-read `RIGHT-PANEL-MAP.md` for the per-page state catalog.

## Authoritative Doc Set

When you need to understand the platform, read these in order:

| File | Purpose |
|------|---------|
| `docs/PLATFORM-MAP.md` | The high-level map. 8 pages, topology, agent roster, venue tagging, edge taxonomy, hash contract, cross-page navigation index. **Start here.** |
| `docs/core-pages.md` | The canonical implementation spec. All 8 pages page-by-page: data models, panels, modals, actions, flows, hash readers. |
| `docs/RIGHT-PANEL-MAP.md` | Right-panel reference. 6 invariant rules + per-page state catalog + cross-page patterns. |
| `docs/DESIGN.md` | The design system. Color tokens (sage palette), typography, spacing, component patterns. |
| `docs/REALISM-AUDIT.md` | Legacy realism backlog from the upstream Buyamia iteration. Keyed to the old 13-page model — **stale**. Pending a re-audit against the Finn's 8-page model. |

## Scope Anchors (do not drift)

These decisions are locked. Anything that contradicts them is a violation of scope.

- **8 pages**: Overview · Inventory · New Request · Orders · Suppliers · Spending · Activity & Governance · Workflows
- **6 agents** (flat roster, no cohorts): Atlas + A-01 Sourcing + A-02 Restock + A-03 Vendor Comms + A-04 Spend Watchdog + A-05 Logistics
- **5-stage order journey**: Request → Quote/Vendor Confirmed → PO Approved → In Transit → Delivered & Checked
- **3 playbooks**: `WF-STD` Standard · `WF-RSH` Rush · `WF-REC` Recurring
- **5-step request wizard**: Items → Vendors → Delivery → Review → Done
- **4 venues** tagged on every SKU and PO: `BC` Beach Club · `RC` Recreation Club · `ST` Stake · `SP` Splash Waterpark. **No scope switcher** in the global nav.
- **Currency**: IDR primary, USD secondary on imports.

### Patterns explicitly removed from the upstream Buyamia iteration

Do **not** reintroduce these without explicit direction:

- ❌ Decision Attribution Trail (12-stage full-screen modal)
- ❌ TrailReturnPill / `sessionStorage['buyamia-trail-return']` marker
- ❌ Control planes (CP-POL / CP-ECO / CP-TRU / CP-SIM)
- ❌ 5-cohort agent taxonomy (SEN / REA / EXE / GOV / MET) · 40-agent control room
- ❌ Nerve Center · Global Operations · Intelligence · Infrastructure pages
- ❌ L0–L5 master autonomy ladder
- ❌ Tamper-proof audit kernel · payment rail connector · deployment phase queue · simulation sandbox
- ❌ 12-stage DAG (replaced with 5 stages)
- ❌ 8 workflow playbooks (replaced with 3) — including Group Buy, Capex, Production, Maintenance, Blanket PO, Emergency
- ❌ 7-step request wizard (replaced with 5 steps)
- ❌ Workflows Tune Logic sliders + Simulation Workspace
- ❌ Scope 3 Carbon card (no sustainability agent in the roster)

If you find code or copy referencing any of these, treat it as drift — flag it before merging.
