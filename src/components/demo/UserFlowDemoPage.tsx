import { useState, useRef, useEffect, ReactNode } from 'react';
import {
  FileText, ShieldCheck, CreditCard, Database, Factory, BadgeCheck,
  Truck, Globe, MapPin, Building2, Bike, PackageCheck,
  Radio, Workflow, Bot, ClipboardList, ThumbsUp, Activity,
  DollarSign, Users, Sparkles, ArrowDown, ArrowRight, CheckCircle2,
  Circle, Eye, MessageCircle, ChevronRight, Zap,
} from 'lucide-react';

/**
 * UserFlowDemoPage
 *
 * A scrollytelling walkthrough of one canonical order's life across the
 * Buyamia platform — from demand signal to spending impact.
 *
 * Not part of production. Reachable via the "Flow Demo" link in the footer.
 *
 * Layout:
 *   ┌──────────────┬──────────────────────────────────────┐
 *   │  Left rail   │   Right canvas (scrollable)          │
 *   │  (sticky)    │     Hero                             │
 *   │              │     Chapter 1 — Detection            │
 *   │  12-stage    │     Chapter 2 — Drafting             │
 *   │  spine       │     Chapter 3 — Approval             │
 *   │              │     Chapter 4 — Execution            │
 *   │  Page map    │     Chapter 5 — Transit              │
 *   │              │     Chapter 6 — Delivery & Impact    │
 *   │              │     Closing                          │
 *   └──────────────┴──────────────────────────────────────┘
 */

// ── 12-Stage spine ─────────────────────────────────────────
const DAG_STAGES = [
  { id: 1,  label: 'PO Created',          icon: FileText },
  { id: 2,  label: 'Vendor Confirmed',    icon: ShieldCheck },
  { id: 3,  label: 'Payment Sent',        icon: CreditCard },
  { id: 4,  label: 'ERP Sync',            icon: Database },
  { id: 5,  label: 'Vendor Processing',   icon: Factory },
  { id: 6,  label: 'Quality Check',       icon: BadgeCheck },
  { id: 7,  label: 'Dispatched',          icon: Truck },
  { id: 8,  label: 'Customs Clearance',   icon: Globe },
  { id: 9,  label: 'In Transit',          icon: MapPin },
  { id: 10, label: 'Regional Hub',        icon: Building2 },
  { id: 11, label: 'Out for Delivery',    icon: Bike },
  { id: 12, label: 'Delivered',           icon: PackageCheck },
];

// ── Pages in the platform ──────────────────────────────────
const PAGE_MAP = {
  core: [
    { id: 'overview',    label: 'Overview' },
    { id: 'orders',      label: 'Orders' },
    { id: 'inventory',   label: 'Inventory' },
    { id: 'spending',    label: 'Spending' },
    { id: 'suppliers',   label: 'Suppliers' },
    { id: 'ai-activity', label: 'AI Activity' },
    { id: 'request',     label: 'New Request' },
  ],
  agents: [
    { id: 'nerve-center',   label: 'Nerve Center' },
    { id: 'workflows',      label: 'Workflows & Kernel' },
    { id: 'global-ops',     label: 'Global Operations' },
    { id: 'intelligence',   label: 'Intelligence' },
    { id: 'governance',     label: 'Governance' },
    { id: 'infrastructure', label: 'Infrastructure' },
  ],
};

// ── Chapter data ───────────────────────────────────────────
interface Chapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  narrative: string;
  stages: number[];   // which DAG stages are active
  pages: string[];    // which pages light up in the left-rail map
  hitl?: boolean;     // is this the human moment?
}

const CHAPTERS: Chapter[] = [
  {
    id: 'detection',
    number: 1,
    title: 'Detection',
    subtitle: 'A signal fires before any human is involved',
    narrative:
      'A POS demand forecast crosses the par-level threshold for Beef Tenderloin. Sensing agents pick it up, the Decision Kernel routes it through the Standard PO playbook, and the system enters its first "we should buy something" state — silently, without a notification ringing.',
    stages: [],
    pages: ['workflows', 'nerve-center', 'inventory'],
  },
  {
    id: 'drafting',
    number: 2,
    title: 'Drafting',
    subtitle: 'AI agents compose the order',
    narrative:
      'Reasoning agents select a vetted supplier from the internal directory (Seafood Masters Inc), pull historical pricing, and generate a draft PO. The Decision Kernel attaches a trial-order quality-hold clause because this supplier is new. The draft is staged for review — Stage 1 is now "PO Created", but a human has not yet seen it.',
    stages: [1],
    pages: ['nerve-center', 'workflows', 'orders'],
  },
  {
    id: 'approval',
    number: 3,
    title: 'Approval — the human moment',
    subtitle: 'Authorization-gated handoff to the admin',
    narrative:
      'The order surfaces in Orders under "NEEDS YOUR ACTION" with an amber "Awaiting your approval" badge. The admin clicks it; the center panel opens a two-column workspace: order detail and Approve & Execute on the left, the 12-stage Kernel Journey on the right. The right panel shows Atlas\'s reasoning: why this supplier, what the saving is, what the trial clause covers. The admin presses Approve.',
    stages: [1],
    pages: ['orders'],
    hitl: true,
  },
  {
    id: 'execution',
    number: 4,
    title: 'Execution',
    subtitle: 'The silent middle — agents handle stages 2 through 6',
    narrative:
      'With one click the kernel advances. Agent #5 confirms vendor receipt. Agent #28 processes payment. Agent #18 mirrors the entry into the ERP ledger. The vendor begins processing. Agent #9 verifies cold-chain quality specs. None of this requires the admin — the right panel\'s Atlas thread streams a plain-English log of each completion. The DAG card on the right column advances one node at a time.',
    stages: [2, 3, 4, 5, 6],
    pages: ['orders', 'ai-activity'],
  },
  {
    id: 'transit',
    number: 5,
    title: 'Transit & Tracking',
    subtitle: 'The order leaves the warehouse — Live Tracking unlocks',
    narrative:
      'Stage 7 fires: Dispatched. A Live Tracking panel slides in under the order detail card (it stayed hidden before — nothing to track when the goods were still at the supplier). Status pill flips from amber to blue. Agent #33 pre-files customs docs. Agent #7 confirms cold-chain at the regional hub. Out for delivery. The admin can now Track or Message the supplier directly from the order, with no page change.',
    stages: [7, 8, 9, 10, 11],
    pages: ['orders'],
  },
  {
    id: 'impact',
    number: 6,
    title: 'Delivery & Impact',
    subtitle: 'One order ripples across four pages',
    narrative:
      'Delivery confirmed. The kernel writes the trace as an immutable record. Spending\'s category card updates — the $680 saved is now booked. Suppliers\' vendor pulse refreshes — Seafood Masters Inc earns its first on-time delivery, trust score nudges up, the trial clause is cleared. Inventory\'s par level is satisfied. AI Activity logs the full 12-stage trace for audit. The Orders queue clears the card from "NEEDS YOUR ACTION" — autonomy banked back.',
    stages: [12],
    pages: ['orders', 'spending', 'suppliers', 'inventory', 'ai-activity'],
  },
];

// ════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════

interface UserFlowDemoPageProps {
  theme: 'dark' | 'light';
}

export function UserFlowDemoPage({ theme }: UserFlowDemoPageProps) {
  const isDark = theme === 'dark';

  // active chapter is whichever section is most prominently in view
  const [activeId, setActiveId] = useState<string>(CHAPTERS[0].id);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to top-third of viewport
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      {
        root: scrollerRef.current,
        threshold: [0.2, 0.4, 0.6],
        rootMargin: '-20% 0px -40% 0px',
      }
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const activeChapter = CHAPTERS.find((c) => c.id === activeId) ?? CHAPTERS[0];

  // Theme tokens
  const t = {
    bg:        isDark ? 'bg-[#1a1a1a]'   : 'bg-white',
    bgAlt:     isDark ? 'bg-[#141414]'   : 'bg-[#fafaf7]',
    surface:   isDark ? 'bg-[#2a2a2a]'   : 'bg-white',
    border:    isDark ? 'border-gray-800': 'border-[#dddddd]',
    textHead:  isDark ? 'text-white'     : 'text-[#222222]',
    textBody:  isDark ? 'text-gray-300'  : 'text-gray-700',
    textMuted: isDark ? 'text-gray-500'  : 'text-gray-500',
    textDim:   isDark ? 'text-gray-600'  : 'text-gray-400',
    sageBg:    isDark ? 'bg-[#4bbcbe]/15': 'bg-[#eafafa]',
    sageText:  isDark ? 'text-[#82d3d5]' : 'text-[#2c9a9c]',
    sageBorder:isDark ? 'border-[#4bbcbe]/40' : 'border-[#4bbcbe]/40',
  };

  return (
    <div className={`flex h-full min-h-0 overflow-hidden ${t.bgAlt}`}>
      {/* ─── LEFT RAIL — sticky map ─────────────────────────── */}
      <aside className={`w-[340px] shrink-0 border-r ${t.border} overflow-y-auto ${t.bg}`}>
        <LeftRail
          isDark={isDark}
          t={t}
          activeChapter={activeChapter}
          chapters={CHAPTERS}
        />
      </aside>

      {/* ─── RIGHT CANVAS — scrollytelling ──────────────────── */}
      <main ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-10 py-16">
          <Hero t={t} />

          {CHAPTERS.map((chapter) => (
            <ChapterSection
              key={chapter.id}
              chapter={chapter}
              isActive={chapter.id === activeId}
              t={t}
              isDark={isDark}
              registerRef={(el) => {
                if (el) sectionRefs.current.set(chapter.id, el);
                else sectionRefs.current.delete(chapter.id);
              }}
            />
          ))}

          <Closing t={t} isDark={isDark} />
        </div>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// LEFT RAIL
// ════════════════════════════════════════════════════════════

interface RailProps {
  isDark: boolean;
  t: Record<string, string>;
  activeChapter: Chapter;
  chapters: Chapter[];
}

function LeftRail({ isDark, t, activeChapter, chapters }: RailProps) {
  const activeStages = new Set(activeChapter.stages);
  const completedStages = new Set<number>();
  // every stage strictly before the max active one is "completed"
  const maxActive = Math.max(0, ...activeChapter.stages);
  for (let i = 1; i < maxActive; i++) completedStages.add(i);
  // when chapter 6 (impact), ALL stages are completed
  if (activeChapter.id === 'impact') {
    for (let i = 1; i <= 12; i++) completedStages.add(i);
  }
  const activePages = new Set(activeChapter.pages);

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div>
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${t.sageBg} ${t.sageText}`}>
          <Sparkles className="h-2.5 w-2.5" /> Flow Demo
        </div>
        <h1 className={`text-lg font-bold mt-2 ${t.textHead}`}>One order's life</h1>
        <p className={`text-[11px] mt-1 ${t.textMuted}`}>
          Scroll through the canonical path from demand signal to spending impact.
        </p>
      </div>

      {/* Progress */}
      <div className={`p-3 rounded-xl border ${t.border} ${t.surface}`}>
        <div className={`text-[9px] font-semibold uppercase tracking-wider ${t.textDim}`}>
          You are here
        </div>
        <div className={`mt-1 text-sm font-bold ${t.textHead}`}>
          Chapter {activeChapter.number} · {activeChapter.title}
        </div>
        <div className={`mt-2 h-1 rounded-full ${isDark ? 'bg-gray-800' : 'bg-[#dddddd]'}`}>
          <div
            className="h-1 rounded-full bg-[#4bbcbe] transition-all duration-500"
            style={{ width: `${(activeChapter.number / chapters.length) * 100}%` }}
          />
        </div>
      </div>

      {/* DAG Spine */}
      <div>
        <h3 className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${t.textDim}`}>
          12-Stage Kernel Journey
        </h3>
        <div className="relative">
          {/* connector line */}
          <div className={`absolute left-[11px] top-1 bottom-1 w-px ${isDark ? 'bg-gray-800' : 'bg-[#dddddd]'}`} />
          <ul className="space-y-1.5">
            {DAG_STAGES.map((stage) => {
              const isActive = activeStages.has(stage.id);
              const isCompleted = completedStages.has(stage.id);
              const Icon = stage.icon;
              return (
                <li key={stage.id} className="relative flex items-center gap-2.5 pl-0">
                  <div
                    className={`relative z-10 w-[22px] h-[22px] rounded-full border flex items-center justify-center shrink-0 transition-all duration-500 ${
                      isActive
                        ? 'bg-[#4bbcbe] border-[#4bbcbe] shadow-[0_0_0_3px_rgba(135,152,106,0.2)]'
                        : isCompleted
                        ? 'bg-[#4bbcbe]/30 border-[#4bbcbe]/50'
                        : isDark
                        ? 'bg-[#1a1a1a] border-gray-700'
                        : 'bg-white border-[#dddddd]'
                    }`}
                  >
                    {isActive ? (
                      <Icon className="h-2.5 w-2.5 text-white" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="h-3 w-3 text-[#4bbcbe]" />
                    ) : (
                      <Circle className={`h-2 w-2 ${t.textDim}`} />
                    )}
                  </div>
                  <span
                    className={`text-[11px] truncate transition-colors duration-300 ${
                      isActive
                        ? `${t.sageText} font-semibold`
                        : isCompleted
                        ? t.textBody
                        : t.textDim
                    }`}
                  >
                    {stage.id}. {stage.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Page map */}
      <div>
        <h3 className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${t.textDim}`}>
          Pages in play
        </h3>
        <div className="space-y-3">
          <PageGroup label="CORE" pages={PAGE_MAP.core} activePages={activePages} t={t} isDark={isDark} />
          <PageGroup label="AGENTS" pages={PAGE_MAP.agents} activePages={activePages} t={t} isDark={isDark} />
        </div>
      </div>
    </div>
  );
}

function PageGroup({
  label, pages, activePages, t, isDark,
}: {
  label: string;
  pages: { id: string; label: string }[];
  activePages: Set<string>;
  t: Record<string, string>;
  isDark: boolean;
}) {
  return (
    <div>
      <div className={`text-[9px] font-bold ${t.textDim} mb-1.5`}>{label}</div>
      <ul className="space-y-0.5">
        {pages.map((p) => {
          const isActive = activePages.has(p.id);
          return (
            <li
              key={p.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-all duration-300 ${
                isActive
                  ? `${t.sageBg} ${t.sageText} font-semibold`
                  : t.textMuted
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isActive ? 'bg-[#4bbcbe]' : isDark ? 'bg-gray-700' : 'bg-[#dddddd]'
                }`}
              />
              {p.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// HERO + CLOSING
// ════════════════════════════════════════════════════════════

function Hero({ t }: { t: Record<string, string> }) {
  return (
    <header className="mb-20">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${t.sageBg} ${t.sageText}`}>
        <Sparkles className="h-3 w-3" /> Demonstration
      </div>
      <h1 className={`text-4xl font-bold tracking-tight mt-4 ${t.textHead}`}>
        How one order moves through Buyamia
      </h1>
      <p className={`text-base mt-4 leading-relaxed ${t.textBody}`}>
        Buyamia is built around a 12-stage Decision Kernel. Most of those stages happen
        without a human in the loop. The interesting question is — what does an admin
        actually <em>do</em> in the system, and where do their decisions live?
      </p>
      <p className={`text-base mt-4 leading-relaxed ${t.textBody}`}>
        This walkthrough follows one canonical order — a trial restock of beef tenderloin
        from a new supplier — from the moment a demand signal fires to the moment the
        delivery ripples across Spending, Suppliers, and the audit log. The left rail
        tracks where you are at every step.
      </p>
      <div className={`mt-8 inline-flex items-center gap-2 text-[11px] ${t.textMuted}`}>
        <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
        Scroll to begin
      </div>
    </header>
  );
}

function Closing({ t, isDark }: { t: Record<string, string>; isDark: boolean }) {
  return (
    <footer className="mt-24 mb-12">
      <div className={`p-8 rounded-2xl border ${t.border} ${t.surface}`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#4bbcbe] flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${t.textHead}`}>That's the canonical path.</h2>
            <p className={`text-sm mt-2 leading-relaxed ${t.textBody}`}>
              One demand signal, one human touch (the approval), twelve kernel stages, four downstream
              page updates. The admin's role across the entire flow was a single review-and-approve
              decision — the rest happened in the background, visible only when the admin looked.
            </p>
            <p className={`text-sm mt-3 leading-relaxed ${t.textMuted}`}>
              Variants like Manual Takeover, batch processing, exception handling, and the seven-step
              New Request wizard are not shown here — this is the happy path, told end-to-end.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ════════════════════════════════════════════════════════════
// CHAPTER SECTION + MOCKUPS
// ════════════════════════════════════════════════════════════

interface ChapterSectionProps {
  chapter: Chapter;
  isActive: boolean;
  t: Record<string, string>;
  isDark: boolean;
  registerRef: (el: HTMLElement | null) => void;
}

function ChapterSection({ chapter, isActive, t, isDark, registerRef }: ChapterSectionProps) {
  return (
    <section
      id={chapter.id}
      ref={registerRef}
      className={`min-h-[80vh] py-12 transition-opacity duration-500 ${
        isActive ? 'opacity-100' : 'opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
            chapter.hitl
              ? 'bg-amber-500 text-white'
              : 'bg-[#4bbcbe] text-white'
          }`}
        >
          {chapter.number}
        </div>
        {chapter.hitl && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-600 border border-amber-500/30">
            <Eye className="h-2.5 w-2.5" /> Human-in-the-loop
          </span>
        )}
      </div>

      <h2 className={`text-3xl font-bold tracking-tight ${t.textHead}`}>{chapter.title}</h2>
      <p className={`text-sm mt-2 ${t.textMuted}`}>{chapter.subtitle}</p>
      <p className={`text-base mt-6 leading-relaxed ${t.textBody}`}>{chapter.narrative}</p>

      <div className="mt-10">
        {renderMockup(chapter.id, t, isDark)}
      </div>
    </section>
  );
}

// ── Mockup dispatcher ─────────────────────────────────────
function renderMockup(chapterId: string, t: Record<string, string>, isDark: boolean): ReactNode {
  switch (chapterId) {
    case 'detection':  return <DetectionMockup t={t} isDark={isDark} />;
    case 'drafting':   return <DraftingMockup t={t} isDark={isDark} />;
    case 'approval':   return <ApprovalMockup t={t} isDark={isDark} />;
    case 'execution':  return <ExecutionMockup t={t} isDark={isDark} />;
    case 'transit':    return <TransitMockup t={t} isDark={isDark} />;
    case 'impact':     return <ImpactMockup t={t} isDark={isDark} />;
    default: return null;
  }
}

// ── Shared schematic primitives ────────────────────────────
function PanelFrame({
  label, highlighted, t, isDark, children, className = '',
}: {
  label: string;
  highlighted?: boolean;
  t: Record<string, string>;
  isDark: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-lg border ${className} ${
        highlighted
          ? `${t.sageBorder} ${isDark ? 'bg-[#4bbcbe]/10' : 'bg-[#eafafa]/60'} shadow-[0_0_0_3px_rgba(135,152,106,0.15)]`
          : `${t.border} ${t.surface}`
      }`}
    >
      <div className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border-b ${t.border} ${
        highlighted ? t.sageText : t.textDim
      }`}>
        {label}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Annotation({ text, t }: { text: string; t: Record<string, string> }) {
  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] ${t.sageText} font-semibold mt-2`}>
      <ArrowRight className="h-3 w-3" /> {text}
    </div>
  );
}

function Bar({ w, isDark }: { w: string; isDark: boolean }) {
  return <div className={`h-1.5 rounded ${isDark ? 'bg-gray-700' : 'bg-[#dddddd]'}`} style={{ width: w }} />;
}

// ── Chapter 1: Detection ───────────────────────────────────
function DetectionMockup({ t, isDark }: { t: Record<string, string>; isDark: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 h-[280px]">
      {/* Workflows left panel */}
      <PanelFrame label="Workflows · Signals" highlighted t={t} isDark={isDark}>
        <div className="space-y-2">
          <div className={`p-2 rounded border ${t.sageBorder} ${isDark ? 'bg-[#4bbcbe]/10' : 'bg-[#eafafa]'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Radio className={`h-3 w-3 ${t.sageText} animate-pulse`} />
              <span className={`text-[10px] font-bold ${t.sageText}`}>Beef · Par-level breach</span>
            </div>
            <div className="flex items-center gap-1">
              <Bar w="70%" isDark={isDark} />
              <span className={`text-[8px] ${t.textMuted}`}>72%</span>
            </div>
            <div className={`text-[8px] mt-1 ${t.textMuted}`}>Source: POS forecast</div>
          </div>
          <div className={`p-2 rounded border ${t.border} opacity-50`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Radio className={`h-3 w-3 ${t.textDim}`} />
              <span className={`text-[10px] ${t.textMuted}`}>Lamb · Stable</span>
            </div>
            <Bar w="20%" isDark={isDark} />
          </div>
        </div>
      </PanelFrame>

      {/* Nerve Center center DAG */}
      <PanelFrame label="Nerve Center · Sensing" t={t} isDark={isDark}>
        <div className="space-y-2">
          <div className={`text-[9px] ${t.textMuted}`}>SEN cohort</div>
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex-1 h-8 rounded ${i <= 2 ? 'bg-[#4bbcbe]/40' : `${isDark ? 'bg-gray-800' : 'bg-[#eafafa]'}`} flex items-center justify-center`}>
                <Bot className={`h-3 w-3 ${i <= 2 ? t.sageText : t.textDim}`} />
              </div>
            ))}
          </div>
          <div className={`text-[8px] mt-2 ${t.textMuted}`}>SEN-001, SEN-002 firing</div>
        </div>
      </PanelFrame>

      {/* Inventory right */}
      <PanelFrame label="Inventory · Stock" t={t} isDark={isDark}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] ${t.textBody}`}>Beef Tenderloin</span>
            <span className="text-[10px] font-bold text-amber-500">12 kg</span>
          </div>
          <div className="relative h-2 rounded-full bg-amber-500/20 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-amber-500 rounded-full" style={{ width: '24%' }} />
            <div className="absolute top-0 bottom-0 w-px bg-[#2c9a9c]" style={{ left: '50%' }} />
          </div>
          <div className={`text-[8px] ${t.textMuted}`}>Par: 50 kg · below threshold</div>
        </div>
      </PanelFrame>
    </div>
  );
}

// ── Chapter 2: Drafting ────────────────────────────────────
function DraftingMockup({ t, isDark }: { t: Record<string, string>; isDark: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <PanelFrame label="AI Drafting" highlighted t={t} isDark={isDark}>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Workflow className={`h-3 w-3 ${t.sageText}`} />
              <span className={`text-[10px] font-semibold ${t.sageText}`}>Standard PO playbook</span>
            </div>
            <div className="space-y-1 mt-2">
              {[
                { label: 'Vendor selected', who: 'Seafood Masters Inc' },
                { label: 'Quality-hold clause', who: 'Auto-attached · trial' },
                { label: 'Amount drafted', who: '$8,900' },
                { label: 'Saving vs spot', who: '$680' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[9px]">
                  <span className={t.textMuted}>{row.label}</span>
                  <span className={`${t.textBody} font-semibold`}>{row.who}</span>
                </div>
              ))}
            </div>
          </div>
        </PanelFrame>

        <PanelFrame label="Orders queue (left panel)" t={t} isDark={isDark}>
          <div className="space-y-1.5">
            <div className={`text-[9px] uppercase font-bold ${t.textDim}`}>Needs your action · 1</div>
            <div className={`p-2 rounded border ${t.border}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <ClipboardList className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Awaiting your approval</span>
              </div>
              <div className={`text-[10px] ${t.textBody}`}>Seafood Masters Inc</div>
              <div className={`text-[9px] ${t.textMuted}`}>$8,900 · trial order</div>
            </div>
          </div>
        </PanelFrame>
      </div>
      <Annotation text="The order now exists in Stage 1 (PO Created) but no human has seen it yet." t={t} />
    </div>
  );
}

// ── Chapter 3: Approval ────────────────────────────────────
function ApprovalMockup({ t, isDark }: { t: Record<string, string>; isDark: boolean }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[120px_1fr_120px] gap-2 h-[340px]">
        {/* Left: Orders queue with selected card */}
        <PanelFrame label="Orders" t={t} isDark={isDark}>
          <div className="space-y-1.5">
            <div className={`p-1.5 rounded border ${t.sageBorder} ${t.sageBg}`}>
              <div className="text-[8px] font-bold text-amber-600">Awaiting</div>
              <div className={`text-[9px] font-semibold ${t.textBody}`}>Seafood M.</div>
              <div className={`text-[8px] ${t.textMuted}`}>$8,900</div>
            </div>
            <div className={`p-1.5 rounded border ${t.border} opacity-50`}>
              <div className={`text-[9px] ${t.textBody}`}>Other PO</div>
            </div>
          </div>
        </PanelFrame>

        {/* Center: detail + DAG side-by-side, action button highlighted */}
        <PanelFrame label="Order Journey — PO-2855" highlighted t={t} isDark={isDark}>
          <div className="flex gap-2 h-full">
            <div className="flex-1 space-y-2 min-w-0">
              <div className={`text-base font-bold ${t.textHead}`}>$8,900</div>
              <div className={`text-[9px] ${t.textMuted}`}>Trial order · quality hold</div>
              <div className="space-y-1 my-2">
                <Bar w="100%" isDark={isDark} />
                <Bar w="80%" isDark={isDark} />
                <Bar w="90%" isDark={isDark} />
              </div>
              <div className="bg-[#4bbcbe] rounded-md py-2 text-center text-[10px] font-bold text-white shadow-[0_0_0_4px_rgba(135,152,106,0.25)]">
                <ThumbsUp className="h-3 w-3 inline mr-1" /> Approve &amp; Execute
              </div>
              <div className="text-center text-[9px] text-gray-400">Decline</div>
            </div>
            <div className={`w-[80px] shrink-0 rounded border ${t.border} p-1.5 space-y-1`}>
              <div className={`text-[8px] font-bold ${t.textDim}`}>STAGE 1</div>
              {DAG_STAGES.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.id === 1 ? 'bg-amber-500 animate-pulse' : isDark ? 'bg-gray-700' : 'bg-[#dddddd]'}`} />
                  <span className={`text-[7px] truncate ${s.id === 1 ? 'text-amber-600 font-bold' : t.textMuted}`}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </PanelFrame>

        {/* Right: Atlas reasoning */}
        <PanelFrame label="Atlas" t={t} isDark={isDark}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Sparkles className={`h-2.5 w-2.5 ${t.sageText}`} />
              <span className={`text-[9px] font-bold ${t.sageText}`}>Reasoning</span>
            </div>
            <div className={`text-[9px] leading-snug ${t.textBody}`}>
              New supplier — recommend trial. Cost reduction est. $680. Trial clause: cold-chain compliance verified.
            </div>
          </div>
        </PanelFrame>
      </div>
      <Annotation text="One click. The only human touchpoint in the entire 12-stage journey." t={t} />
    </div>
  );
}

// ── Chapter 4: Execution ───────────────────────────────────
function ExecutionMockup({ t, isDark }: { t: Record<string, string>; isDark: boolean }) {
  return (
    <div className="space-y-3">
      <div className={`p-4 rounded-lg border ${t.border} ${t.surface}`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`text-xs font-bold ${t.textHead}`}>12-Stage Kernel Journey</div>
          <div className={`text-[10px] ${t.textMuted}`}>advancing…</div>
        </div>
        <div className="space-y-1.5">
          {DAG_STAGES.slice(0, 7).map((s, idx) => {
            const completed = s.id <= 6;
            const current = s.id === 6;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    completed && !current
                      ? 'bg-[#4bbcbe]/30'
                      : current
                      ? 'bg-[#4bbcbe] shadow-[0_0_0_3px_rgba(135,152,106,0.25)]'
                      : isDark
                      ? 'bg-gray-800'
                      : 'bg-[#eafafa]'
                  }`}
                >
                  {completed && !current ? (
                    <CheckCircle2 className="h-3 w-3 text-[#4bbcbe]" />
                  ) : (
                    <Icon className={`h-3 w-3 ${current ? 'text-white' : t.textDim}`} />
                  )}
                </div>
                <div className={`text-[11px] ${current ? `${t.sageText} font-bold` : completed ? t.textBody : t.textDim}`}>
                  Stage {s.id} · {s.label}
                </div>
                {idx < 6 && (
                  <span className={`text-[9px] ml-auto ${t.textDim}`}>
                    {idx === 0 ? 'Agent #5' : idx === 1 ? 'Agent #28' : idx === 2 ? 'Agent #18' : idx === 3 ? 'auto' : idx === 4 ? 'Agent #9' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Annotation text="Five stages advance without a notification — Atlas streams the audit log into AI Activity." t={t} />
    </div>
  );
}

// ── Chapter 5: Transit ─────────────────────────────────────
function TransitMockup({ t, isDark }: { t: Record<string, string>; isDark: boolean }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_220px] gap-3 h-[280px]">
        {/* Left column with detail + Live Tracking appearing */}
        <div className="flex flex-col gap-2">
          <PanelFrame label="Order detail" t={t} isDark={isDark} className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-base font-bold ${t.textHead}`}>$8,900</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-600 border border-blue-500/30">
                <Truck className="h-2.5 w-2.5" /> In Transit
              </span>
            </div>
            <div className={`text-[10px] ${t.textMuted}`}>Status flipped from amber to blue. Track + Message Supplier now visible in the tertiary row.</div>
          </PanelFrame>
          <PanelFrame label="Live Tracking · just appeared" highlighted t={t} isDark={isDark}>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <Bar w="70%" isDark={isDark} />
                <Bar w="45%" isDark={isDark} />
              </div>
              <MapPin className={`h-5 w-5 ${t.sageText} animate-bounce`} />
            </div>
            <div className={`text-[9px] mt-2 ${t.textDim}`}>Hidden until Stage 7. Nothing to track before dispatch.</div>
          </PanelFrame>
        </div>

        {/* Right column DAG */}
        <PanelFrame label="DAG" t={t} isDark={isDark}>
          <div className="space-y-1">
            {DAG_STAGES.slice(5, 12).map((s) => {
              const completed = s.id <= 10;
              const current = s.id === 11;
              return (
                <div key={s.id} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${completed && !current ? 'bg-[#4bbcbe]' : current ? 'bg-amber-500 animate-pulse' : isDark ? 'bg-gray-700' : 'bg-[#dddddd]'}`} />
                  <span className={`text-[9px] ${current ? 'text-amber-600 font-bold' : completed ? t.textBody : t.textDim}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </PanelFrame>
      </div>
      <Annotation text="Stage gating: the Live Tracking widget was hidden until Stage 7 (Dispatched) fired." t={t} />
    </div>
  );
}

// ── Chapter 6: Impact ──────────────────────────────────────
function ImpactMockup({ t, isDark }: { t: Record<string, string>; isDark: boolean }) {
  const cards = [
    {
      label: 'Spending',
      icon: DollarSign,
      headline: '+$680 saved',
      detail: 'Beef category card updated · saving booked',
    },
    {
      label: 'Suppliers',
      icon: Users,
      headline: 'Trust ↑ 4%',
      detail: 'Seafood Masters · trial clause cleared · 1st on-time delivery',
    },
    {
      label: 'Inventory',
      icon: PackageCheck,
      headline: 'Par level met',
      detail: 'Beef Tenderloin restocked · heartbeat green',
    },
    {
      label: 'AI Activity',
      icon: Activity,
      headline: '12-stage trace',
      detail: 'Immutable record written · 1 human touch logged',
    },
  ];
  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg border ${t.sageBorder} ${t.sageBg} flex items-center gap-3`}>
        <div className="w-9 h-9 rounded-full bg-[#4bbcbe] flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className={`text-sm font-bold ${t.textHead}`}>Delivered · PO-2855 closed</div>
          <div className={`text-[11px] ${t.textMuted}`}>Order leaves the "Needs your action" queue. Autonomy banked.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <PanelFrame key={c.label} label={c.label} highlighted t={t} isDark={isDark}>
              <div className="flex items-start gap-2.5">
                <div className={`w-7 h-7 rounded-lg ${isDark ? 'bg-[#4bbcbe]/20' : 'bg-[#eafafa]'} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-3.5 w-3.5 ${t.sageText}`} />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${t.textHead}`}>{c.headline}</div>
                  <div className={`text-[10px] mt-0.5 ${t.textMuted}`}>{c.detail}</div>
                </div>
              </div>
            </PanelFrame>
          );
        })}
      </div>
      <Annotation text="One order, four downstream effects — all automatic." t={t} />
    </div>
  );
}
