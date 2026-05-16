import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

interface InfoTooltipProps {
  text: string;
  isDark?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({ text, isDark = true, side = 'top' }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center justify-center rounded-full transition-colors shrink-0 ${
            isDark
              ? 'text-gray-600 hover:text-gray-400'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={6}
        className={`max-w-[260px] text-[11px] leading-relaxed px-3 py-2.5 rounded-lg border z-[100] ${
          isDark
            ? 'bg-[#2a2a2a] border-gray-700 text-gray-300 shadow-xl'
            : 'bg-white border-gray-200 text-gray-700 shadow-lg'
        }`}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
