/**
 * Mini-snapshot mockups for each page in the platform.
 *
 * Each snapshot is a ~200×96 schematic wireframe rendered with the project's
 * sage/gray tokens. Used inside the node on the canvas and (at a larger scale)
 * inside the DetailPanel.
 *
 * The mockups are deliberately abstract — they communicate the page's
 * *shape* and *information density*, not its exact pixel layout.
 */
import { Fragment, ReactNode } from 'react';
import {
  ClipboardList, Truck, ShieldCheck, Bot, Radio, MapPin, DollarSign,
  Users, Activity, FileText, Workflow, Globe, Sparkles, PackageCheck,
  Wrench, BarChart2, AlertTriangle,
} from 'lucide-react';

type Tone = 'sage' | 'amber' | 'blue' | 'red' | 'green' | 'gray';

interface SnapProps {
  isDark: boolean;
  /** Render bigger inside the detail panel. */
  large?: boolean;
}

// ── Token helpers ─────────────────────────────────────────
function tones(isDark: boolean) {
  return {
    canvas:   isDark ? 'bg-[#141414]'   : 'bg-[#fafaf7]',
    panel:    isDark ? 'bg-[#2a2a2a]'   : 'bg-white',
    border:   isDark ? 'border-gray-800': 'border-[#dddddd]',
    accent:   isDark ? 'bg-[#4bbcbe]/25': 'bg-[#eafafa]',
    accentB:  isDark ? 'border-[#4bbcbe]/40' : 'border-[#4bbcbe]/40',
    sage:     isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]',
    muted:    isDark ? 'text-gray-500'  : 'text-gray-400',
    dim:      isDark ? 'bg-gray-700'    : 'bg-[#dddddd]',
  };
}

function toneClass(tone: Tone, isDark: boolean) {
  const map: Record<Tone, string> = {
    sage:  isDark ? 'bg-[#4bbcbe]/60' : 'bg-[#4bbcbe]',
    amber: 'bg-amber-500',
    blue:  'bg-blue-500',
    red:   'bg-red-500',
    green: 'bg-green-500',
    gray:  isDark ? 'bg-gray-700' : 'bg-[#dddddd]',
  };
  return map[tone];
}

// ── Base 3-panel scaffold (most pages reuse this) ─────────
function ThreePanelScaffold({
  isDark, large, left, center, right,
}: {
  isDark: boolean;
  large?: boolean;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  const t = tones(isDark);
  const h = large ? 'h-[280px]' : 'h-[96px]';
  const cols = large
    ? 'grid-cols-[64px_1fr_64px]'
    : 'grid-cols-[28px_1fr_28px]';
  return (
    <div className={`${h} grid ${cols} gap-[3px] p-[3px] rounded-md border ${t.border} ${t.canvas} overflow-hidden`}>
      <div className={`${t.panel} rounded ${t.border} border`}>{left}</div>
      <div className={`${t.panel} rounded ${t.border} border`}>{center}</div>
      <div className={`${t.panel} rounded ${t.border} border`}>{right}</div>
    </div>
  );
}

// ── Dot row (compact list rep) ────────────────────────────
function DotRow({
  count = 4, accentIdx = -1, isDark, dense,
}: { count?: number; accentIdx?: number; isDark: boolean; dense?: boolean }) {
  const t = tones(isDark);
  const gap = dense ? 'gap-[2px]' : 'gap-[3px]';
  const h = dense ? 'h-[3px]' : 'h-[4px]';
  return (
    <div className={`flex flex-col ${gap}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${h} rounded ${
            i === accentIdx ? 'bg-[#4bbcbe]' : t.dim
          }`}
          style={{ width: `${60 + ((i * 13) % 35)}%` }}
        />
      ))}
    </div>
  );
}

function Pill({ tone = 'gray', isDark, w = 'w-[60%]' }: { tone?: Tone; isDark: boolean; w?: string }) {
  return <div className={`h-[5px] rounded-full ${toneClass(tone, isDark)} ${w}`} />;
}

// ════════════════════════════════════════════════════════════
// PAGE-SPECIFIC SNAPSHOTS
// ════════════════════════════════════════════════════════════

export function OverviewSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  const h = large ? 'h-[280px]' : 'h-[96px]';
  return (
    <div className={`${h} p-1.5 rounded-md border ${t.border} ${t.panel} overflow-hidden`}>
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-[14px] rounded-[3px] ${t.accent} border ${t.accentB}`} />
        ))}
      </div>
      {/* Triage queue */}
      <div className="space-y-[3px]">
        {[
          { tone: 'amber' as Tone, w: 'w-[92%]' },
          { tone: 'red' as Tone,   w: 'w-[80%]' },
          { tone: 'blue' as Tone,  w: 'w-[70%]' },
          { tone: 'gray' as Tone,  w: 'w-[60%]' },
          { tone: 'gray' as Tone,  w: 'w-[55%]' },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-1 h-[6px] rounded ${toneClass(row.tone, isDark)}`} />
            <div className={`h-[4px] rounded ${t.dim} ${row.w}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrdersSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  return (
    <ThreePanelScaffold
      isDark={isDark}
      large={large}
      left={
        <div className="p-1 space-y-1">
          <div className={`h-[4px] rounded ${t.dim}`} style={{ width: '70%' }} />
          <div className={`p-[2px] rounded ${t.accent} border ${t.accentB}`}>
            <div className="bg-amber-500 rounded h-[3px] w-[60%]" />
            <div className={`h-[3px] rounded ${t.dim} w-[80%] mt-[2px]`} />
          </div>
          {[1, 2].map((i) => (
            <div key={i} className={`p-[2px] rounded border ${t.border}`}>
              <div className={`h-[3px] rounded ${t.dim} w-[70%]`} />
              <div className={`h-[3px] rounded ${t.dim} w-[50%] mt-[2px]`} />
            </div>
          ))}
        </div>
      }
      center={
        <div className="p-1.5 flex gap-1 h-full">
          {/* Detail card with primary CTA */}
          <div className="flex-1 space-y-[3px]">
            <ClipboardList className={`h-2.5 w-2.5 ${t.sage}`} />
            <div className={`h-[5px] rounded ${t.dim} w-[60%]`} />
            <div className="space-y-[2px]">
              <div className={`h-[3px] rounded ${t.dim} w-[90%]`} />
              <div className={`h-[3px] rounded ${t.dim} w-[80%]`} />
            </div>
            <div className="bg-[#4bbcbe] rounded h-[8px] mt-1" />
          </div>
          {/* Mini DAG column */}
          <div className={`w-[24%] flex flex-col gap-[3px] border-l ${t.border} pl-1`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-[2px]">
                <div className={`w-[4px] h-[4px] rounded-full ${i < 2 ? 'bg-[#4bbcbe]' : i === 2 ? 'bg-amber-500' : t.dim}`} />
                <div className={`h-[2px] rounded ${t.dim} w-full`} />
              </div>
            ))}
          </div>
        </div>
      }
      right={
        <div className="p-1 space-y-1">
          <Sparkles className={`h-2.5 w-2.5 ${t.sage}`} />
          <div className={`h-[3px] rounded ${t.dim} w-[80%]`} />
          <div className={`h-[3px] rounded ${t.dim} w-[60%]`} />
          <div className={`mt-2 h-[8px] rounded ${t.accent} border ${t.accentB}`} />
        </div>
      }
    />
  );
}

export function InventorySnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  return (
    <ThreePanelScaffold
      isDark={isDark}
      large={large}
      left={
        <div className="p-1 space-y-1">
          <PackageCheck className={`h-2.5 w-2.5 ${t.sage}`} />
          {/* Stock bars */}
          {[
            { tone: 'red' as Tone,   w: '20%' },
            { tone: 'amber' as Tone, w: '40%' },
            { tone: 'green' as Tone, w: '75%' },
            { tone: 'green' as Tone, w: '85%' },
          ].map((row, i) => (
            <div key={i} className="space-y-[1px]">
              <div className={`h-[2px] rounded ${t.dim}`} style={{ width: '70%' }} />
              <div className={`h-[3px] rounded-full ${toneClass(row.tone, isDark)}`} style={{ width: row.w }} />
            </div>
          ))}
        </div>
      }
      center={
        <div className="p-1.5 space-y-1.5">
          <div className={`h-[5px] rounded ${t.dim} w-[40%]`} />
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-[16px] rounded border ${t.border}`} />
            ))}
          </div>
          <DotRow isDark={isDark} count={3} accentIdx={1} dense />
        </div>
      }
      right={
        <div className="p-1 space-y-1">
          <Sparkles className={`h-2.5 w-2.5 ${t.sage}`} />
          <DotRow isDark={isDark} count={3} dense />
        </div>
      }
    />
  );
}

export function SpendingSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  return (
    <ThreePanelScaffold
      isDark={isDark}
      large={large}
      left={
        <div className="p-1 space-y-1">
          <DollarSign className={`h-2.5 w-2.5 ${t.sage}`} />
          <DotRow isDark={isDark} count={4} accentIdx={1} dense />
        </div>
      }
      center={
        <div className="p-1.5">
          <div className="grid grid-cols-2 gap-1 mb-1">
            <div className={`h-[20px] rounded ${t.accent} border ${t.accentB}`} />
            <div className={`h-[20px] rounded border ${t.border}`} />
          </div>
          {/* Bar chart proxy */}
          <div className="flex items-end gap-[3px] h-[20px]">
            {[40, 70, 30, 90, 55, 75, 35].map((h, i) => (
              <div key={i} className={`flex-1 rounded-t ${i === 3 ? 'bg-[#4bbcbe]' : t.dim}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      }
      right={
        <div className="p-1 space-y-1">
          <Sparkles className={`h-2.5 w-2.5 ${t.sage}`} />
          <DotRow isDark={isDark} count={3} dense />
        </div>
      }
    />
  );
}

export function SuppliersSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  return (
    <ThreePanelScaffold
      isDark={isDark}
      large={large}
      left={
        <div className="p-1 space-y-[3px]">
          <Users className={`h-2.5 w-2.5 ${t.sage}`} />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`p-[2px] rounded border ${t.border} flex items-center gap-1`}>
              <div className={`w-[5px] h-[5px] rounded-full ${i === 1 ? 'bg-[#4bbcbe]' : i === 2 ? 'bg-amber-500' : t.dim}`} />
              <div className={`h-[2px] rounded ${t.dim} flex-1`} />
            </div>
          ))}
        </div>
      }
      center={
        <div className="p-1.5">
          {/* Storefront banner */}
          <div className={`h-[18px] rounded ${t.accent} border ${t.accentB} mb-1.5`} />
          {/* Compare matrix */}
          <div className="grid grid-cols-2 gap-1">
            <div className={`h-[28px] rounded border ${t.border} p-[2px]`}>
              <div className={`h-[2px] rounded ${t.dim} w-[60%] mb-[2px]`} />
              <div className={`h-[2px] rounded bg-[#4bbcbe] w-[80%]`} />
            </div>
            <div className={`h-[28px] rounded border ${t.border} p-[2px]`}>
              <div className={`h-[2px] rounded ${t.dim} w-[50%] mb-[2px]`} />
              <div className={`h-[2px] rounded bg-amber-500 w-[60%]`} />
            </div>
          </div>
        </div>
      }
      right={
        <div className="p-1 space-y-1">
          <ShieldCheck className={`h-2.5 w-2.5 ${t.sage}`} />
          <DotRow isDark={isDark} count={3} dense />
        </div>
      }
    />
  );
}

export function AIActivitySnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  const h = large ? 'h-[280px]' : 'h-[96px]';
  return (
    <div className={`${h} p-1.5 rounded-md border ${t.border} ${t.panel} overflow-hidden`}>
      <div className="flex items-center gap-1 mb-1">
        <Activity className={`h-2.5 w-2.5 ${t.sage}`} />
        <div className={`h-[3px] rounded ${t.dim} w-[40%]`} />
      </div>
      {/* Timeline rows */}
      <div className="space-y-[3px]">
        {[
          { tone: 'sage' as Tone,  w: '85%' },
          { tone: 'sage' as Tone,  w: '72%' },
          { tone: 'amber' as Tone, w: '68%' },
          { tone: 'sage' as Tone,  w: '90%' },
          { tone: 'sage' as Tone,  w: '50%' },
          { tone: 'blue' as Tone,  w: '76%' },
          { tone: 'sage' as Tone,  w: '60%' },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={`w-[4px] h-[4px] rounded-full ${toneClass(row.tone, isDark)}`} />
            <div className={`h-[3px] rounded ${t.dim}`} style={{ width: row.w }} />
            <div className={`h-[3px] rounded ${t.dim} ml-auto`} style={{ width: '15%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewRequestSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  const h = large ? 'h-[280px]' : 'h-[96px]';
  return (
    <div className={`${h} p-1.5 rounded-md border ${t.border} ${t.panel} overflow-hidden`}>
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className={`flex-1 h-[5px] rounded-full ${i <= 3 ? 'bg-[#4bbcbe]' : i === 4 ? 'bg-[#4bbcbe]/50' : t.dim}`} />
        ))}
      </div>
      {/* Body */}
      <div className="space-y-1">
        <FileText className={`h-2.5 w-2.5 ${t.sage}`} />
        <Pill tone="gray" isDark={isDark} w="w-[70%]" />
        <Pill tone="gray" isDark={isDark} w="w-[60%]" />
        <Pill tone="gray" isDark={isDark} w="w-[50%]" />
        <div className="flex justify-end mt-1.5">
          <div className="h-[10px] w-[40%] rounded bg-[#4bbcbe]" />
        </div>
      </div>
    </div>
  );
}

export function NerveCenterSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  return (
    <ThreePanelScaffold
      isDark={isDark}
      large={large}
      left={
        <div className="p-1 space-y-[2px]">
          {/* 5 cohorts */}
          {['SEN', 'REA', 'EXE', 'GOV', 'MET'].map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-[5px] h-[5px] rounded-full ${i < 3 ? 'bg-green-500' : i === 3 ? 'bg-amber-500' : 'bg-green-500'}`} />
              <div className={`h-[2px] rounded ${t.dim} flex-1`} />
            </div>
          ))}
        </div>
      }
      center={
        <div className="p-1.5">
          {/* DAG nodes — 2 rows of 6 */}
          <div className="grid grid-cols-6 gap-[2px] mb-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-[10px] rounded ${i === 2 ? 'bg-red-500' : 'bg-[#4bbcbe]'}`} />
            ))}
          </div>
          <div className="grid grid-cols-6 gap-[2px] mb-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-[10px] rounded ${i === 4 ? 'bg-amber-500' : 'bg-[#4bbcbe]'}`} />
            ))}
          </div>
          {/* Live metrics */}
          <div className="flex items-end gap-[2px] h-[16px]">
            {[30, 60, 45, 80, 50].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-[#4bbcbe]" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      }
      right={
        <div className="p-1 space-y-1">
          <Sparkles className={`h-2.5 w-2.5 ${t.sage}`} />
          {/* Autonomy slider proxy */}
          <div className={`h-[4px] rounded-full ${t.dim}`}>
            <div className="h-[4px] rounded-full bg-[#4bbcbe]" style={{ width: '66%' }} />
          </div>
          <div className={`h-[3px] rounded ${t.dim} w-[80%]`} />
        </div>
      }
    />
  );
}

export function WorkflowsSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  return (
    <ThreePanelScaffold
      isDark={isDark}
      large={large}
      left={
        <div className="p-1 space-y-1">
          <Workflow className={`h-2.5 w-2.5 ${t.sage}`} />
          {/* Template cards */}
          <div className="grid grid-cols-2 gap-[2px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-[10px] rounded border ${i === 0 ? `${t.accentB} ${t.accent}` : t.border}`} />
            ))}
          </div>
        </div>
      }
      center={
        <div className="p-1.5">
          {/* Linear workflow steps */}
          <div className="flex items-center gap-[3px] mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Fragment key={i}>
                <div className={`w-[10px] h-[10px] rounded-full ${i <= 1 ? 'bg-[#4bbcbe]' : i === 2 ? 'bg-amber-500' : t.dim}`} />
                {i < 4 && <div className={`flex-1 h-[2px] ${t.dim}`} />}
              </Fragment>
            ))}
          </div>
          {/* Demand signal sparkline */}
          <div className="flex items-end gap-[2px] h-[18px]">
            {[40, 55, 38, 70, 55, 85, 60, 90, 45].map((h, i) => (
              <div key={i} className={`flex-1 rounded-t ${t.dim}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      }
      right={
        <div className="p-1 space-y-1">
          <Radio className={`h-2.5 w-2.5 ${t.sage} animate-pulse`} />
          <Pill tone="green" isDark={isDark} w="w-[70%]" />
          <Pill tone="amber" isDark={isDark} w="w-[55%]" />
          <Pill tone="gray" isDark={isDark} w="w-[40%]" />
        </div>
      }
    />
  );
}

export function GlobalOpsSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  const h = large ? 'h-[280px]' : 'h-[96px]';
  return (
    <div className={`${h} relative rounded-md border ${t.border} ${t.panel} overflow-hidden`}>
      {/* World map proxy: regional dot field */}
      <div className="absolute inset-1.5">
        <Globe className={`h-2.5 w-2.5 absolute top-0 left-0 ${t.sage}`} />
        {/* Latitude lines */}
        <div className={`absolute top-[40%] left-0 right-0 h-px ${t.dim}`} />
        <div className={`absolute top-[65%] left-0 right-0 h-px ${t.dim}`} />
        {/* Region dots */}
        {[
          { x: 18, y: 35, tone: 'green' },
          { x: 35, y: 28, tone: 'green' },
          { x: 50, y: 40, tone: 'amber' },
          { x: 62, y: 55, tone: 'green' },
          { x: 78, y: 32, tone: 'red' },
          { x: 88, y: 60, tone: 'green' },
          { x: 25, y: 70, tone: 'green' },
          { x: 70, y: 75, tone: 'green' },
        ].map((d, i) => (
          <div
            key={i}
            className={`absolute w-1.5 h-1.5 rounded-full ${toneClass(d.tone as Tone, isDark)} animate-pulse`}
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
          />
        ))}
        {/* Routes */}
        <div className={`absolute h-px bg-[#4bbcbe]/40`} style={{ left: '18%', top: '36%', width: '20%' }} />
        <div className={`absolute h-px bg-[#4bbcbe]/40`} style={{ left: '35%', top: '32%', width: '15%' }} />
      </div>
    </div>
  );
}

export function GovernanceSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  return (
    <ThreePanelScaffold
      isDark={isDark}
      large={large}
      left={
        <div className="p-1 space-y-[3px]">
          <ShieldCheck className={`h-2.5 w-2.5 ${t.sage}`} />
          {/* Agent grid */}
          <div className="grid grid-cols-3 gap-[2px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`h-[8px] rounded border ${i === 4 ? `${t.accentB} ${t.accent}` : t.border}`} />
            ))}
          </div>
        </div>
      }
      center={
        <div className="p-1.5 space-y-1.5">
          {/* Autonomy ceiling */}
          <div className="space-y-[2px]">
            <div className={`h-[2px] rounded ${t.dim} w-[40%]`} />
            <div className="flex gap-[1px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`flex-1 h-[5px] rounded-sm ${i < 4 ? 'bg-[#4bbcbe]' : t.dim}`} />
              ))}
            </div>
          </div>
          {/* Approval ledger */}
          <div className="space-y-[2px]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-1 h-[3px] rounded ${i === 2 ? 'bg-amber-500' : 'bg-[#4bbcbe]'}`} />
                <div className={`h-[2px] rounded ${t.dim} flex-1`} />
              </div>
            ))}
          </div>
        </div>
      }
      right={
        <div className="p-1 space-y-1">
          <AlertTriangle className={`h-2.5 w-2.5 text-amber-500`} />
          <Pill tone="amber" isDark={isDark} w="w-[60%]" />
          <Pill tone="gray" isDark={isDark} w="w-[40%]" />
        </div>
      }
    />
  );
}

export function IntelligenceSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  return (
    <ThreePanelScaffold
      isDark={isDark}
      large={large}
      left={
        <div className="p-1 space-y-1">
          <BarChart2 className={`h-2.5 w-2.5 ${t.sage}`} />
          {/* Pattern cards */}
          {[1, 2, 3].map((i) => (
            <div key={i} className={`p-[2px] rounded border ${t.border}`}>
              <div className={`h-[2px] rounded bg-[#4bbcbe] mb-[1px]`} style={{ width: `${50 + i * 8}%` }} />
              <div className={`h-[2px] rounded ${t.dim} w-[60%]`} />
            </div>
          ))}
        </div>
      }
      center={
        <div className="p-1.5">
          {/* Correlation grid */}
          <div className="grid grid-cols-5 gap-[1px]">
            {Array.from({ length: 20 }).map((_, i) => {
              const opacities = [0.2, 0.4, 0.6, 0.8, 1];
              const opacity = opacities[(i * 3) % 5];
              return (
                <div
                  key={i}
                  className="h-[8px] rounded-[1px]"
                  style={{ backgroundColor: `rgba(135,152,106,${opacity})` }}
                />
              );
            })}
          </div>
          <div className={`mt-1.5 h-[5px] rounded ${t.accent} border ${t.accentB}`} />
        </div>
      }
      right={
        <div className="p-1 space-y-1">
          <Sparkles className={`h-2.5 w-2.5 ${t.sage}`} />
          <DotRow isDark={isDark} count={3} dense />
        </div>
      }
    />
  );
}

export function InfrastructureSnap({ isDark, large }: SnapProps) {
  const t = tones(isDark);
  const h = large ? 'h-[280px]' : 'h-[96px]';
  return (
    <div className={`${h} p-1.5 rounded-md border ${t.border} ${t.panel} overflow-hidden`}>
      <Wrench className={`h-2.5 w-2.5 ${t.sage} mb-1`} />
      {/* Service grid 4×3 */}
      <div className="grid grid-cols-5 gap-[2px]">
        {Array.from({ length: 15 }).map((_, i) => {
          const tone: Tone = i === 6 ? 'amber' : i === 11 ? 'red' : 'green';
          return (
            <div key={i} className={`h-[12px] rounded border ${t.border} relative`}>
              <div className={`absolute top-[2px] left-[2px] w-[3px] h-[3px] rounded-full ${toneClass(tone, isDark)}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Snapshot registry ─────────────────────────────────────
// Finn's 8-page platform — removed Buyamia-era pages from key type.
export type SnapshotKey =
  | 'overview' | 'orders' | 'inventory' | 'spending' | 'suppliers'
  | 'activity' | 'request' | 'workflows';

export function PageSnapshot({ pageId, isDark, large }: { pageId: SnapshotKey; isDark: boolean; large?: boolean }) {
  switch (pageId) {
    case 'overview':   return <OverviewSnap isDark={isDark} large={large} />;
    case 'orders':     return <OrdersSnap isDark={isDark} large={large} />;
    case 'inventory':  return <InventorySnap isDark={isDark} large={large} />;
    case 'spending':   return <SpendingSnap isDark={isDark} large={large} />;
    case 'suppliers':  return <SuppliersSnap isDark={isDark} large={large} />;
    case 'activity':   return <AIActivitySnap isDark={isDark} large={large} />;
    case 'request':    return <NewRequestSnap isDark={isDark} large={large} />;
    case 'workflows':  return <WorkflowsSnap isDark={isDark} large={large} />;
  }
}
