import { useHeartbeat } from '../hooks/useHeartbeat';
import { infrastructureServices } from '../lib/mockData';
import { Sparkles } from 'lucide-react';

interface GlobalFooterProps {
  isDark: boolean;
  /** When true, Kernel and Event Bus status dots show an active processing pulse */
  isProcessing?: boolean;
  /** Opens the (non-production) scrollytelling demo. */
  onOpenFlowDemo?: () => void;
  isDemoActive?: boolean;
}

export function GlobalFooter({ isDark, isProcessing = false, onOpenFlowDemo, isDemoActive = false }: GlobalFooterProps) {
  const pulse = useHeartbeat(1200);

  const bg = isDark ? 'bg-[#141414] border-gray-800' : 'bg-white border-gray-200';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  const textDim = isDark ? 'text-gray-600' : 'text-gray-400';

  const statusColor = (status: string) => {
    if (status === 'healthy') return 'bg-green-500';
    if (status === 'degraded') return 'bg-amber-500';
    return 'bg-red-500';
  };

  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className={`h-10 shrink-0 border-t ${bg} flex items-center justify-between px-6`}>
      {/* Left: System signature */}
      <div className={`text-xs ${textMuted} flex items-center gap-1.5`}>
        <span>40 Agents</span>
        <span className={textDim}>·</span>
        <span>5 Classes</span>
        <span className={textDim}>·</span>
        <span>4 Control Planes</span>
        <span className={textDim}>·</span>
        <span>6 Graphs</span>
        <span className={textDim}>·</span>
        <span>6 Autonomy</span>
        <span className={textDim}>·</span>
        <span>19 Systems</span>
        <span className={textDim}>·</span>
        <span>6 Reforms</span>
        <span className={textDim}>·</span>
        <span>10 Hardening</span>
        <span className={textDim}>·</span>
        <span className={isDark ? 'text-green-400' : 'text-green-600'}>Grade: A</span>
      </div>

      {/* Center: Service status dots */}
      <div className="flex items-center gap-3">
        {infrastructureServices.map((service) => {
          const isActiveService = isProcessing && (service.id === 'SVC-KRN' || service.id === 'SVC-EVT');
          return (
            <div key={service.id} className="flex items-center gap-1.5">
              <div className="relative flex items-center justify-center">
                <div className={`w-2 h-2 rounded-full ${isActiveService ? 'bg-amber-400' : statusColor(service.status)}`} />
                {isActiveService ? (
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-amber-400 opacity-50 animate-ping" />
                ) : service.status === 'healthy' && pulse ? (
                  <div className={`absolute inset-0 w-2 h-2 rounded-full ${statusColor(service.status)} opacity-40 animate-ping`} />
                ) : null}
              </div>
              <span className={`text-xs ${isActiveService ? (isDark ? 'text-amber-400' : 'text-amber-600') : textMuted}`}>
                {service.label}{isActiveService ? ' ●' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right: Heartbeat indicator + demo link */}
      <div className="flex items-center gap-2">
        {onOpenFlowDemo && (
          <button
            onClick={onOpenFlowDemo}
            title="Open the scrollytelling user-flow demo (not part of production)"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
              isDemoActive
                ? isDark ? 'bg-[#87986a]/20 border-[#87986a]/40 text-[#a3b085]'
                         : 'bg-[#f4f6f0] border-[#87986a]/40 text-[#6b7a54]'
                : isDark ? 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                         : 'border-[#e5e5e0] text-gray-400 hover:text-gray-600 hover:border-gray-300'
            }`}
          >
            <Sparkles className="h-2.5 w-2.5" /> System Map
          </button>
        )}
        <div className="relative flex items-center justify-center">
          <div className={`w-2 h-2 rounded-full ${pulse ? 'bg-green-500' : 'bg-green-500/50'}`} />
          {pulse && (
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 opacity-40 animate-ping" />
          )}
        </div>
        <span className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>System OK</span>
        <span className={`text-xs ${textDim}`}>{timestamp}</span>
      </div>
    </div>
  );
}
