import { useState, useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { IntelligencePanel } from '../IntelligencePanel';
import { WorkflowTemplateList } from './WorkflowTemplateList';
import { DagFlowPath } from './DagFlowPath';
import { workflowTemplates } from '../../lib/mockData';
import { getTrailReturn, type TrailReturnMarker } from '../../lib/trailReturn';
import { TrailReturnPill } from '../TrailReturnPill';

interface WorkflowsPageProps {
  theme: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

export function WorkflowsPage({ theme, onNavigate }: WorkflowsPageProps) {
  const isDark = theme === 'dark';
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>('WF-STD');
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [trailReturn, setTrailReturnState] = useState<TrailReturnMarker | null>(null);

  // Read the Trail-Return marker on mount.
  useEffect(() => {
    setTrailReturnState(getTrailReturn());
  }, []);

  // Deep-link hash reader — `#workflow=WF-XXX` selects that template.
  // Dispatched by the Orders Decision Attribution Trail's workflow chip.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw) return;
      const params = new URLSearchParams(raw);
      const wf = params.get('workflow');
      if (!wf) return;
      if (workflowTemplates.some(t => t.id === wf)) {
        setSelectedWorkflow(wf);
      } else {
        toast.warning(`${wf} isn't a known workflow template`, {
          description: 'The template list is open for browsing.',
        });
      }
      window.location.hash = '';
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  return (
    <>
      {trailReturn && (
        <TrailReturnPill
          marker={trailReturn}
          isDark={isDark}
          onReturn={() => { setTrailReturnState(null); onNavigate?.('orders'); }}
        />
      )}
      <ThreePanelLayout
        isDark={isDark}
        left={
          <WorkflowTemplateList
            isDark={isDark}
            selectedWorkflow={selectedWorkflow}
            onSelectWorkflow={setSelectedWorkflow}
            selectedSignalId={selectedSignalId}
            onSignalSelect={setSelectedSignalId}
          />
        }
        center={
          <DagFlowPath
            isDark={isDark}
            selectedWorkflowId={selectedWorkflow}
            selectedSignalId={selectedSignalId}
          />
        }
        right={
          <IntelligencePanel
            theme={theme}
            context="workflows"
            workflowId={selectedWorkflow}
          />
        }
      />
    </>
  );
}
