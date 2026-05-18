/**
 * Finn's — RFQ Tracker (Phase 4h.2)
 *
 * Surfaces in-flight RFQs and the quotes coming back from vendors.
 * Lets the user pick a winner — awarding emits an rfq-award action
 * log entry + synthesises a PO so the awarded vendor's quote becomes
 * a real procurement record.
 *
 * Reads from `lib/rfqStore.ts` via useRFQs(). Subscribes to mock
 * quote arrivals (driven by setTimeout inside the store on RFQ
 * creation) so the tracker fills up live during a session.
 */

import { useMemo, useState, useEffect } from 'react';
import {
  X, Send, ChevronDown, ChevronUp, CircleCheck, Clock, AlertTriangle,
  Lock, Sparkles, Truck, Award, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  useRFQs, awardRFQ, cancelRFQ,
  type RFQRecord, type RFQStatus, type RFQQuote,
} from '../lib/rfqStore';
import { logUserAction } from '../lib/actionLog';
import { useAutonomyMode, AUTONOMY_LABEL } from '../lib/autonomy';
import { createPO, type RuntimePO, type QuoteChannel } from '../lib/poStore';
import { finnsSuppliers } from '../lib/mockData';

interface RFQTrackerModalProps {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
  /** Optional handler — fires when the user clicks "Compose new" from inside the tracker. */
  onComposeNew?: () => void;
  /** Navigation hook — used by "View in Orders" after an award. */
  onNavigate?: (page: string) => void;
}

const STATUS_META: Record<RFQStatus, { label: string; icon: typeof Clock; tone: 'amber' | 'blue' | 'green' | 'gray' | 'red' }> = {
  awaiting:            { label: 'Awaiting',         icon: Clock,         tone: 'amber' },
  partial:             { label: 'Partial',          icon: Clock,         tone: 'blue'  },
  received:            { label: 'Received',         icon: CircleCheck,   tone: 'green' },
  'partially-awarded': { label: 'Partially Awarded', icon: Award,        tone: 'blue'  },
  awarded:             { label: 'Awarded',          icon: Award,         tone: 'green' },
  cancelled:           { label: 'Cancelled',        icon: XCircle,       tone: 'gray'  },
  expired:             { label: 'Expired',          icon: AlertTriangle, tone: 'red'   },
};

const TONE_STYLE = (tone: 'amber' | 'blue' | 'green' | 'gray' | 'red', isDark: boolean): string => {
  switch (tone) {
    case 'amber': return isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700';
    case 'blue':  return isDark ? 'bg-blue-500/15 text-blue-300'   : 'bg-blue-50 text-blue-700';
    case 'green': return isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700';
    case 'red':   return isDark ? 'bg-red-500/15 text-red-400'     : 'bg-red-50 text-red-700';
    default:      return isDark ? 'bg-gray-800 text-gray-400'      : 'bg-gray-100 text-gray-600';
  }
};

const fmtIdrShort = (n: number): string => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n}`;
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function RFQTrackerModal({ isDark, isOpen, onClose, onComposeNew, onNavigate }: RFQTrackerModalProps) {
  const rfqs = useRFQs();
  const mode = useAutonomyMode();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auto-expand the most recent active RFQ when opening fresh.
  useEffect(() => {
    if (!isOpen) return;
    if (expandedId) return;
    const active = rfqs.find(r => r.status !== 'awarded' && r.status !== 'cancelled');
    if (active) setExpandedId(active.id);
  }, [isOpen, rfqs, expandedId]);

  // Tick every 15s so "received Xm ago" labels stay fresh while the
  // tracker is open. Cheap and bounded by the modal lifetime.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(t);
  }, [isOpen]);

  const grouped = useMemo(() => {
    // `partially-awarded` still has unawarded items and may take more
    // awards, so it stays in the Active bucket until coverage hits 100%.
    const active   = rfqs.filter(r => r.status === 'awaiting' || r.status === 'partial' || r.status === 'received' || r.status === 'partially-awarded');
    const finished = rfqs.filter(r => r.status === 'awarded' || r.status === 'cancelled' || r.status === 'expired');
    return { active, finished };
  }, [rfqs]);

  const handleAward = (rfq: RFQRecord, quote: RFQQuote) => {
    // Items this award will actually lock — quote.itemIds minus any
    // items already awarded to another vendor. Mirrors the store rule
    // so the PO summary + savings math reflect only the locked items.
    const alreadyAwarded = new Set<string>(rfq.awards.flatMap(a => a.itemIds));
    const newItemIds = quote.itemIds.filter(id => !alreadyAwarded.has(id));
    if (newItemIds.length === 0) return;
    const awardedItems = rfq.items.filter(it => newItemIds.includes(it.id));

    const poId = `PO-${3050 + Math.floor(Math.random() * 200) + rfq.awards.length}`;
    awardRFQ(rfq.id, quote.vendorId, poId);

    const channelLabel = rfq.channel === 'whatsapp' ? 'WhatsApp' : 'email';
    const quoteChannel: QuoteChannel = rfq.channel === 'whatsapp' ? 'whatsapp' : 'email';

    // Find account-manager contact for the awarded vendor — Bali context:
    // the quote came via the AM's WhatsApp/Telegram, so we tag the PO with it.
    const vendorRecord = finnsSuppliers.find(s => s.id === quote.vendorId);
    const amContact = vendorRecord
      ? `${vendorRecord.accountManager.name} · ${vendorRecord.accountManager.whatsapp}`
      : quote.vendorName;

    // Build the human-readable item summary used in the PO list —
    // scoped to the items THIS award locks, not the full RFQ.
    const itemSummary = awardedItems.map(it => `${it.qty}${it.unit} ${it.name}`);

    // Compute an ETA label from the quoted lead time. Today + leadTime days.
    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + quote.leadTimeDays);
    const etaLabel = etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Compute saving vs the next-best COMPETING quote that ALSO covers
    // any of the newly-awarded items. For multi-award flows a quote
    // from a different category isn't a real competitor — only count
    // quotes that overlap on the items we're locking now.
    const competing = rfq.quotes.filter(q =>
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
      `Awarded via ${rfq.id}. Winning quote came in via ${channelLabel} from ${amContact}.`,
      competing.length > 0
        ? savingIdr > 0
          ? `Beat ${competing.length} competing quote${competing.length === 1 ? '' : 's'} on these items — Rp ${(savingIdr / 1_000_000).toFixed(2)}M cheaper than next-best.`
          : `${competing.length} competing quote${competing.length === 1 ? ' was' : 's were'} more competitive on lead time / terms; price is locked here.`
        : `Sole vendor able to supply ${awardedItems.length} item${awardedItems.length === 1 ? '' : 's'} in this RFQ.`,
      `${quote.leadTimeDays}d lead.${quote.note ? ` Vendor note: "${quote.note}"` : ''}`,
    ].join(' ');

    // ── Mint the runtime PO at Stage 1 (Quote/Vendor Confirmed) ──
    const po: RuntimePO = {
      id: poId,
      supplier: quote.vendorName,
      items: itemSummary,
      amount: quote.totalIdr,
      group: 'needs-action',
      actionKind: 'approve',
      humanAction: 'Approve',
      humanStatus: 'Awarded quote · awaiting your approval',
      humanDescription: `Awarded from ${rfq.id} · ${awardedItems.length} line item${awardedItems.length === 1 ? '' : 's'} routed to ${quote.vendorName}.`,
      eta: `${etaLabel} · ${quote.leadTimeDays}d after approval`,
      etaMinutes: quote.leadTimeDays * 24 * 60,
      dagStage: 1,
      agentReasoning: reasoning,
      agentAgent: 'A-01 (Sourcing)',
      assignedAgent: { id: 5, role: 'Sourcing' },     // legacy id 5 → A-01
      workflowTemplate: 'WF-STD',
      status: 'live',
      createdAt: new Date().toISOString(),
      quoteChannel,
      quoteFrom: amContact,
      quoteReceivedAt: quote.receivedAt,
      fromRfqId: rfq.id,
      saving: savingIdr > 0 ? { time: '2h', cost: Math.round(savingIdr) } : undefined,
      financeInsight: savingIdr > 0
        ? `Locked Rp ${(savingIdr / 1_000_000).toFixed(2)}M vs the next-best quote.`
        : undefined,
    };
    createPO(po);

    // Two action log entries: the award itself + a po-create for the new PO.
    logUserAction({
      kind: 'rfq-award',
      entity: { type: 'supplier', id: quote.vendorId },
      summary: `Awarded ${rfq.id} → ${quote.vendorName} · ${fmtIdrShort(quote.totalIdr)} · ${quote.leadTimeDays}d · ${awardedItems.length} item${awardedItems.length === 1 ? '' : 's'}`,
      venue: rfq.venue,
      details: itemSummary.join(', '),
      meta: {
        rfqId: rfq.id,
        winningVendorId: quote.vendorId,
        winningVendorName: quote.vendorName,
        totalIdr: quote.totalIdr,
        leadTimeDays: quote.leadTimeDays,
        synthesisedPoId: poId,
        channel: rfq.channel,
        itemIds: newItemIds,
      },
    });
    logUserAction({
      kind: 'po-create',
      entity: { type: 'po', id: poId },
      summary: `Created ${poId} from ${rfq.id} · ${quote.vendorName} · ${fmtIdrShort(quote.totalIdr)} · quote via ${channelLabel}`,
      venue: rfq.venue,
      meta: { fromRfqId: rfq.id, vendorId: quote.vendorId, totalIdr: quote.totalIdr, channel: rfq.channel },
    });

    // How much is still unawarded after this — drives the toast copy.
    const remainingItems = rfq.items.length - (alreadyAwarded.size + newItemIds.length);
    toast.success(
      remainingItems > 0
        ? `${quote.vendorName} awarded · ${poId} created · ${remainingItems} item${remainingItems === 1 ? '' : 's'} still open`
        : `${quote.vendorName} awarded · ${poId} created`,
      {
        description: remainingItems > 0
          ? `Award another vendor below to cover the remaining item${remainingItems === 1 ? '' : 's'}. Quote arrived via ${channelLabel}.`
          : `Open in Orders to authorize and execute. Quote arrived via ${channelLabel}.`,
        action: onNavigate
          ? {
              label: 'View in Orders',
              onClick: () => {
                if (typeof window !== 'undefined') window.location.hash = `order=${poId}`;
                onClose();
                onNavigate('orders');
              },
            }
          : undefined,
      },
    );
  };

  const handleCancel = (rfq: RFQRecord) => {
    cancelRFQ(rfq.id);
    logUserAction({
      kind: 'po-cancel',
      entity: { type: 'po', id: rfq.id },
      summary: `Cancelled ${rfq.id} · pre-PO`,
      details: `Cancelled with ${rfq.quotes.length}/${rfq.vendorIds.length} quotes received.`,
      meta: { rfqId: rfq.id },
    });
    toast.warning(`Cancelled ${rfq.id}`, { description: 'Quotes preserved for the record.' });
  };

  if (!isOpen) return null;

  const panelBg     = isDark ? 'bg-[#1a1a1a]' : 'bg-white';
  const panelBorder = isDark ? 'border-gray-800' : 'border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textMuted   = isDark ? 'text-gray-400' : 'text-gray-600';
  const cardBg      = isDark ? 'bg-[#2a2a2a] border-gray-800' : 'bg-gray-50 border-gray-200';

  const renderRFQ = (rfq: RFQRecord) => {
    const meta = STATUS_META[rfq.status];
    const StatusIcon = meta.icon;
    const expanded = expandedId === rfq.id;
    const minQuote = rfq.quotes.length > 0 ? Math.min(...rfq.quotes.map(q => q.totalIdr)) : null;
    const isTerminal = rfq.status === 'awarded' || rfq.status === 'cancelled' || rfq.status === 'expired';
    // Multi-award support: track which items the rfq has locked in.
    const totalItems    = rfq.items.length;
    const awardedItemSet = new Set<string>(rfq.awards.flatMap(a => a.itemIds));
    const awardedCount   = awardedItemSet.size;

    return (
      <div key={rfq.id} className={`rounded-lg border ${cardBg}`}>
        <button
          onClick={() => setExpandedId(expanded ? null : rfq.id)}
          className="w-full text-left px-3 py-2.5 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700 border border-gray-300'}`}>
                {rfq.id}
              </span>
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${TONE_STYLE(meta.tone, isDark)}`}>
                <StatusIcon className="h-2.5 w-2.5" />
                {meta.label}
              </span>
              <span className={`text-[10px] ${textMuted}`}>
                {rfq.quotes.length}/{rfq.vendorIds.length} quoted
              </span>
              {totalItems > 0 && rfq.awards.length > 0 && (
                <span className={`text-[10px] font-semibold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                  · {awardedCount}/{totalItems} items awarded
                </span>
              )}
              {rfq.venue && (
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                  {rfq.venue}
                </span>
              )}
            </div>
            <p className={`text-[11px] mt-1 leading-snug ${textPrimary}`}>
              {rfq.items.map(it => `${it.qty}${it.unit} ${it.name}`).join(', ')}
            </p>
            <div className={`text-[10px] mt-1 flex items-center gap-2 flex-wrap ${textMuted}`}>
              <span>Due {rfq.deadline}</span>
              <span>·</span>
              <span>Sent via {rfq.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</span>
              <span>·</span>
              <span>{relativeTime(rfq.createdAt)}</span>
              {minQuote != null && (
                <>
                  <span>·</span>
                  <span className={isDark ? 'text-green-400' : 'text-green-700'}>
                    Best {fmtIdrShort(minQuote)}
                  </span>
                </>
              )}
            </div>
          </div>
          <span className={`shrink-0 mt-1 ${textMuted}`}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>

        {expanded && (
          <div className={`px-3 pb-3 pt-1 space-y-2 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            {/* Vendor list with quote / pending status */}
            <div>
              <p className={`text-[10px] uppercase tracking-wide font-bold mb-1.5 ${textMuted}`}>
                Vendors ({rfq.vendorIds.length})
              </p>
              <div className="space-y-1.5">
                {rfq.vendorIds.map((vid, idx) => {
                  const vendorName = rfq.vendorNames[idx] ?? vid;
                  const quote = rfq.quotes.find(q => q.vendorId === vid);
                  const award = rfq.awards.find(a => a.vendorId === vid);
                  const isWinner = !!award;
                  const lowestId = minQuote != null
                    ? rfq.quotes.find(q => q.totalIdr === minQuote)?.vendorId
                    : null;
                  const isLowest = quote && quote.vendorId === lowestId && !isWinner;
                  // Items in this vendor's quote that are still claimable
                  // (not already locked to another award).
                  const claimable = quote
                    ? quote.itemIds.filter(id => !awardedItemSet.has(id))
                    : [];
                  const isNoBidForBasket = quote && quote.itemIds.length === 0;
                  const quoteItemNames = quote
                    ? quote.itemIds
                        .map(id => rfq.items.find(it => it.id === id))
                        .filter(Boolean)
                        .map(it => `${it!.qty}${it!.unit} ${it!.name}`)
                    : [];

                  return (
                    <div key={vid} className={`flex items-start gap-2 p-2 rounded border ${
                      isWinner
                        ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/50' : 'bg-[#f4f6f0] border-[#87986a]/40'
                        : isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[11px] font-semibold ${textPrimary}`}>{vendorName}</span>
                          {isWinner && award && (
                            <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>
                              <Award className="h-2.5 w-2.5" /> Awarded · {award.poId}
                            </span>
                          )}
                          {!isWinner && isLowest && (
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                              Lowest
                            </span>
                          )}
                          {!isWinner && quote && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              claimable.length === 0
                                ? isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
                                : isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                            }`}>
                              {isNoBidForBasket
                                ? 'No bid'
                                : `Quotes on ${quote.itemIds.length}/${totalItems}`}
                            </span>
                          )}
                        </div>
                        {quote ? (
                          <>
                            <div className={`text-[10px] mt-0.5 flex items-center gap-2 flex-wrap ${textMuted}`}>
                              <span className={`font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                                {fmtIdrShort(quote.totalIdr)}
                              </span>
                              <span className="inline-flex items-center gap-0.5">
                                <Truck className="h-2.5 w-2.5" />
                                {quote.leadTimeDays}d lead
                              </span>
                              <span>·</span>
                              <span className={`inline-flex items-center gap-0.5 ${
                                rfq.channel === 'whatsapp'
                                  ? isDark ? 'text-[#a3b085]' : 'text-[#25D366]'
                                  : isDark ? 'text-blue-300' : 'text-blue-700'
                              }`}>
                                via {rfq.channel === 'whatsapp' ? 'WhatsApp' : 'email'}
                              </span>
                              <span>·</span>
                              <span>{relativeTime(quote.receivedAt)}</span>
                            </div>
                            {quoteItemNames.length > 0 && (
                              <p className={`text-[10px] mt-1 leading-snug ${textMuted}`}>
                                <span className="font-semibold">Quote covers:</span> {quoteItemNames.join(', ')}
                              </p>
                            )}
                            {!isWinner && quote.itemIds.length > 0 && claimable.length === 0 && (
                              <p className={`text-[10px] mt-1 italic ${textMuted}`}>
                                All items in this quote are already awarded to another vendor.
                              </p>
                            )}
                          </>
                        ) : (
                          <div className={`text-[10px] mt-0.5 inline-flex items-center gap-1 ${textMuted}`}>
                            <Clock className="h-2.5 w-2.5" />
                            Waiting on {rfq.channel === 'whatsapp' ? 'WhatsApp' : 'email'} reply
                          </div>
                        )}
                        {quote?.note && (
                          <p className={`text-[10px] mt-1 italic ${textMuted}`}>"{quote.note}"</p>
                        )}
                      </div>
                      {quote && !isTerminal && !isWinner && claimable.length > 0 && (
                        <button
                          onClick={() => handleAward(rfq, quote)}
                          className={`shrink-0 text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                            isLowest
                              ? 'bg-[#87986a] border-[#87986a] text-white hover:bg-[#6b7a54]'
                              : isDark
                                ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}>
                          <Award className="h-2.5 w-2.5" /> Award
                        </button>
                      )}
                      {quote && !isTerminal && !isWinner && quote.itemIds.length > 0 && claimable.length === 0 && (
                        <span className={`shrink-0 text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded ${
                          isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
                        }`}>
                          Items covered
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {rfq.notes && (
              <div className={`text-[10px] p-2 rounded ${isDark ? 'bg-[#1a1a1a] text-gray-300' : 'bg-white text-gray-700 border border-gray-200'}`}>
                <span className={`font-semibold ${textMuted}`}>Notes:</span> {rfq.notes}
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
              <div className={`text-[10px] ${textMuted}`}>
                {rfq.awards.length > 1
                  ? (
                    <>Awarded → {rfq.awards.map((a, i) => (
                      <span key={a.poId}>
                        {i > 0 && <span>, </span>}
                        <span className="font-semibold">{a.poId}</span>
                        <span> ({a.vendorName})</span>
                      </span>
                    ))}</>
                  )
                  : rfq.awardedPoId
                    ? <>Awarded → <span className="font-semibold">{rfq.awardedPoId}</span></>
                    : isTerminal
                      ? null
                      : `Quotes auto-arrive as vendors reply.`}
              </div>
              {!isTerminal && (
                <button
                  onClick={() => handleCancel(rfq)}
                  className={`text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                    isDark ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-red-300/70 text-red-600 hover:bg-red-50'
                  }`}>
                  <XCircle className="h-2.5 w-2.5" /> Cancel RFQ
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)' }}
         onClick={onClose}>
      <div className={`relative w-full max-w-3xl max-h-[88vh] rounded-2xl border shadow-2xl flex flex-col ${panelBg} ${panelBorder}`}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`shrink-0 flex items-start justify-between gap-3 p-5 border-b ${panelBorder}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-base font-bold ${textPrimary}`}>Your RFQs</h2>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'
              }`}>
                <Lock className="h-2.5 w-2.5" /> Internal Directory
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                Autonomy: {AUTONOMY_LABEL[mode]}
              </span>
            </div>
            <p className={`text-xs mt-1 ${textMuted}`}>
              In-flight quote requests and the vendor replies coming back. Award the winner to mint a PO.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onComposeNew && (
              <Button onClick={() => { onComposeNew(); onClose(); }}
                      className="bg-[#87986a] hover:bg-[#6b7a54] text-white h-8 px-3 text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Compose new
              </Button>
            )}
            <button onClick={onClose}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
          {rfqs.length === 0 ? (
            <div className={`text-center text-[11px] py-12 rounded-lg border border-dashed ${isDark ? 'border-gray-800 text-gray-500' : 'border-gray-300 text-gray-500'}`}>
              No RFQs yet. Click <span className={`font-semibold ${textPrimary}`}>Compose new</span> above to send your first one.
            </div>
          ) : (
            <>
              {grouped.active.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-[10px] uppercase tracking-wide font-bold ${textMuted}`}>
                      Active ({grouped.active.length})
                    </h3>
                    <span className={`text-[10px] ${textMuted}`}>
                      Mock quotes arrive 5–15s after sending.
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grouped.active.map(renderRFQ)}
                  </div>
                </section>
              )}
              {grouped.finished.length > 0 && (
                <section>
                  <h3 className={`text-[10px] uppercase tracking-wide font-bold mb-2 ${textMuted}`}>
                    Closed ({grouped.finished.length})
                  </h3>
                  <div className="space-y-2">
                    {grouped.finished.map(renderRFQ)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
