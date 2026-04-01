interface MaskSensitiveMemberNumberOptions {
  reveal?: boolean;
}

export function maskSensitiveMemberNumber(
  value: string | null | undefined,
  fallback = 'Not set',
  options?: MaskSensitiveMemberNumberOptions,
): string {
  if (!value || !String(value).trim()) {
    return fallback;
  }

  if (options?.reveal) {
    return String(value).trim();
  }

  return 'Hidden for privacy';
}
