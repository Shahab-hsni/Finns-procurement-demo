import React, { useState, useEffect } from "react";
import { RequestPanel } from "./components/RequestPanel";
import { OverviewPage } from "./components/OverviewPage";
import { NewOrdersPage } from "./components/NewOrdersPage";
import { NewInventoryPage } from "./components/NewInventoryPage";
import { SpendingPage } from "./components/SpendingPage";
import { SuppliersPage } from "./components/SuppliersPage";
import { AIActivityPage } from "./components/AIActivityPage";
import { WorkflowsPage } from "./components/workflows/WorkflowsPage";
import { GovernancePage } from "./components/governance/GovernancePage";
import { UserFlowDemoPage } from "./components/demo/UserFlowDemoPage";
import { FlowChartPage } from "./components/demo/FlowChartPage";
import { GlobalFooter } from "./components/GlobalFooter";
import { Moon, Sun, Bell } from "lucide-react";
import { Toaster } from "sonner@2.0.3";

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: 20, color: 'red'}}>
        <h1>Something went wrong.</h1>
        <pre>{this.state.error?.toString()}</pre>
        <pre>{this.state.error?.stack}</pre>
      </div>;
    }
    return this.props.children;
  }
}

// ── Page types ──
// Activity & Governance is split across two routes during the transition.
// Phase 3h merges them at `/activity` and drops the `governance` route.
type AppPage =
  | 'overview'
  | 'orders'
  | 'inventory'
  | 'spending'
  | 'suppliers'
  | 'ai-activity'      // becomes the canonical "Activity & Governance" route after Phase 3h
  | 'governance'       // removed after Phase 3h merge
  | 'workflows'
  | 'request';
type DemoPage = 'flow-demo' | 'flow-chart';
type Page = AppPage | DemoPage;

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentPage, setCurrentPage] = useState<Page>('overview');
  const isDark = theme === 'dark';

  // Simulate agent processing bursts (Kernel + Event Bus active)
  const [isProcessing, setIsProcessing] = useState(false);
  useEffect(() => {
    const cycle = () => {
      setIsProcessing(true);
      const onDuration = 3000 + Math.random() * 4000;
      const offDuration = 5000 + Math.random() * 8000;
      const offTimer = setTimeout(() => {
        setIsProcessing(false);
        const onTimer = setTimeout(cycle, offDuration);
        return () => clearTimeout(onTimer);
      }, onDuration);
      return () => clearTimeout(offTimer);
    };
    const initial = setTimeout(cycle, 2000);
    return () => clearTimeout(initial);
  }, []);

  // ── New Request draft tracker ─────────────────────────────────
  const [hasDraft, setHasDraft] = useState(false);
  const [draftMeta, setDraftMeta] = useState<{ step: number; name: string; items: number } | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const raw = sessionStorage.getItem('newRequestDraft');
        if (!raw) { setHasDraft(false); setDraftMeta(null); return; }
        const parsed = JSON.parse(raw);
        setHasDraft(true);
        setDraftMeta({ step: parsed.step ?? 1, name: parsed.name ?? '', items: parsed.items ?? 0 });
      } catch { setHasDraft(false); setDraftMeta(null); }
    };
    read();
    window.addEventListener('newRequestDraftChanged', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('newRequestDraftChanged', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  // Cross-page navigation from deep links.
  // Pages dispatch `finns-navigate-page` with optional context (evtId / agentId
  // / orderId / workflowId). We promote the context to the URL hash before
  // switching pages so the receiver's hash-reader picks it up.
  //
  // Backward-compat: also listen to legacy `buyamia-navigate-page` while old
  // pages still emit it. Removed in Phase 4 once every emitter is migrated.
  // The deprecated `decisionId` field is no longer promoted -- Decision
  // Attribution Trail is cut from Finn's scope.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{
        page: string;
        evtId?: string;
        agentId?: string;
        orderId?: string;
        workflowId?: string;
      }>).detail ?? {} as Record<string, string>;
      if (typeof window !== 'undefined') {
        if (detail.evtId)            window.location.hash = `evt=${detail.evtId}`;
        else if (detail.agentId)     window.location.hash = `agent-${String(detail.agentId).padStart(2, '0')}`;
        else if (detail.orderId)     window.location.hash = `order=${detail.orderId}`;
        else if (detail.workflowId)  window.location.hash = `workflow=${detail.workflowId}`;
      }
      if (detail.page) setCurrentPage(detail.page as Page);
    };
    window.addEventListener('finns-navigate-page', handler);
    window.addEventListener('buyamia-navigate-page', handler); // legacy, removed in Phase 4
    return () => {
      window.removeEventListener('finns-navigate-page', handler);
      window.removeEventListener('buyamia-navigate-page', handler);
    };
  }, []);

  // 9 nav items during transition. Phase 3h collapses AI Activity + Governance
  // into a single "Activity & Governance" tab pointing at the `/activity` route.
  const navItems: { id: AppPage; label: string }[] = [
    { id: 'overview',    label: 'Overview' },
    { id: 'inventory',   label: 'Inventory' },
    { id: 'request',     label: 'New Request' },
    { id: 'orders',      label: 'Orders' },
    { id: 'suppliers',   label: 'Suppliers' },
    { id: 'spending',    label: 'Spending' },
    { id: 'ai-activity', label: 'Activity' },
    { id: 'governance',  label: 'Governance' },
    { id: 'workflows',   label: 'Workflows' },
  ];

  const pageTheme = isDark ? 'dark' : 'light';

  const renderPageContent = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage theme={pageTheme} />;
      case 'orders':
        return <NewOrdersPage theme={pageTheme} onNavigate={(page) => setCurrentPage(page as Page)} />;
      case 'inventory':
        return <NewInventoryPage theme={pageTheme} onNavigate={(page) => setCurrentPage(page as Page)} />;
      case 'spending':
        return <SpendingPage theme={pageTheme} />;
      case 'suppliers':
        return <SuppliersPage theme={pageTheme} onNavigate={(page) => setCurrentPage(page as Page)} />;
      case 'ai-activity':
        return <AIActivityPage theme={pageTheme} onNavigate={(page) => setCurrentPage(page as Page)} />;
      case 'governance':
        return <GovernancePage theme={pageTheme} onNavigate={(page) => setCurrentPage(page as Page)} />;
      case 'workflows':
        return <WorkflowsPage theme={pageTheme} onNavigate={(page) => setCurrentPage(page as Page)} />;
      case 'flow-demo':
        return <UserFlowDemoPage theme={pageTheme} />;
      case 'flow-chart':
        return (
          <FlowChartPage
            theme={pageTheme}
            onOpenGuidedTour={() => setCurrentPage('flow-demo')}
            onNavigateLive={(pageId) => setCurrentPage(pageId as Page)}
          />
        );
      case 'request':
      default:
        return <RequestPanel theme={pageTheme} onNavigate={(page) => setCurrentPage(page as Page)} />;
    }
  };

  // ── Theme-aware tokens ──
  const topBarBg = isDark ? 'bg-[#1a1a1a]' : 'bg-white';
  const topBarBorder = isDark ? 'border-gray-800' : 'border-gray-200';
  const screenBg = isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50';
  const navBg = isDark ? 'bg-[#252525] border-gray-800' : 'bg-gray-100/80 border-gray-200';
  const navInactive = isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800';
  const iconBtn = isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700';
  const logoText = isDark ? 'text-white' : 'text-gray-900';

  return (
    <ErrorBoundary>
      <Toaster />
      <div className={`h-screen flex flex-col ${screenBg}`}>
        {/* ── Top Bar ── */}
        <div className={`h-14 ${topBarBg} border-b ${topBarBorder} flex items-center justify-between px-4 shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-[#87986a] to-[#6b7a54] rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">F</span>
            </div>
            <span className={`${logoText} font-medium text-sm`}>Finn's</span>
          </div>

          {/* Flat single-row navigation (no Agents dropdown) */}
          <nav className={`flex items-center gap-0.5 rounded-full px-1 py-0.5 border ${navBg}`}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  currentPage === item.id
                    ? 'bg-[#87986a] text-white shadow-sm'
                    : navInactive
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            {/* Draft-in-progress pill */}
            {hasDraft && currentPage !== 'request' && draftMeta && (
              <button
                onClick={() => setCurrentPage('request')}
                title={`Return to draft · ${draftMeta.name || 'unnamed'} · ${draftMeta.items} item${draftMeta.items === 1 ? '' : 's'}`}
                className={`mr-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                  isDark ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                        : 'bg-amber-50 border border-amber-400/50 text-amber-700 hover:bg-amber-100'
                }`}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-70 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                </span>
                Draft in progress · Step {draftMeta.step}/5
              </button>
            )}
            <button className={`relative p-2 rounded-full ${iconBtn} transition-colors`}>
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-2 rounded-full ${iconBtn} transition-colors`}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* ── Content Area ──
            The request page is a self-contained Sourcing Wizard that
            owns its own sidebars (they react to wizard state). */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 h-full min-h-0">
            {renderPageContent()}
          </div>
        </div>

        <GlobalFooter
          isDark={isDark}
          isProcessing={isProcessing}
          onOpenFlowDemo={() => setCurrentPage('flow-chart')}
          isDemoActive={currentPage === 'flow-chart' || currentPage === 'flow-demo'}
        />
      </div>
    </ErrorBoundary>
  );
}
