# Buyamia Procurement Platform

## Mandatory: Buyamia Design Philosophy

**Before writing, modifying, or proposing ANY UI component, layout, page, or screen, you MUST evaluate your work against the Buyamia Design Philosophy.** This is non-negotiable.

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
- When asked to review a screen, use the full audit format from `.claude/skills/buyamia-design-philosophy.md`.

## Mandatory: Production Realism

This prototype is shipping to a real enterprise customer AND serving as the UX/flow reference for the developers building production. **Missing UI surfaces, flow states, failure modes, and misleading copy in the prototype become missing features in production.**

- The full realism backlog lives in `docs/REALISM-AUDIT.md` — 138 flagged items across all pages, plus 10 cross-cutting patterns.
- When adding or modifying UI: do not introduce async actions as one-click instant success, downstream-state booleans with no UI representing what flips them, misleading copy ("no penalty", "saving locked", "tamper-proof" while not yet sealed), or single-tenant/single-currency/single-timezone assumptions.
- When you address a flag in production code, update its row in `REALISM-AUDIT.md` to `[DONE: <PR ref>]`. Do not delete flags — they form the historical spec.
