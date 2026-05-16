# Buyamia — Design System
> Sage Intelligence on White Canvas

**Theme:** light (dark mode supported via `.dark` class)

Buyamia presents a high-contrast, functionally transparent procurement cockpit. Surfaces are pure white with sage-green accents as the sole primary color — no blue, no purple, no arbitrary hues. Typography is compact and precise using Inter. Accent appears only as functional signal: active states, primary actions, agent indicators. Components are lightweight, with soft border radii and minimal diffused shadows that let structure emerge from content rather than decoration.

---

## Design Mantra

> "Stop designing pages meant to be read, and start designing instruments meant to be played."

---

## Color Tokens

| Name | Hex | Token | Role |
|------|-----|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Page background, all card surfaces, modal backgrounds |
| Sage | `#87986a` | `--color-sage` | **Primary action color.** Button backgrounds, active states, progress fills, agent badges |
| Sage Dark | `#6b7a54` | `--color-sage-dark` | Hover state for primary buttons, pressed/active sage elements |
| Sage Mid | `#a3b085` | `--color-sage-mid` | Secondary sage accent, agent icons in dark mode, supporting labels |
| Sage Ash | `#f4f6f0` | `--color-sage-ash` | Selected item background, filter chip active bg, subtle info tint |
| Sage Border | `#e5e5e0` | `--color-sage-border` | All card borders, dividers, input borders |
| Sage Border Muted | `#dbe3ce` | `--color-sage-border-muted` | Par level / agent watch box borders, informational callout borders |
| Ink Black | `#0a0a0a` | `--color-ink-black` | Primary text, all headings, prominent labels |
| Thunder Gray | `#171717` | `--color-thunder-gray` | Secondary informational text |
| Steel Gray | `#404040` | `--color-steel-gray` | Muted text, less-emphasis details |
| Ghost Gray | `#6b7280` | `--color-ghost-gray` | Placeholder text, captions, timestamps |
| Subtle Ash | `#f5f5f5` | `--color-subtle-ash` | Hover states on white cards, toggle pill backgrounds |
| Amber Alert | `#f59e0b` | `--color-amber-alert` | Manual takeover banners, warning states |
| Red Critical | `#ef4444` | `--color-red-critical` | Critical stock, failed stages, destructive actions |
| Dark Canvas | `#1a1a1a` | `--color-dark-canvas` | Dark mode panel background |
| Dark Card | `#2a2a2a` | `--color-dark-card` | Dark mode card surface |

### Globals CSS (light mode)

```css
:root {
  --primary:              #87986a;
  --primary-foreground:   #ffffff;
  --secondary:            #6b7a54;
  --secondary-foreground: #ffffff;
  --muted:                #dbe3ce;
  --muted-foreground:     #6b7280;
  --accent:               #f4f6f0;
  --accent-foreground:    #4f5c3e;
  --destructive:          #c6564c;
  --destructive-foreground: #ffffff;
  --border:               #e5e5e0;
  --input:                #e5e5e0;
  --ring:                 #87986a;
  --background:           #ffffff;
  --foreground:           #0a0a0a;
  --card:                 #ffffff;
  --card-foreground:      #0a0a0a;
}
```

---

## Typography

**Primary face:** Inter — all UI elements, body text, navigation, data labels.
**Fallback stack:** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
**Monospace (IDs/codes):** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

### Type Scale

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| caption | 9–10px | 400 | 1.4 | Timestamps, badges, micro-labels |
| body-sm | 11px | 400–500 | 1.43 | Secondary info, agent steps, sub-descriptions |
| body | 12–13px | 400–500 | 1.43 | Standard body, list items, table cells |
| label | 14px | 500 | 1.43 | Action labels, input labels, card titles |
| heading-sm | 14–16px | 600 | 1.33 | Card headings, section titles |
| heading | 18–20px | 600–700 | 1.33 | Page-level headings, modal titles |
| display | 24px+ | 700 | 1.15 | Hero numbers (spend totals, KPIs) |

### Rules

- Headings within cards: `text-sm font-semibold` (14px/600)
- Section group labels: `text-[10px] font-semibold uppercase tracking-wide` + Ghost Gray
- Metric values: `text-sm font-bold` or `text-base font-bold`
- All badge/chip text: `text-[10px] font-medium` or `text-[10px] font-bold`

---

## Spacing

**Base unit:** 4px

| Token | Value | Common usage |
|-------|-------|-------------|
| `p-2` / `px-2` | 8px | Tight inline padding, small buttons |
| `p-3` / `px-3` | 12px | Sidebar list cards, compact info boxes |
| `p-4` / `px-4` | 16px | Main panel cards, section wrappers |
| `p-6` / `px-6` | 24px | Center/right panel outer padding |
| `gap-1.5` | 6px | Inline icon+label gaps |
| `gap-3` | 12px | Card grid gaps, action row gaps |
| `gap-4` | 16px | Section-level gaps |
| `space-y-5` | 20px | Vertical rhythm between panel sections |
| `mb-3` | 12px | Card header → content gap |

---

## Border Radius

| Element | Tailwind | px | Usage |
|---------|----------|----|-------|
| Chip / pill / badge | `rounded-full` | 9999px | Filter chips, steering badges, mode toggles |
| Small button | `rounded-lg` | 8px | Action buttons in toolbars |
| List card / sidebar item | `rounded-lg` | 8px | Sidebar SKU cards, list rows |
| Panel card | `rounded-xl` | 12px | Main content cards inside center/right panels |
| Modal | `rounded-2xl` | 16px | All modals and overlays |

---

## Shadows

| Context | Value | Tailwind |
|---------|-------|----------|
| Button (primary) | `rgba(0,0,0,0.05) 0px 1px 2px` | `shadow-sm` |
| Content card (light mode) | `rgba(0,0,0,0.04) 0px 1px 3px` | `shadow-[0_1px_3px_rgba(0,0,0,0.04)]` |
| Dropdown / popover | `rgba(0,0,0,0.1) 0px 4px 6px -1px, rgba(0,0,0,0.1) 0px 2px 4px -2px` | `shadow-xl` |
| Modal (standard) | `rgba(0,0,0,0.09) 0px 20px 20px` | `shadow-lg` |
| Modal (elevated / warning) | deeper lift for destructive or critical modals | `shadow-2xl` |
| Dark mode cards | none — border provides depth | — |

### Modal Overlay
```
Standard:  fixed inset-0 z-50 bg-black/40
Elevated:  fixed inset-0 z-50 style={{ background: 'rgba(0,0,0,0.55)' }}
```
Use the elevated variant for destructive or time-sensitive modals (manual takeover, delete confirmation).

---

## Component Patterns

### Primary Action Button
```
bg-[#87986a] text-white rounded-lg px-3 py-1.5 text-xs font-bold
hover:bg-[#6b7a54] transition-colors shadow-sm
```

### Secondary / Ghost Button
```
text-gray-700 hover:bg-[#f4f6f0] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors
```

### Sage Outline Button (pipeline/contextual)
```
bg-[#f4f6f0] border border-[#87986a]/40 text-[#6b7a54] rounded-lg px-3 py-1.5 text-xs font-bold
hover:bg-[#e8eddf] transition-colors shadow-sm
```

### Sidebar List Card
```
Light: bg-white border border-[#e5e5e0] rounded-lg p-3 hover:bg-[#f4f6f0]
Selected: bg-[#f4f6f0] border-[#87986a]/40
Dark:  bg-[#2a2a2a] border-gray-800 rounded-lg p-3 hover:bg-gray-800
```

### Panel Content Card
```
Light: bg-white border border-[#e5e5e0] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]
Dark:  bg-[#1a1a1a] border-gray-800 rounded-xl p-4
```

### Metric Summary Card (3-up grid)
```
Light: bg-white border border-[#e5e5e0] rounded-lg p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]
Dark:  bg-[#2a2a2a] border-gray-800 rounded-lg p-3
```

### Card Component Anatomy (Header / Body / Footer)
All card-shaped containers — section cards in sidebars, panel cards, action panels — follow the same three-zone anatomy. Any zone is optional except Body.

```
┌───────────────────────────────────────────────────────┐
│ HEADER (optional)                                      │
│   [Section Label Badge]   [count]   [right action]    │
│   — mb-4 gap below header before body —               │
├───────────────────────────────────────────────────────┤
│ BODY                                                   │
│   Content items, data, or list                        │
├───────────────────────────────────────────────────────┤
│ FOOTER (optional)                                      │
│   [ghost cancel]         [primary action →]           │
└───────────────────────────────────────────────────────┘
```

Rules:
- **Header is absent** when the surrounding layout already frames the section (inside a modal, inside a page that has its own header strip).
- **Header always uses a Section Label Badge** — never raw uppercase `h3` / `text-[10px]` text.
- **Header row:** `flex items-center justify-between` — badge on the left, secondary actions / count pill on the right.
- **Mandatory gap below header:** `mb-4` (16 px) before the body begins.
- **Footer actions** follow the standard Button pattern: ghost cancel left-aligned, primary sage button right-aligned (`ml-auto`).

### State Card — Icon Badge Variant
White-background card that signals state through a **filled circular icon badge only**. No background tint. No colored border.

```
Card wrapper:
  Light: bg-white border border-[#e5e5e0] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]
  Dark:  bg-[#2a2a2a] border-[state]/20 rounded-xl p-4

Icon badge (shrink-0, mt-0.5 to align with first text line):
  w-7 h-7 rounded-full flex items-center justify-center shrink-0
  Icon inside: h-3.5 w-3.5 text-white

Badge fill × dark border:
  Error   → bg-red-500   / border-red-500/20
  Warning → bg-amber-500 / border-amber-500/20
  Success → bg-green-500 / border-green-500/20
  Info    → bg-blue-500  / border-blue-500/20
  Sage    → bg-[#87986a] / border-[#87986a]/20

Card text (always dark — never colored):
  Title:   text-xs font-semibold text-[#0a0a0a]
  Body:    text-[10px] text-[#6b7280]

Inline text-link actions (below body, indented ml-10 to align under text):
  Primary:   text-[10px] font-semibold text-[state-color] hover:text-[state-color-dark]
  Secondary: text-[10px] text-[#6b7280] hover:text-[#0a0a0a]
```

### OrderCard (left panel — Orders page)
The canonical sidebar feed card. All status communication lives in the **header title's icon + text color** — never on the card border, background tint, or CTA button. The card itself is chromatically neutral.

```
Card wrapper (default — every status):
  Light: bg-white       border border-[#e5e5e0]  rounded-xl  shadow-[0_1px_3px_rgba(0,0,0,0.04)]
  Dark:  bg-[#2a2a2a]   border border-gray-800   rounded-xl
  Hover (light): hover:bg-[#f4f6f0]/40
  Hover (dark):  hover:bg-gray-800

Selected (user selection — NOT status):
  Light: bg-[#f4f6f0]    border-[#87986a]/50  ring-1 ring-[#87986a]/20
  Dark:  bg-[#87986a]/15 border-[#87986a]/50  ring-1 ring-[#87986a]/30

Completed (faded out, still gray border):
  opacity-50
```

**Status communication — title row only:**
```
Header row: flex items-center justify-between px-3 pt-3 pb-0
  Icon (h-3.5 w-3.5) + label (text-[11px] font-semibold) share one color:
    Approve / pending decision   → text-amber-700  (light)  / text-amber-400 (dark)
    Confirm-delivery / in transit → text-blue-600  / text-blue-400
    Resolve-issue / failed       → text-red-600   / text-red-400
    Imminent / delivered / done  → text-green-600 / text-green-400
    Manual takeover              → text-amber-700 / text-amber-400  (Hand icon)
    Idle / pre-dispatch          → text-gray-400  / text-gray-500
```

**Header right side — ⋯ context menu trigger** (see *Card Context Menu (⋯)* pattern). Items are stage-gated:
- "Track Shipment" — only when stage ≥ 7 and not yet completed
- "Message Supplier" — always shown
- "Repeat Order" — only when order is completed

**Forbidden:** No colored borders, no colored background tints, no colored rings driven by status. The selected sage ring is the only ring that may appear, and it signals selection — not status.

### Section Label Badge
Pill-shaped label for feed/list section headers in sidebars. Replaces raw uppercase `h3` text.

```
Base: inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border

Dot (before text): w-1.5 h-1.5 rounded-full shrink-0
```

| Variant | Light | Dark | Dot |
|---------|-------|------|-----|
| Amber (action needed) | `bg-amber-50 border-amber-200/70 text-amber-700` | `bg-amber-500/12 border-amber-500/25 text-amber-300` | `bg-amber-500` |
| Green (success / autonomous) | `bg-green-50 border-green-200/70 text-green-700` | `bg-green-500/12 border-green-500/25 text-green-300` | `bg-green-500` |
| Red (error / critical) | `bg-red-50 border-red-200/70 text-red-700` | `bg-red-500/12 border-red-500/25 text-red-300` | `bg-red-500` |
| Blue (info) | `bg-blue-50 border-blue-200/70 text-blue-700` | `bg-blue-500/12 border-blue-500/25 text-blue-300` | `bg-blue-500` |
| Sage (neutral / default) | `bg-[#f4f6f0] border-[#dbe3ce] text-[#6b7a54]` | `bg-[#87986a]/12 border-[#87986a]/25 text-[#a3b085]` | `bg-[#87986a]` |

Usage: always pair with a count pill (separate `text-[9px] font-bold rounded-full`) on the right side of the header row.

### Filter Chip (active)
```
bg-[#f4f6f0] text-[#6b7a54] border border-[#dbe3ce] rounded-full px-2.5 py-1 text-[10px] font-medium
```

### Filter Chip (inactive)
```
bg-gray-100 text-gray-500 border border-[#e5e5e0] rounded-full px-2.5 py-1 text-[10px] font-medium
hover:bg-gray-200
```

### Agent / Steering Badge
```
Autonomous: bg-[#f4f6f0] border-[#87986a]/30 text-[#6b7a54] rounded-full px-1.5 py-0.5 text-[10px] font-bold
Manual:     bg-amber-50 border-amber-400/50 text-amber-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold
```

### Status Badge — Sage (Active/Live)
```
bg-[#f4f6f0] text-[#6b7a54] border border-[#dbe3ce] rounded-full text-[10px]
```

### Callout / Info Box — Sage
```
bg-[#f4f6f0] border border-[#dbe3ce] rounded-lg px-3 py-2
```

### Callout / Info Box — Amber (Warning)
```
bg-amber-50 border border-amber-300/60 rounded-lg px-3 py-2
```

### Section Divider
```
border-b border-[#e5e5e0]
```

### Toggle Pill Group
```
Wrapper: border border-[#e5e5e0] rounded-full bg-gray-50
Active tab: bg-[#87986a] text-white rounded-full
Inactive tab: text-gray-500 hover:text-gray-800
```

### Modal Overlay
```
fixed inset-0 z-50 flex items-center justify-center bg-black/40
```

### Modal Panel
```
Light: bg-white rounded-2xl shadow-lg border border-[#e5e5e0] p-6
```

### Modal Header Strip
```
px-5 py-4 border-b border-[#e5e5e0] flex items-start gap-3
  Icon circle:  w-9 h-9 rounded-xl bg-[#87986a] text-white flex items-center justify-center
  Title:        text-sm font-bold text-[#0a0a0a]
  Subtitle:     text-[11px] text-[#6b7280]
  Close button: w-7 h-7 rounded-lg hover:bg-[#f4f6f0] text-gray-500

Amber variant (manual/warning):  bg-amber-50/60 border-[#e5e5e0]  icon bg-amber-500
Sage variant  (normal/complete):  bg-[#f4f6f0]   border-[#e5e5e0]  icon bg-[#87986a]
```

### Modal Atlas Hint Bar
Appears below the header when an AI copilot hint is contextually relevant.
```
px-5 py-3 border-b border-[#e5e5e0] bg-[#f4f6f0] flex items-start gap-2
  Sparkles icon: h-3.5 w-3.5 text-[#6b7a54]
  Label:         text-[9px] font-bold uppercase tracking-wide text-[#6b7a54]
  Body:          text-[11px] leading-relaxed text-[#0a0a0a]
```

### Modal Footer
```
shrink-0 px-5 py-3 border-t border-[#e5e5e0] flex items-center gap-2
  Cancel: px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-[#f4f6f0]
  Primary: ml-auto px-4 py-2 rounded-lg text-xs font-bold shadow-sm bg-[#87986a] text-white hover:bg-[#6b7a54]
  Disabled primary: bg-gray-100 text-gray-400 cursor-not-allowed
```

### Modal Form: Text / Textarea Input
```
Label: text-[11px] font-semibold text-[#0a0a0a] mb-1.5
Input: w-full rounded-lg px-3 py-2 text-sm border border-[#e5e5e0] bg-gray-50
       placeholder:text-gray-400 outline-none focus:border-[#87986a]/60
Textarea: same + resize-none rows={3}
```

### Numeric Stepper Input
A count input flanked by decrement/increment buttons. Used for physical stock counts.
```
Wrapper: flex items-center gap-2
Stepper btn: w-9 h-9 rounded-lg border border-[#e5e5e0] text-gray-600 hover:bg-[#f4f6f0] flex items-center justify-center
Number input: flex-1 rounded-lg px-3 py-2 text-sm font-bold text-center border
              bg-amber-50/40 border-amber-400/50 focus:border-amber-500/70
Unit label: text-xs font-medium text-[#6b7280]
Delta hint (below): text-[10px] — green if positive, amber if negative
```

### Text Input with Icon Prefix
```
Wrapper: relative
Icon:  absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400
Input: pl-9 text-xs h-8 border border-[#e5e5e0] rounded-lg focus:outline-none focus:border-[#87986a]
       Light: bg-white placeholder:text-gray-400
       Dark:  bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500
```

### Urgency / Priority Badge
Inline badge for order and event urgency levels. Uses colored variants only for status — not brand.
```
High   (red):    bg-red-50  border-red-200  text-red-700    (dark: bg-red-500/10  border-red-500/20  text-red-400)
Medium (amber):  bg-amber-50 border-amber-200 text-amber-700 (dark: bg-amber-500/10 border-amber-500/20 text-amber-400)
Low    (blue):   bg-blue-50 border-blue-200 text-blue-700   (dark: bg-blue-500/10 border-blue-500/20 text-blue-400)

Shared classes: text-[10px] flex items-center gap-1 rounded-full px-1.5 py-0.5 border
```

### View Toggle (Segmented)
Rectangular segmented control for switching between panel modes (e.g. Analytics ↔ Logistics Calendar).
```
Wrapper: flex items-center rounded-lg border p-0.5
         Light: border-[#e5e5e0] bg-gray-50
         Dark:  border-gray-700 bg-[#1a1a1a]

Segment button active:
  Light: bg-white text-[#6b7a54] rounded-md shadow-sm text-[10px] font-medium px-2.5 py-1
  Dark:  bg-[#87986a]/20 text-[#a3b085] rounded-md

Segment button inactive:
  Light: text-gray-400 hover:text-gray-600 text-[10px] font-medium px-2.5 py-1
  Dark:  text-gray-500 hover:text-gray-300
```

### Status Indicators
Use the smallest possible footprint — these are ambient signals, not foreground content.

**Live / online dot:**
```
w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse
```

**Pulsing ring alert (high urgency):**
```
relative inline-flex h-2.5 w-2.5
  span: absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping bg-amber-500
  span: relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500
```
Use amber for manual-takeover / critical restock alerts. Use `bg-red-500` for stockout imminent.

**Bouncing dots loader (agent working):**
```
flex gap-0.5
  {[0, 150, 300].map(d => (
    <div className="w-1 h-1 rounded-full bg-[#87986a] animate-bounce"
         style={{ animationDelay: `${d}ms` }} />
  ))}
```

### Hover Affordances (Group Pattern)
Actions that reveal on row/card hover — never visible at rest.
```
Card or row wrapper: className="group ..."

Hidden action (default invisible):
  opacity-0 group-hover:opacity-100 transition-opacity

Icon-only micro-button (for inline approve / reject / notes):
  w-5 h-5 rounded flex items-center justify-center transition-colors
  Amber action: hover:bg-amber-50 text-amber-600
  Sage action:  hover:bg-[#f4f6f0] text-[#6b7a54]
  Red action:   hover:bg-red-50 text-red-600
```

### Agent Icon Container
Small icon box used in activity feeds and action logs to identify agent class.
```
Small (activity feed):  w-6 h-6 rounded-md flex items-center justify-center
  Light: bg-gray-100  Dark: bg-[#2a2a2a]
  Icon:  h-3 w-3  (color from agent class meta)

Large (modal header):   w-9 h-9 rounded-xl flex items-center justify-center
  Sage mode:  bg-[#87986a] text-white
  Amber mode: bg-amber-500 text-white
```

### Toast / Floating Notification
Ephemeral success confirmation that floats up and fades. Positioned absolute within panel.
```
absolute top-4 left-1/2 -translate-x-1/2 z-20
flex items-center gap-2 px-5 py-2.5 rounded-full
bg-green-500 text-white text-xs font-semibold shadow-lg
style={{ animation: 'floatUp 3s ease-out forwards' }}

@keyframes floatUp {
  0%   { opacity:1; transform:translateX(-50%) translateY(0); }
  70%  { opacity:1; transform:translateX(-50%) translateY(-24px); }
  100% { opacity:0; transform:translateX(-50%) translateY(-40px); }
}
```

### Dropdown Menu
Absolute-positioned action menu attached to a trigger button (not a modal).
```
Wrapper: absolute right-0 top-full mt-1.5 z-30
         w-72 rounded-xl border shadow-xl overflow-hidden
         Light: bg-white border-[#e5e5e0]
         Dark:  bg-[#2a2a2a] border-gray-700

Section header row: px-3 py-2 border-b border-[#e5e5e0] text-[9px] font-bold uppercase text-[#6b7280]

Menu item row: flex items-center gap-2 px-3 py-2 text-xs transition-colors
  Light: hover:bg-[#f4f6f0] text-[#0a0a0a]
  Dark:  hover:bg-gray-800 text-white
  Destructive: text-red-600 hover:bg-red-50
```

---

## DAG / Timeline Patterns

### DAG Stage Row (Full — clickable, expandable)
Used in the center panel Restock Journey and Orders 12-stage kernel.
```
Wrapper button: w-full flex items-start gap-3 py-2 px-2 rounded-lg text-left
                hover:bg-[#f4f6f0]/60 transition-colors cursor-pointer

Node dot (left column):
  complete: w-3.5 h-3.5 rounded-full bg-green-600 border-green-600  → Check icon
  active:   w-3.5 h-3.5 rounded-full bg-[#87986a] border-[#87986a] animate-pulse
  active+manual: bg-amber-500 border-amber-500  → Hand icon
  failed:   w-3.5 h-3.5 rounded-full bg-red-500 border-red-500  → X icon
  pending:  w-3.5 h-3.5 rounded-full bg-transparent border-gray-300

Connector line (between nodes):
  complete:  w-0.5 h-4 bg-green-500/50
  failed:    w-0.5 h-4 bg-red-500/30
  pending:   w-0.5 h-4 bg-gray-200

Stage label:
  complete: text-[11px] font-medium text-green-700
  active:   text-[11px] font-medium text-[#0a0a0a]
  failed:   text-[11px] font-medium text-red-600
  pending:  text-[11px] font-medium text-[#6b7280]

Inline status pill (right of label):
  In Progress:   bg-[#f4f6f0] text-[#6b7a54] rounded-full px-1.5 py-0.5 text-[9px] font-medium
  You're driving: bg-amber-500 text-white rounded-full text-[9px] font-medium
  Failed:        bg-red-50 text-red-600 rounded-full text-[9px] font-medium

Hover "View Trace" affordance (ml-auto, opacity-0 → group-hover:opacity-100):
  complete: bg-[#f4f6f0] text-[#6b7a54]
  phase-2:  bg-blue-50 text-blue-700
  pending:  bg-gray-100 text-gray-600
```

### DAG Stage Row (Compact — read-only, right panel)
```
Wrapper: flex items-start gap-2 py-1
Node dot: w-2.5 h-2.5 rounded-full border-[1.5px]  (same color logic as full, smaller)
Connector: w-px h-2.5
Label: text-[10px] leading-tight  (same color logic)
```

### DAG Phase Header
Labels separating Phase 1 (Decision) from Phase 2 (Execution).
```
flex items-center gap-2 mb-1.5
Icon: h-3 w-3 text-[#6b7a54]
Label: text-[9px] font-bold uppercase tracking-wide text-[#6b7a54]
Sub:   text-[9px] text-[#6b7280]
```

### DAG Phase Handoff Banner
The connector strip between Phase 1 and Phase 2, with an optional deep-link.
```
flex items-center gap-2 my-2 py-1 px-2 rounded-md
Active (phase 1 done): bg-[#f4f6f0]
Inactive:              bg-gray-100
Arrow icon + label text: text-[9px] font-semibold text-[#6b7a54]
Deep-link pill: bg-white text-[#6b7a54] hover:bg-[#e8eddf] rounded-full px-1.5 py-0.5 text-[9px] font-bold
```

### DAG Failure Callout (below failed stage)
```
ml-9 mb-2 p-3 rounded-lg border bg-red-50 border-red-200
Body text: text-[10px] leading-relaxed text-red-700
Actions: flex items-center gap-2 mt-2
  "Call Supplier": bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 h-7 px-3 text-[10px]
  "Retry Agent":   bg-gray-100 hover:bg-gray-200 text-gray-700 h-7 px-3 text-[10px]
```

### Stream Switcher
Appears above Phase 2 execution stages. Each stream is a pill tab.
```
Wrapper: p-2 rounded-lg border bg-gray-50 border-[#e5e5e0]
Header:  text-[9px] font-bold uppercase tracking-wide text-[#6b7280]

Stream pill (selected, active): bg-blue-500 border-blue-500 text-white
Stream pill (selected, draft):  bg-[#87986a] border-[#87986a] text-white
Stream pill (unselected): bg-white border-[#e5e5e0] text-gray-700 hover:border-gray-300 rounded-full

Kind badge inside pill:
  active: bg-blue-50 text-blue-700 (or white/20 when selected)
  draft:  bg-[#f4f6f0] text-[#6b7a54] (or white/20 when selected)

"Soonest" tag: bg-amber-50 text-amber-700
"Open in Orders" link: ml-auto text-blue-700 hover:bg-blue-100 rounded-full text-[10px] font-semibold
Footer meta line: text-[9px] text-[#6b7280]
```

---

## Progress & Data Viz Patterns

Two standard heights — pick by context, never mix ad-hoc values.

### Sidebar Progress Bar (h-1.5 — 6 px)
Used in **left and right sidebars** only: stock bars in sidebar lists, confidence scores, spend %, triage progress, autonomy goal.
```
Track: h-1.5 rounded-full bg-gray-200          (dark: bg-gray-700)
Fill:  h-1.5 rounded-full transition-all
```

### Panel Progress Bar (h-2 — 8 px)
Used in **center panel** content cards only: simulator risk bar, larger metric cards.
```
Track: h-2 rounded-full bg-gray-200             (dark: bg-gray-700)
Fill:  h-2 rounded-full transition-all
```

### Fill Color Rules (shared across both variants)
```
Sage (agent-driven, autonomy, spend):    bg-[#87986a]
Stock / risk threshold:
  > 60% stocked:   bg-green-500
  30–60% stocked:  bg-amber-500
  < 30% stocked:   bg-red-500
Confidence threshold:
  > 85%:  bg-green-500
  > 70%:  bg-amber-500
  ≤ 70%:  bg-red-500
Health / gradient sweep (bad → good):   bg-gradient-to-r from-red-500 via-amber-400 to-green-500
Burn rate sweep (good → bad):           bg-gradient-to-r from-green-500 via-amber-400 to-red-500
```

All fills must include `transition-all` (or `transition-all duration-N` for animated updates).

### Digital Twin Simulator Slider
Custom range input for the par level simulator (center panel).
```
input[type=range]: h-3 rounded-full appearance-none cursor-pointer
Fill color (inline style gradient):
  AI mode:     #87986a (left fill) / #e5e5e0 (right track)
  Manual mode: #f59e0b (amber, left fill)
Min/Max labels: text-[9px] text-[#6b7280]
Live value label: text-[10px] font-bold text-[#0a0a0a]
```

### Preview Metrics Block
The secondary card beneath the simulator slider showing risk at the previewed par.
```
p-3 rounded-lg border bg-gray-50 border-[#e5e5e0]   (light)
p-3 rounded-lg border bg-[#2a2a2a] border-gray-800  (dark)
Section label: text-[9px] font-bold uppercase tracking-wide text-[#6b7280] mb-2
Metric row: flex items-center justify-between
  Label+icon: text-[10px] text-[#6b7280] flex items-center gap-1
  Value: text-xs font-bold  (red/amber/green based on risk threshold)
```

---

## Intelligence Panel Patterns (Right Panel)

### Right Panel Section Header
All-caps label above a group of related intelligence items.
```
text-[10px] font-semibold uppercase tracking-wide  + t.sectionLabel color
  (light: text-gray-600 / dark: text-gray-400)
mb-2
```

### Agent Reasoning Box
White card with a Bot icon and a block of explanatory text from the AI.
```
p-3 rounded-lg border bg-white border-[#e5e5e0] shadow-sm
  Icon: Bot h-3.5 w-3.5 text-[#6b7a54]
  Body: text-[10px] leading-relaxed text-[#404040]
  Divider (when confidence follows): border-t border-[#e5e5e0] mt-2 pt-2
```

### Market Signal Box (Blue)
External data signal from Agent #21. Uses blue as a one-off informational color only.
```
p-2.5 rounded-lg border bg-blue-50 border-blue-200
  Icon: Radar h-3 w-3 text-blue-600
  Label: text-[9px] font-semibold uppercase text-blue-600
  Body: text-[10px] leading-relaxed text-blue-800
```

### Action Log Entry (Green)
Ephemeral success record that pulses on first render.
```
p-2 rounded-lg flex items-center gap-2 bg-green-50  (i===0: animate-pulse)
  Icon: ShieldCheck h-3 w-3 text-green-600
  Name: text-[10px] font-medium text-green-700
  Action: text-[9px] text-[#6b7280]
  Time:   text-[9px] text-[#6b7280] (ml-auto)
```

### ROI of Autonomy Card (Sage)
Shows hours eliminated and cost saved by the AI.
```
p-3 rounded-lg border bg-[#f4f6f0] border-[#dbe3ce]
  Body: text-[10px] leading-relaxed text-[#404040] mb-2
  2-col grid: text-[9px] label + text-sm font-bold text-[#6b7a54] value
```

### Supply Weather Card
Contextual status card. Color is determined by status (clear / caution / disrupted).
```
p-2.5 rounded-lg border
  clear:     bg-green-50 border-green-200   icon/title: text-green-600
  caution:   bg-amber-50 border-amber-200   icon/title: text-amber-600
  disrupted: bg-red-50   border-red-200     icon/title: text-red-600

Icon: h-3.5 w-3.5
Title: text-[10px] font-semibold
Status tag: text-[9px] ml-auto capitalize
Body: text-[10px] leading-relaxed text-[#404040]
```

### Chat Bubble — Atlas (AI)
```
flex items-start gap-2
Avatar: w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5
  Light: bg-[#f4f6f0]   Dark: bg-[#87986a]/20
  Icon: Sparkles h-2.5 w-2.5  Light: text-[#6b7a54]  Dark: text-[#a3b085]
Bubble: max-w-[82%] px-3 py-2 rounded-2xl rounded-tl-sm text-[11px] leading-relaxed border
  Light: bg-[#f4f6f0] border-[#e5e5e0] text-gray-700
  Dark:  bg-[#2a2a2a] border-gray-800  text-gray-300
```

### Chat Bubble — User
```
flex justify-end
Bubble: max-w-[82%] px-3 py-2 rounded-2xl rounded-tr-sm text-[11px] leading-relaxed
  Light: bg-[#87986a] text-white
  Dark:  bg-[#87986a] text-white
```

### Chat Prompt Suggestion Button
Pre-built question that pre-fills the chat.
```
w-full text-left p-2 rounded-lg text-[10px] transition-colors
Light: text-gray-500 hover:bg-[#f4f6f0] hover:text-gray-900
Dark:  text-gray-400 hover:bg-gray-800 hover:text-white
```

### Chat Input Bar (pinned bottom of right panel)
```
Wrapper: shrink-0 p-3 border-t  (border-[#e5e5e0] light / border-gray-800 dark)
  Inner: flex items-end gap-2
Textarea: flex-1 text-[11px] px-3 py-2 rounded-xl border resize-none
  min-rows: 1  auto-grows via onInput height reset
  Light: bg-white border-[#e5e5e0] placeholder-gray-300
  Dark:  bg-[#2a2a2a] border-gray-700 placeholder-gray-600
Send button: w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors mb-0.5
  Enabled:  bg-[#87986a] hover:bg-[#6b7a54] text-white
  Disabled: bg-[#e5e5e0] text-gray-400 cursor-not-allowed  (when textarea is empty)
  Icon: Send h-3 w-3
```

### Card Context Menu (⋯)
Revealed in card header on hover; one ⋯ button per card. Only one menu open at a time; closes on outside `mousedown`.
```
Trigger button: w-5 h-5 rounded flex items-center justify-center transition-colors
  opacity-0 group-hover:opacity-100 (visible while open: opacity-100)
  Light: hover:bg-[#f4f6f0] text-gray-400
  Dark:  hover:bg-gray-700  text-gray-500
  Icon: MoreHorizontal h-3 w-3

Dropdown: absolute right-0 top-6 z-50 w-44 rounded-xl border shadow-lg overflow-hidden
  Light: bg-white border-[#e5e5e0]
  Dark:  bg-[#1a1a1a] border-gray-800
  Item row: w-full flex items-center gap-2.5 px-3 py-2 text-[10px] transition-colors
    Light: hover:bg-[#f4f6f0] text-gray-700
    Dark:  hover:bg-gray-800  text-gray-300
    Icon: h-3 w-3 shrink-0
```

### Source Bridge Panel
Replaces the right panel's normal AI content when the user opens a supplier contact action. Dismissed automatically when the selected order changes.
```
Full right-panel takeover — flex flex-col h-full
Header: px-4 py-3 border-b flex items-center gap-2
  Back button: ArrowLeft h-3.5 w-3.5 (click → clears bridgeTarget)
  Title: text-[11px] font-semibold  e.g. "Message {supplier}"
  Subtitle: text-[10px] text-muted  channel label
Body: flex-1 flex flex-col gap-3 px-4 py-3 overflow-y-auto
  Channel selector (segmented control):
    flex rounded-lg border overflow-hidden (border-[#e5e5e0] / border-gray-700)
    Each half: flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold
      WhatsApp active:  bg-[#25D366] text-white
      Telegram active:  bg-[#0088cc] text-white
      Inactive: bg-white / bg-[#1a1a1a] text-gray-500
    Divider between halves: w-px bg-[#e5e5e0] / bg-gray-700
  Textarea area: flex-1 flex flex-col
    textarea: flex-1 w-full rounded-xl px-3 py-2.5 text-[11px] border resize-none
      Light: bg-white border-[#e5e5e0]   Dark: bg-[#2a2a2a] border-gray-700
Footer: shrink-0 px-4 pb-4 flex flex-col gap-2
  Gateway note: text-[9px] text-center text-muted
  Send button: w-full h-9 rounded-xl text-[11px] font-semibold text-white
    WhatsApp: bg-[#25D366] hover:bg-[#1ea952]
    Telegram: bg-[#0088cc] hover:bg-[#0077bb]
    Label: "Send via WhatsApp" / "Send via Telegram"
```

### Action Button Hierarchy (Center Panel CTAs)
Three-tier visual hierarchy applied to all order action areas in the center panel.
```
Tier 1 — Primary (dominant CTA):
  w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold
  Approve & Execute / Confirm Delivery: bg-[#87986a] hover:bg-[#6b7a54] text-white
  Contact Supplier (resolve):           bg-red-500   hover:bg-red-600   text-white

Tier 2 — Secondary (quiet alternative):
  Rendered as a centered text link below the primary button (no border/outline button)
  inline-flex items-center gap-1.5 text-xs transition-colors
  Light: text-gray-400 hover:text-gray-600   Dark: text-gray-500 hover:text-gray-300
  Examples: "Decline", "Report Issue", "Reschedule"

Tier 3 — Tertiary (utility actions, stage-gated):
  Row: flex items-center justify-center gap-5 pt-2 border-t text-[10px]
  Each action: inline-flex items-center gap-1 transition-colors
    Light: text-gray-400 hover:text-gray-600   Dark: text-gray-500 hover:text-gray-300
  Stage gates:
    "Track"   — visible only when stage ≥ 6 (order dispatched)
    "Repeat"  — visible only when order is completed (stage ≥ 11 / in completedIds)
    "Message supplier" — always visible
```

---

## Calendar Grid Patterns

### Month View Grid
```
Outer wrapper: rounded-xl border border-[#e5e5e0] overflow-hidden  (light)
               rounded-xl border border-gray-800 overflow-hidden    (dark)

Day-of-week header row: grid grid-cols-7
  Cell: text-[9px] font-semibold uppercase text-[#6b7280] text-center py-2 border-b border-[#e5e5e0]

Date cell: min-h-[60px] p-1.5 border-b border-r border-[#e5e5e0] text-[10px]
  Today:       bg-[#f4f6f0]  date number: w-5 h-5 rounded-full bg-[#87986a] text-white
  Other month: text-gray-300
  Current:     text-[#0a0a0a]

Event dot (inside cell): w-1 h-1 rounded-full  (sage / amber / blue based on event type)
```

### Week / Agenda View Row
```
Day row: rounded-xl border p-4
  Today's row: bg-[#f4f6f0] border-[#dbe3ce]  (dark: bg-[#87986a]/5 border-[#87986a]/20)
  Other rows:  bg-white border-[#e5e5e0] shadow-sm  (dark: bg-[#1a1a1a] border-gray-800)

Date column (left): w-12 shrink-0 text-center
  Day name:   text-[9px] uppercase text-[#6b7280]
  Date number: text-base font-bold text-[#0a0a0a]  (today: text-[#87986a])

Event entry inside row: flex items-start gap-2 p-1.5 rounded-lg text-[10px]
  Color dot: w-1.5 h-1.5 rounded-full mt-0.5 shrink-0
```

---

## Table Patterns

Two table archetypes are used in the platform. Use the correct one for the context.

---

### Archetype A — Selection Data Grid
The primary interactive table used for audit/batch operations (e.g. inventory audit mode). Rows are clickable, selectable, and support hover.

#### Table Container
```html
<table className="w-full">
```
No outer card wrapper — sits directly on the panel/sidebar background. The containing panel provides the surface.

#### Header Row
```html
<thead>
  <tr className="text-[9px] uppercase tracking-wide text-[#6b7280]">
    <th className="text-left py-2 px-4 w-8">          {/* checkbox col */}
    <th className="text-left py-2 px-2" style={{ maxWidth: 140 }}>Item</th>
    <th className="text-right py-2 px-2" style={{ maxWidth: 60 }}>On Hand</th>
    {/* text-center for badge/status columns */}
  </tr>
</thead>
```
- Always `text-[9px] uppercase tracking-wide` — never sentence case
- Text alignment mirrors the cell: `text-left` / `text-right` / `text-center`
- Use `style={{ maxWidth: N }}` (not Tailwind `max-w-`) to constrain columns — Tailwind max-width does not work reliably in table layout

#### Data Row
```html
<tr className={`cursor-pointer border-b transition-colors duration-200 ${
  isSelected
    ? isDark ? 'bg-[#87986a]/10 border-[#87986a]/20'
             : 'bg-[#f4f6f0] border-[#87986a]/20'
    : isDark  ? 'border-gray-800/50 hover:bg-gray-800/50'
             : 'border-gray-100 hover:bg-[#f4f6f0]'
}`}>
```
Row dividers use `border-gray-100` (light) / `border-gray-800/50` (dark) — intentionally lighter than card borders so they recede inside the table.

#### Cell Types

**Checkbox column** (always first, no header label):
```html
<td className="py-2 px-4">
  <button onClick={e => { e.stopPropagation(); toggle(id); }}>
    {isChecked
      ? <SquareCheckBig className="h-3.5 w-3.5 text-[#6b7a54]" />
      : <Square className="h-3.5 w-3.5 text-[#6b7280]" />}
  </button>
</td>
```

**Text — primary** (name/title column):
```html
<td className="py-2 px-2" style={{ maxWidth: 140 }}>
  <span className="text-xs font-medium text-[#0a0a0a] truncate block">{name}</span>
</td>
```
`truncate block` is required for `maxWidth` clipping to work.

**Text — secondary** (SKU, category, metadata):
```html
<td className="py-2 px-2" style={{ maxWidth: 80 }}>
  <span className="text-[10px] text-[#6b7280]">{sku}</span>
</td>
```

**Numeric — primary** (quantities, counts):
```html
<td className="py-2 px-2 text-right" style={{ maxWidth: 60 }}>
  <span className="text-xs font-semibold text-[#0a0a0a]">{value}</span>
  <span className="text-[9px] ml-0.5 text-[#6b7280]">{unit}</span>
</td>
```
Pair value + unit label inline; unit is always `text-[9px] ml-0.5`.

**Numeric — muted** (par, burn rate, secondary stats):
```html
<td className="py-2 px-2 text-right" style={{ maxWidth: 60 }}>
  <span className="text-[10px] text-[#6b7280]">{value}</span>
</td>
```

**Numeric — threshold-colored** (days remaining, risk scores):
```html
<td className="py-2 px-2 text-right" style={{ maxWidth: 60 }}>
  <span className={`text-xs font-semibold ${
    days <= 1 ? 'text-red-600'
    : days <= 3 ? 'text-amber-600'
    : 'text-[#0a0a0a]'
  }`}>{days}d</span>
</td>
```
Thresholds are domain-specific but pattern is always: red (critical) → amber (warning) → inherit (safe).

**Badge / status column** (steering mode, category status):
```html
<td className="py-2 px-2 text-center" style={{ maxWidth: 90 }}>
  {renderSteeringBadge(item)}   {/* or inline badge JSX */}
</td>
```

**Icon + label status** (category group, workflow stage):
```html
<td className="py-2 px-2 text-center" style={{ maxWidth: 70 }}>
  <div className="inline-flex items-center gap-1">
    <Icon className="h-3 w-3 text-[color]" />
    <span className="text-[9px] font-medium text-[color]">{label}</span>
  </div>
</td>
```

---

### Archetype B — Management / Catalog Table
Used inside modals for viewing and editing structured records (e.g. SKU catalog, audit log). No selection, no checkbox column. Rows are non-interactive by default; inline edit/action buttons live in the last column.

#### Table Container
```html
<div className="overflow-y-auto flex-1">
  <table className="w-full text-[11px]">
```
Wrapped in a scrolling container when inside a modal body.

#### Header Row
```html
<thead>
  <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-[#e5e5e0]'}`}>
    <th className={`text-left px-4 py-2 font-semibold tracking-wider text-[9px] uppercase
                    ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
      {columnName}
    </th>
  </tr>
</thead>
```
Header border uses `border-[#e5e5e0]` (heavier than data rows) to separate header from body visually.

#### Data Row
```html
<tr className={`border-b ${isDark ? 'border-gray-800' : 'border-gray-100'} ${archived ? 'opacity-40' : ''}`}>
```
No hover, no cursor-pointer — this is a read/edit surface, not a navigation surface.
Archived/disabled rows use `opacity-40`.

#### Cell Types

**Primary text cell:**
```html
<td className={`px-4 py-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{name}</td>
```

**Secondary / metadata cell:**
```html
<td className={`px-4 py-2.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{value}</td>
```

**Monospace cell** (SKU, ID, code):
```html
<td className={`px-4 py-2.5 font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{sku}</td>
```

**Inline editable cell** (shows input when in edit mode):
```html
<td className={`px-4 py-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
  {isEditing
    ? <input className={`w-full text-[11px] px-1.5 py-0.5 rounded border focus:outline-none focus:border-[#87986a]
                         ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white'
                                  : 'bg-white border-[#e5e5e0] text-gray-900'}`} />
    : value}
</td>
```

**Inline action column** (Edit / Archive / Restore buttons):
```html
<td className="px-4 py-2.5">
  <div className="flex items-center gap-1.5">
    <button className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors
      ${isDark ? 'border-gray-700 text-gray-400 hover:text-[#a3b085] hover:border-[#87986a]/50'
               : 'border-[#e5e5e0] text-gray-500 hover:text-[#6b7a54]'}`}>
      Edit
    </button>
    <button className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors
      ${isArchived
        ? isDark ? 'border-[#87986a]/50 text-[#a3b085]' : 'border-[#6b7a54]/50 text-[#6b7a54]'
        : isDark ? 'border-gray-700 text-gray-500 hover:text-amber-400 hover:border-amber-500/40'
                 : 'border-[#e5e5e0] text-gray-500 hover:text-amber-600'}`}>
      {isArchived ? 'Restore' : 'Archive'}
    </button>
  </div>
</td>
```

---

### Shared Rules (both archetypes)
- All `<table>` are `w-full` — never set a fixed width.
- Use `style={{ maxWidth: N }}` on `<th>` and `<td>` pairs together for column width constraints.
- `py-2 px-2` for data cells; `py-2 px-4` for the checkbox column and management tables.
- Row dividers: `border-gray-100` (light) / `border-gray-800` (dark) — always lighter than the surrounding card border.
- Never add background to `<thead>` — header inherits the panel background.

---

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Page Background | `#ffffff` | The canvas every panel sits on |
| 1 | Card Surface | `#ffffff` | All content cards (adds border + shadow) |
| 2 | Subtle Hover | `#f5f5f5` | Hover state on white cards, secondary tabs |
| 3 | Sage Ash | `#f4f6f0` | Selected states, active filter chips, info callouts |
| 4 | Sage Muted | `#dbe3ce` | Callout borders, decorative fills |

---

## Do's and Don'ts

### Do
- Use `#87986a` (Sage) as the **only** primary action and accent color.
- Use `bg-white` for all card and panel surfaces in light mode.
- Use `border-[#e5e5e0]` for all card borders and dividers — never `border-gray-200`.
- Use `shadow-sm` on main panel-level cards (`rounded-xl`) in light mode.
- Use `rounded-full` for all chips, badges, pills, and toggle groups.
- Use `rounded-xl` for all major content cards inside panels.
- Use `rounded-2xl` for all modals.
- Use `text-xs font-semibold` for card headings, `text-[10px] font-semibold uppercase tracking-wide` for group labels.
- Apply `transition-colors` to all interactive elements.
- Keep dark mode cards at `bg-[#2a2a2a]` / `bg-[#1a1a1a]` — no shadows needed.

### Don't
- Do not use blue, purple, or any non-sage brand accent anywhere.
- Do not use `bg-gray-50` as a card background — it's only for hover states and toggle wrappers.
- Do not use `border-gray-200` — always use `border-[#e5e5e0]`.
- Do not apply heavy shadows; max is `shadow-sm` on cards, `shadow-md` on dropdowns.
- Do not use arbitrary border radii — stick to the 4 defined levels (full, lg, xl, 2xl).
- Do not put text smaller than `text-[9px]` — reserved only for the tightest micro-labels.
- Do not introduce new typefaces or brand colors.
- Do not use saturated color blocks — sage and amber appear only in small functional highlights.

---

## Layout

Three-panel cognitive layout:
- **Left** — "What am I looking at?" — Catalog / List / Heartbeat sidebar
- **Center** — "What am I doing with it?" — Journey / Task / Digital Twin
- **Right** — "What should I know about it?" — Intelligence / Context / Chat

Rules:
- All three panels scroll independently (`min-h-0`, `overflow-auto`, `overflow-y-auto`).
- Panels never share scroll position.
- Center and right panels get `p-6` outer padding.
- Left panel sections use `p-4 border-b border-[#e5e5e0]`.
- **Left and right sidebars are always `bg-white` in light mode** — never `bg-gray-50`.
- Center panel may use a subtle `bg-gray-50/50` tint to visually separate it from the white sidebars.
- Panel dividers (border between columns): `border-[#e5e5e0]` — never `border-gray-200`.
- Dark mode: left/right panels use `bg-[#111]` or `bg-[#1a1a1a]`; center uses `bg-[#111]`.

### Panel Morph Transition
When the center panel morphs between views (e.g. calendar list → event DAG journey):
```
Outgoing view (hidden): opacity-0 pointer-events-none absolute inset-0
Incoming view (shown):  transition-all duration-[380ms] flex-1 min-h-0 overflow-y-auto p-6
```
Always pair `opacity-0` with `pointer-events-none` — never use `display:none` (breaks layout shift).

### Flex Text Truncation
When a flex child contains long text that must be clipped:
```
Parent:  flex items-center gap-2
Child:   flex-1 min-w-0        ← required — without min-w-0 flex child overflows
Text:    truncate block text-xs font-medium
```
`min-w-0` is mandatory; omitting it causes the text to overflow the flex container.

---

## Tailwind Quick-Start

```css
/* In globals.css / @theme inline block */
--color-sage:             #87986a;
--color-sage-dark:        #6b7a54;
--color-sage-mid:         #a3b085;
--color-sage-ash:         #f4f6f0;
--color-sage-border:      #e5e5e0;
--color-sage-border-muted:#dbe3ce;
```

### Utility shortcuts (mental model)
```
Primary button:    bg-[#87986a] hover:bg-[#6b7a54] text-white
Sage outline btn:  bg-[#f4f6f0] border border-[#87986a]/40 text-[#6b7a54]
Ghost button:      text-gray-700 hover:bg-[#f4f6f0]          ← never hover:bg-gray-100
Card (light):      bg-white border border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-xl
Divider:           border-[#e5e5e0]                          ← never border-gray-200
Selected row/card: bg-[#f4f6f0] border-[#87986a]/40 ring-1 ring-[#87986a]/15
Agent badge:       bg-[#f4f6f0] border-[#87986a]/30 text-[#6b7a54]
Section label:     text-[10px] font-semibold uppercase tracking-wide text-gray-500
Live dot:          w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse
Bouncing dots:     w-1 h-1 rounded-full bg-[#87986a] animate-bounce (3x, delay 0/150/300ms)
Panel morph out:   opacity-0 pointer-events-none absolute inset-0
```
