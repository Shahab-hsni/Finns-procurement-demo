import { X, ArrowRight, Layers, MousePointerClick, PanelTop, Bot, Star, ExternalLink } from 'lucide-react';
import { PageNodeData, FlowEdgeData, PAGES } from './data';
import { PageSnapshot, SnapshotKey } from './snapshots';

interface DetailPanelProps {
  page: PageNodeData;
  edges: FlowEdgeData[];
  isDark: boolean;
  onClose: () => void;
  onJumpToPage: (pageId: string) => void;
  onOpenLive?: (route: string) => void;
}

export function DetailPanel({ page, edges, isDark, onClose, onJumpToPage, onOpenLive }: DetailPanelProps) {
  const outgoing = edges.filter((e) => e.source === page.id);
  const incoming = edges.filter((e) => e.target === page.id);

  const t = {
    surface:    isDark ? 'bg-[#1a1a1a]'    : 'bg-white',
    surfaceAlt: isDark ? 'bg-[#222]'       : 'bg-[#fafaf7]',
    border:     isDark ? 'border-gray-800' : 'border-[#e5e5e0]',
    textHead:   isDark ? 'text-white'      : 'text-[#0a0a0a]',
    textBody:   isDark ? 'text-gray-300'   : 'text-gray-700',
    textMuted:  isDark ? 'text-gray-500'   : 'text-gray-500',
    textDim:    isDark ? 'text-gray-600'   : 'text-gray-400',
    sageBg:     isDark ? 'bg-[#87986a]/20' : 'bg-[#f4f6f0]',
    sageText:   isDark ? 'text-[#a3b085]'  : 'text-[#6b7a54]',
    sageBorder: isDark ? 'border-[#87986a]/40' : 'border-[#87986a]/40',
  };

  const groupColor =
    page.group === 'core'
      ? { bg: t.sageBg, text: t.sageText }
      : { bg: isDark ? 'bg-amber-500/15' : 'bg-amber-50', text: isDark ? 'text-amber-300' : 'text-amber-700' };

  return (
    <aside
      className={`absolute top-0 right-0 h-full w-[440px] border-l ${t.border} ${t.surface} shadow-2xl z-30 flex flex-col`}
    >
      {/* Header */}
      <div className={`shrink-0 px-5 py-4 border-b ${t.border}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${groupColor.bg} ${groupColor.text}`}>
                {page.group === 'core' ? <Star className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                {page.group === 'core' ? 'Core' : 'Agents'}
              </span>
              <span className={`text-[10px] font-mono ${t.textDim}`}>{page.route}</span>
            </div>
            <h2 className={`text-lg font-bold ${t.textHead}`}>{page.label}</h2>
            <p className={`text-xs mt-1 ${t.textMuted}`}>{page.oneLine}</p>
          </div>
          <button
            onClick={onClose}
            className={`shrink-0 p-1.5 rounded-md transition-colors ${
              isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-[#f4f6f0] text-gray-500'
            }`}
            title="Close detail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Larger snapshot */}
        <div>
          <SectionLabel icon={PanelTop} label="Snapshot" t={t} />
          <PageSnapshot pageId={page.id as SnapshotKey} isDark={isDark} large />
        </div>

        {/* Purpose */}
        <div>
          <SectionLabel icon={PanelTop} label="Purpose" t={t} />
          <p className={`text-sm leading-relaxed ${t.textBody}`}>{page.purpose}</p>
        </div>

        {/* States */}
        {page.states.length > 0 && (
          <div>
            <SectionLabel icon={Layers} label={`States · ${page.states.length}`} t={t} />
            <ul className="space-y-1.5">
              {page.states.map((s) => (
                <li key={s.id} className={`p-2.5 rounded-lg border ${t.border} ${t.surfaceAlt}`}>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-[11px] font-bold ${t.textHead}`}>{s.label}</span>
                    <span className={`text-[9px] font-mono ${t.textDim}`}>{s.id}</span>
                  </div>
                  <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>{s.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {page.actions.length > 0 && (
          <div>
            <SectionLabel icon={MousePointerClick} label={`Actions · ${page.actions.length}`} t={t} />
            <ul className="space-y-1.5">
              {page.actions.map((a, i) => {
                const target = a.navigatesTo ? PAGES.find((p) => p.id === a.navigatesTo) : undefined;
                return (
                  <li key={i} className={`p-2.5 rounded-lg border ${t.border} ${t.surfaceAlt}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-semibold ${t.textHead}`}>{a.label}</div>
                        <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>{a.description}</p>
                      </div>
                      {target && (
                        <button
                          onClick={() => onJumpToPage(target.id)}
                          title={`Jump to ${target.label}`}
                          className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-semibold ${t.sageBg} ${t.sageText} hover:brightness-95 transition`}
                        >
                          <ArrowRight className="h-2.5 w-2.5" /> {target.label}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Modals */}
        {page.modals.length > 0 && (
          <div>
            <SectionLabel icon={PanelTop} label={`Modals · ${page.modals.length}`} t={t} />
            <ul className="space-y-1.5">
              {page.modals.map((m) => (
                <li key={m.id} className={`p-2.5 rounded-lg border ${t.border} ${t.surfaceAlt}`}>
                  <div className={`text-[11px] font-semibold ${t.textHead}`}>{m.label}</div>
                  <p className={`text-[11px] mt-0.5 ${t.textMuted}`}>{m.description}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Outgoing edges */}
        <div>
          <SectionLabel icon={ArrowRight} label={`Goes to · ${outgoing.length}`} t={t} />
          {outgoing.length === 0 ? (
            <p className={`text-[11px] ${t.textDim}`}>No outgoing routes.</p>
          ) : (
            <ul className="space-y-1">
              {outgoing.map((e) => {
                const target = PAGES.find((p) => p.id === e.target);
                if (!target) return null;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => onJumpToPage(target.id)}
                      className={`w-full text-left p-2 rounded-lg border ${t.border} hover:${t.sageBg} hover:${t.sageBorder} transition-colors flex items-center gap-2`}
                    >
                      <EdgeKindDot kind={e.kind} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-semibold ${t.textHead}`}>{target.label}</div>
                        {(e.detail || e.label) && (
                          <div className={`text-[10px] mt-0.5 leading-snug ${t.textMuted}`}>
                            {e.detail ?? e.label}
                          </div>
                        )}
                      </div>
                      <ArrowRight className={`h-3 w-3 ${t.textDim}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Incoming edges */}
        <div>
          <SectionLabel icon={ArrowRight} label={`Comes from · ${incoming.length}`} t={t} />
          {incoming.length === 0 ? (
            <p className={`text-[11px] ${t.textDim}`}>No incoming routes.</p>
          ) : (
            <ul className="space-y-1">
              {incoming.map((e) => {
                const source = PAGES.find((p) => p.id === e.source);
                if (!source) return null;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => onJumpToPage(source.id)}
                      className={`w-full text-left p-2 rounded-lg border ${t.border} hover:${t.sageBg} hover:${t.sageBorder} transition-colors flex items-center gap-2`}
                    >
                      <ArrowRight className={`h-3 w-3 ${t.textDim} rotate-180`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-semibold ${t.textHead}`}>{source.label}</div>
                        {(e.detail || e.label) && (
                          <div className={`text-[10px] mt-0.5 leading-snug ${t.textMuted}`}>
                            {e.detail ?? e.label}
                          </div>
                        )}
                      </div>
                      <EdgeKindDot kind={e.kind} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Footer — open the live page */}
      {onOpenLive && (
        <div className={`shrink-0 px-5 py-3 border-t ${t.border} ${t.surfaceAlt}`}>
          <button
            onClick={() => onOpenLive(page.route)}
            className={`w-full inline-flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-semibold bg-[#87986a] hover:bg-[#6b7a54] text-white transition-colors`}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open the live {page.label} page
          </button>
        </div>
      )}
    </aside>
  );
}

function SectionLabel({ icon: Icon, label, t }: { icon: React.ComponentType<{ className?: string }>; label: string; t: Record<string, string> }) {
  return (
    <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-wider ${t.textDim}`}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

function EdgeKindDot({ kind }: { kind: 'nav' | 'data' | 'event' }) {
  const color =
    kind === 'nav'   ? 'bg-[#87986a]' :
    kind === 'data'  ? 'bg-blue-500' :
                       'bg-amber-500';
  const title =
    kind === 'nav'   ? 'Navigation — user clicks to traverse' :
    kind === 'data'  ? 'Data flow — system pushes data' :
                       'Event — system fires a transition';
  return <div title={title} className={`w-2 h-2 rounded-full ${color} shrink-0`} />;
}
