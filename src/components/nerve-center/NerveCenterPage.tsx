import { useState } from 'react';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { IntelligencePanel } from '../IntelligencePanel';
import { AgentGrid } from './AgentGrid';
import { DagVisualization } from './DagVisualization';
import { AgentClassSheet } from './AgentClassSheet';
import { dagStages } from '../../lib/mockData';
import { useSimulatedMetric } from '../../hooks/useSimulatedMetric';
import type { AgentClass, AutonomyLevel } from '../../lib/types';

interface NerveCenterPageProps {
  theme: 'dark' | 'light';
}

// Baseline stress is derived from DAG bottleneck + waiting counts (static shape)
const BOTTLENECK_COUNT = dagStages.filter(s => s.status === 'bottleneck').length;
const WAITING_COUNT    = dagStages.filter(s => s.status === 'waiting').length;
const STRESS_BASELINE  = 50 + BOTTLENECK_COUNT * 20 + WAITING_COUNT * 8; // ~78

export function NerveCenterPage({ theme }: NerveCenterPageProps) {
  const isDark = theme === 'dark';
  const [selectedClass, setSelectedClass] = useState<AgentClass | null>(null);
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>(3);

  // Single source of truth — both panels read the same oscillating values
  const systemStress  = Math.min(100, Math.round(useSimulatedMetric(STRESS_BASELINE, 12)));
  const anomalyCount  = Math.round(useSimulatedMetric(280, 60));

  return (
    <ThreePanelLayout
      isDark={isDark}
      left={
        <AgentGrid
          isDark={isDark}
          selectedClass={selectedClass}
          onClassSelect={setSelectedClass}
          systemStress={systemStress}
        />
      }
      center={
        <DagVisualization
          isDark={isDark}
          selectedClass={selectedClass}
          autonomyLevel={autonomyLevel}
          onAutonomyChange={setAutonomyLevel}
          systemStress={systemStress}
          anomalyCount={anomalyCount}
        />
      }
      right={
        selectedClass
          ? <AgentClassSheet cls={selectedClass} isDark={isDark} onClose={() => setSelectedClass(null)} />
          : <IntelligencePanel theme={theme} context="nerve-center" />
      }
    />
  );
}
