import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { quotaSafeGetItem, quotaSafeSetJsonItem } from '@/lib/storage/quotaSafeStorage';
import createContextHook from '@nkzw/create-context-hook';
import { getUserScopedKey, STORAGE_KEYS } from '@/lib/storage/storageKeys';
import { useAuth } from './AuthProvider';

export interface AskAllOffersScope {
  profileId: string;
  brand: string;
  program: string;
}

export interface AskAllOffersSourceCard {
  id: string;
  type: 'offer' | 'cruise' | 'certificate' | 'loyalty' | 'calendar' | 'weather' | 'casino';
  title: string;
  subtitle: string;
  route?: string;
  evidenceStatus: 'verified' | 'partial' | 'stale' | 'missing';
}

export interface AskAllOffersConversation {
  id: string;
  title: string;
  scope: AskAllOffersScope;
  ownerEmail: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface AskAllOffersMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sources?: AskAllOffersSourceCard[];
  evidenceStatus?: 'verified' | 'partial' | 'missing';
  feedback?: 'helpful' | 'not_helpful';
  retryOfMessageId?: string;
}

interface StoredConversations {
  version: 1;
  conversations: AskAllOffersConversation[];
  messages: AskAllOffersMessage[];
}

interface AskAllOffersState {
  conversations: AskAllOffersConversation[];
  messages: AskAllOffersMessage[];
  isLoading: boolean;
  createConversation: (scope: AskAllOffersScope, title?: string) => AskAllOffersConversation;
  renameConversation: (conversationId: string, title: string) => void;
  archiveConversation: (conversationId: string) => void;
  restoreConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  addMessage: (message: Omit<AskAllOffersMessage, 'id' | 'createdAt'>) => AskAllOffersMessage;
  setMessageFeedback: (messageId: string, feedback: 'helpful' | 'not_helpful') => void;
}

const EMPTY_STORED_CONVERSATIONS: StoredConversations = {
  version: 1,
  conversations: [],
  messages: [],
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseStoredConversations(value: string | null): StoredConversations {
  if (!value) return EMPTY_STORED_CONVERSATIONS;

  try {
    const parsed = JSON.parse(value) as Partial<StoredConversations>;
    if (!Array.isArray(parsed.conversations) || !Array.isArray(parsed.messages)) {
      return EMPTY_STORED_CONVERSATIONS;
    }

    return {
      version: 1,
      conversations: parsed.conversations.filter((conversation): conversation is AskAllOffersConversation => {
        return Boolean(
          conversation
          && typeof conversation.id === 'string'
          && typeof conversation.title === 'string'
          && conversation.scope
          && typeof conversation.scope.profileId === 'string'
          && typeof conversation.scope.brand === 'string'
          && typeof conversation.scope.program === 'string'
        );
      }),
      messages: parsed.messages.filter((message): message is AskAllOffersMessage => {
        return Boolean(
          message
          && typeof message.id === 'string'
          && typeof message.conversationId === 'string'
          && (message.role === 'user' || message.role === 'assistant')
          && typeof message.content === 'string'
        );
      }),
    };
  } catch (error) {
    console.warn('[AskAllOffers] Ignoring unreadable saved conversations:', error);
    return EMPTY_STORED_CONVERSATIONS;
  }
}

export const [AskAllOffersProvider, useAskAllOffers] = createContextHook((): AskAllOffersState => {
  const { authenticatedEmail } = useAuth();
  const storageKey = useMemo(() => getUserScopedKey(STORAGE_KEYS.ASK_ALL_OFFERS_CONVERSATIONS, authenticatedEmail), [authenticatedEmail]);
  const [conversations, setConversations] = useState<AskAllOffersConversation[]>([]);
  const [messages, setMessages] = useState<AskAllOffersMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    hydratedKeyRef.current = null;
    setConversations([]);
    setMessages([]);

    const load = async () => {
      try {
        const stored = parseStoredConversations(await quotaSafeGetItem(storageKey));
        if (!isActive) return;
        setConversations(stored.conversations);
        setMessages(stored.messages);
        hydratedKeyRef.current = storageKey;
      } catch (error) {
        console.warn('[AskAllOffers] Failed loading conversation store:', error);
        if (isActive) {
          hydratedKeyRef.current = storageKey;
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (hydratedKeyRef.current !== storageKey) return;

    const persist = async () => {
      try {
        await quotaSafeSetJsonItem(storageKey, { version: 1, conversations, messages } satisfies StoredConversations);
      } catch (error) {
        console.warn('[AskAllOffers] Failed saving conversation store:', error);
      }
    };

    void persist();
  }, [conversations, messages, storageKey]);

  const createConversation = useCallback((scope: AskAllOffersScope, title = 'New conversation'): AskAllOffersConversation => {
    const now = new Date().toISOString();
    const conversation: AskAllOffersConversation = {
      id: createId('conversation'),
      title,
      scope,
      ownerEmail: authenticatedEmail?.toLowerCase().trim() ?? null,
      createdAt: now,
      updatedAt: now,
    };
    setConversations((current) => [conversation, ...current]);
    return conversation;
  }, [authenticatedEmail]);

  const renameConversation = useCallback((conversationId: string, title: string) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    const updatedAt = new Date().toISOString();
    setConversations((current) => current.map((conversation) => conversation.id === conversationId
      ? { ...conversation, title: normalizedTitle, updatedAt }
      : conversation));
  }, []);

  const archiveConversation = useCallback((conversationId: string) => {
    const updatedAt = new Date().toISOString();
    setConversations((current) => current.map((conversation) => conversation.id === conversationId
      ? { ...conversation, updatedAt, archivedAt: updatedAt }
      : conversation));
  }, []);

  const restoreConversation = useCallback((conversationId: string) => {
    const updatedAt = new Date().toISOString();
    setConversations((current) => current.map((conversation) => {
      if (conversation.id !== conversationId) return conversation;
      const { archivedAt: _archivedAt, ...restoredConversation } = conversation;
      return { ...restoredConversation, updatedAt };
    }));
  }, []);

  const deleteConversation = useCallback((conversationId: string) => {
    setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    setMessages((current) => current.filter((message) => message.conversationId !== conversationId));
  }, []);

  const addMessage = useCallback((message: Omit<AskAllOffersMessage, 'id' | 'createdAt'>): AskAllOffersMessage => {
    const createdAt = new Date().toISOString();
    const nextMessage: AskAllOffersMessage = {
      ...message,
      id: createId(message.role),
      createdAt,
    };
    setMessages((current) => [...current, nextMessage]);
    setConversations((current) => current.map((conversation) => conversation.id === message.conversationId
      ? { ...conversation, updatedAt: createdAt }
      : conversation));
    return nextMessage;
  }, []);

  const setMessageFeedback = useCallback((messageId: string, feedback: 'helpful' | 'not_helpful') => {
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, feedback } : message));
  }, []);

  return useMemo(() => ({
    conversations,
    messages,
    isLoading,
    createConversation,
    renameConversation,
    archiveConversation,
    restoreConversation,
    deleteConversation,
    addMessage,
    setMessageFeedback,
  }), [addMessage, archiveConversation, conversations, createConversation, deleteConversation, isLoading, messages, renameConversation, restoreConversation, setMessageFeedback]);
});
