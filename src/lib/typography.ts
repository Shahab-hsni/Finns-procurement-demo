/**
 * Buyamia Typography System
 *
 * Standardized text sizes & weights derived from the New Request page reference.
 * Each page should use these constants for consistency.
 *
 * Usage:
 *   import { typo } from "../lib/typography";
 *   <h2 className={`${typo.panelTitle} ${isDark ? 'text-white' : 'text-gray-900'}`}>
 *
 * Colors are NOT included — they vary by context (dark/light theme, accent states).
 */

export const typo = {
  /** Left/right panel titles, center panel header — h2 level */
  panelTitle: "text-base font-semibold",

  /** Subtitle under panel/page titles */
  subtitle: "text-sm",

  /** Bold section headers inside panels — h3 level */
  sectionTitle: "text-sm font-semibold",

  /** Lighter section labels (category-like) — "Quick Access", "Featured Videos" */
  sectionLabel: "text-sm",

  /** Form labels, item names (matches Label component default) */
  label: "text-sm font-medium",

  /** Body text, descriptions, paragraphs */
  body: "text-sm",

  /** Small text — timestamps, badges, meta info */
  meta: "text-xs",

  /** Large stat/metric numbers */
  metric: "text-2xl font-bold",

  /** Medium stat/metric numbers */
  metricMd: "text-lg font-bold",

  /** Smaller inline metrics */
  metricSm: "text-base font-semibold",
} as const;
