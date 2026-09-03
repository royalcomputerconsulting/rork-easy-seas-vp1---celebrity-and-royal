export interface FavoriteStateroomDraft {
  shipName: string;
  stateroomNumber: string;
  deckNumber?: string;
  category?: string;
  locationNotes?: string;
  nearbyAlternatives?: string;
  notes?: string;
}

export interface FavoriteStateroom extends FavoriteStateroomDraft {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
