import { useState, useCallback, useRef, useEffect } from 'react';
import type { ElementType } from 'react';
import {
  DollarSign, TrendingDown, Lock, Leaf, Bot, Eye, ChevronRight,
  CheckCircle, Sparkles, FileText, Package, ShieldCheck, ArrowLeft,
  User, AlertTriangle, Beef, Fish, Apple, Milk, Wine, Archive,
  Zap, Send, MessageCircle, BarChart2, Settings, X
} from 'lucide-react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart,
  Cell, BarChart, Bar, Legend
} from 'recharts';
import { toast } from 'sonner';
import { ThreePanelLayout } from './layout/ThreePanelLayout';
import { theme as themeTokens } from '../lib/theme';
import { logUserAction } from '../lib/actionLog';
import type { FinnsCategory } from '../lib/types';
import { AgentCTA } from './AgentCTA';

interface SpendingPageProps {
  theme: 'dark' | 'light';
}

// ── Types ─────────────────────────────────────────────────────────

type DriftStatus = 'over' | 'on-track' | 'under';
type TimeRange = '1M' | '3M' | '6M' | '1Y';
type ActorType = 'agent' | 'admin' | 'override';

interface Category {
  id: string;
  name: string;
  spend: number;
  budget: number;
  drift: number;
  driftStatus: DriftStatus;
  color: string;
  Icon: ElementType;
  savingsUnlocked: number;
  agentActions: number;
  co2Kg: number;
  trend6: number[];
  stockoutRisk: number;
  topAgent: { id: number; name: string; contribution: number };
  atlasPrompts: string[];
}

interface LedgerEntry {
  id: string;
  actorType: ActorType;
  agentId?: number;
  actorLabel: string;
  action: string;
  saving: number;
  supplier: string;
  date: string;
  invoiceRef: string;
  categoryId: string;
  overrideOf?: string;
}

interface AtlasMessage {
  role: 'user' | 'atlas';
  content: string;
}

// ── Legacy agent id → Finn's A-NN roster ─────────────────────────
// Most SpendingPage references touch Pricing (#6), Group Buying (#18),
// Demand Forecast (#3), Sustainability (#29), Payments (#28). Mapped
// to A-01..A-05 by their closest Finn's role.
const LEGACY_AGENT_MAP: Record<number, string> = {
  1: 'A-04', 3: 'A-02', 5: 'A-01', 6: 'A-01', 7: 'A-05',
  8: 'A-02', 9: 'A-05', 10: 'A-04', 13: 'A-03', 14: 'A-04',
  18: 'A-04', 21: 'A-01', 25: 'A-02', 28: 'A-04', 29: 'A-01', 33: 'A-04',
};
const agentLabel = (id: number) => LEGACY_AGENT_MAP[id] ?? 'A-01';

// ── Semantic Color Palette (fixed, enforced everywhere) ───────────

const COLORS = {
  protein:   '#991b1b',   // Deep Maroon — Meat & Core Energy
  seafood:   '#075985',   // Deep Sea Blue — Cold-chain & Water
  produce:   '#166534',   // Forest Green — Freshness & Agriculture
  'dry-goods': '#334155', // Slate/Charcoal — Packaging & Stability
  dairy:     '#0e7490',   // Cyan/Teal — Dairy & Cold
  beverages: '#92400e',   // Amber/Gold — Liquids & Glass
  other:     '#64748b',   // Neutral Gray
} as const;

// ── Static Data ───────────────────────────────────────────────────

// Category seed amounts in IDR (millions). 7 categories matching Finn's docs.
const CATEGORIES: Category[] = [
  {
    id: 'protein', name: 'Protein', spend: 142_000_000, budget: 130_000_000, drift: 9.2, driftStatus: 'over',
    color: COLORS.protein, Icon: Beef,
    savingsUnlocked: 18_400_000, agentActions: 7, co2Kg: 320, stockoutRisk: 12,
    trend6: [120_000_000, 131_000_000, 138_000_000, 145_000_000, 139_000_000, 142_000_000],
    topAgent: { id: 6, name: 'Sourcing Agent', contribution: 52 },
    atlasPrompts: ['Why did A-01 switch suppliers?', 'Alternative Wagyu vendors?', 'Protein forecast next month?'],
  },
  {
    id: 'seafood', name: 'Seafood', spend: 78_000_000, budget: 85_000_000, drift: -8.2, driftStatus: 'under',
    color: COLORS.seafood, Icon: Fish,
    savingsUnlocked: 21_000_000, agentActions: 5, co2Kg: 180, stockoutRisk: 6,
    trend6: [85_000_000, 82_000_000, 79_000_000, 76_000_000, 78_000_000, 78_000_000],
    topAgent: { id: 18, name: 'Spend Watchdog', contribution: 45 },
    atlasPrompts: ['Why under budget?', 'Cold chain risk?', 'Tuna sourcing alternatives?'],
  },
  {
    id: 'produce', name: 'Produce', spend: 84_000_000, budget: 82_000_000, drift: 2.4, driftStatus: 'on-track',
    color: COLORS.produce, Icon: Apple,
    savingsUnlocked: 6_200_000, agentActions: 3, co2Kg: 45, stockoutRisk: 8,
    trend6: [78_000_000, 80_000_000, 81_000_000, 83_000_000, 82_000_000, 84_000_000],
    topAgent: { id: 18, name: 'Spend Watchdog', contribution: 38 },
    atlasPrompts: ['Seasonal price impact?', 'Recurring schedule with CV Indo Sayur?', 'Produce trends'],
  },
  {
    id: 'dry-goods', name: 'Dry Goods', spend: 69_000_000, budget: 70_000_000, drift: -1.4, driftStatus: 'on-track',
    color: COLORS['dry-goods'], Icon: Package,
    savingsUnlocked: 4_100_000, agentActions: 2, co2Kg: 92, stockoutRisk: 4,
    trend6: [70_000_000, 68_000_000, 69_000_000, 71_000_000, 68_000_000, 69_000_000],
    topAgent: { id: 6, name: 'Sourcing Agent', contribution: 61 },
    atlasPrompts: ['Packaging cost reduction?', 'Pulau bulk options?', 'Dry goods forecast'],
  },
  {
    id: 'dairy', name: 'Dairy', spend: 52_000_000, budget: 48_000_000, drift: 8.3, driftStatus: 'over',
    color: COLORS.dairy, Icon: Milk,
    savingsUnlocked: 7_800_000, agentActions: 4, co2Kg: 210, stockoutRisk: 22,
    trend6: [45_000_000, 47_000_000, 49_000_000, 50_000_000, 51_000_000, 52_000_000],
    topAgent: { id: 3, name: 'Restock Agent', contribution: 44 },
    atlasPrompts: ['Why over budget?', 'Sumber halal cert renewal?', 'Burrata supply risk?'],
  },
  {
    id: 'beverages', name: 'Beverages', spend: 31_000_000, budget: 32_000_000, drift: -3.1, driftStatus: 'on-track',
    color: COLORS.beverages, Icon: Wine,
    savingsUnlocked: 3_200_000, agentActions: 2, co2Kg: 65, stockoutRisk: 3,
    trend6: [33_000_000, 32_000_000, 31_000_000, 30_000_000, 31_000_000, 31_000_000],
    topAgent: { id: 6, name: 'Sourcing Agent', contribution: 70 },
    atlasPrompts: ['Bintang volume break?', 'Wine FX exposure?', 'Beverages trend'],
  },
  {
    id: 'other', name: 'Other', spend: 22_200_000, budget: 25_000_000, drift: -11.2, driftStatus: 'under',
    color: COLORS.other, Icon: Archive,
    savingsUnlocked: 1_500_000, agentActions: 1, co2Kg: 28, stockoutRisk: 2,
    trend6: [26_000_000, 25_000_000, 24_000_000, 23_000_000, 22_000_000, 22_000_000],
    topAgent: { id: 29, name: 'Sourcing Agent', contribution: 55 },
    atlasPrompts: ['What is in Other?', 'Eka Packaging premium?', 'Other spend breakdown'],
  },
];

// LEDGER — Finn's seeded savings ledger. Saving amounts in IDR.
const LEDGER: LedgerEntry[] = [
  { id: 'l1', actorType: 'agent',    agentId: 6,  actorLabel: 'A-01',  action: 'Switched yellowfin tuna to PT Bali Seafood — 4% under 30d median, cold-chain SLA 98%',                       saving: 840_000,    supplier: 'PT Bali Seafood Lestari', date: '15 May', invoiceRef: 'INV-2026-3041', categoryId: 'seafood' },
  { id: 'l2', actorType: 'agent',    agentId: 18, actorLabel: 'A-04',  action: 'Pre-approved recurring Bintang case (180/wk) — auto-approved under standing recurring schedule',           saving: 1_200_000,  supplier: 'Bintang Distribusi',     date: '14 May', invoiceRef: 'INV-2026-3044', categoryId: 'beverages' },
  { id: 'l3', actorType: 'override', agentId: 3,  actorLabel: 'Admin', action: 'Kept Sumber Dairy for burrata despite A-02 lower-cost alternative — preserved relationship & halal cert',  saving: -120_000,   supplier: 'Sumber Dairy',           date: '13 May', invoiceRef: 'INV-2026-3045', categoryId: 'dairy',     overrideOf: 'A-02 (Restock)' },
  { id: 'l4', actorType: 'agent',    agentId: 3,  actorLabel: 'A-02',  action: 'Trimmed dairy PO by 12% — 8-day surplus window predicted at 87% confidence',                                saving: 380_000,    supplier: 'Sumber Dairy',           date: '13 May', invoiceRef: 'INV-2026-3045', categoryId: 'dairy' },
  { id: 'l5', actorType: 'agent',    agentId: 29, actorLabel: 'A-01',  action: 'Rerouted dry goods to Pulau via local hub — saved 1 day lead time + 4% volume break',                       saving: 120_000,    supplier: 'Pulau Dry Goods',        date: '13 May', invoiceRef: 'INV-2026-2995', categoryId: 'dry-goods' },
  { id: 'l6', actorType: 'agent',    agentId: 6,  actorLabel: 'A-01',  action: 'Negotiated Q2 bulk on Wagyu Ribeye MB7+ — 6kg/cycle at locked AUD price (USD/IDR 15,490 locked)',          saving: 490_000,    supplier: 'AUS Premium Meats',      date: '10 May', invoiceRef: 'INV-2026-2993', categoryId: 'protein' },
  { id: 'l7', actorType: 'admin',                 actorLabel: 'Admin', action: 'Manual PO for heritage tomatoes — local farm relationship, no agent sourcing',                              saving: 0,          supplier: 'Bali Fresh Farms',       date: '09 May', invoiceRef: 'INV-2026-2989', categoryId: 'produce' },
  { id: 'l8', actorType: 'agent',    agentId: 18, actorLabel: 'A-04',  action: 'Combined Krakatoa pork belly + chicken thighs on one cold-chain run — 4% freight saving on bundled drop',  saving: 310_000,    supplier: 'Krakatoa Coldstore',     date: '07 May', invoiceRef: 'INV-2026-2990', categoryId: 'protein' },
  { id: 'l9', actorType: 'override', agentId: 6,  actorLabel: 'Admin', action: 'Approved Eka Packaging quote despite +18% premium — Splash Saturday event needed takeaway boxes (DSP-101)', saving: -60_000,    supplier: 'Eka Packaging',          date: '14 May', invoiceRef: 'INV-2026-3047', categoryId: 'other',     overrideOf: 'A-04 (Spend Watchdog)' },
];

// ── Temporal data ─────────────────────────────────────────────────
// 12-month rolling window ending May 2026 (matches Finn's currentDate).
// Amounts in IDR (millions).
const ALL_MONTHS = [
  { month: 'Jun', actual: 382_000_000, budget: 410_000_000 },
  { month: 'Jul', actual: 415_000_000, budget: 420_000_000 },
  { month: 'Aug', actual: 438_000_000, budget: 435_000_000 },
  { month: 'Sep', actual: 462_000_000, budget: 440_000_000 },
  { month: 'Oct', actual: 441_000_000, budget: 440_000_000 },
  { month: 'Nov', actual: 423_000_000, budget: 435_000_000 },
  { month: 'Dec', actual: 456_000_000, budget: 440_000_000 },
  { month: 'Jan', actual: 482_000_000, budget: 460_000_000 },
  { month: 'Feb', actual: 448_000_000, budget: 450_000_000 },
  { month: 'Mar', actual: 431_000_000, budget: 445_000_000 },
  { month: 'Apr', actual: 419_000_000, budget: 440_000_000 },
  { month: 'May', actual: 420_000_000, budget: 445_000_000 },
];

const RANGE_CFG: Record<TimeRange, { months: number; dateRange: string; actionCount: number }> = {
  '1M':  { months: 1,  dateRange: 'Apr 1 – Apr 20, 2026',              actionCount: 23  },
  '3M':  { months: 3,  dateRange: 'Feb 1 – Apr 20, 2026',              actionCount: 74  },
  '6M':  { months: 6,  dateRange: 'Nov 1, 2025 – Apr 20, 2026',        actionCount: 148 },
  '1Y':  { months: 12, dateRange: 'May 1, 2025 – Apr 20, 2026',        actionCount: 312 },
};

function getGlobalTrend(r: TimeRange) {
  return ALL_MONTHS.slice(ALL_MONTHS.length - RANGE_CFG[r].months);
}

function getCatTrend(cat: Category, r: TimeRange) {
  const labels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const n = Math.min(RANGE_CFG[r].months, 6);
  return cat.trend6.slice(cat.trend6.length - n).map((spend, i) => ({
    month: labels[labels.length - n + i],
    spend,
    budget: Math.round(cat.budget / 6),
  }));
}

function computeTradeoff(slider: number, cat: Category) {
  const costFocus = (100 - slider) / 100;
  const resilienceFocus = slider / 100;
  return {
    projectedSavings: cat.savingsUnlocked * costFocus * 0.9,
    stockoutReduction: cat.stockoutRisk * resilienceFocus * 0.7,
  };
}

// ── Atlas AI response engine ──────────────────────────────────────

function getAtlasResponse(q: string, catId: string | null, totalSpend: number, overallDrift: number): string {
  const lq = q.toLowerCase();
  const cat = catId ? CATEGORIES.find(c => c.id === catId) : null;
  const totalSavings = CATEGORIES.reduce((s, c) => s + c.savingsUnlocked, 0);

  // Agent-specific questions — reference ledger data
  if ((lq.includes('a-01') || lq.includes('sourcing')) && (lq.includes('switch') || lq.includes('why'))) {
    return 'A-01 (Pricing) detected a 6.2% price gap between your current supplier and PT Maju Jaya for lamb shoulder on Apr 20. The switch fell within A-01\'s policy envelope for this category — exact thresholds are managed in Governance → Agent Policies. This saved $840 and is logged in INV-2024-8821.';
  }
  if (lq.includes('a-04') || lq.includes('spend watchdog') || lq.includes('group buy')) {
    return 'A-04 (Group Buying) contributed 45% of Seafood savings this month by forming a 6-operator consortium for Atlantic salmon. The tier-3 volume discount yielded $1,200 savings on INV-2024-8815. It is currently monitoring 3 additional group buy windows this quarter.';
  }
  if (lq.includes('sustainability') || lq.includes('carbon')) {
    if (cat) return `${cat.name} contributes ${cat.co2Kg} kg CO2e this month. A-01 has pre-qualified 2 low-emission carriers for this category at equivalent cost, saving an estimated 3.1t CO2. ${cat.co2Kg > 200 ? '⚠️ High-emission flag active.' : 'Currently within sustainable range.'}`;
    return 'A-01 (Sustainability) rerouted 3 dry-goods orders to low-emission carriers this month, cutting 3.1t CO2 at a +$8 marginal cost. Total platform emission: 940 kg CO2e, down 12% vs last month.';
  }
  if (lq.includes('override')) {
    return 'You overrode 2 agent recommendations this month — both related to supplier quality standards. The override pattern has been noted; future quality-sensitive switches in Dairy and Beverages will be surfaced for your review before A-01 acts. Adjust the policy directly in Governance → Agent Policies if you want to formalise it.';
  }

  // Category-specific intelligence
  if (cat) {
    if (lq.includes('why') && (lq.includes('over') || lq.includes('drift') || lq.includes('budget'))) {
      return cat.driftStatus === 'over'
        ? `${cat.name} is +${cat.drift}% over budget this month. Primary drivers: (1) seasonal price increase on core SKUs (+4.1%), (2) unplanned spot buy on Apr 14 (+$420). ${agentLabel(cat.topAgent.id)} has identified $${cat.savingsUnlocked.toLocaleString()} in recoverable savings — activate the Trade-off Engine to commit.`
        : `${cat.name} is ${Math.abs(cat.drift)}% under budget — strong performance. ${agentLabel(cat.topAgent.id)} negotiated early-commitment discounts and pooled orders where possible.`;
    }
    if (lq.includes('alternative') || lq.includes('supplier')) {
      return `For ${cat.name}, A-01 has 3 pre-qualified alternative suppliers on standby: all within 5km radius, quality score ≥92%, delivery reliability ≥94%. Switching to the best alternative could reduce spend by up to ${((cat.savingsUnlocked / cat.spend) * 100).toFixed(1)}% with a 2-week transition window.`;
    }
    if (lq.includes('forecast') || lq.includes('next month')) {
      const forecastSpend = cat.spend * (1 + (cat.drift / 100) * 0.6);
      return `Next-month ${cat.name} forecast: $${forecastSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} (92% confidence). If you lock the Trade-off Engine at current settings, projected spend drops to $${(forecastSpend - cat.savingsUnlocked * 0.8).toLocaleString(undefined, { maximumFractionDigits: 0 })}. Key risk: seasonal volatility ±8% in this category.`;
    }
    if (lq.includes('stockout') || lq.includes('risk')) {
      return `${cat.name} stockout risk is currently ${cat.stockoutRisk}%. Moving the resilience slider above 60% drops this to ~${(cat.stockoutRisk * 0.35).toFixed(1)}% by prioritising backup supplier pre-orders. A-02 is monitoring 2 active demand signals.`;
    }
    return `Viewing ${cat.name}: ${cat.drift > 0 ? '+' : ''}${cat.drift}% budget drift, $${cat.savingsUnlocked.toLocaleString()} optimization potential, ${cat.co2Kg} kg CO2e. ${agentLabel(cat.topAgent.id)} (${cat.topAgent.name}) leads this category with ${cat.topAgent.contribution}% savings attribution. What aspect would you like to explore?`;
  }

  // Global queries
  if (lq.includes('savings') || lq.includes('unlock')) {
    return `Total unlockable savings: $${totalSavings.toLocaleString()} across 7 categories. Highest opportunity: Seafood ($2,100 via A-04 group buying), then Protein ($1,840 via A-01 pricing). Lock savings through the Trade-off Engine in each category view.`;
  }
  if (lq.includes('trend') || lq.includes('forecast') || lq.includes('next month')) {
    return `Total spend tracking ${Math.abs(overallDrift).toFixed(1)}% ${overallDrift > 0 ? 'above' : 'below'} budget. A-04 forecasts next month at $47.2K (92% confidence). Key risks: Protein and Dairy show consistent +8% drift. Recommend activating Trade-off Engine on both.`;
  }
  if (lq.includes('which') && lq.includes('optimis')) {
    return 'Prioritise: (1) Seafood — $2,100 potential, under budget so low risk. (2) Protein — $1,840 potential, actively over budget. (3) Dairy — $780 potential, highest stockout risk at 22%. Optimize these three to recover $4,760 this month.';
  }

  return `I have full visibility across $${totalSpend.toLocaleString()} in monthly spend and ${LEDGER.length} agent decisions. Ask me about a specific category, agent action, supplier switch, carbon impact, or forecast — I can reference live ledger data to answer precisely.`;
}

// ── Component ─────────────────────────────────────────────────────

export function SpendingPage({ theme }: SpendingPageProps) {
  const isDark = theme === 'dark';
  const t = themeTokens(isDark);

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [tradeoff, setTradeoff] = useState(30);
  const [lockedSavings, setLockedSavings] = useState<Set<string>>(new Set());
  const [showCapital, setShowCapital] = useState(false);
  const [capitalAmt, setCapitalAmt] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('6M');
  const [centerOpacity, setCenterOpacity] = useState(1);

  // Budget setup
  const [budgetSetupOpen, setBudgetSetupOpen] = useState(false);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>(
    Object.fromEntries(CATEGORIES.map(c => [c.id, String(c.budget)]))
  );

  // Manual saving entries (Phase 4j) — admin-recorded savings achieved
  // outside the agent flow (manual renegotiations, side deals, etc.).
  // Merges into visibleLedger so the Decision Ledger surfaces them
  // inline alongside the agent-recorded ones.
  const [manualEntries, setManualEntries] = useState<LedgerEntry[]>([]);
  const [addSavingOpen, setAddSavingOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState({
    amount: '',
    supplier: '',
    action: '',
    invoiceRef: '',
  });

  // Atlas state
  const [atlasInput, setAtlasInput] = useState('');
  const [atlasMsgs, setAtlasMsgs] = useState<AtlasMessage[]>([]);
  const atlasMsgRef = useRef<HTMLDivElement>(null);

  const selected = CATEGORIES.find(c => c.id === selectedCat) ?? null;
  const td = selected ? computeTradeoff(tradeoff, selected) : null;
  const globalTrend = getGlobalTrend(timeRange);
  const catTrend = selected ? getCatTrend(selected, timeRange) : [];
  const rcfg = RANGE_CFG[timeRange];

  const totalSpend = CATEGORIES.reduce((s, c) => s + c.spend, 0);
  const totalBudget = CATEGORIES.reduce((s, c) => s + c.budget, 0);
  const overallDrift = (totalSpend - totalBudget) / totalBudget * 100;
  const totalSavings = CATEGORIES.reduce((s, c) => s + c.savingsUnlocked, 0);
  const totalLocked = [...lockedSavings].reduce((s, id) => {
    const cat = CATEGORIES.find(c => c.id === id);
    return s + (cat ? computeTradeoff(tradeoff, cat).projectedSavings : 0);
  }, 0);
  const surplusCapital = totalBudget - totalSpend + totalLocked;

  const fullLedger = [...manualEntries, ...LEDGER];
  const visibleLedger = selectedCat ? fullLedger.filter(e => e.categoryId === selectedCat) : fullLedger;
  const agentCount = fullLedger.filter(e => e.actorType === 'agent').length;
  const adminCount = fullLedger.filter(e => e.actorType !== 'agent').length;
  const autonomyPct = fullLedger.length === 0 ? 0 : Math.round((agentCount / fullLedger.length) * 100);

  useEffect(() => {
    if (atlasMsgRef.current) {
      atlasMsgRef.current.scrollTop = atlasMsgRef.current.scrollHeight;
    }
  }, [atlasMsgs]);

  const handleSelectCat = useCallback((id: string) => {
    setCenterOpacity(0);
    setTimeout(() => {
      setSelectedCat(prev => prev === id ? null : id);
      setTradeoff(30);
      setCenterOpacity(1);
    }, 180);
  }, []);

  const handleBackToAll = useCallback(() => {
    setCenterOpacity(0);
    setTimeout(() => {
      setSelectedCat(null);
      setCenterOpacity(1);
    }, 180);
  }, []);

  const handleLockSavings = useCallback(() => {
    if (!selected || !td || lockedSavings.has(selected.id)) return;
    setLockedSavings(prev => new Set([...prev, selected.id]));
    setCapitalAmt(td.projectedSavings);
    setShowCapital(true);
    setTimeout(() => setShowCapital(false), 2800);
    // ── Action log ──
    logUserAction({
      kind: 'savings-lock',
      entity: { type: 'ledger', id: selected.id },
      summary: `Locked $${td.projectedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} saving · ${selected.name}`,
      category: selected.name as FinnsCategory,
      meta: { amount: td.projectedSavings, categoryId: selected.id },
    });
  }, [selected, td, lockedSavings]);

  // Manual saving entry (Phase 4j) — records a saving achieved outside
  // the agent flow. Prepends a row to the Decision Ledger and emits
  // a 'savings-manual-add' action log entry.
  const savingDraftValid =
    !!selected &&
    Number(savingDraft.amount) > 0 &&
    savingDraft.supplier.trim().length > 0 &&
    savingDraft.action.trim().length > 0;

  const handleAddManualSaving = useCallback(() => {
    if (!selected) return;
    const amount = Number(savingDraft.amount);
    if (!amount || amount <= 0) return;
    if (!savingDraft.supplier.trim() || !savingDraft.action.trim()) return;
    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    const entry: LedgerEntry = {
      id: `m-${Date.now()}`,
      actorType: 'admin',
      actorLabel: 'Admin',
      action: savingDraft.action.trim(),
      saving: amount,
      supplier: savingDraft.supplier.trim(),
      date: dateLabel,
      invoiceRef: savingDraft.invoiceRef.trim() || `MAN-${now.getTime().toString().slice(-6)}`,
      categoryId: selected.id,
    };
    setManualEntries(prev => [entry, ...prev]);
    logUserAction({
      kind: 'savings-manual-add',
      entity: { type: 'ledger', id: entry.id },
      summary: `Logged $${amount.toLocaleString()} manual saving · ${selected.name} · ${entry.supplier}`,
      category: selected.name as FinnsCategory,
      details: entry.action,
      meta: {
        amount,
        supplier: entry.supplier,
        invoiceRef: entry.invoiceRef,
        categoryId: selected.id,
      },
    });
    toast.success(`Logged $${amount.toLocaleString()} saving`, {
      description: `Added to ${selected.name} ledger · ${entry.supplier}`,
    });
    setSavingDraft({ amount: '', supplier: '', action: '', invoiceRef: '' });
    setAddSavingOpen(false);
  }, [selected, savingDraft]);

  const handleAtlasSubmit = useCallback(() => {
    const q = atlasInput.trim();
    if (!q) return;
    setAtlasMsgs(prev => [...prev, { role: 'user', content: q }]);
    setAtlasInput('');
    const response = getAtlasResponse(q, selectedCat, totalSpend, overallDrift);
    setTimeout(() => {
      setAtlasMsgs(prev => [...prev, { role: 'atlas', content: response }]);
    }, 320);
  }, [atlasInput, selectedCat, totalSpend, overallDrift]);

  const handleAtlasPrompt = useCallback((prompt: string) => {
    setAtlasMsgs(prev => [...prev, { role: 'user', content: prompt }]);
    const response = getAtlasResponse(prompt, selectedCat, totalSpend, overallDrift);
    setTimeout(() => {
      setAtlasMsgs(prev => [...prev, { role: 'atlas', content: response }]);
    }, 320);
  }, [selectedCat, totalSpend, overallDrift]);

  const tooltipStyle = {
    background: isDark ? '#2a2a2a' : '#fff',
    border: isDark ? '1px solid #333' : '1px solid #e5e7eb',
    borderRadius: '8px', fontSize: '11px',
    color: isDark ? '#fff' : '#111',
  };

  // ── Left Panel ────────────────────────────────────────────────────

  const leftPanel = (
    <div className="flex flex-col h-full">
      <div className={t.section}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Optimization Queue</h2>
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>Ranked by drift severity</p>
          </div>
          <div className="flex items-center gap-1.5">
            {selectedCat && (
              <button
                onClick={handleBackToAll}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border transition-colors ${
                  isDark ? 'border-gray-700 text-gray-400 hover:text-white bg-[#2a2a2a]' : 'border-gray-200 text-gray-500 hover:text-gray-800 bg-gray-50'
                }`}
              >
                <BarChart2 className="h-2.5 w-2.5" />
                All
              </button>
            )}
            <button
              onClick={() => setBudgetSetupOpen(true)}
              title="Set Category Budgets"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Synthesised outcome — Tesler's Law */}
      <div className={t.section}>
        <div className={`p-3 rounded-lg border ${
          surplusCapital > 0
            ? isDark ? 'bg-[#87986a]/10 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'
            : isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
        }`}>
          <span className={`text-[10px] ${t.textMuted}`}>Surplus Capital Available</span>
          <div className={`text-lg font-bold mt-0.5 ${surplusCapital > 0 ? 'text-[#87986a]' : 'text-red-400'}`}>
            ${Math.abs(surplusCapital).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <span className={`text-[10px] ${t.textMuted}`}>
            {surplusCapital > 0 ? 'ready for redeployment' : 'over budget — action needed'}
          </span>
        </div>
      </div>

      {/* First-run CTA — prompt budget setup if never customized */}
      {CATEGORIES.every(c => categoryBudgets[c.id] === String(c.budget)) && (
        <div className={`mx-3 mb-2 p-3 rounded-lg border ${
          isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'
        }`}>
          <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
            Set your category budgets
          </p>
          <p className={`text-[9px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            AI is using default budgets. Customise limits so the guardrails match your actual targets.
          </p>
          <button
            onClick={() => setBudgetSetupOpen(true)}
            className="mt-2 w-full py-1 rounded text-[10px] font-semibold bg-[#87986a] hover:bg-[#6b7a54] text-white transition-colors"
          >
            Configure Budgets →
          </button>
        </div>
      )}

      {/* Category queue */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2 space-y-1.5">
        {[...CATEGORIES]
          .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
          .map((cat) => {
            const isSelected = selectedCat === cat.id;
            const isLocked = lockedSavings.has(cat.id);
            const CatIcon = cat.Icon;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCat(cat.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all group ${
                  isSelected
                    ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 ring-1 ring-[#87986a]/20' : 'bg-[#f4f6f0] border-[#87986a]/40 ring-1 ring-[#87996a]/20'
                    : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:border-gray-700' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {/* Semantic icon with semantic color */}
                    <CatIcon className="h-3.5 w-3.5 shrink-0" style={{ color: cat.color }} />
                    <span className={`text-xs font-medium ${t.textPrimary}`}>{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      cat.driftStatus === 'over' ? 'bg-red-500/12 text-red-400'
                      : cat.driftStatus === 'under' ? 'bg-green-500/12 text-green-400'
                      : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {cat.driftStatus === 'over' ? '▲' : cat.driftStatus === 'under' ? '▼' : '●'}
                      {' '}{cat.drift > 0 ? '+' : ''}{cat.drift}%
                    </span>
                    {isLocked && <Lock className="h-3 w-3 text-[#87986a] shrink-0" />}
                  </div>
                </div>
                {/* Spend bar */}
                <div className="relative h-1.5 rounded-full overflow-hidden mb-1.5">
                  <div className={`absolute inset-0 ${t.progressTrack}`} />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: `${Math.min((cat.spend / cat.budget) * 100, 100)}%`,
                      backgroundColor: cat.driftStatus === 'over' ? '#ef4444' : cat.color,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] ${t.textMuted}`}>
                    ${(cat.spend / 1000).toFixed(1)}K / ${(cat.budget / 1000).toFixed(0)}K
                  </span>
                  <Eye className={`h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity ${t.textMuted}`} />
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );

  // ── Center Panel ──────────────────────────────────────────────────

  const centerPanel = (
    <div className="relative flex flex-col h-full overflow-y-auto">
      {/* Capital Unlocked peak-end animation */}
      {showCapital && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="capital-burst text-center">
            <div className="capital-amount text-5xl font-black">
              +${capitalAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className={`text-base font-semibold mt-2 ${t.textSecondary}`}>Capital Unlocked</div>
            <div className="flex justify-center gap-2 mt-3 capital-sparkles">
              {[...Array(5)].map((_, i) => <Sparkles key={i} className="h-5 w-5 text-[#a3b085]" />)}
            </div>
          </div>
        </div>
      )}

      <div
        className="p-6 space-y-5"
        style={{ opacity: centerOpacity, transition: 'opacity 0.18s ease-in-out' }}
      >
        {/* Breadcrumb + Temporal toggle */}
        <div className="flex items-center justify-between gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            {selected ? (
              <>
                <button
                  onClick={handleBackToAll}
                  className={`flex items-center gap-1 text-xs transition-colors ${t.textMuted} hover:text-[#87986a]`}
                >
                  <ArrowLeft className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">All Categories</span>
                  <span className="sm:hidden">Back</span>
                </button>
                <ChevronRight className={`h-3 w-3 shrink-0 ${t.textMuted}`} />
                <div className="flex items-center gap-1.5 min-w-0">
                  <selected.Icon className="h-3.5 w-3.5 shrink-0" style={{ color: selected.color }} />
                  <span className={`text-xs font-semibold truncate ${t.textPrimary}`}>{selected.name}</span>
                </div>
              </>
            ) : (
              <span className={`text-xs font-semibold ${t.textPrimary}`}>Spending · All Categories</span>
            )}
          </div>

          {/* Temporal toggle */}
          <div className={`flex items-center gap-0.5 p-0.5 rounded-lg shrink-0 ${isDark ? 'bg-[#1a1a1a] border border-gray-800' : 'bg-gray-100 border border-gray-200'}`}>
            {(['1M', '3M', '6M', '1Y'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  timeRange === r ? 'bg-[#87986a] text-white shadow-sm' : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* ── GLOBAL VIEW ── */}
        {!selected && (
          <>
            {/* Macro summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className={t.cardPanel}>
                <span className={`text-[10px] ${t.textMuted}`}>Total Spend</span>
                <div className={`text-xl font-bold mt-1 ${t.textPrimary}`}>${(totalSpend / 1000).toFixed(1)}K</div>
                <span className={`text-[10px] ${overallDrift > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {overallDrift > 0 ? '▲' : '▼'} {Math.abs(overallDrift).toFixed(1)}% vs budget
                </span>
              </div>
              <div className={`${t.cardPanel} ring-1 ring-[#87986a]/20`}>
                <span className={`text-[10px] ${t.textMuted}`}>Locked Savings</span>
                <div className="text-xl font-bold mt-1 text-[#87986a]">
                  ${totalLocked.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <span className={`text-[10px] ${t.textMuted}`}>{lockedSavings.size}/{CATEGORIES.length} optimized</span>
              </div>
              <div className={t.cardPanel}>
                <span className={`text-[10px] ${t.textMuted}`}>Still Unlockable</span>
                <div className="text-xl font-bold mt-1 text-amber-400">
                  ${(totalSavings - totalLocked).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <span className={`text-[10px] ${t.textMuted}`}>potential remaining</span>
              </div>
            </div>

            {/* Global spend trend — min-height 450px */}
            <div>
              <h3 className={`text-sm font-semibold mb-0.5 ${t.textPrimary}`}>Total Spend Trend</h3>
              <p className={`text-xs mb-3 ${t.textMuted}`}>{rcfg.dateRange} · {rcfg.actionCount} agent actions</p>
              <div className={`${t.cardPanel} p-4`}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={globalTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="globalFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#87986a" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#87986a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: isDark ? '#666' : '#999' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: isDark ? '#666' : '#999' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
                      <Legend iconType="line" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                        formatter={(val) => <span style={{ color: isDark ? '#aaa' : '#666' }}>{val}</span>} />
                      <Area type="monotone" dataKey="actual" stroke="#87986a" strokeWidth={2.5} fill="url(#globalFill)" name="Actual Spend" />
                      <Area type="monotone" dataKey="budget" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth={1.5} fill="none" strokeDasharray="5 4" name="Budget" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Category bar chart — semantic colors enforced */}
            <div>
              <h3 className={`text-sm font-semibold mb-0.5 ${t.textPrimary}`}>Spend by Category</h3>
              <p className={`text-xs mb-3 ${t.textMuted}`}>Each color is consistent across sidebar, charts, and insights</p>
              <div className={`${t.cardPanel} p-4`}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={CATEGORIES} layout="vertical" margin={{ left: 4 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: isDark ? '#666' : '#999' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#888' : '#666' }} axisLine={false} tickLine={false} width={76} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, 'Spend']} />
                      <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                        {CATEGORIES.map((cat) => <Cell key={cat.id} fill={cat.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── CATEGORY DETAIL VIEW ── */}
        {selected && td && (
          <>
            {/* Trade-off Engine */}
            <div className={`${t.cardPanel} p-5`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Trade-off Engine</h3>
              </div>
              <AgentCTA
                isDark={isDark}
                variant="inline"
                className="mb-4"
                agentLabel="A-04 · Spend Watchdog"
                reasoning={`Balance cost savings against supply chain resilience. A-04 calibrated this slider against ${selected.name}'s 30-day spend trend and the seeded stockout-risk model.`}
                offModeMessage={`Move the slider yourself to weigh ${selected.name} savings against stockout risk. Agent calibration is suppressed in Off mode — both gauges below still update live as you drag.`}
                autoExecutionNote="A-04 keeps the slider tuned against current trend data. Adjust manually any time to override."
              />

              <div className="flex justify-between mb-2">
                <span className={`text-xs font-semibold ${tradeoff < 40 ? 'text-[#87986a]' : t.textMuted}`}>💰 Cost Optimization</span>
                <span className={`text-xs font-semibold ${tradeoff > 60 ? 'text-blue-400' : t.textMuted}`}>🛡 Supply Resilience</span>
              </div>
              <input
                type="range" min={0} max={100} value={tradeoff}
                onChange={(e) => setTradeoff(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer tradeoff-slider"
                style={{ background: `linear-gradient(to right, #87986a ${tradeoff}%, #60a5fa ${tradeoff}%)` }}
              />

              {/* Live gauges */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className={`p-3 rounded-lg ${isDark ? 'bg-[#87986a]/10 border border-[#87986a]/25' : 'bg-[#f4f6f0] border border-[#dbe3ce]'}`}>
                  <span className={`text-[10px] ${t.textMuted}`}>Projected Savings</span>
                  <div className="text-xl font-bold text-[#87986a] mt-0.5 tabular-nums">
                    ${td.projectedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className={`h-1 rounded-full mt-2 ${t.progressTrack}`}>
                    <div className="h-full rounded-full bg-[#87986a] transition-all duration-200"
                      style={{ width: `${(td.projectedSavings / selected.savingsUnlocked) * 100}%` }} />
                  </div>
                  <span className={`text-[9px] ${t.textMuted}`}>of ${selected.savingsUnlocked.toLocaleString()} potential</span>
                </div>
                <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                  <span className={`text-[10px] ${t.textMuted}`}>Stockout Risk</span>
                  <div className={`text-xl font-bold mt-0.5 tabular-nums ${(selected.stockoutRisk - td.stockoutReduction) > 15 ? 'text-red-400' : 'text-blue-400'}`}>
                    {Math.max(0, selected.stockoutRisk - td.stockoutReduction).toFixed(1)}%
                  </div>
                  <div className={`h-1 rounded-full mt-2 ${t.progressTrack}`}>
                    <div className="h-full rounded-full bg-blue-400 transition-all duration-200"
                      style={{ width: `${Math.max(0, selected.stockoutRisk - td.stockoutReduction)}%` }} />
                  </div>
                  <span className={`text-[9px] ${t.textMuted}`}>↓ {td.stockoutReduction.toFixed(1)}% from {selected.stockoutRisk}% baseline</span>
                </div>
              </div>

              <button
                onClick={handleLockSavings}
                disabled={lockedSavings.has(selected.id)}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  lockedSavings.has(selected.id)
                    ? isDark ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#87986a] text-white hover:bg-[#6b7a54] active:scale-[0.98]'
                }`}
              >
                {lockedSavings.has(selected.id)
                  ? <><CheckCircle className="h-3.5 w-3.5" /> Capital Unlocked — Savings Committed</>
                  : <><Lock className="h-3.5 w-3.5" /> Commit ${td.projectedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} — Unlock Capital</>
                }
              </button>
            </div>

            {/* Category trend — min-height 450px */}
            <div className={`${t.cardPanel} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <selected.Icon className="h-4 w-4" style={{ color: selected.color }} />
                  <h3 className={`text-sm font-semibold ${t.textPrimary}`}>{selected.name} · Spend Trend</h3>
                </div>
                <span className={`text-[10px] ${t.textMuted}`}>{rcfg.dateRange}</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={catTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="catFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#87986a" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#87986a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: isDark ? '#666' : '#999' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: isDark ? '#666' : '#999' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}K`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
                    <Legend iconType="line" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      formatter={(val) => <span style={{ color: isDark ? '#aaa' : '#666' }}>{val}</span>} />
                    <Area type="monotone" dataKey="spend" stroke="#87986a" strokeWidth={2.5} fill="url(#catFill)" name="Actual Spend" />
                    <Area type="monotone" dataKey="budget" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth={1.5} fill="none" strokeDasharray="5 4" name="Monthly Budget" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Decision Ledger */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Decision Ledger</h3>
                  <p className={`text-xs ${t.textMuted}`}>
                    Showing {visibleLedger.length} actions · {rcfg.dateRange}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <Bot className="h-3 w-3" /> Agent
                  </span>
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <User className="h-3 w-3" /> Admin
                  </span>
                  <button
                    onClick={() => setAddSavingOpen(v => !v)}
                    title="Record a saving achieved manually (e.g. side renegotiation, supplier discount you closed)"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold transition-colors ${
                      addSavingOpen
                        ? isDark ? 'bg-[#87986a]/20 border-[#87986a]/50 text-[#a3b085]'
                                  : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
                        : isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}>
                    <DollarSign className="h-3 w-3" />
                    {addSavingOpen ? 'Close' : 'Add Manual Saving'}
                  </button>
                </div>
              </div>

              {/* Manual saving entry form (Phase 4j) */}
              {addSavingOpen && selected && (
                <div className={`mb-3 p-4 rounded-xl border ${
                  isDark ? 'bg-[#87986a]/5 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`text-xs font-bold ${t.textPrimary}`}>
                      Log a manual saving · {selected.name}
                    </h4>
                    <span className={`text-[10px] ${t.textMuted}`}>
                      You drove this · no agent involved
                    </span>
                  </div>
                  <p className={`text-[10px] mb-3 ${t.textMuted}`}>
                    Side renegotiation? Supplier discount you closed? Record it here so it shows in the category ledger and rolls into Locked Savings.
                  </p>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <label className={`text-[9px] uppercase tracking-wide font-bold ${t.textMuted}`}>Amount saved ($)</label>
                      <input type="number" min={1} value={savingDraft.amount}
                        onChange={e => setSavingDraft(d => ({ ...d, amount: e.target.value }))}
                        placeholder="240"
                        className={`mt-1 w-full text-xs px-2 py-1.5 rounded border ${
                          isDark ? 'bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                        }`} />
                    </div>
                    <div className="col-span-4">
                      <label className={`text-[9px] uppercase tracking-wide font-bold ${t.textMuted}`}>Supplier</label>
                      <input value={savingDraft.supplier}
                        onChange={e => setSavingDraft(d => ({ ...d, supplier: e.target.value }))}
                        placeholder="e.g. Bali Fresh Farms"
                        className={`mt-1 w-full text-xs px-2 py-1.5 rounded border ${
                          isDark ? 'bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                        }`} />
                    </div>
                    <div className="col-span-5">
                      <label className={`text-[9px] uppercase tracking-wide font-bold ${t.textMuted}`}>Invoice ref (optional)</label>
                      <input value={savingDraft.invoiceRef}
                        onChange={e => setSavingDraft(d => ({ ...d, invoiceRef: e.target.value }))}
                        placeholder="INV-2026-XXXX"
                        className={`mt-1 w-full text-xs px-2 py-1.5 rounded border ${
                          isDark ? 'bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                        }`} />
                    </div>
                    <div className="col-span-12">
                      <label className={`text-[9px] uppercase tracking-wide font-bold ${t.textMuted}`}>What you did</label>
                      <textarea value={savingDraft.action}
                        onChange={e => setSavingDraft(d => ({ ...d, action: e.target.value }))}
                        rows={2}
                        placeholder="e.g. Closed Q3 bulk on heritage tomatoes — 8% discount locked over 3 deliveries."
                        className={`mt-1 w-full text-xs px-2 py-1.5 rounded border resize-none ${
                          isDark ? 'bg-[#1a1a1a] border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
                        }`} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button onClick={() => { setAddSavingOpen(false); setSavingDraft({ amount: '', supplier: '', action: '', invoiceRef: '' }); }}
                      className={`text-[10px] px-2.5 py-1.5 rounded border ${
                        isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}>
                      Cancel
                    </button>
                    <button onClick={handleAddManualSaving} disabled={!savingDraftValid}
                      className={`text-[10px] px-3 py-1.5 rounded font-bold transition-colors ${
                        savingDraftValid
                          ? 'bg-[#87986a] text-white hover:bg-[#6b7a54]'
                          : isDark ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}>
                      Log saving
                    </button>
                  </div>
                </div>
              )}
              <div className={`${t.cardPanel} overflow-hidden`}>
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${t.border}`}>
                      <th className={`text-left text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Actor</th>
                      <th className={`text-left text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Action</th>
                      <th className={`text-right text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Impact</th>
                      {/* Reserve space for invoice button — no layout shift */}
                      <th className={`text-right text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`} style={{ minWidth: '110px' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLedger.map((entry) => (
                      <tr
                        key={entry.id}
                        onMouseEnter={() => setHoveredRow(entry.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        className={`border-b last:border-0 transition-colors ${t.border} ${
                          hoveredRow === entry.id ? isDark ? 'bg-gray-800/40' : 'bg-gray-50' : ''
                        }`}
                      >
                        {/* Actor — consistent icon backgrounds */}
                        <td className="py-2.5 px-3 align-top">
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            entry.actorType === 'agent'
                              ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                              : entry.actorType === 'override'
                              ? isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                              : isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {entry.actorType === 'agent' ? <Bot className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                            <span>{entry.actorType === 'agent' ? `#${entry.agentId}` : 'Admin'}</span>
                          </div>
                          {entry.actorType === 'override' && (
                            <div className={`text-[8px] font-bold mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>OVERRIDE</div>
                          )}
                        </td>
                        {/* Action */}
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] leading-relaxed ${t.textSecondary}`}>{entry.action}</span>
                          {entry.overrideOf && (
                            <div className={`text-[9px] mt-0.5 ${isDark ? 'text-amber-400/70' : 'text-amber-600'}`}>
                              Overrode: {entry.overrideOf}
                            </div>
                          )}
                        </td>
                        {/* Impact */}
                        <td className="py-2.5 px-3 text-right align-top whitespace-nowrap">
                          <span className={`text-[10px] font-semibold ${entry.saving > 0 ? 'text-green-400' : entry.saving < 0 ? 'text-amber-400' : t.textMuted}`}>
                            {entry.saving > 0 ? `+$${entry.saving}` : entry.saving < 0 ? `−$${Math.abs(entry.saving)}` : '—'}
                          </span>
                        </td>
                        {/* Date + invoice — always-present slot, opacity controls visibility (no layout shift) */}
                        <td className="py-2.5 px-3 align-top" style={{ minWidth: '110px' }}>
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`text-[10px] ${t.textMuted} whitespace-nowrap`}>{entry.date}</span>
                            {/* Always rendered — opacity only, no layout shift */}
                            <button
                              onClick={() => toast.info(`Invoice ${entry.invoiceRef}`, {
                                description: 'Production: opens the three-way match grid (PO ↔ Goods Receipt ↔ Invoice) with per-line variance (price / qty), match-exception flow, credit-memo affordance, and a link to the underlying payment-run record.',
                              })}
                              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] whitespace-nowrap transition-all ${
                                isDark ? 'border-gray-700 text-gray-400 hover:text-white hover:border-gray-500' : 'border-gray-300 text-gray-400 hover:text-gray-700 hover:border-gray-400'
                              }`}
                              style={{
                                opacity: hoveredRow === entry.id ? 1 : 0,
                                pointerEvents: hoveredRow === entry.id ? 'auto' : 'none',
                              }}
                            >
                              <FileText className="h-2.5 w-2.5" />
                              {entry.invoiceRef}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── Right Panel ───────────────────────────────────────────────────

  const rightPanel = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Autonomy Balance */}
        <div className={t.section}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className={`h-4 w-4 ${t.sageIcon}`} />
            <div>
              <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Autonomy Balance</h3>
              <p className={`text-[10px] ${t.textMuted}`}>This month · {LEDGER.length} total actions</p>
            </div>
          </div>
          <div className={`p-3 rounded-lg ${t.sageBg} border ${t.sageBorder} mb-3`}>
            <p className={`text-[11px] leading-relaxed ${t.textSecondary}`}>
              Agents handled <strong className={t.textPrimary}>{autonomyPct}% of transactions</strong> autonomously.
              You intervened on <strong className={t.textPrimary}>{100 - autonomyPct}%</strong> — primarily to maintain local
              vendor relationships and quality standards.
            </p>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Agent Autonomous', pct: autonomyPct, Icon: Bot, colorClass: isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700', bar: '#10b981' },
              { label: 'Admin Intervention', pct: 100 - autonomyPct, Icon: User, colorClass: isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700', bar: '#60a5fa' },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between mb-1">
                  <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${row.colorClass}`}>
                    <row.Icon className="h-2.5 w-2.5" /> {row.label}
                  </span>
                  <span className={`text-[10px] font-semibold ${t.textSecondary}`}>{row.pct}%</span>
                </div>
                <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${row.pct}%`, backgroundColor: row.bar }} />
                </div>
              </div>
            ))}
            <p className={`text-[9px] mt-1 ${t.textMuted}`}>
              {adminCount} override{adminCount !== 1 ? 's' : ''} recorded — system learning from your expertise
            </p>
          </div>
        </div>

        {/* Agent Efficacy — semantic colors */}
        <div className={t.section}>
          <div className="flex items-center gap-2 mb-3">
            <Bot className={`h-4 w-4 ${t.sageIcon}`} />
            <div>
              <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Agent Efficacy</h3>
              <p className={`text-[10px] ${t.textMuted}`}>{selected ? selected.name : 'All categories'}</p>
            </div>
          </div>
          <div className="space-y-2">
            {(selected ? [selected] : CATEGORIES.slice(0, 4)).map((cat) => {
              const CatIcon = cat.Icon;
              return (
                <div key={cat.id} className={`${t.card} space-y-1.5`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CatIcon className="h-3 w-3 shrink-0" style={{ color: cat.color }} />
                      <span className={`text-[10px] font-medium ${t.textPrimary}`}>{cat.name}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-[#87986a]">{agentLabel(cat.topAgent.id)}</span>
                  </div>
                  <p className={`text-[10px] leading-snug ${t.textSecondary}`}>
                    {agentLabel(cat.topAgent.id)} ({cat.topAgent.name}) contributed{' '}
                    <strong className={t.textPrimary}>{cat.topAgent.contribution}%</strong> of {cat.name} savings
                  </p>
                  <div className={`h-1 rounded-full ${t.progressTrack}`}>
                    <div className="h-full rounded-full" style={{ width: `${cat.topAgent.contribution}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scope 3 Carbon */}
        <div className={t.section}>
          <div className="flex items-center gap-2 mb-3">
            <Leaf className={`h-4 w-4 ${t.sageIcon}`} />
            <div>
              <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Scope 3 Carbon</h3>
              <p className={`text-[10px] ${t.textMuted}`}>A-01 · Sustainability</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {CATEGORIES.slice(0, 5).map((cat) => {
              const CatIcon = cat.Icon;
              return (
                <div key={cat.id} className="flex items-center gap-2">
                  <CatIcon className="h-3 w-3 shrink-0" style={{ color: cat.color }} />
                  <span className={`text-[10px] flex-1 ${t.textSecondary}`}>{cat.name}</span>
                  <span className={`text-[10px] font-medium tabular-nums ${t.textPrimary}`}>{cat.co2Kg} kg</span>
                  {cat.co2Kg > 200 && <AlertTriangle className="h-2.5 w-2.5 text-amber-400 shrink-0" />}
                </div>
              );
            })}
            <div className={`mt-2 p-2.5 rounded-lg ${t.sageBg} border ${t.sageBorder}`}>
              <div className="flex justify-between">
                <span className={`text-[10px] ${t.textSecondary}`}>Total <strong className={t.textPrimary}>940 kg CO2e</strong></span>
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-green-400" />
                  <span className="text-[10px] text-green-400">−12%</span>
                </div>
              </div>
              <p className={`text-[9px] mt-1 ${t.textMuted}`}>A-01 rerouted 3 orders to low-emission carriers</p>
            </div>
          </div>
        </div>

        {/* Forecast Confidence */}
        <div className={`${t.section}`}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className={`h-4 w-4 ${t.sageIcon}`} />
            <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Forecast Confidence</h3>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Next month spend', value: 92, forecast: '$47.2K', color: '#10b981' },
              { label: 'Savings estimate', value: 87, forecast: '$6,200', color: '#87986a' },
              { label: 'Drift detection', value: 95, forecast: selected ? `${selected.name}: ${selected.drift > 0 ? '+' : ''}${selected.drift}%` : 'All cats.', color: '#10b981' },
              { label: 'Stockout probability', value: 78, forecast: selected ? `${selected.stockoutRisk}% base` : 'Avg 8%', color: '#f59e0b' },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex justify-between mb-0.5">
                  <span className={`text-[10px] ${t.textSecondary}`}>{m.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] ${t.textMuted}`}>{m.forecast}</span>
                    <span className="text-[10px] font-semibold" style={{ color: m.color }}>{m.value}%</span>
                  </div>
                </div>
                <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${m.value}%`, backgroundColor: m.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Atlas context-aware prompts */}
        {selected && selected.atlasPrompts && (
          <div className="px-4 py-3">
            <p className={`text-[10px] mb-2 ${t.textMuted}`}>Suggested for {selected.name}:</p>
            <div className="space-y-1">
              {selected.atlasPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => handleAtlasPrompt(p)}
                  className={`w-full text-left text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                    isDark ? 'border-gray-800 text-gray-400 hover:border-[#87986a]/40 hover:text-[#a3b085] bg-[#2a2a2a]' : 'border-gray-200 text-gray-500 hover:border-[#87986a]/40 hover:text-[#6b7a54] bg-gray-50'
                  }`}
                >
                  "{p}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Atlas message history */}
        {atlasMsgs.length > 0 && (
          <div ref={atlasMsgRef} className="px-4 pb-2 space-y-2 max-h-48 overflow-y-auto">
            {atlasMsgs.map((msg, i) => (
              <div
                key={i}
                className={`text-[10px] p-2.5 rounded-lg leading-relaxed ${
                  msg.role === 'user'
                    ? isDark ? 'bg-[#87986a]/15 text-[#c6d4ae] self-end' : 'bg-[#f4f6f0] text-[#4a5a36]'
                    : isDark ? 'bg-[#2a2a2a] text-gray-300' : 'bg-white border border-gray-200 text-gray-700'
                }`}
              >
                {msg.role === 'atlas' && (
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles className="h-2.5 w-2.5 text-[#87986a]" />
                    <span className="font-semibold text-[#87986a] text-[9px]">Atlas</span>
                  </div>
                )}
                {msg.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Persistent Atlas input — pinned to bottom */}
      <div className={`shrink-0 p-3 border-t ${t.border}`}>
        <div className="flex items-center gap-1 mb-1.5">
          <MessageCircle className={`h-3 w-3 ${t.sageIcon}`} />
          <span className={`text-[10px] font-medium ${t.textPrimary}`}>
            Ask Atlas{selected ? ` about ${selected.name}` : ' about spending'}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
          isDark ? 'bg-[#2a2a2a] border-gray-700 focus-within:border-[#87986a]/50' : 'bg-gray-50 border-gray-200 focus-within:border-[#87986a]/50'
        }`}>
          <input
            type="text"
            value={atlasInput}
            onChange={(e) => setAtlasInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAtlasSubmit(); }}
            placeholder={selected ? `e.g. "${selected.atlasPrompts[0]}"` : 'e.g. "Why did A-01 switch suppliers?"'}
            className={`flex-1 text-[10px] bg-transparent outline-none ${t.textSecondary} placeholder:${t.textMuted}`}
          />
          <button
            onClick={handleAtlasSubmit}
            disabled={!atlasInput.trim()}
            className={`p-1 rounded transition-colors ${
              atlasInput.trim() ? 'text-[#87986a] hover:text-[#a3b085]' : t.textMuted
            }`}
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes capitalBurst {
          0%   { opacity: 0; transform: translateY(40px) scale(0.8); }
          20%  { opacity: 1; transform: translateY(-8px) scale(1.06); }
          55%  { opacity: 1; transform: translateY(0) scale(1); }
          82%  { opacity: 1; transform: translateY(-4px) scale(1.02); }
          100% { opacity: 0; transform: translateY(-70px) scale(0.9); }
        }
        @keyframes sparkleFloat {
          0%, 100% { transform: translateY(0) rotate(0deg);    opacity: 0.6; }
          50%       { transform: translateY(-10px) rotate(180deg); opacity: 1; }
        }
        .capital-burst {
          animation: capitalBurst 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          background: ${isDark ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)'};
          backdrop-filter: blur(12px);
          padding: 2.5rem 3.5rem;
          border-radius: 1.5rem;
          border: 1px solid ${isDark ? 'rgba(135,152,106,0.4)' : 'rgba(135,152,106,0.5)'};
          box-shadow: 0 30px 80px rgba(135,152,106,0.25);
        }
        .capital-amount {
          background: linear-gradient(135deg, #87986a, #a3b085, #6b7a54);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .capital-sparkles svg { animation: sparkleFloat 0.9s ease-in-out infinite; }
        .capital-sparkles svg:nth-child(1) { animation-delay: 0s; }
        .capital-sparkles svg:nth-child(2) { animation-delay: 0.18s; }
        .capital-sparkles svg:nth-child(3) { animation-delay: 0.36s; }
        .capital-sparkles svg:nth-child(4) { animation-delay: 0.54s; }
        .capital-sparkles svg:nth-child(5) { animation-delay: 0.72s; }
        .tradeoff-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px; height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #87986a, #60a5fa);
          cursor: pointer;
          border: 3px solid ${isDark ? '#1a1a1a' : '#fff'};
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .tradeoff-slider::-webkit-slider-thumb:hover { transform: scale(1.3); }
        .tradeoff-slider::-moz-range-thumb {
          width: 20px; height: 20px; border-radius: 50%;
          background: linear-gradient(135deg, #87986a, #60a5fa);
          cursor: pointer; border: 3px solid ${isDark ? '#1a1a1a' : '#fff'};
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
      `}</style>
      <ThreePanelLayout isDark={isDark} left={leftPanel} center={centerPanel} right={rightPanel} />

      {/* Budget Setup Modal */}
      {budgetSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className={`w-full max-w-sm mx-4 rounded-xl border shadow-xl ${
            isDark ? 'bg-[#1e1e1e] border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Category Budgets</h3>
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Set monthly spend limits per category</p>
              </div>
              <button onClick={() => setBudgetSetupOpen(false)} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {CATEGORIES.map(cat => {
                const CatIcon = cat.Icon;
                return (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                          style={{ background: `${cat.color}22` }}>
                      <CatIcon className="h-3 w-3" style={{ color: cat.color }} />
                    </span>
                    <label className={`text-[11px] font-medium w-24 shrink-0 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{cat.name}</label>
                    <div className="flex-1 relative">
                      <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>$</span>
                      <input
                        type="number"
                        value={categoryBudgets[cat.id] ?? ''}
                        onChange={e => setCategoryBudgets(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        className={`w-full pl-5 pr-2 py-1.5 rounded border text-[11px] ${
                          isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                        } focus:outline-none focus:border-[#87986a]`}
                        placeholder={String(cat.budget)}
                        min={0}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`flex gap-2 p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setBudgetSetupOpen(false)}
                className={`flex-1 py-1.5 rounded text-[11px] border transition-colors ${
                  isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => setBudgetSetupOpen(false)}
                className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-[#87986a] hover:bg-[#6b7a54] text-white transition-colors"
              >
                Save Budgets
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
