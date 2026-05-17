import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ShoppingCart, Search as SearchIcon, Users, XCircle, FileText, TrendingUp,
  Bot, DollarSign, Zap, CheckCircle, Shield, Scale, Activity,
  AlertTriangle, Undo2, Eye, Percent, Timer, Gauge,
  Beef, Fish, Apple, Wine, Archive, Package, Layers,
  ChevronUp, ChevronDown, RotateCcw, PauseCircle, PlayCircle,
  ExternalLink, Pencil, Hand, Check, X, Send,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { ThreePanelLayout } from './layout/ThreePanelLayout';
import { AUTONOMY_LABELS } from '../lib/types';
import type { AutonomyLevel } from '../lib/types';
import { theme as themeTokens } from '../lib/theme';
import { toast } from 'sonner@2.0.3';
import { useActionLog, type ActorType, type ActionLogEntry, logUserAction } from '../lib/actionLog';
import { useAutonomyMode, useAgentsPaused, setAgentsPaused } from '../lib/autonomy';
import { AgentCTA } from './AgentCTA';
import { finnsAgents, finnsPolicyRules, finnsDisputes } from '../lib/mockData';
import { RuleComposerModal } from './RuleComposerModal';
import type { PolicyRule } from '../lib/types';

interface AIActivityPageProps {
  theme: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

// ── Undo Window mode (Expert Void answer) ──────────────────────────
// Hard timer = real-world commit physics (e.g., truck leaves, payment clears).
// Ledger close = day-end human approval gate (matches accounting reality).
// Per-class = soft window for internal actions, hard timer for external-bound.
type UndoMode = 'hard-60' | 'ledger-close' | 'per-class';

// ── Semantic Category Palette (matches Suppliers/Spending) ───────

const CATEGORY_COLORS: Record<string, string> = {
  Protein:    '#991b1b',
  Seafood:    '#075985',
  Produce:    '#166534',
  'Dry Goods':'#334155',
  Beverages:  '#92400e',
  Dairy:      '#0e7490',
  Other:      '#64748b',
};

const CATEGORY_ICONS: Record<string, typeof Beef> = {
  Protein:    Beef,
  Seafood:    Fish,
  Produce:    Apple,
  'Dry Goods':Archive,
  Beverages:  Wine,
  Dairy:      Package,
  Other:      Layers,
};

// ── Event taxonomy ────────────────────────────────────────────────

type EventType = 'all' | 'auto-order' | 'sourcing' | 'group-buy' | 'rejection' | 'compliance' | 'forecast';
type ConfidenceBand = 'all' | 'low' | 'medium' | 'high';

// ── Fixed Action Palette (Layer 2) ───────────────────────────────
// Slate = transactional order flow, Amber = rejection/guardrail,
// Green = compliance/seal, Indigo = sourcing/search, Purple = pooling,
// Cyan = forecasting/prediction. Never mixed with category colors.
const ACTION_COLORS: Record<string, string> = {
  'auto-order': '#334155', // Slate
  'sourcing':   '#4338ca', // Indigo
  'group-buy':  '#7e22ce', // Purple
  'rejection':  '#b45309', // Amber
  'compliance': '#15803d', // Green
  'forecast':   '#0e7490', // Cyan
};

const EVENT_CONFIG: Record<string, { icon: typeof Bot; label: string }> = {
  'auto-order': { icon: ShoppingCart, label: 'Auto-Order' },
  'sourcing':   { icon: SearchIcon,   label: 'Sourcing Match' },
  'group-buy':  { icon: Users,        label: 'Group Buy' },
  'rejection':  { icon: XCircle,      label: 'Quote Rejection' },
  'compliance': { icon: FileText,     label: 'Compliance' },
  'forecast':   { icon: TrendingUp,   label: 'Forecast Update' },
};

// ── Agent Directory (for Relationship Awareness) ──────────────────

interface AgentMeta {
  id: string;
  name: string;
  role: string;
  icon: typeof Bot;
  accent: string;
}

const AGENTS: Record<string, AgentMeta> = {
  'EXE-001': { id: 'EXE-001', name: 'Agent #1',  role: 'Order Executor',      icon: Zap,          accent: '#60a5fa' },
  'EXE-002': { id: 'EXE-002', name: 'Agent #2',  role: 'Procurement Runner',  icon: ShoppingCart, accent: '#22d3ee' },
  'EXE-005': { id: 'EXE-005', name: 'Agent #5',  role: 'Group Buy Coordinator', icon: Users,      accent: '#a78bfa' },
  'REA-003': { id: 'REA-003', name: 'Agent #3',  role: 'Quote Reviewer',      icon: Shield,       accent: '#f472b6' },
  'SEN-001': { id: 'SEN-001', name: 'Agent #6',  role: 'Demand Sensor',       icon: Activity,     accent: '#34d399' },
  'SEN-002': { id: 'SEN-002', name: 'Agent #7',  role: 'Forecast Engine',     icon: TrendingUp,   accent: '#fb923c' },
  'SEN-004': { id: 'SEN-004', name: 'Agent #4',  role: 'Sourcing Scout',      icon: SearchIcon,   accent: '#facc15' },
  'GOV-001': { id: 'GOV-001', name: 'Agent #8',  role: 'Compliance Officer',  icon: Scale,        accent: '#818cf8' },
  'GOV-002': { id: 'GOV-002', name: 'Agent #9',  role: 'Certification Bot',   icon: FileText,     accent: '#c084fc' },
};

// ── Event Ledger ──────────────────────────────────────────────────

interface DataPoint {
  label: string;
  value: string;
  /** Optional delta — e.g. "−4% vs avg", "+15% above guardrail" */
  delta?: string;
  /** positive = good, negative = warn, neutral = no tint */
  tone?: 'positive' | 'negative' | 'neutral';
}

interface ReasoningChain {
  why: string;
  /** Specific, measurable data points the agent used (e.g. "Market Price — $4.20/kg") */
  dataPoints: DataPoint[];
  alternatives: { label: string; rejectedBecause: string }[];
}

interface ActivityEvent {
  id: string;
  type: Exclude<EventType, 'all'>;
  minutesAgo: number;       // numeric so we can compute undo window
  category: keyof typeof CATEGORY_COLORS;
  description: string;
  agent: string;            // agent id key
  confidence: number;       // 0-100
  saving: number | null;    // $ saved
  capitalPreserved: number; // working capital preserved
  rollbackable: boolean;    // false once action is irreversible (shipped, paid, etc.)
  reasoning: ReasoningChain;
}

const EVENTS: ActivityEvent[] = [
  {
    id: 'evt-001', type: 'auto-order', minutesAgo: 2, category: 'Dry Goods',
    description: 'Auto-ordered 500kg Jasmine Rice from PT Maju Bersama',
    agent: 'EXE-001', confidence: 96, saving: 240, capitalPreserved: 1800, rollbackable: true,
    reasoning: {
      why: 'On-hand stock fell below reorder threshold (85kg remaining). Vendor pricing dropped 4% vs last 30-day average, and lead time of 2 days is within safety window.',
      dataPoints: [
        { label: 'On-hand stock', value: '85 kg', delta: 'below 120 kg threshold', tone: 'negative' },
        { label: 'Vendor unit price', value: '$1.42/kg', delta: '−4% vs 30d avg', tone: 'positive' },
        { label: '30d market avg',   value: '$1.48/kg', tone: 'neutral' },
        { label: 'Lead time',        value: '2 days',   delta: 'within 3d safety buffer', tone: 'positive' },
      ],
      alternatives: [
        { label: 'VN Supply Co', rejectedBecause: '12% higher unit price' },
        { label: 'Thai Fresh Co', rejectedBecause: '5-day lead time exceeds buffer' },
      ],
    },
  },
  {
    id: 'evt-002', type: 'rejection', minutesAgo: 18, category: 'Seafood',
    description: 'Rejected quote from VN Supply — price 15% above market rate',
    agent: 'REA-003', confidence: 92, saving: 1200, capitalPreserved: 1200, rollbackable: true,
    reasoning: {
      why: 'Submitted quote of $4.80/kg exceeds rolling 30-day market median ($4.17/kg) by 15.1%. No compensating quality or delivery advantage.',
      dataPoints: [
        { label: 'Vendor quote',     value: '$4.80/kg', delta: '+15.1% above market', tone: 'negative' },
        { label: '30d market median', value: '$4.17/kg', tone: 'neutral' },
        { label: 'Vendor quality score', value: '82', delta: 'no premium', tone: 'neutral' },
        { label: 'Guardrail ceiling', value: '+8% above market', tone: 'neutral' },
      ],
      alternatives: [
        { label: 'Accept quote', rejectedBecause: 'Breaches max-price guardrail' },
        { label: 'Counter-offer', rejectedBecause: 'Vendor declined 2x already this quarter' },
      ],
    },
  },
  {
    id: 'evt-003', type: 'group-buy', minutesAgo: 45, category: 'Dry Goods',
    description: 'Joined Group Buy pool for cooking oil (3 buyers pooled)',
    agent: 'EXE-005', confidence: 88, saving: 680, capitalPreserved: 2400, rollbackable: true,
    reasoning: {
      why: 'Pooled demand reached 3 buyers and volume tier 2 unlocked (+12% discount). Your forecast demand aligns with pool quantity.',
      dataPoints: [
        { label: 'Buyers pooled',     value: '3 of 5',     delta: 'tier-2 unlocked', tone: 'positive' },
        { label: 'Tier-2 discount',   value: '12%',        tone: 'positive' },
        { label: 'Solo unit price',   value: '$3.80/L',    tone: 'neutral' },
        { label: 'Pooled unit price', value: '$3.34/L',    delta: '−$0.46/L',        tone: 'positive' },
      ],
      alternatives: [
        { label: 'Solo order at tier 1', rejectedBecause: 'No discount, 12% higher total cost' },
      ],
    },
  },
  {
    id: 'evt-004', type: 'forecast', minutesAgo: 60, category: 'Seafood',
    description: 'Updated demand forecast for seafood category — +12% for April',
    agent: 'SEN-002', confidence: 74, saving: null, capitalPreserved: 0, rollbackable: true,
    reasoning: {
      why: 'Ramadan proximity + historical 3-year +11% average uptick in seafood demand. Weather forecast shows stable fishing conditions.',
      dataPoints: [
        { label: '3yr historical uptick', value: '+11% avg',   tone: 'neutral' },
        { label: 'Ramadan proximity',     value: '8 days',     delta: 'within seasonality window', tone: 'positive' },
        { label: 'Weather (BMKG)',        value: 'stable',     delta: 'no disruption',             tone: 'positive' },
        { label: 'Booking pipeline',      value: '+15%',       delta: 'vs 30d baseline',           tone: 'positive' },
      ],
      alternatives: [
        { label: 'Hold forecast flat', rejectedBecause: 'Historical base rate strongly favors uptick' },
        { label: '+20% aggressive',    rejectedBecause: 'Would risk over-ordering if weather disrupts' },
      ],
    },
  },
  {
    id: 'evt-005', type: 'compliance', minutesAgo: 120, category: 'Other',
    description: 'Generated import compliance docs for Indonesia shipment PO-2847',
    agent: 'GOV-001', confidence: 99, saving: null, capitalPreserved: 0, rollbackable: false,
    reasoning: {
      why: 'PO-2847 crosses ID-SG border. BPOM + customs forms mandatory. All vendor certificates verified valid through 2026-12-31.',
      dataPoints: [
        { label: 'BPOM cert coverage', value: '4 of 4 vendors', delta: 'all valid',       tone: 'positive' },
        { label: 'Cert expiry',        value: '2026-12-31',     tone: 'neutral' },
        { label: 'HS codes matched',   value: '12 of 12',       delta: 'no exceptions',    tone: 'positive' },
        { label: 'Customs forms',      value: 'auto-generated', tone: 'positive' },
      ],
      alternatives: [
        { label: 'Manual paperwork', rejectedBecause: 'Slower, no cost/quality tradeoff' },
      ],
    },
  },
  {
    id: 'evt-006', type: 'auto-order', minutesAgo: 180, category: 'Other',
    description: 'Auto-ordered cleaning supplies — stock below threshold',
    agent: 'EXE-001', confidence: 94, saving: 85, capitalPreserved: 420, rollbackable: false,
    reasoning: {
      why: 'Dish soap + sanitizer both below reorder point. Consolidated order saves $32 in shipping vs two separate POs.',
      dataPoints: [
        { label: 'Dish soap on-hand',     value: '8 units',   delta: 'below 20 threshold', tone: 'negative' },
        { label: 'Sanitizer on-hand',     value: '4 gal',     delta: 'below 10 threshold', tone: 'negative' },
        { label: 'Consolidated shipping', value: '$32 saved', tone: 'positive' },
        { label: 'Next manual-order ETA', value: '3 days',    delta: 'stockout risk',      tone: 'negative' },
      ],
      alternatives: [
        { label: 'Wait for manual order', rejectedBecause: 'Would stockout in 3 days' },
      ],
    },
  },
  {
    id: 'evt-007', type: 'sourcing', minutesAgo: 210, category: 'Protein',
    description: 'Found alternative supplier for beef — 8% cheaper with same quality',
    agent: 'SEN-004', confidence: 81, saving: 720, capitalPreserved: 720, rollbackable: true,
    reasoning: {
      why: 'New vendor "AU Prime Cuts" scored 88 (vs incumbent 85) on composite, with 8% lower unit price. Cold chain certification validated.',
      dataPoints: [
        { label: 'Incumbent composite', value: '85',         tone: 'neutral' },
        { label: 'AU Prime Cuts score', value: '88',         delta: '+3 pts',   tone: 'positive' },
        { label: 'Unit price delta',    value: '−8%',        delta: '$720/mo',  tone: 'positive' },
        { label: 'Cold chain audit',    value: 'verified',   tone: 'positive' },
      ],
      alternatives: [
        { label: 'Stay with incumbent', rejectedBecause: 'Missing $720/mo savings' },
      ],
    },
  },
  {
    id: 'evt-008', type: 'auto-order', minutesAgo: 240, category: 'Dairy',
    description: 'Auto-ordered dairy products from Thai Fresh Co',
    agent: 'EXE-002', confidence: 91, saving: 150, capitalPreserved: 900, rollbackable: false,
    reasoning: {
      why: 'Milk + yoghurt below threshold. Thai Fresh is contracted primary vendor for dairy; no alternate needed.',
      dataPoints: [
        { label: 'Milk on-hand',     value: '12 gal',          delta: 'below 20 threshold', tone: 'negative' },
        { label: 'Yoghurt on-hand',  value: '15 kg',           delta: 'below 25 threshold', tone: 'negative' },
        { label: 'Primary contract', value: 'Thai Fresh Co',   tone: 'neutral' },
        { label: 'Spoilage window',  value: '5 days',          delta: 'covered by lead time', tone: 'positive' },
      ],
      alternatives: [
        { label: 'Skip yoghurt', rejectedBecause: 'Menu dependency — would impact service' },
      ],
    },
  },
  {
    id: 'evt-009', type: 'rejection', minutesAgo: 300, category: 'Produce',
    description: 'Rejected PH Agri Corp quote — delivery time exceeds threshold',
    agent: 'REA-003', confidence: 68, saving: null, capitalPreserved: 0, rollbackable: true,
    reasoning: {
      why: 'Promised 7-day lead time vs 3-day SLA. Price advantage (-4%) does not compensate for stockout risk.',
      dataPoints: [
        { label: 'Promised lead time', value: '7 days',  delta: 'exceeds 3-day SLA', tone: 'negative' },
        { label: 'Price advantage',    value: '−4%',     tone: 'positive' },
        { label: 'Spoilage window',    value: '4 days',  tone: 'neutral' },
        { label: 'Stockout risk',      value: 'high',    tone: 'negative' },
      ],
      alternatives: [
        { label: 'Accept with buffer stock', rejectedBecause: 'Working-capital tie-up exceeds saving' },
      ],
    },
  },
  {
    id: 'evt-010', type: 'forecast', minutesAgo: 360, category: 'Protein',
    description: 'Seasonal adjustment: increased protein demand forecast for Ramadan',
    agent: 'SEN-001', confidence: 82, saving: null, capitalPreserved: 0, rollbackable: true,
    reasoning: {
      why: 'Ramadan pattern: +24% protein demand in evenings. Historical 4-year confidence interval matches current booking velocity.',
      dataPoints: [
        { label: '4yr historical uptick',  value: '+24%',    tone: 'neutral' },
        { label: 'Booking velocity',       value: 'on-pace', delta: 'matches forecast', tone: 'positive' },
        { label: 'Ramadan days covered',   value: '30',      tone: 'neutral' },
        { label: 'Evening demand factor',  value: '+38%',    delta: 'dinner peak',       tone: 'positive' },
      ],
      alternatives: [
        { label: '+15% conservative', rejectedBecause: 'Under-estimates based on current booking rate' },
      ],
    },
  },
  {
    id: 'evt-011', type: 'group-buy', minutesAgo: 480, category: 'Dry Goods',
    description: 'Created Group Buy opportunity for bulk rice (target: 5 buyers)',
    agent: 'EXE-005', confidence: 71, saving: null, capitalPreserved: 0, rollbackable: true,
    reasoning: {
      why: 'Identified 4 peer buyers with aligned rice demand window. Tier-3 price break unlocks at 5 buyers.',
      dataPoints: [
        { label: 'Buyers committed', value: '4 of 5',    delta: '1 seat open',    tone: 'neutral' },
        { label: 'Tier-3 threshold', value: '5 buyers',  tone: 'neutral' },
        { label: 'Tier-3 discount',  value: '18%',       tone: 'positive' },
        { label: 'Solo vs pooled',   value: '$1.52 → $1.24/kg', delta: '−$0.28/kg', tone: 'positive' },
      ],
      alternatives: [
        { label: 'Individual order', rejectedBecause: 'Forgoes 18% tier-3 discount' },
      ],
    },
  },
  {
    id: 'evt-012', type: 'compliance', minutesAgo: 600, category: 'Other',
    description: 'Auto-renewed food safety certificates for 3 suppliers',
    agent: 'GOV-002', confidence: 97, saving: null, capitalPreserved: 0, rollbackable: false,
    reasoning: {
      why: 'Three vendor certs within 30d of expiry. Renewal fully automated under contracted service. No gap in supplier eligibility.',
      dataPoints: [
        { label: 'Vendors with expiring certs', value: '3',         tone: 'neutral' },
        { label: 'Days to expiry',              value: '< 30',      delta: 'renewal window',  tone: 'negative' },
        { label: 'Renewal contract',            value: 'on-retainer', tone: 'positive' },
        { label: 'Service gap risk',            value: '0',         delta: 'no lapse',        tone: 'positive' },
      ],
      alternatives: [
        { label: 'Manual renewal', rejectedBecause: 'Creates operational risk of lapse' },
      ],
    },
  },
];

// ── 24-hour capital efficiency (sparklines) ──────────────────────
// 24 hourly samples, oldest → newest. Used for summary-card sparklines.

const SAVINGS_24H: { v: number }[] = [
  { v: 0 },   { v: 45 },  { v: 120 }, { v: 180 }, { v: 220 }, { v: 260 },
  { v: 310 }, { v: 380 }, { v: 420 }, { v: 520 }, { v: 640 }, { v: 790 },
  { v: 850 }, { v: 910 }, { v: 980 }, { v: 1080 },{ v: 1240 },{ v: 1380 },
  { v: 1520 },{ v: 1640 },{ v: 1810 },{ v: 2060 },{ v: 2240 },{ v: 3075 },
];

const CAPITAL_24H: { v: number }[] = [
  { v: 0 },   { v: 200 }, { v: 420 }, { v: 640 }, { v: 820 }, { v: 1040 },
  { v: 1260 },{ v: 1480 },{ v: 1860 },{ v: 2040 },{ v: 2320 },{ v: 2680 },
  { v: 2940 },{ v: 3280 },{ v: 3540 },{ v: 3860 },{ v: 4220 },{ v: 4640 },
  { v: 4980 },{ v: 5420 },{ v: 5880 },{ v: 6240 },{ v: 6680 },{ v: 7640 },
];

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Autonomy Throttle (per-category) ──────────────────────────────

const DEFAULT_CATEGORY_AUTONOMY: Record<string, AutonomyLevel> = {
  Protein:    2,
  Seafood:    2,
  Produce:    3,
  'Dry Goods':4,
  Beverages:  4,
  Dairy:      2,
  Other:      3,
};

// ── Helpers ──────────────────────────────────────────────────────

function relativeTimeLabel(min: number): string {
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60 * 10) / 10;
  return `${h}h ago`;
}

function confidenceBand(conf: number): ConfidenceBand {
  if (conf >= 90) return 'high';
  if (conf >= 80) return 'medium';
  return 'low';
}

function confidenceColor(conf: number, isDark: boolean): string {
  if (conf >= 90) return isDark ? 'text-green-400' : 'text-green-600';
  if (conf >= 80) return isDark ? 'text-amber-400' : 'text-amber-600';
  return isDark ? 'text-red-400' : 'text-red-600';
}

// ── Atlas chat — always-on global rule ───────────────────────────
// Persistent chat input pinned to the bottom of the right rail. Atlas
// is *always* available regardless of which event the user is inspecting.
function ActivityAtlasChat({ isDark, t }: { isDark: boolean; t: any }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ from: 'user' | 'atlas'; text: string }[]>([]);
  const send = () => {
    const q = input.trim();
    if (!q) return;
    setMessages(prev => [...prev, { from: 'user', text: q }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        from: 'atlas',
        text: `Pulling the audit trail relevant to "${q.slice(0, 40)}". Open the event in the timeline for the full reasoning chain.`,
      }]);
    }, 600);
  };
  return (
    <div className={`shrink-0 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
      {messages.length > 0 && (
        <div className="px-3 py-2 max-h-32 overflow-y-auto space-y-1.5">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] px-2 py-1 rounded-lg text-[10px] leading-relaxed ${
                m.from === 'user'
                  ? isDark ? 'bg-[#87986a]/20 text-[#dbe3ce]' : 'bg-[#87986a]/15 text-[#3d4933]'
                  : isDark ? 'bg-[#2a2a2a] text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}>{m.text}</div>
            </div>
          ))}
        </div>
      )}
      <div className="p-3 flex items-end gap-1.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask Atlas about agents, events, evidence…"
          rows={1}
          className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11px] resize-none outline-none ${
            isDark ? 'bg-[#2a2a2a] border border-gray-700 text-white placeholder:text-gray-500' : 'bg-gray-50 border border-gray-200 placeholder:text-gray-400'
          }`}
        />
        <button onClick={send} disabled={!input.trim()}
          className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
            input.trim() ? 'bg-[#87986a] hover:bg-[#6b7a54] text-white' : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'
          }`}>
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Action Log Panel (Phase 4f.3 consumer) ───────────────────────
// Reads from the unified action log via useActionLog. Renders a
// compact row list with an actor-filter chip group. Mode-aware:
// Off mode defaults to "Your actions"; Assist/Auto show "All".

interface ActionLogPanelProps {
  isDark: boolean;
  t: ReturnType<typeof themeTokens>;
  autonomyMode: 'off' | 'assist' | 'auto';
  actorFilter: 'all' | ActorType;
  setActorFilter: (next: 'all' | ActorType) => void;
  entries: ActionLogEntry[];
}

const ACTOR_CHIPS: { id: 'all' | ActorType; label: string }[] = [
  { id: 'all',    label: 'All' },
  { id: 'admin',  label: 'You' },
  { id: 'agent',  label: 'Agents' },
  { id: 'system', label: 'System' },
];

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const at = new Date(iso).getTime();
  const ms = now - at;
  const min = Math.round(ms / 60000);
  if (min < 1)        return 'just now';
  if (min < 60)       return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24)        return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7)          return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActionLogPanel({ isDark, t, autonomyMode, actorFilter, setActorFilter, entries }: ActionLogPanelProps) {
  const offEmpty = autonomyMode === 'off' && actorFilter === 'agent' && entries.length === 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Action Log</h3>
          <span className={`text-[10px] ${t.textMuted}`}>everything you, agents, and the system have done</span>
        </div>
        <span className={`text-[10px] ${t.textMuted}`}>{entries.length} shown</span>
      </div>

      {/* Actor filter chips */}
      <div className="flex items-center gap-1 mb-3">
        {ACTOR_CHIPS.map(chip => {
          const active = actorFilter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setActorFilter(chip.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                active
                  ? isDark ? 'bg-[#87986a]/20 text-[#a3b085] border border-[#87986a]/50' : 'bg-[#f4f6f0] text-[#6b7a54] border border-[#87986a]/40'
                  : isDark ? 'text-gray-500 border border-gray-800 hover:text-gray-300 hover:border-gray-700' : 'text-gray-500 border border-gray-200 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Off-mode hint when no agent activity */}
      {offEmpty && (
        <div className={`text-[10px] mb-2 px-2.5 py-1.5 rounded-md ${isDark ? 'bg-amber-500/8 text-amber-300/80' : 'bg-amber-50 text-amber-700'}`}>
          Autonomy is <strong>Off</strong> — agents observe but don't act, so this list will stay empty until you switch to Assist or Auto.
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 && !offEmpty ? (
        <div className={`text-[11px] py-4 text-center ${t.textMuted}`}>
          No actions match this filter yet.
        </div>
      ) : (
        <div className={`rounded-xl border divide-y ${isDark ? 'bg-[#1a1a1a] border-gray-800 divide-gray-800' : 'bg-white border-gray-200 divide-gray-100'}`}>
          {entries.map(e => {
            const actorDotColor =
              e.actorType === 'admin'  ? (isDark ? 'bg-[#a3b085]' : 'bg-[#6b7a54]') :
              e.actorType === 'agent'  ? (isDark ? 'bg-indigo-400' : 'bg-indigo-500') :
                                          (isDark ? 'bg-slate-400' : 'bg-slate-500');
            const outcomeTone =
              e.outcome === 'failed'      ? (isDark ? 'text-red-400'   : 'text-red-600')   :
              e.outcome === 'overridden'  ? (isDark ? 'text-amber-300' : 'text-amber-700') :
              e.outcome === 'pending'     ? (isDark ? 'text-blue-300'  : 'text-blue-700')  :
                                              t.textMuted;
            return (
              <div key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <span className={`h-2 w-2 rounded-full ${actorDotColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[11px] font-semibold ${t.textPrimary}`}>{e.actorLabel}</span>
                    <span className={`text-[9px] ${t.textMuted}`}>{formatRelativeTime(e.at)}</span>
                    {e.outcome !== 'success' && (
                      <span className={`text-[9px] uppercase tracking-wide font-bold ${outcomeTone}`}>{e.outcome}</span>
                    )}
                    {e.venue && (
                      <span className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{e.venue}</span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{e.summary}</p>
                  {e.details && (
                    <p className={`text-[10px] mt-0.5 leading-snug ${t.textMuted}`}>{e.details}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────

export function AIActivityPage({ theme, onNavigate }: AIActivityPageProps) {
  const isDark = theme === 'dark';
  const t = themeTokens(isDark);
  const [typeFilter, setTypeFilter] = useState<EventType>('all');
  const [confFilter, setConfFilter] = useState<ConfidenceBand>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(EVENTS[0].id);
  const [categoryAutonomy, setCategoryAutonomy] = useState<Record<string, AutonomyLevel>>(DEFAULT_CATEGORY_AUTONOMY);
  const [reversedIds, setReversedIds] = useState<Set<string>>(new Set());
  const globalAutonomy: AutonomyLevel = 3;

  // ── Governance state ───────────────────────────────────────────
  const [suspendedAgents, setSuspendedAgents] = useState<Set<string>>(new Set());
  const [confidenceGuardrail, setConfidenceGuardrail] = useState<number>(85);
  const [editedDataPoints, setEditedDataPoints] = useState<Record<string, Record<string, string>>>({});
  // { eventId: { fieldLabel: newValue } } — overrides per event/field
  const [editingField, setEditingField] = useState<{ eventId: string; label: string } | null>(null);
  const [fieldDraft, setFieldDraft] = useState<string>('');
  const [rollbackPromptId, setRollbackPromptId] = useState<string | null>(null);
  const [undoMode, setUndoMode] = useState<UndoMode>('per-class');
  const [ledgerApproved, setLedgerApproved] = useState<boolean>(false);
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);

  // ── Action Log feed (Phase 4f.3) ─────────────────────────────────
  // Reads from the unified action log. Actor chip has a mode-aware
  // default: Off → 'admin' (your actions), Assist/Auto → 'all'.
  const autonomyMode = useAutonomyMode();
  const [actorFilter, setActorFilter] = useState<'all' | ActorType>(
    autonomyMode === 'off' ? 'admin' : 'all',
  );
  const actionLogEntries = useActionLog({
    actorType: actorFilter,
    limit: 20,
  });

  // ── Left-panel tab state (Phase 4d) ──────────────────────────────
  type LeftTab = 'activity' | 'agents' | 'policy' | 'disputes';
  const [leftTab, setLeftTab] = useState<LeftTab>('activity');
  const [suspendedAgentSet, setSuspendedAgentSet] = useState<Set<string>>(new Set());

  // ── System-wide pause (Phase 6c) ─────────────────────────────────
  // Lives under Agents tab; flips agentsPaused which gates every Auto
  // entity platform-wide. Manual entities are unaffected; Atlas + insights stay live.
  const agentsPaused = useAgentsPaused();
  const handlePauseToggle = () => {
    const next = !agentsPaused;
    setAgentsPaused(next);
    logUserAction({
      kind: 'autonomy-mode-change',
      entity: { type: 'platform', id: 'autonomy' },
      summary: next ? 'Paused all agents (system-wide)' : 'Resumed all agents (system-wide)',
      details: next
        ? 'Per-entity Auto entities are frozen until resumed. Per-entity Manual entities are unaffected. Atlas chat + insight surfaces stay live.'
        : 'Auto entities are free to act again within policy.',
      meta: { paused: next },
    });
    toast[next ? 'warning' : 'success'](
      next ? 'All agents paused' : 'Agents resumed',
      { description: next ? 'System-wide kill switch active. Auto entities frozen.' : 'Auto entities are running again within policy.' },
    );
  };
  const openDisputeCount = useMemo(
    () => finnsDisputes.filter(d => d.status === 'open' || d.status === 'escalated').length,
    [],
  );

  // ── Rule Composer state (Phase 4m) ───────────────────────────────
  const [composerOpen, setComposerOpen]   = useState(false);
  const [editingRule, setEditingRule]     = useState<PolicyRule | null>(null);
  const [customRules, setCustomRules]     = useState<PolicyRule[]>([]);
  const [deletedSeededIds, setDeletedSeededIds] = useState<Set<string>>(new Set());
  const [seededOverrides, setSeededOverrides]   = useState<Record<string, Partial<PolicyRule>>>({});

  // Composite rule list — custom-on-top, then seeded with any overrides
  // (toggles / edits) applied, minus any seeded ids the user has deleted.
  const visiblePolicyRules: PolicyRule[] = useMemo(() => {
    const seededVisible = finnsPolicyRules
      .filter(r => !deletedSeededIds.has(r.id))
      .map(r => seededOverrides[r.id] ? { ...r, ...seededOverrides[r.id] } as PolicyRule : r);
    return [...customRules, ...seededVisible];
  }, [customRules, deletedSeededIds, seededOverrides]);

  const openComposerCreate = () => { setEditingRule(null); setComposerOpen(true); };
  const openComposerEdit   = (r: PolicyRule) => { setEditingRule(r); setComposerOpen(true); };
  const handleRuleCreate = (r: PolicyRule) => setCustomRules(prev => [r, ...prev]);
  const handleRuleUpdate = (r: PolicyRule) => {
    if (customRules.some(c => c.id === r.id)) {
      setCustomRules(prev => prev.map(c => c.id === r.id ? r : c));
    } else {
      // Editing a seeded rule — record an override instead of mutating.
      setSeededOverrides(prev => ({ ...prev, [r.id]: r }));
    }
  };
  const handleRuleDelete = (id: string) => {
    if (customRules.some(c => c.id === id)) {
      setCustomRules(prev => prev.filter(c => c.id !== id));
    } else {
      setDeletedSeededIds(prev => new Set(prev).add(id));
    }
  };

  // Deep-link hash reader — #evt=eventId selects that event in the right panel.
  // Falls back to an amber toast when the event id is not in the seeded ledger
  // (some upstream callers — e.g. the Orders Decision Attribution Trail —
  // synthesize evt ids that don't always map to real records).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw) return;
      const params = new URLSearchParams(raw);
      const evtId = params.get('evt');
      if (!evtId) return;
      if (EVENTS.some(e => e.id === evtId)) {
        setSelectedEventId(evtId);
        setHighlightEventId(evtId);
        setTimeout(() => {
          const card = document.querySelector(`[data-event-id="${evtId}"]`);
          card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        setTimeout(() => setHighlightEventId(null), 2400);
      } else {
        toast.warning(`${evtId} isn't in this ledger`, {
          description: 'The activity timeline is open for browsing — filter by event type or confidence to narrow it.',
        });
      }
      window.location.hash = '';
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // ── Warm-up / Learning Phase ────────────────────────────────────
  // System needs ≥25 events before confidence calibration is trustworthy.
  const WARMUP_THRESHOLD = 25;
  const isWarmingUp = EVENTS.length < WARMUP_THRESHOLD;
  const warmupPct = Math.min(100, Math.round((EVENTS.length / WARMUP_THRESHOLD) * 100));
  // Per-category calibration: a category is calibrated if it has ≥3 events
  const categoryCalibratedMap = useMemo(() => {
    const counts: Record<string, number> = {};
    EVENTS.forEach(e => { counts[e.category] = (counts[e.category] ?? 0) + 1; });
    return Object.fromEntries(
      Object.keys(CATEGORY_COLORS).map(cat => [cat, (counts[cat] ?? 0) >= 3])
    );
  }, []);

  // Open the agent's directory profile in Governance.
  // Self-navigate to focus an agent — Activity & Governance is now merged,
  // so we stay on this page and scroll/highlight via hash.
  const openAgentGovernance = useCallback((agentKey: string) => {
    const meta = AGENTS[agentKey];
    if (!meta) return;
    const numericId = meta.name.replace(/[^\d]/g, '') || '00';
    if (typeof window !== 'undefined') {
      window.location.hash = `agent-${numericId.padStart(2, '0')}`;
    }
    // No cross-page navigation needed — we're already on Activity & Governance.
  }, []);

  const toggleAgentSuspension = useCallback((agentKey: string) => {
    const meta = AGENTS[agentKey];
    setSuspendedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentKey)) {
        next.delete(agentKey);
        toast.success(`${meta?.name ?? 'Agent'} resumed`, {
          description: 'Performance Review cleared. Autonomous actions resume across the app.',
        });
      } else {
        next.add(agentKey);
        toast.warning(`${meta?.name ?? 'Agent'} suspended`, {
          description: 'Halted globally. All in-flight autonomous actions paused until cleared.',
        });
      }
      return next;
    });
  }, []);

  const handleRollback = useCallback((id: string) => {
    setReversedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Two-choice rollback resolution.
  const handleRollbackChoice = useCallback((id: string, choice: 'fix' | 'manual') => {
    const event = EVENTS.find(e => e.id === id);
    handleRollback(id);
    setRollbackPromptId(null);
    if (choice === 'fix') {
      toast.success(`Rolled back · queued for AI re-run`, {
        description: `${event?.description ?? 'Action'} reverted. Edit data points in the Reasoning Chain — agent will retry on save.`,
      });
    } else {
      toast.warning(`Rolled back · Manual Takeover engaged`, {
        description: `${event?.description ?? 'Action'} reverted. Related order/SKU flipped to Manual mode for hands-on completion.`,
      });
    }
  }, [handleRollback]);

  // Map an event to its source page (deep-link behind the description).
  const getEventSource = useCallback((event: ActivityEvent): { page: string; label: string } | null => {
    switch (event.type) {
      case 'auto-order':
      case 'group-buy':
        return { page: 'orders', label: 'Open in Orders' };
      case 'sourcing':
      case 'rejection':
        return { page: 'suppliers', label: 'Open in Suppliers' };
      case 'compliance':
        return { page: 'governance', label: 'Open in Governance' };
      case 'forecast':
        return { page: 'inventory', label: 'Open in Inventory' };
      default:
        return null;
    }
  }, []);
  const openEventSource = useCallback((event: ActivityEvent) => {
    const src = getEventSource(event);
    if (!src) return;
    if (typeof window !== 'undefined') {
      window.location.hash = `evt=${event.id}`;
    }
    onNavigate?.(src.page);
  }, [getEventSource, onNavigate]);

  const startEditField = useCallback((eventId: string, label: string, currentValue: string) => {
    setEditingField({ eventId, label });
    setFieldDraft(currentValue);
  }, []);
  const saveEditField = useCallback(() => {
    if (!editingField) return;
    const { eventId, label } = editingField;
    setEditedDataPoints(prev => ({
      ...prev,
      [eventId]: { ...(prev[eventId] ?? {}), [label]: fieldDraft },
    }));
    const event = EVENTS.find(e => e.id === eventId);
    toast.success('Recalibration saved', {
      description: `Updated "${label}" for ${event?.description.slice(0, 60) ?? 'event'} · agent will use this value on next run.`,
    });
    setEditingField(null);
    setFieldDraft('');
  }, [editingField, fieldDraft]);
  const cancelEditField = useCallback(() => {
    setEditingField(null);
    setFieldDraft('');
  }, []);

  const filtered = useMemo(() =>
    EVENTS
      .filter(e => typeFilter === 'all' || e.type === typeFilter)
      .filter(e => confFilter === 'all' || confidenceBand(e.confidence) === confFilter),
    [typeFilter, confFilter]
  );

  const selectedEvent = selectedEventId ? EVENTS.find(e => e.id === selectedEventId) ?? null : null;

  const eventTypes: { id: EventType; label: string }[] = [
    { id: 'all',        label: 'All Events' },
    { id: 'auto-order', label: 'Auto-Orders' },
    { id: 'sourcing',   label: 'Sourcing' },
    { id: 'group-buy',  label: 'Group Buys' },
    { id: 'rejection',  label: 'Rejections' },
    { id: 'compliance', label: 'Compliance' },
    { id: 'forecast',   label: 'Forecasts' },
  ];

  const confBands: { id: ConfidenceBand; label: string; range: string }[] = [
    { id: 'all',    label: 'All Confidence', range: '0–100%' },
    { id: 'high',   label: 'High',           range: '≥ 90%' },
    { id: 'medium', label: 'Medium',         range: '80–89%' },
    { id: 'low',    label: 'Low Confidence', range: '< 80%' },
  ];

  const interceptedIds = useMemo(() =>
    new Set(EVENTS.filter(e => e.confidence < confidenceGuardrail).map(e => e.id)),
    [confidenceGuardrail]
  );

  // Per-class undo windows: external-bound events (auto-order, group-buy)
  // get the hard 60-min timer; internal-only events stay open until ledger close.
  const isExternalBound = useCallback((e: ActivityEvent) =>
    e.type === 'auto-order' || e.type === 'group-buy', []);
  const undoOpenFor = useCallback((e: ActivityEvent): boolean => {
    if (!e.rollbackable) return false;
    if (reversedIds.has(e.id)) return false;
    if (undoMode === 'hard-60') return e.minutesAgo <= 60;
    if (undoMode === 'ledger-close') return !ledgerApproved;
    // per-class
    return isExternalBound(e) ? e.minutesAgo <= 60 : !ledgerApproved;
  }, [undoMode, ledgerApproved, reversedIds, isExternalBound]);

  const dailyCapital = useMemo(() => ({
    tasksCompleted: EVENTS.length,
    moneySaved: EVENTS.reduce((s, e) => s + (e.saving ?? 0), 0),
    capitalPreserved: EVENTS.reduce((s, e) => s + e.capitalPreserved, 0),
    autoOrders: EVENTS.filter(e => e.type === 'auto-order').length,
    lowConfCount: EVENTS.filter(e => confidenceBand(e.confidence) === 'low').length,
    interceptedCount: interceptedIds.size,
    undoWindowCount: EVENTS.filter(e => undoOpenFor(e)).length,
  }), [interceptedIds, undoOpenFor]);

  const adjustCategory = (cat: string, delta: number) => {
    setCategoryAutonomy(prev => {
      const current = prev[cat] ?? 3;
      const next = Math.max(0, Math.min(5, current + delta)) as AutonomyLevel;
      return { ...prev, [cat]: next };
    });
  };

  // ── LEFT PANEL — Control Plane ──────────────────────────────────

  // ── Activity tab body — the existing Control Plane content ───────
  const activityTabBody = (
    <>
      <div className={t.section}>
        <div className="flex items-center gap-2">
          <Gauge className={`h-4 w-4 ${t.sageIcon}`} strokeWidth={1.5} />
          <div>
            <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Control Plane</h2>
            <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Throttle · Triage · Trust</p>
          </div>
        </div>
      </div>

      {/* Confidence Guardrail — global throttle */}
      <div className={t.section}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-xs ${t.sectionLabel}`}>CONFIDENCE GUARDRAIL</h3>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
          }`}>
            {dailyCapital.interceptedCount} intercepted
          </span>
        </div>
        <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] ${t.textMuted}`}>Auto-execute when ≥</span>
            <span className={`text-sm font-bold ${t.textPrimary}`}>{confidenceGuardrail}%</span>
          </div>
          <input type="range" min={50} max={99} value={confidenceGuardrail}
            onChange={e => setConfidenceGuardrail(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${isDark ? '#a3b085' : '#87986a'} ${((confidenceGuardrail - 50) / 49) * 100}%, ${isDark ? '#374151' : '#e5e7eb'} 0%)`,
            }} />
          <div className="flex justify-between mt-0.5">
            <span className={`text-[9px] ${t.textMuted}`}>50%</span>
            <span className={`text-[9px] ${t.textMuted}`}>99%</span>
          </div>
          <p className={`text-[10px] mt-2 leading-relaxed ${t.textMuted}`}>
            Below this threshold, autonomous actions are <strong className={isDark ? 'text-amber-300' : 'text-amber-700'}>intercepted</strong> and routed to <strong>Needs Your Action</strong> instead of auto-executing.
          </p>
        </div>
      </div>

      {/* Confidence Triage */}
      <div className={t.section}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-xs ${t.sectionLabel}`}>CONFIDENCE TRIAGE</h3>
          {dailyCapital.lowConfCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
              {dailyCapital.lowConfCount} flagged
            </span>
          )}
        </div>
        <div className="space-y-1">
          {confBands.map(b => {
            const count = b.id === 'all' ? EVENTS.length : EVENTS.filter(e => confidenceBand(e.confidence) === b.id).length;
            const active = confFilter === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setConfFilter(b.id)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                  active
                    ? isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                    : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Percent className={`h-3 w-3 shrink-0 ${
                    b.id === 'high'   ? isDark ? 'text-green-400' : 'text-green-600'
                    : b.id === 'medium' ? isDark ? 'text-amber-400' : 'text-amber-600'
                    : b.id === 'low'    ? isDark ? 'text-red-400'   : 'text-red-600'
                    : t.textMuted
                  }`} />
                  <div className="min-w-0 text-left">
                    <div className="font-medium truncate">{b.label}</div>
                    <div className={`text-[9px] ${t.textMuted}`}>{b.range}</div>
                  </div>
                </div>
                <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Event type filter */}
      <div className={t.section}>
        <h3 className={`text-xs mb-3 ${t.sectionLabel}`}>EVENT TYPE</h3>
        <div className="space-y-1">
          {eventTypes.map(et => {
            const count = et.id === 'all' ? EVENTS.length : EVENTS.filter(e => e.type === et.id).length;
            return (
              <button
                key={et.id}
                onClick={() => setTypeFilter(et.id)}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                  typeFilter === et.id
                    ? isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                    : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium">{et.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-Category Autonomy Throttle */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-xs ${t.sectionLabel}`}>AUTONOMY THROTTLE</h3>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
            Global L{globalAutonomy}
          </span>
        </div>
        <div className="space-y-1.5">
          {(Object.keys(DEFAULT_CATEGORY_AUTONOMY) as (keyof typeof CATEGORY_COLORS)[]).map(cat => {
            const level = categoryAutonomy[cat] ?? 3;
            const CI = CATEGORY_ICONS[cat] ?? Package;
            const color = CATEGORY_COLORS[cat];
            return (
              <div key={cat} className={`p-2 rounded-lg border ${isDark ? 'border-gray-800 bg-[#2a2a2a]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                          style={{ background: `${color}22` }}>
                      <CI className="h-2.5 w-2.5" style={{ color }} />
                    </span>
                    <span className={`text-[11px] font-medium truncate ${t.textPrimary}`}>{cat}</span>
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 ${t.textPrimary}`}>L{level}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustCategory(cat, -1)}
                    disabled={level === 0}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      level === 0
                        ? isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div className="flex-1 flex gap-0.5">
                    {[0, 1, 2, 3, 4, 5].map(tick => (
                      <div key={tick}
                           className={`flex-1 h-1.5 rounded-sm transition-colors`}
                           style={{ background: tick <= level ? color : isDark ? '#3a3a3a' : '#e5e7eb' }} />
                    ))}
                  </div>
                  <button
                    onClick={() => adjustCategory(cat, 1)}
                    disabled={level === 5}
                    className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                      level === 5
                        ? isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-[9px] leading-tight ${t.textMuted}`}>{AUTONOMY_LABELS[level]}</p>
                  {isWarmingUp && (
                    <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${
                      categoryCalibratedMap[cat]
                        ? isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-700'
                        : isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {categoryCalibratedMap[cat] ? 'Calibrated' : 'Learning'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Autonomy */}
      <div className="px-4 pb-4">
        <h3 className={`text-xs mb-2 ${t.sectionLabel}`}>GLOBAL AUTONOMY</h3>
        <div className={t.cardBorder}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${t.textPrimary}`}>Level {globalAutonomy}</span>
            <span className={`text-[10px] ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{AUTONOMY_LABELS[globalAutonomy]}</span>
          </div>
          <div className={`h-2 rounded-full ${t.progressTrack}`}>
            <div className="h-2 rounded-full bg-[#87986a]" style={{ width: `${(globalAutonomy / 5) * 100}%` }} />
          </div>
          <p className={`text-[10px] mt-2 ${t.textMuted}`}>
            72% progress to Level {Math.min(globalAutonomy + 1, 5) as AutonomyLevel}: {AUTONOMY_LABELS[Math.min(globalAutonomy + 1, 5) as AutonomyLevel]}
          </p>
        </div>
      </div>
    </>
  );

  // ── Agents tab body — 6-agent roster status (Phase 4d) ───────────
  const agentsTabBody = (
      <div className="p-4 space-y-3">
        <div>
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Agent Roster</h2>
          <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
            The 5 operating agents. Atlas (chat copilot) isn't gated and isn't shown here.
          </p>
        </div>

        {/* 6c — System-wide pause */}
        <div className={`p-3 rounded-lg border ${
          agentsPaused
            ? isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
            : isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`shrink-0 w-2 h-2 rounded-full ${agentsPaused ? 'bg-red-500' : 'bg-green-500'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-semibold ${t.textPrimary}`}>
                {agentsPaused ? 'All agents paused' : 'Agents active'}
              </p>
              <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                {agentsPaused
                  ? 'Kill switch on — every Auto entity is frozen. Per-entity Manual unaffected. Atlas + insights stay live.'
                  : 'Per-entity autonomy applies: Auto entities act within policy; Manual entities wait for you.'}
              </p>
            </div>
            <button onClick={handlePauseToggle}
              className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded border transition-colors ${
                agentsPaused
                  ? 'bg-[#87986a] border-[#87986a] text-white hover:bg-[#6b7a54]'
                  : isDark ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-red-300/70 text-red-600 hover:bg-red-50'
              }`}>
              {agentsPaused ? <><PlayCircle className="h-3 w-3 inline -mt-0.5 mr-0.5" /> Resume all</> : <><PauseCircle className="h-3 w-3 inline -mt-0.5 mr-0.5" /> Pause all</>}
            </button>
          </div>
        </div>

        {/* 6c — System-wide pause */}
        <div className={`p-3 rounded-lg border ${
          agentsPaused
            ? isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
            : isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`shrink-0 w-2 h-2 rounded-full ${agentsPaused ? 'bg-red-500' : 'bg-green-500'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-semibold ${t.textPrimary}`}>
                {agentsPaused ? 'All agents paused' : 'Agents active'}
              </p>
              <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                {agentsPaused
                  ? 'Kill switch on — every Auto entity is frozen. Per-entity Manual unaffected. Atlas + insights stay live.'
                  : 'Per-entity autonomy applies: Auto entities act within policy; Manual entities wait for you.'}
              </p>
            </div>
            <button onClick={handlePauseToggle}
              className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded border transition-colors ${
                agentsPaused
                  ? 'bg-[#87986a] border-[#87986a] text-white hover:bg-[#6b7a54]'
                  : isDark ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-red-300/70 text-red-600 hover:bg-red-50'
              }`}>
              {agentsPaused ? <><PlayCircle className="h-3 w-3 inline -mt-0.5 mr-0.5" /> Resume all</> : <><PauseCircle className="h-3 w-3 inline -mt-0.5 mr-0.5" /> Pause all</>}
            </button>
          </div>
        </div>
      <div className="space-y-2">
        {finnsAgents.map(a => {
          const suspended = suspendedAgentSet.has(a.id);
          const bandColor =
            a.performanceBand === 'green'
              ? isDark ? 'text-green-400' : 'text-green-600'
              : a.performanceBand === 'amber'
                ? isDark ? 'text-amber-400' : 'text-amber-700'
                : isDark ? 'text-red-400' : 'text-red-600';
          return (
            <div key={a.id}
                 className={`p-2.5 rounded-lg border ${
                   suspended
                     ? isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50/60 border-amber-200'
                     : isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'
                 }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
                      {a.id}
                    </span>
                    <span className={`text-[11px] font-semibold ${t.textPrimary}`}>{a.name}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${bandColor}`}>
                      ● {a.performanceBand}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-1 leading-relaxed ${t.textSecondary}`}>{a.description}</p>
                </div>
                <button
                  onClick={() => setSuspendedAgentSet(prev => {
                    const next = new Set(prev);
                    next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                    toast.info(`${a.id} ${next.has(a.id) ? 'suspended' : 'resumed'}`, {
                      description: next.has(a.id)
                        ? 'In-flight autonomous actions paused. Suggestions still surface.'
                        : 'Resumed within current Autonomy mode policy.',
                    });
                    return next;
                  })}
                  className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded border transition-colors ${
                    suspended
                      ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
                      : isDark ? 'border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-500/40' : 'border-gray-300 text-gray-500 hover:text-amber-700 hover:border-amber-300'
                  }`}>
                  {suspended ? <><PlayCircle className="h-2.5 w-2.5 inline -mt-0.5 mr-0.5" /> Resume</> : <><PauseCircle className="h-2.5 w-2.5 inline -mt-0.5 mr-0.5" /> Suspend</>}
                </button>
              </div>
              <div className={`mt-2 pt-2 border-t flex items-center justify-between text-[9px] ${isDark ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-500'}`}>
                <span>{a.tasksCompletedToday} task{a.tasksCompletedToday === 1 ? '' : 's'} today</span>
                <span>{a.recentDecisions.length} recent decision{a.recentDecisions.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Policy tab body — rule list (Phase 4d / 4m) ──────────────────
  const policyTabBody = (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Policy Rules</h2>
          <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
            Hard gates that A-04 (Spend Watchdog) enforces on every PO.
          </p>
        </div>
        <button
          onClick={openComposerCreate}
          className={`text-[10px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md border ${
            isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}>
          + New rule
        </button>
      </div>
      <div className="space-y-2">
        {visiblePolicyRules.map(rule => (
          <div key={rule.id}
               className={`p-2.5 rounded-lg border ${
                 rule.active
                   ? isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'
                   : isDark ? 'bg-[#1a1a1a] border-gray-800 opacity-60' : 'bg-white border-gray-200 opacity-60'
               }`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    {rule.id}
                  </span>
                  <span className={`text-[11px] font-semibold ${t.textPrimary}`}>{rule.name}</span>
                </div>
                <p className={`text-[9px] mt-0.5 ${t.textMuted}`}>
                  Scope: {rule.scope} · Template: {rule.template} · {rule.triggers} trigger{rule.triggers === 1 ? '' : 's'}
                </p>
              </div>
              <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                rule.active
                  ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                  : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {rule.active ? 'Active' : 'Off'}
              </span>
            </div>
            <p className={`text-[9px] mt-1 ${t.textMuted}`}>
              Created by {rule.createdBy} · {rule.createdAt}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => openComposerEdit(rule)}
                className={`text-[10px] inline-flex items-center gap-1 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}>
                <Pencil className="h-2.5 w-2.5" /> Edit
              </button>
              <button
                onClick={() => {
                  const nextActive = !rule.active;
                  // Apply the toggle to local state so the chip flips immediately.
                  if (customRules.some(c => c.id === rule.id)) {
                    setCustomRules(prev => prev.map(c => c.id === rule.id ? { ...c, active: nextActive } : c));
                  } else {
                    setSeededOverrides(prev => ({ ...prev, [rule.id]: { ...(prev[rule.id] ?? {}), active: nextActive } }));
                  }
                  logUserAction({
                    kind: 'rule-toggle',
                    entity: { type: 'rule', id: rule.id },
                    summary: `${nextActive ? 'Enabled' : 'Disabled'} ${rule.id} · ${rule.name}`,
                    meta: { active: nextActive, prior: rule.active },
                  });
                  toast.success(`${nextActive ? 'Enabled' : 'Disabled'} ${rule.id}`, { description: rule.name });
                }}
                className={`text-[10px] inline-flex items-center gap-1 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}>
                {rule.active ? <PauseCircle className="h-2.5 w-2.5" /> : <PlayCircle className="h-2.5 w-2.5" />}
                {rule.active ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Disputes tab body — open + recent disputes (Phase 4d) ────────
  const disputesTabBody = (
    <div className="p-4 space-y-3">
      <div>
        <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Disputes</h2>
        <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
          Open quality / SLA / override cases. Approve, reject, or escalate.
        </p>
      </div>
      {finnsDisputes.length === 0 ? (
        <div className={`text-[11px] py-6 text-center rounded-lg border border-dashed ${
          isDark ? 'border-gray-800 text-gray-500' : 'border-gray-300 text-gray-500'
        }`}>
          No open disputes.
        </div>
      ) : (
        <div className="space-y-2">
          {finnsDisputes.map(d => {
            const priColor =
              d.priority === 'high'   ? isDark ? 'text-red-400'    : 'text-red-600'
              : d.priority === 'medium' ? isDark ? 'text-amber-400' : 'text-amber-700'
                                        : isDark ? 'text-gray-400'   : 'text-gray-600';
            const statusColor =
              d.status === 'escalated' ? isDark ? 'bg-red-500/15 text-red-400'      : 'bg-red-50 text-red-700'
              : d.status === 'open'    ? isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                                        : isDark ? 'bg-gray-800 text-gray-400'     : 'bg-gray-100 text-gray-600';
            return (
              <div key={d.id}
                   className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                        {d.id}
                      </span>
                      <span className={`text-[11px] font-semibold ${t.textPrimary}`}>{d.refPoId}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wide ${priColor}`}>● {d.priority}</span>
                    </div>
                    <p className={`text-[10px] mt-1 leading-relaxed ${t.textSecondary}`}>{d.reason}</p>
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${statusColor}`}>
                    {d.status}
                  </span>
                </div>
                <p className={`text-[9px] mt-1 ${t.textMuted}`}>
                  Raised by {d.raisedBy}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => {
                      logUserAction({
                        kind: 'dispute-approve',
                        entity: { type: 'dispute', id: d.id },
                        summary: `Approved dispute ${d.id} · ${d.refPoId} · ${d.reason.slice(0, 60)}${d.reason.length > 60 ? '…' : ''}`,
                        details: `Raised by ${d.raisedBy}. Priority ${d.priority}.`,
                        meta: { poId: d.refPoId, raisedBy: d.raisedBy, priority: d.priority },
                      });
                      toast.success(`Approved ${d.id}`, { description: 'Override accepted. Logged to action log.' });
                    }}
                    className={`text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border ${isDark ? 'border-green-500/40 text-green-400 hover:bg-green-500/10' : 'border-green-300/70 text-green-600 hover:bg-green-50'}`}>
                    <Check className="h-2.5 w-2.5" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      logUserAction({
                        kind: 'dispute-reject',
                        entity: { type: 'dispute', id: d.id },
                        summary: `Rejected dispute ${d.id} · ${d.refPoId}`,
                        details: `Raised by ${d.raisedBy}. Priority ${d.priority}.`,
                        outcome: 'overridden',
                        meta: { poId: d.refPoId, raisedBy: d.raisedBy, priority: d.priority },
                      });
                      toast.warning(`Rejected ${d.id}`, { description: 'Override denied. Logged to action log.' });
                    }}
                    className={`text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border ${isDark ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-red-300/70 text-red-600 hover:bg-red-50'}`}>
                    <X className="h-2.5 w-2.5" /> Reject
                  </button>
                  <button
                    onClick={() => {
                      logUserAction({
                        kind: 'dispute-escalate',
                        entity: { type: 'dispute', id: d.id },
                        summary: `Escalated dispute ${d.id} · ${d.refPoId} to F&B Director`,
                        details: `Raised by ${d.raisedBy}. Awaiting Director sign-off.`,
                        outcome: 'pending',
                        meta: { poId: d.refPoId, raisedBy: d.raisedBy, priority: d.priority },
                      });
                      toast.info(`Escalated ${d.id}`, { description: 'Routed to F&B Director for sign-off.' });
                    }}
                    className={`text-[10px] inline-flex items-center gap-1 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}>
                    Escalate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Left-panel shell with tab strip ──────────────────────────────
  const TAB_DEFS: { id: LeftTab; label: string; icon: typeof Gauge; count?: number }[] = [
    { id: 'activity', label: 'Activity', icon: Gauge },
    { id: 'agents',   label: 'Agents',   icon: Bot,    count: finnsAgents.length },
    { id: 'policy',   label: 'Policy',   icon: Shield, count: visiblePolicyRules.length },
    { id: 'disputes', label: 'Disputes', icon: Scale,  count: openDisputeCount },
  ];

  const leftPanel = (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className={`shrink-0 flex border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        {TAB_DEFS.map(tab => {
          const Icon = tab.icon;
          const active = leftTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setLeftTab(tab.id)}
              className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-2.5 text-[10px] font-semibold transition-colors border-b-2 ${
                active
                  ? isDark ? 'text-[#a3b085] border-[#87986a]' : 'text-[#6b7a54] border-[#87986a]'
                  : isDark ? 'text-gray-500 border-transparent hover:text-gray-300' : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}>
              <Icon className="h-3 w-3" />
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`ml-0.5 text-[9px] px-1 py-0 rounded-full font-bold ${
                  active
                    ? isDark ? 'bg-[#87986a]/30 text-[#a3b085]' : 'bg-[#87986a]/20 text-[#6b7a54]'
                    : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {leftTab === 'activity' && activityTabBody}
        {leftTab === 'agents'   && agentsTabBody}
        {leftTab === 'policy'   && policyTabBody}
        {leftTab === 'disputes' && disputesTabBody}
      </div>
    </div>
  );

  // ── CENTER PANEL — Autonomous Event Ledger ──────────────────────

  const centerPanel = (
    <div className="p-6 space-y-6">
      {/* Learning Phase banner */}
      {isWarmingUp && (
        <div className={`flex items-start gap-3 p-3.5 rounded-lg border ${
          isDark ? 'bg-teal-500/8 border-teal-500/30' : 'bg-teal-50 border-teal-200'
        }`}>
          <Gauge className={`h-4 w-4 shrink-0 mt-0.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
              Learning Phase — {warmupPct}% calibrated ({EVENTS.length}/{WARMUP_THRESHOLD} events)
            </p>
            <p className={`text-[10px] mt-0.5 leading-relaxed ${isDark ? 'text-teal-400/80' : 'text-teal-700'}`}>
              The AI is still building its confidence baseline. Throttle settings and confidence scores may shift as more events are recorded. Categories marked "Calibrated" in the left panel have enough data to be trusted.
            </p>
            <div className={`mt-2 h-1 rounded-full ${isDark ? 'bg-teal-900' : 'bg-teal-100'}`}>
              <div className="h-1 rounded-full bg-teal-500 transition-all" style={{ width: `${warmupPct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Capital Efficiency summary */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bot className={`h-4 w-4 ${t.sageIcon}`} strokeWidth={1.5} />
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Today's Autonomous Ledger</h2>
          <span className={`ml-auto text-[10px] ${t.textMuted}`}>{filtered.length} of {EVENTS.length} events shown</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {/* Actions Executed */}
          <div className={t.cardBorder}>
            <Zap className={`h-4 w-4 mb-1.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} strokeWidth={1.5} />
            <span className={`text-[10px] ${t.textMuted}`}>Actions Executed</span>
            <div className={`text-sm font-semibold mt-0.5 ${t.textPrimary}`}>{dailyCapital.tasksCompleted}</div>
          </div>
          {/* Direct Savings — sparkline */}
          <div className={`${t.cardBorder} flex flex-col`}>
            <DollarSign className={`h-4 w-4 mb-1 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} strokeWidth={1.5} />
            <span className={`text-[10px] ${t.textMuted}`}>Direct Savings</span>
            <div className={`text-sm font-semibold mt-0.5 mb-1 ${t.textPrimary}`}>${dailyCapital.moneySaved.toLocaleString()}</div>
            <Sparkline data={SAVINGS_24H} color="#22c55e" />
          </div>
          {/* Capital Preserved — sparkline */}
          <div className={`${t.cardBorder} flex flex-col`}>
            <TrendingUp className={`h-4 w-4 mb-1 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} strokeWidth={1.5} />
            <span className={`text-[10px] ${t.textMuted}`}>Capital Preserved</span>
            <div className={`text-sm font-semibold mt-0.5 mb-1 ${t.textPrimary}`}>${dailyCapital.capitalPreserved.toLocaleString()}</div>
            <Sparkline data={CAPITAL_24H} color="#87986a" />
          </div>
          {/* In Undo Window — now mode-aware */}
          <div className={t.cardBorder}>
            <div className="flex items-center justify-between mb-1.5">
              <Timer className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} strokeWidth={1.5} />
              <span className={`text-[8px] uppercase tracking-wide font-bold ${
                undoMode === 'hard-60'
                  ? isDark ? 'text-amber-300' : 'text-amber-700'
                  : undoMode === 'ledger-close'
                    ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                    : isDark ? 'text-blue-300' : 'text-blue-700'
              }`}>
                {undoMode === 'hard-60' ? '60-min' : undoMode === 'ledger-close' ? 'ledger' : 'mixed'}
              </span>
            </div>
            <span className={`text-[10px] ${t.textMuted}`}>In Undo Window</span>
            <div className={`text-sm font-semibold mt-0.5 ${t.textPrimary}`}>{dailyCapital.undoWindowCount}</div>
          </div>
        </div>

        {/* ═══ Undo Window Policy ═══
            Per the Expert Void check: hard 60-min timers reflect external commit
            physics (truck leaves, payment clears). Ledger-close models the human
            "approve the day" mental model. Per-class is the recommended hybrid. */}
        <div className={`mt-3 p-3 rounded-xl border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Timer className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} strokeWidth={1.5} />
            <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Undo Window Policy</h3>
            {!ledgerApproved && undoMode !== 'hard-60' && (
              <button onClick={() => { setLedgerApproved(true); toast.success('Daily ledger approved', { description: 'Reversible actions are now finalized for today.' }); }}
                className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  isDark ? 'bg-[#87986a]/15 border border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/25'
                        : 'bg-[#f4f6f0] border border-[#87986a]/40 text-[#6b7a54] hover:bg-[#e8eddf]'
                }`}>
                <CheckCircle className="h-3 w-3" /> Approve Today's Ledger
              </button>
            )}
            {ledgerApproved && undoMode !== 'hard-60' && (
              <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
              }`}>
                <CheckCircle className="h-2.5 w-2.5" /> Ledger approved · windows closed
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'hard-60' as UndoMode, label: 'Hard 60-min timer', sub: 'Real-world commit physics' },
              { id: 'ledger-close' as UndoMode, label: 'Until ledger close', sub: 'Daily Approve gate' },
              { id: 'per-class' as UndoMode, label: 'Per-class (default)', sub: 'External 60m · Internal until close' },
            ].map(m => {
              const active = undoMode === m.id;
              return (
                <button key={m.id} onClick={() => { setUndoMode(m.id); if (m.id === 'hard-60') setLedgerApproved(false); }}
                  className={`text-left p-2 rounded-lg border transition-colors ${
                    active
                      ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/50 ring-1 ring-[#87986a]/30' : 'bg-[#f4f6f0] border-[#87986a]/50 ring-1 ring-[#87986a]/30'
                      : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:border-gray-700' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className={`text-[11px] font-bold ${t.textPrimary}`}>{m.label}</div>
                  <div className={`text-[9px] ${t.textMuted} leading-tight mt-0.5`}>{m.sub}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Action Log (Phase 4f.3 consumer) ─────────────────────── */}
      <ActionLogPanel
        isDark={isDark}
        t={t}
        autonomyMode={autonomyMode}
        actorFilter={actorFilter}
        setActorFilter={setActorFilter}
        entries={actionLogEntries}
      />

      {/* Activity Timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Activity Timeline</h3>
          <div className="flex items-center gap-2 text-[10px]">
            {confFilter !== 'all' && (
              <button onClick={() => setConfFilter('all')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${isDark ? 'bg-[#87986a]/15 text-[#a3b085] hover:bg-[#87986a]/25' : 'bg-[#f4f6f0] text-[#6b7a54] hover:bg-[#e6ecda]'}`}>
                <XCircle className="h-2.5 w-2.5" /> Clear confidence filter
              </button>
            )}
            {typeFilter !== 'all' && (
              <button onClick={() => setTypeFilter('all')}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${isDark ? 'bg-[#87986a]/15 text-[#a3b085] hover:bg-[#87986a]/25' : 'bg-[#f4f6f0] text-[#6b7a54] hover:bg-[#e6ecda]'}`}>
                <XCircle className="h-2.5 w-2.5" /> Clear type filter
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className={`text-xs py-6 text-center ${t.textMuted}`}>
            No events match your filters.
          </div>
        ) : (
          <div>
            {filtered.map((event, idx) => {
              const cfg = EVENT_CONFIG[event.type];
              const Icon = cfg.icon;
              const agent = AGENTS[event.agent];
              const AgentIcon = agent?.icon ?? Bot;
              const catColor = CATEGORY_COLORS[event.category];
              const actionColor = ACTION_COLORS[event.type];
              const isSelected = selectedEventId === event.id;
              const isReversed = reversedIds.has(event.id);
              const isSuspended = suspendedAgents.has(event.agent);
              const isIntercepted = interceptedIds.has(event.id);
              const withinUndo = undoOpenFor(event);
              const isExternal = isExternalBound(event);
              const undoPct = withinUndo && (undoMode === 'hard-60' || (undoMode === 'per-class' && isExternal))
                ? Math.max(0, 100 - (event.minutesAgo / 60) * 100)
                : withinUndo ? 100 : 0;
              const source = getEventSource(event);

              const isHighlighted = highlightEventId === event.id;
              return (
                <div key={event.id} data-event-id={event.id}>
                  <div
                    onClick={() => !isReversed && setSelectedEventId(event.id)}
                    style={isHighlighted ? { animation: 'flash-event 2200ms ease-out' } : undefined}
                    className={`relative rounded-xl border transition-all overflow-hidden ${
                      isReversed
                        ? isDark ? 'border-gray-800 bg-[#1a1a1a] opacity-50 cursor-default' : 'border-gray-200 bg-white opacity-50 cursor-default'
                        : isSelected
                          ? `cursor-pointer ${isDark ? 'border-[#87986a]/50 bg-[#87986a]/8 ring-1 ring-[#87986a]/20' : 'border-[#87986a]/50 bg-[#f4f6f0] ring-1 ring-[#87986a]/20'}`
                          : `cursor-pointer ${isDark ? 'border-gray-800 bg-[#1a1a1a] hover:border-gray-700' : 'border-gray-200 bg-white hover:border-gray-300'}`
                    }`}
                  >
                    {/* Layer 1 — Category left stripe */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: catColor }} />

                    <div className="pl-4 pr-3 py-3">
                      {/* Status chips: Reversed · Intercepted · Agent Suspended */}
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        {isReversed && (
                          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                            <RotateCcw className="h-2.5 w-2.5" strokeWidth={1.5} />
                            Reversed by Admin · working capital restored
                          </span>
                        )}
                        {isIntercepted && !isReversed && (
                          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${
                            isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                          }`} title={`Confidence ${event.confidence}% < ${confidenceGuardrail}% guardrail — needs your action.`}>
                            <AlertTriangle className="h-2.5 w-2.5" strokeWidth={1.5} />
                            Intercepted · Probationary (below {confidenceGuardrail}% guardrail)
                          </span>
                        )}
                        {isSuspended && !isReversed && (
                          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${
                            isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-700'
                          }`}>
                            <PauseCircle className="h-2.5 w-2.5" strokeWidth={1.5} />
                            {agent?.name} Suspended
                          </span>
                        )}
                      </div>

                      {/* Row 1 — Event type + agent + confidence + time */}
                      <div className={`flex items-center gap-2 mb-1.5 ${isReversed ? 'line-through decoration-gray-400' : ''}`}>
                        {/* Layer 2 — Action icon bg */}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                             style={{ background: `${actionColor}22` }}>
                          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: actionColor }} />
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                              style={{ background: `${actionColor}18`, color: actionColor }}>
                          {cfg.label}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); openAgentGovernance(event.agent); }}
                          title={`Open ${agent?.name}'s Employment Contract in Governance`}
                          className={`text-[10px] shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} ${t.textSecondary}`}>
                          <AgentIcon className="h-2.5 w-2.5" strokeWidth={1.5} style={{ color: agent?.accent }} />
                          <span className="font-mono">{agent?.id}</span>
                          <span className="text-[9px]">· {agent?.role}</span>
                          <ExternalLink className="h-2 w-2 opacity-60" />
                        </button>
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <Percent className={`h-2.5 w-2.5 ${confidenceColor(event.confidence, isDark)}`} strokeWidth={1.5} />
                            <span className={`text-[10px] font-bold ${confidenceColor(event.confidence, isDark)}`}>
                              {event.confidence}%
                            </span>
                          </div>
                          <span className={`text-[10px] ${t.textMuted}`}>{relativeTimeLabel(event.minutesAgo)}</span>
                        </div>
                      </div>

                      {/* Row 2 — Description (clickable deep-link to source) */}
                      <div className="flex items-start gap-2 mb-2">
                        <p className={`text-xs leading-relaxed flex-1 ${isReversed ? `line-through ${t.textMuted}` : t.textPrimary}`}>
                          {event.description}
                        </p>
                        {source && !isReversed && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openEventSource(event); }}
                            title={source.label}
                            className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                              isDark ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}>
                            <ExternalLink className="h-2.5 w-2.5" />
                            {source.label}
                          </button>
                        )}
                      </div>

                      {/* Row 3 — Confidence bar + saving */}
                      {!isReversed && (
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-1 max-w-[160px]">
                            <div className={`h-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                              <div className="h-1 rounded-full" style={{
                                width: `${event.confidence}%`,
                                background: event.confidence >= 90 ? '#22c55e' : event.confidence >= 80 ? '#f59e0b' : '#ef4444',
                              }} />
                            </div>
                          </div>
                          {event.saving !== null && (
                            <span className="text-[10px] text-green-500 font-semibold">
                              +${event.saving.toLocaleString()} direct
                            </span>
                          )}
                          {event.capitalPreserved > 0 && (
                            <span className={`text-[10px] ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                              ${event.capitalPreserved.toLocaleString()} capital preserved
                            </span>
                          )}
                        </div>
                      )}

                      {/* Row 4 — Safe-to-Cancel + micro-actions */}
                      {!isReversed && (
                        <div className="flex items-center gap-2">
                          {withinUndo ? (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Timer className="h-2.5 w-2.5 text-amber-500 shrink-0" strokeWidth={1.5} />
                              <div className={`flex-1 max-w-[120px] h-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                <div className="h-1 rounded-full bg-amber-500" style={{ width: `${undoPct}%` }} />
                              </div>
                              <span className="text-[9px] text-amber-500 font-medium shrink-0">
                                Safe-to-Cancel · {Math.max(0, 60 - event.minutesAgo)}m left
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-1">
                              <CheckCircle className={`h-2.5 w-2.5 ${t.textMuted}`} strokeWidth={1.5} />
                              <span className={`text-[9px] ${t.textMuted}`}>
                                {event.rollbackable ? 'Undo window expired' : 'Action finalized'}
                              </span>
                            </div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedEventId(event.id); }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                              isDark ? 'border border-gray-700 text-gray-300 hover:bg-gray-800' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Eye className="h-2.5 w-2.5" strokeWidth={1.5} /> Explain Logic
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (withinUndo) setRollbackPromptId(event.id); }}
                            disabled={!withinUndo}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                              !withinUndo
                                ? isDark ? 'border border-gray-800 text-gray-600 cursor-not-allowed' : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                                : isDark ? 'border border-amber-500/40 text-amber-400 hover:bg-amber-500/10' : 'border border-amber-500/40 text-amber-600 hover:bg-amber-50'
                            }`}
                          >
                            <Undo2 className="h-2.5 w-2.5" strokeWidth={1.5} /> {event.rollbackable ? 'Rollback' : 'Locked'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* System Heartbeat — vertical slate connector between events */}
                  {idx < filtered.length - 1 && (
                    <div className="flex justify-start h-3 pl-[1.375rem]">
                      <div className={`w-px h-full ${isDark ? 'bg-slate-600/50' : 'bg-slate-300/70'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── RIGHT PANEL — Transparency Copilot ──────────────────────────

  const rightPanel = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {selectedEvent ? (() => {
          const agent = AGENTS[selectedEvent.agent];
          const AgentIcon = agent?.icon ?? Bot;
          const cfg = EVENT_CONFIG[selectedEvent.type];
          const catColor = CATEGORY_COLORS[selectedEvent.category];
          const withinUndo = selectedEvent.rollbackable && selectedEvent.minutesAgo <= 60;
          return (
            <>
              <div className={t.section}>
                <div className="flex items-center gap-2 mb-3">
                  <Bot className={`h-4 w-4 ${t.sageIcon}`} strokeWidth={1.5} />
                  <div className="min-w-0">
                    <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Agent Reasoning Chain</h3>
                    <p className={`text-[10px] ${t.textMuted} truncate`}>Why this action was taken</p>
                  </div>
                </div>

                {/* Agent identity card — clickable + Suspend button */}
                <div className={`p-2.5 rounded-lg border mb-2.5`}
                     style={{ background: `${agent?.accent ?? '#87986a'}12`, borderColor: `${agent?.accent ?? '#87986a'}40` }}>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${agent?.accent ?? '#87986a'}33` }}>
                      <AgentIcon className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: agent?.accent ?? '#87986a' }} />
                    </span>
                    <button onClick={() => openAgentGovernance(selectedEvent.agent)}
                      title="Open Employment Contract in Governance"
                      className="min-w-0 text-left hover:underline">
                      <div className={`text-[11px] font-semibold truncate ${t.textPrimary} flex items-center gap-1`}>
                        {agent?.name} · {agent?.role}
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </div>
                      <div className={`font-mono text-[9px] ${t.textMuted}`}>{agent?.id}</div>
                    </button>
                    <div className="ml-auto text-right">
                      <div className={`text-[10px] font-bold ${confidenceColor(selectedEvent.confidence, isDark)}`}>{selectedEvent.confidence}%</div>
                      <div className={`text-[9px] ${t.textMuted}`}>confidence</div>
                    </div>
                  </div>
                  {/* Suspend / Resume — global halt across the app */}
                  <div className="mt-2 pt-2 border-t flex items-center gap-2"
                       style={{ borderColor: `${agent?.accent ?? '#87986a'}30` }}>
                    {suspendedAgents.has(selectedEvent.agent) ? (
                      <>
                        <span className={`text-[10px] font-bold inline-flex items-center gap-1 ${
                          isDark ? 'text-red-300' : 'text-red-700'
                        }`}>
                          <PauseCircle className="h-3 w-3" /> Globally Suspended
                        </span>
                        <button onClick={() => toggleAgentSuspension(selectedEvent.agent)}
                          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors">
                          <PlayCircle className="h-3 w-3" /> Clear Suspension
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`text-[10px] ${t.textMuted}`}>Performance review available</span>
                        <button onClick={() => toggleAgentSuspension(selectedEvent.agent)}
                          className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                            isDark ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : 'border-red-500/40 text-red-700 hover:bg-red-50'
                          }`}>
                          <PauseCircle className="h-3 w-3" /> Suspend Agent
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Category + type chips */}
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                        style={{ background: `${catColor}22`, color: catColor }}>
                    {selectedEvent.category}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    {cfg.label}
                  </span>
                  <span className={`ml-auto text-[9px] ${t.textMuted}`}>{relativeTimeLabel(selectedEvent.minutesAgo)}</span>
                </div>

                {/* Why (mode-aware via AgentCTA) */}
                <AgentCTA
                  isDark={isDark}
                  variant="inline"
                  className={`p-2.5 rounded-lg mb-2 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}
                  agentLabel={AGENTS[selectedEvent.agent]
                    ? `${AGENTS[selectedEvent.agent].name} · ${AGENTS[selectedEvent.agent].role}`
                    : selectedEvent.agent}
                  reasoning={selectedEvent.reasoning.why}
                  offModeMessage="Agent receipt hidden — Off mode suppresses recommendation narratives. The Data Used table below still shows what triggered this event."
                  autoExecutionNote="This action was taken autonomously within policy. Use Override / Rollback below if you disagree."
                />

                {/* Data Points — editable key-value table (Evidence Override) */}
                <div className={`p-2.5 rounded-lg mb-2 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className={`h-3 w-3 ${t.sageIcon}`} strokeWidth={1.5} />
                    <div className={`text-[9px] uppercase tracking-wide font-semibold ${t.textMuted}`}>Data used</div>
                    <span className={`ml-auto text-[9px] ${t.textMuted}`}>Click ✎ to recalibrate</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedEvent.reasoning.dataPoints.map((dp, i) => {
                      const overrides = editedDataPoints[selectedEvent.id] ?? {};
                      const overridden = overrides[dp.label];
                      const displayValue = overridden ?? dp.value;
                      const isEditing = editingField?.eventId === selectedEvent.id && editingField.label === dp.label;
                      return (
                        <div key={i} className={`group flex items-start justify-between gap-2 px-2 py-1 -mx-2 rounded ${
                          overridden && !isEditing
                            ? isDark ? 'bg-amber-500/10' : 'bg-amber-50'
                            : ''
                        }`}>
                          <span className={`text-[10px] shrink-0 ${t.textMuted}`}>
                            {dp.label}
                            {overridden && (
                              <span className={`ml-1 text-[8px] font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}
                                    title="Admin override saved — agent will use this on next run">
                                ⚠ overridden
                              </span>
                            )}
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1 min-w-0">
                              <input
                                value={fieldDraft}
                                onChange={(e) => setFieldDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEditField(); if (e.key === 'Escape') cancelEditField(); }}
                                autoFocus
                                className={`w-32 px-1.5 py-0.5 rounded text-[10px] font-semibold outline-none border ${
                                  isDark ? 'bg-[#1a1a1a] border-amber-500/40 text-white' : 'bg-white border-amber-400/50'
                                }`}
                              />
                              <button onClick={saveEditField} title="Save" className="w-5 h-5 rounded flex items-center justify-center bg-[#87986a] text-white hover:bg-[#6b7a54]">
                                <Check className="h-2.5 w-2.5" />
                              </button>
                              <button onClick={cancelEditField} title="Cancel" className={`w-5 h-5 rounded flex items-center justify-center ${isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 min-w-0">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`text-[10px] font-semibold ${t.textPrimary}`}>{displayValue}</span>
                                {dp.delta && !overridden && (
                                  <span className={`text-[9px] leading-none ${
                                    dp.tone === 'positive' ? isDark ? 'text-green-400' : 'text-green-600'
                                    : dp.tone === 'negative' ? isDark ? 'text-red-400' : 'text-red-600'
                                    : t.textMuted
                                  }`}>{dp.delta}</span>
                                )}
                              </div>
                              <button onClick={() => startEditField(selectedEvent.id, dp.label, displayValue)}
                                title={`Recalibrate ${dp.label} — agent will use your value on next run`}
                                className={`opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center ${
                                  isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800'
                                }`}>
                                <Pencil className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alternatives */}
                <div className={`p-2.5 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className={`h-3 w-3 ${t.sageIcon}`} strokeWidth={1.5} />
                    <div className={`text-[9px] uppercase tracking-wide font-semibold ${t.textMuted}`}>Alternatives rejected</div>
                  </div>
                  <div className="space-y-1.5">
                    {selectedEvent.reasoning.alternatives.map((a, i) => (
                      <div key={i} className={`text-[10px] leading-tight`}>
                        <div className={`font-medium ${t.textPrimary}`}>{a.label}</div>
                        <div className={`${t.textMuted} italic`}>{a.rejectedBecause}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Safe-to-Cancel pill */}
              <div className={t.section}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Timer className={`h-3.5 w-3.5 ${withinUndo ? 'text-amber-500' : t.textMuted}`} strokeWidth={1.5} />
                  <h4 className={`text-xs font-semibold ${t.textPrimary}`}>Safe-to-Cancel Window</h4>
                </div>
                {withinUndo ? (
                  <div className={`p-2.5 rounded-lg border border-amber-500/40 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                    <div className={`text-[11px] font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      {Math.max(0, 60 - selectedEvent.minutesAgo)} minutes left
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-200/80' : 'text-amber-700/80'}`}>
                      Reversible — vendor confirmation required. Fees and lead-time impact depend on vendor cancellation policy. After the window closes, rollback requires manual vendor coordination.
                    </div>
                    <div className={`mt-2 h-1 rounded-full ${isDark ? 'bg-amber-500/20' : 'bg-amber-500/20'}`}>
                      <div className="h-1 rounded-full bg-amber-500" style={{ width: `${Math.max(0, 100 - (selectedEvent.minutesAgo / 60) * 100)}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className={`p-2.5 rounded-lg border ${isDark ? 'border-gray-800 bg-[#2a2a2a]' : 'border-gray-200 bg-gray-50'}`}>
                    <div className={`text-[11px] font-semibold ${t.textPrimary}`}>
                      {selectedEvent.rollbackable ? 'Undo window expired' : 'Action finalized'}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                      {selectedEvent.rollbackable
                        ? 'Rollback now requires manual vendor coordination.'
                        : 'Compliance or shipped actions cannot be reversed automatically.'}
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })() : (
          <div className={t.section}>
            <div className="flex items-center gap-2 mb-3">
              <Bot className={`h-4 w-4 ${t.sageIcon}`} strokeWidth={1.5} />
              <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Transparency Copilot</h3>
            </div>
            <p className={`text-[11px] leading-relaxed ${t.textSecondary}`}>
              Select an event in the ledger to inspect the agent's reasoning chain — why it acted, what data it used, and which alternatives it rejected.
            </p>
          </div>
        )}

        {/* Capital Efficiency summary */}
        <div className={t.section}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className={`h-4 w-4 ${t.sageIcon}`} strokeWidth={1.5} />
            <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Capital Efficiency</h3>
          </div>
          <div className={`p-3 rounded-lg border ${t.sageBg} ${t.sageBorder}`}>
            <span className={`text-[10px] ${t.textMuted}`}>Working capital preserved today</span>
            <div className="text-xl font-bold text-[#87986a] mt-0.5">${dailyCapital.capitalPreserved.toLocaleString()}</div>
            <p className={`text-[10px] mt-1.5 leading-relaxed ${t.textSecondary}`}>
              Buyamia agents avoided tying up ${dailyCapital.capitalPreserved.toLocaleString()} in premature orders, excess inventory, or bad quotes — in addition to ${dailyCapital.moneySaved.toLocaleString()} in direct savings.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-[#87986a]/15">
              <div>
                <div className={`text-[9px] ${t.textMuted}`}>Direct savings</div>
                <div className={`text-sm font-semibold ${t.textPrimary}`}>${dailyCapital.moneySaved.toLocaleString()}</div>
              </div>
              <div>
                <div className={`text-[9px] ${t.textMuted}`}>Auto-orders</div>
                <div className={`text-sm font-semibold ${t.textPrimary}`}>{dailyCapital.autoOrders}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ═══ ALWAYS-ON ATLAS CHAT (global rule) ═══ */}
      <ActivityAtlasChat isDark={isDark} t={t} />
    </div>
  );

  // ── Rollback two-choice modal ─────────────────────────────────
  const rollbackModal = (() => {
    if (!rollbackPromptId) return null;
    const event = EVENTS.find(e => e.id === rollbackPromptId);
    if (!event) return null;
    const agent = AGENTS[event.agent];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setRollbackPromptId(null)}>
        <div onClick={e => e.stopPropagation()}
          className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-[#1a1a1a] border-amber-500/40' : 'bg-white border-amber-400/50'
          }`}>
          {/* Header */}
          <div className={`px-5 py-4 border-b flex items-start gap-3 ${isDark ? 'border-gray-800 bg-amber-500/8' : 'border-gray-200 bg-amber-50/60'}`}>
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-amber-500 text-white">
              <Undo2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                Rollback &amp; Intervene
              </div>
              <h3 className={`text-sm font-bold mt-0.5 ${t.textPrimary}`}>How should I correct this?</h3>
              <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textMuted}`}>
                {event.description}
              </p>
              <p className={`text-[10px] mt-1 ${t.textMuted}`}>
                Decided by <span className={`font-mono ${t.textPrimary}`}>{agent?.id}</span> · {agent?.role} · {event.confidence}% confidence
              </p>
            </div>
            <button onClick={() => setRollbackPromptId(null)} className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Two-choice grid */}
          <div className="p-5 space-y-3">
            <button onClick={() => handleRollbackChoice(event.id, 'fix')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors group ${
                isDark ? 'border-[#87986a]/40 hover:border-[#87986a]/70 hover:bg-[#87986a]/8' : 'border-[#87986a]/40 hover:border-[#87986a]/70 hover:bg-[#f4f6f0]'
              }`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-[#87986a] text-white">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${t.textPrimary}`}>Fix &amp; Re-run</div>
                  <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textMuted}`}>
                    Revert this action, then edit the data points below (e.g., the price or quote)
                    so the agent retries with corrected inputs.
                  </p>
                  <p className={`text-[9px] mt-1 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'} font-semibold`}>
                    → Best when the AI used stale or wrong data.
                  </p>
                </div>
              </div>
            </button>
            <button onClick={() => handleRollbackChoice(event.id, 'manual')}
              className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                isDark ? 'border-amber-500/40 hover:border-amber-500/70 hover:bg-amber-500/10' : 'border-amber-400/50 hover:border-amber-500/70 hover:bg-amber-50'
              }`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-amber-500 text-white">
                  <Hand className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${t.textPrimary}`}>Manual Takeover</div>
                  <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textMuted}`}>
                    Revert this action and put the related order/SKU into Manual Mode.
                    You finish the task by hand — agent stays paused on this item until you Resume.
                  </p>
                  <p className={`text-[9px] mt-1 ${isDark ? 'text-amber-300' : 'text-amber-700'} font-semibold`}>
                    → Best when the AI's whole approach was wrong, not just the data.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className={`shrink-0 px-5 py-3 border-t flex items-center gap-2 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <button onClick={() => setRollbackPromptId(null)}
              className={`ml-auto px-3 py-2 rounded-lg text-xs font-semibold ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <>
      <style>{`
        @keyframes flash-event {
          0%   { box-shadow: 0 0 0 3px rgba(135,152,106,0.55); }
          40%  { box-shadow: 0 0 0 3px rgba(135,152,106,0.30); }
          100% { box-shadow: 0 0 0 0 rgba(135,152,106,0); }
        }
      `}</style>
      <ThreePanelLayout
        isDark={isDark}
        left={leftPanel}
        center={centerPanel}
        right={rightPanel}
      />
      {rollbackModal}
      {/* Rule Composer (Phase 4m) */}
      <RuleComposerModal
        isDark={isDark}
        isOpen={composerOpen}
        editing={editingRule}
        onClose={() => setComposerOpen(false)}
        onCreate={handleRuleCreate}
        onUpdate={handleRuleUpdate}
        onDelete={editingRule ? handleRuleDelete : undefined}
      />
    </>
  );
}
