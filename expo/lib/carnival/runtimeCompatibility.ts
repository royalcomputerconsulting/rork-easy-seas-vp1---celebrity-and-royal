export type CarnivalRuntimeCompatibilityState =
  | 'ready'
  | 'authentication_required'
  | 'challenge_detected'
  | 'unsupported_layout'
  | 'invalid_origin';

export interface CarnivalRuntimeProbe {
  url?: unknown;
  loggedIn?: unknown;
  challengeDetected?: unknown;
  profileSignals?: unknown;
  offerSignals?: unknown;
  evidence?: unknown;
  observedAt?: unknown;
}

export interface CarnivalRuntimeCompatibility {
  state: CarnivalRuntimeCompatibilityState;
  canIngest: boolean;
  reason: string;
  evidence: string[];
  observedAt: string;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)));
}

function isCarnivalOrigin(value: unknown): boolean {
  try {
    const hostname = new URL(String(value ?? '')).hostname.toLowerCase();
    return hostname === 'carnival.com' || hostname.endsWith('.carnival.com');
  } catch {
    return false;
  }
}

function observedAt(value: unknown): string {
  const parsed = new Date(String(value ?? '')).getTime();
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

/**
 * Accepts a deliberately small WebView probe rather than page HTML, cookies,
 * or provider tokens. A changed page or anti-bot challenge must stop the
 * collector and leave a resumable checkpoint instead of guessing at markup.
 */
export function assessCarnivalRuntimeCompatibility(probe: CarnivalRuntimeProbe): CarnivalRuntimeCompatibility {
  const evidence = textList(probe.evidence);
  const timestamp = observedAt(probe.observedAt);
  if (!isCarnivalOrigin(probe.url)) {
    return {
      state: 'invalid_origin',
      canIngest: false,
      reason: 'Carnival sync only accepts a confirmed carnival.com page.',
      evidence,
      observedAt: timestamp,
    };
  }
  if (probe.challengeDetected === true) {
    return {
      state: 'challenge_detected',
      canIngest: false,
      reason: 'Carnival requires verification in the browser. Complete it there, then retry without bypassing the challenge.',
      evidence,
      observedAt: timestamp,
    };
  }
  if (probe.loggedIn !== true) {
    return {
      state: 'authentication_required',
      canIngest: false,
      reason: 'Sign in to Carnival in the provider page before collecting data.',
      evidence,
      observedAt: timestamp,
    };
  }
  if (probe.profileSignals !== true && probe.offerSignals !== true) {
    return {
      state: 'unsupported_layout',
      canIngest: false,
      reason: 'Carnival signed in successfully, but the current page layout did not expose a supported profile or offers marker. Use the browser extension/import path and send diagnostics instead of collecting guessed data.',
      evidence,
      observedAt: timestamp,
    };
  }
  return {
    state: 'ready',
    canIngest: true,
    reason: 'Carnival page compatibility was confirmed for this session.',
    evidence,
    observedAt: timestamp,
  };
}

export function mustBlockCarnivalIngestion(compatibility: CarnivalRuntimeCompatibility | null | undefined): boolean {
  return Boolean(compatibility && !compatibility.canIngest);
}
