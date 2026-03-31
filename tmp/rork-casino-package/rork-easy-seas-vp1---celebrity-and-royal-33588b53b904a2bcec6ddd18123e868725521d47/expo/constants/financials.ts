export const FINANCIAL_CATEGORIES = {
  CASINO: 'Casino',
  DINING: 'Dining',
  BEVERAGE: 'Beverage',
  SPA: 'Spa',
  SHORE_EXCURSIONS: 'Shore Excursions',
  SPECIALTY_DINING: 'Specialty Dining',
  GIFTS: 'Gifts & Shopping',
  PHOTO: 'Photo',
  INTERNET: 'Internet',
  GRATUITIES: 'Gratuities',
  TAXES: 'Taxes & Fees',
  CRUISE_FARE: 'Cruise Fare',
  DEPOSIT: 'Deposit',
  OTHER: 'Other',
} as const;

export type FinancialCategory = typeof FINANCIAL_CATEGORIES[keyof typeof FINANCIAL_CATEGORIES];

export const CATEGORY_COLORS: Record<string, string> = {
  Casino: '#F59E0B',
  Dining: '#10B981',
  Beverage: '#3B82F6',
  Spa: '#EC4899',
  'Shore Excursions': '#8B5CF6',
  'Specialty Dining': '#14B8A6',
  'Gifts & Shopping': '#F97316',
  Photo: '#6366F1',
  Internet: '#6B7280',
  Gratuities: '#84CC16',
  'Taxes & Fees': '#EF4444',
  'Cruise Fare': '#0EA5E9',
  Deposit: '#22C55E',
  Other: '#9CA3AF',
};

export const DEPARTMENT_MAPPINGS: Record<string, FinancialCategory> = {
  'CASINO': 'Casino',
  'CASINO CAGE': 'Casino',
  'CASINO HOST': 'Casino',
  'MAIN DINING': 'Dining',
  'WINDJAMMER': 'Dining',
  'ROOM SERVICE': 'Dining',
  'CAFE': 'Dining',
  'BAR': 'Beverage',
  'LOUNGE': 'Beverage',
  'POOL BAR': 'Beverage',
  'SPA': 'Spa',
  'FITNESS': 'Spa',
  'SALON': 'Spa',
  'SHORE EX': 'Shore Excursions',
  'EXCURSIONS': 'Shore Excursions',
  'CHOPS': 'Specialty Dining',
  'IZUMI': 'Specialty Dining',
  'GIOVANNIS': 'Specialty Dining',
  'JAMIE\'S': 'Specialty Dining',
  'WONDERLAND': 'Specialty Dining',
  '150 CENTRAL PARK': 'Specialty Dining',
  'GIFT SHOP': 'Gifts & Shopping',
  'LOGO SHOP': 'Gifts & Shopping',
  'JEWELRY': 'Gifts & Shopping',
  'PHOTO': 'Photo',
  'PHOTOS': 'Photo',
  'WIFI': 'Internet',
  'INTERNET': 'Internet',
  'GRATUITY': 'Gratuities',
  'GRATUITIES': 'Gratuities',
  'SERVICE CHARGE': 'Gratuities',
  'PORT FEES': 'Taxes & Fees',
  'TAXES': 'Taxes & Fees',
  'GOV FEES': 'Taxes & Fees',
};

export function normalizeCategory(rawCategory: string): FinancialCategory {
  const upper = rawCategory.toUpperCase().trim();
  
  for (const [pattern, category] of Object.entries(DEPARTMENT_MAPPINGS)) {
    if (upper.includes(pattern)) {
      return category;
    }
  }
  
  return 'Other';
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}

export const CASINO_SUBCATEGORIES = [
  'Slots',
  'Table Games',
  'Poker',
  'Sports Betting',
  'Free Play',
  'Marker',
  'Cash Advance',
] as const;

export const NON_CASINO_CATEGORIES = [
  'Dining',
  'Beverage',
  'Spa',
  'Shore Excursions',
  'Specialty Dining',
  'Gifts & Shopping',
  'Photo',
  'Internet',
  'Gratuities',
] as const;
