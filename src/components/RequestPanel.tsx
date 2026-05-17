import { useState, useEffect, useMemo } from "react";
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
import { finnsSuppliers, finnsPlaybooks, finnsVenues } from "../lib/mockData";
import type {
  VenueTag, FinnsCategory, PlaybookId, FinnsAgentId,
} from "../lib/types";
import { AgentCTA } from "./AgentCTA";
import { RFQComposerModal } from "./RFQComposerModal";
import { RFQTrackerModal } from "./RFQTrackerModal";
import { useAutonomyMode } from "../lib/autonomy";
import { useRFQs, awardRFQ, cancelRFQ, type RFQQuote } from "../lib/rfqStore";
import { createPO, updatePO, type RuntimePO } from "../lib/poStore";
import { logUserAction } from "../lib/actionLog";
import { detectItem, suggestVendorsForItems } from "../lib/itemIntel";
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
  activeBg: (isDark: boolean) => isDark ? 'bg-[#87986a]/10 border-[#87986a]/40' : 'bg-[#f4f6f0] border-[#87986a]/50',
  inactiveBg: (isDark: boolean) => isDark ? 'bg-[#2a2a2a] border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300',
  primary: (isDark: boolean) => isDark ? 'bg-[#87986a] hover:bg-[#6b7a54] text-white' : 'bg-[#87986a] hover:bg-[#6b7a54] text-white',
  badge: (isDark: boolean) => isDark ? 'bg-[#87986a]/10 text-[#a3b085] border-[#87986a]/20' : 'bg-[#f4f6f0] text-[#4f5c3e] border-[#87986a]/30',
  icon: (isDark: boolean) => isDark ? 'text-[#a3b085]' : 'text-[#87986a]',
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
          <span key={v} className={`text-[9px] font-bold px-1 py-0.5 rounded ${isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'}`}>
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
                ? isDark ? 'bg-[#87986a] border-[#87986a] text-white' : 'bg-[#87986a] border-[#87986a] text-white'
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
  const autonomyMode = useAutonomyMode();
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqTrackerOpen, setRfqTrackerOpen] = useState(false);
  const rfqRecords = useRFQs();
  const activeRfqCount = rfqRecords.filter(r =>
    r.status === 'awaiting' || r.status === 'partial' || r.status === 'received'
  ).length;

  // Step 1 — Items
  const [requestName, setRequestName] = useState("Weekly produce restock");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', name: 'Tomatoes, vine-ripened', category: 'Produce', qty: 20, unit: 'kg', unitPriceIdr: 18_000, venues: ['BC', 'RC'] },
    { id: '2', name: 'Mixed greens (rocket, lettuce)', category: 'Produce', qty: 15, unit: 'kg', unitPriceIdr: 22_000, venues: ['BC', 'ST'] },
    { id: '3', name: 'Lime, key', category: 'Produce', qty: 10, unit: 'kg', unitPriceIdr: 24_000, venues: ['BC', 'RC', 'SP'] },
  ]);
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
    // 5c — Off mode disables auto-fill. The chip still hides, the
    // form stays manual. Assist + Auto both auto-fill the same way
    // because the difference between them is in how vendors are
    // suggested downstream (Step 2), not how items are categorised.
    if (autonomyMode === 'off') return;
    if (!detectedFromName) return;
    if (!overridden.category) setNewItemCategory(detectedFromName.category);
    if (!overridden.unit && detectedFromName.unit) setNewItemUnit(detectedFromName.unit);
    if (!overridden.venues && detectedFromName.venues && detectedFromName.venues.length > 0) {
      setNewItemVenues(detectedFromName.venues);
    }
  }, [detectedFromName, overridden, autonomyMode]);
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
    totalIdr: number;
    leadTimeDays: number;
    channel: 'whatsapp' | 'email';
    receivedAt: string;
    rfqId: string;
    poId: string;          // PO created at award time; updated again at Step 5 Submit
    amContact: string;     // account manager display label
    note?: string;
  }
  const [awardedQuote, setAwardedQuote] = useState<AwardedQuote | null>(null);
  const wizardRfq = wizardRfqId
    ? rfqRecords.find(r => r.id === wizardRfqId) ?? null
    : null;

  // 5c — Auto-mode pre-pick: when entering Step 2 with the 'pick' path
  // and no vendor chosen yet, auto-select the top-suggested vendor
  // based on the items already in the wizard. The user can still
  // override by clicking another row. Assist + Off leave selection
  // empty so the user always makes the call.
  useEffect(() => {
    if (autonomyMode !== 'auto') return;
    if (step !== 2 || sourcingPath !== 'pick' || wizardRfqId) return;
    if (selectedVendors.length > 0) return;
    if (items.length === 0) return;
    const [topId] = suggestVendorsForItems(items.map(it => it.name), 1);
    if (topId) setSelectedVendors([topId]);
  }, [autonomyMode, step, sourcingPath, wizardRfqId, items, selectedVendors.length]);

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

  function toggleItemVenue(itemId: string, v: VenueTag) {
    setItems(items.map(it => it.id === itemId ? {
      ...it,
      venues: it.venues.includes(v) ? it.venues.filter(x => x !== v) : [...it.venues, v],
    } : it));
  }

  function toggleVendor(id: string) {
    setSelectedVendors(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  }

  function toggleTargetVenue(v: VenueTag) {
    setTargetVenues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  // ── Step 5 — final wizard Submit ──────────────────────────────
  // Two paths converge here:
  //   1. Direct vendor (sourcingPath === 'pick') — no PO exists yet.
  //      Mint one with the wizard data + selected vendor.
  //   2. RFQ award (sourcingPath === 'rfq' && awardedQuote) — the PO
  //      was created at Award time. Update it with delivery details.
  // Both routes navigate to Orders deep-linked to the PO so the user
  // can run Approve & Execute (Stage 2 → 3) from one place.
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
    if (awardedQuote) {
      // ── RFQ path: PO exists, fill in delivery details ──
      poId = awardedQuote.poId;
      updatePO(poId, {
        items: itemSummary,
        humanStatus: 'Quote awarded · awaiting your approval',
        humanDescription: `Awarded from ${awardedQuote.rfqId} · delivery to ${targetVenues.join(' + ') || 'BC'} on ${neededBy}.`,
        eta: `${neededBy} · ${awardedQuote.leadTimeDays}d lead`,
        workflowTemplate: playbook,
      });
      logUserAction({
        kind: 'po-stage-advance',
        entity: { type: 'po', id: poId },
        summary: `Authorized ${poId} · ${awardedQuote.vendorName} · Rp ${(awardedQuote.totalIdr / 1_000_000).toFixed(2)}M (from RFQ ${awardedQuote.rfqId})`,
        venue: venueLabel === 'BC' || venueLabel === 'RC' || venueLabel === 'ST' || venueLabel === 'SP' ? venueLabel : 'Multi',
        details: `Delivery to ${targetVenues.join(', ')} on ${neededBy}. Quote received via ${awardedQuote.channel === 'whatsapp' ? 'WhatsApp' : 'email'} from ${awardedQuote.amContact}.`,
        meta: {
          poId,
          rfqId: awardedQuote.rfqId,
          vendorId: awardedQuote.vendorId,
          totalIdr: awardedQuote.totalIdr,
          path: 'rfq',
          playbook,
        },
      });
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

    toast.success(`${poId} authorized · routed to Orders`, {
      description: `Running on ${playbook} (${playbookLabel}). Hit Approve & Execute in Orders to advance to Stage 3.`,
    });
    setStep(5);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.hash = `order=${poId}`;
      }
      onNavigate?.('orders');
    }, 1400);
  }

  // ── In-wizard RFQ handlers (5a) ───────────────────────────────
  function handleAwardInWizard(quote: RFQQuote) {
    if (!wizardRfq) return;
    const poId = `PO-${3050 + Math.floor(Math.random() * 200)}`;
    awardRFQ(wizardRfq.id, quote.vendorId, poId);

    const channelLabel = wizardRfq.channel === 'whatsapp' ? 'WhatsApp' : 'email';
    const channel: 'whatsapp' | 'email' = wizardRfq.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const vendorRecord = finnsSuppliers.find(s => s.id === quote.vendorId);
    const amContact = vendorRecord
      ? `${vendorRecord.accountManager.name} · ${vendorRecord.accountManager.whatsapp}`
      : quote.vendorName;
    const itemSummary = wizardRfq.items.map(it => `${it.qty}${it.unit} ${it.name}`);

    const others = wizardRfq.quotes.filter(q => q.vendorId !== quote.vendorId);
    const nextBest = others.length > 0
      ? others.reduce((min, q) => q.totalIdr < min ? q.totalIdr : min, Number.POSITIVE_INFINITY)
      : null;
    const savingIdr = nextBest != null && nextBest !== Number.POSITIVE_INFINITY
      ? nextBest - quote.totalIdr
      : 0;
    const reasoning = [
      `Awarded via ${wizardRfq.id}. Winning quote came in via ${channelLabel} from ${amContact}.`,
      others.length > 0
        ? savingIdr > 0
          ? `Beat ${others.length} other quote${others.length === 1 ? '' : 's'} — Rp ${(savingIdr / 1_000_000).toFixed(2)}M cheaper than next-best.`
          : `${others.length} other quote${others.length === 1 ? ' was' : 's were'} more competitive on lead time / terms; price is locked here.`
        : 'No other vendors bid — sole responder.',
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
      humanDescription: `Drafted from ${wizardRfq.id}. Delivery details pending Step 3 of the wizard.`,
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
      summary: `Awarded ${wizardRfq.id} → ${quote.vendorName} · Rp ${(quote.totalIdr / 1_000_000).toFixed(2)}M · ${quote.leadTimeDays}d lead`,
      venue: wizardRfq.venue,
      meta: {
        rfqId: wizardRfq.id,
        winningVendorId: quote.vendorId,
        winningVendorName: quote.vendorName,
        totalIdr: quote.totalIdr,
        leadTimeDays: quote.leadTimeDays,
        synthesisedPoId: poId,
        channel: wizardRfq.channel,
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

    setAwardedQuote({
      vendorId:    quote.vendorId,
      vendorName:  quote.vendorName,
      totalIdr:    quote.totalIdr,
      leadTimeDays: quote.leadTimeDays,
      channel,
      receivedAt:  quote.receivedAt,
      rfqId:       wizardRfq.id,
      poId,
      amContact,
      note:        quote.note,
    });
    setSelectedVendors([quote.vendorId]);
    toast.success(`${quote.vendorName} awarded · ${poId} drafted`, {
      description: `Vendor + amount locked. Next: delivery details.`,
    });
    setStep(3);
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
                    ? 'bg-[#87986a] text-white cursor-pointer hover:bg-[#6b7a54]'
                    : active
                      ? 'bg-amber-500 text-white ring-2 ring-amber-500/30 ring-offset-1 ' + (isDark ? 'ring-offset-[#1a1a1a]' : 'ring-offset-white')
                      : isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-500'
                }`}>
                {done ? <CheckCircle className="h-3 w-3" /> : num}
              </button>
              <span className={`text-[10px] font-semibold truncate ${
                done ? isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'
                : active ? isDark ? 'text-white' : 'text-gray-900'
                : isDark ? 'text-gray-500' : 'text-gray-500'
              }`}>{label}</span>
              {i < 3 && (
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
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
              <AgentCTA
                isDark={isDark}
                variant="inline"
                agentLabel="A-01 · Sourcing Agent"
                reasoning="Describe why — not just what. The clearer your intent, the better A-01 (Sourcing) can recommend vendors and playbooks downstream. Items can have multiple venue tags — that's how A-05 (Logistics) knows where to route the drop."
                offModeMessage="Describe why — not just what. List each line item with its category, quantity, and venue tags so receiving knows where each drop goes."
              />
              <div className={`mt-2 pt-2 border-t flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Spending pulse</span>
                <span className={`text-[10px] font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{fmtIdrShort(itemsTotalIdr)} of Rp 12jt monthly</span>
              </div>
            </div>
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
                      <span className={`text-[10px] font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{v}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                      <div className="h-1.5 rounded-full bg-[#87986a]" style={{ width: `${v}%` }} />
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
          )}

          {step === 5 && (
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
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
                    ? isDark ? 'bg-[#87986a] text-white' : 'bg-[#6b7a54] text-white'
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
            className={`shrink-0 h-7 w-7 p-0 ${atlasInput.trim() ? 'bg-[#87986a] hover:bg-[#6b7a54] text-white' : isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
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
                  isDark ? 'bg-[#87986a]/15 border-[#87986a]/40 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
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
            {/* RFQ Tracker trigger (4h.2). The Compose button moved
                into Step 2 — see Step 2 "Compare quotes" path. */}
            {step < 5 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setRfqTrackerOpen(true)}
                  title="Open the RFQ tracker — see active quote requests, vendor replies, and historical awards."
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isDark
                      ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}>
                  <FileText className="h-3.5 w-3.5" />
                  Your RFQs
                  {activeRfqCount > 0 && (
                    <span className={`ml-0.5 text-[9px] font-bold px-1 py-0 rounded-full ${
                      isDark ? 'bg-[#87986a]/30 text-[#a3b085]' : 'bg-[#87986a]/20 text-[#6b7a54]'
                    }`}>
                      {activeRfqCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Mode-aware banner (5c). One row, mode-tinted, always visible
              while in the wizard so the user knows what the page will do
              for them at each step. */}
          {step < 5 && (
            <div className={`mt-3 p-2.5 rounded-lg border text-[11px] flex items-center gap-2 flex-wrap ${
              autonomyMode === 'off'
                ? isDark ? 'bg-amber-500/8 border-amber-500/25 text-amber-300/90' : 'bg-amber-50 border-amber-200 text-amber-700'
                : autonomyMode === 'assist'
                  ? isDark ? 'bg-blue-500/8 border-blue-500/25 text-blue-300/90' : 'bg-blue-50 border-blue-200 text-blue-700'
                  : isDark ? 'bg-[#87986a]/10 border-[#87986a]/30 text-[#a3b085]' : 'bg-[#f4f6f0] border-[#dbe3ce] text-[#6b7a54]'
            }`}>
              <span className="font-bold uppercase tracking-wide text-[9px]">
                {autonomyMode === 'off' ? 'Off mode' : autonomyMode === 'assist' ? 'Assist mode' : 'Auto mode'}
              </span>
              <span>·</span>
              <span>
                {autonomyMode === 'off' &&
                  'No category auto-fill, no vendor ranking, no pre-selection. Use Step 2\'s "Compare quotes (RFQ)" path to source manually.'}
                {autonomyMode === 'assist' &&
                  'A-01 suggests as you type — category + unit + venues from the item name, vendors ranked by relevance. Nothing pre-selected; you approve every step.'}
                {autonomyMode === 'auto' &&
                  'A-01 auto-fills item categories, pre-picks the top-matched vendor on Step 2, and surfaces the RFQ path when there is no clear winner. Override anything to keep control.'}
              </span>
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
          <div key={step}
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
                          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{item.qty} {item.unit}</span>
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
                      <Input placeholder="Unit price (Rp)" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} type="number"
                        className={`col-span-8 ${inputClass} mt-0`} />
                      <div className="col-span-4 flex items-center gap-2">
                        <VenueChips venues={newItemVenues} isDark={isDark}
                          onToggle={v => {
                            setNewItemVenues(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
                            setOverridden(o => ({ ...o, venues: true }));
                          }} />
                      </div>
                    </div>

                    {/* Smart-detect hint — Assist + Auto only (5c) */}
                    {autonomyMode !== 'off' && detectedFromName && newItemName.trim().length > 0 && (
                      <div className={`mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-md text-[10px] ${
                        isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                      }`}>
                        <Sparkles className="h-3 w-3" />
                        <span className="font-semibold">A-01 detected:</span>
                        <span>{detectedFromName.category}</span>
                        {detectedFromName.unit && (<><span className="opacity-50">·</span><span>unit "{detectedFromName.unit}"</span></>)}
                        {detectedFromName.venues && detectedFromName.venues.length > 0 && (
                          <><span className="opacity-50">·</span><span>typically {detectedFromName.venues.join(' / ')}</span></>
                        )}
                        <span className={`opacity-60 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          · {autonomyMode === 'auto' ? 'auto-filled' : 'suggestion'} (edit to override)
                        </span>
                      </div>
                    )}

                    <Button onClick={addItem} disabled={!newItemName.trim()} size="sm"
                      className={`mt-3 h-7 text-[11px] ${SAGE.primary(isDark)}`}>
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  </div>
                </div>

                {/* Playbook selector */}
                <div className={cardClass}>
                  <h2 className={`text-sm font-semibold mb-2 ${labelClass}`}>Playbook</h2>
                  <p className={hintClass}>How the agents handle this request from intake to delivery.</p>
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
                {/* Path picker — only visible when no RFQ is in flight */}
                {!wizardRfqId && (
                  <div className={cardClass}>
                    <h2 className={`text-sm font-semibold mb-3 ${labelClass}`}>How are you sourcing this?</h2>
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
                  // 5b/5c — In Assist + Auto, rank vendors by relevance to
                  // the items in Step 1 (Match chip on suggestions). In
                  // Off mode, render the directory in raw alphabetical
                  // order — no agent attribution, no Match chips.
                  const ranked = autonomyMode === 'off';
                  const suggestedIds = !ranked
                    ? suggestVendorsForItems(items.map(it => it.name), 10)
                    : [];
                  const suggestedSet = new Set(suggestedIds);
                  const suggested = suggestedIds
                    .map(id => finnsSuppliers.find(v => v.id === id)!)
                    .filter(Boolean);
                  const rest = ranked
                    ? finnsSuppliers.slice().sort((a, b) => a.name.localeCompare(b.name))
                    : finnsSuppliers
                        .filter(v => !suggestedSet.has(v.id))
                        .sort((a, b) => b.metrics.composite - a.metrics.composite);
                  const ordered = ranked ? rest : [...suggested, ...rest];
                  return (
                  <div className={cardClass}>
                    <h2 className={`text-sm font-semibold mb-3 ${labelClass}`}>Approved Directory</h2>
                    <AgentCTA
                      isDark={isDark}
                      variant="inline"
                      className="mb-2"
                      agentLabel="A-01 · Sourcing Agent"
                      reasoning={`A-01 ranks the directory by overlap with your items + composite + SLA. ${suggested.length > 0 ? `Top ${suggested.length} match your categories.` : ''} Pick one or more — the first selected becomes the primary. After approval the PO is forwarded via the vendor's preferred channel (WhatsApp first, email if formal).`}
                      offModeMessage="Pick one or more vendors from your approved directory. The first selected becomes the primary. Sort by composite, on-time, or cold-chain SLA using the metrics on each row. After approval the PO is sent via WhatsApp or email."
                    />
                    <div className="mt-4 space-y-2">
                      {ordered.map((v, idx) => {
                        const selected = selectedVendors.includes(v.id);
                        const isPrimary = selected && selectedVendors[0] === v.id;
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
                                  {isPrimary && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${SAGE.badge(isDark)}`}>Primary</span>}
                                  {isSuggested && !isPrimary && (
                                    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                      isDark ? 'bg-[#87986a]/20 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                                    }`}>
                                      <Sparkles className="h-2.5 w-2.5" /> Match
                                    </span>
                                  )}
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
                                  <span className={`text-[10px] font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{v.metrics.composite}</span>
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

                {/* ── Path B: Waiting for quotes ──────────────────────── */}
                {wizardRfqId && wizardRfq && !awardedQuote && (
                  <div className={cardClass}>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <h2 className={`text-sm font-semibold ${labelClass}`}>
                        Quotes coming in · {wizardRfq.id}
                      </h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        wizardRfq.quotes.length === wizardRfq.vendorIds.length
                          ? isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'
                          : isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {wizardRfq.quotes.length}/{wizardRfq.vendorIds.length} quoted
                      </span>
                    </div>
                    <p className={`text-[11px] mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Sent via <strong>{wizardRfq.channel === 'whatsapp' ? 'WhatsApp' : 'email'}</strong> · deadline {wizardRfq.deadline}. First replies usually land within 10–30 seconds (demo).
                    </p>
                    <div className="space-y-2">
                      {wizardRfq.vendorIds.map((vid, idx) => {
                        const vendorName = wizardRfq.vendorNames[idx] ?? vid;
                        const quote = wizardRfq.quotes.find(q => q.vendorId === vid);
                        const lowestTotal = wizardRfq.quotes.length > 0
                          ? Math.min(...wizardRfq.quotes.map(q => q.totalIdr))
                          : null;
                        const isLowest = quote && quote.totalIdr === lowestTotal;
                        return (
                          <div key={vid} className={`flex items-center gap-2 p-3 rounded-lg border ${
                            isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
                          }`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${labelClass}`}>{vendorName}</span>
                                {isLowest && (
                                  <span className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                    Lowest
                                  </span>
                                )}
                              </div>
                              {quote ? (
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
                                      ? isDark ? 'text-[#a3b085]' : 'text-[#25D366]'
                                      : isDark ? 'text-blue-300' : 'text-blue-700'
                                  }`}>
                                    via {wizardRfq.channel === 'whatsapp' ? 'WhatsApp' : 'email'}
                                  </span>
                                </div>
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
                            {quote && (
                              <button
                                onClick={() => handleAwardInWizard(quote)}
                                className={`shrink-0 text-[10px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded font-bold transition-colors ${
                                  isLowest
                                    ? 'bg-[#87986a] text-white hover:bg-[#6b7a54]'
                                    : isDark
                                      ? 'border border-gray-700 text-gray-300 hover:bg-gray-800'
                                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}>
                                <Award className="h-3 w-3" /> Award &amp; continue
                              </button>
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
                )}

                {/* Wizard nav */}
                <div className="flex justify-between gap-2 mt-6">
                  <Button variant="outline" onClick={() => setStep(1)}
                    className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                    ← Back
                  </Button>
                  <div className="flex items-center gap-2">
                    {wizardRfqId && (
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
                {/* Award context banner — visible when arrived here via RFQ */}
                {awardedQuote && (
                  <div className={`p-3 rounded-lg border ${
                    isDark ? 'bg-[#87986a]/10 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#dbe3ce]'
                  }`}>
                    <div className="flex items-start gap-2">
                      <Award className={`h-4 w-4 mt-0.5 shrink-0 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`} />
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
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${active ? (isDark ? 'bg-[#87986a] text-white' : 'bg-[#87986a] text-white') : SAGE.badge(isDark)}`}>{v.tag}</span>
                            <span className={`text-xs font-semibold ${labelClass}`}>{v.name}</span>
                          </div>
                          <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{v.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                <div className={cardClass}>
                  <h2 className={`text-sm font-semibold mb-3 ${labelClass}`}>Authorize Procurement</h2>
                  <div className="space-y-3">
                    {[
                      { k: 'Request', v: requestName },
                      { k: 'Items', v: `${items.length} line${items.length === 1 ? '' : 's'} · ${fmtIdrShort(itemsTotalIdr)}` },
                      { k: 'Playbook', v: `${playbook} · ${finnsPlaybooks.find(p => p.id === playbook)?.name}` },
                      { k: 'Primary Vendor', v: primaryVendor?.name ?? '(none)' },
                      { k: 'Target Venues', v: targetVenues.join(', ') || '(none)' },
                      { k: 'Target Date', v: `${neededBy} (±${windowDays}d window)` },
                      { k: 'Recurring', v: recurring ? `Yes · ${recurringFrequency}` : 'No' },
                    ].map(row => (
                      <div key={row.k} className="flex items-center justify-between gap-3">
                        <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{row.k}</span>
                        <span className={`text-[11px] font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`p-3 rounded-lg border mb-4 ${isDark ? 'bg-[#87986a]/8 border-[#87986a]/25' : 'bg-[#f4f6f0] border-[#dbe3ce]'}`}>
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

                <div className="flex justify-between gap-2 mt-6">
                  <Button variant="outline" onClick={() => setStep(3)}
                    className={isDark ? 'bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800' : ''}>
                    ← Back
                  </Button>
                  <Button onClick={handleSubmit} className={SAGE.primary(isDark)}>
                    Authorize · Deploy Agent <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ── STEP 5: Done ─────────────────────────────────────── */}
            {step === 5 && (
              <div className={`${cardClass} text-center py-12`}>
                <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-[#87986a]/20' : 'bg-[#f4f6f0]'}`}>
                  <CheckCircle className={`h-7 w-7 ${SAGE.icon(isDark)}`} />
                </div>
                <h2 className={`text-base font-semibold ${labelClass}`}>PO Authorized</h2>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Running on {playbook} ({finnsPlaybooks.find(p => p.id === playbook)?.name}). {PLAYBOOK_META[playbook].agent} is on Stage 2. Routing you to Orders…
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
