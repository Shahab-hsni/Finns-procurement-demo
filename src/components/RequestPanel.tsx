import { useState, useEffect, useMemo } from "react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import {
  Sparkles, ChevronRight, ChevronLeft,
  Plus, Trash2, CheckCircle, Package, MapPin,
  Users, Zap, Edit2, FileText, TrendingUp, Star, Clock,
  Bot, ShieldCheck, AlertTriangle, Hand, Lock, Activity,
  ArrowRight, Truck, X, Flame, ShoppingCart,
  ScrollText, AlertCircle, Factory, Wrench, Building2, Cpu,
} from "lucide-react";
import { workflowTemplates } from "../lib/mockData";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "sonner";
import { ProductSidebar } from "./ProductSidebar";

interface RequestPanelProps {
  theme?: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

interface LineItem {
  id: string;
  name: string;
  category: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

// ── Autonomy Matrix · agent assignment per level ────────────────
interface AutonomyTier {
  value: string;
  label: string;
  agent?: { id: number; role: string };
  desc: string;
  scope: string;
}
const AUTONOMY_TIERS: AutonomyTier[] = [
  { value: 'L0', label: 'L0 · Manual',            desc: 'You approve every step',           scope: 'No agent assigned — every gesture is yours.' },
  { value: 'L1', label: 'L1 · Suggest',            agent: { id: 7,  role: 'Logistics' },     desc: 'AI recommends, you decide',        scope: 'Drafts proposals + collects quotes. Won\'t commit anything.' },
  { value: 'L2', label: 'L2 · Auto',               agent: { id: 33, role: 'Compliance' },    desc: 'AI acts, you review',              scope: 'Executes within guardrails. Surfaces low-confidence calls.' },
  { value: 'L3', label: 'L3 · Full',               agent: { id: 1,  role: 'PO Engine' },     desc: 'AI handles end-to-end',            scope: 'Full autonomy except HITL-gated stages.' },
  { value: 'L4', label: 'L4 · Supervised Full',    agent: { id: 1,  role: 'PO Engine' },     desc: 'AI runs all stages, weekly digest', scope: 'Full execution + weekly briefing summary. HITL gates at Stage 1 and Stage 12 remain.' },
  { value: 'L5', label: 'L5 · Full Autonomy',      agent: { id: 2,  role: 'Fleet' },         desc: 'Full agent fleet, no check-ins',   scope: 'Agent fleet (EXE-001, EXE-002, SEN-001, SEN-002) operates end-to-end. Legal HITL gates only.' },
];

// ── Group Buy · simulated pool match (Atlas surfaces this from the directory) ──
interface GroupBuyPool {
  id: string;
  members: string[];
  estDiscountPct: number;
  windowDays: number;
  category: string;
}
const SIMULATED_POOL_MATCH: GroupBuyPool = {
  id: 'DR-2864',
  members: ['Indo Seafood Corp', 'Thai Fresh Co', 'PT Maju Bersama'],
  estDiscountPct: 12,
  windowDays: 4,
  category: 'Protein',
};

const SAGE = {
  activeBg: (isDark: boolean) => isDark ? 'bg-[#87986a]/10 border-[#87986a]/40' : 'bg-[#f4f6f0] border-[#87986a]/50',
  inactiveBg: (isDark: boolean) => isDark ? 'bg-[#2a2a2a] border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300',
  primary: (isDark: boolean) => isDark ? 'bg-[#87986a] hover:bg-[#6b7a54] text-white' : 'bg-[#87986a] hover:bg-[#6b7a54] text-white',
  badge: (isDark: boolean) => isDark ? 'bg-[#87986a]/10 text-[#a3b085] border-[#87986a]/20' : 'bg-[#f4f6f0] text-[#4f5c3e] border-[#87986a]/30',
  icon: (isDark: boolean) => isDark ? 'text-[#a3b085]' : 'text-[#87986a]',
};

const STEP_LABELS = [
  'Details', 'Items', 'Budget', 'Vendors', 'Delivery', 'Review', 'Done'
];

export function RequestPanel({ theme = 'dark', onNavigate }: RequestPanelProps) {
  const isDark = theme === 'dark';
  const [step, setStep] = useState(1);

  // Step 1
  const [requestName, setRequestName] = useState("November Fresh Produce Order");
  const [description, setDescription] = useState("Weekly produce restock for kitchen — vegetables, herbs, and fruit. Priority on leafy greens and root vegetables for the seasonal menu.");
  const [procurementType, setProcurementType] = useState("products");
  const [productType, setProductType] = useState("food-beverage");

  // Step 2
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', name: 'Baby Spinach (500g bag)', category: 'Leafy Greens', qty: 20, unit: 'bags', unitPrice: 4.50 },
    { id: '2', name: 'Cherry Tomatoes', category: 'Vegetables', qty: 15, unit: 'punnets', unitPrice: 3.80 },
    { id: '3', name: 'Fresh Basil Bunch', category: 'Herbs', qty: 10, unit: 'bunches', unitPrice: 2.20 },
  ]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemPrice, setNewItemPrice] = useState("");

  // Step 3
  const [budget, setBudget] = useState("500");
  const [budgetType, setBudgetType] = useState("flexible");
  const [neededBy, setNeededBy] = useState("2026-04-05");
  const [urgency, setUrgency] = useState("standard");

  // Step 4
  const [selectedVendors, setSelectedVendors] = useState<string[]>(['fresh-farm']);
  const [autonomy, setAutonomy] = useState("L1");
  const [groupBuying, setGroupBuying] = useState(false);
  const [deployedWorkflow, setDeployedWorkflow] = useState<string | null>(null);
  // Confirmation modal for sharing volume into a group buy pool.
  const [groupBuyConfirmOpen, setGroupBuyConfirmOpen] = useState(false);

  // Express deep-link prefill — Orders, Inventory, and Suppliers all
  // hand off here via the URL hash. Three intent landings:
  //   • mode=blank   → Step 2 with auto-name        (+ New Order)
  //   • mode=reorder → Step 6 with full prefill     (Re-order This PO)
  //   • restock=...  → Step 4 with locked items     (Restock Now from Inventory)
  const [inventoryContext, setInventoryContext] = useState<{
    skuId?: string;
    skuName?: string;
    items?: string[];
    vendor?: string;
    urgent?: boolean;
  } | null>(null);
  type ExpressMode = 'blank' | 'reorder' | 'restock' | null;
  const [expressMode, setExpressMode] = useState<ExpressMode>(null);
  const [expressContext, setExpressContext] = useState<{ from?: string; vendor?: string } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const intent = params.get('intent');
    const mode = params.get('mode'); // blank | reorder
    const restock = params.get('restock');

    // ── Restock (Strategic Fill) — Inventory → Step 4 ──
    if (restock) {
      const itemsParsed = params.get('items')?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
      const vendor = params.get('vendor') ?? undefined;
      setExpressMode('restock');
      setInventoryContext({
        skuId: restock,
        skuName: itemsParsed[0]?.split(/\s\d/)[0]?.trim(),
        items: itemsParsed,
        vendor,
        urgent: true,
      });
      if (itemsParsed.length > 0) {
        setRequestName(`Restock — ${itemsParsed[0]}`);
        setDescription(`Auto-drafted from Inventory. SKU: ${restock}. Triggered by stock falling below par.`);
        setItems(itemsParsed.map((label, i) => {
          const m = label.match(/^(.+?)\s+(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
          return m
            ? { id: `inv-${i}`, name: m[1], category: 'Restock', qty: parseFloat(m[2]) || 1, unit: m[3], unitPrice: 0 }
            : { id: `inv-${i}`, name: label, category: 'Restock', qty: 1, unit: 'units', unitPrice: 0 };
        }));
        setUrgency('urgent');
        setProcurementType('products');
        setProductType('food-beverage');
      }
      setStep(4); // Strategic Fill lands on Labor Assignment
      window.location.hash = '';
      return;
    }

    // ── Express modes from Orders ──
    if (intent === 'express' && mode === 'blank') {
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setRequestName(`Express Order · ${stamp}`);
      setDescription('Express-lane order initiated from Orders dashboard. Discovery and intent steps skipped.');
      setExpressMode('blank');
      setStep(2); // Blank Canvas lands on Items
      window.location.hash = '';
      return;
    }

    if (intent === 'express' && mode === 'reorder') {
      const from = params.get('from') ?? undefined;
      const vendor = params.get('vendor') ?? undefined;
      const itemsParsed = params.get('items')?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
      setExpressMode('reorder');
      setExpressContext({ from, vendor });
      if (from) setRequestName(`Re-order of ${from}`);
      setDescription(`Carbon-copy re-order from ${from ?? 'a previous PO'}${vendor ? ` (${vendor})` : ''}. All inputs cloned from the source.`);
      if (itemsParsed.length > 0) {
        setItems(itemsParsed.map((label, i) => ({
          id: `re-${i}`, name: label, category: 'Re-order',
          qty: 1, unit: 'units', unitPrice: 0,
        })));
      }
      setProcurementType('products');
      setProductType('food-beverage');
      setStep(6); // Carbon Copy lands on Review
      window.location.hash = '';
      return;
    }
  }, []);

  // Step 5
  const [deliveryAddress, setDeliveryAddress] = useState("123 Market Street, San Francisco, CA 94103");
  const [deliveryContact, setDeliveryContact] = useState("John Doe — +1 (555) 123-4567");
  const [deliveryWindow, setDeliveryWindow] = useState("morning");
  const [specialInstructions, setSpecialInstructions] = useState("Please deliver to loading dock (rear entrance). Call 30 min before arrival.");
  const [recurring, setRecurring] = useState(false);

  const itemsTotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);

  function addItem() {
    if (!newItemName.trim()) return;
    setItems([...items, {
      id: Date.now().toString(),
      name: newItemName,
      category: 'General',
      qty: parseInt(newItemQty) || 1,
      unit: 'units',
      unitPrice: parseFloat(newItemPrice) || 0,
    }]);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemPrice("");
  }

  function removeItem(id: string) {
    setItems(items.filter(i => i.id !== id));
  }

  function toggleVendor(id: string) {
    setSelectedVendors(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  }

  function handleSubmit() {
    const tier = AUTONOMY_TIERS.find(a => a.value === autonomy);
    const agentLabel = tier?.agent
      ? `Agent #${String(tier.agent.id).padStart(2, '0')} (${tier.agent.role})`
      : 'Manual ownership · no agent assigned';
    toast.success(`PO-2026-0147 authorized · routed to Orders`, {
      description: `${agentLabel} will own execution. Stage 1 (PO Approval) and Stage 12 (Delivery Confirmation) remain HITL-gated.`,
    });
    setStep(7);
    // Brief: redirect the user to Orders with the new PO landing on its journey.
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.hash = `order=PO-2026-0147`;
      }
      onNavigate?.('orders');
    }, 1400);
  }

  // Group Buy match resolution — guarded by the confirmation modal.
  const groupBuyMatch = useMemo(() => {
    // For demo: treat any food-beverage request as a candidate for the seeded pool.
    if (productType !== 'food-beverage') return null;
    return SIMULATED_POOL_MATCH;
  }, [productType]);

  const confirmJoinPool = () => {
    setGroupBuying(true);
    setGroupBuyConfirmOpen(false);
    if (groupBuyMatch) {
      toast.success(`Joined Pool ${groupBuyMatch.id}`, {
        description: `${groupBuyMatch.members.length} operators · −${groupBuyMatch.estDiscountPct}% est. unit cost · binding for ${groupBuyMatch.windowDays}-day window.`,
      });
    }
  };

  // Toggle handler — flipping ON triggers the confirmation modal; flipping OFF is immediate.
  const handleGroupBuyToggle = (next: boolean) => {
    if (next) {
      setGroupBuyConfirmOpen(true);
    } else {
      setGroupBuying(false);
      toast.info('Left group buy pool · solo PO');
    }
  };

  const cardClass = `rounded-lg p-6 mb-6 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white border border-gray-200'}`;
  const labelClass = isDark ? 'text-gray-200' : 'text-gray-900';
  const inputClass = `mt-2 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white'}`;
  const hintClass = `text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`;

  // ── Sourcing DAG · denser stage tracker ───────────────────────
  // Replaces the simple bar with a labeled DAG-style stepper. Done stages
  // get a sage check; the active stage is highlighted; future stages show
  // their numeric position so the Admin sees the full sourcing graph at once.
  const SourcingDAG = () => (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        {STEP_LABELS.slice(0, 6).map((label, i) => {
          const num = i + 1;
          const done = num < step;
          const active = num === step;
          return (
            <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
              <button
                onClick={() => num < step && setStep(num)}
                disabled={num >= step}
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                  done
                    ? 'bg-[#87986a] text-white cursor-pointer hover:bg-[#6b7a54]'
                    : active
                      ? 'bg-amber-500 text-white ring-2 ring-amber-500/30 ring-offset-1 ' + (isDark ? 'ring-offset-[#2a2a2a]' : 'ring-offset-white')
                      : isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-500'
                }`}>
                {done ? <CheckCircle className="h-3 w-3" /> : num}
              </button>
              <span className={`text-[10px] font-semibold truncate ${
                done ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                : active ? t.textPrimaryColor
                : isDark ? 'text-gray-500' : 'text-gray-500'
              }`}>{label}</span>
              {i < 5 && (
                <div className={`flex-1 h-0.5 min-w-[6px] rounded-full transition-colors ${
                  done ? 'bg-[#87986a]' : isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Vendor directory (right panel reactive reliability) ────────
  const VENDOR_DIRECTORY: Record<string, { name: string; reliability: number; onTime: number; coldChain: number; lane: string; flag: string }> = {
    'fresh-farm':    { name: 'Fresh Farm Supply Co.', reliability: 96, onTime: 98, coldChain: 94, lane: 'Local · Bay Area', flag: '🇺🇸' },
    'green-valley':  { name: 'Green Valley Organics', reliability: 88, onTime: 91, coldChain: 89, lane: 'CA · 1-day',       flag: '🇺🇸' },
    'metro-produce': { name: 'Metro Produce Ltd.',    reliability: 82, onTime: 85, coldChain: 78, lane: 'Same-day in-city', flag: '🇺🇸' },
  };
  const primaryVendor = selectedVendors[0] ? VENDOR_DIRECTORY[selectedVendors[0]] ?? null : null;

  // ── Discovery content · category-tagged ad placements ─────────
  const FEATURED_VIDEOS_ALL = [
    { title: 'Negotiating Q3 protein contracts',  duration: '4:12', thumbColor: '#991b1b', categories: ['food-beverage', 'protein'] },
    { title: 'Group buying for restaurants 101',   duration: '6:48', thumbColor: '#0e7490', categories: ['food-beverage', 'all'] },
    { title: 'Cold-chain QC checklist',            duration: '3:22', thumbColor: '#166534', categories: ['food-beverage', 'protein', 'seafood', 'produce'] },
    { title: 'Bulk produce sourcing playbook',     duration: '5:01', thumbColor: '#166534', categories: ['food-beverage', 'produce'] },
    { title: 'Seafood traceability deep-dive',     duration: '4:45', thumbColor: '#075985', categories: ['food-beverage', 'seafood'] },
    { title: 'Office supplies — paper vs digital', duration: '2:48', thumbColor: '#334155', categories: ['office-supplies'] },
    { title: 'Service contract negotiation',       duration: '7:15', thumbColor: '#4338ca', categories: ['services'] },
    { title: 'IT hardware procurement basics',     duration: '4:33', thumbColor: '#7e22ce', categories: ['it-hardware'] },
  ];
  const POPULAR_PRODUCTS_ALL = [
    { name: 'Lamb Rack',         price: '$185/kg',     velocity: 'Hot · 6kg/day',     categories: ['food-beverage', 'protein'] },
    { name: 'Tiger Prawns',      price: '$310/kg',     velocity: 'Hot · 4.5kg/day',   categories: ['food-beverage', 'seafood'] },
    { name: 'Salmon Fillet',     price: '$280/kg',     velocity: 'Watch · 5kg/day',   categories: ['food-beverage', 'seafood'] },
    { name: 'Cherry Tomatoes',   price: '$3.80/punnet',velocity: 'Steady · 12kg/day', categories: ['food-beverage', 'produce'] },
    { name: 'Baby Spinach',      price: '$4.50/bag',   velocity: 'Hot · 20bag/day',   categories: ['food-beverage', 'produce'] },
    { name: 'A4 Copy Paper',     price: '$42/case',    velocity: 'Steady',            categories: ['office-supplies'] },
    { name: 'Standing Desks',    price: '$580/unit',   velocity: 'New rollout',       categories: ['office-supplies', 'it-hardware'] },
  ];

  const activeCategoryTags = useMemo(() => {
    const tags = new Set<string>();
    if (productType) tags.add(productType);
    items.forEach(i => {
      const c = i.category.toLowerCase();
      if (c.includes('protein') || c.includes('lamb') || c.includes('beef') || c.includes('chicken')) tags.add('protein');
      if (c.includes('seafood') || c.includes('fish') || c.includes('prawn') || c.includes('squid')) tags.add('seafood');
      if (c.includes('produce') || c.includes('green') || c.includes('herb') || c.includes('vegetable') || c.includes('tomato') || c.includes('spinach')) tags.add('produce');
    });
    return tags;
  }, [productType, items]);

  // Step 1 = exploration mode; left panel stays untouched (no filter applied).
  // Filtering kicks in at Step 2 once the Admin commits to a category and items.
  const FEATURED_VIDEOS = useMemo(() => {
    if (step <= 1) return FEATURED_VIDEOS_ALL.slice(0, 3);
    return FEATURED_VIDEOS_ALL.filter(v => v.categories.some(c => activeCategoryTags.has(c) || c === 'all')).slice(0, 3);
  }, [activeCategoryTags, step]);
  const POPULAR_PRODUCTS = useMemo(() => {
    if (step <= 1) return POPULAR_PRODUCTS_ALL.slice(0, 4);
    return POPULAR_PRODUCTS_ALL.filter(p => p.categories.some(c => activeCategoryTags.has(c))).slice(0, 4);
  }, [activeCategoryTags, step]);

  const activeCategoryLabel = useMemo(() => {
    if (step <= 1) return 'All categories'; // explicit: Step 1 is unscoped
    const labels: string[] = [];
    if (activeCategoryTags.has('protein')) labels.push('Protein');
    if (activeCategoryTags.has('seafood')) labels.push('Seafood');
    if (activeCategoryTags.has('produce')) labels.push('Produce');
    if (labels.length === 0 && productType) {
      labels.push(productType.replace('-', ' & ').replace(/\b\w/g, c => c.toUpperCase()));
    }
    return labels.length > 0 ? labels.join(' · ') : 'All categories';
  }, [activeCategoryTags, productType, step]);

  // ── Strategic History (Steps 3-6) ─────────────────────────────
  const STRATEGIC_HISTORY = useMemo(() => {
    if (items.length === 0) return [];
    const sample = items[0];
    return [
      { id: 'PO-2855', date: 'Apr 11', vendor: 'AUS Meats Pty', qty: sample.qty,        unitPrice: sample.unitPrice * 1.04, issue: null as string | null, status: 'Delivered' },
      { id: 'PO-2830', date: 'Apr 5',  vendor: 'AUS Meats Pty', qty: sample.qty * 0.85, unitPrice: sample.unitPrice * 0.97, issue: null,                  status: 'Delivered' },
      { id: 'PO-2802', date: 'Mar 28', vendor: 'PT Sumber',     qty: sample.qty * 1.1,  unitPrice: sample.unitPrice * 1.08, issue: 'Late by 6h',          status: 'Late' },
    ];
  }, [items]);

  // ── Atlas chat state (always available in the right panel) ─────
  const [atlasInput, setAtlasInput] = useState('');
  const [atlasMessages, setAtlasMessages] = useState<{ from: 'user' | 'atlas'; text: string }[]>([]);

  // Validation Mode — when arriving via an Express deep-link, skip Atlas's
  // standard "introduction" coaching and post a validation message immediately.
  useEffect(() => {
    if (!expressMode) return;
    const sourceLabel = expressContext?.from ?? 'this request';
    const vendor = expressContext?.vendor ?? 'your primary vetted vendor';
    let text = '';
    if (expressMode === 'reorder') {
      text = `I've validated this re-order from ${sourceLabel}. Prices stable, vendor (${vendor}) reliability holding at 96, Agent #07 ready to deploy. Skip to authorization when you're ready.`;
    } else if (expressMode === 'restock') {
      text = `I've validated this restock. Critical SKU items locked, vendor pre-selected, urgency set to urgent. Pick your autonomy tier and deploy.`;
    } else if (expressMode === 'blank') {
      text = `Express lane open. Add line items below — I'll validate prices against the 30-day market median in real time.`;
    }
    if (text) {
      setAtlasMessages(prev => prev.length === 0 ? [{ from: 'atlas', text }] : prev);
    }
  }, [expressMode, expressContext]);
  const sendAtlas = () => {
    const q = atlasInput.trim();
    if (!q) return;
    setAtlasMessages(prev => [...prev, { from: 'user', text: q }]);
    setAtlasInput('');
    const responses: Record<number, string> = {
      1: `Frame the intent. The clearer the "why", the better I can map agents downstream.`,
      2: `Live 30-day median for these items lands you ~3.2% under market. Lock now if forecast looks tight.`,
      3: `You'd consume ~${(parseFloat(budget) || 500).toFixed(0)} of $12,000 monthly. On pace for healthy utilization.`,
      4: primaryVendor ? `${primaryVendor.name} scores ${primaryVendor.reliability} composite. Lane: ${primaryVendor.lane}.` : `Pick a vendor to see live reliability.`,
      5: `+1.5d buffer recommended for this lane (Java monsoon, Tanjung Priok congestion).`,
      6: `Final audit looks clean. Stage 1 + Stage 12 still gated to your manual authorization.`,
    };
    setTimeout(() => {
      setAtlasMessages(prev => [...prev, { from: 'atlas', text: responses[step] ?? 'Walking through your inputs now.' }]);
    }, 600);
  };

  // ── Draft-in-progress flag (sessionStorage) for top-bar pill ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasDraft = step >= 1 && step < 7 && (requestName.trim().length > 0 || items.length > 0 || !!inventoryContext);
    if (hasDraft) {
      sessionStorage.setItem('newRequestDraft', JSON.stringify({ step, name: requestName, items: items.length, ts: Date.now() }));
    } else {
      sessionStorage.removeItem('newRequestDraft');
    }
    window.dispatchEvent(new Event('newRequestDraftChanged'));
  }, [step, requestName, items.length, inventoryContext]);

  // Tiny token map for inline coloring inside the DAG.
  const t = {
    textPrimaryColor: isDark ? 'text-white' : 'text-gray-900',
  };

  // ── Left Panel (wizard-owned) ─────────────────────────────────
  // Step 1 = original ProductSidebar, fully untouched. Featured Videos,
  // Supplier Showcases, recommended item mocks all stay exactly as-is —
  // this is the founder's ad space and should not change in exploration mode.
  // Step 2+ swaps to wizard-aware Discovery / Strategic History panels.
  const wizardLeftPanel = step === 1 ? (
    <ProductSidebar theme={theme} />
  ) : (
    <div className={`flex flex-col h-full overflow-hidden ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          {step === 2 ? <Sparkles className={`h-3.5 w-3.5 ${SAGE.icon(isDark)}`} /> : <Clock className={`h-3.5 w-3.5 ${SAGE.icon(isDark)}`} />}
          <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {step === 2 ? 'Discovery' : 'Strategic History'}
          </h3>
          <span className={`ml-auto text-[9px] uppercase tracking-wide font-bold ${SAGE.icon(isDark)}`}>
            {step === 2 ? 'Plan' : 'Execute'}
          </span>
        </div>
        <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {step === 2 ? `Filtered to · ${activeCategoryLabel}`
          : 'Last 3 times you bought these items.'}
        </p>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {step === 2 ? (
          <div className="p-4 space-y-4">
            {groupBuyMatch && (
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users className={`h-3.5 w-3.5 ${SAGE.icon(isDark)}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Group Buy Alert</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Pool <strong>{groupBuyMatch.id}</strong> · {groupBuyMatch.members.length} operators · est. <strong>−{groupBuyMatch.estDiscountPct}%</strong>. Surfaces in Step 4 (Labor).
                </p>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Featured</div>
                <span className={`text-[9px] ${SAGE.icon(isDark)}`}>
                  for {activeCategoryLabel}
                </span>
              </div>
              {FEATURED_VIDEOS.length === 0 ? (
                <div className={`p-2 text-[10px] rounded ${isDark ? 'bg-[#2a2a2a] text-gray-500' : 'bg-gray-50 text-gray-500'}`}>
                  No featured content for this category yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {FEATURED_VIDEOS.map(v => (
                    <button key={v.title} className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                      isDark ? 'bg-[#2a2a2a] border-gray-800 hover:border-gray-700' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className="w-10 h-10 rounded shrink-0 flex items-center justify-center" style={{ background: `${v.thumbColor}33` }}>
                        <FileText className="h-3.5 w-3.5" style={{ color: v.thumbColor }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11px] font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{v.title}</div>
                        <div className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{v.duration}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Popular this week · {activeCategoryLabel}
              </div>
              {POPULAR_PRODUCTS.length === 0 ? (
                <div className={`p-2 text-[10px] rounded ${isDark ? 'bg-[#2a2a2a] text-gray-500' : 'bg-gray-50 text-gray-500'}`}>
                  Pick a product category to see relevant SKUs.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {POPULAR_PRODUCTS.map(p => (
                    <div key={p.name} className={`flex items-center gap-2 p-2 rounded-lg border ${
                      isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <ShoppingCart className={`h-3 w-3 shrink-0 ${SAGE.icon(isDark)}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-[11px] font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.name}</div>
                        <div className={`text-[9px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{p.price} · {p.velocity}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {STRATEGIC_HISTORY.length === 0 ? (
              <div className={`p-3 rounded-lg text-[10px] ${isDark ? 'bg-[#2a2a2a] text-gray-500' : 'bg-gray-50 text-gray-500'}`}>
                Add line items to see prior orders for these SKUs.
              </div>
            ) : (
              <>
                <div className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
                  Last 3 orders for <strong>{items[0]?.name ?? 'this SKU'}</strong>:
                </div>
                {STRATEGIC_HISTORY.map(h => (
                  <div key={h.id} className={`p-3 rounded-lg border ${
                    h.issue
                      ? isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50 border-amber-300/50'
                      : isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{h.id}</span>
                      <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{h.date}</span>
                    </div>
                    <div className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{h.vendor}</div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className={`text-[11px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{h.qty.toFixed(1)} × @${h.unitPrice.toFixed(2)}</span>
                      <span className={`text-[9px] font-bold ${
                        h.status === 'Delivered'
                          ? isDark ? 'text-green-400' : 'text-green-600'
                          : isDark ? 'text-amber-300' : 'text-amber-700'
                      }`}>{h.status}</span>
                    </div>
                    {h.issue && (
                      <div className={`mt-1.5 text-[9px] flex items-center gap-1 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                        <AlertTriangle className="h-2.5 w-2.5" /> {h.issue}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  // ── Right Panel · Reactive Atlas Copilot + persistent chat ────
  const wizardRightPanel = (
    <div className={`flex flex-col h-full overflow-hidden ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className={`h-3.5 w-3.5 ${SAGE.icon(isDark)}`} />
          <h3 className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Atlas Copilot</h3>
          <span className={`ml-auto text-[9px] uppercase tracking-wide font-bold ${SAGE.icon(isDark)}`}>Step {Math.min(step, 6)} · {STEP_LABELS[step - 1] ?? ''}</span>
        </div>
        <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {step === 1 && 'Frame the strategic intent.'}
          {step === 2 && 'Live market price validation.'}
          {step === 3 && 'Budget against monthly category pulse.'}
          {step === 4 && (primaryVendor ? `Reliability for ${primaryVendor.name}` : 'Vendor reliability + group buy.')}
          {step === 5 && 'Logistics risk on this lane.'}
          {step === 6 && 'Final audit summary before deploy.'}
          {step === 7 && 'Hand-off complete.'}
        </p>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {step === 1 && (
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Atlas · Strategic Intent</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Describe <em>why</em> — not just <em>what</em>. The clearer your intent, the better I can recommend agents and pools downstream.
              </p>
            </div>
          )}
          {step === 2 && (
            <>
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Market Price Trends</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Estimated total <strong>${itemsTotal.toFixed(2)}</strong> · 30d median puts you <strong className="text-green-500">3.2% under market</strong>.
                </p>
              </div>
              {inventoryContext && (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-300/60'}`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Atlas · Safety Buffer</span>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    I've added a <strong>10kg safety buffer</strong> because your current shipment <strong>PO-2855</strong> is delayed by 4 hours.
                  </p>
                </div>
              )}
            </>
          )}
          {step === 3 && (() => {
            const monthlyBudget = 12000;
            const spentSoFar = 8420;
            const thisRequest = parseFloat(budget) || itemsTotal;
            const overBudget = spentSoFar + thisRequest > monthlyBudget;
            return (
              <div className={`p-3 rounded-lg border ${
                overBudget
                  ? isDark ? 'bg-red-500/8 border-red-500/30' : 'bg-red-50 border-red-300/60'
                  : isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
              }`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Activity className={`h-3 w-3 ${overBudget ? 'text-red-500' : SAGE.icon(isDark)}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${
                    overBudget ? isDark ? 'text-red-300' : 'text-red-700' : isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                  }`}>Spending Pulse · {productType.replace('-', ' & ')}</span>
                </div>
                <p className={`text-[11px] leading-relaxed mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  This request consumes <strong>${thisRequest.toFixed(0)}</strong> of your <strong>${monthlyBudget.toLocaleString()}</strong> monthly category budget.
                </p>
                <div className={`h-2 rounded-full overflow-hidden flex ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                  <div className="h-full bg-[#87986a]" style={{ width: `${(spentSoFar / monthlyBudget) * 100}%` }} />
                  <div className={`h-full ${overBudget ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${(thisRequest / monthlyBudget) * 100}%` }} />
                </div>
              </div>
            );
          })()}
          {step === 4 && (
            <>
              {deployedWorkflow && (() => {
                const wf = workflowTemplates.find(w => w.id === deployedWorkflow);
                if (!wf) return null;
                return (
                  <div className={`p-3 rounded-lg border mb-0 ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Cpu className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Mission Brief Active</span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <strong>{wf.name}</strong> kernel engaged — {wf.stages.length} DAG stages mapped, {wf.agentClasses.length} agent classes briefed. Stage 1 will trigger immediately on authorization.
                    </p>
                  </div>
                );
              })()}
              {primaryVendor ? (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Activity className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Reliability · {primaryVendor.flag} {primaryVendor.name}</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Composite reliability', value: primaryVendor.reliability },
                      { label: 'On-time delivery',       value: primaryVendor.onTime },
                      { label: 'Cold-chain integrity',   value: primaryVendor.coldChain },
                    ].map(m => (
                      <div key={m.label}>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{m.label}</span>
                          <span className={`font-bold ${m.value >= 90 ? 'text-green-500' : m.value >= 80 ? 'text-amber-500' : 'text-red-500'}`}>{m.value}</span>
                        </div>
                        <div className={`h-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                          <div className={`h-1 rounded-full ${m.value >= 90 ? 'bg-green-500' : m.value >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                  <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Select a vendor to see live reliability data.</p>
                </div>
              )}
              {groupBuyMatch && (
                <div className={`p-3 rounded-lg border ${
                  groupBuying
                    ? isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
                    : isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-300/60'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Users className={`h-3 w-3 ${groupBuying ? isDark ? 'text-green-300' : 'text-green-700' : 'text-amber-500'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${
                      groupBuying ? isDark ? 'text-green-300' : 'text-green-700' : isDark ? 'text-amber-300' : 'text-amber-700'
                    }`}>
                      {groupBuying ? 'Pool Joined' : 'Group Buy Opportunity'}
                    </span>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {groupBuying
                      ? <>You're in <strong>Pool {groupBuyMatch.id}</strong>. Volume locked for {groupBuyMatch.windowDays} days.</>
                      : <>Pool <strong>{groupBuyMatch.id}</strong> available · est. <strong>−{groupBuyMatch.estDiscountPct}%</strong>. Toggle to join.</>}
                  </p>
                </div>
              )}
            </>
          )}
          {step === 5 && (
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-300/60'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Truck className="h-3 w-3 text-amber-500" />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Logistics Risk Map</span>
              </div>
              <div className="space-y-1.5">
                <div className={`p-2 rounded ${isDark ? 'bg-amber-500/10' : 'bg-amber-100/60'}`}>
                  <div className={`text-[10px] font-bold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>🌧️ Java · Monsoon advisory</div>
                  <div className={`text-[9px] ${isDark ? 'text-amber-200/80' : 'text-amber-900/80'}`}>+1 day on seafood routes</div>
                </div>
                <div className={`p-2 rounded ${isDark ? 'bg-red-500/10' : 'bg-red-100/60'}`}>
                  <div className={`text-[10px] font-bold ${isDark ? 'text-red-200' : 'text-red-900'}`}>⚠ Tanjung Priok · Port congestion</div>
                  <div className={`text-[9px] ${isDark ? 'text-red-200/80' : 'text-red-900/80'}`}>+6h inbound, +12h outbound</div>
                </div>
                <div className={`p-2 rounded ${isDark ? 'bg-green-500/10' : 'bg-green-100/60'}`}>
                  <div className={`text-[10px] font-bold ${isDark ? 'text-green-200' : 'text-green-900'}`}>✓ Australia · All clear</div>
                </div>
              </div>
            </div>
          )}
          {step === 6 && (
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>Audit Summary</span>
              </div>
              <div className="space-y-1.5 text-[10px]">
                {[
                  { label: 'Items vetted', value: `${items.length} SKU${items.length === 1 ? '' : 's'} · all in directory`, ok: true },
                  { label: 'Vendor selection', value: `${selectedVendors.length} vetted · ${primaryVendor?.reliability ?? '—'} score`, ok: !!primaryVendor },
                  { label: 'Labor assigned', value: AUTONOMY_TIERS.find(a => a.value === autonomy)?.agent ? `Agent #${String(AUTONOMY_TIERS.find(a => a.value === autonomy)!.agent!.id).padStart(2, '0')} · ${AUTONOMY_TIERS.find(a => a.value === autonomy)!.agent!.role}` : 'Manual', ok: true },
                  { label: 'Group Buy', value: groupBuying && groupBuyMatch ? `Pool ${groupBuyMatch.id} · −${groupBuyMatch.estDiscountPct}%` : 'Solo PO', ok: true },
                  { label: 'Mission Brief', value: deployedWorkflow ? `${workflowTemplates.find(w => w.id === deployedWorkflow)?.name ?? ''} · ${workflowTemplates.find(w => w.id === deployedWorkflow)?.stages.length ?? 0} stages` : 'No template deployed', ok: !!deployedWorkflow },
                  { label: 'HITL gates', value: 'Stage 1 + Stage 12 require manual auth', ok: true, warn: true },
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-1.5">
                    {row.warn ? <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                              : row.ok ? <CheckCircle className="h-3 w-3 shrink-0 mt-0.5 text-green-500" />
                              : <X className="h-3 w-3 shrink-0 mt-0.5 text-red-500" />}
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.label}</div>
                      <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Atlas conversation transcript — always rendered, fills as the user chats */}
          {atlasMessages.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Conversation</div>
              {atlasMessages.map((m, i) => (
                <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] px-2.5 py-1.5 rounded-lg text-[10px] leading-relaxed ${
                    m.from === 'user'
                      ? isDark ? 'bg-[#87986a]/20 text-[#dbe3ce]' : 'bg-[#87986a]/15 text-[#3d4933]'
                      : isDark ? 'bg-[#2a2a2a] text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
      {/* ═══ ALWAYS-ON CHAT INPUT (Atlas global rule) ═══ */}
      <div className={`shrink-0 p-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-end gap-1.5">
          <textarea
            value={atlasInput}
            onChange={(e) => setAtlasInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAtlas(); } }}
            placeholder={`Ask Atlas about ${STEP_LABELS[step - 1]?.toLowerCase() ?? 'this request'}…`}
            rows={1}
            className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11px] resize-none outline-none ${
              isDark ? 'bg-[#2a2a2a] border border-gray-700 text-white placeholder:text-gray-500' : 'bg-gray-50 border border-gray-200 placeholder:text-gray-400'
            }`}
          />
          <Button onClick={sendAtlas} disabled={!atlasInput.trim()}
            size="sm"
            className={`shrink-0 h-7 w-7 p-0 ${atlasInput.trim() ? 'bg-[#87986a] hover:bg-[#6b7a54] text-white' : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className={`text-[8px] mt-1 text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Atlas is always here · ask anything about your request, vendors, or pricing.
        </p>
      </div>
    </div>
  );

  return (
    <div className={`flex h-full ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
      {/* ═══ LEFT SIDEBAR · Discovery → Strategic History ═══ */}
      <div className={`w-72 h-full border-r shrink-0 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        {wizardLeftPanel}
      </div>

      {/* ═══ CENTER · Sourcing Wizard ═══ */}
      <div className={`flex flex-col h-full flex-1 min-w-0 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
      {/* ═══ SOVEREIGN HEADER · Strategic Sourcing Portal ═══ */}
      <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${
                isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
              }`}>
                <ShieldCheck className="h-2.5 w-2.5" />
                Strategic Sourcing Portal
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
              }`}>
                <Lock className="h-2.5 w-2.5" /> Internal Directory
              </span>
            </div>
            <h1 className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {step === 7 ? 'PO Authorized · Routing to Orders' : 'Authorize a new procurement'}
            </h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {step === 1 && 'Frame the strategic need · what and why'}
              {step === 2 && 'Lock the line items · prices preview live in the right rail'}
              {step === 3 && 'Set budget guardrails and the deadline window'}
              {step === 4 && 'Choose vetted vendors and assign agent labor'}
              {step === 5 && 'Confirm delivery — logistics risk surfaces in the right rail'}
              {step === 6 && 'Review the full DAG before authorization'}
              {step === 7 && 'Hand-off complete · agent picking up the journey on Orders'}
            </p>
            {step < 7 && <SourcingDAG />}
          </div>
        </div>

        {/* Express Mode banner — visible whenever a deep-link landed on a non-default step */}
        {expressMode && expressMode !== 'restock' && step < 7 && (
          <div className={`mt-3 p-2.5 rounded-lg border flex items-center gap-2 flex-wrap ${
            isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-300/60'
          }`}>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
              isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
            }`}>
              ⚡ Express Lane
            </span>
            <span className={`text-[11px] font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
              {expressMode === 'reorder'
                ? `Carbon copy of ${expressContext?.from ?? 'a previous PO'} · jumped to Step 6 (Review)`
                : `Blank canvas · jumped to Step 2 (Items)`}
            </span>
            <span className={`text-[10px] ${isDark ? 'text-blue-300/80' : 'text-blue-700/80'}`}>
              Discovery and intent steps skipped — Atlas pre-validated.
            </span>
            <button onClick={() => { setExpressMode(null); setStep(1); }}
              className={`ml-auto text-[10px] font-bold ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-900'}`}>
              ← Restart from Step 1
            </button>
          </div>
        )}

        {/* Inventory deep-link banner — Stock Heartbeat reminder */}
        {inventoryContext && step < 7 && (
          <div className={`mt-3 p-2.5 rounded-lg border flex items-center gap-2 flex-wrap ${
            isDark ? 'bg-red-500/8 border-red-500/30' : 'bg-red-50 border-red-300/60'
          }`}>
            <Flame className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            <span className={`text-[11px] font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
              Pre-filled from Inventory · {inventoryContext.skuId}
            </span>
            <span className={`text-[10px] ${isDark ? 'text-red-300/80' : 'text-red-700/80'}`}>
              {inventoryContext.skuName ?? 'SKU'} fell below par · auto-set urgency to <strong>urgent</strong>
              {inventoryContext.vendor ? ` · vendor ${inventoryContext.vendor} pre-selected` : ''}
            </span>
            <button onClick={() => {
              if (inventoryContext?.skuId) {
                window.dispatchEvent(new CustomEvent('buyamia-restock-intent-failed', {
                  detail: { skuId: inventoryContext.skuId, skuName: inventoryContext.skuName ?? inventoryContext.skuId },
                }));
              }
              setInventoryContext(null);
            }}
              className={`ml-auto text-[10px] ${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-800'}`}>
              Dismiss
            </button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div key={step}
             className="px-6 py-6 max-w-3xl mx-auto w-full"
             style={{ animation: 'wizard-slide-in 280ms cubic-bezier(0.34, 1.4, 0.64, 1)' }}>
          <style>{`
            @keyframes wizard-slide-in {
              0%   { opacity: 0; transform: translateX(12px); }
              100% { opacity: 1; transform: translateX(0); }
            }
          `}</style>

          {/* ─── STEP 1: Request Details ─────────────────────────── */}
          {step === 1 && (
            <>
              <div className={cardClass}>
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="requestName" className={labelClass}>
                      Request Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="requestName"
                      placeholder="e.g., November Fresh Produce Order"
                      value={requestName}
                      onChange={(e) => setRequestName(e.target.value)}
                      className={inputClass}
                    />
                    <p className={hintClass}>Choose a name that clearly identifies what you're procuring</p>
                  </div>

                  <div>
                    <Label htmlFor="description" className={labelClass}>Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide any additional context..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`${inputClass} min-h-[90px]`}
                    />
                  </div>

                  <div>
                    <Label className={labelClass}>What are you procuring? <span className="text-red-500">*</span></Label>
                    <RadioGroup value={procurementType} onValueChange={setProcurementType} className="mt-3 space-y-3">
                      {[
                        { value: 'products', label: 'Products', desc: 'Physical goods, materials, supplies' },
                        { value: 'services', label: 'Services', desc: 'Coming soon' },
                        { value: 'both', label: 'Products & Services', desc: 'Coming soon' },
                      ].map(opt => (
                        <div key={opt.value} className={`flex items-start p-4 rounded-lg border cursor-pointer transition-colors ${
                          procurementType === opt.value ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                        }`}>
                          <RadioGroupItem value={opt.value} id={opt.value} className="mt-0.5" />
                          <div className="ml-3">
                            <Label htmlFor={opt.value} className={`cursor-pointer ${isDark ? 'text-white' : 'text-gray-900'}`}>{opt.label}</Label>
                            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{opt.desc}</p>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {procurementType === 'products' && (
                    <div>
                      <Label className={labelClass}>Product Category <span className="text-red-500">*</span></Label>
                      <RadioGroup value={productType} onValueChange={setProductType} className="mt-3 grid grid-cols-2 gap-3">
                        {[
                          { value: 'food-beverage', label: 'Food & Beverage', desc: 'Produce, dry goods, beverages' },
                          { value: 'equipment', label: 'Equipment', desc: 'Kitchen, office, machinery' },
                          { value: 'office-supplies', label: 'Office Supplies', desc: 'Stationery, consumables' },
                          { value: 'other', label: 'Other', desc: 'Anything else' },
                        ].map(opt => (
                          <div key={opt.value} className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                            productType === opt.value ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                          }`}>
                            <RadioGroupItem value={opt.value} id={`pt-${opt.value}`} className="mt-0.5" />
                            <div className="ml-3">
                              <Label htmlFor={`pt-${opt.value}`} className={`cursor-pointer text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{opt.label}</Label>
                              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{opt.desc}</p>
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  <div className={`p-4 rounded-lg flex items-start gap-3 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                    <Sparkles className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    <p className={`text-sm ${isDark ? 'text-blue-200/80' : 'text-blue-800'}`}>
                      After this step you'll add items, set a budget, choose vendors, and configure delivery — then your request goes live.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    try {
                      sessionStorage.setItem('newRequestDraft', JSON.stringify({
                        step: 1,
                        name: requestName,
                        items: 0,
                        productType,
                        savedAt: Date.now(),
                      }));
                      window.dispatchEvent(new Event('newRequestDraftChanged'));
                    } catch { /* sessionStorage unavailable */ }
                    toast.success('Draft saved to this session', {
                      description: 'Production: drafts persist server-side with optimistic-concurrency locking, owner, version, and expiry. Listed on the Drafts page; multi-user collision shows "locked by X."',
                    });
                  }}
                  className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}
                >
                  Save Draft
                </Button>
                <Button disabled={!requestName.trim() || !productType} className={SAGE.primary(isDark)} onClick={() => setStep(2)}>
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 2: Add Items ───────────────────────────────── */}
          {step === 2 && (
            <>
              {/* Step-specific intelligence — Market Price Trends */}
              <div className={`mb-4 p-3 rounded-lg border flex items-start gap-2 ${
                isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
              }`}>
                <TrendingUp className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${SAGE.icon(isDark)}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[10px] font-bold uppercase tracking-wide ${SAGE.icon(isDark)}`}>
                    Atlas · Market Price Trends
                  </div>
                  <p className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {items.length > 0
                      ? <>Across <strong>{items.length}</strong> line items, 30d median moves: 2 trending <span className="text-green-500 font-bold">↓ 4.2%</span>, 1 trending <span className="text-amber-500 font-bold">↑ 3.1%</span>. Lock pricing now to capture the dip.</>
                      : <>Add line items to see live 30-day market median trends and price-lock opportunities.</>}
                  </p>
                </div>
              </div>
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={isDark ? 'text-white' : 'text-gray-900'}>Line Items</h3>
                  <div className={`text-sm font-medium ${SAGE.icon(isDark)}`}>
                    {items.length} item{items.length !== 1 ? 's' : ''} · Est. ${itemsTotal.toFixed(2)}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {items.map(item => (
                    <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                      <Package className={`h-4 w-4 flex-shrink-0 ${SAGE.icon(isDark)}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{item.category}</div>
                      </div>
                      <div className={`text-sm text-right flex-shrink-0 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div>{item.qty} {item.unit}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>${(item.qty * item.unitPrice).toFixed(2)}</div>
                      </div>
                      <button onClick={() => removeItem(item.id)} className={`p-1 rounded transition-colors ${isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <Separator className={`my-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />

                {/* Add item row */}
                <div>
                  <Label className={`${labelClass} text-sm mb-2 block`}>Add Item</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Item name"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addItem()}
                      className={`flex-1 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white'}`}
                    />
                    <Input
                      placeholder="Qty"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className={`w-20 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white'}`}
                    />
                    <Input
                      placeholder="$price"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      className={`w-24 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white'}`}
                    />
                    <Button size="sm" onClick={addItem} className={SAGE.primary(isDark)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* AI suggestion box */}
              <div className={`rounded-lg p-4 mb-6 flex items-start gap-3 ${isDark ? 'bg-[#87986a]/10 border border-[#87986a]/20' : 'bg-[#f4f6f0] border border-[#dbe3ce]'}`}>
                <Sparkles className={`h-4 w-4 mt-0.5 flex-shrink-0 ${SAGE.icon(isDark)}`} />
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-[#bfc89f]' : 'text-[#4f5c3e]'}`}>AI Suggestions</p>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Based on your last 3 orders, you typically also order <strong>Romaine Lettuce</strong> and <strong>Mixed Peppers</strong> with this produce bundle.
                  </p>
                  <button className={`text-xs mt-2 underline ${SAGE.icon(isDark)}`} onClick={() => {
                    setItems(prev => [
                      ...prev,
                      { id: 'ai1', name: 'Romaine Lettuce', category: 'Leafy Greens', qty: 12, unit: 'heads', unitPrice: 1.80 },
                      { id: 'ai2', name: 'Mixed Peppers', category: 'Vegetables', qty: 8, unit: 'kg', unitPrice: 5.50 },
                    ]);
                    toast.success("Added 2 AI-suggested items");
                  }}>Add suggested items</button>
                </div>
              </div>

              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button disabled={items.length === 0} className={SAGE.primary(isDark)} onClick={() => setStep(3)}>
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 3: Budget & Timeline ───────────────────────── */}
          {step === 3 && (
            <>
              <div className={cardClass}>
                <div className="space-y-6">
                  <div>
                    <Label className={labelClass}>Total Budget <span className="text-red-500">*</span></Label>
                    <div className="relative mt-2">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>$</span>
                      <Input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className={`pl-7 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : 'bg-white'}`}
                      />
                    </div>
                    <p className={hintClass}>Estimated total from items: <strong>${itemsTotal.toFixed(2)}</strong></p>
                  </div>

                  <div>
                    <Label className={labelClass}>Budget Type</Label>
                    <RadioGroup value={budgetType} onValueChange={setBudgetType} className="mt-3 grid grid-cols-2 gap-3">
                      {[
                        { value: 'fixed', label: 'Fixed', desc: 'Cannot exceed this amount' },
                        { value: 'flexible', label: 'Flexible', desc: 'Allow up to 10% over budget' },
                      ].map(opt => (
                        <div key={opt.value} className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                          budgetType === opt.value ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                        }`}>
                          <RadioGroupItem value={opt.value} id={`bt-${opt.value}`} className="mt-0.5" />
                          <div className="ml-3">
                            <Label htmlFor={`bt-${opt.value}`} className={`cursor-pointer text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{opt.label}</Label>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{opt.desc}</p>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="neededBy" className={labelClass}>Needed By <span className="text-red-500">*</span></Label>
                    <Input
                      id="neededBy"
                      type="date"
                      value={neededBy}
                      onChange={(e) => setNeededBy(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <Label className={labelClass}>Urgency</Label>
                    <RadioGroup value={urgency} onValueChange={setUrgency} className="mt-3 grid grid-cols-3 gap-3">
                      {[
                        { value: 'flexible', label: 'Flexible', color: 'text-blue-500', desc: '+2 days OK' },
                        { value: 'standard', label: 'Standard', color: 'text-[#87986a]', desc: 'On date' },
                        { value: 'urgent', label: 'Urgent', color: 'text-orange-500', desc: 'ASAP' },
                      ].map(opt => (
                        <div key={opt.value} className={`flex flex-col items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                          urgency === opt.value ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <RadioGroupItem value={opt.value} id={`urg-${opt.value}`} />
                            <Label htmlFor={`urg-${opt.value}`} className={`cursor-pointer text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{opt.label}</Label>
                          </div>
                          <p className={`text-xs ml-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{opt.desc}</p>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className={SAGE.primary(isDark)} onClick={() => setStep(4)}>
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 4: Vendor Preferences ──────────────────────── */}
          {step === 4 && (
            <>
              {/* Step-specific intelligence — Vendor Reliability */}
              <div className={`mb-4 p-3 rounded-lg border flex items-start gap-2 ${
                isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
              }`}>
                <Activity className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${SAGE.icon(isDark)}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[10px] font-bold uppercase tracking-wide ${SAGE.icon(isDark)}`}>
                    Atlas · Vendor Reliability
                  </div>
                  <p className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Top-3 vendors below scored against the last 90 days · cold-chain reliability, on-time %, dispute rate. All from your <strong>vetted internal directory</strong>.
                  </p>
                </div>
              </div>
              <div className={cardClass}>
                <h3 className={`mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>AI-Recommended Vendors</h3>
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Based on your order history and requirements</p>

                <div className="space-y-3 mb-6">
                  {[
                    { id: 'fresh-farm', name: 'Fresh Farm Supply Co.', score: 96, tag: 'Best Match', tagColor: 'bg-[#87986a]/10 text-[#87986a]', desc: 'Organic produce specialist — 98% on-time delivery', savings: 'Save 12%' },
                    { id: 'green-valley', name: 'Green Valley Organics', score: 88, tag: 'Eco-Certified', tagColor: 'bg-blue-500/10 text-blue-500', desc: 'Certified organic, local farm network', savings: 'Save 8%' },
                    { id: 'metro-produce', name: 'Metro Produce Ltd.', score: 82, tag: 'Fast Delivery', tagColor: 'bg-orange-500/10 text-orange-500', desc: 'Same-day delivery available within city', savings: 'Save 5%' },
                  ].map(vendor => (
                    <button
                      key={vendor.id}
                      onClick={() => toggleVendor(vendor.id)}
                      className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-colors ${
                        selectedVendors.includes(vendor.id) ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                        selectedVendors.includes(vendor.id) ? 'bg-[#87986a] border-[#87986a]' : isDark ? 'border-gray-600' : 'border-gray-300'
                      }`}>
                        {selectedVendors.includes(vendor.id) && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{vendor.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${vendor.tagColor}`}>{vendor.tag}</span>
                        </div>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{vendor.desc}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={`text-sm font-semibold ${SAGE.icon(isDark)}`}>{vendor.score}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{vendor.savings}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <Separator className={`my-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className={labelClass}>Autonomy Matrix · Labor Assignment</Label>
                    <span className={`text-[10px] font-bold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                      isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                    }`}>
                      <Bot className="h-2.5 w-2.5" /> {autonomy} selected
                    </span>
                  </div>
                  <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Each tier names the specific staff agent who'll own this PO once authorized.
                  </p>
                  <div className="space-y-2 mb-3">
                    {AUTONOMY_TIERS.map(lvl => {
                      const active = autonomy === lvl.value;
                      return (
                        <button
                          key={lvl.value}
                          onClick={() => setAutonomy(lvl.value)}
                          className={`w-full p-3 rounded-lg border text-left transition-colors flex items-start gap-3 ${
                            active ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                          }`}
                        >
                          <div className={`shrink-0 w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                            active ? 'bg-[#87986a] border-[#87986a]' : isDark ? 'border-gray-600' : 'border-gray-300'
                          }`}>
                            {active && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{lvl.label}</span>
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>· {lvl.desc}</span>
                              {/* Agent badge — explicit assignment per tier */}
                              {lvl.agent ? (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                  isDark ? 'bg-[#87986a]/20 border border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border border-[#87986a]/40 text-[#6b7a54]'
                                }`}>
                                  <Bot className="h-2.5 w-2.5" />
                                  Agent #{String(lvl.agent.id).padStart(2, '0')} · {lvl.agent.role}
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                  isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                                }`}>
                                  <Hand className="h-2.5 w-2.5" /> Human-led
                                </span>
                              )}
                            </div>
                            <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{lvl.scope}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {/* Governance Guardrail · HITL warning */}
                  <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                    isDark ? 'bg-amber-500/8 border-amber-500/40' : 'bg-amber-50 border-amber-400/50'
                  }`}>
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                    <div className="min-w-0">
                      <div className={`text-[11px] font-bold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                        Governance Guardrail
                      </div>
                      <p className={`text-[10px] mt-0.5 leading-relaxed ${isDark ? 'text-amber-200/80' : 'text-amber-900/80'}`}>
                        Even at <strong>L3 Full</strong>, you must manually <strong>Authorize PO Approval (Stage 1)</strong> and <strong>Confirm Delivery Receipt (Stage 12)</strong>. The agent never crosses these gates.
                      </p>
                    </div>
                  </div>
                </div>

                <Separator className={`my-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />

                {/* Group Buy · Copilot match handshake */}
                {groupBuyMatch && !groupBuying && (
                  <div className={`mb-3 p-3 rounded-lg border ${
                    isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Sparkles className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${SAGE.icon(isDark)}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                          Atlas · Group Buy match found
                        </div>
                        <p className={`text-[11px] leading-relaxed mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          Pool <strong>{groupBuyMatch.id}</strong> · {groupBuyMatch.members.length} operators ({groupBuyMatch.members.join(', ')}) · est. <strong>−{groupBuyMatch.estDiscountPct}% unit cost</strong> · {groupBuyMatch.windowDays}-day binding window.
                        </p>
                        <p className={`text-[10px] mt-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Sharing volume is a commercial decision · flip the toggle below to confirm explicit consent.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Join Group Buying Pool
                      {groupBuyMatch && !groupBuying && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                        }`}>
                          Match available · −{groupBuyMatch.estDiscountPct}%
                        </span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Combine with vetted operators to unlock volume discounts · explicit confirmation required.
                    </div>
                  </div>
                  <Switch checked={groupBuying} onCheckedChange={handleGroupBuyToggle} />
                </div>
                {groupBuying && groupBuyMatch && (
                  <div className={`mt-3 p-3 rounded-lg text-xs flex items-center gap-2 ${
                    isDark ? 'bg-green-500/10 text-green-300 border border-green-500/30' : 'bg-green-50 text-green-700 border border-green-200'
                  }`}>
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Volume share confirmed · <strong>Pool {groupBuyMatch.id}</strong> · {groupBuyMatch.members.length} operators · binding {groupBuyMatch.windowDays}-day window.</span>
                  </div>
                )}

                <Separator className={`my-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} />

                {/* Mission Brief · Kernel Workflow */}
                {(() => {
                  const WF_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
                    FileText, Zap, ScrollText, Users, AlertCircle, Factory, Wrench, Building2,
                  };
                  const COMPLEXITY_CLR: Record<string, string> = {
                    simple:  isDark ? 'text-green-400' : 'text-green-700',
                    medium:  isDark ? 'text-amber-400' : 'text-amber-700',
                    complex: isDark ? 'text-red-400'   : 'text-red-700',
                  };
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className={labelClass}>Mission Brief · Kernel Workflow</Label>
                        {deployedWorkflow && (
                          <span className={`text-[10px] font-bold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                            isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                          }`}>
                            <Cpu className="h-2.5 w-2.5" /> Briefed
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        Deploy a workflow template to give agents a structured execution brief. The kernel will follow this logic path once the PO is authorized.
                      </p>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {workflowTemplates.map(wf => {
                          const Icon = WF_ICONS[wf.icon] || FileText;
                          const isDeployed = deployedWorkflow === wf.id;
                          return (
                            <button
                              key={wf.id}
                              onClick={() => setDeployedWorkflow(isDeployed ? null : wf.id)}
                              className={`text-left p-3 rounded-lg border transition-colors ${
                                isDeployed ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <Icon className={`h-3.5 w-3.5 shrink-0 ${isDeployed ? SAGE.icon(isDark) : isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{wf.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] ${COMPLEXITY_CLR[wf.complexity]}`}>{wf.complexity}</span>
                                <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>·</span>
                                <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{wf.stages.length} stages</span>
                                {isDeployed && <CheckCircle className={`h-3 w-3 ml-auto ${SAGE.icon(isDark)}`} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {deployedWorkflow && (() => {
                        const wf = workflowTemplates.find(w => w.id === deployedWorkflow)!;
                        return (
                          <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                            isDark ? 'bg-[#87986a]/8 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
                          }`}>
                            <Cpu className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${SAGE.icon(isDark)}`} />
                            <div>
                              <div className={`text-[11px] font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                                Mission Brief deployed: {wf.name}
                              </div>
                              <p className={`text-[10px] mt-0.5 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {wf.stages.length} DAG stages · {wf.agentClasses.length} agent classes briefed · Stage 1 triggers on authorization · avg {wf.avgDuration}.
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button disabled={selectedVendors.length === 0} className={SAGE.primary(isDark)} onClick={() => setStep(5)}>
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 5: Delivery & Shipping ─────────────────────── */}
          {step === 5 && (
            <>
              {/* Step-specific intelligence — Logistics Risk Map */}
              <div className={`mb-4 p-3 rounded-lg border ${
                isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-300/60'
              }`}>
                <div className="flex items-start gap-2">
                  <Truck className={`h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[10px] font-bold uppercase tracking-wide ${
                      isDark ? 'text-amber-300' : 'text-amber-700'
                    }`}>
                      Atlas · Logistics Risk Map
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <strong>2 active risks on this lane:</strong> monsoon advisory adding ~1d to Java seafood routes · port congestion at Tanjung Priok adding ~6h to inbound. Build a <strong>+1.5 day buffer</strong> into your delivery window.
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px]">
                      <span className={`inline-flex items-center gap-1 ${isDark ? 'text-amber-200/80' : 'text-amber-800/80'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Java · Monsoon (+1d)
                      </span>
                      <span className={`inline-flex items-center gap-1 ${isDark ? 'text-amber-200/80' : 'text-amber-800/80'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Tanjung Priok · Port congestion (+6h)
                      </span>
                      <span className={`inline-flex items-center gap-1 ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Australia · Clear
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={cardClass}>
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="deliveryAddress" className={labelClass}>Delivery Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="deliveryAddress"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <Label htmlFor="deliveryContact" className={labelClass}>Delivery Contact</Label>
                    <Input
                      id="deliveryContact"
                      placeholder="Name — phone number"
                      value={deliveryContact}
                      onChange={(e) => setDeliveryContact(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <Label className={labelClass}>Preferred Delivery Window</Label>
                    <RadioGroup value={deliveryWindow} onValueChange={setDeliveryWindow} className="mt-3 grid grid-cols-3 gap-3">
                      {[
                        { value: 'morning', label: 'Morning', desc: '6am – 12pm' },
                        { value: 'afternoon', label: 'Afternoon', desc: '12pm – 5pm' },
                        { value: 'anytime', label: 'Anytime', desc: 'No preference' },
                      ].map(opt => (
                        <div key={opt.value} className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${
                          deliveryWindow === opt.value ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                        }`}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <RadioGroupItem value={opt.value} id={`dw-${opt.value}`} />
                            <Label htmlFor={`dw-${opt.value}`} className={`cursor-pointer text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{opt.label}</Label>
                          </div>
                          <p className={`text-xs ml-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{opt.desc}</p>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="specialInstructions" className={labelClass}>Special Instructions</Label>
                    <Textarea
                      id="specialInstructions"
                      placeholder="Access codes, loading dock details, fragile items..."
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className={`${inputClass} min-h-[80px]`}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Set as Recurring Order</div>
                      <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Repeat this order automatically on a schedule</div>
                    </div>
                    <Switch checked={recurring} onCheckedChange={setRecurring} />
                  </div>
                  {recurring && (
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                      <Label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Repeat every</Label>
                      <div className="flex gap-2 mt-2">
                        {['Weekly', 'Bi-weekly', 'Monthly'].map(freq => (
                          <button key={freq} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                            isDark ? 'border-gray-700 text-gray-300 hover:border-[#87986a] hover:text-[#a3b085]' : 'border-gray-200 text-gray-700 hover:border-[#87986a]'
                          }`}>{freq}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={() => setStep(4)} className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className={SAGE.primary(isDark)} onClick={() => setStep(6)}>
                  Review Request <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 6: Review & Confirm ────────────────────────── */}
          {step === 6 && (
            <>
              {/* Summary sections */}
              {[
                {
                  icon: FileText,
                  title: 'Request Details',
                  editStep: 1,
                  rows: [
                    { label: 'Name', value: requestName },
                    { label: 'Type', value: `${procurementType} · ${productType.replace('-', ' & ')}` },
                    { label: 'Description', value: description || '—' },
                  ]
                },
                {
                  icon: Package,
                  title: `Items (${items.length})`,
                  editStep: 2,
                  rows: items.map(i => ({ label: `${i.qty} × ${i.name}`, value: `$${(i.qty * i.unitPrice).toFixed(2)}` }))
                    .concat([{ label: 'Estimated Total', value: `$${itemsTotal.toFixed(2)}` }])
                },
                {
                  icon: TrendingUp,
                  title: 'Budget & Timeline',
                  editStep: 3,
                  rows: [
                    { label: 'Budget', value: `$${budget} (${budgetType})` },
                    { label: 'Needed By', value: neededBy },
                    { label: 'Urgency', value: urgency.charAt(0).toUpperCase() + urgency.slice(1) },
                  ]
                },
                {
                  icon: Users,
                  title: 'Vendors',
                  editStep: 4,
                  rows: [
                    { label: 'Selected', value: `${selectedVendors.length} vendor${selectedVendors.length !== 1 ? 's' : ''}` },
                    { label: 'Autonomy', value: autonomy },
                    { label: 'Group Buying', value: groupBuying ? 'Enabled' : 'Off' },
                  ]
                },
                {
                  icon: MapPin,
                  title: 'Delivery',
                  editStep: 5,
                  rows: [
                    { label: 'Address', value: deliveryAddress },
                    { label: 'Window', value: deliveryWindow.charAt(0).toUpperCase() + deliveryWindow.slice(1) },
                    { label: 'Recurring', value: recurring ? 'Yes' : 'No' },
                  ]
                },
              ].map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.title} className={`rounded-lg p-4 mb-3 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white border border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${SAGE.icon(isDark)}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{section.title}</span>
                      </div>
                      <button onClick={() => setStep(section.editStep)} className={`text-xs flex items-center gap-1 ${SAGE.icon(isDark)} hover:underline`}>
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {section.rows.map((row, i) => (
                        <div key={i} className="flex justify-between gap-4">
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{row.label}</span>
                          <span className={`text-xs text-right ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-between gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(5)} className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className={`${SAGE.primary(isDark)} px-8`} onClick={handleSubmit}>
                  <Zap className="mr-2 h-4 w-4" /> Authorize &amp; Deploy Agent
                </Button>
              </div>
            </>
          )}

          {/* ─── STEP 7: Submitted ───────────────────────────────── */}
          {step === 7 && (
            <div className="text-center py-8">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${isDark ? 'bg-[#87986a]/20' : 'bg-[#f4f6f0]'}`}>
                <CheckCircle className={`h-8 w-8 ${SAGE.icon(isDark)}`} />
              </div>
              <h2 className={`text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Request Submitted!</h2>
              <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{requestName}</p>
              <Badge variant="outline" className={`mb-8 ${SAGE.badge(isDark)}`}>BUY-2026-0147</Badge>

              <div className={`rounded-lg p-5 mb-6 text-left ${isDark ? 'bg-[#1a1a1a]' : 'bg-white border border-gray-200'}`}>
                <h3 className={`text-sm font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>What happens next</h3>
                <div className="space-y-4">
                  {[
                    { icon: Star, step: '1', title: 'Vendors are notified', desc: `${selectedVendors.length} vendor${selectedVendors.length !== 1 ? 's' : ''} will review your request and submit quotes within 24h` },
                    { icon: FileText, step: '2', title: 'Review quotes', desc: 'You\'ll get notified when quotes arrive. Compare pricing and select the best offer.' },
                    { icon: Clock, step: '3', title: 'Order confirmed', desc: `Delivery scheduled for ${neededBy} during ${deliveryWindow} window` },
                  ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#4f5c3e]'
                        }`}>{item.step}</div>
                        <div>
                          <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</div>
                          <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.desc}</div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  className={`w-full ${SAGE.primary(isDark)}`}
                  onClick={() => {
                    onNavigate?.('orders');
                    toast.info("Opening your order in Orders page");
                  }}
                >
                  View in Orders
                </Button>
                <Button
                  variant="outline"
                  className={`w-full ${isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}`}
                  onClick={() => {
                    setStep(1);
                    setRequestName("");
                    setDescription("");
                    setItems([]);
                    setBudget("500");
                    setSelectedVendors(['fresh-farm']);
                  }}
                >
                  Start New Request
                </Button>
              </div>
            </div>
          )}

        </div>
      </ScrollArea>
      </div>

      {/* ═══ RIGHT SIDEBAR · Reactive Atlas Copilot (always-on chat) ═══ */}
      <div className={`w-80 h-full border-l shrink-0 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        {wizardRightPanel}
      </div>

      {/* ═══ GROUP BUY · CONFIRMATION MODAL ═══
          Sharing volume is a commercial decision — explicit consent required. */}
      {groupBuyConfirmOpen && groupBuyMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setGroupBuyConfirmOpen(false)}>
          <div onClick={e => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
              isDark ? 'bg-[#1a1a1a] border-[#87986a]/40' : 'bg-white border-[#87986a]/40'
            }`}>
            <div className={`px-5 py-4 border-b flex items-start gap-3 ${isDark ? 'border-gray-800 bg-[#87986a]/8' : 'border-gray-200 bg-[#f4f6f0]'}`}>
              <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-[#87986a] text-white">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                  Confirm Volume Share
                </div>
                <h3 className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Join Pool {groupBuyMatch.id}?</h3>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Sharing your volume is a commercial decision that affects your competitive posture. This is logged to the audit trail.
                </p>
              </div>
              <button onClick={() => setGroupBuyConfirmOpen(false)} className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className={`p-3 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                <div className={`text-[9px] font-bold uppercase tracking-wide mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Pool Members ({groupBuyMatch.members.length})</div>
                <div className="space-y-1">
                  {groupBuyMatch.members.map(m => (
                    <div key={m} className={`flex items-center gap-2 text-[11px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <ShieldCheck className={`h-3 w-3 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
                      {m}
                      <span className={`ml-auto text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>vetted directory</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-2.5 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
                  <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-green-400' : 'text-green-700'}`}>Estimated Savings</div>
                  <div className={`text-base font-bold mt-0.5 ${isDark ? 'text-green-300' : 'text-green-700'}`}>−{groupBuyMatch.estDiscountPct}%</div>
                  <div className={`text-[10px] ${isDark ? 'text-green-400/80' : 'text-green-700/80'}`}>vs solo PO unit cost</div>
                </div>
                <div className={`p-2.5 rounded-lg ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-300'}`}>
                  <div className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Binding Window</div>
                  <div className={`text-base font-bold mt-0.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{groupBuyMatch.windowDays} days</div>
                  <div className={`text-[10px] ${isDark ? 'text-amber-300/80' : 'text-amber-700/80'}`}>can't withdraw mid-cycle</div>
                </div>
              </div>
              <div className={`p-2.5 rounded-lg flex items-start gap-2 border ${isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50/60 border-amber-300/50'}`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                <p className={`text-[10px] leading-relaxed ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                  Pool members will see your participation by name &amp; volume. Your competitive posture changes once you commit.
                </p>
              </div>
            </div>
            <div className={`shrink-0 px-5 py-3 border-t flex items-center gap-2 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              <button onClick={() => setGroupBuyConfirmOpen(false)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>
                Cancel · Stay Solo
              </button>
              <button onClick={confirmJoinPool}
                className="ml-auto px-4 py-2 rounded-lg text-xs font-bold bg-[#87986a] text-white hover:bg-[#6b7a54] transition-colors inline-flex items-center gap-1.5 shadow-sm">
                <CheckCircle className="h-3 w-3" /> Confirm · Share Volume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
