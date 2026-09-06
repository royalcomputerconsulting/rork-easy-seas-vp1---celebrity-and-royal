import { normalizeCertificateParseDiagnostics } from '@/lib/certificates/certificateParsingStatus';
import { materialCertificateLevelKey } from '@/lib/certificates/certificatePdfParserCore';

export const CERTIFICATE_PARSER_PARITY_VERSION = 'v2.0.0-material-row-reconciliation';

export interface CertificateParserParityResult {
  materiallyConsistent: boolean;
  backendGroups: number;
  deviceGroups: number;
  backendReferences: number;
  deviceReferences: number;
  missingFromBackend: string[];
  missingFromDevice: string[];
  discrepancies: string[];
}

function groupKey(match: any): string {
  return `${String(match?.shipName ?? '').trim().toLowerCase()}__${String(match?.sailDate ?? '').trim()}`;
}

function rowKeys(matches: any[]): Set<string> {
  const keys = new Set<string>();
  matches.forEach((match) => {
    const prefix = groupKey(match);
    (Array.isArray(match?.levels) ? match.levels : []).forEach((level: any) => keys.add(`${prefix}__${materialCertificateLevelKey(level)}`));
  });
  return keys;
}

function referenceCount(matches: any[]): number {
  return matches.reduce((sum, match) => sum + (Array.isArray(match?.levels) ? match.levels.length : 0), 0);
}

export function compareCertificateParserOutputs(backendResult: any, deviceResult: any): CertificateParserParityResult {
  const backendMatches = Array.isArray(backendResult?.matches) ? backendResult.matches : [];
  const deviceMatches = Array.isArray(deviceResult?.matches) ? deviceResult.matches : [];
  const backendKeys = rowKeys(backendMatches);
  const deviceKeys = rowKeys(deviceMatches);
  const missingFromBackend = Array.from(deviceKeys).filter((key) => !backendKeys.has(key)).sort();
  const missingFromDevice = Array.from(backendKeys).filter((key) => !deviceKeys.has(key)).sort();
  const backendReferences = referenceCount(backendMatches);
  const deviceReferences = referenceCount(deviceMatches);
  const discrepancies: string[] = [];
  if (missingFromBackend.length > 0) discrepancies.push(`${missingFromBackend.length} material sailing row${missingFromBackend.length === 1 ? '' : 's'} appear only in device output`);
  if (missingFromDevice.length > 0) discrepancies.push(`${missingFromDevice.length} material sailing row${missingFromDevice.length === 1 ? '' : 's'} appear only in backend output`);
  if (backendReferences !== deviceReferences) discrepancies.push(`Reference count differs: backend ${backendReferences}, device ${deviceReferences}`);

  const backendCatalog = Array.isArray(backendResult?.catalog) ? backendResult.catalog : [];
  const deviceCatalog = Array.isArray(deviceResult?.catalog) ? deviceResult.catalog : [];
  const codes = new Set([...backendCatalog, ...deviceCatalog].map((entry: any) => String(entry?.certificateCode ?? '').toUpperCase()).filter(Boolean));
  for (const code of codes) {
    const backend = backendCatalog.find((entry: any) => String(entry?.certificateCode ?? '').toUpperCase() === code);
    const device = deviceCatalog.find((entry: any) => String(entry?.certificateCode ?? '').toUpperCase() === code);
    if (!backend || !device) {
      discrepancies.push(`${code} missing from ${backend ? 'device' : 'backend'} catalog`);
      continue;
    }
    const backendDiagnostic = normalizeCertificateParseDiagnostics(backend, backendMatches, 'backend');
    const deviceDiagnostic = normalizeCertificateParseDiagnostics(device, deviceMatches, 'direct-device');
    if (backendDiagnostic.status !== deviceDiagnostic.status) discrepancies.push(`${code} status differs: backend ${backendDiagnostic.status}, device ${deviceDiagnostic.status}`);
    if (backend?.documentSha256 && device?.documentSha256 && backend.documentSha256 !== device.documentSha256) discrepancies.push(`${code} PDF SHA-256 differs between backend and device`);
  }

  return {
    materiallyConsistent: discrepancies.length === 0,
    backendGroups: new Set(backendMatches.map(groupKey)).size,
    deviceGroups: new Set(deviceMatches.map(groupKey)).size,
    backendReferences,
    deviceReferences,
    missingFromBackend,
    missingFromDevice,
    discrepancies,
  };
}

export function reconcileCertificateParserOutputs(backendResult: any, deviceResult: any): any {
  const parity = compareCertificateParserOutputs(backendResult, deviceResult);
  const groups = new Map<string, any>();
  const ingest = (result: any, parserSource: 'backend' | 'direct-device') => {
    const matches = Array.isArray(result?.matches) ? result.matches : [];
    matches.forEach((match: any) => {
      const key = groupKey(match);
      const existing = groups.get(key) ?? { shipName: match.shipName, sailDate: match.sailDate, levels: [], decisionGuide: [], opportunities: [] };
      (Array.isArray(match?.levels) ? match.levels : []).forEach((level: any) => {
        const materialKey = materialCertificateLevelKey(level);
        const found = existing.levels.find((candidate: any) => materialCertificateLevelKey(candidate) === materialKey);
        if (found) {
          found.parserSources = Array.from(new Set([...(found.parserSources ?? []), parserSource]));
          found.benefitEvidence = Array.from(new Set([...(found.benefitEvidence ?? []), ...(level.benefitEvidence ?? [])]));
          if (!found.documentSha256 && level.documentSha256) found.documentSha256 = level.documentSha256;
          if (!found.documentArchiveUri && level.documentArchiveUri) found.documentArchiveUri = level.documentArchiveUri;
        } else {
          existing.levels.push({ ...level, parserSources: Array.from(new Set([...(level.parserSources ?? []), parserSource])) });
        }
      });
      existing.parserDiscrepancies = parity.discrepancies;
      groups.set(key, existing);
    });
  };
  ingest(backendResult, 'backend');
  ingest(deviceResult, 'direct-device');

  const catalogMap = new Map<string, any>();
  for (const result of [backendResult, deviceResult]) {
    for (const entry of Array.isArray(result?.catalog) ? result.catalog : []) {
      const code = String(entry?.certificateCode ?? '').toUpperCase();
      if (!code) continue;
      const current = catalogMap.get(code) ?? {};
      catalogMap.set(code, {
        ...current,
        ...entry,
        parserSources: Array.from(new Set([...(current.parserSources ?? []), entry?.parserSource].filter(Boolean))),
        parserParity: parity,
        evidence: Array.from(new Set([...(current.evidence ?? []), ...(entry?.evidence ?? []), ...parity.discrepancies])),
      });
    }
  }
  return { catalog: Array.from(catalogMap.values()), matches: Array.from(groups.values()), parserParity: parity, source: 'reconciled-backend-device' };
}
