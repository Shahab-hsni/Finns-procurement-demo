// Finn's mock data lives at the bottom of this file. The legacy Buyamia
// mock data above is carried forward so the surviving pages still compile
// during the Phase 3 migration. Phase 4 prunes the legacy.

import type {
  Agent, DagStage, WorkflowTemplate, DemandSignal,
  MetricCategory, SupplierPromise, Country, Industry,
  ControlPlane, LossCategory, DecisionRecord, Dispute,
  ServiceIndicator,
  // Finn's
  VenueDefinition, Playbook, FinnsOrder, FinnsSKU, FinnsSupplier,
  ActivityEvent, PolicyRule, FinnsDispute, FinnsAgent,
} from './types';

// ── 40 Agents across 5 Classes ───────────────────────────────

const agentNames: Record<string, { class: import('./types').AgentClass; tier: import('./types').AgentTier; desc: string; lastAction: string; currentFocus: string }> = {
  'SEN-001': { class: 'sensing', tier: 'T1', desc: 'Market price feed ingestion', lastAction: 'Ingested 1,240 price updates from 18 markets', currentFocus: 'Live commodity feed from Jakarta exchange' },
  'SEN-002': { class: 'sensing', tier: 'T1', desc: 'Supplier catalog sync', lastAction: 'Synced 340 supplier catalog updates', currentFocus: 'AlphaFoods catalog re-sync (ETA 2 min)' },
  'SEN-003': { class: 'sensing', tier: 'T2', desc: 'Demand signal detection', lastAction: 'Classified Ramadan demand spike signal', currentFocus: 'Monitoring F&B POS signal anomalies' },
  'SEN-004': { class: 'sensing', tier: 'T2', desc: 'Inventory level monitoring', lastAction: 'Flagged lamb rack at 12% threshold', currentFocus: 'Scanning 48 items near reorder point' },
  'SEN-005': { class: 'sensing', tier: 'T2', desc: 'Delivery tracking ingestion', lastAction: 'Tracked PO-2847 location update', currentFocus: '3 active shipments in-transit monitoring' },
  'SEN-006': { class: 'sensing', tier: 'T3', desc: 'Weather & disruption feeds', lastAction: 'Processed typhoon disruption alert', currentFocus: 'SE Asia weather feed parsing' },
  'SEN-007': { class: 'sensing', tier: 'T3', desc: 'Competitor price scraping', lastAction: 'Scraped 820 competitor price points', currentFocus: 'Daily dry goods price benchmarking' },
  'SEN-008': { class: 'sensing', tier: 'T3', desc: 'Social sentiment analysis', lastAction: 'Detected negative sentiment for Indo Seafood', currentFocus: 'Social monitoring for PT Maju reviews' },
  'REA-001': { class: 'reasoning', tier: 'T1', desc: 'Spend pattern analysis', lastAction: 'Identified 11% overspend in seafood category', currentFocus: 'Cross-supplier spend pattern analysis' },
  'REA-002': { class: 'reasoning', tier: 'T1', desc: 'Vendor risk scoring', lastAction: 'Updated PT Maju trust score to 94', currentFocus: 'Indo Seafood reliability scoring (risk)' },
  'REA-003': { class: 'reasoning', tier: 'T1', desc: 'Demand forecasting', lastAction: 'Forecast 18% protein demand increase', currentFocus: 'Seafood demand spike analysis — Ramadan' },
  'REA-004': { class: 'reasoning', tier: 'T2', desc: 'Price optimization', lastAction: 'Secured 8% discount on coffee bulk order', currentFocus: 'Price optimization for 12 active quotes' },
  'REA-005': { class: 'reasoning', tier: 'T2', desc: 'Contract clause analysis', lastAction: 'Flagged 3 unfavorable contract clauses', currentFocus: 'GreenHarvest contract renewal review' },
  'REA-006': { class: 'reasoning', tier: 'T2', desc: 'BOM cost estimation', lastAction: 'Estimated $2,340 BOM cost for menu redesign', currentFocus: 'Q2 kitchen renovation BOM estimation' },
  'REA-007': { class: 'reasoning', tier: 'T3', desc: 'Market trend prediction', lastAction: 'Predicted IDR weakening of 2.3%', currentFocus: 'FX trend modeling for Indonesia operations' },
  'REA-008': { class: 'reasoning', tier: 'T3', desc: 'Supply chain simulation', lastAction: 'Simulated 4-supplier outage scenario', currentFocus: 'Supply chain resilience stress test' },
  'EXE-001': { class: 'execution', tier: 'T1', desc: 'Purchase order generation', lastAction: 'Generated PO-4821 for AlphaFoods ($2,340)', currentFocus: 'Queued 4 POs pending compliance gate' },
  'EXE-002': { class: 'execution', tier: 'T1', desc: 'Quote request dispatch', lastAction: 'Dispatched RFQ to 6 protein suppliers', currentFocus: 'Awaiting quotes for olive oil reorder' },
  'EXE-003': { class: 'execution', tier: 'T1', desc: 'Payment processing', lastAction: 'Processed early payment to Pacific Supply', currentFocus: 'Reconciling 8 pending payment batches' },
  'EXE-004': { class: 'execution', tier: 'T2', desc: 'Delivery scheduling', lastAction: 'Scheduled delivery for PO-2847 (tomorrow)', currentFocus: 'Coordinating 3 cold chain deliveries' },
  'EXE-005': { class: 'execution', tier: 'T2', desc: 'Invoice reconciliation', lastAction: 'Reconciled invoice INV-9920 with PO-4818', currentFocus: 'Matching 22 open invoices to POs' },
  'EXE-006': { class: 'execution', tier: 'T2', desc: 'Inventory auto-reorder', lastAction: 'Triggered olive oil auto-reorder at 4% stock', currentFocus: 'Monitoring 12 items near reorder threshold' },
  'EXE-007': { class: 'execution', tier: 'T3', desc: 'Group buy pool formation', lastAction: 'Formed protein group buy pool (6 members)', currentFocus: 'Aggregating bulk flour buy across 4 outlets' },
  'EXE-008': { class: 'execution', tier: 'T3', desc: 'Cross-border fulfillment', lastAction: 'Cleared customs for Thailand shipment', currentFocus: 'Cross-border fulfillment — 3 active orders' },
  'GOV-001': { class: 'governance', tier: 'T1', desc: 'Policy enforcement engine', lastAction: 'Blocked $18K equipment purchase (over cap)', currentFocus: 'Evaluating 7 pending policy exceptions' },
  'GOV-002': { class: 'governance', tier: 'T1', desc: 'Budget guardian', lastAction: 'Enforced monthly budget cap for kitchen dept', currentFocus: 'Monitoring seafood category at 92% budget' },
  'GOV-003': { class: 'governance', tier: 'T1', desc: 'Compliance checker', lastAction: 'Cleared Vietnam regulatory compliance check', currentFocus: 'Vietnam VAT rule review (new regulation)' },
  'GOV-004': { class: 'governance', tier: 'T2', desc: 'Audit trail recorder', lastAction: 'Recorded 28 decision entries this hour', currentFocus: 'Timestamping DEC-008 payment execution' },
  'GOV-005': { class: 'governance', tier: 'T2', desc: 'Fraud detection', lastAction: 'Flagged INV-9921 for duplicate pattern', currentFocus: 'Cross-checking 3 suspicious invoice batches' },
  'GOV-006': { class: 'governance', tier: 'T2', desc: 'Loss cap monitor', lastAction: 'Loss cap at 71% mitigation for delays', currentFocus: 'Monitoring LC-DLY exposure (trending up)' },
  'GOV-007': { class: 'governance', tier: 'T3', desc: 'Dispute arbitrator', lastAction: 'Escalated DSP-002 equipment override dispute', currentFocus: 'Arbitrating BeanHouse discount dispute' },
  'GOV-008': { class: 'governance', tier: 'T3', desc: 'Regulatory scanner', lastAction: 'Scanned 5 jurisdictions for regulatory changes', currentFocus: 'Vietnam new import regulation parsing' },
  'MET-001': { class: 'meta', tier: 'T1', desc: 'Agent orchestrator', lastAction: 'Scaled sensing agents from 6 to 8', currentFocus: 'Orchestrating peak-hour agent rebalancing' },
  'MET-002': { class: 'meta', tier: 'T1', desc: 'DAG kernel scheduler', lastAction: 'Scheduled DAG optimization pass', currentFocus: 'Rebalancing stage 5 bottleneck workload' },
  'MET-003': { class: 'meta', tier: 'T1', desc: 'Memory system manager', lastAction: 'Archived 2,400 memory entries to cold store', currentFocus: 'Managing 18 active reasoning memory contexts' },
  'MET-004': { class: 'meta', tier: 'T2', desc: 'Model gateway router', lastAction: 'Routed 340 LLM requests in last 5 min', currentFocus: 'Load balancing GPT-4o and Claude-3 traffic' },
  'MET-005': { class: 'meta', tier: 'T2', desc: 'Event bus coordinator', lastAction: 'Processed 1,240 events in last minute', currentFocus: 'Event bus throughput optimization' },
  'MET-006': { class: 'meta', tier: 'T2', desc: 'Trust score aggregator', lastAction: 'Aggregated trust scores for 42 entities', currentFocus: 'Real-time trust propagation for GreenHarvest' },
  'MET-007': { class: 'meta', tier: 'T3', desc: 'Self-healing monitor', lastAction: 'Auto-recovered SEN-006 from timeout error', currentFocus: 'Health monitoring — 2 degraded agents' },
  'MET-008': { class: 'meta', tier: 'T3', desc: 'Performance optimizer', lastAction: 'Applied DAG optimization: +8% throughput', currentFocus: 'Profiling stage 5 price optimization latency' },
};

export const agents: Agent[] = Object.entries(agentNames).map(([id, a]) => ({
  id,
  name: id.replace('-', ' ').replace(/(\d+)/, '#$1'),
  class: a.class,
  tier: a.tier,
  status: Math.random() > 0.1 ? 'active' : Math.random() > 0.5 ? 'idle' : 'error',
  description: a.desc,
  tasksCompleted: Math.floor(Math.random() * 5000) + 100,
  uptime: +(95 + Math.random() * 5).toFixed(1),
  lastAction: a.lastAction,
  currentFocus: a.currentFocus,
}));

// ── 12-Stage DAG Kernel ──────────────────────────────────────

export const dagStages: DagStage[] = [
  { id: 1,  name: 'Signal Intake',       agents: ['SEN-001','SEN-002','SEN-003'], throughput: 342, status: 'active',      dependencies: [] },
  { id: 2,  name: 'Demand Classification', agents: ['SEN-004','REA-001'],          throughput: 310, status: 'active',      dependencies: [1] },
  { id: 3,  name: 'Source Discovery',     agents: ['SEN-005','SEN-006'],           throughput: 285, status: 'active',      dependencies: [2] },
  { id: 4,  name: 'Vendor Evaluation',    agents: ['REA-002','REA-003'],           throughput: 260, status: 'active',      dependencies: [3] },
  { id: 5,  name: 'Price Optimization',   agents: ['REA-004','REA-005'],           throughput: 240, status: 'bottleneck',  dependencies: [4] },
  { id: 6,  name: 'Compliance Gate',      agents: ['GOV-001','GOV-003'],           throughput: 238, status: 'active',      dependencies: [5] },
  { id: 7,  name: 'Order Assembly',       agents: ['EXE-001','EXE-002'],           throughput: 220, status: 'active',      dependencies: [6] },
  { id: 8,  name: 'Approval Routing',     agents: ['GOV-002','MET-001'],           throughput: 215, status: 'waiting',     dependencies: [7] },
  { id: 9,  name: 'Execution',            agents: ['EXE-003','EXE-004'],           throughput: 200, status: 'active',      dependencies: [8] },
  { id: 10, name: 'Fulfillment Tracking', agents: ['SEN-005','EXE-005'],           throughput: 195, status: 'active',      dependencies: [9] },
  { id: 11, name: 'Settlement',           agents: ['EXE-005','GOV-004'],           throughput: 190, status: 'active',      dependencies: [10] },
  { id: 12, name: 'Learning & Feedback',  agents: ['MET-003','MET-008'],           throughput: 188, status: 'active',      dependencies: [11] },
];

// ── 8 Workflow Templates ─────────────────────────────────────

export const workflowTemplates: WorkflowTemplate[] = [
  { id: 'WF-STD',  name: 'Standard',          description: 'Regular procurement cycle with full evaluation',        icon: 'FileText',   stages: [1,2,3,4,5,6,7,8,9,10,11,12], complexity: 'medium', avgDuration: '5-7 days',  agentClasses: ['sensing','reasoning','execution','governance'] },
  { id: 'WF-RSH',  name: 'Rush',              description: 'Expedited procurement for urgent needs',               icon: 'Zap',        stages: [1,2,5,6,7,9,10,11],           complexity: 'simple', avgDuration: '24-48 hrs', agentClasses: ['sensing','execution','governance'] },
  { id: 'WF-BPO',  name: 'Blanket PO',        description: 'Long-term purchase agreement with scheduled releases', icon: 'ScrollText', stages: [1,2,3,4,5,6,7,8,9,11,12],     complexity: 'complex', avgDuration: '2-4 weeks', agentClasses: ['sensing','reasoning','execution','governance','meta'] },
  { id: 'WF-GRP',  name: 'Group Buy',         description: 'Pooled purchasing across multiple entities',           icon: 'Users',      stages: [1,2,3,4,5,7,8,9,10,11],       complexity: 'complex', avgDuration: '1-2 weeks', agentClasses: ['sensing','reasoning','execution','meta'] },
  { id: 'WF-EMR',  name: 'Emergency',         description: 'Critical stockout requiring immediate action',         icon: 'AlertCircle',stages: [1,7,9,10,11],                 complexity: 'simple', avgDuration: '2-6 hrs',   agentClasses: ['sensing','execution'] },
  { id: 'WF-PRD',  name: 'Production-Driven', description: 'BOM-triggered procurement from production schedule',   icon: 'Factory',    stages: [1,2,3,4,5,6,7,8,9,10,11,12], complexity: 'complex', avgDuration: '3-5 days',  agentClasses: ['sensing','reasoning','execution','governance','meta'] },
  { id: 'WF-MNT',  name: 'Maintenance',       description: 'Scheduled maintenance parts and supplies',             icon: 'Wrench',     stages: [1,2,4,6,7,9,10,11],           complexity: 'medium', avgDuration: '3-5 days',  agentClasses: ['sensing','reasoning','execution'] },
  { id: 'WF-CPX',  name: 'Project/Capex',     description: 'Capital expenditure with multi-level approval',        icon: 'Building2',  stages: [1,2,3,4,5,6,7,8,9,10,11,12], complexity: 'complex', avgDuration: '2-6 weeks', agentClasses: ['sensing','reasoning','execution','governance','meta'] },
];

// ── 11 Demand Signals ────────────────────────────────────────

export const demandSignals: DemandSignal[] = [
  { id: 'DS-01', name: 'POS Transaction',     source: 'POS System',       frequency: 'Real-time', lastTriggered: '2 min ago',   strength: 92, relatedWorkflows: ['WF-STD','WF-RSH'] },
  { id: 'DS-02', name: 'Inventory Threshold',  source: 'Stock Monitor',    frequency: 'Real-time', lastTriggered: '5 min ago',   strength: 88, relatedWorkflows: ['WF-STD','WF-EMR'] },
  { id: 'DS-03', name: 'Production Schedule',  source: 'MRP System',       frequency: 'Daily',     lastTriggered: '1 hr ago',    strength: 85, relatedWorkflows: ['WF-PRD','WF-BPO'] },
  { id: 'DS-04', name: 'Seasonal Forecast',    source: 'AI Predictor',     frequency: 'Weekly',    lastTriggered: '2 days ago',  strength: 78, relatedWorkflows: ['WF-BPO','WF-GRP'] },
  { id: 'DS-05', name: 'Contract Expiry',      source: 'Contract Engine',  frequency: 'Daily',     lastTriggered: '6 hrs ago',   strength: 72, relatedWorkflows: ['WF-BPO'] },
  { id: 'DS-06', name: 'Price Alert',          source: 'Market Feed',      frequency: 'Real-time', lastTriggered: '12 min ago',  strength: 95, relatedWorkflows: ['WF-STD','WF-GRP'] },
  { id: 'DS-07', name: 'Maintenance Schedule', source: 'CMMS',             frequency: 'Weekly',    lastTriggered: '3 days ago',  strength: 65, relatedWorkflows: ['WF-MNT'] },
  { id: 'DS-08', name: 'Budget Release',       source: 'Finance System',   frequency: 'Monthly',   lastTriggered: '5 days ago',  strength: 60, relatedWorkflows: ['WF-CPX','WF-BPO'] },
  { id: 'DS-09', name: 'Supplier Event',       source: 'Supplier Portal',  frequency: 'Real-time', lastTriggered: '30 min ago',  strength: 82, relatedWorkflows: ['WF-STD','WF-RSH'] },
  { id: 'DS-10', name: 'Quality Incident',     source: 'QC System',        frequency: 'Real-time', lastTriggered: '45 min ago',  strength: 90, relatedWorkflows: ['WF-EMR','WF-RSH'] },
  { id: 'DS-11', name: 'Group Pool Trigger',   source: 'Pool Engine',      frequency: 'Hourly',    lastTriggered: '20 min ago',  strength: 75, relatedWorkflows: ['WF-GRP'] },
];

// ── 8 Transformation Metrics ─────────────────────────────────

function generateHistory(base: number, variance: number, points: number = 30): { date: string; value: number }[] {
  return Array.from({ length: points }, (_, i) => ({
    date: `Day ${i + 1}`,
    value: +(base + (Math.random() - 0.5) * variance * 2).toFixed(1),
  }));
}

export const transformationMetrics: MetricCategory[] = [
  { id: 'TM-01', name: 'Autonomous Spend',         currentValue: 72.4,  unit: '%',     trend: 'up',   trendPct: 3.2,  history: generateHistory(70, 5) },
  { id: 'TM-02', name: 'Auto-Execution Rate',       currentValue: 68.1,  unit: '%',     trend: 'up',   trendPct: 5.1,  history: generateHistory(65, 6) },
  { id: 'TM-03', name: 'Manual Touches Eliminated', currentValue: 1240,  unit: 'count', trend: 'up',   trendPct: 12.3, history: generateHistory(1100, 200) },
  { id: 'TM-04', name: 'Labor Hours Saved',         currentValue: 486,   unit: 'hrs',   trend: 'up',   trendPct: 8.7,  history: generateHistory(440, 60) },
  { id: 'TM-05', name: 'Stockouts Prevented',       currentValue: 34,    unit: 'count', trend: 'down', trendPct: -2.1, history: generateHistory(36, 8) },
  { id: 'TM-06', name: 'Realized Savings',          currentValue: 48200, unit: '$',     trend: 'up',   trendPct: 6.5,  history: generateHistory(45000, 5000) },
  { id: 'TM-07', name: 'Working Capital Freed',     currentValue: 125000,unit: '$',     trend: 'up',   trendPct: 4.8,  history: generateHistory(120000, 10000) },
  { id: 'TM-08', name: 'Exception Trend',           currentValue: 18,    unit: 'count', trend: 'down', trendPct: -15.2,history: generateHistory(22, 6) },
];

export const supplierPromises: SupplierPromise[] = [
  { supplierId: 'SP-01', supplierName: 'AlphaFoods International', promisedDelivery: '3 days', actualDelivery: '2.8 days', promisedQuality: 98, actualQuality: 97.5, trustScore: 94, variance: 'on-track' },
  { supplierId: 'SP-02', supplierName: 'Pacific Supply Co.',       promisedDelivery: '5 days', actualDelivery: '5.2 days', promisedQuality: 95, actualQuality: 93.1, trustScore: 82, variance: 'at-risk' },
  { supplierId: 'SP-03', supplierName: 'MegaEquip Industries',     promisedDelivery: '7 days', actualDelivery: '6.5 days', promisedQuality: 97, actualQuality: 98.2, trustScore: 96, variance: 'on-track' },
  { supplierId: 'SP-04', supplierName: 'GreenHarvest Farms',       promisedDelivery: '2 days', actualDelivery: '4.1 days', promisedQuality: 96, actualQuality: 88.0, trustScore: 58, variance: 'breached' },
  { supplierId: 'SP-05', supplierName: 'TechParts Global',         promisedDelivery: '4 days', actualDelivery: '3.9 days', promisedQuality: 99, actualQuality: 99.1, trustScore: 98, variance: 'on-track' },
];

// ── 5 Countries ──────────────────────────────────────────────

export const countries: Country[] = [
  { id: 'CTR-ID', name: 'Indonesia',    code: 'ID', flag: 'ID', currency: 'IDR', activeAgents: 40, supplierCount: 1240, gmv: '$2.4M',  taxRegime: 'PPN 11%',        paymentRails: ['Bank Transfer','Virtual Account','QRIS'], regulatoryStatus: 'compliant' },
  { id: 'CTR-AU', name: 'Australia',    code: 'AU', flag: 'AU', currency: 'AUD', activeAgents: 32, supplierCount: 680,  gmv: '$1.8M',  taxRegime: 'GST 10%',        paymentRails: ['BPAY','Direct Debit','PayID'],            regulatoryStatus: 'compliant' },
  { id: 'CTR-TH', name: 'Thailand',     code: 'TH', flag: 'TH', currency: 'THB', activeAgents: 28, supplierCount: 520,  gmv: '$980K',  taxRegime: 'VAT 7%',         paymentRails: ['PromptPay','Bank Transfer'],               regulatoryStatus: 'compliant' },
  { id: 'CTR-VN', name: 'Vietnam',      code: 'VN', flag: 'VN', currency: 'VND', activeAgents: 24, supplierCount: 410,  gmv: '$620K',  taxRegime: 'VAT 10%',        paymentRails: ['Bank Transfer','VNPay'],                   regulatoryStatus: 'review' },
  { id: 'CTR-PH', name: 'Philippines',  code: 'PH', flag: 'PH', currency: 'PHP', activeAgents: 20, supplierCount: 340,  gmv: '$450K',  taxRegime: 'VAT 12%',        paymentRails: ['GCash','Bank Transfer','Maya'],            regulatoryStatus: 'compliant' },
];

// ── 5 Industries ─────────────────────────────────────────────

export const industries: Industry[] = [
  { id: 'IND-FB', name: 'F&B',           icon: 'UtensilsCrossed', transactionVolume: 28400, growthPct: 18.2, bomTypes: ['Recipe BOM','Menu BOM'],                 complianceRules: ['Halal','HACCP','Food Safety'],      demandSignals: ['POS','Inventory','Seasonal'], topSuppliers: ['AlphaFoods','GreenHarvest'],    demandTrend: 'rising' },
  { id: 'IND-MF', name: 'Manufacturing', icon: 'Factory',         transactionVolume: 15200, growthPct: 12.5, bomTypes: ['Production BOM','Assembly BOM'],          complianceRules: ['ISO 9001','Environmental'],         demandSignals: ['Production','Contract'],      topSuppliers: ['MegaEquip','TechParts'],        demandTrend: 'stable' },
  { id: 'IND-HO', name: 'Hospitality',   icon: 'Hotel',           transactionVolume: 22100, growthPct: 22.8, bomTypes: ['Room Setup BOM','Event BOM'],             complianceRules: ['Fire Safety','Health Permit'],      demandSignals: ['Occupancy','Seasonal'],       topSuppliers: ['Pacific Supply','AlphaFoods'],  demandTrend: 'rising' },
  { id: 'IND-PH', name: 'Pharmacy',      icon: 'Pill',            transactionVolume: 9800,  growthPct: 8.4,  bomTypes: ['Formulation BOM','Packaging BOM'],        complianceRules: ['GMP','BPOM','Drug Registry'],       demandSignals: ['Prescription','Inventory'],   topSuppliers: ['PharmaDist','MedSupply'],        demandTrend: 'stable' },
  { id: 'IND-GR', name: 'Grocery',       icon: 'ShoppingBasket',  transactionVolume: 34600, growthPct: 15.1, bomTypes: ['Category BOM','Private Label BOM'],       complianceRules: ['BPOM','Halal','Expiry Tracking'],   demandSignals: ['POS','Inventory','Seasonal'], topSuppliers: ['GreenHarvest','AlphaFoods'],    demandTrend: 'rising' },
];

// ── 4 Control Planes ─────────────────────────────────────────

export const controlPlanes: ControlPlane[] = [
  { id: 'CP-POL', name: 'Policy Engine',    description: 'Enforces procurement policies, approval hierarchies, and spend limits',          status: 'active',  ruleCount: 142, lastUpdated: '2 hrs ago', coverage: 98 },
  { id: 'CP-ECO', name: 'Economic Guard',   description: 'Monitors budget adherence, ROI thresholds, and cost anomalies',                 status: 'active',  ruleCount: 89,  lastUpdated: '1 hr ago',  coverage: 95 },
  { id: 'CP-TRU', name: 'Trust Framework',  description: 'Calculates and enforces trust scores for agents, suppliers, and transactions',  status: 'active',  ruleCount: 67,  lastUpdated: '30 min ago',coverage: 100 },
  { id: 'CP-SIM', name: 'Simulation Sandbox',description:'Tests autonomous decisions in a sandboxed environment before live execution',   status: 'warning', ruleCount: 34,  lastUpdated: '5 hrs ago', coverage: 72 },
];

export const lossCategories: LossCategory[] = [
  { id: 'LC-FRD', name: 'Fraud',           exposure: 12400,  trend: 'decreasing', incidentCount: 3,  mitigationPct: 94 },
  { id: 'LC-WST', name: 'Waste',           exposure: 28600,  trend: 'decreasing', incidentCount: 12, mitigationPct: 82 },
  { id: 'LC-ERR', name: 'Error',           exposure: 8900,   trend: 'stable',     incidentCount: 7,  mitigationPct: 88 },
  { id: 'LC-DLY', name: 'Delay',           exposure: 34200,  trend: 'increasing', incidentCount: 18, mitigationPct: 71 },
  { id: 'LC-NCO', name: 'Non-compliance',  exposure: 5600,   trend: 'decreasing', incidentCount: 2,  mitigationPct: 96 },
];

// ── Decision Records ─────────────────────────────────────────

export const decisionRecords: DecisionRecord[] = [
  { id: 'DEC-001', timestamp: '2024-10-28 14:32', agentId: 'EXE-001', agentName: 'EXE #001', decisionType: 'Auto-PO Generation',    confidenceScore: 97, autonomyLevel: 4, outcome: 'success',    details: 'Generated PO-4821 for AlphaFoods — $2,340 within policy limits' },
  { id: 'DEC-002', timestamp: '2024-10-28 14:28', agentId: 'REA-004', agentName: 'REA #004', decisionType: 'Price Negotiation',      confidenceScore: 89, autonomyLevel: 3, outcome: 'success',    details: 'Negotiated 8% discount on bulk coffee order from BeanHouse' },
  { id: 'DEC-003', timestamp: '2024-10-28 14:15', agentId: 'GOV-005', agentName: 'GOV #005', decisionType: 'Fraud Flag',             confidenceScore: 72, autonomyLevel: 2, outcome: 'pending',    details: 'Flagged invoice INV-9921 — duplicate amount pattern detected' },
  { id: 'DEC-004', timestamp: '2024-10-28 13:58', agentId: 'EXE-006', agentName: 'EXE #006', decisionType: 'Auto-Reorder',           confidenceScore: 95, autonomyLevel: 4, outcome: 'success',    details: 'Triggered reorder for olive oil — stock at 4% threshold' },
  { id: 'DEC-005', timestamp: '2024-10-28 13:42', agentId: 'SEN-003', agentName: 'SEN #003', decisionType: 'Demand Reclassification',confidenceScore: 84, autonomyLevel: 3, outcome: 'success',    details: 'Reclassified tomato demand from seasonal to trending-up' },
  { id: 'DEC-006', timestamp: '2024-10-28 13:30', agentId: 'GOV-002', agentName: 'GOV #002', decisionType: 'Budget Override Block',  confidenceScore: 99, autonomyLevel: 5, outcome: 'overridden', details: 'Blocked $18K equipment purchase — exceeded monthly cap. Manager overrode.' },
  { id: 'DEC-007', timestamp: '2024-10-28 13:15', agentId: 'MET-001', agentName: 'MET #001', decisionType: 'Agent Scaling',          confidenceScore: 91, autonomyLevel: 4, outcome: 'success',    details: 'Scaled sensing agents from 6 to 8 for peak hour demand' },
  { id: 'DEC-008', timestamp: '2024-10-28 12:50', agentId: 'EXE-003', agentName: 'EXE #003', decisionType: 'Payment Execution',      confidenceScore: 98, autonomyLevel: 5, outcome: 'success',    details: 'Processed early payment to Pacific Supply — captured 2% discount' },
];

export const disputes: Dispute[] = [
  { id: 'DSP-001', decisionId: 'DEC-003', raisedBy: 'Finance Team',    reason: 'Invoice may be legitimate — vendor confirmed shipment',    status: 'open',      priority: 'high',   createdAt: '2024-10-28 14:20' },
  { id: 'DSP-002', decisionId: 'DEC-006', raisedBy: 'Ops Manager',     reason: 'Equipment is critical for kitchen renovation deadline',    status: 'escalated', priority: 'high',   createdAt: '2024-10-28 13:35' },
  { id: 'DSP-003', decisionId: 'DEC-002', raisedBy: 'Procurement Lead', reason: 'BeanHouse already offered 10% — agent accepted 8%',       status: 'open',      priority: 'medium', createdAt: '2024-10-28 14:30' },
];

// ── Infrastructure Services ──────────────────────────────────

export const infrastructureServices: ServiceIndicator[] = [
  { id: 'SVC-KRN', label: 'Kernel',        status: 'healthy' },
  { id: 'SVC-EVT', label: 'Event Bus',     status: 'healthy' },
  { id: 'SVC-TRU', label: 'Trust',         status: 'healthy' },
  { id: 'SVC-MEM', label: 'Memory',        status: 'healthy' },
  { id: 'SVC-MDL', label: 'Model Gateway', status: 'healthy' },
  { id: 'SVC-TOL', label: 'Tool Registry', status: 'healthy' },
  { id: 'SVC-DAG', label: 'DAG Engine',    status: 'healthy' },
];

// ═════════════════════════════════════════════════════════════
// ── Finn's Canonical Mock Data ───────────────────────────────
// ═════════════════════════════════════════════════════════════

// ── Venues (4) ───────────────────────────────────────────────

export const finnsVenues: VenueDefinition[] = [
  { tag: 'BC', name: 'Beach Club',       type: 'beach club',       description: 'Flagship beach club — high-volume bar, casual F&B, large daily covers.' },
  { tag: 'RC', name: 'Recreation Club',  type: 'recreation club',  description: 'Member-only club — F&B + retail, multi-day events.' },
  { tag: 'ST', name: 'Stake',            type: 'fine dining',      description: 'Fine-dining restaurant — premium proteins, smaller volumes, higher-spec sourcing.' },
  { tag: 'SP', name: 'Splash Waterpark', type: 'waterpark',        description: 'Waterpark concessions — high-volume QSR, beverages, packaged goods.' },
];

// ── Agents (6: Atlas chat copilot + A-01..A-05) ──────────────
// Atlas is intentionally NOT in this array — it has no profile and no hash.

export const finnsAgents: FinnsAgent[] = [
  {
    id: 'A-01',
    name: 'Sourcing Agent',
    role: 'Sourcing Agent',
    description: 'Picks vendors for new requests, validates quotes against market prices, surfaces alternative suppliers.',
    status: 'active',
    performanceBand: 'green',
    tasksCompletedToday: 18,
    recentDecisions: ['evt-001', 'evt-004', 'evt-007'],
  },
  {
    id: 'A-02',
    name: 'Restock Agent',
    role: 'Restock Agent',
    description: 'Watches par levels and consumption velocity, proposes restocks before stockout, prioritizes by venue demand.',
    status: 'active',
    performanceBand: 'green',
    tasksCompletedToday: 26,
    recentDecisions: ['evt-002', 'evt-005', 'evt-009'],
  },
  {
    id: 'A-03',
    name: 'Vendor Comms Agent',
    role: 'Vendor Comms Agent',
    description: 'Drafts and sends WhatsApp / Telegram messages to suppliers via the Source Bridge. Handles 1-on-1 and broadcast announcements.',
    status: 'active',
    performanceBand: 'green',
    tasksCompletedToday: 12,
    recentDecisions: ['evt-003', 'evt-008'],
  },
  {
    id: 'A-04',
    name: 'Spend Watchdog',
    role: 'Spend Watchdog',
    description: 'Flags overspend, unusual cost spikes, duplicate invoices, and gates POs against active policy rules.',
    status: 'active',
    performanceBand: 'amber',
    tasksCompletedToday: 9,
    recentDecisions: ['evt-006', 'evt-010', 'evt-012'],
  },
  {
    id: 'A-05',
    name: 'Logistics Agent',
    role: 'Logistics Agent',
    description: 'Owns the In Transit → Delivered & Checked stages. Tracks shipments, surfaces delivery risk, escalates late or failed deliveries.',
    status: 'active',
    performanceBand: 'green',
    tasksCompletedToday: 14,
    recentDecisions: ['evt-011'],
  },
];

// ── Playbooks (3) ────────────────────────────────────────────

export const finnsPlaybooks: Playbook[] = [
  {
    id: 'WF-STD',
    name: 'Standard',
    description: 'Default playbook for every non-urgent, non-recurring request. Full RFQ + vendor selection cycle.',
    whenItRuns: 'Used for any new request that is not urgency=urgent and not flagged as recurring.',
    complexity: 'standard',
    activeOrderCount: 24,
    avgDurationHours: 96,
    savingsVsBaseline: 14,
    stages: [
      { stage: 1, name: 'Request',                  owningAgent: 'A-02', description: 'Demand signal raised — par breach, scheduled trigger, or human request.', throughputPerHour: 12 },
      { stage: 2, name: 'Quote / Vendor Confirmed', owningAgent: 'A-01', description: 'RFQ broadcast to ≥3 vendors via WhatsApp (or email for formal vendors). Quotes return as chat / email replies, validated against 30-day market median.', throughputPerHour: 10 },
      { stage: 3, name: 'PO Approved',              owningAgent: 'A-04', description: 'Policy checks: spend cap, vendor trust, duplicate detection. Above threshold → human gate. PO PDF sent back to vendor via their preferred channel.', throughputPerHour: 14 },
      { stage: 4, name: 'In Transit',               owningAgent: 'A-05', description: 'Vendor confirms shipment via WhatsApp (driver photo + plate number typical). ETA tracked. Late/risk signals surfaced.', throughputPerHour: 8 },
      { stage: 5, name: 'Delivered & Checked',      owningAgent: 'A-05', description: 'Delivery received at target venue. Receiving lead pings A-05 via WhatsApp with QC photo. Pass → completed; fail → dispute.', throughputPerHour: 6 },
    ],
  },
  {
    id: 'WF-RSH',
    name: 'Rush',
    description: 'Expedited path for urgent requests. Skips RFQ; goes direct to preferred vendor with up to 12% premium tolerated.',
    whenItRuns: 'Marked urgent at request time, OR auto-promoted by Restock Agent when par floor is breached.',
    complexity: 'simple',
    activeOrderCount: 6,
    avgDurationHours: 18,
    savingsVsBaseline: 4,
    stages: [
      { stage: 1, name: 'Request',                  owningAgent: 'A-02', description: 'Urgency=urgent OR par floor breach detected.', throughputPerHour: 18 },
      { stage: 2, name: 'Quote / Vendor Confirmed', owningAgent: 'A-01', description: 'Skips RFQ. Direct WhatsApp / call to preferred vendor. Quote confirmed verbally then backed by a follow-up WhatsApp message. Price up to 12% over market tolerated.', throughputPerHour: 20 },
      { stage: 3, name: 'PO Approved',              owningAgent: 'A-04', description: 'Streamlined policy check. Auto-approves under standard spend cap. PO confirmation pinged to vendor via WhatsApp.', throughputPerHour: 22 },
      { stage: 4, name: 'In Transit',               owningAgent: 'A-05', description: 'Expedited shipping flag set. Live driver location pings via WhatsApp every 30 min.', throughputPerHour: 16 },
      { stage: 5, name: 'Delivered & Checked',      owningAgent: 'A-05', description: 'Receiving lead photo-confirms on WhatsApp the moment goods land. Standard QC at receiving venue.', throughputPerHour: 12 },
    ],
  },
  {
    id: 'WF-REC',
    name: 'Recurring',
    description: 'Standing orders for high-velocity SKUs. Runs on schedule, requires no human approval until spend cap is hit.',
    whenItRuns: 'Standing weekly / biweekly / monthly orders from existing vendors (e.g. PT Indo Sayur weekly produce for Beach Club kitchen).',
    complexity: 'simple',
    activeOrderCount: 11,
    avgDurationHours: 72,
    savingsVsBaseline: 8,
    stages: [
      { stage: 1, name: 'Request',                  owningAgent: 'A-02', description: 'Scheduled trigger fires (weekly / biweekly / monthly).', throughputPerHour: 4 },
      { stage: 2, name: 'Quote / Vendor Confirmed', owningAgent: 'A-01', description: 'Standing WhatsApp agreement with the vendor — no new RFQ. Email used only when invoice / receipt is needed for finance.', throughputPerHour: 30 },
      { stage: 3, name: 'PO Approved',              owningAgent: 'A-04', description: 'Auto-approved up to active spend cap. Paused if cap hit. Confirmation forwarded to vendor WhatsApp.', throughputPerHour: 28 },
      { stage: 4, name: 'In Transit',               owningAgent: 'A-05', description: 'Standard tracking. Vendor sends a WhatsApp ping when the truck leaves.', throughputPerHour: 10 },
      { stage: 5, name: 'Delivered & Checked',      owningAgent: 'A-05', description: 'Standard QC at receiving venue. Receiving lead WhatsApps the QC photo to close the loop.', throughputPerHour: 8 },
    ],
  },
];

// ── Suppliers (10) ───────────────────────────────────────────

export const finnsSuppliers: FinnsSupplier[] = [
  {
    id: 'SUP-014', name: 'PT Bali Seafood Lestari', type: 'local', region: 'Bali',
    categories: ['Seafood'], venuesServed: ['BC', 'ST', 'RC'],
    laborMode: 'auto', agent: 'A-01',
    accountManager: { name: 'Wayan Sukma', whatsapp: '+62 812 3456 7890', telegram: '@wayanseafood' },
    metrics: { composite: 92, onTime: 96, coldChain: 98, quality: 94, leadTimeDays: 1, annualContractIdr: 2_100_000_000 },
    status: 'active', qcAlerts: [],
  },
  {
    id: 'SUP-021', name: 'CV Indo Sayur', type: 'local', region: 'Bali',
    categories: ['Produce'], venuesServed: ['BC', 'RC', 'SP'],
    laborMode: 'auto', agent: 'A-01',
    accountManager: { name: 'Pak Made', whatsapp: '+62 813 5555 1234' },
    metrics: { composite: 88, onTime: 91, coldChain: 86, quality: 90, leadTimeDays: 1, annualContractIdr: 1_400_000_000 },
    status: 'active', qcAlerts: [],
  },
  {
    id: 'SUP-008', name: 'Krakatoa Coldstore', type: 'regional', region: 'Java',
    categories: ['Protein', 'Seafood'], venuesServed: ['BC', 'ST', 'RC'],
    laborMode: 'auto', agent: 'A-01',
    accountManager: { name: 'Budi Hartono', whatsapp: '+62 821 9876 5432', telegram: '@krakatoacold' },
    metrics: { composite: 85, onTime: 89, coldChain: 94, quality: 92, leadTimeDays: 2, annualContractIdr: 3_400_000_000 },
    status: 'active', qcAlerts: [],
  },
  {
    id: 'SUP-031', name: 'Bintang Distribusi', type: 'regional', region: 'Java',
    categories: ['Beverages'], venuesServed: ['BC', 'RC', 'ST', 'SP'],
    laborMode: 'auto', agent: 'A-03',
    accountManager: { name: 'Andi Wijaya', whatsapp: '+62 811 2233 4455' },
    metrics: { composite: 90, onTime: 95, coldChain: 88, quality: 91, leadTimeDays: 2, annualContractIdr: 4_800_000_000 },
    status: 'active', qcAlerts: [],
  },
  {
    id: 'SUP-007', name: 'Sumber Dairy', type: 'regional', region: 'East Java',
    categories: ['Dairy'], venuesServed: ['BC', 'RC', 'SP'],
    laborMode: 'auto', agent: 'A-01',
    accountManager: { name: 'Sari Wahyuni', whatsapp: '+62 815 6677 8899' },
    metrics: { composite: 87, onTime: 92, coldChain: 95, quality: 88, leadTimeDays: 2, annualContractIdr: 1_900_000_000 },
    status: 'active', qcAlerts: [],
  },
  {
    id: 'SUP-042', name: 'PT Wine Cellar Nusa', type: 'import', region: 'Australia / France',
    categories: ['Beverages'], venuesServed: ['ST', 'RC'],
    laborMode: 'manual', agent: 'A-01',
    accountManager: { name: 'Helena Mardiana', whatsapp: '+62 818 4321 9876', telegram: '@winecellarnusa' },
    metrics: { composite: 81, onTime: 84, coldChain: 90, quality: 95, leadTimeDays: 14, annualContractIdr: 5_200_000_000 },
    status: 'watchlist', qcAlerts: [],
  },
  {
    id: 'SUP-018', name: 'Eka Packaging', type: 'local', region: 'Bali',
    categories: ['Other'], venuesServed: ['BC', 'RC', 'SP'],
    laborMode: 'auto', agent: 'A-01',
    accountManager: { name: 'Eka Ratnasari', whatsapp: '+62 812 7777 8888' },
    metrics: { composite: 78, onTime: 82, coldChain: 100, quality: 80, leadTimeDays: 3, annualContractIdr: 620_000_000 },
    status: 'active', qcAlerts: [],
  },
  {
    id: 'SUP-009', name: 'AUS Premium Meats', type: 'import', region: 'Australia',
    categories: ['Protein'], venuesServed: ['ST', 'BC'],
    laborMode: 'auto', agent: 'A-01',
    accountManager: { name: 'James Whitford', whatsapp: '+61 4 1234 5678' },
    metrics: { composite: 89, onTime: 87, coldChain: 96, quality: 97, leadTimeDays: 10, annualContractIdr: 6_800_000_000 },
    status: 'active', qcAlerts: [],
  },
  {
    id: 'SUP-027', name: 'Kopi Bali Roastery', type: 'local', region: 'Bali',
    categories: ['Beverages', 'Dry Goods'], venuesServed: ['BC', 'RC', 'ST', 'SP'],
    laborMode: 'auto', agent: 'A-01',
    accountManager: { name: 'Ketut Astawa', whatsapp: '+62 819 5555 6666', telegram: '@kopibalir' },
    metrics: { composite: 93, onTime: 96, coldChain: 100, quality: 95, leadTimeDays: 1, annualContractIdr: 1_100_000_000 },
    status: 'active', qcAlerts: [],
  },
  {
    id: 'SUP-052', name: 'Pulau Dry Goods', type: 'local', region: 'Bali',
    categories: ['Dry Goods'], venuesServed: ['BC', 'RC', 'SP'],
    laborMode: 'auto', agent: 'A-01',
    accountManager: { name: 'Nyoman Suparta', whatsapp: '+62 813 1111 2222' },
    metrics: { composite: 84, onTime: 90, coldChain: 100, quality: 86, leadTimeDays: 2, annualContractIdr: 880_000_000 },
    status: 'active', qcAlerts: [],
  },
];

// ── SKUs (24) ────────────────────────────────────────────────

export const finnsSKUs: FinnsSKU[] = [
  // Seafood
  { id: 'SKU-0421', name: 'Yellowfin Tuna (sashimi grade)', category: 'Seafood', venues: ['ST'],                     uom: 'kg',   onHand: 8,   par: 12,  burnRate: 4.2,  daysOfCover: 1.9,  agent: 'A-02', laborMode: 'auto', latestPO: 'PO-3041' },
  { id: 'SKU-0422', name: 'Yellowfin Tuna (food grade)',    category: 'Seafood', venues: ['BC', 'RC'],               uom: 'kg',   onHand: 22,  par: 30,  burnRate: 7.5,  daysOfCover: 2.9,  agent: 'A-02', laborMode: 'auto', latestPO: 'PO-3041' },
  { id: 'SKU-0423', name: 'Prawns (large, head-on)',        category: 'Seafood', venues: ['BC', 'ST', 'RC'],         uom: 'kg',   onHand: 14,  par: 25,  burnRate: 6.8,  daysOfCover: 2.1,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0424', name: 'Mahi Mahi fillets',              category: 'Seafood', venues: ['BC', 'ST'],               uom: 'kg',   onHand: 18,  par: 20,  burnRate: 4.0,  daysOfCover: 4.5,  agent: 'A-02', laborMode: 'auto' },

  // Protein
  { id: 'SKU-0101', name: 'AUS Wagyu Ribeye MB7+',          category: 'Protein', venues: ['ST'],                     uom: 'kg',   onHand: 5,   par: 8,   burnRate: 1.8,  daysOfCover: 2.8,  agent: 'A-02', laborMode: 'auto', latestPO: 'PO-3043' },
  { id: 'SKU-0102', name: 'Pork Belly, skin-on',            category: 'Protein', venues: ['BC', 'RC'],               uom: 'kg',   onHand: 28,  par: 35,  burnRate: 8.4,  daysOfCover: 3.3,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0103', name: 'Chicken thighs, boneless',       category: 'Protein', venues: ['BC', 'RC', 'SP'],         uom: 'kg',   onHand: 42,  par: 50,  burnRate: 12.6, daysOfCover: 3.3,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0104', name: 'Lamb rack, frenched',            category: 'Protein', venues: ['ST'],                     uom: 'kg',   onHand: 9,   par: 12,  burnRate: 2.4,  daysOfCover: 3.8,  agent: 'A-02', laborMode: 'auto' },

  // Produce
  { id: 'SKU-0201', name: 'Mixed greens (rocket, lettuce)', category: 'Produce', venues: ['BC', 'RC', 'ST'],         uom: 'kg',   onHand: 15,  par: 18,  burnRate: 6.0,  daysOfCover: 2.5,  agent: 'A-02', laborMode: 'auto', latestPO: 'PO-3042' },
  { id: 'SKU-0202', name: 'Tomatoes, vine-ripened',         category: 'Produce', venues: ['BC', 'RC', 'ST', 'SP'],   uom: 'kg',   onHand: 36,  par: 40,  burnRate: 11.0, daysOfCover: 3.3,  agent: 'A-02', laborMode: 'auto', latestPO: 'PO-3042' },
  { id: 'SKU-0203', name: 'Avocado, hass',                  category: 'Produce', venues: ['BC', 'RC'],               uom: 'kg',   onHand: 24,  par: 28,  burnRate: 7.0,  daysOfCover: 3.4,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0204', name: 'Lime, key',                      category: 'Produce', venues: ['BC', 'RC', 'ST', 'SP'],   uom: 'kg',   onHand: 32,  par: 35,  burnRate: 9.5,  daysOfCover: 3.4,  agent: 'A-02', laborMode: 'auto' },

  // Dairy
  { id: 'SKU-0301', name: 'Butter, salted (Anchor)',        category: 'Dairy',   venues: ['BC', 'RC', 'ST', 'SP'],   uom: 'kg',   onHand: 24,  par: 30,  burnRate: 6.8,  daysOfCover: 3.5,  agent: 'A-02', laborMode: 'auto', latestPO: 'PO-3045' },
  { id: 'SKU-0302', name: 'Burrata',                        category: 'Dairy',   venues: ['ST'],                     uom: 'pcs',  onHand: 12,  par: 18,  burnRate: 4.0,  daysOfCover: 3.0,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0303', name: 'Milk, whole UHT (1L)',           category: 'Dairy',   venues: ['BC', 'RC', 'SP'],         uom: 'L',    onHand: 78,  par: 100, burnRate: 26.0, daysOfCover: 3.0,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0304', name: 'Cream, heavy (1L)',              category: 'Dairy',   venues: ['BC', 'RC', 'ST'],         uom: 'L',    onHand: 18,  par: 24,  burnRate: 6.5,  daysOfCover: 2.8,  agent: 'A-02', laborMode: 'auto' },

  // Beverages
  { id: 'SKU-0501', name: 'Bintang Beer 330ml (case 24)',   category: 'Beverages', venues: ['BC', 'RC', 'SP'],       uom: 'case', onHand: 84,  par: 100, burnRate: 32.0, daysOfCover: 2.6,  agent: 'A-02', laborMode: 'auto', latestPO: 'PO-3044' },
  { id: 'SKU-0502', name: 'Prosecco, Treviso DOC (750ml)',  category: 'Beverages', venues: ['RC', 'ST'],             uom: 'btl',  onHand: 96,  par: 120, burnRate: 22.0, daysOfCover: 4.4,  agent: 'A-02', laborMode: 'auto', latestPO: 'PO-3046' },
  { id: 'SKU-0503', name: 'House red, Shiraz (AU)',         category: 'Beverages', venues: ['RC', 'ST'],             uom: 'btl',  onHand: 64,  par: 80,  burnRate: 14.0, daysOfCover: 4.6,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0504', name: 'Coca-Cola 330ml (case 24)',      category: 'Beverages', venues: ['BC', 'SP', 'RC'],       uom: 'case', onHand: 56,  par: 80,  burnRate: 25.0, daysOfCover: 2.2,  agent: 'A-02', laborMode: 'auto' },

  // Dry Goods
  { id: 'SKU-0601', name: 'Olive oil, EV (5L tin)',         category: 'Dry Goods', venues: ['BC', 'RC', 'ST'],       uom: 'tin',  onHand: 14,  par: 18,  burnRate: 2.4,  daysOfCover: 5.8,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0602', name: 'Jasmine rice (25kg sack)',       category: 'Dry Goods', venues: ['BC', 'RC', 'SP'],       uom: 'sack', onHand: 22,  par: 30,  burnRate: 4.5,  daysOfCover: 4.9,  agent: 'A-02', laborMode: 'auto' },
  { id: 'SKU-0603', name: 'Kopi Bali roasted (1kg)',        category: 'Dry Goods', venues: ['BC', 'RC', 'ST', 'SP'], uom: 'kg',   onHand: 38,  par: 45,  burnRate: 8.0,  daysOfCover: 4.8,  agent: 'A-02', laborMode: 'auto' },

  // Packaging / Other
  { id: 'SKU-0801', name: 'Takeaway box, 1000ml (case 100)', category: 'Other',   venues: ['BC', 'SP', 'RC'],        uom: 'case', onHand: 24,  par: 30,  burnRate: 5.5,  daysOfCover: 4.4,  agent: 'A-02', laborMode: 'auto' },
];

// ── Live Orders (7) ──────────────────────────────────────────

const _today = '2026-05-16';
const _yesterday = '2026-05-15';
const _twoDaysAgo = '2026-05-14';

export const finnsLiveOrders: FinnsOrder[] = [
  {
    id: 'PO-3041', supplier: 'PT Bali Seafood Lestari', supplierId: 'SUP-014',
    managedBy: 'A-01', amount: 14_200_000, currency: 'IDR', venues: ['BC', 'ST'],
    category: 'Seafood', workflowTemplate: 'WF-STD',
    stage: 2, status: 'live', laborMode: 'auto',
    trace: [
      { stage: 1, outcome: 'complete', agent: 'A-02', startedAt: _yesterday, completedAt: _yesterday },
      { stage: 2, outcome: 'in-progress', agent: 'A-01', startedAt: _yesterday },
      { stage: 3, outcome: 'pending' },
      { stage: 4, outcome: 'pending' },
      { stage: 5, outcome: 'pending' },
    ],
    humanDescription: 'Quote awaiting Spend Watchdog approval — yellowfin tuna for BC + ST',
    createdAt: _yesterday, eta: '2026-05-17',
  },
  {
    id: 'PO-3042', supplier: 'CV Indo Sayur', supplierId: 'SUP-021',
    managedBy: 'A-02', amount: 4_800_000, currency: 'IDR', venues: ['BC', 'SP'],
    category: 'Produce', workflowTemplate: 'WF-REC',
    stage: 3, status: 'live', laborMode: 'auto',
    trace: [
      { stage: 1, outcome: 'complete', agent: 'A-02', startedAt: _twoDaysAgo, completedAt: _twoDaysAgo },
      { stage: 2, outcome: 'complete', agent: 'A-01', startedAt: _twoDaysAgo, completedAt: _yesterday },
      { stage: 3, outcome: 'in-progress', agent: 'A-04', startedAt: _yesterday },
      { stage: 4, outcome: 'pending' },
      { stage: 5, outcome: 'pending' },
    ],
    humanDescription: 'Recurring weekly produce — auto-approved by spend cap',
    createdAt: _twoDaysAgo, eta: '2026-05-17',
    recurring: { frequency: 'weekly', nextRun: '2026-05-23' },
  },
  {
    id: 'PO-3043', supplier: 'AUS Premium Meats', supplierId: 'SUP-009',
    managedBy: 'A-01', amount: 28_500_000, currency: 'IDR', amountUsd: 1840, fxRateAtQuote: 15490, venues: ['ST'],
    category: 'Protein', workflowTemplate: 'WF-RSH',
    stage: 1, status: 'live', laborMode: 'auto',
    trace: [
      { stage: 1, outcome: 'in-progress', agent: 'A-02', startedAt: _today },
      { stage: 2, outcome: 'pending' },
      { stage: 3, outcome: 'pending' },
      { stage: 4, outcome: 'pending' },
      { stage: 5, outcome: 'pending' },
    ],
    humanDescription: 'Urgent — Wagyu ribeye for ST, par floor breached',
    createdAt: _today,
  },
  {
    id: 'PO-3044', supplier: 'Bintang Distribusi', supplierId: 'SUP-031',
    managedBy: 'A-05', amount: 9_400_000, currency: 'IDR', venues: ['BC', 'SP', 'RC'],
    category: 'Beverages', workflowTemplate: 'WF-STD',
    stage: 4, status: 'live', laborMode: 'auto',
    trace: [
      { stage: 1, outcome: 'complete', agent: 'A-02', startedAt: '2026-05-12', completedAt: '2026-05-12' },
      { stage: 2, outcome: 'complete', agent: 'A-01', startedAt: '2026-05-12', completedAt: '2026-05-13' },
      { stage: 3, outcome: 'complete', agent: 'A-04', startedAt: '2026-05-13', completedAt: '2026-05-14' },
      { stage: 4, outcome: 'in-progress', agent: 'A-05', startedAt: _yesterday },
      { stage: 5, outcome: 'pending' },
    ],
    humanDescription: 'In transit — Bintang case x180 for BC + SP + RC',
    createdAt: '2026-05-12', eta: _today,
  },
  {
    id: 'PO-3045', supplier: 'Sumber Dairy', supplierId: 'SUP-007',
    managedBy: 'A-05', amount: 3_200_000, currency: 'IDR', venues: ['BC', 'RC'],
    category: 'Dairy', workflowTemplate: 'WF-STD',
    stage: 5, status: 'live', laborMode: 'auto',
    trace: [
      { stage: 1, outcome: 'complete', agent: 'A-02', startedAt: '2026-05-13', completedAt: '2026-05-13' },
      { stage: 2, outcome: 'complete', agent: 'A-01', startedAt: '2026-05-13', completedAt: '2026-05-14' },
      { stage: 3, outcome: 'complete', agent: 'A-04', startedAt: '2026-05-14', completedAt: '2026-05-14' },
      { stage: 4, outcome: 'complete', agent: 'A-05', startedAt: '2026-05-15', completedAt: _today },
      { stage: 5, outcome: 'in-progress', agent: 'A-05', startedAt: _today },
    ],
    humanDescription: 'Delivered — awaiting QC checkin at BC + RC',
    createdAt: '2026-05-13', eta: _today, deliveredAt: _today,
  },
  {
    id: 'PO-3046', supplier: 'PT Wine Cellar Nusa', supplierId: 'SUP-042',
    managedBy: 'A-05', amount: 42_000_000, currency: 'IDR', amountUsd: 2710, fxRateAtQuote: 15500, venues: ['RC', 'ST'],
    category: 'Beverages', workflowTemplate: 'WF-STD',
    stage: 4, status: 'live', laborMode: 'manual',
    trace: [
      { stage: 1, outcome: 'complete', agent: 'A-02', startedAt: '2026-05-02', completedAt: '2026-05-02' },
      { stage: 2, outcome: 'complete', agent: 'A-01', startedAt: '2026-05-03', completedAt: '2026-05-05' },
      { stage: 3, outcome: 'complete', agent: 'A-04', startedAt: '2026-05-05', completedAt: '2026-05-06' },
      { stage: 4, outcome: 'in-progress', agent: 'A-05', startedAt: '2026-05-07' },
      { stage: 5, outcome: 'pending' },
    ],
    humanDescription: 'Imported wine — extended transit, customs cleared 2 days ago',
    createdAt: '2026-05-02', eta: '2026-05-18',
  },
  {
    id: 'PO-3047', supplier: 'Eka Packaging', supplierId: 'SUP-018',
    managedBy: 'A-04', amount: 18_900_000, currency: 'IDR', venues: ['SP'],
    category: 'Other', workflowTemplate: 'WF-STD',
    stage: 2, status: 'disputed', laborMode: 'manual',
    trace: [
      { stage: 1, outcome: 'complete', agent: 'A-02', startedAt: _twoDaysAgo, completedAt: _twoDaysAgo },
      { stage: 2, outcome: 'failed', agent: 'A-01', startedAt: _yesterday, completedAt: _yesterday,
        dataPoints: { 'Quote vs market median': '+18%', 'Vendor trust score': '78' } },
      { stage: 3, outcome: 'pending' },
      { stage: 4, outcome: 'pending' },
      { stage: 5, outcome: 'pending' },
    ],
    humanDescription: 'Quote flagged 18% above market by Spend Watchdog — awaiting dispute resolution',
    createdAt: _twoDaysAgo,
  },
];

// ── Historical Orders (8 completed/disputed/cancelled across last 90 days) ─

export const finnsHistoricalOrders: FinnsOrder[] = [
  {
    id: 'PO-2988', supplier: 'PT Bali Seafood Lestari', supplierId: 'SUP-014',
    managedBy: 'A-01', amount: 12_400_000, currency: 'IDR', venues: ['BC', 'ST'],
    category: 'Seafood', workflowTemplate: 'WF-STD',
    stage: 5, status: 'completed', laborMode: 'auto', trace: [],
    humanDescription: 'Tuna delivery for BC + ST', createdAt: '2026-05-08', deliveredAt: '2026-05-10',
    qcOutcome: 'pass',
  },
  {
    id: 'PO-2989', supplier: 'CV Indo Sayur', supplierId: 'SUP-021',
    managedBy: 'A-02', amount: 4_600_000, currency: 'IDR', venues: ['BC', 'SP'],
    category: 'Produce', workflowTemplate: 'WF-REC',
    stage: 5, status: 'completed', laborMode: 'auto', trace: [],
    humanDescription: 'Weekly produce — recurring', createdAt: '2026-05-06', deliveredAt: '2026-05-09',
    qcOutcome: 'pass',
  },
  {
    id: 'PO-2990', supplier: 'Krakatoa Coldstore', supplierId: 'SUP-008',
    managedBy: 'A-01', amount: 22_000_000, currency: 'IDR', venues: ['BC', 'RC'],
    category: 'Protein', workflowTemplate: 'WF-STD',
    stage: 5, status: 'completed', laborMode: 'auto', trace: [],
    humanDescription: 'Pork belly + chicken thighs bulk', createdAt: '2026-05-04', deliveredAt: '2026-05-07',
    qcOutcome: 'pass',
  },
  {
    id: 'PO-2991', supplier: 'Bintang Distribusi', supplierId: 'SUP-031',
    managedBy: 'A-03', amount: 8_900_000, currency: 'IDR', venues: ['BC', 'SP'],
    category: 'Beverages', workflowTemplate: 'WF-STD',
    stage: 5, status: 'disputed', laborMode: 'auto', trace: [],
    humanDescription: 'Short delivery — 12 cases missing', createdAt: '2026-05-01', deliveredAt: '2026-05-04',
    qcOutcome: 'fail',
  },
  {
    id: 'PO-2992', supplier: 'Sumber Dairy', supplierId: 'SUP-007',
    managedBy: 'A-05', amount: 3_400_000, currency: 'IDR', venues: ['BC', 'RC', 'SP'],
    category: 'Dairy', workflowTemplate: 'WF-STD',
    stage: 5, status: 'completed', laborMode: 'auto', trace: [],
    humanDescription: 'Dairy run — burrata + butter', createdAt: '2026-04-28', deliveredAt: '2026-05-01',
    qcOutcome: 'pass',
  },
  {
    id: 'PO-2993', supplier: 'AUS Premium Meats', supplierId: 'SUP-009',
    managedBy: 'A-01', amount: 31_200_000, currency: 'IDR', amountUsd: 2010, fxRateAtQuote: 15522, venues: ['ST'],
    category: 'Protein', workflowTemplate: 'WF-STD',
    stage: 5, status: 'completed', laborMode: 'auto', trace: [],
    humanDescription: 'Wagyu MB7+ for Stake monthly', createdAt: '2026-04-20', deliveredAt: '2026-04-30',
    qcOutcome: 'pass',
  },
  {
    id: 'PO-2994', supplier: 'Kopi Bali Roastery', supplierId: 'SUP-027',
    managedBy: 'A-01', amount: 6_800_000, currency: 'IDR', venues: ['BC', 'RC', 'ST', 'SP'],
    category: 'Beverages', workflowTemplate: 'WF-REC',
    stage: 5, status: 'completed', laborMode: 'auto', trace: [],
    humanDescription: 'Biweekly coffee — all venues', createdAt: '2026-04-22', deliveredAt: '2026-04-23',
    qcOutcome: 'pass',
  },
  {
    id: 'PO-2995', supplier: 'Pulau Dry Goods', supplierId: 'SUP-052',
    managedBy: 'A-01', amount: 5_400_000, currency: 'IDR', venues: ['BC', 'SP'],
    category: 'Dry Goods', workflowTemplate: 'WF-STD',
    stage: 1, status: 'cancelled', laborMode: 'manual', trace: [],
    humanDescription: 'Cancelled by manager — duplicate of PO-2989', createdAt: '2026-04-25',
  },
];

// ── Activity Events (12) ─────────────────────────────────────

export const finnsActivityEvents: ActivityEvent[] = [
  {
    id: 'evt-001', type: 'auto-order', agentId: 'A-01', at: _today, category: 'Seafood', venue: 'Multi',
    poId: 'PO-3041', supplierId: 'SUP-014', confidence: 92, outcome: 'pending',
    reasoning: {
      why: 'Selected PT Bali Seafood after 30-day median comparison. Quote 4% below market, lead time 1d, cold-chain SLA 98%.',
      dataPoints: [
        { label: 'Quote vs 30d median', value: '−4%', delta: -4 },
        { label: 'Lead time',           value: '1 day' },
        { label: 'Cold-chain SLA',      value: '98%' },
      ],
      alternatives: [
        { label: 'Krakatoa Coldstore',  rejectedBecause: 'Lead time 2 days exceeds receiving window for ST evening service.' },
      ],
    },
    undoWindow: { mode: 'hard-60', expiresAt: '2026-05-16T15:30:00Z' },
  },
  {
    id: 'evt-002', type: 'restock-forecast', agentId: 'A-02', at: _today, category: 'Protein', venue: 'ST',
    skuId: 'SKU-0101', supplierId: 'SUP-009', confidence: 88, outcome: 'pending',
    reasoning: {
      why: 'Wagyu ribeye on hand 5kg vs par 8kg, burn rate +12% from prior 2 weeks (Stake bookings up). Promoted to Rush.',
      dataPoints: [
        { label: 'On hand vs par',  value: '5 / 8 kg' },
        { label: 'Burn rate change', value: '+12%', delta: 12 },
        { label: 'Booking trend',   value: 'Stake +18% wk/wk' },
      ],
      alternatives: [
        { label: 'Standard playbook', rejectedBecause: 'Par floor breach risk within 2 days; Standard avg cycle is 96 hours.' },
      ],
    },
    undoWindow: { mode: 'hard-60' },
  },
  {
    id: 'evt-003', type: 'vendor-rejection', agentId: 'A-01', at: _yesterday, category: 'Other', venue: 'SP',
    poId: 'PO-3047', supplierId: 'SUP-018', confidence: 78, outcome: 'failed',
    reasoning: {
      why: 'Quote +18% over 30d median triggered Spend Watchdog. Eka Packaging cited supply shortage.',
      dataPoints: [
        { label: 'Quote vs market', value: '+18%', delta: 18 },
        { label: 'Trust score',     value: '78' },
      ],
      alternatives: [
        { label: 'Pulau Dry Goods', rejectedBecause: 'Does not carry the 1000ml takeaway box SKU.' },
      ],
    },
    undoWindow: { mode: 'hard-60' },
  },
  {
    id: 'evt-004', type: 'auto-order', agentId: 'A-01', at: '2026-05-15', category: 'Produce', venue: 'Multi',
    poId: 'PO-3042', supplierId: 'SUP-021', confidence: 95, outcome: 'success',
    reasoning: {
      why: 'Recurring weekly trigger fired for CV Indo Sayur. Vendor contract active, spend cap untouched.',
      dataPoints: [
        { label: 'Recurring schedule', value: 'Weekly · Mon 06:00' },
        { label: 'Spend cap usage',    value: '34% of monthly' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'ledger-close' },
  },
  {
    id: 'evt-005', type: 'restock-forecast', agentId: 'A-02', at: '2026-05-15', category: 'Beverages', venue: 'BC',
    skuId: 'SKU-0501', confidence: 86, outcome: 'success',
    reasoning: {
      why: 'Bintang case on-hand 84, par 100, burn rate trending up 8% (long weekend forecast). Restock proposed.',
      dataPoints: [
        { label: 'Days of cover',  value: '2.6 days' },
        { label: 'Weekend signal', value: '+8% expected' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'hard-60' },
  },
  {
    id: 'evt-006', type: 'spend-flag', agentId: 'A-04', at: '2026-05-15', category: 'Other', venue: 'SP',
    poId: 'PO-3047', confidence: 91, outcome: 'overridden',
    reasoning: {
      why: 'Quote 18% above market median triggered hold under standing Spend Cap rule RUL-001.',
      dataPoints: [
        { label: 'Variance',     value: '+18%' },
        { label: 'Rule fired',   value: 'RUL-001 Spend Cap' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'hard-60' },
    override: { actor: 'user', reason: 'Splash needs the takeaway boxes for Saturday event — accept premium', at: _yesterday },
  },
  {
    id: 'evt-007', type: 'auto-order', agentId: 'A-01', at: '2026-05-14', category: 'Beverages', venue: 'Multi',
    poId: 'PO-3044', supplierId: 'SUP-031', confidence: 89, outcome: 'success',
    reasoning: {
      why: 'Multi-venue Bintang order auto-issued. BC + SP + RC consumption signals aligned.',
      dataPoints: [
        { label: 'Venue split',  value: 'BC 50% / SP 30% / RC 20%' },
        { label: 'Vendor score', value: '90 composite' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'hard-60' },
  },
  {
    id: 'evt-008', type: 'auto-order', agentId: 'A-03', at: '2026-05-14', category: 'Seafood', venue: 'Multi',
    supplierId: 'SUP-014', confidence: 83, outcome: 'success',
    reasoning: {
      why: 'WhatsApp message sent to Wayan Sukma confirming PO-3041 quote details. Read receipt at 14:08.',
      dataPoints: [
        { label: 'Channel',  value: 'WhatsApp · +62 812 3456 7890' },
        { label: 'Status',   value: 'Read 14:08' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'ledger-close' },
  },
  {
    id: 'evt-009', type: 'restock-forecast', agentId: 'A-02', at: '2026-05-13', category: 'Seafood', venue: 'ST',
    skuId: 'SKU-0421', confidence: 84, outcome: 'success',
    reasoning: {
      why: 'Sashimi-grade tuna burn rate up 12% (Stake covers +18% wk). Restock proposed.',
      dataPoints: [
        { label: 'Burn rate',     value: '+12%' },
        { label: 'Stake covers',  value: '+18% wk/wk' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'hard-60' },
  },
  {
    id: 'evt-010', type: 'spend-flag', agentId: 'A-04', at: '2026-05-12', category: 'Beverages', venue: 'ST',
    poId: 'PO-3046', confidence: 87, outcome: 'success',
    reasoning: {
      why: 'PT Wine Cellar Nusa quote within 3% of last benchmark. Approved.',
      dataPoints: [
        { label: 'Variance vs last',  value: '+3%' },
        { label: 'FX lock applied',   value: 'IDR/USD 15500' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'hard-60' },
  },
  {
    id: 'evt-011', type: 'qc-event', agentId: 'A-05', at: '2026-05-04', category: 'Beverages', venue: 'Multi',
    poId: 'PO-2991', supplierId: 'SUP-031', confidence: 99, outcome: 'failed',
    reasoning: {
      why: 'Bintang delivery short 12 cases. QC fail recorded at receiving venue (BC). Dispute opened.',
      dataPoints: [
        { label: 'Cases ordered',  value: '180' },
        { label: 'Cases received', value: '168' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'hard-60' },
  },
  {
    id: 'evt-012', type: 'rule-trigger', agentId: 'A-04', at: '2026-05-10', category: 'Protein', venue: 'ST',
    confidence: 100, outcome: 'success',
    reasoning: {
      why: 'Vendor Trust Floor (RUL-002, scope=vendor, threshold=70) checked against AUS Premium Meats (composite 89). Passed.',
      dataPoints: [
        { label: 'Vendor composite', value: '89' },
        { label: 'Floor threshold',  value: '70' },
      ],
      alternatives: [],
    },
    undoWindow: { mode: 'ledger-close' },
  },
];

// ── Policy Rules (3 active) ──────────────────────────────────

export const finnsPolicyRules: PolicyRule[] = [
  {
    // 6s — global spend cap. Default INACTIVE for the demo so Auto
    // orders ride end-to-end without admin clicks. Admin can flip it
    // on from A&G → Policy tab to add a Stage 1 approval gate for
    // every Auto PO above the threshold (segregation-of-duties).
    id: 'RUL-001', template: 'spend-cap',
    name: 'Spend cap · All vendors',
    config: { threshold: 12_000_000, currency: 'IDR' },
    scope: 'all', active: false,
    createdBy: 'Procurement Manager', createdAt: '2026-04-12',
    triggers: 0,
  },
  {
    id: 'RUL-002', template: 'vendor-trust-floor',
    name: 'Vendor trust floor · 70 composite',
    config: { threshold: 70 },
    scope: 'all', active: true,
    createdBy: 'Procurement Manager', createdAt: '2026-03-08',
    triggers: 11,
  },
  {
    id: 'RUL-003', template: 'fraud-hold',
    name: 'Duplicate-amount fraud hold',
    config: { window_hours: 72, exact_amount_match: true },
    scope: 'all', active: true,
    createdBy: 'Procurement Manager', createdAt: '2026-02-20',
    triggers: 2,
  },
];

// ── Disputes (2) ─────────────────────────────────────────────

export const finnsDisputes: FinnsDispute[] = [
  {
    id: 'DSP-101', raisedBy: 'F&B Director', refEventId: 'evt-003', refPoId: 'PO-3047',
    reason: 'Splash event Saturday — packaging shortage. Accept 18% premium one-off.',
    priority: 'high', status: 'open',
  },
  {
    id: 'DSP-102', raisedBy: 'BC Receiving Lead', refEventId: 'evt-011', refPoId: 'PO-2991',
    reason: 'Bintang short delivery — 12 cases missing. Request credit memo + redelivery.',
    priority: 'medium', status: 'escalated',
  },
];
