import { useState, useEffect, useRef } from 'react';

/**
 * Returns a numeric value that drifts randomly around a baseline.
 * Powers live sparklines and real-time metric displays.
 *
 * @param baseline   The center value to oscillate around
 * @param variance   Max drift per tick (default: 5% of baseline)
 * @param intervalMs How often the value updates (default: 2000ms)
 */
export function useSimulatedMetric(
  baseline: number,
  variance?: number,
  intervalMs = 2000,
): number {
  const drift = variance ?? baseline * 0.05;
  const [value, setValue] = useState(baseline);
  const baseRef = useRef(baseline);
  baseRef.current = baseline;

  useEffect(() => {
    const id = setInterval(() => {
      setValue((prev) => {
        const delta = (Math.random() - 0.5) * 2 * drift;
        const next = prev + delta;
        // Clamp within ±2× variance of baseline
        const min = baseRef.current - drift * 2;
        const max = baseRef.current + drift * 2;
        return Math.max(min, Math.min(max, next));
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [drift, intervalMs]);

  return value;
}
