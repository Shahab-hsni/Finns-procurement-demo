import { useState, useEffect } from 'react';
import { constraintStore } from '../lib/constraintStore';

export function useConstraints(): ReadonlyMap<string, number> {
  const [snap, setSnap] = useState<ReadonlyMap<string, number>>(
    () => constraintStore.snapshot()
  );
  useEffect(() => constraintStore.subscribe(setSnap), []);
  return snap;
}
