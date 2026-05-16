import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  type Node, type Edge, type EdgeMarker, MarkerType, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { PAGES, EDGES, PageNodeData } from './flowchart/data';
import { PageNode, PageNodePayload } from './flowchart/PageNode';
import { DetailPanel } from './flowchart/DetailPanel';
import { Sparkles, BookOpen, Filter, Search, Compass } from 'lucide-react';

interface FlowChartPageProps {
  theme: 'dark' | 'light';
  /** Open the scrollytelling tour. */
  onOpenGuidedTour?: () => void;
  /** Navigate to a real page (matches Page type in App.tsx). */
  onNavigateLive?: (pageId: string) => void;
}

export function FlowChartPage({ theme, onOpenGuidedTour, onNavigateLive }: FlowChartPageProps) {
  return (
    <ReactFlowProvider>
      <FlowChartInner theme={theme} onOpenGuidedTour={onOpenGuidedTour} onNavigateLive={onNavigateLive} />
    </ReactFlowProvider>
  );
}

function FlowChartInner({ theme, onOpenGuidedTour, onNavigateLive }: FlowChartPageProps) {
  const isDark = theme === 'dark';
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<'all' | 'core' | 'agents'>('all');
  const [search, setSearch] = useState('');
  const { fitView, setCenter } = useReactFlow();

  const focusedPage = useMemo(
    () => (focusedId ? PAGES.find((p) => p.id === focusedId) ?? null : null),
    [focusedId]
  );

  // Build nodes + edges
  const filteredPages = useMemo(() => {
    return PAGES.filter((p) => {
      if (groupFilter !== 'all' && p.group !== groupFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.label.toLowerCase().includes(q) || p.oneLine.toLowerCase().includes(q) || p.id.includes(q);
      }
      return true;
    });
  }, [groupFilter, search]);

  const visiblePageIds = useMemo(() => new Set(filteredPages.map((p) => p.id)), [filteredPages]);

  const nodes: Node<PageNodePayload>[] = useMemo(
    () =>
      PAGES.map((p) => ({
        id: p.id,
        type: 'page',
        position: p.pos,
        data: {
          pageId: p.id,
          label: p.label,
          oneLine: p.oneLine,
          group: p.group,
          isDark,
          isFocused: focusedId === p.id,
          stateCount: p.states.length,
          actionCount: p.actions.length,
          modalCount: p.modals.length,
        },
        hidden: !visiblePageIds.has(p.id),
        draggable: true,
        selectable: true,
      })),
    [isDark, focusedId, visiblePageIds]
  );

  const edges: Edge[] = useMemo(
    () =>
      EDGES.map((e) => {
        const color =
          e.kind === 'nav'   ? '#87986a' :
          e.kind === 'data'  ? '#3b82f6' :
                               '#f59e0b';
        const isLit = focusedId === e.source || focusedId === e.target;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          type: 'smoothstep',
          animated: isLit,
          // smoothstep with a generous corner radius reads more naturally
          // when edges fan in/out of the busier hubs (Orders, Governance).
          pathOptions: { borderRadius: 24, offset: 24 },
          labelStyle: {
            fontSize: 11,
            fontWeight: 600,
            fill: isLit ? color : isDark ? '#cbd5e1' : '#374151',
          },
          // Solid label background with a tinted border so labels stay
          // legible when edges cross or run parallel.
          labelBgStyle: {
            fill: isDark ? '#1f1f1f' : '#ffffff',
            stroke: isLit ? color : isDark ? '#374151' : '#e5e5e0',
            strokeWidth: 1,
          },
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 6,
          style: {
            stroke: color,
            strokeWidth: isLit ? 2.5 : 1.5,
            opacity: visiblePageIds.has(e.source) && visiblePageIds.has(e.target) ? 1 : 0.15,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 22,
            height: 22,
          } as EdgeMarker,
        };
      }),
    [isDark, focusedId, visiblePageIds]
  );

  // Node click → open detail panel + recenter
  const handleNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      setFocusedId(node.id);
      const page = PAGES.find((p) => p.id === node.id);
      if (page) {
        setCenter(page.pos.x + 120, page.pos.y + 120, { zoom: 1, duration: 400 });
      }
    },
    [setCenter]
  );

  const handlePaneClick = useCallback(() => {
    setFocusedId(null);
  }, []);

  const handleJumpToPage = useCallback(
    (pageId: string) => {
      const page = PAGES.find((p) => p.id === pageId);
      if (!page) return;
      setFocusedId(pageId);
      setCenter(page.pos.x + 120, page.pos.y + 120, { zoom: 1, duration: 500 });
    },
    [setCenter]
  );

  // Initial fitView once
  useEffect(() => {
    const t = setTimeout(() => fitView({ duration: 600, padding: 0.15 }), 50);
    return () => clearTimeout(t);
  }, [fitView]);

  const nodeTypes = useMemo(() => ({ page: PageNode }), []);

  // Theme tokens
  const t = {
    canvas:    isDark ? 'bg-[#141414]'   : 'bg-[#fafaf7]',
    surface:   isDark ? 'bg-[#1a1a1a]'   : 'bg-white',
    border:    isDark ? 'border-gray-800': 'border-[#e5e5e0]',
    textHead:  isDark ? 'text-white'     : 'text-[#0a0a0a]',
    textBody:  isDark ? 'text-gray-300'  : 'text-gray-700',
    textMuted: isDark ? 'text-gray-500'  : 'text-gray-500',
    textDim:   isDark ? 'text-gray-600'  : 'text-gray-400',
    sageBg:    isDark ? 'bg-[#87986a]/20': 'bg-[#f4f6f0]',
    sageText:  isDark ? 'text-[#a3b085]' : 'text-[#6b7a54]',
  };

  return (
    <div className={`relative w-full h-full ${t.canvas} overflow-hidden`}>
      {/* ─── Toolbar ────────────────────────────────────────── */}
      <div className={`absolute top-4 left-4 right-4 z-20 flex items-center gap-3`}>
        {/* Title pill */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${t.border} ${t.surface} shadow-sm`}>
          <Compass className={`h-4 w-4 ${t.sageText}`} />
          <span className={`text-sm font-bold ${t.textHead}`}>Buyamia · System Map</span>
          <span className={`text-[10px] ${t.textMuted} ml-1`}>{PAGES.length} pages · {EDGES.length} routes</span>
        </div>

        {/* Search */}
        <div className={`flex items-center gap-2 flex-1 max-w-md px-3 py-2 rounded-xl border ${t.border} ${t.surface} shadow-sm`}>
          <Search className={`h-3.5 w-3.5 ${t.textMuted}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages — orders, governance, vendor…"
            className={`flex-1 bg-transparent border-none outline-none text-xs ${t.textBody} placeholder:${t.textDim}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className={`text-[10px] ${t.textMuted} hover:${t.textBody}`}>clear</button>
          )}
        </div>

        {/* Group filter */}
        <div className={`flex items-center rounded-xl border ${t.border} ${t.surface} shadow-sm overflow-hidden`}>
          <Filter className={`h-3.5 w-3.5 ml-2 ${t.textMuted}`} />
          {(['all', 'core', 'agents'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`px-3 py-2 text-[11px] font-semibold capitalize transition-colors ${
                groupFilter === g
                  ? `${t.sageBg} ${t.sageText}`
                  : `${t.textMuted} hover:${t.textBody}`
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Guided tour CTA */}
        {onOpenGuidedTour && (
          <button
            onClick={onOpenGuidedTour}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-colors bg-[#87986a] hover:bg-[#6b7a54] text-white shadow-sm`}
          >
            <BookOpen className="h-3.5 w-3.5" /> Guided Tour
          </button>
        )}
      </div>

      {/* ─── Legend (bottom-left) ──────────────────────────── */}
      <div className={`absolute bottom-4 left-4 z-20 px-3 py-2.5 rounded-xl border ${t.border} ${t.surface} shadow-sm`}>
        <div className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${t.textDim}`}>Edge legend</div>
        <div className="space-y-1">
          <LegendRow color="#87986a" label="Navigation — user click"  t={t} />
          <LegendRow color="#3b82f6" label="Data flow — system push"  t={t} />
          <LegendRow color="#f59e0b" label="Event — system fires"     t={t} />
        </div>
      </div>

      {/* Sparkle hint */}
      <div className={`absolute bottom-4 right-4 z-20 flex items-center gap-1.5 text-[10px] ${t.textMuted}`}>
        <Sparkles className="h-3 w-3" />
        Click any node for details · drag to reposition · scroll to zoom
      </div>

      {/* ─── React Flow canvas ─────────────────────────────── */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background
          gap={20}
          size={1}
          color={isDark ? '#262626' : '#e5e5e0'}
        />
        <Controls
          showInteractive={false}
          className={isDark ? '[&>button]:!bg-[#1a1a1a] [&>button]:!border-gray-800 [&>button]:!text-gray-400 [&>button:hover]:!bg-gray-800' : ''}
        />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const page = PAGES.find((p) => p.id === node.id);
            if (!page) return '#888';
            return page.group === 'core' ? '#87986a' : '#f59e0b';
          }}
          maskColor={isDark ? 'rgba(20,20,20,0.7)' : 'rgba(245,245,240,0.7)'}
          style={{
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            border: `1px solid ${isDark ? '#262626' : '#e5e5e0'}`,
            borderRadius: 8,
          }}
        />
      </ReactFlow>

      {/* ─── Detail panel ─────────────────────────────────── */}
      {focusedPage && (
        <DetailPanel
          page={focusedPage as PageNodeData}
          edges={EDGES}
          isDark={isDark}
          onClose={() => setFocusedId(null)}
          onJumpToPage={handleJumpToPage}
          onOpenLive={onNavigateLive ? () => onNavigateLive(focusedPage.id) : undefined}
        />
      )}
    </div>
  );
}

function LegendRow({ color, label, t }: { color: string; label: string; t: Record<string, string> }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: color }} />
      <span className={`text-[10px] ${t.textBody}`}>{label}</span>
    </div>
  );
}
