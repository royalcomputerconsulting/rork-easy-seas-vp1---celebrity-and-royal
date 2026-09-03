export const ASK_ALL_OFFERS_MODEL_VERSION = 'v1.0.0-profile-scoped-conversations';
export type ConversationEvidenceKind = 'fact' | 'calculated' | 'estimated' | 'missing' | 'stale';
export interface ConversationSourceReference { id:string; sourceType:'offer'|'booked-offer'|'certificate'|'cruise'|'calendar'|'crew'|'machine'|'weather'|'loyalty'|'system'; label:string; detail:string; evidenceKind:ConversationEvidenceKind; route?:string; }
export interface ConversationScopeSnapshot { ownerKey:string; profileId:string; brand:string; program:string; generatedAt:string; activeOfferRows:number; standaloneOffers:number; bookedOfferRecords:number; certificateRecords:number; cruiseRecords:number; sourceFreshness:'current'|'mixed'|'stale'|'unknown'; }
export interface ConversationMessageRecord { id:string; role:'user'|'assistant'; content:string; timestamp:string; sourceReferences:ConversationSourceReference[]; feedback?:'up'|'down'|null; }
export interface ConversationThread { id:string; title:string; createdAt:string; updatedAt:string; archivedAt:string|null; scope:ConversationScopeSnapshot; messages:ConversationMessageRecord[]; lastQuestion:string|null; }
export interface AskAllOffersOwnerScope { authenticatedEmail:string|null|undefined; profileId:string; brand:string; program:string; }
