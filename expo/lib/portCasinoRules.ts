export type PortCasinoDockStatus =
  | 'open-while-docked'
  | 'closed-while-docked'
  | 'sea-day'
  | 'unknown';

export type PortCasinoConfidence = 'very-high' | 'high' | 'medium' | 'low' | 'unknown';

export interface PortCasinoRule {
  status: PortCasinoDockStatus;
  confidence: PortCasinoConfidence;
  source: 'user-confirmed' | 'researched' | 'line-general-rule' | 'derived' | 'unknown';
  label: string;
  notes: string[];
  /** True for private destinations such as CocoCay where the casino does not close just because the ship is docked. */
  continuousWhileDocked?: boolean;
}

const OPEN_WHILE_DOCKED_ALIASES: Record<string, Omit<PortCasinoRule, 'label'>> = {
  'perfect day at cococay': {
    status: 'open-while-docked',
    confidence: 'very-high',
    source: 'user-confirmed',
    continuousWhileDocked: true,
    notes: ['User-confirmed: Royal owns Perfect Day at CocoCay, so the casino does not close just because the ship is docked there.'],
  },
  'cococay': {
    status: 'open-while-docked',
    confidence: 'very-high',
    source: 'user-confirmed',
    continuousWhileDocked: true,
    notes: ['User-confirmed: Royal owns CocoCay, so the casino does not close just because the ship is docked there.'],
  },
  'hideaway beach': {
    status: 'open-while-docked',
    confidence: 'very-high',
    source: 'user-confirmed',
    continuousWhileDocked: true,
    notes: ['User-confirmed: CocoCay/Hideaway Beach days keep casino availability continuous.'],
  },
  'charlotte amalie': {
    status: 'open-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Charlotte Amalie is treated as a casino-open port in EasySeas.'],
  },
  'st thomas': {
    status: 'open-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: St. Thomas/Charlotte Amalie is treated as a casino-open port in EasySeas.'],
  },
  'roatan': {
    status: 'open-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Roatán is treated as a casino-open port in EasySeas.'],
  },
  'roatán': {
    status: 'open-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Roatán is treated as a casino-open port in EasySeas.'],
  },
};

const CLOSED_WHILE_DOCKED_ALIASES: Record<string, Omit<PortCasinoRule, 'label'>> = {
  'san juan': {
    status: 'closed-while-docked',
    confidence: 'very-high',
    source: 'user-confirmed',
    notes: ['User-confirmed: San Juan is treated as closed while docked.'],
  },
  'puerto rico': {
    status: 'closed-while-docked',
    confidence: 'very-high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Puerto Rico/San Juan is treated as closed while docked.'],
  },
  'basseterre': {
    status: 'closed-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Basseterre/St. Kitts is treated as closed while docked.'],
  },
  'st kitts': {
    status: 'closed-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Basseterre/St. Kitts is treated as closed while docked.'],
  },
  'philipsburg': {
    status: 'closed-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Philipsburg/St. Maarten is treated as closed while docked.'],
  },
  'st maarten': {
    status: 'closed-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Philipsburg/St. Maarten is treated as closed while docked.'],
  },
  'sint maarten': {
    status: 'closed-while-docked',
    confidence: 'high',
    source: 'user-confirmed',
    notes: ['User-confirmed: Philipsburg/St. Maarten is treated as closed while docked.'],
  },
};

const SEA_DAY_ALIASES = [
  'at sea',
  'sea day',
  'cruising',
  'marine zone',
  'western atlantic',
  'northwest bahamas',
  'mediterranean sea',
  'atlantic ocean',
];

const RESTRICTED_COUNTRY_ALIASES = [
  'united states',
  'usa',
  'florida',
  'texas',
  'california',
  'washington',
  'alaska',
  'hawaii',
  'canada',
  'british columbia',
  'mexico',
  'spain',
  'portugal',
  'morocco',
  'italy',
  'france',
  'greece',
  'turkey',
];

export const CASINO_DAY1_OPEN_AFTER_SAILAWAY_MINUTES = 60;
export const CASINO_PORT_OPEN_AFTER_SAILAWAY_MINUTES = 60;
export const CASINO_DEFAULT_LATE_CLOSE_TIME = '02:30';
export const CASINO_ALTERNATE_LATE_CLOSE_TIME = '03:00';

function normalize(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findAlias(portName: string, map: Record<string, Omit<PortCasinoRule, 'label'>>): Omit<PortCasinoRule, 'label'> | null {
  const normalizedPort = normalize(portName);
  for (const [alias, rule] of Object.entries(map)) {
    const normalizedAlias = normalize(alias);
    if (normalizedPort === normalizedAlias || normalizedPort.includes(normalizedAlias)) return rule;
  }
  return null;
}

export function getPortCasinoRule(portName?: string | null): PortCasinoRule {
  const normalizedPort = normalize(portName);
  if (!normalizedPort) {
    return {
      status: 'unknown',
      confidence: 'unknown',
      source: 'unknown',
      label: 'Unknown port',
      notes: ['No port was provided, so casino availability must be estimated.'],
    };
  }

  if (SEA_DAY_ALIASES.some(alias => normalizedPort.includes(normalize(alias)))) {
    return {
      status: 'sea-day',
      confidence: 'very-high',
      source: 'line-general-rule',
      label: portName || 'At Sea',
      notes: ['Sea/marine day: casino availability follows at-sea operating pattern.'],
    };
  }

  const openRule = findAlias(normalizedPort, OPEN_WHILE_DOCKED_ALIASES);
  if (openRule) return { ...openRule, label: portName || 'Port' };

  const closedRule = findAlias(normalizedPort, CLOSED_WHILE_DOCKED_ALIASES);
  if (closedRule) return { ...closedRule, label: portName || 'Port' };

  if (RESTRICTED_COUNTRY_ALIASES.some(alias => normalizedPort.includes(normalize(alias)))) {
    return {
      status: 'closed-while-docked',
      confidence: 'medium',
      source: 'derived',
      label: portName || 'Port',
      notes: ['Default researched/legal pattern: casino is closed while docked in this port and reopens after sailaway when allowed.'],
    };
  }

  return {
    status: 'closed-while-docked',
    confidence: 'low',
    source: 'derived',
    label: portName || 'Port',
    notes: ['Unknown port default: assume closed while docked; reopen after sailaway if the ship departs that day.'],
  };
}

export function isCasinoOpenWhileDockedPort(portName?: string | null): boolean {
  return getPortCasinoRule(portName).status === 'open-while-docked';
}

export function isCasinoClosedWhileDockedPort(portName?: string | null): boolean {
  return getPortCasinoRule(portName).status === 'closed-while-docked';
}

export function isCasinoSeaDayPort(portName?: string | null): boolean {
  return getPortCasinoRule(portName).status === 'sea-day';
}

export function getCasinoLateCloseTime(preferThreeAM?: boolean): string {
  return preferThreeAM ? CASINO_ALTERNATE_LATE_CLOSE_TIME : CASINO_DEFAULT_LATE_CLOSE_TIME;
}
