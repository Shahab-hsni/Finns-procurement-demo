import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Bot, Star } from 'lucide-react';
import { PageSnapshot, SnapshotKey } from './snapshots';

export interface PageNodePayload {
  pageId: string;
  label: string;
  oneLine: string;
  group: 'core' | 'agents';
  isDark: boolean;
  isFocused: boolean;
  stateCount: number;
  actionCount: number;
  modalCount: number;
}

/**
 * Custom node for the flowchart canvas.
 * - Header: group badge + page name
 * - Body: mini schematic snapshot
 * - Footer: state / action / modal counts
 */
function PageNodeImpl({ data }: NodeProps) {
  const d = data as unknown as PageNodePayload;
  const { pageId, label, oneLine, group, isDark, isFocused, stateCount, actionCount, modalCount } = d;

  const groupColor =
    group === 'core'
      ? { bg: isDark ? 'bg-[#87986a]/20' : 'bg-[#f4f6f0]', text: isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]' }
      : { bg: isDark ? 'bg-amber-500/15' : 'bg-amber-50', text: isDark ? 'text-amber-300' : 'text-amber-700' };

  const surface = isDark ? 'bg-[#1f1f1f]' : 'bg-white';
  const border = isFocused
    ? 'border-[#87986a] shadow-[0_0_0_3px_rgba(135,152,106,0.25)]'
    : isDark
    ? 'border-gray-800'
    : 'border-[#e5e5e0]';
  const textHead = isDark ? 'text-white' : 'text-[#0a0a0a]';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-500';
  const textDim = isDark ? 'text-gray-600' : 'text-gray-400';

  return (
    <div
      className={`w-[240px] rounded-xl border ${border} ${surface} shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow duration-200 cursor-pointer overflow-hidden`}
    >
      {/*
        Connection handles — every side has BOTH a source and a target so
        ReactFlow can pick the shortest path. Each pair shares a position;
        ReactFlow uses whichever role the edge needs. Unique ids keep them
        distinct so smoothstep routing fans edges out across sides
        instead of stacking them all into one corridor.
      */}
      <Handle id="t-top"    type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle id="s-top"    type="source" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle id="t-left"   type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle id="s-left"   type="source" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle id="t-right"  type="target" position={Position.Right}  style={{ opacity: 0 }} />
      <Handle id="s-right"  type="source" position={Position.Right}  style={{ opacity: 0 }} />
      <Handle id="t-bottom" type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle id="s-bottom" type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${groupColor.bg} ${groupColor.text}`}>
            {group === 'core' ? <Star className="h-2 w-2" /> : <Bot className="h-2 w-2" />}
            {group === 'core' ? 'Core' : 'Agents'}
          </span>
          <span className={`text-[9px] font-mono ${textDim}`}>{pageId}</span>
        </div>
      </div>
      <div className="px-3">
        <h3 className={`text-sm font-bold leading-tight ${textHead}`}>{label}</h3>
        <p className={`text-[10px] mt-0.5 line-clamp-2 leading-snug ${textMuted}`}>{oneLine}</p>
      </div>

      {/* Snapshot */}
      <div className="px-3 mt-2">
        <PageSnapshot pageId={pageId as SnapshotKey} isDark={isDark} />
      </div>

      {/* Footer counts */}
      <div className={`mt-2.5 px-3 py-1.5 flex items-center gap-3 border-t ${isDark ? 'border-gray-800 bg-[#181818]' : 'border-[#e5e5e0] bg-[#fafaf7]'}`}>
        <FooterStat label="states"  value={stateCount}  textMuted={textMuted} textHead={textHead} />
        <FooterStat label="actions" value={actionCount} textMuted={textMuted} textHead={textHead} />
        <FooterStat label="modals"  value={modalCount}  textMuted={textMuted} textHead={textHead} />
      </div>
    </div>
  );
}

function FooterStat({ label, value, textMuted, textHead }: { label: string; value: number; textMuted: string; textHead: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`text-[10px] font-bold ${textHead}`}>{value}</span>
      <span className={`text-[9px] ${textMuted}`}>{label}</span>
    </div>
  );
}

export const PageNode = memo(PageNodeImpl);
