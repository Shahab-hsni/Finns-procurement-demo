import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DollarSign, Package, AlertTriangle, TrendingUp, TrendingDown,
  CheckCircle, Zap, Bot, ThumbsUp, ThumbsDown,
  ChevronRight, Sparkles, Send, Activity, Shield, Eye,
  Radar, Scale, Info, Check, Clock, Calendar,
  BarChart3, Truck, FileText, CreditCard,
  MessageCircle, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ThreePanelLayout } from './layout/ThreePanelLayout';
import { theme as themeTokens } from '../lib/theme';
import type { FinnsAgentId, FinnsAgentRole, VenueTag } from '../lib/types';
import { AgentCTA } from './AgentCTA';

interface OverviewPageProps {
  theme: 'dark' | 'light';
}

// ── IDR formatting ─────────────────────────────────────────────────────
const fmtIdr = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtIdrShort = (n: number) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000)         return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n}`;
};

// ── Agent icon meta (keyed by id) ──────────────────────────────────────
const AGENT_META: Record<FinnsAgentId, { role: FinnsAgentRole; icon: typeof Zap; color: string; darkColor: string }> = {
  'A-01': { role: 'Sourcing Agent',      icon: Radar,         color: 'text-blue-600',   darkColor: 'text-blue-400'   },
  'A-02': { role: 'Restock Agent',       icon: Package,       color: 'text-green-600',  darkColor: 'text-green-400'  },
  'A-03': { role: 'Vendor Comms Agent',  icon: MessageCircle, color: 'text-purple-600', darkColor: 'text-purple-400' },
  'A-04': { role: 'Spend Watchdog',      icon: Scale,         color: 'text-amber-600',  darkColor: 'text-amber-400'  },
  'A-05': { role: 'Logistics Agent',     icon: Truck,         color: 'text-orange-600', darkColor: 'text-orange-400' },
};

// ── Top metrics ────────────────────────────────────────────────────────
const METRICS = [
  { label: "Month's Spend",  value: fmtIdrShort(420_000_000),  change: -6.2, icon: DollarSign,    detail: 'vs Rp 448jt last month' },
  { label: 'Active Orders',  value: '7',                       change: 12,   icon: Package,       detail: '3 arriving this week'   },
  { label: 'Low Stock',      value: '4',                       change: 0,    icon: AlertTriangle, detail: '2 auto-restocks sent'   },
  { label: 'AI Savings MTD', value: fmtIdrShort(38_400_000),   change: 0,    icon: Zap,           detail: '17 actions this month'  },
];

type Urgency = 'high' | 'medium' | 'low';
const URGENCY_ICON: Record<Urgency, typeof Zap> = { high: Zap, medium: AlertTriangle, low: Info };

// ── Critical Actions (Finn's-flavored, mirrors mockData live orders) ──
interface CriticalAction {
  id: string;
  supplier: string;
  amount: number;          // IDR
  amountUsd?: number;      // when import
  venues: VenueTag[];
  type: string;
  urgency: Urgency;
  why: string;
  aiReasoning: string;
  estimatedSaving: number; // IDR
  contextQuestions: string[];
  negotiationLog: { agent: string; text: string }[];
}

const CRITICAL_ACTIONS: CriticalAction[] = [
  {
    id: 'PO-3041', supplier: 'PT Bali Seafood Lestari', amount: 14_200_000, venues: ['BC', 'ST'],
    type: 'Quote Awaiting Approval', urgency: 'high',
    why: 'Spend Watchdog flagged — quote 4% below market but above standing approval threshold',
    aiReasoning: "Quote validated against the 30-day median by Sourcing Agent (A-01). Vendor reliability holding at 92 composite, cold-chain 98% SLA — well above your trust floor. The Rp 14.2M sits above the auto-approve threshold for Seafood (Rp 12M) so it needs your nod. Spend Watchdog (A-04) cleared the policy gates; only the cap rule is holding it.",
    estimatedSaving: 590_000,
    contextQuestions: [
      'Why is PT Bali Seafood 4% below market median?',
      'How does this compare to the last 5 tuna orders?',
      'What changes if I approve at L4 autonomy for Seafood?',
    ],
    negotiationLog: [
      { agent: 'A-01 Sourcing',     text: 'RFQ sent to PT Bali Seafood Lestari, Krakatoa Coldstore, and Indo Oseanik' },
      { agent: 'A-01 Sourcing',     text: 'Received 3 quotes — PT Bali Seafood lowest at Rp 14.2M (sashimi grade for ST, food grade for BC)' },
      { agent: 'A-04 Spend Watchdog', text: 'Variance vs 30d median: −4%. Vendor trust floor PASS (92 > 70). Cap rule HOLD — escalate to human' },
    ],
  },
  {
    id: 'PO-3043', supplier: 'AUS Premium Meats', amount: 28_500_000, amountUsd: 1840, venues: ['ST'],
    type: 'Rush — Par Floor Breached', urgency: 'high',
    why: 'Wagyu MB7+ on hand 5kg vs par 8kg — Restock Agent promoted to Rush playbook',
    aiReasoning: "Restock Agent (A-02) flagged the par floor breach this morning. Stake bookings are up 18% week-over-week so the burn rate moved +12%. Going Standard would risk a 2-day gap for Stake's tasting menu. Rush playbook bypasses RFQ — AUS Premium Meats is your contracted Wagyu vendor and the quote came in within the 12% Rush premium tolerance. USD-denominated; FX locked at 15,490.",
    estimatedSaving: 0,
    contextQuestions: [
      'Why did Rush promote over Standard for this SKU?',
      'How much do we lose if Stake runs out of Wagyu Saturday?',
      "What's the FX exposure if we don't lock now?",
    ],
    negotiationLog: [
      { agent: 'A-02 Restock',     text: 'Par floor breached: SKU-0101 Wagyu Ribeye MB7+ at 5/8 kg — burn +12% wk/wk' },
      { agent: 'A-02 Restock',     text: 'Promoted to Rush playbook (WF-RSH) — Stake covers up 18%, 2-day gap risk under Standard' },
      { agent: 'A-01 Sourcing',    text: 'Direct quote from AUS Premium Meats: USD 1,840 (≈ Rp 28.5M). Within 12% Rush premium tolerance' },
    ],
  },
  {
    id: 'PO-3047', supplier: 'Eka Packaging', amount: 18_900_000, venues: ['SP'],
    type: 'Dispute — Quote +18% Above Market', urgency: 'medium',
    why: 'Spend Watchdog held the PO. F&B Director raised a dispute to accept the premium.',
    aiReasoning: "Eka Packaging's takeaway-box quote came in 18% over the 30-day median — Spend Watchdog (A-04) auto-held under the standing Spend Cap rule (RUL-001). F&B Director raised a dispute citing the Splash event Saturday. No alternative vendor in the catalog carries the 1000ml takeaway SKU. You can approve the override here, or kick to the Disputes workspace on Activity & Governance to harden as a precedent.",
    estimatedSaving: 0,
    contextQuestions: [
      'Why is Eka Packaging 18% above market this cycle?',
      'Who else carries the 1000ml takeaway SKU?',
      'What happens if I harden this as a precedent?',
    ],
    negotiationLog: [
      { agent: 'A-01 Sourcing',    text: 'Quote from Eka Packaging: Rp 18.9M. No alternative carries the SKU.' },
      { agent: 'A-04 Spend Watchdog', text: 'Variance +18% triggered RUL-001 (Spend Cap, vendor scope). PO held.' },
      { agent: 'A-04 Spend Watchdog', text: 'Dispute DSP-101 opened by F&B Director — needs human override' },
    ],
  },
];

const SYSTEM_ALERTS = [
  { id: 'a1', icon: AlertTriangle, label: 'Yellowfin Tuna (sashimi) at 1.9 days cover — auto-restock queued', severity: 'warning' as const, canQuickApprove: true,  saving: 420_000 },
  { id: 'a2', icon: Shield,        label: 'Halal cert renewal for Sumber Dairy due in 12 days',              severity: 'warning' as const, canQuickApprove: false, saving: 0 },
  { id: 'a3', icon: TrendingDown,  label: 'Bintang Distribusi cold-chain SLA dipped to 88% (target 92%)',    severity: 'info'    as const, canQuickApprove: false, saving: 0 },
];

const AI_ACTIONS: { time: string; action: string; agentId: FinnsAgentId; saving: number | null }[] = [
  { time: '12m ago', action: 'Auto-ordered weekly produce from CV Indo Sayur for BC + SP',         agentId: 'A-01', saving: 240_000 },
  { time: '34m ago', action: 'Rejected Eka Packaging quote — 18% above 30d median, escalated',     agentId: 'A-04', saving: 1_200_000 },
  { time: '1h ago',  action: 'Sent WhatsApp confirmation to Wayan Sukma re: PO-3041 quote',        agentId: 'A-03', saving: null },
  { time: '2h ago',  action: 'Updated tuna burn-rate model — Stake covers +18% wk/wk',             agentId: 'A-02', saving: null },
  { time: '3h ago',  action: 'Locked FX rate for AUS Premium Meats import (USD/IDR 15,490)',       agentId: 'A-04', saving: 680_000 },
  { time: '4h ago',  action: 'Confirmed Bintang shipment dispatch — ETA Friday 14:00 for BC',      agentId: 'A-05', saving: 85_000  },
];

const LIVE_PULSES: { agentId: FinnsAgentId; text: string }[] = [
  { agentId: 'A-01', text: 'Validating 3 seafood quotes for PO-3041...' },
  { agentId: 'A-02', text: 'Recomputing burn model — Wagyu for Stake...' },
  { agentId: 'A-05', text: 'Tracking PO-3044 — Bintang shipment 60km out...' },
  { agentId: 'A-03', text: "Drafting WhatsApp to Pak Made re: tomorrow's drop..." },
];

// 12-month spend trend (current month + 11 prior). Last 2 months are predictive.
const SPEND_TREND = (() => {
  const monthLabels = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
  return monthLabels.map((m, i) => {
    const base = 380_000_000 + Math.sin(i / 2) * 60_000_000 + i * 4_000_000;
    const isPred = i >= 10;
    return {
      month: m,
      spend:     isPred ? null : Math.round(base + 20_000_000),
      predicted: isPred ? Math.round(base + 30_000_000) : null,
      predHigh:  isPred ? Math.round(base + 60_000_000) : null,
      predLow:   isPred ? Math.round(base - 20_000_000) : null,
    };
  });
})();

const AUTONOMY = { progress: 72, remaining: 8, label: 'Higher Autonomy', category: 'Seafood' };
const ROI = { manualTouches: 14, hoursSaved: 3.5, capitalFreed: 34_200_000 };

const DEFAULT_QUESTIONS = [
  'What needs my attention most urgently?',
  'Which PO has the biggest savings opportunity today?',
  "What's blocking the next autonomy unlock?",
];

// ══════════════════════════════════════════════════════════════════════
// CALENDAR DATA
// ══════════════════════════════════════════════════════════════════════
type CalEventStatus = 'pending' | 'in-transit' | 'action-needed' | 'completed' | 'overdue';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  time?: string;
  type: 'delivery' | 'payment' | 'compliance' | 'restock' | 'meeting';
  status: CalEventStatus;
  supplier?: string;
  amount?: number;
  amountUsd?: number;
  venues?: VenueTag[];
  poRef?: string;
  agentReasoning: string;
  estimatedSaving?: number;
  dagStage: number;   // 0-4 (5 stages)
  failedStage?: number;
}

const STATUS_META: Record<CalEventStatus, {
  icon: typeof Clock; label: string;
  color: string; darkColor: string;
  bg: string; darkBg: string;
}> = {
  'pending':       { icon: Clock,         label: 'Pending',       color: 'text-blue-600',   darkColor: 'text-blue-400',   bg: 'bg-blue-50 border-blue-200',       darkBg: 'bg-blue-500/10 border-blue-500/20'   },
  'in-transit':    { icon: Truck,         label: 'In Transit',    color: 'text-purple-600', darkColor: 'text-purple-400', bg: 'bg-purple-50 border-purple-200',   darkBg: 'bg-purple-500/10 border-purple-500/20' },
  'action-needed': { icon: AlertTriangle, label: 'Action Needed', color: 'text-amber-600',  darkColor: 'text-amber-400',  bg: 'bg-amber-50 border-amber-200',     darkBg: 'bg-amber-500/10 border-amber-500/20' },
  'completed':     { icon: Check,         label: 'Completed',     color: 'text-green-600',  darkColor: 'text-green-400',  bg: 'bg-green-50 border-green-200',     darkBg: 'bg-green-500/10 border-green-500/20' },
  'overdue':       { icon: AlertTriangle, label: 'Overdue',       color: 'text-red-600',    darkColor: 'text-red-400',    bg: 'bg-red-50 border-red-200',         darkBg: 'bg-red-500/10 border-red-500/20'     },
};

const TYPE_ICON: Record<CalendarEvent['type'], typeof Truck> = {
  delivery:   Truck,
  payment:    CreditCard,
  compliance: FileText,
  restock:    Package,
  meeting:    MessageCircle,
};

// Today = May 16 2026
const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'EVT-001', title: 'Bintang Beer Delivery — BC + SP + RC', date: '2026-05-16', time: '14:00',
    type: 'delivery', status: 'in-transit', supplier: 'Bintang Distribusi', amount: 9_400_000, venues: ['BC', 'SP', 'RC'], poRef: 'PO-3044',
    agentReasoning: 'Logistics Agent (A-05) tracking GPS — vehicle 60km out, ETA 14:00. BC receives 50%, SP 30%, RC 20%. Receiving leads notified via WhatsApp 30 min ago.',
    estimatedSaving: 320_000, dagStage: 3,
  },
  {
    id: 'EVT-002', title: 'Sumber Dairy QC Check-in', date: '2026-05-16', time: '10:00',
    type: 'delivery', status: 'action-needed', supplier: 'Sumber Dairy', amount: 3_200_000, venues: ['BC', 'RC'], poRef: 'PO-3045',
    agentReasoning: 'Delivered at 09:42. Logistics Agent (A-05) awaiting your QC sign-off at the BC kitchen receiving bay. Burrata batch needs visual check before stock release.',
    estimatedSaving: 0, dagStage: 4,
  },
  {
    id: 'EVT-003', title: 'PT Wine Cellar Nusa — Customs Clear', date: '2026-05-17', time: '08:00',
    type: 'compliance', status: 'pending', supplier: 'PT Wine Cellar Nusa', amount: 42_000_000, amountUsd: 2710, venues: ['RC', 'ST'], poRef: 'PO-3046',
    agentReasoning: 'Imported wine cleared Tanjung Priok customs yesterday — ETA Bali warehouse Sunday. Logistics Agent (A-05) coordinating last-mile with cold-chain handler.',
    estimatedSaving: 0, dagStage: 3,
  },
  {
    id: 'EVT-004', title: 'AUS Wagyu Restock — Stake', date: '2026-05-17', time: '16:00',
    type: 'restock', status: 'action-needed', supplier: 'AUS Premium Meats', amount: 28_500_000, amountUsd: 1840, venues: ['ST'], poRef: 'PO-3043',
    agentReasoning: 'Rush PO awaiting your approval. Par floor breached this morning. FX locked at 15,490. Skipping this cycle risks a 2-day gap for Stake tasting menu.',
    estimatedSaving: 0, dagStage: 0, failedStage: undefined,
  },
  {
    id: 'EVT-005', title: 'CV Indo Sayur — Weekly Produce', date: '2026-05-17', time: '06:00',
    type: 'delivery', status: 'in-transit', supplier: 'CV Indo Sayur', amount: 4_800_000, venues: ['BC', 'SP'], poRef: 'PO-3042',
    agentReasoning: 'Recurring weekly produce — auto-approved by Spend Watchdog under standing recurring schedule. Pak Made confirmed 06:00 drop at BC kitchen.',
    estimatedSaving: 0, dagStage: 3,
  },
  {
    id: 'EVT-006', title: 'Halal Cert Renewal — Sumber Dairy', date: '2026-05-28',
    type: 'compliance', status: 'pending',
    agentReasoning: 'Halal cert expires May 28. Vendor Comms (A-03) has the renewal pack ready to send to Sumber. Needs your sign-off to dispatch.',
    estimatedSaving: 0, dagStage: 1,
  },
  {
    id: 'EVT-007', title: 'BC Saturday Stock Build (event prep)', date: '2026-05-16', time: '23:59',
    type: 'restock', status: 'action-needed', amount: 18_900_000, venues: ['SP'], poRef: 'PO-3047',
    agentReasoning: 'Splash hosting Saturday event — Eka Packaging takeaway boxes needed. Quote came in 18% over market; dispute open in Activity & Governance.',
    estimatedSaving: 0, dagStage: 1, failedStage: 1,
  },
  {
    id: 'EVT-008', title: 'PT Bali Seafood — Tuna for ST + BC', date: '2026-05-17', time: '11:00',
    type: 'delivery', status: 'pending', supplier: 'PT Bali Seafood Lestari', amount: 14_200_000, venues: ['BC', 'ST'], poRef: 'PO-3041',
    agentReasoning: 'Quote pending your approval. Sashimi-grade for Stake, food-grade for Beach Club. Wayan Sukma standing by for confirmation via WhatsApp.',
    estimatedSaving: 590_000, dagStage: 1,
  },
  {
    id: 'EVT-009', title: 'Krakatoa Coldstore Quality Audit', date: '2026-05-22',
    type: 'compliance', status: 'pending',
    agentReasoning: 'Routine quarterly QC audit for cold-chain vendors. Pre-audit checklist generated by Vendor Comms (A-03). Needs your scope sign-off.',
    estimatedSaving: 0, dagStage: 0,
  },
  {
    id: 'EVT-010', title: 'Krakatoa Coldstore — Pork + Chicken Bulk', date: '2026-05-13',
    type: 'delivery', status: 'completed', supplier: 'Krakatoa Coldstore', amount: 22_000_000, venues: ['BC', 'RC'], poRef: 'PO-2990',
    agentReasoning: 'Delivered and verified. Logistics Agent QC passed — cold chain intact, quality score 92. Inventory updated.',
    estimatedSaving: 380_000, dagStage: 4,
  },
  {
    id: 'EVT-011', title: 'Bali Fresh Farms — Herb Pre-Order', date: '2026-05-15', time: '15:00',
    type: 'restock', status: 'completed', supplier: 'Bali Fresh Farms', amount: 960_000, venues: ['BC', 'ST'],
    agentReasoning: 'Pre-order for weekend tasting menu confirmed. Same-day delivery slot locked.',
    estimatedSaving: 90_000, dagStage: 4,
  },
  {
    id: 'EVT-012', title: 'Eka Packaging Invoice Overdue', date: '2026-05-14',
    type: 'payment', status: 'overdue', supplier: 'Eka Packaging', amount: 5_400_000,
    agentReasoning: 'Invoice 48h past net-30 terms. Late fee of 1.5% accruing daily. Vendor Comms (A-03) sent 2 follow-up reminders — manual escalation recommended.',
    estimatedSaving: 0, dagStage: 4,
  },
  {
    id: 'EVT-013', title: 'Quarterly Review — Bali Fresh Farms', date: '2026-05-21', time: '10:00',
    type: 'meeting', status: 'pending', supplier: 'Bali Fresh Farms',
    agentReasoning: 'Sourcing Agent (A-01) arranged quarterly review. Agenda: seasonal pricing lock for Q3, organic herb line for Stake, delivery frequency adjustment.',
    estimatedSaving: 0, dagStage: 0,
  },
  {
    id: 'EVT-014', title: 'Kopi Bali — Biweekly Coffee All Venues', date: '2026-05-19',
    type: 'restock', status: 'pending', amount: 1_275_000, venues: ['BC', 'RC', 'ST', 'SP'],
    agentReasoning: 'Restock Agent (A-02) scheduled routine biweekly coffee restock. Consumption trend up 8% — recommends increasing par by 5kg next cycle.',
    estimatedSaving: 70_000, dagStage: 0,
  },
];

// ── 5-Stage Order Journey DAG ────────────────────────────────────────
const DAG_STAGES: { label: string; agentStep?: string }[] = [
  { label: 'Request',                  agentStep: 'Restock Agent (A-02) raised the demand signal — par breach, scheduled trigger, or human request.' },
  { label: 'Quote / Vendor Confirmed', agentStep: 'Sourcing Agent (A-01) ran the playbook. RFQ for Standard, direct vendor for Rush, contract draw for Recurring. Quote validated vs 30-day market median.' },
  { label: 'PO Approved',              agentStep: 'Spend Watchdog (A-04) checked the policy stack — spend cap, vendor trust floor, duplicate detection. PO issued to vendor on pass.' },
  { label: 'In Transit',               agentStep: 'Logistics Agent (A-05) confirmed dispatch and tracks ETA. Cold-chain sensors monitored for proteins, seafood, dairy.' },
  { label: 'Delivered & Checked',      agentStep: 'Receiving venue staff QC the delivery against PO. Pass → stock updated. Fail → dispute opened on Activity & Governance.' },
];

// ── Temporal Alerts ──────────────────────────────────────────────────
const TEMPORAL_ALERTS: {
  id: string; severity: 'high' | 'medium' | 'low';
  title: string; detail: string; agentId: FinnsAgentId; saving: number;
}[] = [
  {
    id: 'ta-1', severity: 'high',
    title: 'Stake Tasting Menu — Wagyu Gap Risk',
    detail: 'AUS Wagyu PO-3043 still pending approval. Standard playbook would land Tuesday; Rush playbook needs your nod by 16:00 today. Spending Rp 28.5M now vs missing the weekend menu.',
    agentId: 'A-02', saving: 0,
  },
  {
    id: 'ta-2', severity: 'medium',
    title: 'Bintang Multi-Venue Delivery — 14:00 today',
    detail: '180-case Bintang drop hits BC, SP, and RC this afternoon. Logistics Agent (A-05) flagged: BC receiving window closes 16:00. Confirm with each venue lead now.',
    agentId: 'A-05', saving: 0,
  },
  {
    id: 'ta-3', severity: 'low',
    title: 'Halal Cert Window Closing',
    detail: 'Sumber Dairy halal cert expires May 28. If missed, Sumber orders pause 5–7 business days. Vendor Comms (A-03) has the renewal pre-filled — needs only your dispatch sign-off.',
    agentId: 'A-03', saving: 0,
  },
];

const CAL_SAVINGS = {
  total: 4_200_000,
  items: [
    { label: 'Early-payment discounts',  amount: 1_080_000, agentId: 'A-04' as FinnsAgentId },
    { label: 'Recurring vendor lock-in', amount: 1_620_000, agentId: 'A-01' as FinnsAgentId },
    { label: 'Pre-locked FX windows',    amount: 1_500_000, agentId: 'A-04' as FinnsAgentId },
  ],
};

// ── Venue chip ───────────────────────────────────────────────────────
const VENUE_LABEL: Record<VenueTag, string> = { BC: 'BC', RC: 'RC', ST: 'ST', SP: 'SP' };
const VenueChips = ({ venues, isDark }: { venues: VenueTag[]; isDark: boolean }) => (
  <div className="flex items-center gap-0.5 flex-wrap">
    {venues.map(v => (
      <span key={v} className={`text-[8px] font-bold px-1 py-0.5 rounded ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
        {VENUE_LABEL[v]}
      </span>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════
export function OverviewPage({ theme }: OverviewPageProps) {
  const isDark = theme === 'dark';
  const t = themeTokens(isDark);

  // PO triage state
  const [approvedIds, setApprovedIds]     = useState<Set<string>>(new Set());
  const [quickApproved, setQuickApproved] = useState<Set<string>>(new Set());
  const [flyOutId, setFlyOutId]           = useState<string | null>(null);
  const [selectedPoId, setSelectedPoId]   = useState<string | null>(null);
  const [chatInput, setChatInput]         = useState('');
  const [savingFloat, setSavingFloat]     = useState<string | null>(null);
  const [pulseIdx, setPulseIdx]           = useState(0);
  const [chatMessages, setChatMessages]   = useState([
    { from: 'atlas', text: 'Select a PO or calendar event to see my analysis, or ask me anything.' },
  ]);

  // Calendar state
  const [centerMode, setCenterMode]           = useState<'analytics' | 'calendar'>('analytics');
  const [calView, setCalView]                 = useState<'month' | 'week' | 'agenda'>('week');
  const [selectedEvent, setSelectedEvent]     = useState<CalendarEvent | null>(null);
  const [hoveredEventId, setHoveredEventId]   = useState<string | null>(null);
  const [clearedIds, setClearedIds]           = useState<Set<string>>(new Set());
  const [clearingId, setClearingId]           = useState<string | null>(null);
  const [expandedDag, setExpandedDag]         = useState<Set<number>>(new Set());
  const [dailySavings, setDailySavings]       = useState(0);

  // Rotate agent pulse
  useEffect(() => {
    const id = setInterval(() => setPulseIdx(p => (p + 1) % LIVE_PULSES.length), 4000);
    return () => clearInterval(id);
  }, []);

  // Derived
  const totalTasks      = CRITICAL_ACTIONS.length + SYSTEM_ALERTS.length;
  const clearedTasks    = approvedIds.size + quickApproved.size;
  const visibleCritical = CRITICAL_ACTIONS.filter(a => !approvedIds.has(a.id));
  const selectedPO      = CRITICAL_ACTIONS.find(a => a.id === selectedPoId && !approvedIds.has(a.id)) ?? null;

  const currentQuestions = selectedEvent
    ? [
        `Why is "${selectedEvent.title}" at stage ${selectedEvent.dagStage + 1}/5?`,
        `What are the risks for this ${selectedEvent.type}?`,
        `Show alternatives for ${selectedEvent.supplier ?? 'this event'}`,
      ]
    : selectedPO
    ? selectedPO.contextQuestions
    : DEFAULT_QUESTIONS;

  // ── Calendar date helpers ──────────────────────────────────────────
  // Project date: May 16 2026 (matches Finn's system date)
  const TODAY = useMemo(() => new Date(2026, 4, 16), []);

  const weekDays = useMemo<Date[]>(() => {
    const sun = new Date(TODAY);
    sun.setDate(TODAY.getDate() - TODAY.getDay());
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(sun); d.setDate(sun.getDate() + i); return d; });
  }, [TODAY]);

  const monthCells = useMemo<(Date | null)[]>(() => {
    const year = TODAY.getFullYear(), month = TODAY.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [TODAY]);

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const TODAY_KEY = dateKey(TODAY);

  const eventsFor = useCallback((d: Date) =>
    CALENDAR_EVENTS.filter(e => e.date === dateKey(d) && !clearedIds.has(e.id)),
  [clearedIds]);

  const agendaEvents = useMemo(() =>
    [...CALENDAR_EVENTS]
      .filter(e => !clearedIds.has(e.id))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')),
  [clearedIds]);

  const isToday = (d: Date) => d.getDate() === TODAY.getDate() && d.getMonth() === TODAY.getMonth();

  const friendlyDate = (ds: string) => {
    const d = new Date(ds + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // ── Handlers ──────────────────────────────────────────────────────
  const handlePoApprove = useCallback((id: string) => {
    const po = CRITICAL_ACTIONS.find(a => a.id === id);
    setFlyOutId(id);
    if (po?.estimatedSaving) {
      setSavingFloat(`Saved ${fmtIdrShort(po.estimatedSaving)}`);
      setTimeout(() => setSavingFloat(null), 2400);
    }
    setTimeout(() => {
      setApprovedIds(prev => new Set([...prev, id]));
      setFlyOutId(null);
      setSelectedPoId(null);
      if (po) setChatMessages(prev => [...prev, { from: 'atlas', text: `${id} submitted. ${fmtIdrShort(po.estimatedSaving)} saving estimated — pending vendor acknowledgement. I'll surface the vendor's ack and confirm the realised saving once the PO is accepted.` }]);
    }, 380);
  }, []);

  const handlePoSelect = useCallback((id: string) => {
    const po = CRITICAL_ACTIONS.find(a => a.id === id);
    setSelectedPoId(id);
    setSelectedEvent(null);
    if (po) setChatMessages(prev => [...prev, { from: 'atlas', text: po.aiReasoning }]);
  }, []);

  const handleQuickApprove = useCallback((alertId: string, saving: number) => {
    setQuickApproved(prev => new Set([...prev, alertId]));
    if (saving > 0) { setSavingFloat(`Saved ${fmtIdrShort(saving)}`); setTimeout(() => setSavingFloat(null), 2400); }
  }, []);

  const handleChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatMessages(prev => [...prev, { from: 'user', text: msg }]);
    setChatInput('');
    setTimeout(() => setChatMessages(prev => [...prev, { from: 'atlas', text: "I'm pulling the latest data now. Recommendation incoming." }]), 900);
  }, [chatInput]);

  // Calendar: open event → morph into DAG journey
  const handleEventClick = useCallback((evt: CalendarEvent) => {
    setSelectedEvent(evt);
    setSelectedPoId(null);
    setExpandedDag(new Set());
    setChatMessages(prev => [...prev, { from: 'atlas', text: evt.agentReasoning }]);
  }, []);

  // Calendar: clear a deadline (Peak-End animation)
  const handleClearDeadline = useCallback((evt: CalendarEvent) => {
    setClearingId(evt.id);
    const saving = evt.estimatedSaving ?? 0;
    if (saving > 0) {
      setSavingFloat(`Deadline Cleared — Saved ${fmtIdrShort(saving)}`);
      setTimeout(() => setSavingFloat(null), 2800);
    }
    setTimeout(() => {
      setClearedIds(prev => new Set([...prev, evt.id]));
      setClearingId(null);
      setSelectedEvent(null);
      setDailySavings(prev => prev + saving);
      setChatMessages(prev => [...prev, {
        from: 'atlas',
        text: `${evt.title} cleared. ${saving > 0 ? `${fmtIdrShort(saving)} saving estimated — pending downstream confirmation (payment / compliance / receipt depending on event type).` : 'Status updated across all systems.'}`,
      }]);
    }, 850);
  }, []);

  const toggleDag = useCallback((idx: number) => {
    setExpandedDag(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }, []);

  // Pre-compute selected event metadata
  const evtSm   = selectedEvent ? STATUS_META[selectedEvent.status] : null;
  const EvtStatusIcon = evtSm?.icon ?? Clock;
  const EvtTypeIcon   = selectedEvent ? TYPE_ICON[selectedEvent.type] : Truck;

  // ── Calendar event card ────────────────────────────────────────────
  const renderCalEvent = (evt: CalendarEvent, compact = false) => {
    const sm = STATUS_META[evt.status];
    const StatusIcon = sm.icon;
    const TypeIcon = TYPE_ICON[evt.type];
    const isHov = hoveredEventId === evt.id;
    const isClearing = clearingId === evt.id;
    const isActive = selectedEvent?.id === evt.id;

    return (
      <div key={evt.id}
        onMouseEnter={() => setHoveredEventId(evt.id)}
        onMouseLeave={() => setHoveredEventId(null)}
        onClick={() => handleEventClick(evt)}
        className={`group relative cursor-pointer rounded-lg border p-2.5 transition-all duration-200 select-none ${
          isClearing
            ? 'scale-95 opacity-50'
            : isActive
            ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 ring-1 ring-[#87986a]/20' : 'bg-[#f4f6f0] border-[#87986a]/40 ring-1 ring-[#87986a]/20'
            : isDark ? `${sm.darkBg} hover:brightness-110` : `${sm.bg} hover:brightness-95`
        }`}
        style={isClearing ? { animation: 'deadlineCleared 850ms ease-out forwards' } : undefined}
      >
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center ${isDark ? 'bg-black/20' : 'bg-white/70'}`}>
            <TypeIcon className={`h-3 w-3 ${isDark ? sm.darkColor : sm.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[11px] font-medium truncate ${t.textPrimary}`}>{evt.title}</span>
              <StatusIcon className={`h-3 w-3 shrink-0 ${isDark ? sm.darkColor : sm.color}`} />
              {evt.venues && evt.venues.length > 0 && <VenueChips venues={evt.venues} isDark={isDark} />}
            </div>
            {!compact && (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {evt.time && <span className={`text-[9px] ${t.textMuted}`}>{evt.time}</span>}
                {evt.supplier && <span className={`text-[9px] ${t.textMuted}`}>· {evt.supplier}</span>}
                {evt.amount != null && (
                  <span className={`text-[9px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                    {fmtIdrShort(evt.amount)}
                  </span>
                )}
                {evt.estimatedSaving != null && evt.estimatedSaving > 0 && (
                  <span className="text-[9px] text-green-500">saves {fmtIdrShort(evt.estimatedSaving)}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hover micro-actions */}
        {isHov && !compact && !isClearing && (
          <div className={`flex items-center gap-1 mt-2 pt-2 border-t ${isDark ? 'border-gray-700' : 'border-[#e5e5e0]/70'}`}
            onClick={e => e.stopPropagation()}>
            <button
              onClick={() => handleEventClick(evt)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium transition-colors ${isDark ? 'bg-[#87986a]/15 text-[#a3b085] hover:bg-[#87986a]/25' : 'bg-[#f4f6f0] text-[#6b7a54] hover:bg-[#e8eddf]'}`}>
              <Eye className="h-2.5 w-2.5" /> View Journey
            </button>
            <button
              onClick={() => handleClearDeadline(evt)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium transition-colors ${isDark ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
              <Check className="h-2.5 w-2.5" />
              {evt.type === 'payment' ? 'Pay Now' : evt.status === 'action-needed' ? 'Execute' : 'Complete'}
            </button>
            <button
              onClick={() => {
                setChatMessages(prev => [
                  ...prev,
                  { from: 'user',  text: `Tell me about "${evt.title}"` },
                  { from: 'atlas', text: evt.agentReasoning },
                ]);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium transition-colors ${isDark ? 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>
              <Sparkles className="h-2.5 w-2.5" /> Atlas
            </button>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // LEFT PANEL
  // ══════════════════════════════════════════════════════════════════
  const leftPanel = (
    <div className={`flex flex-col h-full ${isDark ? '' : 'bg-white'}`}>
      {/* Progress bar */}
      <div className={`px-4 py-3 border-b ${t.border}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[10px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{clearedTasks}/{totalTasks} Tasks Cleared</span>
          <span className={`text-[10px] ${t.textMuted}`}>{totalTasks - clearedTasks} remaining</span>
        </div>
        <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
          <div className="h-1.5 rounded-full bg-[#87986a] transition-all duration-500" style={{ width: `${(clearedTasks / totalTasks) * 100}%` }} />
        </div>
      </div>

      <div className={`px-4 py-3 border-b ${t.border}`}>
        <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Triage Queue</h2>
        <p className={`text-xs mt-0.5 ${t.textMuted}`}>Items needing your decision</p>
      </div>

      {/* Critical POs */}
      <div className={`p-4 border-b ${t.border}`}>
        <h3 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>REQUIRES REVIEW</h3>
        <div className="space-y-2">
          {visibleCritical.length === 0 ? (
            <div className={`flex items-center gap-2 p-2.5 rounded-lg ${isDark ? 'bg-[#87986a]/10' : 'bg-[#f4f6f0]'}`}>
              <CheckCircle className="h-3.5 w-3.5 text-green-400" />
              <span className={`text-xs ${t.textPrimary}`}>All reviews complete</span>
            </div>
          ) : visibleCritical.map(item => {
            const UrgIcon = URGENCY_ICON[item.urgency];
            const isFlying   = flyOutId === item.id;
            const isSelected = selectedPoId === item.id;
            return (
              <div key={item.id} className={`relative transition-all duration-[380ms] ${isFlying ? 'opacity-0 translate-x-16 scale-95' : ''}`}>
                <button onClick={() => handlePoSelect(item.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40' : 'bg-[#f4f6f0] border-[#87986a]/40'
                      : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-[#f4f6f0]'
                  }`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <UrgIcon className={`h-3 w-3 shrink-0 ${item.urgency === 'high' ? (isDark ? 'text-red-400' : 'text-red-600') : item.urgency === 'medium' ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-blue-400' : 'text-blue-600')}`} />
                      <span className={`text-xs font-medium ${t.textPrimary}`}>{item.id}</span>
                      <VenueChips venues={item.venues} isDark={isDark} />
                    </div>
                    <ChevronRight className={`h-3 w-3 ${isSelected ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textMuted}`} />
                  </div>
                  <p className={`text-[10px] leading-snug mt-0.5 ${t.textMuted}`}>{item.why}</p>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className={`text-xs font-semibold ${t.textPrimary}`}>{fmtIdrShort(item.amount)}</span>
                    {item.amountUsd && (
                      <span className={`text-[9px] ${t.textMuted}`}>· USD {item.amountUsd.toLocaleString()}</span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* System alerts */}
      <div className="p-4 flex-1 overflow-y-auto min-h-0">
        <h3 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>SYSTEM ALERTS</h3>
        <div className="space-y-1.5">
          {SYSTEM_ALERTS.map(alert => {
            const Icon  = alert.icon;
            const isDone = quickApproved.has(alert.id);
            return (
              <div key={alert.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${isDone ? (isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200') : (isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]')}`}>
                {isDone ? <Check className="h-3.5 w-3.5 shrink-0 text-green-400" /> : <Icon className={`h-3.5 w-3.5 shrink-0 ${alert.severity === 'warning' ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-blue-400' : 'text-blue-600')}`} />}
                <span className={`text-[10px] leading-snug flex-1 ${isDone ? (isDark ? 'text-green-400' : 'text-green-700') : t.textMuted}`}>{isDone ? 'Approved' : alert.label}</span>
                {alert.canQuickApprove && !isDone && (
                  <button onClick={() => handleQuickApprove(alert.id, alert.saving)}
                    className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${isDark ? 'bg-green-500/15 hover:bg-green-500/30 text-green-400' : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'}`}>
                    <Check className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // CENTER PANEL
  // ══════════════════════════════════════════════════════════════════
  const centerPanel = (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Float saving badge */}
      {savingFloat && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-green-500 text-white text-xs font-semibold shadow-lg pointer-events-none"
          style={{ animation: 'floatUp 2.4s ease-out forwards' }}>
          {savingFloat}
        </div>
      )}

      {/* Mode toggle header (hidden when PO workspace or DAG journey open) */}
      {!selectedPO && !selectedEvent && (
        <div className={`px-6 pt-5 pb-4 flex items-center justify-between shrink-0 border-b ${t.border}`}>
          <div className={`flex items-center rounded-lg border p-0.5 ${isDark ? 'border-gray-700 bg-[#1a1a1a]' : 'border-[#e5e5e0] bg-gray-50'}`}>
            {([['analytics', BarChart3, 'Performance'] as const, ['calendar', Calendar, 'Logistics Calendar'] as const]).map(([mode, Icon, label]) => (
              <button key={mode}
                onClick={() => { setCenterMode(mode); setSelectedEvent(null); if (mode === 'calendar') setSelectedPoId(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                  centerMode === mode
                    ? isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-white text-[#6b7a54] shadow-sm'
                    : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          {centerMode === 'calendar' && (
            <div className="flex items-center gap-2">
              {dailySavings > 0 && (
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                  Daily Savings: {fmtIdrShort(dailySavings)}
                </span>
              )}
              <div className={`flex items-center rounded-md border p-0.5 ${isDark ? 'border-gray-700' : 'border-[#e5e5e0]'}`}>
                {(['month', 'week', 'agenda'] as const).map(v => (
                  <button key={v} onClick={() => setCalView(v)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium capitalize transition-colors ${calView === v ? (isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-white text-[#6b7a54] shadow-sm') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ANALYTICS VIEW ═══ */}
      <div className={`transition-all duration-[400ms] flex-1 min-h-0 overflow-y-auto p-6 ${centerMode === 'analytics' && !selectedPO && !selectedEvent ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
        <div className="space-y-5">
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3">
            {METRICS.map(m => {
              const Icon = m.icon;
              return (
                <div key={m.label} className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                    <span className={`text-[10px] ${t.textMuted}`}>{m.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${t.textPrimary}`}>{m.value}</span>
                    {m.change !== 0 && (
                      <span className={`flex items-center gap-0.5 text-[10px] ${m.change < 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {m.change < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        {Math.abs(m.change)}%
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] ${t.textMuted}`}>{m.detail}</span>
                </div>
              );
            })}
          </div>

          {/* Spend trend chart */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Monthly Spending Trend</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>Spend Watchdog forecast: Apr–May</span>
            </div>
            <p className={`text-xs mb-4 ${t.textMuted}`}>Shaded zone = Spend Watchdog (A-04) confidence band</p>
            <div className={`${t.cardPanel} p-4`}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={SPEND_TREND}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#87986a" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#87986a" stopOpacity={0}   />
                      </linearGradient>
                      <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#87986a" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#87986a" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: isDark ? '#777' : '#999' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: isDark ? '#777' : '#999' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1_000_000).toFixed(0)}jt`} />
                    <Tooltip contentStyle={{ background: isDark ? '#2a2a2a' : '#fff', border: isDark ? '1px solid #333' : '1px solid #e5e5e0', borderRadius: 8, fontSize: 11, color: isDark ? '#fff' : '#111' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'predHigh' || name === 'predLow') return [null, null];
                        return [value != null ? fmtIdrShort(value) : '—', name === 'spend' ? 'Actual' : 'Forecast'];
                      }} />
                    <Area type="monotone" dataKey="predHigh" stroke="none" fill="#87986a" fillOpacity={0.07} legendType="none" />
                    <Area type="monotone" dataKey="predLow"  stroke="none" fill={isDark ? '#1a1a1a' : '#fff'} fillOpacity={1} legendType="none" />
                    <Area type="monotone" dataKey="spend"     stroke="#87986a" strokeWidth={2} fill="url(#spendGrad)" dot={false} />
                    <Area type="monotone" dataKey="predicted" stroke="#87986a" strokeWidth={2} strokeDasharray="6 3" fill="url(#predGrad)" dot={{ fill: '#87986a', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CALENDAR VIEWS ═══ */}
      <div className={`transition-all duration-[400ms] flex-1 min-h-0 flex flex-col overflow-hidden p-6 pt-4 ${centerMode === 'calendar' && !selectedEvent && !selectedPO ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
        {/* Calendar sub-header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Logistics Calendar — May 2026</h2>
            <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
              {CALENDAR_EVENTS.filter(e => !clearedIds.has(e.id) && (e.status === 'action-needed' || e.status === 'overdue')).length} items need action
            </p>
          </div>
        </div>

        {/* Calendar scroll area */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* MONTH VIEW */}
          {calView === 'month' && (
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
              <div className={`grid grid-cols-7 border-b ${t.border} ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50'}`}>
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className={`text-center py-2.5 text-[10px] font-semibold ${t.textMuted}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((date, idx) => {
                  const evts = date ? eventsFor(date) : [];
                  const todayCell = date ? isToday(date) : false;
                  const hasAction = evts.some(e => e.status === 'action-needed' || e.status === 'overdue');
                  return (
                    <div key={idx} className={`min-h-[80px] p-2.5 border-b border-r ${isDark ? 'border-gray-800' : 'border-gray-100'} ${!date ? (isDark ? 'bg-[#0d0d0d]' : 'bg-gray-50/40') : ''}`}>
                      {date && (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[11px] leading-none font-medium ${todayCell ? `w-5 h-5 rounded-full bg-[#87986a] text-white flex items-center justify-center text-[10px] font-bold` : t.textPrimary}`}>
                              {date.getDate()}
                            </span>
                            {evts.length > 0 && (
                              <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${hasAction ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700') : (isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]')}`}>
                                {evts.length}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {evts.slice(0, 4).map(evt => (
                              <button key={evt.id} onClick={() => handleEventClick(evt)}
                                title={evt.title}
                                className={`w-2 h-2 rounded-full transition-transform hover:scale-[2] ${
                                  evt.status === 'overdue'       ? 'bg-red-500'    :
                                  evt.status === 'action-needed' ? 'bg-amber-400'  :
                                  evt.status === 'in-transit'    ? 'bg-purple-400' :
                                  evt.status === 'completed'     ? 'bg-green-500'  : 'bg-blue-400'
                                }`} />
                            ))}
                            {evts.length > 4 && <span className={`text-[8px] ${t.textMuted}`}>+{evts.length - 4}</span>}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {calView === 'week' && (
            <div className="space-y-1.5">
              {weekDays.map(date => {
                const evts    = eventsFor(date);
                const todayRow = isToday(date);
                return (
                  <div key={date.toISOString()}
                    className={`rounded-xl border p-4 ${todayRow ? (isDark ? 'bg-[#87986a]/5 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]') : (isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]')}`}>
                    <div className="flex items-start gap-5">
                      <div className="w-12 shrink-0 text-center pt-0.5">
                        <div className={`text-[10px] font-medium ${t.textMuted}`}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className={`text-xl font-bold mt-0.5 leading-none ${todayRow ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textPrimary}`}>
                          {date.getDate()}
                        </div>
                        {todayRow && <div className={`text-[8px] font-bold uppercase mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Today</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        {evts.length === 0
                          ? <p className={`text-[10px] py-2 ${t.textMuted}`}>No scheduled events</p>
                          : <div className="space-y-1.5">{evts.map(e => renderCalEvent(e))}</div>
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AGENDA VIEW */}
          {calView === 'agenda' && (() => {
            const grouped = new Map<string, CalendarEvent[]>();
            agendaEvents.forEach(evt => {
              const arr = grouped.get(evt.date) ?? [];
              arr.push(evt);
              grouped.set(evt.date, arr);
            });
            return (
              <div className="space-y-5">
                {[...grouped.entries()].map(([ds, evts]) => (
                  <div key={ds}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-semibold ${ds === TODAY_KEY ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textPrimary}`}>
                        {friendlyDate(ds)}
                      </span>
                      {ds === TODAY_KEY && (
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>Today</span>
                      )}
                      <div className={`flex-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                      <span className={`text-[9px] ${t.textMuted}`}>{evts.length} event{evts.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1.5 ml-2">
                      {evts.map(e => renderCalEvent(e))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Calendar Event DAG Journey Morph */}
      <div className={`transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] flex-1 min-h-0 overflow-y-auto p-6 ${selectedEvent && !selectedPO ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
        {selectedEvent && evtSm && (
          <div className="space-y-4">
            {/* Journey header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <EvtTypeIcon className={`h-4 w-4 ${isDark ? evtSm.darkColor : evtSm.color}`} />
                  <h2 className={`text-sm font-semibold ${t.textPrimary}`}>{selectedEvent.title}</h2>
                  <Badge variant="outline" className={`text-[10px] border ${isDark ? evtSm.darkBg : evtSm.bg}`}>
                    <EvtStatusIcon className="h-2.5 w-2.5 mr-0.5" />{evtSm.label}
                  </Badge>
                  {selectedEvent.venues && <VenueChips venues={selectedEvent.venues} isDark={isDark} />}
                </div>
                <p className={`text-[10px] mt-1 ${t.textMuted}`}>
                  {friendlyDate(selectedEvent.date)}
                  {selectedEvent.time ? ` at ${selectedEvent.time}` : ''}
                  {selectedEvent.supplier ? ` · ${selectedEvent.supplier}` : ''}
                  {selectedEvent.poRef ? ` · ${selectedEvent.poRef}` : ''}
                </p>
              </div>
              <button onClick={() => setSelectedEvent(null)}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-[#f4f6f0]'}`}>
                &larr; Calendar
              </button>
            </div>

            {/* Amount + contextual actions */}
            <div className={`${t.cardPanel} space-y-4`}>
              <div className="flex items-start justify-between">
                {selectedEvent.amount != null && (
                  <div>
                    <span className={`text-2xl font-bold ${t.textPrimary}`}>{fmtIdr(selectedEvent.amount)}</span>
                    {selectedEvent.amountUsd && (
                      <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>USD {selectedEvent.amountUsd.toLocaleString()} (locked)</p>
                    )}
                    <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                      {selectedEvent.type === 'payment' ? 'Payment due'
                        : selectedEvent.type === 'delivery' ? 'Order value'
                        : 'Estimated cost'}
                    </p>
                  </div>
                )}
                {selectedEvent.estimatedSaving != null && selectedEvent.estimatedSaving > 0 && (
                  <div className="text-right">
                    <span className="text-sm font-bold text-green-400">{fmtIdrShort(selectedEvent.estimatedSaving)}</span>
                    <p className={`text-[10px] ${t.textMuted}`}>potential saving</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleClearDeadline(selectedEvent)} className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700 text-white">
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {selectedEvent.type === 'payment' ? 'Approve Payment'
                    : selectedEvent.type === 'compliance' ? 'Sign & Submit'
                    : selectedEvent.type === 'delivery' ? 'Confirm Receipt'
                    : 'Mark Complete'}
                </Button>
                <Button variant="outline" className={`h-9 px-3 ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`}>
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" className={`h-9 px-3 ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`} title="Ask Atlas">
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* 5-Stage DAG */}
            <div className={t.cardPanel}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Journey — 5-Stage DAG</h3>
                <span className={`text-[10px] ${t.textMuted}`}>Stage {selectedEvent.dagStage + 1}/5</span>
              </div>
              <div>
                {DAG_STAGES.map((stage, idx) => {
                  const isFailed = idx === selectedEvent.failedStage;
                  const stageStatus = isFailed ? 'failed'
                    : idx < selectedEvent.dagStage  ? 'complete'
                    : idx === selectedEvent.dagStage ? 'active'
                    : 'pending';
                  const isExp = expandedDag.has(idx);
                  return (
                    <div key={idx}>
                      <button
                        onClick={() => { if (stage.agentStep) toggleDag(idx); }}
                        className={`w-full flex items-start gap-3 py-2 px-2 rounded-lg text-left transition-colors ${stage.agentStep ? 'cursor-pointer hover:bg-[#f4f6f0]/60' : 'cursor-default'}`}>
                        <div className="flex flex-col items-center pt-0.5">
                          <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isFailed          ? 'bg-red-500 border-red-500'
                            : stageStatus === 'complete' ? (isDark ? 'bg-green-500 border-green-500' : 'bg-green-600 border-green-600')
                            : stageStatus === 'active'   ? 'bg-[#87986a] border-[#87986a] animate-pulse'
                            : isDark ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-transparent'
                          }`}>
                            {stageStatus === 'complete' && <Check className="h-2 w-2 text-white" />}
                            {isFailed && <X className="h-2 w-2 text-white" />}
                          </div>
                          {idx < DAG_STAGES.length - 1 && (
                            <div className={`w-0.5 h-4 mt-0.5 ${isFailed ? 'bg-red-500/30' : stageStatus === 'complete' ? 'bg-green-500/50' : isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-medium ${
                              isFailed          ? (isDark ? 'text-red-400' : 'text-red-600')
                              : stageStatus === 'complete' ? (isDark ? 'text-green-400' : 'text-green-700')
                              : stageStatus === 'active'   ? t.textPrimary
                              : t.textMuted
                            }`}>{stage.label}</span>
                            {stageStatus === 'active' && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>In Progress</span>
                            )}
                            {isFailed && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'}`}>Failed</span>
                            )}
                            {stage.agentStep && (isExp
                              ? <ChevronUp className={`h-3 w-3 ${t.textMuted}`} />
                              : <ChevronDown className={`h-3 w-3 ${t.textMuted}`} />)}
                          </div>
                        </div>
                      </button>
                      {isExp && stage.agentStep && (
                        <div className={`ml-9 mb-2 p-2.5 rounded-lg text-[10px] leading-relaxed ${isDark ? 'bg-[#2a2a2a] text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
                          <Bot className="h-3 w-3 inline mr-1" />{stage.agentStep}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agent reasoning (mode-aware via AgentCTA) */}
            <AgentCTA
              isDark={isDark}
              variant="inline"
              className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-[#f4f6f0] border-[#e5e5e0]'}`}
              agentLabel={(() => {
                const id: FinnsAgentId =
                  selectedEvent.type === 'delivery'   ? 'A-05' :
                  selectedEvent.type === 'payment'    ? 'A-04' :
                  selectedEvent.type === 'compliance' ? 'A-03' :
                  selectedEvent.type === 'restock'    ? 'A-02' :
                  /* meeting */                         'A-01';
                return `${id} · ${AGENT_META[id].role}`;
              })()}
              reasoning={selectedEvent.agentReasoning}
              offModeMessage={`Use the date, supplier, and stage above to decide what to do. Agent narrative is hidden in Off mode — drive this from the calendar and the order workspace.`}
              autoExecutionNote={`The owning agent will keep this on track within policy. You only see this card because it needs your attention.`}
            />
          </div>
        )}
      </div>

      {/* ═══ PO WORKSPACE ═══ */}
      <div className={`transition-all duration-[380ms] flex-1 min-h-0 overflow-y-auto p-6 ${selectedPO ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
        {selectedPO && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Purchase Order Workspace</h2>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className={`text-xs ${t.textMuted}`}>{selectedPO.id} · {selectedPO.supplier} · {selectedPO.type}</span>
                  <VenueChips venues={selectedPO.venues} isDark={isDark} />
                </div>
              </div>
              <button onClick={() => setSelectedPoId(null)}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-[#f4f6f0]'}`}>
                ← Back
              </button>
            </div>
            <div className={`${t.cardPanel} space-y-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-2xl font-bold ${t.textPrimary}`}>{fmtIdr(selectedPO.amount)}</span>
                  {selectedPO.amountUsd && (
                    <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>USD {selectedPO.amountUsd.toLocaleString()} (FX locked)</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {(() => { const UI = URGENCY_ICON[selectedPO.urgency]; return (
                      <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${selectedPO.urgency === 'high' ? (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200') : selectedPO.urgency === 'medium' ? (isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200') : (isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-200')}`}>
                        <UI className="h-2.5 w-2.5" />{selectedPO.urgency} priority
                      </Badge>
                    ); })()}
                    <span className={`text-[10px] ${t.textMuted}`}>{selectedPO.why}</span>
                  </div>
                </div>
                {selectedPO.estimatedSaving > 0 && (
                  <div className="text-right">
                    <span className="text-sm font-bold text-green-400">{fmtIdrShort(selectedPO.estimatedSaving)}</span>
                    <p className={`text-[10px] ${t.textMuted}`}>estimated saving</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handlePoApprove(selectedPO.id)} className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700 text-white">
                  <ThumbsUp className="h-3.5 w-3.5 mr-1.5" /> Approve
                </Button>
                <Button variant="outline" className={`flex-1 h-9 text-xs ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`}>
                  <ThumbsDown className="h-3.5 w-3.5 mr-1.5" /> Decline
                </Button>
                <Button variant="outline" className={`h-9 px-3 ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>LIVE AGENT NEGOTIATION LOG</span>
              </div>
              <div className={`${t.cardPanel} space-y-2.5`}>
                {selectedPO.negotiationLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold mt-0.5 ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>{entry.agent}</div>
                    <p className={`text-[10px] leading-snug ${t.textPrimary}`}>{entry.text}</p>
                  </div>
                ))}
                <div className={`flex items-center gap-2 pt-1 border-t ${t.border}`}>
                  <div className="flex gap-0.5">
                    {[0, 150, 300].map(d => <div key={d} className="w-1 h-1 rounded-full bg-[#87986a] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                  <span className={`text-[10px] ${t.textMuted}`}>Agents still working on your behalf...</span>
                </div>
              </div>
            </div>
            <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className={`h-3.5 w-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Menu Engineering Insight</span>
              </div>
              <p className={`text-xs leading-relaxed ${t.textPrimary}`}>
                Wagyu market hit a +6% spike last week. Stake's Wagyu tasting menu hits the 32% food cost target only if Beef Wellington (Day 3) swaps to a beef shin braise — saves Rp 2.1jt this weekend at the same margin.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes floatUp {
          0%   { opacity:1; transform:translateX(-50%) translateY(0); }
          70%  { opacity:1; transform:translateX(-50%) translateY(-24px); }
          100% { opacity:0; transform:translateX(-50%) translateY(-40px); }
        }
        @keyframes deadlineCleared {
          0%   { background:rgba(251,191,36,0.12); transform:scale(1);    box-shadow:none; }
          35%  { background:rgba(251,191,36,0.38); transform:scale(1.025); box-shadow:0 0 22px rgba(251,191,36,0.35); }
          100% { background:rgba(251,191,36,0);    transform:scale(0.93); opacity:0; }
        }
      `}</style>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // RIGHT PANEL — Atlas
  // ══════════════════════════════════════════════════════════════════
  const currentPulse = LIVE_PULSES[pulseIdx];
  const currentPulseMeta = AGENT_META[currentPulse.agentId];

  const rightPanel = (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`p-4 border-b ${t.border}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <Sparkles className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
          <span className={`text-sm font-semibold ${t.textPrimary}`}>Atlas</span>
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
        <p className={`text-xs ${t.textMuted}`}>
          {selectedEvent ? `Analyzing: ${selectedEvent.title}` : selectedPO ? `Analyzing ${selectedPO.id}` : 'Operations copilot · Always on'}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* TEMPORAL ALERTS — calendar mode */}
        {centerMode === 'calendar' && !selectedEvent && (
          <div className={`p-4 border-b ${t.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>TEMPORAL ALERTS — NEXT 7 DAYS</span>
            </div>
            <div className="space-y-2">
              {TEMPORAL_ALERTS.map(alert => {
                const meta = AGENT_META[alert.agentId];
                const severityStyle = alert.severity === 'high'
                  ? { bg: isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200', textH: isDark ? 'text-red-400' : 'text-red-700', icon: isDark ? 'text-red-400' : 'text-red-600' }
                  : alert.severity === 'medium'
                  ? { bg: isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200', textH: isDark ? 'text-amber-400' : 'text-amber-700', icon: isDark ? 'text-amber-400' : 'text-amber-600' }
                  : { bg: isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200', textH: isDark ? 'text-blue-400' : 'text-blue-700', icon: isDark ? 'text-blue-400' : 'text-blue-600' };
                return (
                  <div key={alert.id} className={`p-2.5 rounded-lg border ${severityStyle.bg}`}>
                    <div className="flex items-start gap-1.5 mb-1">
                      <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${severityStyle.icon}`} />
                      <span className={`text-[10px] font-semibold leading-tight ${severityStyle.textH}`}>{alert.title}</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${t.textSecondary}`}>{alert.detail}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[9px] ${t.textMuted}`}>{alert.agentId} {meta.role}</span>
                      {alert.saving > 0 && <span className="text-[9px] font-semibold text-green-400">Save {fmtIdrShort(alert.saving)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SAVINGS IN CALENDAR */}
        {centerMode === 'calendar' && !selectedEvent && (
          <div className={`p-4 border-b ${t.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>SAVINGS IN CALENDAR</span>
            </div>
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/10 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className={`text-[10px] ${t.textMuted}`}>Available potential</span>
                <span className={`text-base font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{fmtIdrShort(CAL_SAVINGS.total)}</span>
              </div>
              <div className="space-y-1.5">
                {CAL_SAVINGS.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className={`text-[10px] ${t.textSecondary}`}>{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] ${t.textMuted}`}>{item.agentId}</span>
                      <span className={`text-[10px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{fmtIdrShort(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className={`text-[9px] mt-2.5 leading-snug italic ${t.textMuted}`}>
                Spend Watchdog (A-04) scans continuously for early-payment windows and FX lock opportunities.
              </p>
            </div>
          </div>
        )}

        {/* Live agent activity */}
        <div className={`p-4 border-b ${t.border}`}>
          <div className="flex items-center gap-2 mb-2">
            <Activity className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>LIVE AGENT ACTIVITY</span>
          </div>
          <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#87986a]/5 border-[#87986a]/15' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 shrink-0">
                {[0, 150, 300].map(d => <div key={d} className="w-1 h-1 rounded-full bg-[#87986a] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
              <div>
                <span className={`text-[10px] font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{currentPulse.agentId} {currentPulseMeta.role}</span>
                <p className={`text-[10px] ${t.textMuted}`}>{currentPulse.text}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Context-aware questions */}
        <div className={`p-4 border-b ${t.border}`}>
          <h3 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>
            {selectedEvent ? `INSIGHTS: ${selectedEvent.title.slice(0, 22).toUpperCase()}` : selectedPO ? `INSIGHTS FOR ${selectedPO.id}` : 'ASK ATLAS'}
          </h3>
          <div className="space-y-1.5">
            {currentQuestions.map((q, i) => (
              <button key={i}
                onClick={() => {
                  setChatMessages(prev => [...prev, { from: 'user', text: q }]);
                  const resp = selectedEvent ? selectedEvent.agentReasoning : "I'm analyzing the data now — recommendation incoming.";
                  setTimeout(() => setChatMessages(prev => [...prev, { from: 'atlas', text: resp }]), 800);
                }}
                className={`w-full text-left text-[10px] px-2.5 py-2 rounded-lg border transition-colors ${isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800 text-gray-300' : 'bg-white border-[#e5e5e0] hover:bg-[#f4f6f0] text-gray-700'}`}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Autonomous actions today */}
        <div className={`p-4 border-b ${t.border}`}>
          <div className="flex items-center gap-2 mb-3">
            <Bot className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>AUTONOMOUS ACTIONS TODAY</span>
            <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>{AI_ACTIONS.length}</span>
          </div>
          <div className="space-y-2.5">
            {AI_ACTIONS.map((action, i) => {
              const meta = AGENT_META[action.agentId];
              const AIcon = meta.icon;
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                    <AIcon className={`h-3 w-3 ${isDark ? meta.darkColor : meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] leading-snug ${t.textPrimary}`}>{action.action}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-medium ${isDark ? meta.darkColor : meta.color}`}>{action.agentId} {meta.role}</span>
                      <span className={`text-[9px] ${t.textMuted}`}>{action.time}</span>
                      {action.saving && <span className="text-[9px] text-green-400">+{fmtIdrShort(action.saving)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Autonomy goal */}
        <div className={`p-4 border-b ${t.border}`}>
          <div className="flex items-center gap-2 mb-3">
            <Activity className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>AUTONOMY GOAL</span>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-semibold ${t.textPrimary}`}>{AUTONOMY.category} category</span>
            <span className={`text-[10px] font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{AUTONOMY.progress}%</span>
          </div>
          <div className={`h-1.5 rounded-full ${t.progressTrack} mb-2`}>
            <div className="h-1.5 rounded-full bg-[#87986a] transition-all duration-700" style={{ width: `${AUTONOMY.progress}%` }} />
          </div>
          <p className={`text-[10px] leading-snug ${t.textMuted}`}>
            <span className={`font-semibold ${t.textPrimary}`}>{AUTONOMY.remaining} more approvals</span> until Sourcing Agent (A-01) unlocks higher autonomy for <span className={`font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{AUTONOMY.category}</span>.
          </p>
        </div>

        {/* ROI */}
        <div className={`p-4 border-b ${t.border}`}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>THIS WEEK'S IMPACT</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] ${t.textMuted}`}>Manual steps eliminated</span>
              <span className={`text-xs font-semibold ${t.textPrimary}`}>{ROI.manualTouches}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] ${t.textMuted}`}>Labor hours saved</span>
              <span className={`text-xs font-semibold ${t.textPrimary}`}>{ROI.hoursSaved}h</span>
            </div>
            <div className={`flex items-center justify-between pt-1.5 border-t ${t.border}`}>
              <span className={`text-[10px] font-medium ${t.textPrimary}`}>Working capital freed</span>
              <span className="text-xs font-bold text-green-400">{fmtIdrShort(ROI.capitalFreed)}</span>
            </div>
          </div>
          <p className={`text-[9px] mt-2 italic ${t.textMuted}`}>The system is making you money — not just saving time.</p>
        </div>

        {/* Chat log */}
        <div className="p-4 space-y-2">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] px-3 py-2 rounded-xl text-[10px] leading-snug ${msg.from === 'user' ? (isDark ? 'bg-[#87986a] text-white' : 'bg-[#6b7a54] text-white') : (isDark ? 'bg-[#2a2a2a] text-gray-300 border border-gray-800' : 'bg-gray-100 text-gray-700')}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat input */}
      <div className={`p-3 border-t ${t.border}`}>
        <div className="flex gap-2">
          <Input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()}
            placeholder="Ask Atlas anything..."
            className={`flex-1 h-8 text-xs ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : ''}`} />
          <Button onClick={handleChat} size="sm" className="h-8 w-8 p-0 bg-[#87986a] hover:bg-[#6b7a54] text-white">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ThreePanelLayout isDark={isDark} left={leftPanel} center={centerPanel} right={rightPanel} />
  );
}
