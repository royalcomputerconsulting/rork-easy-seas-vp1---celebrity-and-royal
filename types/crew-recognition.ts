export interface CrewMember {
  id: string;
  fullName: string;
  department: string;
  roleTitle?: string;
  notes?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sailing {
  id: string;
  shipName: string;
  sailStartDate: string;
  sailEndDate: string;
  nights?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecognitionEntry {
  id: string;
  crewMemberId: string;
  sailingId: string;
  shipName: string;
  sailStartDate: string;
  sailEndDate: string;
  sailingMonth: string;
  sailingYear: number;
  department: string;
  roleTitle?: string;
  sourceText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecognitionEntryWithCrew extends RecognitionEntry {
  fullName: string;
  crewNotes?: string;
}

export interface SurveyListItem {
  fullName: string;
  department: string;
  roleTitle?: string;
  mentionCount: number;
}

export const DEPARTMENTS = [
  'Casino',
  'Dining',
  'Housekeeping',
  'Guest Relations',
  'Activities',
  'Spa',
  'Retail',
  'Beverage',
  'Loyalty',
  'Public Areas',
  'Other',
] as const;

export type Department = typeof DEPARTMENTS[number];
