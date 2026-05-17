import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Search, Star, TrendingUp, TrendingDown, Minus, Truck, Shield, DollarSign,
  Package, MapPin, Clock, CheckCircle, AlertTriangle, Bot, Leaf,
  MessageCircle, Zap, ArrowLeft, Eye, Filter, X,
  Award, Activity, Globe, ChevronRight, GitMerge, FileText,
  Maximize2, Minimize2, LayoutGrid, List, Mail, Phone, Building2,
  Beef, Fish, Apple, Wine, Archive, Send, Lock, ChevronDown, ChevronUp,
  Calendar, Target, MoreVertical, Users, User, UserPlus, ShieldCheck,
  PauseCircle, PlayCircle, ExternalLink, Hand
} from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, BarChart, Bar, Cell,
  ScatterChart, Scatter, ZAxis, ReferenceLine
} from 'recharts';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { theme as themeTokens } from '../lib/theme';
import { AgentCTA } from './AgentCTA';
import { VendorOnboardingModal } from './VendorOnboardingModal';
import { RenegotiationModal } from './RenegotiationModal';
import { ManualNotes } from './ManualNotes';
import { logUserAction } from '../lib/actionLog';

interface SuppliersPageProps {
  theme: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

// ── Labor Switch (Manual Takeover) ────────────────────────────────
type LaborMode = 'agent' | 'manual';

// ── Semantic Category Palette ─────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Protein:    '#991b1b', // Deep Maroon
  Seafood:    '#075985', // Deep Sea Blue
  Produce:    '#166534', // Forest Green
  'Dry Goods':'#334155', // Slate
  Beverages:  '#92400e', // Amber/Gold
  Dairy:      '#0e7490',
  Other:      '#64748b',
};

const CATEGORY_ICONS: Record<string, typeof Beef> = {
  Protein:    Beef,
  Seafood:    Fish,
  Produce:    Apple,
  'Dry Goods':Archive,
  Beverages:  Wine,
  Other:      Package,
};

// ── Types ─────────────────────────────────────────────────────────

type VendorStatus = 'action' | 'watchlist' | 'stable';
type RadarMetric = 'delivery' | 'quality' | 'price' | 'sustainability' | 'co2' | null;
type AuditView = 'grid' | 'table';
type MessageChannel = 'whatsapp' | 'telegram';

interface RecentOrder {
  date: string;
  item: string;
  value: number;
  status: 'delivered' | 'in-transit' | 'pending' | 'late' | 'disputed';
  metrics: ('delivery' | 'quality' | 'price' | 'sustainability' | 'co2')[];
}

interface ContactInfo {
  role: 'Sales' | 'Finance' | 'Logistics';
  name: string;
  email: string;
  phone: string;
}

interface ChatMessage {
  id: string;
  from: 'admin' | 'vendor';
  text: string;
  time: string;
}

interface AssignedAgent {
  id: number;          // e.g., 6 → "A-01"
  role: string;        // e.g., "Pricing", "Compliance"
  activeTasks: number; // open AI tasks (negotiations, re-orders, audits)
}

interface Supplier {
  id: string;
  name: string;
  initials: string;
  country: string;
  flag: string;
  vendorStatus: VendorStatus;
  score: number;
  prevScore: number;
  reliability: number;
  quality: number;
  price: number;
  sustainability: number;
  co2Score: number;
  trend: 'up' | 'flat' | 'down';
  sparkline: number[];
  orders: number;
  contractValue: number;
  contractExpiresIn: number;
  categories: string[];
  leadDays: number;
  lastOrder: string;
  savingsYTD: number;
  journeyStage: number;
  accountManager: string;
  waPhone: string;
  agentNotes: string;
  recentOrders: RecentOrder[];
  actionReason?: string;
  // Company Dossier
  address: string;
  nib: string;
  npwp: string;
  contacts: ContactInfo[];
  messageHistory: ChatMessage[];
  // Digital workforce assignment (Wayne / Fortress doctrine)
  assignedAgent: AssignedAgent;
}

// ── Regional benchmarks (A-01) ───────────────────────────────

const REGIONAL_BENCH: Record<string, { leadAvg: number; qualityAvg: number }> = {
  Indonesia:   { leadAvg: 2.5, qualityAvg: 88 },
  Thailand:    { leadAvg: 3.0, qualityAvg: 90 },
  Australia:   { leadAvg: 4.5, qualityAvg: 93 },
  Vietnam:     { leadAvg: 3.8, qualityAvg: 82 },
  Philippines: { leadAvg: 3.2, qualityAvg: 85 },
};

// ── Supplier data ─────────────────────────────────────────────────

const SUPPLIERS: Supplier[] = [
  {
    id: 's-001', name: 'PT Maju Bersama', initials: 'MB', country: 'Indonesia', flag: '🇮🇩', vendorStatus: 'stable',
    score: 94, prevScore: 92, reliability: 96, quality: 92, price: 88, sustainability: 85, co2Score: 78,
    trend: 'up', sparkline: [85, 88, 90, 87, 92, 94],
    orders: 142, contractValue: 184000, contractExpiresIn: 142, categories: ['Protein', 'Dry Goods'],
    leadDays: 2, lastOrder: '20 Apr', savingsYTD: 12400, journeyStage: 11,
    accountManager: 'Budi Santoso', waPhone: '628123456789',
    assignedAgent: { id: 6, role: 'Pricing', activeTasks: 2 },
    agentNotes: 'Within your approved directory, A-01 detected a 6.2% price gap vs the vetted Protein cohort. Q3 renegotiation window opens in 42 days — consider proactive terms.',
    address: 'Jl. Gatot Subroto No. 14, Kuningan, Jakarta Selatan 12930, Indonesia',
    nib: '9120009821394',
    npwp: '01.234.567.8-901.000',
    contacts: [
      { role: 'Sales',     name: 'Budi Santoso',      email: 'budi.s@majubersama.id',    phone: '+62 812 3456 789' },
      { role: 'Finance',   name: 'Sinta Permata',     email: 'finance@majubersama.id',   phone: '+62 813 5566 778' },
      { role: 'Logistics', name: 'Ahmad Rizal',       email: 'logistics@majubersama.id', phone: '+62 811 9988 776' },
    ],
    messageHistory: [
      { id: 'm1', from: 'vendor', text: 'Confirming lamb shoulder shipment will arrive Thursday.', time: '09:42' },
      { id: 'm2', from: 'admin',  text: 'Thanks Budi — any chance to advance the next PO?',        time: '09:50' },
      { id: 'm3', from: 'vendor', text: 'Yes, Monday works. 500kg lamb + 200kg brisket.',           time: '10:03' },
    ],
    recentOrders: [
      { date: '20 Apr', item: 'Lamb shoulder 500kg', value: 4200, status: 'in-transit', metrics: ['delivery'] },
      { date: '17 Apr', item: 'Chuck roll 300kg (A-01 negotiated)', value: 2800, status: 'delivered', metrics: ['price'] },
      { date: '14 Apr', item: 'Jasmine rice 1t', value: 1100, status: 'delivered', metrics: ['delivery', 'price'] },
      { date: '10 Apr', item: 'Beef brisket 200kg', value: 1900, status: 'delivered', metrics: ['quality'] },
    ],
  },
  {
    id: 's-002', name: 'Thai Fresh Co.', initials: 'TF', country: 'Thailand', flag: '🇹🇭', vendorStatus: 'stable',
    score: 91, prevScore: 89, reliability: 93, quality: 95, price: 82, sustainability: 91, co2Score: 88,
    trend: 'up', sparkline: [82, 85, 88, 90, 89, 91],
    orders: 98, contractValue: 142000, contractExpiresIn: 231, categories: ['Seafood', 'Produce'],
    leadDays: 3, lastOrder: '19 Apr', savingsYTD: 8200, journeyStage: 10,
    accountManager: 'Somchai Prasert', waPhone: '66812345678',
    assignedAgent: { id: 18, role: 'Group Buying', activeTasks: 1 },
    agentNotes: 'Within your approved directory, this is the highest quality score in the vetted Seafood cohort. A-04 pooled 6 internal operators — tier-3 discount locked through Q3.',
    address: '88 Sukhumvit Road, Khlong Toei, Bangkok 10110, Thailand',
    nib: 'TH-0105559018742',
    npwp: '0-1055-59018-74-2',
    contacts: [
      { role: 'Sales',     name: 'Somchai Prasert',  email: 'somchai@thaifresh.co.th',    phone: '+66 81 234 5678' },
      { role: 'Finance',   name: 'Ploy Wattana',     email: 'finance@thaifresh.co.th',   phone: '+66 82 111 2233' },
      { role: 'Logistics', name: 'Narong Phanit',    email: 'logistics@thaifresh.co.th', phone: '+66 85 667 8899' },
    ],
    messageHistory: [
      { id: 'm1', from: 'vendor', text: 'Group buy tier 3 locked for Q3. Salmon 24% below list.', time: '08:15' },
      { id: 'm2', from: 'admin',  text: 'Excellent. Can you extend to prawns as well?',             time: '08:30' },
    ],
    recentOrders: [
      { date: '19 Apr', item: 'Atlantic salmon 200kg (group buy)', value: 3800, status: 'in-transit', metrics: ['delivery', 'price'] },
      { date: '15 Apr', item: 'Tiger prawns 80kg', value: 2100, status: 'delivered', metrics: ['quality'] },
      { date: '11 Apr', item: 'Cherry tomatoes 400kg (low-emission)', value: 1600, status: 'delivered', metrics: ['sustainability', 'co2'] },
    ],
  },
  {
    id: 's-003', name: 'AUS Meats Pty', initials: 'AM', country: 'Australia', flag: '🇦🇺', vendorStatus: 'watchlist',
    score: 88, prevScore: 88, reliability: 90, quality: 94, price: 76, sustainability: 82, co2Score: 72,
    trend: 'flat', sparkline: [86, 87, 88, 89, 88, 88],
    orders: 67, contractValue: 98000, contractExpiresIn: 28, categories: ['Protein'],
    leadDays: 5, lastOrder: '16 Apr', savingsYTD: 4100, journeyStage: 12,
    accountManager: 'James Whitaker', waPhone: '61412345678',
    assignedAgent: { id: 21, role: 'Benchmarking', activeTasks: 3 },
    agentNotes: 'Within your approved directory, contract expires in 28 days. Premium quality (94) but price index lags vetted peers. 5d lead time blocks 40% of auto-order triggers.',
    actionReason: 'Contract expires in 28 days',
    address: 'Unit 7, 142 Industrial Drive, Melbourne VIC 3000, Australia',
    nib: 'ABN 54 621 887 341',
    npwp: 'TFN 321-654-987',
    contacts: [
      { role: 'Sales',     name: 'James Whitaker',  email: 'james@ausmeats.com.au',     phone: '+61 4 1234 5678' },
      { role: 'Finance',   name: 'Olivia Chen',     email: 'accounts@ausmeats.com.au', phone: '+61 4 2000 1122' },
      { role: 'Logistics', name: 'Mark Delaney',    email: 'dispatch@ausmeats.com.au', phone: '+61 4 3344 5566' },
    ],
    messageHistory: [
      { id: 'm1', from: 'admin',  text: 'Contract renewal in 28 days — want to discuss terms?', time: '14:05' },
      { id: 'm2', from: 'vendor', text: 'Can we schedule a call this week? Open to revised pricing.', time: '14:22' },
    ],
    recentOrders: [
      { date: '16 Apr', item: 'Wagyu stripling 120kg', value: 5400, status: 'delivered', metrics: ['quality'] },
      { date: '09 Apr', item: 'Lamb rack 80kg', value: 3200, status: 'late', metrics: ['delivery'] },
    ],
  },
  {
    id: 's-004', name: 'VN Supply Ltd', initials: 'VN', country: 'Vietnam', flag: '🇻🇳', vendorStatus: 'action',
    score: 82, prevScore: 85, reliability: 85, quality: 80, price: 92, sustainability: 68, co2Score: 61,
    trend: 'down', sparkline: [88, 86, 85, 83, 82, 82],
    orders: 54, contractValue: 61000, contractExpiresIn: 89, categories: ['Produce', 'Dry Goods'],
    leadDays: 4, lastOrder: '18 Apr', savingsYTD: 2100, journeyStage: 11,
    accountManager: 'Nguyen Van Thanh', waPhone: '84912345678',
    assignedAgent: { id: 3, role: 'Compliance', activeTasks: 4 },
    agentNotes: 'Declining quality trend over 4 months. 3 compliance incidents this quarter. Within your approved directory, A-02 has pre-qualified 2 vetted Produce alternatives — replacement available without external sourcing.',
    actionReason: 'Score dropped 3pts · 3 compliance incidents',
    address: '24 Le Loi Street, District 1, Ho Chi Minh City 70000, Vietnam',
    nib: 'VN-0301234567',
    npwp: '0301234567',
    contacts: [
      { role: 'Sales',     name: 'Nguyen Van Thanh', email: 'thanh@vnsupply.vn',    phone: '+84 91 234 5678' },
      { role: 'Finance',   name: 'Le Thi Hoa',       email: 'finance@vnsupply.vn',  phone: '+84 93 222 3344' },
      { role: 'Logistics', name: 'Tran Minh Duc',    email: 'ship@vnsupply.vn',     phone: '+84 90 556 7788' },
    ],
    messageHistory: [
      { id: 'm1', from: 'admin',  text: '3 quality disputes this quarter — please investigate.', time: '11:30' },
      { id: 'm2', from: 'vendor', text: 'Understood. Running internal audit.',                    time: '11:45' },
    ],
    recentOrders: [
      { date: '18 Apr', item: 'Mixed herbs 200kg', value: 900, status: 'pending', metrics: ['delivery'] },
      { date: '12 Apr', item: 'Lemongrass 150kg', value: 420, status: 'disputed', metrics: ['quality'] },
      { date: '05 Apr', item: 'Basil 100kg (returned)', value: 280, status: 'disputed', metrics: ['quality'] },
    ],
  },
  {
    id: 's-005', name: 'Indo Seafood', initials: 'IS', country: 'Indonesia', flag: '🇮🇩', vendorStatus: 'action',
    score: 79, prevScore: 81, reliability: 78, quality: 82, price: 84, sustainability: 74, co2Score: 69,
    trend: 'down', sparkline: [84, 82, 81, 80, 79, 79],
    orders: 41, contractValue: 44000, contractExpiresIn: 18, categories: ['Seafood'],
    leadDays: 2, lastOrder: '15 Apr', savingsYTD: 1400, journeyStage: 11,
    accountManager: 'Rizky Pratama', waPhone: '628567890123',
    assignedAgent: { id: 6, role: 'Pricing', activeTasks: 2 },
    agentNotes: 'Contract expires in 18 days. 2 SLA breaches this quarter. Within your approved directory, A-01 is sourcing a replacement from the vetted Seafood cohort.',
    actionReason: 'Contract expires in 18 days · 2 SLA breaches',
    address: 'Pelabuhan Muara Baru Blok A-12, Jakarta Utara 14440, Indonesia',
    nib: '9120014556783',
    npwp: '02.998.112.3-456.000',
    contacts: [
      { role: 'Sales',     name: 'Rizky Pratama',  email: 'rizky@indoseafood.id',    phone: '+62 856 7890 123' },
      { role: 'Finance',   name: 'Dewi Lestari',   email: 'finance@indoseafood.id',  phone: '+62 815 4433 221' },
      { role: 'Logistics', name: 'Bambang Yuda',   email: 'ops@indoseafood.id',      phone: '+62 811 6655 443' },
    ],
    messageHistory: [],
    recentOrders: [
      { date: '15 Apr', item: 'Snapper fillet 150kg', value: 2100, status: 'late', metrics: ['delivery'] },
      { date: '08 Apr', item: 'Grouper whole 100kg', value: 1800, status: 'delivered', metrics: ['quality'] },
    ],
  },
  {
    id: 's-006', name: 'PH Agri Corp', initials: 'PH', country: 'Philippines', flag: '🇵🇭', vendorStatus: 'stable',
    score: 86, prevScore: 84, reliability: 88, quality: 86, price: 85, sustainability: 88, co2Score: 83,
    trend: 'up', sparkline: [80, 82, 83, 84, 85, 86],
    orders: 72, contractValue: 78000, contractExpiresIn: 178, categories: ['Produce', 'Beverages'],
    leadDays: 3, lastOrder: '17 Apr', savingsYTD: 5600, journeyStage: 10,
    accountManager: 'Maria Santos', waPhone: '639171234567',
    assignedAgent: { id: 29, role: 'Sustainability', activeTasks: 1 },
    agentNotes: 'Within your approved directory, this vendor shows the strongest upward trend in vetted Produce. A-01 certified as low-emission supplier. One quote rejected Apr 15 (delivery threshold).',
    address: '1501 Ortigas Avenue, Pasig, Metro Manila 1605, Philippines',
    nib: 'PH-SEC-CS201812345',
    npwp: '009-321-654-000',
    contacts: [
      { role: 'Sales',     name: 'Maria Santos',     email: 'maria@phagri.ph',       phone: '+63 917 123 4567' },
      { role: 'Finance',   name: 'Joselito Cruz',    email: 'finance@phagri.ph',     phone: '+63 918 556 7788' },
      { role: 'Logistics', name: 'Angelita Reyes',   email: 'logistics@phagri.ph',   phone: '+63 920 334 5566' },
    ],
    messageHistory: [
      { id: 'm1', from: 'vendor', text: 'Low-emission banana shipment certified and dispatched.', time: '07:50' },
    ],
    recentOrders: [
      { date: '17 Apr', item: 'Cavendish banana 800kg (low-emission)', value: 1200, status: 'in-transit', metrics: ['sustainability', 'co2'] },
      { date: '13 Apr', item: 'Calamansi juice 200L', value: 640, status: 'delivered', metrics: ['quality'] },
      { date: '09 Apr', item: 'Pineapple 500kg', value: 900, status: 'delivered', metrics: ['price'] },
    ],
  },
];

// ── 12-Stage DAG Relationship Kernel ──────────────────────────────

const JOURNEY = [
  { id: 1, label: 'Discovery' },
  { id: 2, label: 'RFQ Issued' },
  { id: 3, label: 'Proposal Received' },
  { id: 4, label: 'Evaluation' },
  { id: 5, label: 'KYC Verification' },
  { id: 6, label: 'Contract Draft' },
  { id: 7, label: 'Legal Review' },
  { id: 8, label: 'Onboarding' },
  { id: 9, label: 'First Order' },
  { id: 10, label: 'Active' },
  { id: 11, label: 'Performance Review' },
  { id: 12, label: 'Renewal' },
];

// ── Manual Takeover · Task Modules ────────────────────────────────
// Each stage has a typed form requiring human evidence/inputs. When
// "Manual Takeover" is on, clicking a stage opens its module — the
// Admin completes the work as if no AI agent existed and advances the
// relationship one stage at a time.
type RelStageInputKind = 'text' | 'textarea' | 'select' | 'file' | 'date' | 'number';
interface RelStageInput {
  kind: RelStageInputKind;
  key: string;
  label: string;
  placeholder?: string;
  options?: string[];
  accept?: string;
  required?: boolean;
}
interface RelStageModule {
  action: string;     // The verb-phrase shown in the modal header
  rationale: string;  // 1-line explanation of why this stage exists
  inputs: RelStageInput[];
}
const RELATIONSHIP_TASK_MODULES: RelStageModule[] = [
  // 1. Discovery
  { action: 'Log a candidate vendor',
    rationale: 'Capture who they are, where they came from, and how to reach them.',
    inputs: [
      { kind: 'text',     key: 'vendor_name',     label: 'Vendor Name',         required: true, placeholder: 'e.g. PT Maju Bersama' },
      { kind: 'select',   key: 'source',          label: 'How you found them',  required: true, options: ['Referral', 'Trade show', 'Cold outreach', 'Inbound inquiry', 'Industry directory'] },
      { kind: 'text',     key: 'country',         label: 'Country', placeholder: 'e.g. Indonesia' },
      { kind: 'text',     key: 'contact_name',    label: 'Primary Contact',     placeholder: 'Name + role' },
      { kind: 'text',     key: 'contact_email',   label: 'Contact Email' },
      { kind: 'textarea', key: 'discovery_notes', label: 'Discovery Notes',     placeholder: 'First impressions, why they\'re a candidate' },
    ] },
  // 2. RFQ Issued
  { action: 'Send the Request for Quote',
    rationale: 'Document what you asked for, when, and through which channel.',
    inputs: [
      { kind: 'file',     key: 'rfq_doc',     label: 'Upload RFQ document', required: true, accept: '.pdf,.doc,.docx' },
      { kind: 'select',   key: 'channel',     label: 'Channel',             required: true, options: ['Email', 'Phone', 'WhatsApp', 'Vendor portal', 'In-person'] },
      { kind: 'date',     key: 'sent_at',     label: 'Sent on',             required: true },
      { kind: 'date',     key: 'deadline',    label: 'Response deadline' },
      { kind: 'textarea', key: 'scope_notes', label: 'Scope summary',       placeholder: 'What categories / volumes / terms you asked for' },
    ] },
  // 3. Proposal Received
  { action: 'Log the proposal they sent back',
    rationale: 'Capture their pricing, lead time, and any conditions.',
    inputs: [
      { kind: 'file',     key: 'proposal_doc', label: 'Upload proposal',          required: true, accept: '.pdf,.doc,.docx,.xlsx' },
      { kind: 'text',     key: 'unit_price',   label: 'Quoted unit price',         required: true, placeholder: 'e.g. $4.20/kg' },
      { kind: 'text',     key: 'lead_time',    label: 'Quoted lead time',          required: true, placeholder: 'e.g. 4 days' },
      { kind: 'select',   key: 'payment_terms',label: 'Payment terms',             options: ['Net 15', 'Net 30', 'Net 60', '50% deposit · 50% on delivery', 'Letter of Credit'] },
      { kind: 'textarea', key: 'caveats',      label: 'Caveats / conditions',      placeholder: 'Volume minimums, exclusivity clauses, etc.' },
    ] },
  // 4. Evaluation
  { action: 'Score the proposal',
    rationale: 'Decide whether to proceed to KYC. Be deliberate — these scores feed the directory.',
    inputs: [
      { kind: 'number',   key: 'quality_score',     label: 'Quality (0-100)',     required: true, placeholder: '85' },
      { kind: 'number',   key: 'price_score',       label: 'Price competitiveness (0-100)', required: true, placeholder: '90' },
      { kind: 'number',   key: 'reliability_score', label: 'Reliability proxy (0-100)',     required: true, placeholder: '88' },
      { kind: 'select',   key: 'recommendation',    label: 'Recommendation',                required: true, options: ['Proceed to KYC', 'Counter-offer first', 'Reject — too expensive', 'Reject — quality concerns', 'Park for later'] },
      { kind: 'textarea', key: 'rationale',         label: 'Rationale',                     placeholder: 'Why this score, why this recommendation' },
    ] },
  // 5. KYC Verification
  { action: 'Verify legal & financial vitals',
    rationale: 'No vendor enters the directory unverified. This is the Fortress gate.',
    inputs: [
      { kind: 'text',     key: 'nib',                  label: 'Business Registration (NIB)', required: true, placeholder: 'e.g. 9120009821394' },
      { kind: 'text',     key: 'tax_id',               label: 'Tax ID / NPWP',                required: true, placeholder: 'e.g. 01.234.567.8-901.000' },
      { kind: 'date',     key: 'incorporation_date',   label: 'Incorporation date' },
      { kind: 'file',     key: 'kyc_packet',           label: 'KYC document packet',          required: true, accept: '.pdf,.zip' },
      { kind: 'select',   key: 'sanctions_check',      label: 'Sanctions / OFAC screening',   required: true, options: ['Clear', 'Flagged — needs legal', 'Pending'] },
    ] },
  // 6. Contract Draft
  { action: 'Draft the contract',
    rationale: 'Lock the commercial terms before legal review.',
    inputs: [
      { kind: 'file',     key: 'contract_draft', label: 'Upload contract draft',  required: true, accept: '.pdf,.doc,.docx' },
      { kind: 'text',     key: 'term_length',    label: 'Term length',            required: true, placeholder: 'e.g. 12 months' },
      { kind: 'select',   key: 'payment_terms',  label: 'Payment terms',          required: true, options: ['Net 15', 'Net 30', 'Net 60', '50/50'] },
      { kind: 'text',     key: 'volume_commit',  label: 'Volume commitment',                placeholder: 'e.g. min 500 kg/month' },
      { kind: 'textarea', key: 'special_clauses',label: 'Special clauses',        placeholder: 'Quality holdback, exclusivity, MFN, etc.' },
    ] },
  // 7. Legal Review
  { action: 'Get legal sign-off',
    rationale: 'Risk language and indemnities reviewed by counsel before signing.',
    inputs: [
      { kind: 'text',     key: 'reviewer',         label: 'Legal reviewer',           required: true, placeholder: 'Name + firm' },
      { kind: 'file',     key: 'redlines',         label: 'Upload redlines / markup', accept: '.pdf,.doc,.docx' },
      { kind: 'select',   key: 'approval_status',  label: 'Approval',                 required: true, options: ['Approved', 'Approved with conditions', 'Rejected — needs rework', 'Pending'] },
      { kind: 'textarea', key: 'legal_notes',      label: 'Notes',                    placeholder: 'Outstanding clauses, escalations, follow-ups' },
    ] },
  // 8. Onboarding
  { action: 'Onboard the supplier into your systems',
    rationale: 'ERP IDs, account managers, banking details — make them executable.',
    inputs: [
      { kind: 'text',     key: 'erp_supplier_id',  label: 'ERP supplier ID',     required: true, placeholder: 'e.g. SUP-2026-0048' },
      { kind: 'text',     key: 'account_manager',  label: 'Account manager (yours)', placeholder: 'Who owns this relationship' },
      { kind: 'text',     key: 'their_contact',    label: 'Their account manager',   placeholder: 'Their primary contact' },
      { kind: 'file',     key: 'banking_form',     label: 'Banking / W-9 form upload', accept: '.pdf' },
      { kind: 'textarea', key: 'kickoff_notes',    label: 'Kickoff meeting notes' },
    ] },
  // 9. First Order
  { action: 'Place the first PO',
    rationale: 'Trial run. Quality holdback usually stays attached.',
    inputs: [
      { kind: 'text',     key: 'po_number',     label: 'PO number',         required: true, placeholder: 'e.g. PO-2026-0148' },
      { kind: 'text',     key: 'items',         label: 'Items',             required: true, placeholder: 'What you ordered' },
      { kind: 'number',   key: 'po_value',      label: 'PO value (USD)',    required: true },
      { kind: 'date',     key: 'delivery_date', label: 'Scheduled delivery', required: true },
      { kind: 'textarea', key: 'risk_notes',    label: 'First-order risk notes', placeholder: 'Hold-clauses, observers assigned, etc.' },
    ] },
  // 10. Active
  { action: 'Move into active rotation',
    rationale: 'Trial passed — they\'re now a regular supplier.',
    inputs: [
      { kind: 'select',   key: 'first_order_outcome', label: 'First-order outcome', required: true, options: ['Met spec — promote to active', 'Met spec with notes', 'Below spec — re-trial', 'Failed — terminate'] },
      { kind: 'number',   key: 'baseline_quality',    label: 'Baseline quality score', placeholder: '90' },
      { kind: 'number',   key: 'baseline_lead_time',  label: 'Baseline lead time (days)' },
      { kind: 'textarea', key: 'first_order_notes',   label: 'Performance notes' },
    ] },
  // 11. Performance Review
  { action: 'Run the quarterly review',
    rationale: 'Score them against baseline. Drives renewal & autonomy decisions.',
    inputs: [
      { kind: 'number',   key: 'q_quality',       label: 'Quality score (0-100)',   required: true },
      { kind: 'number',   key: 'q_reliability',   label: 'Reliability score (0-100)', required: true },
      { kind: 'number',   key: 'q_price',         label: 'Price competitiveness (0-100)', required: true },
      { kind: 'select',   key: 'recommendation',  label: 'Recommendation',          required: true, options: ['Renew at current terms', 'Renew with renegotiation', 'Probation', 'Terminate at end of term'] },
      { kind: 'textarea', key: 'review_notes',    label: 'Review summary' },
    ] },
  // 12. Renewal
  { action: 'Renew, renegotiate, or part ways',
    rationale: 'The relationship\'s next chapter. Capture the decision and the paper.',
    inputs: [
      { kind: 'select',   key: 'decision',         label: 'Decision',             required: true, options: ['Renew — same terms', 'Renew — new terms', 'Renegotiate then decide', 'Terminate — wind down', 'Terminate — immediate'] },
      { kind: 'file',     key: 'renewal_contract', label: 'New contract / amendment upload', accept: '.pdf,.doc,.docx' },
      { kind: 'text',     key: 'new_term_length',  label: 'New term length',      placeholder: 'e.g. 24 months' },
      { kind: 'textarea', key: 'closing_notes',    label: 'Closing notes',        placeholder: 'Lessons learned, handoff details' },
    ] },
];

// ── Helpers ───────────────────────────────────────────────────────

function primaryCategoryColor(s: Supplier) {
  return CATEGORY_COLORS[s.categories[0]] ?? CATEGORY_COLORS.Other;
}

function scoreColor(score: number) {
  if (score >= 90) return 'text-green-400';
  if (score >= 80) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBar(score: number) {
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-amber-500';
  return 'bg-red-500';
}

function statusMeta(status: VendorStatus, isDark: boolean) {
  switch (status) {
    case 'action':
      return { label: 'Action Required', icon: AlertTriangle, pill: isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700', dot: 'bg-red-500' };
    case 'watchlist':
      return { label: 'Watchlist', icon: Eye, pill: isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' };
    case 'stable':
      return { label: 'Stable', icon: CheckCircle, pill: isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700', dot: 'bg-green-500' };
  }
}

// ── Agent identity helper ─────────────────────────────────────────
// Translates legacy Buyamia numeric agent IDs to the 6-agent Finn's
// roster (A-01..A-05). Defaults to A-01 (Sourcing) for any unknown
// legacy id — Suppliers mostly works against the Sourcing Agent.
const LEGACY_AGENT_MAP: Record<number, string> = {
  1: 'A-04', 3: 'A-02', 5: 'A-01', 6: 'A-01', 7: 'A-05',
  8: 'A-02', 9: 'A-05', 10: 'A-04', 13: 'A-03', 14: 'A-04',
  18: 'A-04', 21: 'A-01', 25: 'A-02', 28: 'A-04', 33: 'A-04',
};
function agentBadge(a: AssignedAgent) {
  return LEGACY_AGENT_MAP[a.id] ?? 'A-01';
}
function agentLabel(a: AssignedAgent) {
  return `${agentBadge(a)} · ${a.role}`;
}

// ── Labor Switch (Manual Takeover) ────────────────────────────────
// Two-segment pill: Agent Active vs Manual Takeover.
// `compact` collapses to a single-tap icon toggle for table cells.
function LaborSwitch({
  mode, onChange, agent, isDark, compact, onOpenAgent,
}: {
  mode: LaborMode;
  onChange: (next: LaborMode) => void;
  agent: AssignedAgent;
  isDark: boolean;
  compact?: boolean;
  onOpenAgent?: () => void;
}) {
  const agentActive = mode === 'agent';
  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onChange(agentActive ? 'manual' : 'agent'); }}
        title={agentActive ? `${agentBadge(agent)} executing — click to take over manually` : 'Manual takeover active — click to release back to Agent'}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border transition-colors whitespace-nowrap ${
          agentActive
            ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
            : isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-400/40 text-amber-700'
        }`}
      >
        {agentActive ? <Bot className="h-2.5 w-2.5" /> : <Hand className="h-2.5 w-2.5" />}
        {agentActive ? `#${String(agent.id).padStart(2, '0')}` : 'Manual'}
      </button>
    );
  }
  return (
    <div className={`inline-flex items-stretch rounded-full border ${isDark ? 'border-gray-700 bg-[#2a2a2a]' : 'border-gray-200 bg-gray-50'}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onChange('agent'); onOpenAgent?.(); }}
        className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full text-[10px] font-semibold transition-colors ${
          agentActive
            ? 'bg-[#87986a] text-white shadow-sm'
            : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
        }`}
        title={agentActive
          ? `Executing · ${agent.activeTasks} open task${agent.activeTasks === 1 ? '' : 's'}`
          : `Resume ${agentBadge(agent)} (${agent.role})`}
      >
        <Bot className="h-3 w-3" />
        {agentBadge(agent)}
        {agentActive && (
          <span className={`text-[8px] font-bold px-1 py-px rounded-full ${isDark ? 'bg-white/15 text-white' : 'bg-white/30 text-white'}`}>
            {agent.activeTasks}
          </span>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onChange('manual'); }}
        className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-full text-[10px] font-semibold transition-colors ${
          !agentActive
            ? 'bg-amber-500 text-white shadow-sm'
            : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
        }`}
        title={!agentActive
          ? `${agent.activeTasks} task${agent.activeTasks === 1 ? '' : 's'} parked in Human Review queue`
          : 'Suspend Agent and take over manually'}
      >
        <Hand className="h-3 w-3" />
        Manual Takeover
      </button>
    </div>
  );
}

// ── Agent-status sub-line (used under the switch) ─────────────────
function AgentStatusLine({
  mode, agent, isDark, onOpenAgent, dense,
}: {
  mode: LaborMode;
  agent: AssignedAgent;
  isDark: boolean;
  onOpenAgent?: () => void;
  dense?: boolean;
}) {
  const sageText = isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]';
  const amberText = 'text-amber-500';
  const subText = isDark ? 'text-gray-500' : 'text-gray-500';
  if (mode === 'agent') {
    return (
      <div className={`flex items-center gap-1.5 ${dense ? 'text-[9px]' : 'text-[10px]'} ${subText}`}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#87986a] opacity-60 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#87986a]" />
        </span>
        <span className={sageText + ' font-medium'}>Executing</span>
        <span>·</span>
        <span>{agent.activeTasks} open task{agent.activeTasks === 1 ? '' : 's'}</span>
        {onOpenAgent && (
          <button onClick={(e) => { e.stopPropagation(); onOpenAgent(); }}
                  className={`ml-1 inline-flex items-center gap-0.5 ${sageText} hover:underline`}>
            Tune in Governance <ExternalLink className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-1.5 ${dense ? 'text-[9px]' : 'text-[10px]'} ${subText}`}>
      <PauseCircle className={`h-3 w-3 ${amberText}`} />
      <span className={amberText + ' font-medium'}>Agent in Standby</span>
      <span>·</span>
      <span>{agent.activeTasks} task{agent.activeTasks === 1 ? '' : 's'} → Human Review queue</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────

export function SuppliersPage({ theme, onNavigate }: SuppliersPageProps) {
  const isDark = theme === 'dark';
  const t = themeTokens(isDark);
  const panelBorder = isDark ? 'border-gray-800' : 'border-gray-200';
  const panelBg = isDark ? 'bg-[#1a1a1a]' : 'bg-white';

  // ── Labor Switch (Manual Takeover) ─────────────────────────────
  // Per-vendor steering mode. Default 'agent' for every vendor.
  const [laborMode, setLaborMode] = useState<Record<string, LaborMode>>({});
  const getMode = useCallback((id: string): LaborMode => laborMode[id] ?? 'agent', [laborMode]);
  const setMode = useCallback((id: string, mode: LaborMode) => {
    setLaborMode(prev => ({ ...prev, [id]: mode }));
  }, []);
  const bulkSetMode = useCallback((ids: string[], mode: LaborMode) => {
    setLaborMode(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = mode; });
      return next;
    });
  }, []);
  const openGovernance = useCallback((agentId: number) => {
    // Wayne doctrine: every Agent assignment must lead back to its Directory profile
    // for autonomy / approval-limit tuning. Governance page handles deep-link via URL hash.
    if (typeof window !== 'undefined') {
      window.location.hash = `agent-${String(agentId).padStart(2, '0')}`;
    }
    onNavigate?.('governance');
  }, [onNavigate]);
  // Vendor Onboarding mini-wizard (Phase 4i). Replaces the broken
  // "redirect to New Request" path with a proper 4-step intake modal.
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const handleOnboardVendor = useCallback(() => {
    setOnboardingOpen(true);
  }, []);

  // ── Manual Takeover · per-stage task modules ──────────────────
  // Per-supplier override: how many stages have been manually advanced
  // beyond the seeded `journeyStage`. Effective stage = max(seed, override).
  const [forceCompletedJourneyStages, setForceCompletedJourneyStages] = useState<Record<string, number>>({});
  const getEffectiveJourneyStage = useCallback((supplier: Supplier): number => {
    return Math.max(supplier.journeyStage, forceCompletedJourneyStages[supplier.id] ?? 0);
  }, [forceCompletedJourneyStages]);
  // Persisted manual stage entries: { [supplierId]: { [stageIdx]: { fieldKey: value } } }.
  const [manualJourneyEntries, setManualJourneyEntries] = useState<Record<string, Record<number, Record<string, string>>>>({});
  // Currently-open stage modal: { supplierId, stageIdx (0-based) }
  const [openJourneyStage, setOpenJourneyStage] = useState<{ supplierId: string; stageIdx: number } | null>(null);
  const [journeyStageDraft, setJourneyStageDraft] = useState<Record<string, string>>({});
  const [journeyValidationErrors, setJourneyValidationErrors] = useState<string[]>([]);
  const openJourneyModule = useCallback((supplierId: string, stageIdx: number) => {
    setOpenJourneyStage({ supplierId, stageIdx });
    setJourneyStageDraft(manualJourneyEntries[supplierId]?.[stageIdx] ?? {});
    setJourneyValidationErrors([]);
  }, [manualJourneyEntries]);
  const closeJourneyModule = useCallback(() => {
    setOpenJourneyStage(null);
    setJourneyStageDraft({});
    setJourneyValidationErrors([]);
  }, []);
  const saveJourneyModule = useCallback((advance: boolean) => {
    if (!openJourneyStage) return;
    const { supplierId, stageIdx } = openJourneyStage;
    const mod = RELATIONSHIP_TASK_MODULES[stageIdx];
    if (advance) {
      const missing = mod.inputs
        .filter(i => i.required && !((journeyStageDraft[i.key] ?? '').toString().trim()))
        .map(i => i.key);
      if (missing.length > 0) {
        setJourneyValidationErrors(missing);
        return;
      }
    }
    setManualJourneyEntries(prev => ({
      ...prev,
      [supplierId]: { ...(prev[supplierId] ?? {}), [stageIdx]: { ...journeyStageDraft } },
    }));
    if (advance) {
      setForceCompletedJourneyStages(prev => ({
        ...prev,
        [supplierId]: Math.max(prev[supplierId] ?? 0, stageIdx + 1),
      }));
    }
    closeJourneyModule();
  }, [openJourneyStage, journeyStageDraft, closeJourneyModule]);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>('s-001');
  const [comparisonActive, setComparisonActive] = useState(false);
  const [compareTooltipVisible, setCompareTooltipVisible] = useState(false);
  const compareTooltipTimer = useRef<number | null>(null);
  const [metricFilter, setMetricFilter] = useState<RadarMetric>(null);
  const [showHardened, setShowHardened] = useState(false);
  const [hardenedName, setHardenedName] = useState('');
  const [centerOpacity, setCenterOpacity] = useState(1);
  const [expandedSidebar, setExpandedSidebar] = useState(false);
  const [auditView, setAuditView] = useState<AuditView>('table');
  const [dossierOpen, setDossierOpen] = useState(true);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [messagingChannel, setMessagingChannel] = useState<MessageChannel>('whatsapp');
  const [messageDraft, setMessageDraft] = useState('');
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>({});
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | VendorStatus>('all');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scoreMin, setScoreMin] = useState(0);
  const [contractMaxDays, setContractMaxDays] = useState(365);
  const [auditChecked, setAuditChecked] = useState<Set<string>>(new Set());
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [kebabOpenId, setKebabOpenId] = useState<string | null>(null);
  const [matrixVisible, setMatrixVisible] = useState(false);
  const [sidebarSelectMode, setSidebarSelectMode] = useState(false);
  const [sidebarSelected, setSidebarSelected] = useState<Set<string>>(new Set());

  // QC failure alerts from Orders page
  const [qcFailureAlerts, setQcFailureAlerts] = useState<Array<{ orderId: string; supplier: string; ts: number }>>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const { orderId, supplier } = (e as CustomEvent<{ orderId: string; supplier: string }>).detail ?? {};
      if (orderId && supplier) {
        setQcFailureAlerts(prev => [...prev, { orderId, supplier, ts: Date.now() }]);
      }
    };
    window.addEventListener('finns-qc-failure', handler);
    return () => window.removeEventListener('finns-qc-failure', handler);
  }, []);

  const filtered = useMemo(() =>
    SUPPLIERS.filter(s =>
      !search
        || s.name.toLowerCase().includes(search.toLowerCase())
        || s.country.toLowerCase().includes(search.toLowerCase())
    ), [search]
  );

  const grouped = useMemo(() => ({
    action:    filtered.filter(s => s.vendorStatus === 'action'),
    watchlist: filtered.filter(s => s.vendorStatus === 'watchlist'),
    stable:    filtered.filter(s => s.vendorStatus === 'stable'),
  }), [filtered]);

  const selected = selectedId ? SUPPLIERS.find(s => s.id === selectedId) ?? null : null;
  const compareSuppliers = useMemo(
    () => Array.from(sidebarSelected).map(id => SUPPLIERS.find(s => s.id === id)).filter(Boolean) as Supplier[],
    [sidebarSelected]
  );
  const isComparing = comparisonActive && compareSuppliers.length === 2;

  const renewalsCount = useMemo(() => SUPPLIERS.filter(s => s.contractExpiresIn <= 60).length, []);

  const auditFiltered = useMemo(() =>
    filtered
      .filter(s => auditStatusFilter === 'all' || s.vendorStatus === auditStatusFilter)
      .filter(s => !auditCategoryFilter || s.categories.includes(auditCategoryFilter))
      .filter(s => s.score >= scoreMin)
      .filter(s => s.contractExpiresIn <= contractMaxDays),
    [filtered, auditStatusFilter, auditCategoryFilter, scoreMin, contractMaxDays]
  );

  const auditCategories = useMemo(() =>
    Array.from(new Set(filtered.flatMap(s => s.categories))).sort(),
    [filtered]
  );

  const auditCheckedList = useMemo(() =>
    Array.from(auditChecked).map(id => SUPPLIERS.find(s => s.id === id)).filter(Boolean) as Supplier[],
    [auditChecked]
  );

  // Matrix requires explicit Compare click — never triggered by checkbox alone
  const showComparisonMatrix = expandedSidebar && matrixVisible && auditCheckedList.length === 2;

  const handleSelect = useCallback((id: string) => {
    if (sidebarSelectMode && !expandedSidebar) {
      setSidebarSelected(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      return;
    }
    if (expandedSidebar) {
      // Expanded mode: opens Peek Sheet, never collapses back
      setSelectedId(id);
      setMetricFilter(null);
      return;
    }
    // Normal mode: Doherty <400ms fade
    setCenterOpacity(0);
    setTimeout(() => {
      setSelectedId(prev => prev === id ? null : id);
      setMetricFilter(null);
      setCenterOpacity(1);
    }, 160);
  }, [expandedSidebar, sidebarSelectMode]);

  const handleBackToEcosystem = useCallback(() => {
    setCenterOpacity(0);
    setTimeout(() => {
      setSelectedId(null);
      setMetricFilter(null);
      setCenterOpacity(1);
    }, 160);
  }, []);

  const handleTriggerCompare = useCallback(() => {
    if (comparisonActive) {
      setComparisonActive(false);
      return;
    }
    if (sidebarSelected.size === 2) {
      setComparisonActive(true);
      setSelectedId(null);
      return;
    }
    // Wrong count — surface tooltip, auto-enable select mode so user can act
    if (!sidebarSelectMode) setSidebarSelectMode(true);
    setCompareTooltipVisible(true);
    if (compareTooltipTimer.current) window.clearTimeout(compareTooltipTimer.current);
    compareTooltipTimer.current = window.setTimeout(() => setCompareTooltipVisible(false), 2600);
  }, [comparisonActive, sidebarSelected, sidebarSelectMode]);

  const handleExitComparison = useCallback(() => {
    setComparisonActive(false);
  }, []);

  const handleExpand = useCallback(() => {
    setExpandedSidebar(true);
    setComparisonActive(false);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpandedSidebar(false);
  }, []);

  const handleOpenFullWorkspace = useCallback(() => {
    setExpandedSidebar(false);
    // selected stays so relationship workspace shows
  }, []);

  // Renegotiation Workspace (Phase 4k). The old confetti animation
  // (setHardenedName + setShowHardened) is preserved as the *post*-sign
  // micro-celebration — fired by the modal's onClose after a successful
  // sign. The CTA now opens the modal instead of skipping straight to
  // the burst.
  const [renegotiationOpen, setRenegotiationOpen] = useState(false);
  const handleExecuteRenegotiate = useCallback(() => {
    if (!selected) return;
    setRenegotiationOpen(true);
  }, [selected]);
  const handleRenegotiationClose = useCallback(() => {
    setRenegotiationOpen(false);
  }, []);

  const handleOpenMessaging = useCallback(() => {
    setMessagingOpen(true);
  }, []);

  const handleToggleAuditCheck = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAuditChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleAllAuditCheck = useCallback(() => {
    setAuditChecked(prev =>
      prev.size === auditFiltered.length
        ? new Set()
        : new Set(auditFiltered.map(s => s.id))
    );
  }, [auditFiltered]);

  const handleBulkCompare = useCallback(() => {
    if (auditChecked.size !== 2) return;
    setMatrixVisible(true);
  }, [auditChecked]);

  const handleExport = useCallback(() => {
    const headers = ['Name','Country','Status','Score','Delivery','Quality','Price','Sustainability','CO2','Lead Days','Annual Contract ($)','Contract Expires (days)','Savings YTD ($)','Journey Stage'];
    const rows = auditFiltered.map(s => [
      s.name, s.country, s.vendorStatus, s.score, s.reliability, s.quality, s.price,
      s.sustainability, s.co2Score, s.leadDays, s.contractValue, s.contractExpiresIn,
      s.savingsYTD, s.journeyStage,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditFiltered]);

  const handleSendMessage = useCallback(() => {
    if (!selected || !messageDraft.trim()) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const text = messageDraft.trim();
    const msg: ChatMessage = {
      id: `ms-${Date.now()}`,
      from: 'admin',
      text,
      time,
    };
    setSessionMessages(prev => ({
      ...prev,
      [selected.id]: [...(prev[selected.id] ?? []), msg],
    }));
    setMessageDraft('');
    logUserAction({
      kind: 'vendor-message',
      entity: { type: 'supplier', id: selected.id },
      summary: `Messaged ${selected.name} via ${messagingChannel === 'whatsapp' ? 'WhatsApp' : 'Telegram'} · ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
      details: text,
      meta: { channel: messagingChannel, vendor: selected.name },
    });
  }, [selected, messageDraft, messagingChannel]);

  const handleOpenMap = useCallback(() => {
    if (!selected) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.address)}`, '_blank');
  }, [selected]);

  const handleKebabViewJourney = useCallback((s: Supplier) => {
    setKebabOpenId(null);
    setSelectedId(s.id);
    setMatrixVisible(false); // Dismiss matrix so peek sheet is visible
  }, []);

  const handleKebabCompare = useCallback((s: Supplier) => {
    setKebabOpenId(null);
    setAuditChecked(prev => {
      if (prev.size >= 2 || prev.has(s.id)) return prev;
      const next = new Set(prev);
      next.add(s.id);
      return next;
    });
  }, []);

  const handleKebabBroadcast = useCallback((s: Supplier) => {
    setKebabOpenId(null);
    setSelectedId(s.id);
    setMessagingOpen(true);
    setBroadcastOpen(false);
  }, []);

  const handleDownloadDossier = useCallback((s: Supplier) => {
    setKebabOpenId(null);
    const headers = ['Name','Country','Status','Score','Delivery','Quality','Price','Sustainability','CO2','Lead Days','Annual $','Contract Days','Savings YTD','Stage','Account Manager'];
    const row = [s.name, s.country, s.vendorStatus, s.score, s.reliability, s.quality, s.price, s.sustainability, s.co2Score, s.leadDays, s.contractValue, s.contractExpiresIn, s.savingsYTD, s.journeyStage, s.accountManager];
    const csv = [headers, row].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dossier-${s.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const tooltipStyle = {
    background: isDark ? '#2a2a2a' : '#fff',
    border: isDark ? '1px solid #333' : '1px solid #e5e7eb',
    borderRadius: '8px', fontSize: '11px',
    color: isDark ? '#fff' : '#111',
  };

  const filteredOrders = selected
    ? metricFilter
      ? selected.recentOrders.filter(o => o.metrics.includes(metricFilter))
      : selected.recentOrders
    : [];

  // ── Ecosystem calculations ──────────────────────────────────────

  const categoryHealth = useMemo(() => {
    const cats = ['Protein', 'Seafood', 'Produce', 'Dry Goods', 'Beverages'];
    return cats.map(cat => {
      const related = SUPPLIERS.filter(s => s.categories.includes(cat));
      const avgScore = related.length ? related.reduce((sum, s) => sum + s.score, 0) / related.length : 0;
      return { name: cat, score: Math.round(avgScore), suppliers: related.length, color: CATEGORY_COLORS[cat] };
    });
  }, []);

  const scatterData = useMemo(() =>
    SUPPLIERS.map(s => ({
      x: s.contractValue / 1000, // spend in $K
      y: s.reliability,          // reliability score
      z: s.orders,               // bubble size
      name: s.name,
      flag: s.flag,
      color: primaryCategoryColor(s),
      score: s.score,
    })), []
  );

  // ── Normal Left Panel (280px, Vendor Pulse) ──────────────────────

  const normalLeftPanel = (
    <div className="flex flex-col h-full">
      <div className={t.section}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Vendor Pulse</h2>
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>{SUPPLIERS.length} vendors · 3 tiers</p>
          </div>
          <div className="flex items-center gap-1">
            {(selectedId || comparisonActive || sidebarSelectMode) && (
              <button
                onClick={() => {
                  setComparisonActive(false);
                  setSidebarSelectMode(false);
                  setSidebarSelected(new Set());
                  handleBackToEcosystem();
                }}
                title="Back to Ecosystem"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <Globe className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => { setSidebarSelectMode(v => !v); setSidebarSelected(new Set()); }}
              title="Selection Mode"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                sidebarSelectMode
                  ? isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                  : isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleExpand}
              title="Expand to Audit Mode"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Search + compare toggle */}
      <div className={t.section}>
        <div className="relative mb-2.5">
          <Search className={t.searchIcon} />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={t.searchInput}
          />
        </div>
        {sidebarSelectMode && (
          <>
            <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${
              isDark ? 'border-[#87986a]/30 bg-[#87986a]/8' : 'border-[#87986a]/30 bg-[#f4f6f0]'
            }`}>
              <Users className={`h-3 w-3 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold leading-tight ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                {sidebarSelected.size === 0
                  ? 'Select vendors to compare or broadcast'
                  : `${sidebarSelected.size} selected`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <button
                onClick={handleTriggerCompare}
                className={`relative flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors ${
                  comparisonActive
                    ? 'bg-[#87986a] border-[#87986a] text-white'
                    : sidebarSelected.size === 2
                    ? isDark ? 'border-[#87986a]/50 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#87986a]/50 text-[#6b7a54] hover:bg-[#f4f6f0]'
                    : isDark ? 'border-gray-700 text-gray-500 hover:border-gray-600' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                <GitMerge className="h-3 w-3" />
                {comparisonActive ? 'Exit Compare' : 'Compare'}
              </button>
              <button
                onClick={() => {
                  if (sidebarSelected.size >= 2) {
                    setBroadcastOpen(true);
                    setMessagingOpen(false);
                  } else {
                    setCompareTooltipVisible(false);
                    if (compareTooltipTimer.current) window.clearTimeout(compareTooltipTimer.current);
                  }
                }}
                disabled={sidebarSelected.size < 2}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors ${
                  sidebarSelected.size >= 2
                    ? isDark ? 'border-[#87986a]/50 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#87986a]/50 text-[#6b7a54] hover:bg-[#f4f6f0]'
                    : isDark ? 'border-gray-700 text-gray-500 cursor-not-allowed opacity-50' : 'border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                }`}
              >
                <Globe className="h-3 w-3" />
                Broadcast
              </button>
            </div>
            {compareTooltipVisible && (
              <div className={`mt-1.5 flex items-start gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] leading-tight ${
                isDark ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-amber-500/40 bg-amber-50 text-amber-700'
              }`}>
                <Bot className="h-3 w-3 shrink-0 mt-0.5" />
                <span>Select 2 vendors to initiate a side-by-side comparison.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Grouped list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-3">
        {([
          { key: 'action' as const,    label: 'Action Required' },
          { key: 'watchlist' as const, label: 'Watchlist' },
          { key: 'stable' as const,    label: 'Stable' },
        ]).map(section => {
          const list = grouped[section.key];
          if (list.length === 0) return null;
          const meta = statusMeta(section.key, isDark);
          const SIcon = meta.icon;
          return (
            <div key={section.key} className={section.key !== 'action' ? 'mt-6' : ''}>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5">
                  <SIcon className={`h-3 w-3 ${section.key === 'action' ? 'text-red-400' : section.key === 'watchlist' ? 'text-amber-400' : 'text-green-400'}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${t.textMuted}`}>{section.label}</span>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.pill}`}>{list.length}</span>
              </div>
              <div className="space-y-1.5">
                {list.map(s => {
                  const isSelected = !sidebarSelectMode && selectedId === s.id;
                  const isChecked = sidebarSelectMode && sidebarSelected.has(s.id);
                  const TrendIcon = s.trend === 'up' ? TrendingUp : s.trend === 'down' ? TrendingDown : Minus;
                  const hasQcFailure = qcFailureAlerts.some(a => a.supplier === s.name);
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelect(s.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        isSelected || isChecked
                          ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 ring-1 ring-[#87986a]/20' : 'bg-[#f4f6f0] border-[#87986a]/40 ring-1 ring-[#87986a]/20'
                          : hasQcFailure
                          ? isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                          : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:border-gray-700' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {sidebarSelectMode && (
                            <div className={`w-3 h-3 rounded border-2 shrink-0 flex items-center justify-center ${
                              isChecked ? 'bg-[#87986a] border-[#87986a]' : isDark ? 'border-gray-600' : 'border-gray-400'
                            }`}>
                              {isChecked && <CheckCircle className="h-2 w-2 text-white" />}
                            </div>
                          )}
                          <span className="text-sm leading-none shrink-0">{s.flag}</span>
                          <span className={`text-[11px] font-medium truncate ${t.textPrimary}`}>{s.name}</span>
                          {hasQcFailure && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="QC failure logged" />}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-xs font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                          <TrendIcon className={`h-2.5 w-2.5 ${s.trend === 'up' ? 'text-green-400' : s.trend === 'down' ? 'text-red-400' : t.textMuted}`} />
                        </div>
                      </div>
                      {s.actionReason ? (
                        <span className={`text-[9px] leading-tight ${section.key === 'action' ? 'text-red-400' : 'text-amber-400'}`}>
                          {s.actionReason}
                        </span>
                      ) : (
                        <div className="h-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={s.sparkline.map((v, i) => ({ v, i }))}>
                              <Line type="monotone" dataKey="v" stroke={s.trend === 'down' ? '#ef4444' : '#87986a'} strokeWidth={1.2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Expanded Audit Panel (fills width) ──────────────────────────

  // Status filter counts (before status filter applies, so chips show realistic counts)
  const statusCounts = useMemo(() => ({
    all: filtered.filter(s => s.score >= scoreMin && s.contractExpiresIn <= contractMaxDays && (!auditCategoryFilter || s.categories.includes(auditCategoryFilter))).length,
    action: filtered.filter(s => s.vendorStatus === 'action' && s.score >= scoreMin && s.contractExpiresIn <= contractMaxDays && (!auditCategoryFilter || s.categories.includes(auditCategoryFilter))).length,
    watchlist: filtered.filter(s => s.vendorStatus === 'watchlist' && s.score >= scoreMin && s.contractExpiresIn <= contractMaxDays && (!auditCategoryFilter || s.categories.includes(auditCategoryFilter))).length,
    stable: filtered.filter(s => s.vendorStatus === 'stable' && s.score >= scoreMin && s.contractExpiresIn <= contractMaxDays && (!auditCategoryFilter || s.categories.includes(auditCategoryFilter))).length,
  }), [filtered, scoreMin, contractMaxDays, auditCategoryFilter]);

  const allAuditChecked = auditFiltered.length > 0 && auditChecked.size === auditFiltered.length;
  const someAuditChecked = auditChecked.size > 0 && !allAuditChecked;

  const auditLeftPanel = (
    <div className="flex flex-col h-full relative">
      {/* ── Top bar ── */}
      <div className={`p-4 border-b ${panelBorder}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Vendor Audit</h2>
            <p className={`text-[10px] ${t.textMuted}`}>{auditFiltered.length} of {SUPPLIERS.length} vendors · A-04 · A-01</p>
          </div>
          <div className="flex items-center gap-1">
            <div className={`flex items-center rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button onClick={() => setAuditView('table')} title="Table view"
                className={`flex items-center justify-center w-7 h-6 rounded-l-lg transition-colors ${
                  auditView === 'table' ? (isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')
                }`}>
                <List className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setAuditView('grid')} title="Grid view"
                className={`flex items-center justify-center w-7 h-6 rounded-r-lg transition-colors ${
                  auditView === 'grid' ? (isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]') : (isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')
                }`}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={handleCollapse} title="Collapse"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className={t.searchIcon} />
          <Input
            placeholder="Search vendors, country, categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={t.searchInput}
          />
        </div>

        {/* ── Filter Ribbon ── */}
        <div className="space-y-2">
          {/* Status chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { key: 'all',       label: 'All',             color: isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700',         activeColor: isDark ? 'bg-gray-500 text-white' : 'bg-gray-800 text-white' },
              { key: 'action',    label: 'Action Required', color: isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700',            activeColor: 'bg-red-500 text-white' },
              { key: 'watchlist', label: 'Watchlist',       color: isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700',    activeColor: 'bg-amber-500 text-white' },
              { key: 'stable',    label: 'Stable',          color: isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700',    activeColor: 'bg-green-600 text-white' },
            ] as const).map(chip => {
              const count = statusCounts[chip.key];
              const isActive = auditStatusFilter === chip.key;
              return (
                <button key={chip.key}
                        onClick={() => setAuditStatusFilter(chip.key)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${isActive ? chip.activeColor : chip.color}`}>
                  {chip.label}
                  <span className={`text-[9px] opacity-75`}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Category facets + Advanced filter trigger */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setAuditCategoryFilter(null)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                !auditCategoryFilter ? (isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]') : (isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')
              }`}>
              All Categories
            </button>
            {auditCategories.map(cat => {
              const CI = CATEGORY_ICONS[cat] ?? Package;
              const color = CATEGORY_COLORS[cat] ?? '#64748b';
              const isActive = auditCategoryFilter === cat;
              return (
                <button key={cat}
                        onClick={() => setAuditCategoryFilter(isActive ? null : cat)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
                        style={{
                          background: isActive ? `${color}dd` : `${color}22`,
                          color: isActive ? '#fff' : color,
                          border: `1px solid ${color}44`,
                        }}>
                  <CI className="h-2.5 w-2.5" />
                  {cat}
                </button>
              );
            })}

            {/* Advanced Filter trigger */}
            <div className="relative ml-auto">
              <button
                onClick={() => setAdvancedOpen(v => !v)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
                  advancedOpen || scoreMin > 0 || contractMaxDays < 365
                    ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
                    : isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
                }`}>
                <Filter className="h-2.5 w-2.5" />
                {(scoreMin > 0 || contractMaxDays < 365) ? '● Filtered' : 'Filter'}
              </button>

              {advancedOpen && (
                <div className={`absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-xl z-30 p-4 space-y-4 ${isDark ? 'bg-[#252525] border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${t.textPrimary}`}>Advanced Filters</span>
                    <button onClick={() => { setScoreMin(0); setContractMaxDays(365); }}
                            className={`text-[10px] ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                      Reset
                    </button>
                  </div>

                  {/* Score threshold */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-[11px] font-medium ${t.textSecondary}`}>Min. Composite Score</label>
                      <span className={`text-[11px] font-bold ${t.textPrimary}`}>{scoreMin === 0 ? 'Any' : `≥ ${scoreMin}`}</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={scoreMin}
                           onChange={e => setScoreMin(Number(e.target.value))}
                           className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#87986a]"
                           style={{ background: `linear-gradient(to right, #87986a ${scoreMin}%, ${isDark ? '#444' : '#e5e7eb'} ${scoreMin}%)` }} />
                    <div className="flex justify-between mt-0.5">
                      <span className={`text-[9px] ${t.textMuted}`}>0</span>
                      <span className={`text-[9px] ${t.textMuted}`}>100</span>
                    </div>
                  </div>

                  {/* Contract expiry */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={`text-[11px] font-medium ${t.textSecondary}`}>Contract Expiry ≤</label>
                      <span className={`text-[11px] font-bold ${contractMaxDays <= 60 ? 'text-amber-400' : t.textPrimary}`}>
                        {contractMaxDays >= 365 ? 'Any' : `${contractMaxDays}d`}
                      </span>
                    </div>
                    <input type="range" min={14} max={365} step={7} value={contractMaxDays}
                           onChange={e => setContractMaxDays(Number(e.target.value))}
                           className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#87986a]"
                           style={{ background: `linear-gradient(to right, #87986a ${((contractMaxDays - 14) / 351) * 100}%, ${isDark ? '#444' : '#e5e7eb'} ${((contractMaxDays - 14) / 351) * 100}%)` }} />
                    <div className="flex justify-between mt-0.5">
                      <span className={`text-[9px] ${t.textMuted}`}>14d</span>
                      <span className={`text-[9px] ${t.textMuted}`}>365d</span>
                    </div>
                  </div>

                  <button onClick={() => setAdvancedOpen(false)}
                          className="w-full py-1.5 rounded-lg text-[11px] font-medium bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors">
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Table / Grid content ── */}
      <div ref={tableScrollRef} className="flex-1 min-h-0" style={{ overflowY: 'auto', overflowX: 'auto' }}>
        {auditView === 'table' ? (
          <table style={{ minWidth: 860 }} className="w-full">
            <thead className={`sticky top-0 z-10 ${panelBg} border-b ${panelBorder}`}>
              <tr className={`text-[9px] uppercase tracking-wide ${t.textMuted}`}>
                <th className="py-2 pl-3 pr-1" style={{ minWidth: 36 }}>
                  <button onClick={handleToggleAllAuditCheck}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                            allAuditChecked ? 'bg-[#87986a] border-[#87986a]'
                            : someAuditChecked ? 'border-[#87986a] bg-[#87986a]/30'
                            : isDark ? 'border-gray-600' : 'border-gray-400'
                          }`}>
                    {(allAuditChecked || someAuditChecked) && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                  </button>
                </th>
                <th className="text-left py-2 px-2" style={{ minWidth: 160 }}>Vendor</th>
                <th className="text-left py-2 px-2" style={{ minWidth: 150 }}>Categories</th>
                <th className="text-center py-2 px-2" style={{ minWidth: 120 }}>Status</th>
                <th className="text-center py-2 px-2" style={{ minWidth: 110 }}>Steering</th>
                <th className="text-right py-2 px-2" style={{ minWidth: 60 }}>Score</th>
                <th className="text-right py-2 px-2" style={{ minWidth: 70 }}>Lead ↕</th>
                <th className="text-right py-2 px-2" style={{ minWidth: 80 }}>Annual $</th>
                <th className="text-right py-2 px-2" style={{ minWidth: 90 }}>Renewal</th>
                <th className="py-2 pr-2" style={{ minWidth: 36 }} />
              </tr>
            </thead>
            <tbody>
              {auditFiltered.map(s => {
                const sm = statusMeta(s.vendorStatus, isDark);
                const daysLeft = s.contractExpiresIn;
                const isChecked = auditChecked.has(s.id);
                const TrendIcon = s.trend === 'up' ? TrendingDown : s.trend === 'down' ? TrendingUp : Minus;
                const leadColor = s.trend === 'up' ? 'text-green-400' : s.trend === 'down' ? 'text-red-400' : t.textMuted;
                const isKebabOpen = kebabOpenId === s.id;
                const canAddToCompare = auditChecked.size < 2 && !auditChecked.has(s.id);
                return (
                  <tr key={s.id}
                      onClick={() => { setKebabOpenId(null); handleSelect(s.id); }}
                      className={`cursor-pointer border-b transition-colors ${
                        selectedId === s.id ? (isDark ? 'bg-[#87986a]/10 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#87986a]/20')
                        : isChecked ? (isDark ? 'bg-blue-500/5 border-blue-500/15' : 'bg-blue-50/50 border-blue-200/50')
                        : isDark ? 'border-gray-800/50 hover:bg-gray-800/40' : 'border-gray-100 hover:bg-gray-50'
                      }`}>
                    {/* Checkbox */}
                    <td className="py-2.5 pl-3 pr-1" onClick={e => handleToggleAuditCheck(s.id, e)}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isChecked ? 'bg-[#87986a] border-[#87986a]' : isDark ? 'border-gray-600 hover:border-gray-400' : 'border-gray-400 hover:border-gray-600'
                      }`}>
                        {isChecked && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </td>
                    <td className="py-2.5 px-2" style={{ minWidth: 160 }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm leading-none">{s.flag}</span>
                        <div>
                          <div className={`text-[11px] font-semibold ${t.textPrimary}`}>{s.name}</div>
                          <div className={`text-[9px] ${t.textMuted}`}>{s.country}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2" style={{ minWidth: 150 }}>
                      <div className="flex items-center gap-1 flex-wrap">
                        {s.categories.map(c => {
                          const CI = CATEGORY_ICONS[c] ?? Package;
                          return (
                            <span key={c} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap"
                                  style={{ background: `${CATEGORY_COLORS[c]}22`, color: CATEGORY_COLORS[c] }}>
                              <CI className="h-2.5 w-2.5" />
                              {c}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center" style={{ minWidth: 120 }}>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${sm.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                        {sm.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center" style={{ minWidth: 110 }}>
                      <LaborSwitch
                        mode={getMode(s.id)}
                        onChange={(next) => setMode(s.id, next)}
                        agent={s.assignedAgent}
                        isDark={isDark}
                        compact
                      />
                    </td>
                    <td className="py-2.5 px-2 text-right" style={{ minWidth: 60 }}>
                      <span className={`text-xs font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                    </td>
                    <td className="py-2.5 px-2 text-right" style={{ minWidth: 70 }}>
                      <div className="flex items-center justify-end gap-1">
                        <TrendIcon className={`h-2.5 w-2.5 ${leadColor}`} />
                        <span className={`text-[10px] font-medium ${t.textSecondary}`}>{s.leadDays}d</span>
                      </div>
                    </td>
                    <td className={`py-2.5 px-2 text-right text-[10px] font-medium ${t.textPrimary}`} style={{ minWidth: 80 }}>${(s.contractValue / 1000).toFixed(0)}K</td>
                    <td className="py-2.5 px-2 text-right" style={{ minWidth: 90 }}>
                      {daysLeft <= 30 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 whitespace-nowrap">
                          <AlertTriangle className="h-2.5 w-2.5" /> {daysLeft}d left
                        </span>
                      ) : daysLeft <= 60 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 whitespace-nowrap">
                          <Calendar className="h-2.5 w-2.5" /> Review
                        </span>
                      ) : daysLeft > 180 ? (
                        <span className="inline-flex items-center gap-1 text-[9px] text-green-400 whitespace-nowrap">
                          <CheckCircle className="h-2.5 w-2.5" /> OK
                        </span>
                      ) : (
                        <span className={`text-[9px] ${t.textMuted}`}>{daysLeft}d</span>
                      )}
                    </td>
                    {/* Kebab menu */}
                    <td className="py-2.5 pr-2 text-right" style={{ minWidth: 36 }}
                        onClick={e => e.stopPropagation()}>
                      <div className="relative inline-block">
                        <button
                          onClick={e => { e.stopPropagation(); setKebabOpenId(isKebabOpen ? null : s.id); }}
                          className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                            isKebabOpen
                              ? isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'
                              : isDark ? 'text-gray-500 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                          }`}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {isKebabOpen && (
                          <div className={`absolute right-0 top-full mt-1 w-44 rounded-xl border shadow-xl py-1 z-50 ${isDark ? 'bg-[#252525] border-gray-700' : 'bg-white border-gray-200'}`}>
                            <button onClick={() => handleKebabViewJourney(s)}
                                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                              <GitMerge className="h-3 w-3 opacity-60" /> View Journey
                            </button>
                            {canAddToCompare && (
                              <button onClick={() => handleKebabCompare(s)}
                                      className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                                <Activity className="h-3 w-3 opacity-60" /> Compare
                              </button>
                            )}
                            <button onClick={() => handleKebabBroadcast(s)}
                                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                              <MessageCircle className="h-3 w-3 opacity-60" /> Broadcast Message
                            </button>
                            <div className={`my-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />
                            <button onClick={() => handleDownloadDossier(s)}
                                    className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                              <FileText className="h-3 w-3 opacity-60" /> Download Dossier
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {auditFiltered.length === 0 && (
                <tr>
                  <td colSpan={10} className={`py-12 text-center text-[11px] ${t.textMuted}`}>
                    No vendors match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p-4 grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {auditFiltered.map(s => {
              const sm = statusMeta(s.vendorStatus, isDark);
              const isSel = selectedId === s.id;
              const isChecked = auditChecked.has(s.id);
              const color = primaryCategoryColor(s);
              const isKebabOpen = kebabOpenId === s.id;
              const canAddToCompare = auditChecked.size < 2 && !auditChecked.has(s.id);
              return (
                <div key={s.id}
                     onClick={() => { setKebabOpenId(null); handleSelect(s.id); }}
                     className={`relative cursor-pointer rounded-xl border transition-all overflow-visible ${
                       isSel ? (isDark ? 'border-[#87986a]/60 ring-1 ring-[#87986a]/30' : 'border-[#87986a]/60 ring-1 ring-[#87986a]/30')
                       : isChecked ? (isDark ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-blue-400/40 ring-1 ring-blue-400/20')
                       : isDark ? 'bg-[#1a1a1a] border-gray-800 hover:border-gray-700' : 'bg-white border-gray-200 hover:border-gray-300'
                     }`}>
                  <div className="h-12 relative rounded-t-xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}dd, ${color}66)` }}>
                    <div className="absolute -bottom-4 left-3 w-10 h-10 rounded-lg border-2 flex items-center justify-center font-bold text-sm"
                         style={{ borderColor: isDark ? '#1a1a1a' : '#fff', background: '#fff', color, zIndex: 1 }}>
                      {s.initials}
                    </div>
                    <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-lg">{s.flag}</span>
                    {/* Kebab button on card */}
                    <button
                      onClick={e => { e.stopPropagation(); setKebabOpenId(isKebabOpen ? null : s.id); }}
                      className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                    >
                      <MoreVertical className="h-3.5 w-3.5 text-white" />
                    </button>
                  </div>
                  <div className="pt-5 px-3 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold truncate ${t.textPrimary}`}>{s.name}</span>
                      <span className={`text-xs font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                    </div>
                    <p className={`text-[10px] mb-2 ${t.textMuted}`}>{s.country}</p>
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {s.categories.map(c => {
                        const CI = CATEGORY_ICONS[c] ?? Package;
                        return (
                          <span key={c} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium"
                                style={{ background: `${CATEGORY_COLORS[c]}22`, color: CATEGORY_COLORS[c] }}>
                            <CI className="h-2 w-2" />{c}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${sm.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                        {sm.label}
                      </span>
                      <span className={`text-[10px] ${s.contractExpiresIn <= 60 ? 'text-amber-400 font-semibold' : t.textMuted}`}>
                        {s.contractExpiresIn}d
                      </span>
                    </div>
                  </div>
                  {/* Kebab dropdown */}
                  {isKebabOpen && (
                    <div className={`absolute right-1 top-8 w-44 rounded-xl border shadow-xl py-1 z-50 ${isDark ? 'bg-[#252525] border-gray-700' : 'bg-white border-gray-200'}`}
                         onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleKebabViewJourney(s)}
                              className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                        <GitMerge className="h-3 w-3 opacity-60" /> View Journey
                      </button>
                      {canAddToCompare && auditChecked.size < 2 && (
                        <button onClick={() => handleKebabCompare(s)}
                                className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                          <Activity className="h-3 w-3 opacity-60" /> Compare
                        </button>
                      )}
                      <button onClick={() => handleKebabBroadcast(s)}
                              className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                        <MessageCircle className="h-3 w-3 opacity-60" /> Broadcast Message
                      </button>
                      <div className={`my-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />
                      <button onClick={() => handleDownloadDossier(s)}
                              className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}>
                        <FileText className="h-3 w-3 opacity-60" /> Download Dossier
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bulk Action Bar ── */}
      {auditChecked.size > 0 && (() => {
        const checkedIds = Array.from(auditChecked);
        const allManual = checkedIds.every(id => getMode(id) === 'manual');
        return (
        <div className={`shrink-0 px-3 py-2 border-t ${panelBorder} flex items-center gap-2 ${isDark ? 'bg-[#1e2a1e]' : 'bg-[#f0f4e8]'}`}>
          <span className={`text-[10px] font-semibold ${t.textPrimary} shrink-0`}>{auditChecked.size} vendor{auditChecked.size > 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Bulk Labor Switch — pause / resume agents across the network */}
            <button
              onClick={() => bulkSetMode(checkedIds, allManual ? 'agent' : 'manual')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                allManual
                  ? isDark ? 'border-[#87986a]/50 bg-[#87986a]/15 text-[#a3b085] hover:bg-[#87986a]/25'
                           : 'border-[#87986a]/50 bg-[#f4f6f0] text-[#6b7a54] hover:bg-[#e8eddf]'
                  : isDark ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                           : 'border-amber-500/50 bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
              title={allManual ? 'Resume Agents on all selected vendors' : 'Pause Agents → tasks move to Human Review'}
            >
              {allManual ? <PlayCircle className="h-2.5 w-2.5" /> : <PauseCircle className="h-2.5 w-2.5" />}
              {allManual ? 'Resume Agents' : 'Pause Agents'}
            </button>
            {auditChecked.size === 2 && (
              <button onClick={handleBulkCompare}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all duration-300 whitespace-nowrap ${
                        showComparisonMatrix
                          ? isDark ? 'bg-[#87986a]/20 border-[#87986a]/50 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/50 text-[#6b7a54]'
                          : isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}>
                <GitMerge className="h-2.5 w-2.5" /> Compare
              </button>
            )}
            <button onClick={() => { setBroadcastOpen(true); setMessagingOpen(false); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors whitespace-nowrap">
              <Globe className="h-2.5 w-2.5" /> Broadcast
            </button>
            <button onClick={handleExport}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
              <FileText className="h-2.5 w-2.5" /> Export
            </button>
            <button onClick={() => { setAuditChecked(new Set()); setMatrixVisible(false); }}
                    className={`w-6 h-6 flex items-center justify-center rounded ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );

  // ── Center Panel ──────────────────────────────────────────────────

  const centerPanel = (
    <div className="relative flex flex-col h-full overflow-y-auto">
      {showHardened && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="hardened-burst text-center">
            <div className="hardened-grade text-6xl font-black">→</div>
            <div className={`text-sm font-semibold mt-1 ${t.textSecondary}`}>Renegotiation Initiated</div>
            <div className={`text-xs mt-0.5 ${t.textMuted}`}>{hardenedName} · agent drafting opening offer</div>
            <div className="flex justify-center gap-2 mt-3 hardened-sparkles">
              {[...Array(5)].map((_, i) => <Award key={i} className="h-5 w-5 text-[#a3b085]" />)}
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-5" style={{ opacity: centerOpacity, transition: 'opacity 0.16s ease-in-out' }}>
        {/* ═══ QC FAILURE ALERTS ═══ */}
        {qcFailureAlerts.length > 0 && (
          <div className="space-y-2">
            {qcFailureAlerts.map((alert, i) => (
              <div key={`${alert.orderId}-${alert.ts}`} className={`flex items-start gap-3 p-3 rounded-lg border ${
                isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
              }`}>
                <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                    QC Failure — {alert.supplier}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
                    Order {alert.orderId} failed Quality Check. Review vendor profile and consider trust-score adjustment.
                  </p>
                </div>
                <button
                  onClick={() => setQcFailureAlerts(prev => prev.filter((_, j) => j !== i))}
                  className={`shrink-0 p-0.5 rounded transition-colors ${isDark ? 'text-amber-500 hover:text-amber-300' : 'text-amber-500 hover:text-amber-700'}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ COMPARISON MATRIX ═══ */}
        {isComparing && renderComparison(compareSuppliers, t, isDark, tooltipStyle)}

        {/* ═══ ECOSYSTEM HUB ═══ */}
        {!isComparing && !selected && (
          <>
            <div className="flex items-center gap-1.5">
              <Globe className={`h-4 w-4 ${t.sageIcon}`} />
              <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Supply Chain Ecosystem</h2>
              <span className={`text-[10px] ${t.textMuted}`}>· Operational Risk Overview</span>
            </div>

            {/* Buyamia Vitals */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: Activity,    label: 'Network Health',    value: `${Math.round(SUPPLIERS.reduce((s, v) => s + v.score, 0) / SUPPLIERS.length)}`, sub: 'avg composite', color: '#87986a' },
                { icon: AlertTriangle, label: 'Action Items',    value: grouped.action.length,                                                           sub: 'need attention',  color: '#ef4444' },
                { icon: DollarSign,  label: 'Agent Savings YTD', value: `$${(SUPPLIERS.reduce((s, v) => s + v.savingsYTD, 0) / 1000).toFixed(1)}K`,      sub: 'agent-attributed', color: '#10b981' },
                { icon: Calendar,    label: 'Renewals <60d',     value: renewalsCount,                                                                    sub: 'contracts due',    color: '#f59e0b' },
              ].map((m) => {
                const MIcon = m.icon;
                return (
                  <div key={m.label} className={t.cardPanel}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] ${t.textMuted}`}>{m.label}</span>
                      <MIcon className="h-3.5 w-3.5" style={{ color: m.color }} />
                    </div>
                    <div className="text-xl font-bold mt-1" style={{ color: m.color }}>{m.value}</div>
                    <span className={`text-[10px] ${t.textMuted}`}>{m.sub}</span>
                  </div>
                );
              })}
            </div>

            {/* Performance Matrix (2D Quadrant: Spend vs Reliability) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Performance Matrix</h3>
                <span className={`text-[10px] ${t.textMuted}`}>Spend ($K) × Reliability · Bubble = Order Volume</span>
              </div>
              <div className={`${t.cardPanel} p-4`}>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                      <XAxis type="number" dataKey="x" name="Spend" unit="K"
                             domain={[0, 'dataMax + 20']}
                             tick={{ fontSize: 10, fill: isDark ? '#888' : '#666' }}
                             label={{ value: 'Annual Spend ($K)', position: 'insideBottom', offset: -14, fill: isDark ? '#888' : '#666', fontSize: 10 }}
                             axisLine={{ stroke: isDark ? '#333' : '#e5e7eb' }} />
                      <YAxis type="number" dataKey="y" name="Reliability" domain={[60, 100]}
                             tick={{ fontSize: 10, fill: isDark ? '#888' : '#666' }}
                             label={{ value: 'Reliability', angle: -90, position: 'insideLeft', fill: isDark ? '#888' : '#666', fontSize: 10 }}
                             axisLine={{ stroke: isDark ? '#333' : '#e5e7eb' }} />
                      <ZAxis type="number" dataKey="z" range={[120, 620]} name="Orders" />
                      <ReferenceLine x={100} stroke={isDark ? '#444' : '#d1d5db'} strokeDasharray="3 3" />
                      <ReferenceLine y={88} stroke={isDark ? '#444' : '#d1d5db'} strokeDasharray="3 3" />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }}
                               formatter={(v: any, n: string) => n === 'Spend' ? [`$${v}K`, 'Spend'] : n === 'Orders' ? [v, 'Orders'] : [v, n]}
                               labelFormatter={() => ''}
                               content={({ active, payload }: any) => {
                                 if (!active || !payload?.length) return null;
                                 const d = payload[0].payload;
                                 return (
                                   <div style={tooltipStyle} className="px-2 py-1.5">
                                     <div className="flex items-center gap-1.5 font-semibold">
                                       <span>{d.flag}</span><span>{d.name}</span>
                                     </div>
                                     <div style={{ fontSize: 10, opacity: 0.7 }}>Spend: ${d.x}K · Reliability: {d.y}</div>
                                     <div style={{ fontSize: 10, opacity: 0.7 }}>Orders: {d.z} · Score: {d.score}</div>
                                   </div>
                                 );
                               }} />
                      <Scatter data={scatterData} fillOpacity={0.75}>
                        {scatterData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                {/* Quadrant legend */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className={`text-[9px] ${t.textMuted} flex items-center gap-1`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Top-right: Champions · High-spend, high-reliability
                  </div>
                  <div className={`text-[9px] ${t.textMuted} flex items-center gap-1`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Bottom-right: Review · High-spend, low-reliability
                  </div>
                </div>
              </div>
            </div>

            {/* Actionable Category Bars */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Category Reliability</h3>
                <span className={`text-[10px] ${t.textMuted}`}>Click a bar to audit that category</span>
              </div>
              <div className={`${t.cardPanel} p-4`}>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryHealth} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: isDark ? '#666' : '#999' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#bbb' : '#444' }} axisLine={false} tickLine={false} width={82} />
                      <Tooltip contentStyle={tooltipStyle}
                               formatter={(v: number, _n: string, props: any) => [`${v}/100 · ${props.payload.suppliers} vendor(s)`, 'Score']} />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]}
                           onClick={(d: any) => { setSearch(d.name); setExpandedSidebar(true); }}
                           style={{ cursor: 'pointer' }}>
                        {categoryHealth.map((c) => (
                          <Cell key={c.name} fill={c.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Status distribution */}
            <div>
              <h3 className={`text-sm font-semibold mb-3 ${t.textPrimary}`}>Vendor Status Distribution</h3>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: 'action',    label: 'Action Required', color: '#ef4444' },
                  { key: 'watchlist', label: 'Watchlist',        color: '#f59e0b' },
                  { key: 'stable',    label: 'Stable',            color: '#10b981' },
                ] as const).map(s => (
                  <div key={s.key} className={`${t.cardPanel} border-t-2`} style={{ borderTopColor: s.color }}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] ${t.textMuted}`}>{s.label}</span>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    </div>
                    <div className={`text-2xl font-bold mt-1 ${t.textPrimary}`}>{grouped[s.key].length}</div>
                    <div className={`text-[10px] mt-1 ${t.textMuted}`}>
                      {grouped[s.key].map(v => v.name.split(' ')[0]).join(' · ') || 'None'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ RELATIONSHIP WORKSPACE ═══ */}
        {!isComparing && selected && renderRelationshipWorkspace(
          selected, t, isDark, tooltipStyle, metricFilter, setMetricFilter,
          filteredOrders, handleBackToEcosystem, handleExecuteRenegotiate,
          dossierOpen, setDossierOpen, handleOpenMap,
          getMode(selected.id),
          (next) => setMode(selected.id, next),
          () => openGovernance(selected.assignedAgent.id),
          getEffectiveJourneyStage(selected),
          manualJourneyEntries[selected.id],
          (stageIdx: number) => openJourneyModule(selected.id, stageIdx),
        )}
      </div>
    </div>
  );

  // ── Peek Sheet (when expanded + selected) ────────────────────────

  const peekSheet = selected && (() => {
    const peekMode = getMode(selected.id);
    const peekIsManual = peekMode === 'manual';
    return (
    <div className="flex flex-col h-full">
      {/* ── Header + score strip ── */}
      <div className={`p-4 border-b ${panelBorder}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-sm"
                 style={{ background: `${primaryCategoryColor(selected)}22`, color: primaryCategoryColor(selected) }}>
              {selected.initials}
            </div>
            <div className="min-w-0">
              <div className={`text-xs font-semibold truncate ${t.textPrimary}`}>{selected.name}</div>
              <div className={`text-[10px] ${t.textMuted}`}>{selected.flag} {selected.country} · Stage {selected.journeyStage}/12</div>
            </div>
          </div>
          <button onClick={handleOpenFullWorkspace} title="Open Full Workspace"
                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${isDark ? 'bg-[#87986a]/15 text-[#a3b085] hover:bg-[#87986a]/25' : 'bg-[#f4f6f0] text-[#6b7a54] hover:bg-[#e8eddf]'}`}>
            <Maximize2 className="h-3 w-3" /> Full
          </button>
        </div>

        {/* Labor Switch + Assigned Agent (Wayne doctrine) */}
        <div className="mb-3 flex flex-col gap-1.5">
          <LaborSwitch
            mode={peekMode}
            onChange={(next) => setMode(selected.id, next)}
            agent={selected.assignedAgent}
            isDark={isDark}
          />
          <div className={`flex items-center gap-1 text-[9px] ${t.textMuted}`}>
            <span>Managed by:</span>
            <button
              onClick={() => openGovernance(selected.assignedAgent.id)}
              className={`inline-flex items-center gap-0.5 font-semibold hover:underline ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}
              title="Tune autonomy & approval limits in Governance"
            >
              {agentLabel(selected.assignedAgent)}
              <ExternalLink className="h-2 w-2" />
            </button>
          </div>
          <AgentStatusLine mode={peekMode} agent={selected.assignedAgent} isDark={isDark} dense />
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[
            { k: 'Delivery', v: selected.reliability },
            { k: 'Quality',  v: selected.quality },
            { k: 'Price',    v: selected.price },
            { k: 'Sustain.', v: selected.sustainability },
            { k: 'CO₂',      v: selected.co2Score },
          ].map(m => (
            <div key={m.k} className={`rounded-lg py-1.5 text-center ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
              <div className={`text-xs font-bold ${scoreColor(m.v)}`}>{m.v}</div>
              <div className={`text-[8px] ${t.textMuted}`}>{m.k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* ── Vertical Journey Track ── */}
        <div className="p-4">
          {(() => {
            const peekEffStage = getEffectiveJourneyStage(selected);
            const peekEntries = manualJourneyEntries[selected.id];
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h4 className={`text-[10px] font-semibold ${t.sectionLabel}`}>RELATIONSHIP JOURNEY</h4>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
                    {Math.round((peekEffStage / 12) * 100)}%
                  </span>
                </div>
                {JOURNEY.map((stage, idx) => {
                  const stageIdx = stage.id - 1;
                  const done = stage.id < peekEffStage;
                  const active = stage.id === peekEffStage;
                  const upcoming = stage.id > peekEffStage;
                  const isLast = idx === JOURNEY.length - 1;
                  const hasManualEntry = !!peekEntries?.[stageIdx]
                    && Object.values(peekEntries[stageIdx]).some(v => v && v.toString().trim().length > 0);
                  const clickable = peekIsManual; // every stage clickable in Manual
                  const NodeTag: any = clickable ? 'button' : 'div';
                  return (
                    <div key={stage.id} className="flex items-stretch gap-3">
                      {/* Node + vertical connector */}
                      <div className="flex flex-col items-center" style={{ minWidth: 20 }}>
                        <NodeTag
                          {...(clickable ? {
                            onClick: () => openJourneyModule(selected.id, stageIdx),
                            title: `${active ? 'Execute' : done ? 'Edit' : 'Plan ahead'}: ${stage.label} (${RELATIONSHIP_TASK_MODULES[stageIdx].action})`,
                          } : {})}
                          className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold z-10 ${
                            done
                              ? clickable
                                ? 'bg-[#87986a] text-white cursor-pointer hover:bg-amber-500'
                                : 'bg-[#87986a] text-white'
                            : active
                              ? clickable
                                ? 'bg-amber-500 text-white ring-2 ring-amber-500/50 cursor-pointer hover:bg-amber-600'
                                : `bg-[#87986a]/20 text-[#87986a] ring-2 ring-[#87986a]/50`
                            : upcoming && clickable
                              ? (isDark ? 'border-2 border-amber-500/40 text-amber-300 bg-transparent cursor-pointer hover:bg-amber-500/15' : 'border-2 border-amber-400/50 text-amber-700 bg-transparent cursor-pointer hover:bg-amber-50')
                              : isDark ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-white text-gray-400 border border-gray-300'
                          }`}
                        >
                          {done ? <CheckCircle className="h-3 w-3" /> : active && clickable ? <Hand className="h-2.5 w-2.5" /> : stage.id}
                        </NodeTag>
                        {!isLast && (
                          <div style={{
                            flex: '1 0 0',
                            width: 2,
                            minHeight: 18,
                            marginTop: 2,
                            marginBottom: 2,
                            background: done ? '#87986a' : 'transparent',
                            borderLeft: done ? 'none' : `2px dashed ${isDark ? '#444' : '#cbd5e1'}`,
                          }} />
                        )}
                      </div>
                      {/* Label */}
                      <div className={`flex items-start gap-2 min-w-0 flex-wrap ${isLast ? 'pb-0' : 'pb-1'}`} style={{ paddingTop: 1 }}>
                        <span className={`text-[10px] leading-tight ${done || active ? t.textPrimary : t.textMuted}`}>
                          {stage.label}
                        </span>
                        {active && (
                          <span className={`shrink-0 text-[8px] px-1 py-0.5 rounded font-semibold ${
                            clickable
                              ? 'bg-amber-500/15 text-amber-500'
                              : isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                          }`}>
                            {clickable ? 'execute now' : 'current'}
                          </span>
                        )}
                        {hasManualEntry && !active && (
                          <span className={`shrink-0 inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded font-bold ${
                            isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                          }`}>
                            <User className="h-2 w-2" /> manual
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* ── Agent notes / Standby drafts ── */}
        <div className={`mx-4 mb-4 p-3 rounded-lg ${
          peekIsManual
            ? isDark ? 'bg-amber-500/5 border border-amber-500/30' : 'bg-amber-50/60 border border-amber-300/50'
            : isDark ? 'bg-[#87986a]/8 border border-[#87986a]/20' : 'bg-[#f4f6f0] border border-[#dbe3ce]'
        }`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            {peekIsManual ? <Hand className="h-3 w-3 text-amber-500" /> : <Bot className={`h-3 w-3 ${t.sageIcon}`} />}
            <span className={`text-[10px] font-semibold ${t.textPrimary}`}>
              {peekIsManual ? 'Human Review · Drafts' : 'Agent Intelligence'}
            </span>
          </div>
          {peekIsManual ? (
            <p className={`text-[10px] leading-relaxed ${t.textSecondary}`}>
              {`${agentBadge(selected.assignedAgent)} suspended. ${selected.assignedAgent.activeTasks} task${selected.assignedAgent.activeTasks === 1 ? '' : 's'} parked for manual sign-off.`}
            </p>
          ) : (
            <AgentCTA
              isDark={isDark}
              variant="inline"
              agentLabel={`${agentBadge(selected.assignedAgent)} · ${selected.assignedAgent.role}`}
              reasoning={selected.agentNotes}
              offModeMessage={`Use the metrics above to evaluate ${selected.name}. Agent recommendations are suppressed.`}
            />
          )}
        </div>
      </div>

      {/* ── Bottom action zone: Full Workspace only ── */}
      <div className={`shrink-0 p-3 border-t ${panelBorder}`}>
        <button onClick={handleOpenFullWorkspace}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-semibold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-all">
          <Maximize2 className="h-3 w-3" /> Open Full Workspace
        </button>
      </div>
    </div>
    );
  })();

  // ── Right Panel ───────────────────────────────────────────────────

  const activeSupplier = selected
    ?? (expandedSidebar && auditCheckedList.length > 0 ? auditCheckedList[0] : null)
    ?? (isComparing ? compareSuppliers[0] : null);
  const bench = activeSupplier ? REGIONAL_BENCH[activeSupplier.country] : null;

  // Broadcast targets: audit checked (expanded) OR sidebar selected (normal)
  const broadcastTargets: Supplier[] = expandedSidebar
    ? auditCheckedList
    : (sidebarSelectMode && sidebarSelected.size >= 2)
    ? (Array.from(sidebarSelected).map(id => SUPPLIERS.find(s => s.id === id)).filter(Boolean) as Supplier[])
    : [];

  const sidebarBroadcastReady = !expandedSidebar && sidebarSelectMode && sidebarSelected.size >= 2;

  const rightPanel = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* ── Comparative Delta (Atlas synthesis, no per-vendor cards) ── */}
        {isComparing ? (() => {
          const [a, b] = compareSuppliers;
          const aName = a.name.split(' ')[0];
          const bName = b.name.split(' ')[0];
          const leadDiff = a.leadDays - b.leadDays;
          const priceDiff = a.contractValue - b.contractValue;
          const scoreDiff = a.score - b.score;
          const savingsDiff = a.savingsYTD - b.savingsYTD;
          const fmtK = (v: number) => `$${(Math.abs(v) / 1000).toFixed(1)}K`;
          // Winner = highest composite score
          const winner = scoreDiff >= 0 ? a : b;
          const loser = winner.id === a.id ? b : a;
          // Build narrative — always framed relative to A vs B
          const parts: string[] = [];
          if (leadDiff !== 0) {
            parts.push(`${Math.abs(leadDiff)} day${Math.abs(leadDiff) === 1 ? '' : 's'} ${leadDiff > 0 ? 'slower' : 'faster'}`);
          }
          if (priceDiff !== 0) {
            parts.push(`${fmtK(priceDiff)}/yr ${priceDiff > 0 ? 'more expensive' : 'cheaper'}`);
          }
          if (savingsDiff !== 0 && parts.length < 2) {
            parts.push(`${fmtK(savingsDiff)} ${savingsDiff > 0 ? 'more' : 'less'} saved YTD`);
          }
          const directComparison = parts.length === 0
            ? `${aName} and ${bName} are effectively identical on cost and lead time.`
            : `${aName} is ${parts.join(' but ')} than ${bName}.`;
          // Recommendation
          const budgetFocus = priceDiff !== 0;
          const speedFocus = leadDiff !== 0;
          let recommendation: string;
          if (budgetFocus && speedFocus) {
            recommendation = `If your priority is budget, ${priceDiff > 0 ? bName : aName} is the strategic choice despite the ${Math.abs(leadDiff)}-day lead-time trade-off. Prioritize ${leadDiff > 0 ? bName : aName} when speed is critical.`;
          } else if (speedFocus) {
            recommendation = `${leadDiff > 0 ? bName : aName} delivers faster with comparable cost — favor them for tight cycles.`;
          } else if (budgetFocus) {
            recommendation = `${priceDiff > 0 ? bName : aName} is the clear budget play; lead times are effectively tied.`;
          } else {
            recommendation = `Both vendors are near-identical on the core metrics. ${winner.name.split(' ')[0]}'s composite score edges ahead; default to them.`;
          }
          return (
          <>
            <div className={t.section}>
              <div className="flex items-center gap-2 mb-3">
                <Bot className={`h-4 w-4 ${t.sageIcon}`} />
                <div>
                  <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Comparative Delta</h3>
                  <p className={`text-[10px] ${t.textMuted}`}>Atlas synthesis · {a.flag} {aName} vs {b.flag} {bName}</p>
                </div>
              </div>

              {/* Direct comparison — narrative */}
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`text-[9px] uppercase tracking-wide mb-1.5 ${t.textMuted}`}>Direct Comparison</div>
                <p className={`text-[11px] leading-relaxed ${t.textPrimary}`}>{directComparison}</p>
              </div>

              {/* Recommendation */}
              <div className={`mt-2.5 p-3 rounded-lg border ${t.sageBg} ${t.sageBorder}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Award className={`h-3 w-3 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                  <div className={`text-[9px] uppercase tracking-wide font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Recommendation</div>
                </div>
                <p className={`text-[11px] leading-relaxed ${t.textPrimary}`}>{recommendation}</p>
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#87986a]/15">
                  <span className={`text-[9px] ${t.textMuted}`}>Suggested winner:</span>
                  <span className="text-[10px]">{winner.flag}</span>
                  <span className={`text-[10px] font-semibold ${t.textPrimary}`}>{winner.name}</span>
                  <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${scoreColor(winner.score)} ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                    {winner.score}
                  </span>
                </div>
              </div>

              {/* Metric deltas — compact strip */}
              <div className={`mt-2.5 p-2.5 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                <div className={`text-[9px] uppercase tracking-wide mb-2 ${t.textMuted}`}>Metric Deltas</div>
                {[
                  { l: 'Composite Score', a: a.score, b: b.score, lowerBetter: false, fmt: (v: number) => String(v) },
                  { l: 'Lead Time', a: a.leadDays, b: b.leadDays, lowerBetter: true, fmt: (v: number) => `${v}d` },
                  { l: 'Annual Cost', a: a.contractValue, b: b.contractValue, lowerBetter: true, fmt: (v: number) => `$${(v / 1000).toFixed(0)}K` },
                  { l: 'Savings YTD', a: a.savingsYTD, b: b.savingsYTD, lowerBetter: false, fmt: (v: number) => `$${v.toLocaleString()}` },
                ].map(d => {
                  const delta = d.a - d.b;
                  const aWins = d.lowerBetter ? d.a < d.b : d.a > d.b;
                  return (
                    <div key={d.l} className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] ${t.textMuted}`}>{d.l}</span>
                      <span className={`text-[10px] font-semibold ${delta === 0 ? t.textMuted : aWins ? 'text-[#87986a]' : 'text-blue-400'}`}>
                        {delta === 0 ? 'Tied' : `${aWins ? aName : bName} ${d.lowerBetter ? '−' : '+'}${d.fmt(Math.abs(delta))}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
          );
        })() : sidebarBroadcastReady ? (
          <>
            <div className={t.section}>
              <div className="flex items-center gap-2 mb-3">
                <Users className={`h-4 w-4 ${t.sageIcon}`} />
                <div>
                  <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Bulk Action Summary</h3>
                  <p className={`text-[10px] ${t.textMuted}`}>{sidebarSelected.size} vendors selected</p>
                </div>
              </div>
              <div className="space-y-2">
                {Array.from(sidebarSelected).map(id => {
                  const s = SUPPLIERS.find(x => x.id === id);
                  if (!s) return null;
                  return (
                    <div key={s.id} className={`${t.card} flex items-center justify-between`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm shrink-0">{s.flag}</span>
                        <div className="min-w-0">
                          <div className={`text-[11px] font-medium truncate ${t.textPrimary}`}>{s.name}</div>
                          <div className={`text-[9px] ${t.textMuted}`}>{s.country}</div>
                        </div>
                      </div>
                      <span className={`text-xs font-bold shrink-0 ${scoreColor(s.score)}`}>{s.score}</span>
                    </div>
                  );
                })}
              </div>
              <div className={`mt-3 p-2.5 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                <div className={`text-[9px] uppercase tracking-wide mb-1.5 ${t.textMuted}`}>Combined Reach</div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] ${t.textMuted}`}>Total contract value</span>
                  <span className={`text-[10px] font-semibold ${t.textPrimary}`}>
                    ${(Array.from(sidebarSelected).reduce((sum, id) => {
                      const s = SUPPLIERS.find(x => x.id === id);
                      return sum + (s?.contractValue ?? 0);
                    }, 0) / 1000).toFixed(0)}K/yr
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[10px] ${t.textMuted}`}>Avg score</span>
                  <span className={`text-[10px] font-semibold ${t.textPrimary}`}>
                    {Math.round(Array.from(sidebarSelected).reduce((sum, id) => {
                      const s = SUPPLIERS.find(x => x.id === id);
                      return sum + (s?.score ?? 0);
                    }, 0) / sidebarSelected.size)}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : activeSupplier ? (
          <>
            <div className={t.section}>
              <div className="flex items-center gap-2 mb-3">
                <Award className={`h-4 w-4 ${t.sageIcon}`} />
                <div>
                  <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Relationship ROI</h3>
                  <p className={`text-[10px] ${t.textMuted}`}>{activeSupplier.name}</p>
                </div>
              </div>
              <div className={`p-3 rounded-lg ${t.sageBg} border ${t.sageBorder}`}>
                <span className={`text-[10px] ${t.textMuted}`}>Savings YTD (agent-attributed)</span>
                <div className="text-xl font-bold text-[#87986a] mt-0.5">${activeSupplier.savingsYTD.toLocaleString()}</div>
                <p className={`text-[10px] mt-1.5 leading-relaxed ${t.textSecondary}`}>
                  {activeSupplier.savingsYTD > 8000
                    ? `High-value partner. Saved via early-bird discounts and group-buy pooling this year.`
                    : activeSupplier.savingsYTD > 3000
                    ? `Reliable partner with moderate savings. Consider volume commitment for larger upside.`
                    : `Low-savings partner. A-01 has 3 alternatives pre-qualified if optimization is desired.`}
                </p>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#87986a]/15">
                  <span className={`text-[10px] ${t.textMuted}`}>Partner grade:</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    activeSupplier.score >= 90 ? 'bg-green-500 text-white'
                    : activeSupplier.score >= 85 ? 'bg-[#87986a] text-white'
                    : activeSupplier.score >= 80 ? 'bg-amber-500 text-white'
                    : 'bg-red-500 text-white'
                  }`}>
                    {activeSupplier.score >= 90 ? 'A' : activeSupplier.score >= 85 ? 'B+' : activeSupplier.score >= 80 ? 'B' : 'C'}
                  </span>
                </div>
              </div>
            </div>

            {bench && (
              <div className={t.section}>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className={`h-4 w-4 ${t.sageIcon}`} />
                  <div>
                    <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Market Benchmarking</h3>
                    <p className={`text-[10px] ${t.textMuted}`}>A-01 · Regional Intelligence</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className={t.card}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] ${t.textMuted}`}>Lead Time</span>
                      <span className={`text-[10px] font-semibold ${
                        activeSupplier.leadDays < bench.leadAvg ? 'text-green-400'
                        : activeSupplier.leadDays > bench.leadAvg ? 'text-amber-400' : t.textPrimary
                      }`}>
                        {activeSupplier.leadDays < bench.leadAvg ? '▼' : activeSupplier.leadDays > bench.leadAvg ? '▲' : '●'}
                        {' '}{Math.abs(activeSupplier.leadDays - bench.leadAvg).toFixed(1)}d vs avg
                      </span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${t.textSecondary}`}>
                      <strong>{activeSupplier.leadDays}d</strong> vs <strong>{bench.leadAvg}d</strong> regional avg for {activeSupplier.country}.
                    </p>
                  </div>
                  <div className={t.card}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] ${t.textMuted}`}>Quality Score</span>
                      <span className={`text-[10px] font-semibold ${
                        activeSupplier.quality > bench.qualityAvg ? 'text-green-400'
                        : activeSupplier.quality < bench.qualityAvg ? 'text-amber-400' : t.textPrimary
                      }`}>
                        {activeSupplier.quality > bench.qualityAvg ? '▲' : '▼'}
                        {' '}{Math.abs(activeSupplier.quality - bench.qualityAvg)}pt vs avg
                      </span>
                    </div>
                    <p className={`text-[10px] leading-relaxed ${t.textSecondary}`}>
                      <strong>{activeSupplier.quality}</strong> vs regional avg <strong>{bench.qualityAvg}</strong>.
                      {activeSupplier.quality > bench.qualityAvg + 3 && ' Top quartile.'}
                      {activeSupplier.quality < bench.qualityAvg - 3 && ' Below threshold.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className={`h-4 w-4 ${t.sageIcon}`} />
                <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Account Manager</h3>
              </div>
              <div className={t.card}>
                <div className={`text-xs font-medium ${t.textPrimary}`}>{activeSupplier.accountManager}</div>
                <div className={`text-[10px] ${t.textMuted}`}>+{activeSupplier.waPhone}</div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className={`text-[9px] font-bold uppercase tracking-wide ${t.textMuted}`}>
                    Reachable via
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isDark ? 'bg-[#25D366]/15 text-[#7dd9a4]' : 'bg-[#25D366]/10 text-[#25D366]'
                  }`}>
                    <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'
                  }`}>
                    <Mail className="h-2.5 w-2.5" /> Email
                  </span>
                </div>
                <p className={`text-[9px] mt-1.5 ${t.textMuted}`}>
                  No vendor portal — all updates land here through chat or email.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className={t.section}>
            <div className="flex items-center gap-2 mb-3">
              <Globe className={`h-4 w-4 ${t.sageIcon}`} />
              <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Network Overview</h3>
            </div>
            <p className={`text-[11px] leading-relaxed ${t.textSecondary}`}>
              Monitoring {SUPPLIERS.length} vendors across {new Set(SUPPLIERS.map(s => s.country)).size} regions.
              Total annual contract value:{' '}
              <strong className={t.textPrimary}>${(SUPPLIERS.reduce((s, v) => s + v.contractValue, 0) / 1000).toFixed(0)}K</strong>.
            </p>
            <p className={`text-[11px] leading-relaxed mt-2 ${t.textSecondary}`}>
              {grouped.action.length > 0 && (
                <><strong className="text-red-400">{grouped.action.length} vendor{grouped.action.length !== 1 ? 's' : ''}</strong> need attention. </>
              )}
              Select a vendor to view their Relationship Journey.
            </p>
          </div>
        )}
      </div>

      {/* Atlas Prompt Area — Secure Messaging Portal / Broadcast / Secure Bridge */}
      <div className={`shrink-0 p-3 border-t ${panelBorder}`}>
        {isComparing ? (() => {
          const winner = compareSuppliers[0].score >= compareSuppliers[1].score
            ? compareSuppliers[0] : compareSuppliers[1];
          return (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <Lock className={`h-3 w-3 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${t.textMuted}`}>Secure Messaging Portal</span>
            </div>
            <button
              onClick={() => { setBroadcastOpen(true); setMessagingOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-all"
            >
              <Globe className="h-3.5 w-3.5" />
              Message Both
            </button>
            <button
              onClick={() => { setSelectedId(winner.id); setMessagingOpen(true); setBroadcastOpen(false); }}
              className={`w-full mt-1.5 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all border ${isDark ? 'border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#87986a]/40 text-[#6b7a54] hover:bg-[#f4f6f0]'}`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Message Winner · {winner.name.split(' ')[0]}
            </button>
          </>
          );
        })() : sidebarBroadcastReady ? (
          <>
            <button
              onClick={() => { setBroadcastOpen(true); setMessagingOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-all"
            >
              <Globe className="h-3.5 w-3.5" />
              <MessageCircle className="h-3.5 w-3.5" />
              Broadcast Announcement
            </button>
            <p className={`text-[9px] mt-1.5 text-center ${t.textMuted}`}>
              {sidebarSelected.size} vendors selected
            </p>
          </>
        ) : expandedSidebar && auditChecked.size > 1 ? (
          <>
            <button
              onClick={() => { setBroadcastOpen(true); setMessagingOpen(false); }}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isDark ? 'bg-[#2a2a2a] border border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/10' : 'bg-white border border-[#87986a]/40 text-[#6b7a54] hover:bg-[#f4f6f0]'
              }`}
            >
              <Globe className="h-3 w-3" />
              <MessageCircle className="h-3.5 w-3.5" />
              Broadcast Announcement
            </button>
            <p className={`text-[9px] mt-1.5 text-center ${t.textMuted}`}>
              {auditChecked.size} vendors · routes via Buyamia Gateway
            </p>
          </>
        ) : activeSupplier ? (
          <>
            <button
              onClick={() => { setMessagingOpen(true); setBroadcastOpen(false); }}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isDark ? 'bg-[#2a2a2a] border border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/10' : 'bg-white border border-[#87986a]/40 text-[#6b7a54] hover:bg-[#f4f6f0]'
              }`}
            >
              <Lock className="h-3 w-3" />
              <MessageCircle className="h-3.5 w-3.5" />
              Open Secure Bridge
            </button>
            <p className={`text-[9px] mt-1.5 text-center ${t.textMuted}`}>
              Routes to {activeSupplier.accountManager} · encrypted
            </p>
          </>
        ) : (
          <p className={`text-[10px] text-center ${t.textMuted}`}>Select a vendor to begin</p>
        )}
      </div>
    </div>
  );

  // ── Messaging Drawer (overlays right panel) ──────────────────────

  const messagingDrawer = activeSupplier && (
    <div className={`absolute inset-0 z-20 flex flex-col ${panelBg}`}>
      {/* Header */}
      <div className={`p-3 border-b ${panelBorder}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className={`h-3.5 w-3.5 ${t.sageIcon}`} />
            <div>
              <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Secure Messaging Portal</h3>
              <p className={`text-[9px] ${t.textMuted}`}>{activeSupplier.accountManager}</p>
            </div>
          </div>
          <button onClick={() => setMessagingOpen(false)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Targeting status */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] ${t.textMuted}`}>Targeting:</span>
          <div className={`flex items-center rounded-full border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button onClick={() => setMessagingChannel('whatsapp')}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-colors ${
                      messagingChannel === 'whatsapp' ? 'bg-[#25D366] text-white' : isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
              WhatsApp
            </button>
            <button onClick={() => setMessagingChannel('telegram')}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-colors ${
                      messagingChannel === 'telegram' ? 'bg-[#0088cc] text-white' : isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
              Telegram
            </button>
          </div>
          <span className="ml-auto flex items-center gap-1 text-[9px] text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> live
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {[...activeSupplier.messageHistory, ...(sessionMessages[activeSupplier.id] ?? [])].length === 0 ? (
          <div className={`text-center text-[10px] py-8 ${t.textMuted}`}>
            No messages yet. Start the conversation below.
          </div>
        ) : (
          [...activeSupplier.messageHistory, ...(sessionMessages[activeSupplier.id] ?? [])].map(m => (
            <div key={m.id} className={`flex ${m.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-[10px] leading-relaxed ${
                m.from === 'admin'
                  ? isDark ? 'bg-[#87986a]/20 text-[#dbe3ce]' : 'bg-[#87986a]/15 text-[#3d4933]'
                  : isDark ? 'bg-[#2a2a2a] text-gray-300' : 'bg-gray-100 text-gray-700'
              }`}>
                <p>{m.text}</p>
                <span className={`text-[8px] mt-0.5 block opacity-60`}>{m.time}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className={`shrink-0 p-3 border-t ${panelBorder}`}>
        <div className="flex items-end gap-1.5">
          <textarea
            value={messageDraft}
            onChange={(e) => setMessageDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            placeholder={`Message ${activeSupplier.accountManager}...`}
            rows={2}
            className={`flex-1 rounded-lg px-2.5 py-1.5 text-[10px] resize-none outline-none ${
              isDark ? 'bg-[#2a2a2a] border border-gray-700 text-white placeholder:text-gray-500' : 'bg-gray-50 border border-gray-200 placeholder:text-gray-400'
            }`}
          />
          <button onClick={handleSendMessage} disabled={!messageDraft.trim()}
                  className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    messageDraft.trim() ? 'bg-[#87986a] text-white hover:bg-[#6b7a54]' : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'
                  }`}>
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className={`text-[8px] mt-1 text-center ${t.textMuted}`}>
          Routed via Buyamia Gateway → {messagingChannel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
        </p>
      </div>
    </div>
  );

  // ── Broadcast Drawer (overlays right panel for multi-vendor announcements) ──

  const broadcastDrawer = (
    <div className={`absolute inset-0 z-20 flex flex-col ${panelBg}`}>
      <div className={`p-3 border-b ${panelBorder}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Globe className={`h-3.5 w-3.5 ${t.sageIcon}`} />
            <div>
              <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Broadcast Announcement</h3>
              <p className={`text-[9px] ${t.textMuted}`}>{broadcastTargets.length} vendors targeted</p>
            </div>
          </div>
          <button onClick={() => setBroadcastOpen(false)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {broadcastTargets.map(s => (
            <span key={s.id} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
              {s.flag} {s.name.split(' ')[0]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className={`text-[9px] ${t.textMuted}`}>Via:</span>
          <div className={`flex items-center rounded-full border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button onClick={() => setMessagingChannel('whatsapp')}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-colors ${messagingChannel === 'whatsapp' ? 'bg-[#25D366] text-white' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              WhatsApp
            </button>
            <button onClick={() => setMessagingChannel('telegram')}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-colors ${messagingChannel === 'telegram' ? 'bg-[#0088cc] text-white' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Telegram
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 p-3 flex flex-col gap-2 min-h-0">
        <label className={`text-[10px] font-semibold ${t.textMuted}`}>Compose Message</label>
        <textarea
          value={broadcastDraft}
          onChange={(e) => setBroadcastDraft(e.target.value)}
          placeholder={`Write a message to ${auditChecked.size} vendors...`}
          rows={6}
          className={`flex-1 rounded-lg px-2.5 py-2 text-[10px] resize-none outline-none ${isDark ? 'bg-[#2a2a2a] border border-gray-700 text-white placeholder:text-gray-500' : 'bg-gray-50 border border-gray-200 placeholder:text-gray-400'}`}
        />
        <p className={`text-[9px] ${t.textMuted}`}>
          Sent to each vendor's {messagingChannel === 'whatsapp' ? 'WhatsApp' : 'Telegram'} via Buyamia Gateway
        </p>
      </div>
      <div className={`shrink-0 p-3 border-t ${panelBorder}`}>
        <button
          onClick={() => {
            const text = broadcastDraft.trim();
            if (!text) return;
            const recipients = broadcastTargets.map(s => s.name).slice(0, 5);
            const tail = broadcastTargets.length > 5 ? ` +${broadcastTargets.length - 5} more` : '';
            logUserAction({
              kind: 'vendor-broadcast',
              summary: `Broadcast to ${broadcastTargets.length} vendor${broadcastTargets.length === 1 ? '' : 's'} via ${messagingChannel === 'whatsapp' ? 'WhatsApp' : 'Telegram'} · ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
              details: text,
              meta: {
                channel: messagingChannel,
                recipientIds: broadcastTargets.map(s => s.id),
                recipientNames: recipients.join(', ') + tail,
              },
            });
            toast.success(`Broadcast sent to ${broadcastTargets.length} vendor${broadcastTargets.length === 1 ? '' : 's'}`, {
              description: `Routed via ${messagingChannel === 'whatsapp' ? 'WhatsApp' : 'Telegram'}.`,
            });
            setBroadcastDraft('');
            setBroadcastOpen(false);
          }}
          disabled={!broadcastDraft.trim()}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-semibold transition-all ${broadcastDraft.trim() ? 'bg-[#87986a] text-white hover:bg-[#6b7a54]' : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'}`}
        >
          <Send className="h-3.5 w-3.5" />
          Send to {broadcastTargets.length} Vendors
        </button>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes hardenedBurst {
          0%   { opacity: 0; transform: translateY(30px) scale(0.7); }
          20%  { opacity: 1; transform: translateY(-8px) scale(1.08); }
          55%  { opacity: 1; transform: translateY(0) scale(1); }
          85%  { opacity: 1; transform: translateY(-4px) scale(1.02); }
          100% { opacity: 0; transform: translateY(-50px) scale(0.92); }
        }
        @keyframes sparkleFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
          50%       { transform: translateY(-8px) rotate(180deg); opacity: 1; }
        }
        .hardened-burst {
          animation: hardenedBurst 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          background: ${isDark ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)'};
          backdrop-filter: blur(12px);
          padding: 2.5rem 4rem;
          border-radius: 1.5rem;
          border: 1px solid ${isDark ? 'rgba(135,152,106,0.4)' : 'rgba(135,152,106,0.5)'};
          box-shadow: 0 30px 80px rgba(135,152,106,0.25);
        }
        .hardened-grade {
          background: linear-gradient(135deg, #87986a, #a3b085, #6b7a54);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
        }
        .hardened-sparkles svg { animation: sparkleFloat 0.9s ease-in-out infinite; }
        .hardened-sparkles svg:nth-child(1) { animation-delay: 0s; }
        .hardened-sparkles svg:nth-child(2) { animation-delay: 0.15s; }
        .hardened-sparkles svg:nth-child(3) { animation-delay: 0.3s; }
        .hardened-sparkles svg:nth-child(4) { animation-delay: 0.45s; }
        .hardened-sparkles svg:nth-child(5) { animation-delay: 0.6s; }
      `}</style>

      <div className="flex flex-col h-full min-h-0" onClick={() => kebabOpenId && setKebabOpenId(null)}>

        {/* ═══ FORTRESS SOURCING BANNER ═══
            Permanent security posture: AI is locked to the vetted internal directory.
            Right side hosts the elevated Onboard New Vendor CTA — humans are
            the sole gateway for new vendor data (Manual Discovery Portal). */}
        <div className={`shrink-0 flex items-center gap-3 px-4 py-2.5 border-b ${panelBorder} ${
          isDark ? 'bg-gradient-to-r from-[#1f2a1f] via-[#1a1a1a] to-[#1a1a1a]' : 'bg-gradient-to-r from-[#f0f4e8] via-white to-white'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${
              isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#87986a]/15 text-[#6b7a54]'
            }`}>
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[11px] font-bold ${t.textPrimary}`}>AI Sourcing Mode:</span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isDark ? 'bg-[#87986a]/20 text-[#a3b085] border border-[#87986a]/40' : 'bg-[#f4f6f0] text-[#6b7a54] border border-[#87986a]/40'
                }`}>
                  <Lock className="h-2.5 w-2.5" />
                  Locked to Internal Directory
                </span>
                <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide ${
                  isDark ? 'text-green-400' : 'text-green-600'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Secure
                </span>
              </div>
              <div className={`text-[10px] leading-tight mt-0.5 ${t.textMuted}`}>
                Atlas optimizes only the {SUPPLIERS.length} vetted vendors below — no global discovery, no internet sourcing.
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className={`hidden md:flex items-center gap-1.5 text-[10px] ${t.textMuted}`}>
              <Bot className="h-3 w-3" />
              <span>{SUPPLIERS.reduce((sum, s) => sum + (getMode(s.id) === 'agent' ? s.assignedAgent.activeTasks : 0), 0)} agent tasks executing</span>
              <span className="opacity-50">·</span>
              <Hand className="h-3 w-3 text-amber-500" />
              <span>{SUPPLIERS.filter(s => getMode(s.id) === 'manual').length} on Manual</span>
            </div>
            {/* Elevated primary action — Manual Discovery Portal */}
            <button
              onClick={handleOnboardVendor}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] active:scale-[0.98] transition-all shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Onboard New Vendor
            </button>
          </div>
        </div>

        {/* ═══ THREE-PANE WORKSPACE ═══ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left:
            normal          → 280px fixed
            expanded only   → flex-1 (full width)
            expanded+matrix → 400px fixed (audit list stays alongside matrix)
        */}
        <div className={`h-full border-r ${panelBorder} ${panelBg} overflow-hidden transition-all duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
             style={{ flex: expandedSidebar ? (showComparisonMatrix ? '0 0 400px' : '1 1 0%') : '0 0 280px' }}>
          {expandedSidebar ? auditLeftPanel : normalLeftPanel}
        </div>

        {/* Center:
            normal          → flex-1
            expanded only   → 0px hidden
            expanded+matrix → flex-1 (shows comparison matrix)
        */}
        <div className={`h-full overflow-y-auto transition-all duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isDark ? 'bg-[#111]' : 'bg-gray-50/50'}`}
             style={{
               flex: (expandedSidebar && !showComparisonMatrix) ? '0 0 0px' : '1 1 0%',
               opacity: (expandedSidebar && !showComparisonMatrix) ? 0 : 1,
               overflow: (expandedSidebar && !showComparisonMatrix) ? 'hidden' : undefined,
             }}>
          {showComparisonMatrix
            ? renderExpandedMatrix(auditCheckedList, t, isDark, tooltipStyle, () => setMatrixVisible(false))
            : centerPanel}
        </div>

        {/* Peek Sheet — shown when expanded (no matrix) + vendor selected */}
        {expandedSidebar && !showComparisonMatrix && selected && (
          <div className={`h-full border-l ${panelBorder} ${panelBg} transition-all duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
               style={{ flex: '0 0 25%', minWidth: 300, maxWidth: 380 }}>
            {peekSheet}
          </div>
        )}

        {/* Right — always 280px, overlays: messaging (1-on-1) OR broadcast */}
        <div className={`w-[280px] shrink-0 h-full border-l ${panelBorder} ${panelBg} relative overflow-hidden`}>
          {rightPanel}
          {messagingOpen && messagingDrawer}
          {broadcastOpen && broadcastDrawer}
        </div>
        </div>
      </div>

      {/* ═══ MANUAL TAKEOVER · STAGE TASK MODULE ═══
          One modal per relationship stage. Each renders the schema-driven
          form for that stage so the Admin can advance the journey from A
          to Z without any AI agent. */}
      {openJourneyStage && (() => {
        const supplier = SUPPLIERS.find(s => s.id === openJourneyStage.supplierId);
        if (!supplier) return null;
        const stageIdx = openJourneyStage.stageIdx;
        const stage = JOURNEY[stageIdx];
        const mod = RELATIONSHIP_TASK_MODULES[stageIdx];
        const eff = getEffectiveJourneyStage(supplier);
        const isComplete = stage.id < eff;
        const isActive = stage.id === eff;
        const verb = isActive ? 'Execute' : isComplete ? 'Edit' : 'Plan ahead';
        const set = (key: string, val: string) => {
          setJourneyStageDraft(prev => ({ ...prev, [key]: val }));
          if (journeyValidationErrors.includes(key) && val.trim()) {
            setJourneyValidationErrors(prev => prev.filter(k => k !== key));
          }
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={closeJourneyModule}>
            <div onClick={e => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
                isDark ? 'bg-[#1a1a1a] border-amber-500/40' : 'bg-white border-amber-400/50'
              }`}>
              {/* Header */}
              <div className={`px-5 py-4 border-b flex items-start gap-3 ${isDark ? 'border-gray-800 bg-amber-500/8' : 'border-gray-200 bg-amber-50/60'}`}>
                <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-amber-500 text-white font-bold text-sm">
                  {stage.id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      {verb} · Manual Task · Stage {stage.id}/12
                    </span>
                    <span className={`text-[10px] ${t.textMuted}`}>{supplier.flag} {supplier.name}</span>
                  </div>
                  <h3 className={`text-sm font-bold mt-0.5 ${t.textPrimary}`}>{stage.label}</h3>
                  <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>{mod.action}</p>
                </div>
                <button onClick={closeJourneyModule}
                  className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Rationale */}
              <div className={`px-5 py-2.5 border-b flex items-start gap-2 ${isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-gray-200 bg-[#f4f6f0]'}`}>
                <Bot className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                <div className="min-w-0">
                  <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Why this stage exists</div>
                  <p className={`text-[11px] mt-0.5 leading-relaxed ${t.textPrimary}`}>{mod.rationale}</p>
                </div>
              </div>

              {/* Form fields */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                {mod.inputs.map(input => {
                  const val = journeyStageDraft[input.key] ?? '';
                  const hasError = journeyValidationErrors.includes(input.key);
                  const labelEl = (
                    <label className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 ${hasError ? 'text-red-500' : t.textPrimary}`}>
                      {input.label}
                      {input.required && <span className="text-red-400">*</span>}
                      {hasError && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold text-red-500">
                          <AlertTriangle className="h-2.5 w-2.5" /> Required
                        </span>
                      )}
                    </label>
                  );
                  const errBorder = hasError
                    ? 'border-red-500/60 ring-1 ring-red-500/30 focus:border-red-500'
                    : isDark ? 'border-gray-700 focus:border-amber-500/50' : 'border-gray-200 focus:border-amber-500/50';
                  if (input.kind === 'text' || input.kind === 'date' || input.kind === 'number') {
                    return (
                      <div key={input.key}>
                        {labelEl}
                        <input
                          type={input.kind === 'date' ? 'date' : input.kind === 'number' ? 'number' : 'text'}
                          value={val}
                          onChange={(e) => set(input.key, e.target.value)}
                          placeholder={input.placeholder}
                          className={`w-full rounded-lg px-3 py-2 text-xs outline-none border ${
                            isDark ? `bg-[#2a2a2a] text-white placeholder:text-gray-500 ${errBorder}` : `bg-gray-50 placeholder:text-gray-400 ${errBorder}`
                          }`}
                        />
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
                            isDark ? `bg-[#2a2a2a] text-white placeholder:text-gray-500 ${errBorder}` : `bg-gray-50 placeholder:text-gray-400 ${errBorder}`
                          }`}
                        />
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
                                    : isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:border-gray-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
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
                            : isDark ? 'bg-[#2a2a2a] border-gray-700 text-gray-400 hover:border-gray-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{val || `Click to upload (${input.accept ?? 'any'})`}</span>
                        <input type="file" accept={input.accept} className="hidden"
                          onChange={(e) => set(input.key, e.target.files?.[0]?.name ?? '')} />
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className={`shrink-0 px-5 py-3 border-t flex items-center gap-2 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                <button onClick={closeJourneyModule}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>
                  Cancel
                </button>
                <button onClick={() => saveJourneyModule(false)}
                  className={`ml-auto px-3 py-2 rounded-lg text-xs font-semibold border ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                  Save Draft
                </button>
                <button onClick={() => saveJourneyModule(true)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors inline-flex items-center gap-1.5 shadow-sm">
                  <CheckCircle className="h-3 w-3" />
                  {isActive ? `Mark Complete · Advance to ${JOURNEY[stageIdx + 1]?.label ?? 'next'}` : isComplete ? 'Save Edits' : 'Save & Pre-stage'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Vendor Onboarding mini-wizard (Phase 4i) */}
      <VendorOnboardingModal isDark={isDark} isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* Renegotiation Workspace (Phase 4k) */}
      <RenegotiationModal
        isDark={isDark}
        isOpen={renegotiationOpen}
        vendor={selected ? { id: selected.id, name: selected.name } : null}
        onClose={handleRenegotiationClose}
      />
    </>
  );
}

// ── Relationship Workspace (selected supplier) ──────────────────────

function renderRelationshipWorkspace(
  selected: Supplier,
  t: ReturnType<typeof themeTokens>,
  isDark: boolean,
  tooltipStyle: any,
  metricFilter: RadarMetric,
  setMetricFilter: (m: RadarMetric) => void,
  filteredOrders: RecentOrder[],
  handleBack: () => void,
  handleRenegotiate: () => void,
  dossierOpen: boolean,
  setDossierOpen: (v: boolean) => void,
  handleOpenMap: () => void,
  mode: LaborMode,
  setMode: (next: LaborMode) => void,
  openGovernance: () => void,
  effectiveJourneyStage: number,
  manualEntries: Record<number, Record<string, string>> | undefined,
  openJourneyModule: (stageIdx: number) => void,
) {
  const primaryColor = primaryCategoryColor(selected);
  const CategoryIcon = CATEGORY_ICONS[selected.categories[0]] ?? Package;
  const isManual = mode === 'manual';

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        <button onClick={handleBack}
                className={`flex items-center gap-1 text-xs transition-colors ${t.textMuted} hover:text-[#87986a]`}>
          <ArrowLeft className="h-3 w-3" />
          Ecosystem
        </button>
        <ChevronRight className={`h-3 w-3 ${t.textMuted}`} />
        <span className="text-sm">{selected.flag}</span>
        <span className={`text-xs font-semibold ${t.textPrimary}`}>{selected.name}</span>
      </div>

      {/* ═══ STOREFRONT HERO ═══ */}
      <div className={`${t.cardPanel} p-0 overflow-hidden`}>
        {/* Cover */}
        <div className="relative h-44 overflow-hidden"
             style={{
               background: `linear-gradient(135deg, ${primaryColor}ee 0%, ${primaryColor}aa 40%, ${primaryColor}44 100%)`,
             }}>
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-[0.12]"
               style={{
                 backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.8) 0%, transparent 30%),
                                   radial-gradient(circle at 80% 70%, rgba(255,255,255,0.6) 0%, transparent 35%)`,
               }} />
          {/* Subtle building silhouette via SVG */}
          <svg viewBox="0 0 400 180" className="absolute inset-0 w-full h-full opacity-25" preserveAspectRatio="xMidYMid slice">
            <g fill="rgba(255,255,255,0.4)">
              <rect x="20"  y="90"  width="50" height="90" />
              <rect x="75"  y="60"  width="60" height="120" />
              <rect x="140" y="80"  width="40" height="100" />
              <rect x="185" y="40"  width="70" height="140" />
              <rect x="260" y="70"  width="50" height="110" />
              <rect x="315" y="55"  width="65" height="125" />
            </g>
            <g fill="rgba(255,255,255,0.18)">
              <rect x="85"  y="75"  width="10" height="10" />
              <rect x="105" y="75"  width="10" height="10" />
              <rect x="85"  y="100" width="10" height="10" />
              <rect x="105" y="100" width="10" height="10" />
              <rect x="200" y="60"  width="10" height="10" />
              <rect x="220" y="60"  width="10" height="10" />
              <rect x="240" y="60"  width="10" height="10" />
              <rect x="200" y="95"  width="10" height="10" />
              <rect x="220" y="95"  width="10" height="10" />
              <rect x="240" y="95"  width="10" height="10" />
            </g>
          </svg>
          {/* Category badge top-right */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
            <CategoryIcon className="h-3 w-3 text-white" />
            <span className="text-[10px] font-semibold text-white">{selected.categories.join(' · ')}</span>
          </div>
          {/* Gradient fade to surface */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Logo + identity block */}
        <div className="relative px-5 pt-0 pb-5">
          {/* Logo overlay (overlaps cover bottom) */}
          <div className="absolute -top-7 left-5 w-16 h-16 rounded-xl flex items-center justify-center font-black text-xl shadow-lg"
               style={{
                 background: '#fff',
                 border: `4px solid ${isDark ? '#1a1a1a' : '#fff'}`,
                 color: primaryColor,
                 boxShadow: `0 6px 16px ${primaryColor}33`,
               }}>
            {selected.initials}
          </div>

          <div className="pt-11 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xl">{selected.flag}</span>
                <h2 className={`text-xl font-bold ${t.textPrimary}`}>{selected.name}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusMeta(selected.vendorStatus, isDark).pill}`}>
                  {statusMeta(selected.vendorStatus, isDark).label}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`flex items-center gap-1 text-xs ${t.textMuted}`}><MapPin className="h-3 w-3" /> {selected.country}</span>
                <span className={`flex items-center gap-1 text-xs ${t.textMuted}`}><Clock className="h-3 w-3" /> {selected.leadDays}d lead</span>
                <span className={`flex items-center gap-1 text-xs ${t.textMuted}`}><Package className="h-3 w-3" /> {selected.orders} orders</span>
                <span className={`flex items-center gap-1 text-xs ${t.textMuted}`}><DollarSign className="h-3 w-3" /> ${(selected.contractValue / 1000).toFixed(0)}K / yr</span>
                <span className={`text-xs ${selected.contractExpiresIn < 60 ? 'text-amber-400' : t.textMuted}`}>Contract: {selected.contractExpiresIn}d</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-3xl font-black ${scoreColor(selected.score)}`}>{selected.score}</div>
              <div className={`text-[10px] ${t.textMuted}`}>composite</div>
            </div>
          </div>

          {/* ═══ LABOR SWITCH + ASSIGNED AGENT IDENTITY ═══
              Wayne doctrine: every autonomous task must be handlable by a human.
              The Switch lives adjacent to the vendor (Proximity of Action). */}
          <div className={`mt-4 pt-4 border-t flex items-center justify-between gap-3 flex-wrap ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <LaborSwitch
                mode={mode}
                onChange={setMode}
                agent={selected.assignedAgent}
                isDark={isDark}
              />
              <div className="flex flex-col gap-0.5">
                <div className={`flex items-center gap-1.5 text-[10px] ${t.textMuted}`}>
                  <span>Managed by:</span>
                  <button
                    onClick={openGovernance}
                    className={`inline-flex items-center gap-1 font-semibold hover:underline ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}
                    title="Open this agent's directory profile to tune autonomy & approval limits"
                  >
                    <Bot className="h-3 w-3" />
                    {agentLabel(selected.assignedAgent)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
                <AgentStatusLine mode={mode} agent={selected.assignedAgent} isDark={isDark} />
              </div>
            </div>
            {isManual && (
              <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border ${
                isDark ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-amber-500/40 bg-amber-50 text-amber-700'
              }`}>
                <AlertTriangle className="h-3 w-3" />
                <span className="font-medium">{selected.assignedAgent.activeTasks} task{selected.assignedAgent.activeTasks === 1 ? '' : 's'} parked in Human Review — finish on the journey track below.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ COMPANY DOSSIER ═══ */}
      <div className={`${t.cardPanel} p-0 overflow-hidden`}>
        <button onClick={() => setDossierOpen(!dossierOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isDark ? 'hover:bg-gray-800/40' : 'hover:bg-gray-50'}`}>
          <div className="flex items-center gap-2">
            <Building2 className={`h-3.5 w-3.5 ${t.sageIcon}`} />
            <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Company Dossier</h3>
            <span className={`text-[10px] ${t.textMuted}`}>address · contacts · legal vitals</span>
          </div>
          {dossierOpen ? <ChevronUp className={`h-3.5 w-3.5 ${t.textMuted}`} /> : <ChevronDown className={`h-3.5 w-3.5 ${t.textMuted}`} />}
        </button>

        {dossierOpen && (
          <div className={`px-4 pb-4 pt-1 grid grid-cols-3 gap-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            {/* Address */}
            <div>
              <div className={`text-[9px] uppercase tracking-wide mb-1.5 ${t.textMuted}`}>Address</div>
              <p className={`text-[11px] leading-relaxed ${t.textSecondary}`}>{selected.address}</p>
              <button onClick={handleOpenMap}
                      className={`mt-2 inline-flex items-center gap-1 text-[10px] font-medium transition-colors ${isDark ? 'text-[#a3b085] hover:text-[#c5d3a8]' : 'text-[#6b7a54] hover:text-[#556142]'}`}>
                <MapPin className="h-2.5 w-2.5" /> View on Map
              </button>
            </div>

            {/* Contacts */}
            <div>
              <div className={`text-[9px] uppercase tracking-wide mb-1.5 ${t.textMuted}`}>Contacts</div>
              <div className="space-y-1.5">
                {selected.contacts.map(c => (
                  <div key={c.role}>
                    <div className={`text-[10px] font-semibold ${t.textPrimary}`}>{c.role} · {c.name}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <a href={`mailto:${c.email}`} className={`inline-flex items-center gap-1 text-[9px] transition-colors ${isDark ? 'text-gray-400 hover:text-[#a3b085]' : 'text-gray-500 hover:text-[#6b7a54]'}`}>
                        <Mail className="h-2.5 w-2.5" /> {c.email}
                      </a>
                    </div>
                    <a href={`tel:${c.phone.replace(/\s/g, '')}`} className={`inline-flex items-center gap-1 text-[9px] transition-colors ${isDark ? 'text-gray-400 hover:text-[#a3b085]' : 'text-gray-500 hover:text-[#6b7a54]'}`}>
                      <Phone className="h-2.5 w-2.5" /> {c.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal Vitals */}
            <div>
              <div className={`text-[9px] uppercase tracking-wide mb-1.5 ${t.textMuted}`}>Legal Vitals</div>
              <div className="space-y-1.5">
                <div>
                  <div className={`text-[9px] ${t.textMuted}`}>Business Registration (NIB)</div>
                  <code className={`text-[11px] font-mono font-semibold ${t.textPrimary}`}>{selected.nib}</code>
                </div>
                <div>
                  <div className={`text-[9px] ${t.textMuted}`}>Tax ID (NPWP)</div>
                  <code className={`text-[11px] font-mono font-semibold ${t.textPrimary}`}>{selected.npwp}</code>
                </div>
                <div className={`mt-2 inline-flex items-center gap-1 text-[9px] font-medium text-green-400`}>
                  <CheckCircle className="h-2.5 w-2.5" /> A-01 verified
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ 12-STAGE JOURNEY KERNEL (Continuous Progress Path) ═══
          Manual Takeover hook: when Manual mode is on, the active stage
          becomes the "click-to-finish" handhold for the Admin. */}
      <div className={`${t.cardPanel} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Relationship Journey · Stage {selected.journeyStage}/12</h3>
          <div className="flex items-center gap-2">
            {isManual && (
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
                <Hand className="h-2.5 w-2.5" /> Click any stage to open its task module
              </span>
            )}
            <span className={`text-[10px] ${t.textMuted}`}>{Math.round((effectiveJourneyStage / 12) * 100)}% complete</span>
          </div>
        </div>
        <div className="relative pb-4">
          {/* Continuous progress track */}
          <div className="relative flex items-start justify-between">
            {/* Background lines (span between each node center) */}
            {JOURNEY.slice(0, -1).map((stage, i) => {
              const completed = stage.id < effectiveJourneyStage;
              const leftPct = ((i + 0.5) / JOURNEY.length) * 100;
              const widthPct = (1 / JOURNEY.length) * 100;
              return (
                <div
                  key={`line-${i}`}
                  className="absolute top-3"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, height: 2 }}
                >
                  {completed ? (
                    <div className="h-full bg-[#87986a]" />
                  ) : (
                    <div className="h-full w-full"
                         style={{
                           borderTop: `2px dashed ${isDark ? '#555' : '#9ca3af'}`,
                         }} />
                  )}
                </div>
              );
            })}

            {/* Nodes — clickable in Manual mode (any stage). Manual entries
                show a small chip; the active stage gets the Hand icon. */}
            {JOURNEY.map(stage => {
              const stageIdx = stage.id - 1;
              const done = stage.id < effectiveJourneyStage;
              const active = stage.id === effectiveJourneyStage;
              const upcoming = stage.id > effectiveJourneyStage;
              const hasManualEntry = !!manualEntries?.[stageIdx]
                && Object.values(manualEntries[stageIdx]).some(v => v && v.toString().trim().length > 0);
              const clickable = isManual; // all stages clickable in Manual
              const verb = active ? 'Execute' : done ? 'Edit' : 'Plan ahead';
              const NodeTag: any = clickable ? 'button' : 'div';
              return (
                <div key={stage.id} className="relative flex flex-col items-center z-10" style={{ flex: `0 0 ${100 / JOURNEY.length}%` }}>
                  <NodeTag
                    {...(clickable ? {
                      onClick: () => openJourneyModule(stageIdx),
                      title: `${verb}: ${stage.label} (${RELATIONSHIP_TASK_MODULES[stageIdx].action})`,
                    } : {})}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      done
                        ? clickable
                          ? 'bg-[#87986a] text-white cursor-pointer hover:bg-amber-500'
                          : 'bg-[#87986a] text-white'
                      : active
                        ? clickable
                          ? 'bg-amber-500 text-white ring-2 ring-amber-500/50 ring-offset-2 cursor-pointer hover:bg-amber-600 ' + (isDark ? 'ring-offset-[#1a1a1a]' : 'ring-offset-white')
                          : 'bg-[#87986a]/20 text-[#87986a] ring-2 ring-[#87986a]/50 ring-offset-2 ' + (isDark ? 'ring-offset-[#1a1a1a]' : 'ring-offset-white')
                      : upcoming && clickable
                        ? (isDark ? 'border-2 border-amber-500/40 text-amber-300 bg-transparent cursor-pointer hover:bg-amber-500/15' : 'border-2 border-amber-400/50 text-amber-700 bg-transparent cursor-pointer hover:bg-amber-50')
                        : isDark ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-white text-gray-400 border border-gray-300'
                    }`}
                  >
                    {done ? <CheckCircle className="h-3 w-3" /> : active && clickable ? <Hand className="h-3 w-3" /> : stage.id}
                  </NodeTag>
                  <div className={`text-[9px] font-medium mt-1.5 text-center leading-tight px-0.5 ${
                    done || active ? t.textPrimary : t.textMuted
                  }`}>
                    {stage.label}
                  </div>
                  {active && (
                    <span className={`mt-1 text-[8px] px-1 py-0.5 rounded font-semibold ${
                      clickable
                        ? 'bg-amber-500/15 text-amber-500'
                        : isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                    }`}>
                      {clickable ? 'Execute now' : 'Current'}
                    </span>
                  )}
                  {hasManualEntry && !active && (
                    <span className={`mt-1 inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded font-bold ${
                      isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                    }`}>
                      <User className="h-2 w-2" /> manual
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ SCORE CARDS ═══ */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Delivery', value: selected.reliability, icon: Truck },
          { label: 'Quality', value: selected.quality, icon: Shield },
          { label: 'Price', value: selected.price, icon: DollarSign },
          { label: 'Sustain.', value: selected.sustainability, icon: Leaf },
          { label: 'CO₂', value: selected.co2Score, icon: Star },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className={`${t.cardPanel} text-center`}>
              <Icon className={`h-3.5 w-3.5 mx-auto mb-1 ${t.sageIcon}`} />
              <div className={`text-base font-bold ${scoreColor(m.value)}`}>{m.value}</div>
              <div className={`text-[10px] ${t.textMuted}`}>{m.label}</div>
              <div className={`h-1 rounded-full mt-1.5 ${t.progressTrack}`}>
                <div className={`h-full rounded-full ${scoreBar(m.value)}`} style={{ width: `${m.value}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ ACTIONABLE RADAR (clickable axes) ═══ */}
      <div className={`${t.cardPanel} p-4`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Actionable Performance Radar</h3>
            <p className={`text-[10px] ${t.textMuted}`}>Click a radar axis or pill to filter the Order Ledger</p>
          </div>
          {metricFilter && (
            <button onClick={() => setMetricFilter(null)}
                    className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${isDark ? 'border-gray-700 text-gray-400 hover:text-white' : 'border-gray-300 text-gray-500 hover:text-gray-700'}`}>
              <X className="h-2.5 w-2.5" /> Clear filter
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 items-center">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={[
                { metric: 'Delivery',  key: 'delivery',       value: selected.reliability },
                { metric: 'Quality',   key: 'quality',        value: selected.quality },
                { metric: 'Price',     key: 'price',          value: selected.price },
                { metric: 'Sustain.',  key: 'sustainability', value: selected.sustainability },
                { metric: 'CO₂',       key: 'co2',            value: selected.co2Score },
              ]} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                <PolarGrid stroke={isDark ? '#333' : '#e5e7eb'} />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={(props: any) => {
                    const { x, y, payload, textAnchor } = props;
                    const keyMap: Record<string, RadarMetric> = {
                      'Delivery': 'delivery', 'Quality': 'quality', 'Price': 'price',
                      'Sustain.': 'sustainability', 'CO₂': 'co2',
                    };
                    const keyFor = keyMap[payload.value];
                    const isActive = metricFilter === keyFor;
                    return (
                      <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }}
                         onClick={() => setMetricFilter(isActive ? null : keyFor)}>
                        <rect x={textAnchor === 'end' ? -50 : textAnchor === 'start' ? 0 : -25}
                              y={-9} width={50} height={18} rx={9}
                              fill={isActive ? (isDark ? 'rgba(135,152,106,0.2)' : 'rgba(135,152,106,0.15)') : 'transparent'}
                              stroke={isActive ? '#87986a' : 'transparent'} strokeWidth={1} />
                        <text x={0} y={0} dy={3} textAnchor={textAnchor}
                              fill={isActive ? '#87986a' : (isDark ? '#aaa' : '#666')}
                              fontSize={10}
                              fontWeight={isActive ? 700 : 500}
                              style={{ userSelect: 'none' }}>
                          {payload.value}
                        </text>
                      </g>
                    );
                  }}
                />
                <Radar dataKey="value" stroke="#87986a" fill="#87986a" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {([
              { key: 'delivery' as const,       label: 'Delivery',     value: selected.reliability,    icon: Truck },
              { key: 'quality' as const,        label: 'Quality',      value: selected.quality,         icon: Shield },
              { key: 'price' as const,          label: 'Price',        value: selected.price,           icon: DollarSign },
              { key: 'sustainability' as const, label: 'Sustain.',      value: selected.sustainability,  icon: Leaf },
              { key: 'co2' as const,            label: 'CO₂',          value: selected.co2Score,        icon: Star },
            ]).map(m => {
              const MIcon = m.icon;
              const active = metricFilter === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMetricFilter(active ? null : m.key)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] transition-all ${
                    active
                      ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
                      : isDark ? 'bg-[#2a2a2a] border-gray-800 text-gray-400 hover:border-gray-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <MIcon className="h-2.5 w-2.5 shrink-0" />
                  <span className="flex-1 text-left font-medium">{m.label}</span>
                  <span className={`font-semibold ${scoreColor(m.value)}`}>{m.value}</span>
                  <Filter className="h-2.5 w-2.5 opacity-60" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ AGENT INTELLIGENCE + EXECUTE / MANUAL DRAFT ═══
          In Manual mode, the AI is suspended — instead of an Execute CTA,
          the Admin sees the parked task ready for human completion. */}
      <div className={`p-4 rounded-lg border ${
        isManual
          ? isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50/60 border-amber-300/50'
          : isDark ? 'bg-[#87986a]/8 border-[#87986a]/20' : 'bg-[#f4f6f0] border-[#dbe3ce]'
      }`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isManual ? <Hand className="h-4 w-4 text-amber-500" /> : <Bot className={`h-4 w-4 ${t.sageIcon}`} />}
            <span className={`text-xs font-semibold ${t.textPrimary}`}>
              {isManual ? 'Human Review · Drafts' : 'Agent Intelligence'}
            </span>
          </div>
          <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide ${
            isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
          }`}>
            <Lock className="h-2.5 w-2.5" /> Internal directory only
          </span>
        </div>
        {isManual ? (
          <p className={`text-[11px] leading-relaxed mb-3 ${t.textSecondary}`}>
            {`${agentBadge(selected.assignedAgent)} (${selected.assignedAgent.role}) is in Standby. ${selected.assignedAgent.activeTasks} task${selected.assignedAgent.activeTasks === 1 ? ' is' : 's are'} parked here as draft${selected.assignedAgent.activeTasks === 1 ? '' : 's'} for you to complete or cancel manually.`}
          </p>
        ) : (
          <div className="mb-3">
            <AgentCTA
              isDark={isDark}
              variant="inline"
              agentLabel={`${agentBadge(selected.assignedAgent)} · ${selected.assignedAgent.role}`}
              reasoning={selected.agentNotes}
              offModeMessage={`Use the metrics, contract status, and order history above to assess ${selected.name}. Agent narrative is hidden in Off mode.`}
              autoExecutionNote={`${agentBadge(selected.assignedAgent)} is actively monitoring this vendor and will propose renegotiations / sourcing alternatives within policy.`}
              onDefer={() => toast.info(`Deferred A-01 intelligence on ${selected.name}`, { description: 'Snoozed for 24h. SLA and contract sensors keep running.' })}
              onDecline={() => toast.warning(`Dismissed A-01 intelligence on ${selected.name}`, { description: "Won't re-surface until SLA or pricing signal changes materially." })}
            />
          </div>
        )}
        {isManual ? (
          <div className="flex gap-2">
            <button
              onClick={() => toast.info(`Human Review Queue · ${selected.name}`, {
                description: `Production: opens ${selected.assignedAgent.activeTasks} parked agent task${selected.assignedAgent.activeTasks === 1 ? '' : 's'} — for each, the original prompt, agent's draft action, accept / edit / reject controls, and an audit row of who actioned what.`,
              })}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98]"
            >
              <Hand className="h-3.5 w-3.5" />
              Open Human Review Queue ({selected.assignedAgent.activeTasks})
            </button>
            <button
              onClick={() => setMode('agent')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                isDark ? 'border-[#87986a]/40 text-[#a3b085] hover:bg-[#87986a]/10' : 'border-[#87986a]/40 text-[#6b7a54] hover:bg-[#f4f6f0]'
              }`}
              title="Resume Agent — return tasks to autonomous execution"
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Resume
            </button>
          </div>
        ) : (
          <button
            onClick={handleRenegotiate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all bg-[#87986a] text-white hover:bg-[#6b7a54] active:scale-[0.98]"
            title="Production: opens a multi-week renegotiation workspace (prep brief → opening offer → vendor counter rounds → red-line → signed amendment). 'Hardened' state only after a signed amendment is on file."
          >
            <Zap className="h-3.5 w-3.5" />
            Initiate Renegotiation · {agentLabel(selected.assignedAgent)}
          </button>
        )}
      </div>

      {/* ═══ MANUAL NOTES (Phase 4l) ═══ */}
      <ManualNotes
        isDark={isDark}
        type="supplier"
        id={selected.id}
        entityLabel={selected.name}
      />

      {/* ═══ FILTERED ORDER LEDGER ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className={`text-sm font-semibold ${t.textPrimary}`}>Order Ledger</h3>
            <p className={`text-xs ${t.textMuted}`}>
              {metricFilter
                ? `Filtered by ${metricFilter} · ${filteredOrders.length} of ${selected.recentOrders.length}`
                : `All ${selected.recentOrders.length} recent orders`}
            </p>
          </div>
        </div>
        <div className={`${t.cardPanel} overflow-hidden p-0`}>
          {filteredOrders.length === 0 ? (
            <div className={`p-6 text-center text-[11px] ${t.textMuted}`}>No orders match the {metricFilter} filter</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className={`border-b ${t.border}`}>
                  <th className={`text-left text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Date</th>
                  <th className={`text-left text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Item</th>
                  <th className={`text-right text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Value</th>
                  <th className={`text-right text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, i) => (
                  <tr key={i} className={`border-b last:border-0 ${t.border}`}>
                    <td className={`py-2.5 px-3 text-[10px] ${t.textMuted}`}>{o.date}</td>
                    <td className={`py-2.5 px-3 text-[10px] ${t.textSecondary}`}>{o.item}</td>
                    <td className={`py-2.5 px-3 text-[10px] font-medium text-right ${t.textPrimary}`}>${o.value.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        o.status === 'delivered' ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                        : o.status === 'in-transit' ? isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'
                        : o.status === 'late' ? isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700'
                        : o.status === 'disputed' ? isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                        : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {o.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ── Expanded Comparison Matrix (in-place, audit mode) ────────────

function renderExpandedMatrix(
  suppliers: Supplier[],
  t: ReturnType<typeof themeTokens>,
  isDark: boolean,
  tooltipStyle: any,
  onClose: () => void,
) {
  const metrics: { key: keyof Supplier; label: string; lowerBetter?: boolean }[] = [
    { key: 'score',          label: 'Overall Score' },
    { key: 'reliability',    label: 'Delivery %' },
    { key: 'quality',        label: 'Quality' },
    { key: 'price',          label: 'Price Index' },
    { key: 'sustainability', label: 'Sustainability' },
    { key: 'co2Score',       label: 'CO₂ Score' },
    { key: 'leadDays',       label: 'Lead Time (d)', lowerBetter: true },
    { key: 'contractValue',  label: 'Annual Contract' },
    { key: 'savingsYTD',     label: 'Savings YTD ($)' },
  ];
  const COLORS = ['#87986a', '#60a5fa', '#f59e0b', '#a78bfa', '#f87171', '#34d399', '#fb923c'];
  const is2 = suppliers.length === 2;

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GitMerge className={`h-4 w-4 ${t.sageIcon}`} />
          <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Comparison Matrix</h2>
          <span className={`text-[10px] ${t.textMuted}`}>· {suppliers.length} vendors</span>
        </div>
        <button onClick={onClose}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <X className="h-3 w-3" /> Close Matrix
        </button>
      </div>

      {/* Vendor name cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(suppliers.length, 4)}, minmax(0,1fr))` }}>
        {suppliers.map((s, i) => (
          <div key={s.id} className={`${t.cardPanel} p-3 border-t-2`} style={{ borderTopColor: COLORS[i] }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{s.flag}</span>
              <span className={`text-[11px] font-bold truncate ${t.textPrimary}`}>{s.name}</span>
            </div>
            <div className={`text-3xl font-black ${
              s.score >= 90 ? 'text-green-400' : s.score >= 80 ? 'text-amber-400' : 'text-red-400'
            }`}>{s.score}</div>
            <div className={`text-[9px] ${t.textMuted}`}>{s.country} · {s.categories[0]}</div>
          </div>
        ))}
      </div>

      {/* 2-vendor radar overlay */}
      {is2 && (
        <div className={`${t.cardPanel} p-4`}>
          <h3 className={`text-xs font-semibold mb-2 ${t.textPrimary}`}>Performance Overlay</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={[
                { metric: 'Delivery',  ...Object.fromEntries(suppliers.map(s => [s.id, s.reliability])) },
                { metric: 'Quality',   ...Object.fromEntries(suppliers.map(s => [s.id, s.quality])) },
                { metric: 'Price',     ...Object.fromEntries(suppliers.map(s => [s.id, s.price])) },
                { metric: 'Sustain.',  ...Object.fromEntries(suppliers.map(s => [s.id, s.sustainability])) },
                { metric: 'CO₂',       ...Object.fromEntries(suppliers.map(s => [s.id, s.co2Score])) },
              ]} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                <PolarGrid stroke={isDark ? '#333' : '#e5e7eb'} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: isDark ? '#888' : '#666' }} />
                {suppliers.map((s, i) => (
                  <Radar key={s.id} name={s.name} dataKey={s.id} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.2} strokeWidth={2} />
                ))}
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-1">
            {suppliers.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5" style={{ background: COLORS[i] }} />
                <span className={`text-[10px] ${t.textSecondary}`}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scalable metric table — green = best performer per row */}
      <div className={`${t.cardPanel} overflow-hidden p-0`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${t.border}`}>
                <th className={`text-left text-[10px] font-medium py-2.5 pl-3 pr-4 ${t.textMuted} sticky left-0 ${isDark ? 'bg-[#252525]' : 'bg-gray-50'} z-10`}>Metric</th>
                {suppliers.map((s, i) => (
                  <th key={s.id} className={`text-right text-[10px] font-medium py-2.5 px-3 whitespace-nowrap`}
                      style={{ color: COLORS[i] }}>
                    {s.flag} {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => {
                const values = suppliers.map(s => s[m.key] as number);
                const bestVal = m.lowerBetter ? Math.min(...values) : Math.max(...values);
                const allSame = values.every(v => v === values[0]);
                return (
                  <tr key={String(m.key)} className={`border-b last:border-0 ${t.border}`}>
                    <td className={`py-2 pl-3 pr-4 text-[10px] ${t.textSecondary} sticky left-0 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} z-10`}>{m.label}</td>
                    {suppliers.map(s => {
                      const v = s[m.key] as number;
                      const isBest = !allSame && v === bestVal;
                      const display = m.key === 'contractValue'
                        ? `$${(v / 1000).toFixed(0)}K`
                        : m.key === 'savingsYTD' ? `$${v.toLocaleString()}` : String(v);
                      return (
                        <td key={s.id} className={`py-2 px-3 text-[10px] text-right font-medium transition-colors ${isBest ? 'text-green-400' : t.textPrimary}`}
                            style={{ background: isBest ? (isDark ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.08)') : undefined }}>
                          {display}
                          {isBest && <span className="ml-0.5 text-[8px] opacity-70">★</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={`px-3 py-2 border-t ${t.border} flex items-center gap-1.5`}>
          <span className="text-[8px] text-green-400">★</span>
          <span className={`text-[9px] ${t.textMuted}`}>Best performer per metric</span>
        </div>
      </div>
    </div>
  );
}

// ── Comparison Matrix ─────────────────────────────────────────────

function renderComparison(
  suppliers: Supplier[],
  t: ReturnType<typeof themeTokens>,
  isDark: boolean,
  tooltipStyle: any,
) {
  const [a, b] = suppliers;
  const metrics = [
    { key: 'score',          label: 'Overall Score' },
    { key: 'reliability',    label: 'Delivery' },
    { key: 'quality',        label: 'Quality' },
    { key: 'price',          label: 'Price' },
    { key: 'sustainability', label: 'Sustainability' },
    { key: 'co2Score',       label: 'CO₂ Score' },
    { key: 'leadDays',       label: 'Lead Time (d)', lowerBetter: true },
    { key: 'orders',         label: 'Total Orders' },
    { key: 'savingsYTD',     label: 'Savings YTD ($)' },
  ] as const;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <GitMerge className={`h-4 w-4 ${t.sageIcon}`} />
        <h2 className={`text-sm font-semibold ${t.textPrimary}`}>Side-by-Side Comparison</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {suppliers.map(s => (
          <div key={s.id} className={`${t.cardPanel} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{s.flag}</span>
              <h3 className={`text-sm font-bold ${t.textPrimary}`}>{s.name}</h3>
            </div>
            <div className={`text-[10px] ${t.textMuted} mb-3`}>{s.country} · {s.categories.join(', ')}</div>
            <div className={`text-4xl font-black ${scoreColor(s.score)}`}>{s.score}</div>
            <div className={`text-[10px] ${t.textMuted}`}>composite score</div>
          </div>
        ))}
      </div>

      <div className={`${t.cardPanel} p-4`}>
        <h3 className={`text-xs font-semibold mb-2 ${t.textPrimary}`}>Performance Overlay</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={[
              { metric: 'Delivery', a: a.reliability, b: b.reliability },
              { metric: 'Quality', a: a.quality, b: b.quality },
              { metric: 'Price', a: a.price, b: b.price },
              { metric: 'Sustain.', a: a.sustainability, b: b.sustainability },
              { metric: 'CO₂', a: a.co2Score, b: b.co2Score },
            ]} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
              <PolarGrid stroke={isDark ? '#333' : '#e5e7eb'} />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: isDark ? '#888' : '#666' }} />
              <Radar name={a.name} dataKey="a" stroke="#87986a" fill="#87986a" fillOpacity={0.22} strokeWidth={2} />
              <Radar name={b.name} dataKey="b" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.22} strokeWidth={2} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-[#87986a]" />
            <span className={`text-[10px] ${t.textSecondary}`}>{a.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-[#60a5fa]" />
            <span className={`text-[10px] ${t.textSecondary}`}>{b.name}</span>
          </div>
        </div>
      </div>

      <div className={`${t.cardPanel} overflow-hidden p-0`}>
        <table className="w-full">
          <thead>
            <tr className={`border-b ${t.border}`}>
              <th className={`text-left text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Metric</th>
              <th className={`text-right text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>{a.name}</th>
              <th className={`text-right text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>{b.name}</th>
              <th className={`text-right text-[10px] font-medium py-2.5 px-3 ${t.textMuted}`}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const va = a[m.key as keyof Supplier] as number;
              const vb = b[m.key as keyof Supplier] as number;
              const lowerBetter = 'lowerBetter' in m && m.lowerBetter;
              const aWins = lowerBetter ? va < vb : va > vb;
              return (
                <tr key={m.key} className={`border-b last:border-0 ${t.border}`}>
                  <td className={`py-2 px-3 text-[10px] ${t.textSecondary}`}>{m.label}</td>
                  <td className={`py-2 px-3 text-[10px] text-right font-medium ${aWins ? 'text-green-400' : t.textPrimary}`}>{va.toLocaleString()}</td>
                  <td className={`py-2 px-3 text-[10px] text-right font-medium ${!aWins && va !== vb ? 'text-green-400' : t.textPrimary}`}>{vb.toLocaleString()}</td>
                  <td className={`py-2 px-3 text-[10px] text-right ${t.textMuted}`}>{va === vb ? '—' : `${Math.abs(va - vb).toFixed(0)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
