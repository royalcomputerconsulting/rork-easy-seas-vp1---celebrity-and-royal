import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { File as ExpoFile, Paths as ExpoPaths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  ChevronDown,
  ChevronUp,
  DownloadCloud,
  FileText,
  Share2,
  Trash2,
} from 'lucide-react-native';

import {
  certificateDownloadLogger,
  type CertificateDownloadLogEntry,
  type CertificateDownloadLogSnapshot,
} from '@/lib/certificates/certificateDownloadLogger';

const EMPTY_SNAPSHOT: CertificateDownloadLogSnapshot = {
  entries: [],
  currentActivity: 'Ready to download A and C certificates.',
  currentCertificateCodes: [],
  isActive: false,
  sessionStartedAt: null,
};

function getEntryColor(type: CertificateDownloadLogEntry['type']): string {
  if (type === 'error') return '#B42318';
  if (type === 'warning') return '#9A6700';
  if (type === 'success') return '#067647';
  return '#344054';
}

function buildExportFilename(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `certificate-download-${stamp}.log`;
}

export function CertificateDownloadLogPanel({ initiallyExpanded = false }: { initiallyExpanded?: boolean }) {
  const [snapshot, setSnapshot] = useState<CertificateDownloadLogSnapshot>(EMPTY_SNAPSHOT);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [exporting, setExporting] = useState(false);

  useEffect(() => certificateDownloadLogger.subscribe(setSnapshot), []);

  const visibleEntries = useMemo(() => {
    const limit = expanded ? 80 : 4;
    return snapshot.entries.slice(-limit);
  }, [expanded, snapshot.entries]);

  const exportLog = useCallback(async () => {
    const text = certificateDownloadLogger.getLogsAsText();
    if (!snapshot.entries.length) {
      Alert.alert('No certificate log yet', 'Start a certificate download first, then export the activity log.');
      return;
    }

    try {
      setExporting(true);
      const filename = buildExportFilename();
      if (Platform.OS === 'web') {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      } else {
        const file = new ExpoFile(ExpoPaths.cache, filename);
        await file.write(text);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/plain',
            dialogTitle: 'Export Certificate Download Log',
          });
        } else {
          Alert.alert('Log saved', `The certificate log was saved as ${filename}.`);
        }
      }
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  }, [snapshot.entries.length]);

  const clearLog = useCallback(() => {
    Alert.alert(
      'Clear certificate log?',
      'This removes the current certificate download activity from the app. Export it first if you need it for troubleshooting.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => certificateDownloadLogger.clear() },
      ],
    );
  }, []);

  return (
    <View style={styles.container} testID="certificate-download-log.panel">
      <View style={styles.statusRow}>
        <View style={styles.statusIcon}>
          {snapshot.isActive ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <DownloadCloud size={17} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.statusTextWrap}>
          <Text style={styles.statusLabel}>{snapshot.isActive ? 'Downloading now' : 'Certificate download status'}</Text>
          <Text style={styles.statusText}>{snapshot.currentActivity}</Text>
          {snapshot.currentCertificateCodes.length > 0 ? (
            <Text style={styles.codeText}>{snapshot.currentCertificateCodes.join(' • ')}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <FileText size={16} color="#173B63" />
          <Text style={styles.title}>Certificate Log</Text>
          <Text style={styles.count}>{snapshot.entries.length}</Text>
        </View>
        <Pressable onPress={() => setExpanded((value) => !value)} style={styles.expandButton} testID="certificate-download-log.toggle">
          <Text style={styles.expandText}>{expanded ? 'Collapse' : 'View log'}</Text>
          {expanded ? <ChevronUp size={15} color="#173B63" /> : <ChevronDown size={15} color="#173B63" />}
        </Pressable>
      </View>

      {(expanded || snapshot.isActive) ? (
        <View style={styles.entriesWrap}>
          {visibleEntries.length ? visibleEntries.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={styles.timestamp}>{entry.timestamp}</Text>
              <Text style={[styles.message, { color: getEntryColor(entry.type) }]}>{entry.message}</Text>
            </View>
          )) : (
            <Text style={styles.empty}>No certificate download activity yet.</Text>
          )}
          {snapshot.entries.length > visibleEntries.length ? (
            <Text style={styles.more}>{snapshot.entries.length - visibleEntries.length} older log entr{snapshot.entries.length - visibleEntries.length === 1 ? 'y' : 'ies'} hidden</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={exportLog} disabled={exporting} style={[styles.actionButton, styles.exportButton]} testID="certificate-download-log.export">
          {exporting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Share2 size={15} color="#FFFFFF" />}
          <Text style={styles.exportText}>{exporting ? 'Exporting…' : 'Export Log'}</Text>
        </Pressable>
        <Pressable onPress={clearLog} disabled={!snapshot.entries.length || snapshot.isActive} style={[styles.actionButton, styles.clearButton, (!snapshot.entries.length || snapshot.isActive) && styles.disabled]} testID="certificate-download-log.clear">
          <Trash2 size={15} color="#475467" />
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D7E2EF',
    padding: 14,
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE1F5',
    padding: 12,
  },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0E7FA7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextWrap: { flex: 1 },
  statusLabel: { fontSize: 11, fontWeight: '800', color: '#175CD3', textTransform: 'uppercase', letterSpacing: 0.7 },
  statusText: { marginTop: 3, fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#173B63' },
  codeText: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: '800', color: '#9A6700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 15, fontWeight: '800', color: '#173B63' },
  count: { minWidth: 23, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 12, overflow: 'hidden', textAlign: 'center', backgroundColor: '#E7EEF7', color: '#344054', fontSize: 11, fontWeight: '800' },
  expandButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5, paddingHorizontal: 7 },
  expandText: { color: '#173B63', fontSize: 12, fontWeight: '700' },
  entriesWrap: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#EAECF0', padding: 10, gap: 8 },
  entry: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D0D5DD', paddingBottom: 7 },
  timestamp: { fontSize: 10, color: '#667085', marginBottom: 2 },
  message: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  empty: { color: '#667085', fontSize: 12, lineHeight: 17 },
  more: { color: '#667085', fontSize: 10, textAlign: 'center', fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  exportButton: { backgroundColor: '#173B63' },
  clearButton: { backgroundColor: '#F2F4F7', borderWidth: 1, borderColor: '#D0D5DD' },
  exportText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  clearText: { color: '#475467', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
