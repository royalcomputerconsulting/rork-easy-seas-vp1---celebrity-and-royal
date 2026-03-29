import { parseBirthdate, type HoroscopeLuckResult } from '@/lib/luckCalculator';

export type MomentumLevel = 'slow' | 'steady' | 'explosive';
export type BestMoveType = 'Execute' | 'Wait' | 'Explore' | 'Exit';

export interface ChineseZodiacSection {
  title: 'Chinese Zodiac Reading';
  sign: string;
  score: number;
  scoreText: string;
  personalityAlignment: string;
  tacticalGuidance: string;
  strengthZone: string;
  weaknessZone: string;
  summary: string;
}

export interface WesternZodiacSection {
  title: 'Western Zodiac Reading';
  sign: string;
  score: number;
  scoreText: string;
  emotionalState: string;
  decisionGuidance: string;
  communicationAdvice: string;
  momentumLevel: MomentumLevel;
  summary: string;
}

export interface AlignmentSection {
  title: 'Daily Alignment Reading';
  score: number;
  scoreText: string;
  label: string;
  whyRated: string;
  numerologyDay: number;
  numerologyMeaning: string;
  tarotCard: string;
  tarotInterpretation: string;
  combinedSystemSynthesis: string;
  powerWindow: string;
  luckyColor: string;
  bestMoveType: BestMoveType;
  dangerZone: string;
}

export interface ActionSynthesisSection {
  title: 'AI SYNTHESIS: WHAT YOU SHOULD DO TODAY';
  financialBehavior: string;
  decisionMakingStyle: string;
  riskTolerance: string;
  focusStrategy: string;
  actionSteps: string[];
  summary: string;
}

export interface DailyIntelligenceReading {
  chinese: ChineseZodiacSection;
  western: WesternZodiacSection;
  alignment: AlignmentSection;
  synthesis: ActionSynthesisSection;
}

interface ChineseAnimalProfile {
  core: string;
  strengthZone: string;
  weaknessZone: string;
  highAction: string;
  steadyAction: string;
  lowAction: string;
}

interface WesternSignProfile {
  core: string;
  highState: string;
  steadyState: string;
  lowState: string;
  highDecision: string;
  steadyDecision: string;
  lowDecision: string;
  communication: string;
}

interface NumerologyProfile {
  label: string;
  meaning: string;
  guidance: string;
}

interface TarotProfile {
  name: string;
  meaning: string;
  highRelevance: string;
  steadyRelevance: string;
  lowRelevance: string;
}

const CHINESE_ELEMENTS = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water'] as const;

const CHINESE_PROFILES: Record<string, ChineseAnimalProfile> = {
  Rat: {
    core: 'Your edge is pattern recognition, social timing, and seeing openings early.',
    strengthZone: 'Negotiation, networking, quick pivots, deal scouting',
    weaknessZone: 'Scattered priorities, gossip loops, overcommitting to weak leads',
    highAction: 'Work the room, gather signal fast, and convert the clearest opening before momentum cools.',
    steadyAction: 'Stay selective, compare options, and commit only after the second signal confirms the first.',
    lowAction: 'Protect information, skip noisy environments, and delay decisions that depend on unreliable people.',
  },
  Ox: {
    core: 'Your edge is endurance, stable execution, and calm pressure.',
    strengthZone: 'Long-form tasks, operational cleanup, follow-through, logistics',
    weaknessZone: 'Rigidity, moving too slowly, absorbing avoidable burdens',
    highAction: 'Advance the serious plan, formalize commitments, and use consistency as leverage.',
    steadyAction: 'Keep the cadence steady, remove friction, and let proof outrank persuasion.',
    lowAction: 'Do less, simplify the workload, and refuse responsibilities that are not clearly yours.',
  },
  Tiger: {
    core: 'Your edge is courage, visible leadership, and attacking hesitation.',
    strengthZone: 'Bold starts, public presence, decisive intervention, first moves',
    weaknessZone: 'Impulse, ego contests, forcing action before facts are ready',
    highAction: 'Take the lead, cut through delay, and move first where the upside is visible.',
    steadyAction: 'Use strength with restraint, test the field, and strike only once the target is clear.',
    lowAction: 'Stand down from conflict, avoid reactive bets, and let urgency expire before choosing.',
  },
  Rabbit: {
    core: 'Your edge is emotional intelligence, diplomacy, and creating smooth lanes.',
    strengthZone: 'Relationship repair, soft influence, timing-sensitive conversations, aesthetics',
    weaknessZone: 'Avoidance, indirectness, preserving comfort over clarity',
    highAction: 'Use grace as strategy, open the right conversation, and convert trust into practical progress.',
    steadyAction: 'Keep the tone warm but clear, and resolve one important relationship issue cleanly.',
    lowAction: 'Avoid appeasing everyone, skip passive decisions, and protect your energy from demanding people.',
  },
  Dragon: {
    core: 'Your edge is scale, confidence, and pulling attention toward what matters.',
    strengthZone: 'Leadership, launching, influence, high-visibility asks',
    weaknessZone: 'Overreach, grand gestures without execution, dominating the room',
    highAction: 'Make the visible move, claim territory, and back ambition with crisp execution.',
    steadyAction: 'Aim high but narrow the scope, and support every claim with evidence.',
    lowAction: 'Do not chase validation, avoid oversized promises, and keep the plan lean.',
  },
  Snake: {
    core: 'Your edge is precision, strategic patience, and reading what others miss.',
    strengthZone: 'Research, private planning, risk filtering, negotiation leverage',
    weaknessZone: 'Over-calculation, secrecy that blocks trust, suspicion spirals',
    highAction: 'Use discretion, take the information advantage, and act once the board is mapped.',
    steadyAction: 'Study first, reveal only what is needed, and make one intelligent adjustment at a time.',
    lowAction: 'Do not spiral in analysis, avoid shadowboxing with imagined threats, and ask for missing facts directly.',
  },
  Horse: {
    core: 'Your edge is speed, independence, and pushing movement into stagnant situations.',
    strengthZone: 'Momentum, travel, outreach, visible progress, quick execution',
    weaknessZone: 'Restlessness, abandoning process, outrunning details',
    highAction: 'Move fast on the clean path, capitalize on momentum, and keep decisions lightweight.',
    steadyAction: 'Channel energy into one active lane and keep a practical checkpoint before each pivot.',
    lowAction: 'Slow the pace, resist escape behavior, and finish the current task before opening another.',
  },
  Goat: {
    core: 'Your edge is refinement, intuition, and shaping calmer conditions around you.',
    strengthZone: 'Creative planning, care work, curation, building supportive alliances',
    weaknessZone: 'Mood-driven choices, softness around weak boundaries, avoidance of hard calls',
    highAction: 'Use taste and emotional intelligence to position yourself where support compounds.',
    steadyAction: 'Keep the day simple, choose the best-fit environment, and work with people who are already aligned.',
    lowAction: 'Protect your boundaries, avoid guilt-based commitments, and do not finance someone else’s chaos.',
  },
  Monkey: {
    core: 'Your edge is wit, adaptability, and turning complexity into advantage.',
    strengthZone: 'Problem-solving, improvisation, deal making, fast learning',
    weaknessZone: 'Trickster energy, inconsistency, treating serious calls like games',
    highAction: 'Use creativity aggressively, connect unusual dots, and turn volatility into edge.',
    steadyAction: 'Stay clever but disciplined, and verify details before you scale the move.',
    lowAction: 'Avoid clever shortcuts, stop multitasking, and do not make promises you have not modeled.',
  },
  Rooster: {
    core: 'Your edge is precision, standards, and putting structure around chaos.',
    strengthZone: 'Detail work, quality control, scheduling, direct feedback',
    weaknessZone: 'Perfection loops, needless criticism, friction caused by overcorrecting others',
    highAction: 'Lead with facts, sequence the day tightly, and make the clean ask before the room gets noisy.',
    steadyAction: 'Narrow the field, verify details once, and back the option with the strongest logistics.',
    lowAction: 'Reduce exposure, skip reactive criticism, and avoid decisions that rely on shaky execution.',
  },
  Dog: {
    core: 'Your edge is loyalty, judgment, and protecting what actually matters.',
    strengthZone: 'Trust decisions, ethics checks, defense, long-term loyalty plays',
    weaknessZone: 'Cynicism, carrying other people’s problems, moral fatigue',
    highAction: 'Back the right people, make the principled decision, and use honesty as leverage.',
    steadyAction: 'Stay practical, verify motives, and support only what has earned your energy.',
    lowAction: 'Do not rescue everyone, avoid adversarial conversations, and keep your standards private but firm.',
  },
  Pig: {
    core: 'Your edge is generosity, calm persistence, and attracting easier collaboration.',
    strengthZone: 'Relationship building, comfort-based sales, hospitality, recovery',
    weaknessZone: 'Overindulgence, weak filters, saying yes because it feels pleasant',
    highAction: 'Use warmth strategically, let ease work for you, and choose the path with strong reciprocity.',
    steadyAction: 'Keep the environment calm, manage resources carefully, and say yes only where trust is already real.',
    lowAction: 'Avoid comfort spending, emotional eating, and the easy option that creates tomorrow’s mess.',
  },
};

const WESTERN_PROFILES: Record<string, WesternSignProfile> = {
  Aries: {
    core: 'Your instinct is to move first and break stagnation.',
    highState: 'Energy is amplified and impatience can be productive if it is pointed at one real target.',
    steadyState: 'Drive is present, but it works best with discipline instead of raw force.',
    lowState: 'Your system wants action, but the day punishes speed without proof.',
    highDecision: 'Make the call once the facts are 80% clear and do not reopen it out of nerves.',
    steadyDecision: 'Choose the direct path, but build in one verification point before you commit.',
    lowDecision: 'Use a two-step decision process and let someone else pressure-test the idea first.',
    communication: 'Speak plainly, cut filler, and make requests with a clear desired outcome.',
  },
  Taurus: {
    core: 'Your instinct is to stabilize value and protect what lasts.',
    highState: 'Calm confidence becomes attractive leverage today.',
    steadyState: 'You can move the day forward through patience and steady standards.',
    lowState: 'You may cling to comfort even when adjustment is required.',
    highDecision: 'Back durable options, especially where quality and payoff are measurable.',
    steadyDecision: 'Take the practical route and avoid paying extra for speed you do not need.',
    lowDecision: 'Delay big commitments until conditions feel cleaner and less emotionally charged.',
    communication: 'Be warm, concise, and specific about expectations, budgets, and timing.',
  },
  Gemini: {
    core: 'Your instinct is to gather signal fast and connect ideas on the fly.',
    highState: 'Mental speed is high and your range becomes an advantage.',
    steadyState: 'You are sharp enough to adapt, but need filters to avoid dispersion.',
    lowState: 'Noise can feel like opportunity when it is really just noise.',
    highDecision: 'Run fast comparisons and choose the option with the best information edge.',
    steadyDecision: 'Keep two options alive, then close the weaker one once data improves.',
    lowDecision: 'Do not decide mid-conversation; capture options and review them in silence first.',
    communication: 'Ask precise questions, summarize back what you heard, and keep messages short.',
  },
  Cancer: {
    core: 'Your instinct is to read emotional undercurrents and protect the inner circle.',
    highState: 'Sensitivity becomes strategic awareness instead of drag.',
    steadyState: 'You can guide the day well if you keep your own mood regulated.',
    lowState: 'Personal reactions can distort the actual signal.',
    highDecision: 'Choose the option that feels emotionally clean and operationally stable.',
    steadyDecision: 'Decide after rest, not during emotional spikes.',
    lowDecision: 'Avoid decisions made to restore comfort in the moment.',
    communication: 'Use calm, direct language and name what you need without apology.',
  },
  Leo: {
    core: 'Your instinct is to lead visibly and raise the temperature in the room.',
    highState: 'Presence is strong and your confidence has traction.',
    steadyState: 'You can influence outcomes if performance is backed by substance.',
    lowState: 'The need to be seen may outrun the quality of the move.',
    highDecision: 'Choose the option where your leadership clearly changes the outcome.',
    steadyDecision: 'Be bold, but define success in measurable terms first.',
    lowDecision: 'Avoid ego-driven plays and any commitment made mainly to impress.',
    communication: 'Be generous, specific, and confident without overexplaining your importance.',
  },
  Virgo: {
    core: 'Your instinct is to refine, diagnose, and improve systems.',
    highState: 'Analysis is crisp and practical, giving you a real execution edge.',
    steadyState: 'Precision helps, but over-editing will waste the window.',
    lowState: 'The urge to perfect things can delay good decisions.',
    highDecision: 'Choose what is clean, repeatable, and easiest to execute under pressure.',
    steadyDecision: 'Set a decision deadline and stop polishing once the essential facts are in.',
    lowDecision: 'Do not over-research small calls; conserve precision for what materially matters.',
    communication: 'Be exact, but keep feedback useful instead of clinical.',
  },
  Libra: {
    core: 'Your instinct is to balance interests and keep conditions socially workable.',
    highState: 'Charm and judgment combine well today.',
    steadyState: 'You can broker useful outcomes if you do not dilute the message.',
    lowState: 'Trying to please everyone weakens your position.',
    highDecision: 'Choose the path that preserves leverage and keeps the relationship usable.',
    steadyDecision: 'Use a fairness filter, but do not confuse politeness with alignment.',
    lowDecision: 'If the room is split, delay the call until motives are clearer.',
    communication: 'Be elegant and direct; one clear sentence is stronger than soft ambiguity.',
  },
  Scorpio: {
    core: 'Your instinct is to look under the surface and act from conviction.',
    highState: 'Intensity is useful and your read on hidden motives is sharper than usual.',
    steadyState: 'You have depth, but need restraint to keep it strategic.',
    lowState: 'Suspicion can harden into self-created conflict.',
    highDecision: 'Make the move only after you know what others are not saying.',
    steadyDecision: 'Trust your instincts, then force them through a factual filter.',
    lowDecision: 'Avoid irreversible calls made in reaction to incomplete information.',
    communication: 'Say less, mean it, and do not hint when you can state the point cleanly.',
  },
  Sagittarius: {
    core: 'Your instinct is to expand, test limits, and chase the bigger horizon.',
    highState: 'Optimism has propulsion and can open real doors.',
    steadyState: 'The day rewards movement, but not careless excess.',
    lowState: 'Freedom seeking can become avoidance of detail.',
    highDecision: 'Back the growth move if the logistics can actually support it.',
    steadyDecision: 'Say yes to upside, but pin down cost, time, and exit conditions first.',
    lowDecision: 'Avoid big leaps that depend on hope more than evidence.',
    communication: 'Keep it candid, upbeat, and anchored in real commitments.',
  },
  Capricorn: {
    core: 'Your instinct is to structure ambition and convert pressure into output.',
    highState: 'Authority and discipline are well supported today.',
    steadyState: 'You can build steadily if you avoid making everything heavy.',
    lowState: 'Control instincts may create drag and unnecessary defensiveness.',
    highDecision: 'Favor moves that compound over time and improve your position structurally.',
    steadyDecision: 'Choose the durable option, then pace it realistically.',
    lowDecision: 'Do not lock into a hard line too early; keep room to adapt.',
    communication: 'Be measured, clear, and specific about standards and accountability.',
  },
  Aquarius: {
    core: 'Your instinct is to innovate, detach, and spot the non-obvious angle.',
    highState: 'Original thinking is highly usable right now.',
    steadyState: 'You can solve creatively if you stay connected to practical reality.',
    lowState: 'Detachment may read as indifference and weaken coordination.',
    highDecision: 'Choose the unconventional route when it clearly improves efficiency.',
    steadyDecision: 'Experiment, but keep one stable fallback in place.',
    lowDecision: 'Avoid decisions made mainly to reject convention; usefulness matters more than novelty.',
    communication: 'Be concise, smart, and explicit about the practical upside.',
  },
  Pisces: {
    core: 'Your instinct is to sense tone, imagine possibilities, and move with softness.',
    highState: 'Intuition is strong and can guide excellent timing.',
    steadyState: 'Sensitivity helps if you anchor it in facts and boundaries.',
    lowState: 'Blurred boundaries can turn empathy into confusion.',
    highDecision: 'Follow the option that feels both intuitive and operationally clean.',
    steadyDecision: 'Pause, ground, and decide only after emotion and logistics tell the same story.',
    lowDecision: 'Do not commit because something feels magical or because you want rescue energy.',
    communication: 'Stay gentle but explicit; say what is true before the mood shifts.',
  },
};

const NUMEROLOGY_PROFILES: Record<number, NumerologyProfile> = {
  1: {
    label: 'Initiation',
    meaning: 'Day 1 favors starts, identity, and clear directional choices.',
    guidance: 'Act with ownership, but do not confuse movement with strategy.',
  },
  2: {
    label: 'Calibration',
    meaning: 'Day 2 emphasizes partnership, timing, and emotional intelligence.',
    guidance: 'Let alignment, not speed, decide the move.',
  },
  3: {
    label: 'Expression',
    meaning: 'Day 3 rewards visibility, communication, and social momentum.',
    guidance: 'Your best leverage comes from message quality and presence.',
  },
  4: {
    label: 'Foundation',
    meaning: 'Day 4 favors order, systems, logistics, and disciplined follow-through.',
    guidance: 'Build the structure before you scale the ambition.',
  },
  5: {
    label: 'Change',
    meaning: 'Day 5 increases volatility, movement, and opportunity hidden inside disruption.',
    guidance: 'Stay adaptive, but keep hard limits around risk.',
  },
  6: {
    label: 'Responsibility',
    meaning: 'Day 6 emphasizes care, stewardship, and decisions that affect other people.',
    guidance: 'Choose what holds up relationally as well as financially.',
  },
  7: {
    label: 'Insight',
    meaning: 'Day 7 rewards reflection, analysis, and separating signal from performance.',
    guidance: 'Research first, then act with precision.',
  },
  8: {
    label: 'Power',
    meaning: 'Day 8 favors money decisions, leverage, execution, and measurable advancement.',
    guidance: 'Use authority efficiently and demand real return on effort.',
  },
  9: {
    label: 'Completion',
    meaning: 'Day 9 closes cycles, clarifies what no longer fits, and rewards clean endings.',
    guidance: 'Finish, release, and consolidate before opening a new chapter.',
  },
};

const TAROT_ARCHETYPES: Record<number, TarotProfile> = {
  1: {
    name: 'The Magician',
    meaning: 'resource alignment, skill, and controlled execution',
    highRelevance: 'Execution is favored when you use your tools deliberately instead of improvising wildly.',
    steadyRelevance: 'Progress comes from disciplined use of the skills and relationships already in hand.',
    lowRelevance: 'Potential exists, but forcing outcomes without clean setup will waste it.',
  },
  2: {
    name: 'The High Priestess',
    meaning: 'discernment, quiet intelligence, and timing',
    highRelevance: 'Private insight gives you an edge and helps you act before others understand the field.',
    steadyRelevance: 'The best move is informed patience, not visible pressure.',
    lowRelevance: 'Silence is useful only if it leads to clarity instead of passive delay.',
  },
  3: {
    name: 'The Empress',
    meaning: 'growth, nourishment, and compounding value',
    highRelevance: 'The day supports moves that create comfort, loyalty, and long-term return.',
    steadyRelevance: 'Sustainable progress comes from improving conditions, not squeezing harder.',
    lowRelevance: 'Overindulgence or excess softness can weaken otherwise good opportunities.',
  },
  4: {
    name: 'The Emperor',
    meaning: 'order, authority, and structure under pressure',
    highRelevance: 'Strong leadership and clean rules amplify outcomes today.',
    steadyRelevance: 'The right boundaries and systems matter more than charisma.',
    lowRelevance: 'Rigid control will create resistance if you refuse to adapt.',
  },
  5: {
    name: 'The Hierophant',
    meaning: 'frameworks, tradition, and tested wisdom',
    highRelevance: 'The strongest move is the one that respects proven process.',
    steadyRelevance: 'Borrow from what already works instead of inventing a harder route.',
    lowRelevance: 'Blindly following the script will not save a weak situation.',
  },
  6: {
    name: 'The Lovers',
    meaning: 'alignment, values, and meaningful choice',
    highRelevance: 'Decisions gain power when motive, relationship, and action all match.',
    steadyRelevance: 'Choose the option that is both attractive and ethically stable.',
    lowRelevance: 'Avoid confusing desire with long-term fit.',
  },
  7: {
    name: 'The Chariot',
    meaning: 'direction, will, and controlled momentum',
    highRelevance: 'Momentum favors the disciplined operator who keeps the lane narrow.',
    steadyRelevance: 'You can win by staying on course and refusing distraction.',
    lowRelevance: 'Pushing harder without traction only creates fatigue.',
  },
  8: {
    name: 'Strength',
    meaning: 'self-command, composure, and influence without force',
    highRelevance: 'Calm restraint becomes a competitive advantage.',
    steadyRelevance: 'The day responds best to pressure applied with emotional control.',
    lowRelevance: 'Raw force or visible frustration will undercut you.',
  },
  9: {
    name: 'The Hermit',
    meaning: 'clarity, review, and intelligent withdrawal from noise',
    highRelevance: 'Strategic solitude sharpens your read and improves your final move.',
    steadyRelevance: 'Insight matters more than pace; step back to improve the line.',
    lowRelevance: 'Withdrawal becomes avoidance if you use it to dodge a necessary decision.',
  },
};

const ALIGNMENT_LABELS: Record<number, string> = {
  1: 'Rough',
  2: 'Challenging',
  3: 'Difficult',
  4: 'Mixed',
  5: 'Neutral',
  6: 'Good',
  7: 'Favorable',
  8: 'Very Lucky',
  9: 'Extremely Lucky',
};

const LUCKY_COLORS = ['Obsidian', 'Pearl', 'Rose Gold', 'Emerald', 'Sapphire', 'Amber', 'Ivory', 'Cobalt', 'Champagne'] as const;

function sumDigits(value: number): number {
  return Math.abs(value)
    .toString()
    .split('')
    .reduce((total, digit) => total + Number(digit), 0);
}

function reduceToDigit(value: number): number {
  let nextValue = Math.abs(value);
  while (nextValue > 9) {
    nextValue = sumDigits(nextValue);
  }
  return Math.max(1, nextValue);
}

function getChineseElement(year: number): string {
  const index = ((year - 4) % 10 + 10) % 10;
  return CHINESE_ELEMENTS[index];
}

function getNumerologyDay(targetDate: Date): number {
  return reduceToDigit(sumDigits(targetDate.getFullYear()) + (targetDate.getMonth() + 1) + targetDate.getDate());
}

function formatHourLabel(hour24: number): string {
  const normalizedHour = ((hour24 % 24) + 24) % 24;
  const period = normalizedHour >= 12 ? 'PM' : 'AM';
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${displayHour} ${period}`;
}

function getPowerWindow(targetDate: Date, westernScore: number, chineseScore: number): string {
  const startHour = ((targetDate.getDate() + westernScore + chineseScore) % 10) + 8;
  const duration = westernScore >= 7 ? 3 : 2;
  return `${formatHourLabel(startHour)} – ${formatHourLabel(startHour + duration)}`;
}

function getChineseProfile(animal: string): ChineseAnimalProfile {
  return CHINESE_PROFILES[animal] ?? CHINESE_PROFILES.Rooster;
}

function getWesternProfile(sign: string): WesternSignProfile {
  return WESTERN_PROFILES[sign] ?? WESTERN_PROFILES.Aries;
}

function getMomentumLevel(score: number): MomentumLevel {
  if (score >= 8) {
    return 'explosive';
  }
  if (score <= 4) {
    return 'slow';
  }
  return 'steady';
}

function getBestMoveType(combinedScore: number, numerologyDay: number): BestMoveType {
  if (combinedScore <= 2) {
    return 'Exit';
  }
  if (combinedScore <= 4) {
    return 'Wait';
  }
  if (combinedScore >= 7 || numerologyDay === 8 || numerologyDay === 1) {
    return 'Execute';
  }
  return 'Explore';
}

function getTarotProfile(targetDate: Date, numerologyDay: number, combinedScore: number): TarotProfile {
  const tarotIndex = ((numerologyDay + targetDate.getDay() + combinedScore - 1) % 9) + 1;
  return TAROT_ARCHETYPES[tarotIndex] ?? TAROT_ARCHETYPES[1];
}

function getLuckyColor(targetDate: Date, combinedScore: number, numerologyDay: number): string {
  const index = (targetDate.getDay() + combinedScore + numerologyDay) % LUCKY_COLORS.length;
  return LUCKY_COLORS[index] ?? 'Sapphire';
}

function getAlignmentExplanation(
  horoscopeLuck: HoroscopeLuckResult,
  numerologyDay: number,
  bestMoveType: BestMoveType,
): string {
  const chineseSignal = horoscopeLuck.chineseScore >= 7 ? 'supports disciplined action' : horoscopeLuck.chineseScore <= 4 ? 'warns against loose execution' : 'holds a stable baseline';
  const westernSignal = horoscopeLuck.westernScore >= 7 ? 'amplifies personal momentum' : horoscopeLuck.westernScore <= 4 ? 'asks for tighter self-control' : 'keeps the tempo balanced';
  const numerologySignal = NUMEROLOGY_PROFILES[numerologyDay]?.label.toLowerCase() ?? 'balance';

  return `This day rates ${horoscopeLuck.combinedScore}/9 because the Chinese signal ${chineseSignal}, the Western signal ${westernSignal}, and the numerology cycle emphasizes ${numerologySignal}. The combined result favors a ${bestMoveType.toLowerCase()} posture rather than emotional improvisation.`;
}

function getDangerZone(horoscopeLuck: HoroscopeLuckResult, bestMoveType: BestMoveType): string {
  if (bestMoveType === 'Exit') {
    return 'Staying in a weak situation just to avoid admitting it is weak.';
  }
  if (bestMoveType === 'Wait') {
    return 'Confusing urgency with evidence and making a commitment before the data is ready.';
  }
  if (horoscopeLuck.westernScore - horoscopeLuck.chineseScore >= 3) {
    return 'Moving faster than your execution quality can support.';
  }
  if (horoscopeLuck.chineseScore - horoscopeLuck.westernScore >= 3) {
    return 'Over-analyzing a move that only needs a clean decision.';
  }
  return 'Splitting attention across too many targets and weakening your strongest lane.';
}

function getChineseSection(horoscopeLuck: HoroscopeLuckResult, birthYear: number): ChineseZodiacSection {
  const chineseProfile = getChineseProfile(horoscopeLuck.chineseAnimal);
  const chineseType = `${getChineseElement(birthYear)} ${horoscopeLuck.chineseAnimal}`;
  const score = horoscopeLuck.chineseScore;
  const personalityAlignment = score >= 7
    ? `${chineseType} energy is aligned. ${chineseProfile.core}`
    : score <= 4
      ? `${chineseType} energy is present but under friction. ${chineseProfile.core} Today works only if you stay measured.`
      : `${chineseType} energy is balanced. ${chineseProfile.core}`;

  const tacticalGuidance = score >= 7
    ? chineseProfile.highAction
    : score <= 4
      ? chineseProfile.lowAction
      : chineseProfile.steadyAction;

  const summary = score >= 7
    ? `Use ${chineseType.toLowerCase()} precision to make one clean, well-timed move and let structure do the rest.`
    : score <= 4
      ? `Win by reducing noise, lowering exposure, and refusing sloppy commitments.`
      : `Stay disciplined, stay selective, and let timing outrank force.`;

  return {
    title: 'Chinese Zodiac Reading',
    sign: chineseType,
    score,
    scoreText: `${score}/9`,
    personalityAlignment,
    tacticalGuidance,
    strengthZone: chineseProfile.strengthZone,
    weaknessZone: chineseProfile.weaknessZone,
    summary,
  };
}

function getWesternSection(horoscopeLuck: HoroscopeLuckResult): WesternZodiacSection {
  const westernProfile = getWesternProfile(horoscopeLuck.westernSign);
  const score = horoscopeLuck.westernScore;
  const momentumLevel = getMomentumLevel(score);
  const emotionalState = score >= 7
    ? `${westernProfile.highState} ${westernProfile.core}`
    : score <= 4
      ? `${westernProfile.lowState} ${westernProfile.core}`
      : `${westernProfile.steadyState} ${westernProfile.core}`;

  const decisionGuidance = score >= 7
    ? westernProfile.highDecision
    : score <= 4
      ? westernProfile.lowDecision
      : westernProfile.steadyDecision;

  const summary = momentumLevel === 'explosive'
    ? `Act decisively, but keep the lane narrow so speed becomes leverage instead of waste.`
    : momentumLevel === 'slow'
      ? `Use restraint, collect proof, and refuse decisions made under emotional pressure.`
      : `Move with confidence, but let process and verification keep the day clean.`;

  return {
    title: 'Western Zodiac Reading',
    sign: horoscopeLuck.westernSign,
    score,
    scoreText: `${score}/9`,
    emotionalState,
    decisionGuidance,
    communicationAdvice: westernProfile.communication,
    momentumLevel,
    summary,
  };
}

function getAlignmentSection(targetDate: Date, horoscopeLuck: HoroscopeLuckResult): AlignmentSection {
  const numerologyDay = getNumerologyDay(targetDate);
  const tarotProfile = getTarotProfile(targetDate, numerologyDay, horoscopeLuck.combinedScore);
  const bestMoveType = getBestMoveType(horoscopeLuck.combinedScore, numerologyDay);
  const luckyColor = getLuckyColor(targetDate, horoscopeLuck.combinedScore, numerologyDay);
  const powerWindow = getPowerWindow(targetDate, horoscopeLuck.westernScore, horoscopeLuck.chineseScore);
  const numerologyProfile = NUMEROLOGY_PROFILES[numerologyDay] ?? NUMEROLOGY_PROFILES[5];
  const tarotRelevance = horoscopeLuck.combinedScore >= 7
    ? tarotProfile.highRelevance
    : horoscopeLuck.combinedScore <= 4
      ? tarotProfile.lowRelevance
      : tarotProfile.steadyRelevance;
  const label = ALIGNMENT_LABELS[horoscopeLuck.combinedScore] ?? 'Neutral';

  const combinedSystemSynthesis = `The numerology cycle sets the pace, ${tarotProfile.name} defines the posture, and your zodiac scores determine how much force you can safely apply. Together they point toward ${bestMoveType.toLowerCase()} moves that are focused, timed, and reversible if conditions change.`;

  return {
    title: 'Daily Alignment Reading',
    score: horoscopeLuck.combinedScore,
    scoreText: `${horoscopeLuck.combinedScore} – ${label}`,
    label,
    whyRated: getAlignmentExplanation(horoscopeLuck, numerologyDay, bestMoveType),
    numerologyDay,
    numerologyMeaning: `${numerologyProfile.meaning} ${numerologyProfile.guidance}`,
    tarotCard: tarotProfile.name,
    tarotInterpretation: `${tarotProfile.name} represents ${tarotProfile.meaning}. ${tarotRelevance}`,
    combinedSystemSynthesis,
    powerWindow,
    luckyColor,
    bestMoveType,
    dangerZone: getDangerZone(horoscopeLuck, bestMoveType),
  };
}

function getActionSynthesisSection(
  chineseSection: ChineseZodiacSection,
  westernSection: WesternZodiacSection,
  alignmentSection: AlignmentSection,
): ActionSynthesisSection {
  const riskTolerance = alignmentSection.score >= 8
    ? 'Controlled aggressive'
    : alignmentSection.score >= 6
      ? 'Moderate'
      : alignmentSection.score >= 4
        ? 'Low to moderate'
        : 'Low';

  const focusStrategy = alignmentSection.score >= 7 || westernSection.momentumLevel === 'explosive'
    ? 'Single target'
    : 'Multiple small probes';

  const financialBehavior = alignmentSection.bestMoveType === 'Execute'
    ? 'Deploy capital selectively into proven opportunities. Back edge, not emotion.'
    : alignmentSection.bestMoveType === 'Explore'
      ? 'Use small exploratory commitments only. Gather data before sizing up.'
      : alignmentSection.bestMoveType === 'Wait'
        ? 'Preserve liquidity, avoid impulse spending, and make no prestige purchases today.'
        : 'Cut weak exposure, exit sunk-cost thinking, and stop financing low-quality situations.';

  const decisionMakingStyle = westernSection.momentumLevel === 'explosive'
    ? 'Fast, fact-based, and narrow. Decide once, then execute.'
    : westernSection.momentumLevel === 'steady'
      ? 'Two-step. Compare options, choose cleanly, and lock the next action.'
      : 'Measured. Delay irreversible moves until emotion drops and signal improves.';

  const actionSteps: string[] = [
    `Use the ${alignmentSection.powerWindow} power window for your highest-value conversation, reservation, or money move.`,
    `Let ${chineseSection.sign} discipline control execution quality while ${westernSection.sign} energy sets the pace.`,
    `${financialBehavior}`,
    `Avoid the danger zone: ${alignmentSection.dangerZone}`,
  ];

  const summary = alignmentSection.bestMoveType === 'Execute'
    ? 'Press the advantage, but do it with precision, not ego.'
    : alignmentSection.bestMoveType === 'Explore'
      ? 'Probe intelligently, learn fast, and expand only after proof appears.'
      : alignmentSection.bestMoveType === 'Wait'
        ? 'Hold position, improve information quality, and do not pay for uncertainty.'
        : 'Exit what is weak, protect resources, and reset for a cleaner line tomorrow.';

  return {
    title: 'AI SYNTHESIS: WHAT YOU SHOULD DO TODAY',
    financialBehavior,
    decisionMakingStyle,
    riskTolerance,
    focusStrategy,
    actionSteps,
    summary,
  };
}

export function buildDailyIntelligenceReading(
  birthdate: string,
  targetDate: Date,
  horoscopeLuck: HoroscopeLuckResult,
): DailyIntelligenceReading | null {
  const parsedBirthdate = parseBirthdate(birthdate);
  if (!parsedBirthdate) {
    console.warn('[DailyIntelligence] Unable to parse birthdate for intelligence reading', { birthdate });
    return null;
  }

  const chineseSection = getChineseSection(horoscopeLuck, parsedBirthdate.year);
  const westernSection = getWesternSection(horoscopeLuck);
  const alignmentSection = getAlignmentSection(targetDate, horoscopeLuck);
  const synthesisSection = getActionSynthesisSection(chineseSection, westernSection, alignmentSection);

  console.log('[DailyIntelligence] Built premium daily reading', {
    date: targetDate.toISOString(),
    chineseSign: chineseSection.sign,
    chineseScore: chineseSection.score,
    westernSign: westernSection.sign,
    westernScore: westernSection.score,
    alignmentScore: alignmentSection.score,
    bestMoveType: alignmentSection.bestMoveType,
    momentumLevel: westernSection.momentumLevel,
  });

  return {
    chinese: chineseSection,
    western: westernSection,
    alignment: alignmentSection,
    synthesis: synthesisSection,
  };
}
