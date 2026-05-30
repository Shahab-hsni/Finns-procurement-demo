/**
 * Finn's Shared Design Tokens
 *
 * Migrated from sage to teal voltage on 2026-05-30.
 * Reference: docs/DESIGN.md (Airbnb-derived warm, photography-led system
 * scaled to Finn's brand teal #4bbcbe).
 *
 * The legacy `sage*` keys are preserved as ALIASES on the new teal palette
 * so consuming components continue to render without an inline-class sweep —
 * `t.sageIcon` now emits teal. A second pass will rename these keys.
 *
 * Usage:
 *   import { theme } from "../lib/theme";
 *   const t = theme(isDark);
 *   <div className={t.card}>...</div>
 */

export function theme(isDark: boolean) {
  return {
    // ── Card backgrounds ──────────────────────────────────────────
    /** Standard neutral card (sidebar items, list cards, info cards) */
    card: `p-3 rounded-[14px] ${isDark ? "bg-[#1a1f1f]" : "bg-white"}`,

    /** Card with border (action cards, clickable tiles) */
    cardBorder: `p-3 rounded-[14px] border ${
      isDark
        ? "bg-[#1a1f1f] border-[#2a3030]"
        : "bg-white border-[#dddddd] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    }`,

    /** Interactive card with hover (grid tiles, quick actions) */
    cardInteractive: `p-3 rounded-[14px] border text-left transition-all ${
      isDark
        ? "bg-[#1a1f1f] border-[#2a3030] hover:border-[#4bbcbe]/40 hover:bg-[#1d3535]"
        : "bg-white border-[#dddddd] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[rgba(0,0,0,0.02)_0_0_0_1px,rgba(0,0,0,0.04)_0_2px_6px_0,rgba(0,0,0,0.1)_0_4px_8px_0] hover:bg-[#eafafa]/40"
    }`,

    /** Center panel content cards (larger padding, lg radius) */
    cardPanel: `p-4 rounded-[20px] border ${
      isDark
        ? "bg-[#0e1414] border-[#2a3030]"
        : "bg-white border-[#dddddd] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    }`,

    // ── Raw card background (for when you need just the bg class) ─
    cardBg:  isDark ? "bg-[#1a1f1f]" : "bg-[#f7f7f7]",
    panelBg: isDark ? "bg-[#0e1414]" : "bg-white",

    // ── Search input ──────────────────────────────────────────────
    searchIcon: `absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${
      isDark ? "text-gray-500" : "text-[#929292]"
    }`,
    searchInput: `pl-10 rounded-full ${
      isDark
        ? "bg-[#1a1f1f] border-[#2a3030] text-white placeholder:text-[#6a6a6a]"
        : "bg-[#f7f7f7] border-[#ebebeb] placeholder:text-[#929292]"
    }`,

    // ── Section patterns ──────────────────────────────────────────
    section: `p-4 border-b ${isDark ? "border-[#2a3030]" : "border-[#ebebeb]"}`,
    sectionLabel: `text-[12px] font-medium ${isDark ? "text-[#929292]" : "text-[#6a6a6a]"}`,

    // ── Borders & dividers ────────────────────────────────────────
    border:  isDark ? "border-[#2a3030]" : "border-[#dddddd]",
    divider: isDark ? "border-[#2a3030]" : "border-[#ebebeb]",

    // ── Text colors (Airbnb scale) ────────────────────────────────
    textPrimary:   isDark ? "text-white"        : "text-[#222222]",
    textSecondary: isDark ? "text-[#d0d0d0]"    : "text-[#3f3f3f]",
    textMuted:     isDark ? "text-[#929292]"    : "text-[#6a6a6a]",

    // ── Teal accent (legacy `sage*` keys preserved as aliases) ────
    tealIcon:   isDark ? "text-[#82d3d5]"            : "text-[#4bbcbe]",
    tealBg:     isDark ? "bg-[#4bbcbe]/10"           : "bg-[#eafafa]",
    tealBorder: isDark ? "border-[#4bbcbe]/25"       : "border-[#c4eef0]",

    /** @deprecated use `tealIcon` */
    sageIcon:   isDark ? "text-[#82d3d5]"            : "text-[#4bbcbe]",
    /** @deprecated use `tealBg` */
    sageBg:     isDark ? "bg-[#4bbcbe]/10"           : "bg-[#eafafa]",
    /** @deprecated use `tealBorder` */
    sageBorder: isDark ? "border-[#4bbcbe]/25"       : "border-[#c4eef0]",

    // ── Progress bar track ────────────────────────────────────────
    progressTrack: isDark ? "bg-[#2a3030]" : "bg-[#ebebeb]",
  } as const;
}
