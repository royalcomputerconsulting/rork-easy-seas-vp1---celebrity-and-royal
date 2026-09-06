import type { ChatMessage } from '@/components/AgentXChat';
import type { ConversationThread } from '@/lib/askAllOffers/types';
import { exportFile } from '@/lib/importExport';
import * as Print from 'expo-print';

export interface AgentSeaConversationLogContext {
  activeConversationId: string | null;
  scopeLabel: string;
  scopeCounts: Record<string, number>;
  aiConnected: boolean;
  aiModel: string;
  providerError: string | null;
  isLoading: boolean;
}

function asIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function serializableMessage(message: ChatMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: asIso(message.timestamp),
    isLoading: Boolean(message.isLoading),
    toolName: message.toolName ?? null,
    toolInput: message.toolInput ?? null,
    contextSummary: message.contextSummary ?? null,
    supportingDetails: message.supportingDetails ?? null,
    sourceReferences: message.sourceReferences ?? [],
    pendingAction: message.pendingAction ?? null,
    actionStatus: message.actionStatus ?? null,
  };
}

function buildDiagnosticTurns(messages: ChatMessage[]) {
  let latestQuestion: ChatMessage | null = null;
  return messages.flatMap((message) => {
    if (message.role === 'user') { latestQuestion = message; return []; }
    if (message.isLoading || !message.content.trim()) return [];
    const question = latestQuestion as ChatMessage | null;
    const sources = message.sourceReferences ?? [];
    const startedAt = question ? new Date(question.timestamp).getTime() : new Date(message.timestamp).getTime();
    const completedAt = new Date(message.timestamp).getTime();
    const errorText = /(?:could not|failed|error|unavailable)/i.test(message.content) ? message.content : null;
    return [{
      question: question?.content ?? null,
      interpretedIntent: message.toolName ?? message.contextSummary ?? 'Conversational owner-scoped data question',
      toolCalls: message.toolName ? [{ name: message.toolName, input: message.toolInput ?? null }] : [],
      recordIds: sources.map((source) => source.id),
      recordCount: sources.length,
      timingMs: Math.max(0, completedAt - startedAt),
      formulas: sources.filter((source) => source.evidenceKind === 'calculated' || /(?:formula|calculation|calculated|estimate)/i.test(source.detail)).map((source) => source.detail),
      sources,
      errors: errorText ? [errorText] : [],
      finalAnswer: message.content,
      supportingDetails: message.supportingDetails ?? null,
    }];
  });
}

export function buildAgentSeaConversationLog(
  messages: ChatMessage[],
  threads: ConversationThread[],
  context: AgentSeaConversationLogContext,
  now = new Date(),
): string {
  const activeThread = threads.find((thread) => thread.id === context.activeConversationId) ?? null;
  return JSON.stringify({
    logType: 'Easy Seas Agent SEA conversation diagnostic',
    schemaVersion: 2,
    exportedAt: now.toISOString(),
    diagnosticContext: context,
    activeConversation: {
      id: context.activeConversationId,
      title: activeThread?.title ?? null,
      createdAt: activeThread?.createdAt ?? null,
      updatedAt: activeThread?.updatedAt ?? null,
      savedScope: activeThread?.scope ?? null,
      messageCount: messages.length,
      messages: messages.map(serializableMessage),
      diagnosticTurns: buildDiagnosticTurns(messages),
    },
    savedConversationIndex: threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      archivedAt: thread.archivedAt,
      messageCount: thread.messages.length,
      lastQuestion: thread.lastQuestion,
    })),
    privacyNote: 'The OpenAI API key is intentionally excluded. User-entered questions and locally cited Easy Seas evidence are included for diagnosis.',
  }, null, 2);
}

export async function exportAgentSeaConversationLog(
  messages: ChatMessage[],
  threads: ConversationThread[],
  context: AgentSeaConversationLogContext,
  now = new Date(),
): Promise<{ fileName: string; exported: boolean; messageCount: number }> {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const fileName = `agent-sea-conversation-${stamp}.json`;
  const exported = await exportFile(buildAgentSeaConversationLog(messages, threads, context, now), fileName);
  return { fileName, exported, messageCount: messages.length };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character));
}

export function buildAgentSeaConversationDocument(messages: ChatMessage[], title = 'Agent SEA Conversation'): string {
  const rows = messages
    .filter((message) => !message.isLoading && message.content.trim().length > 0)
    .map((message) => {
      const role = message.role === 'user' ? 'You' : 'Agent SEA';
    const timestampDate = message.timestamp instanceof Date
      ? message.timestamp
      : new Date(message.timestamp);
    const timestamp = timestampDate.toLocaleString();
      return `<section class="message ${message.role}"><div class="meta">${escapeHtml(role)} · ${escapeHtml(timestamp)}</div><div class="bubble">${escapeHtml(message.content).replace(/\n/g, '<br>')}</div></section>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1C2F7A;margin:28px;background:#fff}h1{font-size:24px}.message{margin:14px 0;page-break-inside:avoid}.meta{font-size:10px;color:#676A70;margin:0 8px 4px}.bubble{display:inline-block;max-width:82%;padding:11px 14px;border-radius:16px;background:#F3F3F2;line-height:1.4}.user{text-align:right}.user .bubble{background:#1C2F7A;color:#fff;text-align:left}.assistant{text-align:left}footer{margin-top:24px;color:#8E8A89;font-size:9px}</style></head><body><h1>${escapeHtml(title)}</h1>${rows || '<p>No messages yet.</p>'}<footer>Saved from Easy Seas Agent SEA.</footer></body></html>`;
}

export async function saveAgentSeaConversation(messages: ChatMessage[], now = new Date()): Promise<boolean> {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const readable = messages
    .filter((message) => !message.isLoading && message.content.trim().length > 0)
    .map((message) => `${message.role === 'user' ? 'YOU' : 'AGENT SEA'} — ${asIso(message.timestamp)}\n${message.content}`)
    .join('\n\n');
  return exportFile(readable, `agent-sea-conversation-${stamp}.txt`);
}

export async function shareAgentSeaConversation(messages: ChatMessage[], now = new Date()): Promise<boolean> {
  return saveAgentSeaConversation(messages, now);
}

export async function printAgentSeaConversation(messages: ChatMessage[]): Promise<void> {
  await Print.printAsync({ html: buildAgentSeaConversationDocument(messages) });
}
