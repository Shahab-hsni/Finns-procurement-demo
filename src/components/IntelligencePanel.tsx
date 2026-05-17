import { useState, useEffect } from "react";
import {
  Sparkles, Send, TrendingUp, Clock, DollarSign, CheckCircle,
  BarChart3, FileText, Users, Zap, Shield, Globe, Activity,
  AlertTriangle, Bot, Cpu, Search, Settings, Eye, Target, Gauge,
  FlaskConical, X, ScrollText, AlertCircle, Factory, Wrench, Building2,
  AlertOctagon, FileCheck,
} from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useConstraints } from "../hooks/useConstraints";
import { workflowTemplates } from "../lib/mockData";
import type { IntelligenceContext } from "../lib/types";

const WORKFLOW_HERO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, Zap, ScrollText, Users, AlertCircle, Factory, Wrench, Building2,
};

const COMPLEXITY_CHIP = {
  simple: {
    dark:  { bg: 'bg-green-500/10',  border: 'border-green-500/25',  icon: 'text-green-400',  badge: 'bg-green-500/15 text-green-400 border-green-500/20'  },
    light: { bg: 'bg-green-50',      border: 'border-green-200',     icon: 'text-green-600',  badge: 'bg-green-50 text-green-700 border-green-200'          },
  },
  medium: {
    dark:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  icon: 'text-amber-400',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20'  },
    light: { bg: 'bg-amber-50',      border: 'border-amber-200',     icon: 'text-amber-600',  badge: 'bg-amber-50 text-amber-700 border-amber-200'          },
  },
  complex: {
    dark:  { bg: 'bg-purple-500/10', border: 'border-purple-500/25', icon: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
    light: { bg: 'bg-purple-50',     border: 'border-purple-200',    icon: 'text-purple-600', badge: 'bg-purple-50 text-purple-700 border-purple-200'        },
  },
};

// ── Workflows-specific data ───────────────────────────────────

const STAGE_REASONING: Record<number, { headline: string; body: string; action: string }> = {
  1:  { headline: 'Signal Intake · 342 ops/min',          body: 'SEN-001/002/003 processing 3 live streams. POS Transaction (92%) and Inventory Threshold (88%) are primary triggers. No excess noise detected.',                                        action: '🛠️ Tune Sensitivity'      },
  2:  { headline: 'Demand Classification · 310 ops/min',  body: 'SEN-004 and REA-001 cross-referencing signals. Confidence at 75% — 3 borderline signals queued. Lowering to 70% would auto-clear them without material risk.',                           action: '⬇️ Lower Threshold'        },
  3:  { headline: 'Source Discovery · 285 ops/min',       body: 'SEN-005/006 scanning 3 supplier tiers. 1 seafood vendor flagged for weather disruption. Alternative found: Thai Fresh Co at +8% cost difference.',                                       action: '🔍 Expand to 4 Tiers'      },
  4:  { headline: 'Vendor Evaluation · 260 ops/min',      body: 'REA-002/003 scoring 14 vendors. Strictness at 65pts — 4 vendors borderline. Lowering floor to 60pts adds 2 qualified options without increasing vendor risk.',                           action: '📊 Adjust Score Floor'     },
  5:  { headline: 'Price Optimization · bottleneck risk', body: 'REA-004 averaging 9h on Rush orders. BeanHouse API adding 340ms/call latency. Pre-approving vendors <$5K on Rush bypass reduces avg to 3h and hits the 24h SLA.',                       action: '⚡ Set Bypass Rule'         },
  6:  { headline: 'Compliance Check · 4 rules active',    body: 'GOV-001/002 validating against Halal, geo-restriction, budget ceiling, and vendor whitelist. 1 PO pending geo-restriction review. 98% auto-clearance rate.',                           action: '📋 View Pending PO'        },
  7:  { headline: 'Order Bundling · 3-order threshold',   body: 'REA-005 waiting for 3-order minimum before bundling. 2 orders queued — 1 more needed. Lowering to 2 would unblock 8 pending POs and reduce avg PO cost by 6%.',                        action: '📦 Lower to 2 Orders'      },
  8:  { headline: 'Approval Gate · 2 pending >4h',        body: 'GOV-003/004 monitoring 2 stalled approvals. Auto-escalation triggers at 8h. Finance notified. 1 is time-sensitive — manual nudge recommended before the deadline.',                    action: '🔔 Escalate Now'           },
  9:  { headline: 'PO Execution · 5 concurrent',          body: 'EXE-001/002/003/004 at concurrency limit. 3 POs queued behind. Increasing to 8 concurrent would clear the queue in ~12 min with no quality or compliance risk.',                       action: '⬆️ Scale to 8'             },
  10: { headline: 'Delivery Tracking · 15-min refresh',   body: 'EXE-004/005/006 monitoring active shipments. 1 seafood order showing customs delay — ETA slipping 2 days. VN Supply flagged automatically for supplier watch.',                         action: '⚠️ Flag VN Supply'         },
  11: { headline: 'Invoice Settlement · 7-day window',    body: 'EXE-007/008 closing invoices. 2 approaching window close today. 94% auto-close rate across active vendors. 1 manual exception flagged for finance review.',                            action: '📝 Review Exception'       },
  12: { headline: 'Cycle Learning · 20-cycle pass',       body: 'MET-001/002 analyzing last 20 cycles. 3 patterns identified: Rush latency at S5, Blanket PO discount gap, and S4 strictness overhead. Next auto-pass in 4h.',                          action: '🔄 Run Pass Now'           },
};

const SAVINGS_VELOCITY: Record<string, number[]> = {
  'WF-STD': [12.1, 14.3, 13.8, 15.2, 16.4, 17.1, 18.0, 18.4],
  'WF-RSH': [1.8,  2.1,  2.8,  2.4,  3.0,  3.1,  3.2,  3.2 ],
  'WF-BPO': [28.4, 31.2, 34.5, 36.8, 38.1, 40.2, 41.5, 42.1],
  'WF-GRP': [6.2,  7.8,  8.4,  9.1,  10.2, 10.8, 11.4, 11.8],
  'WF-EMR': [0.8,  0.9,  1.1,  1.2,  1.3,  1.3,  1.4,  1.4 ],
  'WF-PRD': [18.2, 20.4, 22.1, 24.3, 25.8, 27.1, 28.2, 28.9],
  'WF-MNT': [2.8,  3.4,  3.8,  4.2,  4.6,  4.9,  5.1,  5.3 ],
  'WF-CPX': [41.2, 48.5, 52.1, 55.8, 58.4, 60.1, 62.3, 63.7],
};

const RECENT_EXCEPTIONS = [
  { id: 'EX-001', stageId: 6, desc: 'Rush PO bypassed S6 Compliance',  time: '2h ago', severity: 'medium' as const },
  { id: 'EX-002', stageId: 5, desc: 'Blanket PO price variance +12%',  time: '4h ago', severity: 'high'   as const },
  { id: 'EX-003', stageId: 8, desc: 'Emergency skipped approval gate', time: '6h ago', severity: 'low'    as const },
];

interface SimulationScenario {
  id: string;
  label: string;
  description: string;
  predictedBottlenecks: number[];
  overstressedAgents: string[];
  alertMessage: string;
  applyFix: string;
}

const SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    id: 'SIM-CHK',
    label: 'Chicken +20% spike',
    description: 'Simulates a 20% sudden demand spike for Chicken across all outlets',
    predictedBottlenecks: [2, 3, 4, 5],
    overstressedAgents: ['SEN-003', 'SEN-004', 'REA-003', 'REA-004'],
    alertMessage: 'S5 Price Optimization would bottleneck — REA-004 at est. 94% capacity. Consider pre-authorizing price band.',
    applyFix: 'Pre-authorize $12K price band for poultry',
  },
  {
    id: 'SIM-STK',
    label: 'Seafood emergency stockout',
    description: 'Simulates an emergency seafood stockout across 3 outlets simultaneously',
    predictedBottlenecks: [1, 7, 9, 10],
    overstressedAgents: ['SEN-004', 'EXE-001', 'EXE-002', 'EXE-004'],
    alertMessage: 'S7–S9 Execution pipeline would saturate — 3 concurrent Emergency POs would queue behind S9.',
    applyFix: 'Increase Emergency concurrency to 8 POs',
  },
  {
    id: 'SIM-PRC',
    label: 'Coffee price surge +30%',
    description: 'Simulates a sudden 30% price surge in coffee commodities',
    predictedBottlenecks: [4, 5, 6],
    overstressedAgents: ['REA-002', 'REA-004', 'GOV-001', 'GOV-002'],
    alertMessage: 'S4 Vendor Evaluation + S5 bottleneck — governance review queue grows to est. 14 pending decisions.',
    applyFix: 'Bypass S5 for pre-approved coffee vendors',
  },
];

// ── Per-template dynamic insights ────────────────────────────

type BadgeType = 'roi' | 'alert' | 'latency' | 'info';
interface DynamicInsightDef {
  title: string;
  description: string;
  badge: string;
  badgeType: BadgeType;
  recommendedAction: string;
}

const WORKFLOW_DYNAMIC_INSIGHTS: Record<string, DynamicInsightDef[]> = {
  'WF-STD': [
    { title: '94% efficiency — best in class',    description: '124 active orders running smoothly. Stage 5 is your only friction point — BeanHouse API adding 340ms avg per negotiation cycle.',                                        badge: 'Top ROI',    badgeType: 'roi',     recommendedAction: '⚡ Cache Vendor Prices'     },
    { title: 'Blanket PO leaking 5%',             description: 'Un-captured volume discounts at Stage 5 costing est. $2.1K/month. Standard workflow could auto-route qualifying orders to the BPO path.',                               badge: 'Action',     badgeType: 'alert',   recommendedAction: '🔀 Route to Blanket PO'    },
    { title: 'Signal noise within bounds',        description: 'All 3 sensing agents are processing cleanly. No suppression needed. POS Transaction is the highest-confidence trigger at 92%.',                                         badge: 'Healthy',    badgeType: 'info',    recommendedAction: '📊 View Signal Breakdown'  },
  ],
  'WF-RSH': [
    { title: 'Stage 5 adding 9h on Rush',         description: 'Rush orders avg 38h. Price Optimization is the bottleneck — bypass for pre-approved vendors <$5K would hit the 24h SLA.',                                               badge: 'Latency',    badgeType: 'latency', recommendedAction: '⚡ Set Bypass Rule'         },
    { title: '31 active — 2× normal volume',      description: 'Rush volume is elevated this week. Vendor whitelist should be expanded to reduce Stage 4 queue depth and prevent secondary bottlenecks.',                               badge: 'Volume',     badgeType: 'alert',   recommendedAction: '📋 Expand Whitelist'       },
    { title: '$3.2K saved — room to grow',        description: 'Rush savings are below potential. Pre-positioning stock for top 5 trigger categories would reduce future escalation frequency.',                                         badge: 'Opportunity', badgeType: 'roi',   recommendedAction: '📦 Pre-position Stock'     },
  ],
  'WF-BPO': [
    { title: '$42.1K saved — highest ROI',        description: 'Blanket PO is your top-performing workflow. 8 active contracts capturing volume discounts. Stage 7 bundling threshold can be lowered for more coverage.',               badge: 'Top ROI',    badgeType: 'roi',     recommendedAction: '📦 Lower Bundle Threshold' },
    { title: '18-day avg — review S8 gate',       description: 'Approval Gate (S8) is adding 3–4 days to cycle time. Pre-approving repeat vendors would cut avg to 12 days without compromising governance.',                           badge: 'Latency',    badgeType: 'latency', recommendedAction: '✅ Pre-approve Repeats'    },
    { title: 'Discount capture at 95%',           description: '5% of discount windows are still missed at Stage 5. Re-wiring Price Optimization for BPO path could recover est. $2.1K/month.',                                        badge: 'Action',     badgeType: 'alert',   recommendedAction: '⚡ Re-wire S5 for BPO'    },
  ],
  'WF-GRP': [
    { title: '12 active group buys',              description: 'Group buying coordination is healthy. Protein category leads with 6 active bundles. Expanding to dry goods would add est. $4K/month.',                                 badge: 'Opportunity', badgeType: 'roi',   recommendedAction: '🛒 Add Dry Goods'          },
    { title: 'S7 threshold blocking 40%',         description: 'At 3-order minimum, 40% of eligible orders miss the bundle window. Lowering to 2 would add 6 more bundles monthly and $2.8K in savings.',                              badge: 'Tune',       badgeType: 'alert',   recommendedAction: '⬇️ Lower to 2 Orders'      },
    { title: '$11.8K saved — growing',            description: 'Savings velocity has grown 90% over 8 weeks. Watch for vendor fatigue on high-repeat suppliers as volume increases.',                                                   badge: 'Trend',      badgeType: 'info',    recommendedAction: '📊 Check Vendor Load'      },
  ],
  'WF-EMR': [
    { title: 'Emergency 3× above baseline',       description: 'Triggered 3× this week vs. 1× baseline. Inventory Threshold signal (DS-02) shifted 2 days earlier would catch stockouts before escalation.',                           badge: 'Alert',      badgeType: 'alert',   recommendedAction: '📅 Adjust DS-02 Timing'    },
    { title: '3.5h avg — fastest workflow',       description: 'Emergency response is within SLA. Seafood is the most frequent trigger (67%). Pre-positioning key items reduces future escalation frequency by est. 40%.',              badge: 'Performance', badgeType: 'roi',   recommendedAction: '📦 Pre-position Seafood'   },
    { title: '$1.4K saved — below potential',     description: 'Emergency workflow saves less per cycle due to reactive pricing. Earlier signal detection would shift more orders to Standard or Rush.',                                 badge: 'Opportunity', badgeType: 'info',  recommendedAction: '🔄 Shift to Proactive'     },
  ],
  'WF-PRD': [
    { title: 'Production-driven — on target',     description: 'BOM-triggered procurement at 4.2d avg. Stage 3 Source Discovery is the slowest sub-path for protein categories specifically.',                                         badge: 'On Track',   badgeType: 'info',    recommendedAction: '🔍 Expand Protein Sources' },
    { title: '$28.9K saved via BOM timing',       description: 'Production schedule integration is capturing early-order discounts. Extending look-ahead from 7 to 14 days could add est. $6K/month.',                                 badge: 'ROI',        badgeType: 'roi',     recommendedAction: '📅 Extend Look-ahead'       },
    { title: 'Stage 4 strictness overhead',       description: 'Vendor evaluation at 65pts is optimal for most items, but consumables with repeat vendors could use a lighter 50pt path to reduce queue depth.',                       badge: 'Tune',       badgeType: 'latency', recommendedAction: '📊 Add Repeat-Vendor Path' },
  ],
  'WF-MNT': [
    { title: '14 maintenance orders active',      description: 'Preventive maintenance procurement is on-track at 4.1d avg. Stage 4 vendor evaluation is stricter than needed for low-risk consumables.',                             badge: 'Status',     badgeType: 'info',    recommendedAction: '📊 Relax S4 for Consumables' },
    { title: '$5.3K saved — room to grow',        description: 'Bundling maintenance orders is underused. Only 30% are bundled at the current threshold. Lowering S7 to 2 orders could add $2K/month.',                               badge: 'Opportunity', badgeType: 'roi',   recommendedAction: '📦 Optimize Bundling'      },
    { title: 'No compliance flags this week',     description: 'All 14 maintenance orders passed S6 Compliance auto-check. Preventive maintenance whitelists are functioning correctly.',                                               badge: 'Clean',      badgeType: 'info',    recommendedAction: '📋 View Whitelist'         },
  ],
  'WF-CPX': [
    { title: '$63.7K saved — Capex champion',     description: '4 active capital projects with multi-level approval. 28-day avg is expected for this complexity tier. Stage 8 is the critical path at 28h avg per gate.',              badge: 'Complex',    badgeType: 'info',    recommendedAction: '📋 Review S8 Approvers'    },
    { title: 'Parallel approvals could save 8d', description: 'Capex approvals avg 28h each across 3 gates. Parallel routing for independent gate pairs would reduce total cycle time by 8–10 days.',                                 badge: 'Latency',    badgeType: 'latency', recommendedAction: '🔀 Enable Parallel Gates'  },
    { title: 'Discount window: act now',          description: '2 of 4 active Capex projects are approaching vendor price validity windows. Expediting S8 approval would lock in current pricing.',                                    badge: 'Urgent',     badgeType: 'alert',   recommendedAction: '🔔 Expedite Approvals'     },
  ],
};

function getWorkflowInsights(workflowId: string | null | undefined, isDark: boolean): Insight[] {
  const defs = workflowId ? WORKFLOW_DYNAMIC_INSIGHTS[workflowId] : undefined;
  if (!defs) return INSIGHTS['workflows'](isDark);
  const badgeColors: Record<BadgeType, string> = {
    roi:     isDark ? 'bg-[#87986a]/15 text-[#a3b085] border-[#87986a]/20'     : 'bg-[#f4f6f0] text-[#6b7a54] border-[#dbe3ce]',
    alert:   isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'           : 'bg-red-50 text-red-700 border-red-200',
    latency: isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'  : 'bg-orange-50 text-orange-700 border-orange-200',
    info:    isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'        : 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const iconMap: Record<BadgeType, typeof Sparkles> = {
    roi: TrendingUp, alert: AlertTriangle, latency: Clock, info: Activity,
  };
  return defs.map(d => ({
    icon: iconMap[d.badgeType],
    title: d.title,
    description: d.description,
    badge: d.badge,
    badgeColor: badgeColors[d.badgeType],
    recommendedAction: d.recommendedAction,
  }));
}

// ── Mini sparkline ────────────────────────────────────────────

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const W = 88, H = 22, n = values.length;
  if (n < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * W;
    const y = H - ((v - min) / span) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Context-specific content maps ─────────────────────────────

const GREETINGS: Record<IntelligenceContext, string> = {
  'overview':       "You have 3 approvals pending — 2 are time-sensitive. I saved $3,075 today across 12 actions. Spending is down 8.2% this month. What would you like to triage first?",
  'orders':         "I'm tracking all your purchase orders. Ask me about delivery ETAs, auto-order patterns, or supplier performance on active orders.",
  'inventory':      "I'm monitoring stock levels across all categories. Ask me about reorder timing, consumption trends, or incoming shipment ETAs.",
  'spending':       "I can analyze your spending patterns, identify savings opportunities, or compare costs across suppliers and categories.",
  'suppliers':      "I have performance data on all your suppliers. Ask me about reliability scores, quality trends, or sourcing alternatives.",
  'ai-activity':    "I can explain any automated action, show you why a decision was made, or help you adjust autonomy settings.",
  'request':        "Hi! I'm your procurement assistant. I can help you with request suggestions, vendor recommendations, budget optimization, and more.",
  'workflows':      "Three playbooks active: Standard, Rush, Recurring. This is a read-only reference — pick a card on the left to see the 5-stage flow path and which agent owns each stage.",
  'governance':     "I'm your Policy Architect. I've detected 3 recurring budget cap overrides for one vendor this month — that's a pattern worth codifying as a rule exception. Want to surface the rule diff?",
};

interface QuickAction {
  icon: typeof Sparkles;
  label: string;
  description: string;
  color: string;
  onClick?: () => void;
}

const QUICK_ACTIONS: Record<IntelligenceContext, (isDark: boolean) => QuickAction[]> = {
  'workflows': (isDark) => [
    { icon: ScrollText,    label: 'Standard',  description: 'WF-STD playbook',  color: isDark ? 'text-[#a3b085]'  : 'text-[#87986a]'  },
    { icon: Zap,           label: 'Rush',      description: 'WF-RSH playbook',  color: isDark ? 'text-amber-400'  : 'text-amber-600'  },
    { icon: FileText,      label: 'Recurring', description: 'WF-REC playbook',  color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: TrendingUp,    label: 'ROI',       description: 'Savings by playbook', color: isDark ? 'text-purple-400' : 'text-purple-600' },
  ],
  'governance': (isDark) => [
    { icon: Shield,        label: 'Policy Rules', description: 'Active rules',  color: isDark ? 'text-green-400'  : 'text-green-600'  },
    { icon: FileText,      label: 'Activity Feed', description: 'Recent events', color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: AlertTriangle, label: 'Disputes',     description: 'Open cases',    color: isDark ? 'text-orange-400' : 'text-orange-600' },
    { icon: Settings,      label: 'Agents',       description: 'A-01 to A-05',  color: isDark ? 'text-purple-400' : 'text-purple-600' },
  ],
  'request': (isDark) => [
    { icon: BarChart3,  label: 'Price Analysis', description: 'Compare pricing',   color: isDark ? 'text-purple-400' : 'text-purple-600' },
    { icon: TrendingUp, label: 'Trends',         description: 'Market insights',   color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: Users,      label: 'Vendor Match',   description: 'Find suppliers',    color: isDark ? 'text-green-400'  : 'text-green-600'  },
    { icon: DollarSign, label: 'Budget Tools',   description: 'Optimize spending', color: isDark ? 'text-[#a3b085]'  : 'text-[#87986a]' },
  ],
  'overview': (isDark) => [
    { icon: Zap,        label: 'Triage Now',   description: 'Clear pending items',   color: isDark ? 'text-green-400'  : 'text-green-600'  },
    { icon: Target,     label: 'Simulate',     description: 'Make vs Buy analysis',  color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: Bot,        label: 'AI Reasoning', description: 'Why this decision?',    color: isDark ? 'text-purple-400' : 'text-purple-600' },
    { icon: TrendingUp, label: 'Autonomy',     description: 'Level 3 → 4 path',     color: isDark ? 'text-[#a3b085]'  : 'text-[#87986a]' },
  ],
  'orders': (isDark) => [
    { icon: Search,        label: 'Track Order', description: 'Find by PO #',    color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: Clock,         label: 'ETA Check',   description: 'Delivery times',  color: isDark ? 'text-green-400'  : 'text-green-600'  },
    { icon: Bot,           label: 'Auto-Orders', description: 'Review routine',  color: isDark ? 'text-purple-400' : 'text-purple-600' },
    { icon: AlertTriangle, label: 'Delays',      description: 'Flag issues',     color: isDark ? 'text-orange-400' : 'text-orange-600' },
  ],
  'inventory': (isDark) => [
    { icon: AlertTriangle, label: 'Low Stock',   description: 'Critical items', color: isDark ? 'text-red-400'    : 'text-red-600'    },
    { icon: TrendingUp,    label: 'Consumption', description: 'Usage trends',   color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: Settings,      label: 'Thresholds',  description: 'Adjust levels',  color: isDark ? 'text-purple-400' : 'text-purple-600' },
    { icon: Clock,         label: 'ETAs',        description: 'Incoming stock', color: isDark ? 'text-green-400'  : 'text-green-600'  },
  ],
  'spending': (isDark) => [
    { icon: DollarSign, label: 'Savings',  description: 'Where we saved', color: isDark ? 'text-green-400'  : 'text-green-600'  },
    { icon: BarChart3,  label: 'Compare',  description: 'YoY analysis',   color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: TrendingUp, label: 'Forecast', description: 'Next month',     color: isDark ? 'text-purple-400' : 'text-purple-600' },
    { icon: Target,     label: 'Budget',   description: 'Utilization %',  color: isDark ? 'text-[#a3b085]'  : 'text-[#87986a]' },
  ],
  'suppliers': (isDark) => [
    { icon: Users,         label: 'Top Rated', description: 'Best performers',     color: isDark ? 'text-green-400'  : 'text-green-600'  },
    { icon: AlertTriangle, label: 'At Risk',   description: 'Declining scores',    color: isDark ? 'text-red-400'    : 'text-red-600'    },
    { icon: Search,        label: 'Find New',  description: 'Source alternatives', color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: BarChart3,     label: 'Compare',   description: 'Side by side',        color: isDark ? 'text-purple-400' : 'text-purple-600' },
  ],
  'ai-activity': (isDark) => [
    { icon: Bot,        label: 'Explain',  description: 'Why this action?', color: isDark ? 'text-blue-400'   : 'text-blue-600'   },
    { icon: Settings,   label: 'Autonomy', description: 'Adjust level',     color: isDark ? 'text-purple-400' : 'text-purple-600' },
    { icon: Eye,        label: 'Audit',    description: 'Verify decisions', color: isDark ? 'text-green-400'  : 'text-green-600'  },
    { icon: TrendingUp, label: 'Stats',    description: 'Performance',      color: isDark ? 'text-[#a3b085]'  : 'text-[#87986a]' },
  ],
};

interface Suggestion {
  icon: typeof Sparkles;
  text: string;
}

const SUGGESTIONS: Record<IntelligenceContext, Suggestion[]> = {
  'workflows':      [{ icon: Sparkles, text: "What does Rush do that Standard doesn't?" }, { icon: Sparkles, text: "Which playbook has the best savings ratio?" }, { icon: Sparkles, text: "Show me recent POs on each playbook" }],
  'governance':     [{ icon: Sparkles, text: "Which agent is overridden most often?" }, { icon: Sparkles, text: "How many spend-cap rules fired this week?" }, { icon: Sparkles, text: "What's the open dispute backlog?" }],
  'request':        [{ icon: Sparkles, text: "What should I name my request?" }, { icon: Sparkles, text: "Which vendor handles this category best?" }, { icon: Sparkles, text: "Why is this playbook being recommended?" }],
  'overview':       [{ icon: Sparkles, text: "Which PO needs my attention most urgently?" }, { icon: Sparkles, text: "What value is arriving today?" }, { icon: Sparkles, text: "Any cost-saving opportunities I'm missing?" }],
  'orders':         [{ icon: Sparkles, text: "Which orders are arriving this week?" }, { icon: Sparkles, text: "Show me auto-ordered items" }, { icon: Sparkles, text: "Any delivery delays to flag?" }],
  'inventory':      [{ icon: Sparkles, text: "What's running low right now?" }, { icon: Sparkles, text: "Which items were auto-reordered?" }, { icon: Sparkles, text: "Predict next week's stock needs" }],
  'spending':       [{ icon: Sparkles, text: "Where are we overspending?" }, { icon: Sparkles, text: "Compare this month to last month" }, { icon: Sparkles, text: "Show savings by category and venue" }],
  'suppliers':      [{ icon: Sparkles, text: "Who's our most reliable supplier?" }, { icon: Sparkles, text: "Any suppliers underperforming?" }, { icon: Sparkles, text: "Find cheaper alternatives for protein" }],
  'ai-activity':    [{ icon: Sparkles, text: "Why did the AI reject that quote?" }, { icon: Sparkles, text: "How much has the AI saved me?" }, { icon: Sparkles, text: "What's needed for higher autonomy on Seafood?" }],
};

interface Insight {
  icon: typeof Sparkles;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  recommendedAction?: string;
  actionEvent?: string;
}

const INSIGHTS: Record<IntelligenceContext, (isDark: boolean) => Insight[]> = {
  'workflows': (isDark) => [
    { icon: TrendingUp,    title: 'Standard 94% — Blanket PO leaking 5%', description: 'Blanket PO is leaking ~5% in un-captured discounts at Stage 5. Re-wiring Price Optimization recovers est. $2.1K/month.',                badge: 'ROI Switch', badgeColor: isDark ? 'bg-[#87986a]/15 text-[#a3b085] border-[#87986a]/20' : 'bg-[#f4f6f0] text-[#6b7a54] border-[#dbe3ce]', recommendedAction: '⚡ Re-wire S5 Now'       },
    { icon: AlertTriangle, title: 'Emergency Spike — 3× Baseline',        description: 'Emergency triggered 3× this week vs. 1× baseline. Shifting Inventory Threshold signal 2 days earlier catches stockouts pre-escalation.',  badge: 'Action',    badgeColor: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'           : 'bg-red-50 text-red-700 border-red-200',         recommendedAction: '📅 Adjust DS-02 Timing'  },
    { icon: Clock,         title: 'Rush Latency +9h at Stage 5',          description: 'Rush orders avg 38h. Stage 5 adds 9h. Set bypass for Rush orders <$5K with pre-approved vendors to hit the 24h SLA.',                     badge: 'Latency',   badgeColor: isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'  : 'bg-orange-50 text-orange-700 border-orange-200', recommendedAction: '⚡ Set Bypass Rule'       },
  ],
  'governance': (isDark) => [
    { icon: Shield,        title: 'Override Flagged', description: 'Manual override on DEC-006 exceeds budget cap. Agent GOV-002 blocked the purchase; a manager reversed it. Review the governance trail to see if a new policy rule is warranted.', badge: 'Review', badgeColor: isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200', recommendedAction: '🛡️ Review Governance', actionEvent: 'buyamia-governance-review-override' },
    { icon: CheckCircle,   title: 'Audit Clear',      description: 'Trust plane passed weekly integrity check — all 67 trust rules are operating correctly and no anomalies detected.',       badge: 'Pass',   badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'   },
    { icon: AlertTriangle, title: 'Dispute Open',     description: 'Agent EXE-003 decision (DEC-003) contested by Finance Team — invoice may be legitimate. 2 open disputes require your review.',     badge: 'Open',   badgeColor: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'         : 'bg-red-50 text-red-700 border-red-200'         },
  ],
  'request': (isDark) => [
    { icon: TrendingUp,  title: 'Price Alert',    description: 'Coffee beans prices down 12% this week', badge: 'New',   badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'   },
    { icon: Clock,       title: 'Delivery Update',description: 'Your last order arriving tomorrow',      badge: 'Today', badgeColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'     : 'bg-blue-50 text-blue-700 border-blue-200'     },
    { icon: CheckCircle, title: 'Recommendation', description: 'Try bulk ordering to save 15%',         badge: 'Tip',   badgeColor: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200' },
  ],
  'overview': (isDark) => [
    { icon: Target,    title: 'Make vs Buy: PO-2847',  description: 'Approving saves $1,120 vs sourcing locally. 92% confidence.',                                       badge: 'Simulation', badgeColor: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200' },
    { icon: Activity,  title: 'Autonomy: Level 3 → 4', description: '72% complete. Need 3 more criteria: trust score, volume threshold, approval latency.',              badge: 'Progress',   badgeColor: isDark ? 'bg-[#87986a]/15 text-[#a3b085] border-[#87986a]/20'   : 'bg-[#f4f6f0] text-[#6b7a54] border-[#dbe3ce]' },
    { icon: TrendingUp,title: 'Proactive Insight',    description: 'Ramadan demand spike in 3 weeks — pre-order protein now to lock prices.',                           badge: 'Forecast',   badgeColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'     : 'bg-blue-50 text-blue-700 border-blue-200'     },
  ],
  'orders': (isDark) => [
    { icon: Zap,           title: 'Auto-Order Complete', description: 'Rice order placed with PT Maju Bersama',        badge: 'Auto',  badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'   },
    { icon: Clock,         title: 'Delivery Tomorrow',   description: 'PO-2847 arriving from Indonesia',               badge: 'ETA',   badgeColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'     : 'bg-blue-50 text-blue-700 border-blue-200'     },
    { icon: AlertTriangle, title: 'Delay Risk',          description: 'VN Supply shipment may be 2 days late',         badge: 'Alert', badgeColor: isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200' },
  ],
  'inventory': (isDark) => [
    { icon: AlertTriangle, title: 'Critical Stock',   description: 'Lamb Rack at 12% — auto-reorder triggered',    badge: 'Low',   badgeColor: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'         : 'bg-red-50 text-red-700 border-red-200'         },
    { icon: CheckCircle,   title: 'Restock Incoming', description: '4 auto-orders in transit, arriving this week', badge: 'ETA',   badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'   },
    { icon: TrendingUp,    title: 'Usage Spike',       description: 'Protein consumption up 15% this week',         badge: 'Trend', badgeColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'     : 'bg-blue-50 text-blue-700 border-blue-200'     },
  ],
  'spending': (isDark) => [
    { icon: DollarSign,  title: 'Budget Alert',   description: 'Seafood category at 92% of monthly budget',   badge: 'Watch', badgeColor: isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200' },
    { icon: TrendingUp,  title: 'Savings Growing', description: 'Total savings up 18% vs last quarter',        badge: 'Trend', badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'   },
    { icon: CheckCircle, title: 'Cost Tip',        description: 'Switch dry goods to Thai Fresh Co — save 11%',badge: 'Tip',   badgeColor: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200' },
  ],
  'suppliers': (isDark) => [
    { icon: AlertTriangle, title: 'Score Drop',       description: 'Indo Seafood reliability fell below 80%',                badge: 'Alert', badgeColor: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'         : 'bg-red-50 text-red-700 border-red-200'         },
    { icon: TrendingUp,    title: 'Top Performer',    description: 'PT Maju Bersama score up to 94 — new high',              badge: 'New',   badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'   },
    { icon: CheckCircle,   title: 'New Source Found', description: 'Alternative beef supplier in Australia — 8% cheaper',   badge: 'Tip',   badgeColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'     : 'bg-blue-50 text-blue-700 border-blue-200'     },
  ],
  'ai-activity': (isDark) => [
    { icon: Bot,         title: 'Autonomy Progress', description: '72% toward Level 4 — 3 more criteria needed',    badge: 'Progress', badgeColor: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200' },
    { icon: DollarSign,  title: 'Daily Savings',     description: '$3,075 saved today across 47 actions',           badge: 'Today',    badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'   },
    { icon: CheckCircle, title: 'Trust Building',    description: 'AI accuracy at 96.2% — up from 94.8% last week', badge: 'Trend',    badgeColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'     : 'bg-blue-50 text-blue-700 border-blue-200'     },
  ],
};

const SUBTITLES: Record<IntelligenceContext, string> = {
  'overview':       'Triage copilot · Autonomy advisor',
  'orders':         'Order tracking assistant',
  'inventory':      'Stock management copilot',
  'spending':       'Financial analytics copilot',
  'suppliers':      'Vendor intelligence advisor',
  'ai-activity':    'Autonomy transparency copilot',
  'request':        'Your smart procurement copilot',
  'workflows':      'Workflow reference',
  'governance':     'Atlas · Policy Architect',
};

// ── Governance-specific data ──────────────────────────────────

const GOVERNANCE_FILTER_INSIGHTS: Record<string, (isDark: boolean) => Insight[]> = {
  'LC-FRD': (isDark) => [
    { icon: Shield,        title: 'GOV #005 — Fraud Pattern Active',      description: '3 invoices flagged for duplicate-amount patterns. Confidence at 72% — below 80% auto-clear threshold. Manual review backlog growing.',               badge: 'Active',    badgeColor: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'         : 'bg-red-50 text-red-700 border-red-200',         recommendedAction: '⬆️ Raise Confidence Floor'     },
    { icon: AlertTriangle, title: 'REA #001 — Spend Anomaly',             description: 'PT Maju flagged with 11% overspend in seafood — 2 prior duplicate-invoice incidents in 6 months. Vendor review recommended.',                          badge: 'Pattern',   badgeColor: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'   : 'bg-amber-50 text-amber-700 border-amber-200',   recommendedAction: '🕵️ Investigate PT Maju'        },
    { icon: Activity,      title: '$12,400 exposure · 94% mitigated',     description: 'GOV-005 mitigated 94% of total fraud exposure. Remaining $744 requires human confirmation before flagged invoices can proceed.',                         badge: 'Contained', badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'   },
  ],
  'LC-WST': (isDark) => [
    { icon: DollarSign,    title: 'REA #004 — Missed Discount Windows',   description: 'BeanHouse API latency (340ms/call) caused 8 discount window timeouts this month at Stage 5. Estimated waste: $21,000 in uncaptured savings.',          badge: 'High Impact',badgeColor: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'         : 'bg-red-50 text-red-700 border-red-200',         recommendedAction: '⚡ Cache BeanHouse Prices'      },
    { icon: AlertTriangle, title: 'EXE #006 — Over-ordering Pattern',     description: '4 auto-reorder events placed quantities above demand signal threshold due to signal lag. $7,600 in excess inventory identified.',                        badge: 'Review',    badgeColor: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'   : 'bg-amber-50 text-amber-700 border-amber-200',   recommendedAction: '📊 Tune Reorder Buffer'        },
    { icon: Activity,      title: '$28,600 exposure · 82% mitigated',     description: '12 waste incidents this month. Stage 5 bottleneck is the root cause of 67% of events. Caching BeanHouse responses eliminates the primary trigger.',       badge: 'Monitor',   badgeColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'     : 'bg-blue-50 text-blue-700 border-blue-200'     },
  ],
  'LC-ERR': (isDark) => [
    { icon: Activity,      title: 'SEN #003 — Misclassification Events',  description: '5 demand items reclassified at 84% confidence — below 90% auto-classification threshold. Manual corrections required for all affected POs.',              badge: 'Below Threshold', badgeColor: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200',   recommendedAction: '📊 Raise Classification Threshold' },
    { icon: AlertTriangle, title: 'EXE #001 — 2 Incorrect POs',           description: '2 purchase orders generated with quantities above demand signal — $2,800 in over-ordered items. Both held for review pending manual confirmation.',          badge: 'Hold',      badgeColor: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'         : 'bg-red-50 text-red-700 border-red-200',         recommendedAction: '📋 Review Held POs'            },
    { icon: CheckCircle,   title: '$8,900 exposure · 88% mitigated',      description: '7 error incidents this month. Raising SEN-003 confidence threshold from 84% → 90% would prevent 5 of these automatically going forward.',                   badge: 'Manageable',badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'  },
  ],
  'LC-NCO': (isDark) => [
    { icon: Shield,        title: 'GOV #002 — PT Maju Override Pattern',  description: 'Budget cap overridden 3× this month for PT Maju. GOV-002 correctly blocked each instance. A standing 10% variance exception for this vendor may be warranted.',badge: 'Pattern',  badgeColor: isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-700 border-orange-200', recommendedAction: '✏️ Update Rule #14',           actionEvent: 'buyamia-governance-update-rule' },
    { icon: CheckCircle,   title: '2 incidents · both contained',         description: 'Both non-compliance incidents were correctly blocked by GOV-002 and escalated. No policy breach occurred — governance is functioning correctly.',            badge: 'Contained', badgeColor: isDark ? 'bg-green-500/10 text-green-400 border-green-500/20'   : 'bg-green-50 text-green-700 border-green-200'  },
  ],
  'LC-DLY': (isDark) => [
    { icon: Clock,         title: 'EXE #004 — BeanHouse API Bottleneck', description: 'Delivery scheduling blocked by 340ms/call BeanHouse API latency cascading Stage 5→9. 12 delay incidents, $22,100 exposure. Pre-caching eliminates 70%.',    badge: 'Root Cause',badgeColor: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20'         : 'bg-red-50 text-red-700 border-red-200',         recommendedAction: '⚡ Pre-cache BeanHouse API'    },
    { icon: AlertTriangle, title: 'EXE #003 — 3 Delayed Settlements',    description: 'Payment processing avg +2.1 days past window. Early payment discount capture rate dropped from 94% → 78% this month.',                                       badge: 'Latency',   badgeColor: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'   : 'bg-amber-50 text-amber-700 border-amber-200',   recommendedAction: '📋 Review Settlement Queue'   },
    { icon: Activity,      title: 'SEN #005 — Tracking Gaps',             description: '3 active shipments lost tracking signal mid-journey (PO-2847, PO-2849, PO-2851). Manual re-sync required.',                                                  badge: 'Monitor',   badgeColor: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'     : 'bg-blue-50 text-blue-700 border-blue-200',      recommendedAction: '🔍 Re-sync Tracking Feeds'    },
  ],
};

// Rule Coverage Map: index = stage index (0-based), value = override count this week
const STAGE_OVERRIDES = [0, 0, 0, 0, 3, 1, 1, 2, 0, 0, 0, 0];
const STAGE_NAMES_SHORT = ['Signal','Demand','Source','Vendor','Price','Comply','Order','Approve','Execute','Fulfill','Settle','Learn'];

const POLICY_INTEGRITY = { pct: 94, compliant: 847, exceptions: 52, leakage: 8400 };

// ── Component ─────────────────────────────────────────────────

interface IntelligencePanelProps {
  theme?: 'dark' | 'light';
  context?: IntelligenceContext;
  workflowId?: string | null;
}

export function IntelligencePanel({
  theme = 'dark',
  context = 'request',
  workflowId,
}: IntelligencePanelProps) {
  const isDark = theme === 'dark';
  const constraints = useConstraints();
  const sensitivityLocked = context === 'workflows' && (constraints.get('signal-sensitivity') ?? 0) >= 90;

  const [aiInput, setAiInput] = useState('');
  const [messages, setMessages] = useState([{ type: 'assistant', content: GREETINGS[context] }]);
  const [simMode, setSimMode] = useState(false);
  const [activeScenario, setActiveScenario] = useState<SimulationScenario | null>(null);
  const [applyFix, setApplyFix] = useState(false);
  const [activeStageId, setActiveStageId] = useState<number | null>(null);
  const [pivotAuthorized, setPivotAuthorized] = useState(false);
  // Governance reactive state
  const [activeGovernanceFilter, setActiveGovernanceFilter] = useState<string | null>(null);
  const [activeControlPlane, setActiveControlPlane] = useState<string>('CP-POL');
  const [precedentData, setPrecedentData] = useState<{ decisionId: string; disputeReason: string } | null>(null);
  const [ruleApplied, setRuleApplied] = useState(false);
  // Infrastructure reactive state
  const [infraLockdown, setInfraLockdown] = useState(false);
  const [agentScaled, setAgentScaled] = useState(false);

  // Stage reasoning: triggered by clicking Tune Logic in DagFlowPath
  useEffect(() => {
    if (context !== 'workflows') return;
    const handler = (e: Event) => setActiveStageId((e as CustomEvent<number | null>).detail);
    window.addEventListener('buyamia-workflow-tune-stage', handler);
    return () => window.removeEventListener('buyamia-workflow-tune-stage', handler);
  }, [context]);

  // Open simulation mode (from hero block trigger)
  useEffect(() => {
    if (context !== 'workflows') return;
    const handler = () => { setSimMode(true); setActiveScenario(null); setApplyFix(false); };
    window.addEventListener('buyamia-workflow-simulate', handler);
    return () => window.removeEventListener('buyamia-workflow-simulate', handler);
  }, [context]);

  // Broadcast selected scenario to DagFlowPath whenever it changes
  useEffect(() => {
    if (context !== 'workflows') return;
    window.dispatchEvent(new CustomEvent('buyamia-workflow-sim-scenario', {
      detail: activeScenario
        ? { bottleneckStages: activeScenario.predictedBottlenecks, overstressedAgents: activeScenario.overstressedAgents }
        : null,
    }));
  }, [activeScenario, context]);

  // Governance: react to loss category filter changes from Decision Ledger
  useEffect(() => {
    if (context !== 'governance') return;
    const handler = (e: Event) => setActiveGovernanceFilter((e as CustomEvent<string | null>).detail);
    window.addEventListener('buyamia-governance-filter-changed', handler);
    return () => window.removeEventListener('buyamia-governance-filter-changed', handler);
  }, [context]);

  // Governance: react when a dispute is hardened into a policy precedent
  useEffect(() => {
    if (context !== 'governance') return;
    const handler = (e: Event) => {
      const { decisionId, disputeReason } = (e as CustomEvent).detail ?? {};
      setPrecedentData({ decisionId, disputeReason });
      setRuleApplied(false);
    };
    window.addEventListener('buyamia-governance-precedent-set', handler);
    return () => window.removeEventListener('buyamia-governance-precedent-set', handler);
  }, [context]);

  // Governance: react to control plane selection
  useEffect(() => {
    if (context !== 'governance') return;
    const handler = (e: Event) => {
      const cp = (e as CustomEvent<string | null>).detail;
      if (cp) setActiveControlPlane(cp);
    };
    window.addEventListener('buyamia-governance-cp-changed', handler);
    return () => window.removeEventListener('buyamia-governance-cp-changed', handler);
  }, [context]);


  const quickActions = QUICK_ACTIONS[context](isDark);
  const suggestions = SUGGESTIONS[context];
  const insights = context === 'workflows'
    ? getWorkflowInsights(workflowId, isDark)
    : context === 'governance' && activeGovernanceFilter
      ? (GOVERNANCE_FILTER_INSIGHTS[activeGovernanceFilter]?.(isDark) ?? INSIGHTS['governance'](isDark))
      : INSIGHTS[context](isDark);

  const insightsLabel = context === 'governance' && activeGovernanceFilter
    ? (activeGovernanceFilter === 'LC-DLY' ? '⚡ LATENCY PULSE' : '🔍 INCIDENT DIAGNOSTICS')
    : 'INSIGHTS & UPDATES';

  const savingsData = workflowId ? SAVINGS_VELOCITY[workflowId] : undefined;

  // Workflow identity for header chip
  const currentWorkflow = context === 'workflows' && workflowId
    ? workflowTemplates.find(w => w.id === workflowId) ?? null
    : null;
  const WorkflowChipIcon = currentWorkflow ? (WORKFLOW_HERO_ICONS[currentWorkflow.icon] ?? FileText) : null;
  const chipCC = currentWorkflow
    ? COMPLEXITY_CHIP[currentWorkflow.complexity as 'simple' | 'medium' | 'complex'][isDark ? 'dark' : 'light']
    : null;
  const stageMeta = activeStageId ? STAGE_REASONING[activeStageId] : undefined;
  const chatLabel = context === 'workflows' ? 'Workflow Architect' : 'AI Assistant';

  const handleSendMessage = () => {
    if (!aiInput.trim()) return;
    setMessages(prev => [...prev, { type: 'user', content: aiInput }]);
    setAiInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: 'I can help you with that! Let me analyze the current data and get back to you with recommendations.',
      }]);
    }, 1000);
  };

  const exitSim = () => {
    setSimMode(false);
    setActiveScenario(null);
    setApplyFix(false);
    window.dispatchEvent(new CustomEvent('buyamia-workflow-sim-exit'));
  };

  const handleApplyFix = () => {
    if (!activeScenario) return;
    window.dispatchEvent(new CustomEvent('buyamia-workflow-apply-fix', { detail: activeScenario.id }));
    setApplyFix(true);
    setTimeout(exitSim, 1500);
  };

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white border-l border-gray-200'}`}>

      {/* ── Header ── */}
      <div
        id={context === 'governance' ? 'gov-intel-header' : context === 'workflows' ? 'wf-intel-header' : undefined}
        className={`shrink-0 p-4 border-b transition-colors ${
          simMode
            ? isDark ? 'border-[#87986a]/30 bg-[#87986a]/5' : 'border-[#dbe3ce] bg-[#f4f6f0]/60'
            : isDark ? 'border-gray-800' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className={`h-5 w-5 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
          <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Intelligence</h2>
          {simMode && (
            <div className="ml-auto flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-[#a3b085]' : 'bg-[#87986a]'}`} />
              <span className={`text-[10px] font-bold tracking-wider ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>SIM ACTIVE</span>
            </div>
          )}
        </div>
        <p className={`text-xs ${simMode ? (isDark ? 'text-[#a3b085]/70' : 'text-[#6b7a54]/70') : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {simMode ? 'Scenario results reflect live in DAG →' : SUBTITLES[context]}
        </p>

        {/* Template identity chip */}
        {currentWorkflow && WorkflowChipIcon && chipCC && (
          <div className={`mt-2.5 flex items-center gap-2 px-3 py-2 rounded-lg border ${chipCC.bg} ${chipCC.border}`}>
            <WorkflowChipIcon className={`w-3.5 h-3.5 shrink-0 ${chipCC.icon}`} />
            <span className={`text-xs font-semibold flex-1 min-w-0 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {currentWorkflow.name}
            </span>
            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold border capitalize ${chipCC.badge}`}>
              {currentWorkflow.complexity}
            </span>
          </div>
        )}

        {context === 'workflows' && (
          <div className="mt-3">
            {simMode ? (
              <button
                onClick={exitSim}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                  isDark
                    ? 'border-[#87986a]/50 bg-[#87986a]/10 text-[#a3b085] hover:bg-[#87986a]/15'
                    : 'border-[#dbe3ce] bg-[#f4f6f0] text-[#6b7a54] hover:bg-[#e8edd8]'
                }`}
              >
                <X className="h-3.5 w-3.5" />
                Exit Simulation
              </button>
            ) : (
              <button
                onClick={() => { setSimMode(true); setActiveScenario(null); setApplyFix(false); }}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                  isDark
                    ? 'border-[#87986a]/30 bg-[#2a2a2a] text-[#a3b085] hover:bg-[#87986a]/10 hover:border-[#87986a]/50'
                    : 'border-[#dbe3ce] bg-white text-[#6b7a54] hover:bg-[#f4f6f0] hover:border-[#87986a]/40'
                }`}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                🧪 Start Simulation
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable: Quick Access + Insights ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* Quick Access */}
        <div className={`p-4 border-b transition-colors ${
          simMode
            ? isDark ? 'border-[#87986a]/25 bg-[#87986a]/5' : 'border-[#dbe3ce] bg-[#f4f6f0]/40'
            : isDark ? 'border-gray-800' : 'border-gray-200'
        }`}>
          <h3 className={`text-[10px] font-semibold tracking-wider mb-3 ${
            simMode ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>{simMode ? '🧪 SIMULATION WORKSPACE' : context === 'governance' ? 'GOVERNANCE WORKSPACE' : 'QUICK ACCESS'}</h3>

          {context === 'workflows' ? (

            simMode ? (
              /* ── Simulation Mode: Scenario Selector ── */
              <>
                <div className="space-y-2 mb-3">
                  {SIMULATION_SCENARIOS.map(sc => (
                    <button
                      key={sc.id}
                      onClick={() => { setActiveScenario(prev => prev?.id === sc.id ? null : sc); setApplyFix(false); }}
                      className={`w-full text-left p-2.5 rounded-lg border text-[10px] transition-all ${
                        activeScenario?.id === sc.id
                          ? isDark ? 'bg-[#87986a]/20 border-[#87986a]/50 text-[#c8d4a8]' : 'bg-[#f4f6f0] border-[#87986a]/60 text-[#3a4a2a]'
                          : isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-300 hover:border-[#87986a]/30 hover:bg-[#87986a]/5' : 'bg-white border-gray-200 text-gray-700 hover:border-[#87986a]/40 hover:bg-[#f4f6f0]/50'
                      }`}
                    >
                      <div className="font-semibold mb-0.5">🧪 {sc.label}</div>
                      <div className={activeScenario?.id === sc.id ? 'opacity-80' : isDark ? 'text-gray-500' : 'text-gray-500'}>{sc.description}</div>
                    </button>
                  ))}
                </div>

                {activeScenario ? (
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                    <div className={`text-[10px] font-semibold tracking-wider mb-1.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>PREDICTED IMPACT</div>
                    <div className={`text-[10px] mb-1 font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                      ⚠ Bottleneck: {activeScenario.predictedBottlenecks.map(s => `S${s}`).join(' · ')}
                    </div>
                    <p className={`text-[10px] mb-3 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{activeScenario.alertMessage}</p>
                    {applyFix ? (
                      <div className={`text-[11px] font-semibold text-center py-2 rounded ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'}`}>
                        ✓ Fix applied — closing simulation...
                      </div>
                    ) : (
                      <button
                        onClick={handleApplyFix}
                        className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors bg-[#87986a] hover:bg-[#6b7a54] text-white"
                      >
                        ⚡ Apply Pre-emptive Fix — {activeScenario.applyFix}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className={`text-[10px] text-center py-3 ${isDark ? 'text-[#a3b085]/50' : 'text-[#6b7a54]/60'}`}>
                    ↑ Select a scenario to see predicted impact
                  </p>
                )}
              </>

            ) : stageMeta ? (
              /* ── Stage Reasoning Card (triggered by clicking Tune Logic) ── */
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-semibold tracking-wider ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                    STAGE {activeStageId} REASONING
                  </span>
                  <button
                    onClick={() => setActiveStageId(null)}
                    className={`p-0.5 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{stageMeta.headline}</div>
                <p className={`text-[10px] mb-3 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stageMeta.body}</p>
                <button className="w-full py-1.5 rounded text-[11px] font-semibold bg-[#87986a] hover:bg-[#6b7a54] text-white transition-colors">
                  {stageMeta.action}
                </button>
              </div>

            ) : (
              /* ── Default Workflows Quick Access ── */
              <>
                <div className={`relative mb-2 p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  {sensitivityLocked && (
                    <div className="absolute inset-0 rounded-lg border-2 border-amber-400/60 animate-ping pointer-events-none" />
                  )}
                  <Target className={`h-4 w-4 mb-2 ${sensitivityLocked ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-blue-400' : 'text-blue-600')}`} />
                  <div className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Tune Logic</div>
                  <div className={`text-[10px] mt-0.5 ${sensitivityLocked ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-gray-500' : 'text-gray-500')}`}>
                    {sensitivityLocked ? '🔒 Hard-lock active — click stage to adjust' : 'Click any stage below to adjust thresholds'}
                  </div>
                </div>

                <div className={`mb-2 p-2.5 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`text-[10px] font-semibold mb-1.5 ${isDark ? 'text-red-400' : 'text-red-600'}`}>⚠ Recent Exceptions</div>
                  <div className="space-y-1">
                    {RECENT_EXCEPTIONS.map(ex => (
                      <button
                        key={ex.id}
                        onClick={() => window.dispatchEvent(new CustomEvent('buyamia-workflow-highlight-stage', { detail: ex.stageId }))}
                        className="w-full flex items-center gap-1.5 text-left py-0.5 hover:opacity-75 transition-opacity"
                      >
                        <span className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded ${
                          ex.severity === 'high'   ? (isDark ? 'bg-red-500/15 text-red-400'     : 'bg-red-50 text-red-700')
                        : ex.severity === 'medium' ? (isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700')
                        :                            (isDark ? 'bg-gray-700 text-gray-400'       : 'bg-gray-100 text-gray-600')
                        }`}>S{ex.stageId}</span>
                        <span className={`flex-1 text-[10px] truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{ex.desc}</span>
                        <span className={`shrink-0 text-[9px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{ex.time}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Savings Velocity</span>
                    {savingsData && (
                      <span className={`text-[10px] font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        ${savingsData[savingsData.length - 1].toFixed(1)}K/mo
                      </span>
                    )}
                  </div>
                  {savingsData
                    ? <MiniSparkline values={savingsData} color={isDark ? '#34d399' : '#059669'} />
                    : <div className={`h-[22px] text-[10px] flex items-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No data</div>
                  }
                  <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>ROI Report · 8-week trend</div>
                </div>
              </>
            )

          ) : context === 'governance' ? (
            /* ── Governance: Policy Architect Workspace ── */
            <div className="space-y-3">

              {/* New Rule Confirmation — appears after Harden Policy */}
              {precedentData && !ruleApplied && (
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
                }`}>
                  <div className={`text-[10px] font-bold tracking-wider mb-1.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                    🔖 NEW RULE CREATED FROM DISPUTE
                  </div>
                  <p className={`text-[10px] mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="font-semibold">{precedentData.decisionId}:</span> "{precedentData.disputeReason}"
                  </p>
                  <p className={`text-[10px] mb-2.5 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    This override has been recorded as a standing exception. Apply it to Global Policy so the AI won't repeat this decision in the same scenario.
                  </p>
                  <button
                    onClick={() => setRuleApplied(true)}
                    className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors bg-[#87986a] hover:bg-[#6b7a54] text-white"
                  >
                    🛡️ Apply to Global Policy
                  </button>
                </div>
              )}
              {ruleApplied && (
                <div className={`px-3 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-2 ${
                  isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                }`}>
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  Rule added to Global Policy — AI will apply this exception automatically
                </div>
              )}

              {/* ── Per-control-plane workspace ── */}
              {activeControlPlane === 'CP-POL' ? (
                <>
                  {/* Policy Integrity Gauge */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`text-[10px] font-semibold tracking-wider mb-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      POLICY INTEGRITY
                    </div>
                    <div className="flex items-center gap-4">
                      {(() => {
                        const r = 30, cx = 38, cy = 38;
                        const circ = 2 * Math.PI * r;
                        const dash = circ * POLICY_INTEGRITY.pct / 100;
                        const ringColor = POLICY_INTEGRITY.pct >= 90 ? '#87986a' : POLICY_INTEGRITY.pct >= 70 ? '#f59e0b' : '#ef4444';
                        return (
                          <svg width="76" height="76" className="shrink-0">
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? '#333' : '#e5e7eb'} strokeWidth="7" />
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke={ringColor} strokeWidth="7"
                              strokeDasharray={`${dash} ${circ - dash}`}
                              strokeDashoffset={circ * 0.25}
                              strokeLinecap="round"
                            />
                            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill={isDark ? 'white' : '#111'}>{POLICY_INTEGRITY.pct}%</text>
                            <text x={cx} y={cx + 9} textAnchor="middle" fontSize="8" fill={isDark ? '#666' : '#999'}>integrity</text>
                          </svg>
                        );
                      })()}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Compliant</span>
                          <span className={`font-bold tabular-nums ${isDark ? 'text-green-400' : 'text-green-600'}`}>{POLICY_INTEGRITY.compliant.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Exceptions</span>
                          <span className={`font-bold tabular-nums ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{POLICY_INTEGRITY.exceptions}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Last 7 days</span>
                          <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{(POLICY_INTEGRITY.compliant + POLICY_INTEGRITY.exceptions).toLocaleString()} decisions</span>
                        </div>
                      </div>
                    </div>
                    <div className={`mt-2.5 flex items-center justify-between px-2.5 py-1.5 rounded border text-[10px] ${
                      isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-200 bg-red-50'
                    }`}>
                      <span className={isDark ? 'text-red-400' : 'text-red-700'}>💸 Financial leakage (un-hardened rules)</span>
                      <span className={`font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>${POLICY_INTEGRITY.leakage.toLocaleString()}</span>
                    </div>
                  </div>
                  {/* Rule Coverage Map */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`text-[10px] font-semibold tracking-wider mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      RULE COVERAGE MAP · 12-STAGE KERNEL
                    </div>
                    <div className="grid grid-cols-6 gap-1 mb-2">
                      {STAGE_OVERRIDES.map((overrides, i) => {
                        const bg = overrides >= 3 ? 'bg-red-500' : overrides >= 1 ? 'bg-amber-500' : isDark ? 'bg-green-500/60' : 'bg-green-400';
                        return (
                          <div
                            key={i}
                            title={`S${i + 1}: ${STAGE_NAMES_SHORT[i]} — ${overrides} override${overrides !== 1 ? 's' : ''} this week`}
                            className={`h-7 rounded text-[8px] font-bold flex flex-col items-center justify-center text-white ${bg}`}
                          >
                            <span>S{i + 1}</span>
                            {overrides > 0 && <span className="text-[7px] opacity-90">{overrides}×</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div className={`flex items-center gap-3 text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />0 overrides</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" />1–2</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />3+</span>
                    </div>
                  </div>
                  {/* Atlas: Policy Engine */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                    <div className={`text-[10px] font-bold tracking-wider mb-1.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>✨ ATLAS SUGGESTS</div>
                    <p className={`text-[10px] mb-2.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      I've noticed you frequently override the "Budget Cap" rule for PT Maju. Should I update <span className="font-semibold">Rule #14</span> to allow a 10% variance for this vendor automatically?
                    </p>
                    <button
                      className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors bg-[#87986a] hover:bg-[#6b7a54] text-white"
                      onClick={() => window.dispatchEvent(new CustomEvent('buyamia-governance-update-rule'))}
                    >
                      ✅ Update Rule #14 — Allow 10% Variance
                    </button>
                  </div>
                </>

              ) : activeControlPlane === 'CP-ECO' ? (
                <>
                  {/* Budget Utilization Gauge */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`text-[10px] font-semibold tracking-wider mb-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      BUDGET UTILIZATION
                    </div>
                    <div className="flex items-center gap-4">
                      {(() => {
                        const pct = 78, r = 30, cx = 38, cy = 38;
                        const circ = 2 * Math.PI * r;
                        const dash = circ * pct / 100;
                        return (
                          <svg width="76" height="76" className="shrink-0">
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? '#333' : '#e5e7eb'} strokeWidth="7" />
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth="7"
                              strokeDasharray={`${dash} ${circ - dash}`}
                              strokeDashoffset={circ * 0.25}
                              strokeLinecap="round"
                            />
                            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill={isDark ? 'white' : '#111'}>{pct}%</text>
                            <text x={cx} y={cx + 9} textAnchor="middle" fontSize="8" fill={isDark ? '#666' : '#999'}>utilized</text>
                          </svg>
                        );
                      })()}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Total budget</span>
                          <span className={`font-bold tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>$320K</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Spent this month</span>
                          <span className={`font-bold tabular-nums ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>$249.6K</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Cap breaches</span>
                          <span className={`font-bold tabular-nums ${isDark ? 'text-red-400' : 'text-red-600'}`}>2 depts</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {([
                        { dept: 'Kitchen',     pct: 118, over: true  },
                        { dept: 'Beverages',   pct: 82,  over: false },
                        { dept: 'Maintenance', pct: 61,  over: false },
                        { dept: 'Admin',       pct: 45,  over: false },
                      ] as { dept: string; pct: number; over: boolean }[]).map(({ dept, pct, over }) => (
                        <div key={dept}>
                          <div className="flex items-center justify-between text-[10px] mb-0.5">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{dept}</span>
                            <span className={`font-semibold tabular-nums ${over ? (isDark ? 'text-red-400' : 'text-red-600') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>{pct}%</span>
                          </div>
                          <div className={`h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className={`h-1.5 rounded-full ${over ? 'bg-red-500' : 'bg-[#87986a]'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Atlas: Economic Guard */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                    <div className={`text-[10px] font-bold tracking-wider mb-1.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>✨ ATLAS SUGGESTS</div>
                    <p className={`text-[10px] mb-2.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Kitchen dept has exceeded its budget cap 3× this month — this is a recurring high-season pattern. Should I propose a formal <span className="font-semibold">+15% seasonal variance</span> exception for Q3?
                    </p>
                    <button
                      className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors bg-[#87986a] hover:bg-[#6b7a54] text-white"
                      onClick={() => window.dispatchEvent(new CustomEvent('buyamia-governance-update-rule'))}
                    >
                      📋 Propose Seasonal Budget Exception
                    </button>
                  </div>
                </>

              ) : activeControlPlane === 'CP-TRU' ? (
                <>
                  {/* Vendor Trust Health Gauge */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`text-[10px] font-semibold tracking-wider mb-2.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      VENDOR TRUST HEALTH
                    </div>
                    <div className="flex items-center gap-4">
                      {(() => {
                        const pct = 87, r = 30, cx = 38, cy = 38;
                        const circ = 2 * Math.PI * r;
                        const dash = circ * pct / 100;
                        return (
                          <svg width="76" height="76" className="shrink-0">
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? '#333' : '#e5e7eb'} strokeWidth="7" />
                            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#87986a" strokeWidth="7"
                              strokeDasharray={`${dash} ${circ - dash}`}
                              strokeDashoffset={circ * 0.25}
                              strokeLinecap="round"
                            />
                            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill={isDark ? 'white' : '#111'}>{pct}</text>
                            <text x={cx} y={cx + 9} textAnchor="middle" fontSize="8" fill={isDark ? '#666' : '#999'}>avg score</text>
                          </svg>
                        );
                      })()}
                      <div className="flex-1 space-y-1.5">
                        {([
                          { label: 'High trust (≥85)',  count: 14, color: isDark ? 'text-green-400' : 'text-green-600' },
                          { label: 'Mid trust (60–84)', count: 8,  color: isDark ? 'text-amber-400' : 'text-amber-600' },
                          { label: 'Low trust (<60)',   count: 2,  color: isDark ? 'text-red-400'   : 'text-red-600'   },
                        ] as { label: string; count: number; color: string }[]).map(({ label, count, color }) => (
                          <div key={label} className="flex items-center justify-between text-[10px]">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
                            <span className={`font-bold tabular-nums ${color}`}>{count} vendors</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={`mt-2.5 pt-2.5 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className={`text-[9px] font-semibold tracking-wider mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>RECENT CHANGES</div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Indo Seafood</span>
                          <span className={`font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>74 ↓6 pts — below threshold</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>PT Maju Bersama</span>
                          <span className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>94 ↑2 pts — new high</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Atlas: Trust Layer */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                    <div className={`text-[10px] font-bold tracking-wider mb-1.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>✨ ATLAS SUGGESTS</div>
                    <p className={`text-[10px] mb-2.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Indo Seafood dropped 6 points below your 80-point threshold. I recommend placing them on a <span className="font-semibold">30-day watchlist</span> and routing their orders to backup suppliers until their score recovers.
                    </p>
                    <button className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors bg-[#87986a] hover:bg-[#6b7a54] text-white">
                      🔍 Place Indo Seafood on Watchlist
                    </button>
                  </div>
                </>

              ) : (
                <>
                  {/* Simulation Health */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`text-[10px] font-semibold tracking-wider mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      SIMULATION HEALTH · THIS WEEK
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {([
                        { label: 'run',     value: 3, bg: isDark ? 'bg-[#87986a]/10' : 'bg-[#f4f6f0]',   color: isDark ? 'text-white' : 'text-gray-900' },
                        { label: 'passed',  value: 2, bg: isDark ? 'bg-green-500/10' : 'bg-green-50',     color: isDark ? 'text-green-400' : 'text-green-600' },
                        { label: 'flagged', value: 1, bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',     color: isDark ? 'text-amber-400' : 'text-amber-600' },
                      ] as { label: string; value: number; bg: string; color: string }[]).map(({ label, value, bg, color }) => (
                        <div key={label} className={`flex-1 text-center py-2 rounded-lg ${bg}`}>
                          <div className={`text-lg font-bold ${color}`}>{value}</div>
                          <div className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>LAST RESULT</div>
                    <div className={`px-2.5 py-2 rounded-lg mb-2 ${isDark ? 'bg-amber-500/8 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                      <div className={`text-[10px] font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>⚠ Chicken +20% spike</div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>S5 would bottleneck — REA-004 at 94% capacity</div>
                    </div>
                    <div className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>PENDING</div>
                    <div className={`px-2.5 py-2 rounded-lg border text-[10px] ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      PT Maju new contract scenario — <span className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>not yet run</span>
                    </div>
                  </div>
                  {/* Atlas: Simulation Sandbox */}
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                    <div className={`text-[10px] font-bold tracking-wider mb-1.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>✨ ATLAS SUGGESTS</div>
                    <p className={`text-[10px] mb-2.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      PT Maju proposed new contract terms last week and no simulation has been run yet. I can model how their new pricing affects your Stage 4–5 pipeline before you commit.
                    </p>
                    <button className="w-full py-1.5 rounded text-[11px] font-semibold transition-colors bg-[#87986a] hover:bg-[#6b7a54] text-white">
                      🧪 Run PT Maju Contract Simulation
                    </button>
                  </div>
                </>
              )}

            </div>

          ) : (
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      isDark
                        ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800 hover:border-gray-700'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`h-4 w-4 mb-2 ${action.color}`} />
                    <div className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{action.label}</div>
                    <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{action.description}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Insights & Updates — label and content pivot with governance filter */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <h3 className={`text-[10px] font-semibold tracking-wider mb-3 ${
            context === 'governance' && activeGovernanceFilter
              ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
              : isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>{insightsLabel}</h3>
          <div className="space-y-3">
            {insights.map((insight, index) => {
              const Icon = insight.icon;
              return (
                <div key={index} className={`p-3 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
                      <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{insight.title}</span>
                    </div>
                    <Badge variant="outline" className={insight.badgeColor}>{insight.badge}</Badge>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{insight.description}</p>
                  {insight.recommendedAction && (
                    <button
                      onClick={() => insight.actionEvent && window.dispatchEvent(new CustomEvent(insight.actionEvent))}
                      className={`mt-2 text-[11px] font-semibold px-2.5 py-1 rounded border transition-colors ${
                        isDark
                          ? 'border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/10'
                          : 'border-[#87986a]/40 text-[#6b7a54] hover:bg-[#f4f6f0]'
                      }`}
                    >
                      {insight.recommendedAction}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Chat messages + suggestions ── */}
        <div className="p-4">
          <h3 className={`text-[10px] font-semibold mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{chatLabel.toUpperCase()}</h3>

          {/* Suggestions — only on fresh chat */}
          {messages.length === 1 && (
            <div className="space-y-1.5 mb-3">
              {suggestions.slice(0, 2).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setAiInput(suggestion.text)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                    isDark
                      ? 'bg-[#2a2a2a] hover:bg-gray-800 text-gray-400 hover:text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700'
                  }`}
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="text-xs">{suggestion.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="space-y-2">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] px-3 py-2 rounded-xl text-[10px] leading-snug ${
                  message.type === 'user'
                    ? isDark ? 'bg-[#87986a] text-white' : 'bg-[#6b7a54] text-white'
                    : isDark ? 'bg-[#2a2a2a] text-gray-300 border border-gray-800' : 'bg-gray-100 text-gray-700'
                }`}>
                  {message.type === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className={`h-2.5 w-2.5 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
                      <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{chatLabel}</span>
                    </div>
                  )}
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Input only — pinned to bottom ── */}
      <div className={`shrink-0 p-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex gap-2">
          <Input
            placeholder="Ask anything..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className={`flex-1 h-8 text-xs ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : ''}`}
          />
          <Button
            size="sm"
            onClick={handleSendMessage}
            className="h-8 w-8 p-0 bg-[#87986a] hover:bg-[#6b7a54]"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

    </div>
  );
}
