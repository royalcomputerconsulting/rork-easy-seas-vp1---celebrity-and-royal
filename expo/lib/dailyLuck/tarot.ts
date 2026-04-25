export interface TarotCard {
  name: string;
  arcana: 'major' | 'minor';
  suit?: string;
  uprightMeaning: string;
  casinoReading: string;
  luckModifier: number;
}

const MAJOR_ARCANA: TarotCard[] = [
  { name: 'The Fool', arcana: 'major', uprightMeaning: 'New beginnings, spontaneity, a leap of faith', casinoReading: 'Beginner\'s luck is real today. Try something new — a fresh table or an unfamiliar game may surprise you.', luckModifier: 1 },
  { name: 'The Magician', arcana: 'major', uprightMeaning: 'Manifestation, resourcefulness, skill', casinoReading: 'Your skills are sharp and your timing is on. Channel focus into your best game and trust your reads.', luckModifier: 2 },
  { name: 'The High Priestess', arcana: 'major', uprightMeaning: 'Intuition, mystery, inner knowledge', casinoReading: 'Trust quiet instincts over loud impulses. Your gut read at the table is worth more than any system today.', luckModifier: 1 },
  { name: 'The Empress', arcana: 'major', uprightMeaning: 'Abundance, nurturing, fertility', casinoReading: 'Abundance energy flows freely. Play with generosity of spirit and let wins accumulate naturally.', luckModifier: 2 },
  { name: 'The Emperor', arcana: 'major', uprightMeaning: 'Authority, structure, discipline', casinoReading: 'Structure is your friend. Set firm limits early and play within your system — discipline wins today.', luckModifier: 1 },
  { name: 'The Hierophant', arcana: 'major', uprightMeaning: 'Tradition, guidance, established methods', casinoReading: 'Stick to proven strategies and familiar games. Tradition and method carry more weight than innovation today.', luckModifier: 0 },
  { name: 'The Lovers', arcana: 'major', uprightMeaning: 'Choice, alignment, partnerships', casinoReading: 'Choose your games wisely — alignment matters. A partner at the table or a shared bet could amplify fortune.', luckModifier: 1 },
  { name: 'The Chariot', arcana: 'major', uprightMeaning: 'Determination, victory, willpower', casinoReading: 'Victory through willpower and focus. Stay the course when others waver — controlled aggression pays today.', luckModifier: 2 },
  { name: 'Strength', arcana: 'major', uprightMeaning: 'Courage, patience, compassion', casinoReading: 'Steady and patient energy leads to quiet wins. Strength isn\'t about force — it\'s about holding your nerve.', luckModifier: 1 },
  { name: 'The Hermit', arcana: 'major', uprightMeaning: 'Soul-searching, introspection, solitude', casinoReading: 'Play solo and trust your own analysis. Crowd energy is misleading today — find your quiet edge.', luckModifier: -1 },
  { name: 'Wheel of Fortune', arcana: 'major', uprightMeaning: 'Luck, cycles, turning point', casinoReading: 'The Wheel spins in your favor. This is one of the highest luck cards — fortune is actively turning toward you.', luckModifier: 3 },
  { name: 'Justice', arcana: 'major', uprightMeaning: 'Fairness, truth, cause and effect', casinoReading: 'Fair outcomes follow honest play. Don\'t push edges you shouldn\'t — clean decisions return clean results.', luckModifier: 0 },
  { name: 'The Hanged Man', arcana: 'major', uprightMeaning: 'Pause, surrender, new perspective', casinoReading: 'Pause before committing. A brief wait reveals a better angle — the best move today may be no move at all.', luckModifier: -1 },
  { name: 'Death', arcana: 'major', uprightMeaning: 'Endings, transformation, transition', casinoReading: 'An old pattern ends and a new one begins. Release any fixed strategy today — transformation brings fresh opportunity.', luckModifier: 0 },
  { name: 'Temperance', arcana: 'major', uprightMeaning: 'Balance, moderation, patience', casinoReading: 'Moderation is your power today. Blend patience and action in equal measure — neither extreme serves you.', luckModifier: 1 },
  { name: 'The Devil', arcana: 'major', uprightMeaning: 'Shadow, restriction, materialism', casinoReading: 'Watch for traps disguised as opportunities. Avoid chasing losses or breaking your own limits today.', luckModifier: -2 },
  { name: 'The Tower', arcana: 'major', uprightMeaning: 'Sudden change, upheaval, revelation', casinoReading: 'Volatility is high. Short bursts of play over long sessions — the energy is unpredictable and fast-moving.', luckModifier: -1 },
  { name: 'The Star', arcana: 'major', uprightMeaning: 'Hope, renewal, inspiration', casinoReading: 'Hope is working for you. One of the most auspicious cards — play with optimism and let the stars guide your timing.', luckModifier: 2 },
  { name: 'The Moon', arcana: 'major', uprightMeaning: 'Illusion, fear, the subconscious', casinoReading: 'Things are not as they appear. Avoid overconfidence and read the table carefully — surface appearances deceive today.', luckModifier: -1 },
  { name: 'The Sun', arcana: 'major', uprightMeaning: 'Success, vitality, joy', casinoReading: 'Radiant fortune energy. The Sun is one of the luckiest cards in the deck — play with joy and expect bright outcomes.', luckModifier: 3 },
  { name: 'Judgement', arcana: 'major', uprightMeaning: 'Reflection, reckoning, awakening', casinoReading: 'Clear assessment leads to better results. Review your session honestly — a fresh approach reveals the right next move.', luckModifier: 1 },
  { name: 'The World', arcana: 'major', uprightMeaning: 'Completion, integration, accomplishment', casinoReading: 'The cycle completes in your favor. Full-circle energy — a natural peak is nearby. Move with confidence toward closure.', luckModifier: 2 },
];

function dateHash(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return (y * 10000 + m * 100 + d) >>> 0;
}

export function getTarotCardForDate(date: Date): TarotCard {
  const hash = dateHash(date);
  const index = hash % MAJOR_ARCANA.length;
  return MAJOR_ARCANA[index] ?? MAJOR_ARCANA[0]!;
}
