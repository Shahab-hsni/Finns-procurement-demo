/**
 * Finn's — Atlas Intelligence Helpers
 *
 * Pure functions that produce the inline Atlas-flavored insight strings
 * shown in the New Request wizard. Each helper returns plain data —
 * no JSX, no styling — so the same intel can be rendered in different
 * surfaces if needed later.
 *
 * Why these live inline (not in the right intelligence panel): the
 * insights below are decision-shaping facts about the data right in
 * front of the user (their basket, their picked vendor, their target
 * date). Pillar 3 "Proximity of Action" — the insight belongs next to
 * the data it modifies.
 */

import { detectCategory } from './itemIntel';
import { finnsSuppliers, finnsPolicyRules } from './mockData';
import { readActionLog } from './actionLog';
import { readRuntimePOs } from './poStore';
import type { FinnsCategory, VenueTag } from './types';

// ── Step 1 · Market Price Trends ──────────────────────────────────

export interface ItemTrend {
  name: string;
  pct: number;                      // signed; e.g. -4.2 or +3.1
  direction: 'up' | 'down' | 'flat';
}

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Stable per-name 30d trend. Same item name always yields the same
 * number across the session — different items get varied trends.
 * Synthesized because we don't have a real price history feed, but
 * deterministic so the banner doesn't flicker.
 */
export function itemTrend(name: string): ItemTrend {
  const h = stableHash(name.toLowerCase());
  const bucket = h % 100;
  if (bucket < 10) return { name, pct: 0, direction: 'flat' };
  if (bucket < 55) {
    const pct = -(((h % 60) / 10) + 0.5);
    return { name, pct: Math.round(pct * 10) / 10, direction: 'down' };
  }
  const pct = (((h % 50) / 10) + 0.5);
  return { name, pct: Math.round(pct * 10) / 10, direction: 'up' };
}

export interface MarketTrendSummary {
  totalItems: number;
  upCount: number;
  downCount: number;
  flatCount: number;
  medianUpPct: number;
  medianDownPct: number;
  trends: ItemTrend[];
  lead: string;                    // "Across N items, 30d median moves: …"
  recommendation: string;          // "Lock pricing now to capture the dip."
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = nums.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function summarizeMarketTrends(itemNames: string[]): MarketTrendSummary | null {
  if (itemNames.length === 0) return null;
  const trends = itemNames.map(itemTrend);
  const up = trends.filter(t => t.direction === 'up');
  const down = trends.filter(t => t.direction === 'down');
  const flat = trends.filter(t => t.direction === 'flat');
  const medianUp = median(up.map(t => t.pct));
  const medianDown = median(down.map(t => t.pct));
  const fragments: string[] = [];
  if (down.length > 0) fragments.push(`${down.length} trending ↓ ${Math.abs(medianDown).toFixed(1)}%`);
  if (up.length > 0)   fragments.push(`${up.length} trending ↑ ${medianUp.toFixed(1)}%`);
  if (flat.length > 0) fragments.push(`${flat.length} flat`);
  const lead = `Across ${itemNames.length} line item${itemNames.length === 1 ? '' : 's'}, 30d median moves: ${fragments.join(', ')}.`;
  const recommendation = down.length >= up.length && down.length > 0
    ? 'Lock pricing now to capture the dip.'
    : up.length > 0
      ? 'Pricing pressure on the upside — lock now to cap risk.'
      : 'Market stable for this basket — pricing risk is low.';
  return {
    totalItems: itemNames.length,
    upCount: up.length,
    downCount: down.length,
    flatCount: flat.length,
    medianUpPct: medianUp,
    medianDownPct: medianDown,
    trends,
    lead,
    recommendation,
  };
}

// ── Step 1 · Complementary Items ──────────────────────────────────

/** Category → typical co-occurring items, drawn from past Finn's POs. */
const COMPLEMENTARY_MAP: Record<FinnsCategory, { name: string; unit: string; qty: number }[]> = {
  Produce:     [
    { name: 'Romaine Lettuce', unit: 'kg', qty: 5 },
    { name: 'Mixed Peppers',   unit: 'kg', qty: 3 },
    { name: 'Fresh Basil',     unit: 'kg', qty: 1 },
  ],
  Protein:     [
    { name: 'Garlic',          unit: 'kg', qty: 2 },
    { name: 'Rosemary',        unit: 'kg', qty: 1 },
  ],
  Seafood:     [
    { name: 'Fresh Lime',      unit: 'kg', qty: 2 },
    { name: 'Cilantro Bunch',  unit: 'kg', qty: 1 },
  ],
  Dairy:       [
    { name: 'Fresh Eggs',      unit: 'tray', qty: 4 },
    { name: 'Salted Butter',   unit: 'kg',   qty: 2 },
  ],
  'Dry Goods': [
    { name: 'Jasmine Rice',    unit: 'kg', qty: 25 },
    { name: 'Olive Oil',       unit: 'L',  qty: 5 },
  ],
  Beverages:   [
    { name: 'Lime',            unit: 'kg', qty: 3 },
    { name: 'Mint Bunch',      unit: 'kg', qty: 1 },
  ],
  Other:       [],
};

export interface ComplementarySuggestion {
  name: string;
  category: FinnsCategory;
  unit: string;
  qty: number;
  reason: string;
}

/** Suggest items that frequently co-occur with the basket. Skips dupes. */
export function suggestComplementary(itemNames: string[]): ComplementarySuggestion[] {
  if (itemNames.length === 0) return [];
  const cats = new Set<FinnsCategory>();
  itemNames.forEach(n => {
    const c = detectCategory(n);
    if (c) cats.add(c);
  });
  if (cats.size === 0) return [];
  const existingLower = itemNames.map(n => n.toLowerCase());
  const out: ComplementarySuggestion[] = [];
  cats.forEach(cat => {
    (COMPLEMENTARY_MAP[cat] ?? []).forEach(item => {
      const itemLower = item.name.toLowerCase();
      if (existingLower.some(e => e.includes(itemLower) || itemLower.includes(e))) return;
      if (out.some(s => s.name === item.name)) return;
      out.push({
        name: item.name,
        category: cat,
        unit: item.unit,
        qty: item.qty,
        reason: `typically ordered with ${cat.toLowerCase()} baskets`,
      });
    });
  });
  return out.slice(0, 4);
}

// ── Step 2 · Vendor Intel ─────────────────────────────────────────

export interface VendorIntelSummary {
  totalCovering: number;
  aboveTrustFloor: number;          // composite ≥ 80
  flaggedCount: number;             // composite < 70
  bestComposite: number;
  bestVendorName: string;
  bestLeadDays: number;
  message: string;
}

export function summarizeVendorIntel(itemNames: string[]): VendorIntelSummary | null {
  if (itemNames.length === 0) return null;
  const cats = new Set<FinnsCategory>();
  itemNames.forEach(n => {
    const c = detectCategory(n);
    if (c) cats.add(c);
  });
  if (cats.size === 0) return null;
  const covering = finnsSuppliers.filter(s => s.categories.some(c => cats.has(c)));
  if (covering.length === 0) return null;
  const above = covering.filter(s => s.metrics.composite >= 80).length;
  const flagged = covering.filter(s => s.metrics.composite < 70).length;
  const best = covering.reduce((a, b) => a.metrics.composite > b.metrics.composite ? a : b);
  const message = `${covering.length} vendor${covering.length === 1 ? '' : 's'} cover this basket — ${above} above the 80 trust floor${flagged > 0 ? `, ${flagged} flagged for review` : ''}. Top match: ${best.name} (composite ${best.metrics.composite}, ${best.metrics.leadTimeDays}d catalog lead).`;
  return {
    totalCovering: covering.length,
    aboveTrustFloor: above,
    flaggedCount: flagged,
    bestComposite: best.metrics.composite,
    bestVendorName: best.name,
    bestLeadDays: best.metrics.leadTimeDays,
    message,
  };
}

export interface VendorHistoryInsight {
  vendorName: string;
  pastInteractions: number;
  catalogLeadDays: number;
  onTimePct: number;
  recommendedBufferDays: number;
  message: string;
}

export function vendorHistory(vendorId: string): VendorHistoryInsight | null {
  const v = finnsSuppliers.find(s => s.id === vendorId);
  if (!v) return null;
  const past = readActionLog({ kind: ['po-create', 'po-approve', 'po-stage-advance'], limit: 80 })
    .filter(e => e.meta?.vendorId === vendorId || (e.entity?.type === 'supplier' && e.entity?.id === vendorId));
  const pastCount = past.length;
  const buffer = Math.max(1, Math.round(v.metrics.leadTimeDays * 0.25));
  const message = pastCount > 0
    ? `${pastCount} past interaction${pastCount === 1 ? '' : 's'} with ${v.name}. Catalog lead ${v.metrics.leadTimeDays}d at ${v.metrics.onTime}% on-time — pencil a ${buffer}d buffer.`
    : `First-time engagement with ${v.name}. Catalog promises ${v.metrics.leadTimeDays}d at ${v.metrics.onTime}% on-time across the directory baseline.`;
  return {
    vendorName: v.name,
    pastInteractions: pastCount,
    catalogLeadDays: v.metrics.leadTimeDays,
    onTimePct: v.metrics.onTime,
    recommendedBufferDays: buffer,
    message,
  };
}

// ── Step 3 · Logistics ────────────────────────────────────────────

export interface LogisticsInsight {
  message: string;
  dayName: string;
  flexAssessment: 'tight' | 'ok' | 'comfortable';
  conflicts: { poId: string; venue: VenueTag | 'Multi'; supplier?: string }[];
}

export function summarizeLogistics(
  vendorId: string | null,
  targetDate: string,
  flexDays: number,
  targetVenues: VenueTag[],
): LogisticsInsight | null {
  if (!targetDate) return null;
  const d = new Date(targetDate);
  if (isNaN(d.getTime())) return null;
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const v = vendorId ? finnsSuppliers.find(s => s.id === vendorId) : null;
  const lead = v?.metrics.leadTimeDays ?? 0;
  const assess: LogisticsInsight['flexAssessment'] = flexDays >= lead
    ? 'comfortable'
    : flexDays === 0 ? 'tight' : 'ok';
  const allPOs = readRuntimePOs();
  const conflicts: LogisticsInsight['conflicts'] = [];
  allPOs.forEach(p => {
    if (typeof p.eta === 'string' && p.eta.includes(targetDate)) {
      conflicts.push({ poId: p.id, venue: 'Multi', supplier: p.supplier });
    }
  });
  let message: string;
  if (v) {
    message = `${dayName} delivery from ${v.name}. Catalog lead ${v.metrics.leadTimeDays}d · on-time ${v.metrics.onTime}%${v.metrics.coldChain ? ` · cold-chain ${v.metrics.coldChain}%` : ''}. Flex window of ${flexDays}d is ${assess === 'comfortable' ? 'comfortable slack' : assess === 'ok' ? 'a usable buffer' : 'tight — no room to slip'}.`;
  } else {
    message = `${dayName} delivery to ${targetVenues.join(', ') || 'venues TBD'}. Flex window of ${flexDays}d.`;
  }
  if (conflicts.length > 0) {
    message += ` Heads-up — ${conflicts.length} other PO${conflicts.length === 1 ? '' : 's'} already landing the same date; consider consolidating receiving slots.`;
  }
  return { message, dayName, flexAssessment: assess, conflicts };
}

// ── Step 4 · Readiness ────────────────────────────────────────────

export interface ReadinessSummary {
  policyGreen: boolean;
  warnCount: number;
  reviewCount: number;
  spendCap?: number;
  message: string;
}

/**
 * Summarises the spend-cap rule headroom + overall posture for the
 * authorize banner on Step 4. Doesn't re-run policy — it consumes the
 * pre-computed checks from the wizard's policyPreview.
 */
export function summarizeReadiness(
  amount: number,
  checks: { rule: string; status: 'pass' | 'review' | 'warn'; detail: string }[],
): ReadinessSummary {
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const reviewCount = checks.filter(c => c.status === 'review').length;
  const policyGreen = warnCount === 0 && reviewCount === 0;
  // Find the spend-cap rule (if active) to compute headroom.
  const cap = finnsPolicyRules.find(r => r.active && r.template === 'spend-cap');
  const capAmount = cap ? (cap.config.threshold as number | undefined) : undefined;
  const headroom = capAmount != null ? Math.max(0, capAmount - amount) : undefined;
  const headroomFragment = headroom != null && capAmount != null
    ? amount > capAmount
      ? ` This PO (${(amount / 1_000_000).toFixed(1)}M) exceeds the ${(capAmount / 1_000_000).toFixed(0)}M spend cap by Rp ${((amount - capAmount) / 1_000_000).toFixed(1)}M.`
      : ` Cap headroom after this PO: Rp ${(headroom / 1_000_000).toFixed(1)}M.`
    : '';
  const message = policyGreen
    ? `All policy gates green — vendor trust + spend cap + venue windows clear.${headroomFragment} A-04 will gate at Stage 3 within rules.`
    : warnCount > 0
      ? `${warnCount} hard policy block${warnCount === 1 ? '' : 's'} ahead — see preview below.${headroomFragment} A-04 will route this for manual review.`
      : `${reviewCount} item${reviewCount === 1 ? '' : 's'} need a second look — see preview below.${headroomFragment} A-04 will pause at Stage 3 for sign-off.`;
  return { policyGreen, warnCount, reviewCount, spendCap: capAmount, message };
}
