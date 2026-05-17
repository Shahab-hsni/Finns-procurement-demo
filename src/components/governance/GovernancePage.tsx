import { useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Clock, Shield, DollarSign, Eye, FlaskConical, HelpCircle, Plus } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { IntelligencePanel } from '../IntelligencePanel';
import { DecisionLedger } from './DecisionLedger';
import { DisputePanel } from './DisputePanel';
import { InfoTooltip } from '../ui/InfoTooltip';
import { controlPlanes, lossCategories, decisionRecords } from '../../lib/mockData';
import { theme } from '../../lib/theme';
import { getTrailReturn, type TrailReturnMarker } from '../../lib/trailReturn';
import { TrailReturnPill } from '../TrailReturnPill';

const TOUR_STORAGE_KEY = 'buyamia-gov-tour-seen';

function createTour() {
  return driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    steps: [
      {
        element: '#gov-page-header',
        popover: {
          title: '👋 What is this page?',
          description: "This page shows how your AI knows when to stop itself. Every decision your AI makes is recorded here — you can push back on any decision you disagree with, and you can lock in good rulings as permanent rules.",
          side: 'bottom',
        },
      },
      {
        element: '#gov-left-panel',
        popover: {
          title: '🛡️ Four Rule Supervisors',
          description: "These four cards each represent a different set of rules your AI must always follow. Think of them as four department supervisors — one watches spending, one watches supplier trust, one enforces policy, and one lets you test new ideas safely before they go live.",
          side: 'right',
        },
      },
      {
        element: '#gov-control-plane-detail',
        popover: {
          title: '📋 What Is Each Supervisor Doing?',
          description: "Clicking a supervisor card on the left opens this view — it shows exactly what the supervisor is doing right now: how many rules it's enforcing, how many decisions it reviewed this week, and which AI agents it is watching over.",
          side: 'bottom',
        },
      },
      {
        element: '#gov-decision-ledger',
        popover: {
          title: '📒 Every AI Action, Recorded',
          description: "This is the full history of every action your AI took — every purchase ordered, every payment blocked, every renegotiation. Use the filter chips above the table to zoom into a specific problem type, like suspected fraud or delivery delays, and see exactly which AI was responsible.",
          side: 'top',
        },
      },
      {
        element: '#gov-disputes',
        popover: {
          title: '✋ Disagree? Push Back Here',
          description: "If your AI made a call you disagree with, raise a dispute here and override it. Once you approve the override, you can lock that ruling in as a permanent rule — so the AI never makes that same mistake again.",
          side: 'top',
        },
      },
      {
        element: '#gov-intel-header',
        popover: {
          title: '🤖 Atlas — Your Governance Advisor',
          description: "Atlas monitors all of your AI's decisions and flags unusual patterns. It can suggest new permanent rules, help you understand why a specific decision was made, and answer any question you have about what your AI has been doing.",
          side: 'left',
        },
      },
    ],
  });
}

interface GovernancePageProps {
  theme: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

// Control plane → governing agents
const CP_AGENT_ROLES: Record<string, string[]> = {
  'CP-POL': ['GOV-001 · Policy Enforcement', 'GOV-003 · Compliance Checker', 'GOV-004 · Audit Trail Recorder'],
  'CP-ECO': ['GOV-002 · Budget Guardian',     'GOV-006 · Loss Cap Monitor',   'REA-004 · Price Optimization'],
  'CP-TRU': ['REA-002 · Vendor Risk Scoring', 'MET-006 · Trust Aggregator',   'GOV-007 · Dispute Arbitrator'],
  'CP-SIM': ['REA-008 · Supply Chain Simulation', 'GOV-008 · Regulatory Scanner'],
};

const CP_ICONS: Record<string, typeof Shield> = {
  'CP-POL': Shield,
  'CP-ECO': DollarSign,
  'CP-TRU': Eye,
  'CP-SIM': FlaskConical,
};

const CP_WEEK_STATS: Record<string, { decisions: number; blocks: number; overrides: number }> = {
  'CP-POL': { decisions: 847, blocks: 3, overrides: 1 },
  'CP-ECO': { decisions: 234, blocks: 1, overrides: 0 },
  'CP-TRU': { decisions: 562, blocks: 0, overrides: 0 },
  'CP-SIM': { decisions: 45,  blocks: 0, overrides: 0 },
};

const STATUS_BADGE: Record<string, { dark: string; light: string }> = {
  active:  { dark: 'bg-green-500/15 text-green-400', light: 'bg-green-50 text-green-700' },
  warning: { dark: 'bg-amber-500/15 text-amber-400', light: 'bg-amber-50 text-amber-700' },
  disabled:{ dark: 'bg-red-500/15 text-red-400',     light: 'bg-red-50 text-red-700'     },
};

// Reasoning chains per decision
const REASONING_CHAINS: Record<string, {
  agentName: string;
  decisionType: string;
  steps: Array<{ label: string; detail: string; confidence: number; status: 'done' | 'passed' | 'flagged' }>;
}> = {
  'DEC-001': {
    agentName: 'EXE #001 — Purchase Order Generation',
    decisionType: 'Auto-PO Generation',
    steps: [
      { label: 'Policy Gate Check',    detail: 'PO-4821 value $2,340 — within $5,000 auto-approval cap',                       confidence: 99, status: 'passed' },
      { label: 'Supplier Trust Score', detail: 'AlphaFoods International trust score: 94/100 — above 80-point threshold',      confidence: 97, status: 'passed' },
      { label: 'Budget Availability',  detail: 'Kitchen dept has $8,200 headroom vs monthly cap ($80K)',                       confidence: 97, status: 'passed' },
      { label: 'PO Generated',         detail: 'PO-4821 dispatched to AlphaFoods — 12-stage fulfillment initiated',            confidence: 97, status: 'done'   },
    ],
  },
  'DEC-002': {
    agentName: 'REA #004 — Price Optimization',
    decisionType: 'Price Negotiation',
    steps: [
      { label: 'Market Benchmark',   detail: 'Pulled 14 coffee price points across regional exchanges',                confidence: 92, status: 'passed' },
      { label: 'Negotiation Range',  detail: 'Optimal range: 8–12% discount based on volume and market position',      confidence: 89, status: 'passed' },
      { label: 'Counter-offer Sent', detail: '8% discount request submitted to BeanHouse — accepted in 4 min',        confidence: 89, status: 'done'   },
    ],
  },
  'DEC-003': {
    agentName: 'GOV #005 — Fraud Detection',
    decisionType: 'Fraud Flag',
    steps: [
      { label: 'Pattern Analysis',     detail: 'INV-9921 matched duplicate-amount pattern from INV-9908 (same amount, different ref)',  confidence: 72, status: 'passed'  },
      { label: 'Vendor History Check', detail: 'PT Maju has 2 prior duplicate-invoice incidents in past 6 months',                      confidence: 72, status: 'flagged' },
      { label: 'Escalation Triggered', detail: 'Invoice held — auto-clear blocked below 80% confidence; Finance Team notified',         confidence: 72, status: 'flagged' },
    ],
  },
  'DEC-004': {
    agentName: 'EXE #006 — Inventory Auto-Reorder',
    decisionType: 'Auto-Reorder',
    steps: [
      { label: 'Stock Level Check',  detail: 'Olive oil at 4% of capacity — below 8% reorder trigger threshold',    confidence: 95, status: 'passed' },
      { label: 'Supplier Selection', detail: 'Mediterranean Direct selected — lowest cost + 94 trust score',        confidence: 95, status: 'passed' },
      { label: 'Reorder Triggered',  detail: 'Auto-reorder placed for 24 units — ETA 3 days',                      confidence: 95, status: 'done'   },
    ],
  },
  'DEC-005': {
    agentName: 'SEN #003 — Demand Classification',
    decisionType: 'Demand Reclassification',
    steps: [
      { label: 'Signal Detection',     detail: 'Tomato sales velocity up 22% vs prior 4-week average across 6 outlets',      confidence: 84, status: 'passed' },
      { label: 'Seasonal Correlation', detail: 'Summer uplift accounts for ~8% — remaining 14% is trend-driven',              confidence: 84, status: 'passed' },
      { label: 'Reclassification',     detail: 'Changed "seasonal" → "trending-up" — increases reorder buffer automatically', confidence: 84, status: 'done'   },
    ],
  },
  'DEC-006': {
    agentName: 'GOV #002 — Budget Guardian',
    decisionType: 'Budget Override Block',
    steps: [
      { label: 'Spend Request Received', detail: '$18,000 equipment purchase request from Kitchen department',                confidence: 99, status: 'passed'  },
      { label: 'Monthly Cap Check',      detail: 'Kitchen dept at $94,200 vs $80,000 monthly cap — already exceeded',        confidence: 99, status: 'flagged' },
      { label: 'Auto-block Applied',     detail: 'Purchase blocked and escalated to Operations Manager for override decision', confidence: 99, status: 'flagged' },
    ],
  },
  'DEC-007': {
    agentName: 'MET #001 — Agent Orchestrator',
    decisionType: 'Agent Scaling',
    steps: [
      { label: 'Throughput Analysis', detail: 'Peak-hour: Stage 1 at 340 ops/min — 14% above baseline',             confidence: 91, status: 'passed' },
      { label: 'Scaling Decision',    detail: 'Scaling sensing tier 6→8 agents — within auto-scale policy',        confidence: 91, status: 'passed' },
      { label: 'Agents Activated',    detail: 'SEN-007 and SEN-008 brought online — Stage 1 throughput normalized', confidence: 91, status: 'done'   },
    ],
  },
  'DEC-008': {
    agentName: 'EXE #003 — Payment Processing',
    decisionType: 'Payment Execution',
    steps: [
      { label: 'Early Payment Window', detail: 'Pacific Supply invoice eligible for 2% early payment discount (24h window)', confidence: 98, status: 'passed' },
      { label: 'Cashflow Check',       detail: 'Available operating cash $240K — well above $12K payment threshold',        confidence: 98, status: 'passed' },
      { label: 'Payment Dispatched',   detail: 'Early payment processed — $240 discount captured on $12,000 invoice',       confidence: 98, status: 'done'   },
    ],
  },
};

// ── Sub-components ────────────────────────────────────────────

const POLICY_TEMPLATES = [
  { id: 'spend-cap', label: 'Spend Cap', desc: 'Block any PO above a threshold without manual approval.' },
  { id: 'vendor-trust', label: 'Vendor Trust Floor', desc: 'Reject quotes from vendors below a minimum trust score.' },
  { id: 'fraud-hold', label: 'Fraud Hold', desc: 'Auto-hold invoices matching duplicate-amount patterns until reviewed.' },
  { id: 'delivery-sla', label: 'Delivery SLA Breach', desc: 'Escalate to Ops Manager if estimated delivery exceeds contracted SLA.' },
];

function ControlPlaneDetail({ cpId, isDark }: { cpId: string; isDark: boolean }) {
  const t = theme(isDark);
  const cp = controlPlanes.find(c => c.id === cpId);
  const [policyCreatorOpen, setPolicyCreatorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [ruleType, setRuleType] = useState('threshold');
  const [ruleThreshold, setRuleThreshold] = useState('');
  const [ruleScope, setRuleScope] = useState('all-vendors');

  if (!cp) return null;
  const Icon = CP_ICONS[cpId] || Shield;
  const badge = STATUS_BADGE[cp.status];
  const stats = CP_WEEK_STATS[cpId];
  const agents = CP_AGENT_ROLES[cpId] ?? [];

  return (
    <>
    <div className={`${t.cardPanel} overflow-hidden`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-[#87986a]/15' : 'bg-[#f4f6f0]'}`}>
          <Icon className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${t.textPrimary}`}>{cp.name}</h3>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? badge.dark : badge.light}`}>{cp.status}</span>
          </div>
          <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Last updated {cp.lastUpdated}</p>
        </div>
        <button
          onClick={() => setPolicyCreatorOpen(true)}
          className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors shrink-0 ${
            isDark ? 'border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#87986a]/50 text-[#6b7a54] hover:bg-[#f4f6f0]'
          }`}
        >
          <Plus className="h-3 w-3" />
          Add Rule
        </button>
      </div>

      <p className={`text-xs mb-3 leading-relaxed ${t.textSecondary}`}>{cp.description}</p>

      {/* First-run empty state when no rules exist */}
      {cp.ruleCount === 0 ? (
        <div className={`flex flex-col items-center gap-2 py-6 px-4 rounded-lg border border-dashed ${
          isDark ? 'border-gray-700' : 'border-gray-300'
        }`}>
          <Shield className={`h-6 w-6 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
          <p className={`text-xs font-medium text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No rules yet</p>
          <p className={`text-[10px] text-center leading-relaxed ${t.textMuted}`}>
            This control plane has no active rules. Add your first rule to start governing AI decisions in this area.
          </p>
          <button
            onClick={() => setPolicyCreatorOpen(true)}
            className="mt-1 flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-[#87986a] hover:bg-[#6b7a54] text-white font-semibold transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add First Rule
          </button>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className={`flex items-center gap-4 px-3 py-2 rounded-lg mb-3 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
            <div className="text-center">
              <div className={`text-sm font-bold ${t.textPrimary}`}>{cp.ruleCount}</div>
              <div className={`text-[9px] ${t.textMuted}`}>active rules</div>
            </div>
            <div className={`w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="text-center">
              <div className={`text-sm font-bold ${cp.coverage >= 90 ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>{cp.coverage}%</div>
              <div className={`text-[9px] ${t.textMuted}`}>coverage</div>
            </div>
            <div className={`w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="text-center">
              <div className={`text-sm font-bold ${t.textPrimary}`}>{stats.decisions.toLocaleString()}</div>
              <div className={`text-[9px] ${t.textMuted}`}>decisions/wk</div>
            </div>
            <div className={`w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="text-center">
              <div className={`text-sm font-bold ${stats.blocks > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-green-400' : 'text-green-600')}`}>{stats.blocks}</div>
              <div className={`text-[9px] ${t.textMuted}`}>blocks this wk</div>
            </div>
            {stats.overrides > 0 && (
              <>
                <div className={`w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                <div className="text-center">
                  <div className={`text-sm font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{stats.overrides}</div>
                  <div className={`text-[9px] ${t.textMuted}`}>overrides</div>
                </div>
              </>
            )}
          </div>

          {/* Coverage bar */}
          <div className="mb-3">
            <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
              <div
                className={`h-1.5 rounded-full ${cp.coverage >= 90 ? 'bg-green-500' : cp.coverage >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${cp.coverage}%` }}
              />
            </div>
          </div>

          {/* Governing agents */}
          <div>
            <p className={`text-[10px] font-semibold tracking-wider mb-2 ${t.textMuted}`}>GOVERNING AGENTS</p>
            <div className="flex flex-wrap gap-1.5">
              {agents.map(a => (
                <span key={a} className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-[#2a2a2a] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>

    {/* Policy Creator Modal */}
    {policyCreatorOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPolicyCreatorOpen(false)}>
        <div className={`relative w-full max-w-md mx-4 rounded-xl border shadow-xl ${
          isDark ? 'bg-[#1e1e1e] border-gray-700' : 'bg-white border-gray-200'
        }`} onClick={e => e.stopPropagation()}>
          <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Policy Rule</h3>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{cp.name}</p>
            </div>
            <button onClick={() => setPolicyCreatorOpen(false)} className={`p-1 rounded ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Templates */}
            <div>
              <p className={`text-[10px] font-semibold tracking-wider mb-2 ${t.textMuted}`}>CHOOSE A TEMPLATE</p>
              <div className="space-y-1.5">
                {POLICY_TEMPLATES.map(tmpl => (
                  <button key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                      selectedTemplate === tmpl.id
                        ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/50' : 'bg-[#f4f6f0] border-[#87986a]/60'
                        : isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tmpl.label}</p>
                    <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>{tmpl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Rule details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${t.textMuted}`}>RULE TYPE</label>
                <select value={ruleType} onChange={e => setRuleType(e.target.value)}
                  className={`w-full text-[11px] px-2 py-1.5 rounded border ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} focus:outline-none focus:border-[#87986a]`}>
                  <option value="threshold">Threshold</option>
                  <option value="pattern">Pattern Match</option>
                  <option value="time-window">Time Window</option>
                  <option value="score">Score Ceiling</option>
                </select>
              </div>
              <div>
                <label className={`block text-[10px] font-semibold mb-1 ${t.textMuted}`}>THRESHOLD / VALUE</label>
                <input value={ruleThreshold} onChange={e => setRuleThreshold(e.target.value)} placeholder="e.g. 5000"
                  className={`w-full text-[11px] px-2 py-1.5 rounded border ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'} focus:outline-none focus:border-[#87986a]`} />
              </div>
            </div>
            <div>
              <label className={`block text-[10px] font-semibold mb-1 ${t.textMuted}`}>SCOPE</label>
              <select value={ruleScope} onChange={e => setRuleScope(e.target.value)}
                className={`w-full text-[11px] px-2 py-1.5 rounded border ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} focus:outline-none focus:border-[#87986a]`}>
                <option value="all-vendors">All Vendors</option>
                <option value="specific-vendor">Specific Vendor</option>
                <option value="category">Category</option>
                <option value="agent">Agent</option>
              </select>
            </div>
          </div>

          <div className={`flex gap-2 p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button onClick={() => setPolicyCreatorOpen(false)}
              className={`flex-1 py-1.5 rounded text-[11px] border transition-colors ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              Cancel
            </button>
            <button onClick={() => setPolicyCreatorOpen(false)}
              className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-[#87986a] hover:bg-[#6b7a54] text-white transition-colors">
              Create Rule
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function ReasoningChainPanel({ decisionId, isDark, onClose }: { decisionId: string; isDark: boolean; onClose: () => void }) {
  const t = theme(isDark);
  const chain = REASONING_CHAINS[decisionId];
  if (!chain) return null;

  const STATUS_STYLE = {
    done:    { color: isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]', label: 'Done'    },
    passed:  { color: isDark ? 'text-green-400'  : 'text-green-600', label: 'Passed'  },
    flagged: { color: isDark ? 'text-amber-400'  : 'text-amber-700', label: 'Flagged' },
  };

  return (
    <div className={`${t.cardPanel} overflow-hidden`}>
      <div className={`flex items-center justify-between px-0 pb-3 border-b mb-4 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div>
          <span className={`text-[10px] font-semibold tracking-wider ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
            REASONING CHAIN — {decisionId}
          </span>
          <p className={`text-xs font-medium mt-0.5 ${t.textPrimary}`}>{chain.agentName}</p>
          <p className={`text-[10px] ${t.textMuted}`}>{chain.decisionType}</p>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <div className={`absolute left-[6px] top-2 bottom-2 w-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
        <div className="space-y-4">
          {chain.steps.map((step, i) => {
            const st = STATUS_STYLE[step.status];
            return (
              <div key={i} className="flex gap-3 relative">
                <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 z-10 ${
                  step.status === 'done'    ? 'bg-[#87986a]'
                  : step.status === 'passed'  ? 'bg-green-500'
                  : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-xs font-semibold ${t.textPrimary}`}>{step.label}</span>
                    <span className={`text-[9px] font-semibold shrink-0 ${st.color}`}>{st.label}</span>
                  </div>
                  <p className={`text-[10px] leading-relaxed ${t.textMuted}`}>{step.detail}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-8 h-1 rounded-full ${t.progressTrack}`}>
                      <div
                        className={`h-1 rounded-full ${step.confidence >= 90 ? 'bg-green-500' : step.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${step.confidence}%` }}
                      />
                    </div>
                    <span className={`text-[9px] ${t.textMuted}`}>{step.confidence}% confidence</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Loss Category Filter Chips ────────────────────────────────

function LossCategoryFilters({
  isDark, activeLossCategory, onSelect,
}: {
  isDark: boolean;
  activeLossCategory: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = theme(isDark);
  const TREND_COLOR: Record<string, string> = {
    increasing: isDark ? 'text-red-400'   : 'text-red-600',
    decreasing: isDark ? 'text-green-400' : 'text-green-600',
    stable:     t.textMuted,
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-[10px] shrink-0 ${t.textMuted}`}>Filter ledger:</span>
      {lossCategories.map(lc => {
        const isActive = activeLossCategory === lc.id;
        return (
          <button
            key={lc.id}
            onClick={() => onSelect(isActive ? null : lc.id)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors ${
              isActive
                ? isDark
                  ? 'bg-[#87986a]/20 border-[#87986a]/50 text-[#c8d4a8] font-semibold'
                  : 'bg-[#f4f6f0] border-[#87986a]/60 text-[#3a4a2a] font-semibold'
                : isDark
                  ? 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {lc.name}
            <span className={`${isActive ? '' : TREND_COLOR[lc.trend]}`}>·{lc.incidentCount}</span>
            {isActive && <X className="h-2.5 w-2.5 ml-0.5" />}
          </button>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export function GovernancePage({ theme: themeProp, onNavigate }: GovernancePageProps) {
  const isDark = themeProp === 'dark';

  const [selectedId, setSelectedId] = useState<string | null>('CP-POL');
  const [activeLossCategory, setActiveLossCategory] = useState<string | null>(null);
  const [hardenedDecisions, setHardenedDecisions] = useState<Set<string>>(new Set());
  const [reasoningChainId, setReasoningChainId] = useState<string | null>(null);
  const [incomingAgentId, setIncomingAgentId] = useState<string | null>(null);
  const [highlightDecisionId, setHighlightDecisionId] = useState<string | null>(null);
  const [trailReturn, setTrailReturnState] = useState<TrailReturnMarker | null>(null);

  // Read the Trail-Return marker on mount — if the user arrived via a
  // Decision Attribution Trail chip, render the return pill.
  useEffect(() => {
    setTrailReturnState(getTrailReturn());
  }, []);

  // Deep-link hash reader — accepts `agent-NN` (from Orders/Suppliers/Inventory/AI Activity)
  // and `decision=DEC-XXX` (from Decision Ledger cross-page nav and the
  // Orders Decision Attribution Trail).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw) return;
      const agentMatch = raw.match(/^agent-(\d+)$/);
      if (agentMatch) {
        const num = agentMatch[1];
        setIncomingAgentId(num);
        toast.info(`Opened Governance for Agent #${num}`, {
          description: 'Review this agent\'s decisions in the ledger below.',
        });
        window.location.hash = '';
        return;
      }
      const params = new URLSearchParams(raw);
      const decisionId = params.get('decision');
      if (decisionId) {
        // Receiver-side highlight: if the id exists in the ledger,
        // scroll to it and flash. Otherwise, fall back to an amber
        // toast so the user knows the deep-link was lossy.
        const found = decisionRecords.some(d => d.id === decisionId);
        if (found) {
          setReasoningChainId(decisionId);
          setHighlightDecisionId(decisionId);
          setTimeout(() => {
            const row = document.querySelector(`[data-decision-id="${decisionId}"]`);
            row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
          // Clear the highlight flash after the animation runs.
          setTimeout(() => setHighlightDecisionId(null), 2400);
        } else {
          toast.warning(`${decisionId} isn't in this ledger`, {
            description: 'The ledger is open for browsing — search by agent or loss category.',
          });
        }
        window.location.hash = '';
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Notify IntelligencePanel whenever the loss category filter changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('buyamia-governance-filter-changed', { detail: activeLossCategory }));
  }, [activeLossCategory]);

  // Notify IntelligencePanel whenever the selected control plane changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('buyamia-governance-cp-changed', { detail: selectedId }));
  }, [selectedId]);

  const startTour = useCallback(() => {
    createTour().drive();
  }, []);

  useEffect(() => {
    if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    const timer = setTimeout(() => startTour(), 600);
    return () => clearTimeout(timer);
  }, [startTour]);

  const handleHardenPolicy = useCallback((decisionId: string) => {
    setHardenedDecisions(prev => new Set([...prev, decisionId]));
  }, []);

  const handleOpenReasoningChain = useCallback((decisionId: string) => {
    setReasoningChainId(prev => prev === decisionId ? null : decisionId);
  }, []);

  return (
    <>
      {trailReturn && (
        <TrailReturnPill
          marker={trailReturn}
          isDark={isDark}
          onReturn={() => { setTrailReturnState(null); onNavigate?.('orders'); }}
        />
      )}
    <ThreePanelLayout
      isDark={isDark}
      left={
        <div id="gov-left-panel" className={`h-full p-4 ${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs`}>
          {/* Control planes removed — left panel will become the Activity/Agents/Policy/Disputes tabbed catalog in Phase 3h. */}
          <div>Activity & Governance left panel — pending merge</div>
        </div>
      }
      center={
        <div className="p-6 space-y-5">
          {/* Page header */}
          <div id="gov-page-header" className="flex items-center justify-between">
            <h2 className={`text-sm font-semibold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Governance & Trust
              <InfoTooltip
                text="How your AI self-regulates — every rule it follows, every decision it makes, and every override you can issue, all in one place."
                isDark={isDark}
                side="bottom"
              />
            </h2>
            <button
              onClick={startTour}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors shrink-0 ${
                isDark
                  ? 'border-gray-700 text-gray-400 hover:border-[#87986a]/50 hover:text-[#a3b085]'
                  : 'border-gray-200 text-gray-500 hover:border-[#87986a]/50 hover:text-[#6b7a54]'
              }`}
            >
              <HelpCircle className="h-3 w-3" />
              Take a tour
            </button>
          </div>

          {/* Control Plane Detail — shown when one is selected */}
          {selectedId && (
            <div id="gov-control-plane-detail">
              <ControlPlaneDetail
                cpId={selectedId}
                isDark={isDark}
              />
            </div>
          )}

          {/* Reasoning Chain — shown when an agent is clicked */}
          {reasoningChainId && (
            <ReasoningChainPanel
              decisionId={reasoningChainId}
              isDark={isDark}
              onClose={() => setReasoningChainId(null)}
            />
          )}

          {/* Decision Ledger with inline filter chips */}
          <div id="gov-decision-ledger">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-xs font-semibold flex items-center gap-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                DECISION LEDGER
                <InfoTooltip
                  text="A complete record of every action your AI has taken. Filter by problem type to quickly find what you're looking for."
                  isDark={isDark}
                  side="top"
                />
              </h3>
            </div>
            <LossCategoryFilters
              isDark={isDark}
              activeLossCategory={activeLossCategory}
              onSelect={setActiveLossCategory}
            />
            <div className="mt-3">
              <DecisionLedger
                isDark={isDark}
                activeLossCategory={activeLossCategory}
                hardenedDecisions={hardenedDecisions}
                onOpenReasoningChain={handleOpenReasoningChain}
                highlightDecisionId={highlightDecisionId}
              />
            </div>
          </div>

          <div id="gov-disputes">
            <DisputePanel
              isDark={isDark}
              hardenedDecisions={hardenedDecisions}
              onHardenPolicy={handleHardenPolicy}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      }
      right={<IntelligencePanel theme={themeProp} context="governance" />}
    />
    </>
  );
}
