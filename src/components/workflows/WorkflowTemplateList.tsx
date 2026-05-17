import { useState } from 'react';
import { ScrollText, Zap, FileText, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { InfoTooltip } from '../ui/InfoTooltip';
import { finnsPlaybooks } from '../../lib/mockData';
import { theme } from '../../lib/theme';
import type { PlaybookId, Playbook } from '../../lib/types';

interface WorkflowTemplateListProps {
  isDark: boolean;
  selectedWorkflow: PlaybookId;
  onSelectWorkflow: (id: PlaybookId) => void;
}

const PLAYBOOK_ICON: Record<PlaybookId, typeof Zap> = {
  'WF-STD': ScrollText,
  'WF-RSH': Zap,
  'WF-REC': FileText,
};

const PLAYBOOK_BADGE: Record<PlaybookId, { label: string; light: string; dark: string }> = {
  'WF-STD': { label: 'Default',  light: 'bg-[#f4f6f0] text-[#6b7a54]', dark: 'bg-[#87986a]/15 text-[#a3b085]' },
  'WF-RSH': { label: 'Urgent',   light: 'bg-amber-50 text-amber-700',  dark: 'bg-amber-500/15 text-amber-300' },
  'WF-REC': { label: 'Schedule', light: 'bg-blue-50 text-blue-700',    dark: 'bg-blue-500/15 text-blue-300' },
};

const fmtIdrShort = (n: number) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  return `Rp ${n.toLocaleString('id-ID')}`;
};

export function WorkflowTemplateList({ isDark, selectedWorkflow, onSelectWorkflow }: WorkflowTemplateListProps) {
  const t = theme(isDark);
  const [search, setSearch] = useState('');

  const visible: Playbook[] = finnsPlaybooks.filter(p =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div id="wf-left-panel" className={`flex flex-col h-full ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${t.border}`}>
        <div className="flex items-center gap-2">
          <h2 className={`text-sm font-semibold flex items-center gap-1.5 ${t.textPrimary}`}>
            Workflows
            <InfoTooltip
              text="Read-only reference for the three playbooks Finn's runs every order through. Pick a card to see the 5-stage flow path."
              isDark={isDark}
              side="bottom"
            />
          </h2>
        </div>
        <p className={`text-[10px] mt-0.5 ${t.textMuted}`}>3 playbooks · Standard · Rush · Recurring</p>
      </div>

      {/* Search */}
      <div className={`px-4 py-3 border-b ${t.border}`}>
        <div className="relative">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${t.textMuted}`} />
          <Input
            placeholder="Search playbooks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-8 h-8 text-xs ${isDark ? 'bg-[#2a2a2a] border-gray-700 text-white placeholder:text-gray-500' : 'bg-white border-gray-200'}`}
          />
        </div>
      </div>

      {/* Playbook cards */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2">
        <h3 className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${t.sectionLabel}`}>Playbooks</h3>
        {visible.length === 0 ? (
          <p className={`text-[10px] py-3 ${t.textMuted}`}>No playbooks match "{search}".</p>
        ) : (
          visible.map(p => {
            const Icon = PLAYBOOK_ICON[p.id];
            const badge = PLAYBOOK_BADGE[p.id];
            const active = selectedWorkflow === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectWorkflow(p.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  active
                    ? isDark ? 'bg-[#87986a]/15 border-[#87986a]/40' : 'bg-[#f4f6f0] border-[#87986a]/40'
                    : isDark ? 'bg-[#2a2a2a] border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
                }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`h-3.5 w-3.5 ${active ? (isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]') : t.textMuted}`} />
                  <span className={`text-xs font-semibold ${t.textPrimary}`}>{p.id} · {p.name}</span>
                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isDark ? badge.dark : badge.light}`}>
                    {badge.label}
                  </span>
                </div>
                <p className={`text-[10px] leading-relaxed ${t.textMuted}`}>{p.description}</p>
                {/* 3-stat strip */}
                <div className={`flex items-center justify-between mt-2 pt-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <div>
                    <p className={`text-[8px] uppercase ${t.textMuted}`}>Active</p>
                    <p className={`text-[10px] font-bold ${t.textPrimary}`}>{p.activeOrderCount}</p>
                  </div>
                  <div>
                    <p className={`text-[8px] uppercase ${t.textMuted}`}>Avg</p>
                    <p className={`text-[10px] font-bold ${t.textPrimary}`}>{p.avgDurationHours}h</p>
                  </div>
                  <div>
                    <p className={`text-[8px] uppercase ${t.textMuted}`}>Savings</p>
                    <p className={`text-[10px] font-bold ${isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]'}`}>{p.savingsVsBaseline}%</p>
                  </div>
                </div>
              </button>
            );
          })
        )}

        {/* Reference note */}
        <div className={`mt-4 p-2.5 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-[9px] leading-relaxed italic ${t.textMuted}`}>
            Reference only. Playbooks aren't tuned here — selection happens automatically at request time based on urgency / recurring flag. To change behavior, update the policy rules in Activity & Governance.
          </p>
        </div>
      </div>
    </div>
  );
}
