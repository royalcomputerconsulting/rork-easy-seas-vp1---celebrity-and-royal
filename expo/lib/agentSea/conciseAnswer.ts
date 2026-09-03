export function splitConciseFirstAgentSeaAnswer(answer: string, softLimit = 850): { content: string; supportingDetails?: string } {
  const normalized = answer.trim();
  if (normalized.length <= softLimit) return { content: normalized };
  const blocks = normalized.split(/\n(?=\S)/).filter(Boolean);
  const visible: string[] = [];
  let visibleLength = 0;
  for (const block of blocks) {
    if (visible.length >= 8 || (visible.length > 0 && visibleLength + block.length > softLimit)) break;
    visible.push(block);
    visibleLength += block.length + 1;
  }
  if (visible.length === 0) visible.push(normalized.slice(0, softLimit));
  const content = visible.join('\n').trim();
  const supportingDetails = normalized.slice(content.length).trim();
  return supportingDetails ? { content, supportingDetails } : { content };
}
