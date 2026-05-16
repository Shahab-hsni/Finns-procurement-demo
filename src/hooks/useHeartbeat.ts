import { useState, useEffect } from 'react';

/**
 * Returns a boolean that toggles on/off at the given interval.
 * Used for agent pulse dots, footer heartbeat, status indicators.
 */
export function useHeartbeat(intervalMs = 1200): boolean {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return pulse;
}
