export function parseGmailConnectionToken(value: string): string {
  const trimmed = value.trim();
  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) return trimmed;
  const labeled = trimmed.match(/(?:connectionToken|copyThisValueIntoEasySeas)["'\s:=]+([A-Fa-f0-9]{64})/i)?.[1];
  if (labeled) return labeled;
  const onlyCandidate = trimmed.match(/\b[A-Fa-f0-9]{64}\b/g);
  if (onlyCandidate?.length === 1) return onlyCandidate[0];
  throw new Error('Paste either the 64-character Easy Seas connection token or the full authorizeAndInstall result copied from Google Apps Script.');
}
