import AsyncStorage from '@react-native-async-storage/async-storage';

export type BookDropPromoState = 'available' | 'reserved' | 'shared' | 'redeemed' | 'unavailable';

export interface BookDropPromoCode {
  code: string;
  url: string;
  state: BookDropPromoState;
}

export interface BookDropShareRecord {
  id: string;
  date: string;
  bookTitle: string;
  recipient: string;
  promoCode?: string;
}

export interface BookDropAuthor {
  name: string;
  email: string;
  phone: string;
  website: string;
}

export interface BookDropState {
  promoStates: Record<string, BookDropPromoState>;
  history: BookDropShareRecord[];
  author: BookDropAuthor;
}

const BOOKDROP_STORAGE_KEY = '@easyseas/bookdrop/v1';

export const DEFAULT_BOOKDROP_STATE: BookDropState = {
  promoStates: {},
  history: [],
  author: { name: 'Scott A. Astin', email: '', phone: '', website: '' },
};

export function parseBookDropPromoCodes(source: string, states: Record<string, BookDropPromoState>): BookDropPromoCode[] {
  return source.split(/\r?\n/).slice(1).flatMap((line) => {
    const fields = line.trim().split(/\s+/);
    const raw = fields[0] ?? '';
    const url = fields.find((field) => field.startsWith('https://')) ?? '';
    const code = raw.replace(/\*/g, '').replace(/\.z$/i, '');
    if (!code || !url) return [];
    const annotated = raw.includes('*') || fields.some((field) => field.toLowerCase() === 'used');
    return [{ code, url, state: states[code] ?? (annotated ? 'unavailable' : 'available') }];
  });
}

export async function loadBookDropState(): Promise<BookDropState> {
  try {
    const raw = await AsyncStorage.getItem(BOOKDROP_STORAGE_KEY);
    if (!raw) return DEFAULT_BOOKDROP_STATE;
    const parsed = JSON.parse(raw) as Partial<BookDropState>;
    return {
      promoStates: parsed.promoStates && typeof parsed.promoStates === 'object' ? parsed.promoStates : {},
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 500) : [],
      author: { ...DEFAULT_BOOKDROP_STATE.author, ...(parsed.author ?? {}) },
    };
  } catch {
    return DEFAULT_BOOKDROP_STATE;
  }
}

export async function saveBookDropState(state: BookDropState): Promise<void> {
  await AsyncStorage.setItem(BOOKDROP_STORAGE_KEY, JSON.stringify({ ...state, history: state.history.slice(0, 500) }));
}

export function buildBookDropVCard(author: BookDropAuthor): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${author.name}`];
  if (author.email.trim()) lines.push(`EMAIL:${author.email.trim()}`);
  if (author.phone.trim()) lines.push(`TEL:${author.phone.trim()}`);
  if (author.website.trim()) lines.push(`URL:${author.website.trim()}`);
  lines.push('NOTE:Author', 'END:VCARD');
  return lines.join('\r\n');
}
