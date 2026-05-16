import { useState } from 'react';
import { Globe, Factory } from 'lucide-react';
import { countries, industries } from '../../lib/mockData';
import { useHeartbeat } from '../../hooks/useHeartbeat';
import { theme } from '../../lib/theme';

type ViewMode = 'country' | 'industry';

interface CountryIndustryListProps {
  isDark: boolean;
  selectedId: string | null;
  viewMode: ViewMode;
  onSelectId: (id: string) => void;
  onChangeView: (mode: ViewMode) => void;
}

const REGULATORY_BADGE: Record<string, { dark: string; light: string }> = {
  compliant: { dark: 'bg-green-500/15 text-green-400', light: 'bg-green-50 text-green-700' },
  review: { dark: 'bg-amber-500/15 text-amber-400', light: 'bg-amber-50 text-amber-700' },
  blocked: { dark: 'bg-red-500/15 text-red-400', light: 'bg-red-50 text-red-700' },
};

export function CountryIndustryList({ isDark, selectedId, viewMode, onSelectId, onChangeView }: CountryIndustryListProps) {
  const t = theme(isDark);
  const pulse = useHeartbeat(1500);

  return (
    <div className="flex flex-col h-full">
      <div className={t.section}>
        <h2 className={`text-sm font-semibold mb-3 ${t.textPrimary}`}>Global Ops</h2>

        {/* View toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => onChangeView('country')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'country'
                ? 'bg-[#87986a] text-white'
                : isDark ? 'bg-[#2a2a2a] text-gray-400 hover:text-gray-200' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            <Globe className="h-3 w-3" />
            Countries
          </button>
          <button
            onClick={() => onChangeView('industry')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              viewMode === 'industry'
                ? 'bg-[#87986a] text-white'
                : isDark ? 'bg-[#2a2a2a] text-gray-400 hover:text-gray-200' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
            }`}
          >
            <Factory className="h-3 w-3" />
            Industries
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4 space-y-2 pt-2">
        {viewMode === 'country' ? (
          <>
            <h3 className={`text-xs mb-1 ${t.sectionLabel}`}>5 COUNTRIES</h3>
            {countries.map((country) => {
              const isSelected = selectedId === country.id;
              const badge = REGULATORY_BADGE[country.regulatoryStatus];
              return (
                <button
                  key={country.id}
                  onClick={() => onSelectId(country.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#87986a]/30'
                      : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{country.flag}</span>
                    <span className={`text-xs font-medium ${t.textPrimary}`}>{country.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] ${t.textMuted}`}>{country.activeAgents} agents · {country.supplierCount} suppliers</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? badge.dark : badge.light}`}>
                      {country.regulatoryStatus}
                    </span>
                  </div>
                </button>
              );
            })}
          </>
        ) : (
          <>
            <h3 className={`text-xs mb-1 ${t.sectionLabel}`}>5 INDUSTRIES</h3>
            {industries.map((industry) => {
              const isSelected = selectedId === industry.id;
              const trendColor = industry.demandTrend === 'rising'
                ? 'text-green-400'
                : industry.demandTrend === 'declining'
                  ? 'text-red-400'
                  : t.textMuted;
              return (
                <button
                  key={industry.id}
                  onClick={() => onSelectId(industry.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/30' : 'bg-[#f4f6f0] border-[#87986a]/30'
                      : isDark ? 'bg-[#2a2a2a] border-gray-800 hover:bg-gray-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{industry.icon}</span>
                    <span className={`text-xs font-medium ${t.textPrimary}`}>{industry.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] ${t.textMuted}`}>{industry.transactionVolume.toLocaleString()} txns</span>
                    <span className={`text-[10px] ${trendColor}`}>
                      {industry.growthPct > 0 ? '+' : ''}{industry.growthPct}% growth
                    </span>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
