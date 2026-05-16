# Buyamia Procurement Platform — UI Design Spec

**Date:** 2026-03-26
**Status:** Pending user review
**Scope:** Complete buyer-side UI for 9 pages, new sage/olive color system, three-panel cockpit layout

---

## 1. Design Philosophy

Every screen follows the Buyamia Design Philosophy — 4 pillars enforced on all UI work:

1. **Layout as Context** — Three-panel cognitive layout (Left: catalog/options, Center: active task, Right: intelligence/context)
2. **Meaningful Space** — Generous padding, large typography, no data cramming above the fold
3. **Proximity of Action** — Inline buttons/actions adjacent to the data they affect
4. **Asynchronous Independence** — Panels scroll independently (`min-h-0`, `overflow-auto`)

---

## 2. Color System (Light Theme Only)

Primary: sage/olive `#87986a`

### Primary Scale
| Token | Hex |
|-------|-----|
| primary-50 | `#f4f6f0` |
| primary-100 | `#dbe3ce` |
| primary-200 | `#bfc89f` |
| primary-300 | `#a3b085` |
| primary-400 / primary | `#87986a` |
| primary-500 | `#6b7a54` |
| primary-600 | `#4f5c3e` |
| primary-700 | `#3a4430` |

### Semantic Colors
| Role | Foreground | Background | Accent |
|------|-----------|------------|--------|
| Success | `#6b7a54` | `#f4f6f0` | — |
| Warning | `#92650a` | `#fef5e7` | `#d99a44` |
| Danger | `#8f3a32` | `#fdf0ef` | `#c6564c` |
| Info | `#4a6b82` | `#eef3f7` | `#7998af` |
| Purple accent | `#6b4e8a` | `#f3f0f9` | — |

### Surface Colors (Light Theme)
- Page background: `#f8f8f6`
- Card/panel background: `white`
- Borders: `#e5e5e0`
- Text primary: `#1a1a1a`
- Text secondary: `#6b7280`
- Text muted: `#9ca3af`

Dark theme deferred to a future cycle.

---

## 3. Navigation

Horizontal top nav bar with 9 items:

```
[B Logo] Buyamia Procurement | Dashboard | New Request | Orders | Quotes | Group Buying | Inventory | Analytics | Vendors | Settings
```

- Active item: `background: #f4f6f0; color: #4f5c3e; font-weight: 500`
- Inactive: `color: #6b7280`
- Logo: 28px rounded square with gradient `#87986a → #6b7a54`, white "B"

---

## 4. Global Layout Rules

- Three-panel layout applies to all pages **except Settings** (which uses a single centered panel with tabs)
- Left panel: 260–280px fixed width
- Center panel: flex-1, **max-width: 1800px**
- Right panel: 260–280px fixed width
- All three panels scroll independently
- Panel heights: `flex: 1; overflow-y: auto; min-h-0`

---

## 5. Page Designs

### 5.1 Dashboard (Command Center)

**Left Panel — Action Items:**
- Grouped by urgency: Urgent (red), Needs Attention (amber), Informational (blue)
- Each item: title, description, timestamp, action button inline
- Filter chips: All, Urgent, Orders, Quotes

**Center Panel — Overview:**
- Stats grid (4 cols): Active Requests, Pending Quotes, In-Transit Orders, Monthly Spend
- Quick Actions: 2x2 button grid (New Request, Reorder Last, Check Inventory, View Reports)
- Recent Requests: card list with status badges, vendor, amount, progress
- Budget Usage: progress bar with monthly limit

**Right Panel — AI Intelligence:**
- AI chat input at top
- Proactive suggestions (savings opportunities, reorder reminders)
- Market insights
- Quick action buttons

### 5.2 New Request (7-Step Wizard)

The center panel progresses through 7 steps. Left panel shows product browser (steps 1–3) then request summary (steps 4–7). Right panel shows contextual AI intelligence throughout.

**Step 1 — Request Details** (existing):
- Request name, description, procurement type (Products/Services/Both), product type (Food & Beverage / Furniture & Equipment)

**Step 2 — Sourcing Method:**
- 4 radio card options with autonomy level tags:
  - AI Auto-Source (recommended, L2) — AI matches vendors, user approves
  - Request for Quotes / RFQ (L1) — competitive quotes
  - Direct to Vendor (L0) — skip quotes
  - Join Group Buying Pool — demand pooling

**Step 3 — Add Items:**
- Left panel: searchable product catalog with categories, price ranges, + buttons
- Center: added items list, each with quantity stepper, unit selector, specs/notes input, estimated cost
- Running total bar at bottom
- "Add Custom Item" button for unlisted products

**Step 4 — Delivery & Logistics:**
- Saved delivery address selection (radio cards)
- "Add New Address" button
- Delivery window dropdown (Morning/Midday/Afternoon)
- Urgency dropdown (Standard/Express/Emergency)
- Special handling toggle chips: Cold Chain, Fragile, No Substitutions, Certificate of Origin
- Delivery notes textarea

**Step 5 — Budget & Timeline:**
- Maximum budget input
- Auto-approve threshold input (L2 autonomy: AI can accept quotes under this amount)
- Visual budget gauge: estimated cost vs budget with auto-approve marker
- Need-by date picker
- Quote deadline date picker
- Recurring order toggle

**Step 6 — Review & Confirm:**
- Compact summary cards for each previous step with "Edit →" link
- Right panel: AI readiness check, "what happens next" numbered timeline
- "Publish Request" button

**Step 7 — Published (Success State):**
- Centered success message with request ID
- Summary card (items, budget, need-by, autonomy level)
- Action buttons: View in Quotes, Create Another, Go to Dashboard
- Right panel: live AI matching activity feed

### 5.3 Orders (Delivery Tracking & Management)

**Left Panel — Order List:**
- Grouped by status: In Transit (purple), Processing (blue), Pending (amber), Delivered (green)
- Each card: order name, vendor, amount, ETA/status, item count
- Search + status filter chips

**Center Panel — Order Detail:**
- Header: order title, status badge, inline actions (Download Invoice, Contact Vendor, Confirm Receipt)
- Delivery Timeline: 5-step visual tracker (Confirmed → Packed → Shipped → In Transit → Delivered), current step highlighted/pulsing
- Tracking info bar: tracking number, carrier, last location, temperature (cold chain)
- Order Items table: item name/description, SKU, quantity, unit price, subtotal, "+N more items" collapse
- Order Summary: subtotal, shipping, group buying discount, tax, total
- Receiving Checklist: quality inspection tasks with checkboxes (verify cold chain, inspect packaging, count items, photo-document)

**Right Panel — Delivery Intelligence:**
- AI delivery prediction: ETA with confidence %, vendor on-time rate bar
- Vendor performance: quality score, orders completed, avg delivery time, dispute rate
- Active alerts: route changes, cold chain status, delays
- Quick actions: view delivery log, message vendor, reorder, report issue

### 5.4 Quotes (Review & Negotiate)

**Left Panel — Quote List:**
- Grouped by request name
- Each card: vendor name, total amount, delivery time, expiry countdown
- Status filter chips: All, New, Under Review, Accepted

**Center Panel — Quote Comparison:**
- Side-by-side comparison cards (2–3 vendors)
- Each card: vendor name, price, delivery time, terms, item breakdown
- AI recommendation badge on best-value quote
- Negotiation thread: message history with vendor, inline reply
- Accept/Reject/Counter-offer buttons per quote

**Right Panel — Negotiation Intelligence:**
- Market price benchmarks per item
- Historical pricing from this vendor
- AI negotiation suggestions
- Savings calculator

### 5.5 Group Buying

**Left Panel — Demand Pools:**
- Grouped by urgency: Closing Soon (red), Active (green), Forming (blue)
- Each pool: product name, progress bar (current vs target volume), member count, savings %
- Search + category filters

**Center Panel — Pool Detail:**
- Pool header: product, current volume/target, time remaining
- Tier progress visualization: volume tiers with corresponding discount levels
- Join form: commit type (hard/soft), quantity input
- Member grid: participating buyers, their committed quantities
- Pool terms and conditions

**Right Panel — Savings Intelligence:**
- Estimated savings at current tier vs next tier
- Historical pool success rates
- AI recommendation: optimal commit quantity
- Similar active pools

### 5.6 Inventory (POS & Predictive Stock)

**Left Panel — Inventory List:**
- Grouped by stock urgency: Critical (red), Low (amber), Healthy (green)
- Each item: name, stock % with progress bar, days remaining estimate
- Search + stock level filter chips

**Center Panel — Item Detail:**
- Item header with stock level badge
- POS-linked menu items: which dishes use this ingredient
- Usage chart: consumption trend over time (area/line chart)
- Auto-reorder card: threshold settings, preferred vendor, autonomy level (L0–L3)
- Reorder history

**Right Panel — Predictive Intelligence:**
- AI stockout prediction with confidence
- Demand forecast (upcoming events, seasonal trends)
- Autonomy level indicator with explanation
- Auto-reorder alerts and pending actions

### 5.7 Analytics & Finance

**Left Panel — Report Categories:**
- Spending, Savings, Vendors, Invoices, Cash Flow
- Date range filter
- Export button

**Center Panel — Reports:**
- Spending overview: line/bar charts (Recharts), category breakdown
- Invoice list with inline "Pay" button, status badges
- Supplier concentration risk visualization
- Early-payment discount opportunities table
- Category spending breakdown (pie/donut chart)

**Right Panel — AI Savings Intelligence:**
- Total savings breakdown (negotiation, group buying, early payment, contract)
- Savings opportunities: actionable recommendations with estimated impact
- Cash flow outlook: upcoming payments, receivables
- Budget vs actual tracking

### 5.8 Vendors (Relationship & Performance Hub)

**Left Panel — Vendor Directory:**
- All vendors with avatar (initials), category, star rating, reliability %
- Search + category filter chips (Produce, Beverage, Equipment, Bakery)
- "Add Vendor" button

**Center Panel — Vendor Profile:**
- **Storefront banner**: wide cover image (180px height) uploaded by seller, with vendor info bar overlapping the bottom edge (avatar overlaps banner like a cover photo pattern)
- Vendor name, "Preferred" badge, star rating, location, member-since date
- Inline actions: Message, New Order
- Stats row (5 cols): Total Orders, Total Spend, Rating, On-Time Rate, Avg Delivery
- Active Contracts: contract cards with name, frequency, item count, monthly value, next delivery, discount, inline actions (View Items, Edit, Pause)
- Contact & Details: primary contact name/role, phone, email, address, payment terms, certifications (Organic, HACCP, FDA)
- Recent Orders table: order ID, description, date, amount, status badge, quality rating

**Right Panel — Performance Intelligence:**
- AI Vendor Score: letter grade (A+), percentile, summary
- Performance breakdown: progress bars for Delivery Reliability, Quality Consistency, Price Competitiveness, Communication
- Price trend: 6-month bar chart with market comparison warning
- AI Recommendations: consolidate orders, early payment opportunity, volume tier negotiation

### 5.9 Settings

**Layout:** Single centered panel with tabs (no three-panel layout)

Tabs: Profile, Organization, Notifications, Appearance, Security

Existing design — no changes needed beyond color update from teal to sage.

---

## 6. Autonomy Levels

A key Buyamia concept surfaced across multiple pages:

| Level | Name | Behavior | Where it appears |
|-------|------|----------|-----------------|
| L0 | Manual | User controls everything | Direct to Vendor sourcing |
| L1 | Suggest | AI suggests, user decides | RFQ sourcing, intelligence panels |
| L2 | Auto | AI acts within limits, user approves exceptions | Auto-source, auto-approve budget threshold, auto-reorder |
| L3 | Full Autonomous | AI handles end-to-end | Future: full auto-reorder |

---

## 7. Interaction Patterns

### Consistent across all pages:
- **Selection state:** 2px solid primary border + primary-50 background on selected cards
- **Hover state:** border darkens one step, optional subtle shadow
- **Status badges:** rounded pill shape, semantic color background + border + text
- **Search inputs:** left-aligned search icon, consistent padding/border-radius
- **Filter chips:** toggle group, active chip gets primary-50 bg + primary border
- **Action buttons:** primary actions in `#87986a`, secondary in white with gray border
- **Cards:** white background, `#e5e5e0` border, 8–10px border-radius
- **Progress bars:** 4px height, `#e5e5e0` track, semantic color fill
- **Step badge:** "Step N of 7" in primary-50 pill, top-right of center panel header

### Data density:
- Left panel: compact cards, 10–12px font sizes, tight spacing
- Center panel: comfortable spacing, 12–16px font sizes, generous padding
- Right panel: information-dense but well-grouped, 10–12px font sizes

---

## 8. Implementation Scope

### New pages to create:
- `QuotesPage.tsx`
- `GroupBuyingPage.tsx`
- `InventoryPage.tsx`

### Existing pages to enhance:
- `DashboardPage.tsx` — convert to three-panel layout
- `OrdersPage.tsx` — convert to three-panel with delivery tracking detail
- `VendorsPage.tsx` — convert to three-panel with storefront banner and vendor profile
- `AnalyticsPage.tsx` — convert to three-panel with finance features
- `RequestPanel.tsx` — add steps 2–7 to the wizard

### Existing pages with color-only changes:
- `SettingsPage.tsx` — update teal → sage, keep single-panel layout

### Global changes:
- `App.tsx` — add new Page types (`quotes`, `groupbuying`, `inventory`), nav items, imports
- All components — replace teal color references with sage `#87986a` equivalents
- Center panel max-width: 1800px on every three-panel page

### Not in scope:
- Dark theme (deferred)
- Seller dashboard (separate future project)
- Backend/API integration (dummy data throughout)
- Mobile responsive (desktop-first)

---

## 9. Tech Stack (Existing)

- React 18 + TypeScript
- Vite 6.3.5
- Tailwind CSS 4.1.12
- Radix UI + Shadcn (55+ components)
- Recharts (charts)
- Lucide (icons)
- Sonner (toasts)
- State-based routing via `type Page` union in App.tsx (no React Router)
- Theme prop pattern: `theme: 'dark' | 'light'`, `isDark` boolean

---

## 10. Visual Mockups

All mockups are available in `.superpowers/brainstorm/` directory:

| File | Content |
|------|---------|
| `nav-structure.html` | Navigation bar + three-panel wireframes |
| `color-system-light.html` | Full sage palette, semantic colors, component preview |
| `page-dashboard.html` | Dashboard / Command Center |
| `page-quotes.html` | Quotes review & negotiation |
| `page-groupbuying.html` | Group buying demand pools |
| `page-inventory.html` | POS-linked inventory management |
| `page-analytics.html` | Analytics & finance |
| `page-orders.html` | Enhanced orders with delivery tracking |
| `page-vendors.html` | Vendor hub with storefront banner |
| `page-request-wizard.html` | Request wizard steps 2–7 |
