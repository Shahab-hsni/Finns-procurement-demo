import { useState, useEffect, useCallback } from 'react';
import { X, Bot, Clock, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { IntelligencePanel } from '../IntelligencePanel';
import { MetricCategoryList } from './MetricCategoryList';
import { SparklineHistories } from './SparklineHistories';
import { SupplierPromiseEngine } from './SupplierPromiseEngine';
import { InfoTooltip } from '../ui/InfoTooltip';
import { theme } from '../../lib/theme';

const TOUR_STORAGE_KEY = 'buyamia-transform-tour-seen';

function createTour() {
  return driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    steps: [
      {
        element: '#tm-page-header',
        popover: {
          title: '👋 Welcome to Your AI Dashboard',
          description: 'This page shows how well your AI purchasing system is performing. You\'ll find 8 performance numbers and a supplier reliability tracker. Use the ℹ icons anywhere for quick explanations.',
          side: 'bottom',
        },
      },
      {
        element: '#tm-left-panel',
        popover: {
          title: '📊 Performance Areas',
          description: 'Click any metric here to select it. The main view will show you the AI agents behind that number and exactly what they did to move it.',
          side: 'right',
        },
      },
      {
        element: '#tm-metrics-section',
        popover: {
          title: '📈 Live Performance Metrics',
          description: 'These 8 cards update in real time. Click any card to expand a full breakdown of which AI agents drove the change. Each card also has a ℹ icon explaining what the number means.',
          side: 'bottom',
        },
      },
      {
        element: '#tm-tm08-card',
        popover: {
          title: '⚙️ Exception Trend — You Control This One',
          description: 'This is the only metric you can tune directly. Use the slider to set how many issues get flagged for your review: "Catch Everything" to see every flag, "Only Major Issues" to reduce noise.',
          side: 'top',
        },
      },
      {
        element: '#tm-supplier-section',
        popover: {
          title: '🤝 Supplier Promise Tracker',
          description: 'This table shows whether your suppliers are keeping their delivery and quality commitments. Click any Delivery or Quality score to trace the full order journey — every step, with timestamps.',
          side: 'top',
        },
      },
      {
        element: '#tm-greenharvest-row',
        popover: {
          title: '⚠️ How Breached Rows Work',
          description: 'Orange rows mean a supplier missed their promises. You can click "Stop Auto-Orders" to pause AI purchasing from them while you investigate. Click their Delivery score to see exactly where things went wrong.',
          side: 'top',
        },
      },
      {
        element: '#tm-intel-header',
        popover: {
          title: '🤖 Your AI Advisor (Atlas)',
          description: 'This panel surfaces urgent recommendations — like the GreenHarvest issue — and answers any question you type. The chat at the bottom understands plain English. Try "Why is GreenHarvest late?" to start.',
          side: 'left',
        },
      },
    ],
  });
}

interface TransformationPageProps {
  theme: 'dark' | 'light';
}

// ── Neural Audit Trail data per metric ───────────────────────────

const AUDIT_TRAILS: Record<string, {
  headline: string;
  agents: { id: string; cls: string; action: string; impact: string }[];
}> = {
  'TM-01': {
    headline: 'Autonomous Spend at 72.4% — 3 agents driving growth',
    agents: [
      { id: 'REA-001', cls: 'Reasoning', action: 'Identified 18 spend categories eligible for auto-route', impact: '+4.2% autonomous coverage' },
      { id: 'REA-004', cls: 'Reasoning', action: 'Secured volume discounts on 8 repeat vendors', impact: 'Freed $14.2K for auto-allocation' },
      { id: 'EXE-001', cls: 'Execution', action: 'Auto-placed 47 POs in last 24h without human touch', impact: '47 manual touches eliminated' },
      { id: 'GOV-002', cls: 'Governance', action: 'Approved auto-execution for 3 new spend categories', impact: 'Coverage expanded by 6.1%' },
    ],
  },
  'TM-02': {
    headline: 'Auto-Execution Rate 68.1% — bottleneck at Vendor Evaluation',
    agents: [
      { id: 'REA-002', cls: 'Reasoning', action: 'Scored 42 vendors, 8 new approvals added to auto-route', impact: '+3.2% auto-execution coverage' },
      { id: 'EXE-001', cls: 'Execution', action: 'Processed 124 POs this cycle without human gate', impact: '124 autonomous executions' },
      { id: 'GOV-001', cls: 'Governance', action: 'Policy engine cleared 98% of compliance checks automatically', impact: '2% rejection rate — lowest ever' },
      { id: 'MET-002', cls: 'Metrology', action: 'Detected Stage 4 bottleneck reducing auto-rate by est. 4.1%', impact: 'Bottleneck identified — action needed' },
    ],
  },
  'TM-03': {
    headline: 'Manual Touches down to 1,240 — up 12.3% from last cycle',
    agents: [
      { id: 'EXE-001', cls: 'Execution', action: 'Auto-placed 47 POs eliminating manual generation steps', impact: '−94 manual touches this cycle' },
      { id: 'EXE-006', cls: 'Execution', action: 'Triggered 12 auto-reorders at threshold without human input', impact: '−36 manual reorder touches' },
      { id: 'GOV-004', cls: 'Governance', action: 'Automated audit trail recording for 28 decisions per hour', impact: '−168 manual log entries' },
      { id: 'MET-001', cls: 'Metrology', action: 'Orchestrated agent rebalancing without manual intervention', impact: '−12 operations touches' },
    ],
  },
  'TM-04': {
    headline: 'Labor Hours at 486 — 8.4% below target',
    agents: [
      { id: 'EXE-002', cls: 'Execution', action: 'Dispatched RFQs to 6 suppliers automatically', impact: '−18h quote-gathering labor' },
      { id: 'EXE-005', cls: 'Execution', action: 'Reconciled 22 invoices autonomously', impact: '−11h reconciliation labor' },
      { id: 'REA-001', cls: 'Reasoning', action: 'Spend pattern analysis surfaced in real-time — no analyst hours', impact: '−8h analysis labor' },
      { id: 'MET-003', cls: 'Metrology', action: 'Managed memory and context routing without manual archiving', impact: '−4h ops labor' },
    ],
  },
  'TM-05': {
    headline: 'Stockouts at 34 — elevated, seafood primary driver',
    agents: [
      { id: 'SEN-004', cls: 'Sensing', action: 'Flagged lamb rack at 12% — triggered auto-reorder', impact: 'Prevented 2 additional stockouts' },
      { id: 'SEN-006', cls: 'Sensing', action: 'Detected typhoon disruption — seafood supply at risk', impact: 'Pre-warned 3 outlet managers' },
      { id: 'REA-003', cls: 'Reasoning', action: 'Forecast 18% protein demand increase — pre-orders queued', impact: 'Demand shock buffer created' },
      { id: 'EXE-006', cls: 'Execution', action: 'Triggered olive oil auto-reorder at 4% stock', impact: 'Stockout prevented at 2 outlets' },
    ],
  },
  'TM-06': {
    headline: 'Realized Savings $48,200 — blanket PO leads at $23K',
    agents: [
      { id: 'REA-004', cls: 'Reasoning', action: 'Negotiated 8% discount on coffee bulk order', impact: '$2,100 captured this cycle' },
      { id: 'REA-001', cls: 'Reasoning', action: 'Identified blanket PO opportunity for seafood category', impact: '$14,200 in volume discounts' },
      { id: 'EXE-007', cls: 'Execution', action: 'Formed protein group buy pool with 6 outlet members', impact: '$8,400 group discount captured' },
      { id: 'MET-002', cls: 'Metrology', action: 'DAG optimization pass recovered workflow efficiency gaps', impact: '$23,500 opportunity unlocked' },
    ],
  },
  'TM-07': {
    headline: 'Working Capital $125K — payment timing opportunity identified',
    agents: [
      { id: 'EXE-003', cls: 'Execution', action: 'Processed early payment to Pacific Supply for 2% discount', impact: '$3,200 early-pay discount' },
      { id: 'REA-001', cls: 'Reasoning', action: 'Modeled 30-day DPO extension across 4 vendors', impact: 'Est. $18K working capital improvement' },
      { id: 'GOV-002', cls: 'Governance', action: 'Budget guardian flagged seafood category at 92% utilization', impact: 'Payment cadence risk mitigated' },
      { id: 'REA-007', cls: 'Reasoning', action: 'Modeled IDR weakening impact on USD-denominated payables', impact: '$4.1K FX risk flagged' },
    ],
  },
  'TM-08': {
    headline: 'Exception Trend 18 — down 15.2%, sensitivity adjustable',
    agents: [
      { id: 'GOV-005', cls: 'Governance', action: 'Flagged INV-9921 for duplicate payment pattern', impact: '1 exception caught, $1,400 saved' },
      { id: 'GOV-001', cls: 'Governance', action: 'Blocked $18K equipment purchase over budget cap', impact: '1 policy exception triggered' },
      { id: 'REA-005', cls: 'Reasoning', action: 'Flagged 3 unfavorable clauses in GreenHarvest contract', impact: '3 contract exceptions raised' },
      { id: 'MET-007', cls: 'Metrology', action: 'Monitoring detects 2 degraded agents causing timeout exceptions', impact: '2 system exceptions tracked' },
    ],
  },
};

// ── Logistics History data per supplier ──────────────────────────

const LOGISTICS_HISTORIES: Record<string, {
  supplierName: string;
  stages: { step: number; name: string; status: 'done' | 'late' | 'pending'; time: string; note?: string }[];
}> = {
  'SP-01': {
    supplierName: 'AlphaFoods International',
    stages: [
      { step: 1,  name: 'Requirement Detected',   status: 'done', time: 'Day 0 · 08:14', note: 'SEN-004 flagged protein reorder threshold' },
      { step: 2,  name: 'RFQ Issued',              status: 'done', time: 'Day 0 · 08:22' },
      { step: 3,  name: 'Quote Received',           status: 'done', time: 'Day 0 · 11:45', note: 'AlphaFoods quoted within 3.5h SLA' },
      { step: 4,  name: 'Vendor Evaluated',         status: 'done', time: 'Day 0 · 11:48', note: 'REA-002 scored 97/100 — top tier' },
      { step: 5,  name: 'PO Generated',             status: 'done', time: 'Day 0 · 11:50' },
      { step: 6,  name: 'Compliance Approved',      status: 'done', time: 'Day 0 · 11:51', note: '98% auto-clearance — no manual gate needed' },
      { step: 7,  name: 'Order Confirmed',          status: 'done', time: 'Day 0 · 12:05' },
      { step: 8,  name: 'Pick & Pack',              status: 'done', time: 'Day 1 · 06:30' },
      { step: 9,  name: 'Dispatched',               status: 'done', time: 'Day 1 · 09:15', note: 'Cold chain vehicle departed KL depot' },
      { step: 10, name: 'In Transit',               status: 'done', time: 'Day 1 · 09:15–18:00' },
      { step: 11, name: 'Customs / Gate',           status: 'done', time: 'Day 1 · 18:10' },
      { step: 12, name: 'Delivered',                status: 'done', time: 'Day 2 · 08:45', note: '2.8d actual vs 3d promised ✓' },
    ],
  },
  'SP-02': {
    supplierName: 'Pacific Supply Co.',
    stages: [
      { step: 1,  name: 'Requirement Detected',   status: 'done', time: 'Day 0 · 10:00' },
      { step: 2,  name: 'RFQ Issued',              status: 'done', time: 'Day 0 · 10:08' },
      { step: 3,  name: 'Quote Received',           status: 'done', time: 'Day 0 · 16:30', note: 'Delayed — Pacific responded in 6.5h' },
      { step: 4,  name: 'Vendor Evaluated',         status: 'done', time: 'Day 0 · 16:35', note: 'Trust score 82 — at-risk flag raised' },
      { step: 5,  name: 'PO Generated',             status: 'done', time: 'Day 0 · 16:40' },
      { step: 6,  name: 'Compliance Approved',      status: 'done', time: 'Day 1 · 08:00', note: '1 manual review required — geo-restriction check' },
      { step: 7,  name: 'Order Confirmed',          status: 'done', time: 'Day 1 · 10:15' },
      { step: 8,  name: 'Pick & Pack',              status: 'done', time: 'Day 2 · 07:00' },
      { step: 9,  name: 'Dispatched',               status: 'done', time: 'Day 2 · 14:00' },
      { step: 10, name: 'In Transit',               status: 'late', time: 'Day 2–5 (+0.2d lag)', note: 'Courier handoff delayed 4h' },
      { step: 11, name: 'Customs / Gate',           status: 'done', time: 'Day 5 · 09:00' },
      { step: 12, name: 'Delivered',                status: 'done', time: 'Day 5 · 14:20', note: '5.2d actual vs 5d promised — minor overrun' },
    ],
  },
  'SP-03': {
    supplierName: 'MegaEquip Industries',
    stages: [
      { step: 1,  name: 'Requirement Detected',   status: 'done', time: 'Day 0 · 09:00' },
      { step: 2,  name: 'RFQ Issued',              status: 'done', time: 'Day 0 · 09:05' },
      { step: 3,  name: 'Quote Received',           status: 'done', time: 'Day 0 · 11:00' },
      { step: 4,  name: 'Vendor Evaluated',         status: 'done', time: 'Day 0 · 11:04', note: 'REA-002 scored 96/100' },
      { step: 5,  name: 'PO Generated',             status: 'done', time: 'Day 0 · 11:06' },
      { step: 6,  name: 'Compliance Approved',      status: 'done', time: 'Day 0 · 11:07' },
      { step: 7,  name: 'Order Confirmed',          status: 'done', time: 'Day 0 · 11:30' },
      { step: 8,  name: 'Pick & Pack',              status: 'done', time: 'Day 1 · 08:00' },
      { step: 9,  name: 'Dispatched',               status: 'done', time: 'Day 1 · 12:00' },
      { step: 10, name: 'In Transit',               status: 'done', time: 'Day 1–6' },
      { step: 11, name: 'Customs / Gate',           status: 'done', time: 'Day 6 · 08:00' },
      { step: 12, name: 'Delivered',                status: 'done', time: 'Day 6 · 11:00', note: '6.5d actual vs 7d promised — ahead of SLA ✓' },
    ],
  },
  'SP-04': {
    supplierName: 'GreenHarvest Farms',
    stages: [
      { step: 1,  name: 'Requirement Detected',   status: 'done', time: 'Day 0 · 07:45' },
      { step: 2,  name: 'RFQ Issued',              status: 'done', time: 'Day 0 · 07:52' },
      { step: 3,  name: 'Quote Received',           status: 'done', time: 'Day 0 · 09:10' },
      { step: 4,  name: 'Vendor Evaluated',         status: 'late', time: 'Day 0 · 09:14', note: '⚠ Trust score 58 — BREACH flag raised by REA-002' },
      { step: 5,  name: 'PO Generated',             status: 'done', time: 'Day 0 · 09:20', note: 'PO generated despite low trust — manual override required' },
      { step: 6,  name: 'Compliance Approved',      status: 'late', time: 'Day 0 · 11:00', note: '⚠ Manual review triggered — quality cert expired' },
      { step: 7,  name: 'Order Confirmed',          status: 'done', time: 'Day 0 · 14:30' },
      { step: 8,  name: 'Pick & Pack',              status: 'late', time: 'Day 1 · 16:00', note: '⚠ 8h delay — cold storage issue reported at farm' },
      { step: 9,  name: 'Dispatched',               status: 'late', time: 'Day 2 · 10:00', note: '⚠ 1 day dispatch delay — vehicle unavailable' },
      { step: 10, name: 'In Transit',               status: 'late', time: 'Day 2–4', note: '⚠ Route deviation added 6h — wrong depot routing' },
      { step: 11, name: 'Customs / Gate',           status: 'done', time: 'Day 4 · 14:00' },
      { step: 12, name: 'Delivered',                status: 'late', time: 'Day 4 · 18:15', note: '⚠ 4.1d actual vs 2d promised — 2× SLA breach' },
    ],
  },
  'SP-05': {
    supplierName: 'TechParts Global',
    stages: [
      { step: 1,  name: 'Requirement Detected',   status: 'done', time: 'Day 0 · 10:30' },
      { step: 2,  name: 'RFQ Issued',              status: 'done', time: 'Day 0 · 10:35' },
      { step: 3,  name: 'Quote Received',           status: 'done', time: 'Day 0 · 12:00', note: 'Sub-2h quote — fastest in class' },
      { step: 4,  name: 'Vendor Evaluated',         status: 'done', time: 'Day 0 · 12:04', note: 'Trust score 98 — platinum tier' },
      { step: 5,  name: 'PO Generated',             status: 'done', time: 'Day 0 · 12:06' },
      { step: 6,  name: 'Compliance Approved',      status: 'done', time: 'Day 0 · 12:07', note: '100% auto-clearance — no exceptions' },
      { step: 7,  name: 'Order Confirmed',          status: 'done', time: 'Day 0 · 12:15' },
      { step: 8,  name: 'Pick & Pack',              status: 'done', time: 'Day 1 · 07:00' },
      { step: 9,  name: 'Dispatched',               status: 'done', time: 'Day 1 · 10:00' },
      { step: 10, name: 'In Transit',               status: 'done', time: 'Day 1–3' },
      { step: 11, name: 'Customs / Gate',           status: 'done', time: 'Day 3 · 10:00' },
      { step: 12, name: 'Delivered',                status: 'done', time: 'Day 3 · 15:40', note: '3.9d actual vs 4d promised ✓' },
    ],
  },
};

const AGENT_CLASS_COLOR: Record<string, { dark: string; light: string }> = {
  Reasoning:  { dark: 'bg-purple-500/10 text-purple-400', light: 'bg-purple-50 text-purple-700' },
  Execution:  { dark: 'bg-green-500/10 text-green-400',   light: 'bg-green-50 text-green-700'   },
  Governance: { dark: 'bg-amber-500/10 text-amber-400',   light: 'bg-amber-50 text-amber-700'   },
  Sensing:    { dark: 'bg-blue-500/10 text-blue-400',     light: 'bg-blue-50 text-blue-700'     },
  Metrology:  { dark: 'bg-pink-500/10 text-pink-400',     light: 'bg-pink-50 text-pink-700'     },
};

// ── Inline Audit Trail panel ─────────────────────────────────────

function MetricAuditPanel({ metricId, isDark, onClose }: {
  metricId: string; isDark: boolean; onClose: () => void;
}) {
  const t = theme(isDark);
  const trail = AUDIT_TRAILS[metricId];
  if (!trail) return null;

  return (
    <div className={`rounded-xl border p-5 ${
      isDark ? 'bg-[#1a1a1a] border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[10px] font-bold tracking-wider ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
              WHAT DROVE THIS NUMBER
            </span>
            <InfoTooltip
              isDark={isDark}
              side="right"
              text="AI agents that worked behind the scenes on this metric. Each had a specific job — here's what they did and the measurable result."
            />
          </div>
          <h4 className={`text-sm font-semibold ${t.textPrimary}`}>{trail.headline}</h4>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-gray-200 text-gray-400'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {trail.agents.map((ag, i) => {
          const clsColors = AGENT_CLASS_COLOR[ag.cls] ?? AGENT_CLASS_COLOR['Reasoning'];
          return (
            <div key={i} className={`flex gap-3 p-3 rounded-lg ${isDark ? 'bg-[#252525]' : 'bg-white border border-gray-100'}`}>
              <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                <Bot className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
                {i < trail.agents.length - 1 && (
                  <div className={`w-px flex-1 min-h-[12px] ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold ${t.textPrimary}`}>AI Agent {ag.id}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? clsColors.dark : clsColors.light}`}>{ag.cls}</span>
                </div>
                <p className={`text-[10px] ${t.textMuted} mb-1`}>{ag.action}</p>
                <div className={`text-[10px] font-semibold px-2 py-0.5 rounded inline-block ${
                  isDark ? 'bg-[#87986a]/10 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                }`}>Result: {ag.impact}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Inline Logistics History panel ──────────────────────────────

function LogisticsHistoryPanel({ supplierId, isDark, onClose }: {
  supplierId: string; isDark: boolean; onClose: () => void;
}) {
  const t = theme(isDark);
  const hist = LOGISTICS_HISTORIES[supplierId];
  if (!hist) return null;

  return (
    <div className={`rounded-xl border p-5 ${
      isDark ? 'bg-[#1a1a1a] border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[10px] font-bold tracking-wider ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
              ORDER JOURNEY — EVERY STEP TRACKED
            </span>
            <InfoTooltip
              isDark={isDark}
              side="right"
              text="The complete journey of your last order — from when the system detected a need, to final delivery. Orange steps had delays or problems."
            />
          </div>
          <h4 className={`text-sm font-semibold ${t.textPrimary}`}>{hist.supplierName}</h4>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-gray-200 text-gray-400'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {hist.stages.map((stage) => (
          <div
            key={stage.step}
            className={`p-2.5 rounded-lg border text-[10px] ${
              stage.status === 'late'
                ? isDark ? 'bg-amber-500/8 border-amber-500/25' : 'bg-amber-50 border-amber-200'
                : stage.status === 'pending'
                  ? isDark ? 'bg-[#2a2a2a] border-gray-700 opacity-50' : 'bg-gray-50 border-gray-200 opacity-50'
                  : isDark ? 'bg-[#252525] border-gray-800' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {stage.status === 'done' ? (
                <CheckCircle className={`h-3 w-3 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              ) : stage.status === 'late' ? (
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
              ) : (
                <Clock className={`h-3 w-3 shrink-0 ${t.textMuted}`} />
              )}
              <span className={`font-semibold ${
                stage.status === 'late' ? (isDark ? 'text-amber-300' : 'text-amber-700') : t.textPrimary
              }`}>S{stage.step} {stage.name}</span>
            </div>
            <div className={t.textMuted}>{stage.time}</div>
            {stage.note && (
              <div className={`mt-1 leading-tight ${
                stage.status === 'late' ? (isDark ? 'text-amber-400/80' : 'text-amber-700/80') : t.textMuted
              }`}>{stage.note}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export function TransformationPage({ theme: pageTheme }: TransformationPageProps) {
  const isDark = pageTheme === 'dark';
  const t = theme(isDark);

  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [auditMetricId, setAuditMetricId] = useState<string | null>(null);
  const [logisticsSupplier, setLogisticsSupplier] = useState<string | null>(null);
  const [pausedSuppliers, setPausedSuppliers] = useState<Set<string>>(new Set());
  const [sensitivity, setSensitivity] = useState(50);

  const startTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
    const t = createTour();
    t.drive();
  }, []);

  // Auto-start tour on first visit
  useEffect(() => {
    if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
      const timer = setTimeout(startTour, 600);
      return () => clearTimeout(timer);
    }
  }, [startTour]);

  // Right panel can request logistics view (Investigate button)
  useEffect(() => {
    const handler = () => setLogisticsSupplier('SP-04');
    window.addEventListener('buyamia-transform-investigate', handler);
    return () => window.removeEventListener('buyamia-transform-investigate', handler);
  }, []);

  // Right panel Authorize Pivot → pause GreenHarvest, clear logistics view
  useEffect(() => {
    const handler = () => {
      setPausedSuppliers(prev => { const next = new Set(prev); next.add('SP-04'); return next; });
    };
    window.addEventListener('buyamia-transform-authorize-pivot', handler);
    return () => window.removeEventListener('buyamia-transform-authorize-pivot', handler);
  }, []);

  const handleAuditMetric = (id: string | null) => {
    setAuditMetricId(id);
    setSelectedMetric(id);
  };

  const handleLogisticsView = (id: string) => {
    setLogisticsSupplier(id || null);
  };

  const handlePauseToggle = (supplierId: string) => {
    setPausedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId); else next.add(supplierId);
      return next;
    });
  };

  return (
    <ThreePanelLayout
      isDark={isDark}
      left={
        <MetricCategoryList
          isDark={isDark}
          selectedMetric={selectedMetric}
          onSelectMetric={(id) => handleAuditMetric(id === auditMetricId ? null : id)}
        />
      }
      center={
        <div className="p-6 space-y-6">
          <div id="tm-page-header" className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                AI Procurement Performance
              </h2>
              <InfoTooltip
                isDark={isDark}
                side="right"
                text="8 live performance numbers and your supplier reliability tracker. Click any metric card or delivery/quality score to dig deeper. Use the ℹ icons anywhere for instant explanations."
              />
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

          <SparklineHistories
            isDark={isDark}
            selectedMetricId={auditMetricId}
            onAuditMetric={handleAuditMetric}
            sensitivity={sensitivity}
            onSensitivityChange={setSensitivity}
          />

          {auditMetricId && (
            <MetricAuditPanel
              metricId={auditMetricId}
              isDark={isDark}
              onClose={() => { setAuditMetricId(null); setSelectedMetric(null); }}
            />
          )}

          <SupplierPromiseEngine
            isDark={isDark}
            pausedSuppliers={pausedSuppliers}
            onPauseToggle={handlePauseToggle}
            onLogisticsView={handleLogisticsView}
            activeLogisticsId={logisticsSupplier}
          />

          {logisticsSupplier && (
            <LogisticsHistoryPanel
              supplierId={logisticsSupplier}
              isDark={isDark}
              onClose={() => setLogisticsSupplier(null)}
            />
          )}
        </div>
      }
      right={<IntelligencePanel theme={pageTheme} context="transformation" />}
    />
  );
}
