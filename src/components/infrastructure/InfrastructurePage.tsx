import { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, Zap,
  Database, Shield, GitBranch, Lock,
  RefreshCw, AlertOctagon, Award, FileCheck, HelpCircle,
  CreditCard, X, Plus,
} from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { toast } from 'sonner';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { IntelligencePanel } from '../IntelligencePanel';
import { InfoTooltip } from '../ui/InfoTooltip';
import { theme as themeTokens } from '../../lib/theme';

const TOUR_STORAGE_KEY = 'buyamia-infra-tour-seen';

function createTour() {
  return driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    steps: [
      {
        element: '#infra-page-header',
        popover: {
          title: '👋 Welcome to Infrastructure',
          description: "This page is your platform's engine room. You can see live system health, authorize new build phases, and audit every AI action ever taken.",
          side: 'bottom',
        },
      },
      {
        element: '#infra-left-panel',
        popover: {
          title: '📊 Reforms & Hardening',
          description: 'Reforms are the major rebuilds happening right now. Hardening is the production readiness checklist your platform must pass. Switch between them using the tabs.',
          side: 'right',
        },
      },
      {
        element: '#infra-schematic',
        popover: {
          title: '🗺️ Live System Blueprint',
          description: 'Each block is a core part of your AI platform showing how many agents are inside it. Click any block to reveal a control lever — like boosting throughput or scaling a slow component.',
          side: 'bottom',
        },
      },
      {
        element: '#infra-deployment-queue',
        popover: {
          title: '🚀 You Are the Final Gate',
          description: "Phases marked 'Ready for Authorization' are queued and waiting. Nothing deploys until you press Start — this is your sovereign control over the platform's growth.",
          side: 'top',
        },
      },
      {
        element: '#infra-audit-log',
        popover: {
          title: '🔒 Append-Only Audit Log',
          description: "Every action every AI agent has taken is appended to this log and sealed by your Governance agents. Cryptographic sealing is being rolled out (see hardening item h7). Once complete, any alteration triggers detection and lockdown.",
          side: 'top',
        },
      },
      {
        element: '#infra-intel-header',
        popover: {
          title: '🤖 Atlas — Your Site Architect',
          description: 'Atlas monitors platform health in real time. It already diagnosed the Graph Memory latency and surfaced the fix. Ask it anything about build status, system health, or what to authorize next.',
          side: 'left',
        },
      },
    ],
  });
}

interface InfrastructurePageProps {
  theme: 'dark' | 'light';
}

// ── Types ─────────────────────────────────────────────────────────

type ReformStatus = 'complete' | 'active' | 'in-progress' | 'pending';

interface Reform {
  id: string;
  name: string;
  description: string;
  ccHours: number;
  status: ReformStatus;
  agentCount: number;
  icon: typeof Zap;
  progress: number;
}

interface HardeningRequirement {
  id: string;
  label: string;
  status: 'done' | 'in-progress' | 'pending';
  priority: 'P0' | 'P1' | 'P2';
}

interface BuildPhase {
  id: number;
  name: string;
  weeks: string;
  agentCount: number;
  status: ReformStatus;
  milestones: string[];
}

interface DagNode {
  id: string;
  name: string;
  agents: number;
  icon: typeof Zap;
  status: 'healthy' | 'degraded';
  metric: string;
  scaledMetric: string;
  actionLabel: string;
}

// ── Data ──────────────────────────────────────────────────────────

const REFORMS: Reform[] = [
  { id: 'r1', name: 'DAG Kernel Architecture',  ccHours: 480, status: 'active',      progress: 74,  agentCount: 12, description: 'Directed acyclic graph execution engine for deterministic agent orchestration', icon: GitBranch },
  { id: 'r2', name: 'Event Bus (Pub/Sub)',       ccHours: 240, status: 'complete',    progress: 100, agentCount: 8,  description: 'Kafka-style event streaming backbone connecting all 40 agents',                icon: Zap       },
  { id: 'r3', name: 'Graph Memory Store',        ccHours: 320, status: 'active',      progress: 58,  agentCount: 6,  description: 'Persistent cross-agent memory with 6 specialised graph schemas',               icon: Database  },
  { id: 'r4', name: 'Multi-tenant Isolation',    ccHours: 180, status: 'in-progress', progress: 35,  agentCount: 4,  description: 'Operator-level data partitioning and resource isolation layer',                icon: Lock      },
  { id: 'r5', name: 'Compliance Engine v2',      ccHours: 160, status: 'pending',     progress: 0,   agentCount: 3,  description: 'Automated regulatory compliance for 5 countries and 4 control planes',         icon: Shield    },
  { id: 'r6', name: 'Global Operations Layer',   ccHours: 280, status: 'in-progress', progress: 42,  agentCount: 7,  description: 'Multi-region orchestration across Indonesia, Australia, Thailand, Vietnam, Philippines', icon: Zap },
];

const HARDENING: HardeningRequirement[] = [
  { id: 'h1',  label: 'Zero-downtime deployment',          status: 'done',        priority: 'P0' },
  { id: 'h2',  label: 'Rate limiting & throttle guards',   status: 'done',        priority: 'P0' },
  { id: 'h3',  label: 'Circuit breaker pattern',           status: 'in-progress', priority: 'P0' },
  { id: 'h4',  label: 'Distributed tracing (OpenTelemetry)',status: 'in-progress',priority: 'P1' },
  { id: 'h5',  label: 'Secrets management (Vault)',        status: 'done',        priority: 'P0' },
  { id: 'h6',  label: 'RBAC enforcement',                  status: 'done',        priority: 'P0' },
  { id: 'h7',  label: 'Audit log tamper-proof sealing',    status: 'in-progress', priority: 'P1' },
  { id: 'h8',  label: 'SLA monitoring & alerting',         status: 'pending',     priority: 'P1' },
  { id: 'h9',  label: 'Disaster recovery drill automation',status: 'pending',     priority: 'P2' },
  { id: 'h10', label: 'Load testing at 10× baseline',      status: 'pending',     priority: 'P2' },
];

const BUILD_PHASES: BuildPhase[] = [
  { id: 1, name: 'Core DAG Kernel',        weeks: 'Wk 1–4',   agentCount: 12, status: 'complete', milestones: ['DAG executor live', 'Agent registry seeded', 'Basic scheduling'] },
  { id: 2, name: 'Event Bus + Connectors', weeks: 'Wk 5–8',   agentCount: 18, status: 'complete', milestones: ['Pub/Sub backbone', '18 agents connected', 'Replay buffer live'] },
  { id: 3, name: 'Intelligence Layer',     weeks: 'Wk 9–14',  agentCount: 24, status: 'active',   milestones: ['Graph memory (4/6 schemas)', 'Forecast agents active', 'Group buy kernel'] },
  { id: 4, name: 'Global Expansion',       weeks: 'Wk 15–20', agentCount: 32, status: 'pending',  milestones: ['Multi-region deploy', 'Compliance layer', 'FX hedging agents'] },
  { id: 5, name: 'Production Hardening',   weeks: 'Wk 21–26', agentCount: 40, status: 'pending',  milestones: ['Full 40-agent suite', '10× load validated', 'Grade A certification'] },
];

const DAG_NODES: DagNode[] = [
  { id: 'event-bus',      name: 'Event Bus',          agents: 8,  icon: Zap,        status: 'healthy',  metric: '2,400 ops/min',   scaledMetric: '3,200 ops/min ↑', actionLabel: '⚡ Overclock Throughput' },
  { id: 'dag-kernel',     name: 'DAG Kernel',          agents: 12, icon: GitBranch,  status: 'healthy',  metric: '340 ops/min',     scaledMetric: '420 ops/min ↑',   actionLabel: '⚖️ Rebalance DAG'        },
  { id: 'memory',         name: 'Graph Memory Store',  agents: 6,  icon: Database,   status: 'degraded', metric: '145ms latency ⚠', scaledMetric: '8ms latency ✓',   actionLabel: '✅ Scale MET #004'      },
  { id: 'compliance',     name: 'Compliance Engine',   agents: 3,  icon: Shield,     status: 'healthy',  metric: '99.8% pass rate', scaledMetric: '99.8% pass rate', actionLabel: '📋 Run Compliance Audit' },
  { id: 'payment-rails',  name: 'Payment Rails',       agents: 0,  icon: CreditCard, status: 'degraded', metric: 'No rails connected', scaledMetric: 'Rails active ✓', actionLabel: '🔌 Connect Payment Rail' },
];

const PAYMENT_RAIL_OPTIONS = [
  { id: 'swift',    name: 'SWIFT', region: 'International', desc: 'Global interbank transfers' },
  { id: 'bca',      name: 'BCA Virtual Account', region: 'Indonesia', desc: 'IDR domestic payments' },
  { id: 'paynow',   name: 'PayNow', region: 'Singapore', desc: 'SGD real-time payments' },
  { id: 'promptpay',name: 'PromptPay', region: 'Thailand', desc: 'THB instant transfers' },
  { id: 'gcash',    name: 'GCash', region: 'Philippines', desc: 'PHP mobile payments' },
];

// ── Status helpers ────────────────────────────────────────────────

function reformStatusStyle(status: ReformStatus, isDark: boolean) {
  switch (status) {
    case 'complete':    return isDark ? 'bg-green-500/15 text-green-400'   : 'bg-green-50 text-green-700';
    case 'active':      return isDark ? 'bg-[#87986a]/15 text-[#a3b085]'   : 'bg-[#f4f6f0] text-[#6b7a54]';
    case 'in-progress': return isDark ? 'bg-blue-500/15 text-blue-400'     : 'bg-blue-50 text-blue-700';
    case 'pending':     return isDark ? 'bg-gray-700 text-gray-400'        : 'bg-gray-100 text-gray-500';
  }
}

function reformStatusLabel(status: ReformStatus) {
  switch (status) {
    case 'complete':    return 'Complete';
    case 'active':      return 'Active';
    case 'in-progress': return 'In Progress';
    case 'pending':     return 'Pending';
  }
}

function hardeningStatusIcon(status: HardeningRequirement['status']) {
  switch (status) {
    case 'done':        return <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />;
    case 'in-progress': return <RefreshCw className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
    case 'pending':     return <Clock className="h-3.5 w-3.5 text-gray-500 shrink-0" />;
  }
}

type PhaseState = 'complete' | 'active' | 'needs-auth' | 'authorized' | 'locked';

function getPhaseState(phase: BuildPhase, authorizedPhases: Set<number>): PhaseState {
  if (phase.status === 'complete') return 'complete';
  if (phase.status === 'active')   return 'active';
  if (phase.id === 4) return authorizedPhases.has(4) ? 'authorized' : 'needs-auth';
  if (phase.id === 5) {
    if (!authorizedPhases.has(4)) return 'locked';
    return authorizedPhases.has(5) ? 'authorized' : 'needs-auth';
  }
  return 'locked';
}

// ── Component ─────────────────────────────────────────────────────

export function InfrastructurePage({ theme }: InfrastructurePageProps) {
  const isDark = theme === 'dark';
  const t = themeTokens(isDark);

  const [tab, setTab]                     = useState<'reforms' | 'hardening'>('reforms');
  const [selectedNode, setSelectedNode]   = useState<string | null>(null);
  const [scaledNodes, setScaledNodes]     = useState<Set<string>>(new Set());
  const [authorizedPhases, setAuthorized] = useState<Set<number>>(new Set());
  const [tamperDetected, setTamperDetected] = useState(false);
  const [lockdownActive, setLockdownActive] = useState(false);
  const [connectedRails, setConnectedRails] = useState<Set<string>>(new Set());
  const [railConnectorOpen, setRailConnectorOpen] = useState(false);

  const doneCount  = HARDENING.filter(h => h.status === 'done').length;
  const totalCC    = REFORMS.reduce((s, r) => s + r.ccHours, 0);
  const completedCC = REFORMS.filter(r => r.status === 'complete').reduce((s, r) => s + r.ccHours, 0);

  const handleScaleNode = useCallback((nodeId: string) => {
    setScaledNodes(prev => new Set([...prev, nodeId]));
    window.dispatchEvent(new CustomEvent('buyamia-infra-agent-scaled', { detail: nodeId }));
  }, []);

  const handleTamper = useCallback(() => {
    setTamperDetected(true);
    setLockdownActive(true);
    window.dispatchEvent(new CustomEvent('buyamia-infra-lockdown', { detail: true }));
  }, []);

  const handleClearLockdown = useCallback(() => {
    setTamperDetected(false);
    setLockdownActive(false);
    window.dispatchEvent(new CustomEvent('buyamia-infra-lockdown', { detail: false }));
  }, []);

  const startTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
    const t = createTour();
    t.drive();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      const timer = setTimeout(startTour, 600);
      return () => clearTimeout(timer);
    }
  }, [startTour]);

  // Listen for right-panel scale action
  useEffect(() => {
    const handler = () => setScaledNodes(prev => new Set([...prev, 'memory']));
    window.addEventListener('buyamia-infra-scale-from-panel', handler);
    return () => window.removeEventListener('buyamia-infra-scale-from-panel', handler);
  }, []);

  // ── Left Panel ────────────────────────────────────────────────────

  const leftPanel = (
    <div id="infra-left-panel" className="flex flex-col h-full">
      <div className={t.section}>
        <div className="flex items-center gap-1.5">
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Infrastructure</h2>
          <InfoTooltip text="Your platform's two health areas: Reforms (active rebuilds in progress) and Hardening (production readiness checklist). Switch with the tabs below." isDark={isDark} side="right" />
        </div>
      </div>

      <div className={t.section}>
        <div className="grid grid-cols-2 gap-2">
          <div className={t.card}>
            <span className={`text-[10px] ${t.textMuted}`}>CC Hours</span>
            <div className={`text-sm font-bold mt-0.5 ${t.textPrimary}`}>{completedCC.toLocaleString()}</div>
            <span className={`text-[10px] ${t.textMuted}`}>of {totalCC.toLocaleString()} total</span>
          </div>
          <div className={t.card}>
            <span className={`text-[10px] ${t.textMuted}`}>Hardening</span>
            <div className={`text-sm font-bold mt-0.5 ${doneCount >= 7 ? 'text-green-400' : 'text-amber-400'}`}>{doneCount}/{HARDENING.length}</div>
            <span className={`text-[10px] ${t.textMuted}`}>requirements met</span>
          </div>
        </div>
      </div>

      {/* Tab toggle */}
      <div className={`flex gap-0.5 mx-4 mb-3 p-0.5 rounded-lg ${isDark ? 'bg-[#1a1a1a] border border-gray-800' : 'bg-gray-100 border border-gray-200'}`}>
        {(['reforms', 'hardening'] as const).map(id => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-all capitalize ${
              tab === id ? 'bg-[#87986a] text-white shadow-sm' : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      {tab === 'reforms' && (
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
          {REFORMS.map((r) => {
            const RIcon = r.icon;
            return (
              <div
                key={r.id}
                className={`w-full text-left p-3 rounded-lg border ${
                  isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <RIcon className={`h-3.5 w-3.5 shrink-0 ${t.sageIcon}`} />
                    <span className={`text-xs font-medium ${t.textPrimary}`}>{r.name}</span>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${reformStatusStyle(r.status, isDark)}`}>
                    {reformStatusLabel(r.status)}
                  </span>
                </div>
                {r.status !== 'pending' && r.status !== 'complete' && (
                  <div className={`h-1 rounded-full ${t.progressTrack}`}>
                    <div className="h-full rounded-full bg-[#87986a]" style={{ width: `${r.progress}%` }} />
                  </div>
                )}
                <div className="flex justify-between mt-1">
                  <span className={`text-[10px] ${t.textMuted}`}>{r.ccHours} CC hrs</span>
                  <span className={`text-[10px] ${t.textMuted}`}>{r.agentCount} agents</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'hardening' && (
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5">
          {HARDENING.map((h) => (
            <div
              key={h.id}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${
                h.status === 'done'        ? isDark ? 'bg-green-500/8 border-green-500/20'  : 'bg-green-50 border-green-200'
                : h.status === 'in-progress' ? isDark ? 'bg-blue-500/8 border-blue-500/15' : 'bg-blue-50 border-blue-200'
                :                              isDark ? 'bg-[#2a2a2a] border-gray-800'      : 'bg-gray-50 border-gray-200'
              }`}
            >
              {hardeningStatusIcon(h.status)}
              <span className={`text-[10px] flex-1 ${h.status === 'done' ? t.textPrimary : t.textSecondary}`}>{h.label}</span>
              <span className={`text-[9px] font-bold ${
                h.priority === 'P0' ? 'text-red-400' : h.priority === 'P1' ? 'text-amber-400' : t.textMuted
              }`}>{h.priority}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Center Panel ──────────────────────────────────────────────────

  const centerPanel = (
    <div className={`p-6 space-y-6 overflow-y-auto h-full ${lockdownActive ? 'ring-2 ring-inset ring-red-500/40' : ''}`}>

      {/* ── Page header ── */}
      <div id="infra-page-header" className="flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Platform Infrastructure</h2>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>Engine room · Live architecture, deployments & audit</p>
        </div>
        <button
          onClick={startTour}
          className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
            isDark
              ? 'border-gray-700 text-gray-500 hover:border-[#87986a]/40 hover:text-[#a3b085]'
              : 'border-gray-200 text-gray-500 hover:border-[#87986a]/40 hover:text-[#6b7a54]'
          }`}
        >
          <HelpCircle className="h-3 w-3" />
          Take a tour
        </button>
      </div>

      {/* ── Lockdown Banner ── */}
      {lockdownActive && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${
          isDark ? 'bg-red-500/10 border-red-500/40' : 'bg-red-50 border-red-300'
        }`}>
          <AlertOctagon className="h-4 w-4 text-red-400 shrink-0 animate-pulse" />
          <span className={`flex-1 text-xs font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
            🔴 SECURITY LOCKDOWN ACTIVE — Tamper event detected in Audit Log. GOV agents notified.
          </span>
          <button
            onClick={handleClearLockdown}
            className={`text-[10px] underline ${isDark ? 'text-red-400' : 'text-red-600'}`}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── 1. DAG Kernel Schematic ── */}
      <div id="infra-schematic">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className={`text-sm font-semibold ${t.textPrimary}`}>DAG Kernel Schematic</h3>
            <InfoTooltip text="A live map of your platform's core components. Each block shows how many AI agents are running inside it. Click any block to reveal a control lever you can act on." isDark={isDark} side="right" />
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
            isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
          }`}>
            40 agents online
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {DAG_NODES.map((node) => {
            const NodeIcon = node.icon;
            const isSelected = selectedNode === node.id;
            const isScaled   = scaledNodes.has(node.id);
            const isDegraded = node.status === 'degraded' && !isScaled;

            return (
              <button
                key={node.id}
                onClick={() => setSelectedNode(prev => prev === node.id ? null : node.id)}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 ring-1 ring-[#87986a]/20' : 'bg-[#f4f6f0] border-[#87986a]/40'
                    : isDegraded
                    ? isDark ? 'bg-amber-500/8 border-amber-500/30 hover:border-amber-500/50' : 'bg-amber-50/80 border-amber-200 hover:border-amber-300'
                    : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:border-gray-700' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className={`p-1.5 rounded-lg ${
                    isSelected  ? (isDark ? 'bg-[#87986a]/20' : 'bg-[#e8edd8]')
                    : isDegraded ? (isDark ? 'bg-amber-500/15' : 'bg-amber-100')
                    :              (isDark ? 'bg-gray-800' : 'bg-white border border-gray-200')
                  }`}>
                    <NodeIcon className={`h-3.5 w-3.5 ${
                      isSelected  ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]')
                      : isDegraded ? (isDark ? 'text-amber-400' : 'text-amber-600')
                      :              t.textSecondary
                    }`} />
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    isScaled    ? (isDark ? 'bg-green-500/15 text-green-400'   : 'bg-green-50 text-green-700')
                    : isDegraded ? (isDark ? 'bg-amber-500/15 text-amber-400'  : 'bg-amber-50 text-amber-700')
                    :              (isDark ? 'bg-green-500/15 text-green-400'  : 'bg-green-50 text-green-700')
                  }`}>
                    {isScaled ? 'scaled ✓' : node.status}
                  </span>
                </div>

                <div className={`text-xs font-semibold mb-1 ${t.textPrimary}`}>{node.name}</div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] ${isDegraded ? (isDark ? 'text-amber-400' : 'text-amber-600') : t.textMuted}`}>
                    {isScaled ? node.scaledMetric : node.metric}
                  </span>
                  <span className={`text-[10px] font-semibold tabular-nums ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                    {node.agents} agents
                  </span>
                </div>

                {/* Activity pulse bars */}
                <div className="flex items-end gap-0.5 mt-2.5 h-4">
                  {Array.from({ length: 8 }, (_, i) => {
                    const h = isDegraded
                      ? [40, 80, 30, 90, 50, 100, 35, 70][i]
                      : [55, 70, 60, 85, 50, 75, 65, 80][i];
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm transition-all ${
                          isSelected  ? 'bg-[#87986a]'
                          : isDegraded ? 'bg-amber-500'
                          :              isDark ? 'bg-gray-600' : 'bg-gray-300'
                        }`}
                        style={{ height: `${h}%`, opacity: isScaled ? 0.9 : 0.7 }}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>

        {/* Component action lever */}
        {selectedNode && (() => {
          const node    = DAG_NODES.find(n => n.id === selectedNode)!;
          const isScaled   = scaledNodes.has(node.id);
          const isDegraded = node.status === 'degraded' && !isScaled;
          return (
            <div className={`mt-3 p-4 rounded-xl border ${
              isDegraded
                ? isDark ? 'bg-amber-500/8 border-amber-500/25' : 'bg-amber-50/80 border-amber-200'
                : isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'
            }`}>
              <div className={`text-[10px] font-bold tracking-wider mb-2 ${
                isDegraded ? (isDark ? 'text-amber-400' : 'text-amber-700') : (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]')
              }`}>
                {isDegraded ? '⚠ PERFORMANCE DEGRADATION DETECTED' : `⚙ ${node.name.toUpperCase()} — LEVER`}
              </div>

              {isDegraded && !isScaled && (
                <p className={`text-[10px] mb-3 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="font-semibold">Graph Memory Store</span> is experiencing a 145ms latency spike due to bulk data ingestion. MET #004 (Memory Manager) is the responsible agent — scaling it will normalize latency to ~8ms.
                </p>
              )}

              {!isDegraded && !isScaled && (
                <p className={`text-[10px] mb-3 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {node.name} is operating normally at {node.metric}. Use the lever below to give this component additional compute resources.
                </p>
              )}

              {/* Payment Rails — show connected rails + connector button */}
              {node.id === 'payment-rails' ? (
                <div>
                  {connectedRails.size > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {Array.from(connectedRails).map(rId => {
                        const rail = PAYMENT_RAIL_OPTIONS.find(r => r.id === rId);
                        return rail ? (
                          <span key={rId} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'}`}>
                            ✓ {rail.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => setRailConnectorOpen(true)}
                    className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors text-white bg-amber-500 hover:bg-amber-600"
                  >
                    🔌 {connectedRails.size > 0 ? 'Manage Payment Rails' : 'Connect Payment Rail'}
                  </button>
                </div>
              ) : isScaled ? (
                <div className={`flex items-center gap-2 py-1.5 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[11px] font-semibold">
                    {node.id === 'memory' ? 'MET #004 scaled — latency normalized to 8ms' : `${node.name} overclocked — ${node.scaledMetric}`}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => handleScaleNode(node.id)}
                  className={`w-full py-1.5 rounded text-[11px] font-semibold transition-colors text-white ${
                    isDegraded ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#87986a] hover:bg-[#6b7a54]'
                  }`}
                >
                  {node.actionLabel}
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── 2. Deployment Queue ── */}
      <div id="infra-deployment-queue">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Deployment Queue</h3>
            <InfoTooltip text="Your 5-phase build roadmap. Phases that are ready show an amber badge. Nothing deploys until you press the Start button — you are the final authorization gate." isDark={isDark} side="right" />
          </div>
          <span className={`text-[10px] ${t.textMuted}`}>40-agent production suite</span>
        </div>

        <div className={`${t.cardPanel} p-4`}>
          <div className="space-y-0">
            {BUILD_PHASES.map((phase, idx) => {
              const state      = getPhaseState(phase, authorizedPhases);
              const isDone     = state === 'complete';
              const isActive   = state === 'active';
              const needsAuth  = state === 'needs-auth';
              const isAuth     = state === 'authorized';
              const isLocked   = state === 'locked';

              return (
                <div key={phase.id} className="flex items-stretch gap-4">
                  {/* Timeline node */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isDone    ? 'bg-[#87986a] text-white'
                      : isActive ? `ring-2 ring-[#87986a]/40 ${isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`
                      : needsAuth ? `ring-2 ring-amber-500/40 animate-pulse ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600'}`
                      : isAuth  ? `${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-600'}`
                      :            isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-200 text-gray-400'
                    }`}>
                      {isDone   ? <CheckCircle className="h-4 w-4" />
                       : isLocked ? <Lock className="h-3.5 w-3.5" />
                       : phase.id}
                    </div>
                    {idx < BUILD_PHASES.length - 1 && (
                      <div className={`w-px flex-1 min-h-[20px] my-1 ${isDone ? 'bg-[#87986a]' : isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />
                    )}
                  </div>

                  {/* Phase content */}
                  <div className="pb-5 flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${
                          isDone || isActive ? t.textPrimary
                          : needsAuth ? (isDark ? 'text-amber-400' : 'text-amber-700')
                          : isAuth    ? (isDark ? 'text-green-400' : 'text-green-700')
                          :              t.textMuted
                        }`}>{phase.name}</span>

                        {isActive && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>Active</span>
                        )}
                        {needsAuth && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>
                            ⚠ Ready for Human Authorization
                          </span>
                        )}
                        {isAuth && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'}`}>
                            Authorized ✓
                          </span>
                        )}
                        {isLocked && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                            🔒 Locked — authorize phase {phase.id - 1} first
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] ${t.textMuted}`}>{phase.weeks}</span>
                        <span className={`text-[10px] font-medium ${t.textSecondary}`}>{phase.agentCount} agents</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      {phase.milestones.map(m => (
                        <span key={m} className={`text-[9px] px-1.5 py-0.5 rounded ${
                          isDone  ? isDark ? 'bg-green-500/12 text-green-400' : 'bg-green-50 text-green-700'
                          : isActive ? isDark ? 'bg-[#87986a]/10 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                          :            isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {isDone ? '✓ ' : ''}{m}
                        </span>
                      ))}
                    </div>

                    {needsAuth && (
                      <button
                        onClick={() => setAuthorized(prev => new Set([...prev, phase.id]))}
                        className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                      >
                        🚀 Start Build Phase {phase.id} — {phase.name}
                      </button>
                    )}
                    {isAuth && (
                      <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                        <CheckCircle className="h-3 w-3 shrink-0" />
                        Deployment authorized — agents initializing
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 3. Append-Only Audit Log ── */}
      <div id="infra-audit-log">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Append-Only Audit Log</h3>
            <InfoTooltip text="An append-only record of every AI agent action. Cryptographic sealing rollout is in progress (hardening item h7) — once complete, alterations trigger detection and lockdown." isDark={isDark} side="right" />
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isDark ? 'bg-[#87986a]/15' : 'bg-[#f4f6f0]'}`}>
            <Award className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            <span className={`text-xs font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Grade: A</span>
          </div>
        </div>

        <div className={t.cardPanel}>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 p-4 pb-0">
            {[
              { label: 'Actions Logged', value: '12,847',  color: t.textPrimary },
              { label: 'Verified',       value: '12,847',  color: isDark ? 'text-green-400' : 'text-green-600' },
              { label: 'Tampered',       value: tamperDetected ? '1' : '0',
                color: tamperDetected ? (isDark ? 'text-red-400' : 'text-red-600') : (isDark ? 'text-green-400' : 'text-green-600') },
            ].map(s => (
              <div key={s.label} className={t.card}>
                <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                <span className={`text-[10px] ${t.textMuted}`}>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="p-4 pt-3 space-y-3">
            {/* GOV agent seals */}
            <div className={`flex items-center justify-between text-[10px] ${t.textMuted}`}>
              <span>Sealed by GOV agents:</span>
              <div className="flex gap-1">
                {['GOV-001', 'GOV-003', 'GOV-004'].map(a => (
                  <span key={a} className={`px-1.5 py-0.5 rounded-full font-semibold ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>{a}</span>
                ))}
              </div>
            </div>

            {/* Seal status */}
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
              tamperDetected
                ? isDark ? 'border-red-500/40 bg-red-500/10' : 'border-red-300 bg-red-50'
                : isDark ? 'border-green-500/20 bg-green-500/8' : 'border-green-200 bg-green-50'
            }`}>
              <div className="flex items-center gap-2">
                {tamperDetected
                  ? <AlertOctagon className="h-3.5 w-3.5 text-red-400 shrink-0 animate-pulse" />
                  : <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                }
                <span className={`text-[10px] font-semibold ${tamperDetected ? (isDark ? 'text-red-400' : 'text-red-700') : (isDark ? 'text-green-400' : 'text-green-700')}`}>
                  {tamperDetected
                    ? 'TAMPER DETECTED — Log integrity compromised. GOV agents locked.'
                    : 'Sealing coverage 87% (rollout in progress) · Last verified 2 min ago'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => toast.info('Full Audit Log', {
                  description: 'Production: paginated, filterable table of every signed entry (actor, role, action, timestamp, prev-hash). Includes "Verify seals" action, signed-CSV export for compliance, and retention-policy footer.',
                })}
                className={`flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors border ${
                isDark ? 'border-gray-700 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-gray-200 text-[#6b7a54] hover:bg-[#f4f6f0]'
              }`}>
                <FileCheck className="h-3 w-3" />
                View Full Audit Log →
              </button>
              {!tamperDetected ? (
                <button
                  onClick={handleTamper}
                  className={`px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors border ${
                    isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  Simulate Tamper
                </button>
              ) : (
                <button
                  onClick={handleClearLockdown}
                  className={`px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors border ${
                    isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );

  return (
    <>
      <ThreePanelLayout
        isDark={isDark}
        left={leftPanel}
        center={centerPanel}
        right={<IntelligencePanel theme={theme} context="infrastructure" />}
      />

      {/* Rail Connector Modal */}
      {railConnectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setRailConnectorOpen(false)}>
          <div className={`relative w-full max-w-sm mx-4 rounded-xl border shadow-xl ${
            isDark ? 'bg-[#1e1e1e] border-gray-700' : 'bg-white border-gray-200'
          }`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <CreditCard className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <div>
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Rail Connector</h3>
                  <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{connectedRails.size} of {PAYMENT_RAIL_OPTIONS.length} rails active</p>
                </div>
              </div>
              <button onClick={() => setRailConnectorOpen(false)} className={`p-1 rounded ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {PAYMENT_RAIL_OPTIONS.map(rail => {
                const isConnected = connectedRails.has(rail.id);
                return (
                  <div key={rail.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isConnected
                      ? isDark ? 'bg-[#87986a]/10 border-[#87986a]/40' : 'bg-[#f4f6f0] border-[#87986a]/50'
                      : isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{rail.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{rail.region}</span>
                      </div>
                      <p className={`text-[9px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{rail.desc}</p>
                    </div>
                    <button
                      onClick={() => setConnectedRails(prev => {
                        const next = new Set(prev);
                        isConnected ? next.delete(rail.id) : next.add(rail.id);
                        return next;
                      })}
                      className={`ml-3 shrink-0 text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                        isConnected
                          ? isDark ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-[#87986a] hover:bg-[#6b7a54] text-white'
                      }`}
                    >
                      {isConnected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button onClick={() => setRailConnectorOpen(false)}
                className="w-full py-1.5 rounded text-[11px] font-semibold bg-[#87986a] hover:bg-[#6b7a54] text-white transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
