export function maskSensitiveMemberNumber(value: string | null | undefined, fallback = 'Not set'): string {
  if (!value || !String(value).trim()) {
    return fallback;
  }

  return 'Hidden for privacy';
}
