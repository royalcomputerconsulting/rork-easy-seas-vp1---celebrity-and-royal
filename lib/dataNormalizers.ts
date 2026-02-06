import { createDateFromString } from './date';

export interface NormalizationResult<T> {
  value: T;
  wasNormalized: boolean;
  originalValue: unknown;
  issues: string[];
}

const SHIP_NAME_MAP: Record<string, string> = {
  'allure': 'Allure of the Seas',
  'allure of the seas': 'Allure of the Seas',
  'anthem': 'Anthem of the Seas',
  'anthem of the seas': 'Anthem of the Seas',
  'brilliance': 'Brilliance of the Seas',
  'brilliance of the seas': 'Brilliance of the Seas',
  'enchantment': 'Enchantment of the Seas',
  'enchantment of the seas': 'Enchantment of the Seas',
  'explorer': 'Explorer of the Seas',
  'explorer of the seas': 'Explorer of the Seas',
  'freedom': 'Freedom of the Seas',
  'freedom of the seas': 'Freedom of the Seas',
  'grandeur': 'Grandeur of the Seas',
  'grandeur of the seas': 'Grandeur of the Seas',
  'harmony': 'Harmony of the Seas',
  'harmony of the seas': 'Harmony of the Seas',
  'icon': 'Icon of the Seas',
  'icon of the seas': 'Icon of the Seas',
  'independence': 'Independence of the Seas',
  'independence of the seas': 'Independence of the Seas',
  'jewel': 'Jewel of the Seas',
  'jewel of the seas': 'Jewel of the Seas',
  'liberty': 'Liberty of the Seas',
  'liberty of the seas': 'Liberty of the Seas',
  'mariner': 'Mariner of the Seas',
  'mariner of the seas': 'Mariner of the Seas',
  'navigator': 'Navigator of the Seas',
  'navigator of the seas': 'Navigator of the Seas',
  'oasis': 'Oasis of the Seas',
  'oasis of the seas': 'Oasis of the Seas',
  'odyssey': 'Odyssey of the Seas',
  'odyssey of the seas': 'Odyssey of the Seas',
  'ovation': 'Ovation of the Seas',
  'ovation of the seas': 'Ovation of the Seas',
  'quantum': 'Quantum of the Seas',
  'quantum of the seas': 'Quantum of the Seas',
  'radiance': 'Radiance of the Seas',
  'radiance of the seas': 'Radiance of the Seas',
  'rhapsody': 'Rhapsody of the Seas',
  'rhapsody of the seas': 'Rhapsody of the Seas',
  'serenade': 'Serenade of the Seas',
  'serenade of the seas': 'Serenade of the Seas',
  'spectrum': 'Spectrum of the Seas',
  'spectrum of the seas': 'Spectrum of the Seas',
  'symphony': 'Symphony of the Seas',
  'symphony of the seas': 'Symphony of the Seas',
  'utopia': 'Utopia of the Seas',
  'utopia of the seas': 'Utopia of the Seas',
  'vision': 'Vision of the Seas',
  'vision of the seas': 'Vision of the Seas',
  'voyager': 'Voyager of the Seas',
  'voyager of the seas': 'Voyager of the Seas',
  'wonder': 'Wonder of the Seas',
  'wonder of the seas': 'Wonder of the Seas',
};

const PORT_NAME_MAP: Record<string, string> = {
  'ft. lauderdale': 'Fort Lauderdale, FL',
  'ft lauderdale': 'Fort Lauderdale, FL',
  'port everglades': 'Fort Lauderdale, FL',
  'everglades': 'Fort Lauderdale, FL',
  'miami': 'Miami, FL',
  'cape canaveral': 'Cape Canaveral, FL',
  'port canaveral': 'Cape Canaveral, FL',
  'canaveral': 'Cape Canaveral, FL',
  'orlando': 'Cape Canaveral, FL',
  'tampa': 'Tampa, FL',
  'galveston': 'Galveston, TX',
  'new orleans': 'New Orleans, LA',
  'nola': 'New Orleans, LA',
  'seattle': 'Seattle, WA',
  'los angeles': 'Los Angeles, CA',
  'la': 'Los Angeles, CA',
  'san pedro': 'Los Angeles, CA',
  'long beach': 'Long Beach, CA',
  'san juan': 'San Juan, PR',
  'puerto rico': 'San Juan, PR',
  'bayonne': 'Bayonne, NJ',
  'cape liberty': 'Cape Liberty, NJ',
  'new jersey': 'Cape Liberty, NJ',
  'new york': 'Cape Liberty, NJ',
  'nyc': 'Cape Liberty, NJ',
  'baltimore': 'Baltimore, MD',
  'nassau': 'Nassau, Bahamas',
  'cozumel': 'Cozumel, Mexico',
  'costa maya': 'Costa Maya, Mexico',
  'progreso': 'Progreso, Mexico',
  'roatan': 'Roatan, Honduras',
  'belize': 'Belize City, Belize',
  'grand cayman': 'George Town, Grand Cayman',
  'cayman': 'George Town, Grand Cayman',
  'jamaica': 'Falmouth, Jamaica',
  'falmouth': 'Falmouth, Jamaica',
  'labadee': 'Labadee, Haiti',
  'labadi': 'Labadee, Haiti',
  'st thomas': 'St. Thomas, USVI',
  'st. thomas': 'St. Thomas, USVI',
  'charlotte amalie': 'St. Thomas, USVI',
  'st maarten': 'Philipsburg, St. Maarten',
  'st. maarten': 'Philipsburg, St. Maarten',
  'sint maarten': 'Philipsburg, St. Maarten',
  'philipsburg': 'Philipsburg, St. Maarten',
  'san francisco': 'San Francisco, CA',
  'sf': 'San Francisco, CA',
  'honolulu': 'Honolulu, HI',
  'hawaii': 'Honolulu, HI',
  'vancouver': 'Vancouver, BC',
  'barcelona': 'Barcelona, Spain',
  'rome': 'Civitavecchia (Rome), Italy',
  'civitavecchia': 'Civitavecchia (Rome), Italy',
  'southampton': 'Southampton, UK',
  'london': 'Southampton, UK',
};

const CABIN_TYPE_MAP: Record<string, string> = {
  'interior': 'Interior',
  'inside': 'Interior',
  'int': 'Interior',
  'oceanview': 'Oceanview',
  'ocean view': 'Oceanview',
  'ocean': 'Oceanview',
  'ov': 'Oceanview',
  'balcony': 'Balcony',
  'bal': 'Balcony',
  'blc': 'Balcony',
  'suite': 'Suite',
  'ste': 'Suite',
  'js': 'Junior Suite',
  'junior suite': 'Junior Suite',
  'gs': 'Grand Suite',
  'grand suite': 'Grand Suite',
  'os': 'Owner\'s Suite',
  'owners suite': 'Owner\'s Suite',
  'owner\'s suite': 'Owner\'s Suite',
  'rl': 'Royal Loft Suite',
  'royal loft': 'Royal Loft Suite',
};

export function normalizeDate(value: unknown): NormalizationResult<string> {
  const issues: string[] = [];
  let wasNormalized = false;
  
  if (!value) {
    return {
      value: '',
      wasNormalized: false,
      originalValue: value,
      issues: ['Empty date value'],
    };
  }

  const strValue = String(value).trim();
  
  try {
    const parsedDate = createDateFromString(strValue);
    if (!isNaN(parsedDate.getTime())) {
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsedDate.getDate()).padStart(2, '0');
      const year = String(parsedDate.getFullYear());
      const normalizedValue = `${month}-${day}-${year}`;
      wasNormalized = normalizedValue !== strValue;
      return {
        value: normalizedValue,
        wasNormalized,
        originalValue: value,
        issues,
      };
    }
  } catch {
    issues.push(`Failed to parse date: ${strValue}`);
  }

  return {
    value: strValue,
    wasNormalized: false,
    originalValue: value,
    issues: [...issues, 'Could not normalize date format'],
  };
}

export function normalizeCurrency(value: unknown): NormalizationResult<number> {
  const issues: string[] = [];
  
  if (value === null || value === undefined || value === '') {
    return {
      value: 0,
      wasNormalized: false,
      originalValue: value,
      issues: ['Empty currency value'],
    };
  }

  if (typeof value === 'number') {
    return {
      value: Math.round(value * 100) / 100,
      wasNormalized: false,
      originalValue: value,
      issues: [],
    };
  }

  const strValue = String(value).trim();
  const cleaned = strValue
    .replace(/[$€£¥]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  const numValue = parseFloat(cleaned);
  
  if (isNaN(numValue)) {
    issues.push(`Invalid currency value: ${strValue}`);
    return {
      value: 0,
      wasNormalized: true,
      originalValue: value,
      issues,
    };
  }

  return {
    value: Math.round(numValue * 100) / 100,
    wasNormalized: cleaned !== strValue,
    originalValue: value,
    issues,
  };
}

export function normalizeShipName(value: unknown): NormalizationResult<string> {
  if (!value) {
    return {
      value: '',
      wasNormalized: false,
      originalValue: value,
      issues: ['Empty ship name'],
    };
  }

  const strValue = String(value).trim();
  const lowercase = strValue.toLowerCase();
  
  if (SHIP_NAME_MAP[lowercase]) {
    return {
      value: SHIP_NAME_MAP[lowercase],
      wasNormalized: SHIP_NAME_MAP[lowercase] !== strValue,
      originalValue: value,
      issues: [],
    };
  }

  for (const [key, normalizedName] of Object.entries(SHIP_NAME_MAP)) {
    if (lowercase.includes(key)) {
      return {
        value: normalizedName,
        wasNormalized: true,
        originalValue: value,
        issues: [],
      };
    }
  }

  const titleCase = strValue.replace(/\b\w/g, l => l.toUpperCase());
  return {
    value: titleCase,
    wasNormalized: titleCase !== strValue,
    originalValue: value,
    issues: [],
  };
}

export function normalizePortName(value: unknown): NormalizationResult<string> {
  if (!value) {
    return {
      value: '',
      wasNormalized: false,
      originalValue: value,
      issues: ['Empty port name'],
    };
  }

  const strValue = String(value).trim();
  const lowercase = strValue.toLowerCase();
  
  if (PORT_NAME_MAP[lowercase]) {
    return {
      value: PORT_NAME_MAP[lowercase],
      wasNormalized: PORT_NAME_MAP[lowercase] !== strValue,
      originalValue: value,
      issues: [],
    };
  }

  for (const [key, normalizedName] of Object.entries(PORT_NAME_MAP)) {
    if (lowercase.includes(key)) {
      return {
        value: normalizedName,
        wasNormalized: true,
        originalValue: value,
        issues: [],
      };
    }
  }

  const titleCase = strValue.replace(/\b\w/g, l => l.toUpperCase());
  return {
    value: titleCase,
    wasNormalized: titleCase !== strValue,
    originalValue: value,
    issues: [],
  };
}

export function normalizeCabinType(value: unknown): NormalizationResult<string> {
  if (!value) {
    return {
      value: '',
      wasNormalized: false,
      originalValue: value,
      issues: ['Empty cabin type'],
    };
  }

  const strValue = String(value).trim();
  const lowercase = strValue.toLowerCase();
  
  if (CABIN_TYPE_MAP[lowercase]) {
    return {
      value: CABIN_TYPE_MAP[lowercase],
      wasNormalized: CABIN_TYPE_MAP[lowercase] !== strValue,
      originalValue: value,
      issues: [],
    };
  }

  const titleCase = strValue.replace(/\b\w/g, l => l.toUpperCase());
  return {
    value: titleCase,
    wasNormalized: titleCase !== strValue,
    originalValue: value,
    issues: [],
  };
}

export function normalizeNights(value: unknown): NormalizationResult<number> {
  if (value === null || value === undefined || value === '') {
    return {
      value: 0,
      wasNormalized: false,
      originalValue: value,
      issues: ['Empty nights value'],
    };
  }

  if (typeof value === 'number') {
    return {
      value: Math.max(0, Math.round(value)),
      wasNormalized: value !== Math.round(value),
      originalValue: value,
      issues: [],
    };
  }

  const strValue = String(value).trim();
  const cleaned = strValue.replace(/[^\d]/g, '');
  const numValue = parseInt(cleaned, 10);
  
  if (isNaN(numValue)) {
    return {
      value: 0,
      wasNormalized: true,
      originalValue: value,
      issues: [`Invalid nights value: ${strValue}`],
    };
  }

  return {
    value: Math.max(0, numValue),
    wasNormalized: true,
    originalValue: value,
    issues: [],
  };
}

export function normalizePoints(value: unknown): NormalizationResult<number> {
  if (value === null || value === undefined || value === '') {
    return {
      value: 0,
      wasNormalized: false,
      originalValue: value,
      issues: [],
    };
  }

  if (typeof value === 'number') {
    return {
      value: Math.max(0, Math.round(value)),
      wasNormalized: value !== Math.round(value),
      originalValue: value,
      issues: [],
    };
  }

  const strValue = String(value).trim();
  const cleaned = strValue.replace(/,/g, '').replace(/\s/g, '');
  const numValue = parseFloat(cleaned);
  
  if (isNaN(numValue)) {
    return {
      value: 0,
      wasNormalized: true,
      originalValue: value,
      issues: [`Invalid points value: ${strValue}`],
    };
  }

  return {
    value: Math.max(0, Math.round(numValue)),
    wasNormalized: true,
    originalValue: value,
    issues: [],
  };
}

export function normalizeDestination(value: unknown): NormalizationResult<string> {
  if (!value) {
    return {
      value: '',
      wasNormalized: false,
      originalValue: value,
      issues: ['Empty destination'],
    };
  }

  const strValue = String(value).trim();
  
  const destinationMap: Record<string, string> = {
    'caribbean': 'Caribbean',
    'western caribbean': 'Western Caribbean',
    'eastern caribbean': 'Eastern Caribbean',
    'southern caribbean': 'Southern Caribbean',
    'bahamas': 'Bahamas',
    'bermuda': 'Bermuda',
    'alaska': 'Alaska',
    'mexico': 'Mexican Riviera',
    'mexican riviera': 'Mexican Riviera',
    'mediterranean': 'Mediterranean',
    'europe': 'Europe',
    'hawaii': 'Hawaii',
    'transatlantic': 'Transatlantic',
    'pacific': 'Pacific',
    'asia': 'Asia',
    'australia': 'Australia',
    'new zealand': 'Australia & New Zealand',
  };

  const lowercase = strValue.toLowerCase();
  for (const [key, normalized] of Object.entries(destinationMap)) {
    if (lowercase.includes(key)) {
      return {
        value: normalized,
        wasNormalized: normalized !== strValue,
        originalValue: value,
        issues: [],
      };
    }
  }

  const titleCase = strValue.replace(/\b\w/g, l => l.toUpperCase());
  return {
    value: titleCase,
    wasNormalized: titleCase !== strValue,
    originalValue: value,
    issues: [],
  };
}

export interface CruiseNormalizationReport {
  totalFields: number;
  normalizedFields: number;
  issues: { field: string; issue: string }[];
}

export function normalizeCruiseData<T extends Record<string, unknown>>(
  cruise: T
): { normalized: T; report: CruiseNormalizationReport } {
  const report: CruiseNormalizationReport = {
    totalFields: 0,
    normalizedFields: 0,
    issues: [],
  };

  const normalized = { ...cruise };

  if ('sailDate' in cruise) {
    report.totalFields++;
    const result = normalizeDate(cruise.sailDate);
    (normalized as Record<string, unknown>).sailDate = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'sailDate', issue }));
  }

  if ('returnDate' in cruise) {
    report.totalFields++;
    const result = normalizeDate(cruise.returnDate);
    (normalized as Record<string, unknown>).returnDate = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'returnDate', issue }));
  }

  if ('shipName' in cruise) {
    report.totalFields++;
    const result = normalizeShipName(cruise.shipName);
    (normalized as Record<string, unknown>).shipName = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'shipName', issue }));
  }

  if ('departurePort' in cruise) {
    report.totalFields++;
    const result = normalizePortName(cruise.departurePort);
    (normalized as Record<string, unknown>).departurePort = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'departurePort', issue }));
  }

  if ('destination' in cruise) {
    report.totalFields++;
    const result = normalizeDestination(cruise.destination);
    (normalized as Record<string, unknown>).destination = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'destination', issue }));
  }

  if ('cabinType' in cruise) {
    report.totalFields++;
    const result = normalizeCabinType(cruise.cabinType);
    (normalized as Record<string, unknown>).cabinType = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'cabinType', issue }));
  }

  if ('price' in cruise) {
    report.totalFields++;
    const result = normalizeCurrency(cruise.price);
    (normalized as Record<string, unknown>).price = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'price', issue }));
  }

  if ('nights' in cruise) {
    report.totalFields++;
    const result = normalizeNights(cruise.nights);
    (normalized as Record<string, unknown>).nights = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'nights', issue }));
  }

  if ('earnedPoints' in cruise) {
    report.totalFields++;
    const result = normalizePoints(cruise.earnedPoints);
    (normalized as Record<string, unknown>).earnedPoints = result.value;
    if (result.wasNormalized) report.normalizedFields++;
    result.issues.forEach(issue => report.issues.push({ field: 'earnedPoints', issue }));
  }

  return { normalized, report };
}
