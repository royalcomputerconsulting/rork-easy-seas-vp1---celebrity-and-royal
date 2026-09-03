import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { BACKEND_API_ROOT_URL } from '@/lib/trpc';

const API_KEY_STORAGE_KEY = 'easyseas_agent_sea_openai_api_key_v2';
const MODEL_STORAGE_KEY = 'easyseas_agent_sea_openai_model_v2';
const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = process.env.EXPO_PUBLIC_AGENT_SEA_MODEL?.trim() || 'gpt-5.5';
const OWNER_EMAIL = (process.env.EXPO_PUBLIC_AGENT_SEA_OWNER_EMAIL?.trim() || 'scott.merlis1@gmail.com').toLowerCase();
const OWNER_PROXY_URL = BACKEND_API_ROOT_URL ? `${BACKEND_API_ROOT_URL}/agent-sea/respond` : '';

export interface AgentSeaAIConfig {
  apiKey: string;
  model: string;
  source: 'device' | 'proxy' | 'none';
  isConfigured: boolean;
  secureStorageAvailable: boolean;
}

export interface AgentSeaAIRequest {
  authenticatedEmail?: string | null;
  question: string;
  systemPrompt: string;
  localEvidence: string;
  conversation?: Array<{ role: 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
}

export interface AgentSeaAIResult {
  text: string | null;
  usedAI: boolean;
  model: string;
  error?: string;
}

function clip(value: string, maximum: number): string {
  return value.length <= maximum
    ? value
    : `${value.slice(0, maximum)}\n[Evidence clipped locally to keep Agent SEA responsive.]`;
}

async function canUseSecureStore(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

function accountStorageKey(base: string, authenticatedEmail?: string | null): string {
  const owner = authenticatedEmail?.trim().toLowerCase() || 'signed-out-device';
  return `${base}:${encodeURIComponent(owner)}`;
}

function mayUseOwnerProxy(authenticatedEmail?: string | null): boolean {
  return Boolean(OWNER_PROXY_URL && authenticatedEmail && authenticatedEmail.trim().toLowerCase() === OWNER_EMAIL);
}

async function readDeviceApiKey(authenticatedEmail?: string | null): Promise<string> {
  const storageKey = accountStorageKey(API_KEY_STORAGE_KEY, authenticatedEmail);
  try {
    if (await canUseSecureStore()) {
      return (await SecureStore.getItemAsync(storageKey))?.trim() || '';
    }
  } catch (error) {
    console.warn('[Agent SEA AI] SecureStore read failed; personal AI is unavailable.', error);
  }
  return '';
}

export async function loadAgentSeaAIConfig(authenticatedEmail?: string | null): Promise<AgentSeaAIConfig> {
  const modelStorageKey = accountStorageKey(MODEL_STORAGE_KEY, authenticatedEmail);
  const [secureStorageAvailable, deviceKey, storedModel] = await Promise.all([
    canUseSecureStore(),
    readDeviceApiKey(authenticatedEmail),
    AsyncStorage.getItem(modelStorageKey).catch(() => null),
  ]);
  const model = storedModel?.trim() || DEFAULT_MODEL;
  if (mayUseOwnerProxy(authenticatedEmail)) {
    return { apiKey: '', model, source: 'proxy', isConfigured: true, secureStorageAvailable };
  }
  if (deviceKey) {
    return { apiKey: deviceKey, model, source: 'device', isConfigured: true, secureStorageAvailable };
  }
  return { apiKey: '', model, source: 'none', isConfigured: false, secureStorageAvailable };
}

export async function saveAgentSeaAIConfig(input: { apiKey: string; model?: string; authenticatedEmail?: string | null }): Promise<AgentSeaAIConfig> {
  const apiKey = input.apiKey.trim();
  const model = input.model?.trim() || DEFAULT_MODEL;
  const apiKeyStorageKey = accountStorageKey(API_KEY_STORAGE_KEY, input.authenticatedEmail);
  const modelStorageKey = accountStorageKey(MODEL_STORAGE_KEY, input.authenticatedEmail);
  const secureStorageAvailable = await canUseSecureStore();
  if (secureStorageAvailable) {
    if (apiKey) await SecureStore.setItemAsync(apiKeyStorageKey, apiKey);
    else await SecureStore.deleteItemAsync(apiKeyStorageKey);
    // Remove the legacy plaintext fallback if an older build created it.
    await AsyncStorage.removeItem(apiKeyStorageKey).catch(() => undefined);
  } else {
    if (apiKey) {
      throw new Error('Secure device storage is unavailable. Agent SEA did not save the API key.');
    }
    // Never retain a provider credential in AsyncStorage, backups, logs, or exports.
    await AsyncStorage.removeItem(apiKeyStorageKey);
  }
  await AsyncStorage.setItem(modelStorageKey, model);
  return loadAgentSeaAIConfig(input.authenticatedEmail);
}

function extractResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === 'string' && record.output_text.trim()) return record.output_text.trim();
  if (!Array.isArray(record.output)) return null;
  const parts: string[] = [];
  for (const outputItem of record.output) {
    if (!outputItem || typeof outputItem !== 'object') continue;
    const content = (outputItem as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== 'object') continue;
      const text = (contentItem as Record<string, unknown>).text;
      if (typeof text === 'string' && text.trim()) parts.push(text.trim());
    }
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
}

function buildInput(request: AgentSeaAIRequest): string {
  const recentConversation = (request.conversation || [])
    .slice(-8)
    .map((message) => `${message.role === 'user' ? 'USER' : 'AGENT SEA'}: ${clip(message.content, 1_500)}`)
    .join('\n\n');
  return [
    'CURRENT USER QUESTION',
    request.question,
    recentConversation ? `RECENT CONVERSATION\n${recentConversation}` : '',
    `LOCAL EASY SEAS EVIDENCE\n${clip(request.localEvidence, 24_000)}`,
    'Answer naturally as a two-way conversation. Directly answer the question in the first sentence. Use the local evidence as the factual source of truth and never replace a deterministic Easy Seas calculation with your own arithmetic. Preserve only the [S#] citations that support the answer. Distinguish recorded facts, calculations, estimates, and missing data. Never invent a reservation, price, sailing, casino result, certificate, weather measurement, or crew record. Do not describe yourself as a database search. Do not list unrelated matches or repeat the complete data inventory. Unless the user requests detail, keep the primary answer under 250 words and offer to expand the evidence.',
  ].filter(Boolean).join('\n\n');
}

async function requestOwnerProxy(request: AgentSeaAIRequest, model: string, signal: AbortSignal): Promise<AgentSeaAIResult> {
  const response = await fetch(OWNER_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      authenticatedEmail: request.authenticatedEmail?.trim().toLowerCase(),
      model,
      instructions: clip(request.systemPrompt, 12_000),
      input: buildInput(request),
    }),
    signal,
  });
  const payload = await response.json().catch(() => null) as { text?: unknown; model?: unknown; error?: unknown } | null;
  const responseModel = typeof payload?.model === 'string' && payload.model.trim() ? payload.model.trim() : model;
  if (!response.ok) {
    return {
      text: null,
      usedAI: false,
      model: responseModel,
      error: typeof payload?.error === 'string' ? payload.error : `Agent SEA AI service failed (${response.status})`,
    };
  }
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  return text
    ? { text, usedAI: true, model: responseModel }
    : { text: null, usedAI: false, model: responseModel, error: 'Agent SEA AI service returned no answer text' };
}

export async function generateAgentSeaAIResponse(request: AgentSeaAIRequest): Promise<AgentSeaAIResult> {
  const config = await loadAgentSeaAIConfig(request.authenticatedEmail);
  if (!config.isConfigured) return { text: null, usedAI: false, model: config.model, error: 'AI key not configured' };

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (request.signal?.aborted) controller.abort();
  else request.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    if (config.source === 'proxy') {
      return await requestOwnerProxy(request, config.model, controller.signal);
    }
    const response = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        instructions: clip(request.systemPrompt, 12_000),
        input: buildInput(request),
        reasoning: { effort: 'medium' },
        text: { verbosity: 'low' },
        max_output_tokens: 900,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const apiError = payload && typeof payload === 'object'
        ? (payload as { error?: { message?: string } }).error?.message
        : null;
      return { text: null, usedAI: false, model: config.model, error: apiError || `OpenAI request failed (${response.status})` };
    }
    const text = extractResponseText(payload);
    return text
      ? { text, usedAI: true, model: config.model }
      : { text: null, usedAI: false, model: config.model, error: 'OpenAI returned no answer text' };
  } catch (error) {
    return {
      text: null,
      usedAI: false,
      model: config.model,
      error: error instanceof Error ? error.message : 'OpenAI request failed',
    };
  } finally {
    clearTimeout(timeout);
    request.signal?.removeEventListener('abort', abortFromCaller);
  }
}
