/**
 * Finn's — Item Intelligence (5b)
 *
 * Tiny keyword library that powers the New Request smart suggestions:
 *   detectCategory("Wagyu Ribeye")     → "Protein"
 *   detectVenues("Sashimi Tuna")       → ['ST']      // Stake uses sashimi
 *   detectUnit("Bintang Beer")         → "case"
 *   suggestVendorsForItems([items])    → ['SUP-014', 'SUP-019', ...]
 *
 * Curated, not exhaustive — enough to make the wizard feel smart
 * without dragging in an NLP dep. Lower-cased substring matching; the
 * first matching rule wins. Keep entries scoped to Finn's catalog —
 * adding edge cases beyond the seeded data isn't useful.
 */

import { finnsSuppliers } from './mockData';
import type { FinnsCategory, VenueTag } from './types';

interface CategoryRule {
  match: string[];                 // lower-case substrings to match against the item name
  category: FinnsCategory;
  /** Optional default unit override. */
  unit?: string;
  /** Optional venues that typically consume this item. */
  venues?: VenueTag[];
}

const CATEGORY_RULES: CategoryRule[] = [
  // ── Protein ──────────────────────────────────────────────
  { match: ['wagyu', 'ribeye', 'striploin', 'tenderloin', 'sirloin'], category: 'Protein', unit: 'kg', venues: ['ST'] },
  { match: ['chicken thigh', 'chicken breast', 'chicken whole', 'chicken'], category: 'Protein', unit: 'kg', venues: ['BC', 'RC', 'SP'] },
  { match: ['pork belly', 'pork loin', 'bacon', 'pork', 'sausage'],   category: 'Protein', unit: 'kg', venues: ['BC', 'RC'] },
  { match: ['lamb chop', 'lamb rack', 'lamb', 'mutton'],              category: 'Protein', unit: 'kg', venues: ['ST', 'BC'] },
  { match: ['duck breast', 'duck'],                                    category: 'Protein', unit: 'kg', venues: ['ST'] },
  { match: ['beef'],                                                   category: 'Protein', unit: 'kg' },

  // ── Seafood ──────────────────────────────────────────────
  { match: ['yellowfin', 'tuna sashimi', 'sashimi'],                  category: 'Seafood', unit: 'kg', venues: ['ST'] },
  { match: ['tuna'],                                                   category: 'Seafood', unit: 'kg' },
  { match: ['salmon'],                                                 category: 'Seafood', unit: 'kg' },
  { match: ['prawn', 'shrimp'],                                        category: 'Seafood', unit: 'kg', venues: ['BC', 'RC', 'ST'] },
  { match: ['mahi', 'snapper', 'grouper', 'barramundi'],               category: 'Seafood', unit: 'kg', venues: ['BC', 'RC', 'ST'] },
  { match: ['scallop', 'mussel', 'clam', 'oyster', 'squid', 'octopus', 'crab', 'lobster'], category: 'Seafood', unit: 'kg' },

  // ── Dairy ────────────────────────────────────────────────
  { match: ['burrata'],                              category: 'Dairy', unit: 'pcs', venues: ['ST'] },
  { match: ['mozzarella', 'parmesan', 'cheddar', 'cheese', 'feta', 'ricotta'], category: 'Dairy', unit: 'kg' },
  { match: ['butter'],                               category: 'Dairy', unit: 'kg' },
  { match: ['cream', 'yogurt', 'milk', 'kefir'],     category: 'Dairy', unit: 'L' },
  { match: ['egg'],                                   category: 'Dairy', unit: 'tray' },

  // ── Produce ──────────────────────────────────────────────
  { match: ['tomato', 'cherry tomato', 'heirloom'],  category: 'Produce', unit: 'kg' },
  { match: ['lime', 'lemon', 'orange', 'citrus'],    category: 'Produce', unit: 'kg' },
  { match: ['lettuce', 'rocket', 'arugula', 'salad', 'greens', 'spinach', 'kale'], category: 'Produce', unit: 'kg' },
  { match: ['basil', 'mint', 'cilantro', 'parsley', 'thyme', 'rosemary', 'herb'], category: 'Produce', unit: 'kg', venues: ['ST', 'BC'] },
  { match: ['onion', 'garlic', 'shallot', 'leek'],   category: 'Produce', unit: 'kg' },
  { match: ['avocado'],                              category: 'Produce', unit: 'kg' },
  { match: ['banana', 'mango', 'pineapple', 'papaya', 'watermelon', 'melon', 'apple', 'fruit'], category: 'Produce', unit: 'kg' },
  { match: ['mushroom', 'shiitake', 'oyster mushroom'], category: 'Produce', unit: 'kg' },
  { match: ['pepper', 'chili', 'jalapeno', 'capsicum'], category: 'Produce', unit: 'kg' },

  // ── Beverages ────────────────────────────────────────────
  { match: ['bintang', 'heineken', 'beer', 'cider'], category: 'Beverages', unit: 'case', venues: ['BC', 'RC', 'SP'] },
  { match: ['wine', 'prosecco', 'champagne', 'rosé', 'rose '], category: 'Beverages', unit: 'btl' },
  { match: ['vodka', 'gin', 'rum', 'whisky', 'whiskey', 'tequila', 'spirit'], category: 'Beverages', unit: 'btl' },
  { match: ['coke', 'coca-cola', 'cola', 'pepsi', 'sprite', 'fanta', 'soda'], category: 'Beverages', unit: 'case', venues: ['BC', 'SP'] },
  { match: ['tonic', 'soda water', 'sparkling water'], category: 'Beverages', unit: 'btl' },
  { match: ['coffee', 'kopi', 'espresso'],            category: 'Beverages', unit: 'kg' },
  { match: ['tea', 'matcha'],                         category: 'Beverages', unit: 'kg' },
  { match: ['juice', 'syrup'],                        category: 'Beverages', unit: 'L' },

  // ── Dry Goods ────────────────────────────────────────────
  { match: ['rice'],                                  category: 'Dry Goods', unit: 'kg' },
  { match: ['pasta', 'spaghetti', 'penne', 'flour'],  category: 'Dry Goods', unit: 'kg' },
  { match: ['salt', 'sugar', 'pepper corn', 'spice'], category: 'Dry Goods', unit: 'kg' },
  { match: ['oil', 'olive oil', 'vinegar', 'soy sauce'], category: 'Dry Goods', unit: 'L' },
  { match: ['takeaway box', 'takeaway', 'packaging', 'napkin', 'paper bag', 'container'], category: 'Other', unit: 'case', venues: ['SP', 'BC'] },
];

/** Match the strongest rule for a free-text item name. */
function findRule(name: string): CategoryRule | null {
  const n = name.toLowerCase();
  if (!n.trim()) return null;
  // Find the rule whose match list contains the longest matching token.
  // (Avoids "tuna" winning over "yellowfin tuna sashimi".)
  let best: { rule: CategoryRule; length: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    for (const token of rule.match) {
      if (n.includes(token) && (!best || token.length > best.length)) {
        best = { rule, length: token.length };
      }
    }
  }
  return best?.rule ?? null;
}

export function detectCategory(name: string): FinnsCategory | null {
  return findRule(name)?.category ?? null;
}

export function detectUnit(name: string): string | null {
  return findRule(name)?.unit ?? null;
}

export function detectVenues(name: string): VenueTag[] | null {
  return findRule(name)?.venues ?? null;
}

/** Combined: one call returns all three. Returns null when no rule hits. */
export function detectItem(name: string): {
  category: FinnsCategory;
  unit: string | null;
  venues: VenueTag[] | null;
} | null {
  const rule = findRule(name);
  if (!rule) return null;
  return {
    category: rule.category,
    unit: rule.unit ?? null,
    venues: rule.venues ?? null,
  };
}

/**
 * Rank the supplier directory by relevance to a set of items.
 * Returns supplier ids sorted by:
 *   1. Categories covered (more = better)
 *   2. Composite score as a tie-breaker
 * Only returns suppliers that cover at least one of the items' categories.
 */
export function suggestVendorsForItems(itemNames: string[], limit = 5): string[] {
  const categories = new Set<FinnsCategory>();
  itemNames.forEach(n => {
    const c = detectCategory(n);
    if (c) categories.add(c);
  });
  if (categories.size === 0) {
    // No detected categories — fall back to top vendors by composite.
    return finnsSuppliers
      .slice()
      .sort((a, b) => b.metrics.composite - a.metrics.composite)
      .slice(0, limit)
      .map(s => s.id);
  }
  const scored = finnsSuppliers.map(s => {
    const overlap = s.categories.filter(c => categories.has(c)).length;
    return { id: s.id, overlap, composite: s.metrics.composite };
  });
  return scored
    .filter(x => x.overlap > 0)
    .sort((a, b) => (b.overlap - a.overlap) || (b.composite - a.composite))
    .slice(0, limit)
    .map(x => x.id);
}
