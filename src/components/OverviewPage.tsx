import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DollarSign, Package, AlertTriangle, TrendingUp, TrendingDown,
  CheckCircle, Zap, Bot, ThumbsUp, ThumbsDown,
  ChevronRight, Sparkles, Send, Activity, Shield, Eye,
  Brain, Radar, Scale, Info, Check, Clock, Calendar,
  BarChart3, Truck, FileText, CreditCard,
  MessageCircle, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ThreePanelLayout } from './layout/ThreePanelLayout';
import { theme as themeTokens } from '../lib/theme';

interface OverviewPageProps {
  theme: 'dark' | 'light';
}

// ── Agent classes ──────────────────────────────────────────────────────
type AgentClass = 'Sensing' | 'Reasoning' | 'Execution' | 'Governance';
const AGENT_CLASS_META: Record<AgentClass, { icon: typeof Zap; color: string; darkColor: string }> = {
  Sensing:    { icon: Radar,  color: 'text-blue-600',   darkColor: 'text-blue-400'   },
  Reasoning:  { icon: Brain,  color: 'text-purple-600', darkColor: 'text-purple-400' },
  Execution:  { icon: Zap,    color: 'text-green-600',  darkColor: 'text-green-400'  },
  Governance: { icon: Scale,  color: 'text-amber-600',  darkColor: 'text-amber-400'  },
};

// ── Triage / PO data ───────────────────────────────────────────────────
const METRICS = [
  { label: "Month's Spend", value: '$47,820', change: -8.2, icon: DollarSign, detail: 'vs $52,080 last month' },
  { label: 'Active Orders', value: '23',      change: 12,   icon: Package,    detail: '5 arriving today'      },
  { label: 'Low Stock',     value: '4',       change: 0,    icon: AlertTriangle, detail: '2 auto-reorders sent' },
  { label: 'AI Savings',    value: '$3,075',  change: 0,    icon: Zap,        detail: '12 actions today'      },
];

type Urgency = 'high' | 'medium' | 'low';
const URGENCY_ICON: Record<Urgency, typeof Zap> = { high: Zap, medium: AlertTriangle, low: Info };

const CRITICAL_ACTIONS = [
  {
    id: 'PO-2847', supplier: 'PT Maju Bersama', amount: 12400,
    type: 'High-Value PO', urgency: 'high' as Urgency,
    why: 'New supplier — first order over $10k threshold',
    aiReasoning: 'I matched this against 5 vendors. PT Maju is your best choice for reliability (98%) but a shared purchase pool could save an additional 15% if you wait 2 days. Price is locked for 4 more hours.',
    estimatedSaving: 1120,
    contextQuestions: [
      'Why is PT Maju 8% below the market average?',
      "What's the shared purchase pool window closing time?",
      'Compare this to the last 5 similar orders',
    ],
    negotiationLog: [
      { agent: '#5 (Sourcing)',  text: 'Queried 8 vendors for 500kg Jasmine Rice' },
      { agent: '#6 (Pricing)',   text: 'Received 5 quotes — PT Maju lowest at $12,400' },
      { agent: '#6 (Pricing)',   text: 'Counter-offered $11,800 — PT Maju declined' },
      { agent: '#26 (Forecast)', text: 'Price lock window: 4h remaining before expiry' },
    ],
  },
  {
    id: 'PO-2851', supplier: 'Thai Fresh Co', amount: 3200,
    type: 'Rush Order', urgency: 'high' as Urgency,
    why: 'Client #4021 needs Friday delivery',
    aiReasoning: "Rush route available via Bangkok hub. Approving now locks the 3-day window. Waiting 24h adds $180 in express freight. I've pre-confirmed availability with Thai Fresh.",
    estimatedSaving: 240,
    contextQuestions: [
      "What's the cost if we miss the Friday window?",
      'Are there alternative rush routes available?',
      "Show Client #4021's order history",
    ],
    negotiationLog: [
      { agent: '#5 (Sourcing)',   text: 'Confirmed stock availability at Thai Fresh Bangkok' },
      { agent: '#6 (Pricing)',    text: 'Express route locked — window closes in 18h' },
      { agent: '#12 (Logistics)', text: 'ETA: Thursday 6pm via Bangkok-Singapore hub' },
    ],
  },
  {
    id: 'PO-2855', supplier: 'AUS Meats Pty', amount: 8900,
    type: 'New Supplier Trial', urgency: 'medium' as Urgency,
    why: 'Scored 88/100 — trial order with quality hold clause',
    aiReasoning: 'New vendor passed all vetting checks. Quality hold clause limits your exposure to $8,900. If quality passes, they can replace Indo Seafood at 11% lower ongoing cost on protein.',
    estimatedSaving: 680,
    contextQuestions: [
      'Why is AUS Meats 12% cheaper than our regular supplier?',
      'What happens if the quality hold clause triggers?',
      'Show outcomes from similar trial orders',
    ],
    negotiationLog: [
      { agent: '#5 (Sourcing)',    text: 'Identified AUS Meats via APAC Supplier Network' },
      { agent: '#33 (Compliance)', text: 'Vetting passed — certifications verified' },
      { agent: '#6 (Pricing)',     text: 'Price benchmarked: 12% below Indo Seafood avg' },
    ],
  },
];

const SYSTEM_ALERTS = [
  { id: 'a1', icon: AlertTriangle, label: 'Lamb Rack at 12% — auto-reorder queued', severity: 'warning' as const, canQuickApprove: true,  saving: 85 },
  { id: 'a2', icon: Shield,        label: 'Vietnam import cert expires in 5 days',   severity: 'warning' as const, canQuickApprove: false, saving: 0  },
  { id: 'a3', icon: TrendingDown,  label: 'VN Supply reliability score fell to 82',  severity: 'info'    as const, canQuickApprove: false, saving: 0  },
];

const AI_ACTIONS: { time: string; action: string; agent: string; agentClass: AgentClass; saving: number | null }[] = [
  { time: '2m ago',  action: 'Auto-ordered 500kg rice from PT Maju Bersama',     agent: '#14', agentClass: 'Execution',  saving: 240  },
  { time: '18m ago', action: 'Rejected VN Supply quote — 15% above market rate', agent: '#6',  agentClass: 'Reasoning',  saving: 1200 },
  { time: '45m ago', action: 'Joined shared purchase pool for cooking oil',       agent: '#14', agentClass: 'Execution',  saving: 680  },
  { time: '1h ago',  action: 'Updated demand forecast for seafood category',      agent: '#26', agentClass: 'Sensing',    saving: null },
  { time: '2h ago',  action: 'Generated import compliance docs for Indonesia',    agent: '#33', agentClass: 'Governance', saving: null },
  { time: '3h ago',  action: 'Auto-ordered cleaning supplies — below threshold',  agent: '#14', agentClass: 'Execution',  saving: 85   },
];

const LIVE_PULSES = [
  { agent: '#6 (Pricing)',     text: 'Analyzing 14 quotes for PO-2855...'        },
  { agent: '#26 (Forecast)',   text: 'Updating protein demand model...'           },
  { agent: '#5 (Sourcing)',    text: 'Scanning 3 new vendor listings...'          },
  { agent: '#33 (Compliance)', text: 'Verifying Indonesia import cert...'         },
];

const SPEND_TREND = Array.from({ length: 12 }, (_, i) => {
  const base = 38000 + Math.sin(i / 2) * 8000 + i * 400;
  const isPred = i >= 10;
  return {
    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    spend:     isPred ? null : Math.round(base + 2000),
    predicted: isPred ? Math.round(base + 3000) : null,
    predHigh:  isPred ? Math.round(base + 6000) : null,
    predLow:   isPred ? Math.round(base - 2000) : null,
  };
});

const AUTONOMY = { current: 3, next: 4, progress: 72, remaining: 8, label: 'Semi-Autonomous', category: 'Seafood' };
const ROI = { manualTouches: 14, hoursSaved: 3.5, capitalFreed: 4200 };

const DEFAULT_QUESTIONS = [
  'What needs my attention most urgently?',
  'Run a buy-vs-make analysis for PO-2847',
  "What's blocking the Level 4 autonomy upgrade?",
];

// ══════════════════════════════════════════════════════════════════════
// CALENDAR DATA
// ══════════════════════════════════════════════════════════════════════
type CalEventStatus = 'pending' | 'in-transit' | 'action-needed' | 'completed' | 'overdue';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:MM display
  type: 'delivery' | 'payment' | 'compliance' | 'restock' | 'meeting';
  status: CalEventStatus;
  supplier?: string;
  amount?: number;
  poRef?: string;
  agentReasoning: string;
  estimatedSaving?: number;
  dagStage: number;   // 0-11
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

// Today = April 10 2026 (matches project date)
const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'EVT-001', title: 'Lamb Rack Delivery', date: '2026-04-11', time: '14:00',
    type: 'delivery', status: 'in-transit', supplier: 'AUS Meats Pty', amount: 12400, poRef: 'PO-2847',
    agentReasoning: 'Agent #7 (Logistics) tracking GPS — cold-chain intact. Arrival confirmed for 2PM tomorrow. Agent #9 (Quality) will run inspection on arrival.',
    estimatedSaving: 420, dagStage: 9,
  },
  {
    id: 'EVT-002', title: 'Tiger Prawn Arrival', date: '2026-04-12', time: '08:00',
    type: 'delivery', status: 'pending', supplier: 'Indo Seafood Corp', amount: 4650, poRef: 'PO-2839',
    agentReasoning: 'Agent #12 (Logistics) confirmed port slot. Monsoon delay risk +6h but backup cold storage secured by Agent #7.',
    estimatedSaving: 520, dagStage: 10,
  },
  {
    id: 'EVT-003', title: 'Pay Thai Fresh Co', date: '2026-04-12', time: '17:00',
    type: 'payment', status: 'action-needed', supplier: 'Thai Fresh Co', amount: 3200, poRef: 'PO-2851',
    agentReasoning: 'Agent #28 (Payments) detected a 2% early-payment discount window closing today at 5PM. Paying now saves Rp 640K vs net-30 terms. Funds are available.',
    estimatedSaving: 640, dagStage: 7,
  },
  {
    id: 'EVT-004', title: 'Salmon Fillet Restock', date: '2026-04-12', time: '16:00',
    type: 'restock', status: 'action-needed', supplier: 'Oceanic Harvest', amount: 2800,
    agentReasoning: 'Agent #13 (Supplier Comms) failed to reach Nordic Fish Co after 3 retries. Fallback PO routed to Oceanic Harvest. Manual confirmation required before dispatch.',
    dagStage: 4, failedStage: 2,
  },
  {
    id: 'EVT-005', title: 'Indonesia Import Cert Renewal', date: '2026-04-14',
    type: 'compliance', status: 'pending',
    agentReasoning: 'Agent #33 (Compliance) has pre-filled renewal forms. Requires your digital signature. Expiry in 5 days — auto-escalation triggers at 48h.',
    dagStage: 6,
  },
  {
    id: 'EVT-006', title: 'Beef Tenderloin Delivery', date: '2026-04-13', time: '10:00',
    type: 'delivery', status: 'pending', supplier: 'PT Sumber Daging', amount: 8900, poRef: 'PO-2855',
    agentReasoning: 'Agent #14 locked current rate before forecast 5% increase. Quality hold clause active — Agent #9 will verify on arrival.',
    estimatedSaving: 380, dagStage: 8,
  },
  {
    id: 'EVT-007', title: 'Cooking Oil Group Buy Window', date: '2026-04-11', time: '23:59',
    type: 'payment', status: 'action-needed', amount: 1800,
    agentReasoning: 'Agent #14 (Execution) joined shared purchase pool with 3 restaurants. Window closes tonight. Confirming now locks 12% volume discount — saves Rp 216K.',
    estimatedSaving: 216, dagStage: 4,
  },
  {
    id: 'EVT-008', title: 'Chicken Breast PO Decision', date: '2026-04-11', time: '20:00',
    type: 'restock', status: 'pending', supplier: 'PT Maju Bersama', amount: 2080,
    agentReasoning: 'Agent #8 holding PO — Agent #14 negotiating group buy with 3 nearby restaurants for 12% volume discount. Decision expected tonight at 8PM.',
    estimatedSaving: 290, dagStage: 3,
  },
  {
    id: 'EVT-009', title: 'Seafood Quality Audit', date: '2026-04-15',
    type: 'compliance', status: 'pending',
    agentReasoning: 'Agent #33 scheduling routine quality audit for all seafood suppliers. Pre-audit checklist generated. Requires your sign-off to confirm scope.',
    dagStage: 1,
  },
  {
    id: 'EVT-010', title: 'Rice Delivery — PT Maju', date: '2026-04-10', time: '11:00',
    type: 'delivery', status: 'completed', supplier: 'PT Maju Bersama', amount: 3500, poRef: 'PO-2840',
    agentReasoning: 'Delivered and verified. Agent #9 QC passed — quality score 94/100. Inventory updated. Volume discount saved Rp 240K vs spot price.',
    estimatedSaving: 240, dagStage: 11,
  },
  {
    id: 'EVT-011', title: 'Bell Pepper Pre-Order', date: '2026-04-10', time: '15:00',
    type: 'restock', status: 'completed', supplier: 'Bali Fresh Farms', amount: 960,
    agentReasoning: 'Pre-order for Friday menu launch confirmed. Same-day delivery slot locked. Agent #25 POS reports 3x demand increase expected.',
    estimatedSaving: 90, dagStage: 11,
  },
  {
    id: 'EVT-012', title: 'VN Supply Invoice Overdue', date: '2026-04-08',
    type: 'payment', status: 'overdue', supplier: 'VN Supply Co', amount: 5400,
    agentReasoning: 'Agent #28 flagged: Invoice 48h past net-30 terms. Late fee of 1.5% accruing daily. Agent #13 sent 2 follow-up reminders — manual escalation recommended.',
    dagStage: 8,
  },
  {
    id: 'EVT-013', title: 'Herb Supplier Meeting', date: '2026-04-16', time: '10:00',
    type: 'meeting', status: 'pending', supplier: 'Bali Fresh Farms',
    agentReasoning: 'Agent #5 (Sourcing) arranged quarterly review. Topics: seasonal pricing lock for Q3, new organic herb line, delivery frequency adjustment.',
    dagStage: 0,
  },
  {
    id: 'EVT-014', title: 'Coconut Milk Bulk Restock', date: '2026-04-17',
    type: 'restock', status: 'pending', amount: 1275,
    agentReasoning: 'Agent #8 scheduled routine restock. Consumption trend up 8% — Agent #26 recommends increasing par from 25 to 30 cans to buffer demand.',
    estimatedSaving: 70, dagStage: 2,
  },
];

// ── 12-Stage DAG Kernel ──────────────────────────────────────────────
const DAG_STAGES: { label: string; agentStep?: string }[] = [
  { label: 'Demand Forecast',      agentStep: 'Agent #25 (POS Intelligence) calculated 7-day consumption velocity from live sales data' },
  { label: 'Par Level Check',      agentStep: 'Agent #8 (Restock) detected depletion below par threshold' },
  { label: 'Supplier Match',       agentStep: 'Agent #21 (Market Intel) cross-referenced suppliers against price + reliability' },
  { label: 'Price Lock',           agentStep: 'Agent #14 (Pricing) locked volume discount' },
  { label: 'PO Generated',         agentStep: 'Agent #1 (PO Engine) generated PO with quality hold clause' },
  { label: 'ERP Sync',             agentStep: 'Agent #14 (ERP) synced inventory reservation to accounting ledger' },
  { label: 'Compliance Check',     agentStep: 'Agent #22 (Compliance) verified certifications + PPN tax calculation' },
  { label: 'Payment Queued',       agentStep: 'Agent #28 (Payments) queued payment with governance rules applied' },
  { label: 'Dispatched',           agentStep: 'Agent #12 (Logistics) confirmed dispatch from supplier warehouse' },
  { label: 'In Transit',           agentStep: 'Agent #7 (Logistics) monitoring GPS + cold-chain temperature sensors' },
  { label: 'Regional Hub',         agentStep: 'Agent #7 confirmed cold-chain integrity at regional hub' },
  { label: 'Delivered & Verified', agentStep: 'Agent #9 (Quality) ran QC inspection against specs' },
];

// ── Temporal Alerts ──────────────────────────────────────────────────
const TEMPORAL_ALERTS: {
  id: string; severity: 'high' | 'medium' | 'low';
  title: string; detail: string; agent: string; saving: number;
}[] = [
  {
    id: 'ta-1', severity: 'high',
    title: 'Cash-Flow Crunch — Apr 12–13',
    detail: '3 payments totaling $15.8K due in 48h. Agent #28 recommends: pay Thai Fresh today (2% discount saves $640), defer Oceanic Harvest to net-15.',
    agent: '#28 (Payments)', saving: 640,
  },
  {
    id: 'ta-2', severity: 'medium',
    title: 'Logistics Bottleneck — Apr 12',
    detail: '2 deliveries + 1 payment converge Saturday. Port monsoon delay risk could shift Tiger Prawn to Sunday — breaking cold-chain continuity.',
    agent: '#7 (Logistics)', saving: 0,
  },
  {
    id: 'ta-3', severity: 'low',
    title: 'Compliance Window Closing',
    detail: 'Indonesia import cert expires Apr 14. If missed, all Indo Seafood orders pause 5–7 business days. Agent #33 has pre-filled renewal — needs signature only.',
    agent: '#33 (Compliance)', saving: 0,
  },
];

const CAL_SAVINGS = {
  total: 2596,
  items: [
    { label: 'Early-payment discounts', amount: 640,  agent: '#28' },
    { label: 'Group buy volume locks',  amount: 506,  agent: '#14' },
    { label: 'Pre-locked price windows', amount: 1450, agent: '#6'  },
  ],
};

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
  const [selectedPoId, setSelectedPoId]  = useState<string | null>(null);
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
        `Why is "${selectedEvent.title}" at stage ${selectedEvent.dagStage + 1}/12?`,
        `What are the risks for this ${selectedEvent.type}?`,
        `Show alternatives for ${selectedEvent.supplier ?? 'this event'}`,
      ]
    : selectedPO
    ? selectedPO.contextQuestions
    : DEFAULT_QUESTIONS;

  // ── Calendar date helpers ──────────────────────────────────────────
  // Project date: April 10 2026
  const TODAY = useMemo(() => new Date(2026, 3, 10), []);

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
      setSavingFloat(`Saved $${po.estimatedSaving.toLocaleString()}`);
      setTimeout(() => setSavingFloat(null), 2400);
    }
    setTimeout(() => {
      setApprovedIds(prev => new Set([...prev, id]));
      setFlyOutId(null);
      setSelectedPoId(null);
      if (po) setChatMessages(prev => [...prev, { from: 'atlas', text: `${id} submitted. $${po.estimatedSaving.toLocaleString()} saving estimated — pending vendor acknowledgement. I'll surface the vendor's ack and confirm the realised saving once the PO is accepted.` }]);
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
    if (saving > 0) { setSavingFloat(`Saved $${saving}`); setTimeout(() => setSavingFloat(null), 2400); }
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
      setSavingFloat(`Deadline Cleared — Saved $${saving}`);
      setTimeout(() => setSavingFloat(null), 2800);
    }
    setTimeout(() => {
      setClearedIds(prev => new Set([...prev, evt.id]));
      setClearingId(null);
      setSelectedEvent(null);
      setDailySavings(prev => prev + saving);
      setChatMessages(prev => [...prev, {
        from: 'atlas',
        text: `${evt.title} cleared. ${saving > 0 ? `$${saving} saving estimated — pending downstream confirmation (payment / compliance / receipt depending on event type).` : 'Status updated across all systems.'}`,
      }]);
    }, 850);
  }, []);

  const toggleDag = useCallback((idx: number) => {
    setExpandedDag(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  }, []);

  // Pre-compute selected event metadata (avoids IIFE in JSX)
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
            </div>
            {!compact && (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {evt.time && <span className={`text-[9px] ${t.textMuted}`}>{evt.time}</span>}
                {evt.supplier && <span className={`text-[9px] ${t.textMuted}`}>· {evt.supplier}</span>}
                {evt.amount != null && (
                  <span className={`text-[9px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                    ${evt.amount.toLocaleString()}
                  </span>
                )}
                {evt.estimatedSaving != null && (
                  <span className="text-[9px] text-green-500">saves ${evt.estimatedSaving}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hover micro-actions: Rule of Three */}
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
                    </div>
                    <ChevronRight className={`h-3 w-3 ${isSelected ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textMuted}`} />
                  </div>
                  <p className={`text-[10px] leading-snug mt-0.5 ${t.textMuted}`}>{item.why}</p>
                  <span className={`text-xs font-semibold mt-1.5 block ${t.textPrimary}`}>${item.amount.toLocaleString()}</span>
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

      {/* ── Mode toggle header (hidden when PO workspace or DAG journey open) ── */}
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
                  Daily Savings: ${dailySavings}
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
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>AI forecast: Nov–Dec</span>
            </div>
            <p className={`text-xs mb-4 ${t.textMuted}`}>Shaded zone = Agent #26 confidence band</p>
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
                    <YAxis tick={{ fontSize: 10, fill: isDark ? '#777' : '#999' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ background: isDark ? '#2a2a2a' : '#fff', border: isDark ? '1px solid #333' : '1px solid #e5e5e0', borderRadius: 8, fontSize: 11, color: isDark ? '#fff' : '#111' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'predHigh' || name === 'predLow') return [null, null];
                        return [`$${value?.toLocaleString() ?? '—'}`, name === 'spend' ? 'Actual' : 'Forecast'];
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
            <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Logistics Calendar — April 2026</h2>
            <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
              {CALENDAR_EVENTS.filter(e => !clearedIds.has(e.id) && (e.status === 'action-needed' || e.status === 'overdue')).length} items need action
            </p>
          </div>
        </div>

        {/* Calendar scroll area */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── MONTH VIEW ── Progressive Disclosure: dot counts only */}
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
                          {/* Status dots only — progressive disclosure */}
                          <div className="flex flex-wrap gap-1">
                            {evts.slice(0, 4).map(evt => {
                              const sm = STATUS_META[evt.status];
                              return (
                                <button key={evt.id} onClick={() => handleEventClick(evt)}
                                  title={evt.title}
                                  className={`w-2 h-2 rounded-full transition-transform hover:scale-[2] ${
                                    evt.status === 'overdue'       ? 'bg-red-500'    :
                                    evt.status === 'action-needed' ? 'bg-amber-400'  :
                                    evt.status === 'in-transit'    ? 'bg-purple-400' :
                                    evt.status === 'completed'     ? 'bg-green-500'  : 'bg-blue-400'
                                  }`} />
                              );
                            })}
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

          {/* ── WEEK VIEW ── Full event cards with generous padding */}
          {calView === 'week' && (
            <div className="space-y-1.5">
              {weekDays.map(date => {
                const evts    = eventsFor(date);
                const todayRow = isToday(date);
                return (
                  <div key={date.toISOString()}
                    className={`rounded-xl border p-4 ${todayRow ? (isDark ? 'bg-[#87986a]/5 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]') : (isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]')}`}>
                    <div className="flex items-start gap-5">
                      {/* Date column — Meaningful Space */}
                      <div className="w-12 shrink-0 text-center pt-0.5">
                        <div className={`text-[10px] font-medium ${t.textMuted}`}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div className={`text-xl font-bold mt-0.5 leading-none ${todayRow ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textPrimary}`}>
                          {date.getDate()}
                        </div>
                        {todayRow && <div className={`text-[8px] font-bold uppercase mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Today</div>}
                      </div>
                      {/* Events */}
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

          {/* ── AGENDA VIEW ── Grouped by date with date dividers */}
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
                      <span className={`text-xs font-semibold ${ds === '2026-04-10' ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textPrimary}`}>
                        {friendlyDate(ds)}
                      </span>
                      {ds === '2026-04-10' && (
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
                    <span className={`text-2xl font-bold ${t.textPrimary}`}>${selectedEvent.amount.toLocaleString()}</span>
                    <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                      {selectedEvent.type === 'payment' ? 'Payment due'
                        : selectedEvent.type === 'delivery' ? 'Order value'
                        : 'Estimated cost'}
                    </p>
                  </div>
                )}
                {selectedEvent.estimatedSaving != null && (
                  <div className="text-right">
                    <span className="text-sm font-bold text-green-400">${selectedEvent.estimatedSaving.toLocaleString()}</span>
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

            {/* 12-Stage DAG Kernel */}
            <div className={t.cardPanel}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Journey — DAG Kernel</h3>
                <span className={`text-[10px] ${t.textMuted}`}>Stage {selectedEvent.dagStage + 1}/12</span>
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

            {/* Agent reasoning */}
            <div className={`p-3.5 rounded-xl border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-[#f4f6f0] border-[#e5e5e0]'}`}>
              <div className="flex items-start gap-2">
                <Bot className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <p className={`text-[10px] leading-relaxed ${t.textSecondary}`}>{selectedEvent.agentReasoning}</p>
              </div>
            </div>
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
                <p className={`text-xs ${t.textMuted}`}>{selectedPO.id} · {selectedPO.supplier} · {selectedPO.type}</p>
              </div>
              <button onClick={() => setSelectedPoId(null)}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-[#f4f6f0]'}`}>
                ← Back
              </button>
            </div>
            <div className={`${t.cardPanel} space-y-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-2xl font-bold ${t.textPrimary}`}>${selectedPO.amount.toLocaleString()}</span>
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
                    <span className="text-sm font-bold text-green-400">${selectedPO.estimatedSaving.toLocaleString()}</span>
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
                    <div className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold mt-0.5 ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>Agent {entry.agent}</div>
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
                Poultry prices rising 8% this week. Swapping <strong>Chicken Sate &rarr; Tuna Sate</strong> maintains your 32% food cost target and avoids a $2,100 overrun.
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
  // RIGHT PANEL — Atlas with Temporal Reasoning
  // ══════════════════════════════════════════════════════════════════
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

        {/* ── TEMPORAL ALERTS — shown when calendar mode is active ── */}
        {centerMode === 'calendar' && !selectedEvent && (
          <div className={`p-4 border-b ${t.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>TEMPORAL ALERTS — NEXT 7 DAYS</span>
            </div>
            <div className="space-y-2">
              {TEMPORAL_ALERTS.map(alert => {
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
                      <span className={`text-[9px] ${t.textMuted}`}>Agent {alert.agent}</span>
                      {alert.saving > 0 && <span className="text-[9px] font-semibold text-green-400">Save ${alert.saving}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ROI FORECAST IN CALENDAR — savings detected by agents ── */}
        {centerMode === 'calendar' && !selectedEvent && (
          <div className={`p-4 border-b ${t.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>SAVINGS IN CALENDAR</span>
            </div>
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/10 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className={`text-[10px] ${t.textMuted}`}>Available potential</span>
                <span className={`text-base font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>${CAL_SAVINGS.total.toLocaleString()}</span>
              </div>
              <div className="space-y-1.5">
                {CAL_SAVINGS.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className={`text-[10px] ${t.textSecondary}`}>{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] ${t.textMuted}`}>Agent {item.agent}</span>
                      <span className={`text-[10px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>${item.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className={`text-[9px] mt-2.5 leading-snug italic ${t.textMuted}`}>
                Agent #28 scans continuously for early-payment windows and volume lock opportunities.
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
                <span className={`text-[10px] font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Agent {LIVE_PULSES[pulseIdx].agent}</span>
                <p className={`text-[10px] ${t.textMuted}`}>{LIVE_PULSES[pulseIdx].text}</p>
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
              const meta = AGENT_CLASS_META[action.agentClass];
              const AIcon = meta.icon;
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-100'}`}>
                    <AIcon className={`h-3 w-3 ${isDark ? meta.darkColor : meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] leading-snug ${t.textPrimary}`}>{action.action}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-medium ${isDark ? meta.darkColor : meta.color}`}>{action.agent} {action.agentClass}</span>
                      <span className={`text-[9px] ${t.textMuted}`}>{action.time}</span>
                      {action.saving && <span className="text-[9px] text-green-400">+${action.saving}</span>}
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
            <span className={`text-xs font-semibold ${t.textPrimary}`}>Level {AUTONOMY.current} &rarr; {AUTONOMY.next}</span>
            <span className={`text-[10px] font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{AUTONOMY.progress}%</span>
          </div>
          <div className={`h-1.5 rounded-full ${t.progressTrack} mb-2`}>
            <div className="h-1.5 rounded-full bg-[#87986a] transition-all duration-700" style={{ width: `${AUTONOMY.progress}%` }} />
          </div>
          <p className={`text-[10px] leading-snug ${t.textMuted}`}>
            <span className={`font-semibold ${t.textPrimary}`}>{AUTONOMY.remaining} more approvals</span> until Level {AUTONOMY.next} ({AUTONOMY.label}) unlocks for <span className={`font-medium ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{AUTONOMY.category}</span>.
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
              <span className="text-xs font-bold text-green-400">${ROI.capitalFreed.toLocaleString()}</span>
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
