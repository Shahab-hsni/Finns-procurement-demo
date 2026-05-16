/**
 * Buyamia Shared Design Tokens
 *
 * Extracted from the New Request page (ProductSidebar + IntelligencePanel)
 * which is the reference implementation for the entire app.
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
    card: `p-3 rounded-lg ${isDark ? "bg-[#2a2a2a]" : "bg-white"}`,

    /** Card with border (action cards, clickable tiles) */
    cardBorder: `p-3 rounded-lg border ${isDark ? "bg-[#2a2a2a] border-gray-800" : "bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"}`,

    /** Interactive card with hover (grid tiles, quick actions) */
    cardInteractive: `p-3 rounded-lg border text-left transition-colors ${
      isDark
        ? "bg-[#2a2a2a] border-gray-800 hover:bg-gray-800 hover:border-gray-700"
        : "bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:bg-[#f4f6f0]"
    }`,

    /** Center panel content cards (larger padding, xl radius) */
    cardPanel: `p-4 rounded-xl border ${isDark ? "bg-[#1a1a1a] border-gray-800" : "bg-white border-[#e5e5e0] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"}`,

    // ── Raw card background (for when you need just the bg class) ─
    cardBg: isDark ? "bg-[#2a2a2a]" : "bg-gray-50",
    panelBg: isDark ? "bg-[#1a1a1a]" : "bg-white",

    // ── Search input ──────────────────────────────────────────────
    /** Wrapper: place Search icon + Input inside a relative div */
    searchIcon: `absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-gray-500" : "text-gray-400"}`,
    searchInput: `pl-10 ${isDark ? "bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500" : "bg-gray-50"}`,

    // ── Section patterns ──────────────────────────────────────────
    /** Sidebar section wrapper (padding + bottom border) */
    section: `p-4 border-b ${isDark ? "border-gray-800" : "border-[#e5e5e0]"}`,

    /** Section heading (lighter label above a group) */
    sectionLabel: `text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`,

    // ── Borders & dividers ────────────────────────────────────────
    border: isDark ? "border-gray-800" : "border-[#e5e5e0]",
    divider: isDark ? "border-gray-800" : "border-[#e5e5e0]",

    // ── Text colors ───────────────────────────────────────────────
    textPrimary: isDark ? "text-white" : "text-[#0a0a0a]",
    textSecondary: isDark ? "text-gray-400" : "text-[#404040]",
    textMuted: isDark ? "text-gray-500" : "text-[#6b7280]",

    // ── Sage accent ───────────────────────────────────────────────
    sageIcon: isDark ? "text-[#a3b085]" : "text-[#87986a]",
    sageBg: isDark ? "bg-[#87986a]/10" : "bg-[#f4f6f0]",
    sageBorder: isDark ? "border-[#87986a]/20" : "border-[#dbe3ce]",

    // ── Progress bar track ────────────────────────────────────────
    progressTrack: isDark ? "bg-gray-700" : "bg-gray-200",
  } as const;
}
