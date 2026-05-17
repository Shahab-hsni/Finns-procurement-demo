import { useState, useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import { ThreePanelLayout } from '../layout/ThreePanelLayout';
import { IntelligencePanel } from '../IntelligencePanel';
import { WorkflowTemplateList } from './WorkflowTemplateList';
import { DagFlowPath } from './DagFlowPath';
import { finnsPlaybooks } from '../../lib/mockData';
import type { PlaybookId } from '../../lib/types';

interface WorkflowsPageProps {
  theme: 'dark' | 'light';
  onNavigate?: (page: string) => void;
}

export function WorkflowsPage({ theme }: WorkflowsPageProps) {
  const isDark = theme === 'dark';
  const [selectedWorkflow, setSelectedWorkflow] = useState<PlaybookId>('WF-STD');

  // Deep-link hash reader — `#workflow=WF-XXX` selects that playbook.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw) return;
      const params = new URLSearchParams(raw);
      const wf = params.get('workflow');
      if (!wf) return;
      if (finnsPlaybooks.some(p => p.id === wf)) {
        setSelectedWorkflow(wf as PlaybookId);
      } else {
        toast.warning(`${wf} isn't a known playbook`, {
          description: 'Finn\'s runs three playbooks: Standard, Rush, Recurring.',
        });
      }
      window.location.hash = '';
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  return (
    <ThreePanelLayout
      isDark={isDark}
      left={
        <WorkflowTemplateList
          isDark={isDark}
          selectedWorkflow={selectedWorkflow}
          onSelectWorkflow={(id) => setSelectedWorkflow(id as PlaybookId)}
        />
      }
      center={
        <DagFlowPath
          isDark={isDark}
          selectedWorkflowId={selectedWorkflow}
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
  );
}
