type ConstraintListener = (snapshot: ReadonlyMap<string, number>) => void;

class ConstraintStore {
  private _data = new Map<string, number>();
  private _listeners = new Set<ConstraintListener>();

  set(key: string, value: number): void {
    this._data.set(key, value);
    this._emit();
  }

  delete(key: string): void {
    if (this._data.delete(key)) this._emit();
  }

  has(key: string): boolean { return this._data.has(key); }
  get(key: string): number | undefined { return this._data.get(key); }
  snapshot(): ReadonlyMap<string, number> { return new Map(this._data); }

  subscribe(listener: ConstraintListener): () => void {
    this._listeners.add(listener);
    listener(this.snapshot());
    return () => this._listeners.delete(listener);
  }

  private _emit(): void {
    const snap = this.snapshot();
    this._listeners.forEach(l => l(snap));
  }
}

export const constraintStore = new ConstraintStore();
