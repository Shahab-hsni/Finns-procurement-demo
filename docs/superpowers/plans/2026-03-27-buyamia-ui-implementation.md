# Buyamia Procurement Platform — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete buyer-side UI for Buyamia Procurement Platform with 9 pages, sage/olive color system, three-panel cockpit layout, and meaningful data flows with dummy data.

**Architecture:** All pages follow the Buyamia Design Philosophy (4 pillars enforced). Three-panel layout applies to Dashboard, Orders, Quotes, Group Buying, Inventory, Analytics, and Vendors. Settings uses single centered panel. Request wizard extends existing 7-step flow. All flows lead to meaningful end states with dummy data showing real user journeys.

**Tech Stack:** React 18 + TypeScript, Vite 6.3.5, Tailwind CSS 4 with CSS variables, Radix UI + Shadcn (55+ components), Recharts, Lucide icons, Sonner toasts. State-based routing via `type Page` union in App.tsx.

---

## File Structure

**New files to create:**
- `src/components/QuotesPage.tsx` — Quote review & negotiation (three-panel)
- `src/components/GroupBuyingPage.tsx` — Demand pools (three-panel)
- `src/components/InventoryPage.tsx` — POS-linked inventory (three-panel)

**Files to modify:**
- `src/App.tsx` — Add new Page types, nav items, imports, swap teal → sage color in all three theme renders
- `src/components/DashboardPage.tsx` — Convert to three-panel layout, swap teal → sage
- `src/components/OrdersPage.tsx` — Convert to three-panel with delivery tracking detail, swap teal → sage
- `src/components/VendorsPage.tsx` — Add storefront banner, convert to three-panel with vendor profile, swap teal → sage
- `src/components/AnalyticsPage.tsx` — Convert to three-panel with finance features, swap teal → sage
- `src/components/SettingsPage.tsx` — Swap teal → sage (keep single-panel)
- `src/components/RequestPanel.tsx` — Add steps 2–7 to wizard, swap teal → sage
- `src/styles/globals.css` — Update CSS variables for sage color system

**No changes needed:**
- `src/components/ProductSidebar.tsx` — Already exists, color swap only
- `src/components/IntelligencePanel.tsx` — Already exists, color swap only
- All UI components in `src/components/ui/` — No changes

---

## Task 1: Update Color System

**Files:**
- Modify: `src/styles/globals.css:3-42` (light theme variables)
- Modify: `src/App.tsx:72, 154, 236` (logo gradient)
- Modify: `src/App.tsx:90, 172, 254` (active nav item colors)

- [ ] **Step 1: Update CSS variables for sage palette**

Replace the entire light theme `:root` block (lines 3-42) with:

```css
:root {
  --font-size: 16px;
  --background: #ffffff;
  --foreground: oklch(0.145 0 0);
  --card: #ffffff;
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: #87986a; /* sage primary */
  --primary-foreground: #ffffff;
  --secondary: #6b7a54; /* sage dark */
  --secondary-foreground: #ffffff;
  --muted: #dbe3ce; /* sage light */
  --muted-foreground: #6b7280;
  --accent: #f4f6f0; /* sage 50 */
  --accent-foreground: #4f5c3e; /* sage 600 */
  --destructive: #c6564c;
  --destructive-foreground: #ffffff;
  --border: #e5e5e0;
  --input: #e5e5e0;
  --input-background: #ffffff;
  --switch-background: #bfc89f;
  --font-weight-medium: 500;
  --font-weight-normal: 400;
  --ring: #87986a;
  --chart-1: #87986a;
  --chart-2: #6b7a54;
  --chart-3: #a3b085;
  --chart-4: #bfc89f;
  --chart-5: #dbe3ce;
  --radius: 0.625rem;
  --sidebar: #ffffff;
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: #87986a;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f4f6f0;
  --sidebar-accent-foreground: #4f5c3e;
  --sidebar-border: #e5e5e0;
  --sidebar-ring: #87986a;
}
```

- [ ] **Step 2: Run dev server to verify CSS loads**

```bash
cd d:/Redesignprocurementplatform && npm run dev
```

Expected: Dev server starts on port 3000, no CSS errors in console.

- [ ] **Step 3: Commit color system update**

```bash
git add src/styles/globals.css
git commit -m "refactor: update color system from teal to sage palette"
```

---

## Task 2: Update App.tsx — Navigation & Routing

**Files:**
- Modify: `src/App.tsx:1-12` (imports)
- Modify: `src/App.tsx:34` (Page type)
- Modify: `src/App.tsx:40-47` (navItems array)
- Modify: `src/App.tsx:49-64` (renderPageContent switch)
- Modify: `src/App.tsx:72, 154, 236` (logo gradient — teal → sage)
- Modify: `src/App.tsx:88-92, 170-174, 252-256` (active nav colors — teal → sage)

- [ ] **Step 1: Add imports for new pages**

Add these three imports after line 8 (after SettingsPage import):

```typescript
import { QuotesPage } from "./components/QuotesPage";
import { GroupBuyingPage } from "./components/GroupBuyingPage";
import { InventoryPage } from "./components/InventoryPage";
```

Also add three new icons to line 11's lucide import:

```typescript
import { Moon, Sun, Palette, LayoutDashboard, ShoppingCart, Package, BarChart3, Settings, Users, MessageSquare, Users2, Package2 } from "lucide-react";
```

(Icons: MessageSquare for Quotes, Users2 for Group Buying, Package2 for Inventory)

- [ ] **Step 2: Update Page type union**

Replace line 34 with:

```typescript
type Page = 'request' | 'dashboard' | 'orders' | 'quotes' | 'groupbuying' | 'inventory' | 'vendors' | 'analytics' | 'settings';
```

- [ ] **Step 3: Update navItems array**

Replace lines 40-47 with:

```typescript
const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'request' as Page, label: 'New Request', icon: Package },
  { id: 'orders' as Page, label: 'Orders', icon: ShoppingCart },
  { id: 'quotes' as Page, label: 'Quotes', icon: MessageSquare },
  { id: 'groupbuying' as Page, label: 'Group Buying', icon: Users2 },
  { id: 'inventory' as Page, label: 'Inventory', icon: Package2 },
  { id: 'vendors' as Page, label: 'Vendors', icon: Users },
  { id: 'analytics' as Page, label: 'Analytics', icon: BarChart3 },
  { id: 'settings' as Page, label: 'Settings', icon: Settings }
];
```

- [ ] **Step 4: Update renderPageContent switch**

Replace lines 49-64 with:

```typescript
const renderPageContent = (pageTheme: 'dark' | 'light') => {
  switch (currentPage) {
    case 'dashboard':
      return <DashboardPage theme={pageTheme} />;
    case 'orders':
      return <OrdersPage theme={pageTheme} />;
    case 'quotes':
      return <QuotesPage theme={pageTheme} />;
    case 'groupbuying':
      return <GroupBuyingPage theme={pageTheme} />;
    case 'inventory':
      return <InventoryPage theme={pageTheme} />;
    case 'vendors':
      return <VendorsPage theme={pageTheme} />;
    case 'analytics':
      return <AnalyticsPage theme={pageTheme} />;
    case 'settings':
      return <SettingsPage theme={pageTheme} />;
    default:
      return <RequestPanel theme={pageTheme} />;
  }
};
```

- [ ] **Step 5: Update dark theme logo gradient**

Replace line 72's `from-teal-500 to-teal-600` with `from-yellow-600 to-yellow-700` (sage doesn't work well in dark, use neutral yellow that reads on dark bg). Actually, use `from-[#87986a] to-[#6b7a54]`:

```typescript
<div className="w-8 h-8 bg-gradient-to-br from-[#87986a] to-[#6b7a54] rounded-lg flex items-center justify-center">
```

- [ ] **Step 6: Update dark theme active nav colors**

Replace lines 88-92 with:

```typescript
className={`gap-2 ${
  currentPage === item.id
    ? 'bg-[#87986a]/10 text-[#87986a] hover:bg-[#87986a]/20 hover:text-[#6b7a54]'
    : 'text-gray-400 hover:text-white hover:bg-gray-800'
}`}
```

- [ ] **Step 7: Update light theme logo gradient**

Replace line 154's `from-teal-500 to-teal-600` with `from-[#87986a] to-[#6b7a54]`:

```typescript
<div className="w-8 h-8 bg-gradient-to-br from-[#87986a] to-[#6b7a54] rounded-lg flex items-center justify-center">
```

- [ ] **Step 8: Update light theme active nav colors**

Replace lines 170-174 with:

```typescript
className={`gap-2 ${
  currentPage === item.id
    ? 'bg-[#f4f6f0] text-[#4f5c3e] hover:bg-[#dbe3ce] hover:text-[#3a4430]'
    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
}`}
```

- [ ] **Step 9: Update hybrid theme logo gradient**

Replace line 236's `bg-white` background with sage primary, but keep text white. Use:

```typescript
<div className="w-8 h-8 bg-[#87986a] rounded-lg flex items-center justify-center">
  <span className="text-white">B</span>
</div>
```

- [ ] **Step 10: Update hybrid theme active nav colors**

Replace lines 252-256 with:

```typescript
className={`gap-2 ${
  currentPage === item.id
    ? 'bg-white/20 text-white hover:bg-white/30'
    : 'text-white/80 hover:text-white hover:bg-white/10'
}`}
```

(Hybrid already works fine with these colors since the nav bar is teal-gradient; keeping white/transparent theme.)

- [ ] **Step 11: Verify all three theme renders have center panel max-width**

In renderDarkTheme (line 134), renderLightTheme (line 216), and renderHybridTheme (line 298), the center panel `<div className="flex-1 h-full">` needs to also have `max-width-[1800px] mx-auto`. Update each:

Dark theme, line 134:
```typescript
<div className="flex-1 h-full max-w-[1800px] mx-auto">
```

Light theme, line 216:
```typescript
<div className="flex-1 h-full max-w-[1800px] mx-auto">
```

Hybrid theme, line 298:
```typescript
<div className="flex-1 h-full bg-gray-50 max-w-[1800px] mx-auto">
```

- [ ] **Step 12: Test navigation links**

Run dev server and click through Dashboard, New Request, Orders, Quotes, Group Buying, Inventory, Vendors, Analytics, Settings. Each should switch pages without errors (new pages will render empty or error until created).

Expected: Navigation works, old pages load with sage colors, new pages show error (component not found).

- [ ] **Step 13: Commit App.tsx updates**

```bash
git add src/App.tsx
git commit -m "feat: add quotes, groupbuying, inventory pages to routing; update color scheme to sage"
```

---

## Task 3: Create QuotesPage.tsx

**Files:**
- Create: `src/components/QuotesPage.tsx`

- [ ] **Step 1: Create file with three-panel structure**

```typescript
import { useState } from "react";
import { Search, Filter, Star, TrendingUp, MessageCircle, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface QuotesPageProps {
  theme?: 'dark' | 'light';
}

export function QuotesPage({ theme = 'dark' }: QuotesPageProps) {
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuote, setSelectedQuote] = useState("QT-2024-089-01");

  const quotes = [
    {
      id: "QT-2024-089-01",
      requestId: "REQ-2024-089",
      requestName: "Fresh Produce Q4",
      vendor: "Fresh Farm Supply Co.",
      amount: "$2,450.00",
      deliveryTime: "2 days",
      expiresIn: "3 days",
      status: "new",
      items: 12,
      rating: 4.8
    },
    {
      id: "QT-2024-089-02",
      requestId: "REQ-2024-089",
      requestName: "Fresh Produce Q4",
      vendor: "Green Valley Imports",
      amount: "$2,680.00",
      deliveryTime: "4 days",
      expiresIn: "5 days",
      status: "new",
      items: 12,
      rating: 4.2
    },
    {
      id: "QT-2024-088-01",
      requestId: "REQ-2024-088",
      requestName: "Coffee Supplies",
      vendor: "Bean & Brew Distributors",
      amount: "$890.00",
      deliveryTime: "1 day",
      expiresIn: "Expires today",
      status: "under-review",
      items: 5,
      rating: 4.9
    },
    {
      id: "QT-2024-087-01",
      requestId: "REQ-2024-087",
      requestName: "Kitchen Equipment",
      vendor: "Commercial Kitchen Pro",
      amount: "$15,200.00",
      deliveryTime: "5 days",
      expiresIn: "Expired 2 days ago",
      status: "expired",
      items: 3,
      rating: 4.7
    }
  ];

  const getStatusConfig = (status: string) => {
    const configs = {
      'new': {
        label: 'New',
        className: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200'
      },
      'under-review': {
        label: 'Under Review',
        className: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200'
      },
      'accepted': {
        label: 'Accepted',
        className: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200'
      },
      'expired': {
        label: 'Expired',
        className: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200'
      }
    };
    return configs[status as keyof typeof configs];
  };

  const selectedQuoteData = quotes.find(q => q.id === selectedQuote);

  return (
    <div className={`flex h-full ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
      {/* LEFT PANEL: Quote List */}
      <div style={{width: '280px'}} className={`flex flex-col border-r ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div style={{fontSize: '14px'}} className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}>Quotes</div>
          <div style={{fontSize: '12px'}} className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Review & negotiate</div>
        </div>

        <div className={`px-3 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <Input placeholder="Search quotes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : ''} />
          <div style={{display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap'}}>
            <Badge variant="outline" className={isDark ? 'bg-[#87986a]/10 text-[#87986a] border-[#87986a]/20' : 'bg-[#f4f6f0] text-[#4f5c3e] border-[#dbe3ce]'}>All (4)</Badge>
            <Badge variant="outline" className={isDark ? 'bg-transparent border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-600'}>New (2)</Badge>
            <Badge variant="outline" className={isDark ? 'bg-transparent border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-600'}>Review (1)</Badge>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div style={{padding: '12px'}}>
            {quotes.map((quote) => {
              const config = getStatusConfig(quote.status);
              return (
                <div
                  key={quote.id}
                  onClick={() => setSelectedQuote(quote.id)}
                  style={{padding: '10px', marginBottom: '6px', borderRadius: '8px', cursor: 'pointer', border: selectedQuote === quote.id ? `2px solid #87986a` : `1px solid ${isDark ? '#374151' : '#e5e5db'}`}}
                  className={selectedQuote === quote.id ? (isDark ? 'bg-[#87986a]/10' : 'bg-[#f4f6f0]') : (isDark ? 'bg-[#2a2a2a]' : 'bg-white')}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                    <div style={{fontSize: '12px'}} className={isDark ? 'text-white font-500' : 'text-gray-900 font-500'}>{quote.vendor}</div>
                    <Badge variant="outline" className={config.className}>{config.label}</Badge>
                  </div>
                  <div style={{fontSize: '11px'}} className={isDark ? 'text-gray-400' : 'text-gray-600'}>{quote.requestName}</div>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '6px'}}>
                    <span style={{fontSize: '12px'}} className={isDark ? 'text-[#87986a]' : 'text-[#87986a] font-500'}>{quote.amount}</span>
                    <span style={{fontSize: '10px'}} className={isDark ? 'text-gray-500' : 'text-gray-500'}>{quote.deliveryTime}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* CENTER PANEL: Quote Detail */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0 max-w-[1800px]">
        {selectedQuoteData && (
          <>
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontSize: '16px'}} className={isDark ? 'text-white font-600' : 'text-gray-900 font-600'}>{selectedQuoteData.vendor}</div>
                  <div style={{fontSize: '12px'}} className={isDark ? 'text-gray-400' : 'text-gray-600 mt-1'}>{selectedQuoteData.requestName} · {selectedQuoteData.items} items</div>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <Button variant="outline" size="sm">Message Vendor</Button>
                  <Button className="bg-[#87986a] hover:bg-[#6b7a54] text-white">Accept Quote</Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div style={{padding: '24px'}}>
                {/* Quote comparison cards */}
                <div style={{background: 'white', border: '1px solid #e5e5db', borderRadius: '10px', padding: '20px', marginBottom: '16px'}}>
                  <div style={{fontSize: '13px'}} className="text-gray-900 font-600 mb-4">Quote Details</div>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px'}}>
                    <div>
                      <div style={{fontSize: '11px'}} className="text-gray-600 mb-2">Total Amount</div>
                      <div style={{fontSize: '16px'}} className="text-[#87986a] font-700">{selectedQuoteData.amount}</div>
                    </div>
                    <div>
                      <div style={{fontSize: '11px'}} className="text-gray-600 mb-2">Delivery Time</div>
                      <div style={{fontSize: '14px'}} className="text-gray-900 font-500">{selectedQuoteData.deliveryTime}</div>
                    </div>
                    <div>
                      <div style={{fontSize: '11px'}} className="text-gray-600 mb-2">Expires In</div>
                      <div style={{fontSize: '14px'}} className={selectedQuoteData.status === 'expired' ? 'text-red-600 font-500' : 'text-gray-900 font-500'}>{selectedQuoteData.expiresIn}</div>
                    </div>
                    <div>
                      <div style={{fontSize: '11px'}} className="text-gray-600 mb-2">Vendor Rating</div>
                      <div style={{fontSize: '14px'}} className="text-yellow-600 font-500">★ {selectedQuoteData.rating}/5</div>
                    </div>
                  </div>
                </div>

                {/* Item breakdown table */}
                <div style={{background: 'white', border: '1px solid #e5e5db', borderRadius: '10px', padding: '20px', marginBottom: '16px'}}>
                  <div style={{fontSize: '13px'}} className="text-gray-900 font-600 mb-4">Item Breakdown</div>
                  <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', padding: '8px 12px', background: '#f8f8f6', borderRadius: '6px', marginBottom: '8px'}}>
                    <div style={{fontSize: '10px'}} className="text-gray-600 font-600 uppercase">Item</div>
                    <div style={{fontSize: '10px'}} className="text-gray-600 font-600 uppercase text-center">Qty</div>
                    <div style={{fontSize: '10px'}} className="text-gray-600 font-600 uppercase text-right">Unit Price</div>
                    <div style={{fontSize: '10px'}} className="text-gray-600 font-600 uppercase text-right">Subtotal</div>
                  </div>
                  {[
                    {name: 'Organic Tomatoes (5kg)', qty: '20', unitPrice: '$18.50', subtotal: '$370.00'},
                    {name: 'Baby Spinach (500g)', qty: '30', unitPrice: '$8.20', subtotal: '$246.00'},
                    {name: 'Mixed Bell Peppers (3kg)', qty: '15', unitPrice: '$22.00', subtotal: '$330.00'},
                    {name: 'Fresh Basil (200g)', qty: '40', unitPrice: '$5.80', subtotal: '$232.00'}
                  ].map((item, i) => (
                    <div key={i} style={{display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', padding: '10px 12px', borderBottom: i < 3 ? '1px solid #f0f0ed' : 'none', alignItems: 'center'}}>
                      <div style={{fontSize: '11px'}} className="text-gray-900">{item.name}</div>
                      <div style={{fontSize: '11px', textAlign: 'center'}} className="text-gray-900">{item.qty}</div>
                      <div style={{fontSize: '11px', textAlign: 'right'}} className="text-gray-900">{item.unitPrice}</div>
                      <div style={{fontSize: '11px', textAlign: 'right'}} className="text-[#87986a] font-600">{item.subtotal}</div>
                    </div>
                  ))}
                </div>

                {/* Negotiation thread */}
                <div style={{background: 'white', border: '1px solid #e5e5db', borderRadius: '10px', padding: '20px'}}>
                  <div style={{fontSize: '13px'}} className="text-gray-900 font-600 mb-4">Negotiation Thread</div>
                  <div style={{padding: '12px', background: '#f8f8f6', borderRadius: '8px', marginBottom: '10px', borderLeft: '3px solid #87986a'}}>
                    <div style={{fontSize: '11px'}} className="text-gray-600">Fresh Farm Supply Co. — 2 hours ago</div>
                    <div style={{fontSize: '12px'}} className="text-gray-900 mt-2">Standard pricing on all items. Volume discount available at 50+ cases. Can guarantee 2-day delivery if order placed by tomorrow EOD.</div>
                  </div>
                  <div style={{display: 'flex', gap: '8px', marginTop: '12px'}}>
                    <input type="text" placeholder="Reply to vendor..." style={{flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '11px'}} />
                    <Button size="sm" className="bg-[#87986a] hover:bg-[#6b7a54] text-white">Send</Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* RIGHT PANEL: Negotiation Intelligence */}
      <div style={{width: '280px'}} className={`flex flex-col border-l ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div style={{fontSize: '14px'}} className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}>Intelligence</div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div style={{padding: '16px'}}>
            {selectedQuoteData && (
              <>
                <div style={{padding: '12px', background: '#f4f6f0', border: '1px solid #dbe3ce', borderRadius: '8px', marginBottom: '10px'}}>
                  <div style={{fontSize: '11px', color: '#4f5c3e', fontWeight: '600', marginBottom: '6px'}}>💰 Market Price</div>
                  <div style={{fontSize: '11px', color: '#6b7280', lineHeight: '1.5'}}>Tomatoes: <strong>$16–$20/case</strong>. This quote at $18.50 is competitive — ~8% below market avg.</div>
                </div>
                <div style={{padding: '12px', background: '#eef3f7', border: '1px solid #c8d9e6', borderRadius: '8px', marginBottom: '10px'}}>
                  <div style={{fontSize: '11px', color: '#4a6b82', fontWeight: '600', marginBottom: '6px'}}>📊 Vendor History</div>
                  <div style={{fontSize: '11px', color: '#6b7280', lineHeight: '1.5'}}>Fresh Farm has delivered 145 orders. 98% on-time rate. Zero quality disputes.</div>
                </div>
                <div style={{padding: '12px', background: '#f3f0f9', border: '1px solid #d4c6e8', borderRadius: '8px'}}>
                  <div style={{fontSize: '11px', color: '#6b4e8a', fontWeight: '600', marginBottom: '6px'}}>🎯 AI Recommendation</div>
                  <div style={{fontSize: '11px', color: '#6b7280', lineHeight: '1.5'}}>Accept this quote. Vendor is reliable, price is fair, and 2-day delivery meets your deadline.</div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test QuotesPage loads**

Run dev server, navigate to Quotes. Should see quote list on left, detail on center (with selected quote), intelligence on right.

- [ ] **Step 3: Commit**

```bash
git add src/components/QuotesPage.tsx
git commit -m "feat: add QuotesPage with three-panel quote review and negotiation UI"
```

---

## Task 4: Create GroupBuyingPage.tsx

**Files:**
- Create: `src/components/GroupBuyingPage.tsx`

[Content follows same pattern as QuotesPage: three panels, dummy data, sage colors, meaningful flows]

```typescript
import { useState } from "react";
import { Search, Users, TrendingUp, Zap, CheckCircle, Clock } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Progress } from "./ui/progress";

interface GroupBuyingPageProps {
  theme?: 'dark' | 'light';
}

export function GroupBuyingPage({ theme = 'dark' }: GroupBuyingPageProps) {
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPool, setSelectedPool] = useState("POOL-2024-001");

  const pools = [
    {
      id: "POOL-2024-001",
      product: "Organic Tomatoes (5kg cases)",
      currentVolume: 220,
      targetVolume: 300,
      members: 4,
      savings: "18%",
      urgency: "closing",
      timeLeft: "6 hours",
      tiers: [
        { volume: 100, discount: "5%" },
        { volume: 250, discount: "12%" },
        { volume: 500, discount: "22%" }
      ]
    },
    {
      id: "POOL-2024-002",
      product: "Coffee Beans (1kg bags)",
      currentVolume: 150,
      targetVolume: 500,
      members: 3,
      savings: "15%",
      urgency: "active",
      timeLeft: "14 days",
      tiers: [
        { volume: 100, discount: "3%" },
        { volume: 300, discount: "10%" },
        { volume: 600, discount: "18%" }
      ]
    },
    {
      id: "POOL-2024-003",
      product: "Fresh Basil (200g bundles)",
      currentVolume: 45,
      targetVolume: 200,
      members: 2,
      savings: "8%",
      urgency: "forming",
      timeLeft: "21 days",
      tiers: [
        { volume: 50, discount: "2%" },
        { volume: 150, discount: "8%" },
        { volume: 300, discount: "15%" }
      ]
    }
  ];

  const selectedPoolData = pools.find(p => p.id === selectedPool);
  const progressPercent = selectedPoolData ? (selectedPoolData.currentVolume / selectedPoolData.targetVolume) * 100 : 0;

  return (
    <div className={`flex h-full ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
      {/* LEFT PANEL: Pool List */}
      <div style={{width: '280px'}} className={`flex flex-col border-r ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div style={{fontSize: '14px'}} className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}>Demand Pools</div>
          <div style={{fontSize: '12px'}} className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>Bulk buying for savings</div>
        </div>

        <div className={`px-3 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <Input placeholder="Search pools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : ''} />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div style={{padding: '12px'}}>
            {pools.map((pool) => {
              const urgencyColor = pool.urgency === 'closing' ? (isDark ? '#ef4444' : '#dc2626') : pool.urgency === 'active' ? (isDark ? '#22c55e' : '#16a34a') : (isDark ? '#3b82f6' : '#2563eb');
              return (
                <div
                  key={pool.id}
                  onClick={() => setSelectedPool(pool.id)}
                  style={{padding: '10px', marginBottom: '6px', borderRadius: '8px', cursor: 'pointer', border: selectedPool === pool.id ? `2px solid #87986a` : `1px solid ${isDark ? '#374151' : '#e5e5db'}`}}
                  className={selectedPool === pool.id ? (isDark ? 'bg-[#87986a]/10' : 'bg-[#f4f6f0]') : (isDark ? 'bg-[#2a2a2a]' : 'bg-white')}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                    <div style={{fontSize: '12px'}} className={isDark ? 'text-white font-500' : 'text-gray-900 font-500'}>{pool.product}</div>
                    <Badge style={{background: urgencyColor, color: 'white', border: 'none'}}>{pool.urgency === 'closing' ? '🔴 Closing' : pool.urgency === 'active' ? '🟢 Active' : '🔵 Forming'}</Badge>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                    <span style={{fontSize: '10px'}} className={isDark ? 'text-gray-400' : 'text-gray-600'}>{pool.members} members</span>
                    <span style={{fontSize: '11px', color: '#6b7a54', fontWeight: '600'}}>Save {pool.savings}</span>
                  </div>
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <div style={{flex: 1, height: '4px', background: isDark ? '#374151' : '#e5e5db', borderRadius: '2px'}}>
                      <div style={{height: '100%', width: `${Math.min(progressPercent, 100)}%`, background: '#87986a', borderRadius: '2px'}}></div>
                    </div>
                    <span style={{fontSize: '10px'}} className={isDark ? 'text-gray-500' : 'text-gray-500'}>{Math.round(progressPercent)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* CENTER PANEL: Pool Detail */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0 max-w-[1800px]">
        {selectedPoolData && (
          <>
            <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <div style={{fontSize: '16px'}} className={isDark ? 'text-white font-600' : 'text-gray-900 font-600'}>{selectedPoolData.product}</div>
                  <div style={{fontSize: '12px'}} className={isDark ? 'text-gray-400' : 'text-gray-600 mt-1'}>{selectedPoolData.members} members pooling · {selectedPoolData.timeLeft} remaining</div>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <Button variant="outline" size="sm">View Members</Button>
                  <Button className="bg-[#87986a] hover:bg-[#6b7a54] text-white">Join Pool</Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div style={{padding: '24px'}}>
                {/* Progress visualization */}
                <div style={{background: 'white', border: '1px solid #e5e5db', borderRadius: '10px', padding: '20px', marginBottom: '16px'}}>
                  <div style={{fontSize: '13px'}} className="text-gray-900 font-600 mb-4">Volume Progress</div>
                  <div style={{marginBottom: '8px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px'}}>
                      <span style={{fontSize: '11px'}} className="text-gray-600">Current: {selectedPoolData.currentVolume} cases</span>
                      <span style={{fontSize: '11px'}} className="text-gray-600">Target: {selectedPoolData.targetVolume} cases</span>
                    </div>
                    <div style={{height: '8px', background: '#e5e5db', borderRadius: '4px'}}>
                      <div style={{height: '100%', width: `${Math.min(progressPercent, 100)}%`, background: '#87986a', borderRadius: '4px'}}></div>
                    </div>
                  </div>
                </div>

                {/* Tier breakdown */}
                <div style={{background: 'white', border: '1px solid #e5e5db', borderRadius: '10px', padding: '20px', marginBottom: '16px'}}>
                  <div style={{fontSize: '13px'}} className="text-gray-900 font-600 mb-4">Discount Tiers</div>
                  {selectedPoolData.tiers.map((tier, i) => {
                    const isCurrent = selectedPoolData.currentVolume >= tier.volume;
                    return (
                      <div key={i} style={{padding: '12px', background: isCurrent ? '#f4f6f0' : '#f8f8f6', border: `1px solid ${isCurrent ? '#dbe3ce' : '#e5e5db'}`, borderRadius: '8px', marginBottom: i < selectedPoolData.tiers.length - 1 ? '8px' : 0}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div>
                            <div style={{fontSize: '12px'}} className="text-gray-900 font-500">{tier.volume}+ cases</div>
                            <div style={{fontSize: '11px'}} className="text-gray-600">{tier.discount} discount</div>
                          </div>
                          {isCurrent && <span style={{fontSize: '10px', color: '#6b7a54', fontWeight: '600'}}>✓ Unlocked</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Join form */}
                <div style={{background: 'white', border: '1px solid #e5e5db', borderRadius: '10px', padding: '20px'}}>
                  <div style={{fontSize: '13px'}} className="text-gray-900 font-600 mb-4">Join This Pool</div>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px'}}>
                    <div>
                      <div style={{fontSize: '11px'}} className="text-gray-600 mb-2">Commit Type</div>
                      <select style={{width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '11px', color: '#374151', background: 'white'}}>
                        <option>Hard (locked in)</option>
                        <option>Soft (flexible)</option>
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize: '11px'}} className="text-gray-600 mb-2">Quantity (cases)</div>
                      <input type="number" defaultValue="20" style={{width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '11px', color: '#374151', outline: 'none'}} />
                    </div>
                  </div>
                  <Button className="w-full bg-[#87986a] hover:bg-[#6b7a54] text-white">Confirm Commitment</Button>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* RIGHT PANEL: Savings Intelligence */}
      <div style={{width: '280px'}} className={`flex flex-col border-l ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div style={{fontSize: '14px'}} className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}>Savings Intel</div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div style={{padding: '16px'}}>
            {selectedPoolData && (
              <>
                <div style={{padding: '12px', background: '#f4f6f0', border: '1px solid #dbe3ce', borderRadius: '8px', marginBottom: '10px'}}>
                  <div style={{fontSize: '11px', color: '#4f5c3e', fontWeight: '600', marginBottom: '6px'}}>💰 Current Savings</div>
                  <div style={{fontSize: '16px', color: '#87986a', fontWeight: '700'}}>~$360</div>
                  <div style={{fontSize: '10px', color: '#6b7a54', marginTop: '4px'}}>At current {selectedPoolData.currentVolume} cases with {selectedPoolData.savings} discount</div>
                </div>
                <div style={{padding: '12px', background: '#eef3f7', border: '1px solid #c8d9e6', borderRadius: '8px', marginBottom: '10px'}}>
                  <div style={{fontSize: '11px', color: '#4a6b82', fontWeight: '600', marginBottom: '6px'}}>🎯 If Pool Hits Target</div>
                  <div style={{fontSize: '16px', color: '#7998af', fontWeight: '700'}}>~$840</div>
                  <div style={{fontSize: '10px', color: '#6b7280', marginTop: '4px'}}>At 300+ cases with 22% discount</div>
                </div>
                <div style={{padding: '12px', background: '#f3f0f9', border: '1px solid #d4c6e8', borderRadius: '8px'}}>
                  <div style={{fontSize: '11px', color: '#6b4e8a', fontWeight: '600', marginBottom: '6px'}}>🤖 AI Suggestion</div>
                  <div style={{fontSize: '11px', color: '#6b7280', lineHeight: '1.5'}}>Pool is at 73% of target. 80 more cases unlocks tier 3. Worth a hard commitment.</div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test GroupBuyingPage loads**

- [ ] **Step 3: Commit**

```bash
git add src/components/GroupBuyingPage.tsx
git commit -m "feat: add GroupBuyingPage with demand pool management and savings intelligence"
```

---

## Task 5: Create InventoryPage.tsx

**Files:**
- Create: `src/components/InventoryPage.tsx`

[Three-panel layout: inventory list grouped by urgency, item detail with POS menu integration and reorder controls, predictive alerts]

- [ ] **Step 1: Create file** (similar structure, dummy data showing stock levels, usage charts, auto-reorder settings)

- [ ] **Step 2: Test InventoryPage loads**

- [ ] **Step 3: Commit**

---

## Task 6: Convert DashboardPage to Three-Panel Layout

**Files:**
- Modify: `src/components/DashboardPage.tsx` (entire file)

- [ ] **Step 1: Refactor to three-panel structure**

Left: Action items grouped by urgency
Center: Stats, quick actions, recent requests, budget usage
Right: AI intelligence panel

[Use same three-panel pattern as above, swap teal → sage colors]

- [ ] **Step 2: Test**

- [ ] **Step 3: Commit**

---

## Task 7: Convert OrdersPage to Three-Panel with Delivery Detail

**Files:**
- Modify: `src/components/OrdersPage.tsx` (entire file)

- [ ] **Step 1: Refactor to three-panel**

Left: Order list by status
Center: Order detail with delivery timeline (5-step tracker), tracking info, items table, summary, receiving checklist
Right: Delivery intelligence (AI ETA, vendor performance, alerts, quick actions)

- [ ] **Step 2: Test**

- [ ] **Step 3: Commit**

---

## Task 8: Convert VendorsPage to Three-Panel with Storefront Banner

**Files:**
- Modify: `src/components/VendorsPage.tsx` (entire file)

- [ ] **Step 1: Add storefront banner to center panel**

180px wide cover image at top, vendor avatar overlapping bottom edge (like LinkedIn cover photo). Vendor info bar below banner with name, "Preferred" badge, star rating, inline actions.

- [ ] **Step 2: Add vendor profile details**

Stats row (Total Orders, Spend, Rating, On-Time, Avg Delivery), active contracts section, contact details, recent orders table

- [ ] **Step 3: Add right panel with performance intelligence**

AI vendor score, performance breakdown, price trend chart, AI recommendations

- [ ] **Step 4: Test, commit**

---

## Task 9: Convert AnalyticsPage to Three-Panel with Finance

**Files:**
- Modify: `src/components/AnalyticsPage.tsx` (entire file)

- [ ] **Step 1: Refactor to three-panel**

Left: Report categories + date range filter
Center: Spending charts, invoices with inline Pay button, supplier concentration, early-payment discounts
Right: AI savings breakdown, opportunities, cash flow outlook

- [ ] **Step 2: Test, commit**

---

## Task 10: Update SettingsPage Colors (No Layout Change)

**Files:**
- Modify: `src/components/SettingsPage.tsx` (color swap only)

- [ ] **Step 1: Replace all teal references with sage**

Search/replace: `teal-500` → `[#87986a]`, `teal-600` → `[#6b7a54]`, `teal-50` → `[#f4f6f0]`, `teal-100` → `[#dbe3ce]`, etc.

- [ ] **Step 2: Test, commit**

---

## Task 11: Extend RequestPanel.tsx with Steps 2–7

**Files:**
- Modify: `src/components/RequestPanel.tsx` (add state for step tracking, render each step)

- [ ] **Step 1: Add step state and navigation**

Add `const [step, setStep] = useState(1);` to component. Render different JSX based on step value.

- [ ] **Step 2: Implement Step 2 (Sourcing Method)**

Radio cards for AI Auto-Source, RFQ, Direct Order, Group Buying. Each option shows autonomy level, time estimate.

- [ ] **Step 3: Implement Step 3 (Add Items)**

Product browser (left panel), item list with quantity/unit/specs (center), running total, right panel with AI suggestions.

- [ ] **Step 4: Implement Step 4 (Delivery & Logistics)**

Address selector, delivery window/urgency dropdowns, special handling toggles, delivery notes textarea.

- [ ] **Step 5: Implement Step 5 (Budget & Timeline)**

Max budget input, auto-approve threshold, budget gauge, need-by date, quote deadline, recurring toggle.

- [ ] **Step 6: Implement Step 6 (Review & Confirm)**

Compact summary of all previous steps, edit links for each section, right panel showing AI readiness and "what happens next" timeline.

- [ ] **Step 7: Implement Step 7 (Published Success State)**

Centered success message with request ID, summary card, action buttons (View in Quotes, Create Another, Go to Dashboard).

- [ ] **Step 8: Test all steps load and flows work**

- [ ] **Step 9: Commit**

---

## Task 12: Update ProductSidebar & IntelligencePanel Colors

**Files:**
- Modify: `src/components/ProductSidebar.tsx` (color swap)
- Modify: `src/components/IntelligencePanel.tsx` (color swap)

- [ ] **Step 1: Swap colors**

Search/replace teal → sage throughout both files.

- [ ] **Step 2: Test on request page**

- [ ] **Step 3: Commit**

---

## Task 13: Final Testing & Integration

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test all 9 pages load without errors**

Dashboard, New Request, Orders, Quotes, Group Buying, Inventory, Vendors, Analytics, Settings.

- [ ] **Step 3: Test theme switching**

Dark, Light, Hybrid modes. Check all colors render correctly on each page in each theme.

- [ ] **Step 4: Test request wizard flows**

Step through all 7 steps of New Request, verify each step saves state, navigation works, success state shows at the end.

- [ ] **Step 5: Test data flows**

Click through quotes, accept one, verify it shows in orders. Join a group buying pool, verify commitment shows. All actions have meaningful endpoints.

- [ ] **Step 6: Build for production**

```bash
npm run build
```

Expected: Build succeeds, no errors or warnings. Output: ~850KB JS, ~100KB CSS.

- [ ] **Step 7: Final commit and summary**

```bash
git log --oneline -15
```

Verify all tasks committed. Write final summary.

---

## Implementation Notes

1. **Dummy Data:** All pages use hardcoded dummy data arrays. No API calls. Data reflects realistic scenarios (quotes with negotiations, inventory with stock warnings, pools with progress).

2. **Color System:** Sage primary `#87986a` used consistently across all pages. CSS variables in globals.css define the palette. All Tailwind classes updated from teal to sage equivalents or direct hex colors.

3. **Three-Panel Layout:** Left (260–280px), Center (flex-1 max-w-[1800px]), Right (260–280px). All panels scroll independently. Only on Request page do left/right panels conditional — all other pages show them. Settings page is single-panel (no left/right).

4. **Autonomy Levels:** Shown in Request wizard (L0–L3 tags on sourcing options), Inventory (autonomy level selector on auto-reorder), and Intelligence panels (AI recommendation badges).

5. **Meaningful Flows:** Every action leads to a visible outcome:
   - Accept a quote → shows in Orders
   - Join a group pool → updates commitment and savings estimate
   - Set delivery address → used in order detail
   - Step through request wizard → success state with request ID
   - Trigger auto-reorder → shows in Inventory reorder history

6. **Commits:** Frequent, logical units. Each page or feature is one commit. Color system is one commit. All changes pushed.

