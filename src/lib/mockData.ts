import type {
  Agent, DagStage, WorkflowTemplate, DemandSignal,
  MetricCategory, SupplierPromise, Country, Industry,
  ControlPlane, LossCategory, DecisionRecord, Dispute,
  ServiceIndicator,
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
