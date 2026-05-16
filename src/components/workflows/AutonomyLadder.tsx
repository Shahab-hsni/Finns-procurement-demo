import { AUTONOMY_LABELS } from '../../lib/types';
import type { AutonomyLevel } from '../../lib/types';
import { theme } from '../../lib/theme';

interface AutonomyLadderProps {
  isDark: boolean;
  level: AutonomyLevel;
}

export function AutonomyLadder({ isDark, level }: AutonomyLadderProps) {
  const t = theme(isDark);

  return (
    <div className="flex items-center gap-1">
      {([0, 1, 2, 3, 4, 5] as AutonomyLevel[]).map((l) => {
        const isActive = l <= level;
        const isCurrent = l === level;
        return (
          <div key={l} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`w-full h-2 rounded-full transition-colors ${
                isActive ? 'bg-[#87986a]' : isDark ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            />
            <span className={`text-[10px] text-center leading-tight ${
              isCurrent
                ? isDark ? 'text-[#a3b085] font-semibold' : 'text-[#6b7a54] font-semibold'
                : t.textMuted
            }`}>
              L{l} {AUTONOMY_LABELS[l]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
