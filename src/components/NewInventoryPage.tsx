import { useState, useCallback, useEffect, useRef } from 'react';
import {
  AlertTriangle, Clock, Zap, BarChart3, Package,
  ChevronDown, ChevronUp, Send, Bot, Sparkles,
  Activity, Brain, Radar, Scale, Flame,
  Check, Eye, Search, X, MessageCircle,
  ShieldCheck, ChevronRight, Gauge, Maximize2, Minimize2,
  ArrowRight, RefreshCw, PhoneCall, CloudRain, Sun,
  CloudLightning, SquareCheckBig, Square, LayoutGrid, List,
  Hand, User, PauseCircle, PlayCircle, Lock, ExternalLink,
  Edit3, Pencil, ClipboardEdit, MinusCircle, PlusCircle,
  Truck, Database, Plus,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { theme as themeTokens } from '../lib/theme';
import { toast } from 'sonner@2.0.3';
import type { VenueTag, FinnsAgentId } from '../lib/types';

interface InventoryPageProps {
  theme: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

// ── Workforce attribution (6-agent flat roster) ──────────────────────
type LaborMode = 'agent' | 'manual';
type ParMode = 'ai' | 'manual';
interface AssignedAgent { id: FinnsAgentId; role: string; }
function agentBadge(a: AssignedAgent) { return a.id; }
function agentLabel(a: AssignedAgent) { return `${a.id} · ${a.role}`; }

const AGENT_ROLE: Record<FinnsAgentId, string> = {
  'A-01': 'Sourcing',
  'A-02': 'Restock',
  'A-03': 'Vendor Comms',
  'A-04': 'Spend Watchdog',
  'A-05': 'Logistics',
};

// Resolve the SKU's assigned agent. Most inventory items are managed by
// the Restock Agent (A-02); special cases come from `agentTrigger`.
function getAssignedAgent(item: InventoryItem): AssignedAgent {
  const m = item.agentTrigger?.match(/(A-0[1-5])/);
  const id = (m ? (m[1] as FinnsAgentId) : 'A-02');
  return { id, role: AGENT_ROLE[id] };
}

// ── Heartbeat Groups (Miller's Law) ──────────────────────────────────
type HeartbeatGroup = 'critical' | 'watch' | 'autonomous';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  venues: VenueTag[];          // which Finn's venues consume this SKU
  unitCostRp: number;
  onHand: number;
  parLevel: number;
  unit: string;
  daysRemaining: number;
  dailyBurn: number;
  group: HeartbeatGroup;
  trend: 'up' | 'down' | 'flat';
  eta?: string;
  autoReordered: boolean;
  supplierName?: string;
  supplierPhone?: string;
  agentTrigger?: string;
  agentReasoning?: string;
  marketSignal?: string;
  confidenceScore?: number;
  // restockDag.stage is in the 5-stage space (0..4)
  restockDag?: { stage: number; failedStage?: number; failureReason?: string };
  velocityData: { day: string; units: number }[];
  monthlySaving?: number;
  hoursEliminated?: number;
  // Cross-page traceability — same PO visible in Orders under linkedOrderId.
  linkedOrderId?: string;
}

interface DagStage {
  label: string;
  agentStep?: string;
  status: 'complete' | 'active' | 'pending' | 'failed';
}

// ── 5-Stage Restock DAG (matches the canonical platform model) ───────
// Two phases mirror the inventory page's role: the Decision is local to
// inventory (signal + sourcing); the Execution lives on Orders.
//   Decision (2): Request, Quote / Vendor Confirmed
//   Execution (3): PO Approved, In Transit, Delivered & Checked
const DECISION_PHASE_LEN = 2;
type RestockPhase = 'decision' | 'execution';
interface RestockStageDef { label: string; agentStep?: string; phase: RestockPhase; }

const RESTOCK_DAG_TEMPLATE: RestockStageDef[] = [
  // Phase 1 · The Decision (inventory-owned)
  { label: 'Request',                  agentStep: 'A-02 (Restock) raised the demand signal — par breach, scheduled trigger, or human-issued.', phase: 'decision' },
  { label: 'Quote / Vendor Confirmed', agentStep: 'A-01 (Sourcing) ran the playbook. RFQ for Standard, direct vendor for Rush, contract draw for Recurring. Quote validated vs 30-day market median.', phase: 'decision' },
  // Phase 2 · The Execution — labels match Orders → cross-page parity
  { label: 'PO Approved',              agentStep: 'A-04 (Spend Watchdog) checked the policy stack — spend cap, vendor trust floor, duplicate detection. PO issued to vendor on pass.', phase: 'execution' },
  { label: 'In Transit',               agentStep: 'A-05 (Logistics) confirmed dispatch and tracks ETA. Cold-chain sensors monitored for proteins, seafood, dairy.', phase: 'execution' },
  { label: 'Delivered & Checked',      agentStep: 'Receiving venue staff QC the delivery against PO. Pass → stock updated. Fail → dispute opened on Activity & Governance.', phase: 'execution' },
];

function makeDagStages(currentStage: number, failedStage?: number): DagStage[] {
  return RESTOCK_DAG_TEMPLATE.map((s, i) => ({
    ...s,
    status: i === failedStage ? 'failed' : i < currentStage ? 'complete' : i === currentStage ? 'active' : 'pending',
  }));
}

// ── Execution Streams (concurrent multi-stream tracking) ────────────
// A SKU can ride in multiple POs at once — an active shipment in the air
// AND one or more future drafts. Phase 2 must show all of them, with one
// never replacing another.
type StreamKind = 'active' | 'draft';
interface ExecutionStream {
  id: string;
  kind: StreamKind;
  vendor: string;
  agent: AssignedAgent;
  stage: number;        // current stage in the 5-stage layout (Phase 2 starts at idx 2)
  eta?: string;
  etaSortKey: number;
  failedStage?: number;
}

// Static metadata for any linked active PO a SKU references via `linkedOrderId`.
// In a real system this would come from the Orders kernel; we mirror just
// enough here to feed the Stream Switcher.
const LINKED_PO_META: Record<string, Omit<ExecutionStream, 'id' | 'kind'>> = {
  'PO-3044': {
    vendor: 'Bintang Distribusi',
    agent: { id: 'A-05', role: 'Logistics' },
    stage: 3,                     // In Transit on Orders
    eta: 'May 16 · 14:00',
    etaSortKey: new Date('2026-05-16T14:00').getTime(),
  },
  'PO-3045': {
    vendor: 'Sumber Dairy',
    agent: { id: 'A-05', role: 'Logistics' },
    stage: 4,                     // Delivered & Checked
    eta: 'May 16 · 10:00',
    etaSortKey: new Date('2026-05-16T10:00').getTime(),
  },
};

// ── Stage History · Paper Trail (synthesized) ────────────────────────
interface RestockStageHistory {
  data: Record<string, string>;
  trigger: string;        // Why did the action happen?
  proof: string;          // IDs / API timestamps / verification codes
  logic: string;          // 1-sentence Atlas summary
  verifiedAtIso: string;  // Deterministic timestamp per (item × stage)
}
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h);
}
function synthesizeRestockHistory(item: InventoryItem, stageIdx: number, traceSourceId?: string): RestockStageHistory {
  // When the SKU is bundled into a PO, reseed off the PO id so Phase 2's
  // history matches what the Orders page shows for the same PO — same MBL,
  // same carrier, same tracking number.
  const seedSource = traceSourceId ?? item.id;
  const seed = hashStr(`${seedSource}-${stageIdx}`);
  const num = (digits: number) => String(seed % 10 ** digits).padStart(digits, '0');
  const baseEpoch = 1747353600000 + (hashStr(seedSource) % 1_000_000_000); // 2025-05-16-ish base
  const verifiedAtIso = new Date(baseEpoch + stageIdx * (1000 * 60 * 60 * (2 + (seed % 5)))).toISOString();
  const supplier = item.supplierName ?? 'PT Bali Seafood Lestari';
  const carriers = ['JNE Trucking', 'Pos Indonesia', 'Sicepat Cargo'];
  const carrier = carriers[seed % carriers.length];
  const FIXTURES: Record<number, () => RestockStageHistory> = {
    // Phase 1 · The Decision (inventory-owned)
    0: () => ({
      data: {
        '7-day burn (avg)': `${item.dailyBurn} ${item.unit}/day`,
        'Velocity spike': `${15 + (seed % 35)}% above baseline`,
        'On-hand vs par': `${item.onHand} / ${item.parLevel} ${item.unit}`,
        'Days remaining': `${item.daysRemaining} d`,
      },
      trigger: `A-02 (Restock) detected ${item.name} at ${Math.round((item.onHand / Math.max(item.parLevel, 1)) * 100)}% of par with burn +${15 + (seed % 35)}% on the prior 14d baseline.`,
      proof: `Inventory snapshot ID: INV-${num(7)} · POS feed: pos-${num(8)} · Check ran every 30 min`,
      logic: `Restock request raised. Forecasted ${Math.round(item.dailyBurn * 7)} ${item.unit} consumption over the next 7 days at current pace.`,
      verifiedAtIso,
    }),
    1: () => ({
      data: {
        'Vendor': supplier,
        'Quote vs 30d median': `-${4 + (seed % 6)}%`,
        'Lead time': `${1 + (seed % 4)} days`,
        'Cold-chain SLA': `${91 + (seed % 8)}%`,
        'Lock window': '48h',
      },
      trigger: `A-01 (Sourcing) ran the playbook for ${item.name} — quote received from ${supplier} within the negotiation tolerance.`,
      proof: `Quote doc: q-${num(7)} · Lock TTL ${new Date(baseEpoch + 48 * 60 * 60 * 1000).toISOString()}`,
      logic: `${supplier} won on price + cold-chain reliability inside the approved vendor directory. No external sourcing performed.`,
      verifiedAtIso,
    }),
    // Phase 2 · The Execution (mirrors Orders)
    2: () => ({
      data: { po_pdf: `${item.id}_PO_v1.pdf`, vendor: supplier, items: `${Math.round(item.dailyBurn * 7)} ${item.unit}` },
      trigger: `A-04 (Spend Watchdog) cleared the policy gates — spend cap, vendor trust floor, duplicate detection. PO issued.`,
      proof: `PO doc: ${item.id}_PO_v1.pdf · Policy check ID: pol-${num(7)}`,
      logic: `PO drafted from the locked quote. Quality hold clause attached for first delivery.`,
      verifiedAtIso,
    }),
    3: () => ({
      data: { carrier, tracking: `${num(3)}-${num(8)}`, eta_hours: `${24 + (seed % 48)}` },
      trigger: `A-05 (Logistics) confirmed dispatch from ${supplier}; carrier API status IN_TRANSIT.`,
      proof: `Carrier ack: ${carrier.toLowerCase().replace(/\s+/g, '')}-${num(7)} · Tracking ${num(3)}-${num(8)}`,
      logic: `Real-time milestones active. Cold-chain temperature held within spec across the full leg.`,
      verifiedAtIso,
    }),
    4: () => ({
      data: { pod: `${item.id}_signed_POD.jpg`, qc_score: `${88 + (seed % 10)}/100`, receiving_venue: item.venues[0] ?? 'BC' },
      trigger: `Receiving venue staff QC'd ${item.name} on arrival at ${item.venues[0] ?? 'BC'}.`,
      proof: `POD doc: pod-${num(8)} · QC ledger entry: qc-${num(7)}`,
      logic: `Goods received and signed for. QC passed against ${supplier} baseline. Stock auto-incremented for the consuming venue(s).`,
      verifiedAtIso,
    }),
  };
  return FIXTURES[stageIdx]?.() ?? {
    data: {}, trigger: '—', proof: '—',
    logic: 'No history recorded for this stage.',
    verifiedAtIso,
  };
}

function makeVelocity(base: number, variance: number): { day: string; units: number }[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(d => ({ day: d, units: Math.max(1, Math.round(base + (Math.random() - 0.5) * variance)) }));
}

// ── Full Catalog ─────────────────────────────────────────────────────
const ITEMS: InventoryItem[] = [
  // Seafood
  {
    id: 'INV-001', name: 'Yellowfin Tuna (sashimi grade)', sku: 'SKU-0421', category: 'Seafood',
    venues: ['ST'],
    unitCostRp: 380_000, onHand: 8, parLevel: 12, unit: 'kg', daysRemaining: 1.9, dailyBurn: 4.2,
    group: 'critical', trend: 'down', autoReordered: true, eta: 'May 17 · 11:00',
    supplierName: 'PT Bali Seafood Lestari', supplierPhone: '+62 812 3456 7890',
    linkedOrderId: 'PO-3041',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: "Sashimi-grade tuna burn rate up 12% — Stake covers up 18% wk/wk. A-01 (Sourcing) ran an RFQ against PT Bali Seafood, Krakatoa Coldstore and Indo Oseanik. PT Bali Seafood won on lead time (1d) and cold-chain SLA (98%). Quote sits Rp 14.2M for the combined ST/BC drop — 4% under 30-day median. A-04 (Spend Watchdog) cleared everything except the spend cap; needs your nod.",
    marketSignal: 'Bali seafood market stable. Wayan Sukma confirmed cold-chain handler available for the ST drop.',
    confidenceScore: 92,
    restockDag: { stage: 1 },
    velocityData: makeVelocity(4.2, 1.5),
    monthlySaving: 590_000, hoursEliminated: 3.5,
  },
  {
    id: 'INV-002', name: 'Yellowfin Tuna (food grade)', sku: 'SKU-0422', category: 'Seafood',
    venues: ['BC', 'RC'],
    unitCostRp: 180_000, onHand: 22, parLevel: 30, unit: 'kg', daysRemaining: 2.9, dailyBurn: 7.5,
    group: 'watch', trend: 'down', autoReordered: false,
    supplierName: 'PT Bali Seafood Lestari', supplierPhone: '+62 812 3456 7890',
    linkedOrderId: 'PO-3041',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Food-grade tuna stocks for BC + RC. Combined into PO-3041 with the sashimi-grade for ST to share the cold-chain run.',
    marketSignal: 'Same vendor as SKU-0421 — sashimi grade. Combined run.',
    confidenceScore: 90,
    restockDag: { stage: 1 },
    velocityData: makeVelocity(7.5, 2),
    monthlySaving: 240_000, hoursEliminated: 1.5,
  },
  {
    id: 'INV-003', name: 'Prawns (large, head-on)', sku: 'SKU-0423', category: 'Seafood',
    venues: ['BC', 'ST', 'RC'],
    unitCostRp: 220_000, onHand: 14, parLevel: 25, unit: 'kg', daysRemaining: 2.1, dailyBurn: 6.8,
    group: 'critical', trend: 'down', autoReordered: false,
    supplierName: 'PT Bali Seafood Lestari', supplierPhone: '+62 812 3456 7890',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Prawn stocks at 56% of par across BC/ST/RC. Weekend brunch traffic at BC drives ~60% of the burn. Restock proposal pending vendor confirmation.',
    marketSignal: 'Bali prawn harvest favorable this fortnight. Wayan flagged a possible 5% volume break.',
    confidenceScore: 88,
    restockDag: { stage: 0 },
    velocityData: makeVelocity(6.8, 2),
    monthlySaving: 380_000, hoursEliminated: 2.4,
  },
  // Protein
  {
    id: 'INV-004', name: 'AUS Wagyu Ribeye MB7+', sku: 'SKU-0101', category: 'Protein',
    venues: ['ST'],
    unitCostRp: 1_900_000, onHand: 5, parLevel: 8, unit: 'kg', daysRemaining: 2.8, dailyBurn: 1.8,
    group: 'critical', trend: 'down', autoReordered: true, eta: 'May 18 · 09:00',
    supplierName: 'AUS Premium Meats', supplierPhone: '+61 4 1234 5678',
    linkedOrderId: 'PO-3043',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Wagyu MB7+ par floor breach — Stake bookings up 18%. A-02 promoted to Rush playbook (WF-RSH). A-01 went direct to AUS Premium Meats (your contracted Wagyu vendor) — quote within the 12% Rush tolerance. USD-denominated, FX locked at 15,490.',
    marketSignal: 'AUS Wagyu market +6% wk/wk. Lock now or face the next cycle uplift.',
    confidenceScore: 88,
    restockDag: { stage: 0 },
    velocityData: makeVelocity(1.8, 0.5),
    monthlySaving: 0, hoursEliminated: 1.8,
  },
  {
    id: 'INV-005', name: 'Pork Belly, skin-on', sku: 'SKU-0102', category: 'Protein',
    venues: ['BC', 'RC'],
    unitCostRp: 145_000, onHand: 28, parLevel: 35, unit: 'kg', daysRemaining: 3.3, dailyBurn: 8.4,
    group: 'watch', trend: 'flat', autoReordered: false,
    supplierName: 'Krakatoa Coldstore', supplierPhone: '+62 821 9876 5432',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Pork belly tracking at par. No restock yet — vendor is consolidating shipments and offering a 4% break on the next combined delivery.',
    marketSignal: 'Krakatoa next pickup window is May 19. Bundle with chicken thighs for combined freight.',
    confidenceScore: 82,
    velocityData: makeVelocity(8.4, 2),
    monthlySaving: 290_000, hoursEliminated: 2.0,
  },
  {
    id: 'INV-006', name: 'Chicken thighs, boneless', sku: 'SKU-0103', category: 'Protein',
    venues: ['BC', 'RC', 'SP'],
    unitCostRp: 58_000, onHand: 42, parLevel: 50, unit: 'kg', daysRemaining: 3.3, dailyBurn: 12.6,
    group: 'watch', trend: 'down', autoReordered: false,
    supplierName: 'Krakatoa Coldstore', supplierPhone: '+62 821 9876 5432',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Chicken thighs for BC/RC/SP — approaching par. Splash event Saturday will spike SP burn by ~40%. Restock proposal pending the combined Krakatoa drop.',
    marketSignal: 'No price pressure on poultry this cycle. Bundle opportunity with pork belly noted.',
    confidenceScore: 84,
    velocityData: makeVelocity(12.6, 3),
    monthlySaving: 240_000, hoursEliminated: 1.7,
  },
  // Produce
  {
    id: 'INV-007', name: 'Mixed greens (rocket, lettuce)', sku: 'SKU-0201', category: 'Produce',
    venues: ['BC', 'RC', 'ST'],
    unitCostRp: 22_000, onHand: 15, parLevel: 18, unit: 'kg', daysRemaining: 2.5, dailyBurn: 6.0,
    group: 'watch', trend: 'down', autoReordered: false,
    supplierName: 'CV Indo Sayur', supplierPhone: '+62 813 5555 1234',
    linkedOrderId: 'PO-3042',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Recurring weekly produce — auto-approved by A-04 under the standing recurring schedule. Pak Made confirmed Monday 06:00 BC drop.',
    marketSignal: 'CV Indo Sayur recurring vendor — no quote pressure expected.',
    confidenceScore: 93,
    restockDag: { stage: 2 },
    velocityData: makeVelocity(6.0, 1.5),
  },
  {
    id: 'INV-008', name: 'Tomatoes, vine-ripened', sku: 'SKU-0202', category: 'Produce',
    venues: ['BC', 'RC', 'ST', 'SP'],
    unitCostRp: 18_000, onHand: 36, parLevel: 40, unit: 'kg', daysRemaining: 3.3, dailyBurn: 11.0,
    group: 'watch', trend: 'flat', autoReordered: false,
    supplierName: 'CV Indo Sayur', supplierPhone: '+62 813 5555 1234',
    linkedOrderId: 'PO-3042',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Tomatoes for all four venues. Riding the same Monday recurring drop as mixed greens.',
    marketSignal: 'Bali local supply healthy — Pak Made flagged a possible variety swap to plum if heirlooms run short.',
    confidenceScore: 87,
    velocityData: makeVelocity(11, 3),
    monthlySaving: 130_000, hoursEliminated: 1.0,
  },
  {
    id: 'INV-009', name: 'Lime, key', sku: 'SKU-0204', category: 'Produce',
    venues: ['BC', 'RC', 'ST', 'SP'],
    unitCostRp: 24_000, onHand: 32, parLevel: 35, unit: 'kg', daysRemaining: 3.4, dailyBurn: 9.5,
    group: 'watch', trend: 'flat', autoReordered: false,
    supplierName: 'CV Indo Sayur', supplierPhone: '+62 813 5555 1234',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Cocktails at BC and RC consume most of the limes. Splash QSR drinks add ~20% to weekend burn.',
    marketSignal: 'No supply pressure.',
    confidenceScore: 80,
    velocityData: makeVelocity(9.5, 2.5),
  },
  // Dairy
  {
    id: 'INV-010', name: 'Butter, salted (Anchor)', sku: 'SKU-0301', category: 'Dairy',
    venues: ['BC', 'RC', 'ST', 'SP'],
    unitCostRp: 95_000, onHand: 24, parLevel: 30, unit: 'kg', daysRemaining: 3.5, dailyBurn: 6.8,
    group: 'watch', trend: 'flat', autoReordered: false,
    supplierName: 'Sumber Dairy', supplierPhone: '+62 815 6677 8899',
    linkedOrderId: 'PO-3045',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Butter delivered this morning — A-05 (Logistics) awaiting your QC sign-off at BC kitchen.',
    marketSignal: 'Sumber halal cert renewal due May 28 — A-03 has the renewal ready.',
    confidenceScore: 89,
    restockDag: { stage: 4 },
    velocityData: makeVelocity(6.8, 1.5),
    monthlySaving: 180_000, hoursEliminated: 1.2,
  },
  {
    id: 'INV-011', name: 'Burrata', sku: 'SKU-0302', category: 'Dairy',
    venues: ['ST'],
    unitCostRp: 85_000, onHand: 12, parLevel: 18, unit: 'pcs', daysRemaining: 3.0, dailyBurn: 4.0,
    group: 'watch', trend: 'down', autoReordered: false,
    supplierName: 'Sumber Dairy', supplierPhone: '+62 815 6677 8899',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Stake-specific burrata. Stocks under par — restock proposal queued behind the wider dairy delivery.',
    marketSignal: 'Burrata batch limited this week — Sumber flagged production capacity issue.',
    confidenceScore: 76,
    velocityData: makeVelocity(4.0, 1),
  },
  // Beverages
  {
    id: 'INV-012', name: 'Bintang Beer 330ml (case 24)', sku: 'SKU-0501', category: 'Beverages',
    venues: ['BC', 'RC', 'SP'],
    unitCostRp: 320_000, onHand: 84, parLevel: 100, unit: 'case', daysRemaining: 2.6, dailyBurn: 32.0,
    group: 'critical', trend: 'down', autoReordered: true, eta: 'May 16 · 14:00',
    supplierName: 'Bintang Distribusi', supplierPhone: '+62 811 2233 4455',
    linkedOrderId: 'PO-3044',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Bintang case par tracking 84% — long-weekend forecast +8%. A-05 has the truck 60km out, ETA 14:00 for BC + SP + RC.',
    marketSignal: 'Bintang cold-chain SLA dipped to 88% last week — keep an eye on the next two drops.',
    confidenceScore: 91,
    restockDag: { stage: 3 },
    velocityData: makeVelocity(32, 6),
    monthlySaving: 320_000, hoursEliminated: 2.6,
  },
  {
    id: 'INV-013', name: 'Prosecco, Treviso DOC (750ml)', sku: 'SKU-0502', category: 'Beverages',
    venues: ['RC', 'ST'],
    unitCostRp: 280_000, onHand: 96, parLevel: 120, unit: 'btl', daysRemaining: 4.4, dailyBurn: 22.0,
    group: 'watch', trend: 'flat', autoReordered: false,
    supplierName: 'PT Wine Cellar Nusa', supplierPhone: '+62 818 4321 9876',
    linkedOrderId: 'PO-3046',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Prosecco shipment cleared customs yesterday — Logistics tracking last-mile to Bali warehouse.',
    marketSignal: 'PT Wine Cellar Nusa on watchlist — long lead times, FX exposure tracked.',
    confidenceScore: 78,
    restockDag: { stage: 3 },
    velocityData: makeVelocity(22, 4),
  },
  {
    id: 'INV-014', name: 'Coca-Cola 330ml (case 24)', sku: 'SKU-0504', category: 'Beverages',
    venues: ['BC', 'SP', 'RC'],
    unitCostRp: 180_000, onHand: 56, parLevel: 80, unit: 'case', daysRemaining: 2.2, dailyBurn: 25.0,
    group: 'critical', trend: 'down', autoReordered: false,
    supplierName: 'Bintang Distribusi', supplierPhone: '+62 811 2233 4455',
    agentTrigger: 'A-02 (Restock)',
    agentReasoning: 'Coke par dropping fast — Splash QSR drives most of the volume.',
    marketSignal: 'Same vendor as Bintang — can bundle on next drop.',
    confidenceScore: 86,
    velocityData: makeVelocity(25, 5),
    monthlySaving: 150_000, hoursEliminated: 1.0,
  },
  // Dry Goods
  {
    id: 'INV-015', name: 'Olive oil, EV (5L tin)', sku: 'SKU-0601', category: 'Dry Goods',
    venues: ['BC', 'RC', 'ST'],
    unitCostRp: 480_000, onHand: 14, parLevel: 18, unit: 'tin', daysRemaining: 5.8, dailyBurn: 2.4,
    group: 'autonomous', trend: 'flat', autoReordered: false,
    supplierName: 'Pulau Dry Goods', supplierPhone: '+62 813 1111 2222',
    velocityData: makeVelocity(2.4, 0.6), monthlySaving: 120_000, hoursEliminated: 0.7,
  },
  {
    id: 'INV-016', name: 'Jasmine rice (25kg sack)', sku: 'SKU-0602', category: 'Dry Goods',
    venues: ['BC', 'RC', 'SP'],
    unitCostRp: 280_000, onHand: 22, parLevel: 30, unit: 'sack', daysRemaining: 4.9, dailyBurn: 4.5,
    group: 'autonomous', trend: 'flat', autoReordered: false,
    supplierName: 'Pulau Dry Goods', supplierPhone: '+62 813 1111 2222',
    velocityData: makeVelocity(4.5, 1), monthlySaving: 90_000, hoursEliminated: 0.6,
  },
  {
    id: 'INV-017', name: 'Kopi Bali roasted (1kg)', sku: 'SKU-0603', category: 'Dry Goods',
    venues: ['BC', 'RC', 'ST', 'SP'],
    unitCostRp: 240_000, onHand: 38, parLevel: 45, unit: 'kg', daysRemaining: 4.8, dailyBurn: 8.0,
    group: 'autonomous', trend: 'flat', autoReordered: false,
    supplierName: 'Kopi Bali Roastery', supplierPhone: '+62 819 5555 6666',
    velocityData: makeVelocity(8, 1.5), monthlySaving: 130_000, hoursEliminated: 0.9,
  },
  // Other
  {
    id: 'INV-018', name: 'Takeaway box, 1000ml (case 100)', sku: 'SKU-0801', category: 'Other',
    venues: ['BC', 'SP', 'RC'],
    unitCostRp: 350_000, onHand: 24, parLevel: 30, unit: 'case', daysRemaining: 4.4, dailyBurn: 5.5,
    group: 'watch', trend: 'flat', autoReordered: false,
    supplierName: 'Eka Packaging', supplierPhone: '+62 812 7777 8888',
    linkedOrderId: 'PO-3047',
    agentTrigger: 'A-04 (Spend Watchdog)',
    agentReasoning: 'PO-3047 disputed — quote 18% above 30-day median. F&B Director raised override for Splash Saturday event.',
    marketSignal: 'No alternative vendor carries this SKU in 1000ml. Eka has the quote on hold.',
    confidenceScore: 72,
    restockDag: { stage: 1, failedStage: 1, failureReason: 'A-04 (Spend Watchdog) held the PO under RUL-001 (Spend Cap, vendor scope). Dispute DSP-101 open in Activity & Governance.' },
    velocityData: makeVelocity(5.5, 1),
  },
];

// ── Group metadata (POUR: unique icon, never color-only) ─────────────
const GROUP_META: Record<HeartbeatGroup, { label: string; icon: typeof Zap; color: string; darkColor: string; bgDark: string; bgLight: string; desc: string }> = {
  critical: { label: 'Critical', icon: Flame, color: 'text-red-600', darkColor: 'text-red-400', bgDark: 'bg-red-500/10', bgLight: 'bg-red-50', desc: 'Immediate restock required' },
  watch:    { label: 'Watch', icon: Eye, color: 'text-amber-600', darkColor: 'text-amber-400', bgDark: 'bg-amber-500/10', bgLight: 'bg-amber-50', desc: 'Predicted stockout within 72h' },
  autonomous: { label: 'Autonomous Flow', icon: ShieldCheck, color: 'text-green-600', darkColor: 'text-green-400', bgDark: 'bg-green-500/10', bgLight: 'bg-green-50', desc: 'Handled by A-02 Restock' },
};

// ── Macro Intelligence (Right panel in Audit Mode) ───────────────────
// Pareto: top 3 categories by inventory value
const CATEGORY_VALUES = (() => {
  const map = new Map<string, number>();
  ITEMS.forEach(i => map.set(i.category, (map.get(i.category) || 0) + i.onHand * i.unitCostRp));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([cat, val]) => ({ category: cat, valueRp: val }));
})();
const TOTAL_INVENTORY_VALUE = CATEGORY_VALUES.reduce((s, c) => s + c.valueRp, 0);

// Dead stock: items with zero or near-zero burn
const DEAD_STOCK = ITEMS.filter(i => i.dailyBurn <= 1.5 && i.onHand > i.parLevel);
const DEAD_STOCK_VALUE = DEAD_STOCK.reduce((s, i) => s + i.onHand * i.unitCostRp, 0);

// Supply chain weather — Finn's relevant regions
const SUPPLY_WEATHER: { region: string; icon: typeof Sun; status: 'clear' | 'caution' | 'disrupted'; detail: string }[] = [
  { region: 'Bali (Local)',       icon: Sun,           status: 'clear',     detail: 'PT Bali Seafood + CV Indo Sayur + Bali Fresh Farms — all operating normally.' },
  { region: 'Java / Tanjung Priok', icon: CloudRain,   status: 'caution',   detail: 'Monsoon edge — Bintang + Krakatoa cold-chain deliveries +6–12h.' },
  { region: 'Australia (Imports)', icon: Sun,          status: 'clear',     detail: 'AUS Premium Meats routes clear. No customs delays this fortnight.' },
  { region: 'Europe (Wine)',      icon: CloudLightning, status: 'disrupted', detail: 'PT Wine Cellar Nusa flagged Treviso DOC restock +5 days due to vendor backlog.' },
];

// ── Aggregate velocity ───────────────────────────────────────────────
const AGGREGATE_VELOCITY = (() => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((d, i) => {
    const total = ITEMS.reduce((sum, item) => sum + item.velocityData[i].units, 0);
    return { day: d, actual: Math.round(total), forecast: Math.round(total * (1 + (Math.random() - 0.5) * 0.12)) };
  });
})();

// ═════════════════════════════════════════════════════════════════════
export function NewInventoryPage({ theme, onNavigate }: InventoryPageProps) {
  const isDark = theme === 'dark';
  const t = themeTokens(isDark);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [parOverride, setParOverride] = useState<number | null>(null);
  const [expandedDag, setExpandedDag] = useState<Set<number>>(new Set());
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'atlas'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [hardenedId, setHardenedId] = useState<string | null>(null);
  const [emergencyTriggered, setEmergencyTriggered] = useState<Set<string>>(new Set());
  const [auditMode, setAuditMode] = useState(false);     // Expansion / Audit Mode
  const [auditView, setAuditView] = useState<'table' | 'grid'>('table');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<HeartbeatGroup | 'all'>('all');
  const [auditSelected, setAuditSelected] = useState<Set<string>>(new Set());
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [cmdkSearch, setCmdkSearch] = useState('');
  const [flyingId, setFlyingId] = useState<string | null>(null);
  const [intelligenceLog, setIntelligenceLog] = useState<{ id: string; name: string; action: string; time: string }[]>([]);

  // ── Wayne / Fortress: per-SKU steering & physical truth ───────────
  // Per-SKU labor mode (Agent vs Manual user). Default: agent.
  const [laborMode, setLaborMode] = useState<Record<string, LaborMode>>({});
  const getLaborMode = useCallback((id: string): LaborMode => laborMode[id] ?? 'agent', [laborMode]);
  // setMode is declared further below (after the state it reads in the
  // Resumption Handshake) to avoid a TDZ on the dependency array.
  // Per-SKU par mode — AI Recommended (default) vs Manual Fixed (hard floor).
  const [parMode, setParMode] = useState<Record<string, ParMode>>({});
  const getParMode = useCallback((id: string): ParMode => parMode[id] ?? 'ai', [parMode]);
  const [manualParFixed, setManualParFixed] = useState<Record<string, number>>({});
  // Physical-truth manual counts (the "Adjust Stock" capture).
  interface ManualCount { count: number; note: string; ts: string; }
  const [manualCounts, setManualCounts] = useState<Record<string, ManualCount>>({});
  const [adjustOpen, setAdjustOpen] = useState<string | null>(null);
  const [adjustDraft, setAdjustDraft] = useState<{ count: string; note: string }>({ count: '', note: '' });
  const openAdjust = useCallback((id: string) => {
    const item = ITEMS.find(i => i.id === id);
    setAdjustDraft({ count: String(manualCounts[id]?.count ?? item?.onHand ?? ''), note: '' });
    setAdjustOpen(id);
  }, [manualCounts]);
  const closeAdjust = useCallback(() => { setAdjustOpen(null); setAdjustDraft({ count: '', note: '' }); }, []);
  const saveAdjust = useCallback(() => {
    if (!adjustOpen) return;
    const n = Number(adjustDraft.count);
    if (Number.isNaN(n)) return;
    const item = ITEMS.find(i => i.id === adjustOpen);
    if (!item) return;
    const ts = new Date().toISOString();
    // Action only — does not pause the agent, does not flip Steering.
    setManualCounts(prev => ({ ...prev, [adjustOpen]: { count: n, note: adjustDraft.note.trim(), ts } }));
    setIntelligenceLog(prev => [{
      id: adjustOpen,
      name: item.name,
      action: `Manual count → ${n} ${item.unit}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }, ...prev].slice(0, 8));
    const newDays = (n / Math.max(item.dailyBurn, 0.1)).toFixed(1);
    toast.success(`Physical count updated to ${n}${item.unit}.`, {
      description: `New runway: ${newDays}d at ${item.dailyBurn} ${item.unit}/day burn.`,
    });
    setChatMessages(prev => [...prev, {
      role: 'atlas',
      text: `Physical count updated to ${n}${item.unit} for ${item.name}. Adjusting burn-rate projections — runway is now ${newDays}d at ${item.dailyBurn} ${item.unit}/day.${adjustDraft.note.trim() ? ` Note: "${adjustDraft.note.trim()}".` : ''}`,
    }]);
    closeAdjust();
  }, [adjustOpen, adjustDraft, closeAdjust]);
  // Resolved on-hand: manual count overrides seeded onHand.
  const getOnHand = useCallback((item: InventoryItem) => manualCounts[item.id]?.count ?? item.onHand, [manualCounts]);
  // Master SKU Catalog management
  type CatalogRow = { id: string; name: string; sku: string; category: string; unitCost: number; archived: boolean };
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>(
    ITEMS.map(i => ({ id: i.id, name: i.name, sku: i.sku, category: i.category, unitCost: i.unitCostRp, archived: false }))
  );
  const [catalogDraftRow, setCatalogDraftRow] = useState<Partial<CatalogRow> | null>(null);
  const [catalogEditId, setCatalogEditId] = useState<string | null>(null);

  // Failed restock intents — fired when the user dismisses a restock context in RequestPanel
  const [failedIntentIds, setFailedIntentIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const handler = (e: Event) => {
      const { skuId } = (e as CustomEvent<{ skuId: string }>).detail ?? {};
      if (skuId) setFailedIntentIds(prev => new Set([...prev, skuId]));
    };
    window.addEventListener('buyamia-restock-intent-failed', handler);
    return () => window.removeEventListener('buyamia-restock-intent-failed', handler);
  }, []);

  // Restock-journey force-complete (Manual Takeover hook, mirrors Orders).
  const [forceCompletedRestock, setForceCompletedRestock] = useState<Record<string, number>>({});
  const forceCompleteRestock = useCallback((id: string, stageIdx: number) => {
    setForceCompletedRestock(prev => ({ ...prev, [id]: Math.max(prev[id] ?? 0, stageIdx + 1) }));
    const item = ITEMS.find(i => i.id === id);
    if (item) {
      setChatMessages(prev => [...prev, {
        role: 'atlas',
        text: `Stage ${stageIdx + 1} (${RESTOCK_DAG_TEMPLATE[stageIdx].label}) force-completed manually for ${item.name}. Logged to audit trail.`,
      }]);
    }
  }, []);

  // ── Stage Trace · Review Mode modal ────────────────────────────
  // Total Traceability — every stage opens a History & Trace Record modal.
  const [openStageTrace, setOpenStageTrace] = useState<{ skuId: string; stageIdx: number } | null>(null);
  const openStageModal = useCallback((skuId: string, stageIdx: number) => {
    setOpenStageTrace({ skuId, stageIdx });
  }, []);
  const closeStageModal = useCallback(() => setOpenStageTrace(null), []);

  // ── Manual Fixed pivot — fire Atlas reasoning ──────────────────
  const setParModeWithPivot = useCallback((skuId: string, mode: ParMode) => {
    setParMode(prev => ({ ...prev, [skuId]: mode }));
    const item = ITEMS.find(i => i.id === skuId);
    if (!item) return;
    if (mode === 'manual') {
      const floor = manualParFixed[skuId] ?? item.parLevel;
      setChatMessages(prev => [...prev, {
        role: 'atlas',
        text: `I have suspended auto-calculations for ${item.name}. Monitoring stock based on your manual ${floor} ${item.unit} floor — restock logic ignores my forecast until you switch back.`,
      }]);
    } else {
      setChatMessages(prev => [...prev, {
        role: 'atlas',
        text: `Resuming AI Recommended for ${item.name}. Re-running the demand forecast and par-check against current burn.`,
      }]);
    }
  }, [manualParFixed]);

  // ── Open Draft POs (session) — for "Add to Open Draft" path ─────
  // Each draft tracks its own execution stage so Phase 2 of any SKU
  // bundled into it mirrors the PO's real progress.
  interface DraftPO { id: string; vendor: string; items: string[]; stage: number; assignedAgent: AssignedAgent; }
  const [draftPOs, setDraftPOs] = useState<DraftPO[]>([
    {
      id: 'DR-2858',
      vendor: 'AUS Meats Pty',
      items: ['Beef Tenderloin 30kg'],
      stage: 5,                              // PO has cleared Vendor Confirmed (Phase 2 idx 5)
      assignedAgent: { id: 7, role: 'Logistics' },
    },
    {
      id: 'DR-2861',
      vendor: 'AUS Meats Pty',
      items: ['Wagyu Striploin 15kg'],
      stage: 4,                              // Earlier — only PO Created
      assignedAgent: { id: 1, role: 'PO Engine' },
    },
  ]);
  // All drafts that match a vendor (used by the Pipeline menu).
  const findDraftsForVendor = useCallback((vendor?: string): DraftPO[] => {
    if (!vendor) return [];
    return draftPOs.filter(d => d.vendor.toLowerCase() === vendor.toLowerCase());
  }, [draftPOs]);

  // Per-SKU: which draft(s) this SKU has been bundled into.
  // A list — concurrent execution streams (active + drafts) live side-by-side.
  const [bundledIntoDraftIds, setBundledIntoDraftIds] = useState<Record<string, string[]>>({});
  const getBundledDrafts = useCallback((skuId: string): DraftPO[] => {
    const ids = bundledIntoDraftIds[skuId] ?? [];
    return ids.map(id => draftPOs.find(d => d.id === id)).filter(Boolean) as DraftPO[];
  }, [bundledIntoDraftIds, draftPOs]);

  // Compute the full execution-stream list for an SKU.
  // Includes any live PO referenced by `linkedOrderId` AND any drafts the
  // user has bundled this SKU into. Sorted by ETA (soonest first), with
  // active streams beating drafts on ties.
  const getStreamsForSku = useCallback((item: InventoryItem): ExecutionStream[] => {
    const streams: ExecutionStream[] = [];
    if (item.linkedOrderId && LINKED_PO_META[item.linkedOrderId]) {
      const meta = LINKED_PO_META[item.linkedOrderId];
      streams.push({ id: item.linkedOrderId, kind: 'active', ...meta });
    }
    for (const d of getBundledDrafts(item.id)) {
      streams.push({
        id: d.id, kind: 'draft', vendor: d.vendor, agent: d.assignedAgent,
        stage: d.stage,
        etaSortKey: Number.MAX_SAFE_INTEGER,    // drafts have no ETA → land last by default
      });
    }
    streams.sort((a, b) => {
      if (a.etaSortKey !== b.etaSortKey) return a.etaSortKey - b.etaSortKey;
      if (a.kind !== b.kind) return a.kind === 'active' ? -1 : 1;
      return b.stage - a.stage;
    });
    return streams;
  }, [getBundledDrafts]);

  // Per-SKU: which stream tab is currently selected (defaults to soonest).
  const [selectedStreamId, setSelectedStreamId] = useState<Record<string, string>>({});
  // Pipeline dropdown menu (which SKU's pipeline picker is open).
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!pipelineMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-pipeline-menu]')) setPipelineMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pipelineMenuOpen]);
  const getSelectedStream = useCallback((item: InventoryItem): ExecutionStream | null => {
    const list = getStreamsForSku(item);
    if (list.length === 0) return null;
    const explicit = selectedStreamId[item.id];
    if (explicit) {
      const hit = list.find(s => s.id === explicit);
      if (hit) return hit;
    }
    return list[0];
  }, [getStreamsForSku, selectedStreamId]);

  // setMode (Manual Takeover toggle) — declared here so its dependency
  // array can read manualCounts / manualParFixed / parMode / bundledIntoDraftIds
  // without hitting a temporal-dead-zone error.
  const setMode = useCallback((id: string, mode: LaborMode) => {
    setLaborMode(prev => ({ ...prev, [id]: mode }));
    const item = ITEMS.find(i => i.id === id);
    if (!item) return;
    const a = getAssignedAgent(item);
    if (mode === 'manual') {
      setChatMessages(prev => [...prev, {
        role: 'atlas',
        text: `Manual Takeover active on ${item.name}. ${agentLabel(a)} paused — strategy decisions (par, restock initiation, physical counts) are yours. Phase 2 execution still routes through Orders.`,
      }]);
    } else {
      // ═══ Sync Check (Resumption Handshake) ═══
      const synced: string[] = [];
      const mc = manualCounts[id];
      if (mc) synced.push(`Adjust Stock = ${mc.count} ${item.unit}${mc.note ? ` ("${mc.note}")` : ''}`);
      const fp = manualParFixed[id];
      if (fp !== undefined && parMode[id] === 'manual') synced.push(`Manual Par floor = ${fp} ${item.unit}`);
      const bundles = bundledIntoDraftIds[id] ?? [];
      if (bundles.length > 0) synced.push(`Bundled into ${bundles.join(', ')}`);
      const msg = synced.length === 0
        ? `Resuming ${agentLabel(a)} on ${item.name}. No manual inputs to sync — picking up where I left off.`
        : `Resuming ${agentLabel(a)} on ${item.name}. Sync Check: ingesting your manual inputs (${synced.join(' · ')}) before any autonomous step.`;
      setChatMessages(prev => [...prev, { role: 'atlas', text: msg }]);
    }
  }, [manualCounts, manualParFixed, parMode, bundledIntoDraftIds]);

  // ── Manual intervention ACTIONS ────────────────────────────────
  // Per the Action-vs-State protocol, none of these flip Steering
  // (the Manual Takeover toggle is the only governance state change).
  //
  // A. Direct Restock — Express action: redirect to New Request with prefill.
  //    Does NOT touch the SKU's journey or Steering — a fresh PO will start
  //    its own journey once the user submits the New Request.
  const handleRestockNow = useCallback((id: string) => {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return;
    toast.success(`Drafting new PO with ${item.supplierName ?? 'your primary vetted vendor'}`, {
      description: `Pre-filling ${item.name} (${Math.round(item.dailyBurn * 4)}${item.unit}) on the New Request page.`,
    });
    setIntelligenceLog(prev => [{
      id, name: item.name,
      action: `Restock Now → New Request prefill`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }, ...prev].slice(0, 8));
    setChatMessages(prev => [...prev, {
      role: 'atlas',
      text: `Routing to New Request for ${item.name}. I have pre-filled the line items (Step 2) and the vetted vendor ${item.supplierName ?? '(none)'} (Step 4) from this SKU's history. Submit when ready and I'll start the new PO's journey.`,
    }]);
    // Deep-link prefill payload — Step 2 line items + Step 4 vendor.
    if (typeof window !== 'undefined') {
      const lineItem = `${item.name} ${Math.round(item.dailyBurn * 4)}${item.unit}`;
      const params = new URLSearchParams({
        restock: id,
        items: lineItem,
        ...(item.supplierName ? { vendor: item.supplierName } : {}),
      });
      window.location.hash = params.toString();
    }
    onNavigate?.('request');
  }, [onNavigate]);

  // B. Bundle (Add to Open Draft PO) — Action only, NOT a takeover.
  //    Specific draftId so the Pipeline menu can target individual drafts
  //    when the SKU's vendor has multiple open drafts.
  const handleAddToDraft = useCallback((id: string, draftId: string) => {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return;
    const draft = draftPOs.find(d => d.id === draftId);
    if (!draft) return;
    const lineLabel = `${item.name} ${Math.round(item.dailyBurn * 4)}${item.unit}`;
    setDraftPOs(prev => prev.map(d => d.id === draft.id
      ? d.items.includes(lineLabel) ? d : { ...d, items: [...d.items, lineLabel] }
      : d));
    setBundledIntoDraftIds(prev => {
      const cur = prev[id] ?? [];
      return cur.includes(draft.id) ? prev : { ...prev, [id]: [...cur, draft.id] };
    });
    toast.success(`✅ ${item.name} successfully added to your future pipeline in ${draft.id}.`, {
      description: `Active shipment unchanged · ${agentLabel(draft.assignedAgent)} drives the new draft when it leaves.`,
    });
    setIntelligenceLog(prev => [{
      id, name: item.name,
      action: `Bundled into ${draft.id} (future pipeline)`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }, ...prev].slice(0, 8));
    setChatMessages(prev => [...prev, {
      role: 'atlas',
      text: `${item.name} added as a future stream on Draft ${draft.id} (${draft.vendor}). Your active shipment continues unchanged; switch streams in Phase 2 to inspect this draft.`,
    }]);
  }, [draftPOs]);

  // Un-bundle a SKU from a specific draft — pops the line from the draft
  // and removes the stream from the SKU.
  const handleRemoveFromDraft = useCallback((id: string, draftId: string) => {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return;
    const draft = draftPOs.find(d => d.id === draftId);
    if (!draft) return;
    const lineLabel = `${item.name} ${Math.round(item.dailyBurn * 4)}${item.unit}`;
    setDraftPOs(prev => prev.map(d => d.id === draft.id
      ? { ...d, items: d.items.filter(line => line !== lineLabel) }
      : d));
    setBundledIntoDraftIds(prev => {
      const cur = prev[id] ?? [];
      return { ...prev, [id]: cur.filter(x => x !== draft.id) };
    });
    // If the user was viewing this draft as the selected stream, clear the override.
    setSelectedStreamId(prev => {
      if (prev[id] !== draft.id) return prev;
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    toast.success(`${item.name} removed from Draft ${draft.id} pipeline.`, {
      description: `Active shipment unchanged.`,
    });
    setChatMessages(prev => [...prev, {
      role: 'atlas',
      text: `${item.name} unbundled from Draft ${draft.id}. Stream dropped from this SKU's Phase 2 view.`,
    }]);
  }, [draftPOs]);
  const openGovernance = useCallback((agentId: number) => {
    if (typeof window !== 'undefined') {
      window.location.hash = `agent-${String(agentId).padStart(2, '0')}`;
    }
    onNavigate?.('governance');
  }, [onNavigate]);

  const cmdkRef = useRef<HTMLInputElement>(null);
  const auditSearchRef = useRef<HTMLInputElement>(null);
  const selected = ITEMS.find(i => i.id === selectedId) || null;

  // Derived
  const currentPar = parOverride ?? (selected?.parLevel || 0);
  const stockoutRisk = selected ? Math.max(0, Math.min(100, Math.round(100 - ((selected.onHand / Math.max(currentPar, 1)) * 100)))) : 0;
  const daysWithPar = selected ? +(selected.onHand / Math.max(selected.dailyBurn, 0.1)).toFixed(1) : 0;
  const workingCapitalImpact = selected && parOverride !== null ? Math.round((parOverride - selected.parLevel) * selected.unitCostRp) : 0;
  const workingCapitalPPN = Math.round(workingCapitalImpact * 0.11);

  const criticalItems = ITEMS.filter(i => i.group === 'critical');
  const watchItems = ITEMS.filter(i => i.group === 'watch');
  const autoItems = ITEMS.filter(i => i.group === 'autonomous');
  const safePercent = Math.round((autoItems.length / ITEMS.length) * 100);

  // Audit mode filtered items
  const auditFiltered = ITEMS.filter(i => {
    if (auditFilter !== 'all' && i.group !== auditFilter) return false;
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
    }
    return true;
  });

  const allAuditSelected = auditFiltered.length > 0 && auditFiltered.every(i => auditSelected.has(i.id));

  // ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdkOpen(o => !o); setCmdkSearch(''); }
      if (e.key === 'Escape') { setCmdkOpen(false); if (auditMode && !selectedId) setAuditMode(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [auditMode, selectedId]);

  useEffect(() => { if (cmdkOpen && cmdkRef.current) cmdkRef.current.focus(); }, [cmdkOpen]);
  useEffect(() => { if (auditMode && auditSearchRef.current) auditSearchRef.current.focus(); }, [auditMode]);

  // Reset on selection change
  useEffect(() => {
    setParOverride(null);
    setExpandedDag(new Set());
    if (selectedId && selected) {
      setChatMessages([{ role: 'atlas', text: selected.agentReasoning || `${selected.name} is well-stocked. No active agent actions right now.` }]);
    }
  }, [selectedId]);

  // Persistent Discovery: selecting in audit mode does NOT collapse the panel
  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  // Full Journey snap-back: only this exits audit mode and opens full center workspace
  const handleFullJourney = useCallback(() => {
    setAuditMode(false);
  }, []);

  const handleEmergencyReorder = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmergencyTriggered(prev => new Set(prev).add(id));
    setTimeout(() => { setEmergencyTriggered(prev => { const n = new Set(prev); n.delete(id); return n; }); }, 3000);
  }, []);

  const handleParConfirm = useCallback(() => {
    if (!selected || parOverride === null) return;
    setFlyingId(selected.id);
    setHardenedId(selected.id);
    setTimeout(() => {
      setIntelligenceLog(prev => [{ id: selected.id, name: selected.name, action: `Par → ${parOverride} ${selected.unit}`, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }, ...prev].slice(0, 8));
      setFlyingId(null);
    }, 600);
    setTimeout(() => setHardenedId(null), 3200);
    setParOverride(null);
  }, [selected, parOverride]);

  const handleChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setTimeout(() => {
      const response = selected
        ? `For ${selected.name}: A-02 (Restock) reports ${selected.dailyBurn} ${selected.unit}/day burn. ${selected.marketSignal ? `A-01 (Sourcing) signal: ${selected.marketSignal}.` : ''} ${selected.confidenceScore ? `Confidence: ${selected.confidenceScore}%.` : ''}`
        : 'Select an item to get specific intelligence from A-02 Restock, A-01 Sourcing, or A-04 Spend Watchdog.';
      setChatMessages(prev => [...prev, { role: 'atlas', text: response }]);
    }, 600);
  }, [chatInput, selected]);

  const toggleDag = useCallback((idx: number) => {
    setExpandedDag(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  }, []);

  const toggleAuditSelectAll = useCallback(() => {
    if (allAuditSelected) { setAuditSelected(new Set()); }
    else { setAuditSelected(new Set(auditFiltered.map(i => i.id))); }
  }, [allAuditSelected, auditFiltered]);

  const toggleAuditItem = useCallback((id: string) => {
    setAuditSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const cmdkResults = cmdkSearch.trim()
    ? ITEMS.filter(i => i.name.toLowerCase().includes(cmdkSearch.toLowerCase()) || i.id.toLowerCase().includes(cmdkSearch.toLowerCase()) || i.sku.toLowerCase().includes(cmdkSearch.toLowerCase())).slice(0, 8)
    : [];

  const dagStages = selected?.restockDag ? makeDagStages(selected.restockDag.stage, selected.restockDag.failedStage) : [];

  // ── Filter chips for audit mode ────────────────────────────────────
  const FILTER_CHIPS: { id: HeartbeatGroup | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: ITEMS.length },
    { id: 'critical', label: 'Critical', count: criticalItems.length },
    { id: 'watch', label: 'Watch', count: watchItems.length },
    { id: 'autonomous', label: 'Sufficient', count: autoItems.length },
  ];

  // ── Shared item card for sidebar ───────────────────────────────────
  const renderSidebarCard = (item: InventoryItem) => {
    const isSelected = selectedId === item.id;
    const isEmergency = emergencyTriggered.has(item.id);
    const isFly = flyingId === item.id;
    const onHand = getOnHand(item);
    const stockPct = Math.min(100, Math.round((onHand / Math.max(item.parLevel, 1)) * 100));
    const barColor = stockPct > 60 ? 'bg-green-500' : stockPct > 30 ? 'bg-amber-500' : 'bg-red-500';
    const meta = GROUP_META[item.group];
    const GI = meta.icon;
    const agent = getAssignedAgent(item);
    const itemMode = getLaborMode(item.id);
    const isManual = itemMode === 'manual';

    return (
      <button key={item.id} onClick={() => handleSelect(item.id)}
        className={`group w-full text-left p-3 rounded-lg border transition-all duration-[380ms] ${isFly ? 'opacity-0 translate-x-12 scale-90' : ''} ${
          isManual ? (isDark ? 'bg-amber-500/5 border-amber-500/40 hover:bg-amber-500/10' : 'bg-amber-50/60 border-amber-400/50 hover:bg-amber-100/50')
          : isSelected ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40' : 'bg-[#f4f6f0] border-[#87986a]/40'
          : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-[#f4f6f0]'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <GI className={`h-3 w-3 shrink-0 ${isDark ? meta.darkColor : meta.color}`} />
            <span className={`text-xs font-medium ${t.textPrimary} truncate`}>{item.name}</span>
            {/* Workforce attribution — Agent ID or Human Override */}
            <span
              title={isManual ? `Human Override active — ${agentLabel(agent)} in standby` : `${agentLabel(agent)} executing`}
              className={`inline-flex items-center gap-0.5 px-1 py-px rounded-full text-[8px] font-bold border shrink-0 ${
                isManual
                  ? isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-400/50 text-amber-700'
                  : isDark ? 'bg-[#87986a]/15 border-[#87986a]/30 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/30 text-[#6b7a54]'
              }`}>
              {isManual ? <AlertTriangle className="h-2 w-2" /> : <Bot className="h-2 w-2" />}
              {isManual ? 'Override' : `#${String(agent.id).padStart(2, '0')}`}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {!isEmergency && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.group !== 'autonomous' && (
                  <button onClick={(e) => { e.stopPropagation(); handleEmergencyReorder(item.id, e); }} title="Quick Restock"
                    className={`w-5 h-5 rounded flex items-center justify-center ${isDark ? 'hover:bg-amber-500/20 text-amber-400' : 'hover:bg-amber-50 text-amber-600'}`}>
                    <Zap className="h-3 w-3" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleSelect(item.id); }} title="View Forecast"
                  className={`w-5 h-5 rounded flex items-center justify-center ${isDark ? 'hover:bg-blue-500/20 text-blue-400' : 'hover:bg-blue-50 text-blue-600'}`}>
                  <BarChart3 className="h-3 w-3" />
                </button>
                {item.supplierPhone && (
                  <button onClick={(e) => e.stopPropagation()} title={`WhatsApp ${item.supplierName}`}
                    className={`w-5 h-5 rounded flex items-center justify-center ${isDark ? 'hover:bg-green-500/20 text-green-400' : 'hover:bg-green-50 text-green-600'}`}>
                    <MessageCircle className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            {isEmergency && <span className="text-[9px] font-semibold text-amber-400 animate-pulse">Reordering...</span>}
            <ChevronRight className={`h-3 w-3 shrink-0 ml-0.5 ${isSelected ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textMuted}`} />
          </div>
        </div>
        <p className={`text-[10px] leading-snug ${t.textMuted}`}>
          {item.daysRemaining <= 0 ? `Out of stock — ${item.autoReordered ? `incoming ${item.eta}` : 'needs emergency reorder'}` : item.daysRemaining <= 3 ? `${item.daysRemaining} days left${item.autoReordered ? ` · arriving ${item.eta}` : ''}` : `We've got you covered for ${Math.round(item.daysRemaining)} days`}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className={`flex-1 h-1.5 rounded-full ${t.progressTrack}`}><div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${stockPct}%` }} /></div>
          <span className={`text-[9px] w-14 text-right ${t.textMuted}`}>{onHand}/{item.parLevel} {item.unit}</span>
        </div>
      </button>
    );
  };

  // ── Compact Steering badge — toggles SKU labor mode in-place ────
  const renderSteeringBadge = (item: InventoryItem, opts?: { dense?: boolean }) => {
    const agent = getAssignedAgent(item);
    const isManual = getLaborMode(item.id) === 'manual';
    const dense = !!opts?.dense;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setMode(item.id, isManual ? 'agent' : 'manual'); }}
        title={isManual
          ? `Human Override active. Click to release back to ${agentLabel(agent)}.`
          : `${agentLabel(agent)} executing. Click to take over manually.`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold border transition-colors whitespace-nowrap ${
          dense ? 'text-[9px]' : 'text-[10px]'
        } ${
          isManual
            ? isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                    : 'bg-amber-50 border-amber-400/50 text-amber-700 hover:bg-amber-100'
            : isDark ? 'bg-[#87986a]/15 border-[#87986a]/30 text-[#a3b085] hover:bg-[#87986a]/25'
                    : 'bg-[#f4f6f0] border-[#87986a]/30 text-[#6b7a54] hover:bg-[#e8eddf]'
        }`}>
        {isManual ? <AlertTriangle className={dense ? 'h-2 w-2' : 'h-2.5 w-2.5'} /> : <Bot className={dense ? 'h-2 w-2' : 'h-2.5 w-2.5'} />}
        {isManual ? 'Override' : `#${String(agent.id).padStart(2, '0')}`}
      </button>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // LEFT PANEL (Heartbeat sidebar OR Audit Grid when expanded)
  // ══════════════════════════════════════════════════════════════════
  const leftPanel = (
    <div className="flex flex-col h-full">
      {/* ── TRIAGE MODE (default) ── */}
      {!auditMode && (
        <>
          <div className={t.section}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Stock Heartbeat</h2>
                <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>{criticalItems.length} critical · {watchItems.length} watch · {autoItems.length} flowing</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCatalogOpen(true)}
                  title="Manage Catalog"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <Database className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { setAuditMode(true); setAuditSearch(''); setAuditFilter('all'); setAuditSelected(new Set()); }}
                  title="Expand to Audit Mode"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] ${t.textMuted}`}>Stock health</span>
                <span className={`text-[10px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{safePercent}% safe</span>
              </div>
              <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
                <div className="h-1.5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-green-500 transition-all" style={{ width: `${safePercent}%` }} />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {([{ group: 'critical' as HeartbeatGroup, items: criticalItems }, { group: 'watch' as HeartbeatGroup, items: watchItems }, { group: 'autonomous' as HeartbeatGroup, items: autoItems }]).map(({ group, items }) => {
              if (items.length === 0) return null;
              const meta = GROUP_META[group]; const GI = meta.icon;
              return (
                <div key={group} className="px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <GI className={`h-3.5 w-3.5 ${isDark ? meta.darkColor : meta.color}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? meta.darkColor : meta.color}`}>{meta.label}</span>
                    <span className={`text-[10px] ${t.textMuted}`}>· {meta.desc}</span>
                  </div>
                  <div className="space-y-1.5">{items.map(item => renderSidebarCard(item))}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── AUDIT MODE (expanded grid) ── */}
      {auditMode && (
        <>
          <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Inventory Audit</h2>
                <p className={`text-[10px] ${t.textMuted}`}>{auditFiltered.length} of {ITEMS.length} SKUs · A-04 Spend Watchdog</p>
              </div>
              <button onClick={() => setAuditMode(false)} title="Collapse"
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.textMuted}`} />
              <Input ref={auditSearchRef} placeholder="Search by name, SKU, category..." value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className={`pl-9 text-xs h-8 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : ''}`} />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {FILTER_CHIPS.map(chip => (
                <button key={chip.id} onClick={() => setAuditFilter(chip.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    auditFilter === chip.id
                      ? isDark ? 'bg-[#87986a]/20 text-[#a3b085] border border-[#87986a]/30' : 'bg-[#f4f6f0] text-[#6b7a54] border border-[#dbe3ce]'
                      : isDark ? 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 border border-[#e5e5e0] hover:bg-gray-200'
                  }`}>
                  {chip.label} <span className="ml-1 opacity-60">{chip.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toolbar: Select All + View Toggle + Batch Action */}
          <div className={`px-4 py-2 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'} flex items-center gap-3`}>
            <button onClick={toggleAuditSelectAll} className="flex items-center gap-1.5">
              {allAuditSelected
                ? <SquareCheckBig className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                : <Square className={`h-3.5 w-3.5 ${t.textMuted}`} />
              }
              <span className={`text-[10px] font-medium ${t.textMuted}`}>{auditSelected.size > 0 ? `${auditSelected.size} selected` : 'Select All'}</span>
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

            {auditSelected.size > 0 && (
              <Button size="sm" className="h-6 px-3 text-[10px] bg-[#87986a] hover:bg-[#6b7a54] text-white">
                <Zap className="h-3 w-3 mr-1" /> Batch Restock ({auditSelected.size})
              </Button>
            )}
          </div>

          {/* Content: Table or Grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {auditView === 'table' ? (
              /* ── TABLE VIEW ── */
              <table className="w-full">
                <thead>
                  <tr className={`text-[9px] uppercase tracking-wide ${t.textMuted}`}>
                    <th className="text-left py-2 px-4 w-8"></th>
                    <th className="text-left py-2 px-2" style={{ maxWidth: 140 }}>Item</th>
                    <th className="text-left py-2 px-2" style={{ maxWidth: 80 }}>SKU</th>
                    <th className="text-left py-2 px-2" style={{ maxWidth: 70 }}>Category</th>
                    <th className="text-right py-2 px-2" style={{ maxWidth: 60 }}>On Hand</th>
                    <th className="text-right py-2 px-2" style={{ maxWidth: 50 }}>Par</th>
                    <th className="text-right py-2 px-2" style={{ maxWidth: 60 }}>Burn/Day</th>
                    <th className="text-center py-2 px-2" style={{ maxWidth: 90 }}>Steering</th>
                    <th className="text-center py-2 px-2" style={{ maxWidth: 70 }}>Status</th>
                    <th className="text-right py-2 px-2" style={{ maxWidth: 60 }}>Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {auditFiltered.map(item => {
                    const meta = GROUP_META[item.group]; const GI = meta.icon;
                    const isChecked = auditSelected.has(item.id);
                    return (
                      <tr key={item.id}
                        onClick={() => handleSelect(item.id)}
                        className={`cursor-pointer border-b transition-colors duration-200 ${
                          selectedId === item.id ? (isDark ? 'bg-[#87986a]/10 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#87986a]/20') : isDark ? 'border-gray-800/50 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-[#f4f6f0]'
                        }`}>
                        <td className="py-2 px-4">
                          <button onClick={(e) => { e.stopPropagation(); toggleAuditItem(item.id); }}>
                            {isChecked
                              ? <SquareCheckBig className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                              : <Square className={`h-3.5 w-3.5 ${t.textMuted}`} />
                            }
                          </button>
                        </td>
                        <td className="py-2 px-2" style={{ maxWidth: 140 }}>
                          <span className={`text-xs font-medium ${t.textPrimary} truncate block`}>{item.name}</span>
                        </td>
                        <td className="py-2 px-2" style={{ maxWidth: 80 }}>
                          <span className={`text-[10px] ${t.textMuted}`}>{item.sku}</span>
                        </td>
                        <td className="py-2 px-2" style={{ maxWidth: 70 }}>
                          <span className={`text-[10px] ${t.textMuted}`}>{item.category}</span>
                        </td>
                        <td className="py-2 px-2 text-right" style={{ maxWidth: 60 }}>
                          <span className={`text-xs font-semibold ${t.textPrimary}`}>{getOnHand(item)}</span>
                          <span className={`text-[9px] ml-0.5 ${t.textMuted}`}>{item.unit}</span>
                        </td>
                        <td className="py-2 px-2 text-right" style={{ maxWidth: 50 }}>
                          <span className={`text-[10px] ${t.textMuted}`}>
                            {getParMode(item.id) === 'manual' && manualParFixed[item.id] !== undefined
                              ? <span className={isDark ? 'text-amber-300' : 'text-amber-700'}>{manualParFixed[item.id]}*</span>
                              : item.parLevel}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right" style={{ maxWidth: 60 }}>
                          <span className={`text-[10px] ${t.textMuted}`}>{item.dailyBurn}</span>
                        </td>
                        <td className="py-2 px-2 text-center" style={{ maxWidth: 90 }}>
                          {renderSteeringBadge(item)}
                        </td>
                        <td className="py-2 px-2 text-center" style={{ maxWidth: 70 }}>
                          <div className="inline-flex items-center gap-1">
                            <GI className={`h-3 w-3 ${isDark ? meta.darkColor : meta.color}`} />
                            <span className={`text-[9px] font-medium ${isDark ? meta.darkColor : meta.color}`}>{meta.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right" style={{ maxWidth: 60 }}>
                          <span className={`text-xs font-semibold ${item.daysRemaining <= 1 ? (isDark ? 'text-red-400' : 'text-red-600') : item.daysRemaining <= 3 ? (isDark ? 'text-amber-400' : 'text-amber-600') : t.textPrimary}`}>
                            {item.daysRemaining <= 0 ? '0' : item.daysRemaining}d
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* ── GRID (CARDS) VIEW ── */
              <div className="p-4 grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {auditFiltered.map(item => {
                  const meta = GROUP_META[item.group]; const GI = meta.icon;
                  const isChecked = auditSelected.has(item.id);
                  const onHandG = getOnHand(item);
                  const stockPct = Math.min(100, Math.round((onHandG / Math.max(item.parLevel, 1)) * 100));
                  const barColor = stockPct > 60 ? 'bg-green-500' : stockPct > 30 ? 'bg-amber-500' : 'bg-red-500';
                  const isManualCardMode = getLaborMode(item.id) === 'manual';

                  return (
                    <button key={item.id} onClick={() => handleSelect(item.id)}
                      className={`group relative w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                        isManualCardMode ? 'bg-amber-500/5 border-amber-500/40'
                        : selectedId === item.id ? (isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 ring-1 ring-[#87986a]/20' : 'bg-[#f4f6f0] border-[#87986a]/40 ring-1 ring-[#87986a]/20')
                        : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-[#f4f6f0]'
                      }`}>
                      {/* Checkbox */}
                      <div className="absolute top-2.5 right-2.5" onClick={(e) => { e.stopPropagation(); toggleAuditItem(item.id); }}>
                        {isChecked
                          ? <SquareCheckBig className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                          : <Square className={`h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${t.textMuted}`} />
                        }
                      </div>

                      {/* Status + Name */}
                      <div className="flex items-center gap-1.5 mb-1.5 pr-5">
                        <GI className={`h-3 w-3 shrink-0 ${isDark ? meta.darkColor : meta.color}`} />
                        <span className={`text-xs font-medium ${t.textPrimary} truncate`}>{item.name}</span>
                      </div>

                      {/* Category + SKU + Steering */}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <p className={`text-[9px] truncate ${t.textMuted}`}>{item.category} · {item.sku}</p>
                        <div className="shrink-0">{renderSteeringBadge(item, { dense: true })}</div>
                      </div>

                      {/* Stock bar */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`flex-1 h-1.5 rounded-full ${t.progressTrack}`}>
                          <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${stockPct}%` }} />
                        </div>
                        <span className={`text-[9px] ${t.textMuted}`}>{stockPct}%</span>
                      </div>

                      {/* Metrics row */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-xs font-semibold ${t.textPrimary}`}>{onHandG}</span>
                          <span className={`text-[9px] ml-0.5 ${t.textMuted}`}>{item.unit}</span>
                          <span className={`text-[9px] mx-1 ${t.textMuted}`}>/</span>
                          <span className={`text-[9px] ${t.textMuted}`}>
                            {getParMode(item.id) === 'manual' && manualParFixed[item.id] !== undefined
                              ? <span className={isDark ? 'text-amber-300' : 'text-amber-700'}>{manualParFixed[item.id]}* par</span>
                              : `${item.parLevel} par`}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold ${
                          item.daysRemaining <= 1 ? (isDark ? 'text-red-400' : 'text-red-600')
                          : item.daysRemaining <= 3 ? (isDark ? 'text-amber-400' : 'text-amber-600')
                          : t.textPrimary
                        }`}>
                          {item.daysRemaining <= 0 ? '0' : item.daysRemaining}d
                        </span>
                      </div>

                      {/* Burn rate */}
                      <p className={`text-[9px] mt-1 ${t.textMuted}`}>{item.dailyBurn} {item.unit}/day burn</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // CENTER PANEL (hidden in audit mode, morphs on selection)
  // ══════════════════════════════════════════════════════════════════
  const centerPanel = (
    <div className="p-6 relative">
      {hardenedId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500 text-white text-xs font-semibold shadow-lg" style={{ animation: 'floatUp 3s ease-out forwards' }}>
          <ShieldCheck className="h-4 w-4" /> System Hardened — New safety threshold locked
        </div>
      )}

      {/* DEFAULT: Velocity Map */}
      <div className={`transition-all duration-[380ms] ${selected ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100'}`}>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: Package, label: 'Total SKUs', value: `${ITEMS.length}`, sub: `${criticalItems.length + watchItems.length} need attention` },
            { icon: Flame, label: 'Critical', value: `${criticalItems.length}`, sub: 'Immediate restock' },
            { icon: Zap, label: 'Auto-Reorders', value: `${ITEMS.filter(i => i.autoReordered).length}`, sub: 'Active through kernel' },
          ].map(m => (
            <div key={m.label} className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <div className="flex items-center gap-1.5 mb-1"><m.icon className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} /><span className={`text-[10px] ${t.textMuted}`}>{m.label}</span></div>
              <span className={`text-sm font-bold ${t.textPrimary}`}>{m.value}</span>
              <p className={`text-[9px] mt-0.5 ${t.textMuted}`}>{m.sub}</p>
            </div>
          ))}
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Consumption Velocity Map</h3>
              <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>Real-time depletion from A-02 (Restock)</p>
            </div>
            <Badge variant="outline" className={isDark ? 'bg-[#87986a]/10 text-[#a3b085] border-[#87986a]/20 text-[10px]' : 'bg-[#f4f6f0] text-[#6b7a54] border-[#dbe3ce] text-[10px]'}>
              <Activity className="h-3 w-3 mr-1" /> Live
            </Badge>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={AGGREGATE_VELOCITY} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={isDark ? '#a3b085' : '#87986a'} stopOpacity={0.3} /><stop offset="95%" stopColor={isDark ? '#a3b085' : '#87986a'} stopOpacity={0.05} /></linearGradient>
                  <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={isDark ? '#6b7a54' : '#a3b085'} stopOpacity={0.15} /><stop offset="95%" stopColor={isDark ? '#6b7a54' : '#a3b085'} stopOpacity={0.02} /></linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: isDark ? '#2a2a2a' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 8, fontSize: 11, color: isDark ? '#fff' : '#111' }} />
                <Area type="monotone" dataKey="forecast" stroke={isDark ? '#6b7a54' : '#a3b085'} strokeDasharray="4 4" fill="url(#fcGrad)" strokeWidth={1.5} name="AI Forecast" />
                <Area type="monotone" dataKey="actual" stroke={isDark ? '#a3b085' : '#87986a'} fill="url(#velGrad)" strokeWidth={2} name="Actual" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <h3 className={`text-[10px] font-semibold uppercase tracking-wide ${t.sectionLabel}`}>Highest Burn Rates</h3>
          {[...ITEMS].sort((a, b) => b.dailyBurn - a.dailyBurn).slice(0, 6).map(item => {
            const barPct = Math.min(100, Math.round((item.dailyBurn / 20) * 100));
            const meta = GROUP_META[item.group]; const GI = meta.icon;
            return (
              <button key={item.id} onClick={() => handleSelect(item.id)}
                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-[#f4f6f0]'}`}>
                <GI className={`h-3 w-3 shrink-0 ${isDark ? meta.darkColor : meta.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between"><span className={`text-xs font-medium truncate ${t.textPrimary}`}>{item.name}</span><span className={`text-[10px] ${t.textMuted}`}>{item.dailyBurn} {item.unit}/day</span></div>
                  <div className={`mt-1 h-1.5 rounded-full ${t.progressTrack}`}><div className="h-1.5 rounded-full bg-gradient-to-r from-green-500 via-amber-400 to-red-500 transition-all" style={{ width: `${barPct}%` }} /></div>
                </div>
                <ChevronRight className={`h-3 w-3 shrink-0 ${t.textMuted}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE: Item Journey + Digital Twin */}
      <div className={`transition-all duration-[380ms] ${selected ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
        {selected && (() => {
          const skuMode = getLaborMode(selected.id);
          const skuIsManual = skuMode === 'manual';
          const skuAgent = getAssignedAgent(selected);
          const onHandSel = getOnHand(selected);
          const manualCount = manualCounts[selected.id];
          return (
          <div className="space-y-5">
            {/* ═══ MANUAL TAKEOVER BANNER ═══
                Pulled out of the header card so the state change is immediately
                obvious — this is the only top-level governance signal. */}
            {skuIsManual && (
              <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 ${
                isDark ? 'bg-amber-500/10 border-amber-500/50' : 'bg-amber-50 border-amber-500/60'
              }`}>
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                    Manual Takeover · You are driving {selected.name}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-200/80' : 'text-amber-900/80'}`}>
                    {agentLabel(skuAgent)} paused. Forecast and auto-restock suspended. Phase 2 execution stays a read-only mirror of Orders.
                  </div>
                </div>
                <button onClick={() => setMode(selected.id, 'agent')}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors">
                  <Bot className="h-3 w-3" /> Resume Agent
                </button>
              </div>
            )}

            {/* ═══ SKU HEADER ═══
                Three rows · clear visual hierarchy.
                  Row A: identity (title + status + governance link)        — focus
                  Row B: meta + Mode toggle + Back                          — context + state
                  Row C: action toolbar (Restock primary · Adjust · Pipeline) — actions  */}
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              {/* Row A — identity */}
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-base font-bold ${t.textPrimary}`}>{selected.name}</h2>
                {(() => { const m = GROUP_META[selected.group]; const I = m.icon; return (
                  <Badge variant="outline" className={`text-[10px] ${isDark ? `${m.bgDark} ${m.darkColor}` : `${m.bgLight} ${m.color}`}`}>
                    <I className="h-3 w-3 mr-0.5" /> {m.label}
                  </Badge>
                ); })()}
                <button
                  onClick={() => openGovernance(skuAgent.id)}
                  title="Open this agent's directory profile to tune autonomy & approval limits"
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold hover:underline ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                  <Bot className="h-3 w-3" />
                  Managed by {agentLabel(skuAgent)}
                  <ExternalLink className="h-2.5 w-2.5" />
                </button>
                <button onClick={() => setSelectedId(null)}
                  className={`ml-auto text-[10px] ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}>
                  ← Back to map
                </button>
              </div>

              {/* Row B — meta + governance state toggle */}
              <div className="flex items-center justify-between gap-3 flex-wrap mt-1.5">
                <p className={`text-xs ${t.textMuted}`}>
                  {selected.category} · <span className={t.textPrimary}>{onHandSel} {selected.unit}</span> on hand
                  {manualCount && (
                    <span className={`ml-1 inline-flex items-center gap-0.5 text-[9px] font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}
                          title={`Manual count saved ${new Date(manualCount.ts).toLocaleString()}${manualCount.note ? ` · "${manualCount.note}"` : ''}`}>
                      <AlertTriangle className="h-2 w-2" /> Override
                    </span>
                  )}
                  {' · '}{selected.dailyBurn} {selected.unit}/day · {selected.sku}
                </p>
                {/* Mode toggle (state, not action) — compact pill */}
                <div className={`inline-flex items-stretch rounded-full border text-[10px] ${isDark ? 'border-gray-700 bg-[#2a2a2a]' : 'border-[#e5e5e0] bg-gray-50'}`}>
                  <button onClick={() => setMode(selected.id, 'agent')}
                    title={!skuIsManual ? `${agentLabel(skuAgent)} executing autonomously` : `Resume ${agentLabel(skuAgent)}`}
                    className={`flex items-center gap-1 pl-2 pr-2.5 py-0.5 rounded-full font-semibold transition-colors ${
                      !skuIsManual
                        ? 'bg-[#87986a] text-white'
                        : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                    }`}>
                    <Bot className="h-2.5 w-2.5" />
                    {agentBadge(skuAgent)} Active
                  </button>
                  <button onClick={() => setMode(selected.id, 'manual')}
                    title={skuIsManual ? 'You are driving' : `Pause ${agentLabel(skuAgent)} and take over`}
                    className={`flex items-center gap-1 pl-2 pr-2.5 py-0.5 rounded-full font-semibold transition-colors ${
                      skuIsManual
                        ? 'bg-amber-500 text-white'
                        : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                    }`}>
                    <Hand className="h-2.5 w-2.5" />
                    Manual
                  </button>
                </div>
              </div>

              {/* Agent Watch — answer "when does the agent decide to act?" in plain English.
                  Renders only when the agent is in charge; in Manual mode the
                  amber banner above already covers the "paused" state. */}
              {!skuIsManual && (() => {
                const par = manualParFixed[selected.id] ?? selected.parLevel;
                const onHand = onHandSel;
                const isManualFloor = getParMode(selected.id) === 'manual' && manualParFixed[selected.id] !== undefined;
                const stream = getSelectedStream(selected);
                const breached = onHand < par;
                const wellAbove = onHand > par * 1.6;
                let detail: React.ReactNode;
                if (breached && stream) {
                  detail = (
                    <>
                      <span className="font-semibold text-amber-500">{onHand} {selected.unit}</span>
                      <span className={t.textMuted}> &lt; </span>
                      <span className="font-semibold">{par} {selected.unit} par</span>
                      <span className={t.textMuted}> · auto-restock fired · </span>
                      <span className={`font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{stream.id}</span>
                      <span className={t.textMuted}>
                        {stream.kind === 'active' ? ' in transit' : ' draft'}{stream.eta ? ` · ETA ${stream.eta}` : ''}
                      </span>
                    </>
                  );
                } else if (breached) {
                  detail = (
                    <>
                      <span className="font-semibold text-amber-500">{onHand} {selected.unit}</span>
                      <span className={t.textMuted}> &lt; </span>
                      <span className="font-semibold">{par} {selected.unit} par</span>
                      <span className={t.textMuted}> · drafting PO with {selected.supplierName ?? 'primary vetted vendor'}…</span>
                    </>
                  );
                } else if (wellAbove) {
                  detail = (
                    <>
                      <span className="font-semibold">{onHand} {selected.unit}</span>
                      <span className={t.textMuted}> ≫ </span>
                      <span>{par} {selected.unit} par</span>
                      <span className={t.textMuted}> · stable, no action needed</span>
                    </>
                  );
                } else {
                  detail = (
                    <>
                      <span className="font-semibold">{onHand} / {par} {selected.unit}</span>
                      <span className={t.textMuted}> par · will fire restock the moment stock dips below </span>
                      <span className="font-semibold">{par} {selected.unit}</span>
                    </>
                  );
                }
                return (
                  <div className={`mt-3 px-3 py-2 rounded-lg border flex items-center gap-2 flex-wrap ${
                    breached
                      ? isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-300/60'
                      : isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
                  }`}>
                    <span className="relative flex h-2 w-2 shrink-0" title="Live">
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${breached ? 'bg-amber-500' : 'bg-[#87986a]'}`} />
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${breached ? 'bg-amber-500' : 'bg-[#87986a]'}`} />
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${
                      breached
                        ? isDark ? 'text-amber-300' : 'text-amber-700'
                        : isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                    }`}>
                      {skuAgent.id} Watch
                    </span>
                    <span className={`text-[11px] ${t.textPrimary}`}>{detail}</span>
                    <span className={`ml-auto text-[9px] ${t.textMuted}`}>
                      {isManualFloor ? 'Honoring your manual floor · ' : ''}
                      Re-checks every 30 min
                    </span>
                  </div>
                );
              })()}

              {/* Row C — action toolbar (primary · secondary · tertiary) */}
              <div className={`mt-3 pt-3 border-t flex items-center gap-1.5 flex-wrap ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
                {/* Primary — Restock Now */}
                <button onClick={() => handleRestockNow(selected.id)}
                  title={`Open a fresh PO with ${selected.supplierName ?? 'your primary vetted vendor'} pre-filled`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm bg-[#87986a] text-white hover:bg-[#6b7a54]">
                  <Package className="h-3.5 w-3.5" />
                  Restock Now
                </button>
                {/* Secondary — Adjust Stock (lighter outline) */}
                <button onClick={() => openAdjust(selected.id)}
                  title="Record a physical count taken on the floor"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                  <ClipboardEdit className="h-3.5 w-3.5" />
                  Adjust Stock
                </button>
                {/* Pipeline — state-aware bundle control */}
                  {(() => {
                    const allDrafts = findDraftsForVendor(selected.supplierName);
                    if (allDrafts.length === 0) return null;
                    const inIds = bundledIntoDraftIds[selected.id] ?? [];
                    const inDrafts = allDrafts.filter(d => inIds.includes(d.id));
                    const availableDrafts = allDrafts.filter(d => !inIds.includes(d.id));
                    const isOpen = pipelineMenuOpen === selected.id;

                    // Quick-add path: exactly one available draft, none currently bundled.
                    if (inDrafts.length === 0 && availableDrafts.length === 1) {
                      const d = availableDrafts[0];
                      return (
                        <button onClick={() => handleAddToDraft(selected.id, d.id)}
                          title={`Bundle ${selected.name} into Draft ${d.id} (${d.vendor})`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm border ${
                            isDark ? 'bg-[#1f2a1f] border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/15'
                                  : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54] hover:bg-[#e8eddf]'
                          }`}>
                          <span className="font-bold">+</span>
                          Add to {d.id}
                        </button>
                      );
                    }

                    // Status-only: SKU is in the only available draft.
                    if (availableDrafts.length === 0 && inDrafts.length === 1) {
                      const d = inDrafts[0];
                      return (
                        <button onClick={() => handleRemoveFromDraft(selected.id, d.id)}
                          title={`Already bundled in Draft ${d.id} — click to remove`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm border ${
                            isDark ? 'bg-[#87986a]/15 border-[#87986a]/50 text-[#a3b085] hover:bg-amber-500/15 hover:border-amber-500/40 hover:text-amber-300'
                                  : 'bg-[#f4f6f0] border-[#87986a]/50 text-[#6b7a54] hover:bg-amber-50 hover:border-amber-400/50 hover:text-amber-700'
                          }`}>
                          <Check className="h-3 w-3" />
                          In {d.id}
                        </button>
                      );
                    }

                    // Multi-draft / mixed state — render dropdown menu.
                    const totalIn = inDrafts.length;
                    const label = totalIn === 0
                      ? `+ Add to PO`
                      : `Pipeline (${totalIn})`;
                    return (
                      <div className="relative" data-pipeline-menu>
                        <button
                          onClick={() => setPipelineMenuOpen(isOpen ? null : selected.id)}
                          title={totalIn === 0
                            ? `${availableDrafts.length} open drafts available for ${selected.supplierName}`
                            : `In ${totalIn} draft${totalIn === 1 ? '' : 's'} · ${availableDrafts.length} more available`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm border ${
                            totalIn > 0
                              ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/50 text-[#a3b085] hover:bg-[#87986a]/25'
                                      : 'bg-[#f4f6f0] border-[#87986a]/50 text-[#6b7a54] hover:bg-[#e8eddf]'
                              : isDark ? 'bg-[#1f2a1f] border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/15'
                                      : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54] hover:bg-[#e8eddf]'
                          }`}>
                          {totalIn > 0 ? <Check className="h-3 w-3" /> : <span className="font-bold">+</span>}
                          {label}
                          <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className={`absolute right-0 top-full mt-1.5 w-72 rounded-xl border shadow-xl z-30 overflow-hidden ${
                            isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-[#e5e5e0]'
                          }`} data-pipeline-menu>
                            <div className={`px-3 py-2 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
                              <div className={`text-[9px] font-bold uppercase tracking-wide ${t.textMuted}`}>
                                Pipeline · {selected.supplierName}
                              </div>
                              <div className={`text-[9px] mt-0.5 ${t.textMuted}`}>
                                {allDrafts.length} open draft{allDrafts.length === 1 ? '' : 's'} from your vetted directory
                              </div>
                            </div>
                            <div className="py-1 max-h-64 overflow-y-auto">
                              {/* Bundled (✓) — click to remove */}
                              {inDrafts.map(d => (
                                <button key={d.id}
                                  onClick={() => { handleRemoveFromDraft(selected.id, d.id); }}
                                  className={`group w-full px-3 py-2 flex items-start gap-2 text-left transition-colors ${
                                    isDark ? 'hover:bg-amber-500/10' : 'hover:bg-amber-50'
                                  }`}>
                                  <Check className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-[11px] font-semibold ${t.textPrimary}`}>{d.id}</div>
                                    <div className={`text-[9px] ${t.textMuted}`}>
                                      {d.items.length} line{d.items.length === 1 ? '' : 's'} · Stage {d.stage + 1}/5 · {agentLabel(d.assignedAgent)}
                                    </div>
                                  </div>
                                  <span className={`shrink-0 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${
                                    isDark ? 'text-amber-300' : 'text-amber-700'
                                  }`}>Remove</span>
                                </button>
                              ))}
                              {inDrafts.length > 0 && availableDrafts.length > 0 && (
                                <div className={`mx-3 my-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />
                              )}
                              {/* Available — click to add */}
                              {availableDrafts.map(d => (
                                <button key={d.id}
                                  onClick={() => { handleAddToDraft(selected.id, d.id); setPipelineMenuOpen(null); }}
                                  className={`group w-full px-3 py-2 flex items-start gap-2 text-left transition-colors ${
                                    isDark ? 'hover:bg-[#87986a]/10' : 'hover:bg-[#f4f6f0]'
                                  }`}>
                                  <span className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border ${
                                    isDark ? 'border-gray-600' : 'border-gray-300'
                                  }`}>
                                    <span className="text-[10px] font-bold leading-none">+</span>
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-[11px] font-semibold ${t.textPrimary}`}>{d.id}</div>
                                    <div className={`text-[9px] ${t.textMuted}`}>
                                      {d.items.length} line{d.items.length === 1 ? '' : 's'} · Stage {d.stage + 1}/5 · {agentLabel(d.assignedAgent)}
                                    </div>
                                  </div>
                                  <span className={`shrink-0 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${
                                    isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                                  }`}>Add</span>
                                </button>
                              ))}
                            </div>
                            {/* Footer hint — drives the user to Restock Now if they need a brand-new PO */}
                            <div className={`px-3 py-2 border-t flex items-center gap-1.5 ${isDark ? 'border-gray-800 bg-[#1f1f1f]' : 'border-[#e5e5e0] bg-gray-50'}`}>
                              <span className={`text-[9px] ${t.textMuted}`}>Need a fresh PO instead?</span>
                              <button
                                onClick={() => { setPipelineMenuOpen(null); handleRestockNow(selected.id); }}
                                className={`ml-auto text-[10px] font-bold inline-flex items-center gap-1 ${isDark ? 'text-[#a3b085] hover:text-[#c5d3a8]' : 'text-[#6b7a54] hover:text-[#556142]'}`}>
                                <Package className="h-3 w-3" /> Restock Now
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            </div>

            {/* Item velocity */}
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <div className="flex items-center justify-between mb-2"><h3 className={`text-xs font-semibold ${t.textPrimary}`}>Consumption Velocity</h3><span className={`text-[10px] ${t.textMuted}`}>7-day · {selected.dailyBurn} {selected.unit}/day avg</span></div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selected.velocityData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <defs><linearGradient id="ivGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={isDark ? '#a3b085' : '#87986a'} stopOpacity={0.3} /><stop offset="95%" stopColor={isDark ? '#a3b085' : '#87986a'} stopOpacity={0.05} /></linearGradient></defs>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: isDark ? '#2a2a2a' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 8, fontSize: 11, color: isDark ? '#fff' : '#111' }} />
                    <Area type="monotone" dataKey="units" stroke={isDark ? '#a3b085' : '#87986a'} fill="url(#ivGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ═══ Par Level · Digital Twin ═══
                Two distinct jobs in one card:
                  1. SAVED PAR — the value the agent (or your manual floor) is using right now.
                  2. SIMULATOR — drag the slider to *preview* what risk looks like at any other value.
                Saving / committing a value only happens in Manual Fixed mode. */}
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="min-w-0">
                  <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Par Level — Digital Twin</h3>
                  <p className={`text-[10px] ${t.textMuted}`}>
                    Drag the slider to preview risk at different par values · {getParMode(selected.id) === 'manual'
                      ? 'commit with Save Manual Floor.'
                      : 'switch to Manual Fixed to commit.'}
                  </p>
                </div>
                {/* AI Recommended | Manual Fixed toggle */}
                <div className={`inline-flex items-stretch rounded-full border ${isDark ? 'border-gray-700 bg-[#2a2a2a]' : 'border-[#e5e5e0] bg-gray-50'}`}>
                  <button
                    onClick={() => setParModeWithPivot(selected.id, 'ai')}
                    className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                      getParMode(selected.id) === 'ai'
                        ? 'bg-[#87986a] text-white shadow-sm'
                        : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                    }`}>
                    <Bot className="h-3 w-3" /> AI Recommended
                  </button>
                  <button
                    onClick={() => setParModeWithPivot(selected.id, 'manual')}
                    className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                      getParMode(selected.id) === 'manual'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                    }`}>
                    <Lock className="h-3 w-3" /> Manual Fixed
                  </button>
                </div>
                {/* Save Manual Floor — always visible in Manual Fixed mode */}
                {getParMode(selected.id) === 'manual' && (
                  <Button
                    onClick={() => {
                      const valueToSave = parOverride ?? currentPar;
                      setManualParFixed(prev => ({ ...prev, [selected.id]: valueToSave }));
                      const onHand = getOnHand(selected);
                      const restockNeeded = onHand < valueToSave;
                      toast.success(`Manual floor saved at ${valueToSave}${selected.unit}.`, {
                        description: restockNeeded
                          ? `Below floor — ${getAssignedAgent(selected).id} initiating restock now.`
                          : 'Above floor · no restock needed yet.',
                      });
                      setChatMessages(prev => [...prev, {
                        role: 'atlas',
                        text: restockNeeded
                          ? `Manual Par of ${valueToSave} ${selected.unit} saved. Autonomous forecasting suspended; ${agentLabel(getAssignedAgent(selected))} is initiating a restock to meet your new floor (current ${onHand} ${selected.unit} < ${valueToSave} ${selected.unit}).`
                          : `Manual Par of ${valueToSave} ${selected.unit} saved. Autonomous forecasting suspended; current ${onHand} ${selected.unit} is above the floor so no restock is required yet.`,
                      }]);
                      if (restockNeeded) {
                        setForceCompletedRestock(prev => ({ ...prev, [selected.id]: Math.max(prev[selected.id] ?? 0, 4) }));
                      }
                      handleParConfirm();
                    }}
                    disabled={parOverride === null && manualParFixed[selected.id] === currentPar}
                    size="sm"
                    className="h-8 px-4 text-xs text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    {manualParFixed[selected.id] !== undefined ? 'Update Floor' : 'Save Manual Floor'}
                  </Button>
                )}
                {/* AI mode: only surface a lock button if the slider drifts (rare). */}
                {getParMode(selected.id) === 'ai' && parOverride !== null && parOverride !== selected.parLevel && (
                  <Button onClick={handleParConfirm} size="sm"
                    className="h-8 px-4 text-xs text-white bg-green-600 hover:bg-green-700">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Lock New Par
                  </Button>
                )}
              </div>
              {/* SAVED PAR — what the system is actually using right now */}
              {(() => {
                const savedValue = manualParFixed[selected.id] ?? selected.parLevel;
                const savedKind = manualParFixed[selected.id] !== undefined ? 'manual' : 'ai';
                const isPreviewing = parOverride !== null && parOverride !== savedValue;
                return (
                  <div className={`mb-3 p-3 rounded-lg border flex items-center justify-between gap-3 flex-wrap ${
                    savedKind === 'manual'
                      ? isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-300/60'
                      : isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {savedKind === 'manual' ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <Bot className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />}
                      <div className="min-w-0">
                        <div className={`text-[9px] font-bold uppercase tracking-wide ${
                          savedKind === 'manual'
                            ? isDark ? 'text-amber-300' : 'text-amber-700'
                            : isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                        }`}>
                          {savedKind === 'manual' ? 'Your Hard Floor' : 'AI-set Par'} — currently in effect
                        </div>
                        <div className={`text-sm font-bold ${t.textPrimary}`}>
                          {savedValue} {selected.unit}
                          {isPreviewing && (
                            <span className={`ml-2 text-[10px] font-medium ${t.textMuted}`}>
                              (previewing {parOverride} {selected.unit})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`text-[10px] ${t.textMuted} max-w-xs text-right`}>
                      {getParMode(selected.id) === 'manual'
                        ? 'Drag to a new value, then click Save Manual Floor to commit.'
                        : 'Drag the slider to simulate · changes preview only · Manual Fixed to commit.'}
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-3">
                {/* Slider — always interactive (Digital Twin = simulator). */}
                <div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] w-8 ${t.textMuted}`}>0</span>
                    <input
                      type="range" min={0} max={Math.round(selected.parLevel * 2.5)} value={currentPar}
                      onChange={(e) => setParOverride(Number(e.target.value))}
                      title={getParMode(selected.id) === 'ai'
                        ? 'Drag to preview risk at this par level — won\'t commit until you switch to Manual Fixed.'
                        : 'Drag to your hard floor, then click Save Manual Floor.'}
                      className="flex-1 h-3 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, ${
                        getParMode(selected.id) === 'manual' ? '#f59e0b' : isDark ? '#a3b085' : '#87986a'
                      } ${(currentPar / (selected.parLevel * 2.5)) * 100}%, ${isDark ? '#374151' : '#e5e7eb'} 0%)` }} />
                    <span className={`text-xs w-20 text-right ${t.textMuted}`}>{Math.round(selected.parLevel * 2.5)} {selected.unit}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1.5 px-9">
                    <span className={`text-[9px] ${t.textMuted}`}>min</span>
                    <span className={`text-[10px] font-bold ${t.textPrimary}`}>
                      {parOverride !== null ? `Previewing ${parOverride} ${selected.unit}` : `${currentPar} ${selected.unit}`}
                    </span>
                    <span className={`text-[9px] ${t.textMuted}`}>max</span>
                  </div>
                </div>
                {/* Preview metrics — explicitly labeled "if you set par to X" */}
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-[#e5e5e0]'}`}>
                  <div className={`text-[9px] font-bold uppercase tracking-wide mb-2 ${t.textMuted}`}>
                    Preview at {currentPar} {selected.unit} par
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] flex items-center gap-1 ${t.textMuted}`}><Gauge className="h-3 w-3" /> Stockout Risk</span>
                        <span className={`text-xs font-bold ${stockoutRisk > 60 ? (isDark ? 'text-red-400' : 'text-red-600') : stockoutRisk > 30 ? (isDark ? 'text-amber-400' : 'text-amber-600') : isDark ? 'text-green-400' : 'text-green-600'}`}>{stockoutRisk}%</span>
                      </div>
                      <div className={`h-2 rounded-full ${t.progressTrack}`}><div className={`h-2 rounded-full transition-all duration-200 ${stockoutRisk > 60 ? 'bg-red-500' : stockoutRisk > 30 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${stockoutRisk}%` }} /></div>
                    </div>
                    <div className="text-right"><span className={`text-xs font-bold ${t.textPrimary}`}>{daysWithPar}d</span><p className={`text-[9px] ${t.textMuted}`}>runway</p></div>
                  </div>
                </div>

                {/* Working capital callout — only when previewing a different value */}
                {parOverride !== null && parOverride !== selected.parLevel && (
                  <div className={`p-3 rounded-lg border ${workingCapitalImpact > 0 ? isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200' : isDark ? 'bg-green-500/5 border-green-500/20' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className={`h-3 w-3 ${workingCapitalImpact > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-green-400' : 'text-green-600')}`} />
                      <span className={`text-[10px] font-semibold ${workingCapitalImpact > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-green-400' : 'text-green-600')}`}>Working Capital Impact</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${t.textSecondary}`}>
                      {workingCapitalImpact > 0 ? `Raising par to ${parOverride} ${selected.unit} reduces risk to ${stockoutRisk}% but ties up Rp ${Math.abs(workingCapitalImpact).toLocaleString()} extra (incl. Rp ${workingCapitalPPN.toLocaleString()} PPN).` : `Lowering par frees Rp ${Math.abs(workingCapitalImpact).toLocaleString()} but increases risk to ${stockoutRisk}%.`}
                    </p>
                  </div>
                )}

                {/* Atlas recommendation — actionable in Manual Fixed mode */}
                {(() => {
                  const recommended = Math.round(selected.dailyBurn * 4);
                  const recommendedRisk = Math.max(0, Math.min(100, Math.round(100 - ((onHandSel / Math.max(recommended, 1)) * 100))));
                  const isManualFloor = getParMode(selected.id) === 'manual';
                  const alreadyAtRecommended = currentPar === recommended;
                  return (
                    <div className={`p-3 rounded-lg border flex items-start gap-2 ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                      <Sparkles className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                          Atlas · Recommendation
                        </div>
                        <p className={`text-[11px] leading-relaxed mt-0.5 ${t.textPrimary}`}>
                          {stockoutRisk > 60
                            ? <>At <strong>{currentPar} {selected.unit}</strong> you'd run out on a busy weekend. I'd set par to <strong>{recommended} {selected.unit}</strong> for a 4-day buffer (~{recommendedRisk}% stockout risk).</>
                            : stockoutRisk > 30
                              ? <>{daysWithPar} days runway is tight if suppliers delay. A-02 will auto-escalate, but a {recommended} {selected.unit} par would give you headroom.</>
                              : <>Well covered — {daysWithPar} days even at peak. A-02 is monitoring; no change recommended.</>}
                        </p>
                        {isManualFloor && !alreadyAtRecommended && stockoutRisk > 30 && (
                          <button
                            onClick={() => setParOverride(recommended)}
                            className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors">
                            <ArrowRight className="h-2.5 w-2.5" /> Snap slider to {recommended} {selected.unit}
                          </button>
                        )}
                        {!isManualFloor && stockoutRisk > 30 && (
                          <p className={`text-[10px] mt-1 ${t.textMuted}`}>
                            Switch to <strong>Manual Fixed</strong> to set this as your hard floor.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ═══ RESTOCK JOURNEY · two phases ═══
                Phase 1 — The Decision (Inventory-specific reasoning).
                Phase 2 — The Execution (mirrors the Orders 12-Stage Kernel).
                Every stage is clickable; opening a stage shows its History & Trace Record. */}
            {selected.restockDag && (() => {
              const streams = getStreamsForSku(selected);
              const selectedStream = getSelectedStream(selected);
              const baseStage = selected.restockDag.stage;
              const forced = forceCompletedRestock[selected.id] ?? 0;
              // Phase 2 mirrors the *selected* stream's stage. Switching streams
              // never overwrites the others — they all live concurrently.
              const effectiveStage = selectedStream
                ? Math.max(baseStage, forced, selectedStream.stage)
                : Math.max(baseStage, forced);
              const stagesEff = makeDagStages(effectiveStage, selectedStream?.failedStage ?? selected.restockDag.failedStage);
              const skuParMode = getParMode(selected.id);
              const renderStageRow = (stage: DagStage, idx: number) => {
                const isFailed = stage.status === 'failed';
                const isSupplierMatch = idx === 2;
                const isParCheck = idx === 1;
                const isPhase2 = idx >= DECISION_PHASE_LEN;
                const showManualOverride = isParCheck && skuParMode === 'manual';
                // No Force Complete on Inventory — Phase 2 is read-only mirror,
                // Phase 1 is strategy (overridden via Manual Fixed Par, not by force-completing).
                return (
                  <div key={idx}>
                    <button onClick={() => openStageModal(selected.id, idx)}
                      title={`View History & Trace · ${stage.label}`}
                      className={`group w-full flex items-start gap-3 py-2 px-2 rounded-lg text-left transition-colors cursor-pointer ${
                        skuIsManual
                          ? isDark ? 'hover:bg-amber-500/5' : 'hover:bg-amber-50/40'
                          : isDark ? 'hover:bg-[#87986a]/5' : 'hover:bg-[#f4f6f0]/60'
                      }`}>
                      <div className="flex flex-col items-center pt-0.5">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isFailed ? 'bg-red-500 border-red-500'
                          : stage.status === 'complete' ? (isDark ? 'bg-green-500 border-green-500' : 'bg-green-600 border-green-600')
                          : stage.status === 'active' ? (skuIsManual ? 'bg-amber-500 border-amber-500' : 'bg-[#87986a] border-[#87986a] animate-pulse')
                          : skuIsManual ? (isDark ? 'border-amber-500/40' : 'border-amber-400/50')
                          : isDark ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-transparent'
                        }`}>
                          {stage.status === 'complete' && <Check className="h-2 w-2 text-white" />}
                          {isFailed && <X className="h-2 w-2 text-white" />}
                          {stage.status === 'active' && skuIsManual && <Hand className="h-2 w-2 text-white" />}
                        </div>
                        {idx < stagesEff.length - 1 && (<div className={`w-0.5 h-4 mt-0.5 ${isFailed ? 'bg-red-500/30' : stage.status === 'complete' ? 'bg-green-500/50' : isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-medium ${
                            isFailed ? (isDark ? 'text-red-400' : 'text-red-600')
                            : stage.status === 'complete' ? (isDark ? 'text-green-400' : 'text-green-700')
                            : stage.status === 'active' ? t.textPrimary
                            : t.textMuted
                          }`}>{stage.label}</span>
                          {/* Fortress / Internal Directory badge on Supplier Match */}
                          {isSupplierMatch && (
                            <span
                              title="A-01 (Sourcing) cross-referenced only the vetted suppliers in your internal directory"
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
                              }`}>
                              <ShieldCheck className="h-2.5 w-2.5" />
                              Internal Directory
                              <Lock className="h-2.5 w-2.5 opacity-70" />
                            </span>
                          )}
                          {/* Manual Override badge on Par Level Check */}
                          {showManualOverride && (
                            <span
                              title={`Manual Fixed floor: ${manualParFixed[selected.id] ?? selected.parLevel} ${selected.unit} — auto-calc suspended`}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                              }`}>
                              <User className="h-2.5 w-2.5" /> Manual Override
                            </span>
                          )}
                          {stage.status === 'active' && !skuIsManual && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>In Progress</span>}
                          {stage.status === 'active' && skuIsManual && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-amber-500 text-white">You're driving</span>}
                          {isFailed && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'}`}>Failed</span>}
                          {/* Hover affordance — Phase 2 reads as a window into the selected stream */}
                          <span className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                            isPhase2 && selectedStream
                              ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                            : stage.status === 'complete'
                              ? isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                              : isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isPhase2 && selectedStream
                              ? <><ExternalLink className="h-2.5 w-2.5" /> View Trace</>
                              : <><Eye className="h-2.5 w-2.5" /> View Trace</>}
                          </span>
                        </div>
                      </div>
                    </button>
                    {isFailed && selected.restockDag?.failureReason && (
                      <div className={`ml-9 mb-2 p-3 rounded-lg border ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                        <p className={`text-[10px] leading-relaxed mb-2 ${isDark ? 'text-red-300' : 'text-red-700'}`}>{selected.restockDag.failureReason}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => toast.info('Call Supplier', {
                              description: 'Production: opens the supplier comms thread via the channel of record (portal / WhatsApp / email), logs the contact attempt to the order audit trail.',
                            })}
                            className={`h-7 px-3 text-[10px] ${isDark ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30' : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-200'}`}
                          ><PhoneCall className="h-3 w-3 mr-1" /> Call Supplier</Button>
                          <Button
                            size="sm"
                            onClick={() => toast.info('Retry Agent', {
                              description: 'Production: appends a new attempt to RetryHistory with channel + outcome; escalates to backup supplier after N failures per the workflow policy.',
                            })}
                            className={`h-7 px-3 text-[10px] ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                          ><RefreshCw className="h-3 w-3 mr-1" /> Retry Agent</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              };
              const decisionStages = stagesEff.slice(0, DECISION_PHASE_LEN);
              const executionStages = stagesEff.slice(DECISION_PHASE_LEN);
              const decisionDone = effectiveStage >= DECISION_PHASE_LEN;
              return (
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Restock Journey</h3>
                  <div className="flex items-center gap-2">
                    {skuIsManual && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                        <Hand className="h-2.5 w-2.5" /> Click any stage · View Trace or Force Complete
                      </span>
                    )}
                    <span className={`text-[10px] ${t.textMuted}`}>Stage {effectiveStage + 1}/5</span>
                  </div>
                </div>

                {/* Phase 1 · The Decision (Inventory-native) */}
                <div className="mb-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Brain className={`h-3 w-3 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Phase 1 · The Decision</span>
                    <span className={`text-[9px] ${t.textMuted}`}>· forecast → par → sourcing → price</span>
                  </div>
                  <div className="space-y-0">
                    {decisionStages.map((s, i) => renderStageRow(s, i))}
                  </div>
                </div>

                {/* Handoff divider — once Phase 1 is done, link out to the live PO in Orders */}
                <div className={`flex items-center gap-2 my-2 py-1 px-2 rounded-md ${
                  decisionDone
                    ? isDark ? 'bg-[#87986a]/8' : 'bg-[#f4f6f0]'
                    : isDark ? 'bg-gray-800/40' : 'bg-gray-100'
                }`}>
                  <ArrowRight className={`h-3 w-3 ${decisionDone ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textMuted}`} />
                  <span className={`text-[9px] font-semibold ${decisionDone ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textMuted}`}>
                    PO Generated → handoff to Orders kernel
                  </span>
                  {decisionDone && selected.linkedOrderId && (
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.location.hash = `order=${selected.linkedOrderId}`;
                        }
                        onNavigate?.('orders');
                      }}
                      title={`Open ${selected.linkedOrderId} in Orders — same MBL, carrier and tracking data live there`}
                      className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors ${
                        isDark ? 'bg-[#87986a]/15 text-[#a3b085] hover:bg-[#87986a]/25' : 'bg-white text-[#6b7a54] hover:bg-[#e8eddf]'
                      }`}>
                      View {selected.linkedOrderId} in Orders
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {!(decisionDone && selected.linkedOrderId) && (
                    <ExternalLink className={`h-2.5 w-2.5 ml-auto ${t.textMuted}`} />
                  )}
                </div>

                {/* Phase 2 · The Execution (read-only mirror of Orders) */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Truck className={`h-3 w-3 ${t.textMuted}`} />
                    <span className={`text-[9px] font-bold uppercase tracking-wide ${t.textMuted}`}>Phase 2 · The Execution</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`} title="Inventory mirrors execution data — to drive a stage forward, open the PO in Orders.">
                      <Lock className="h-2.5 w-2.5" /> Read-only mirror
                    </span>
                    {streams.length === 0 && (
                      <span className={`text-[9px] ${t.textMuted}`}>· same labels &amp; data as the Orders kernel journey</span>
                    )}
                  </div>

                  {/* ═══ Stream Switcher ═══
                      Surfaces every active PO and future draft this SKU rides in.
                      Clicking a tab swaps the stage-state below — no stream is replaced. */}
                  {streams.length > 0 && (
                    <div className={`mb-2 p-2 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-[#e5e5e0]'}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wide ${t.textMuted}`}>
                          {streams.length === 1 ? 'Execution Stream' : `${streams.length} Execution Streams`}
                        </span>
                        {streams.length > 1 && (
                          <span className={`text-[9px] ${t.textMuted}`}>· every path this SKU is taking to reach you</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {streams.map((stream, idx) => {
                          const isSelectedStream = selectedStream?.id === stream.id;
                          const isPrimary = idx === 0;
                          const cls = isSelectedStream
                            ? stream.kind === 'active'
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'bg-[#87986a] border-[#87986a] text-white'
                            : isDark
                              ? 'bg-[#1a1a1a] border-gray-700 text-gray-300 hover:border-gray-600'
                              : 'bg-white border-[#e5e5e0] text-gray-700 hover:border-gray-300';
                          return (
                            <button
                              key={stream.id}
                              onClick={() => setSelectedStreamId(prev => ({ ...prev, [selected.id]: stream.id }))}
                              title={`${stream.kind === 'active' ? 'Active Shipment' : 'Future Draft'} · ${stream.vendor} · ${agentLabel(stream.agent)}${stream.eta ? ` · ETA ${stream.eta}` : ''}`}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${cls}`}>
                              <span className={`text-[8px] font-bold uppercase px-1 py-px rounded ${
                                stream.kind === 'active'
                                  ? isSelectedStream ? 'bg-white/20' : isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                                  : isSelectedStream ? 'bg-white/20' : isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                              }`}>
                                {stream.kind === 'active' ? 'Active' : 'Draft'}
                              </span>
                              <span>{stream.id}</span>
                              {stream.eta && (
                                <span className={`text-[9px] ${isSelectedStream ? 'opacity-90' : 'opacity-70'}`}>· {stream.eta}</span>
                              )}
                              {isPrimary && streams.length > 1 && (
                                <span className={`text-[8px] px-1 py-px rounded ${isSelectedStream ? 'bg-white/20' : isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                                  Soonest
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {/* "Open in Orders" deep-link for the selected stream */}
                        {selectedStream && (
                          <button
                            onClick={() => {
                              if (typeof window !== 'undefined') window.location.hash = `order=${selectedStream.id}`;
                              onNavigate?.('orders');
                            }}
                            className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                              isDark ? 'text-blue-300 hover:bg-blue-500/15' : 'text-blue-700 hover:bg-blue-100'
                            }`}>
                            <ExternalLink className="h-2.5 w-2.5" /> Open {selectedStream.id} in Orders
                          </button>
                        )}
                      </div>
                      {selectedStream && (
                        <div className={`mt-1.5 text-[9px] ${t.textMuted}`}>
                          {selectedStream.kind === 'active' ? '🟦 Active Shipment' : '🟩 Future Draft'} ·
                          {' '}{selectedStream.vendor} · {agentLabel(selectedStream.agent)}
                          {selectedStream.eta ? ` · ETA ${selectedStream.eta}` : ' · ETA pending'}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-0">
                    {executionStages.map((s, i) => renderStageRow(s, i + DECISION_PHASE_LEN))}
                  </div>
                </div>

                {selected.eta && (<div className={`mt-3 pt-3 border-t flex items-center gap-2 ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}><Clock className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} /><span className={`text-xs ${t.textPrimary}`}>Expected: {selected.eta}</span></div>)}
              </div>
              );
            })()}
          </div>
          );
        })()}
      </div>

      <style>{`@keyframes floatUp { 0% { opacity:0; transform:translateX(-50%) translateY(10px); } 15% { opacity:1; transform:translateX(-50%) translateY(0); } 75% { opacity:1; transform:translateX(-50%) translateY(0); } 100% { opacity:0; transform:translateX(-50%) translateY(-20px); } }`}</style>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // RIGHT PANEL (Item Intelligence OR Macro Portfolio in Audit Mode)
  // ══════════════════════════════════════════════════════════════════
  const rightPanel = (
    <div className="flex flex-col h-full">
      <div className={t.section}>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isDark ? 'bg-[#87986a]/15' : 'bg-[#f4f6f0]'}`}>
            <Sparkles className={`h-3.5 w-3.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
          </div>
          <div>
            <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Atlas</h3>
            <p className={`text-[9px] ${t.textMuted}`}>{auditMode && selected ? 'Quick Journey · Slide-Sheet' : auditMode ? 'Macro-Portfolio Insights · A-04 Spend Watchdog' : 'Stock intelligence · Restock copilot'}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ── QUICK-JOURNEY VIEWER (audit mode + item selected) ── */}
        {auditMode && selected && (
          <>
            {/* Header with Full Journey snap-back */}
            <div className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {(() => { const m = GROUP_META[selected.group]; const GI = m.icon; return <GI className={`h-3.5 w-3.5 shrink-0 ${isDark ? m.darkColor : m.color}`} />; })()}
                  <span className={`text-xs font-semibold truncate ${t.textPrimary}`}>{selected.name}</span>
                </div>
                <button onClick={handleFullJourney} title="Open full journey workspace"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${isDark ? 'bg-[#87986a]/15 text-[#a3b085] hover:bg-[#87986a]/25' : 'bg-[#f4f6f0] text-[#6b7a54] hover:bg-[#e8eddf]'}`}>
                  <Maximize2 className="h-3 w-3" /> Full Journey
                </button>
              </div>
              <p className={`text-[10px] ${t.textMuted}`}>{selected.sku} · {selected.onHand}/{selected.parLevel} {selected.unit} · {selected.daysRemaining}d left</p>
            </div>

            {/* Failed Intent Banner */}
            {failedIntentIds.has(selected.id) && (
              <div className={`mx-4 mt-3 flex items-start gap-2.5 p-2.5 rounded-lg border ${
                isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
              }`}>
                <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-semibold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                    Restock Intent Dismissed
                  </p>
                  <p className={`text-[9px] mt-0.5 ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
                    A restock request for this SKU was started but dismissed. Restock DAG may be stale — review and re-trigger if needed.
                  </p>
                </div>
                <button
                  onClick={() => setFailedIntentIds(prev => { const next = new Set(prev); next.delete(selected.id); return next; })}
                  className={`shrink-0 ${isDark ? 'text-amber-500 hover:text-amber-300' : 'text-amber-500 hover:text-amber-700'}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Compact DAG Kernel */}
            {selected.restockDag && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className={`text-[10px] font-semibold ${t.sectionLabel}`}>RESTOCK JOURNEY</h4>
                  <span className={`text-[9px] ${t.textMuted}`}>Stage {selected.restockDag.stage + 1}/5</span>
                </div>
                <div className="space-y-0">
                  {dagStages.map((stage, idx) => {
                    const isFailed = stage.status === 'failed';
                    return (
                      <div key={idx} className="flex items-start gap-2 py-1">
                        <div className="flex flex-col items-center pt-0.5">
                          <div className={`w-2.5 h-2.5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${
                            isFailed ? 'bg-red-500 border-red-500'
                            : stage.status === 'complete' ? (isDark ? 'bg-green-500 border-green-500' : 'bg-green-600 border-green-600')
                            : stage.status === 'active' ? 'bg-[#87986a] border-[#87986a] animate-pulse'
                            : isDark ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-transparent'
                          }`}>
                            {stage.status === 'complete' && <Check className="h-1.5 w-1.5 text-white" />}
                            {isFailed && <X className="h-1.5 w-1.5 text-white" />}
                          </div>
                          {idx < dagStages.length - 1 && (
                            <div className={`w-px h-2.5 mt-0.5 ${isFailed ? 'bg-red-500/30' : stage.status === 'complete' ? 'bg-green-500/50' : isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                          )}
                        </div>
                        <span className={`text-[10px] leading-tight ${
                          isFailed ? (isDark ? 'text-red-400' : 'text-red-600')
                          : stage.status === 'complete' ? (isDark ? 'text-green-400' : 'text-green-700')
                          : stage.status === 'active' ? t.textPrimary
                          : t.textMuted
                        }`}>{stage.label}</span>
                      </div>
                    );
                  })}
                </div>
                {selected.eta && (
                  <div className={`mt-2 pt-2 border-t flex items-center gap-1.5 ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
                    <Clock className={`h-3 w-3 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                    <span className={`text-[10px] ${t.textPrimary}`}>ETA: {selected.eta}</span>
                  </div>
                )}
                {selected.restockDag.failedStage !== undefined && selected.restockDag.failureReason && (
                  <div className={`mt-2 p-2.5 rounded-lg border ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                    <p className={`text-[10px] leading-relaxed ${isDark ? 'text-red-300' : 'text-red-700'}`}>{selected.restockDag.failureReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Agent reasoning snippet */}
            {selected.agentReasoning && (
              <div className="px-4 pb-3">
                <div className={`p-2.5 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                  <div className="flex items-start gap-1.5">
                    <Bot className={`h-3 w-3 mt-0.5 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                    <p className={`text-[10px] leading-relaxed line-clamp-4 ${t.textSecondary}`}>{selected.agentReasoning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions (Fitts's Law — large targets) */}
            <div className="px-4 pb-4">
              <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>QUICK ACTIONS</h4>
              <div className="space-y-1.5">
                {selected.group !== 'autonomous' && (
                  <Button size="sm" onClick={(e) => handleEmergencyReorder(selected.id, e)}
                    className={`w-full h-9 text-xs justify-start ${emergencyTriggered.has(selected.id)
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-[#87986a] hover:bg-[#6b7a54] text-white'}`}>
                    <Zap className="h-3.5 w-3.5 mr-2" />
                    {emergencyTriggered.has(selected.id) ? 'Reordering...' : 'Emergency Restock'}
                  </Button>
                )}
                {selected.supplierPhone && (
                  <Button size="sm" variant="outline"
                    className={`w-full h-9 text-xs justify-start ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-[#e5e5e0] text-gray-700 hover:bg-gray-50'}`}>
                    <PhoneCall className="h-3.5 w-3.5 mr-2" /> Call {selected.supplierName}
                  </Button>
                )}
                {selected.supplierPhone && (
                  <Button size="sm" variant="outline"
                    className={`w-full h-9 text-xs justify-start ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-[#e5e5e0] text-gray-700 hover:bg-gray-50'}`}>
                    <MessageCircle className="h-3.5 w-3.5 mr-2" /> WhatsApp {selected.supplierName}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleFullJourney}
                  className={`w-full h-9 text-xs justify-start ${isDark ? 'border-[#87986a]/30 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#dbe3ce] text-[#6b7a54] hover:bg-[#f4f6f0]'}`}>
                  <Maximize2 className="h-3.5 w-3.5 mr-2" /> Open Full Workspace
                </Button>
              </div>
            </div>

            {/* Confidence + Market Signal condensed */}
            {(selected.confidenceScore || selected.marketSignal) && (
              <div className="px-4 pb-3">
                {selected.confidenceScore && (
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] ${t.textMuted}`}>Forecast Confidence</span>
                    <span className={`text-xs font-bold ${selected.confidenceScore > 85 ? (isDark ? 'text-green-400' : 'text-green-600') : selected.confidenceScore > 70 ? (isDark ? 'text-amber-400' : 'text-amber-600') : isDark ? 'text-red-400' : 'text-red-600'}`}>{selected.confidenceScore}%</span>
                  </div>
                )}
                {selected.marketSignal && (
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                    <div className="flex items-start gap-1.5">
                      <Radar className={`h-3 w-3 mt-0.5 shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                      <p className={`text-[10px] leading-relaxed ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{selected.marketSignal}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── MACRO PORTFOLIO MODE (when audit is open and no item selected) ── */}
        {auditMode && !selected && (
          <>
            {/* Dead Stock Alert */}
            <div className="p-4">
              <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>DEAD STOCK ALERT</h4>
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-red-500/5 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Package className={`h-3.5 w-3.5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                  <span className={`text-[10px] font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                    {DEAD_STOCK.length} items tying up capital
                  </span>
                </div>
                <p className={`text-[10px] leading-relaxed mb-2 ${t.textSecondary}`}>
                  Rp {DEAD_STOCK_VALUE.toLocaleString()} in working capital is locked in SKUs with ≤1.5 units/day burn and excess stock above par.
                </p>
                <div className="space-y-1">
                  {DEAD_STOCK.slice(0, 4).map(item => (
                    <div key={item.id} className={`flex items-center justify-between py-1 text-[10px] ${t.textMuted}`}>
                      <span>{item.name}</span>
                      <span className={isDark ? 'text-red-400' : 'text-red-600'}>Rp {(item.onHand * item.unitCostRp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Spend Concentration (Pareto) */}
            <div className="px-4 pb-3">
              <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>SPEND CONCENTRATION</h4>
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/10 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                <p className={`text-[10px] mb-2 ${t.textSecondary}`}>Top 3 categories represent {Math.round((CATEGORY_VALUES.slice(0, 3).reduce((s, c) => s + c.valueRp, 0) / TOTAL_INVENTORY_VALUE) * 100)}% of inventory value (Pareto)</p>
                <div className="space-y-2">
                  {CATEGORY_VALUES.slice(0, 3).map((cat, i) => {
                    const pct = Math.round((cat.valueRp / TOTAL_INVENTORY_VALUE) * 100);
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-[10px] font-medium ${t.textPrimary}`}>{i + 1}. {cat.category}</span>
                          <span className={`text-[10px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{pct}%</span>
                        </div>
                        <div className={`h-1.5 rounded-full ${t.progressTrack}`}>
                          <div className="h-1.5 rounded-full bg-[#87986a] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className={`text-[9px] mt-2 ${t.textMuted}`}>Total value: Rp {TOTAL_INVENTORY_VALUE.toLocaleString()}</p>
              </div>
            </div>

            {/* Supply Chain Weather Map */}
            <div className="px-4 pb-3">
              <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>SUPPLY CHAIN WEATHER</h4>
              <div className="space-y-1.5">
                {SUPPLY_WEATHER.map(w => {
                  const WIcon = w.icon;
                  const statusColor = w.status === 'clear' ? (isDark ? 'text-green-400' : 'text-green-600')
                    : w.status === 'caution' ? (isDark ? 'text-amber-400' : 'text-amber-600')
                    : (isDark ? 'text-red-400' : 'text-red-600');
                  const statusBg = w.status === 'clear' ? (isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200')
                    : w.status === 'caution' ? (isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200')
                    : (isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200');

                  return (
                    <div key={w.region} className={`p-2.5 rounded-lg border ${statusBg}`}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <WIcon className={`h-3.5 w-3.5 ${statusColor}`} />
                        <span className={`text-[10px] font-semibold ${statusColor}`}>{w.region}</span>
                        <span className={`text-[9px] ml-auto capitalize ${statusColor}`}>{w.status}</span>
                      </div>
                      <p className={`text-[10px] leading-relaxed ${t.textSecondary}`}>{w.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── ITEM INTELLIGENCE MODE (normal / item selected) ── */}
        {(!auditMode || selected) && (
          <>
            {intelligenceLog.length > 0 && (
              <div className="p-4">
                <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>ACTION LOG</h4>
                <div className="space-y-1.5">
                  {intelligenceLog.map((log, i) => (
                    <div key={i} className={`p-2 rounded-lg flex items-center gap-2 ${isDark ? 'bg-green-500/10' : 'bg-green-50'} ${i === 0 ? 'animate-pulse' : ''}`}>
                      <ShieldCheck className={`h-3 w-3 shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                      <div className="flex-1 min-w-0"><span className={`text-[10px] font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>{log.name}</span><span className={`text-[9px] ml-1 ${t.textMuted}`}>{log.action}</span></div>
                      <span className={`text-[9px] ${t.textMuted}`}>{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected?.agentReasoning && (
              <div className="p-4">
                <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>WHY THIS HAPPENED</h4>
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
                  <div className="flex items-start gap-2"><Bot className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} /><p className={`text-[10px] leading-relaxed ${t.textSecondary}`}>{selected.agentReasoning}</p></div>
                  {selected.confidenceScore && (
                    <div className={`mt-2 pt-2 border-t ${isDark ? 'border-gray-700' : 'border-[#e5e5e0]'}`}>
                      <div className="flex items-center justify-between"><span className={`text-[9px] ${t.textMuted}`}>Forecast Confidence</span><span className={`text-xs font-bold ${selected.confidenceScore > 85 ? (isDark ? 'text-green-400' : 'text-green-600') : selected.confidenceScore > 70 ? (isDark ? 'text-amber-400' : 'text-amber-600') : isDark ? 'text-red-400' : 'text-red-600'}`}>{selected.confidenceScore}%</span></div>
                      <div className={`mt-1 h-1.5 rounded-full ${t.progressTrack}`}><div className={`h-1.5 rounded-full transition-all ${selected.confidenceScore > 85 ? 'bg-green-500' : selected.confidenceScore > 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${selected.confidenceScore}%` }} /></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selected?.marketSignal && (
              <div className="px-4 pb-3">
                <div className={`p-2.5 rounded-lg ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                  <div className="flex items-center gap-1.5 mb-1"><Radar className={`h-3 w-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} /><span className={`text-[9px] font-semibold uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>A-01 Market Signal</span></div>
                  <p className={`text-[10px] leading-relaxed ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>{selected.marketSignal}</p>
                </div>
              </div>
            )}

            {selected && (selected.monthlySaving || selected.hoursEliminated) && (
              <div className="px-4 pb-3">
                <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>ROI OF AUTONOMY</h4>
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/10 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                  <p className={`text-[10px] leading-relaxed mb-2 ${t.textSecondary}`}>This week, {selected.hoursEliminated ? `${selected.hoursEliminated}h of manual work eliminated` : 'autonomous reorders ran'}{selected.monthlySaving ? `, saving $${selected.monthlySaving}/mo via volume-locks` : ''}.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {selected.hoursEliminated && (<div><span className={`text-[9px] ${t.textMuted}`}>Hours Eliminated</span><p className={`text-sm font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{selected.hoursEliminated}h</p></div>)}
                    {selected.monthlySaving && (<div><span className={`text-[9px] ${t.textMuted}`}>Cost Saved</span><p className={`text-sm font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>${selected.monthlySaving}</p></div>)}
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 pb-3">
              <h4 className={`text-[10px] font-semibold mb-2 ${t.sectionLabel}`}>ASK ATLAS</h4>
              <div className="space-y-1.5">
                {(selected ? [
                  `Why did A-02 trigger for ${selected.name}?`,
                  `What signals from A-01 affect ${selected.name}?`,
                  `Confidence score for ${selected.name} forecast?`,
                ] : [
                  'Which items need attention this week?',
                  'How many manual reorders eliminated today?',
                  'Show highest burn-rate items.',
                ]).map((q, i) => (
                  <button key={i} onClick={() => { setChatMessages(prev => [...prev, { role: 'user', text: q }]); setTimeout(() => { const r = selected ? `${selected.agentReasoning || 'No reasoning.'} Confidence: ${selected.confidenceScore || 'N/A'}%.` : 'Select an item for specific intelligence.'; setChatMessages(prev => [...prev, { role: 'atlas', text: r }]); }, 600); }}
                    className={`w-full text-left p-2 rounded-lg text-[10px] transition-colors ${isDark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>{q}</button>
                ))}
              </div>
            </div>

            {chatMessages.length > 0 && (
              <div className="px-4 pb-3 space-y-2">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`p-2.5 rounded-lg text-[10px] leading-relaxed ${msg.role === 'atlas' ? isDark ? 'bg-[#2a2a2a] text-gray-300' : 'bg-gray-50 text-gray-700' : isDark ? 'bg-[#87986a]/15 text-[#a3b085] ml-4' : 'bg-[#f4f6f0] text-[#6b7a54] ml-4'}`}>
                    {msg.role === 'atlas' && <Bot className="h-3 w-3 inline mr-1" />}{msg.text}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Chat input */}
      <div className={`p-3 border-t ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
        <div className="flex items-center gap-2">
          <Input placeholder="Ask about stock, agents, forecasts..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChat()}
            className={`flex-1 text-xs h-8 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : ''}`} />
          <Button size="sm" onClick={handleChat} className="h-8 w-8 p-0 bg-[#87986a] hover:bg-[#6b7a54]"><Send className="h-3 w-3 text-white" /></Button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // MAIN LAYOUT — CSS-driven spatial rebalance
  // ══════════════════════════════════════════════════════════════════
  const panelBg = isDark ? 'bg-[#111]' : 'bg-white';
  const panelBorder = isDark ? 'border-gray-800' : 'border-[#e5e5e0]';

  // ── Adjust Stock Modal (Physical Truth) ────────────────────────
  const adjustModal = (() => {
    if (!adjustOpen) return null;
    const item = ITEMS.find(i => i.id === adjustOpen);
    if (!item) return null;
    const newCount = Number(adjustDraft.count);
    const valid = !Number.isNaN(newCount) && adjustDraft.count.trim().length > 0;
    const delta = valid ? newCount - item.onHand : 0;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={closeAdjust}>
        <div onClick={e => e.stopPropagation()}
          className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-[#1a1a1a] border-amber-500/40' : 'bg-white border-amber-400/50'}`}>
          {/* Header */}
          <div className={`px-5 py-4 border-b flex items-start gap-3 ${isDark ? 'border-gray-800 bg-amber-500/8' : 'border-[#e5e5e0] bg-amber-50/60'}`}>
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-amber-500 text-white">
              <ClipboardEdit className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Physical Truth · Adjust Stock</div>
              <h3 className={`text-sm font-bold mt-0.5 ${t.textPrimary}`}>{item.name}</h3>
              <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>{item.sku} · {item.category} · {agentLabel(getAssignedAgent(item))}</p>
            </div>
            <button onClick={closeAdjust} className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Atlas hint */}
          <div className={`px-5 py-3 border-b flex items-start gap-2 ${isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'}`}>
            <Sparkles className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
            <div className="min-w-0">
              <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Atlas · Copilot Hint</div>
              <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textPrimary}`}>
                I am tracking <strong>{item.onHand} {item.unit}</strong> on the books. Enter the floor count — I will recalculate your burn rate and restock urgency from this new physical baseline.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <div>
              <label className={`flex items-center justify-between text-[11px] font-semibold mb-1.5 ${t.textPrimary}`}>
                <span>Manual Count <span className="text-red-400">*</span></span>
                <span className={`text-[10px] ${t.textMuted}`}>System count: {item.onHand} {item.unit}</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAdjustDraft(d => ({ ...d, count: String(Math.max(0, (Number(d.count) || 0) - 1)) }))}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-[#e5e5e0] text-gray-600 hover:bg-gray-100'}`}>
                  <MinusCircle className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  value={adjustDraft.count}
                  onChange={e => setAdjustDraft(d => ({ ...d, count: e.target.value }))}
                  placeholder={`Counted ${item.unit}…`}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold outline-none border text-center ${isDark ? 'bg-[#2a2a2a] border-amber-500/40 text-white placeholder:text-gray-500 focus:border-amber-500/70' : 'bg-amber-50/40 border-amber-400/50 placeholder:text-gray-400 focus:border-amber-500/70'}`}
                />
                <span className={`text-xs font-medium ${t.textMuted}`}>{item.unit}</span>
                <button
                  onClick={() => setAdjustDraft(d => ({ ...d, count: String(Math.max(0, (Number(d.count) || 0) + 1)) }))}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-[#e5e5e0] text-gray-600 hover:bg-gray-100'}`}>
                  <PlusCircle className="h-4 w-4" />
                </button>
              </div>
              {valid && delta !== 0 && (
                <p className={`mt-1.5 text-[10px] ${delta > 0 ? (isDark ? 'text-green-400' : 'text-green-700') : (isDark ? 'text-amber-300' : 'text-amber-700')}`}>
                  {delta > 0 ? '↑' : '↓'} {Math.abs(delta)} {item.unit} vs system ({delta > 0 ? '+' : ''}{Math.round((delta / Math.max(item.onHand, 1)) * 100)}%)
                </p>
              )}
            </div>
            <div>
              <label className={`block text-[11px] font-semibold mb-1.5 ${t.textPrimary}`}>Note (optional)</label>
              <textarea
                value={adjustDraft.note}
                onChange={e => setAdjustDraft(d => ({ ...d, note: e.target.value }))}
                placeholder="e.g. Found 2kg behind walk-in cooler · weighed at 3:42 PM"
                rows={3}
                className={`w-full rounded-lg px-3 py-2 text-xs outline-none border resize-none ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500/50' : 'bg-gray-50 border-[#e5e5e0] placeholder:text-gray-400 focus:border-amber-500/50'}`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className={`shrink-0 px-5 py-3 border-t flex items-center gap-2 ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            <button onClick={closeAdjust}
              className={`px-3 py-2 rounded-lg text-xs font-semibold ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>
              Cancel
            </button>
            <button onClick={saveAdjust} disabled={!valid}
              className={`ml-auto px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm ${
                valid ? 'bg-amber-500 text-white hover:bg-amber-600' : isDark ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}>
              <ClipboardEdit className="h-3 w-3" /> Save Manual Count
            </button>
          </div>
        </div>
      </div>
    );
  })();

  // ── Review Mode · Restock Stage Trace ──────────────────────────
  const stageTraceModal = (() => {
    if (!openStageTrace) return null;
    const item = ITEMS.find(i => i.id === openStageTrace.skuId);
    if (!item) return null;
    const stageIdx = openStageTrace.stageIdx;
    const def = RESTOCK_DAG_TEMPLATE[stageIdx];
    // Phase 2 reseeds history off the currently-selected stream id so the
    // displayed MBL/carrier matches whichever PO the user is inspecting.
    const stream = getSelectedStream(item);
    const isPhase2 = def.phase === 'execution';
    const traceSourceId = (stream && isPhase2) ? stream.id : undefined;
    const synth = synthesizeRestockHistory(item, stageIdx, traceSourceId);
    const baseStage = item.restockDag?.stage ?? 0;
    const forced = forceCompletedRestock[item.id] ?? 0;
    const effectiveStage = stream
      ? Math.max(baseStage, forced, stream.stage)
      : Math.max(baseStage, forced);
    const isComplete = stageIdx < effectiveStage;
    const isActive = stageIdx === effectiveStage;
    const isFailed = (stream?.failedStage ?? item.restockDag?.failedStage) === stageIdx;
    const isManualParCheck = stageIdx === 1 && getParMode(item.id) === 'manual';
    const skuModeLocal = getLaborMode(item.id);
    const verifiedLabel = (() => {
      try { return new Date(synth.verifiedAtIso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
      catch { return 'cleared earlier in this restock'; }
    })();
    const phaseLabel = def.phase === 'decision' ? 'Phase 1 · The Decision' : 'Phase 2 · The Execution';
    const attribution: 'agent' | 'admin' = isManualParCheck ? 'admin' : 'agent';
    const agent = stream && isPhase2 ? stream.agent : getAssignedAgent(item);
    // Phase 2 is read-only on Inventory (Separation of Concerns) — execution
    // happens on the Orders page. Surface a deep link to the selected stream's PO.
    const ordersLinkId = stream?.id;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={closeStageModal}>
        <div onClick={e => e.stopPropagation()}
          className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isComplete
              ? isDark ? 'bg-[#1a1a1a] border-[#87986a]/40' : 'bg-white border-[#87986a]/40'
              : isDark ? 'bg-[#1a1a1a] border-amber-500/40' : 'bg-white border-amber-400/50'
          }`}>
          {/* Header */}
          <div className={`px-5 py-4 border-b flex items-start gap-3 ${
            isComplete
              ? isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'
              : isDark ? 'border-gray-800 bg-amber-500/8' : 'border-[#e5e5e0] bg-amber-50/60'
          }`}>
            <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-sm ${isComplete ? 'bg-[#87986a]' : 'bg-amber-500'}`}>
              {isComplete ? <Check className="h-4 w-4" /> : isFailed ? <X className="h-4 w-4" /> : stageIdx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isComplete ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : (isDark ? 'text-amber-300' : 'text-amber-700')}`}>
                  History &amp; Trace Record
                </span>
                <span className={`text-[10px] ${t.textMuted}`}>{phaseLabel} · Stage {stageIdx + 1}/5</span>
                {/* Attribution */}
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  attribution === 'admin'
                    ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                    : isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                }`}>
                  {attribution === 'admin' ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                  {attribution === 'admin' ? 'Admin Verified' : `${agentLabel(agent)} Verified`}
                </span>
              </div>
              <h3 className={`text-sm font-bold mt-0.5 ${t.textPrimary}`}>{def.label}</h3>
              <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>
                {item.name} · {item.sku} ·{' '}
                {isComplete ? `Cleared at ${verifiedLabel}` : isActive ? 'Currently active' : isFailed ? 'Failed — agent retrying' : 'Pending'}
              </p>
            </div>
            <button onClick={closeStageModal} className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stream-window context — Phase 2 always mirrors the selected stream */}
          {stream && isPhase2 && (
            <div className={`px-5 py-2.5 border-b flex items-center gap-2 flex-wrap ${
              stream.kind === 'active'
                ? isDark ? 'border-gray-800 bg-blue-500/5' : 'border-[#e5e5e0] bg-blue-50/60'
                : isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'
            }`}>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                stream.kind === 'active'
                  ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                  : isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#dbe3ce] text-[#6b7a54]'
              }`}>
                {stream.kind === 'active' ? 'Active Shipment' : 'Future Draft'}
              </span>
              <span className={`text-[10px] font-semibold ${
                stream.kind === 'active'
                  ? isDark ? 'text-blue-300' : 'text-blue-700'
                  : isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
              }`}>
                Window into {stream.id}
              </span>
              <span className={`text-[10px] ${t.textMuted}`}>
                · same MBL, carrier &amp; tracking as Orders · {agentLabel(stream.agent)} driving{stream.eta ? ` · ETA ${stream.eta}` : ''}
              </span>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.hash = `order=${stream.id}`;
                  }
                  onNavigate?.('orders');
                  closeStageModal();
                }}
                className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors ${
                  stream.kind === 'active'
                    ? isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : isDark ? 'bg-[#87986a]/20 text-[#a3b085] hover:bg-[#87986a]/30' : 'bg-[#dbe3ce] text-[#6b7a54] hover:bg-[#cad6b8]'
                }`}>
                Open in Orders
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>
          )}

          {/* Atlas Audit Summary (Logic) */}
          <div className={`px-5 py-3 border-b ${isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-[#e5e5e0] bg-[#f4f6f0]'}`}>
            <div className="flex items-start gap-2">
              <Sparkles className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <div className="min-w-0">
                <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                  Atlas · Audit Summary (Logic)
                </div>
                <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textPrimary}`}>
                  {isManualParCheck
                    ? `Auto-calc suspended. You set a manual floor of ${manualParFixed[item.id] ?? item.parLevel} ${item.unit}; I am tracking against that, not my forecast.`
                    : synth.logic}
                </p>
              </div>
            </div>
          </div>

          {/* Read-only banner — only when not in Manual Mode */}
          {skuModeLocal !== 'manual' && (
            <div className={`px-5 py-2.5 border-b flex items-center gap-2 ${isDark ? 'border-gray-800 bg-[#1f2a1f]' : 'border-[#e5e5e0] bg-[#f0f4e8]'}`}>
              <Lock className={`h-3 w-3 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold ${t.textPrimary}`}>Immutable record.</span>
              <span className={`text-[10px] ${t.textMuted}`}>Switch to Manual Takeover to override this stage.</span>
            </div>
          )}

          {/* Paper Trail */}
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
                  <span className={t.textSecondary}>{verifiedLabel} · API timestamp</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verified Data */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
            <div className={`text-[9px] font-bold uppercase tracking-wide ${t.textMuted}`}>Verified Data</div>
            {Object.entries(synth.data).map(([k, v]) => {
              const isFile = /\.(pdf|jpg|png)$/i.test(v);
              return (
                <div key={k}>
                  <label className={`block text-[11px] font-semibold mb-1 ${t.textPrimary}`}>{k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                  {isFile ? (
                    <a href="#" onClick={e => e.preventDefault()} title={`View / download ${v}`}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                        isDark ? 'bg-[#87986a]/10 border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/20'
                              : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54] hover:bg-[#e8eddf]'
                      }`}>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{v}</span>
                    </a>
                  ) : (
                    <div className={`px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-[#2a2a2a] text-white' : 'bg-gray-50 text-gray-900'}`}>
                      {v}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer — Phase 2 is read-only on Inventory; execution lives on Orders */}
          <div className={`shrink-0 px-5 py-3 border-t flex items-center gap-2 ${isDark ? 'border-gray-800' : 'border-[#e5e5e0]'}`}>
            {isPhase2 && ordersLinkId && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.hash = `order=${ordersLinkId}`;
                  }
                  onNavigate?.('orders');
                  closeStageModal();
                }}
                title="Execution happens on the Orders page — same MBL, carrier, and tracking"
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 border ${
                  isDark ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 hover:bg-blue-500/20'
                        : 'bg-blue-50 border-blue-300/60 text-blue-700 hover:bg-blue-100'
                }`}>
                <ExternalLink className="h-3 w-3" /> Open {ordersLinkId} in Orders
              </button>
            )}
            <button onClick={closeStageModal}
              className="ml-auto px-4 py-2 rounded-lg text-xs font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors inline-flex items-center gap-1.5 shadow-sm">
              <Check className="h-3 w-3" /> Done
            </button>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div className="flex flex-col h-full relative">
      {/* Adjust Stock — Physical Truth modal */}
      {adjustModal}

      {/* Stage Trace — Review Mode */}
      {stageTraceModal}

      {/* Master SKU Catalog modal */}
      {catalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCatalogOpen(false)}>
          <div className={`relative w-full max-w-2xl mx-4 rounded-xl border shadow-xl flex flex-col max-h-[80vh] ${
            isDark ? 'bg-[#1e1e1e] border-gray-700' : 'bg-white border-[#e5e5e0]'
          }`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between p-4 border-b shrink-0 ${isDark ? 'border-gray-700' : 'border-[#e5e5e0]'}`}>
              <div className="flex items-center gap-2">
                <Database className={`h-4 w-4 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <div>
                  <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Master SKU Catalog</h3>
                  <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{catalogRows.filter(r => !r.archived).length} active SKUs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCatalogDraftRow({ id: `INV-${String(catalogRows.length + 1).padStart(3, '0')}`, name: '', sku: '', category: '', unitCost: 0, archived: false })}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-[#87986a] hover:bg-[#6b7a54] text-white font-semibold transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add SKU
                </button>
                <button onClick={() => setCatalogOpen(false)} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Add new SKU draft row */}
            {catalogDraftRow && (
              <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isDark ? 'border-gray-700 bg-[#87986a]/5' : 'border-[#e5e5e0] bg-[#f4f6f0]'}`}>
                {(['name', 'sku', 'category'] as const).map(field => (
                  <input key={field} value={catalogDraftRow[field] ?? ''} placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                    onChange={e => setCatalogDraftRow(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                    className={`flex-1 text-[11px] px-2 py-1 rounded border ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-600' : 'bg-white border-[#e5e5e0] text-gray-900 placeholder:text-gray-400'} focus:outline-none focus:border-[#87986a]`}
                  />
                ))}
                <button onClick={() => {
                  if (catalogDraftRow.name && catalogDraftRow.sku) {
                    setCatalogRows(prev => [...prev, { id: catalogDraftRow.id!, name: catalogDraftRow.name!, sku: catalogDraftRow.sku!, category: catalogDraftRow.category ?? '', unitCost: 0, archived: false }]);
                    setCatalogDraftRow(null);
                  }
                }} className="text-[10px] px-2 py-1 rounded bg-[#87986a] text-white font-semibold hover:bg-[#6b7a54]">Save</button>
                <button onClick={() => setCatalogDraftRow(null)} className={`text-[10px] px-2 py-1 rounded border ${isDark ? 'border-gray-700 text-gray-400' : 'border-[#e5e5e0] text-gray-500'}`}>Cancel</button>
              </div>
            )}

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-gray-700 text-gray-500' : 'border-[#e5e5e0] text-gray-500'}`}>
                    {['Name', 'SKU', 'Category', 'Actions'].map(h => (
                      <th key={h} className={`text-left px-4 py-2 font-semibold tracking-wider text-[9px] uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalogRows.map(row => (
                    <tr key={row.id} className={`border-b ${isDark ? 'border-gray-800' : 'border-gray-100'} ${row.archived ? 'opacity-40' : ''}`}>
                      <td className={`px-4 py-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {catalogEditId === row.id
                          ? <input value={row.name} onChange={e => setCatalogRows(prev => prev.map(r => r.id === row.id ? { ...r, name: e.target.value } : r))}
                              className={`w-full text-[11px] px-1.5 py-0.5 rounded border ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : 'bg-white border-[#e5e5e0] text-gray-900'} focus:outline-none focus:border-[#87986a]`} />
                          : row.name}
                      </td>
                      <td className={`px-4 py-2.5 font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{row.sku}</td>
                      <td className={`px-4 py-2.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{row.category}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setCatalogEditId(prev => prev === row.id ? null : row.id)}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${isDark ? 'border-gray-700 text-gray-400 hover:text-[#a3b085] hover:border-[#87986a]/50' : 'border-[#e5e5e0] text-gray-500 hover:text-[#6b7a54]'}`}>
                            {catalogEditId === row.id ? 'Done' : 'Edit'}
                          </button>
                          <button onClick={() => setCatalogRows(prev => prev.map(r => r.id === row.id ? { ...r, archived: !r.archived } : r))}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                              row.archived
                                ? isDark ? 'border-[#87986a]/50 text-[#a3b085]' : 'border-[#6b7a54]/50 text-[#6b7a54]'
                                : isDark ? 'border-gray-700 text-gray-500 hover:text-amber-400 hover:border-amber-500/40' : 'border-[#e5e5e0] text-gray-500 hover:text-amber-600'
                            }`}>
                            {row.archived ? 'Restore' : 'Archive'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ⌘K Command Palette */}
      {cmdkOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setCmdkOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={`relative w-full max-w-lg rounded-xl border shadow-2xl ${isDark ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-[#e5e5e0]'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: isDark ? '#333' : '#e5e7eb' }}>
              <Search className={`h-4 w-4 ${t.textMuted}`} />
              <input ref={cmdkRef} value={cmdkSearch} onChange={(e) => setCmdkSearch(e.target.value)} placeholder="Search by name, SKU, category..."
                className={`flex-1 bg-transparent text-sm outline-none ${isDark ? 'text-white placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400'}`} />
              <kbd className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>ESC</kbd>
            </div>
            {cmdkResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto p-2">
                {cmdkResults.map(item => {
                  const meta = GROUP_META[item.group]; const GI = meta.icon;
                  return (
                    <button key={item.id} onClick={() => { handleSelect(item.id); setCmdkOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                      <GI className={`h-4 w-4 ${isDark ? meta.darkColor : meta.color}`} />
                      <div className="flex-1"><span className={`text-xs font-medium ${t.textPrimary}`}>{item.name}</span><span className={`text-[10px] ml-2 ${t.textMuted}`}>{item.sku}</span></div>
                      <div className="text-right"><span className={`text-xs font-semibold ${t.textPrimary}`}>{item.onHand} {item.unit}</span><p className={`text-[9px] ${t.textMuted}`}>{item.daysRemaining}d</p></div>
                      <ArrowRight className={`h-3 w-3 ${t.textMuted}`} />
                    </button>
                  );
                })}
              </div>
            )}
            {cmdkSearch.trim() && cmdkResults.length === 0 && (<div className="p-6 text-center"><span className={`text-xs ${t.textMuted}`}>No items match "{cmdkSearch}"</span></div>)}
          </div>
        </div>
      )}

      {/* Three-panel layout with CSS transition for spatial rebalance */}
      <div className="flex flex-1 min-h-0">
        {/* Left — takes all available space in audit mode, 280px in triage */}
        <div className={`h-full border-r ${panelBorder} ${panelBg} overflow-hidden transition-all duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
          style={{ flex: auditMode ? '1 1 0%' : '0 0 280px' }}>
          {leftPanel}
        </div>

        {/* Center — collapses in audit mode, reappears on snap-back */}
        <div className={`h-full overflow-y-auto transition-all duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isDark ? 'bg-[#111]' : 'bg-gray-50/50'}`}
          style={{ flex: auditMode ? '0 0 0px' : '1 1 0%', opacity: auditMode ? 0 : 1, overflow: auditMode ? 'hidden' : undefined }}>
          {centerPanel}
        </div>

        {/* Right — always 280px */}
        <div className={`w-[280px] shrink-0 h-full border-l ${panelBorder} ${panelBg} overflow-hidden`}>
          {rightPanel}
        </div>
      </div>
    </div>
  );
}
