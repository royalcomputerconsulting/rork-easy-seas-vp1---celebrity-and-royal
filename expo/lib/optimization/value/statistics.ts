export function clamp(value: number, minimum = 0, maximum = 1): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function quantile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(percentile) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function confidenceFromEvidence(evidenceCount: number, completeness: number): 'high' | 'medium' | 'low' | 'missing' {
  if (evidenceCount <= 0 || completeness <= 0) return 'missing';
  if (evidenceCount >= 8 && completeness >= 0.8) return 'high';
  if (evidenceCount >= 3 && completeness >= 0.55) return 'medium';
  return 'low';
}

export function stableValueId(parts: Array<string | number | null | undefined>): string {
  let hash = 2166136261;
  const text = parts.map(part => String(part ?? '')).join('|');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
