export class ExecutionContext {
  private readonly values = new Map<string, unknown>();
  constructor(initial: Record<string, unknown> = {}) { Object.entries(initial).forEach(([key, value]) => this.values.set(key, value)); }
  get<T = unknown>(key: string): T | undefined { return this.values.get(key) as T | undefined; }
  set(key: string, value: unknown) { this.values.set(key, value); }
  snapshot(): Record<string, unknown> { return Object.fromEntries(this.values); }
}
