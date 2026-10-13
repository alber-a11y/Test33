type Handler<T> = (payload: T) => void;

/** Minimal typed event emitter. */
export class Emitter<Events extends Record<string, unknown>> {
  private map = new Map<keyof Events, Set<Handler<any>>>();

  on<K extends keyof Events>(name: K, fn: Handler<Events[K]>): () => void {
    let set = this.map.get(name);
    if (!set) this.map.set(name, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    this.map.get(name)?.forEach((fn) => fn(payload));
  }
}
