import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  Sparkles, ChevronRight, Plus, Trash2, CheckCircle,
  Package, MapPin, Users, Zap, FileText, ShieldCheck,
  AlertTriangle, Lock, Truck, X, Flame, ScrollText,
  Clock, Award, Mail, MessageCircle, StickyNote,
} from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { toast } from "sonner";
import { finnsSuppliers, finnsPlaybooks, finnsVenues, finnsPolicyRules, finnsSKUs } from "../lib/mockData";
import type {
  VenueTag, FinnsCategory, PlaybookId, FinnsAgentId, FinnsSKU,
} from "../lib/types";
import { AgentCTA } from "./AgentCTA";
import { RFQComposerModal } from "./RFQComposerModal";
import { RFQTrackerModal } from "./RFQTrackerModal";
import { useAutonomyMode, type AutonomyMode } from "../lib/autonomy";
import { useRFQs, awardRFQ, cancelRFQ, type RFQQuote } from "../lib/rfqStore";
import { createPO, updatePO, type RuntimePO } from "../lib/poStore";
import { logUserAction, readActionLog } from "../lib/actionLog";
import { detectItem, suggestVendorsForItems } from "../lib/itemIntel";
import {
  summarizeMarketTrends,
  suggestComplementary,
  summarizeVendorIntel,
  vendorHistory,
  summarizeLogistics,
  summarizeReadiness,
  type ComplementarySuggestion,
} from "../lib/atlasIntel";
import { readEntityNote, useEntityNote } from "../lib/entityNotes";

interface RequestPanelProps {
  theme?: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

interface LineItem {
  id: string;
  name: string;
  category: FinnsCategory;
  qty: number;
  unit: string;
  unitPriceIdr: number;
  venues: VenueTag[];
}

const CATEGORIES: FinnsCategory[] = ['Protein', 'Seafood', 'Produce', 'Dry Goods', 'Dairy', 'Beverages', 'Other'];

const SAGE = {
  activeBg: (isDark: boolean) => isDark ? 'bg-[#4bbcbe]/10 border-[#4bbcbe]/40' : 'bg-[#eafafa] border-[#4bbcbe]/50',
  inactiveBg: (isDark: boolean) => isDark ? 'bg-[#2a2a2a] border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300',
  primary: (isDark: boolean) => isDark ? 'bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white' : 'bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white',
  badge: (isDark: boolean) => isDark ? 'bg-[#4bbcbe]/10 text-[#82d3d5] border-[#4bbcbe]/20' : 'bg-[#eafafa] text-[#4f5c3e] border-[#4bbcbe]/30',
  icon: (isDark: boolean) => isDark ? 'text-[#82d3d5]' : 'text-[#4bbcbe]',
};

const STEP_LABELS = ['Items', 'Vendors', 'Delivery', 'Review', 'Done'];

const fmtIdr = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtIdrShort = (n: number) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000)         return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n}`;
};

const VENUE_LABEL: Record<VenueTag, string> = { BC: 'BC', RC: 'RC', ST: 'ST', SP: 'SP' };

const VenueChips = ({ venues, isDark, onToggle }: { venues: VenueTag[]; isDark: boolean; onToggle?: (v: VenueTag) => void }) => {
  const all: VenueTag[] = ['BC', 'RC', 'ST', 'SP'];
  if (!onToggle) {
    return (
      <div className="flex items-center gap-0.5 flex-wrap">
        {venues.map(v => (
          <span key={v} className={`text-[9px] font-bold px-1 py-0.5 rounded ${isDark ? 'bg-[#4bbcbe]/15 text-[#82d3d5]' : 'bg-[#eafafa] text-[#2c9a9c]'}`}>
            {VENUE_LABEL[v]}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {all.map(v => {
        const active = venues.includes(v);
        return (
          <button
            key={v}
            onClick={() => onToggle(v)}
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
              active
                ? isDark ? 'bg-[#4bbcbe] border-[#4bbcbe] text-white' : 'bg-[#4bbcbe] border-[#4bbcbe] text-white'
                : isDark ? 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
            }`}>
            {VENUE_LABEL[v]}
          </button>
        );
      })}
    </div>
  );
};

// ── Playbook details (UI metadata for the 3 Finn's playbooks) ─────────
const PLAYBOOK_META: Record<PlaybookId, { icon: typeof Zap; tagline: string; agent: FinnsAgentId }> = {
  'WF-STD': { icon: ScrollText, tagline: 'Full RFQ cycle. Default for new vendors and non-urgent requests.', agent: 'A-01' },
  'WF-RSH': { icon: Zap,        tagline: 'Skip RFQ. Direct to preferred vendor. Up to 12% premium tolerated.', agent: 'A-01' },
  'WF-REC': { icon: FileText,   tagline: 'Scheduled recurring order from a contracted vendor. Auto-approve under spend cap.', agent: 'A-02' },
};

// ── Vendor Note Panel (5d) ────────────────────────────────────────
// Read-only surface for the currently-selected vendor's team note.
// Note content lives in lib/entityNotes (same store the Suppliers
// page's ManualNotes component writes to). When no note exists, an
// empty-state encourages adding one via Suppliers.
function VendorNotePanel({
  vendorId, vendorName, isDark, onNavigate,
}: {
  vendorId: string;
  vendorName: string;
  isDark: boolean;
  onNavigate?: (page: string) => void;
}) {
  const note = useEntityNote('supplier', vendorId);
  const REL_TIME = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 60_000);
    if (min < 60) return `${min}m ago`;
    const hr  = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d   = Math.round(hr / 24);
    if (d < 7)  return `${d}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  return (
    <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <StickyNote className={`h-3 w-3 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
        <span className={`text-[9px] font-bold uppercase ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Team notes</span>
        {note && (
          <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            edited {REL_TIME(note.updatedAt)}
          </span>
        )}
        {onNavigate && (
          <button onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.hash = `vendor=${vendorId}`;
            }
            onNavigate('suppliers');
          }} className={`ml-auto text-[10px] font-semibold ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}>
            {note ? 'Edit →' : 'Add note →'}
          </button>
        )}
      </div>
      {note ? (
        <p className={`text-[10px] leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {note.text}
        </p>
      ) : (
        <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          No team notes on {vendorName} yet. Add context from past experiences (delivery quirks, who to call after hours, what they prefer to be paid in) on the Suppliers page — it'll show here next time anyone picks this vendor.
        </p>
      )}
    </div>
  );
}

export function RequestPanel({ theme = 'dark', onNavigate }: RequestPanelProps) {
  const isDark = theme === 'dark';
  const [step, setStep] = useState(1);
  const centerPanelRef = useRef<HTMLDivElement>(null);
  // Scroll center panel to top on every step transition so the top of the
  // new step content is always the first thing the user sees.
  useEffect(() => {
    centerPanelRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [step]);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqTrackerOpen, setRfqTrackerOpen] = useState(false);
  // Held suppliers — synced from SuppliersPage via localStorage.
  const [heldVendors, setHeldVendors] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('finns-held-suppliers') ?? '[]') as string[]); }
    catch { return new Set(); }
  });
  useEffect(() => {
    const handler = () => {
      try { setHeldVendors(new Set(JSON.parse(localStorage.getItem('finns-held-suppliers') ?? '[]') as string[])); }
      catch { /* ignore */ }
    };
    window.addEventListener('finns-held-suppliers-changed', handler);
    return () => window.removeEventListener('finns-held-suppliers-changed', handler);
  }, []);
  const rfqRecords = useRFQs();
  const activeRfqCount = rfqRecords.filter(r =>
    r.status === 'awaiting' || r.status === 'partial' || r.status === 'received'
  ).length;

  // ── Per-PO autonomy (Phase 6) ────────────────────────────────────
  // Picked on Step 1 (next to the playbook selector). Drives Step 2
  // auto-pre-pick + Step 4/5 copy + the new PO's laborMode at submit.
  // Defaults to the system default (currently 'auto' — Finn's treats
  // AI as the feature that's on unless flipped).
  const systemDefaultMode = useAutonomyMode();
  const [poAutonomy, setPoAutonomy] = useState<AutonomyMode>(systemDefaultMode);

  // Step 1 — Items. Empty by default; populated only when the wizard
  // is entered through an express deep-link (restock from Inventory,
  // reorder from Orders, etc.) — see the expressMode effect below.
  const [requestName, setRequestName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<FinnsCategory>('Produce');
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("kg");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemVenues, setNewItemVenues] = useState<VenueTag[]>(['BC']);
  // Smart-detect (5b): tracks whether the user manually overrode the
  // auto-filled fields so we stop guessing for them. Resets on add.
  const [overridden, setOverridden] = useState<{
    category?: boolean; unit?: boolean; venues?: boolean;
  }>({});
  const detectedFromName = useMemo(() => detectItem(newItemName), [newItemName]);
  useEffect(() => {
    // 6d — Smart-detect is always on. It's autocomplete-with-categories,
    // not an agent action. Even on a Manual PO the user is glad to have
    // the category auto-filled. Manual just means "user drives the
    // sourcing decision"; smart UX is unaffected.
    if (!detectedFromName) return;
    if (!overridden.category) setNewItemCategory(detectedFromName.category);
    if (!overridden.unit && detectedFromName.unit) setNewItemUnit(detectedFromName.unit);
    if (!overridden.venues && detectedFromName.venues && detectedFromName.venues.length > 0) {
      setNewItemVenues(detectedFromName.venues);
    }
  }, [detectedFromName, overridden]);
  const [playbook, setPlaybook] = useState<PlaybookId>('WF-STD');

  // Step 2 — Sourcing (5a)
  // Two paths: 'pick' (default) lets the user choose vendors directly
  // from the directory; 'rfq' opens the RFQ Composer inline and shows
  // a live waiting view until the user awards a winner.
  // 5c — initial selection is now empty; Auto mode pre-picks the
  // top suggested vendor below. Off mode leaves it empty.
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  type SourcingPath = 'pick' | 'rfq';
  const [sourcingPath, setSourcingPath] = useState<SourcingPath>('pick');
  const [wizardRfqId, setWizardRfqId]   = useState<string | null>(null);
  interface AwardedQuote {
    vendorId: string;
    vendorName: string;
    itemIds: string[];     // RFQ items locked to this vendor by this award
    totalIdr: number;
    leadTimeDays: number;
    channel: 'whatsapp' | 'email';
    receivedAt: string;
    rfqId: string;
    poId: string;          // PO created at award time; updated again at Step 5 Submit
    amContact: string;     // account manager display label
    note?: string;
  }
  // 6k — supports multiple awards on a multi-vendor RFQ.
  const [awardedQuotes, setAwardedQuotes] = useState<AwardedQuote[]>([]);
  // Convenience: the first award (back-compat with Step 3 banner copy).
  const awardedQuote = awardedQuotes[0] ?? null;
  const wizardRfq = wizardRfqId
    ? rfqRecords.find(r => r.id === wizardRfqId) ?? null
    : null;

  // 5g — Multi-vendor split. Group items by their top-suggested vendor
  // (A-01's first relevance pick). When items map to N > 1 vendors,
  // Step 4 offers a one-click "Split into N POs" alternative to the
  // single-PO submit. Doesn't apply to the RFQ path — RFQ already
  // sends to multiple vendors and resolves to one winner.
  interface ProposedSplit {
    vendorId: string;
    vendorName: string;
    items: LineItem[];
  }
  const proposedSplits: ProposedSplit[] = useMemo(() => {
    if (items.length === 0) return [];
    const groups = new Map<string, ProposedSplit>();
    items.forEach(it => {
      const [topId] = suggestVendorsForItems([it.name], 1);
      if (!topId) return;
      const vendor = finnsSuppliers.find(v => v.id === topId);
      if (!vendor) return;
      const existing = groups.get(topId);
      if (existing) {
        existing.items.push(it);
      } else {
        groups.set(topId, { vendorId: topId, vendorName: vendor.name, items: [it] });
      }
    });
    return Array.from(groups.values());
  }, [items]);
  const [splitMode, setSplitMode] = useState(false);
  // If items change such that there's no split need, drop split mode.
  useEffect(() => {
    if (proposedSplits.length <= 1 && splitMode) setSplitMode(false);
  }, [proposedSplits.length, splitMode]);

  // 6i — Coverage analysis for the current basket.
  // Each item has a detected category; check whether the directory
  // contains a vendor that covers EVERY category in the basket. When
  // none exists, the wizard surfaces a cross-category banner on Step 2
  // and a warning on Step 4 if the user tries to send everything to
  // one vendor anyway.
  const itemCategories = useMemo(
    () => Array.from(new Set(items.map(it => it.category).filter(Boolean))),
    [items],
  );
  const someVendorCoversAll = useMemo(() => {
    if (itemCategories.length === 0) return true;
    return finnsSuppliers.some(v =>
      itemCategories.every(c => v.categories.includes(c)),
    );
  }, [itemCategories]);
  /** Returns { covered, total } for a vendor against the basket. */
  const vendorCoverage = useCallback((vendorId: string): { covered: number; total: number } => {
    const v = finnsSuppliers.find(s => s.id === vendorId);
    if (!v || itemCategories.length === 0) return { covered: itemCategories.length, total: itemCategories.length };
    const covered = itemCategories.filter(c => v.categories.includes(c)).length;
    return { covered, total: itemCategories.length };
  }, [itemCategories]);
  /** True iff items span ≥2 categories AND no single vendor covers them all. */
  const isCrossCategoryUnservable = itemCategories.length >= 2 && !someVendorCoversAll;

  // 6m — Manual multi-vendor assignment. When the user picks 2+ vendors
  // on Path A, walk the selection in order and let each vendor claim
  // items in categories they cover that haven't been claimed yet. The
  // unassigned bucket holds items no selected vendor can supply — these
  // block Submit on Step 4.
  interface VendorAssignment {
    vendor: typeof finnsSuppliers[number];
    items: LineItem[];
  }
  const manualAssignments = useMemo(() => {
    const byItem = new Map<string, string>();              // itemId → vendorId
    const groups: VendorAssignment[] = selectedVendors
      .map(vid => finnsSuppliers.find(s => s.id === vid))
      .filter((v): v is typeof finnsSuppliers[number] => !!v)
      .map(v => ({ vendor: v, items: [] }));
    items.forEach(it => {
      const claim = groups.find(g => g.vendor.categories.includes(it.category));
      if (claim) {
        claim.items.push(it);
        byItem.set(it.id, claim.vendor.id);
      }
    });
    const unassigned = items.filter(it => !byItem.has(it.id));
    return { byItem, groups: groups.filter(g => g.items.length > 0), unassigned };
  }, [selectedVendors, items]);
  /** True when manual multi-vendor mode is active (2+ vendors picked, no award, no auto-split). */
  const isManualMultiVendor = selectedVendors.length > 1 && !splitMode && awardedQuotes.length === 0;
  // Dismiss flag — set when the user explicitly clicks "Pick one vendor
  // anyway" so the banner stops nagging within this wizard session.
  const [crossCategoryDismissed, setCrossCategoryDismissed] = useState(false);
  // Reset dismiss when items change so the banner re-asserts on a new basket.
  useEffect(() => {
    setCrossCategoryDismissed(false);
  }, [itemCategories.join('|')]);

  // 6d — Auto-mode pre-pick keys off the PER-PO autonomy setting
  // (picked on Step 1), not the system default. When the user has
  // chosen Auto for this PO and lands on Step 2 with no vendor picked,
  // the top-suggested vendor is auto-selected. Manual leaves the
  // selection empty so the user always makes the call.
  useEffect(() => {
    if (poAutonomy !== 'auto') return;
    if (step !== 2 || sourcingPath !== 'pick' || wizardRfqId) return;
    if (selectedVendors.length > 0) return;
    if (items.length === 0) return;
    const [topId] = suggestVendorsForItems(items.map(it => it.name), 1);
    if (topId) setSelectedVendors([topId]);
  }, [poAutonomy, step, sourcingPath, wizardRfqId, items, selectedVendors.length]);

  // ── 5e · Right-panel insights ────────────────────────────────────
  // Category mix for Step 1 — counts items by detected category.
  const categoryMix = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(it => { counts[it.category] = (counts[it.category] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

  // Similar past POs — matches by category overlap. Reads the action
  // log for entries whose category appears in our current item set.
  const similarPastPOs = useMemo(() => {
    if (items.length === 0) return [] as ReturnType<typeof readActionLog>;
    const cats = new Set(items.map(it => it.category));
    return readActionLog({ kind: ['po-create', 'po-approve'], limit: 30 })
      .filter(e => e.category && cats.has(e.category as FinnsCategory))
      .slice(0, 3);
  }, [items]);

  // Policy preview for Step 4 — runs the seeded active rules against
  // the wizard's amount + vendor + category. Stubbed simulation of
  // what A-04 (Spend Watchdog) would do at Stage 3.
  const policyPreview = useMemo(() => {
    // For multi-award RFQs, sum every awarded PO so the spend-cap check
    // reflects the whole basket. Falls back to single award or item total.
    const amount = awardedQuotes.length > 0
      ? awardedQuotes.reduce((s, a) => s + a.totalIdr, 0)
      : items.reduce((s, it) => s + it.qty * (it.unitPriceIdr || 0), 0);
    const checks: { rule: string; status: 'pass' | 'review' | 'warn'; detail: string }[] = [];
    finnsPolicyRules.forEach(rule => {
      if (!rule.active) return;
      if (rule.template === 'spend-cap') {
        const threshold = (rule.config.threshold as number) ?? 0;
        const currency = (rule.config.currency as string) ?? 'IDR';
        if (amount > threshold) {
          const ratio = amount / threshold;
          checks.push({
            rule: `${rule.id} · ${rule.name}`,
            status: ratio > 1.5 ? 'warn' : 'review',
            detail: `Amount Rp ${(amount / 1_000_000).toFixed(1)}M is above the ${(threshold / 1_000_000).toFixed(0)}M ${currency} cap.`,
          });
        } else {
          checks.push({
            rule: `${rule.id} · ${rule.name}`,
            status: 'pass',
            detail: `Under the ${(threshold / 1_000_000).toFixed(0)}M ${currency} cap.`,
          });
        }
      }
      if (rule.template === 'vendor-trust-floor') {
        const floor = (rule.config.threshold as number) ?? 0;
        const v = finnsSuppliers.find(s => s.id === selectedVendors[0]);
        if (v && v.metrics.composite < floor) {
          checks.push({
            rule: `${rule.id} · ${rule.name}`,
            status: 'warn',
            detail: `${v.name} composite ${v.metrics.composite} is below the ${floor} floor.`,
          });
        } else if (v) {
          checks.push({
            rule: `${rule.id} · ${rule.name}`,
            status: 'pass',
            detail: `${v.name} composite ${v.metrics.composite} clears the ${floor} floor.`,
          });
        }
      }
    });
    return { amount, checks };
  }, [items, awardedQuotes, selectedVendors]);

  // Step 3 — Delivery
  const [targetVenues, setTargetVenues] = useState<VenueTag[]>(['BC', 'RC']);
  const [neededBy, setNeededBy] = useState("2026-05-23");
  const [windowDays, setWindowDays] = useState("2");
  const [deliveryContact, setDeliveryContact] = useState("Wayan Sukarjo (BC Receiving Lead) — +62 813 9999 0000");
  const [specialInstructions, setSpecialInstructions] = useState("Receive at BC loading dock between 06:00–10:00. Call WhatsApp +62 813 9999 0000 30 min before arrival.");
  const [recurring, setRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');

  // Express mode — Inventory/Orders/Suppliers all deep-link in via the URL hash.
  //   • mode=blank   → empty wizard at Step 1
  //   • mode=reorder → Step 4 (Review) with full prefill
  //   • restock=...  → Step 1 with items locked + urgency=urgent
  type ExpressMode = 'blank' | 'reorder' | 'restock' | null;
  const [expressMode, setExpressMode] = useState<ExpressMode>(null);
  const [expressContext, setExpressContext] = useState<{ from?: string; vendor?: string } | null>(null);
  const [inventoryContext, setInventoryContext] = useState<{
    skuId?: string;
    skuName?: string;
    items?: string[];
    vendor?: string;
    urgent?: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const intent = params.get('intent');
    const mode = params.get('mode');
    const restock = params.get('restock');

    // ── Restock express (from Inventory) ──
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
        setDescription(`Auto-drafted from Inventory. SKU ${restock}. Triggered by stock falling below par.`);
        setItems(itemsParsed.map((label, i) => {
          const m = label.match(/^(.+?)\s+(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
          return m
            ? { id: `inv-${i}`, name: m[1], category: 'Produce' as FinnsCategory, qty: parseFloat(m[2]) || 1, unit: m[3], unitPriceIdr: 0, venues: ['BC'] as VenueTag[] }
            : { id: `inv-${i}`, name: label, category: 'Produce' as FinnsCategory, qty: 1, unit: 'units', unitPriceIdr: 0, venues: ['BC'] as VenueTag[] };
        }));
        setPlaybook('WF-RSH');
      }
      setStep(1);
      window.location.hash = '';
      return;
    }

    // ── Express modes from Orders ──
    if (intent === 'express' && mode === 'blank') {
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setRequestName(`Express Order · ${stamp}`);
      setDescription('Express-lane order initiated from Orders dashboard.');
      setItems([]);
      setExpressMode('blank');
      setStep(1);
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
          id: `re-${i}`, name: label, category: 'Other' as FinnsCategory,
          qty: 1, unit: 'units', unitPriceIdr: 0, venues: ['BC'] as VenueTag[],
        })));
      }
      setStep(4);
      window.location.hash = '';
      return;
    }
  }, []);

  // Persist draft summary for the App.tsx header pill.
  useEffect(() => {
    const draft = { step, name: requestName, items: items.length };
    try {
      sessionStorage.setItem('newRequestDraft', JSON.stringify(draft));
      window.dispatchEvent(new Event('newRequestDraftChanged'));
    } catch { /* ignore */ }
  }, [step, requestName, items.length]);

  const itemsTotalIdr = items.reduce((sum, i) => sum + i.qty * i.unitPriceIdr, 0);

  // ── Atlas Quantity Check (Step 4) ───────────────────────────────
  // Fuzzy-matches each basket item to a FinnsSKU by keyword overlap,
  // then computes a suggested quantity from burn rate + par gap.
  // Only fires on Step 4 entry; reset when the user leaves Step 4.
  type QtySuggestion = {
    sku: FinnsSKU;
    suggestedQty: number;
    reason: string;
    accepted: boolean;
    dismissed: boolean;
  };
  const [qtySuggestions, setQtySuggestions] = useState<Record<string, QtySuggestion>>({});

  function matchSKUToItem(item: LineItem): FinnsSKU | null {
    const words = item.name.toLowerCase().split(/[\s,()/-]+/).filter(w => w.length > 3);
    return finnsSKUs.find(sku => {
      const skuLower = sku.name.toLowerCase();
      return words.some(w => skuLower.includes(w));
    }) ?? null;
  }

  useEffect(() => {
    if (step !== 4) { setQtySuggestions({}); return; }
    const LEAD_DAYS = 3;
    const next: Record<string, QtySuggestion> = {};
    items.forEach(item => {
      const sku = matchSKUToItem(item);
      if (!sku) return;
      const burnCover  = Math.ceil(sku.burnRate * LEAD_DAYS);
      const parGap     = Math.max(0, sku.par - sku.onHand);
      const suggested  = Math.max(burnCover, parGap, 1);
      // Only surface when the suggestion is ≥20% more than ordered.
      if (suggested / item.qty < 1.2) return;
      const reason = parGap >= burnCover
        ? `par gap — ${sku.onHand}/${sku.par} ${sku.uom} in stock`
        : `covers ${LEAD_DAYS}d at ${sku.burnRate} ${sku.uom}/day burn rate`;
      next[item.id] = { sku, suggestedQty: suggested, reason, accepted: false, dismissed: false };
    });
    setQtySuggestions(next);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function addItem() {
    if (!newItemName.trim()) return;
    setItems([...items, {
      id: Date.now().toString(),
      name: newItemName,
      category: newItemCategory,
      qty: parseInt(newItemQty) || 1,
      unit: newItemUnit || 'units',
      unitPriceIdr: parseInt(newItemPrice) || 0,
      venues: newItemVenues.length ? newItemVenues : ['BC'],
    }]);
    setNewItemName("");
    setNewItemQty("1");
    setNewItemPrice("");
    // Reset smart-detect override flags so the next typed item auto-fills again.
    setOverridden({});
  }

  function removeItem(id: string) {
    setItems(items.filter(i => i.id !== id));
  }

  /** Add a complementary-item suggestion straight into the basket. */
  function addComplementary(s: ComplementarySuggestion) {
    setItems(prev => [...prev, {
      id: `${Date.now()}-${s.name.replace(/\s+/g, '-').toLowerCase()}`,
      name: s.name,
      category: s.category,
      qty: s.qty,
      unit: s.unit,
      unitPriceIdr: 0,
      venues: ['BC'],
    }]);
    toast.success(`Added ${s.name}`, { description: `From Atlas suggestion · ${s.qty}${s.unit}.` });
  }

  function toggleItemVenue(itemId: string, v: VenueTag) {
    setItems(items.map(it => it.id === itemId ? {
      ...it,
      venues: it.venues.includes(v) ? it.venues.filter(x => x !== v) : [...it.venues, v],
    } : it));
  }

  // 6m — multi-vendor select on the "I know my vendor" path. Cross-category
  // baskets in real life are routed manually: tomatoes → CV Indo Sayur,
  // beef → Krakatoa Coldstore. Single-select forced an impossible choice.
  // Now: each click toggles a vendor in/out of selectedVendors. When
  // 2+ are picked, items are greedily assigned to the first picked
  // vendor that covers each item's category (see manualAssignments).
  // Picking a vendor while splitMode is on cancels splitMode — the
  // user's manual pick wins.
  function toggleVendor(id: string) {
    setSelectedVendors(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (splitMode) setSplitMode(false);
  }

  function toggleTargetVenue(v: VenueTag) {
    setTargetVenues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  // ── Step 5 — final wizard Submit ──────────────────────────────
  // Three paths converge here:
  //   1. Direct vendor (sourcingPath === 'pick') — no PO exists yet.
  //      Mint one with the wizard data + selected vendor.
  //   2. RFQ award (sourcingPath === 'rfq' && awardedQuote) — the PO
  //      was created at Award time. Update it with delivery details.
  //   3. Multi-vendor split (splitMode === true) — items group by
  //      top-suggested vendor. Mint N POs, one per group. Same
  //      delivery info applies to all. Routes to the first PO.
  // All routes navigate to Orders deep-linked so Approve & Execute is
  // one click away.
  function handleSubmit() {
    const meta = PLAYBOOK_META[playbook];
    const playbookLabel = finnsPlaybooks.find(p => p.id === playbook)?.name ?? 'Standard';

    // Compose human-readable items + ETA.
    const itemSummary = items.map(it =>
      `${it.name} ${it.qty}${it.unit}${it.venues?.length ? ` · ${it.venues.join(' + ')}` : ''}`
    );
    const venueLabel = targetVenues.length === 0
      ? 'BC'
      : targetVenues.length === 1
        ? targetVenues[0]
        : 'Multi';
    const totalIdr = items.reduce((s, it) => s + it.qty * (it.unitPriceIdr || 0), 0);

    let poId: string;

    // ── Path 3: Multi-vendor split ──
    if (splitMode && proposedSplits.length > 1) {
      const createdIds: string[] = [];
      const venueChip: VenueTag | 'Multi' =
        venueLabel === 'BC' || venueLabel === 'RC' || venueLabel === 'ST' || venueLabel === 'SP'
          ? venueLabel : 'Multi';
      proposedSplits.forEach((group, idx) => {
        const id = `PO-${3050 + Math.floor(Math.random() * 200) + idx}`;
        const vendor = finnsSuppliers.find(v => v.id === group.vendorId);
        const supplierName = vendor?.name ?? group.vendorName;
        const amContact = vendor
          ? `${vendor.accountManager.name} · ${vendor.accountManager.whatsapp}`
          : 'TBD';
        const splitItemSummary = group.items.map(it =>
          `${it.name} ${it.qty}${it.unit}${it.venues?.length ? ` · ${it.venues.join(' + ')}` : ''}`
        );
        const splitTotal = group.items.reduce((s, it) => s + it.qty * (it.unitPriceIdr || 0), 0);
        const po: RuntimePO = {
          id,
          supplier: supplierName,
          items: splitItemSummary,
          amount: splitTotal,
          group: 'needs-action',
          actionKind: 'approve',
          humanAction: 'Approve',
          humanStatus: `Awaiting your approval · split ${idx + 1}/${proposedSplits.length}`,
          humanDescription: `${meta.agent} (Sourcing) · ${playbookLabel} playbook. Delivery to ${targetVenues.join(' + ') || 'BC'} on ${neededBy}. Split from a combined request — ${group.items.length} item${group.items.length === 1 ? '' : 's'} routed to ${supplierName}.`,
          eta: `${neededBy}`,
          dagStage: 1,
          agentReasoning: `Auto-split: A-01 grouped ${group.items.length} item${group.items.length === 1 ? '' : 's'} to ${supplierName} based on category-vendor overlap. ${vendor ? `Composite ${vendor.metrics.composite}, on-time ${vendor.metrics.onTime}%, lead ${vendor.metrics.leadTimeDays}d.` : ''} Vendor confirmation will arrive via ${vendor?.accountManager.whatsapp ? 'WhatsApp' : 'email'} once each PO is issued.`,
          agentAgent: `${meta.agent} (Sourcing)`,
          assignedAgent: { id: 5, role: 'Sourcing' },
          workflowTemplate: playbook,
          status: 'live',
          createdAt: new Date().toISOString(),
          quoteChannel: 'none',
          quoteFrom: amContact,
        };
        createPO(po);
        createdIds.push(id);
        logUserAction({
          kind: 'po-create',
          entity: { type: 'po', id },
          summary: `Authorized ${id} (split ${idx + 1}/${proposedSplits.length}) · ${supplierName} · Rp ${(splitTotal / 1_000_000).toFixed(2)}M`,
          venue: venueChip,
          details: `${group.items.length} item${group.items.length === 1 ? '' : 's'} from combined wizard request. Delivery to ${targetVenues.join(', ')} on ${neededBy}.`,
          meta: { poId: id, vendorId: group.vendorId, totalIdr: splitTotal, path: 'split', playbook, splitIndex: idx + 1, splitTotal: proposedSplits.length },
        });
      });
      toast.success(`${createdIds.length} POs authorized · routed to Orders`, {
        description: `Split across ${createdIds.length} vendors. Each PO is at Stage 2 awaiting your approval.`,
      });
      setStep(5);
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.hash = `order=${createdIds[0]}`;
        }
        onNavigate?.('orders');
      }, 1400);
      return;
    }

    // ── Path 4: Manual multi-vendor split ──
    //    User picked 2+ vendors on Path A. Each gets a PO with the
    //    items they were greedily assigned. Same delivery info applies
    //    to all. Routes to the first PO. Identical lifecycle to
    //    auto-split — the only difference is user chose the vendors.
    if (isManualMultiVendor && manualAssignments.unassigned.length === 0) {
      const createdIds: string[] = [];
      const venueChip: VenueTag | 'Multi' =
        venueLabel === 'BC' || venueLabel === 'RC' || venueLabel === 'ST' || venueLabel === 'SP'
          ? venueLabel : 'Multi';
      manualAssignments.groups.forEach((group, idx) => {
        const id = `PO-${3050 + Math.floor(Math.random() * 200) + idx}`;
        const supplierName = group.vendor.name;
        const amContact = `${group.vendor.accountManager.name} · ${group.vendor.accountManager.whatsapp}`;
        const splitItemSummary = group.items.map(it =>
          `${it.name} ${it.qty}${it.unit}${it.venues?.length ? ` · ${it.venues.join(' + ')}` : ''}`,
        );
        const splitTotal = group.items.reduce((s, it) => s + it.qty * (it.unitPriceIdr || 0), 0);
        const po: RuntimePO = {
          id,
          supplier: supplierName,
          items: splitItemSummary,
          amount: splitTotal,
          group: 'needs-action',
          actionKind: 'approve',
          humanAction: 'Approve',
          humanStatus: `Awaiting your approval · manual split ${idx + 1}/${manualAssignments.groups.length}`,
          humanDescription: `${meta.agent} (Sourcing) · ${playbookLabel} playbook. Delivery to ${targetVenues.join(' + ') || 'BC'} on ${neededBy}. Manual multi-vendor pick — ${group.items.length} item${group.items.length === 1 ? '' : 's'} routed to ${supplierName} (you picked the vendors).`,
          eta: `${neededBy}`,
          dagStage: 1,
          agentReasoning: `Manual multi-vendor split: you picked ${manualAssignments.groups.length} vendors on Step 2; this PO carries ${group.items.length} item${group.items.length === 1 ? '' : 's'} in categories ${supplierName} covers (${Array.from(new Set(group.items.map(it => it.category))).join(', ')}). Composite ${group.vendor.metrics.composite}, on-time ${group.vendor.metrics.onTime}%, lead ${group.vendor.metrics.leadTimeDays}d. Confirmation will arrive via ${group.vendor.accountManager.whatsapp ? 'WhatsApp' : 'email'}.`,
          agentAgent: `${meta.agent} (Sourcing)`,
          assignedAgent: { id: 5, role: 'Sourcing' },
          workflowTemplate: playbook,
          status: 'live',
          createdAt: new Date().toISOString(),
          quoteChannel: 'none',
          quoteFrom: amContact,
        };
        createPO(po);
        createdIds.push(id);
        logUserAction({
          kind: 'po-create',
          entity: { type: 'po', id },
          summary: `Authorized ${id} (manual split ${idx + 1}/${manualAssignments.groups.length}) · ${supplierName} · Rp ${(splitTotal / 1_000_000).toFixed(2)}M`,
          venue: venueChip,
          details: `${group.items.length} item${group.items.length === 1 ? '' : 's'}. Delivery to ${targetVenues.join(', ')} on ${neededBy}.`,
          meta: { poId: id, vendorId: group.vendor.id, totalIdr: splitTotal, path: 'manual-split', playbook, splitIndex: idx + 1, splitTotal: manualAssignments.groups.length },
        });
      });
      toast.success(`${createdIds.length} POs authorized · routed to Orders`, {
        description: `Manual split across ${createdIds.length} vendors you picked. Each PO is at Stage 2 awaiting your approval.`,
      });
      setStep(5);
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.hash = `order=${createdIds[0]}`;
        }
        onNavigate?.('orders');
      }, 1400);
      return;
    }

    // ── Path 1 & 2 (RFQ multi-award + direct vendor) ──
    if (awardedQuotes.length > 0) {
      // ── RFQ path: each awarded quote has a PO already; fill in
      //    delivery on every one. Multi-vendor RFQs produce N POs. ──
      const venueChip: VenueTag | 'Multi' =
        venueLabel === 'BC' || venueLabel === 'RC' || venueLabel === 'ST' || venueLabel === 'SP'
          ? venueLabel as VenueTag : 'Multi';
      awardedQuotes.forEach(aq => {
        // Per-PO item list — only the items that award covered.
        const awardItemSummary = items
          .filter(it => aq.itemIds.includes(it.id))
          .map(it => `${it.name} ${it.qty}${it.unit}${it.venues?.length ? ` · ${it.venues.join(' + ')}` : ''}`);
        const itemsLine = awardItemSummary.length > 0 ? awardItemSummary : itemSummary;
        updatePO(aq.poId, {
          items: itemsLine,
          humanStatus: 'Quote awarded · awaiting your approval',
          humanDescription: `Awarded from ${aq.rfqId} · ${itemsLine.length} item${itemsLine.length === 1 ? '' : 's'} · delivery to ${targetVenues.join(' + ') || 'BC'} on ${neededBy}.`,
          eta: `${neededBy} · ${aq.leadTimeDays}d lead`,
          workflowTemplate: playbook,
        });
        logUserAction({
          kind: 'po-stage-advance',
          entity: { type: 'po', id: aq.poId },
          summary: `Authorized ${aq.poId} · ${aq.vendorName} · Rp ${(aq.totalIdr / 1_000_000).toFixed(2)}M (from RFQ ${aq.rfqId})`,
          venue: venueChip,
          details: `Delivery to ${targetVenues.join(', ')} on ${neededBy}. Quote received via ${aq.channel === 'whatsapp' ? 'WhatsApp' : 'email'} from ${aq.amContact}.`,
          meta: {
            poId: aq.poId,
            rfqId: aq.rfqId,
            vendorId: aq.vendorId,
            totalIdr: aq.totalIdr,
            path: 'rfq',
            playbook,
          },
        });
      });
      // Deep-link target is the FIRST awarded PO; user can navigate to
      // the others from Orders.
      poId = awardedQuotes[0].poId;
    } else {
      // ── Direct path: mint a fresh PO ──
      poId = `PO-${3050 + Math.floor(Math.random() * 200)}`;
      const primaryVendorId = selectedVendors[0];
      const primaryVendor   = finnsSuppliers.find(v => v.id === primaryVendorId);
      const supplierName    = primaryVendor?.name ?? 'Vendor (TBD)';
      const amContact       = primaryVendor
        ? `${primaryVendor.accountManager.name} · ${primaryVendor.accountManager.whatsapp}`
        : 'TBD';
      const po: RuntimePO = {
        id: poId,
        supplier: supplierName,
        items: itemSummary,
        amount: totalIdr,
        group: 'needs-action',
        actionKind: 'approve',
        humanAction: 'Approve',
        humanStatus: 'Awaiting your approval',
        humanDescription: `${meta.agent} (Sourcing) · ${playbookLabel} playbook. Delivery to ${targetVenues.join(' + ') || 'BC'} on ${neededBy}.`,
        eta: `${neededBy}`,
        dagStage: 1,
        agentReasoning: `Vendor picked directly from the approved directory. ${primaryVendor ? `${primaryVendor.name} (composite ${primaryVendor.metrics.composite}, on-time ${primaryVendor.metrics.onTime}%, lead ${primaryVendor.metrics.leadTimeDays}d).` : ''} Estimated total: Rp ${(totalIdr / 1_000_000).toFixed(2)}M. Vendor confirmation will arrive via ${primaryVendor?.accountManager.whatsapp ? 'WhatsApp' : 'email'} once the PO is issued.`,
        agentAgent: `${meta.agent} (Sourcing)`,
        assignedAgent: { id: 5, role: 'Sourcing' },
        workflowTemplate: playbook,
        status: 'live',
        createdAt: new Date().toISOString(),
        quoteChannel: 'none',
        quoteFrom: amContact,
      };
      createPO(po);
      logUserAction({
        kind: 'po-create',
        entity: { type: 'po', id: poId },
        summary: `Authorized ${poId} · ${supplierName} · Rp ${(totalIdr / 1_000_000).toFixed(2)}M (direct vendor pick)`,
        venue: venueLabel === 'BC' || venueLabel === 'RC' || venueLabel === 'ST' || venueLabel === 'SP' ? venueLabel : 'Multi',
        details: `Delivery to ${targetVenues.join(', ')} on ${neededBy}. Vendor: ${supplierName}.`,
        meta: { poId, vendorId: primaryVendorId, totalIdr, path: 'direct', playbook },
      });
    }

    const poCount = awardedQuotes.length > 1 ? awardedQuotes.length : 1;
    toast.success(
      poCount > 1
        ? `${poCount} POs authorized · routed to Orders`
        : `${poId} authorized · routed to Orders`,
      {
        description: poCount > 1
          ? `${poCount} POs from ${awardedQuotes[0].rfqId}. Each at Stage 2 awaiting your Approve & Execute.`
          : `Running on ${playbook} (${playbookLabel}). Hit Approve & Execute in Orders to advance to Stage 3.`,
      },
    );
    setStep(5);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.hash = `order=${poId}`;
      }
      onNavigate?.('orders');
    }, 1400);
  }

  // ── In-wizard RFQ handlers (5a / 6k multi-award) ──────────────
  function handleAwardInWizard(quote: RFQQuote) {
    if (!wizardRfq) return;
    // Items in this quote that aren't already awarded elsewhere on
    // this RFQ. The store enforces non-overlap too but we mirror here
    // so the UI math (savings, etc.) reflects only the newly-locked items.
    const alreadyAwarded = new Set<string>(wizardRfq.awards.flatMap(a => a.itemIds));
    const newItemIds = quote.itemIds.filter(id => !alreadyAwarded.has(id));
    if (newItemIds.length === 0) return;
    const awardedItems = wizardRfq.items.filter(it => newItemIds.includes(it.id));

    const poId = `PO-${3050 + Math.floor(Math.random() * 200) + wizardRfq.awards.length}`;
    awardRFQ(wizardRfq.id, quote.vendorId, poId);

    const channelLabel = wizardRfq.channel === 'whatsapp' ? 'WhatsApp' : 'email';
    const channel: 'whatsapp' | 'email' = wizardRfq.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const vendorRecord = finnsSuppliers.find(s => s.id === quote.vendorId);
    const amContact = vendorRecord
      ? `${vendorRecord.accountManager.name} · ${vendorRecord.accountManager.whatsapp}`
      : quote.vendorName;
    const itemSummary = awardedItems.map(it => `${it.qty}${it.unit} ${it.name}`);

    // Competing quotes that ALSO cover any of the newly-awarded items.
    const competing = wizardRfq.quotes.filter(q =>
      q.vendorId !== quote.vendorId
      && q.itemIds.some(id => newItemIds.includes(id)),
    );
    const nextBest = competing.length > 0
      ? competing.reduce((min, q) => q.totalIdr < min ? q.totalIdr : min, Number.POSITIVE_INFINITY)
      : null;
    const savingIdr = nextBest != null && nextBest !== Number.POSITIVE_INFINITY
      ? nextBest - quote.totalIdr
      : 0;
    const reasoning = [
      `Awarded via ${wizardRfq.id}. Winning quote came in via ${channelLabel} from ${amContact}.`,
      competing.length > 0
        ? savingIdr > 0
          ? `Beat ${competing.length} competing quote${competing.length === 1 ? '' : 's'} on these items — Rp ${(savingIdr / 1_000_000).toFixed(2)}M cheaper than next-best.`
          : `${competing.length} competing quote${competing.length === 1 ? ' was' : 's were'} more competitive on lead time / terms; price is locked here.`
        : `Sole vendor able to supply ${awardedItems.length} item${awardedItems.length === 1 ? '' : 's'} in this RFQ.`,
      `${quote.leadTimeDays}d lead.${quote.note ? ` Vendor note: "${quote.note}"` : ''}`,
    ].join(' ');

    const po: RuntimePO = {
      id: poId,
      supplier: quote.vendorName,
      items: itemSummary,
      amount: quote.totalIdr,
      group: 'needs-action',
      actionKind: 'approve',
      humanAction: 'Approve',
      humanStatus: 'Awarded quote · awaiting delivery details + your approval',
      humanDescription: `Drafted from ${wizardRfq.id} · ${awardedItems.length} item${awardedItems.length === 1 ? '' : 's'} routed to ${quote.vendorName}. Delivery details pending Step 3 of the wizard.`,
      eta: `${quote.leadTimeDays}d after approval`,
      etaMinutes: quote.leadTimeDays * 24 * 60,
      dagStage: 1,
      agentReasoning: reasoning,
      agentAgent: 'A-01 (Sourcing)',
      assignedAgent: { id: 5, role: 'Sourcing' },
      workflowTemplate: playbook,
      status: 'live',
      createdAt: new Date().toISOString(),
      quoteChannel: channel,
      quoteFrom: amContact,
      quoteReceivedAt: quote.receivedAt,
      fromRfqId: wizardRfq.id,
      saving: savingIdr > 0 ? { time: '2h', cost: Math.round(savingIdr) } : undefined,
      financeInsight: savingIdr > 0
        ? `Locked Rp ${(savingIdr / 1_000_000).toFixed(2)}M vs the next-best quote.`
        : undefined,
    };
    createPO(po);

    logUserAction({
      kind: 'rfq-award',
      entity: { type: 'supplier', id: quote.vendorId },
      summary: `Awarded ${wizardRfq.id} → ${quote.vendorName} · Rp ${(quote.totalIdr / 1_000_000).toFixed(2)}M · ${quote.leadTimeDays}d · ${awardedItems.length} item${awardedItems.length === 1 ? '' : 's'}`,
      venue: wizardRfq.venue,
      meta: {
        rfqId: wizardRfq.id,
        winningVendorId: quote.vendorId,
        winningVendorName: quote.vendorName,
        totalIdr: quote.totalIdr,
        leadTimeDays: quote.leadTimeDays,
        synthesisedPoId: poId,
        channel: wizardRfq.channel,
        itemIds: newItemIds,
        fromWizard: true,
      },
    });
    logUserAction({
      kind: 'po-create',
      entity: { type: 'po', id: poId },
      summary: `Drafted ${poId} from ${wizardRfq.id} · ${quote.vendorName} · quote via ${channelLabel}`,
      venue: wizardRfq.venue,
      meta: { fromRfqId: wizardRfq.id, vendorId: quote.vendorId, totalIdr: quote.totalIdr, channel: wizardRfq.channel },
    });

    // Track this award in the wizard's local set.
    const newAward: AwardedQuote = {
      vendorId:    quote.vendorId,
      vendorName:  quote.vendorName,
      itemIds:     newItemIds,
      totalIdr:    quote.totalIdr,
      leadTimeDays: quote.leadTimeDays,
      channel,
      receivedAt:  quote.receivedAt,
      rfqId:       wizardRfq.id,
      poId,
      amContact,
      note:        quote.note,
    };
    setAwardedQuotes(prev => [...prev, newAward]);

    // Check if every item in the basket is now awarded. If yes →
    // advance to Step 3. If no → stay on Step 2 with the progress meter.
    const awardedAfter = new Set<string>([
      ...wizardRfq.awards.flatMap(a => a.itemIds),
      ...newItemIds,
    ]);
    const allItemsAwarded = wizardRfq.items.every(it => awardedAfter.has(it.id));

    if (allItemsAwarded) {
      toast.success(`All items awarded · ${wizardRfq.awards.length + 1} PO${wizardRfq.awards.length === 0 ? '' : 's'} drafted`, {
        description: 'Vendor + amount locked for every item. Next: delivery details.',
      });
      setStep(3);
    } else {
      const remaining = wizardRfq.items.length - awardedAfter.size;
      toast.success(`${quote.vendorName} awarded · ${poId} drafted`, {
        description: `${remaining} item${remaining === 1 ? '' : 's'} still pending an award. Pick a vendor for the rest below.`,
      });
    }
  }

  function handleCancelWizardRfq() {
    if (!wizardRfqId) return;
    cancelRFQ(wizardRfqId);
    setWizardRfqId(null);
    toast.warning(`Cancelled RFQ`, { description: 'Back to vendor selection.' });
  }

  const cardClass = `rounded-lg p-6 mb-6 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white border border-gray-200'}`;
  const labelClass = isDark ? 'text-gray-200' : 'text-gray-900';
  const inputClass = `mt-2 ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white'}`;
  const hintClass = `text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`;

  // ── Sourcing DAG · 5-step stepper ──────────────────────────────────
  const SourcingDAG = () => (
    <div className="mt-3">
      <div className="flex items-center gap-1">
        {STEP_LABELS.slice(0, 4).map((label, i) => {
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
                    ? 'bg-[#4bbcbe] text-white cursor-pointer hover:bg-[#2c9a9c]'
                    : active
                      ? 'bg-amber-500 text-white ring-2 ring-amber-500/30 ring-offset-1 ' + (isDark ? 'ring-offset-[#1a1a1a]' : 'ring-offset-white')
                      : isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-500'
                }`}>
                {done ? <CheckCircle className="h-3 w-3" /> : num}
              </button>
              <span className={`text-[10px] font-semibold truncate ${
                done ? isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'
                : active ? isDark ? 'text-white' : 'text-gray-900'
                : isDark ? 'text-gray-500' : 'text-gray-500'
              }`}>{label}</span>
              {i < 3 && (
                <div className={`flex-1 h-0.5 min-w-[6px] rounded-full transition-colors ${
                  done ? 'bg-[#4bbcbe]' : isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Vendor metrics shown in step 2 + right panel ───────────────────
  const primaryVendor = useMemo(() => {
    const id = selectedVendors[0];
    return id ? (finnsSuppliers.find(v => v.id === id) ?? null) : null;
  }, [selectedVendors]);

  // ── Atlas chat ─────────────────────────────────────────────────────
  const [atlasMessages, setAtlasMessages] = useState<{ from: 'atlas' | 'user'; text: string }[]>([
    { from: 'atlas', text: "I'll validate vendors and prices against the 30-day market median as you go. Ask me anything at any step." },
  ]);
  const [atlasInput, setAtlasInput] = useState('');
  const sendAtlas = () => {
    const txt = atlasInput.trim();
    if (!txt) return;
    setAtlasMessages(prev => [...prev, { from: 'user', text: txt }]);
    setAtlasInput('');
    setTimeout(() => {
      setAtlasMessages(prev => [...prev, { from: 'atlas', text: "Pulling the latest market data for this lane. Recommendation incoming." }]);
    }, 800);
  };

  // ── Step subtitles ─────────────────────────────────────────────────
  const stepSubtitle: Record<number, string> = {
    1: 'Items + venue targets + playbook',
    2: primaryVendor ? `Reliability for ${primaryVendor.name}` : 'Vendor reliability + alternatives',
    3: 'Logistics risk on this lane',
    4: 'Final audit summary before deploy',
    5: 'Hand-off complete',
  };

  // ══════════════════════════════════════════════════════════════════
  // LEFT PANEL — Draft summary + Atlas history
  // ══════════════════════════════════════════════════════════════════
  const wizardLeftPanel = (
    <div className="flex flex-col h-full">
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <ScrollText className={`h-3.5 w-3.5 ${SAGE.icon(isDark)}`} />
          <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Draft Summary</span>
        </div>
        <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Step {step}/5 · {STEP_LABELS[step - 1]}</p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <div>
            <Label className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Request</Label>
            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{requestName || '(unnamed)'}</p>
          </div>

          <div>
            <Label className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Items</Label>
            {items.length === 0 ? (
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>None yet</p>
            ) : (
              <div className="mt-1 space-y-1">
                {items.slice(0, 5).map(it => (
                  <div key={it.id} className="flex items-center justify-between gap-1">
                    <span className={`text-[10px] truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{it.name}</span>
                    <span className={`text-[10px] shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{it.qty} {it.unit}</span>
                  </div>
                ))}
                {items.length > 5 && (
                  <span className={`text-[9px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>+{items.length - 5} more</span>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Playbook</Label>
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold">
              <span className={`px-1.5 py-0.5 rounded ${SAGE.badge(isDark)}`}>{playbook}</span>
              <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{finnsPlaybooks.find(p => p.id === playbook)?.name}</span>
            </div>
          </div>

          {targetVenues.length > 0 && (
            <div>
              <Label className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Target Venues</Label>
              <div className="mt-1"><VenueChips venues={targetVenues} isDark={isDark} /></div>
            </div>
          )}

          {selectedVendors.length > 0 && primaryVendor && (
            <div>
              <Label className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Primary Vendor</Label>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{primaryVendor.name}</p>
              <p className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{primaryVendor.region} · {primaryVendor.metrics.composite} composite</p>
            </div>
          )}

          {items.length > 0 && (
            <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
              <Label className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Subtotal</Label>
              <p className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{fmtIdrShort(itemsTotalIdr)}</p>
              <p className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>before tax / freight</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // RIGHT PANEL — Atlas Copilot, step-reactive
  // ══════════════════════════════════════════════════════════════════
  const rightPanel = (
    <div className="flex flex-col h-full">
      <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className={`h-3.5 w-3.5 ${SAGE.icon(isDark)}`} />
          <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Atlas Copilot</span>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        </div>
        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{`Step ${step} · ${stepSubtitle[step]}`}</p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">

          {step === 1 && (
            <>
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'}`}>
                <AgentCTA
                  isDark={isDark}
                  variant="inline"
                  agentLabel="A-01 · Sourcing Agent"
                  reasoning="Describe why — not just what. The clearer your intent, the better A-01 (Sourcing) can recommend vendors and playbooks downstream. Items can have multiple venue tags — that's how A-05 (Logistics) knows where to route the drop."
                  offModeMessage="Describe why — not just what. List each line item with its category, quantity, and venue tags so receiving knows where each drop goes."
                />
                <div className={`mt-2 pt-2 border-t flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Spending pulse</span>
                  <span className={`text-[10px] font-bold ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>{fmtIdrShort(itemsTotalIdr)} of Rp 12jt monthly</span>
                </div>
              </div>

              {/* 5e — Category mix */}
              {items.length > 0 && (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Package className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                    <span className={`text-[9px] font-bold uppercase ${SAGE.icon(isDark)}`}>Category mix</span>
                    <span className={`ml-auto text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{items.length} line{items.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="space-y-1">
                    {categoryMix.map(([cat, count]) => {
                      const pct = (count / items.length) * 100;
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-[10px] ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{cat}</span>
                            <span className={`text-[10px] font-bold ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>{count}</span>
                          </div>
                          <div className={`h-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                            <div className="h-1 rounded-full bg-[#4bbcbe]" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5e — Similar past POs (insight; always shown) */}
              {similarPastPOs.length > 0 && (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ScrollText className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                    <span className={`text-[9px] font-bold uppercase ${SAGE.icon(isDark)}`}>Similar past POs</span>
                  </div>
                  <p className={`text-[9px] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    A-01 found {similarPastPOs.length} recent {similarPastPOs.length === 1 ? 'PO' : 'POs'} with overlapping categories.
                  </p>
                  <div className="space-y-1.5">
                    {similarPastPOs.map(e => (
                      <div key={e.id} className={`p-2 rounded ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {e.category && (
                            <span className={`text-[9px] font-semibold px-1 py-0 rounded ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>{e.category}</span>
                          )}
                          {e.entity?.id && (
                            <span className={`text-[10px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{e.entity.id}</span>
                          )}
                        </div>
                        <p className={`text-[10px] mt-0.5 leading-snug ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{e.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && primaryVendor && (
            <>
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                  <span className={`text-[9px] font-bold uppercase ${SAGE.icon(isDark)}`}>Vendor Reliability</span>
                </div>
                <p className={`text-[11px] font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{primaryVendor.name}</p>
                {([['Composite', primaryVendor.metrics.composite], ['On-time', primaryVendor.metrics.onTime], ['Cold-chain', primaryVendor.metrics.coldChain]] as const).map(([k, v]) => (
                  <div key={k} className="mb-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{k}</span>
                      <span className={`text-[10px] font-bold ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>{v}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                      <div className="h-1.5 rounded-full bg-[#4bbcbe]" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))}
                <p className={`text-[9px] mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Account manager: {primaryVendor.accountManager.name} · WhatsApp {primaryVendor.accountManager.whatsapp}
                </p>
              </div>

              {/* 5d — team note from prior admins, read from entityNotes.
                  Editable on Suppliers page; surfaced here read-only so the
                  user picking a vendor sees what teammates noted before. */}
              <VendorNotePanel vendorId={primaryVendor.id} vendorName={primaryVendor.name} isDark={isDark} onNavigate={onNavigate} />
            </>
          )}

          {step === 3 && (
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-amber-500/8 border-amber-500/25' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <MapPin className={`h-3 w-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                <span className={`text-[9px] font-bold uppercase ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Logistics Risk Map</span>
              </div>
              <div className="space-y-1.5">
                <p className={`text-[10px] flex items-start gap-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span>🌧️</span> Java monsoon edge — Bintang / Krakatoa cold-chain +6–12h variance.
                </p>
                <p className={`text-[10px] flex items-start gap-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span>⚠️</span> Tanjung Priok port — minor congestion. Imports +1 day.
                </p>
                <p className={`text-[10px] flex items-start gap-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span>✓</span> Bali local supply (PT Bali Seafood, CV Indo Sayur) — all clear.
                </p>
              </div>
              <p className={`text-[9px] mt-2 italic ${isDark ? 'text-amber-300/80' : 'text-amber-700/80'}`}>
                BC kitchen receives 06:00–10:00 only. ST takes evening drops.
              </p>
            </div>
          )}

          {step === 4 && (
            <>
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                  <span className={`text-[9px] font-bold uppercase ${SAGE.icon(isDark)}`}>Audit Summary</span>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  {[
                    ['Items', `${items.length} line${items.length === 1 ? '' : 's'}`],
                    ['Subtotal', fmtIdrShort(itemsTotalIdr)],
                    ['Playbook', `${playbook} · ${finnsPlaybooks.find(p => p.id === playbook)?.name}`],
                    ['Vendor', primaryVendor?.name ?? '(none selected)'],
                    ['Venues', targetVenues.join(', ') || '(none)'],
                    ['Recurring', recurring ? recurringFrequency : 'no'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{k}</span>
                      <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5e — Policy preview · what would A-04 do? */}
              {policyPreview.checks.length > 0 && (
                <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShieldCheck className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                    <span className={`text-[9px] font-bold uppercase ${SAGE.icon(isDark)}`}>Policy preview</span>
                  </div>
                  <p className={`text-[9px] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    A-04 (Spend Watchdog) runs these checks at Stage 3 (PO Approved). Anything below at "warn" or "review" gets surfaced for your sign-off.
                  </p>
                  <div className="space-y-1.5">
                    {policyPreview.checks.map((c, idx) => {
                      const tone =
                        c.status === 'pass' ? (isDark ? 'text-green-400' : 'text-green-700')
                        : c.status === 'review' ? (isDark ? 'text-amber-300' : 'text-amber-700')
                                                : (isDark ? 'text-red-400' : 'text-red-600');
                      const Icon = c.status === 'pass' ? CheckCircle : AlertTriangle;
                      return (
                        <div key={idx} className={`p-2 rounded ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-1.5">
                            <Icon className={`h-3 w-3 shrink-0 ${tone}`} />
                            <span className={`text-[10px] font-semibold ${tone}`}>
                              {c.status.toUpperCase()}
                            </span>
                            <span className={`text-[10px] truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.rule}</span>
                          </div>
                          <p className={`text-[9px] mt-0.5 leading-tight ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{c.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                <span className={`text-[9px] font-bold uppercase ${SAGE.icon(isDark)}`}>Hand-off Complete</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                PO routed to Orders. {PLAYBOOK_META[playbook].agent} (Sourcing) is on Stage 2 now. You'll see venue receiving on Stage 5.
              </p>
            </div>
          )}

          {/* Chat history */}
          <div className="space-y-2 pt-2">
            {atlasMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] px-3 py-2 rounded-xl text-[10px] leading-snug ${
                  msg.from === 'user'
                    ? isDark ? 'bg-[#4bbcbe] text-white' : 'bg-[#2c9a9c] text-white'
                    : isDark ? 'bg-[#2a2a2a] text-gray-300 border border-gray-800' : 'bg-gray-100 text-gray-700'
                }`}>{msg.text}</div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Chat input pinned bottom */}
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
            className={`shrink-0 h-7 w-7 p-0 ${atlasInput.trim() ? 'bg-[#4bbcbe] hover:bg-[#2c9a9c] text-white' : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex h-full ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
      {/* Left sidebar — Draft summary */}
      <div className={`w-72 h-full border-r shrink-0 ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
        {wizardLeftPanel}
      </div>

      {/* Center — Sourcing Wizard */}
      <div className={`flex flex-col h-full flex-1 min-w-0 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b shrink-0 ${isDark ? 'border-gray-700 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${
                  isDark ? 'bg-[#4bbcbe]/15 border-[#4bbcbe]/40 text-[#82d3d5]' : 'bg-[#eafafa] border-[#4bbcbe]/40 text-[#2c9a9c]'
                }`}>
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Sourcing Portal
                </span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                }`}>
                  <Lock className="h-2.5 w-2.5" /> Internal Directory
                </span>
              </div>
              <h1 className={`mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {step === 5 ? 'PO Authorized · Routing to Orders' : 'Authorize a new procurement'}
              </h1>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stepSubtitle[step]}</p>
              {step < 5 && <SourcingDAG />}
            </div>
            {/* Compose + Tracker triggers moved into Step 2 — the
                wizard is the only place where RFQs originate or get
                acted on. Page header stays clean. */}
          </div>

          {/* Phase 6 — per-PO autonomy banner. Tiny, persistent, lives
              under the SourcingDAG and reflects the per-PO picker on
              Step 1 (not a global state). Tinted so the user sees the
              wizard's downstream behaviour at a glance. */}
          {step < 5 && (
            <div className={`mt-3 p-2.5 rounded-lg border text-[11px] flex items-center gap-2 flex-wrap ${
              poAutonomy === 'auto'
                ? isDark ? 'bg-[#4bbcbe]/10 border-[#4bbcbe]/30 text-[#82d3d5]' : 'bg-[#eafafa] border-[#c4eef0] text-[#2c9a9c]'
                : isDark ? 'bg-amber-500/8 border-amber-500/25 text-amber-300/90' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <span className="font-bold uppercase tracking-wide text-[9px]">
                This PO · {poAutonomy === 'auto' ? 'Auto' : 'Manual'}
              </span>
              <span>·</span>
              <span>
                {poAutonomy === 'auto'
                  ? 'A-01 pre-picks the top-matched vendor on Step 2 and surfaces RFQ when there is no clear winner. You always have override.'
                  : 'You drive Step 2 — pick a vendor or send an RFQ. Smart suggestions are still visible; nothing is pre-selected.'}
              </span>
              <span className="ml-auto text-[9px] opacity-70">Switch on Step 1</span>
            </div>
          )}

          {/* Express Mode banner */}
          {expressMode && expressMode !== 'restock' && step < 5 && (
            <div className={`mt-3 p-2.5 rounded-lg border flex items-center gap-2 flex-wrap ${
              isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-300/60'
            }`}>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
              }`}>⚡ Express Lane</span>
              <span className={`text-[11px] font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                {expressMode === 'reorder'
                  ? `Carbon copy of ${expressContext?.from ?? 'a previous PO'} · landed on Review`
                  : 'Blank canvas · ready to add items'}
              </span>
              <button onClick={() => { setExpressMode(null); setStep(1); }}
                className={`ml-auto text-[10px] font-bold ${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-900'}`}>
                ← Restart
              </button>
            </div>
          )}

          {/* Inventory restock banner */}
          {inventoryContext && step < 5 && (
            <div className={`mt-3 p-2.5 rounded-lg border flex items-center gap-2 flex-wrap ${
              isDark ? 'bg-red-500/8 border-red-500/30' : 'bg-red-50 border-red-300/60'
            }`}>
              <Flame className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
              <span className={`text-[11px] font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                Pre-filled from Inventory · {inventoryContext.skuId}
              </span>
              <span className={`text-[10px] ${isDark ? 'text-red-300/80' : 'text-red-700/80'}`}>
                {inventoryContext.skuName ?? 'SKU'} fell below par · playbook auto-set to <strong>Rush</strong>
                {inventoryContext.vendor ? ` · vendor ${inventoryContext.vendor} pre-selected` : ''}
              </span>
              <button onClick={() => {
                if (inventoryContext?.skuId) {
                  window.dispatchEvent(new CustomEvent('finns-restock-intent-failed', {
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

        {/* Step content area */}
        <ScrollArea className="flex-1 min-h-0">
          <div key={step} ref={centerPanelRef}
            className="px-6 py-6 max-w-3xl mx-auto w-full"
            style={{ animation: 'wizard-slide-in 280ms cubic-bezier(0.34, 1.4, 0.64, 1)' }}>
            <style>{`
              @keyframes wizard-slide-in {
                0%   { opacity: 0; transform: translateX(12px); }
                100% { opacity: 1; transform: translateX(0); }
              }
            `}</style>

            {/* ── STEP 1: Items ─────────────────────────────────────── */}
            {step === 1 && (
              <>
                {/* Atlas · Market Price Trends — synthesized 30d trend
                    across the current basket. Inline (not in the right
                    panel) because it shapes the decision the user is
                    making right here: keep adding, or lock now. */}
                {(() => {
                  const trends = summarizeMarketTrends(items.map(it => it.name));
                  if (!trends) return null;
                  return (
                    <div className={`p-3 rounded-lg border mb-4 ${
                      isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'
                    }`}>
                      <div className="flex items-start gap-2">
                        <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${SAGE.icon(isDark)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${SAGE.icon(isDark)}`}>
                              Atlas · Market Price Trends
                            </span>
                            <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>· 30d</span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {trends.lead}{' '}
                            <span className={`font-semibold ${SAGE.icon(isDark)}`}>{trends.recommendation}</span>
                          </p>
                          {trends.trends.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              {trends.trends.slice(0, 6).map(t => (
                                <span key={t.name} className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${
                                  t.direction === 'down'
                                    ? isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'
                                    : t.direction === 'up'
                                      ? isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'
                                      : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {t.direction === 'down' ? '↓' : t.direction === 'up' ? '↑' : '→'}
                                  {Math.abs(t.pct).toFixed(1)}%
                                  <span className="opacity-70 truncate max-w-[80px]">{t.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className={cardClass}>
                  <div className="space-y-5">
                    <div>
                      <Label htmlFor="requestName" className={labelClass}>Request Name <span className="text-red-500">*</span></Label>
                      <Input id="requestName" value={requestName} onChange={e => setRequestName(e.target.value)}
                        placeholder="e.g., Weekly produce restock"
                        className={inputClass} />
                    </div>
                    <div>
                      <Label htmlFor="description" className={labelClass}>Context (Optional)</Label>
                      <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)}
                        placeholder="Strategic intent — why this request, for which venues, by when…"
                        className={`${inputClass} min-h-[80px]`} />
                    </div>
                  </div>
                </div>

                {/* Line items */}
                <div className={cardClass}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className={`text-sm font-semibold ${labelClass}`}>Line Items</h2>
                    <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{items.length} item{items.length === 1 ? '' : 's'} · {fmtIdrShort(itemsTotalIdr)}</span>
                  </div>

                  <div className="space-y-2 mb-3">
                    {items.map(item => (
                      <div key={item.id} className={`p-3 rounded-lg border ${isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</span>
                          <button onClick={() => removeItem(item.id)}
                            className={`shrink-0 p-1 rounded ${isDark ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded ${SAGE.badge(isDark)}`}>{item.category}</span>
                          {/* +/- qty stepper — consumer-grade quantity control */}
                          <div className={`flex items-center rounded-full border overflow-hidden ${
                            isDark ? 'border-gray-700' : 'border-[#dddddd]'
                          }`}>
                            <button
                              onClick={() => setItems(prev => prev.map(i => i.id === item.id && i.qty > 1 ? { ...i, qty: i.qty - 1 } : i))}
                              className={`w-6 h-6 flex items-center justify-center text-sm transition-colors ${
                                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-[#eafafa] text-gray-500'
                              }`}
                            >−</button>
                            <span className={`px-2 text-[10px] font-semibold min-w-[36px] text-center ${isDark ? 'text-white' : 'text-[#222222]'}`}>
                              {item.qty} {item.unit}
                            </span>
                            <button
                              onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))}
                              className={`w-6 h-6 flex items-center justify-center text-sm transition-colors ${
                                isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-[#eafafa] text-gray-500'
                              }`}
                            >+</button>
                          </div>
                          {item.unitPriceIdr > 0 && <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>· {fmtIdrShort(item.unitPriceIdr)}/{item.unit}</span>}
                          <span className={`ml-auto text-[9px] uppercase font-bold ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Venues</span>
                          <VenueChips venues={item.venues} isDark={isDark} onToggle={v => toggleItemVenue(item.id, v)} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add new item — smart-detect (5b) auto-fills category /
                      unit / venues as the user types the item name. */}
                  <div className={`p-3 rounded-lg border border-dashed ${isDark ? 'bg-[#2a2a2a]/40 border-gray-700' : 'bg-white border-gray-300'}`}>
                    <Label className={`text-[10px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Add Line Item</Label>
                    <div className="mt-2 grid grid-cols-12 gap-2">
                      <Input placeholder='Item name (try "Wagyu Ribeye", "Yellowfin Tuna", "Bintang Beer"…)'
                        value={newItemName} onChange={e => setNewItemName(e.target.value)}
                        className={`col-span-5 ${inputClass} mt-0`} />
                      <select value={newItemCategory}
                        onChange={e => { setNewItemCategory(e.target.value as FinnsCategory); setOverridden(o => ({ ...o, category: true })); }}
                        className={`col-span-3 rounded-md px-2 text-xs ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : 'bg-white border border-gray-200'}`}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Input placeholder="Qty" value={newItemQty} onChange={e => setNewItemQty(e.target.value)} type="number"
                        className={`col-span-2 ${inputClass} mt-0`} />
                      <Input placeholder="Unit" value={newItemUnit}
                        onChange={e => { setNewItemUnit(e.target.value); setOverridden(o => ({ ...o, unit: true })); }}
                        className={`col-span-2 ${inputClass} mt-0`} />
                      <Input placeholder="Budget hint per unit (Rp) — optional"
                        title="Reference price you'd be happy paying per unit. Used as a budget signal in RFQs and to estimate the order total in Step 4 — it is NOT what the vendor will charge."
                        value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} type="number"
                        className={`col-span-8 ${inputClass} mt-0`} />
                      <div className="col-span-4 flex items-center gap-2">
                        <VenueChips venues={newItemVenues} isDark={isDark}
                          onToggle={v => {
                            setNewItemVenues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
                            setOverridden(o => ({ ...o, venues: true }));
                          }} />
                      </div>
                    </div>

                    {/* Smart-detect hint — always visible when there's
                        a match. Detection is autocomplete UX, not an
                        agent action; it runs on every PO regardless of
                        Manual / Auto. (Phase 6 — was gated in 5c, now
                        decoupled.) */}
                    {detectedFromName && newItemName.trim().length > 0 && (
                      <div className={`mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-md text-[10px] ${
                        isDark ? 'bg-[#4bbcbe]/15 text-[#82d3d5]' : 'bg-[#eafafa] text-[#2c9a9c]'
                      }`}>
                        <Sparkles className="h-3 w-3" />
                        <span className="font-semibold">A-01 detected:</span>
                        <span>{detectedFromName.category}</span>
                        {detectedFromName.unit && (<><span className="opacity-50">·</span><span>unit "{detectedFromName.unit}"</span></>)}
                        {detectedFromName.venues && detectedFromName.venues.length > 0 && (
                          <><span className="opacity-50">·</span><span>typically {detectedFromName.venues.join(' / ')}</span></>
                        )}
                        <span className={`opacity-60 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          · auto-filled (edit to override)
                        </span>
                      </div>
                    )}

                    <Button onClick={addItem} disabled={!newItemName.trim()} size="sm"
                      className={`mt-3 h-7 text-[11px] ${SAGE.primary(isDark)}`}>
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  </div>
                </div>

                {/* Quick Pick — browse catalog tiles instead of typing.
                    Filters as the user types; shows all when name is empty.
                    Category colour-coded. Clicking a tile adds the SKU to
                    the basket at the par-gap qty (or 1 as fallback). */}
                {(() => {
                  const query = newItemName.trim().toLowerCase();
                  const matches = finnsSKUs.filter(sku =>
                    !sku.archived &&
                    (query.length < 2 || sku.name.toLowerCase().includes(query))
                  ).slice(0, 12);
                  if (matches.length === 0) return null;
                  const CAT_COLORS: Record<string, string> = {
                    Protein:   '#991b1b', Seafood: '#075985', Produce: '#166534',
                    'Dry Goods': '#334155', Dairy: '#0e7490', Beverages: '#92400e', Other: '#64748b',
                  };
                  return (
                    <div className={cardClass}>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Quick Add from Catalog
                        </span>
                        <span className={`text-[9px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          {query.length >= 2 ? `${matches.length} match${matches.length !== 1 ? 'es' : ''}` : `${matches.length} items`}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {matches.map(sku => {
                          const dot = CAT_COLORS[sku.category] ?? '#64748b';
                          const gap = Math.max(1, Math.ceil(sku.par - sku.onHand));
                          const alreadyAdded = items.some(it =>
                            it.name.toLowerCase().includes(sku.name.split(' ')[0].toLowerCase())
                          );
                          return (
                            <button
                              key={sku.id}
                              disabled={alreadyAdded}
                              onClick={() => {
                                setItems(prev => [...prev, {
                                  id: `sku-${sku.id}-${Date.now()}`,
                                  name: sku.name,
                                  category: sku.category as FinnsCategory,
                                  qty: gap,
                                  unit: sku.uom,
                                  unitPriceIdr: 0,
                                  venues: sku.venues as VenueTag[],
                                }]);
                                toast.success(`Added ${sku.name}`, {
                                  description: `${gap} ${sku.uom} · par gap`,
                                });
                              }}
                              className={`text-left p-2.5 rounded-lg border transition-all ${
                                alreadyAdded
                                  ? isDark ? 'opacity-40 border-gray-800 cursor-not-allowed' : 'opacity-40 border-gray-200 cursor-not-allowed'
                                  : isDark
                                    ? 'border-gray-700 hover:border-[#4bbcbe]/50 hover:bg-[#4bbcbe]/8'
                                    : 'border-[#dddddd] hover:border-[#4bbcbe]/40 hover:bg-[#eafafa]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                                <span className={`text-[9px] font-semibold uppercase tracking-wide`} style={{ color: dot }}>
                                  {sku.category}
                                </span>
                              </div>
                              <p className={`text-[11px] font-semibold leading-tight mb-1 ${isDark ? 'text-white' : 'text-[#222222]'}`}>
                                {sku.name}
                              </p>
                              <p className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {sku.onHand} {sku.uom} in stock · par {sku.par}
                              </p>
                              {alreadyAdded && (
                                <p className={`text-[9px] font-semibold mt-0.5 ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>
                                  ✓ added
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Atlas · Complementary items — items that frequently
                    co-occur in past Finn's POs of the same category mix.
                    Click [+ Add] to drop one into the basket. Hidden
                    when there are no suggestions left to make. */}
                {(() => {
                  const suggestions = suggestComplementary(items.map(it => it.name));
                  if (suggestions.length === 0) return null;
                  return (
                    <div className={`p-3 rounded-lg border mb-6 ${
                      isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'
                    }`}>
                      <div className="flex items-start gap-2 mb-2">
                        <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${SAGE.icon(isDark)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${SAGE.icon(isDark)}`}>
                              Atlas · Suggested Items
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Based on past orders, these {suggestions.length === 1 ? 'item is' : 'items are'} typically requested alongside your current basket.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {suggestions.map(s => (
                          <div key={s.name} className={`flex items-center gap-2 p-2 rounded ${
                            isDark ? 'bg-[#1a1a1a]' : 'bg-white border border-[#c4eef0]'
                          }`}>
                            <div className="min-w-0 flex-1">
                              <p className={`text-[11px] font-semibold ${labelClass}`}>{s.name}</p>
                              <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {s.qty}{s.unit} · {s.reason}
                              </p>
                            </div>
                            <button
                              onClick={() => addComplementary(s)}
                              className={`shrink-0 text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded font-bold transition-colors ${
                                isDark ? 'bg-[#4bbcbe]/20 text-[#82d3d5] hover:bg-[#4bbcbe]/30' : 'bg-[#eafafa] text-[#2c9a9c] hover:bg-[#d6f4f5] border border-[#c4eef0]'
                              }`}>
                              <Plus className="h-3 w-3" /> Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Per-PO autonomy picker (Phase 6d) — sits on Step 1
                    so the choice is locked before Step 2's auto-pre-pick
                    runs. Default = Auto. Manual flips the wizard's
                    downstream behaviour: no vendor auto-pre-pick, Submit
                    routes to Orders without handing off to A-04. */}
                <div className={cardClass}>
                  <h2 className={`text-sm font-semibold mb-2 ${labelClass}`}>How should this PO be handled?</h2>
                  <p className={hintClass}>Per-PO choice — you can flip later from the labor switch on the order itself.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => setPoAutonomy('auto')}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        poAutonomy === 'auto' ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className={`h-3.5 w-3.5 ${poAutonomy === 'auto' ? SAGE.icon(isDark) : (isDark ? 'text-gray-500' : 'text-gray-500')}`} />
                        <span className={`text-xs font-bold ${labelClass}`}>Auto · AI agent</span>
                      </div>
                      <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        A-01 pre-picks the top-matched vendor on Step 2. After authorize, A-04 gates the policy stack and runs the lifecycle within rules. You review exceptions.
                      </p>
                    </button>
                    <button onClick={() => setPoAutonomy('manual')}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        poAutonomy === 'manual' ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className={`h-3.5 w-3.5 ${poAutonomy === 'manual' ? SAGE.icon(isDark) : (isDark ? 'text-gray-500' : 'text-gray-500')}`} />
                        <span className={`text-xs font-bold ${labelClass}`}>Manual · you drive</span>
                      </div>
                      <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        You pick the vendor, run each stage. Agents still surface smart suggestions + Atlas chat is available, but no autonomous action without your sign-off.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Playbook selector */}
                <div className={cardClass}>
                  <h2 className={`text-sm font-semibold mb-2 ${labelClass}`}>Playbook</h2>
                  <p className={hintClass}>How the order flows from intake to delivery.</p>
                  <div className="mt-3 space-y-2">
                    {finnsPlaybooks.map(p => {
                      const meta = PLAYBOOK_META[p.id];
                      const Icon = meta.icon;
                      const active = playbook === p.id;
                      return (
                        <button key={p.id} onClick={() => setPlaybook(p.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${active ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)}`}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-3.5 w-3.5 ${active ? SAGE.icon(isDark) : (isDark ? 'text-gray-500' : 'text-gray-500')}`} />
                            <span className={`text-xs font-semibold ${labelClass}`}>{p.id} · {p.name}</span>
                            {p.id === 'WF-RSH' && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>Urgent</span>}
                            {p.id === 'WF-REC' && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>Schedule</span>}
                          </div>
                          <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{meta.tagline}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button disabled={items.length === 0 || !requestName.trim()}
                    onClick={() => setStep(2)}
                    className={SAGE.primary(isDark)}>
                    Next: Vendors <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ── STEP 2: Sourcing (5a) ─────────────────────────────────
                Two paths converge at "vendor chosen + amount known":
                  (a) pick a vendor directly from the directory
                  (b) send an RFQ to several vendors, wait for replies,
                      award the winner. Award auto-advances to Step 3
                      with vendor + amount + lead time locked in.
                When wizardRfqId is set the path picker is hidden — the
                only way out is Award (advance) or Cancel RFQ (reset). */}
            {step === 2 && (
              <>
                {/* Atlas · Vendor Intel — high-level read of the directory
                    against the current basket. Sits above the cross-category
                    banner so users see the broad picture before any
                    constraint warnings. Hidden inside an RFQ flow (the
                    waiting view carries its own intel). */}
                {!wizardRfqId && (() => {
                  const intel = summarizeVendorIntel(items.map(it => it.name));
                  if (!intel) return null;
                  return (
                    <div className={`p-3 rounded-lg border ${
                      isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'
                    }`}>
                      <div className="flex items-start gap-2">
                        <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${SAGE.icon(isDark)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${SAGE.icon(isDark)}`}>
                              Atlas · Vendor Intel
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {intel.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 6i — Cross-category banner. Fires when items span ≥2
                    categories AND no single vendor in the directory
                    covers them all. Three CTAs: auto-split (skip vendor
                    pick), send a multi-vendor RFQ (open the composer),
                    or proceed anyway (Path A with a Step-4 warning). */}
                {!wizardRfqId && isCrossCategoryUnservable && !crossCategoryDismissed && (
                  <div className={`p-4 rounded-xl border ${
                    isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-start gap-2 mb-3">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
                      <div className="min-w-0">
                        <p className={`text-[11px] font-bold ${labelClass}`}>
                          Cross-category basket · no single vendor covers everything
                        </p>
                        <p className={`text-[10px] mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Your basket spans <strong>{itemCategories.length} categories</strong> ({itemCategories.join(', ')}). A-01 grouped items by best-fit vendor:
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {proposedSplits.map(g => (
                        <div key={g.vendorId} className={`p-2 rounded-lg border ${
                          isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold ${labelClass}`}>{g.vendorName}</span>
                            <span className={`text-[10px] font-bold ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>
                              {g.items.length} item{g.items.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className={`text-[10px] mt-0.5 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {g.items.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => { setSplitMode(true); setStep(3); }}
                        className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-[#4bbcbe] text-white hover:bg-[#2c9a9c] transition-colors">
                        Auto-split into {proposedSplits.length} POs →
                      </button>
                      <button
                        onClick={() => { setSourcingPath('rfq'); setRfqOpen(true); }}
                        className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                          isDark ? 'border border-gray-700 text-gray-300 hover:bg-gray-800' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}>
                        Send a multi-vendor RFQ
                      </button>
                      <button
                        onClick={() => setCrossCategoryDismissed(true)}
                        title="Dismiss the banner and pick multiple vendors below — each will receive the items in their categories."
                        className={`text-[11px] font-semibold transition-colors ${
                          isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-800'
                        }`}>
                        Pick vendors manually →
                      </button>
                    </div>
                  </div>
                )}

                {/* Path picker — only visible when no RFQ is in flight */}
                {!wizardRfqId && (
                  <div className={cardClass}>
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <h2 className={`text-sm font-semibold ${labelClass}`}>How are you sourcing this?</h2>
                      <button onClick={() => setRfqTrackerOpen(true)}
                        title="See all past + active RFQs across requests."
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                          isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                        }`}>
                        <FileText className="h-3 w-3" />
                        View all RFQs
                        {activeRfqCount > 0 && (
                          <span className={`ml-0.5 text-[9px] font-bold px-1 py-0 rounded-full ${
                            isDark ? 'bg-[#4bbcbe]/30 text-[#82d3d5]' : 'bg-[#4bbcbe]/20 text-[#2c9a9c]'
                          }`}>
                            {activeRfqCount}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSourcingPath('pick')}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          sourcingPath === 'pick' ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                        }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Users className={`h-4 w-4 ${sourcingPath === 'pick' ? SAGE.icon(isDark) : (isDark ? 'text-gray-500' : 'text-gray-500')}`} />
                          <span className={`text-xs font-bold ${labelClass}`}>I know my vendor</span>
                        </div>
                        <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Pick directly from the approved directory. Fastest path when you already have a preferred supplier.
                        </p>
                      </button>
                      <button
                        onClick={() => setSourcingPath('rfq')}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          sourcingPath === 'rfq' ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)
                        }`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Mail className={`h-4 w-4 ${sourcingPath === 'rfq' ? SAGE.icon(isDark) : (isDark ? 'text-gray-500' : 'text-gray-500')}`} />
                          <span className={`text-xs font-bold ${labelClass}`}>Compare quotes (RFQ)</span>
                        </div>
                        <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          WhatsApp / email several vendors. Quotes arrive here live — pick the winner to lock in your vendor.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Path A: Pick directly ───────────────────────────── */}
                {!wizardRfqId && sourcingPath === 'pick' && (() => {
                  // 6d — Vendor relevance ranking is always on. It's
                  // analysis (item-category overlap + composite), not
                  // an agent action. The user benefits from "most
                  // relevant vendors first" regardless of per-PO Manual
                  // / Auto choice. Only the auto-pre-pick (selection)
                  // is gated by the per-PO autonomy setting.
                  const suggestedIds = suggestVendorsForItems(items.map(it => it.name), 10);
                  const suggestedSet = new Set(suggestedIds);
                  const suggested = suggestedIds
                    .map(id => finnsSuppliers.find(v => v.id === id)!)
                    .filter(Boolean);
                  const rest = finnsSuppliers
                    .filter(v => !suggestedSet.has(v.id))
                    .sort((a, b) => b.metrics.composite - a.metrics.composite);
                  const ordered = [...suggested, ...rest];
                  return (
                  <div className={cardClass}>
                    <h2 className={`text-sm font-semibold mb-3 ${labelClass}`}>Approved Directory</h2>
                    <AgentCTA
                      isDark={isDark}
                      variant="inline"
                      className="mb-2"
                      agentLabel="A-01 · Sourcing Agent"
                      reasoning={`A-01 ranks the directory by overlap with your items + composite + SLA. ${suggested.length > 0 ? `Top ${suggested.length} match your categories.` : ''} Pick one vendor for a single-PO order, or pick multiple to split a cross-category basket across them. After approval each PO is forwarded via the vendor's preferred channel (WhatsApp first, email if formal).`}
                      offModeMessage="Pick vendors from your approved directory. One vendor for a single PO; multiple vendors split a cross-category basket — each receives the items in their categories. Sort by composite, on-time, or cold-chain SLA using the row metrics."
                    />
                    <div className="mt-4 space-y-2">
                      {ordered.map((v, idx) => {
                        const selected = selectedVendors.includes(v.id);
                        const selectionIndex = selected ? selectedVendors.indexOf(v.id) : -1;
                        const isSuggested = suggestedSet.has(v.id) && idx < suggested.length;
                        const isFirstNonSuggested = idx === suggested.length && suggested.length > 0;
                        return (
                          <div key={v.id}>
                            {isFirstNonSuggested && (
                              <div className={`flex items-center gap-2 my-2 text-[9px] uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                <span className={`flex-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                                <span>Other approved vendors</span>
                                <span className={`flex-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                              </div>
                            )}
                            <button onClick={() => toggleVendor(v.id)}
                              className={`w-full text-left p-3 rounded-lg border transition-colors ${selected ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)}`}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-semibold ${labelClass}`}>{v.name}</span>
                                  {selected && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${SAGE.badge(isDark)}`}>
                                      {selectedVendors.length > 1 ? `Selected #${selectionIndex + 1}` : 'Selected'}
                                    </span>
                                  )}
                                  {isSuggested && !selected && (
                                    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                      isDark ? 'bg-[#4bbcbe]/20 text-[#82d3d5]' : 'bg-[#eafafa] text-[#2c9a9c]'
                                    }`}>
                                      <Sparkles className="h-2.5 w-2.5" /> Match
                                    </span>
                                  )}
                                  {heldVendors.has(v.name) && (
                                    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                      isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-700'
                                    }`}>
                                      <AlertTriangle className="h-2.5 w-2.5" /> PO Hold
                                    </span>
                                  )}
                                  {/* 6i — coverage chip. Only shows when items span ≥2 categories. */}
                                  {itemCategories.length >= 2 && (() => {
                                    const cov = vendorCoverage(v.id);
                                    if (cov.covered === cov.total) {
                                      return (
                                        <span title="This vendor supplies every category in your basket"
                                              className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                                isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                                              }`}>
                                          ✓ Covers all
                                        </span>
                                      );
                                    }
                                    return (
                                      <span title={`This vendor supplies ${cov.covered} of ${cov.total} item categories. Combine with another vendor for the missing categories, or pick a vendor that covers all.`}
                                            className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                              isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                                            }`}>
                                        Covers {cov.covered}/{cov.total}
                                      </span>
                                    );
                                  })()}
                                  {/* 5d — team note exists indicator */}
                                  {(() => {
                                    const n = readEntityNote('supplier', v.id);
                                    return n ? (
                                      <span title="Team note exists — see right panel"
                                            className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                              isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                                            }`}>
                                        <StickyNote className="h-2.5 w-2.5" /> Note
                                      </span>
                                    ) : null;
                                  })()}
                                  <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{v.region} · {v.type}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-bold ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>{v.metrics.composite}</span>
                                  <VenueChips venues={v.venuesServed} isDark={isDark} />
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>On-time {v.metrics.onTime}%</span>
                                <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Cold-chain {v.metrics.coldChain}%</span>
                                <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Lead {v.metrics.leadTimeDays}d</span>
                                <span className={`ml-auto text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{v.categories.join(', ')}</span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })()}

                {/* 6m — Manual multi-vendor assignment card. Visible when
                    user has picked 2+ vendors on Path A. Shows which
                    items go to which vendor (greedy by category overlap)
                    + flags items no selected vendor can supply. Same
                    visual pattern as the auto-split card so users
                    recognise it. Each vendor here mints its own PO. */}
                {!wizardRfqId && sourcingPath === 'pick' && selectedVendors.length > 1 && (
                  <div className={`p-4 rounded-xl border ${
                    manualAssignments.unassigned.length > 0
                      ? isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                      : isDark ? 'bg-[#4bbcbe]/10 border-[#4bbcbe]/40' : 'bg-[#eafafa] border-[#4bbcbe]/40'
                  }`}>
                    <div className="flex items-start gap-2 mb-3">
                      <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${
                        manualAssignments.unassigned.length > 0
                          ? isDark ? 'text-amber-300' : 'text-amber-700'
                          : isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'
                      }`} />
                      <div className="min-w-0">
                        <p className={`text-[11px] font-bold ${labelClass}`}>
                          {manualAssignments.unassigned.length > 0
                            ? `Item assignment · ${manualAssignments.unassigned.length} item${manualAssignments.unassigned.length === 1 ? '' : 's'} need another vendor`
                            : `Item assignment · ${selectedVendors.length} POs will be created`}
                        </p>
                        <p className={`text-[10px] mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Each picked vendor receives the items in their categories. Same delivery date ({neededBy}) and venues apply to all. Authorize on Step 4 mints one PO per vendor.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-2">
                      {manualAssignments.groups.map((g, idx) => (
                        <div key={g.vendor.id} className={`p-2.5 rounded-lg border ${
                          isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${SAGE.badge(isDark)}`}>
                                PO {idx + 1}
                              </span>
                              <span className={`text-xs font-semibold ${labelClass}`}>{g.vendor.name}</span>
                            </div>
                            <span className={`text-[10px] font-bold ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>
                              {g.items.length} item{g.items.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {g.items.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}
                          </p>
                        </div>
                      ))}
                      {/* Selected-but-claimed-nothing vendors */}
                      {selectedVendors
                        .filter(vid => !manualAssignments.groups.some(g => g.vendor.id === vid))
                        .map(vid => {
                          const v = finnsSuppliers.find(s => s.id === vid);
                          if (!v) return null;
                          return (
                            <div key={vid} className={`p-2.5 rounded-lg border ${
                              isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
                            }`}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${labelClass}`}>{v.name}</span>
                                <span className={`text-[10px] italic ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                  No items claimed — already covered by an earlier vendor in your selection.
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {manualAssignments.unassigned.length > 0 && (
                      <div className={`mt-2 p-2 rounded-lg border ${
                        isDark ? 'bg-amber-500/10 border-amber-500/40' : 'bg-amber-100/50 border-amber-300'
                      }`}>
                        <div className="flex items-start gap-1.5 mb-1">
                          <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
                          <p className={`text-[10px] font-bold ${labelClass}`}>
                            {manualAssignments.unassigned.length} item{manualAssignments.unassigned.length === 1 ? '' : 's'} not covered by any picked vendor
                          </p>
                        </div>
                        <p className={`text-[10px] leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'} ml-4`}>
                          {manualAssignments.unassigned.map(it => `${it.qty}${it.unit} ${it.name} (${it.category})`).join(', ')}. Pick a vendor that covers {Array.from(new Set(manualAssignments.unassigned.map(it => it.category))).join(' / ')}, or remove these items from the basket.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Atlas · Picked-vendor history — inline insight under
                    the directory when the user has selected a single
                    vendor. Pulls past interactions from the action log
                    + supplier metrics. Hidden mid-RFQ (different state). */}
                {!wizardRfqId && sourcingPath === 'pick' && selectedVendors.length === 1 && (() => {
                  const history = vendorHistory(selectedVendors[0]);
                  if (!history) return null;
                  return (
                    <div className={`p-3 rounded-lg border ${
                      isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'
                    }`}>
                      <div className="flex items-start gap-2">
                        <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${SAGE.icon(isDark)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${SAGE.icon(isDark)}`}>
                              A-01 · {history.vendorName}
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {history.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Path B: Compose RFQ (pre-send) ──────────────────── */}
                {!wizardRfqId && sourcingPath === 'rfq' && (
                  <div className={cardClass}>
                    <h2 className={`text-sm font-semibold mb-2 ${labelClass}`}>Send an RFQ</h2>
                    <p className={`text-[11px] mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      The composer opens with your <span className="font-semibold">{items.length} item{items.length === 1 ? '' : 's'}</span> from Step 1 pre-filled. Pick vendors, set a deadline + channel (WhatsApp / email), send. Quotes return here as vendors reply.
                    </p>
                    <Button onClick={() => setRfqOpen(true)} className={SAGE.primary(isDark)}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Open RFQ Composer
                    </Button>
                  </div>
                )}

                {/* ── Path B: Waiting for quotes / Awarding ─────────────
                    Stays visible until every item in the RFQ has been
                    awarded. In multi-award flows the user may award
                    several vendors here before advancing to Step 3. */}
                {wizardRfqId && wizardRfq && (() => {
                  const totalItems    = wizardRfq.items.length;
                  const awardedItemIds = new Set<string>(
                    [
                      ...wizardRfq.awards.flatMap(a => a.itemIds),
                      ...awardedQuotes.flatMap(a => a.itemIds),  // fresh awards not yet in store snapshot
                    ],
                  );
                  const awardedCount     = awardedItemIds.size;
                  const allItemsAwarded  = totalItems > 0 && awardedCount >= totalItems;
                  if (allItemsAwarded) return null;
                  const isPartiallyAwarded = awardedCount > 0;
                  const lowestTotal = wizardRfq.quotes.length > 0
                    ? Math.min(...wizardRfq.quotes.map(q => q.totalIdr))
                    : null;
                  return (
                  <div className={cardClass}>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <h2 className={`text-sm font-semibold ${labelClass}`}>
                        {isPartiallyAwarded ? 'Award the remaining items' : 'Quotes coming in'} · {wizardRfq.id}
                      </h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          wizardRfq.quotes.length === wizardRfq.vendorIds.length
                            ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                            : isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {wizardRfq.quotes.length}/{wizardRfq.vendorIds.length} quoted
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isPartiallyAwarded
                            ? isDark ? 'bg-[#4bbcbe]/20 text-[#82d3d5]' : 'bg-[#eafafa] text-[#2c9a9c]'
                            : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {awardedCount}/{totalItems} items awarded
                        </span>
                      </div>
                    </div>
                    <p className={`text-[11px] mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {isPartiallyAwarded
                        ? `${awardedQuotes.length} PO${awardedQuotes.length === 1 ? '' : 's'} drafted. Award a vendor for each remaining item — you'll continue to delivery details once everything is locked.`
                        : <>Sent via <strong>{wizardRfq.channel === 'whatsapp' ? 'WhatsApp' : 'email'}</strong> · deadline {wizardRfq.deadline}. First replies usually land within 10–30 seconds (demo).</>}
                    </p>
                    {/* Coverage progress bar */}
                    {totalItems > 0 && (
                      <div className={`h-1.5 rounded-full overflow-hidden mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                        <div className="h-full bg-[#4bbcbe] transition-all duration-300"
                             style={{ width: `${Math.round((awardedCount / totalItems) * 100)}%` }} />
                      </div>
                    )}
                    <div className="space-y-2">
                      {wizardRfq.vendorIds.map((vid, idx) => {
                        const vendorName = wizardRfq.vendorNames[idx] ?? vid;
                        const quote = wizardRfq.quotes.find(q => q.vendorId === vid);
                        const award = awardedQuotes.find(a => a.vendorId === vid)
                          ?? wizardRfq.awards.find(a => a.vendorId === vid);
                        const isAwarded = !!award;
                        const isLowest  = quote && lowestTotal != null && quote.totalIdr === lowestTotal && !isAwarded;
                        // How many items in this vendor's quote are still claimable?
                        const claimable = quote
                          ? quote.itemIds.filter(id => !awardedItemIds.has(id))
                          : [];
                        // No-bid: vendor replied but with zero overlap to remaining items.
                        const isNoBidForBasket = quote && quote.itemIds.length === 0;
                        // Items this quote was scoped to (names, for display).
                        const quoteItemNames = quote
                          ? quote.itemIds
                              .map(id => wizardRfq.items.find(it => it.id === id))
                              .filter(Boolean)
                              .map(it => `${it!.qty}${it!.unit} ${it!.name}`)
                          : [];
                        const claimableNames = quote
                          ? claimable
                              .map(id => wizardRfq.items.find(it => it.id === id))
                              .filter(Boolean)
                              .map(it => `${it!.qty}${it!.unit} ${it!.name}`)
                          : [];
                        return (
                          <div key={vid} className={`flex items-start gap-2 p-3 rounded-lg border ${
                            isAwarded
                              ? isDark ? 'bg-[#4bbcbe]/10 border-[#4bbcbe]/40' : 'bg-[#eafafa] border-[#4bbcbe]/40'
                              : isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${labelClass}`}>{vendorName}</span>
                                {isAwarded && (
                                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>
                                    <Award className="h-2.5 w-2.5" /> Awarded · {award!.poId}
                                  </span>
                                )}
                                {!isAwarded && isLowest && (
                                  <span className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                    Lowest
                                  </span>
                                )}
                                {quote && !isAwarded && (
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    claimable.length === 0
                                      ? isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
                                      : isDark ? 'bg-[#4bbcbe]/15 text-[#82d3d5]' : 'bg-[#eafafa] text-[#2c9a9c]'
                                  }`}>
                                    {isNoBidForBasket
                                      ? 'No bid'
                                      : `Quotes on ${quote.itemIds.length}/${totalItems}`}
                                  </span>
                                )}
                              </div>
                              {quote ? (
                                <>
                                  <div className={`text-[10px] mt-0.5 flex items-center gap-2 flex-wrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    <span className={`font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                      Rp {(quote.totalIdr / 1_000_000).toFixed(2)}M
                                    </span>
                                    <span className="inline-flex items-center gap-0.5">
                                      <Truck className="h-2.5 w-2.5" />
                                      {quote.leadTimeDays}d lead
                                    </span>
                                    <span>·</span>
                                    <span className={`inline-flex items-center gap-0.5 ${
                                      wizardRfq.channel === 'whatsapp'
                                        ? isDark ? 'text-[#82d3d5]' : 'text-[#25D366]'
                                        : isDark ? 'text-blue-300' : 'text-blue-700'
                                    }`}>
                                      via {wizardRfq.channel === 'whatsapp' ? 'WhatsApp' : 'email'}
                                    </span>
                                  </div>
                                  {quoteItemNames.length > 0 && (
                                    <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                      <span className="font-semibold">Quote covers:</span> {quoteItemNames.join(', ')}
                                    </p>
                                  )}
                                  {!isAwarded && quote.itemIds.length > 0 && claimable.length === 0 && (
                                    <p className={`text-[10px] mt-1 italic ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                      All items in this quote are already awarded to another vendor.
                                    </p>
                                  )}
                                  {!isAwarded && claimable.length > 0 && claimable.length < quote.itemIds.length && (
                                    <p className={`text-[10px] mt-1 italic ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                      Awarding now will lock: {claimableNames.join(', ')}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <div className={`text-[10px] mt-0.5 inline-flex items-center gap-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                  <Clock className="h-2.5 w-2.5" />
                                  Waiting on {wizardRfq.channel === 'whatsapp' ? 'WhatsApp' : 'email'} reply
                                </div>
                              )}
                              {quote?.note && (
                                <p className={`text-[10px] mt-1 italic ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>"{quote.note}"</p>
                              )}
                            </div>
                            {quote && !isAwarded && claimable.length > 0 && (
                              <button
                                onClick={() => handleAwardInWizard(quote)}
                                className={`shrink-0 text-[10px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-bold transition-colors ${
                                  isLowest
                                    ? 'bg-[#4bbcbe] text-white hover:bg-[#2c9a9c]'
                                    : isDark
                                      ? 'border border-gray-700 text-gray-300 hover:bg-gray-800'
                                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}>
                                <Award className="h-3 w-3" /> Award
                              </button>
                            )}
                            {quote && !isAwarded && quote.itemIds.length > 0 && claimable.length === 0 && (
                              <span className={`shrink-0 text-[10px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded ${
                                isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
                              }`}>
                                Items covered
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {wizardRfq.notes && (
                      <p className={`text-[10px] mt-3 p-2 rounded ${isDark ? 'bg-[#1a1a1a] text-gray-400' : 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                        <strong>Your notes to vendors:</strong> {wizardRfq.notes}
                      </p>
                    )}
                  </div>
                  );
                })()}

                {/* Wizard nav */}
                <div className="flex justify-between gap-2 mt-6">
                  <Button variant="outline" onClick={() => setStep(1)}
                    className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                    ← Back
                  </Button>
                  <div className="flex items-center gap-2">
                    {/* Cancel only if no awards have been minted yet. Once
                        a PO draft exists for any item the user shouldn't
                        be able to vaporize the RFQ from this button. */}
                    {wizardRfqId && awardedQuotes.length === 0 && (
                      <Button variant="outline" onClick={handleCancelWizardRfq}
                        className={`${isDark ? 'bg-transparent border-red-500/40 text-red-400 hover:bg-red-500/10' : 'bg-transparent border-red-300/70 text-red-600 hover:bg-red-50'}`}>
                        <X className="h-3 w-3 mr-1" /> Cancel RFQ
                      </Button>
                    )}
                    {!wizardRfqId && sourcingPath === 'pick' && (
                      <Button disabled={selectedVendors.length === 0} onClick={() => setStep(3)}
                        className={SAGE.primary(isDark)}>
                        Next: Delivery <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: Delivery ─────────────────────────────────── */}
            {step === 3 && (
              <>
                {/* Award context banner — visible when arrived here via RFQ.
                    Single-award: classic one-vendor copy. Multi-award:
                    summary header + per-PO rows so the user can see what
                    each draft is going to lock. Delivery details below
                    apply to ALL drafted POs uniformly. */}
                {awardedQuotes.length === 1 && awardedQuote && (
                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-[#4bbcbe]/10 border-[#4bbcbe]/30' : 'bg-[#eafafa] border-[#c4eef0]'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Award className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`} />
                      <div className="min-w-0">
                        <p className={`text-[11px] font-semibold ${labelClass}`}>
                          Awarded from {awardedQuote.rfqId} · {awardedQuote.vendorName}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Rp {(awardedQuote.totalIdr / 1_000_000).toFixed(2)}M · {awardedQuote.leadTimeDays}d lead · quote received via {awardedQuote.channel === 'whatsapp' ? 'WhatsApp' : 'email'} from {awardedQuote.amContact}. Fill in delivery details below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {awardedQuotes.length > 1 && (
                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-[#4bbcbe]/10 border-[#4bbcbe]/30' : 'bg-[#eafafa] border-[#c4eef0]'
                  }`}>
                    <div className="flex items-start gap-2 mb-2">
                      <Award className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[11px] font-semibold ${labelClass}`}>
                          Awarded from {awardedQuotes[0].rfqId} · {awardedQuotes.length} vendors · {awardedQuotes.length} PO drafts
                        </p>
                        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Total Rp {(awardedQuotes.reduce((s, a) => s + a.totalIdr, 0) / 1_000_000).toFixed(2)}M across {awardedQuotes.length} POs. Delivery details below apply to <strong>all drafts</strong>. Each PO ships from its own vendor.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {awardedQuotes.map(aq => {
                        const aqItems = wizardRfq?.items.filter(it => aq.itemIds.includes(it.id)) ?? [];
                        return (
                          <div key={aq.poId} className={`flex items-start gap-2 p-2 rounded text-[10px] ${
                            isDark ? 'bg-[#1a1a1a]' : 'bg-white border border-[#c4eef0]'
                          }`}>
                            <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                              {aq.poId}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`font-semibold ${labelClass}`}>
                                {aq.vendorName} · Rp {(aq.totalIdr / 1_000_000).toFixed(2)}M · {aq.leadTimeDays}d lead
                              </p>
                              <p className={`mt-0.5 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {aqItems.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className={cardClass}>
                  <h2 className={`text-sm font-semibold mb-3 ${labelClass}`}>Target Venues</h2>
                  <p className={hintClass}>Which Finn's venues receive this delivery. Multi-venue splits the drop accordingly.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {finnsVenues.map(v => {
                      const active = targetVenues.includes(v.tag);
                      return (
                        <button key={v.tag} onClick={() => toggleTargetVenue(v.tag)}
                          className={`text-left p-3 rounded-lg border transition-colors ${active ? SAGE.activeBg(isDark) : SAGE.inactiveBg(isDark)}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${active ? (isDark ? 'bg-[#4bbcbe] text-white' : 'bg-[#4bbcbe] text-white') : SAGE.badge(isDark)}`}>{v.tag}</span>
                            <span className={`text-xs font-semibold ${labelClass}`}>{v.name}</span>
                          </div>
                          <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{v.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Atlas · Logistics Intel — A-05 readout. For single-
                    vendor flows it inspects that vendor's metrics + the
                    chosen date. For multi-vendor flows (manual split,
                    auto-split, or multi-award RFQ) it produces a per-
                    vendor mini-summary so the user can spot which leg
                    of the basket is logistically risky. */}
                {(() => {
                  const involvedVendorIds: string[] =
                    awardedQuotes.length > 0
                      ? awardedQuotes.map(a => a.vendorId)
                    : splitMode
                      ? proposedSplits.map(g => g.vendorId)
                    : isManualMultiVendor
                      ? manualAssignments.groups.map(g => g.vendor.id)
                    : selectedVendors.length > 0
                      ? [selectedVendors[0]]
                      : [];
                  const multi = involvedVendorIds.length > 1;
                  if (!multi) {
                    const intel = summarizeLogistics(
                      involvedVendorIds[0] ?? null,
                      neededBy,
                      parseInt(windowDays) || 0,
                      targetVenues,
                    );
                    if (!intel) return null;
                    return (
                      <div className={`p-3 rounded-lg border ${
                        isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'
                      }`}>
                        <div className="flex items-start gap-2">
                          <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${SAGE.icon(isDark)}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-[9px] font-bold uppercase tracking-wide ${SAGE.icon(isDark)}`}>
                                A-05 · Logistics Intel
                              </span>
                              <span className={`text-[9px] px-1 py-0.5 rounded ${
                                intel.flexAssessment === 'tight'
                                  ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                                  : intel.flexAssessment === 'comfortable'
                                    ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                                    : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {intel.flexAssessment} window
                              </span>
                            </div>
                            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {intel.message}
                            </p>
                            {intel.conflicts.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {intel.conflicts.slice(0, 4).map(c => (
                                  <span key={c.poId} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                    isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {c.poId}{c.supplier ? ` · ${c.supplier}` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  // Multi-vendor case — per-vendor mini summaries.
                  const perVendor = involvedVendorIds
                    .map(vid => ({
                      vid,
                      vendor: finnsSuppliers.find(s => s.id === vid),
                      intel: summarizeLogistics(vid, neededBy, parseInt(windowDays) || 0, targetVenues),
                    }))
                    .filter(x => x.vendor && x.intel);
                  if (perVendor.length === 0) return null;
                  const anyTight = perVendor.some(x => x.intel!.flexAssessment === 'tight');
                  return (
                    <div className={`p-3 rounded-lg border ${
                      isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'
                    }`}>
                      <div className="flex items-start gap-2 mb-2">
                        <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${SAGE.icon(isDark)}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${SAGE.icon(isDark)}`}>
                              A-05 · Logistics Intel · {perVendor.length} vendors
                            </span>
                            {anyTight && (
                              <span className={`text-[9px] px-1 py-0.5 rounded ${
                                isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                              }`}>
                                ⚠ tight on {perVendor.filter(x => x.intel!.flexAssessment === 'tight').length} leg{perVendor.filter(x => x.intel!.flexAssessment === 'tight').length === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Same target date applies to {perVendor.length} POs. Per-leg readout below — if any leg is tight, consider widening the flex window or splitting the target date.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {perVendor.map(x => (
                          <div key={x.vid} className={`p-2 rounded text-[10px] ${
                            isDark ? 'bg-[#1a1a1a]' : 'bg-white border border-[#c4eef0]'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className={`font-semibold ${labelClass}`}>{x.vendor!.name}</span>
                              <span className={`text-[9px] px-1 py-0.5 rounded ${
                                x.intel!.flexAssessment === 'tight'
                                  ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                                  : x.intel!.flexAssessment === 'comfortable'
                                    ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                                    : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {x.intel!.flexAssessment}
                              </span>
                            </div>
                            <p className={`leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {x.intel!.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className={cardClass}>
                  <h2 className={`text-sm font-semibold mb-3 ${labelClass}`}>Delivery Window</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className={labelClass}>Target Date</Label>
                      <Input type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <Label className={labelClass}>Flex Window (days)</Label>
                      <Input type="number" value={windowDays} onChange={e => setWindowDays(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label className={labelClass}>Receiving Contact</Label>
                    <Input value={deliveryContact} onChange={e => setDeliveryContact(e.target.value)} className={inputClass} />
                  </div>
                  <div className="mt-4">
                    <Label className={labelClass}>Special Instructions</Label>
                    <Textarea value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)}
                      className={`${inputClass} min-h-[60px]`} />
                  </div>
                </div>

                {playbook === 'WF-REC' && (
                  <div className={cardClass}>
                    <h2 className={`text-sm font-semibold mb-3 ${labelClass}`}>Recurring Schedule</h2>
                    <div className="flex items-center justify-between mb-3">
                      <Label className={labelClass}>Run as recurring</Label>
                      <Switch checked={recurring} onCheckedChange={setRecurring} />
                    </div>
                    {recurring && (
                      <div>
                        <Label className={labelClass}>Frequency</Label>
                        <select value={recurringFrequency} onChange={e => setRecurringFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                          className={`mt-2 w-full rounded-md px-3 py-2 text-xs ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white' : 'bg-white border border-gray-200'}`}>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Biweekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between gap-2 mt-6">
                  <Button variant="outline" onClick={() => setStep(2)}
                    className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                    ← Back
                  </Button>
                  <Button onClick={() => setStep(4)} className={SAGE.primary(isDark)}>
                    Next: Review <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ── STEP 4: Review ───────────────────────────────────── */}
            {step === 4 && (
              <>
                {/* Atlas · Ready to Launch — final posture summary on
                    top of Step 4. Consumes policyPreview (already
                    computed) + atlasIntel.summarizeReadiness for the
                    spend-cap headroom line. */}
                {(() => {
                  const readiness = summarizeReadiness(policyPreview.amount, policyPreview.checks);
                  return (
                    <div className={`p-3 rounded-lg border ${
                      readiness.policyGreen
                        ? isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'
                        : isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        {readiness.policyGreen
                          ? <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${SAGE.icon(isDark)}`} />
                          : <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${
                              readiness.policyGreen ? SAGE.icon(isDark) : isDark ? 'text-amber-300' : 'text-amber-700'
                            }`}>
                              Atlas · {readiness.policyGreen ? 'Ready to Launch' : 'Review Before Launch'}
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {readiness.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Atlas Quantity Check — fires when ≥1 basket item has a
                    meaningful gap vs burn rate or par. Accept updates the
                    qty in the basket live; dismiss hides the row. */}
                {(() => {
                  const pending = items.filter(it => {
                    const s = qtySuggestions[it.id];
                    return s && !s.accepted && !s.dismissed;
                  });
                  const total = Object.keys(qtySuggestions).length;
                  if (total === 0) return null;

                  if (pending.length === 0) {
                    return (
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${
                        isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'
                      }`}>
                        <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`} />
                        <span className={`text-[11px] font-medium ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>
                          All quantities reviewed · Atlas
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className={`rounded-xl border overflow-hidden ${
                      isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-[#dddddd] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                    }`}>
                      {/* Header */}
                      <div className={`px-4 py-3 flex items-center gap-2 border-b ${
                        isDark ? 'border-gray-800' : 'border-[#dddddd]'
                      }`}>
                        <Sparkles className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-[#82d3d5]' : 'text-[#4bbcbe]'}`} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-[9px] font-bold uppercase tracking-wide ${
                            isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'
                          }`}>
                            Atlas · Quantity Check
                          </span>
                          <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {pending.length} item{pending.length !== 1 ? 's' : ''} flagged · burn rate + par levels
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const next = { ...qtySuggestions };
                            setItems(prev => prev.map(it => {
                              const s = next[it.id];
                              if (s && !s.dismissed) {
                                next[it.id] = { ...s, accepted: true };
                                return { ...it, qty: s.suggestedQty };
                              }
                              return it;
                            }));
                            setQtySuggestions(next);
                          }}
                          className={`text-[10px] font-semibold shrink-0 transition-colors ${
                            isDark ? 'text-[#82d3d5] hover:text-white' : 'text-[#2c9a9c] hover:text-[#4f5c3e]'
                          }`}
                        >
                          Accept all ✓
                        </button>
                      </div>
                      {/* Per-item rows */}
                      {items.map(item => {
                        const s = qtySuggestions[item.id];
                        if (!s || s.accepted || s.dismissed) return null;
                        return (
                          <div key={item.id} className={`px-4 py-3 flex items-start gap-3 border-b last:border-b-0 ${
                            isDark ? 'border-gray-800/60' : 'border-gray-100'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-[#222222]'}`}>
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  Ordered: {item.qty} {item.unit}
                                </span>
                                <span className={`text-[9px] ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>→</span>
                                <span className={`text-[10px] font-semibold ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>
                                  Suggested: {s.suggestedQty} {item.unit}
                                </span>
                              </div>
                              <span className={`inline-flex items-center mt-1.5 text-[9px] rounded-full px-2 py-0.5 border ${
                                isDark
                                  ? 'bg-[#4bbcbe]/10 border-[#4bbcbe]/20 text-[#82d3d5]'
                                  : 'bg-[#eafafa] border-[#c4eef0] text-[#2c9a9c]'
                              }`}>
                                {s.reason}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                              <button
                                onClick={() => {
                                  setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: s.suggestedQty } : i));
                                  setQtySuggestions(prev => ({ ...prev, [item.id]: { ...s, accepted: true } }));
                                }}
                                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                                  isDark
                                    ? 'bg-[#4bbcbe]/15 border-[#4bbcbe]/30 text-[#82d3d5] hover:bg-[#4bbcbe]/25'
                                    : 'bg-[#eafafa] border-[#4bbcbe]/40 text-[#2c9a9c] hover:bg-[#d6f4f5]'
                                }`}
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => setQtySuggestions(prev => ({ ...prev, [item.id]: { ...s, dismissed: true } }))}
                                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                                  isDark
                                    ? 'text-gray-600 hover:text-gray-400 hover:bg-gray-800'
                                    : 'text-gray-300 hover:text-gray-500 hover:bg-[#eafafa]'
                                }`}
                                aria-label="Dismiss suggestion"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 6i — Single-vendor coverage warning. Fires when the
                    user is on Path A (no RFQ award), splitMode is off,
                    they picked one vendor, and that vendor doesn't
                    cover every category in the basket. Doesn't block —
                    user can still proceed — but makes the gap visible. */}
                {!awardedQuote && !splitMode && selectedVendors[0] && itemCategories.length >= 2 && (() => {
                  const cov = vendorCoverage(selectedVendors[0]);
                  if (cov.covered === cov.total) return null;
                  const v = finnsSuppliers.find(s => s.id === selectedVendors[0]);
                  const missing = itemCategories.filter(c => !v?.categories.includes(c));
                  return (
                    <div className={`p-4 rounded-xl border ${
                      isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                    }`}>
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
                        <div className="min-w-0">
                          <p className={`text-[11px] font-bold ${labelClass}`}>
                            {v?.name ?? 'Selected vendor'} only covers {cov.covered} of {cov.total} categories
                          </p>
                          <p className={`text-[10px] mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Items in <strong>{missing.join(', ')}</strong> would still go to {v?.name ?? 'this vendor'} on submit — they don't typically supply that. You probably want to split into separate POs by vendor.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setSplitMode(true)}
                          className="text-[11px] px-3 py-1.5 rounded-lg font-bold bg-[#4bbcbe] text-white hover:bg-[#2c9a9c] transition-colors">
                          Switch to auto-split ({proposedSplits.length} POs)
                        </button>
                        <button onClick={() => setStep(2)}
                          className={`text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                            isDark ? 'border border-gray-700 text-gray-300 hover:bg-gray-800' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}>
                          Back to vendor pick
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* 5g — Smart split detected.
                    When items map to multiple top-suggested vendors AND
                    the user isn't on the RFQ path, show a "split" card
                    that lets them mint N POs instead of one. */}
                {!awardedQuote && proposedSplits.length > 1 && (
                  <div className={`p-4 rounded-xl border ${
                    splitMode
                      ? isDark ? 'bg-[#4bbcbe]/10 border-[#4bbcbe]/40' : 'bg-[#eafafa] border-[#4bbcbe]/40'
                      : isDark ? 'bg-amber-500/8 border-amber-500/25' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="flex items-start gap-2 mb-3">
                      <Sparkles className={`h-4 w-4 mt-0.5 shrink-0 ${
                        splitMode
                          ? isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'
                          : isDark ? 'text-amber-300' : 'text-amber-700'
                      }`} />
                      <div className="min-w-0">
                        <p className={`text-[11px] font-bold ${labelClass}`}>
                          Smart split detected — these items typically come from {proposedSplits.length} different vendors
                        </p>
                        <p className={`text-[10px] mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {splitMode
                            ? `Submitting will mint ${proposedSplits.length} POs, one per vendor. Same delivery date (${neededBy}) and venues apply to all. Your Step 2 vendor pick is bypassed.`
                            : `A-01 grouped your items by best-fit vendor. You can keep the single-PO path (everything goes to ${primaryVendor?.name ?? 'your selected vendor'}) or split into ${proposedSplits.length} POs.`}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-3">
                      {proposedSplits.map(g => (
                        <div key={g.vendorId} className={`p-2.5 rounded-lg border ${
                          isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`text-xs font-semibold ${labelClass}`}>{g.vendorName}</span>
                            <span className={`text-[10px] font-bold ${isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]'}`}>
                              {g.items.length} item{g.items.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className={`text-[10px] mt-1 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {g.items.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => setSplitMode(true)}
                        className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-colors ${
                          splitMode
                            ? 'bg-[#4bbcbe] text-white'
                            : isDark ? 'bg-[#4bbcbe]/15 text-[#82d3d5] hover:bg-[#4bbcbe]/25' : 'bg-[#eafafa] text-[#2c9a9c] hover:bg-[#d6f4f5]'
                        }`}>
                        {splitMode ? '✓ Will split into ' : 'Split into '}{proposedSplits.length} POs
                      </button>
                      <button onClick={() => setSplitMode(false)}
                        className={`text-[11px] px-3 py-1.5 rounded-lg font-bold transition-colors ${
                          !splitMode
                            ? isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-200 text-gray-900'
                            : isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'
                        }`}>
                        {!splitMode ? '✓ Send as one combined PO' : 'Send as one combined PO'}
                      </button>
                    </div>
                  </div>
                )}

                <div className={cardClass}>
                  <h2 className={`text-sm font-semibold mb-3 ${labelClass}`}>Authorize Procurement</h2>
                  <div className="space-y-3">
                    {(() => {
                      const isMultiAward = awardedQuotes.length > 1;
                      const isAutoSplit = splitMode && proposedSplits.length > 1;
                      const multiAwardTotal = awardedQuotes.reduce((s, a) => s + a.totalIdr, 0);
                      const isMultiVendorAny = isMultiAward || isAutoSplit || isManualMultiVendor;
                      const poCount = isMultiAward ? awardedQuotes.length
                        : isAutoSplit ? proposedSplits.length
                        : isManualMultiVendor ? manualAssignments.groups.length
                        : 1;
                      const vendorLabel = isMultiAward
                        ? `${awardedQuotes.length} vendors · ${awardedQuotes.length} PO drafts`
                        : isAutoSplit
                          ? `${proposedSplits.length} vendors (auto-split) · ${proposedSplits.length} PO drafts`
                          : isManualMultiVendor
                            ? `${manualAssignments.groups.length} vendors (manual) · ${manualAssignments.groups.length} PO drafts`
                            : primaryVendor?.name ?? '(none)';
                      const rows: { k: string; v: string }[] = [
                        { k: 'Request', v: requestName },
                        { k: 'Items', v: `${items.length} line${items.length === 1 ? '' : 's'} · ${fmtIdrShort(isMultiAward ? multiAwardTotal : itemsTotalIdr)}` },
                        { k: 'Playbook', v: `${playbook} · ${finnsPlaybooks.find(p => p.id === playbook)?.name}` },
                        { k: isMultiVendorAny ? 'Vendors' : 'Primary Vendor', v: vendorLabel },
                        { k: 'Target Venues', v: targetVenues.join(', ') || '(none)' },
                        { k: 'Target Date', v: `${neededBy} (±${windowDays}d window)` },
                        { k: 'Recurring', v: recurring ? `Yes · ${recurringFrequency}` : 'No' },
                      ];
                      // Suppress unused-warning for poCount (used inside fragment text only).
                      void poCount;
                      return rows.map(row => (
                        <div key={row.k} className="flex items-center justify-between gap-3">
                          <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{row.k}</span>
                          <span className={`text-[11px] font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{row.v}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  {/* Per-vendor breakdown — shown for all 3 multi-PO cases
                      (multi-award RFQ, auto-split, manual multi-vendor)
                      so the user always sees what's about to be minted. */}
                  {awardedQuotes.length > 1 && (
                    <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Per-vendor breakdown · multi-award RFQ
                      </p>
                      <div className="space-y-1.5">
                        {awardedQuotes.map(aq => {
                          const aqItems = wizardRfq?.items.filter(it => aq.itemIds.includes(it.id)) ?? [];
                          return (
                            <div key={aq.poId} className={`flex items-start gap-2 p-2 rounded text-[10px] ${
                              isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50 border border-gray-200'
                            }`}>
                              <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700 border border-gray-300'}`}>
                                {aq.poId}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`font-semibold ${labelClass}`}>
                                  {aq.vendorName} · {fmtIdrShort(aq.totalIdr)} · {aq.leadTimeDays}d lead
                                </p>
                                <p className={`mt-0.5 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {aqItems.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {splitMode && proposedSplits.length > 1 && awardedQuotes.length === 0 && (
                    <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Per-vendor breakdown · auto-split
                      </p>
                      <div className="space-y-1.5">
                        {proposedSplits.map((g, idx) => {
                          const splitTotal = g.items.reduce((s, it) => s + it.qty * (it.unitPriceIdr || 0), 0);
                          return (
                            <div key={g.vendorId} className={`flex items-start gap-2 p-2 rounded text-[10px] ${
                              isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50 border border-gray-200'
                            }`}>
                              <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded ${SAGE.badge(isDark)}`}>
                                PO {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`font-semibold ${labelClass}`}>
                                  {g.vendorName} · {fmtIdrShort(splitTotal)} · {g.items.length} item{g.items.length === 1 ? '' : 's'}
                                </p>
                                <p className={`mt-0.5 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {g.items.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {isManualMultiVendor && (
                    <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Per-vendor breakdown · manual split
                      </p>
                      <div className="space-y-1.5">
                        {manualAssignments.groups.map((g, idx) => {
                          const splitTotal = g.items.reduce((s, it) => s + it.qty * (it.unitPriceIdr || 0), 0);
                          return (
                            <div key={g.vendor.id} className={`flex items-start gap-2 p-2 rounded text-[10px] ${
                              isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50 border border-gray-200'
                            }`}>
                              <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded ${SAGE.badge(isDark)}`}>
                                PO {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`font-semibold ${labelClass}`}>
                                  {g.vendor.name} · {fmtIdrShort(splitTotal)} · {g.items.length} item{g.items.length === 1 ? '' : 's'}
                                </p>
                                <p className={`mt-0.5 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {g.items.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {manualAssignments.unassigned.length > 0 && (
                          <div className={`flex items-start gap-2 p-2 rounded text-[10px] ${
                            isDark ? 'bg-amber-500/10 border border-amber-500/40' : 'bg-amber-50 border border-amber-300'
                          }`}>
                            <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
                            <div className="min-w-0 flex-1">
                              <p className={`font-bold ${labelClass}`}>
                                {manualAssignments.unassigned.length} item{manualAssignments.unassigned.length === 1 ? '' : 's'} not assigned
                              </p>
                              <p className={`mt-0.5 leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                {manualAssignments.unassigned.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}. Authorize is blocked — go back to Step 2 and pick a vendor for these categories.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`p-3 rounded-lg border mb-4 ${isDark ? 'bg-[#4bbcbe]/8 border-[#4bbcbe]/25' : 'bg-[#eafafa] border-[#c4eef0]'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldCheck className={`h-3 w-3 ${SAGE.icon(isDark)}`} />
                    <span className={`text-[9px] font-bold uppercase ${SAGE.icon(isDark)}`}>Audit Checklist</span>
                  </div>
                  <ul className="space-y-1 mt-1 text-[10px]">
                    {[
                      'Vendor trust score above floor (70)',
                      'Spend cap headroom available for this category',
                      'Par alignment with current inventory state',
                      'Venue receiving windows respected',
                      'FX lock applied to USD line items (where applicable)',
                      'No conflict with active recurring schedule',
                    ].map(t => (
                      <li key={t} className={`flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <CheckCircle className={`h-2.5 w-2.5 shrink-0 ${SAGE.icon(isDark)}`} />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Authorize gate — block on:
                    (a) manual multi-vendor with unassigned items, or
                    (b) single-vendor on a cross-category basket where the
                        picked vendor doesn't cover every item category. */}
                {(() => {
                  const blockedByUnassigned = isManualMultiVendor && manualAssignments.unassigned.length > 0;
                  const singleVendorIncomplete = !awardedQuote && !splitMode && selectedVendors.length === 1
                    && itemCategories.length >= 2 && vendorCoverage(selectedVendors[0]).covered < vendorCoverage(selectedVendors[0]).total;
                  const blocked = blockedByUnassigned || singleVendorIncomplete;
                  const buttonCopy = awardedQuotes.length > 1
                    ? `Authorize · Finalize ${awardedQuotes.length} POs`
                    : splitMode && proposedSplits.length > 1
                      ? `Authorize · Create ${proposedSplits.length} POs`
                      : isManualMultiVendor
                        ? `Authorize · Create ${manualAssignments.groups.length} POs`
                        : poAutonomy === 'manual'
                          ? 'Authorize · Route to Orders'
                          : 'Authorize · Hand off to A-04';
                  const blockReason = blockedByUnassigned
                    ? `${manualAssignments.unassigned.length} item${manualAssignments.unassigned.length === 1 ? '' : 's'} have no assigned vendor — go back to Step 2 to fix.`
                    : singleVendorIncomplete
                      ? `Selected vendor doesn't cover every category in this basket. Pick another vendor for the missing categories or switch to auto-split.`
                      : '';
                  return (
                    <>
                      {blocked && (
                        <div className={`p-3 rounded-lg border mb-3 ${
                          isDark ? 'bg-amber-500/8 border-amber-500/30' : 'bg-amber-50 border-amber-200'
                        }`}>
                          <div className="flex items-start gap-2">
                            <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
                            <div className="min-w-0">
                              <p className={`text-[11px] font-bold ${labelClass}`}>Authorize blocked</p>
                              <p className={`text-[10px] mt-0.5 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{blockReason}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between gap-2 mt-6">
                        <Button variant="outline" onClick={() => setStep(3)}
                          className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                          ← Back
                        </Button>
                        <Button onClick={handleSubmit} disabled={blocked}
                          className={blocked ? '' : SAGE.primary(isDark)}>
                          {buttonCopy}
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}

            {/* ── STEP 5: Done ─────────────────────────────────────── */}
            {step === 5 && (
              <div className={`${cardClass} text-center py-12`}>
                <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-[#4bbcbe]/20' : 'bg-[#eafafa]'}`}>
                  <CheckCircle className={`h-7 w-7 ${SAGE.icon(isDark)}`} />
                </div>
                <h2 className={`text-base font-semibold ${labelClass}`}>
                  {awardedQuotes.length > 1 ? `${awardedQuotes.length} POs Authorized` : 'PO Authorized'}
                </h2>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {awardedQuotes.length > 1
                    ? `${awardedQuotes.length} POs drafted from ${awardedQuotes[0].rfqId}, one per awarded vendor. All at Stage 2 awaiting your Approve & Execute. Routing you to Orders…`
                    : poAutonomy === 'manual'
                      ? `Running on ${playbook} (${finnsPlaybooks.find(p => p.id === playbook)?.name}). You drive every downstream stage — agents observe + surface insights. Routing you to Orders…`
                      : `Running on ${playbook} (${finnsPlaybooks.find(p => p.id === playbook)?.name}). ${PLAYBOOK_META[playbook].agent} picks it up at Stage 2 within policy. Routing you to Orders…`}
                </p>
                <div className={`mt-4 inline-flex items-center gap-1.5 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  <Truck className="h-3 w-3" />
                  Stage 1 cleared · vendor confirmation incoming
                </div>
              </div>
            )}

          </div>
        </ScrollArea>
      </div>

      {/* Right sidebar — Atlas Copilot */}
      <div className={`w-80 h-full border-l shrink-0 ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
        {rightPanel}
      </div>

      {/* RFQ Composer modal (manual sourcing — 4h) */}
      <RFQComposerModal
        isDark={isDark}
        isOpen={rfqOpen}
        onClose={() => setRfqOpen(false)}
        onSent={(rfqId) => {
          // Only adopt the new RFQ as the wizard's active one when the
          // user opened the composer from Step 2's "Compare quotes" path.
          if (sourcingPath === 'rfq' && !wizardRfqId) {
            setWizardRfqId(rfqId);
            if (step !== 2) setStep(2);
          }
        }}
        prefillItems={sourcingPath === 'rfq' && !wizardRfqId
          ? items.map(i => ({ name: i.name, category: i.category, qty: i.qty, unit: i.unit }))
          : undefined}
      />

      {/* RFQ Tracker modal (4h.2 / 4h.3) */}
      <RFQTrackerModal
        isDark={isDark}
        isOpen={rfqTrackerOpen}
        onClose={() => setRfqTrackerOpen(false)}
        onComposeNew={() => setRfqOpen(true)}
        onNavigate={onNavigate}
      />
    </div>
  );
}
