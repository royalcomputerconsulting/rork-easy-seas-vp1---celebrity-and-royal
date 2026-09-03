export function clamp(value: number, low = 0, high = 1): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, value));
}

export function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(q) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function median(values: number[]): number | null { return quantile(values, 0.5); }

export function variance(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values) ?? 0;
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
}

export function standardDeviation(values: number[]): number | null {
  const value = variance(values);
  return value === null ? null : Math.sqrt(value);
}

export function robustValues(values: number[]): number[] {
  if (values.length < 5) return [...values];
  const low = quantile(values, 0.1) ?? -Infinity;
  const high = quantile(values, 0.9) ?? Infinity;
  return values.filter(value => value >= low && value <= high);
}

export function wilsonInterval(successes: number, total: number): { low: number; high: number } {
  if (total <= 0) return { low: 0, high: 1 };
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return { low: round(clamp(center - margin)), high: round(clamp(center + margin)) };
}

export function confidenceBand(sampleCount: number, quality: number): 'high' | 'medium' | 'low' | 'missing' {
  if (sampleCount <= 0) return 'missing';
  if (sampleCount >= 8 && quality >= 0.75) return 'high';
  if (sampleCount >= 3 && quality >= 0.5) return 'medium';
  return 'low';
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seedText: string): () => number {
  let state = hashString(seedText) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function stableModelFingerprint(parts: Array<string | number | null | undefined>): string {
  return hashString(parts.map(part => String(part ?? '')).join('|')).toString(16).padStart(8, '0');
}
