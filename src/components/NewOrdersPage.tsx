import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Truck, CheckCircle, Clock, AlertTriangle, Package,
  RefreshCw, MessageCircle, MapPin, ThumbsUp, ThumbsDown,
  Sparkles, Send, Activity, DollarSign, Zap,
  X, Search, ArrowRight, CircleCheck,
  PhoneCall, Check, Gauge, ChevronDown, ChevronUp,
  Eye, Bot, ShieldCheck, Hand, PauseCircle, PlayCircle,
  ExternalLink, Lock, User, FileUp, Edit3, Lightbulb,
  Pencil, Plus, Calendar, Repeat, MoreHorizontal, ArrowLeft,
  Maximize2, Minimize2, LayoutGrid, List, SquareCheckBig, Square,
  Download, TrendingUp, History, Filter as FilterIcon, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { theme as themeTokens } from '../lib/theme';
import { workflowTemplates, finnsPolicyRules } from '../lib/mockData';
import { logUserAction, type ActionKind } from '../lib/actionLog';
import { useAgentsPaused } from '../lib/autonomy';
import { AgentCTA } from './AgentCTA';
import { ManualNotes } from './ManualNotes';
import { useRuntimePOs, type RuntimePO } from '../lib/poStore';
import { useRFQs } from '../lib/rfqStore';
import { fmtIdrShort } from '../lib/format';
import {
  useThread, appendMessage, setThread,
  readThread,
  type BridgeMessage, type BridgeChannel,
} from '../lib/sourceBridgeStore';

interface OrdersPageProps {
  theme: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

// ── Labor Switch (Manual Takeover) ───────────────────────────────
// Phase 6: aligned with AutonomyMode in lib/autonomy.ts.
// Legacy `'agent'` reads as `'auto'`; the UI labels "Auto" / "Manual".
type LaborMode = 'manual' | 'auto';

interface AssignedAgent {
  id: number;     // legacy numeric slot; mapped to Finn's A-01..A-05 in agentBadge
  role: string;   // e.g. "Logistics", "Sourcing", "Restock"
}

// Translate legacy Buyamia numeric agent IDs to the 6-agent Finn's roster.
// Defaults to A-02 (Restock) for any unknown legacy id. Phase 4 sweeps the
// mock data to use the canonical IDs directly.
const LEGACY_AGENT_MAP: Record<number, string> = {
  1: 'A-04',   // PO Engine → Spend Watchdog
  3: 'A-02',   // Demand Signal → Restock
  5: 'A-01',   // Sourcing
  6: 'A-01',   // Pricing → Sourcing
  7: 'A-05',   // Logistics
  8: 'A-02',   // Restock
  9: 'A-05',   // Quality → Logistics (QC stage)
  10: 'A-04',  // Ops Analytics → Spend Watchdog
  13: 'A-03',  // Exception Handler / Supplier Comms → Vendor Comms
  14: 'A-04',  // Pricing/ERP → Spend Watchdog
  18: 'A-04',  // ERP → Spend Watchdog
  21: 'A-01',  // Market Intel → Sourcing
  25: 'A-02',  // POS Intelligence → Restock
  28: 'A-04',  // Finance / Payments → Spend Watchdog
  33: 'A-04',  // Compliance → Spend Watchdog
};

function agentBadge(a: AssignedAgent) {
  return LEGACY_AGENT_MAP[a.id] ?? 'A-02';
}

function agentLabel(a: AssignedAgent) {
  return `${agentBadge(a)} · ${a.role}`;
}

// ── Deterministic helpers (stable across renders) ──────────────────
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}

// ── HITL: Authorization-gated stages ────────────────────────────────
// Stage 1 (Request) and Stage 5 (Delivered & Checked) have human
// gatekeepers — even in Agent mode, the primary action remains
// "Review & Authorize" for these stages.
// Stage 1 (Quote/Vendor Confirmed) is the PO approval gate — the admin
// reviews the inbound quote + policy stack before the PO is sent to the
// vendor. Stage 4 (Delivered & Checked) is the QC gate at receiving.
// Those two require explicit Authorize copy on the action button.
function requiresHumanAuthorization(stageIdx: number) {
  return stageIdx === 1 || stageIdx === 4;
}

// ── Auto-mode HITL gates (6s) ─────────────────────────────────────────
//
// In Auto mode the agents run the journey end-to-end. The ONLY
// hard-coded gates are:
//
//   Stage 4 with perishables — visual QC required for items the agent
//     can't auto-clear from a photo (Wagyu, sashimi-grade tuna,
//     burrata, oysters, foie). Physical reality.
//
//   Disputed orders — by definition the agent couldn't act and
//     surfaced to the human.
//
// The OPTIONAL gate is the spend cap. It lives as a real policy rule
// in finnsPolicyRules (RUL-001). Default INACTIVE for the demo so
// the flow shows real automation. Admin can flip it on from A&G →
// Policy tab to enforce a Stage 1 sign-off above the threshold —
// segregation-of-duties for material spend.
const PERISHABLE_KEYWORDS = [
  'wagyu', 'sashimi', 'burrata', 'foie', 'oyster', 'mb7',
];

function basketHasPerishable(order: Order): boolean {
  const blob = order.items.join(' ').toLowerCase();
  return PERISHABLE_KEYWORDS.some(k => blob.includes(k));
}

/** Returns the active spend-cap rule (if any). null when the gate is off. */
function activeSpendCapRule(): { threshold: number; ruleId: string } | null {
  const rule = finnsPolicyRules.find(r => r.active && r.template === 'spend-cap');
  if (!rule) return null;
  const threshold = (rule.config.threshold as number | undefined) ?? 0;
  return { threshold, ruleId: rule.id };
}

/** True when the Auto agent must halt at this stage and surface to the human. */
function autoHumanGateAt(order: Order, stage: number): boolean {
  if (order.status === 'disputed')                         return true;
  if (stage === 4 && basketHasPerishable(order))           return true;
  // Optional cap gate — only when admin has activated the rule.
  if (stage === 1) {
    const cap = activeSpendCapRule();
    if (cap && order.amount > cap.threshold)               return true;
  }
  return false;
}

/** What action does the human need to take at the current effective stage? */
type DerivedActionKind = 'approve' | 'confirm-delivery' | 'resolve-issue' | null;
function derivedActionKind(order: Order, stage: number): DerivedActionKind {
  if (order.status === 'disputed') return 'resolve-issue';
  if (stage === 4 && basketHasPerishable(order)) return 'confirm-delivery';
  if (stage === 1) {
    const cap = activeSpendCapRule();
    if (cap && order.amount > cap.threshold) return 'approve';
  }
  return null;
}

/** Demo cadence — how long between auto-advances. Keep visible but not spammy. */
const AUTO_ADVANCE_INTERVAL_MS = 8_000;

// ── 6r · Stage data the AUTO agent writes when it advances ─────────────
//
// When the auto-progress engine completes a stage, we record realistic
// per-stage artifacts so the Stage Task Module shows real data (and
// proper Agent attribution) when the admin reviews it afterwards. Each
// agent does specific work and signs off in its own way.
//
// Pure helper — no React state inside.
function agentStageDataFor(
  order: Order,
  completingStage: number,            // the stage being marked complete (NOT toStage)
  quoteChannelFromRuntime?: string,   // 'WhatsApp' | 'Email' | undefined
  quoteLeadDaysFromRuntime?: number,
): Record<string, string> {
  const seed = hashStr(`${order.id}-${completingStage}-agent`);
  const num = (digits: number) => String(seed % 10 ** digits).padStart(digits, '0');
  // Pick a venue tag from the items list when possible — needed for the
  // POD receiver label at Stage 4.
  const venueMatch = order.items.join(' ').match(/BC|RC|ST|SP/);
  const venue = venueMatch?.[0] ?? 'BC';
  const venueReceivers: Record<string, string> = {
    BC: 'Wayan Sukarjo (BC Kitchen)',
    RC: 'Ketut Mahendra (RC Receiving)',
    ST: 'Made Wirawan (Stake Receiving)',
    SP: 'Putu Adi (Splash Stockroom)',
  };
  if (completingStage === 0) {
    return {
      reason: `${order.workflowTemplate === 'WF-RSH' ? 'Par floor breach (Rush)' : 'Restock cycle'} · ${order.items[0]?.split(' ')[0] ?? 'SKU'}`,
      urgency: order.workflowTemplate === 'WF-RSH' ? 'urgent' : 'standard',
    };
  }
  if (completingStage === 1) {
    return {
      channel: quoteChannelFromRuntime ?? 'WhatsApp',
      lead_time: quoteLeadDaysFromRuntime != null ? `${quoteLeadDaysFromRuntime} days` : `${1 + (seed % 3)} days`,
      quote_amt: String(order.amount),
    };
  }
  if (completingStage === 2) {
    return {
      po_pdf:     `${order.id}_PO_v1.pdf`,
      policy_ref: `POL-2026-${num(5)}`,
    };
  }
  if (completingStage === 3) {
    return {
      carrier:  order.items.join(' ').toLowerCase().includes('beer') ? 'Bintang Logistics' : 'PT Express Bali',
      tracking: `TRK-${num(7)}`,
      eta:      order.eta,
    };
  }
  if (completingStage === 4) {
    return {
      pod:         `${order.id}_signed_POD.jpg`,
      qc_outcome:  order.status === 'disputed' ? 'fail' : 'pass',
      receiver:    venueReceivers[venue] ?? venueReceivers.BC,
    };
  }
  return {};
}

// ── 5-Stage DAG (matches PLATFORM-MAP.md canonical model) ───────────
const DAG_STAGES: { label: string; agentStep?: string }[] = [
  { label: 'Request',                  agentStep: 'A-02 (Restock) raised the demand signal — par breach, scheduled trigger, or human-issued.' },
  { label: 'Quote / Vendor Confirmed', agentStep: 'A-01 (Sourcing) ran the playbook. RFQ for Standard, direct vendor for Rush, contract draw for Recurring. Quote validated vs 30-day market median.' },
  { label: 'PO Approved',              agentStep: 'A-04 (Spend Watchdog) checked the policy stack — spend cap, vendor trust floor, duplicate detection. PO issued to vendor on pass.' },
  { label: 'In Transit',               agentStep: 'A-05 (Logistics) confirmed dispatch and tracks ETA. Cold-chain sensors monitored for proteins, seafood, dairy.' },
  { label: 'Delivered & Checked',      agentStep: 'Receiving venue staff QC the delivery against PO. Pass → stock updated. Fail → dispute opened on Activity & Governance.' },
];

// ── Manual Takeover · Task Modules ───────────────────────────────────
// One module per DAG stage. When the Admin enters Manual mode, clicking
// a stage opens its task module — a typed form requiring human evidence
// before the stage can be marked complete.
//
// Each module also carries an "Active Handshake" delegation offer:
// even within Manual Mode, the Admin can hand a specific sub-task back
// to Atlas (e.g. "poll the carrier API every 15 min"). Delegation
// persists across Save Draft and is surfaced as a chip on the stepper.
type StageInputKind = 'text' | 'textarea' | 'select' | 'file' | 'date';
interface StageInput {
  kind: StageInputKind;
  key: string;
  label: string;
  placeholder?: string;
  options?: string[];      // for 'select'
  accept?: string;         // for 'file'
  required?: boolean;      // hard-required to "Mark Complete"
  // Atlas can pull this field's value from the vetted internal directory
  // (vendor profile, finance ledger, prior PO). Drives the "Find that data"
  // offer when the user submits with the field empty.
  fortressLookup?: string;
}
interface TaskModule {
  action: string;
  copilotHint: string;        // hint copy shown by Atlas in the modal + right pane
  delegationLabel: string;    // CTA copy for the Active Handshake button
  delegationLockedCopy: string; // copy shown after delegation is locked in
  delegationDependsOn?: string[]; // input keys whose values must be present to enable delegation
  inputs: StageInput[];
}
const TASK_MODULES: TaskModule[] = [
  // Stage 1 — Request
  { action: 'Raise / Confirm Request',
    copilotHint: 'I can prefill from the linked SKU\'s par-floor breach (Inventory) or the source PO (Re-order).',
    delegationLabel: 'Auto-draft from inventory signal',
    delegationLockedCopy: 'Atlas is drafting the request from the inventory signal. You will be alerted when ready.',
    inputs: [
      { kind: 'textarea', key: 'reason',  label: 'Reason / Trigger', placeholder: 'Par breach, scheduled trigger, manual ask…', required: true },
      { kind: 'select',   key: 'urgency', label: 'Urgency', options: ['standard', 'urgent', 'recurring'], required: true },
    ] },
  // Stage 2 — Quote / Vendor Confirmed
  { action: 'Log Quote · Vendor Confirmation',
    copilotHint: "Vendor's preferred channel is WhatsApp. I can pull the last accepted quote from the vendor profile.",
    delegationLabel: 'Send RFQ via preferred channel',
    delegationLockedCopy: 'Atlas is sending the RFQ and will log responses automatically.',
    delegationDependsOn: ['channel'],
    inputs: [
      { kind: 'select', key: 'channel',     label: 'Confirmed via',     options: ['WhatsApp', 'Telegram', 'Email', 'Phone'], required: true },
      { kind: 'text',   key: 'lead_time',   label: 'Estimated Lead Time', placeholder: 'e.g. 2 days', required: true, fortressLookup: 'historical lead-time average for this vendor' },
      { kind: 'text',   key: 'quote_amt',   label: 'Quote Amount (Rp)', placeholder: 'e.g. 14200000', required: true },
    ] },
  // Stage 3 — PO Approved
  { action: 'Approve PO · Policy Gate',
    copilotHint: 'I can verify spend cap headroom and vendor trust floor before you approve. Above-threshold POs route to the Manager queue.',
    delegationLabel: 'Auto-run policy stack',
    delegationLockedCopy: 'Atlas is running the policy stack and will paste the approval reference back.',
    inputs: [
      { kind: 'file', key: 'po_pdf',     label: 'Upload Signed PO PDF', accept: '.pdf', required: true, fortressLookup: 'last accepted quote PDF in vendor profile' },
      { kind: 'text', key: 'policy_ref', label: 'Policy Check Reference', placeholder: 'e.g. pol-2026-3041', required: true },
    ] },
  // Stage 4 — In Transit
  { action: 'Log Dispatch · Track Shipment',
    copilotHint: 'I can poll the carrier API every 15 min once you save the tracking number.',
    delegationLabel: 'Poll carrier API every 15 min',
    delegationLockedCopy: 'Atlas is polling the carrier API every 15 min. You will be alerted on status changes.',
    delegationDependsOn: ['tracking'],
    inputs: [
      { kind: 'text', key: 'carrier',     label: 'Carrier Name', placeholder: 'e.g. JNE Trucking', required: true, fortressLookup: 'default carrier on this lane' },
      { kind: 'text', key: 'tracking',    label: 'Tracking Number', placeholder: 'e.g. 180-12345678', required: true },
      { kind: 'date', key: 'eta',         label: 'ETA at Receiving Venue' },
    ] },
  // Stage 5 — Delivered & Checked
  { action: 'QC at Receiving Venue',
    copilotHint: "I'll auto-update inventory once you upload signed POD and mark QC outcome.",
    delegationLabel: 'Auto-update inventory on QC pass',
    delegationLockedCopy: 'Atlas will write the inventory delta and close the order on QC pass.',
    delegationDependsOn: ['pod'],
    inputs: [
      { kind: 'file',   key: 'pod',          label: 'Signed Proof of Delivery (POD)', accept: 'image/*,.pdf', required: true },
      { kind: 'select', key: 'qc_outcome',   label: 'QC Outcome', options: ['pass', 'fail', 'conditional'], required: true },
      { kind: 'text',   key: 'receiver',     label: 'Receiving Staff', placeholder: 'e.g. Wayan Sukarjo (BC)', required: true },
    ] },
];

// ── Stage History · Paper Trail ─────────────────────────────────────
// Synthesized record returned for any completed stage that has no human
// override. Eliminates "Not Captured" placeholders — every autonomous
// action carries Trigger / Data / Proof / Logic per the audit standard.
interface StageHistory {
  data: Record<string, string>;
  trigger: string;        // Why did the action happen?
  proof: string;          // Document IDs, API timestamps, verification codes
  logic: string;          // 1-sentence Atlas summary of the decision
  verifiedAtIso: string;  // Synthesized timestamp (deterministic per order × stage)
}

// ── Action-centric taxonomy ──────────────────────────────────────────
type ActionGroup = 'needs-action' | 'autonomous';
type ActionKind  = 'approve' | 'confirm-delivery' | 'resolve-issue' | 'pay';

// ── Order lifecycle status (Audit Mode taxonomy) ────────────────────
// `live` covers any order that's currently moving through the pipeline
// (anything pre-Stage 11 plus the action-required gates). Historical
// orders carry one of the terminal statuses.
type OrderStatus = 'live' | 'completed' | 'disputed' | 'cancelled' | 'on-hold';

interface Order {
  id: string;
  supplier: string;
  items: string[];
  amount: number;
  group: ActionGroup;
  actionKind?: ActionKind;
  humanAction: string;               // e.g. "Approve", "Confirm Delivery"
  humanStatus: string;
  humanDescription: string;
  eta: string;
  etaMinutes?: number;
  dagStage: number;
  agentReasoning: string;
  agentAgent: string;
  assignedAgent: AssignedAgent;       // Wayne doctrine: every order has a named member of staff
  financeInsight?: string;
  saving?: { time: string; cost: number };
  failureReason?: string;
  negotiating?: boolean;
  isNewSupplier?: boolean;
  digitalTwin?: { switchSaving: string; leadTimeDelta: string; recommendation: string };
  // ── Audit-mode fields ─────────────────────────────────────────────
  // `createdAt` / `completedAt` are ISO strings. `status` is the
  // terminal label. `resolution` is the human reason for terminal
  // disputed / cancelled / on-hold cases.
  createdAt: string;
  completedAt?: string;
  status: OrderStatus;
  resolution?: string;
  // ── Workflow template (Mission Brief / Kernel Workflow) ───────────
  // The playbook this PO ran through. Drives stage cadence, autonomy
  // ceiling, and which agents own which stages. Sourced from the 8
  // seeded `workflowTemplates` in lib/mockData.ts (WF-STD / WF-RSH /
  // WF-BPO / WF-GRP / WF-EMR / WF-PRD / WF-MNT / WF-CPX).
  workflowTemplate: string;
}

// Helper: short label for a workflow template id (e.g. 'WF-STD' → 'Standard').
function workflowLabel(id: string): string {
  if (id === 'WF-STD') return 'Standard';
  if (id === 'WF-RSH') return 'Rush';
  if (id === 'WF-REC') return 'Recurring';
  // Legacy Buyamia workflow ids — keep a fallback for any historical mock
  // data that still references them. Phase 4 sweeps these out of the data.
  return workflowTemplates.find(w => w.id === id)?.name ?? id;
}

// Deterministic playbook picker. Finn's only runs 3 playbooks.
// 'rush' and 'recurring' hints are honored when supplied; otherwise 70%
// Standard, 20% Rush, 10% Recurring.
function pickWorkflow(seed: number, hint?: 'rush' | 'recurring'): string {
  if (hint === 'rush')      return 'WF-RSH';
  if (hint === 'recurring') return 'WF-REC';
  const roll = seed % 100;
  if (roll < 70) return 'WF-STD';
  if (roll < 90) return 'WF-RSH';
  return            'WF-REC';
}

// ── Finn's seeded live orders ─────────────────────────────────────
// Numeric `assignedAgent.id` keeps the legacy slot (mapped to A-NN by
// LEGACY_AGENT_MAP). amount is IDR. dagStage uses the 5-stage range (0-4).
const SEEDED_ORDERS: Order[] = [
  {
    id: 'PO-3041', supplier: 'PT Bali Seafood Lestari',
    items: ['Yellowfin Tuna sashimi 8kg · ST', 'Yellowfin Tuna food-grade 22kg · BC', 'Prawns 14kg · BC + ST + RC'],
    amount: 14_200_000, group: 'autonomous',
    humanAction: '',
    humanStatus: 'Quote in via WhatsApp · A-04 issuing PO',
    humanDescription: 'Sashimi-grade for Stake, food-grade for BC, prawns split across three venues. Wayan Sukma sent the quote on WhatsApp.',
    eta: 'May 17 · 11:00', dagStage: 1,
    agentReasoning: "Wayan Sukma (PT Bali Seafood) WhatsApped the quote at 08:30 — 4% below the 30-day median. Cold-chain SLA 98%. Combined drop reuses one cold-chain run. No active spend-cap rule blocks — A-04 will issue the PO and A-05 picks up the delivery leg. You'll see this back in your queue at Stage 4 for the sashimi-grade QC.",
    agentAgent: 'A-01 (Sourcing)',
    assignedAgent: { id: 5, role: 'Sourcing' },
    financeInsight: "Rp 590k saving estimated vs the next-best quote. A-04 cleared the policy stack except the cap rule.",
    saving: { time: '1.5h', cost: 590_000 },
    createdAt: '2026-05-15T08:30:00.000Z',
    status: 'live',
    workflowTemplate: 'WF-STD',
  },
  {
    id: 'PO-3043', supplier: 'AUS Premium Meats',
    items: ['Wagyu Ribeye MB7+ 6kg · ST'],
    amount: 28_500_000, group: 'autonomous',
    humanAction: '',
    humanStatus: 'Rush quote in · A-04 issuing PO',
    humanDescription: 'Stake Wagyu par floor breach — 2-day gap risk for the weekend tasting menu.',
    eta: 'May 18 · 09:00', dagStage: 1,
    agentReasoning: "Restock Agent flagged par floor breach this morning. A-02 promoted to Rush playbook. AUS Premium Meats is your contracted Wagyu vendor — quote confirmed verbally with James Whitaker then backed by an emailed PDF within the 12% Rush premium tolerance. USD 1,840 locked at 15,490. No active spend-cap rule blocks — A-04 will issue the PO. You'll see this back at Stage 4 for visual QC on the MB7+ Wagyu.",
    agentAgent: 'A-02 (Restock)',
    assignedAgent: { id: 8, role: 'Restock' },
    financeInsight: "USD-denominated import. FX locked at 15,490 — IDR exposure capped at Rp 28.5M.",
    saving: { time: '2.0h', cost: 0 },
    isNewSupplier: false,
    createdAt: '2026-05-16T09:10:00.000Z',
    status: 'live',
    workflowTemplate: 'WF-RSH',
  },
  {
    id: 'PO-3047', supplier: 'Eka Packaging',
    items: ['Takeaway box 1000ml · 6 cases · SP'],
    amount: 18_900_000, group: 'needs-action', actionKind: 'resolve-issue',
    humanAction: 'Resolve Issue',
    humanStatus: 'Disputed — quote 18% above market (via email)',
    humanDescription: 'Splash Saturday event needs takeaway boxes; quote came in by email and Spend Watchdog flagged it. Dispute open in Activity & Governance.',
    eta: 'May 18 · 14:00', dagStage: 1,
    agentReasoning: "Quote arrived via email from Eka Packaging — 18% above 30-day median. A-04 held under RUL-001 (Spend Cap, vendor scope). No alternative vendor carries the 1000ml SKU. F&B Director raised dispute DSP-101 to accept the premium.",
    agentAgent: 'A-04 (Spend Watchdog)',
    assignedAgent: { id: 1, role: 'Spend Watchdog' },
    failureReason: 'Quote +18% above market — held under RUL-001 spend cap',
    negotiating: true,
    saving: { time: '0h', cost: 0 },
    createdAt: '2026-05-14T11:20:00.000Z',
    status: 'disputed',
    workflowTemplate: 'WF-STD',
  },
  {
    id: 'PO-3048', supplier: 'Krakatoa Coldstore',
    items: ['Pork belly 18kg · BC + RC', 'Chicken thighs 28kg · all'],
    amount: 6_700_000, group: 'autonomous',
    humanAction: '',
    humanStatus: 'PO approved — vendor confirming dispatch window',
    humanDescription: 'A-04 cleared the policy stack at 07:12. WhatsApp PO sent to Ngurah Wisesa; awaiting his pickup-window confirmation before dispatch.',
    eta: 'May 17 · 06:00', dagStage: 2,
    agentReasoning: "A-04 (Spend Watchdog) cleared this under the auto-approve cap (Rp 8M) — no rule blocks. Ngurah Wisesa (Krakatoa) typically replies within 2h on WhatsApp confirming the pickup window for next-morning drops. Cold-chain SLA 96%. Nothing for you to do unless his ETA reply drifts past today.",
    agentAgent: 'A-04 (Spend Watchdog)',
    assignedAgent: { id: 1, role: 'Spend Watchdog' },
    saving: { time: '1.2h', cost: 180_000 },
    createdAt: '2026-05-16T07:12:00.000Z',
    status: 'live',
    workflowTemplate: 'WF-STD',
  },
  {
    id: 'PO-3044', supplier: 'Bintang Distribusi',
    items: ['Bintang Beer cases · 90 BC · 54 SP · 36 RC'],
    amount: 9_400_000, group: 'autonomous',
    humanAction: '',
    humanStatus: 'In transit — ETA 14:00 today',
    humanDescription: 'Multi-venue Bintang drop. Logistics tracking — truck 60km out.',
    eta: 'May 16 · 14:00', etaMinutes: 90, dagStage: 3,
    agentReasoning: "Multi-venue Bintang shipment. A-05 tracking — vehicle 60km out, ETA 14:00. BC receives 50%, SP 30%, RC 20%. Receiving leads notified via WhatsApp.",
    agentAgent: 'A-05 (Logistics)',
    assignedAgent: { id: 7, role: 'Logistics' },
    saving: { time: '1h', cost: 320_000 },
    createdAt: '2026-05-12T08:00:00.000Z',
    status: 'live',
    workflowTemplate: 'WF-STD',
  },
  {
    id: 'PO-3045', supplier: 'Sumber Dairy',
    items: ['Butter Anchor 24kg · BC + RC', 'Burrata 12pcs · ST'],
    amount: 3_200_000, group: 'needs-action', actionKind: 'confirm-delivery',
    humanAction: 'Confirm Delivery',
    humanStatus: 'Delivered — awaiting QC check-in',
    humanDescription: 'Delivered to BC kitchen at 09:42. Burrata batch needs visual QC before stock release.',
    eta: 'Now', etaMinutes: 0, dagStage: 4,
    agentReasoning: "Delivered. Receiving lead WhatsApped the unloading photo at 09:42. A-05 awaiting your QC sign-off at BC kitchen — burrata batch needs a visual check before stock release.",
    agentAgent: 'A-05 (Logistics)',
    assignedAgent: { id: 7, role: 'Logistics' },
    saving: { time: '0.5h', cost: 0 },
    createdAt: '2026-05-13T07:30:00.000Z',
    status: 'live',
    workflowTemplate: 'WF-STD',
  },
  {
    id: 'PO-3046', supplier: 'PT Wine Cellar Nusa',
    items: ['Prosecco Treviso DOC 96btl · RC + ST'],
    amount: 42_000_000, group: 'autonomous',
    humanAction: '',
    humanStatus: 'Cleared customs — last-mile Sunday',
    humanDescription: 'Imported wine cleared Tanjung Priok yesterday. Logistics coordinating cold-chain last-mile to Bali warehouse.',
    eta: 'May 18 · 16:00', dagStage: 3,
    agentReasoning: "Cleared Tanjung Priok customs. Vendor emailed the BL + customs clearance scan; Logistics coordinating last-mile with the cold-chain handler via WhatsApp. USD 2,710 locked at 15,500.",
    agentAgent: 'A-05 (Logistics)',
    assignedAgent: { id: 7, role: 'Logistics' },
    saving: { time: '3h', cost: 0 },
    createdAt: '2026-05-02T10:00:00.000Z',
    status: 'live',
    workflowTemplate: 'WF-STD',
  },
  {
    id: 'PO-3042', supplier: 'CV Indo Sayur',
    items: ['Mixed greens 15kg · BC + ST', 'Tomatoes 36kg · all venues', 'Lime 32kg · all venues'],
    amount: 4_800_000, group: 'autonomous',
    humanAction: '',
    humanStatus: 'Delivered · May 16',
    humanDescription: 'Weekly recurring produce — Pak Made delivered at 06:00. QC pass. Stock updated across BC + SP.',
    eta: 'May 16 · 06:00', dagStage: 4,
    agentReasoning: "Recurring weekly produce — A-04 auto-approved under standing recurring schedule. Pak Made confirmed Monday drop via WhatsApp on Sunday evening. QC pass at receiving. Stock auto-incremented.",
    agentAgent: 'A-02 (Restock)',
    assignedAgent: { id: 8, role: 'Restock' },
    saving: { time: '1.5h', cost: 240_000 },
    createdAt: '2026-05-14T05:00:00.000Z',
    completedAt: '2026-05-16T06:00:00.000Z',
    status: 'live',
    workflowTemplate: 'WF-REC',
  },
];

// ── Historical orders — Audit Mode ledger ──────────────────────────
// ~40 records spread across the last 90 days. Reuses suppliers and
// agents from the live set so the audit surface stays inside the
// Fortress directory.

// Historical pools — Finn's roster + vendor directory.
// AssignedAgent.id stays numeric (legacy slot); LEGACY_AGENT_MAP renders A-NN.
const HISTORICAL_AGENTS: AssignedAgent[] = [
  { id: 5,  role: 'Sourcing' },
  { id: 8,  role: 'Restock' },
  { id: 13, role: 'Vendor Comms' },
  { id: 1,  role: 'Spend Watchdog' },
  { id: 7,  role: 'Logistics' },
];

const HISTORICAL_SUPPLIERS: string[] = [
  'PT Bali Seafood Lestari', 'CV Indo Sayur', 'Krakatoa Coldstore', 'Bintang Distribusi',
  'Sumber Dairy', 'PT Wine Cellar Nusa', 'Eka Packaging', 'AUS Premium Meats',
  'Kopi Bali Roastery', 'Pulau Dry Goods', 'Bali Fresh Farms',
];

const HISTORICAL_ITEMS: string[][] = [
  ['Yellowfin Tuna sashimi 6kg · ST', 'Yellowfin Tuna food-grade 18kg · BC'],
  ['Prawns 14kg · BC + ST', 'Mahi Mahi fillets 9kg · ST'],
  ['Mixed greens 12kg · BC + ST', 'Tomatoes 28kg · all venues', 'Lime 22kg'],
  ['Wagyu Ribeye MB7+ 5kg · ST'],
  ['Pork belly 22kg · BC + RC', 'Chicken thighs 35kg · all'],
  ['Bintang case x140 · BC + SP'],
  ['Prosecco 72btl · RC + ST', 'House red 48btl · RC'],
  ['Butter Anchor 18kg · all', 'Burrata 9pcs · ST', 'Milk UHT 60L'],
  ['Olive oil EV tin x10', 'Jasmine rice 18 sacks'],
  ['Kopi Bali 25kg · all venues'],
  ['Takeaway box 1000ml · 4 cases · SP'],
  ['Coca-Cola case x48 · BC + SP'],
  ['Cream heavy 12L · BC + ST'],
];

const RESOLUTIONS = {
  disputed: [
    'QC fail — moisture content exceeded contract spec',
    'Late by 14h — cold-chain breach at transit hub',
    'Short shipment — only 80% of ordered volume delivered',
    'Wrong cut delivered — supplier acknowledged error',
    'Damaged packaging on 30% of pallets',
  ],
  cancelled: [
    'Cancelled before dispatch — duplicate PO discovered',
    'Cancelled — supplier could not meet delivery window',
    'Cancelled — admin found in-stock equivalent locally',
    'Cancelled — budget freeze authorized by ops manager',
  ],
  'on-hold': [
    'Awaiting supplier credit-line confirmation',
    'On hold — supplier compliance docs expired',
    'On hold — pending quality re-test on prior shipment',
  ],
} as const;

function makeHistoricalOrders(): Order[] {
  // Anchor date: today is 2026-05-12 in the seeded data world.
  const NOW = new Date('2026-05-12T12:00:00.000Z').getTime();
  const DAY = 86_400_000;
  const orders: Order[] = [];

  // 28 completed (on-time)
  for (let i = 0; i < 28; i++) {
    const seed = hashStr(`completed-${i}`);
    const daysAgo = 3 + (seed % 87);
    const cycleHours = 36 + (seed % 60);
    const supplier = HISTORICAL_SUPPLIERS[seed % HISTORICAL_SUPPLIERS.length];
    const items = HISTORICAL_ITEMS[seed % HISTORICAL_ITEMS.length];
    const agent = HISTORICAL_AGENTS[seed % HISTORICAL_AGENTS.length];
    const amount = 800 + (seed % 11200);
    const createdAt = new Date(NOW - daysAgo * DAY).toISOString();
    const completedAt = new Date(NOW - daysAgo * DAY + cycleHours * 3600_000).toISOString();
    orders.push({
      id: `PO-${2400 + i}`,
      supplier,
      items,
      amount,
      group: 'autonomous',
      humanAction: '',
      humanStatus: `Delivered`,
      humanDescription: `${supplier} delivered on time. Cold-chain verified, auto-payment cleared.`,
      eta: completedAt.slice(0, 10),
      dagStage: 4,
      agentReasoning: `SLA met. ${agent.role} agent closed out without intervention.`,
      agentAgent: agentLabel(agent),
      assignedAgent: agent,
      // Savings stored in IDR — scaled to match the live-PO range (40k–1M Rp per PO).
      saving: { time: `${(1 + (seed % 35) / 10).toFixed(1)}h`, cost: (80 + (seed % 950)) * 1000 },
      createdAt,
      completedAt,
      status: 'completed',
      workflowTemplate: pickWorkflow(seed),
    });
  }

  // 4 completed late
  for (let i = 0; i < 4; i++) {
    const seed = hashStr(`late-${i}`);
    const daysAgo = 5 + (seed % 70);
    const supplier = HISTORICAL_SUPPLIERS[seed % HISTORICAL_SUPPLIERS.length];
    const items = HISTORICAL_ITEMS[seed % HISTORICAL_ITEMS.length];
    const agent = HISTORICAL_AGENTS[seed % HISTORICAL_AGENTS.length];
    const amount = 1200 + (seed % 7800);
    const createdAt = new Date(NOW - daysAgo * DAY).toISOString();
    const completedAt = new Date(NOW - (daysAgo - 5) * DAY).toISOString();
    orders.push({
      id: `PO-${2440 + i}`,
      supplier,
      items,
      amount,
      group: 'autonomous',
      humanAction: '',
      humanStatus: 'Delivered late',
      humanDescription: `${supplier} delivery arrived ${4 + (seed % 18)}h past contract window. Exception logged.`,
      eta: completedAt.slice(0, 10),
      dagStage: 4,
      agentReasoning: 'Carrier reported port congestion at origin. SLA breach logged against supplier scorecard.',
      agentAgent: agentLabel(agent),
      assignedAgent: agent,
      saving: { time: '0.5h', cost: 0 },
      createdAt,
      completedAt,
      status: 'completed',
      resolution: `Late by ${4 + (seed % 18)}h — port congestion at origin`,
      workflowTemplate: pickWorkflow(seed, 'rush'),
    });
  }

  // 3 disputed
  for (let i = 0; i < 3; i++) {
    const seed = hashStr(`disputed-${i}`);
    const daysAgo = 4 + (seed % 60);
    const supplier = HISTORICAL_SUPPLIERS[seed % HISTORICAL_SUPPLIERS.length];
    const items = HISTORICAL_ITEMS[seed % HISTORICAL_ITEMS.length];
    const agent = HISTORICAL_AGENTS[(seed + 2) % HISTORICAL_AGENTS.length];
    const amount = 1800 + (seed % 9200);
    const createdAt = new Date(NOW - daysAgo * DAY).toISOString();
    orders.push({
      id: `PO-${2444 + i}`,
      supplier,
      items,
      amount,
      group: 'needs-action',
      actionKind: 'resolve-issue',
      humanAction: 'Resolve Issue',
      humanStatus: 'Disputed',
      humanDescription: `Dispute opened — ${RESOLUTIONS.disputed[seed % RESOLUTIONS.disputed.length]}.`,
      eta: 'Dispute pending',
      dagStage: 4,
      agentReasoning: 'Exception flagged at delivery. A-05 (Logistics) escalated to admin review.',
      agentAgent: agentLabel(agent),
      assignedAgent: agent,
      failureReason: RESOLUTIONS.disputed[seed % RESOLUTIONS.disputed.length],
      saving: { time: '0h', cost: 0 },
      createdAt,
      status: 'disputed',
      resolution: RESOLUTIONS.disputed[seed % RESOLUTIONS.disputed.length],
      workflowTemplate: pickWorkflow(seed),
    });
  }

  // 2 cancelled
  for (let i = 0; i < 2; i++) {
    const seed = hashStr(`cancelled-${i}`);
    const daysAgo = 10 + (seed % 75);
    const supplier = HISTORICAL_SUPPLIERS[seed % HISTORICAL_SUPPLIERS.length];
    const items = HISTORICAL_ITEMS[seed % HISTORICAL_ITEMS.length];
    const agent = HISTORICAL_AGENTS[seed % HISTORICAL_AGENTS.length];
    const amount = 600 + (seed % 4400);
    const createdAt = new Date(NOW - daysAgo * DAY).toISOString();
    orders.push({
      id: `PO-${2447 + i}`,
      supplier,
      items,
      amount,
      group: 'autonomous',
      humanAction: '',
      humanStatus: 'Cancelled',
      humanDescription: RESOLUTIONS.cancelled[seed % RESOLUTIONS.cancelled.length],
      eta: '—',
      dagStage: Math.max(1, seed % 5),
      agentReasoning: 'Order halted before dispatch on admin authorization.',
      agentAgent: agentLabel(agent),
      assignedAgent: agent,
      saving: { time: '0h', cost: 0 },
      createdAt,
      completedAt: new Date(NOW - (daysAgo - 1) * DAY).toISOString(),
      status: 'cancelled',
      resolution: RESOLUTIONS.cancelled[seed % RESOLUTIONS.cancelled.length],
      workflowTemplate: pickWorkflow(seed, i === 0 ? 'rush' : undefined),
    });
  }

  // 3 on-hold
  for (let i = 0; i < 3; i++) {
    const seed = hashStr(`hold-${i}`);
    const daysAgo = 6 + (seed % 25);
    const supplier = HISTORICAL_SUPPLIERS[seed % HISTORICAL_SUPPLIERS.length];
    const items = HISTORICAL_ITEMS[seed % HISTORICAL_ITEMS.length];
    const agent = HISTORICAL_AGENTS[(seed + 1) % HISTORICAL_AGENTS.length];
    const amount = 1100 + (seed % 5400);
    const createdAt = new Date(NOW - daysAgo * DAY).toISOString();
    orders.push({
      id: `PO-${2449 + i}`,
      supplier,
      items,
      amount,
      group: 'needs-action',
      humanAction: '',
      humanStatus: 'On hold',
      humanDescription: RESOLUTIONS['on-hold'][seed % RESOLUTIONS['on-hold'].length],
      eta: 'Pending',
      dagStage: 2 + (seed % 3),  // 2 (PO Approved), 3 (In Transit), 4 (Delivered)
      agentReasoning: `Hold gate engaged by ${agentLabel(agent)}. Awaiting external clearance before resuming.`,
      agentAgent: agentLabel(agent),
      assignedAgent: agent,
      saving: { time: '0h', cost: 0 },
      createdAt,
      status: 'on-hold',
      resolution: RESOLUTIONS['on-hold'][seed % RESOLUTIONS['on-hold'].length],
      workflowTemplate: pickWorkflow(seed, i === 0 ? 'recurring' : undefined),
    });
  }

  return orders;
}

const HISTORICAL_ORDERS: Order[] = makeHistoricalOrders();

// Seeded ledger used by Audit Mode. Runtime POs (from RFQ awards)
// are merged in at the component level (see NewOrdersPage body).
const SEEDED_ALL_ORDERS: Order[] = [...SEEDED_ORDERS, ...HISTORICAL_ORDERS];

// Decision Attribution Trail removed for Finn's scope.
// Audit lineage now lives inline on event cards in Activity & Governance.

// ── Synthesized Stage History (per-order × per-stage) ───────────────
// Deterministic so the same order always shows the same MBL, tracking #,
// timestamps, etc. Real production data would come from the kernel /
// agent execution log; this fills the same slot for the demo without
// forcing the UI to ever say "Not Captured".
function synthesizeStageHistory(order: Order, stageIdx: number): StageHistory {
  const seed = hashStr(`${order.id}-${stageIdx}`);
  const pick = <T,>(arr: T[]) => arr[seed % arr.length];
  const num = (digits: number) => String((seed % 10 ** digits)).padStart(digits, '0');
  // Stable verifiedAt — drift each stage forward by ~2-6 hours from a
  // synthetic order-creation time anchored on the order id.
  const baseEpoch = 1745200000000 + (hashStr(order.id) % 1_000_000_000);
  const verifiedAtIso = new Date(baseEpoch + stageIdx * (1000 * 60 * 60 * (2 + (seed % 5)))).toISOString();
  const carrier = pick(['DHL Express', 'PT Express', 'Maersk Line', 'FedEx Priority', 'NYK Line']);
  const carrierApi = carrier.replace(/\s+/g, '').toLowerCase();
  const channel = pick(['WhatsApp', 'Phone', 'Email']);
  const driver = pick(['Iwan Setiawan', 'Pak Hadi', 'Bambang Yuda', 'Ahmad Rizal', 'Joko Widiarto']);
  const truckPlate = `B ${1000 + (seed % 8999)} ${pick(['KAB', 'BTH', 'JKT', 'SUR'])}`;
  const lastSlug = order.id.slice(-4);

  const STAGE_FIXTURES: Record<number, () => StageHistory> = {
    // Stage 1 — Request
    0: () => ({
      data: { reason: `Par breach · ${order.items[0]?.split(' ')[0] ?? 'SKU'}`, urgency: order.workflowTemplate === 'WF-RSH' ? 'urgent' : 'standard' },
      trigger: `A-02 (Restock) raised the demand signal: ${order.items[0]?.split(' ')[0] ?? 'SKU'} stock below par.`,
      proof: `Inventory snapshot ID: INV-${num(7)}`,
      logic: `Request raised. Forecasted ${order.items.length} line${order.items.length !== 1 ? 's' : ''} for ${order.supplier}.`,
      verifiedAtIso,
    }),
    // Stage 2 — Quote / Vendor Confirmed
    1: () => ({
      data: { channel, lead_time: `${1 + (seed % 4)} days`, quote_amt: `Rp ${order.amount.toLocaleString('id-ID')}` },
      trigger: `A-01 (Sourcing) sent the request to ${order.supplier} via ${channel}.`,
      proof: `${channel} msg ID: msg-${num(8)} · read receipt ${new Date(baseEpoch + 30 * 60 * 1000).toISOString()}`,
      logic: `${order.supplier}'s quote within tolerance of 30-day median. Lead time aligned with their SLA.`,
      verifiedAtIso,
    }),
    // Stage 3 — PO Approved
    2: () => ({
      data: { po_pdf: `${order.id}_PO_v1.pdf`, policy_ref: `pol-${num(8)}` },
      trigger: `A-04 (Spend Watchdog) ran the policy stack — spend cap, vendor trust floor, duplicate detection.`,
      proof: `PO doc ${order.id}_PO_v1.pdf · Policy check ID: pol-${num(8)}`,
      logic: `PO drafted from the locked quote. ${requiresHumanAuthorization(2) ? 'Above spend cap — needed human authorization.' : 'Under auto-approve threshold.'}`,
      verifiedAtIso,
    }),
    // Stage 4 — In Transit
    3: () => ({
      data: { carrier, tracking: `${num(3)}-${num(8)}`, eta: new Date(baseEpoch + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) },
      trigger: `A-05 (Logistics) confirmed dispatch from ${order.supplier}; carrier API IN_TRANSIT.`,
      proof: `Carrier ack: ${carrierApi}-${num(7)} · Tracking ${num(3)}-${num(8)}`,
      logic: `${carrier} on this lane. Cold-chain sensors monitored across the full leg.`,
      verifiedAtIso,
    }),
    // Stage 5 — Delivered & Checked
    4: () => ({
      data: { pod: `${order.id}_signed_POD.jpg`, qc_outcome: order.status === 'disputed' ? 'fail' : 'pass', receiver: driver },
      trigger: `Receiving venue staff QC'd ${order.items[0]?.split(' ')[0] ?? 'delivery'} on arrival.`,
      proof: `POD doc: pod-${num(8)} · QC ledger entry: qc-${num(7)}`,
      logic: `Goods received and signed for. ${order.status === 'disputed' ? 'QC FAIL — dispute opened on Activity & Governance.' : 'QC passed against vendor baseline. Stock auto-incremented for the consuming venue(s).'}`,
      verifiedAtIso,
    }),
  };
  return STAGE_FIXTURES[stageIdx]?.() ?? {
    data: {}, trigger: '—', proof: '—',
    logic: 'No history recorded for this stage.',
    verifiedAtIso,
  };
}

const ACTION_META: Record<ActionKind, { icon: typeof Zap; label: string; color: string; darkColor: string }> = {
  'approve':          { icon: ThumbsUp,    label: 'Approve',          color: 'text-green-600',  darkColor: 'text-green-400' },
  'confirm-delivery': { icon: CircleCheck, label: 'Confirm Delivery', color: 'text-blue-600',   darkColor: 'text-blue-400' },
  'resolve-issue':    { icon: AlertTriangle, label: 'Resolve Issue',  color: 'text-red-600',    darkColor: 'text-red-400' },
  'pay':              { icon: DollarSign,  label: 'Pay',              color: 'text-amber-600',  darkColor: 'text-amber-400' },
};

// ── Component ─────────────────────────────────────────────────────────
// ── Runtime → Order shape adapter ────────────────────────────────
// RuntimePO carries the same fields, but as an exported interface from
// poStore. Re-shape into the page-local `Order` type so the render
// path doesn't need to branch.
function runtimePOToOrder(po: RuntimePO): Order {
  return {
    id: po.id,
    supplier: po.supplier,
    items: po.items,
    amount: po.amount,
    amountUsd: po.amountUsd,
    group: po.group,
    actionKind: po.actionKind,
    humanAction: po.humanAction,
    humanStatus: po.humanStatus,
    humanDescription: po.humanDescription,
    eta: po.eta,
    etaMinutes: po.etaMinutes,
    dagStage: po.dagStage,
    agentReasoning: po.agentReasoning,
    agentAgent: po.agentAgent,
    assignedAgent: po.assignedAgent,
    financeInsight: po.financeInsight,
    saving: po.saving,
    createdAt: po.createdAt,
    completedAt: po.completedAt,
    status: po.status,
    workflowTemplate: po.workflowTemplate,
  };
}

export function NewOrdersPage({ theme, onNavigate }: OrdersPageProps) {
  const isDark = theme === 'dark';
  const t = themeTokens(isDark);

  // Runtime POs (e.g. from RFQ Award) merge in front of the seeded list.
  const runtimePOs = useRuntimePOs();
  // RFQs — used to surface the inbound vendor quote message in the
  // Source Bridge for POs that came from an RFQ award.
  const rfqRecords = useRFQs();
  const ORDERS: Order[] = useMemo(
    () => [...runtimePOs.map(runtimePOToOrder), ...SEEDED_ORDERS],
    [runtimePOs],
  );
  // Same merge for the audit-mode ledger so historical + live + runtime
  // POs all flow through one read path inside the component.
  const ALL_ORDERS: Order[] = useMemo(
    () => [...runtimePOs.map(runtimePOToOrder), ...SEEDED_ALL_ORDERS],
    [runtimePOs],
  );
  // Keep a lookup of runtime PO ids → original RuntimePO for surfacing
  // the Bali channel context on the right panel.
  const runtimePOById = useMemo(() => {
    const m = new Map<string, RuntimePO>();
    runtimePOs.forEach(p => m.set(p.id, p));
    return m;
  }, [runtimePOs]);

  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [chatInput, setChatInput]           = useState('');
  const [completedIds, setCompletedIds]     = useState<Set<string>>(new Set());
  // 6p — orders where the admin took the gate action but the journey
  // hasn't terminated yet. These leave the Needs-Action card (the
  // agent is now driving the next stage) but should NOT show the sage
  // "Completed" badge. completedIds remains reserved for terminal POs.
  const [actionTakenIds, setActionTakenIds] = useState<Set<string>>(new Set());
  // 6s — id of the PO whose Approve button has been clicked. Pops the
  // Approval Confirmation modal (Auto + cap gate active flow).
  const [approvalForId, setApprovalForId]   = useState<string | null>(null);
  const [showCmd, setShowCmd]               = useState(false);
  const [cmdQuery, setCmdQuery]             = useState('');
  const [journeyCompleteId, setJourneyCompleteId] = useState<string | null>(null);
  const [batchComplete, setBatchComplete]   = useState(false);
  const [expandedDagSteps, setExpandedDagSteps] = useState<Set<number>>(new Set());
  const [chatMessages, setChatMessages]     = useState([
    { from: 'atlas', text: 'Select an order to see its full 5-stage journey. Ctrl+click for batch operations.' }
  ]);

  // ── Labor Switch (Manual Takeover) — Wayne doctrine ────────────
  // Per-order steering mode. Default 'auto' for every order. Aligns
  // with the per-PO autonomy picker on the New Request wizard's Step 1.
  const [laborMode, setLaborMode] = useState<Record<string, LaborMode>>({});
  // Per-order force-completed stages (for Manual Takeover of the 5-stage journey).
  const [forceCompletedStages, setForceCompletedStages] = useState<Record<string, number>>({});
  // Per-order manual stage data: { [orderId]: { [stageIdx]: { fieldKey: value } } }.
  // Doubles as the audit trail and the basis for the Resumption Handshake.
  const [manualStageData, setManualStageData] = useState<Record<string, Record<number, Record<string, string>>>>({});
  // 6r — parallel store for the data the AUTO agent wrote when the
  // auto-progress engine completed a stage. Same shape as manualStageData
  // but separate so attribution stays accurate: a field is "Admin
  // Verified" only when manualStageData has a value for it; agent
  // writes never flip the badge to admin.
  const [agentStageData, setAgentStageData] = useState<Record<string, Record<number, Record<string, string>>>>({});
  // Active Handshake delegations: { [orderId]: { [stageIdx]: true } }.
  // Persists across Save Draft — order can be in Manual Mode while a
  // specific sub-task is delegated back to Atlas.
  const [delegations, setDelegations] = useState<Record<string, Record<number, boolean>>>({});
  // Currently-open stage Task Module: { orderId, stageIdx }
  const [openStage, setOpenStage] = useState<{ orderId: string; stageIdx: number } | null>(null);
  // Draft state for the open module's form
  const [stageDraft, setStageDraft] = useState<Record<string, string>>({});
  // Required-field validation errors raised by Mark Complete attempts.
  // Keyed by input field key for the currently-open stage.
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // Per-stage completion timestamps. Captured when a stage is marked complete
  // (via Mark Complete or Force Complete). Drives Review Mode "cleared at" line.
  const [stageCompletedAt, setStageCompletedAt] = useState<Record<string, Record<number, string>>>({});
  // In Review Mode, fields the Admin has flipped back to Input Mode for editing.
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set());

  // ── Initiation Flows · New Order / Re-order / Schedule ─────────
  type DraftMode = { kind: 'new' } | { kind: 'reorder'; sourceOrderId: string };
  interface DraftState {
    supplier: string;
    items: string;        // multiline string of items
    recurring: boolean;
    frequency: 'weekly' | 'monthly';
    // 'auto' / 'manual' aligns with LaborMode + AutonomyMode (Phase 6).
    assignment: LaborMode;
    agentId: number;
  }
  const [draftSheet, setDraftSheet] = useState<DraftMode | null>(null);
  const [draft, setDraft] = useState<DraftState>({
    supplier: '', items: '', recurring: false, frequency: 'weekly',
    assignment: 'auto', agentId: 7,
  });
  // Schedules + drafts created in this session — surfaced on the dashboard.
  interface ScheduledEntry {
    id: string;
    label: string;          // e.g. "PO from PT Maju Bersama · 3 items"
    cadence?: 'one-off' | 'weekly' | 'monthly';
    assignment: LaborMode;
    agentId: number;
    nextRunIso?: string;
  }
  const [scheduledEntries, setScheduledEntries] = useState<ScheduledEntry[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [bridgeTarget, setBridgeTarget] = useState<{
    orderId: string; supplier: string; channel: BridgeChannel; message: string;
  } | null>(null);

  // ── Audit Mode state ────────────────────────────────────────────────
  // Mirrors the Inventory + Suppliers expansion pattern. Audit Mode
  // surfaces ALL_ORDERS (live + historical) for ledger-style review.
  type AuditStatus = 'all' | OrderStatus;
  type AuditView   = 'table' | 'grid';
  type AuditRange  = '7d' | '30d' | '90d' | 'all';
  type AuditStage  = 'all' | 'procurement' | 'processing' | 'logistics';
  const [auditMode,           setAuditMode]           = useState(false);
  const [auditView,           setAuditView]           = useState<AuditView>('table');
  const [auditSearch,         setAuditSearch]         = useState('');
  const [auditStatusFilter,   setAuditStatusFilter]   = useState<AuditStatus>('all');
  const [auditDateRange,      setAuditDateRange]      = useState<AuditRange>('30d');
  const [auditSupplierFilter, setAuditSupplierFilter] = useState<string | null>(null);
  const [auditStageFilter,    setAuditStageFilter]    = useState<AuditStage>('all');
  const [auditAgentFilter,    setAuditAgentFilter]    = useState<number | null>(null);
  const [auditWorkflowFilter, setAuditWorkflowFilter] = useState<string | null>(null);
  const [auditSelected,       setAuditSelected]       = useState<Set<string>>(new Set());
  const auditSearchRef                                 = useRef<HTMLInputElement>(null);

  // Auto-focus the audit search input on entering audit mode (matches
  // Inventory's behavior).
  useEffect(() => {
    if (auditMode && auditSearchRef.current) auditSearchRef.current.focus();
  }, [auditMode]);

  // Deep-link hash reader — accepts #order=PO-XXXX from Inventory, RequestPanel, etc.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw) return;
      const params = new URLSearchParams(raw);
      const orderId = params.get('order');
      if (orderId && ORDERS.some(o => o.id === orderId)) {
        setSelectedIds(new Set([orderId]));
        setJourneyCompleteId(null);
        setBatchComplete(false);
        setAuditMode(false); // collapse Audit Mode if a deep-link arrives
        window.location.hash = '';
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  // Open the drafting sheet (New or Re-order from a completed PO).
  const openDraftSheet = useCallback((mode: DraftMode) => {
    if (mode.kind === 'reorder') {
      const src = ORDERS.find(o => o.id === mode.sourceOrderId);
      if (src) {
        setDraft({
          supplier: src.supplier,
          items: src.items.join('\n'),
          recurring: false,
          frequency: 'weekly',
          assignment: 'auto',
          agentId: src.assignedAgent.id,
        });
      }
    } else {
      setDraft({
        supplier: '', items: '', recurring: false, frequency: 'weekly',
        assignment: 'auto', agentId: 7,
      });
    }
    setDraftSheet(mode);
  }, []);
  const closeDraftSheet = useCallback(() => setDraftSheet(null), []);

  const submitDraft = useCallback(() => {
    if (!draft.supplier.trim() || !draft.items.trim()) return;
    const itemCount = draft.items.split('\n').filter(s => s.trim()).length;
    const cadence: ScheduledEntry['cadence'] = draft.recurring ? draft.frequency : 'one-off';
    const id = `DR-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const nextRunIso = draft.recurring ? new Date(Date.now() + (draft.frequency === 'weekly' ? 7 : 30) * 86400_000).toISOString() : undefined;
    setScheduledEntries(prev => [{
      id,
      label: `${draft.recurring ? 'Recurring PO' : 'PO Draft'} from ${draft.supplier} · ${itemCount} item${itemCount === 1 ? '' : 's'}`,
      cadence,
      assignment: draft.assignment,
      agentId: draft.agentId,
      nextRunIso,
    }, ...prev]);
    const ownerLabel = draft.assignment === 'auto'
      ? `${LEGACY_AGENT_MAP[draft.agentId] ?? 'A-02'} (${draft.agentId === 7 ? 'Logistics' : draft.agentId === 6 ? 'Sourcing' : 'Operations'})`
      : 'You (Manual Takeover from start)';
    setChatMessages(prev => [...prev, {
      from: 'atlas',
      text: draft.recurring
        ? `Scheduled ${draft.frequency} PO with ${draft.supplier} (${itemCount} item${itemCount === 1 ? '' : 's'}) · ${ownerLabel} will draft each cycle for your authorization.`
        : `Drafted ${id} with ${draft.supplier} (${itemCount} item${itemCount === 1 ? '' : 's'}) · ${ownerLabel} will start at Stage 1 (PO Approval).`,
    }]);
    closeDraftSheet();
  }, [draft, closeDraftSheet]);


  const getMode = useCallback((id: string): LaborMode => laborMode[id] ?? 'auto', [laborMode]);
  // System-wide pause from Activity & Governance → Agents tab. When on,
  // every Auto entity behaves as if Manual — the auto-progress engine
  // halts. Manual entities are unaffected.
  const agentsPaused = useAgentsPaused();

  const setMode = useCallback((id: string, mode: LaborMode) => {
    setLaborMode(prev => ({ ...prev, [id]: mode }));
    const order = ORDERS.find(o => o.id === id);
    if (!order) return;
    if (mode === 'manual') {
      setChatMessages(prev => [...prev, {
        from: 'atlas',
        text: `Standing by. Manual Takeover active for ${id} — ${agentLabel(order.assignedAgent)} suspended. Ask me for data to help you resolve this issue.`,
      }]);
    } else {
      // ═══ Resumption Handshake ═══
      // The AI must NOT redo or re-verify stages completed by the human.
      // It synchronizes against everything the Admin touched in Manual mode.
      const touched = manualStageData[id] ? Object.keys(manualStageData[id]).map(Number).sort((a, b) => a - b) : [];
      let msg: string;
      if (touched.length === 0) {
        msg = `Resuming ${agentLabel(order.assignedAgent)} on ${id}. No manual inputs to sync — picking up where I left off.`;
      } else {
        const stageList = touched.map(s => `${s + 1} (${DAG_STAGES[s].label})`).join(' & ');
        msg = `Resuming. Synchronizing with manual inputs for Stage${touched.length === 1 ? '' : 's'} ${stageList}. Proceeding to next autonomous task.`;
      }
      setChatMessages(prev => [...prev, { from: 'atlas', text: msg }]);
    }
  }, [manualStageData]);

  const forceCompleteStage = useCallback((id: string, stage: number) => {
    setForceCompletedStages(prev => ({ ...prev, [id]: Math.max(prev[id] ?? 0, stage + 1) }));
    setStageCompletedAt(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), [stage]: new Date().toISOString() },
    }));
    const order = ORDERS.find(o => o.id === id);
    if (order) {
      setChatMessages(prev => [...prev, {
        from: 'atlas',
        text: `Stage ${stage + 1} (${DAG_STAGES[stage].label}) marked complete manually for ${id}. Logged to audit trail.`,
      }]);
    }
  }, []);

  const effectiveStage = useCallback((order: Order) => {
    return Math.max(order.dagStage, forceCompletedStages[order.id] ?? 0);
  }, [forceCompletedStages]);

  // ── 6q · Auto-mode progress engine ─────────────────────────────────
  //
  // For every order in Auto mode that hasn't hit a HITL gate, ride one
  // stage at a time on a steady cadence. The user sees the journey
  // move without clicking. Halts at:
  //
  //   • Stage 4 itself (the last stage — terminal)
  //   • Any stage where autoHumanGateAt() returns true
  //   • Any order in completedIds (terminal) or disputed
  //   • When agentsPaused (system kill switch)
  //
  // On each tick: scan ORDERS for the FIRST eligible candidate and
  // advance just that one. One-at-a-time keeps the demo coherent and
  // chat output from spamming. The setTimeout closure captures the
  // current snapshot via deps — when forceCompletedStages changes the
  // effect re-runs and the next candidate gets picked.
  //
  // Two specific journeys this enables:
  //   • PO-3048 (autonomous, Stage 2) → 3 → 4 → auto-clear (greens, no
  //     perishable keyword). Lands as Delivered without a click.
  //   • PO-3041 after Approve (above cap → human gate at Stage 1) →
  //     2 → 3 → 4 → halts (tuna sashimi triggers perishable QC gate).
  //     Admin's only clicks: one Approve, one Confirm Delivery.
  useEffect(() => {
    if (agentsPaused) return;
    // Find the next eligible Auto order that can advance.
    let target: { order: Order; fromStage: number } | null = null;
    for (const order of ORDERS) {
      if (completedIds.has(order.id))         continue;
      if (getMode(order.id) !== 'auto')       continue;
      const eff = Math.max(order.dagStage, forceCompletedStages[order.id] ?? 0);
      if (eff >= 4)                           continue;
      if (autoHumanGateAt(order, eff))        continue;
      target = { order, fromStage: eff };
      break;
    }
    if (!target) return;
    const handle = window.setTimeout(() => {
      const { order, fromStage } = target!;
      const toStage = fromStage + 1;

      // ── Write the agent's stage data ──
      // 6r — record realistic artifacts for the stage that just got
      // completed. Pull from RFQ runtime for the quote leg (Stage 1
      // completion) so channel + lead time + amount reflect the real
      // award, not a hash-synthesised guess.
      const runtime = runtimePOById.get(order.id);
      const rfq = runtime?.fromRfqId ? rfqRecords.find(r => r.id === runtime.fromRfqId) : null;
      const awardedQuote = rfq?.quotes.find(q => q.vendorId === runtime?.awardedVendorId)
        ?? rfq?.quotes.find(q => q.vendorName === runtime?.supplier);
      const channelLabel = runtime?.quoteChannel === 'email' ? 'Email'
                         : runtime?.quoteChannel === 'whatsapp' ? 'WhatsApp'
                         : undefined;
      const stageWrite = agentStageDataFor(
        order,
        fromStage,
        channelLabel,
        awardedQuote?.leadTimeDays,
      );
      setAgentStageData(prev => ({
        ...prev,
        [order.id]: { ...(prev[order.id] ?? {}), [fromStage]: stageWrite },
      }));

      setForceCompletedStages(prev => ({
        ...prev,
        [order.id]: Math.max(prev[order.id] ?? 0, fromStage + 1),
      }));
      setStageCompletedAt(prev => ({
        ...prev,
        [order.id]: { ...(prev[order.id] ?? {}), [fromStage]: new Date().toISOString() },
      }));

      // Stage-specific narration: name the actual agent + the artifact
      // it just produced. The user can click into the next-stage trace
      // modal and see the same values rendered with "Agent Verified".
      const narration =
        toStage === 1 ? `🤖 A-01 (Sourcing) logged the quote on ${order.id} — ${stageWrite.channel} reply from ${order.supplier}, ${stageWrite.lead_time} lead, total ${fmtIdrShort(order.amount)}.`
      : toStage === 2 ? `✅ A-04 (Spend Watchdog) cleared the policy stack on ${order.id}. Policy ref ${stageWrite.policy_ref} · PO ${stageWrite.po_pdf} issued to ${order.supplier} via WhatsApp.`
      : toStage === 3 ? `🚚 A-05 (Logistics) confirmed dispatch on ${order.id}. Carrier ${stageWrite.carrier} · tracking ${stageWrite.tracking}. ETA holds at ${order.eta}.`
      : toStage === 4 ? `📦 ${order.supplier} delivered ${order.id} to ${stageWrite.receiver}. ${basketHasPerishable(order) ? 'Perishable items — awaiting your visual QC.' : `Auto-QC ${stageWrite.qc_outcome} against PO spec · POD ${stageWrite.pod}. Stock incremented.`}`
                      : `${order.agentAgent}: ${order.id} advanced to Stage ${toStage + 1}.`;
      setChatMessages(prev => [...prev, { from: 'atlas', text: narration }]);
      logUserAction({
        kind: 'po-stage-advance',
        entity: { type: 'po', id: order.id },
        summary: `Auto-advanced ${order.id} to Stage ${toStage + 1} (${DAG_STAGES[toStage].label})`,
        venue: 'Multi',
        meta: {
          fromStage, toStage,
          supplier: order.supplier,
          agent: order.agentAgent,
          auto: true,
          artifacts: stageWrite,
        },
      });
      // If we just landed at Stage 4 AND the basket is non-perishable,
      // also write the Stage 4 artifacts (POD + QC outcome) and close
      // out — A-05's auto-QC passes immediately. (Perishables sit at
      // Stage 4 waiting for human Confirm Delivery.)
      if (toStage === 4 && !basketHasPerishable(order)) {
        const stage4Write = agentStageDataFor(order, 4);
        setAgentStageData(prev => ({
          ...prev,
          [order.id]: { ...(prev[order.id] ?? {}), 4: stage4Write },
        }));
        setForceCompletedStages(prev => ({
          ...prev,
          [order.id]: Math.max(prev[order.id] ?? 0, 5),
        }));
        setStageCompletedAt(prev => ({
          ...prev,
          [order.id]: { ...(prev[order.id] ?? {}), 4: new Date().toISOString() },
        }));
        setCompletedIds(prev => new Set([...prev, order.id]));
      }
    }, AUTO_ADVANCE_INTERVAL_MS);
    return () => window.clearTimeout(handle);
  }, [ORDERS, agentsPaused, completedIds, forceCompletedStages, getMode, runtimePOById, rfqRecords]);

  // ── High-visibility Status Badge ───────────────────────────────
  // Mirrors the dashboard ETA/status into the detail header (and any
  // other surface that shows an order's live state). Declared after
  // `effectiveStage` to avoid a TDZ on the dependency array.
  const getStatusBadge = useCallback((order: Order) => {
    const stage = effectiveStage(order);
    const isDone = completedIds.has(order.id);
    const isResolveIssue = order.actionKind === 'resolve-issue';
    const isImminent = !!order.etaMinutes && order.etaMinutes <= 15;
    const isDelivered = stage >= 4 || isDone;
    if (isResolveIssue) return { label: 'Delayed', tone: 'amber' as const, pulse: false, icon: AlertTriangle };
    if (isImminent && !isDelivered) return { label: 'Arriving Now', tone: 'green' as const, pulse: true, icon: Truck };
    if (isDelivered) return { label: 'Delivered', tone: 'sage' as const, pulse: false, icon: CircleCheck };
    if (stage === 3) return { label: `In Transit · ${order.eta}`, tone: 'blue' as const, pulse: false, icon: Truck };
    if (stage === 2) return { label: `PO Approved · ${order.eta}`, tone: 'amber' as const, pulse: false, icon: Clock };
    if (order.actionKind === 'approve') return { label: `${order.humanStatus} · ${order.eta}`, tone: 'amber' as const, pulse: false, icon: Clock };
    if (order.actionKind === 'confirm-delivery') return { label: `${order.humanStatus} · ${order.eta}`, tone: 'blue' as const, pulse: false, icon: Truck };
    return { label: `${order.humanStatus} · ${order.eta}`, tone: 'neutral' as const, pulse: false, icon: Clock };
  }, [effectiveStage, completedIds]);

  const openGovernance = useCallback((agentId: number) => {
    if (typeof window !== 'undefined') {
      window.location.hash = `agent-${String(agentId).padStart(2, '0')}`;
    }
    onNavigate?.('governance');
  }, [onNavigate]);

  // Note: openAIActivity / openWorkflow / openGovernanceDecision removed
  // alongside the Decision Attribution Trail. Cross-page navigation now
  // happens via plain hash deep-links (#order / #agent / #evt) from
  // surfaces that survive in Finn's scope.

  // ── Task Module open / save / cancel ────────────────────────────
  const openStageModule = useCallback((orderId: string, stageIdx: number) => {
    setOpenStage({ orderId, stageIdx });
    setValidationErrors([]);
    setEditingFields(new Set());
    // Pre-fill draft with any prior submission for this stage
    let initialDraft = manualStageData[orderId]?.[stageIdx] ?? {};

    // 6p — RFQ pre-fill for Stage 1 (Quote/Vendor Confirmed). The
    // quote came in via the wizard award, so channel + amount + lead
    // time are already in the runtime PO record. Pre-populate the
    // draft so the admin isn't asked to retype data they already
    // gave us. They can still edit any field before clicking Authorize.
    if (stageIdx === 1 && Object.keys(initialDraft).length === 0) {
      const runtime = runtimePOById.get(orderId);
      if (runtime?.fromRfqId) {
        const rfq = rfqRecords.find(r => r.id === runtime.fromRfqId);
        const quote = rfq?.quotes.find(q => q.vendorId === runtime.awardedVendorId)
          ?? rfq?.quotes.find(q => q.vendorName === runtime.supplier);
        const channelLabel = runtime.quoteChannel === 'whatsapp' ? 'WhatsApp'
                           : runtime.quoteChannel === 'email'    ? 'Email'
                           : '';
        initialDraft = {
          channel:   channelLabel,
          lead_time: quote ? `${quote.leadTimeDays} days` : '',
          quote_amt: String(runtime.amount),
        };
      }
    }
    setStageDraft(initialDraft);
  }, [manualStageData, runtimePOById, rfqRecords]);

  const closeStageModule = useCallback(() => {
    setOpenStage(null);
    setStageDraft({});
    setValidationErrors([]);
    setEditingFields(new Set());
  }, []);

  const saveStageModule = useCallback((advance: boolean) => {
    if (!openStage) return;
    const { orderId, stageIdx } = openStage;
    const mod = TASK_MODULES[stageIdx];
    const isDelegated = !!delegations[orderId]?.[stageIdx];

    // ═══ Validation ═══
    // When delegation is locked in, Atlas is collecting the missing data —
    // so we don't gate Mark Complete on field presence. Otherwise, every
    // input flagged `required: true` must have a value.
    if (advance && !isDelegated) {
      const missing = mod.inputs
        .filter(i => i.required && !((stageDraft[i.key] ?? '').toString().trim()))
        .map(i => i.key);
      if (missing.length > 0) {
        setValidationErrors(missing);
        // Atlas help offer — only mention fields Atlas can actually pull
        // from the internal directory (Fortress / Walled Garden).
        const lookable = mod.inputs.filter(i => missing.includes(i.key) && i.fortressLookup);
        const order = ORDERS.find(o => o.id === orderId);
        let help: string;
        if (lookable.length > 0) {
          help = `${missing.length} required field${missing.length === 1 ? '' : 's'} missing on Stage ${stageIdx + 1}. I can find ${lookable[0].label} for you — pulling ${lookable[0].fortressLookup} from your internal directory now.`;
        } else {
          help = `${missing.length} required field${missing.length === 1 ? '' : 's'} missing on Stage ${stageIdx + 1}. I don't have a vetted source for this — please complete it manually.`;
        }
        if (order) {
          setChatMessages(prev => [...prev, { from: 'atlas', text: help }]);
        }
        return; // do NOT save / advance
      }
    }

    // ═══ Persist semantics ═══
    // In Review Mode (stage already complete) only the fields the Admin
    // explicitly flipped to Edit get persisted. This preserves Agent
    // attribution on every other field — they remain "Agent Verified".
    const orderRef = ORDERS.find(o => o.id === orderId);
    const isReviewMode = orderRef ? stageIdx < effectiveStage(orderRef) : false;
    const editedKeys = Array.from(editingFields);
    setManualStageData(prev => {
      const stageBefore = prev[orderId]?.[stageIdx] ?? {};
      const writeMap: Record<string, string> = isReviewMode
        ? editedKeys.reduce((acc, k) => ({ ...acc, [k]: stageDraft[k] ?? '' }), {} as Record<string, string>)
        : { ...stageDraft };
      return {
        ...prev,
        [orderId]: { ...(prev[orderId] ?? {}), [stageIdx]: { ...stageBefore, ...writeMap } },
      };
    });
    if (advance) {
      forceCompleteStage(orderId, stageIdx);
      // 6s — Stage 4 (Delivered & Checked) completion = terminal. Add
      // to completedIds so the sage Completed badge fires and the order
      // moves cleanly out of the priority feed.
      if (stageIdx === 4) {
        setCompletedIds(prev => new Set([...prev, orderId]));
        setActionTakenIds(prev => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
      // QC failure → notify SuppliersPage trust panel
      if (stageIdx === 4 && stageDraft['qc_outcome'] === 'fail') {
        const order = ORDERS.find(o => o.id === orderId);
        window.dispatchEvent(new CustomEvent('finns-qc-failure', {
          detail: { orderId, supplier: order?.supplier ?? '', stage: 'Quality Check' },
        }));
      }
    }
    setChatMessages(prev => [...prev, {
      from: 'atlas',
      text: `Saved manual inputs for Stage ${stageIdx + 1} (${DAG_STAGES[stageIdx].label}) on ${orderId}${advance ? ' — stage marked complete.' : '.'}${isDelegated ? ' Delegation remains active.' : ''}`,
    }]);
    closeStageModule();
  }, [openStage, stageDraft, delegations, editingFields, effectiveStage, forceCompleteStage, closeStageModule]);

  // ── Review Mode helpers ────────────────────────────────────────
  // Attribution PER FIELD: a field is "Admin Verified" only if the Admin
  // wrote a non-empty value. Otherwise it stays "Agent Verified" — even
  // when other fields in the same stage have been edited.
  type Attribution = { kind: 'admin' | 'agent'; label: string };
  const getFieldAttribution = useCallback((order: Order, stageIdx: number, fieldKey: string): Attribution => {
    const v = manualStageData[order.id]?.[stageIdx]?.[fieldKey];
    if (v && v.trim().length > 0) return { kind: 'admin', label: 'Admin Verified' };
    return { kind: 'agent', label: `${agentLabel(order.assignedAgent)} Verified` };
  }, [manualStageData]);
  // Stage-level attribution = Admin if the Admin touched ANY field on this
  // stage; otherwise Agent. Used for the header badge. agentStageData
  // never flips this to Admin — that's reserved for human edits.
  const getStageAttribution = useCallback((order: Order, stageIdx: number): Attribution => {
    const hadManualEntry = !!manualStageData[order.id]?.[stageIdx]
      && Object.values(manualStageData[order.id][stageIdx]).some(v => v && v.trim().length > 0);
    if (hadManualEntry) return { kind: 'admin', label: 'Admin Verified' };
    return { kind: 'agent', label: `${agentLabel(order.assignedAgent)} Verified` };
  }, [manualStageData]);
  // Audit summary string shown in the Atlas Copilot box in Review Mode.
  const getAuditSummary = useCallback((order: Order, stageIdx: number): string => {
    const attr = getStageAttribution(order, stageIdx);
    const dag = DAG_STAGES[stageIdx];
    const wasDelegated = !!delegations[order.id]?.[stageIdx];
    const synth = synthesizeStageHistory(order, stageIdx);
    if (attr.kind === 'admin') {
      return `You manually confirmed ${dag.label}. I have updated the downstream logistics schedule accordingly.`;
    }
    if (wasDelegated) {
      return `Atlas verified this sub-task on your behalf via the delegation. Source: ${dag.agentStep ?? 'vendor & carrier APIs in your internal directory'}.`;
    }
    return synth.logic;
  }, [getStageAttribution, delegations]);
  // Cleared-at timestamp — prefer recorded forceComplete time, fall back
  // to the synthesized verifiedAt so Agent-completed stages still show
  // a concrete timestamp (no "cleared earlier" fuzz).
  const getStageClearedAt = useCallback((orderId: string, stageIdx: number): string => {
    const iso = stageCompletedAt[orderId]?.[stageIdx];
    const order = ORDERS.find(o => o.id === orderId);
    const fallback = order ? synthesizeStageHistory(order, stageIdx).verifiedAtIso : null;
    const useIso = iso ?? fallback;
    if (useIso) {
      try {
        const d = new Date(useIso);
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { /* fall through */ }
    }
    return 'cleared earlier in this order';
  }, [stageCompletedAt]);
  // Resolved value for a field. Order of precedence:
  //   1. Admin manual write (manualStageData)
  //   2. Agent auto-progress write (agentStageData)  ← 6r
  //   3. Hash-synthesised fallback (only for historical orders that
  //      neither the admin nor the live engine ever touched).
  const getFieldDisplayValue = useCallback((order: Order, stageIdx: number, fieldKey: string): string => {
    const manual = manualStageData[order.id]?.[stageIdx]?.[fieldKey];
    if (manual && manual.length > 0) return manual;
    const agent = agentStageData[order.id]?.[stageIdx]?.[fieldKey];
    if (agent && agent.length > 0) return agent;
    return synthesizeStageHistory(order, stageIdx).data[fieldKey] ?? '';
  }, [manualStageData, agentStageData]);

  // ── Active Handshake — delegate this stage back to Atlas ────────
  const isDelegated = useCallback((orderId: string, stageIdx: number) => !!delegations[orderId]?.[stageIdx], [delegations]);
  const toggleDelegation = useCallback((orderId: string, stageIdx: number) => {
    const dag = DAG_STAGES[stageIdx];
    const mod = TASK_MODULES[stageIdx];
    const currently = !!delegations[orderId]?.[stageIdx];
    setDelegations(prev => ({
      ...prev,
      [orderId]: { ...(prev[orderId] ?? {}), [stageIdx]: !currently },
    }));
    if (!currently) {
      setChatMessages(prev => [...prev, {
        from: 'atlas',
        text: `Delegation accepted for Stage ${stageIdx + 1} (${dag.label}) on ${orderId}. ${mod.delegationLockedCopy}`,
      }]);
    } else {
      setChatMessages(prev => [...prev, {
        from: 'atlas',
        text: `Delegation released for Stage ${stageIdx + 1} (${dag.label}) on ${orderId}. You are driving this sub-task again.`,
      }]);
    }
  }, [delegations]);

  // Derived state
  const isBatch       = selectedIds.size > 1;
  const isSingle      = selectedIds.size === 1;
  const selectedId    = isSingle ? [...selectedIds][0] : null;
  const selectedOrder = selectedId ? ORDERS.find((o) => o.id === selectedId) ?? null : null;

  // 6s — priority feed is derived from current state, not seeded group.
  // Order is "needs-action" iff its effective stage sits at a real HITL
  // gate (perishable QC, disputed, or active spend-cap rule). Seeded
  // group is now informational only.
  const actionOrders = ORDERS.filter((o) => {
    if (completedIds.has(o.id))   return false;
    if (actionTakenIds.has(o.id)) return false;
    const eff = Math.max(o.dagStage, forceCompletedStages[o.id] ?? 0);
    return derivedActionKind(o, eff) !== null;
  });
  const autoOrders   = ORDERS.filter((o) => !actionOrders.some(a => a.id === o.id));
  const batchOrders  = ORDERS.filter((o) => selectedIds.has(o.id));

  // ── Audit Mode — derived data ─────────────────────────────────────
  // Status counts feed the filter-chip count badges.
  const auditStatusCounts = useMemo(() => {
    const counts: Record<AuditStatus, number> = {
      all: ALL_ORDERS.length,
      live: 0, completed: 0, disputed: 0, cancelled: 0, 'on-hold': 0,
    };
    ALL_ORDERS.forEach(o => { counts[o.status]++; });
    return counts;
  }, []);

  // Unique suppliers + unique agent IDs across the combined ledger
  // — feed the audit dropdown filters.
  const auditSupplierOptions = useMemo(
    () => Array.from(new Set(ALL_ORDERS.map(o => o.supplier))).sort(),
    []
  );
  const auditAgentOptions = useMemo(
    () => Array.from(new Map(ALL_ORDERS.map(o => [o.assignedAgent.id, o.assignedAgent])).values())
            .sort((a, b) => a.id - b.id),
    []
  );

  // Apply all audit filters. Date-range presets cut against `createdAt`
  // for live + on-hold + cancelled orders, against `completedAt` (or
  // `createdAt` fallback) for completed/disputed.
  const auditFiltered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      auditDateRange === '7d'  ? now - 7  * 86_400_000 :
      auditDateRange === '30d' ? now - 30 * 86_400_000 :
      auditDateRange === '90d' ? now - 90 * 86_400_000 : 0;

    const q = auditSearch.trim().toLowerCase();
    return ALL_ORDERS.filter(o => {
      if (auditStatusFilter !== 'all' && o.status !== auditStatusFilter) return false;
      if (auditSupplierFilter && o.supplier !== auditSupplierFilter) return false;
      if (auditAgentFilter !== null && o.assignedAgent.id !== auditAgentFilter) return false;
      if (auditWorkflowFilter && o.workflowTemplate !== auditWorkflowFilter) return false;
      if (auditStageFilter !== 'all') {
        const s = o.dagStage;
        const inBand =
          auditStageFilter === 'procurement' ? s <= 3 :
          auditStageFilter === 'processing'  ? s >= 4 && s <= 7 :
          auditStageFilter === 'logistics'   ? s >= 8 : true;
        if (!inBand) return false;
      }
      if (cutoff > 0) {
        const ts = new Date(o.completedAt ?? o.createdAt).getTime();
        if (ts < cutoff) return false;
      }
      if (q) {
        const hay = `${o.id} ${o.supplier} ${o.items.join(' ')} ${o.agentAgent}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      // Newest first by createdAt
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [auditSearch, auditStatusFilter, auditSupplierFilter, auditAgentFilter, auditWorkflowFilter, auditStageFilter, auditDateRange]);

  // Aggregate insights for the macro right-panel view (Audit Mode, no
  // row selected). Scoped to the same filter window as the table.
  const auditInsights = useMemo(() => {
    const totalSpend = auditFiltered.reduce((s, o) => s + o.amount, 0);
    const totalSaved = auditFiltered.reduce((s, o) => s + (o.saving?.cost ?? 0), 0);
    const completed  = auditFiltered.filter(o => o.status === 'completed');
    const onTime     = completed.filter(o => !o.resolution || !o.resolution.toLowerCase().includes('late')).length;
    const onTimePct  = completed.length ? Math.round((onTime / completed.length) * 100) : 100;
    // Avg cycle time (hours) on completed orders that carry completedAt
    const cycleHours = completed
      .filter(o => o.completedAt)
      .map(o => (new Date(o.completedAt!).getTime() - new Date(o.createdAt).getTime()) / 3_600_000);
    const avgCycle = cycleHours.length ? cycleHours.reduce((a, b) => a + b, 0) / cycleHours.length : 0;

    // Top suppliers by spend
    const supplierMap = new Map<string, { count: number; spend: number; disputes: number }>();
    auditFiltered.forEach(o => {
      const row = supplierMap.get(o.supplier) ?? { count: 0, spend: 0, disputes: 0 };
      row.count++; row.spend += o.amount;
      if (o.status === 'disputed') row.disputes++;
      supplierMap.set(o.supplier, row);
    });
    const topSuppliers = [...supplierMap.entries()]
      .map(([name, r]) => ({ name, ...r }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    // Disputes by supplier (descending)
    const topDisputes = [...supplierMap.entries()]
      .map(([name, r]) => ({ name, ...r }))
      .filter(r => r.disputes > 0)
      .sort((a, b) => b.disputes - a.disputes)
      .slice(0, 5);

    return {
      totalCount: auditFiltered.length,
      totalSpend,
      totalSaved,
      onTimePct,
      avgCycle: Math.round(avgCycle),
      completedCount: completed.length,
      disputedCount: auditFiltered.filter(o => o.status === 'disputed').length,
      cancelledCount: auditFiltered.filter(o => o.status === 'cancelled').length,
      topSuppliers,
      topDisputes,
    };
  }, [auditFiltered]);

  // Helper: status pill colors
  const statusPill = (status: OrderStatus): { label: string; lightBg: string; lightText: string; darkBg: string; darkText: string } => {
    switch (status) {
      case 'live':      return { label: 'Live',      lightBg: 'bg-blue-50',    lightText: 'text-blue-700',    darkBg: 'bg-blue-500/15',    darkText: 'text-blue-300'   };
      case 'completed': return { label: 'Completed', lightBg: 'bg-green-50',   lightText: 'text-green-700',   darkBg: 'bg-green-500/15',   darkText: 'text-green-300'  };
      case 'disputed':  return { label: 'Disputed',  lightBg: 'bg-red-50',     lightText: 'text-red-700',     darkBg: 'bg-red-500/15',     darkText: 'text-red-300'    };
      case 'cancelled': return { label: 'Cancelled', lightBg: 'bg-gray-100',   lightText: 'text-gray-600',    darkBg: 'bg-gray-700',       darkText: 'text-gray-300'   };
      case 'on-hold':   return { label: 'On Hold',   lightBg: 'bg-amber-50',   lightText: 'text-amber-700',   darkBg: 'bg-amber-500/15',   darkText: 'text-amber-300'  };
    }
  };

  // Audit selection toggles
  const toggleAuditRow = useCallback((id: string) => {
    setAuditSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const toggleAuditSelectAll = useCallback(() => {
    setAuditSelected(prev => {
      if (prev.size === auditFiltered.length && auditFiltered.length > 0) return new Set();
      return new Set(auditFiltered.map(o => o.id));
    });
  }, [auditFiltered]);

  // Open an audit row.
  //   • Live order  → collapse Audit Mode and load the Single Order Journey.
  //   • Historical  → surface a Quick Journey card in the right panel; the
  //                   ledger view stays expanded so the user can keep
  //                   browsing. (No full Decision Attribution Trail
  //                   modal — that pattern is dropped for Finn's.)
  const openFromAudit = useCallback((id: string) => {
    if (ORDERS.some(o => o.id === id)) {
      setSelectedIds(new Set([id]));
      setAuditMode(false);
    } else {
      // Historical: keep audit mode open, surface a single-row selection
      // so the right-panel Quick Journey can render.
      setAuditSelected(new Set([id]));
    }
  }, []);

  // Bulk export selected audit rows as CSV.
  const exportAuditCSV = useCallback((ids: Set<string>) => {
    const rows = auditFiltered.filter(o => ids.size === 0 || ids.has(o.id));
    if (!rows.length) return;
    const headers = ['PO ID', 'Supplier', 'Status', 'Items', 'Amount', 'Agent', 'Created', 'Completed', 'Resolution'];
    const csv = [
      headers.join(','),
      ...rows.map(o => [
        o.id, `"${o.supplier}"`, o.status,
        `"${o.items.join('; ')}"`,
        o.amount,
        `"${agentLabel(o.assignedAgent)}"`,
        o.createdAt.slice(0, 10),
        o.completedAt?.slice(0, 10) ?? '',
        `"${(o.resolution ?? '').replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');
    if (typeof window === 'undefined') return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditFiltered]);

  // Batch summary — chunk by action kind
  const batchSummary = {
    approve:  batchOrders.filter((o) => o.actionKind === 'approve').length,
    confirm:  batchOrders.filter((o) => o.actionKind === 'confirm-delivery').length,
    resolve:  batchOrders.filter((o) => o.actionKind === 'resolve-issue').length,
    total:    batchOrders.length,
    value:    batchOrders.reduce((s, o) => s + o.amount, 0),
    savings:  batchOrders.reduce((s, o) => s + (o.saving?.cost ?? 0), 0),
    hours:    batchOrders.reduce((s, o) => s + parseFloat(o.saving?.time ?? '0'), 0).toFixed(1),
  };

  // ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowCmd((v) => !v); }
      if (e.key === 'Escape') {
        setShowCmd(false);
        setMenuOpenId(null);
        // Escape collapses Audit Mode when nothing else is open and no row is selected.
        if (auditMode && !selectedIds.size) setAuditMode(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [auditMode, selectedIds.size]);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpenId]);

  // Close Source Bridge whenever the selected order changes
  useEffect(() => { setBridgeTarget(null); }, [selectedOrder?.id]);

  // ── Global select all toggle (Hick's Law: one checkbox) ──
  const allActionIds = actionOrders.map((o) => o.id);
  const allSelected  = allActionIds.length > 0 && allActionIds.every((id) => selectedIds.has(id));

  const toggleGlobalSelect = useCallback(() => {
    setSelectedIds(() => {
      if (allSelected) return new Set();
      return new Set(allActionIds);
    });
    if (!allSelected && allActionIds.length > 1) {
      setChatMessages((prev) => [...prev, {
        from: 'atlas',
        text: `Batch mode — analyzing ${allActionIds.length} orders. I've grouped them: ${actionOrders.filter((o) => o.actionKind === 'approve').length} to Approve, ${actionOrders.filter((o) => o.actionKind === 'confirm-delivery').length} to Confirm, ${actionOrders.filter((o) => o.actionKind === 'resolve-issue').length} to Resolve.`
      }]);
    }
  }, [allActionIds, allSelected, actionOrders]);

  const toggleSelect = useCallback((id: string, multi: boolean) => {
    setJourneyCompleteId(null);
    setBatchComplete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (multi) { if (next.has(id)) next.delete(id); else next.add(id); }
      else { if (next.size === 1 && next.has(id)) next.clear(); else { next.clear(); next.add(id); } }
      return next;
    });
    const order = ORDERS.find((o) => o.id === id);
    if (order && !multi) {
      setChatMessages((prev) => [...prev, { from: 'atlas', text: `${order.agentAgent}: ${order.agentReasoning}` }]);
    }
  }, []);

  // ── Execute single action ──
  // Wires the priority-feed CTAs (Approve / Confirm Delivery / Resolve
  // Issue) to actual stage advancement instead of just marking the
  // order "completed". Three branches by actionKind:
  //
  //   approve          → forceCompleteStage(current). For Stage 1 → 2
  //                      (PO Approved/sent), a 5s demo timer auto-
  //                      advances to Stage 3 (In Transit) so the journey
  //                      visibly moves. Stops at Stage 3 — the QC gate
  //                      is held for the user to click Confirm Delivery.
  //   confirm-delivery → marks the order fully terminal. forceCompleteStage(4)
  //                      pushes effectiveStage to 5 (past the rail end),
  //                      adds to completedIds for the sage "Completed" badge.
  //   resolve-issue    → routes the user to Activity & Governance where
  //                      the dispute panel lives. Does not auto-resolve.
  const executeAction = useCallback((id: string) => {
    const order = ORDERS.find((o) => o.id === id);
    if (!order) return;
    const currentStage = Math.max(order.dagStage, forceCompletedStages[id] ?? 0);

    // ── Branch by actionKind ───────────────────────────────────
    if (order.actionKind === 'resolve-issue') {
      // Disputes live on A&G. The Orders CTA logs the intent + routes.
      logUserAction({
        kind: 'po-message-supplier',
        entity: { type: 'po', id: order.id },
        summary: `Opened dispute resolution for ${order.id} · ${order.supplier}`,
        venue: 'Multi',
        details: order.failureReason ?? order.humanDescription,
        meta: { amount: order.amount, supplier: order.supplier, workflow: order.workflowTemplate, route: 'governance' },
      });
      toast.info(`Routing to Activity & Governance`, {
        description: `${order.id} dispute opens in the disputes panel.`,
      });
      if (typeof window !== 'undefined') {
        window.location.hash = `dispute=${order.id}`;
      }
      onNavigate?.('governance');
      return;
    }

    if (order.actionKind === 'confirm-delivery') {
      // Terminal: QC pass on a delivered order. Stamp + complete.
      forceCompleteStage(id, 4);
      setCompletedIds(prev => new Set([...prev, id]));
      setJourneyCompleteId(id);
      logUserAction({
        kind: 'po-stage-advance',
        entity: { type: 'po', id: order.id },
        summary: `Confirmed delivery + QC on ${order.id} · ${order.supplier}`,
        venue: 'Multi',
        details: order.humanDescription,
        meta: { amount: order.amount, supplier: order.supplier, workflow: order.workflowTemplate, terminal: true },
      });
      if (order.saving) {
        setChatMessages(prev => [...prev, {
          from: 'atlas',
          text: `✅ ${order.id} closed out. Saved ${order.saving.time} of manual work and ${fmtIdrShort(order.saving.cost)}.`,
        }]);
      }
      return;
    }

    // Default: Approve (advance one stage). Used at Stage 0 (Request
    // → Quote/Vendor Confirmed) and Stage 1 (Quote/Vendor Confirmed
    // → PO Approved).
    forceCompleteStage(id, currentStage);
    setActionTakenIds(prev => new Set([...prev, id]));
    const newStage = currentStage + 1;
    const amountIDR = `Rp ${(order.amount / 1_000_000).toFixed(1)}M`;
    logUserAction({
      kind: 'po-approve',
      entity: { type: 'po', id: order.id },
      summary: `Approved ${order.id} · ${order.supplier} · ${amountIDR}`,
      venue: 'Multi',
      details: order.humanDescription,
      meta: { amount: order.amount, supplier: order.supplier, workflow: order.workflowTemplate, fromStage: currentStage, toStage: newStage },
    });
    setChatMessages(prev => [...prev, {
      from: 'atlas',
      text: newStage === 2
        ? `✅ ${order.id} approved. PO sent to ${order.supplier} via WhatsApp — A-05 will track from here.`
        : `✅ ${order.id} advanced to Stage ${newStage + 1} (${DAG_STAGES[newStage]?.label ?? 'next stage'}).`,
    }]);
    // From this point on, the auto-progress engine (see below) takes over
    // and rides the journey through any remaining non-HITL stages on its
    // own demo cadence. No further click needed from the admin unless
    // the order hits a real human gate (above-cap, perishable QC, dispute).
  }, [forceCompletedStages, forceCompleteStage, onNavigate]);

  // ── Execute batch ──
  const executeBatch = useCallback(() => {
    setBatchComplete(true);
    batchOrders.forEach((o) => setCompletedIds((prev) => new Set([...prev, o.id])));
    setChatMessages((prev) => [...prev, {
      from: 'atlas',
      text: `✅ Batch finalized — ${batchSummary.total} orders processed. Saved ${fmtIdrShort(batchSummary.savings)} and ${batchSummary.hours}h of labor.`
    }]);
  }, [batchOrders, batchSummary]);

  const handleChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [...prev, { from: 'user', text: chatInput }]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages((prev) => [...prev, { from: 'atlas', text: "Analyzing the latest logistics data. I'll have a recommendation shortly." }]);
    }, 900);
  }, [chatInput]);

  const cmdFiltered = ORDERS.filter((o) =>
    cmdQuery ? o.id.toLowerCase().includes(cmdQuery.toLowerCase()) || o.supplier.toLowerCase().includes(cmdQuery.toLowerCase()) : true
  );

  // ── Order Card ────────────────────────────────────────────────────
  const OrderCard = ({ order }: { order: Order }) => {
    const isSelected = selectedIds.has(order.id);
    const isImminent = !!order.etaMinutes && order.etaMinutes <= 15;
    const isDone     = completedIds.has(order.id);
    const orderMode  = getMode(order.id);
    const isManual   = orderMode === 'manual';
    // 6s — derive the action from current state, not seeded actionKind.
    // The seeded value still informs orderCard visuals (icon/colour) but
    // the CTA + click handler key off the live derivedActionKind.
    const eff = Math.max(order.dagStage, forceCompletedStages[order.id] ?? 0);
    const liveActionKind = derivedActionKind(order, eff);
    const isFailed   = liveActionKind === 'resolve-issue';
    const actionMeta = liveActionKind ? ACTION_META[liveActionKind] : null;

    // ── Header badge config ────────────────────────────────────────
    // Each card surfaces exactly one status label — the icon + text
    // color is the card's only state signal. Card bg stays white.
    const { BadgeIcon, badgeText, badgeColorLight, badgeColorDark } = (() => {
      if (isDone)                             return { BadgeIcon: CircleCheck,  badgeText: 'Completed',                   badgeColorLight: 'text-green-600', badgeColorDark: 'text-green-400' };
      if (isFailed)                           return { BadgeIcon: AlertTriangle, badgeText: order.humanStatus,             badgeColorLight: 'text-red-600',   badgeColorDark: 'text-red-400'   };
      if (isManual)                           return { BadgeIcon: Hand,          badgeText: 'Manual — you are driving',    badgeColorLight: 'text-amber-700', badgeColorDark: 'text-amber-400' };
      if (order.actionKind === 'approve')     return { BadgeIcon: Clock,         badgeText: order.humanStatus,             badgeColorLight: 'text-amber-700', badgeColorDark: 'text-amber-400' };
      if (order.actionKind === 'confirm-delivery') return { BadgeIcon: Truck,   badgeText: order.humanStatus,             badgeColorLight: 'text-blue-600',  badgeColorDark: 'text-blue-400'  };
      if (isImminent)                         return { BadgeIcon: Truck,         badgeText: order.humanStatus,             badgeColorLight: 'text-green-600', badgeColorDark: 'text-green-400' };
      if (order.dagStage === 4)               return { BadgeIcon: CircleCheck,   badgeText: order.humanStatus,             badgeColorLight: 'text-green-600', badgeColorDark: 'text-green-400' };
      if (order.dagStage === 3)               return { BadgeIcon: Truck,         badgeText: order.humanStatus,             badgeColorLight: 'text-blue-600',  badgeColorDark: 'text-blue-400'  };
      return                                         { BadgeIcon: Clock,         badgeText: order.humanStatus,             badgeColorLight: 'text-gray-400',  badgeColorDark: 'text-gray-500'  };
    })();
    const badgeColor = isDark ? badgeColorDark : badgeColorLight;

    // ── Action CTA button style ────────────────────────────────────
    const ctaClass = isFailed
      ? isDark ? 'border-red-500/40 text-red-400 hover:bg-red-500/8' : 'border-red-300/70 text-red-600 hover:bg-red-50/60'
      : order.actionKind === 'confirm-delivery'
      ? isDark ? 'border-blue-500/40 text-blue-400 hover:bg-blue-500/8' : 'border-blue-300/70 text-blue-600 hover:bg-blue-50/60'
      : isDark ? 'border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#87986a]/40 text-[#6b7a54] hover:bg-[#f4f6f0]';

    return (
      <div
        onClick={(e) => toggleSelect(order.id, e.ctrlKey || e.metaKey)}
        className={`w-full text-left rounded-xl border cursor-pointer group transition-all duration-[350ms] relative shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
          isDone     ? (isDark ? 'bg-[#2a2a2a] border-gray-800 opacity-50' : 'bg-white border-[#e5e5e0] opacity-50') :
          isSelected ? (isDark ? 'bg-[#87986a]/15 border-[#87986a]/50 ring-1 ring-[#87986a]/30' : 'bg-[#f4f6f0] border-[#87986a]/50 ring-1 ring-[#87986a]/20') :
                       (isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-white border-[#e5e5e0] hover:bg-[#f4f6f0]/40')
        }`}
      >
        {/* ── HEADER — status badge ──────────────────────────────── */}
        <div className="flex items-center justify-between px-3 pt-3 pb-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <BadgeIcon className={`h-3.5 w-3.5 shrink-0 ${badgeColor}`} />
            <span className={`text-[11px] font-semibold truncate ${badgeColor}`}>
              {badgeText}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2 relative">
            {/* ⋯ context menu trigger */}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === order.id ? null : order.id); }}
              className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${
                menuOpenId === order.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              } ${isDark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-[#f4f6f0] text-gray-400'}`}
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
            {/* Checkbox — needs-action only */}
            {order.group === 'needs-action' && !isDone && (
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                isSelected ? 'bg-[#87986a] border-[#87986a]'
                  : isDark ? 'border-gray-700 opacity-0 group-hover:opacity-100' : 'border-[#e5e5e0] opacity-0 group-hover:opacity-100'
              }`}>
                {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
            )}
            {/* Dropdown */}
            {menuOpenId === order.id && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className={`absolute right-0 top-6 z-50 w-44 rounded-xl border shadow-lg overflow-hidden ${
                  isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#e5e5e0]'
                }`}
              >
                {(() => {
                  const cardStage = effectiveStage(order);
                  const canTrack  = cardStage >= 6 && !isDone;   // Dispatched (Stage 7) → just before Delivered
                  const canRepeat = isDone;                       // Completed orders only
                  return [
                    canTrack && { icon: MapPin,         label: 'Track Shipment',   action: () => setMenuOpenId(null) },
                                  { icon: MessageCircle,  label: 'Message Supplier', action: () => { setBridgeTarget({ orderId: order.id, supplier: order.supplier, channel: 'whatsapp', message: '' }); setMenuOpenId(null); } },
                    canRepeat && { icon: RefreshCw,      label: 'Repeat Order',     action: () => { openDraftSheet({ kind: 'reorder', sourceOrderId: order.id }); setMenuOpenId(null); } },
                  ].filter(Boolean) as { icon: typeof MapPin; label: string; action: () => void }[];
                })().map(({ icon: Icon, label, action }) => (
                  <button
                    key={label}
                    onClick={(e) => { e.stopPropagation(); action(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[10px] transition-colors ${
                      isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-[#f4f6f0] text-gray-700'
                    }`}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────── */}
        <div className="px-3 pt-3 pb-3">
          {/* Supplier — vetted shield + name */}
          <div className="flex items-center gap-1 mb-1">
            <ShieldCheck className={`h-3 w-3 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            <p className={`text-xs font-semibold ${t.textPrimary}`}>{order.supplier}</p>
          </div>
          {/* Description */}
          <p className={`text-[10px] leading-snug ${t.textMuted}`}>{order.humanDescription}</p>
          {/* ETA + Amount */}
          <div className="flex items-center justify-between mt-3">
            <span className={`text-[10px] ${isImminent ? 'text-green-500 font-semibold' : t.textMuted}`}>
              {order.eta}
            </span>
            <span className={`text-sm font-bold ${t.textPrimary}`}>
              {fmtIdrShort(order.amount)}
            </span>
          </div>
        </div>

        {/* ── FOOTER — agent attribution + action CTA ────────────── */}
        <div className={`flex items-center gap-1.5 px-3 py-2 border-t ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
          {/* Workforce badge */}
          <span
            title={isManual
              ? `Admin is driving — ${agentLabel(order.assignedAgent)} in Standby`
              : `${agentLabel(order.assignedAgent)} executing`}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${
              isManual
                ? isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-400/50 text-amber-700'
                : isDark ? 'bg-[#87986a]/15 border-[#87986a]/30 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/30 text-[#6b7a54]'
            }`}>
            {isManual ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
            {isManual ? 'User' : `#${String(order.assignedAgent.id).padStart(2, '0')}`}
          </span>
          {/* Attribution copy */}
          {order.actionKind === 'approve' && !isDone && (
            <span className={`text-[9px] italic truncate ${t.textMuted}`}>
              Proposed by {agentBadge(order.assignedAgent)}
            </span>
          )}
          {/* 6s — Action CTA. Routes per liveActionKind + entity mode:
                · Auto + approve   → opens Approval Confirmation modal
                · Manual + approve → opens Stage 1 task module (admin fills the form)
                · confirm-delivery → opens Stage 4 task module (POD + QC outcome + receiver)
                · resolve-issue    → existing route to A&G dispute panel (executeAction handles) */}
          {actionMeta && !isDone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (liveActionKind === 'approve') {
                  if (isManual) {
                    openStageModule(order.id, 1);
                  } else {
                    setApprovalForId(order.id);
                  }
                } else if (liveActionKind === 'confirm-delivery') {
                  openStageModule(order.id, 4);
                } else {
                  // resolve-issue or other → existing executeAction path
                  executeAction(order.id);
                }
              }}
              className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border transition-colors shrink-0 ${ctaClass}`}
            >
              {(() => { const I = actionMeta.icon; return <I className="h-2.5 w-2.5" />; })()}
              {isManual && liveActionKind === 'approve' ? 'Continue manually' : actionMeta.label}
            </button>
          )}
        </div>

      </div>
    );
  };

  // ── AUDIT MODE — Left Panel (expanded historical ledger) ──────────
  // Mirrors the Suppliers / Inventory Audit Mode shell. Renders only
  // when `auditMode === true`; in that mode the center panel collapses
  // and this view takes the full available width.
  const STATUS_CHIPS: { id: AuditStatus; label: string }[] = [
    { id: 'all',       label: 'All'       },
    { id: 'live',      label: 'Live'      },
    { id: 'completed', label: 'Completed' },
    { id: 'disputed',  label: 'Disputed'  },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'on-hold',   label: 'On Hold'   },
  ];
  const DATE_PRESETS: { id: AuditRange; label: string }[] = [
    { id: '7d',  label: '7 days'  },
    { id: '30d', label: '30 days' },
    { id: '90d', label: '90 days' },
    { id: 'all', label: 'All time' },
  ];
  const STAGE_BANDS: { id: AuditStage; label: string }[] = [
    { id: 'all',         label: 'Any stage'           },
    { id: 'procurement', label: 'Procurement (0-3)'   },
    { id: 'processing',  label: 'Processing (4-7)'    },
    { id: 'logistics',   label: 'Logistics (8-11)'    },
  ];
  const allAuditSelected = auditSelected.size > 0 && auditSelected.size === auditFiltered.length;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const auditLeftPanel = (
    <div className={`flex flex-col h-full ${!isDark ? 'bg-white' : ''}`}>
      {/* Header: title + count + Minimize2 */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            <div>
              <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Orders Audit</h2>
              <p className={`text-[10px] ${t.textMuted}`}>
                {auditFiltered.length} of {ALL_ORDERS.length} orders · A-04 (Spend Watchdog)
              </p>
            </div>
          </div>
          <button onClick={() => { setAuditMode(false); setAuditSelected(new Set()); }} title="Collapse Audit Mode"
            className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.textMuted}`} />
          <Input ref={auditSearchRef} placeholder="Search PO id, supplier, item, agent…"
            value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)}
            className={`pl-9 text-xs h-8 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : ''}`} />
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_CHIPS.map(chip => {
            const count = auditStatusCounts[chip.id];
            const active = auditStatusFilter === chip.id;
            return (
              <button key={chip.id} onClick={() => setAuditStatusFilter(chip.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                  active
                    ? isDark ? 'bg-[#87986a]/20 text-[#a3b085] border border-[#87986a]/30' : 'bg-[#f4f6f0] text-[#6b7a54] border border-[#dbe3ce]'
                    : isDark ? 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 border border-[#e5e5e0] hover:bg-gray-200'
                }`}>
                {chip.label} <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary filter row */}
      <div className={`px-4 py-2 border-b flex items-center gap-2 flex-wrap ${isDark ? 'border-gray-800 bg-[#181818]' : 'border-[#e5e5e0] bg-[#fafaf7]'}`}>
        <FilterIcon className={`h-3 w-3 ${t.textMuted}`} />
        {/* Date range presets */}
        <div className={`flex items-center rounded-md border overflow-hidden ${isDark ? 'border-gray-700' : 'border-[#e5e5e0]'}`}>
          {DATE_PRESETS.map(p => (
            <button key={p.id} onClick={() => setAuditDateRange(p.id)}
              className={`px-2 py-1 text-[9px] font-medium transition-colors ${
                auditDateRange === p.id
                  ? isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Supplier dropdown */}
        <select value={auditSupplierFilter ?? ''} onChange={(e) => setAuditSupplierFilter(e.target.value || null)}
          className={`text-[10px] h-7 px-2 rounded-md border outline-none ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-300' : 'bg-white border-[#e5e5e0] text-gray-700'}`}>
          <option value="">All suppliers</option>
          {auditSupplierOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Stage band */}
        <select value={auditStageFilter} onChange={(e) => setAuditStageFilter(e.target.value as AuditStage)}
          className={`text-[10px] h-7 px-2 rounded-md border outline-none ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-300' : 'bg-white border-[#e5e5e0] text-gray-700'}`}>
          {STAGE_BANDS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        {/* Agent dropdown */}
        <select value={auditAgentFilter ?? ''} onChange={(e) => setAuditAgentFilter(e.target.value ? Number(e.target.value) : null)}
          className={`text-[10px] h-7 px-2 rounded-md border outline-none ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-300' : 'bg-white border-[#e5e5e0] text-gray-700'}`}>
          <option value="">All agents</option>
          {auditAgentOptions.map(a => <option key={a.id} value={a.id}>{agentLabel(a)}</option>)}
        </select>

        {/* Workflow template dropdown */}
        <select value={auditWorkflowFilter ?? ''} onChange={(e) => setAuditWorkflowFilter(e.target.value || null)}
          className={`text-[10px] h-7 px-2 rounded-md border outline-none ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-300' : 'bg-white border-[#e5e5e0] text-gray-700'}`}>
          <option value="">All workflows</option>
          {workflowTemplates.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        {/* Clear filters */}
        {(auditSupplierFilter || auditAgentFilter || auditWorkflowFilter || auditStageFilter !== 'all' || auditStatusFilter !== 'all' || auditSearch) && (
          <button onClick={() => { setAuditSearch(''); setAuditStatusFilter('all'); setAuditSupplierFilter(null); setAuditAgentFilter(null); setAuditWorkflowFilter(null); setAuditStageFilter('all'); }}
            className={`text-[10px] underline ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
            Clear filters
          </button>
        )}
      </div>

      {/* Toolbar: Select All + view toggle + bulk actions */}
      <div className={`px-4 py-2 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'} flex items-center gap-3`}>
        <button onClick={toggleAuditSelectAll} className="flex items-center gap-1.5">
          {allAuditSelected
            ? <SquareCheckBig className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            : <Square className={`h-3.5 w-3.5 ${t.textMuted}`} />}
          <span className={`text-[10px] font-medium ${t.textMuted}`}>
            {auditSelected.size > 0 ? `${auditSelected.size} selected` : 'Select All'}
          </span>
        </button>

        {/* View toggle */}
        <div className={`flex items-center rounded-lg border ${isDark ? 'border-gray-700' : 'border-[#e5e5e0]'} ml-auto`}>
          <button onClick={() => setAuditView('table')} title="Table view"
            className={`flex items-center justify-center w-7 h-6 rounded-l-lg transition-colors ${
              auditView === 'table'
                ? isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
            }`}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setAuditView('grid')} title="Grid view"
            className={`flex items-center justify-center w-7 h-6 rounded-r-lg transition-colors ${
              auditView === 'grid'
                ? isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
            }`}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Bulk actions */}
        <Button size="sm" variant="outline" onClick={() => exportAuditCSV(auditSelected)}
          className={`h-6 px-2.5 text-[10px] gap-1 ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : ''}`}>
          <Download className="h-3 w-3" /> {auditSelected.size > 0 ? `Export (${auditSelected.size})` : 'Export all'}
        </Button>
      </div>

      {/* Content: table or grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {auditFiltered.length === 0 ? (
          <div className="p-8 text-center">
            <p className={`text-xs ${t.textMuted}`}>No orders match the current filters.</p>
          </div>
        ) : auditView === 'table' ? (
          <table className="w-full">
            <thead className={`sticky top-0 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} z-[1]`}>
              <tr className={`text-[9px] uppercase tracking-wide ${t.textMuted}`}>
                <th className="text-left py-2 px-3 w-8"></th>
                <th className="text-left py-2 px-2">PO</th>
                <th className="text-left py-2 px-2">Supplier</th>
                <th className="text-left py-2 px-2">Items</th>
                <th className="text-right py-2 px-2">Amount</th>
                <th className="text-center py-2 px-2">Status</th>
                <th className="text-center py-2 px-2">Stage</th>
                <th className="text-left py-2 px-2">Workflow</th>
                <th className="text-left py-2 px-2">Agent</th>
                <th className="text-left py-2 px-2">Created</th>
                <th className="text-left py-2 px-2">Completed</th>
                <th className="text-right py-2 px-2 pr-3">Savings</th>
              </tr>
            </thead>
            <tbody>
              {auditFiltered.map(o => {
                const isChecked = auditSelected.has(o.id);
                const pill = statusPill(o.status);
                const liveSelected = selectedIds.has(o.id);
                return (
                  <tr key={o.id} onClick={() => openFromAudit(o.id)}
                    className={`cursor-pointer border-b transition-colors duration-200 ${
                      liveSelected
                        ? isDark ? 'bg-[#87986a]/10 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#87986a]/20'
                        : isDark ? 'border-gray-800/50 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-[#f4f6f0]'
                    }`}>
                    <td className="py-2 px-3">
                      <button onClick={(e) => { e.stopPropagation(); toggleAuditRow(o.id); }}>
                        {isChecked
                          ? <SquareCheckBig className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                          : <Square className={`h-3.5 w-3.5 ${t.textMuted}`} />}
                      </button>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-[11px] font-mono font-semibold ${t.textPrimary}`}>{o.id}</span>
                    </td>
                    <td className="py-2 px-2" style={{ maxWidth: 140 }}>
                      <span className={`text-xs font-medium ${t.textPrimary} truncate block`}>{o.supplier}</span>
                    </td>
                    <td className="py-2 px-2" style={{ maxWidth: 200 }}>
                      <span className={`text-[10px] ${t.textMuted} truncate block`}>{o.items.join(', ')}</span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={`text-xs font-semibold ${t.textPrimary}`}>${o.amount.toLocaleString()}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        isDark ? `${pill.darkBg} ${pill.darkText}` : `${pill.lightBg} ${pill.lightText}`
                      }`}>{pill.label}</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={`text-[10px] font-mono ${t.textMuted}`}>{o.dagStage + 1}/5</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'
                      }`} title={workflowTemplates.find(w => w.id === o.workflowTemplate)?.description ?? o.workflowTemplate}>
                        {workflowLabel(o.workflowTemplate)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] ${t.textMuted}`}>#{String(o.assignedAgent.id).padStart(2, '0')} · {o.assignedAgent.role}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] ${t.textMuted}`}>{fmtDate(o.createdAt)}</span>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] ${t.textMuted}`}>{o.completedAt ? fmtDate(o.completedAt) : '—'}</span>
                    </td>
                    <td className="py-2 px-2 pr-3 text-right">
                      <span className={`text-[10px] font-semibold ${o.saving?.cost ? (isDark ? 'text-green-400' : 'text-green-700') : t.textMuted}`}>
                        {o.saving?.cost ? fmtIdrShort(o.saving.cost) : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Grid view */
          <div className="p-4 grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {auditFiltered.map(o => {
              const isChecked = auditSelected.has(o.id);
              const pill = statusPill(o.status);
              return (
                <div key={o.id} onClick={() => openFromAudit(o.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                    isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-white border-[#e5e5e0] hover:bg-[#f4f6f0]/40'
                  }`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-[11px] font-mono font-semibold ${t.textPrimary}`}>{o.id}</span>
                    <button onClick={(e) => { e.stopPropagation(); toggleAuditRow(o.id); }}>
                      {isChecked
                        ? <SquareCheckBig className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                        : <Square className={`h-3.5 w-3.5 ${t.textMuted}`} />}
                    </button>
                  </div>
                  <p className={`text-xs font-semibold ${t.textPrimary} truncate mb-1`}>{o.supplier}</p>
                  <p className={`text-[10px] ${t.textMuted} line-clamp-2 mb-2`}>{o.items.join(', ')}</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      isDark ? `${pill.darkBg} ${pill.darkText}` : `${pill.lightBg} ${pill.lightText}`
                    }`}>{pill.label}</span>
                    <span className={`text-xs font-bold ${t.textPrimary}`}>${o.amount.toLocaleString()}</span>
                  </div>
                  {/* Mini 5-stage bar */}
                  <div className="flex items-center gap-0.5 mb-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-sm ${
                        i <= o.dagStage
                          ? o.status === 'disputed' ? 'bg-red-500' :
                            o.status === 'cancelled' ? 'bg-gray-400' :
                            o.status === 'completed' ? 'bg-green-500' :
                            'bg-[#87986a]'
                          : isDark ? 'bg-gray-700' : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] ${t.textMuted}`}>#{String(o.assignedAgent.id).padStart(2, '0')}</span>
                    <span className={`text-[9px] ${t.textMuted}`}>{fmtDate(o.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ── AUDIT MODE — Right Panel (macro insights or Quick Journey) ────
  const auditRightPanel = (() => {
    // If a single live order is selected in audit mode, show a compact
    // Quick Journey card mirroring Inventory's pattern.
    if (selectedOrder) {
      return (
        <div className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
              <span className={`text-sm font-semibold ${t.textPrimary}`}>Quick Journey</span>
            </div>
            <p className={`text-[10px] ${t.textMuted}`}>{selectedOrder.id} · {selectedOrder.supplier}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-[#fafaf7] border-[#e5e5e0]'}`}>
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-lg font-bold ${t.textPrimary}`}>${selectedOrder.amount.toLocaleString()}</span>
                <span className={`text-[10px] ${t.textMuted}`}>Stage {selectedOrder.dagStage + 1}/5</span>
              </div>
              <p className={`text-[10px] ${t.textMuted}`}>{selectedOrder.humanDescription}</p>
            </div>
            {/* Compact 5-stage dot rail */}
            <div className="space-y-1">
              {DAG_STAGES.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    i < selectedOrder.dagStage  ? 'bg-[#87986a]' :
                    i === selectedOrder.dagStage ? 'bg-amber-500 animate-pulse' :
                    isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`} />
                  <span className={`text-[10px] ${i <= selectedOrder.dagStage ? t.textPrimary : t.textMuted}`}>
                    {i + 1}. {s.label}
                  </span>
                </div>
              ))}
            </div>
            <Button size="sm" onClick={() => { setAuditMode(false); }}
              className="w-full h-8 text-[11px] bg-[#87986a] hover:bg-[#6b7a54] text-white">
              <Maximize2 className="h-3 w-3 mr-1.5" /> Open Full Workspace
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAttributionTrailFor(selectedOrder.id); setExpandedAttrStage(null); }}
              className={`w-full h-8 text-[11px] ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : ''}`}>
              <History className="h-3 w-3 mr-1.5" /> Decision Trail
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBridgeTarget({ orderId: selectedOrder.id, supplier: selectedOrder.supplier, channel: 'whatsapp', message: '' })}
              className={`w-full h-8 text-[11px] ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : ''}`}>
              <MessageCircle className="h-3 w-3 mr-1.5" /> Message Supplier
            </Button>
          </div>
        </div>
      );
    }

    // No order selected — macro insights.
    return (
      <div className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
          <div className="flex items-center gap-2 mb-0.5">
            <TrendingUp className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
            <span className={`text-sm font-semibold ${t.textPrimary}`}>Operations Insights</span>
          </div>
          <p className={`text-[10px] ${t.textMuted}`}>A-04 · scoped to current filters</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Headline stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-[#fafaf7] border-[#e5e5e0]'}`}>
              <p className={`text-[9px] uppercase tracking-wide ${t.textMuted}`}>Processed</p>
              <p className={`text-lg font-bold ${t.textPrimary}`}>{auditInsights.totalCount}</p>
              <p className={`text-[10px] ${t.textMuted}`}>${(auditInsights.totalSpend / 1000).toFixed(1)}K spend</p>
            </div>
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-[#fafaf7] border-[#e5e5e0]'}`}>
              <p className={`text-[9px] uppercase tracking-wide ${t.textMuted}`}>On-time</p>
              <p className={`text-lg font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{auditInsights.onTimePct}%</p>
              <p className={`text-[10px] ${t.textMuted}`}>{auditInsights.completedCount} completed</p>
            </div>
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-[#fafaf7] border-[#e5e5e0]'}`}>
              <p className={`text-[9px] uppercase tracking-wide ${t.textMuted}`}>Avg cycle</p>
              <p className={`text-lg font-bold ${t.textPrimary}`}>{auditInsights.avgCycle}h</p>
              <p className={`text-[10px] ${t.textMuted}`}>PO → Delivered</p>
            </div>
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-[#fafaf7] border-[#e5e5e0]'}`}>
              <p className={`text-[9px] uppercase tracking-wide ${t.textMuted}`}>Savings</p>
              <p className={`text-lg font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>${(auditInsights.totalSaved / 1000).toFixed(1)}K</p>
              <p className={`text-[10px] ${t.textMuted}`}>recovered</p>
            </div>
          </div>

          {/* Status breakdown */}
          <div>
            <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Status mix</p>
            <div className="space-y-1.5">
              {(['live', 'completed', 'disputed', 'cancelled', 'on-hold'] as OrderStatus[]).map(s => {
                const count = auditFiltered.filter(o => o.status === s).length;
                const pill = statusPill(s);
                const pct = auditInsights.totalCount ? Math.round((count / auditInsights.totalCount) * 100) : 0;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold w-20 justify-center ${
                      isDark ? `${pill.darkBg} ${pill.darkText}` : `${pill.lightBg} ${pill.lightText}`
                    }`}>{pill.label}</span>
                    <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <div className="h-full bg-[#87986a]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-[10px] w-8 text-right ${t.textMuted}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top suppliers by spend */}
          {auditInsights.topSuppliers.length > 0 && (
            <div>
              <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Top suppliers · spend</p>
              <div className="space-y-1.5">
                {auditInsights.topSuppliers.map(s => (
                  <div key={s.name} onClick={() => setAuditSupplierFilter(s.name)}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-white border-[#e5e5e0] hover:bg-[#f4f6f0]'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold ${t.textPrimary} truncate`}>{s.name}</span>
                      <span className={`text-[10px] font-bold ${t.textPrimary}`}>${s.spend.toLocaleString()}</span>
                    </div>
                    <p className={`text-[9px] ${t.textMuted}`}>{s.count} order{s.count !== 1 ? 's' : ''}{s.disputes > 0 ? ` · ${s.disputes} disputed` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disputes by supplier */}
          {auditInsights.topDisputes.length > 0 && (
            <div>
              <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Disputes · top sources</p>
              <div className="space-y-1.5">
                {auditInsights.topDisputes.map(s => (
                  <div key={s.name} className={`p-2 rounded-lg border ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold ${isDark ? 'text-red-300' : 'text-red-700'} truncate`}>{s.name}</span>
                      <span className={`text-[10px] font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{s.disputes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  })();

  // ── LEFT PANEL ────────────────────────────────────────────────────
  // Structure: shrink-0 header + flex-1 min-h-0 overflow-y-auto scroll
  // region. The scroll region wraps both card sections so the user can
  // scrub the priority feed AND the autonomous feed independently of
  // the page chrome.
  const leftPanel = (
    <div className={`flex flex-col h-full min-h-0 ${!isDark ? 'bg-white' : ''}`}>
      {/* Header + global actions (fixed) */}
      <div className={`shrink-0 px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        <div className="flex items-center justify-between">
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Orders</h2>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())} className={`text-[9px] ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                Clear ({selectedIds.size})
              </button>
            )}
            <button onClick={() => setAuditMode(true)} title="Expand to Audit Mode — full historical ledger"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
          <span className={`font-semibold ${t.textPrimary}`}>{actionOrders.length}</span> need action ·{' '}
          <span className={`font-semibold ${t.textPrimary}`}>{autoOrders.length}</span> autonomous
        </p>

        {/* Search trigger */}
        <button onClick={() => setShowCmd(true)}
          className={`mt-2 w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] transition-colors ${isDark ? 'border-gray-700 bg-[#2a2a2a] text-gray-500 hover:bg-gray-800' : 'border-[#e5e5e0] bg-white text-gray-400 hover:bg-[#f4f6f0]'}`}>
          <Search className="h-3 w-3" />
          <span>Search orders</span>
          <span className={`ml-auto font-mono text-[9px] px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>⌘K</span>
        </button>
      </div>

      {/* Scroll region — needs-action + autonomous feeds */}
      <div className="flex-1 min-h-0 overflow-y-auto">

      {/* ── Needs Your Action (Priority Feed) ── */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
            isDark ? 'bg-amber-500/12 border-amber-500/25 text-amber-300' : 'bg-amber-50 border-amber-200/70 text-amber-700'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Needs Your Action
          </span>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-500 text-white'}`}>
              {actionOrders.length}
            </span>
            {actionOrders.length > 0 && (
              <button onClick={toggleGlobalSelect}
                className={`flex items-center gap-1 text-[9px] font-medium transition-colors ${isDark ? 'text-[#a3b085] hover:text-white' : 'text-[#6b7a54] hover:text-[#4a5a3a]'}`}>
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${allSelected ? 'bg-[#87986a] border-[#87986a]' : (isDark ? 'border-gray-600' : 'border-gray-400')}`}>
                  {allSelected && <Check className="h-2 w-2 text-white" />}
                </div>
                {allSelected ? 'Deselect' : 'Select all'}
              </button>
            )}
          </div>
        </div>
        {/* Card Body */}
        <div className="space-y-2">
          {actionOrders.length === 0 ? (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${isDark ? 'bg-[#2a2a2a] border-green-500/20' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-white" />
              </div>
              <span className={`text-xs font-medium ${t.textPrimary}`}>All clear — agents handling everything</span>
            </div>
          ) : actionOrders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      </div>

      {/* ── Autonomous Flow (Monitoring Feed) ── */}
      <div className="p-4">
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
            isDark ? 'bg-green-500/12 border-green-500/25 text-green-300' : 'bg-green-50 border-green-200/70 text-green-700'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            Autonomous Flow
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-500 text-white'}`}>
              {autoOrders.length}
            </span>
            <Bot className={`h-3 w-3 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
          </div>
        </div>
        {/* Card Body */}
        <div className="space-y-2">
          {autoOrders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      </div>

      </div>{/* end scroll region */}
    </div>
  );

  // ── 5-STAGE VERTICAL DAG ──────────────────────────────────────────
  // Manual Takeover hook: in `manualMode`, every stage becomes an
  // interactive Task Module (Edit / Execute / Plan), not a passive bar.
  const VerticalDag = ({ stage, manualMode, orderId, manualEntries, stageDelegations }: {
    stage: number;
    manualMode?: boolean;
    orderId?: string;
    manualEntries?: Record<number, Record<string, string>>;
    stageDelegations?: Record<number, boolean>;
  }) => (
    <div className="space-y-0">
      {DAG_STAGES.map((s, i) => {
        const done = i < stage;
        const current = i === stage;
        const upcoming = i > stage;
        const hasSubStep = !!s.agentStep;
        const isExpanded = expandedDagSteps.has(i);
        const hasManualEntry = !!manualEntries?.[i] && Object.values(manualEntries[i]).some(v => v && v.length > 0);
        const stageDelegated = !!stageDelegations?.[i];
        // ═══ Open Cockpit principle ═══
        // Manual mode → every stage is clickable (Edit / Execute / Plan).
        // Agent  mode → completed stages are clickable (View Trace), AND
        // HITL-gated stages (PO Approval, Delivery Confirmation) are
        // clickable when current — those carry "Review & Authorize" CTAs
        // even when the agent is otherwise driving.
        const needsAuthNow = current && requiresHumanAuthorization(i);
        const isInteractive = !!orderId && (!!manualMode || done || needsAuthNow);
        // What action verb to show on hover?
        const actionVerb = !orderId
          ? ''
          : manualMode
            ? current   ? 'Execute'
            : done      ? 'Edit'
            : upcoming  ? 'Plan'
            : ''
          : done         ? 'View Trace'
          : needsAuthNow ? 'Authorize'
          : '';
        const ActionIcon = needsAuthNow && !manualMode ? ShieldCheck
          : current ? Hand
          : done ? (manualMode ? Pencil : Eye)
          : Edit3;
        const handleOpen = (e: React.MouseEvent) => {
          if (!isInteractive) return;
          e.stopPropagation();
          openStageModule(orderId!, i);
        };
        return (
          <div key={i}>
            <div
              className={`group flex items-start gap-3 -mx-2 px-2 rounded-lg transition-colors ${
                isInteractive
                  ? 'cursor-pointer ' + (manualMode
                      ? isDark ? 'hover:bg-amber-500/5' : 'hover:bg-amber-50/40'
                      : isDark ? 'hover:bg-[#87986a]/8' : 'hover:bg-[#f4f6f0]/70')
                  : ''
              }`}
              onClick={isInteractive ? handleOpen : undefined}
            >
              {/* Dot + connector */}
              <div className="flex flex-col items-center pt-0.5">
                {isInteractive ? (
                  <button
                    onClick={handleOpen}
                    title={`${actionVerb}: ${s.label}`}
                    className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors ${
                      done
                        ? manualMode
                          ? 'bg-[#87986a] border-[#87986a] hover:bg-amber-500 hover:border-amber-500'
                          : 'bg-[#87986a] border-[#87986a] hover:ring-2 hover:ring-[#87986a]/40'
                      : current  ? 'bg-amber-500 border-amber-500 hover:bg-amber-600'
                      :            isDark ? 'border-amber-500/40 hover:bg-amber-500/20' : 'border-amber-400/50 hover:bg-amber-100'
                    }`}
                  >
                    {done    ? <Check className="h-2.5 w-2.5 text-white" />
                    : current ? <Hand className="h-2.5 w-2.5 text-white" />
                              : <Edit3 className={`h-2.5 w-2.5 ${isDark ? 'text-amber-300' : 'text-amber-600'}`} />}
                  </button>
                ) : (
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 ${
                    done    ? 'bg-[#87986a] border-[#87986a]' :
                    current ? (isDark ? 'bg-[#87986a]/20 border-[#87986a]' : 'bg-[#f4f6f0] border-[#87986a]') :
                              (isDark ? 'border-gray-700' : 'border-[#e5e5e0]')
                  }`}>
                    {done ? <Check className="h-2.5 w-2.5 text-white" />
                          : current ? <div className="w-1.5 h-1.5 rounded-full bg-[#87986a] animate-pulse" />
                          : null}
                  </div>
                )}
                {i < DAG_STAGES.length - 1 && (
                  <div className={`w-0.5 min-h-[16px] ${isExpanded ? 'min-h-[48px]' : ''} ${done ? 'bg-[#87986a]' : (isDark ? 'bg-gray-700' : 'bg-gray-300')}`} />
                )}
              </div>

              {/* Label + drill-down */}
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs ${
                    done    ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') :
                    current ? `font-semibold ${t.textPrimary}` :
                              t.textMuted
                  }`}>{s.label}</span>
                  {/* Manual-entry indicator */}
                  {isInteractive && hasManualEntry && (
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                      isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700'
                    }`} title="Manually completed by Admin">
                      <User className="h-2 w-2" /> manual
                    </span>
                  )}
                  {/* Sub-task delegated back to Atlas (Active Handshake) */}
                  {isInteractive && stageDelegated && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-green-500/15 text-green-500"
                          title="Atlas is monitoring this sub-task — you will be alerted on updates">
                      <Sparkles className="h-2 w-2" /> Atlas-delegated
                    </span>
                  )}
                  {/* Hover affordance — Edit / Execute / Plan / View Trace */}
                  {isInteractive && (
                    <button
                      onClick={handleOpen}
                      className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        current
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : manualMode
                          ? isDark ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : isDark ? 'bg-[#87986a]/15 text-[#a3b085] hover:bg-[#87986a]/25' : 'bg-[#f4f6f0] text-[#6b7a54] hover:bg-[#e8eddf]'
                      }`}
                    >
                      <ActionIcon className="h-2.5 w-2.5" /> {actionVerb}
                    </button>
                  )}
                  {/* Drill-down toggle for agent sub-steps */}
                  {hasSubStep && (done || current) && !isInteractive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDagSteps((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                      className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>
                {/* Manual-entry summary (replaces agent sub-step in manual mode) */}
                {isInteractive && hasManualEntry && (
                  <div className={`mt-1 px-2 py-1.5 rounded-md text-[10px] ${isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
                    {Object.entries(manualEntries![i])
                      .filter(([, v]) => v)
                      .slice(0, 2)
                      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v.length > 36 ? v.slice(0, 36) + '…' : v}`)
                      .join(' · ')}
                  </div>
                )}
                {/* Expanded agent sub-step (only when not in interactive mode) */}
                {hasSubStep && isExpanded && !isInteractive && (
                  <div className={`mt-1 px-2 py-1.5 rounded-md text-[10px] ${isDark ? 'bg-[#87986a]/10 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
                    {s.agentStep}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Labor Switch (single-order steering) ─────────────────────────
  const LaborSwitch = ({ order }: { order: Order }) => {
    const orderMode = getMode(order.id);
    const agentActive = orderMode === 'auto';
    return (
      <div className={`inline-flex items-stretch rounded-full border ${isDark ? 'border-gray-700 bg-[#2a2a2a]' : 'border-[#e5e5e0] bg-[#f4f6f0]'}`}>
        <button
          onClick={() => setMode(order.id, 'auto')}
          title={agentActive
            ? `${agentLabel(order.assignedAgent)} executing`
            : `Resume ${agentLabel(order.assignedAgent)}`}
          className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            agentActive
              ? 'bg-[#87986a] text-white shadow-sm'
              : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Bot className="h-3 w-3" />
          {agentBadge(order.assignedAgent)} Active
        </button>
        <button
          onClick={() => setMode(order.id, 'manual')}
          title={!agentActive
            ? `${agentLabel(order.assignedAgent)} in Standby — you are driving`
            : `Take over from ${agentLabel(order.assignedAgent)}`}
          className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !agentActive
              ? 'bg-amber-500 text-white shadow-sm'
              : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Hand className="h-3 w-3" />
          Manual Takeover
        </button>
      </div>
    );
  };

  // ── CENTER PANEL ──────────────────────────────────────────────────
  const journeyOrder = journeyCompleteId ? ORDERS.find((o) => o.id === journeyCompleteId) : null;

  const centerPanel = (
    <div className="p-6 space-y-5">

      {/* ── PEAK-END: Journey Complete (single) ── */}
      {journeyOrder && !isBatch && (
        <div className="flex flex-col items-center justify-center py-14 text-center transition-all duration-[400ms]">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${isDark ? 'bg-green-500/15' : 'bg-green-50'}`}>
            <CircleCheck className="h-8 w-8 text-green-400" />
          </div>
          <h2 className={`text-lg font-bold ${t.textPrimary}`}>Journey Complete — {journeyOrder.id}</h2>
          <p className={`text-sm ${t.textMuted} mt-1`}>{journeyOrder.supplier} · {journeyOrder.humanAction}</p>
          {journeyOrder.saving && (
            <div className="flex gap-4 mt-8">
              <div className={`p-5 rounded-xl border text-center ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                <span className="text-xl font-bold text-green-400">{fmtIdrShort(journeyOrder.saving.cost)}</span>
                <p className={`text-[10px] mt-1 ${t.textMuted}`}>Cost saved</p>
              </div>
              <div className={`p-5 rounded-xl border text-center ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                <span className={`text-xl font-bold ${t.textPrimary}`}>{journeyOrder.saving.time}</span>
                <p className={`text-[10px] mt-1 ${t.textMuted}`}>Labor saved</p>
              </div>
              <div className={`p-5 rounded-xl border text-center ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                <span className={`text-xl font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>12</span>
                <p className={`text-[10px] mt-1 ${t.textMuted}`}>DAG stages completed</p>
              </div>
            </div>
          )}
          <Button onClick={() => { setJourneyCompleteId(null); setSelectedIds(new Set()); }} variant="outline"
            className={`mt-8 text-xs ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`}>
            ← Back to orders
          </Button>
        </div>
      )}

      {/* ── PEAK-END: Batch Complete ── */}
      {batchComplete && (
        <div className="flex flex-col items-center justify-center py-14 text-center transition-all duration-[400ms]">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${isDark ? 'bg-green-500/15' : 'bg-green-50'}`}>
            <CircleCheck className="h-8 w-8 text-green-400" />
          </div>
          <h2 className={`text-lg font-bold ${t.textPrimary}`}>Batch Finalized — {batchSummary.total} Orders</h2>
          <div className="flex gap-4 mt-8">
            <div className={`p-5 rounded-xl border text-center ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <span className="text-xl font-bold text-green-400">{fmtIdrShort(batchSummary.savings)}</span>
              <p className={`text-[10px] mt-1 ${t.textMuted}`}>Total saved</p>
            </div>
            <div className={`p-5 rounded-xl border text-center ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <span className={`text-xl font-bold ${t.textPrimary}`}>{batchSummary.hours}h</span>
              <p className={`text-[10px] mt-1 ${t.textMuted}`}>Labor saved</p>
            </div>
            <div className={`p-5 rounded-xl border text-center ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <span className={`text-xl font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{batchSummary.total}</span>
              <p className={`text-[10px] mt-1 ${t.textMuted}`}>Orders processed</p>
            </div>
          </div>
          <Button onClick={() => { setBatchComplete(false); setSelectedIds(new Set()); }} variant="outline"
            className={`mt-8 text-xs ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : ''}`}>
            ← Back to orders
          </Button>
        </div>
      )}

      {/* ── SINGLE ORDER: Individual Journey ── */}
      {isSingle && selectedOrder && !journeyOrder && !batchComplete && (() => {
        const orderMode = getMode(selectedOrder.id);
        const isManual = orderMode === 'manual';
        const stage = effectiveStage(selectedOrder);
        return (
        <div className="space-y-5 transition-all duration-[380ms]">
          {/* ═══ HEADER — Wayne doctrine: identity, attribution, steering ═══
              When Manual mode is on, the header turns amber to show
              the Admin is "Driving." */}
          <div className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${
            isManual
              ? isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50/70 border-amber-400/40'
              : isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
          }`}>
            <div className="min-w-0">
              {/* Row 1 — identity */}
              <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Order Journey — {selectedOrder.id}</h2>

              {/* Row 2 — status badge + supplier + directory badge, all same pill spec */}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {(() => {
                  const sb = getStatusBadge(selectedOrder);
                  const SBI = sb.icon;
                  const cls = sb.tone === 'green'
                    ? isDark ? 'bg-green-500/15 text-green-300 border-green-500/40' : 'bg-green-50 text-green-700 border-green-300/60'
                  : sb.tone === 'amber'
                    ? isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-300/60'
                  : sb.tone === 'sage'
                    ? isDark ? 'bg-[#87986a]/15 text-[#a3b085] border-[#87986a]/40' : 'bg-[#f4f6f0] text-[#6b7a54] border-[#87986a]/40'
                  : sb.tone === 'blue'
                    ? isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'bg-blue-50 text-blue-700 border-blue-300/60'
                    : isDark ? 'bg-[#2a2a2a] text-gray-300 border-gray-700' : 'bg-[#f4f6f0] text-gray-600 border-[#e5e5e0]';
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${cls}`}>
                      {sb.pulse && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-70 animate-ping" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                        </span>
                      )}
                      <SBI className="h-2.5 w-2.5" />
                      {sb.label}
                    </span>
                  );
                })()}
                {/* Supplier + Internal Directory — same pill spec */}
                <span
                  title="AI is locked to the vetted internal directory · Walled Garden"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                    isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
                  }`}>
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {selectedOrder.supplier}
                  <Lock className="h-2.5 w-2.5 opacity-60" />
                </span>
              </div>

              {/* Row 3 — managed-by (tertiary, quieter) */}
              <button
                onClick={() => openGovernance(selectedOrder.assignedAgent.id)}
                title="Open this agent's directory profile to tune autonomy & approval limits"
                className={`mt-1.5 inline-flex items-center gap-1 text-[10px] hover:underline ${t.textMuted}`}>
                <Bot className="h-3 w-3" />
                Managed by: {agentLabel(selectedOrder.assignedAgent)}
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Re-order — visible action for delivered orders.
                  Surfaces the carbon-copy path here instead of burying it in
                  the Stage 5 trace modal. */}
              {(stage >= 4 || completedIds.has(selectedOrder.id)) && (
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      const params = new URLSearchParams({
                        intent: 'express', mode: 'reorder',
                        from: selectedOrder.id,
                        vendor: selectedOrder.supplier,
                        items: selectedOrder.items.join(', '),
                      });
                      window.location.hash = params.toString();
                    }
                    onNavigate?.('request');
                  }}
                  title={`Carbon-copy ${selectedOrder.id} into a new request — lands on Step 4 (Review) for one-click authorize`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm border ${
                    isDark ? 'bg-[#1f2a1f] border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/15'
                          : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54] hover:bg-[#e8eddf]'
                  }`}>
                  <RefreshCw className="h-3.5 w-3.5" /> Re-order
                </button>
              )}
              <LaborSwitch order={selectedOrder} />
              <button onClick={() => setSelectedIds(new Set())}
                className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-[#f4f6f0]'}`}>
                ← All
              </button>
            </div>
          </div>

          {/* Manual driver banner */}
          {isManual && (
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#2a2a2a] border-amber-500/20' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Hand className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${t.textPrimary}`}>
                    Manual Takeover Active — You are driving {selectedOrder.id}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                    {agentLabel(selectedOrder.assignedAgent)} is in Standby. Every stage below is now an Edit / Execute / Plan task module — open one to log evidence and advance the journey.
                  </p>
                  <button
                    onClick={() => setMode(selectedOrder.id, 'auto')}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#6b7a54] hover:text-[#4a5a3a] transition-colors"
                  >
                    <PlayCircle className="h-3 w-3" /> Resume Auto →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Order detail + DAG — side-by-side */}
          <div className="flex gap-4 items-start">

            {/* Left column — Order detail card + Live Tracking (stage ≥ 7) */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div className={`${t.cardPanel} space-y-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-2xl font-bold tracking-tight ${t.textPrimary}`}>${selectedOrder.amount.toLocaleString()}</span>
                  <p className={`text-sm mt-1 ${t.textMuted}`}>{selectedOrder.humanDescription}</p>
                </div>
                {selectedOrder.saving && selectedOrder.saving.cost > 0 && (
                  <div className="text-right">
                    <span className="text-sm font-bold text-green-400">{fmtIdrShort(selectedOrder.saving.cost)}</span>
                    <p className={`text-[10px] ${t.textMuted}`}>estimated saving</p>
                  </div>
                )}
              </div>

              {/* Item table with generous padding */}
              <div>
                <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>ITEMS</h4>
                <div className="space-y-1.5">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className={`px-4 py-2.5 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-[#f4f6f0]'}`}>
                      <span className={`text-sm ${t.textPrimary}`}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action — Failure / Approve / Confirm */}
              {selectedOrder.actionKind === 'resolve-issue' ? (
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#2a2a2a] border-red-500/20' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${t.textPrimary}`}>Delivery couldn't be completed</p>
                      <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>{selectedOrder.failureReason}</p>
                      {selectedOrder.negotiating && (
                        <p className={`text-[10px] mt-1 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{selectedOrder.agentAgent} is handling this. Second attempt at 10:00 AM.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 ml-10">
                    <button onClick={() => executeAction(selectedOrder.id)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors inline-flex items-center gap-1">
                      <PhoneCall className="h-3 w-3" /> Contact Supplier
                    </button>
                    <button className={`text-xs ${t.textMuted} hover:${t.textPrimary} transition-colors inline-flex items-center gap-1`}>
                      <RefreshCw className="h-3 w-3" /> Reschedule
                    </button>
                  </div>
                </div>
              ) : selectedOrder.actionKind === 'approve' ? (
                <div className="space-y-2">
                  <button onClick={() => executeAction(selectedOrder.id)}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold bg-[#87986a] hover:bg-[#6b7a54] text-white transition-colors">
                    <ThumbsUp className="h-4 w-4" /> Approve &amp; Execute
                  </button>
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        logUserAction({
                          kind: 'po-decline',
                          entity: { type: 'po', id: selectedOrder.id },
                          summary: `Declined ${selectedOrder.id} · ${selectedOrder.supplier}`,
                          details: selectedOrder.humanDescription,
                          outcome: 'overridden',
                          meta: { amount: selectedOrder.amount, supplier: selectedOrder.supplier },
                        });
                        toast.warning(`Declined ${selectedOrder.id}`, {
                          description: 'Agent recommendation rejected — it will not re-suggest without new data.',
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                      <ThumbsDown className="h-3 w-3" /> Decline
                    </button>
                  </div>
                </div>
              ) : selectedOrder.actionKind === 'confirm-delivery' ? (
                <div className="space-y-2">
                  <button onClick={() => executeAction(selectedOrder.id)}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                    <CircleCheck className="h-4 w-4" /> Confirm Delivery
                  </button>
                  <div className="flex justify-center">
                    <button
                      onClick={() => toast.info(`Report an issue · ${selectedOrder.id}`, {
                        description: 'Production: opens a per-line-item receipt modal — accept-all / accept-partial (qty short-shipped) / reject-quality (with photos) / reject-wrong-item / pending-inspection. Emits a GoodsReceipt event and routes to dispute flow when needed.',
                      })}
                      className={`inline-flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <AlertTriangle className="h-3 w-3" /> Report an Issue
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Tertiary actions — stage-gated */}
              {(stage >= 3 || completedIds.has(selectedOrder.id)) && (
                <div className={`flex items-center justify-center gap-5 pt-2 border-t ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
                  {stage >= 3 && (
                    <button className={`inline-flex items-center gap-1 text-[11px] transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}>
                      <MapPin className="h-3 w-3" /> Track
                    </button>
                  )}
                  <button
                    onClick={() => setBridgeTarget({ orderId: selectedOrder.id, supplier: selectedOrder.supplier, channel: 'whatsapp', message: '' })}
                    className={`inline-flex items-center gap-1 text-[11px] transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}>
                    <MessageCircle className="h-3 w-3" /> Message supplier
                  </button>
                  {completedIds.has(selectedOrder.id) && (
                    <button
                      onClick={() => openDraftSheet({ kind: 'reorder', sourceOrderId: selectedOrder.id })}
                      className={`inline-flex items-center gap-1 text-[11px] transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}>
                      <RefreshCw className="h-3 w-3" /> Repeat
                    </button>
                  )}
                </div>
              )}
              {stage < 3 && !completedIds.has(selectedOrder.id) && (
                <div className={`flex items-center justify-center pt-2 border-t ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
                  <button
                    onClick={() => setBridgeTarget({ orderId: selectedOrder.id, supplier: selectedOrder.supplier, channel: 'whatsapp', message: '' })}
                    className={`inline-flex items-center gap-1 text-[11px] transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-700'}`}>
                    <MessageCircle className="h-3 w-3" /> Message supplier
                  </button>
                </div>
              )}
            </div>{/* end detail card */}

            {/* Live Tracking — only from Stage 4 (In Transit) onwards */}
            {stage >= 3 && (
              <div className={`${t.cardPanel} space-y-3`}>
                <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Live Tracking</h3>
                <div className={`h-20 rounded-xl border flex items-center justify-center ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-[#f4f6f0] border-[#e5e5e0]'}`}>
                  <div className="flex items-center gap-3">
                    <div className="space-y-1.5">
                      <div className={`h-2 w-24 rounded-full animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                      <div className={`h-2 w-16 rounded-full animate-pulse ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    </div>
                    <MapPin className={`h-5 w-5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'} animate-bounce`} />
                  </div>
                </div>
              </div>
            )}

            </div>{/* end left column */}

            {/* Right column — 5-Stage Order Journey (title inside the card) */}
            <div className="w-[260px] shrink-0">
              <div className={`${t.cardPanel} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-semibold ${t.textPrimary}`}>
                    {isManual ? '5-Stage Task List' : '5-Stage Order Journey'} — Stage {stage + 1}
                  </h3>
                  {isManual && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                      <Edit3 className="h-2.5 w-2.5" /> Hover · Edit
                    </span>
                  )}
                </div>
                <VerticalDag
                  stage={stage}
                  manualMode={isManual}
                  orderId={selectedOrder.id}
                  manualEntries={manualStageData[selectedOrder.id]}
                  stageDelegations={delegations[selectedOrder.id]}
                />
              </div>
            </div>

          </div>
        </div>
        );
      })()}

      {/* ── BATCH: Transformation Console ── */}
      {isBatch && !batchComplete && (
        <div className="space-y-5 transition-all duration-[380ms]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Batch Transformation Console</h2>
              <p className={`text-xs ${t.textMuted}`}>{batchSummary.total} orders · ${batchSummary.value.toLocaleString()} total</p>
            </div>
            <button onClick={() => setSelectedIds(new Set())}
              className={`text-[10px] px-2.5 py-1 rounded-md ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-[#f4f6f0]'}`}>
              Exit batch
            </button>
          </div>

          {/* Chunked summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {batchSummary.approve > 0 && (
              <div className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${isDark ? 'bg-[#2a2a2a] border-green-500/20' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                  <ThumbsUp className="h-3.5 w-3.5 text-white" />
                </div>
                <span className={`text-lg font-bold ${t.textPrimary}`}>{batchSummary.approve}</span>
                <p className={`text-[10px] text-center ${t.textMuted}`}>To Approve</p>
              </div>
            )}
            {batchSummary.confirm > 0 && (
              <div className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${isDark ? 'bg-[#2a2a2a] border-blue-500/20' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                  <CircleCheck className="h-3.5 w-3.5 text-white" />
                </div>
                <span className={`text-lg font-bold ${t.textPrimary}`}>{batchSummary.confirm}</span>
                <p className={`text-[10px] text-center ${t.textMuted}`}>To Confirm Receipt</p>
              </div>
            )}
            {batchSummary.resolve > 0 && (
              <div className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${isDark ? 'bg-[#2a2a2a] border-red-500/20' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5 text-white" />
                </div>
                <span className={`text-lg font-bold ${t.textPrimary}`}>{batchSummary.resolve}</span>
                <p className={`text-[10px] text-center ${t.textMuted}`}>To Resolve</p>
              </div>
            )}
          </div>

          {/* Consolidated table — judgment-only columns */}
          <div>
            <h3 className={`text-xs font-semibold mb-3 ${t.textPrimary}`}>Order Details</h3>
            <div className="space-y-2">
              {batchOrders.map((order) => {
                const meta = order.actionKind ? ACTION_META[order.actionKind] : null;
                return (
                  <div key={order.id} className={`p-4 rounded-xl border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-semibold ${t.textPrimary}`}>{order.id}</span>
                          <span className={`text-xs ${t.textMuted}`}>{order.supplier}</span>
                        </div>
                        <p className={`text-[10px] ${t.textMuted}`}>{order.humanDescription}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs font-bold ${t.textPrimary}`}>${order.amount.toLocaleString()}</span>
                          {meta && (
                            <span className={`text-[10px] font-medium ${isDark ? meta.darkColor : meta.color}`}>{meta.label}</span>
                          )}
                        </div>
                      </div>
                      {/* Fitts's Law — large action button */}
                      {meta && (
                        <Button
                          onClick={() => executeAction(order.id)}
                          size="sm"
                          className={`h-9 px-4 text-xs font-semibold shrink-0 ${
                            order.actionKind === 'approve' || order.actionKind === 'confirm-delivery'
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                        >
                          {(() => { const I = meta.icon; return <I className="h-3.5 w-3.5 mr-1.5" />; })()}
                          {meta.label}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Oversized Execute Batch button — Fitts's Law */}
          <div className={`sticky bottom-0 pt-4 pb-2 ${isDark ? 'bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a] to-transparent' : 'bg-gradient-to-t from-white via-white to-transparent'}`}>
            <Button onClick={executeBatch}
              className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg">
              <Zap className="h-5 w-5 mr-2" />
              Execute Batch — {batchSummary.total} Orders · ${batchSummary.value.toLocaleString()}
            </Button>
          </div>
        </div>
      )}

      {/* ── DEFAULT: No selection ── */}
      {!isBatch && !isSingle && !journeyOrder && !batchComplete && (() => {
        // Macro Workforce Vitals (Wayne doctrine)
        // Active = not yet at final stage 11 and not force-completed via takeover.
        const activeOrders = ORDERS.filter(o => effectiveStage(o) < 11);
        const humanLed = activeOrders.filter(o => getMode(o.id) === 'manual').length;
        const agentLed = activeOrders.length - humanLed;
        const humanLedPct = activeOrders.length === 0 ? 0 : Math.round((humanLed / activeOrders.length) * 100);
        const agentLedPct = activeOrders.length === 0 ? 0 : 100 - humanLedPct;
        const hoursReclaimed = ORDERS.reduce((sum, o) => sum + parseFloat(o.saving?.time ?? '0'), 0).toFixed(1);
        return (
        <div className="space-y-5 transition-all duration-[380ms]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Order Dashboard</h2>
              <p className={`text-xs mt-0.5 ${t.textMuted}`}>Select an order to open its journey. Ctrl+click to batch.</p>
            </div>
            <button
              onClick={() => {
                // Same as top-nav New Request — fresh wizard from Step 1.
                if (typeof window !== 'undefined') {
                  window.location.hash = '';
                }
                onNavigate?.('request');
              }}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] active:scale-[0.98] transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Order
            </button>
          </div>

          {/* Pending Drafts / Schedules — surface anything created this session */}
          {scheduledEntries.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Pending Drafts &amp; Schedules</h3>
                <span className={`text-[10px] ${t.textMuted}`}>{scheduledEntries.length} this session</span>
              </div>
              <div className="space-y-2">
                {scheduledEntries.map(entry => (
                  <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      entry.cadence === 'one-off'
                        ? isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                        : isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {entry.cadence === 'one-off' ? <FileUp className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-semibold ${t.textPrimary} truncate`}>{entry.label}</div>
                      <div className={`flex items-center gap-2 text-[10px] mt-0.5 flex-wrap ${t.textMuted}`}>
                        <span className="inline-flex items-center gap-1">
                          {entry.cadence === 'weekly' ? <><Calendar className="h-2.5 w-2.5" /> Weekly</>
                          : entry.cadence === 'monthly' ? <><Calendar className="h-2.5 w-2.5" /> Monthly</>
                          : <>One-off draft</>}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          {entry.assignment === 'auto'
                            ? <><Bot className="h-2.5 w-2.5" /> {LEGACY_AGENT_MAP[entry.agentId] ?? 'A-02'}</>
                            : <><Hand className="h-2.5 w-2.5 text-amber-500" /> Manual from start</>}
                        </span>
                        {entry.nextRunIso && (
                          <>
                            <span>·</span>
                            <span>Next: {new Date(entry.nextRunIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-500 shrink-0">
                      <ShieldCheck className="h-2.5 w-2.5" /> Awaits Authorization
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workforce Vitals — labor-aware metrics */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Active Value', value: fmtIdrShort(ORDERS.filter((o) => effectiveStage(o) < 4).reduce((s, o) => s + o.amount, 0)), accent: false, sub: `${activeOrders.length} active` },
              { label: 'Human Hours Reclaimed', value: `${hoursReclaimed}h`, accent: true, sub: 'this week · agent-attributed' },
              { label: 'Savings This Week', value: fmtIdrShort(ORDERS.reduce((s, o) => s + (o.saving?.cost ?? 0), 0)), accent: true, sub: 'agent-driven' },
              { label: 'Agent-Managed', value: `${autoOrders.length}`, accent: false, sub: `of ${ORDERS.length} orders` },
            ].map(({ label, value, accent, sub }) => (
              <div key={label} className={`p-4 rounded-xl border text-center ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                <span className={`text-lg font-bold ${accent ? 'text-green-400' : t.textPrimary}`}>{value}</span>
                <p className={`text-[10px] mt-1 font-medium ${t.textPrimary}`}>{label}</p>
                <p className={`text-[9px] mt-0.5 ${t.textMuted}`}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Labor Mix — Human-led vs Agent-led active orders */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Labor Mix</h3>
                <span className={`text-[10px] ${t.textMuted}`}>· {activeOrders.length} active orders</span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-[#87986a]" />
                  <span className={t.textMuted}>Agent-led</span>
                  <span className={`font-bold ${t.textPrimary}`}>{agentLed} ({agentLedPct}%)</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm bg-amber-500" />
                  <span className={t.textMuted}>Human-led</span>
                  <span className={`font-bold ${t.textPrimary}`}>{humanLed} ({humanLedPct}%)</span>
                </span>
              </div>
            </div>
            {/* Mix bar */}
            <div className={`flex h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
              <div className="bg-[#87986a] h-full transition-all" style={{ width: `${agentLedPct}%` }} />
              <div className="bg-amber-500 h-full transition-all" style={{ width: `${humanLedPct}%` }} />
            </div>
            {humanLed > 0 && (
              <p className={`text-[9px] mt-2 ${t.textMuted}`}>
                {humanLed} order{humanLed === 1 ? '' : 's'} parked in Human Review — open the order to finish or release back to the assigned agent.
              </p>
            )}
          </div>

          {/* Next 48h arrivals */}
          <div>
            <h3 className={`text-xs font-semibold mb-3 ${t.textPrimary}`}>Arriving Next 48 Hours</h3>
            <div className="space-y-2">
              {ORDERS.filter((o) => o.dagStage === 3).map((order) => {
                const isImminent = !!order.etaMinutes && order.etaMinutes <= 15;
                return (
                  <button key={order.id} onClick={() => toggleSelect(order.id, false)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                      isImminent ? (isDark ? 'bg-[#2a2a2a] border-green-500/30 hover:bg-green-500/5' : 'bg-white border-green-400/50 hover:bg-[#f4f6f0]')
                                 : (isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-white border-[#e5e5e0] hover:bg-[#f4f6f0]')
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#87986a]/10' : 'bg-[#f4f6f0]'}`}>
                        <Truck className={`h-4 w-4 ${isImminent ? 'text-green-500' : (isDark ? 'text-blue-400' : 'text-blue-600')}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${t.textPrimary}`}>{order.supplier}</span>
                          <span className={`text-xs font-bold ${isImminent ? 'text-green-400' : t.textPrimary}`}>{order.eta}</span>
                        </div>
                        <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>{order.humanDescription}</p>
                      </div>
                      <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${t.textMuted}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );

  // ── RIGHT PANEL (Atlas) ───────────────────────────────────────────
  const contextQuestions = isBatch ? [
    `What's the risk profile of this batch?`,
    `Which orders can be auto-approved right now?`,
    `Summarize the exceptions and how to fix them`,
  ] : selectedOrder ? [
    `Why did you choose this logistics provider?`,
    `What's the backup plan if delivery fails?`,
    `How does ${selectedOrder.supplier} compare to alternatives?`,
  ] : [
    "Which order needs my attention most urgently?",
    "What value is arriving today?",
    "Any cost-saving opportunities I'm missing?",
  ];

  // ── Source Bridge Panel ───────────────────────────────────────────
  // ── Inbound quote message lookup ─────────────────────────────────
  // If the open Source Bridge target is for a PO that was minted from
  // an RFQ award, surface the actual vendor reply that started this
  // PO. Used to seed the thread store on first open.
  const bridgeQuoteContext = (() => {
    if (!bridgeTarget) return null;
    const runtime = runtimePOById.get(bridgeTarget.orderId);
    if (!runtime?.fromRfqId) return null;
    const rfq = rfqRecords.find(r => r.id === runtime.fromRfqId);
    if (!rfq) return null;
    const quote = rfq.quotes.find(q => q.vendorId === runtime.awardedVendorId)
      ?? rfq.quotes.find(q => q.vendorName === runtime.supplier);
    if (!quote) return null;
    return { runtime, rfq, quote };
  })();

  // Thread for the open Source Bridge. Re-renders when appendMessage fires.
  const bridgeThread = useThread(bridgeTarget?.orderId);

  // Seed the thread on first open. For RFQ-sourced POs the inbound quote
  // bubble is the first message. The PO-sent system note + admin's
  // approval reply also synthesise here so the demo conversation feels
  // complete on first view.
  useEffect(() => {
    if (!bridgeTarget) return;
    const existing = readThread(bridgeTarget.orderId);
    if (existing.length > 0) return;
    const ctx = bridgeQuoteContext;
    const order = ORDERS.find(o => o.id === bridgeTarget.orderId);
    const supplierName = bridgeTarget.supplier;
    const acctMgrName = ctx?.runtime.quoteFrom?.split(' ·')[0] ?? supplierName;
    const channel: BridgeChannel = ctx?.rfq.channel === 'email' ? 'email' : 'whatsapp';
    const messages: BridgeMessage[] = [];
    if (ctx) {
      const quote = ctx.quote;
      messages.push({
        id: `${bridgeTarget.orderId}-quote`,
        poId: bridgeTarget.orderId,
        author: 'vendor',
        authorLabel: acctMgrName,
        channel,
        kind: 'inbound-quote',
        text: `For ${ctx.rfq.id}: we can do Rp ${(quote.totalIdr / 1_000_000).toFixed(2)}M total with ${quote.leadTimeDays}d lead.${quote.note ? ` ${quote.note}` : ''} Confirm and I'll send the formal quote PDF.`,
        sentAt: quote.receivedAt,
      });
      // System notice when the admin authorised the PO.
      messages.push({
        id: `${bridgeTarget.orderId}-po-sent`,
        poId: bridgeTarget.orderId,
        author: 'admin',
        authorLabel: 'System',
        channel,
        kind: 'po-sent',
        text: `PO ${bridgeTarget.orderId} sent to ${supplierName}`,
        sentAt: new Date(new Date(quote.receivedAt).getTime() + 3 * 60_000).toISOString(),
      });
      // Vendor's dispatch confirmation if the order is at Stage 3+.
      const effStage = order ? Math.max(order.dagStage, forceCompletedStages[order.id] ?? 0) : 0;
      if (effStage >= 3) {
        messages.push({
          id: `${bridgeTarget.orderId}-dispatch`,
          poId: bridgeTarget.orderId,
          author: 'vendor',
          authorLabel: acctMgrName,
          channel,
          kind: 'dispatch-confirm',
          text: `Pak, sudah jalan. Truck dispatched. ETA holds at ${order?.eta ?? 'today'}. Will WhatsApp the unloading photo on arrival.`,
          sentAt: new Date(new Date(quote.receivedAt).getTime() + 6 * 3600_000).toISOString(),
        });
      }
    } else {
      // Non-RFQ PO — direct vendor pick. Seed a generic conversation
      // opener so the thread isn't visually empty on first open.
      messages.push({
        id: `${bridgeTarget.orderId}-opener`,
        poId: bridgeTarget.orderId,
        author: 'vendor',
        authorLabel: supplierName,
        channel: 'whatsapp',
        kind: 'reply',
        text: `Pak, PO ${bridgeTarget.orderId} diterima. Akan kami siapkan sesuai jadwal.`,
        sentAt: order?.createdAt ?? new Date().toISOString(),
      });
    }
    if (messages.length > 0) setThread(bridgeTarget.orderId, messages);
  }, [bridgeTarget?.orderId, bridgeQuoteContext, forceCompletedStages]);

  const bridgePanel = (() => {
    if (!bridgeTarget) return null;
    const channel = bridgeTarget.channel;
    const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'Email';
    const channelColor = channel === 'whatsapp' ? 'bg-[#25D366]' : 'bg-blue-600';
    const channelHover = channel === 'whatsapp' ? 'hover:bg-[#1ea952]' : 'hover:bg-blue-700';
    const channelText  = channel === 'whatsapp'
      ? isDark ? 'text-[#7dd9a4]' : 'text-[#1a8c47]'
      : isDark ? 'text-blue-300'  : 'text-blue-700';
    const thread = bridgeThread;
    const acctMgrName = bridgeQuoteContext?.runtime.quoteFrom?.split(' ·')[0] ?? bridgeTarget.supplier;
    return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`shrink-0 p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <button
            onClick={() => setBridgeTarget(null)}
            className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-[#f4f6f0] text-gray-400'}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <Lock className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
          <span className={`text-sm font-semibold ${t.textPrimary}`}>Source Bridge</span>
        </div>
        <p className={`text-xs ${t.textMuted} pl-7`}>
          {bridgeTarget.supplier} · {acctMgrName} · {bridgeTarget.orderId}
        </p>
      </div>

      {/* Channel selector — WhatsApp / Email (Bali rule: no Telegram). */}
      <div className={`shrink-0 px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        <div className={`flex rounded-lg border overflow-hidden ${isDark ? 'border-gray-700' : 'border-[#e5e5e0]'}`}>
          <button
            onClick={() => setBridgeTarget(b => b ? { ...b, channel: 'whatsapp' } : b)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold transition-colors ${
              channel === 'whatsapp'
                ? 'bg-[#25D366] text-white'
                : isDark ? 'bg-[#2a2a2a] text-gray-400 hover:bg-gray-800' : 'bg-white text-gray-500 hover:bg-[#f4f6f0]'
            }`}
          >
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </button>
          <div className={`w-px shrink-0 ${isDark ? 'bg-gray-700' : 'bg-[#e5e5e0]'}`} />
          <button
            onClick={() => setBridgeTarget(b => b ? { ...b, channel: 'email' } : b)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold transition-colors ${
              channel === 'email'
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-[#2a2a2a] text-gray-400 hover:bg-gray-800' : 'bg-white text-gray-500 hover:bg-[#f4f6f0]'
            }`}
          >
            <Send className="h-3 w-3" /> Email
          </button>
        </div>
      </div>

      {/* Thread — full conversation history. Scrolls independently. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {thread.length === 0 && (
          <p className={`text-[11px] text-center py-6 ${t.textMuted}`}>
            No prior messages with {bridgeTarget.supplier} on {bridgeTarget.orderId}.
            <br />Send the first message below.
          </p>
        )}
        {thread.map(msg => {
          const fromAdmin = msg.author === 'admin';
          const msgChannelLabel = msg.channel === 'whatsapp' ? 'WhatsApp' : 'Email';
          const initials = msg.authorLabel.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();
          const isInbound = msg.kind === 'inbound-quote';
          const isSystem  = msg.kind === 'po-sent';
          const timeLabel = new Date(msg.sentAt).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-semibold ${
                  isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                }`}>
                  {msg.text} · {timeLabel}
                </div>
              </div>
            );
          }
          return (
            <div key={msg.id} className={`flex items-start gap-2 ${fromAdmin ? 'flex-row-reverse' : ''}`}>
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                fromAdmin
                  ? isDark ? 'bg-[#87986a]/30 text-[#a3b085]' : 'bg-[#87986a]/20 text-[#6b7a54]'
                  : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700'
              }`}>
                {fromAdmin ? 'You' : initials}
              </div>
              <div className={`flex-1 min-w-0 ${fromAdmin ? 'flex flex-col items-end' : ''}`}>
                <div className={`max-w-[88%] p-2.5 rounded-lg text-[11px] leading-relaxed ${
                  fromAdmin
                    ? 'rounded-tr-sm ' + (isDark ? 'bg-[#87986a]/20 text-gray-100' : 'bg-[#f4f6f0] text-gray-800')
                    : 'rounded-tl-sm ' + (isDark ? 'bg-[#2a2a2a] text-gray-200' : 'bg-gray-100 text-gray-800')
                }`}>
                  {isInbound && (
                    <div className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${
                      isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                    }`}>
                      Quote · proof of source
                    </div>
                  )}
                  <p>{msg.text}</p>
                </div>
                <p className={`text-[9px] mt-1 ${t.textMuted} ${fromAdmin ? 'text-right' : ''}`}>
                  {msg.authorLabel} · via {msgChannelLabel} · {timeLabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose — pinned bottom. Sending appends to the thread; the
          panel stays open so the user can continue the conversation. */}
      <div className={`shrink-0 p-3 border-t space-y-2 ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        <textarea
          value={bridgeTarget.message}
          onChange={(e) => setBridgeTarget(b => b ? { ...b, message: e.target.value } : b)}
          placeholder={`Message ${bridgeTarget.supplier} via ${channelLabel}…`}
          rows={2}
          className={`w-full rounded-xl px-3 py-2 text-xs outline-none border resize-none leading-relaxed ${
            isDark
              ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500 focus:border-[#87986a]/50'
              : 'bg-white border-[#e5e5e0] placeholder:text-gray-400 focus:border-[#87986a]/50'
          }`}
        />
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-[#f4f6f0]'}`}>
          <Lock className={`h-2.5 w-2.5 shrink-0 ${channelText}`} />
          <p className={`text-[9px] ${t.textMuted}`}>
            Routed via Finn's Gateway → {channelLabel} · encrypted
          </p>
        </div>
        <button
          onClick={() => {
            const text = bridgeTarget.message.trim();
            if (!text) return;
            // Append to thread store + log action. Panel stays open.
            appendMessage({
              poId: bridgeTarget.orderId,
              author: 'admin',
              authorLabel: 'You',
              channel,
              kind: 'reply',
              text,
            });
            logUserAction({
              kind: 'po-message-supplier',
              entity: { type: 'po', id: bridgeTarget.orderId },
              summary: `Messaged ${bridgeTarget.supplier} re: ${bridgeTarget.orderId} via ${channelLabel} · ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
              details: text,
              meta: { channel, supplier: bridgeTarget.supplier },
            });
            setBridgeTarget(b => b ? { ...b, message: '' } : b);
            toast.success(`Sent via ${channelLabel}`, {
              description: `${acctMgrName} · ${bridgeTarget.supplier}`,
            });
          }}
          disabled={!bridgeTarget.message.trim()}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white ${channelColor} ${channelHover}`}
        >
          <Send className="h-3.5 w-3.5" />
          Send via {channelLabel}
        </button>
      </div>
    </div>
    );
  })();

  const rightPanel = bridgeTarget ? bridgePanel : (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
      <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <Sparkles className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#87986a]'}`} />
          <span className={`text-sm font-semibold ${t.textPrimary}`}>Atlas</span>
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
        <p className={`text-xs ${t.textMuted}`}>
          {isBatch       ? `Batch analysis · ${selectedIds.size} orders` :
           selectedOrder ? `${selectedOrder.agentAgent} · ${selectedOrder.id}` :
                           'Logistics intelligence · Live'}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── Agent Active · Immutable Record viewer ──
            Fires when the user opens a completed-stage trace modal while
            the order is still under Agent Active mode. Tells the Admin
            why nothing here is editable and how to unlock. */}
        {selectedOrder && openStage?.orderId === selectedOrder.id
          && getMode(selectedOrder.id) === 'auto'
          && openStage.stageIdx < effectiveStage(selectedOrder)
          && !isBatch && (
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/10 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lock className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                  Immutable Record · Stage {openStage.stageIdx + 1}
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed ${t.textPrimary}`}>
                You are viewing an immutable record of an autonomous action.
                To modify this data, switch to Manual Takeover.
              </p>
              <button
                onClick={() => setMode(selectedOrder.id, 'manual')}
                className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                <Hand className="h-2.5 w-2.5" /> Switch to Manual Takeover
              </button>
            </div>
          </div>
        )}

        {/* ── Manual Takeover · Atlas Copilot Mode ── */}
        {selectedOrder && getMode(selectedOrder.id) === 'manual' && !isBatch && (() => {
          const order = selectedOrder;
          const stage = effectiveStage(order);
          const touched = manualStageData[order.id]
            ? Object.keys(manualStageData[order.id]).map(Number).sort((a, b) => a - b)
            : [];
          // Stage-aware suggestion: spotlight either the open stage or the next live stage.
          const focusIdx = openStage?.orderId === order.id ? openStage.stageIdx : stage;
          const focusModule = TASK_MODULES[focusIdx];
          const focusDag = DAG_STAGES[focusIdx];
          return (
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            {/* Standby header */}
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#2a2a2a] border-amber-500/20' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                  <PauseCircle className="h-3 w-3 text-white" />
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold ${t.textPrimary}`}>Manual Takeover Active · Copilot Mode</p>
                  <p className={`text-[10px] mt-0.5 leading-relaxed ${t.textMuted}`}>
                    I am standing by. {agentLabel(order.assignedAgent)} suspended. Ask me for data to help you resolve this.
                  </p>
                  <button
                    onClick={() => setMode(order.id, 'auto')}
                    className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${isDark ? 'text-[#a3b085] hover:text-white' : 'text-[#6b7a54] hover:text-[#4a5a3a]'}`}
                  >
                    <PlayCircle className="h-2.5 w-2.5" /> Resume Auto →
                  </button>
                </div>
              </div>
            </div>

            {/* Copilot stage-aware hint — explicit "I noticed you're handling Stage X" */}
            <div className={`mt-3 p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                  Copilot Suggestion
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed ${t.textPrimary}`}>
                I noticed you're handling Stage {focusIdx + 1} ({focusDag.label}). {focusModule.copilotHint}
              </p>
              {openStage?.orderId !== order.id && (
                <button
                  onClick={() => openStageModule(order.id, focusIdx)}
                  className={`mt-2 inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${isDark ? 'text-amber-300 hover:text-amber-200' : 'text-amber-700 hover:text-amber-800'}`}
                >
                  Open Stage {focusIdx + 1} task module <ArrowRight className="h-2.5 w-2.5" />
                </button>
              )}
            </div>

            {/* Touched-stages audit trail */}
            {touched.length > 0 && (
              <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-[#f4f6f0]'}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <User className={`h-3 w-3 ${t.textMuted}`} />
                  <span className={`text-[9px] font-semibold uppercase tracking-wide ${t.textMuted}`}>
                    Manual Audit Trail · {touched.length} stage{touched.length === 1 ? '' : 's'} touched
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {touched.map(s => (
                    <button key={s}
                      onClick={() => openStageModule(order.id, s)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${isDark ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>
                      <Edit3 className="h-2 w-2" /> Stage {s + 1} · {DAG_STAGES[s].label}
                    </button>
                  ))}
                </div>
                <p className={`text-[9px] mt-2 ${t.textMuted}`}>
                  These will be synced when you Resume Auto — I will not redo or re-verify them.
                </p>
              </div>
            )}
          </div>
          );
        })()}

        {/* ── Digital Twin Peek (new supplier) ── */}
        {selectedOrder?.isNewSupplier && selectedOrder.digitalTwin && !isBatch && (
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Gauge className={`h-3.5 w-3.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
              <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>DIGITAL TWIN SIMULATION</span>
            </div>
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-purple-500/5 border-purple-500/20' : 'bg-purple-50 border-purple-200'}`}>
              <p className={`text-xs leading-relaxed ${t.textPrimary} mb-2`}>{selectedOrder.digitalTwin.recommendation}</p>
              <div className="flex gap-3">
                <div>
                  <span className={`text-xs font-bold ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>{selectedOrder.digitalTwin.switchSaving}</span>
                  <p className={`text-[9px] ${t.textMuted}`}>cost reduction</p>
                </div>
                <div>
                  <span className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{selectedOrder.digitalTwin.leadTimeDelta}</span>
                  <p className={`text-[9px] ${t.textMuted}`}>lead time change</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Single: Quote source · Bali channel context (Phase 4h.3) ── */}
        {selectedOrder && !isBatch && (() => {
          const runtime = runtimePOById.get(selectedOrder.id);
          if (!runtime || runtime.quoteChannel === 'none' || !runtime.quoteFrom) return null;
          const channelLabel = runtime.quoteChannel === 'whatsapp' ? 'WhatsApp' : 'Email';
          const received = runtime.quoteReceivedAt
            ? new Date(runtime.quoteReceivedAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
            : null;
          const channelTone = runtime.quoteChannel === 'whatsapp'
            ? isDark ? 'text-[#a3b085]' : 'text-[#25D366]'
            : isDark ? 'text-blue-300' : 'text-blue-700';
          return (
            <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className={`h-3.5 w-3.5 ${channelTone}`} />
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${channelTone}`}>
                  Quote received via {channelLabel}
                </span>
              </div>
              <div className={`p-3 rounded-lg border ${
                isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-[11px] font-semibold ${t.textPrimary}`}>{runtime.quoteFrom}</p>
                {received && (
                  <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>{received}</p>
                )}
                {runtime.fromRfqId && (
                  <p className={`text-[10px] mt-1 ${t.textMuted}`}>
                    Awarded from <span className={`font-semibold ${t.textPrimary}`}>{runtime.fromRfqId}</span>
                    {' '}· vendor's reply is the source of truth — no portal handshake exists for this seller.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Single: Agent reasoning (mode-aware via AgentCTA).
            forceMode reflects this specific PO's labor switch so the
            card respects the per-entity setting, not the system default. */}
        {selectedOrder && !isBatch && (
          <AgentCTA
            isDark={isDark}
            forceMode={getMode(selectedOrder.id)}
            className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}
            agentLabel={selectedOrder.agentAgent}
            reasoning={selectedOrder.agentReasoning}
            autoExecutionNote={
              selectedOrder.actionKind === 'approve'
                ? `${selectedOrder.agentAgent} drafted this and is waiting for your approval — above the auto-execute cap.`
                : `${selectedOrder.agentAgent} is driving this stage in Auto.`
            }
          />
        )}

        {/* ── Single: Manual notes (Phase 4l) ── */}
        {selectedOrder && !isBatch && (
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <ManualNotes
              isDark={isDark}
              type="po"
              id={selectedOrder.id}
              entityLabel={`${selectedOrder.id} · ${selectedOrder.supplier}`}
            />
          </div>
        )}

        {/* ── Single: Embedded Finance ── */}
        {selectedOrder?.financeInsight && !isBatch && (
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className={`h-3.5 w-3.5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>EMBEDDED FINANCE</span>
            </div>
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-green-500/5 border-green-500/15' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-green-400' : 'text-green-700'}`}>A-04 (Finance)</p>
              <p className={`text-xs leading-relaxed ${t.textPrimary} mb-2`}>{selectedOrder.financeInsight}</p>
              <button className={`text-[10px] font-semibold flex items-center gap-1 ${isDark ? 'text-green-400 hover:text-green-300' : 'text-green-700 hover:text-green-800'}`}>
                Factor this invoice <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* ── Batch: Macro Intelligence (Rule of Three) ── */}
        {isBatch && (
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>BATCH LOGIC SUMMARY</span>
            </div>

            {/* Exactly 3 insights — Rule of Three */}
            <div className="space-y-2.5">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Cold-Chain Verified',
                  text: `All ${batchSummary.total} orders matched against cold-chain requirements. ${batchSummary.approve > 0 ? `${batchSummary.approve} orders` : 'All'} meet compliance thresholds.`,
                  color: isDark ? 'text-green-400' : 'text-green-600',
                },
                {
                  icon: DollarSign,
                  title: 'Pricing Confidence',
                  text: `Quotes validated against your 30-day market median. Aggregate saving on this batch: ${fmtIdrShort(batchSummary.savings)} vs. running these POs individually.`,
                  color: isDark ? 'text-blue-400' : 'text-blue-600',
                },
                {
                  icon: AlertTriangle,
                  title: batchSummary.resolve > 0 ? `${batchSummary.resolve} Exception(s) Flagged` : 'No Exceptions',
                  text: batchSummary.resolve > 0
                    ? `${batchSummary.resolve} order(s) require manual resolution before batch can fully clear. Remaining ${batchSummary.total - batchSummary.resolve} are safe to execute.`
                    : 'All orders passed validation. No manual intervention needed.',
                  color: batchSummary.resolve > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-green-400' : 'text-green-600'),
                },
              ].map(({ icon: Icon, title, text, color }) => (
                <div key={title} className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    <span className={`text-[10px] font-semibold ${t.textPrimary}`}>{title}</span>
                  </div>
                  <p className={`text-[10px] leading-snug ${t.textMuted}`}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch ROI */}
        {isBatch && (
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold ${t.sectionLabel}`}>BATCH ROI ESTIMATE</span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'Labor hours saved by batch', value: `~${batchSummary.hours}h`, isSaving: false },
                { label: 'Manual steps eliminated', value: `${batchSummary.total * 3}`, isSaving: false },
                { label: 'Projected savings', value: fmtIdrShort(batchSummary.savings), isSaving: true },
              ].map(({ label, value, isSaving }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className={`text-[10px] ${t.textMuted}`}>{label}</span>
                  <span className={`text-xs font-semibold ${isSaving ? 'text-green-400' : t.textPrimary}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Context questions — always 3 */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
          <h3 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>
            {isBatch ? 'BATCH INSIGHTS' : selectedOrder ? `INSIGHTS FOR ${selectedOrder.id}` : 'ASK ATLAS'}
          </h3>
          <div className="space-y-1.5">
            {contextQuestions.map((q, i) => (
              <button key={i}
                onClick={() => { setChatMessages((prev) => [...prev, { from: 'user', text: q }]); setTimeout(() => setChatMessages((prev) => [...prev, { from: 'atlas', text: "Analyzing now — recommendation coming shortly." }]), 800); }}
                className={`w-full text-left text-[10px] px-2.5 py-2 rounded-lg border transition-colors ${isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800 text-gray-300' : 'bg-white border-[#e5e5e0] hover:bg-[#f4f6f0] text-gray-700'}`}>
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat messages ── */}
        <div className="px-4 py-3 space-y-3">
          {chatMessages.map((msg, i) => (
            msg.from === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className={`max-w-[82%] px-3 py-2 rounded-2xl rounded-tr-sm text-[11px] leading-relaxed ${
                  isDark ? 'bg-[#87986a] text-white' : 'bg-[#6b7a54] text-white'
                }`}>{msg.text}</div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isDark ? 'bg-[#87986a]/20' : 'bg-[#f4f6f0]'
                }`}>
                  <Sparkles className={`h-2.5 w-2.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                </div>
                <div className={`max-w-[82%] px-3 py-2 rounded-2xl rounded-tl-sm text-[11px] leading-relaxed border ${
                  isDark ? 'bg-[#2a2a2a] border-gray-800 text-gray-300' : 'bg-[#f4f6f0] border-[#e5e5e0] text-gray-700'
                }`}>{msg.text}</div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Chat input — pinned bottom */}
      <div className={`shrink-0 px-3 pb-3 pt-2 border-t ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        <div className={`flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors ${
          isDark
            ? 'bg-[#2a2a2a] border-gray-700 focus-within:border-[#87986a]/50'
            : 'bg-white border-[#e5e5e0] focus-within:border-[#87986a]/60'
        }`}>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
            placeholder={isBatch ? 'Ask about this batch…' : 'Ask Atlas anything…'}
            rows={1}
            className={`flex-1 resize-none bg-transparent text-xs outline-none leading-relaxed min-h-[20px] max-h-[80px] overflow-y-auto ${
              isDark ? 'text-white placeholder:text-gray-500' : 'text-gray-800 placeholder:text-gray-400'
            }`}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={handleChat}
            disabled={!chatInput.trim()}
            className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all ${
              chatInput.trim()
                ? 'bg-[#87986a] hover:bg-[#6b7a54] text-white'
                : isDark ? 'bg-gray-800 text-gray-600' : 'bg-[#f4f6f0] text-gray-400'
            }`}
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
        <p className={`text-[9px] mt-1.5 text-center ${t.textMuted}`}>Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );

  // ── Task Module Sheet (manual-mode stage form) ─────────────────────
  const taskModuleSheet = (() => {
    if (!openStage) return null;
    const order = ORDERS.find(o => o.id === openStage.orderId);
    if (!order) return null;
    const stageIdx = openStage.stageIdx;
    const dag = DAG_STAGES[stageIdx];
    const mod = TASK_MODULES[stageIdx];
    const stage = effectiveStage(order);
    const isCompleted = stageIdx < stage;             // Historical record — Review Mode
    const reviewMode = isCompleted;
    const orderManualMode = getMode(order.id) === 'manual';
    const canEditFields = reviewMode && orderManualMode;
    const anyEditing = editingFields.size > 0;
    const status = stageIdx < stage ? 'Edit' : stageIdx === stage ? 'Execute' : 'Plan ahead';
    const set = (key: string, val: string) => {
      setStageDraft(prev => ({ ...prev, [key]: val }));
      // Clear validation error for this field once the user starts typing.
      if (validationErrors.includes(key) && val.trim()) {
        setValidationErrors(prev => prev.filter(k => k !== key));
      }
    };
    const delegated = isDelegated(order.id, stageIdx);
    // Delegation gate — every input listed in delegationDependsOn must be filled.
    // If no deps are declared, the delegation is always available.
    const delegationDeps = mod.delegationDependsOn ?? [];
    const delegationReady = delegationDeps.every(k => (stageDraft[k] ?? '').toString().trim().length > 0);
    const missingDepLabels = delegationDeps
      .filter(k => !((stageDraft[k] ?? '').toString().trim()))
      .map(k => mod.inputs.find(i => i.key === k)?.label ?? k);
    // Review-mode metadata
    const attribution = reviewMode ? getStageAttribution(order, stageIdx) : null;
    const auditSummary = reviewMode ? getAuditSummary(order, stageIdx) : '';
    const clearedAt = reviewMode ? getStageClearedAt(order.id, stageIdx) : '';
    const synth = reviewMode ? synthesizeStageHistory(order, stageIdx) : null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={closeStageModule}>
        <div
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            reviewMode
              ? isDark ? 'bg-[#1a1a1a] border-[#87986a]/40' : 'bg-white border-[#87986a]/40'
              : isDark ? 'bg-[#1a1a1a] border-amber-500/40' : 'bg-white border-amber-400/50'
          }`}
        >
          {/* Header — Manual Task (amber) vs Review Mode (sage) */}
          <div className={`px-5 py-4 border-b flex items-start gap-3 ${
            reviewMode
              ? isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'
              : isDark ? 'border-gray-800 bg-amber-500/8' : 'border-[#e5e5e0] bg-amber-50/60'
          }`}>
            <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-sm ${
              reviewMode ? 'bg-[#87986a]' : 'bg-amber-500'
            }`}>
              {reviewMode ? <Check className="h-4 w-4" /> : stageIdx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wide ${
                  reviewMode
                    ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                    : isDark ? 'text-amber-300' : 'text-amber-700'
                }`}>
                  {reviewMode ? 'History & Trace Record' : `${status} · Manual Task`}
                </span>
                <span className={`text-[10px] ${t.textMuted}`}>{order.id} · Stage {stageIdx + 1}/5</span>
                {/* Attribution badge (Review only) */}
                {reviewMode && attribution && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    attribution.kind === 'admin'
                      ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                      : isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                  }`}>
                    {attribution.kind === 'admin' ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                    {attribution.label}
                  </span>
                )}
                {delegated && !reviewMode && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-green-500/15 text-green-500">
                    <Sparkles className="h-2.5 w-2.5" /> Atlas-delegated
                  </span>
                )}
              </div>
              <h3 className={`text-sm font-bold mt-0.5 ${t.textPrimary}`}>{dag.label}</h3>
              <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>
                {reviewMode ? `Cleared at ${clearedAt}` : mod.action}
              </p>
            </div>
            <button onClick={closeStageModule}
              className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-[#f4f6f0] text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ═══ Copilot Hint — Active Handshake (Input Mode) ═══
              In Review Mode this slot becomes Audit Summary + read-only
              banner + Paper Trail panel (Trigger / Proof / Verified-at). */}
          {reviewMode ? (
            <>
              {/* Atlas Audit Summary (the "Logic" line of the Paper Trail) */}
              <div className={`px-5 py-3 border-b ${isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'}`}>
                <div className="flex items-start gap-2">
                  <Sparkles className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                  <div className="min-w-0">
                    <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                      Atlas · Audit Summary (Logic)
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textPrimary}`}>{auditSummary}</p>
                  </div>
                </div>
              </div>

              {/* Read-only banner — only in Agent Active mode */}
              {!orderManualMode && (
                <div className={`px-5 py-2.5 border-b flex items-center gap-2 ${isDark ? 'border-gray-800 bg-[#1f2a1f]' : 'border-[#e5e5e0] bg-[#f0f4e8]'}`}>
                  <Lock className={`h-3 w-3 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                  <span className={`text-[10px] font-semibold ${t.textPrimary}`}>Immutable record.</span>
                  <span className={`text-[10px] ${t.textMuted}`}>
                    Switch to Manual Takeover to correct any data point.
                  </span>
                </div>
              )}

              {/* Paper Trail — Trigger / Proof / Verified at */}
              {synth && (
                <div className={`px-5 py-3 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
                  <div className={`text-[9px] font-bold uppercase tracking-wide mb-2 ${t.textMuted}`}>Paper Trail</div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-start gap-2">
                      <Zap className={`h-3 w-3 shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                      <div className="min-w-0">
                        <span className={`font-semibold ${t.textPrimary}`}>Trigger:</span>{' '}
                        <span className={t.textSecondary}>{synth.trigger}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ShieldCheck className={`h-3 w-3 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                      <div className="min-w-0">
                        <span className={`font-semibold ${t.textPrimary}`}>Proof:</span>{' '}
                        <span className={t.textSecondary}>{synth.proof}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className={`h-3 w-3 shrink-0 mt-0.5 ${t.textMuted}`} />
                      <div className="min-w-0">
                        <span className={`font-semibold ${t.textPrimary}`}>Verified at:</span>{' '}
                        <span className={t.textSecondary}>{clearedAt} · API timestamp</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
          <div className={`px-5 py-3 border-b transition-colors ${
            delegated
              ? isDark ? 'border-gray-800 bg-green-500/10' : 'border-[#e5e5e0] bg-green-50'
              : isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'
          }`}>
            <div className="flex items-start gap-2">
              {delegated
                ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
                : <Sparkles className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />}
              <div className="min-w-0 flex-1">
                <div className={`text-[9px] font-bold uppercase tracking-wide ${
                  delegated ? 'text-green-500' : isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                }`}>
                  {delegated ? 'Atlas · Sub-task Active' : 'Atlas · Copilot Hint'}
                </div>
                <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textPrimary}`}>
                  {delegated ? mod.delegationLockedCopy : mod.copilotHint}
                </p>
                {delegated ? (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-500">
                      <CheckCircle className="h-3 w-3" /> You will be alerted on updates.
                    </span>
                    <button
                      onClick={() => toggleDelegation(order.id, stageIdx)}
                      className={`ml-auto inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      <X className="h-2.5 w-2.5" /> Release back to me
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => toggleDelegation(order.id, stageIdx)}
                      disabled={!delegationReady}
                      title={delegationReady
                        ? `Hand this sub-task to Atlas — even though ${order.id} is in Manual Mode`
                        : `Fill ${missingDepLabels.join(' & ')} first to enable delegation`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        delegationReady
                          ? isDark ? 'bg-[#87986a]/30 border border-[#87986a]/50 text-[#a3b085] hover:bg-[#87986a]/40' : 'bg-[#87986a]/15 border border-[#87986a]/40 text-[#6b7a54] hover:bg-[#87986a]/25'
                          : isDark ? 'bg-gray-800 border border-gray-700 text-gray-600 cursor-not-allowed opacity-60' : 'bg-[#f4f6f0] border border-[#e5e5e0] text-gray-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Zap className="h-3 w-3" /> {mod.delegationLabel}
                    </button>
                    {!delegationReady && missingDepLabels.length > 0 && (
                      <span className={`text-[9px] ${t.textMuted}`}>
                        Needs: {missingDepLabels.join(' · ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* 6p — RFQ pre-fill banner. When Stage 1 (Quote/Vendor
              Confirmed) is opened on a PO that was minted from an RFQ
              award, the inputs are auto-populated from the wizard's
              runtime data. This banner makes the source explicit so
              the user knows they're reviewing, not retyping. */}
          {!reviewMode && stageIdx === 1 && (() => {
            const runtime = runtimePOById.get(order.id);
            if (!runtime?.fromRfqId) return null;
            return (
              <div className={`px-5 py-3 border-b ${isDark ? 'bg-[#87986a]/8 border-gray-800' : 'bg-[#f4f6f0] border-[#e5e5e0]'}`}>
                <div className="flex items-start gap-2">
                  <Sparkles className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                  <div className="min-w-0">
                    <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                      Pre-filled from {runtime.fromRfqId}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textPrimary}`}>
                      Channel, lead time, and quote amount came in with the vendor's reply on the wizard award.
                      Review and click <strong>Review &amp; Authorize PO</strong> to send to {runtime.supplier}.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ═══ Form fields — Input Mode renders the editable controls.
              Review Mode renders Verified Data labels; in Manual Mode each
              row exposes a per-field Edit pencil that flips just that field
              back to Input Mode for correction. */}
          <div className={`flex-1 min-h-0 overflow-y-auto p-5 space-y-4 ${
            delegated && !reviewMode ? 'opacity-60 pointer-events-none' : ''
          }`}>
            {mod.inputs.map(input => {
              const val = stageDraft[input.key] ?? '';
              const hasError = validationErrors.includes(input.key);
              const isFieldEditing = editingFields.has(input.key);
              const showAsInput = !reviewMode || isFieldEditing;

              // Per-field attribution (Review Mode only).
              const fieldAttr = reviewMode ? getFieldAttribution(order, stageIdx, input.key) : null;
              const labelEl = (
                <label className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 ${hasError ? 'text-red-500' : t.textPrimary}`}>
                  {input.label}
                  {input.required && !reviewMode && <span className="text-red-400">*</span>}
                  {/* Per-field attribution chip — Review Mode only */}
                  {fieldAttr && !isFieldEditing && (
                    <span className={`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-bold ${
                      fieldAttr.kind === 'admin'
                        ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                        : isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                    }`}
                      title={fieldAttr.label}>
                      {fieldAttr.kind === 'admin' ? <User className="h-2 w-2" /> : <Bot className="h-2 w-2" />}
                      {fieldAttr.kind === 'admin' ? 'Admin' : `#${String(order.assignedAgent.id).padStart(2, '0')}`}
                    </span>
                  )}
                  {hasError && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold text-red-500">
                      <AlertTriangle className="h-2.5 w-2.5" /> Required
                    </span>
                  )}
                  {/* Per-field Edit hook — Manual Mode only, Review only */}
                  {canEditFields && !isFieldEditing && (
                    <button
                      onClick={() => {
                        // Seed draft with the synthesized value if no manual entry exists,
                        // so the input control opens with the current visible value.
                        const existing = stageDraft[input.key] ?? manualStageData[order.id]?.[stageIdx]?.[input.key] ?? '';
                        if (!existing) {
                          const seeded = getFieldDisplayValue(order, stageIdx, input.key);
                          setStageDraft(prev => ({ ...prev, [input.key]: seeded }));
                        }
                        setEditingFields(prev => new Set(prev).add(input.key));
                      }}
                      title={`Edit ${input.label}`}
                      className={`ml-auto inline-flex items-center gap-1 text-[9px] font-semibold transition-colors ${isDark ? 'text-amber-300 hover:text-amber-200' : 'text-amber-700 hover:text-amber-800'}`}
                    >
                      <Pencil className="h-2.5 w-2.5" /> Edit
                    </button>
                  )}
                  {canEditFields && isFieldEditing && (
                    <button
                      onClick={() => {
                        // Cancel field edit — restore the saved value
                        const saved = manualStageData[order.id]?.[stageIdx]?.[input.key] ?? '';
                        setStageDraft(prev => ({ ...prev, [input.key]: saved }));
                        setEditingFields(prev => {
                          const next = new Set(prev);
                          next.delete(input.key);
                          return next;
                        });
                      }}
                      className={`ml-auto inline-flex items-center gap-1 text-[9px] font-semibold transition-colors ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                      <X className="h-2.5 w-2.5" /> Cancel field
                    </button>
                  )}
                </label>
              );
              const errorBorder = hasError
                ? 'border-red-500/60 ring-1 ring-red-500/30 focus:border-red-500'
                : 'border-gray-700 focus:border-amber-500/50';
              const errorBorderLight = hasError
                ? 'border-red-500/60 ring-1 ring-red-500/20 focus:border-red-500'
                : 'border-[#e5e5e0] focus:border-amber-500/50';
              const helpLine = hasError && input.fortressLookup ? (
                <p className={`mt-1 text-[10px] ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                  <Sparkles className="inline h-2.5 w-2.5 mr-0.5" />
                  Atlas can pull this from the internal directory ({input.fortressLookup}).
                </p>
              ) : null;

              // ═══ REVIEW MODE — Verified Data display ═══
              // Always falls back to synthesized data so we never show
              // "Not Captured" for an autonomously-completed stage.
              if (!showAsInput) {
                const isFile = input.kind === 'file';
                const displayValue = getFieldDisplayValue(order, stageIdx, input.key);
                return (
                  <div key={input.key}>
                    {labelEl}
                    {isFile ? (
                      <a
                        onClick={(e) => e.preventDefault()}
                        href="#"
                        title={`View / download ${displayValue}`}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                          isDark ? 'bg-[#87986a]/10 border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/20'
                                : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54] hover:bg-[#e8eddf]'
                        }`}
                      >
                        <FileUp className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{displayValue}</span>
                        <ExternalLink className="h-2.5 w-2.5 ml-1 opacity-70" />
                      </a>
                    ) : (
                      <div className={`px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-[#2a2a2a] text-white' : 'bg-[#f4f6f0] text-gray-900'}`}>
                        {displayValue}
                      </div>
                    )}
                  </div>
                );
              }

              // ═══ INPUT MODE — editable controls ═══
              if (input.kind === 'text' || input.kind === 'date') {
                return (
                  <div key={input.key}>
                    {labelEl}
                    <input
                      type={input.kind === 'date' ? 'datetime-local' : 'text'}
                      value={val}
                      onChange={(e) => set(input.key, e.target.value)}
                      placeholder={input.placeholder}
                      className={`w-full rounded-lg px-3 py-2 text-xs outline-none border ${
                        isDark ? `bg-[#2a2a2a] text-white placeholder:text-gray-500 ${errorBorder}` : `bg-white placeholder:text-gray-400 ${errorBorderLight}`
                      }`}
                    />
                    {helpLine}
                  </div>
                );
              }
              if (input.kind === 'textarea') {
                return (
                  <div key={input.key}>
                    {labelEl}
                    <textarea
                      value={val}
                      onChange={(e) => set(input.key, e.target.value)}
                      placeholder={input.placeholder}
                      rows={3}
                      className={`w-full rounded-lg px-3 py-2 text-xs outline-none border resize-none ${
                        isDark ? `bg-[#2a2a2a] text-white placeholder:text-gray-500 ${errorBorder}` : `bg-white placeholder:text-gray-400 ${errorBorderLight}`
                      }`}
                    />
                    {helpLine}
                  </div>
                );
              }
              if (input.kind === 'select') {
                return (
                  <div key={input.key}>
                    {labelEl}
                    <div className={`flex flex-wrap gap-1.5 ${hasError ? 'p-2 rounded-lg ring-1 ring-red-500/30 bg-red-500/5' : ''}`}>
                      {input.options!.map(opt => {
                        const active = val === opt;
                        return (
                          <button key={opt} onClick={() => set(input.key, opt)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                              active
                                ? 'bg-amber-500 border-amber-500 text-white'
                                : isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:border-gray-600' : 'bg-white border-[#e5e5e0] text-gray-600 hover:border-[#87986a]/30'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {helpLine}
                  </div>
                );
              }
              // file
              return (
                <div key={input.key}>
                  {labelEl}
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                    val
                      ? isDark ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-400/50 text-amber-800'
                      : hasError
                        ? isDark ? 'bg-red-500/5 border-red-500/60 text-red-300 ring-1 ring-red-500/30' : 'bg-red-50/50 border-red-500/60 text-red-700 ring-1 ring-red-500/20'
                        : isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:border-gray-600' : 'bg-white border-[#e5e5e0] text-gray-600 hover:border-[#87986a]/30'
                  }`}>
                    <FileUp className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{val || `Click to upload (${input.accept ?? 'any'})`}</span>
                    <input type="file" accept={input.accept} className="hidden"
                      onChange={(e) => set(input.key, e.target.files?.[0]?.name ?? '')} />
                  </label>
                  {helpLine}
                </div>
              );
            })}
          </div>

          {/* Footer actions — Review vs Input. */}
          <div className={`shrink-0 px-5 py-3 border-t flex items-center gap-2 ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            {reviewMode ? (
              anyEditing ? (
                <>
                  <button onClick={closeStageModule}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-[#f4f6f0]'}`}>
                    Cancel
                  </button>
                  <span className={`text-[10px] ${t.textMuted}`}>{editingFields.size} field{editingFields.size === 1 ? '' : 's'} being edited</span>
                  <button onClick={() => saveStageModule(false)}
                    className="ml-auto px-3 py-2 rounded-lg text-xs font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="h-3 w-3" /> Save Edits
                  </button>
                </>
              ) : (
                <>
                  {/* Re-order — only on Stage 5 (Delivered & Checked) Review Mode */}
                  {stageIdx === 4 && (
                    <button
                      onClick={() => {
                        closeStageModule();
                        // Express deep-link → New Request "Carbon Copy" mode (lands on Step 6).
                        if (typeof window !== 'undefined') {
                          const params = new URLSearchParams({
                            intent: 'express', mode: 'reorder',
                            from: order.id,
                            vendor: order.supplier,
                            items: order.items.join(', '),
                          });
                          window.location.hash = params.toString();
                        }
                        onNavigate?.('request');
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                        isDark ? 'border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#87986a]/40 text-[#6b7a54] hover:bg-[#f4f6f0]'
                      }`}
                    >
                      <RefreshCw className="h-3 w-3" /> Re-order This PO
                    </button>
                  )}
                  <button onClick={closeStageModule}
                    className="ml-auto px-4 py-2 rounded-lg text-xs font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors inline-flex items-center gap-1.5 shadow-sm">
                    <Check className="h-3 w-3" /> Done
                  </button>
                </>
              )
            ) : (
              <>
                <button onClick={closeStageModule}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-[#f4f6f0]'}`}>
                  Cancel
                </button>
                <button onClick={() => saveStageModule(false)}
                  className={`ml-auto px-3 py-2 rounded-lg text-xs font-semibold border ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-[#e5e5e0] text-gray-700 hover:bg-[#f4f6f0]'}`}>
                  Save Draft
                </button>
                <button onClick={() => saveStageModule(true)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors inline-flex items-center gap-1.5 shadow-sm ${
                    requiresHumanAuthorization(stageIdx) && status === 'Execute'
                      ? 'bg-[#87986a] hover:bg-[#6b7a54]'  // sage = HITL judgment
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  {requiresHumanAuthorization(stageIdx) && status === 'Execute'
                    ? <ShieldCheck className="h-3 w-3" />
                    : <Check className="h-3 w-3" />}
                  {status === 'Execute'
                    ? requiresHumanAuthorization(stageIdx)
                      ? stageIdx === 1 ? 'Review & Authorize PO' : 'Review & Authorize Delivery'
                      : 'Mark Stage Complete'
                    : 'Save & Pre-stage'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  })();

  // ── Draft Sheet · New Order / Re-order / Schedule ─────────────
  const draftSheetEl = (() => {
    if (!draftSheet) return null;
    const isReorder = draftSheet.kind === 'reorder';
    const sourceOrder = isReorder ? ORDERS.find(o => o.id === draftSheet.sourceOrderId) : null;
    const supplierOptions = Array.from(new Set(ORDERS.map(o => o.supplier))).sort();
    const agentOptions = Array.from(
      new Map(ORDERS.map(o => [o.assignedAgent.id, o.assignedAgent])).values()
    );
    const itemCount = draft.items.split('\n').filter(s => s.trim()).length;
    const canSubmit = !!draft.supplier.trim() && itemCount > 0;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={closeDraftSheet}>
        <div onClick={e => e.stopPropagation()}
          className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-[#1a1a1a] border-[#87986a]/40' : 'bg-white border-[#87986a]/40'}`}>
          {/* Header */}
          <div className={`px-5 py-4 border-b flex items-start gap-3 ${isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'}`}>
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-[#87986a] text-white">
              {isReorder ? <RefreshCw className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                {isReorder ? `Re-order · From ${sourceOrder?.id ?? ''}` : 'New Order · Manual Discovery Portal'}
              </div>
              <h3 className={`text-sm font-bold mt-0.5 ${t.textPrimary}`}>
                {isReorder ? `Repeat ${sourceOrder?.supplier ?? ''}` : 'Draft a new purchase order'}
              </h3>
              <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>
                {isReorder
                  ? 'Pre-filled with the same items and vendor — assign an agent or take over manually.'
                  : 'Within your approved directory · pick a vetted vendor and assign labor.'}
              </p>
            </div>
            <button onClick={closeDraftSheet} className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-[#f4f6f0] text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {/* Vendor */}
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 ${t.textPrimary}`}>Vendor (vetted directory)</label>
              <div className="flex flex-wrap gap-1.5">
                {supplierOptions.map(s => {
                  const active = draft.supplier === s;
                  return (
                    <button key={s} onClick={() => setDraft(d => ({ ...d, supplier: s }))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                        active
                          ? 'bg-[#87986a] border-[#87986a] text-white'
                          : isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-300 hover:border-gray-600' : 'bg-white border-[#e5e5e0] text-gray-700 hover:border-[#87986a]/30'
                      }`}
                    >
                      <ShieldCheck className="h-2.5 w-2.5" />
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Items */}
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 ${t.textPrimary}`}>
                Items {itemCount > 0 && <span className={`ml-1 text-[9px] font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>· {itemCount}</span>}
              </label>
              <textarea
                value={draft.items}
                onChange={e => setDraft(d => ({ ...d, items: e.target.value }))}
                placeholder={"One per line, e.g.\nLamb Rack 20kg\nChicken Breast 50kg"}
                rows={4}
                className={`w-full rounded-lg px-3 py-2 text-xs outline-none border resize-none ${
                  isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500 focus:border-[#87986a]/50'
                        : 'bg-white border-[#e5e5e0] placeholder:text-gray-400 focus:border-[#87986a]/50'
                }`}
              />
            </div>

            {/* Recurring */}
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-[#f4f6f0] border-[#e5e5e0]'}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.recurring}
                  onChange={e => setDraft(d => ({ ...d, recurring: e.target.checked }))}
                  className="mt-0.5 accent-[#87986a]"
                />
                <div className="min-w-0">
                  <div className={`text-[11px] font-semibold ${t.textPrimary} flex items-center gap-1.5`}>
                    <Repeat className="h-3 w-3" /> Make this a recurring scheduled order
                  </div>
                  <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>
                    The assigned agent will draft the PO automatically each cycle for your authorization.
                  </p>
                </div>
              </label>
              {draft.recurring && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold ${t.textMuted}`}>Frequency:</span>
                  {(['weekly', 'monthly'] as const).map(f => (
                    <button key={f} onClick={() => setDraft(d => ({ ...d, frequency: f }))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                        draft.frequency === f
                          ? 'bg-[#87986a] border-[#87986a] text-white'
                          : isDark ? 'bg-[#1a1a1a] border-gray-700 text-gray-300' : 'bg-white border-[#e5e5e0] text-gray-700'
                      }`}
                    >
                      <Calendar className="h-2.5 w-2.5" /> {f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assignment */}
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 ${t.textPrimary}`}>Assignment</label>
              <div className={`grid grid-cols-2 gap-2`}>
                <button onClick={() => setDraft(d => ({ ...d, assignment: 'auto' }))}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    draft.assignment === 'auto'
                      ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/50 ring-1 ring-[#87986a]/30' : 'bg-[#f4f6f0] border-[#87986a]/50 ring-1 ring-[#87986a]/30'
                      : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:border-gray-700' : 'bg-white border-[#e5e5e0] hover:border-[#87986a]/30'
                  }`}>
                  <div className="flex items-center gap-1.5">
                    <Bot className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                    <span className={`text-[11px] font-bold ${t.textPrimary}`}>Assign to Agent</span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Autonomous execution from PO Approval onward.</p>
                </button>
                <button onClick={() => setDraft(d => ({ ...d, assignment: 'manual' }))}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    draft.assignment === 'manual'
                      ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                      : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:border-gray-700' : 'bg-white border-[#e5e5e0] hover:border-[#87986a]/30'
                  }`}>
                  <div className="flex items-center gap-1.5">
                    <Hand className="h-3.5 w-3.5 text-amber-500" />
                    <span className={`text-[11px] font-bold ${t.textPrimary}`}>Handle Manually</span>
                  </div>
                  <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>You drive every stage from the start.</p>
                </button>
              </div>
              {draft.assignment === 'auto' && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold ${t.textMuted}`}>Agent:</span>
                  {agentOptions.map(a => (
                    <button key={a.id} onClick={() => setDraft(d => ({ ...d, agentId: a.id }))}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-colors ${
                        draft.agentId === a.id
                          ? 'bg-[#87986a] border-[#87986a] text-white'
                          : isDark ? 'bg-[#1a1a1a] border-gray-700 text-gray-400' : 'bg-white border-[#e5e5e0] text-gray-600'
                      }`}>
                      <Bot className="h-2.5 w-2.5" /> #{String(a.id).padStart(2, '0')} · {a.role}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* HITL gate hint */}
            <div className={`p-3 rounded-lg border flex items-start gap-2 ${isDark ? 'bg-[#1f2a1f] border-[#87986a]/30' : 'bg-[#f0f4e8] border-[#87986a]/30'}`}>
              <ShieldCheck className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <p className={`text-[10px] leading-relaxed ${t.textPrimary}`}>
                Stage 1 (Request) and Stage 5 (Delivered &amp; Checked) always require <strong>your</strong> Review &amp; Authorize — even when an agent is driving.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className={`shrink-0 px-5 py-3 border-t flex items-center gap-2 ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <button onClick={closeDraftSheet}
              className={`px-3 py-2 rounded-lg text-xs font-semibold ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-[#f4f6f0]'}`}>
              Cancel
            </button>
            <button onClick={submitDraft} disabled={!canSubmit}
              className={`ml-auto px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm ${
                canSubmit
                  ? 'bg-[#87986a] text-white hover:bg-[#6b7a54]'
                  : isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-[#f4f6f0] text-gray-400 cursor-not-allowed'
              }`}>
              {draft.recurring ? <Calendar className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {draft.recurring ? `Schedule ${draft.frequency} PO` : (isReorder ? 'Create Re-order Draft' : 'Create PO Draft')}
            </button>
          </div>
        </div>
      </div>
    );
  })();


  // Theme tokens for the audit-aware panel shell
  const panelBorder = isDark ? 'border-gray-800' : 'border-[#e5e5e0]';
  const panelBg     = isDark ? 'bg-[#1a1a1a]'    : 'bg-white';

  return (
    <>
      {/* Three-panel layout — left expands to full width in Audit Mode
          while the center collapses (matches Inventory + Suppliers). */}
      <div className="flex h-full min-h-0 overflow-hidden">
        {/* Left — 280px in Triage, full width in Audit */}
        <div className={`h-full border-r ${panelBorder} ${panelBg} overflow-hidden transition-all duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
          style={{ flex: auditMode ? '1 1 0%' : '0 0 280px' }}>
          {auditMode ? auditLeftPanel : leftPanel}
        </div>

        {/* Center — collapses to 0 in Audit Mode */}
        <div className="h-full min-h-0 overflow-y-auto transition-all duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ flex: auditMode ? '0 0 0px' : '1 1 0%', opacity: auditMode ? 0 : 1, overflow: auditMode ? 'hidden' : undefined }}>
          {centerPanel}
        </div>

        {/* Right — always 280px; content swaps to Insights in Audit Mode */}
        <div className={`w-[280px] shrink-0 flex flex-col min-h-0 overflow-hidden border-l ${panelBorder} ${panelBg}`}>
          {auditMode ? auditRightPanel : rightPanel}
        </div>
      </div>

      {/* Manual-mode Task Module sheet (5-stage interactive task list) */}
      {taskModuleSheet}

      {/* 6s — Approval Confirmation modal. Auto + Stage 1 gate fired
          (cap rule active + above threshold). One-screen review of
          quote + policy posture + sign-off. Confirm fires the standard
          executeAction; cancel just closes. */}
      {approvalForId && (() => {
        const order = ORDERS.find(o => o.id === approvalForId);
        if (!order) return null;
        const cap = activeSpendCapRule();
        const overBy = cap ? Math.max(0, order.amount - cap.threshold) : 0;
        const eff = Math.max(order.dagStage, forceCompletedStages[order.id] ?? 0);
        // Live quote info from the agent's Stage 1 write (or synthesizer fallback).
        const channel = getFieldDisplayValue(order, 1, 'channel') || (order.agentReasoning.toLowerCase().includes('whatsapp') ? 'WhatsApp' : 'Email');
        const leadTime = getFieldDisplayValue(order, 1, 'lead_time');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
               style={{ background: 'rgba(0,0,0,0.55)' }}
               onClick={() => setApprovalForId(null)}>
            <div onClick={(e) => e.stopPropagation()}
                 className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-[#1a1a1a] border-[#87986a]/40' : 'bg-white border-[#87986a]/40'}`}>
              {/* Header */}
              <div className={`px-5 py-4 border-b flex items-start gap-3 ${isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'}`}>
                <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-[#87986a] text-white">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                    Sign off · Stage 1 → 2 (PO Approved)
                  </div>
                  <h3 className={`text-sm font-bold mt-0.5 ${t.textPrimary}`}>{order.id} · {order.supplier}</h3>
                  <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>{fmtIdrShort(order.amount)} · {order.eta}</p>
                </div>
                <button onClick={() => setApprovalForId(null)}
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-[#f4f6f0] text-gray-500'}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body — quote details + policy preview */}
              <div className="p-5 space-y-4">
                {/* Quote summary */}
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0]'}`}>
                  <div className={`text-[9px] font-bold uppercase tracking-wide mb-2 ${t.textMuted}`}>
                    Quote · received {channel ? `via ${channel}` : ''}
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    {[
                      ['Total', fmtIdrShort(order.amount)],
                      leadTime ? ['Lead time', leadTime] : null,
                      ['Items', `${order.items.length} line${order.items.length === 1 ? '' : 's'}`],
                      ['Vendor', order.supplier],
                    ].filter(Boolean).map((row) => (
                      <div key={(row as string[])[0]} className="flex items-center justify-between">
                        <span className={t.textMuted}>{(row as string[])[0]}</span>
                        <span className={`font-semibold ${t.textPrimary}`}>{(row as string[])[1]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Policy posture */}
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
                    <div className="min-w-0">
                      <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                        Policy gate · {cap ? cap.ruleId : 'Spend cap'} active
                      </div>
                      <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textPrimary}`}>
                        {cap
                          ? <>Amount exceeds the <strong>{fmtIdrShort(cap.threshold)}</strong> cap by <strong>{fmtIdrShort(overBy)}</strong>. A-04 (Spend Watchdog) cleared every other rule (vendor trust floor, duplicate detection, currency lock) — your sign-off completes the gate. After Confirm, A-04 issues the PO and A-05 picks up the delivery leg.</>
                          : <>A-04 cleared every active rule. Your sign-off completes the gate.</>}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Atlas reasoning snippet */}
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                  <div className="flex items-start gap-2">
                    <Sparkles className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                    <div className="min-w-0">
                      <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                        {order.agentAgent}
                      </div>
                      <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textPrimary}`}>{order.agentReasoning}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer — Confirm / Switch to Manual / Cancel */}
              <div className={`px-5 py-3 border-t flex items-center gap-2 flex-wrap ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
                <button onClick={() => setApprovalForId(null)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-[#f4f6f0]'}`}>
                  Cancel
                </button>
                <button onClick={() => {
                  setApprovalForId(null);
                  setMode(order.id, 'manual');
                  openStageModule(order.id, 1);
                }}
                  title="Switch to Manual Takeover — fill the Stage 1 form yourself (upload PO PDF, log policy ref)"
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-[#e5e5e0] text-gray-700 hover:bg-[#f4f6f0]'}`}>
                  Switch to Manual
                </button>
                <button onClick={() => {
                  setApprovalForId(null);
                  executeAction(order.id);
                }}
                  className="ml-auto px-4 py-2 rounded-lg text-xs font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors inline-flex items-center gap-1.5 shadow-sm">
                  <Check className="h-3.5 w-3.5" /> Confirm Approval
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* New Order / Re-order / Schedule sheet */}
      {draftSheetEl}

      {/* ⌘K Command Palette */}
      {showCmd && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowCmd(false)}>
          <div className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden ${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-[#e5e5e0]'}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center gap-3 p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
              <Search className={`h-4 w-4 shrink-0 ${t.textMuted}`} />
              <input autoFocus value={cmdQuery} onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Search orders by ID or supplier..."
                className={`flex-1 text-sm bg-transparent outline-none ${t.textPrimary}`} />
              <button onClick={() => setShowCmd(false)}><X className={`h-4 w-4 ${t.textMuted}`} /></button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {cmdFiltered.map((order) => (
                <button key={order.id}
                  onClick={() => { toggleSelect(order.id, false); setShowCmd(false); setCmdQuery(''); }}
                  className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-[#f4f6f0]'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#2a2a2a]' : 'bg-[#f4f6f0]'}`}>
                    {order.actionKind === 'resolve-issue' ? <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> :
                     order.dagStage === 4                 ? <CircleCheck className="h-3.5 w-3.5 text-green-400" /> :
                     order.dagStage === 3                 ? <Truck className={`h-3.5 w-3.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} /> :
                                                            <Clock className={`h-3.5 w-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${t.textPrimary}`}>{order.id}</span>
                      <span className={`text-[10px] ${t.textMuted}`}>{order.humanStatus}</span>
                    </div>
                    <p className={`text-[10px] truncate ${t.textMuted}`}>{order.supplier} · {order.eta}</p>
                  </div>
                  <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${t.textMuted}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
