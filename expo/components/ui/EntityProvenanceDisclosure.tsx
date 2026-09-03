import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { listProvenanceLinks } from '@/lib/database/HealthTrustDatabase';
import { createProvenance } from '@/lib/provenance/provenance';
import type { DataProvenance, ProvenanceLink } from '@/types/provenance';
import { ProvenanceDisclosure } from '@/components/ui/ProvenanceDisclosure';
import { EASY_SEAS_TOKENS as T } from '@/constants/easySeasDesignSystem';

export function EntityProvenanceDisclosure({
  ownerId,
  entityType,
  entityId,
  field,
  fallback,
  label,
}: {
  ownerId: string | null;
  entityType: ProvenanceLink['entityType'];
  entityId: string;
  field?: string;
  fallback?: Omit<DataProvenance, 'id' | 'isDerived'> & { isDerived?: boolean };
  label?: string;
}) {
  const [value, setValue] = useState<DataProvenance | null>(fallback ? createProvenance(fallback) : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void listProvenanceLinks(ownerId, entityType, entityId, field).then((rows) => {
      if (live && rows[0]) setValue(rows[0]);
    }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [entityId, entityType, field, ownerId]);
  if (!value) return failed ? <View><Text style={{ color: T.color.muted, fontSize: T.type.caption }}>Source evidence will be indexed in the background.</Text></View> : null;
  return <ProvenanceDisclosure provenance={value} label={label} />;
}

