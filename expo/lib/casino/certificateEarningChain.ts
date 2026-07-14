export function linkCertificateToEarningCruise(input: { certificateCode?: string; bookedCruise?: Record<string, unknown>; completedCruises?: Record<string, unknown>[] }) {
  const code = String(input.certificateCode ?? input.bookedCruise?.instantCertificateOfferCode ?? input.bookedCruise?.offerCode ?? '').toUpperCase();
  const matches = (input.completedCruises ?? []).filter(cruise => String(cruise.instantCertificateOfferCode ?? cruise.offerCode ?? '').toUpperCase() === code);
  return { certificateCode: code || null, likelyEarningCruise: matches[0] ?? null, confidence: matches.length ? 'medium' : 'low', warnings: matches.length ? [] : ['No completed cruise could be confidently linked to this certificate yet.'] };
}
