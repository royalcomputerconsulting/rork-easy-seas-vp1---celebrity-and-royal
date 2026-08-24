import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AskAllOffersCompatibilityRoute() {
  const params = useLocalSearchParams<{ prompt?: string; query?: string }>();
  const query = String(params.query || params.prompt || '').trim();
  return <Redirect href={{ pathname: '/ask-my-data', params: query ? { query } : {} } as any} />;
}
