import { useState } from 'react';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { IntelligencePanel } from '../IntelligencePanel';
import { CountryIndustryList } from './CountryIndustryList';
import { RegionalDrillDown } from './RegionalDrillDown';

interface GlobalOpsPageProps {
  theme: 'dark' | 'light';
}

export function GlobalOpsPage({ theme }: GlobalOpsPageProps) {
  const isDark = theme === 'dark';
  const [viewMode, setViewMode] = useState<'country' | 'industry'>('country');
  const [selectedId, setSelectedId] = useState<string | null>('country-id');

  return (
    <ThreePanelLayout
      isDark={isDark}
      left={
        <CountryIndustryList
          isDark={isDark}
          selectedId={selectedId}
          viewMode={viewMode}
          onSelectId={setSelectedId}
          onChangeView={(mode) => {
            setViewMode(mode);
            setSelectedId(null);
          }}
        />
      }
      center={<RegionalDrillDown isDark={isDark} selectedId={selectedId} viewMode={viewMode} />}
      right={<IntelligencePanel theme={theme} context="global-ops" />}
    />
  );
}
