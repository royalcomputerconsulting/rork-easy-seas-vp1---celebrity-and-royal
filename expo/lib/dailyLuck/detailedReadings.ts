export interface DetailedWesternReading {
  coreTheme: string;
  coreDescription: string;
  career: string;
  careerTranslation: string;
  relationships: string;
  relationshipsAdvice: string;
  mentalState: string[];
  mentalSummary: string;
}

export interface DetailedChineseReading {
  coreTheme: string;
  coreDescription: string;
  dangerNote: string;
  workStructure: string;
  workTranslation: string;
  money: string;
  moneyNote: string;
  relationships: string;
  closingAdvice: string;
}

export interface TarotDayArc {
  morning: { card: string; label: string; meaning: string; implication: string };
  midday: { card: string; label: string; meaning: string; implication: string };
  evening: { card: string; label: string; meaning: string; implication: string };
}

export interface FinalLuckCalc {
  westernScore: number;
  chineseScore: number;
  tarotScore: number;
  total: number;
  maxTotal: number;
  luckNumber: number;
  luckNumberMeaning: string;
  favors: string[];
  punishes: string[];
  finalRead: string;
}

const WESTERN_ELEMENTS: Record<string, { element: string; quality: string; ruler: string }> = {
  aries: { element: 'fire', quality: 'forward motion, instinct', ruler: 'Mars' },
  taurus: { element: 'earth', quality: 'stability, patience', ruler: 'Venus' },
  gemini: { element: 'air', quality: 'duality, communication', ruler: 'Mercury' },
  cancer: { element: 'water', quality: 'intuition, protection', ruler: 'Moon' },
  leo: { element: 'fire', quality: 'confidence, expression', ruler: 'Sun' },
  virgo: { element: 'earth', quality: 'precision, analysis', ruler: 'Mercury' },
  libra: { element: 'air', quality: 'balance, diplomacy', ruler: 'Venus' },
  scorpio: { element: 'water', quality: 'intensity, transformation', ruler: 'Pluto' },
  sagittarius: { element: 'fire', quality: 'expansion, optimism', ruler: 'Jupiter' },
  capricorn: { element: 'earth', quality: 'discipline, ambition', ruler: 'Saturn' },
  aquarius: { element: 'air', quality: 'innovation, independence', ruler: 'Uranus' },
  pisces: { element: 'water', quality: 'imagination, empathy', ruler: 'Neptune' },
};

const CHINESE_ELEMENTS: Record<string, { element: string; quality: string }> = {
  rat: { element: 'Water', quality: 'resourcefulness and quick-wittedness' },
  ox: { element: 'Earth', quality: 'diligence and dependability' },
  tiger: { element: 'Wood', quality: 'courage and magnetic leadership' },
  rabbit: { element: 'Wood', quality: 'gentleness and perception' },
  dragon: { element: 'Earth', quality: 'power and auspicious fortune' },
  snake: { element: 'Fire', quality: 'wisdom and strategic intuition' },
  horse: { element: 'Fire', quality: 'energy and adventurous spirit' },
  goat: { element: 'Earth', quality: 'artistry and compassion' },
  monkey: { element: 'Metal', quality: 'cleverness and adaptability' },
  rooster: { element: 'Metal', quality: 'precision, discipline, pattern recognition' },
  dog: { element: 'Earth', quality: 'loyalty and integrity' },
  pig: { element: 'Water', quality: 'generosity and sincerity' },
};

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

function dateSeed(date: Date): number {
  return (date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()) >>> 0;
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

const CORE_THEMES_HIGH = ['Controlled Power', 'Aligned Momentum', 'Clear Authority', 'Focused Expansion', 'Elevated Confidence'];
const CORE_THEMES_MID = ['Measured Navigation', 'Steady Calibration', 'Patient Strategy', 'Balanced Attention', 'Quiet Positioning'];
const CORE_THEMES_LOW = ['Cautious Restraint', 'Protective Awareness', 'Strategic Withdrawal', 'Grounded Recovery', 'Silent Observation'];

const CHINESE_THEMES_HIGH = ['Precision Over Pride', 'Aligned Discipline', 'Confident Structure', 'Masterful Timing', 'Sharp Awareness'];
const CHINESE_THEMES_MID = ['Observation Over Action', 'Careful Positioning', 'Patient Refinement', 'Quiet Strategy', 'Steady Ground'];
const CHINESE_THEMES_LOW = ['Restraint Over Reaction', 'Guarded Patience', 'Minimal Exposure', 'Silent Strength', 'Defensive Clarity'];

export function getDetailedWesternReading(sign: string, score: number, date: Date): DetailedWesternReading {
  const rand = seededRandom(dateSeed(date) * 31 + 7);
  const info = WESTERN_ELEMENTS[sign] ?? WESTERN_ELEMENTS.aries!;

  const themes = score >= 7 ? CORE_THEMES_HIGH : score >= 4 ? CORE_THEMES_MID : CORE_THEMES_LOW;
  const coreTheme = pick(themes, rand);

  const highEnergy = score >= 7;
  const midEnergy = score >= 4 && score < 7;

  const coreDescription = highEnergy
    ? `There is strong energy today, and it is stable enough to use. Confidence is high, instinct is sharp, and clarity depends on whether you channel it deliberately.`
    : midEnergy
    ? `Energy today is present but requires direction. You will notice opportunities and obstacles in equal measure. The key is knowing which to engage.`
    : `Energy is subdued today. This is not a day for forcing outcomes. Your best moves come from careful observation and selective engagement.`;

  const careerOptions = highEnergy
    ? [
        `Good for finishing, executing, and closing open loops. Financial energy shows opportunity through decisive action, not speculation.`,
        `Strong for leadership moves and strategic decisions. Monetary signals favor calculated risks with clear exit points.`,
        `Ideal for pushing projects forward and locking in commitments. Financial winds favor action over analysis paralysis.`,
      ]
    : midEnergy
    ? [
        `Moderate energy for career moves. Best for planning and positioning rather than bold declarations. Financial energy is neutral — avoid unnecessary spending.`,
        `Steady for incremental progress. Focus on refining existing work rather than starting new initiatives. Money flows are stable but unremarkable.`,
        `Workable for meetings and collaborations. Avoid major financial commitments — today rewards preparation over execution.`,
      ]
    : [
        `Not ideal for career confrontations or risky financial decisions. Focus on maintenance and small improvements.`,
        `Low energy for professional advances. Protect existing positions rather than reaching for new ones. Financial caution is warranted.`,
        `Quiet day professionally. Use it to organize, clean up, and prepare for stronger days ahead.`,
      ];

  const career = pick(careerOptions, rand);

  const careerTranslation = highEnergy
    ? `You can make real progress today, or quietly lose ground through rushed decisions. Choose deliberately.`
    : midEnergy
    ? `Steady hands win today. Do not force what does not naturally move.`
    : `Protect what you have. Advancement comes later — today is for holding ground.`;

  const relOptions = highEnergy
    ? [
        `You may feel driven to lead conversations. Channel ${info.element} energy into clear, direct communication rather than dominance.`,
        `Relationships respond well to confidence today, but not to pressure. Lead with certainty, not control.`,
        `Social energy is high. Use it for connection, not correction. People respond to warmth more than authority today.`,
      ]
    : midEnergy
    ? [
        `You may feel misunderstood or slowed down. The instinct will be to push harder or explain more. That will not work.`,
        `Relationships need patience today. Listen more than you speak. Quiet presence carries more weight than arguments.`,
        `Mixed signals in relationships. Do not over-interpret. Give space where needed and stay present where invited.`,
      ]
    : [
        `Social energy is low. Avoid deep emotional conversations or confrontations. Keep interactions light and brief.`,
        `Relationships may feel distant or strained. This is temporary. Do not make permanent decisions based on temporary feelings.`,
        `Withdraw slightly from draining social situations. Protect your energy for the people and moments that truly matter.`,
      ];

  const relationships = pick(relOptions, rand);
  const relationshipsAdvice = highEnergy
    ? `Today responds to calm, direct, simple communication.`
    : midEnergy
    ? `Patience and listening are your strongest tools today.`
    : `Silence is more powerful than words today. Use it wisely.`;

  const mentalState = highEnergy
    ? ['Fast thinking', 'High tolerance for complexity', 'Strong confidence']
    : midEnergy
    ? ['Moderate focus', 'Variable tolerance', 'Careful optimism']
    : ['Slower processing', 'Low tolerance for noise', 'Guarded energy'];

  const mentalSummary = highEnergy
    ? `You are not wrong, but you are not fully calibrated either. Pause before your biggest decision.`
    : midEnergy
    ? `Your instincts are adequate but not sharp. Double-check before committing to anything significant.`
    : `Mental energy is conserved. Use it for essential decisions only. Everything else can wait.`;

  return { coreTheme, coreDescription, career, careerTranslation, relationships, relationshipsAdvice, mentalState, mentalSummary };
}

export function getDetailedChineseReading(sign: string, score: number, date: Date): DetailedChineseReading {
  const rand = seededRandom(dateSeed(date) * 43 + 11);
  const info = CHINESE_ELEMENTS[sign] ?? CHINESE_ELEMENTS.rooster!;

  const themes = score >= 7 ? CHINESE_THEMES_HIGH : score >= 4 ? CHINESE_THEMES_MID : CHINESE_THEMES_LOW;
  const coreTheme = pick(themes, rand);

  const highEnergy = score >= 7;
  const midEnergy = score >= 4 && score < 7;

  const coreDescription = highEnergy
    ? `Today sharpens your awareness. You will see patterns, inefficiencies, and opportunities more clearly than usual. Your ${info.quality} aligns well with today's energy.`
    : midEnergy
    ? `Today's energy is neutral, requiring your ${info.quality} to navigate carefully. Awareness is moderate — stay attentive to subtle shifts.`
    : `Today's energy resists forcing outcomes. Your ${info.quality} is best applied to protection and observation rather than action.`;

  const dangerNote = highEnergy
    ? `The danger is overreacting to what you see. Today is not about correcting others. It is about positioning yourself.`
    : midEnergy
    ? `The risk is mistaking inaction for weakness. Today rewards careful moves, not stillness.`
    : `The trap is impatience. What feels like stagnation is actually protection. Trust the pause.`;

  const workOptions = highEnergy
    ? [
        `Strong for organizing, refining, improving systems. Not ideal for confrontation or calling people out. Win quietly.`,
        `Excellent for strategic planning and system optimization. Your ${info.element} element supports structured progress.`,
        `Ideal for behind-the-scenes work that positions you for future advantage. Execute with precision, not fanfare.`,
      ]
    : midEnergy
    ? [
        `Moderate for routine work and maintenance. Avoid starting major new projects. Refine what already exists.`,
        `Workable for collaboration if you keep expectations measured. ${info.element} energy supports cooperative effort today.`,
        `Focus on clearing backlogs and organizing. The satisfaction comes from completion, not initiation.`,
      ]
    : [
        `Not a strong work day. Focus on the minimum viable output and preserve energy for better-aligned days.`,
        `Workplace energy is flat. Do what must be done, nothing more. Overextending today creates problems tomorrow.`,
        `Keep work interactions minimal and professional. Today's ${info.element} energy favors solo tasks over team efforts.`,
      ];

  const workStructure = pick(workOptions, rand);
  const workTranslation = highEnergy ? `Win quietly.` : midEnergy ? `Move carefully.` : `Preserve energy.`;

  const money = highEnergy
    ? `Stable and steady with potential for small gains if disciplined. No major losses if you stay within your system.`
    : midEnergy
    ? `Neutral money day. No major gains expected, no losses if careful. Avoid speculative moves.`
    : `Defensive money day. Protect existing positions. This is a "don't mess it up" money day.`;

  const moneyNote = highEnergy
    ? `This is a "capitalize on small wins" money day.`
    : midEnergy
    ? `This is a "hold steady" money day.`
    : `This is a "don't mess it up" money day.`;

  const relOptions = highEnergy
    ? [`Friction may come from tone or critique. Avoid unnecessary commentary. Today rewards observation and restraint.`]
    : midEnergy
    ? [`Relationships are stable but unexciting. Maintain connections without forcing depth. Light touch works best.`]
    : [`Social energy is low. Minimize conflict exposure. If friction arises, step back rather than engage.`];

  const relationships = pick(relOptions, rand);

  const closingAdvice = highEnergy
    ? `Your disciplined nature aligns well with the day's energy. Trust your systems.`
    : midEnergy
    ? `Stay measured. The day rewards patience over initiative.`
    : `Conserve and protect. Better days for action are coming.`;

  return { coreTheme, coreDescription, dangerNote, workStructure, workTranslation, money, moneyNote, relationships, closingAdvice };
}

const TAROT_MORNING_CARDS = [
  { card: 'The Hermit', meaning: 'Step back and think before acting.', implication: 'Your first instinct is not your best move. Your second one is.' },
  { card: 'The High Priestess', meaning: 'Listen to your inner voice.', implication: 'The answer you need is already inside you. Stop looking outward.' },
  { card: 'The Moon', meaning: 'Things are unclear in the early hours.', implication: 'Do not commit to anything until the fog lifts. Wait for clarity.' },
  { card: 'The Star', meaning: 'Hope and renewal guide your morning.', implication: 'Start with optimism. The early hours set the tone for everything that follows.' },
  { card: 'Temperance', meaning: 'Balance your energy before the day begins.', implication: 'Do not rush into the day. Calibrate first, then move.' },
  { card: 'The Hanged Man', meaning: 'A shift in perspective is needed.', implication: 'What you assumed yesterday may not apply today. Look again.' },
  { card: 'Four of Swords', meaning: 'Rest and mental clarity.', implication: 'Your mind needs a moment of quiet before it can serve you well today.' },
  { card: 'Ace of Cups', meaning: 'Emotional openness and new feelings.', implication: 'Begin the day with an open heart. Receptivity brings unexpected gifts.' },
];

const TAROT_MIDDAY_CARDS = [
  { card: 'The Emperor', meaning: 'Structure, authority, control.', implication: 'Once you decide, act clearly and decisively. No emotion, just execution.' },
  { card: 'The Chariot', meaning: 'Willpower and forward momentum.', implication: 'The middle of the day rewards bold, controlled movement. Do not hesitate.' },
  { card: 'Strength', meaning: 'Inner power and patience.', implication: 'You do not need force. Steady confidence carries you through any challenge.' },
  { card: 'The Magician', meaning: 'Manifestation and skill.', implication: 'You have every tool you need. Channel your focus into one clear action.' },
  { card: 'Justice', meaning: 'Fair outcomes through honest action.', implication: 'Make decisions cleanly. The afternoon rewards integrity over cleverness.' },
  { card: 'The Sun', meaning: 'Vitality, success, and clarity.', implication: 'Peak energy arrives midday. Use this window for your most important moves.' },
  { card: 'Knight of Wands', meaning: 'Passionate action and swift movement.', implication: 'The afternoon favors speed and decisiveness. Strike while the energy is hot.' },
  { card: 'Three of Pentacles', meaning: 'Teamwork and skilled collaboration.', implication: 'Your best midday results come through working with others, not alone.' },
];

const TAROT_EVENING_CARDS = [
  { card: 'Two of Wands', meaning: 'A new direction or opportunity appears.', implication: 'This is a setup day. Something small today leads to something bigger.' },
  { card: 'The World', meaning: 'Completion and integration.', implication: 'The day resolves into wholeness. What started rough ends with quiet satisfaction.' },
  { card: 'The Fool', meaning: 'A fresh beginning emerges.', implication: 'The evening opens a door you did not expect. Step through it without overthinking.' },
  { card: 'Ten of Pentacles', meaning: 'Long-term security and legacy.', implication: 'Today\'s small decisions contribute to something much larger. Trust the compound effect.' },
  { card: 'Nine of Cups', meaning: 'Wishes fulfilled and contentment.', implication: 'The day ends better than it began. Allow yourself to enjoy what you have built.' },
  { card: 'Ace of Pentacles', meaning: 'New material opportunity.', implication: 'A seed planted today grows into something tangible. Watch for the opening.' },
  { card: 'Six of Wands', meaning: 'Recognition and victory.', implication: 'The evening brings acknowledgment of your efforts. Accept it gracefully.' },
  { card: 'Page of Cups', meaning: 'Creative inspiration and intuitive message.', implication: 'An insight arrives in the quiet hours. Pay attention to what surfaces naturally.' },
];

export function getTarotDayArc(date: Date): TarotDayArc {
  const rand = seededRandom(dateSeed(date) * 59 + 23);
  const morning = pick(TAROT_MORNING_CARDS, rand);
  const midday = pick(TAROT_MIDDAY_CARDS, rand);
  const evening = pick(TAROT_EVENING_CARDS, rand);
  return {
    morning: { ...morning, label: 'Morning / Internal State' },
    midday: { ...midday, label: 'Midday / Action Phase' },
    evening: { ...evening, label: 'Evening / Outcome' },
  };
}

const LUCK_NUMBER_MEANINGS: Record<number, { meaning: string; favors: string[]; punishes: string[] }> = {
  1: {
    meaning: 'Independence, initiative, self-reliance',
    favors: ['solo decisions', 'first moves', 'setting boundaries'],
    punishes: ['dependency', 'hesitation', 'following the crowd'],
  },
  2: {
    meaning: 'Partnership, balance, patience',
    favors: ['collaboration', 'listening', 'measured responses'],
    punishes: ['impatience', 'going alone', 'forced outcomes'],
  },
  3: {
    meaning: 'Intelligent movement, timing, positioning',
    favors: ['clear thinking', 'strategic action', 'awareness of opportunity'],
    punishes: ['overreaction', 'forcing outcomes', 'unnecessary conflict'],
  },
  4: {
    meaning: 'Foundation, structure, discipline',
    favors: ['building systems', 'routine work', 'organization'],
    punishes: ['shortcuts', 'ignoring details', 'recklessness'],
  },
  5: {
    meaning: 'Change, freedom, adaptability',
    favors: ['flexibility', 'trying new approaches', 'embracing uncertainty'],
    punishes: ['rigidity', 'clinging to plans', 'resistance to change'],
  },
  6: {
    meaning: 'Harmony, responsibility, nurturing',
    favors: ['relationships', 'service to others', 'balanced action'],
    punishes: ['selfishness', 'neglecting commitments', 'emotional avoidance'],
  },
  7: {
    meaning: 'Analysis, introspection, inner wisdom',
    favors: ['deep thinking', 'research', 'trusting intuition'],
    punishes: ['surface-level decisions', 'ignoring gut feelings', 'rushing analysis'],
  },
  8: {
    meaning: 'Power, abundance, manifestation',
    favors: ['financial decisions', 'authority moves', 'confident execution'],
    punishes: ['timidity', 'undervaluing yourself', 'scattered focus'],
  },
  9: {
    meaning: 'Completion, wisdom, humanitarianism',
    favors: ['closing cycles', 'generosity', 'big-picture thinking'],
    punishes: ['pettiness', 'starting new things', 'holding grudges'],
  },
};

function reduceToSingle(n: number): number {
  let val = n;
  while (val > 9) {
    let sum = 0;
    while (val > 0) {
      sum += val % 10;
      val = Math.floor(val / 10);
    }
    val = sum;
  }
  return Math.max(1, Math.min(9, val));
}

export function getFinalLuckCalculation(
  westernScore: number,
  chineseScore: number,
  tarotScore: number,
): FinalLuckCalc {
  const total = westernScore + chineseScore + tarotScore;
  const maxTotal = 27;
  const luckNumber = reduceToSingle(total);
  const info = LUCK_NUMBER_MEANINGS[luckNumber] ?? LUCK_NUMBER_MEANINGS[5]!;

  const highDay = total >= 19;
  const lowDay = total <= 12;

  const finalRead = highDay
    ? `This is a navigation day.\n\nNot a storm.\nNot calm seas.\n\nYou have:\n• enough energy to move forward\n• enough awareness to choose correctly\n• enough momentum to build on\n\nMost people will react today.\n\nIf you:\n• pause first\n• decide cleanly\n• recognize the opening\n\nYou do not just have a good day.\nYou position the next one.`
    : lowDay
    ? `This is a conservation day.\n\nNot a retreat.\nNot a loss.\n\nYou have:\n• enough clarity to avoid mistakes\n• enough restraint to protect your position\n• enough patience to wait for the turn\n\nMost people will push too hard today.\n\nIf you:\n• stay quiet\n• protect your energy\n• watch for the real signal\n\nYou do not just survive today.\nYou set up tomorrow.`
    : `This is a calibration day.\n\nNot full speed.\nNot standing still.\n\nYou have:\n• enough signal to make measured moves\n• enough stability to hold your ground\n• enough instinct to know the difference\n\nMost people will overthink today.\n\nIf you:\n• trust your first clean read\n• act on one thing clearly\n• release what you cannot control\n\nYou do not just get through today.\nYou use it.`;

  return {
    westernScore,
    chineseScore,
    tarotScore,
    total,
    maxTotal,
    luckNumber,
    luckNumberMeaning: info.meaning,
    favors: info.favors,
    punishes: info.punishes,
    finalRead,
  };
}
