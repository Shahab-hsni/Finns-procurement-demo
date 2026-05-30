import React from 'react';

interface ThreePanelLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  isDark: boolean;
}

/**
 * Buyamia three-panel cognitive layout:
 *   Left   (280px) — "What am I looking at?"  (Catalog/Options)
 *   Center (flex)   — "What am I doing with it?" (Journey/Active task)
 *   Right  (280px)  — "What should I know?"    (Intelligence/AI)
 *
 * Each panel scrolls independently (Asynchronous Independence pillar).
 * Left & center use native overflow-y-auto.
 * Right panel is a flex column so IntelligencePanel can manage its own scroll internally.
 */
export function ThreePanelLayout({ left, center, right, isDark }: ThreePanelLayoutProps) {
  const border = isDark ? 'border-gray-800' : 'border-[#dddddd]';

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left Panel — Catalog */}
      <div className={`w-[280px] shrink-0 min-h-0 overflow-y-auto border-r ${border}`}>
        {left}
      </div>

      {/* Center Panel — Journey */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {center}
      </div>

      {/* Right Panel — Intelligence (AI only) */}
      <div className={`w-[280px] shrink-0 flex flex-col min-h-0 overflow-hidden border-l ${border}`}>
        {right}
      </div>
    </div>
  );
}
