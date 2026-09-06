import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, Copy, Database, Download, Eye, KeyRound, RefreshCcw, ShieldCheck, TriangleAlert, Upload } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/state/AuthProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { useUser } from '@/state/UserProvider';
import { useLoyalty } from '@/state/LoyaltyProvider';
import { EASY_SEAS_TOKENS as T } from '@/constants/easySeasDesignSystem';
import { TYPOGRAPHY } from '@/constants/theme';
import { getDomainMigrationDiagnostics, getHealthTrustDatabase, getMigrationDiagnostics, listAllProvenanceLinks, type DomainMigrationDiagnostic } from '@/lib/database/HealthTrustDatabase';
import { getHighVolumeDefinition } from '@/lib/database/highVolumeRepository';
import { migrateAllHighVolumeDomains, rollbackHighVolumeMigration } from '@/lib/database/highVolumeMigration';
import { applyIntegrityRepair, buildRepairPreview, listIntegrityIssues, listRepairHistory, persistIntegrityIssues, rollbackIntegrityRepair, scanIntegrity, type IntegrityIssue, type RepairHistoryRow } from '@/lib/integrity/integrityCenter';
import { getAllStoredData, importAllData } from '@/lib/dataBundle/bundleOperations';
import { exportUserPreferenceStorage, loadExperiencePreferences, restoreUserPreferenceStorage } from '@/lib/experience/experiencePreferences';
import { BackupCancelledError, assertBackupStorageCapacity, buildBackupDatasetMap, compareRestoreReadback, createIncrementalEncryptedBackup, decryptBackupArchive, decryptBackupDatasets, estimateBackupStorageBytes, mergeRestoreDatasets, parseBackupArchive, parseEncryptedBackup, previewBackupDatasetMap, restoreBundleFromDatasetMap, serializeBackupArchive, type BackupDatasetMap, type BackupResumeCheckpoint, type IncrementalBackupEnvelope, type RestorePreview } from '@/lib/backup/incrementalEncryptedBackup';
import { ProgressiveDisclosure } from '@/components/ui/ProgressiveDisclosure';
import { persistProvenanceSnapshot } from '@/lib/provenance/domainProvenance';
import { storeProvenanceLinks } from '@/lib/database/HealthTrustDatabase';
import { OperationStatusCard, type OperationFeedback } from '@/components/ui/OperationStatusCard';
import { emitAppDataEvent } from '@/lib/appDataEvents';
import { buildIntegrityIssuesCsv, buildIntegrityIssuesJson, filterIntegrityIssuesForExport, type IntegrityIssueExportFilter, type IntegrityIssueExportFormat } from '@/lib/integrity/integrityIssueExport';
import { exportAllDataToFile, importAllDataFromFile } from '@/lib/dataBundle/bundleFileIO';

function getIntegrityIssueSource(issue: IntegrityIssue): string {
  const evidence = issue.evidence as Record<string, unknown>;
  return String(evidence.sourceType ?? evidence.source ?? evidence.provider ?? 'Automatic Integrity Center');
}

function normalizeOwner(value: unknown): string { return String(value ?? '').trim().toLowerCase(); }
function belongsToActiveProfile(record: Record<string, unknown>, allowedOwners: Set<string>): boolean {
  const owner = normalizeOwner(record.ownerId ?? record.ownerProfileId ?? record.userId);
  return !owner || allowedOwners.has(owner);
}

export default function DataTrustCenter() {
  const router = useRouter(); const { intent } = useLocalSearchParams<{ intent?: 'backup' | 'restore' }>(); const { authenticatedEmail } = useAuth(); const ownerId = authenticatedEmail?.toLowerCase().trim() || 'local-default';
  const core = useCoreData(); const { searchableCertificates } = useCertificates(); const { currentUser } = useUser(); const loyalty = useLoyalty();
  const [issues, setIssues] = useState<IntegrityIssue[]>([]); const [diagnostics, setDiagnostics] = useState<Array<{ version: number; name: string; state: string }>>([]); const [domainDiagnostics, setDomainDiagnostics] = useState<DomainMigrationDiagnostic[]>([]); const [busy, setBusy] = useState(''); const [progress, setProgress] = useState('');
  const [repairHistory, setRepairHistory] = useState<RepairHistoryRow[]>([]);
  const [trustOperation, setTrustOperation] = useState<OperationFeedback | null>(null);
  const [lastRepairIssue, setLastRepairIssue] = useState<IntegrityIssue | null>(null);
  const [password, setPassword] = useState(''); const [recoveryKey, setRecoveryKey] = useState(''); const [backupChain, setBackupChain] = useState<IncrementalBackupEnvelope[]>([]); const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null); const [pendingRestore, setPendingRestore] = useState<{ incoming: BackupDatasetMap; current: BackupDatasetMap; bundle: Awaited<ReturnType<typeof getAllStoredData>> } | null>(null);
  const [restoreCredentialType, setRestoreCredentialType] = useState<'password' | 'recovery-key'>('password');
  const [showRecoveryKeyInput, setShowRecoveryKeyInput] = useState(false);
  const [issueView, setIssueView] = useState<IntegrityIssueExportFilter>('all');
  const [issueSearch, setIssueSearch] = useState('');
  const [issueDomain, setIssueDomain] = useState('all');
  const [issueOwner, setIssueOwner] = useState('all');
  const [issueRepairability, setIssueRepairability] = useState<'all' | 'safe' | 'manual'>('all');
  const [issueSource, setIssueSource] = useState('all');
  const [issueStatus, setIssueStatus] = useState('all');
  const [shownIssueCount, setShownIssueCount] = useState(20);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [backupResume, setBackupResume] = useState<BackupResumeCheckpoint | null>(null);
  const operationAbortRef = useRef<AbortController | null>(null);
  const contentRef = useRef<ScrollView | null>(null);
  const [backupSectionY, setBackupSectionY] = useState(0);
  const privateOwner = currentUser?.id || ownerId;
  const localChainUri = `${FileSystem.documentDirectory}easyseas-health-trust/${encodeURIComponent(privateOwner)}-encrypted-chain.easyseas`;
  const recoveryStorageKey = `easyseas.healthTrust.recovery.${encodeURIComponent(privateOwner)}`;
  const lastScanStorageKey = `easyseas.healthTrust.lastScan.${encodeURIComponent(privateOwner)}`;
  const isWebPreview = Platform.OS === 'web';
  const webCompatibilityMessage = 'The browser preview does not open the native indexed trust database. Integrity scans, migrations, readable JSON exports, and restores remain fully available in the iOS app.';

  const refresh = useCallback(async () => {
    if (isWebPreview) {
      setDiagnostics([]); setDomainDiagnostics([]); setIssues([]); setRepairHistory([]); setProgress(webCompatibilityMessage);
      return;
    }
    const [nextDiagnostics, nextDomainDiagnostics, nextIssues, nextHistory] = await Promise.all([getMigrationDiagnostics(), getDomainMigrationDiagnostics(ownerId), listIntegrityIssues(privateOwner), listRepairHistory(privateOwner)]); setDiagnostics(nextDiagnostics); setDomainDiagnostics(nextDomainDiagnostics); setIssues(nextIssues); setRepairHistory(nextHistory);
  }, [isWebPreview, ownerId, privateOwner]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (isWebPreview) return; void SecureStore.getItemAsync(lastScanStorageKey).then(setLastScanAt).catch(() => undefined); }, [isWebPreview, lastScanStorageKey]);
  useEffect(() => {
    if (!intent || backupSectionY <= 0) return;
    const timer = setTimeout(() => contentRef.current?.scrollTo({ y: Math.max(0, backupSectionY - 16), animated: true }), 80);
    return () => clearTimeout(timer);
  }, [backupSectionY, intent]);
  useEffect(() => { if (isWebPreview) return undefined; let cancelled = false; void (async () => { try { const [info, storedRecovery] = await Promise.all([FileSystem.getInfoAsync(localChainUri), SecureStore.getItemAsync(recoveryStorageKey)]); if (storedRecovery && !cancelled) setRecoveryKey(storedRecovery); if (!info.exists) return; const archive = parseBackupArchive(await FileSystem.readAsStringAsync(localChainUri)); if (!cancelled) setBackupChain(archive.chain); } catch { if (!cancelled) setBackupChain([]); } })(); return () => { cancelled = true; }; }, [isWebPreview, localChainUri, recoveryStorageKey]);

  const runIntegrity = async () => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    const startedAt = new Date().toISOString();
    setBusy('integrity');
    setProgress('Checking ownership, dates, totals, certificates, and links…');
    setTrustOperation({ id: 'integrity-scan', title: 'Integrity scan', status: 'running', message: 'Checking ownership, dates, totals, certificates, and offer links.', current: 0, total: 6, committed: false, startedAt });
    try {
      const availableCruises = await core.getAllCruises();
      const allowedOwnerIds = [privateOwner, ownerId, currentUser?.id, (currentUser as any)?.email, authenticatedEmail].map(normalizeOwner).filter(Boolean);
      const allowedOwners = new Set(allowedOwnerIds);
      const profileCruises = (core.bookedCruises ?? []).filter((row) => belongsToActiveProfile(row as unknown as Record<string, unknown>, allowedOwners));
      const allCruises = [...profileCruises, ...availableCruises];
      const offerSailings = availableCruises.filter((row) => (row as any).offerId || (row as any).offerInstanceKey).map((row) => ({ id: row.id, offerId: (row as any).offerId ?? (row as any).offerInstanceKey, cruiseId: row.id }));
      const casinoRows = profileCruises.map((row) => ({ ...(row as any), id: row.id, ownerId: (row as any).ownerProfileId ?? privateOwner, points: (row as any).casinoPoints ?? (row as any).pointsEarned ?? 0, coinIn: (row as any).coinIn ?? 0 }));
      const loyaltyRows = [{ id: 'loyalty', ownerId: privateOwner, program: 'Royal/Celebrity', updatedAt: (loyalty as any).lastUpdated ?? (core as any).lastSyncDate, points: (loyalty as any).clubRoyalePoints, tier: (loyalty as any).clubRoyaleTier }];
      setTrustOperation((current) => current ? { ...current, current: 3, message: 'Ownership, cruise dates, and offer links checked; reconciling totals and sources.' } : current);
      const detected = scanIntegrity({ ownerId: privateOwner, allowedOwnerIds, cruises: profileCruises as any[], catalogCruises: availableCruises as any[], offers: (core.casinoOffers ?? []) as any[], offerSailings, certificates: searchableCertificates as any[], loyalty: loyaltyRows, casinoTotals: casinoRows });
      await Promise.all([persistIntegrityIssues(detected, privateOwner), persistProvenanceSnapshot({ cruise: allCruises as any[], offer: (core.casinoOffers ?? []) as any[], certificate: searchableCertificates as any[], casino: casinoRows, loyalty: loyaltyRows }, privateOwner)]);
      const completedAt = new Date().toISOString();
      setLastScanAt(completedAt);
      await SecureStore.setItemAsync(lastScanStorageKey, completedAt);
      await refresh();
      const message = `${detected.length} issue${detected.length === 1 ? '' : 's'} found. Findings and source labels were saved; no ambiguous record was changed.`;
      setProgress(message);
      setTrustOperation((current) => current ? { ...current, status: 'success', message, current: 6, committed: true, completedAt } : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setTrustOperation((current) => current ? { ...current, status: 'error', message, committed: false, completedAt: new Date().toISOString() } : current);
      Alert.alert('Integrity check failed', message);
    } finally {
      setBusy('');
    }
  };

  const saveReadableBackup = async () => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    setBusy('plain-backup');
    setProgress('Collecting and verifying the readable JSON backup…');
    try {
      const result = await exportAllDataToFile(authenticatedEmail, {
        authenticatedEmail,
        activeProfileId: currentUser?.id ?? null,
        activeProfileEmail: (currentUser as any)?.email ?? authenticatedEmail ?? null,
      });
      if (!result.success) throw new Error(result.error || 'The JSON backup could not be created.');
      setProgress(result.summaryText ?? `${result.fileName ?? 'The JSON backup'} was created and opened in the iOS share sheet.`);
    } catch (error) {
      Alert.alert('Backup was not created', error instanceof Error ? error.message : String(error));
    } finally { setBusy(''); }
  };

  const loadReadableBackup = async () => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    setBusy('plain-restore');
    setProgress('Choose a readable Easy Seas JSON backup. Existing data remains protected until the import commits.');
    try {
      const result = await importAllDataFromFile(authenticatedEmail, {
        authenticatedEmail,
        activeProfileId: currentUser?.id ?? null,
        activeProfileEmail: (currentUser as any)?.email ?? authenticatedEmail ?? null,
      });
      if (!result.success || !result.imported) {
        if (result.error === 'Import cancelled') { setProgress('No file was selected. Existing app data was unchanged.'); return; }
        throw new Error(result.error || 'The selected file did not contain readable Easy Seas data.');
      }
      await core.refreshData();
      emitAppDataEvent('cloudDataRestored');
      const imported = Object.values(result.imported).reduce((sum, count) => sum + count, 0);
      setProgress(`${imported.toLocaleString()} records were imported and published to the live app. A fresh integrity check is running now.`);
      await runIntegrity();
    } catch (error) {
      Alert.alert('Backup was not loaded', `${error instanceof Error ? error.message : String(error)} Existing app data was preserved.`);
    } finally { setBusy(''); }
  };
  const confirmRepair = (row: IntegrityIssue) => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    const preview = buildRepairPreview(row);
    if (!preview.allowed) return Alert.alert('Manual review required', preview.reason);
    Alert.alert('Apply safe repair?', `${row.title}\n\nBefore\n${JSON.stringify(preview.before, null, 2)}\n\nAfter\n${JSON.stringify(preview.after, null, 2)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply', onPress: () => {
        void (async () => {
          setLastRepairIssue(row);
          setBusy(`repair-${row.id}`);
          setTrustOperation({ id: `repair-${row.id}`, title: 'Applying verified repair', status: 'running', message: `${row.title}: applying only the previewed, unambiguous change.`, current: 0, total: 1, committed: false, startedAt: new Date().toISOString() });
          try {
            const result = await applyIntegrityRepair(row);
            setProgress(result.message);
            await refresh();
            setTrustOperation((current) => current ? { ...current, status: 'success', message: `${result.message} The repair history was updated.`, current: 1, committed: true, completedAt: new Date().toISOString() } : current);
            if (result.route) router.push(result.route as any);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'The repair could not be committed.';
            setTrustOperation((current) => current ? { ...current, status: 'error', message, committed: false, completedAt: new Date().toISOString() } : current);
          } finally {
            setBusy('');
          }
        })();
      } },
    ]);
  };
  const confirmRepairRollback = (row: RepairHistoryRow) => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    Alert.alert('Restore quarantined relationship?', 'The source record was never deleted. This reopens the integrity finding and returns the relationship to review.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', onPress: () => { void (async () => {
        setBusy(`rollback-${row.id}`);
        try { const result = await rollbackIntegrityRepair(row.id, privateOwner); setProgress(result.message); await refresh(); }
        catch (error) { Alert.alert('Rollback failed', error instanceof Error ? error.message : String(error)); }
        finally { setBusy(''); }
      })(); } },
    ]);
  };
  const confirmMigrationRollback = (row: DomainMigrationDiagnostic) => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    const definition = getHighVolumeDefinition(row.domain);
    if (!definition) return Alert.alert('Migration definition unavailable', `Easy Seas cannot safely roll back the ${row.domain} checkpoint.`);
    Alert.alert('Roll back indexed migration?', `Restore the retained pre-migration ${row.domain.replaceAll('_', ' ')} generation? The legacy source remains available and can be indexed again later.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Roll back', style: 'destructive', onPress: () => { void (async () => {
        setBusy(`migration-rollback-${row.id}`);
        try { const result = await rollbackHighVolumeMigration(ownerId, definition, row.sourceKey); setProgress(`Migration rolled back: ${result.removedRows.toLocaleString()} indexed rows removed and ${result.restoredRows.toLocaleString()} prior rows restored. Audit ${result.auditId} was saved.`); await refresh(); }
        catch (error) { Alert.alert('Migration rollback failed', error instanceof Error ? error.message : String(error)); }
        finally { setBusy(''); }
      })(); } },
    ]);
  };
  const migrate = async () => { if (isWebPreview) { setProgress(webCompatibilityMessage); return; } setBusy('migration'); try { const result = await migrateAllHighVolumeDomains(ownerId, (domain, done, total) => setProgress(`${domain.replaceAll('_', ' ')}: ${done.toLocaleString()} of ${total.toLocaleString()}`)); setProgress(`${result.reduce((sum, row) => sum + row.migrated, 0).toLocaleString()} records indexed locally. Original values were retained as rollback checkpoints.`); await refresh(); } catch (error) { Alert.alert('Local database migration failed', error instanceof Error ? error.message : String(error)); } finally { setBusy(''); } };
  const exportIntegrityReport = async (filter: IntegrityIssueExportFilter, explicitRows?: IntegrityIssue[], format: IntegrityIssueExportFormat = 'csv') => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    const selected = explicitRows ?? filterIntegrityIssuesForExport(issues, filter);
    if (selected.length === 0) return Alert.alert('No matching issues', `There are no ${filter === 'all' ? 'open issues' : filter} to export.`);
    setBusy(`export-${filter}`);
    try {
      const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!directory) throw new Error('The app does not have an available export directory.');
      const date = new Date().toISOString().slice(0, 10);
      const extension = format === 'json' ? 'json' : 'csv';
      const uri = `${directory}EasySeas-Data-Trust-${filter}-${date}.${extension}`;
      const appliedFilters = { severity: issueView, domain: issueDomain, owner: issueOwner, repairability: issueRepairability, source: issueSource, status: issueStatus, search: issueSearch };
      const report = format === 'json' ? buildIntegrityIssuesJson(selected, { filter, ownerId: privateOwner, appliedFilters }) : buildIntegrityIssuesCsv(selected);
      await FileSystem.writeAsStringAsync(uri, report, { encoding: FileSystem.EncodingType.UTF8 });
      const saved = await FileSystem.getInfoAsync(uri);
      if (!saved.exists || Number(saved.size ?? 0) === 0) throw new Error('The issue report did not pass file readback.');
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: format === 'json' ? 'application/json' : 'text/csv', UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text', dialogTitle: `Save ${selected.length} Easy Seas data trust issues` });
      setProgress(`${selected.length.toLocaleString()} ${filter === 'all' ? 'open issue' : filter}${selected.length === 1 ? '' : 's'} exported as ${format.toUpperCase()} with record IDs, evidence, source, and repair guidance.`);
    } catch (error) {
      Alert.alert('Issue export failed', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy('');
    }
  };
  const currentBackupContext = async () => { const bundle = await getAllStoredData(authenticatedEmail); const provenance = await listAllProvenanceLinks(privateOwner); const preferences = await loadExperiencePreferences(ownerId); const rawUserPreferences = await exportUserPreferenceStorage(ownerId); return { bundle, map: buildBackupDatasetMap(bundle, { provenance, preferences: { [privateOwner]: preferences }, rawUserPreferences }) }; };
  const createBackup = async () => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    if (password.length < 8) return Alert.alert('Choose a backup password', 'Use at least eight characters. This password is controlled by you and never sent to a server.');
    const controller = new AbortController(); operationAbortRef.current = controller; setBusy('backup');
    try {
      const { bundle, map } = await currentBackupContext();
      const localInfo = await FileSystem.getInfoAsync(localChainUri);
      setProgress('Checking backup size and available storage…');
      const estimatedBytes = await estimateBackupStorageBytes(map, localInfo.exists ? Number(localInfo.size ?? 0) : 0, (dataset, done, total) => setProgress(`Sizing ${dataset}: ${done.toLocaleString()} of ${total.toLocaleString()}`), controller.signal);
      const availableBytes = await FileSystem.getFreeDiskStorageAsync();
      assertBackupStorageCapacity(estimatedBytes, availableBytes);
      const created = await createIncrementalEncryptedBackup({ ownerId: privateOwner, appVersion: '13.0.75', datasets: map, password, previousChain: backupChain, recoveryKey: backupResume?.recoveryKey || recoveryKey || undefined, resume: backupResume ?? undefined, signal: controller.signal, onCheckpoint: setBackupResume, onProgress: (dataset, done, total) => setProgress(`Encrypting ${dataset}: ${done.toLocaleString()} of ${total.toLocaleString()}`) });
      const nextChain = [...backupChain, created.envelope];
      const raw = serializeBackupArchive(nextChain);
      assertBackupStorageCapacity(Math.ceil(raw.length * 2.25), await FileSystem.getFreeDiskStorageAsync());
      const directory = localChainUri.slice(0, localChainUri.lastIndexOf('/') + 1);
      const uri = `${FileSystem.documentDirectory}EasySeas-encrypted-chain-${created.envelope.manifest.backupId}.easyseas`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      setProgress('Saving the verified local backup chain…');
      await FileSystem.writeAsStringAsync(localChainUri, raw, { encoding: FileSystem.EncodingType.UTF8 });
      await FileSystem.writeAsStringAsync(uri, raw, { encoding: FileSystem.EncodingType.UTF8 });
      const saved = await FileSystem.getInfoAsync(localChainUri);
      if (!saved.exists || Number(saved.size ?? 0) < raw.length) throw new Error('BACKUP_FILE_READBACK_SIZE_MISMATCH');
      setBackupChain(nextChain); setBackupResume(null); setRecoveryKey(created.recoveryKey);
      await SecureStore.setItemAsync(recoveryStorageKey, created.recoveryKey);
      const db = await getHealthTrustDatabase(); await db.runAsync('UPDATE backup_manifests SET file_uri=? WHERE id=?', [localChainUri, created.envelope.manifest.backupId]);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save encrypted Easy Seas backup chain' });
      setProgress(`${created.envelope.manifest.kind === 'full' ? 'Full baseline' : 'Incremental'} backup completed: ${created.envelope.manifest.recordCount.toLocaleString()} changed records across ${created.envelope.manifest.datasets.length} datasets. The local chain now contains ${nextChain.length} snapshot${nextChain.length === 1 ? '' : 's'} and ${bundle.certificateDocuments?.length ?? 0} certificate documents.`);
    } catch (error) {
      if (error instanceof BackupCancelledError) { setBackupResume(error.checkpoint); setProgress(`Backup paused safely after ${error.checkpoint.completedDatasets.length} complete dataset${error.checkpoint.completedDatasets.length === 1 ? '' : 's'}. Press Resume encrypted backup to continue; no partial backup was published.`); }
      else if (error instanceof Error && error.message === 'BACKUP_PREFLIGHT_CANCELLED') setProgress('Backup cancelled during storage preflight. No backup file was written.');
      else Alert.alert('Encrypted backup failed', error instanceof Error ? error.message : String(error));
    } finally { operationAbortRef.current = null; setBusy(''); }
  };
  const pickRestore = async (credentialOverride?: { value: string; type: 'password' | 'recovery-key' }) => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    const credential = (credentialOverride?.value ?? password).trim();
    const credentialType = credentialOverride?.type ?? restoreCredentialType;
    if (credential.length < 8) return Alert.alert(credentialType === 'password' ? 'Enter the backup password' : 'Enter the recovery key', 'Easy Seas must decrypt the backup before comparing it with current data.');
    if (typeof DocumentPicker.getDocumentAsync !== 'function') return Alert.alert('File picker unavailable', 'The installed app is missing the native document picker. Reinstall this build before restoring a backup.');
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'application/octet-stream'], copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    const controller = new AbortController(); operationAbortRef.current = controller; setBusy('restore-preview');
    try {
      const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri);
      const parsed = JSON.parse(raw) as { format?: string };
      const { bundle, map } = await currentBackupContext();
      let incoming: BackupDatasetMap; let backupId: string; let backupOwner: string;
      if (parsed.format === 'easyseas-incremental-chain-v1') { const archive = parseBackupArchive(raw); backupOwner = archive.chain[0].manifest.ownerId; incoming = await decryptBackupArchive(archive, credential, credentialType, (done, total) => setProgress(`Reading encrypted snapshot ${done} of ${total}…`), controller.signal); backupId = archive.chain.at(-1)?.manifest.backupId ?? 'backup-chain'; }
      else { const envelope = parseEncryptedBackup(raw); backupOwner = envelope.manifest.ownerId; incoming = await decryptBackupDatasets(envelope, credential, credentialType, {}, undefined, controller.signal); backupId = envelope.manifest.backupId; }
      if (backupOwner !== privateOwner) throw new Error(`BACKUP_OWNER_MISMATCH: This backup belongs to ${backupOwner}, not the active profile.`);
      const preview = previewBackupDatasetMap(map, incoming, backupId); setRestorePreview(preview); setPendingRestore({ incoming, current: map, bundle }); setProgress('Restore preview is ready. Nothing has been changed.');
    } catch (error) { if (error instanceof Error && error.message === 'RESTORE_CANCELLED') setProgress('Restore preview cancelled. Nothing was changed.'); else Alert.alert('Could not preview backup', error instanceof Error ? error.message : String(error)); }
    finally { operationAbortRef.current = null; setBusy(''); }
  };
  const copyRecoveryKey = () => {
    if (!recoveryKey) return;
    Clipboard.setString(recoveryKey);
    setProgress('Recovery key copied. Paste it into a password manager or another safe location.');
  };
  const pasteRecoveryKey = async () => {
    const pasted = (await Clipboard.getString()).trim();
    if (!pasted) return Alert.alert('Clipboard is empty', 'Copy the Easy Seas recovery key first, then tap Paste recovery key.');
    setRestoreCredentialType('recovery-key');
    setPassword(pasted);
    setShowRecoveryKeyInput(true);
    setProgress('Recovery key pasted. Tap Load encrypted backup to choose the backup file.');
  };
  const loadWithSavedRecoveryKey = async () => {
    if (!recoveryKey) return;
    setRestoreCredentialType('recovery-key');
    setPassword(recoveryKey);
    setShowRecoveryKeyInput(true);
    await pickRestore({ value: recoveryKey, type: 'recovery-key' });
  };
  const applySafeRestore = async () => {
    if (isWebPreview) { setProgress(webCompatibilityMessage); return; }
    if (!pendingRestore || !restorePreview) return;
    setBusy('restore');
    const rollbackBundle = pendingRestore.bundle;
    try {
      const merged = mergeRestoreDatasets(pendingRestore.current, pendingRestore.incoming, 'preserve-current');
      const bundle = restoreBundleFromDatasetMap(rollbackBundle, merged);
      setProgress('Applying the previewed restore with a rollback checkpoint…');
      const result = await importAllData(bundle, authenticatedEmail);
      if (!result.success) throw new Error(result.errors.join('\n') || 'Restore import failed.');
      // Publish the committed repository generation to every live consumer
      // before announcing success. This keeps Settings, Offers, and Booked in
      // lockstep with the exact durable readback verified below.
      await core.refreshData();
      const readback = await currentBackupContext();
      const report = compareRestoreReadback(merged, readback.map);
      if (!report.exact) {
        const failed = report.rows.filter((row) => row.expected !== row.actual || row.missing || row.mismatched).map((row) => `${row.dataset} expected ${row.expected}, read back ${row.actual}, missing ${row.missing}, changed ${row.mismatched}`).join('; ');
        throw new Error(`RESTORE_READBACK_MISMATCH: ${failed}`);
      }
      emitAppDataEvent('cloudDataRestored');
      setProgress(`Safe restore completed and read back exactly: ${report.actualTotal.toLocaleString()} records across ${report.rows.length} datasets. ${restorePreview.totals.conflict.toLocaleString()} conflicts preserved the current values.`);
      setRestorePreview(null); setPendingRestore(null);
    } catch (error) {
      setProgress('Restore did not verify. Restoring the pre-restore checkpoint…');
      const rollback = await importAllData(rollbackBundle, authenticatedEmail);
      const message = error instanceof Error ? error.message : String(error);
      if (!rollback.success) Alert.alert('Restore and rollback need attention', `${message}\n\nRollback errors:\n${rollback.errors.join('\n')}`);
      else {
        await core.refreshData();
        emitAppDataEvent('cloudDataRestored');
        Alert.alert('Restore not applied', `${message}\n\nThe pre-restore data checkpoint was restored.`);
      }
    } finally { setBusy(''); }
  };

  const errors = issues.filter((row) => row.severity === 'critical' || row.severity === 'high').length;
  const warnings = issues.length - errors;
  const ambiguous = issues.filter((row) => row.ambiguous).length;
  const issueDomains = useMemo(() => [...new Set(issues.map((row) => row.entityType))].sort(), [issues]);
  const issueOwners = useMemo(() => [...new Set(issues.map((row) => row.ownerId ?? 'shared'))].sort(), [issues]);
  const issueSources = useMemo(() => [...new Set(issues.map(getIntegrityIssueSource))].sort(), [issues]);
  const issueStatuses = useMemo(() => [...new Set(issues.map((row) => row.state))].sort(), [issues]);
  const healthSummary = useMemo(() => {
    const severityWeight = { critical: 12, high: 8, medium: 4, low: 1 } as const;
    const penalty = issues.reduce((sum, row) => sum + severityWeight[row.severity], 0);
    const currentScore = Math.max(0, Math.round(100 - Math.min(100, penalty)));
    const repaired = new Set(repairHistory.filter((row) => row.result === 'applied').map((row) => row.issueId)).size;
    const failed = repairHistory.filter((row) => row.result === 'failed').length;
    const trend = repaired > failed ? `Improving · ${repaired} repaired` : failed > 0 ? `Needs attention · ${failed} failed` : issues.length === 0 ? 'Healthy · no open issues' : 'Current snapshot';
    return { currentScore, trend };
  }, [issues, repairHistory]);
  const clearIssueFilters = () => { setIssueView('all'); setIssueSearch(''); setIssueDomain('all'); setIssueOwner('all'); setIssueRepairability('all'); setIssueSource('all'); setIssueStatus('all'); };
  const visibleIssues = useMemo(() => {
    const query = issueSearch.trim().toLowerCase();
    return filterIntegrityIssuesForExport(issues, issueView).filter((row) => {
      if (issueDomain !== 'all' && row.entityType !== issueDomain) return false;
      if (issueOwner !== 'all' && (row.ownerId ?? 'shared') !== issueOwner) return false;
      if (issueRepairability === 'safe' && (!row.repair || row.ambiguous)) return false;
      if (issueRepairability === 'manual' && row.repair && !row.ambiguous) return false;
      if (issueSource !== 'all' && getIntegrityIssueSource(row) !== issueSource) return false;
      if (issueStatus !== 'all' && row.state !== issueStatus) return false;
      if (!query) return true;
      return [row.title, row.detail, row.kind, row.entityType, row.ownerId ?? 'shared', getIntegrityIssueSource(row), ...row.entityIds]
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [issueDomain, issueOwner, issueRepairability, issueSearch, issueSource, issueStatus, issueView, issues]);
  useEffect(() => {
    setShownIssueCount(20);
  }, [issueDomain, issueOwner, issueRepairability, issueSearch, issueSource, issueStatus, issueView]);
  const displayedIssues = useMemo(() => visibleIssues.slice(0, shownIssueCount), [shownIssueCount, visibleIssues]);
  return <SafeAreaView style={styles.safe}><Stack.Screen options={{ headerShown: false }}/><View style={styles.header}><TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityLabel="Back"><ArrowLeft color={T.color.deepNavy}/></TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.eyebrow}>LOCAL · PRIVATE · EXPLAINABLE</Text><Text style={styles.title}>Data trust center</Text></View><ShieldCheck color="#0E7FA7"/></View><ScrollView ref={contentRef} contentContainerStyle={styles.content}>
    {isWebPreview ? <View style={styles.webCompatibility} accessibilityRole="summary"><Database color={T.color.teal}/><View style={{ flex: 1 }}><Text style={styles.webCompatibilityTitle}>iOS trust tools protected in browser preview</Text><Text style={styles.detail}>{webCompatibilityMessage}</Text></View></View> : null}
    <ProgressiveDisclosure ownerId={privateOwner} screenId="data-trust" sectionId="health" title="Health at a glance" conclusions={[{ id: 'issues', label: 'Open issues', value: String(issues.length), status: issues.length ? 'warning' : 'success', actionLabel: issues.length ? 'Filter + download' : undefined, onPress: issues.length ? () => { clearIssueFilters(); void exportIntegrityReport('all'); } : undefined }, { id: 'warnings', label: 'Warnings', value: String(warnings), status: warnings ? 'warning' : 'success', actionLabel: warnings ? 'Filter + download' : undefined, onPress: warnings ? () => { clearIssueFilters(); setIssueView('warnings'); void exportIntegrityReport('warnings'); } : undefined }, { id: 'errors', label: 'Errors', value: String(errors), status: errors ? 'error' : 'success', actionLabel: errors ? 'Filter + download' : undefined, onPress: errors ? () => { clearIssueFilters(); setIssueView('errors'); void exportIntegrityReport('errors'); } : undefined }]}>
      <View style={styles.healthMeta}><View style={styles.healthMetaItem}><Text style={styles.healthMetaValue}>{healthSummary.currentScore}%</Text><Text style={styles.small}>Current health score</Text></View><View style={styles.healthMetaItem}><Text style={styles.healthMetaValue}>{healthSummary.trend}</Text><Text style={styles.small}>Health trend</Text></View><View style={styles.healthMetaItem}><Text style={styles.healthMetaValue}>{lastScanAt ? new Date(lastScanAt).toLocaleString() : 'Not yet scanned'}</Text><Text style={styles.small}>Last integrity scan</Text></View></View>
      <Text style={styles.detail}>Tap Open issues, Warnings, or Errors to download a CSV containing the affected record IDs, evidence, and repair guidance. Ambiguous repairs are preview-only and never run silently. {ambiguous} current issue{ambiguous === 1 ? '' : 's'} require human judgment. Local schema version: v{diagnostics.length}.</Text>
    </ProgressiveDisclosure>
    <View style={styles.actions}><Action icon={<RefreshCcw color={T.color.navy}/>} title="Run integrity check" subtitle="Duplicates, owners, links, totals, dates, loyalty" onPress={runIntegrity} disabled={!!busy || isWebPreview}/><Action icon={<Database color={T.color.teal}/>} title="Optimize local database" subtitle="Resumable SQLite indexing; source retained for rollback" onPress={migrate} disabled={!!busy || isWebPreview}/></View>
    {domainDiagnostics.length ? <View style={styles.card}><Text style={styles.sectionIn}>Indexed migration checkpoints</Text><Text style={styles.detail}>Each source is staged before promotion. Its retained pre-migration generation can be restored from here.</Text>{domainDiagnostics.slice(0, 12).map((row) => <View key={row.id} style={styles.diagnosticRow}><View style={{ flex: 1 }}><Text style={styles.issueTitle}>{row.domain.replaceAll('_', ' ')}</Text><Text style={styles.small}>{row.state.toUpperCase()} · {row.lastIndex.toLocaleString()} of {row.totalRows.toLocaleString()} · {new Date(row.updatedAt).toLocaleString()}</Text>{row.error ? <Text style={styles.warningText}>{row.error}</Text> : null}</View>{row.state !== 'rolled_back' ? <TouchableOpacity style={styles.rollbackSmall} onPress={() => confirmMigrationRollback(row)} disabled={!!busy} accessibilityRole="button" accessibilityLabel={`Roll back ${row.domain.replaceAll('_', ' ')} migration`}><Text style={styles.rollbackButtonText}>Roll back</Text></TouchableOpacity> : null}</View>)}</View> : null}
    {busy ? <View style={styles.progress}><ActivityIndicator color={T.color.teal}/><Text style={styles.progressText}>{progress || 'Working in bounded background batches…'}</Text>{busy === 'backup' || busy === 'restore-preview' ? <TouchableOpacity style={styles.cancel} onPress={() => operationAbortRef.current?.abort()} accessibilityRole="button" accessibilityLabel={`Cancel ${busy === 'backup' ? 'backup' : 'restore preview'}`}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity> : null}</View> : progress ? <View style={styles.progress}><CheckCircle2 color={T.color.success}/><Text style={styles.progressText}>{progress}</Text></View> : null}
    {trustOperation ? <OperationStatusCard operation={trustOperation} onRetry={trustOperation.status === 'error' ? trustOperation.id === 'integrity-scan' ? () => void runIntegrity() : lastRepairIssue ? () => confirmRepair(lastRepairIssue) : undefined : undefined} onDismiss={trustOperation.status !== 'running' ? () => setTrustOperation(null) : undefined}/> : null}
    <Text onLayout={(event) => setBackupSectionY(event.nativeEvent.layout.y)} style={styles.section}>Data export and restore</Text><View style={styles.card} testID={`data-trust-${intent ?? 'manage'}-backup`}>
      {intent ? <View style={styles.intentBanner}><Text style={styles.intentMode}>{intent === 'backup' ? 'SAVE ALL WORKFLOW' : 'LOAD ALL WORKFLOW'}</Text><Text style={styles.detail}>{intent === 'backup' ? 'Create a readable JSON backup and choose where to save it in the iOS share sheet.' : 'Choose a readable Easy Seas JSON backup. Existing records are preserved until the import commits successfully.'}</Text></View> : null}
      <Text style={styles.detail}>Save All produces an ordinary readable JSON file. Load All accepts that same file and publishes the restored records only after the import finishes successfully.</Text>
      <View style={styles.actions}>
        <Action icon={<Download color={T.color.navy}/>} title="Save All Data (.JSON)" subtitle="Export a readable complete Easy Seas backup" onPress={() => void saveReadableBackup()} disabled={!!busy || isWebPreview}/>
        <Action icon={<Upload color={T.color.teal}/>} title="Load All Data (.JSON)" subtitle="Choose a readable backup from Files and restore it" onPress={() => void loadReadableBackup()} disabled={!!busy || isWebPreview}/>
      </View>
    </View>
    <Text style={styles.section}>Integrity and reconciliation</Text>
    <View style={styles.issueTools} testID="data-trust-issue-filters">
      <View style={styles.issueFilterRow}>{(['all', 'warnings', 'errors'] as IntegrityIssueExportFilter[]).map((filter) => <TouchableOpacity key={filter} style={[styles.issueFilter, issueView === filter && styles.issueFilterOn]} onPress={() => setIssueView(filter)} accessibilityRole="button" accessibilityState={{ selected: issueView === filter }} testID={`data-trust-filter-${filter}`}><Text style={[styles.issueFilterText, issueView === filter && styles.issueFilterTextOn]}>{filter === 'all' ? `All ${issues.length}` : filter === 'warnings' ? `Warnings ${warnings}` : `Errors ${errors}`}</Text></TouchableOpacity>)}</View>
      <TextInput value={issueSearch} onChangeText={setIssueSearch} placeholder="Search issue, domain, owner, or record ID" placeholderTextColor={T.color.muted} style={styles.issueSearch} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search integrity issues" testID="data-trust-issue-search"/>
      <IssueFacet label="Domain" values={issueDomains} selected={issueDomain} onSelect={setIssueDomain}/>
      <IssueFacet label="Owner" values={issueOwners} selected={issueOwner} onSelect={setIssueOwner}/>
      <IssueFacet label="Repair" values={['safe', 'manual']} selected={issueRepairability} onSelect={(value) => setIssueRepairability(value as 'all' | 'safe' | 'manual')}/>
      <IssueFacet label="Source" values={issueSources} selected={issueSource} onSelect={setIssueSource}/>
      <IssueFacet label="Status" values={issueStatuses} selected={issueStatus} onSelect={setIssueStatus}/>
      <View style={styles.issueResultRow}><Text style={styles.small}>{visibleIssues.length.toLocaleString()} matching issue{visibleIssues.length === 1 ? '' : 's'}</Text><TouchableOpacity style={styles.clearFiltersButton} onPress={clearIssueFilters} accessibilityRole="button" testID="data-trust-clear-filters"><Text style={styles.clearFiltersText}>Clear all</Text></TouchableOpacity></View>
      <View style={styles.exportRow}><TouchableOpacity style={styles.issueExportButton} onPress={() => void exportIntegrityReport(issueView, visibleIssues, 'csv')} disabled={!visibleIssues.length || !!busy || isWebPreview} accessibilityRole="button" testID="data-trust-export-current-list"><Download size={15} color={T.color.navy}/><Text style={styles.issueExportText}>Export CSV</Text></TouchableOpacity><TouchableOpacity style={styles.issueExportButton} onPress={() => void exportIntegrityReport(issueView, visibleIssues, 'json')} disabled={!visibleIssues.length || !!busy || isWebPreview} accessibilityRole="button" testID="data-trust-export-current-json"><Download size={15} color={T.color.navy}/><Text style={styles.issueExportText}>Export JSON</Text></TouchableOpacity></View>
    </View>
    {issues.length === 0 ? <View style={styles.empty}><ShieldCheck color={T.color.success}/><Text style={styles.emptyTitle}>No unresolved issues</Text><Text style={styles.detail}>Run an integrity check whenever data is imported, synced, or restored.</Text></View> : visibleIssues.length === 0 ? <View style={styles.empty}><ShieldCheck color={T.color.teal}/><Text style={styles.emptyTitle}>No matching issues</Text><Text style={styles.detail}>Clear the search or choose another severity filter.</Text></View> : displayedIssues.map((row) => { const preview = buildRepairPreview(row); return <View key={row.id} style={styles.issue}><View style={styles.issueHead}><TriangleAlert color={row.severity === 'critical' ? T.color.error : T.color.warning}/><View style={{ flex: 1 }}><Text style={styles.issueTitle}>{row.title}</Text><Text style={styles.small}>{row.severity.toUpperCase()} · {row.kind.replaceAll('_', ' ')} · {row.ownerId ?? 'shared'}</Text></View></View><Text style={styles.detail}>{row.detail}</Text><Text style={styles.evidenceLabel}>Before</Text><Text style={styles.evidence}>{JSON.stringify(preview.before, null, 2)}</Text><Text style={styles.evidenceLabel}>Proposed result</Text><Text style={styles.evidence}>{JSON.stringify(preview.after, null, 2)}</Text><Text style={styles.previewRow}>{preview.reason}</Text>{preview.allowed ? <TouchableOpacity style={styles.repairButton} onPress={() => confirmRepair(row)} accessibilityRole="button" accessibilityLabel={`Apply safe repair for ${row.title}`}><Text style={styles.repairButtonText}>Preview and apply safe repair</Text></TouchableOpacity> : <View style={styles.manualBadge}><Text style={styles.manualBadgeText}>Manual review required · no automatic change</Text></View>}</View>; })}
    {displayedIssues.length < visibleIssues.length ? <TouchableOpacity style={styles.action} onPress={() => setShownIssueCount((count) => Math.min(count + 20, visibleIssues.length))} accessibilityRole="button" accessibilityLabel={`Show 20 more issues. ${visibleIssues.length - displayedIssues.length} remain.`} testID="data-trust-load-more-issues"><Download size={19} color={T.color.teal}/><View style={{ flex: 1 }}><Text style={styles.actionTitle}>Show 20 more issues</Text><Text style={styles.small}>{displayedIssues.length.toLocaleString()} of {visibleIssues.length.toLocaleString()} shown · exports still include every matching issue</Text></View></TouchableOpacity> : null}
    <Text style={styles.section}>Repair history</Text>{repairHistory.length === 0 ? <Text style={styles.detail}>No repairs have been applied or rejected on this profile.</Text> : repairHistory.slice(0, 20).map((row) => <View key={row.id} style={styles.historyRow}><CheckCircle2 color={row.result === 'applied' ? T.color.success : row.result === 'failed' ? T.color.error : T.color.warning} size={18}/><View style={{ flex: 1 }}><Text style={styles.issueTitle}>{row.repairKind.replaceAll('_', ' ')}</Text><Text style={styles.small}>{row.result.toUpperCase()} · {new Date(row.confirmedAt).toLocaleString()}</Text>{row.error ? <Text style={styles.warningText}>{row.error}</Text> : null}{row.result === 'applied' && (row.repairKind === 'quarantine_orphan_link' || row.repairKind === 'quarantine_relationship') ? <TouchableOpacity style={styles.rollbackButton} onPress={() => confirmRepairRollback(row)} disabled={!!busy} accessibilityRole="button" accessibilityLabel={`Restore quarantined ${row.repairKind.replaceAll('_', ' ')}`}><Text style={styles.rollbackButtonText}>Restore quarantined relationship</Text></TouchableOpacity> : null}</View></View>)}
  </ScrollView></SafeAreaView>;
}

function Action({ icon, title, subtitle, onPress, disabled }:{ icon: React.ReactNode; title: string; subtitle: string; onPress: () => void; disabled: boolean }) { return <TouchableOpacity style={[styles.action, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`}>{icon}<View style={{ flex: 1 }}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.small}>{subtitle}</Text></View></TouchableOpacity>; }
function IssueFacet({ label, values, selected, onSelect }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void }) { return <View style={styles.facetRow}><Text style={styles.facetLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facetScroller}>{['all', ...values].map((value) => <TouchableOpacity key={`${label}-${value}`} style={[styles.facetChip, selected === value && styles.facetChipOn]} onPress={() => onSelect(value)} accessibilityRole="button" accessibilityState={{ selected: selected === value }} accessibilityLabel={`${label}: ${value === 'all' ? 'All' : value}`}><Text numberOfLines={1} style={[styles.facetChipText, selected === value && styles.facetChipTextOn]}>{value === 'all' ? 'All' : value.replaceAll('_', ' ')}</Text></TouchableOpacity>)}</ScrollView></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F6F2EA' }, header: { backgroundColor: '#FFFDF9', padding: T.space.lg, flexDirection: 'row', alignItems: 'center', gap: T.space.md, borderBottomWidth: 1, borderBottomColor: T.color.border }, back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: '#0E7FA7', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { color: T.color.deepNavy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 26, fontWeight: '600' }, content: { padding: T.space.lg, paddingBottom: 60 }, webCompatibility: { flexDirection: 'row', gap: T.space.md, alignItems: 'flex-start', backgroundColor: '#E8F4F8', borderColor: '#9BC9D7', borderWidth: 1, borderRadius: T.radius.lg, padding: T.space.lg, marginBottom: T.space.md }, webCompatibilityTitle: { color: T.color.deepNavy, fontSize: T.type.body, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontWeight: '600', marginBottom: 4 }, section: { color: T.color.deepNavy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 20, fontWeight: '600', marginTop: T.space.xl, marginBottom: T.space.sm }, sectionIn: { color: T.color.deepNavy, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontSize: 18, fontWeight: '600', marginBottom: T.space.sm }, card: { backgroundColor: T.color.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.color.border, padding: T.space.lg, ...T.elevation.card }, intentBanner: { borderRadius: T.radius.md, backgroundColor: '#E8F4F8', borderWidth: 1, borderColor: '#9BC9D7', padding: T.space.md, marginBottom: T.space.md }, intentMode: { color: T.color.teal, fontSize: T.type.caption, fontWeight: '900', letterSpacing: 1.1, marginBottom: 4 }, healthMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm, marginBottom: T.space.md }, healthMetaItem: { flexGrow: 1, minWidth: 120, borderRadius: T.radius.md, backgroundColor: T.color.surfaceAlt, padding: T.space.sm }, healthMetaValue: { color: T.color.deepNavy, fontWeight: '900', fontSize: T.type.supporting, marginBottom: 3 }, actions: { gap: T.space.sm }, action: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: T.space.md, padding: T.space.md, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, borderRadius: T.radius.md }, actionTitle: { color: T.color.text, fontWeight: '900', fontSize: T.type.body }, disabled: { opacity: .55 }, detail: { color: T.color.muted, lineHeight: 20 }, small: { color: T.color.muted, fontSize: T.type.caption, lineHeight: 15 }, progress: { marginTop: T.space.md, backgroundColor: '#E5F4EF', borderRadius: T.radius.md, padding: T.space.md, flexDirection: 'row', gap: T.space.sm, alignItems: 'center' }, progressText: { flex: 1, color: '#225B4C', fontWeight: '700' }, cancel: { minHeight: 40, minWidth: 68, borderRadius: T.radius.pill, backgroundColor: T.color.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: T.space.sm }, cancelText: { color: '#fff', fontWeight: '900' }, credentialTabs: { flexDirection: 'row', gap: T.space.sm, marginTop: T.space.md }, credentialTab: { flex: 1, minHeight: 42, borderRadius: T.radius.pill, borderWidth: 1, borderColor: T.color.border, alignItems: 'center', justifyContent: 'center' }, credentialTabOn: { backgroundColor: T.color.navy, borderColor: T.color.navy }, credentialTabText: { color: T.color.navy, fontWeight: '800' }, credentialTabTextOn: { color: '#fff' }, credentialInputRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm }, credentialInput: { flex: 1 }, credentialUtilityButton: { minHeight: 50, minWidth: 68, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.color.border, borderRadius: T.radius.md, backgroundColor: T.color.surface }, credentialUtilityText: { color: T.color.navy, fontWeight: '800', fontSize: T.type.caption }, input: { minHeight: 50, borderWidth: 1, borderColor: T.color.border, borderRadius: T.radius.md, paddingHorizontal: T.space.md, marginVertical: T.space.md, backgroundColor: T.color.surfaceAlt, color: T.color.text }, pasteButton: { minHeight: T.control.minimum, marginBottom: T.space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: T.space.sm, borderWidth: 1, borderColor: T.color.navy, borderRadius: T.radius.md, backgroundColor: T.color.surface }, pasteButtonText: { color: T.color.navy, fontWeight: '900' }, recovery: { marginTop: T.space.md, padding: T.space.md, backgroundColor: '#FFF7D6', borderRadius: T.radius.md, borderWidth: 1, borderColor: '#E6B63D' }, recoveryTitle: { color: T.color.warning, fontWeight: '900' }, recoveryValue: { color: T.color.text, fontFamily: 'monospace', marginVertical: 8, lineHeight: 20 }, recoveryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm, marginTop: T.space.md }, recoveryButton: { minHeight: T.control.minimum, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: T.space.sm, borderWidth: 1, borderColor: T.color.navy, borderRadius: T.radius.md, paddingHorizontal: T.space.md, backgroundColor: T.color.surface }, recoveryButtonText: { color: T.color.navy, fontWeight: '900' }, recoveryButtonPrimary: { minHeight: T.control.minimum, flexGrow: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: T.space.sm, borderRadius: T.radius.md, paddingHorizontal: T.space.md, backgroundColor: T.color.navy }, recoveryButtonPrimaryText: { color: '#FFFFFF', fontWeight: '900' }, issueTools: { backgroundColor: T.color.surface, borderRadius: T.radius.lg, borderWidth: 1, borderColor: T.color.border, padding: T.space.md, marginBottom: T.space.sm }, issueFilterRow: { flexDirection: 'row', gap: T.space.sm }, issueFilter: { flex: 1, minHeight: T.control.minimum, alignItems: 'center', justifyContent: 'center', borderRadius: T.radius.pill, borderWidth: 1, borderColor: T.color.border, backgroundColor: T.color.surfaceAlt }, issueFilterOn: { backgroundColor: T.color.navy, borderColor: T.color.navy }, issueFilterText: { color: T.color.navy, fontWeight: '800', fontSize: T.type.caption }, issueFilterTextOn: { color: '#FFFFFF' }, facetRow: { marginTop: T.space.sm }, facetLabel: { color: T.color.muted, fontSize: T.type.caption, fontWeight: '800', marginBottom: 5 }, facetScroller: { gap: 6, paddingRight: T.space.md }, facetChip: { minHeight: 36, maxWidth: 190, justifyContent: 'center', borderRadius: T.radius.pill, borderWidth: 1, borderColor: T.color.border, backgroundColor: T.color.surfaceAlt, paddingHorizontal: T.space.sm }, facetChipOn: { backgroundColor: T.color.teal, borderColor: T.color.teal }, facetChipText: { color: T.color.navy, fontSize: T.type.caption, fontWeight: '800', textTransform: 'capitalize' }, facetChipTextOn: { color: '#FFFFFF' }, issueSearch: { minHeight: T.control.minimum, borderWidth: 1, borderColor: T.color.border, borderRadius: T.radius.md, paddingHorizontal: T.space.md, marginTop: T.space.sm, backgroundColor: T.color.surfaceAlt, color: T.color.text }, issueResultRow: { minHeight: T.control.minimum, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: T.space.sm, marginTop: T.space.xs }, clearFiltersButton: { minHeight: T.control.minimum, justifyContent: 'center', paddingHorizontal: T.space.sm }, clearFiltersText: { color: T.color.teal, fontWeight: '900', fontSize: T.type.caption }, exportRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: T.space.sm, borderTopWidth: 1, borderTopColor: T.color.border, paddingTop: T.space.xs }, issueExportButton: { minHeight: T.control.minimum, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: T.space.sm }, issueExportText: { color: T.color.navy, fontWeight: '900', fontSize: T.type.caption }, previewRow: { color: T.color.text, fontSize: T.type.supporting, marginTop: 6 }, warningText: { color: T.color.warning, fontWeight: '800', marginTop: T.space.md }, primary: { minHeight: T.control.large, borderRadius: T.radius.md, backgroundColor: T.color.navy, alignItems: 'center', justifyContent: 'center', marginTop: T.space.md }, primaryText: { color: '#fff', fontWeight: '900' }, issue: { backgroundColor: T.color.surface, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.color.border, padding: T.space.md, marginBottom: T.space.sm }, issueHead: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm, marginBottom: T.space.sm }, issueTitle: { color: T.color.text, fontWeight: '900' }, evidenceLabel: { color: T.color.navy, fontWeight: '900', marginTop: T.space.sm, fontSize: T.type.caption }, evidence: { color: T.color.muted, backgroundColor: T.color.surfaceAlt, borderRadius: T.radius.sm, padding: T.space.sm, fontFamily: 'monospace', fontSize: 11, marginTop: 4 }, repairButton: { minHeight: T.control.minimum, borderRadius: T.radius.md, backgroundColor: T.color.navy, alignItems: 'center', justifyContent: 'center', marginTop: T.space.md, paddingHorizontal: T.space.md }, repairButtonText: { color: '#fff', fontWeight: '900' }, rollbackButton: { minHeight: T.control.minimum, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.color.navy, alignItems: 'center', justifyContent: 'center', marginTop: T.space.sm, paddingHorizontal: T.space.md }, rollbackButtonText: { color: T.color.navy, fontWeight: '900', fontSize: T.type.caption }, rollbackSmall: { minHeight: T.control.minimum, minWidth: 78, borderRadius: T.radius.md, borderWidth: 1, borderColor: T.color.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: T.space.sm }, diagnosticRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm, borderTopWidth: 1, borderTopColor: T.color.border, paddingVertical: T.space.sm, marginTop: T.space.sm }, manualBadge: { borderRadius: T.radius.sm, backgroundColor: '#FFF7D6', padding: T.space.sm, marginTop: T.space.sm }, manualBadgeText: { color: T.color.warning, fontWeight: '800', fontSize: T.type.caption }, historyRow: { flexDirection: 'row', gap: T.space.sm, backgroundColor: T.color.surface, borderWidth: 1, borderColor: T.color.border, borderRadius: T.radius.md, padding: T.space.md, marginBottom: T.space.sm }, empty: { alignItems: 'center', backgroundColor: T.color.surface, padding: T.space.xl, borderRadius: T.radius.lg }, emptyTitle: { color: T.color.success, fontSize: T.type.emphasized, fontFamily: TYPOGRAPHY.fontFamilyEditorialSemibold, fontWeight: '600', marginVertical: T.space.sm }, });
