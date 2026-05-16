// ── Buyamia v3: Autonomous Procurement Infrastructure Types ──

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
export type IntelligenceContext =
  // Core fundamentals
  | 'overview'
  | 'orders'
  | 'inventory'
  | 'spending'
  | 'suppliers'
  | 'ai-activity'
  | 'request'
  // Agents hub
  | 'nerve-center'
  | 'workflows'
  | 'transformation'
  | 'global-ops'
  | 'governance'
  | 'infrastructure';
