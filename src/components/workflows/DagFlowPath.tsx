import {
  ScrollText, Zap, FileText, Bot, CheckCircle, Clock,
} from 'lucide-react';
import { InfoTooltip } from '../ui/InfoTooltip';
import { finnsPlaybooks, finnsAgents } from '../../lib/mockData';
import { theme } from '../../lib/theme';
import type { PlaybookId, FinnsAgentId } from '../../lib/types';

interface DagFlowPathProps {
  isDark: boolean;
  selectedWorkflowId: PlaybookId;
}

const PLAYBOOK_ICON: Record<PlaybookId, typeof Zap> = {
  'WF-STD': ScrollText,
  'WF-RSH': Zap,
  'WF-REC': FileText,
};

export function DagFlowPath({ isDark, selectedWorkflowId }: DagFlowPathProps) {
  const t = theme(isDark);
  const playbook = finnsPlaybooks.find(p => p.id === selectedWorkflowId);

  if (!playbook) {
    return (
      <div className={`flex items-center justify-center h-full ${t.textMuted}`}>
        <p className="text-xs">No playbook selected.</p>
      </div>
    );
  }

  const Icon = PLAYBOOK_ICON[playbook.id];
  const agentFor = (id: FinnsAgentId | 'human') => {
    if (id === 'human') return { name: 'Human', role: 'Receiving Venue Staff' };
    return finnsAgents.find(a => a.id === id) ?? { name: id, role: '' };
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto p-6 space-y-5">
      {/* Hero card */}
      <div id="wf-workflow-hero"
        className={`p-5 rounded-xl border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'}`}>
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-sm font-bold ${t.textPrimary}`}>{playbook.id} · {playbook.name}</h2>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
              }`}>{playbook.complexity}</span>
            </div>
            <p className={`text-[11px] mt-1 leading-relaxed ${t.textMuted}`}>{playbook.description}</p>
          </div>
        </div>

        {/* Stats strip */}
        <div className={`grid grid-cols-4 gap-3 mt-4 pt-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
          <div>
            <p className={`text-[9px] uppercase ${t.textMuted}`}>Active</p>
            <p className={`text-base font-bold mt-0.5 ${t.textPrimary}`}>{playbook.activeOrderCount}</p>
          </div>
          <div>
            <p className={`text-[9px] uppercase ${t.textMuted}`}>Stages</p>
            <p className={`text-base font-bold mt-0.5 ${t.textPrimary}`}>{playbook.stages.length}</p>
          </div>
          <div>
            <p className={`text-[9px] uppercase ${t.textMuted}`}>Avg duration</p>
            <p className={`text-base font-bold mt-0.5 ${t.textPrimary}`}>{playbook.avgDurationHours}h</p>
          </div>
          <div>
            <p className={`text-[9px] uppercase ${t.textMuted}`}>Savings</p>
            <p className={`text-base font-bold mt-0.5 ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>+{playbook.savingsVsBaseline}%</p>
          </div>
        </div>

        {/* When-it-runs */}
        <div className={`mt-4 p-2.5 rounded-lg ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-50'}`}>
          <p className={`text-[9px] font-bold uppercase ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'} mb-1`}>When it runs</p>
          <p className={`text-[11px] leading-relaxed ${t.textPrimary}`}>{playbook.whenItRuns}</p>
        </div>
      </div>

      {/* Flow Path — 5 stages vertical */}
      <div id="wf-flow-path">
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className={`text-xs font-semibold ${t.textPrimary}`}>Flow Path</h3>
          <InfoTooltip
            text="The 5 stages every order in this playbook flows through. Read-only — agents are assigned by role, not configured per request."
            isDark={isDark}
            side="bottom"
          />
        </div>

        <div>
          {playbook.stages.map((stage, idx) => {
            const agent = agentFor(stage.owningAgent);
            const isLast = idx === playbook.stages.length - 1;
            return (
              <div key={stage.stage} className="flex items-start gap-3">
                {/* Node column */}
                <div className="flex flex-col items-center pt-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isDark ? 'bg-[#87986a]/20 text-[#a3b085] border border-[#87986a]/40' : 'bg-[#f4f6f0] text-[#6b7a54] border border-[#87986a]/40'
                  }`}>
                    {stage.stage}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 grow my-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ minHeight: 28 }} />
                  )}
                </div>

                {/* Body card */}
                <div className={`flex-1 mb-3 p-3 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <span className={`text-xs font-semibold ${t.textPrimary}`}>{stage.name}</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      isDark ? 'bg-[#87986a]/15 text-[#a3b085]' : 'bg-[#f4f6f0] text-[#6b7a54]'
                    }`}>
                      <Bot className="h-2.5 w-2.5" />
                      {stage.owningAgent === 'human' ? 'Human' : stage.owningAgent}
                    </span>
                    {stage.throughputPerHour != null && (
                      <span className={`text-[9px] ${t.textMuted}`}>
                        <Clock className="h-2.5 w-2.5 inline -mt-0.5 mr-0.5" />
                        ~{stage.throughputPerHour}/hr
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] leading-relaxed ${t.textMuted}`}>{stage.description}</p>
                  <p className={`text-[9px] mt-1.5 italic ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Owned by {agent.name}{agent.role ? ` · ${agent.role}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Read-only banner */}
      <div className={`p-3 rounded-lg border ${isDark ? 'bg-amber-500/8 border-amber-500/25' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-start gap-2">
          <CheckCircle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
          <div>
            <p className={`text-[10px] font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Read-only reference</p>
            <p className={`text-[10px] mt-0.5 leading-relaxed ${t.textPrimary}`}>
              You don't configure playbooks here. Stage behavior is governed by Activity &amp; Governance policy rules (spend caps, vendor trust floors). To change which playbook fires for a request, set urgency at request time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
