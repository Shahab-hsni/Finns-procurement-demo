// ── Finn's Procurement Platform — Types ──
//
// This file contains the canonical Finn's data shapes (bottom section) AND a
// legacy compatibility layer (this top section) carried forward from the
// upstream Buyamia prototype. Legacy types stay until each consuming page is
// reshaped in Phase 3; Phase 4 prunes them.
//
// LEGACY (will be removed):
// - 40-agent 5-cohort roster (Agent + AgentClass + AgentTier)
// - 12-stage DAG (DagStage)
// - 8 playbooks (WorkflowTemplate)
// - 4 control planes + L0..L5 autonomy ladder
// - Country / Industry / SupplierPromise / MetricCategory / ServiceIndicator
//
// FINN'S (new — at bottom of file):
// - 4 venues (VenueTag)
// - 6 agents flat (FinnsAgent: Atlas + A-01..A-05)
// - 5-stage Order (Order, OrderStage)
// - 3 playbooks (Playbook)
// - SKU, Supplier, ActivityEvent, PolicyRule, FinnsDispute
//
// ── Legacy Buyamia v3 Types ──────────────────────────────────

// ── Agent System ──────────────────────────────────────────────
export type AgentClass = 'sensing' | 'reasoning' | 'execution' | 'governance' | 'meta';
export type AgentTier = 'T1' | 'T2' | 'T3';
export type AgentStatus = 'active' | 'idle' | 'error';

export interface Agent {
  id: string;
  name: string;
  class: AgentClass;
  tier: AgentTier;
  status: AgentStatus;
  description: string;
  tasksCompleted: number;
  uptime: number; // percentage
  lastAction: string;
  currentFocus: string;
}

// ── DAG Kernel ────────────────────────────────────────────────
export type DagStageStatus = 'active' | 'waiting' | 'bottleneck';

export interface DagStage {
  id: number;
  name: string;
  agents: string[]; // agent IDs
  throughput: number; // ops/min
  status: DagStageStatus;
  dependencies: number[]; // upstream stage IDs
}

// ── Autonomy Ladder ───────────────────────────────────────────
export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  0: 'Manual',
  1: 'Assisted',
  2: 'Partial',
  3: 'Conditional',
  4: 'High',
  5: 'Full Autonomy',
};

// ── Workflows ─────────────────────────────────────────────────
export type WorkflowComplexity = 'simple' | 'medium' | 'complex';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  stages: number[]; // DAG stage IDs involved
  complexity: WorkflowComplexity;
  avgDuration: string;
  agentClasses: AgentClass[];
}

export interface DemandSignal {
  id: string;
  name: string;
  source: string;
  frequency: string;
  lastTriggered: string;
  strength: number; // 0-100
  relatedWorkflows: string[];
}

// ── Transformation Metrics ────────────────────────────────────
export interface MetricCategory {
  id: string;
  name: string;
  currentValue: number;
  unit: string; // '%', 'ms', '$', 'hrs', 'count'
  trend: 'up' | 'down' | 'flat';
  trendPct: number;
  history: { date: string; value: number }[];
}

export interface SupplierPromise {
  supplierId: string;
  supplierName: string;
  promisedDelivery: string;
  actualDelivery: string;
  promisedQuality: number;
  actualQuality: number;
  trustScore: number; // 0-100
  variance: 'on-track' | 'at-risk' | 'breached';
}

// ── Global Operations ─────────────────────────────────────────
export interface Country {
  id: string;
  name: string;
  code: string;
  flag: string;
  currency: string;
  activeAgents: number;
  supplierCount: number;
  gmv: string;
  taxRegime: string;
  paymentRails: string[];
  regulatoryStatus: 'compliant' | 'review' | 'blocked';
}

export interface Industry {
  id: string;
  name: string;
  icon: string;
  transactionVolume: number;
  growthPct: number;
  bomTypes: string[];
  complianceRules: string[];
  demandSignals: string[];
  topSuppliers: string[];
  demandTrend: 'rising' | 'stable' | 'declining';
}

// ── Governance & Trust ────────────────────────────────────────
export type ControlPlaneStatus = 'active' | 'warning' | 'disabled';

export interface ControlPlane {
  id: string;
  name: string;
  description: string;
  status: ControlPlaneStatus;
  ruleCount: number;
  lastUpdated: string;
  coverage: number; // percentage
}

export interface LossCategory {
  id: string;
  name: string;
  exposure: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  incidentCount: number;
  mitigationPct: number;
}

export interface DecisionRecord {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  decisionType: string;
  confidenceScore: number;
  autonomyLevel: AutonomyLevel;
  outcome: 'success' | 'pending' | 'failed' | 'overridden';
  details: string;
}

export interface Dispute {
  id: string;
  decisionId: string;
  raisedBy: string;
  reason: string;
  status: 'open' | 'resolved' | 'escalated';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

// ── Infrastructure ────────────────────────────────────────────
export type ServiceStatus = 'healthy' | 'degraded' | 'down';

export interface ServiceIndicator {
  id: string;
  label: string;
  status: ServiceStatus;
}

// ── Intelligence Panel ────────────────────────────────────────
// Narrowed to the 8 Finn's pages. 'governance' is a legacy alias for the
// merged Activity & Governance page (the canonical context is 'ai-activity'
// but governance still passes through here for any legacy callers).
export type IntelligenceContext =
  | 'overview'
  | 'orders'
  | 'inventory'
  | 'spending'
  | 'suppliers'
  | 'ai-activity'
  | 'governance'        // legacy alias for ai-activity (merged page)
  | 'workflows'
  | 'request';

// ─────────────────────────────────────────────────────────────
// ── Finn's Canonical Types — read these first ────────────────
// ─────────────────────────────────────────────────────────────

// ── Venues ───────────────────────────────────────────────────
// Every SKU and PO carries a venue tag. No scope switcher in nav — the
// Procurement Manager sees all venues at once. Multi-venue POs use the
// 'Multi' chip in filters only; the venues field always lists the actual tags.
export type VenueTag = 'BC' | 'RC' | 'ST' | 'SP';

export interface VenueDefinition {
  tag: VenueTag;
  name: string;
  type: string;             // 'beach club' | 'recreation club' | 'fine dining' | 'waterpark'
  description: string;
}

// ── Categories ───────────────────────────────────────────────
export type FinnsCategory =
  | 'Protein'
  | 'Seafood'
  | 'Produce'
  | 'Dry Goods'
  | 'Dairy'
  | 'Beverages'
  | 'Other';

// ── Currency ─────────────────────────────────────────────────
// IDR is primary. USD only for imports (wine, AUS beef, some dairy).
export type Currency = 'IDR' | 'USD';

// ── Playbooks ────────────────────────────────────────────────
export type PlaybookId = 'WF-STD' | 'WF-RSH' | 'WF-REC';

export interface Playbook {
  id: PlaybookId;
  name: 'Standard' | 'Rush' | 'Recurring';
  description: string;
  whenItRuns: string;
  complexity: 'simple' | 'medium' | 'standard';
  stages: PlaybookStage[];
  activeOrderCount: number;
  avgDurationHours: number;
  savingsVsBaseline: number;     // % saved vs manual baseline
}

export interface PlaybookStage {
  stage: OrderStage;
  name: string;
  owningAgent: FinnsAgentId | 'human';
  description: string;
  throughputPerHour?: number;
}

// ── Order journey ────────────────────────────────────────────
// 5 stages: Request -> Quote/Vendor Confirmed -> PO Approved
//        -> In Transit -> Delivered & Checked.
export type OrderStage = 1 | 2 | 3 | 4 | 5;

export type OrderStatus =
  | 'live'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'on-hold';

/**
 * Per-entity labor mode. Aligns with `AutonomyMode` in `lib/autonomy.ts`.
 * Was `'agent' | 'manual'` (Phase 4 vintage); migrated to `'manual' | 'auto'`
 * in Phase 6 so per-entity values and the system default speak the same
 * vocabulary. Old `'agent'` values in localStorage / mock data should
 * be read as `'auto'` (see seed migration in mockData.ts).
 */
export type OrderLaborMode = 'manual' | 'auto';

export interface FinnsOrder {
  id: string;                       // "PO-3041"
  supplier: string;                 // display name
  supplierId: string;               // canonical id, joins to FinnsSupplier
  managedBy: FinnsAgentId;          // assigned operating agent
  amount: number;                   // primary currency value
  currency: Currency;
  amountUsd?: number;               // USD equivalent at booking FX (for IDR POs serving imports)
  fxRateAtQuote?: number;           // captured at quote time when currency=USD
  venues: VenueTag[];               // one or more
  category: FinnsCategory;
  workflowTemplate: PlaybookId;
  stage: OrderStage;
  status: OrderStatus;
  laborMode: OrderLaborMode;
  trace: OrderStageTrace[];
  humanDescription: string;         // plain-English one-liner for cockpit
  createdAt: string;                // ISO
  eta?: string;                     // ISO expected delivery
  deliveredAt?: string;             // ISO
  recurring?: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    nextRun: string;
  };
  qcOutcome?: 'pass' | 'fail';      // populated when stage = 5
  override?: {
    actor: 'user' | 'agent';
    reason: string;
    at: string;
  };
}

export interface OrderStageTrace {
  stage: OrderStage;
  outcome: 'pending' | 'in-progress' | 'complete' | 'failed';
  agent?: FinnsAgentId;
  startedAt?: string;
  completedAt?: string;
  dataPoints?: Record<string, string | number>;
  alternatives?: { label: string; rejectedBecause: string }[];
}

// ── SKUs (Inventory) ─────────────────────────────────────────
export interface FinnsSKU {
  id: string;                       // "SKU-0421"
  name: string;
  category: FinnsCategory;
  venues: VenueTag[];               // which venues consume this
  uom: string;                      // "kg" / "L" / "case" / "btl"
  onHand: number;
  par: number;                      // target floor
  parFloor?: number;                // hardened safety threshold (> par when set)
  burnRate: number;                 // units/day (rolling 14d avg)
  daysOfCover: number;              // onHand / burnRate
  agent: FinnsAgentId;              // typically A-02 Restock
  laborMode: OrderLaborMode;
  latestPO?: string;                // most recent PO id for this SKU
  archived?: boolean;
  failedIntent?: {
    at: string;
    reason: 'user_dismissed' | 'budget_exceeded' | 'approver_rejected' | 'vendor_unreachable';
  };
}

// ── Suppliers ────────────────────────────────────────────────
export type SupplierType = 'local' | 'regional' | 'import';
export type SupplierStatus = 'active' | 'watchlist' | 'paused';

export interface FinnsSupplier {
  id: string;                       // "SUP-014"
  name: string;                     // "PT Bali Seafood Lestari"
  type: SupplierType;
  region: string;                   // "Bali" / "Java" / "Australia" / etc.
  categories: FinnsCategory[];
  venuesServed: VenueTag[];
  laborMode: OrderLaborMode;
  agent: FinnsAgentId;              // typically A-01 (Sourcing) or A-03 (Vendor Comms)
  accountManager: {
    name: string;
    whatsapp: string;
    telegram?: string;
  };
  metrics: {
    composite: number;              // 0-100
    onTime: number;                 // %
    coldChain: number;              // % SLA
    quality: number;                // 0-100
    leadTimeDays: number;
    annualContractIdr: number;
  };
  status: SupplierStatus;
  qcAlerts: SupplierQcAlert[];
}

export interface SupplierQcAlert {
  poId: string;
  at: string;
  failureNote: string;
  dismissed: boolean;
}

// ── Activity & Governance ────────────────────────────────────
export type ActivityEventType =
  | 'auto-order'
  | 'restock-forecast'
  | 'vendor-rejection'
  | 'spend-flag'
  | 'qc-event'
  | 'override'
  | 'rule-trigger';

export type EventOutcome = 'success' | 'pending' | 'failed' | 'overridden';

export interface ActivityEvent {
  id: string;                       // "evt-001"
  type: ActivityEventType;
  agentId: FinnsAgentId;
  at: string;
  category?: FinnsCategory;
  venue: VenueTag | 'Multi';
  poId?: string;
  skuId?: string;
  supplierId?: string;
  confidence: number;               // 0-100
  outcome: EventOutcome;
  reasoning: {
    why: string;
    dataPoints: { label: string; value: string; delta?: number }[];
    alternatives: { label: string; rejectedBecause: string }[];
  };
  undoWindow: {
    mode: 'hard-60' | 'ledger-close' | 'per-class';
    expiresAt?: string;
  };
  override?: {
    actor: 'user' | 'agent';
    reason: string;
    at: string;
  };
}

// ── Policy Rules ─────────────────────────────────────────────
export type PolicyTemplate =
  | 'spend-cap'
  | 'vendor-trust-floor'
  | 'fraud-hold'
  | 'delivery-sla';

export type PolicyScope = 'all' | 'category' | 'venue' | 'vendor' | 'agent';

export interface PolicyRule {
  id: string;                       // "RUL-001"
  template: PolicyTemplate;
  name: string;                     // human label
  config: Record<string, unknown>;
  scope: PolicyScope;
  active: boolean;
  createdBy: string;
  createdAt: string;
  triggers: number;                 // count of times this rule has fired
}

// ── Disputes ─────────────────────────────────────────────────
export type DisputePriority = 'high' | 'medium' | 'low';
export type DisputeStatus = 'open' | 'resolved' | 'escalated';

export interface FinnsDispute {
  id: string;                       // "DSP-001"
  raisedBy: string;
  refEventId: string;
  refPoId?: string;
  reason: string;
  priority: DisputePriority;
  status: DisputeStatus;
  resolution?: {
    action: 'approve' | 'reject' | 'escalate';
    hardenedAsPrecedent: boolean;
    at: string;
  };
}

// ── Agent Roster (6 agents, flat) ────────────────────────────
// Atlas is the chat copilot (no profile page, no hash). A-01..A-05 are the
// operating agents that appear in order journeys, governance feed, etc.
export type FinnsAgentId =
  | 'A-01'   // Sourcing
  | 'A-02'   // Restock
  | 'A-03'   // Vendor Comms
  | 'A-04'   // Spend Watchdog
  | 'A-05';  // Logistics

export type FinnsAgentRole =
  | 'Sourcing Agent'
  | 'Restock Agent'
  | 'Vendor Comms Agent'
  | 'Spend Watchdog'
  | 'Logistics Agent';

export interface FinnsAgent {
  id: FinnsAgentId;
  name: string;
  role: FinnsAgentRole;
  description: string;
  status: 'active' | 'suspended';
  performanceBand: 'green' | 'amber' | 'red';
  tasksCompletedToday: number;
  recentDecisions: string[];        // event ids
}

// Atlas is intentionally separate — it has no id, no profile, no hash.
// It's the chat layer that synthesizes the operating agents' work.
