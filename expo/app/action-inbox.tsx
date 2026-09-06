import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, CheckCircle2, CheckSquare2, ChevronRight, Clock3, Database, ShieldAlert, Square, UserRound } from 'lucide-react-native';
import { useAuth } from '@/state/AuthProvider';
import { useUser } from '@/state/UserProvider';
import { useCoreData } from '@/state/CoreDataProvider';
import { useCertificates } from '@/state/CertificatesProvider';
import { EASY_SEAS_TOKENS as T } from '@/constants/easySeasDesignSystem';
import { integrityIssuesToInbox, listIntegrityIssues } from '@/lib/integrity/integrityCenter';
import { reconcileInbox, type InboxIssue } from '@/lib/operating/operatingSystem';
import { TabIdentityBand } from '@/components/ui/TabIdentityBand';
import { ThemedSectionHeader } from '@/components/ui/ThemedSectionCard';

type Decision = { status: 'open' | 'snoozed' | 'resolved'; snoozedUntil?: string; assignedOwnerId?: string };
const storageKey = (accountId: string) => `@easyseas/actionInboxDecisions/v2::${accountId}`;
const nowIso = () => new Date().toISOString();

export default function ActionInbox() {
  const router = useRouter();
  const { authenticatedEmail } = useAuth();
  const { currentUser, users } = useUser();
  const core = useCoreData();
  const { searchableCertificates } = useCertificates();
  const ownerId = currentUser?.id || authenticatedEmail?.toLowerCase().trim() || 'local-default';
  const accountId = authenticatedEmail?.toLowerCase().trim() || 'local-default';
  const canManageAllProfiles = currentUser?.isOwner !== false;
  const [integrity, setIntegrity] = useState<InboxIssue[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<'all' | 'mine'>('mine');
  const integrityOwnerIds = useMemo(() => [...new Set([ownerId, ...(canManageAllProfiles ? users.map((user) => user.id) : [])])].sort(), [canManageAllProfiles, ownerId, users]);

  useEffect(() => { if (!canManageAllProfiles) setScope('mine'); }, [canManageAllProfiles, ownerId]);
  useEffect(() => {
    let cancelled = false;
    // Never leave the prior account's decisions or selections visible while
    // the next account-scoped inbox is loading.
    setIntegrity([]);
    setDecisions({});
    setSelected(new Set());
    void (async () => {
      try {
        // The integrity repository is a native, indexed SQLite authority.
        // expo-sqlite's web worker requires cross-origin isolation and may
        // reject before a query starts in ordinary browser previews. Keep the
        // Action Inbox usable on web without weakening the native iOS path.
        const issueGroups = Platform.OS === 'web'
          ? []
          : await Promise.all(integrityOwnerIds.map((id) => listIntegrityIssues(id)));
        const [accountRaw, legacyRaw] = await Promise.all([
          AsyncStorage.getItem(storageKey(accountId)),
          AsyncStorage.getItem(storageKey(ownerId)),
        ]);
        if (cancelled) return;
        const issues = [...new Map(issueGroups.flat().map((issue) => [issue.id, issue])).values()];
        setIntegrity(integrityIssuesToInbox(issues));
        try { setDecisions(JSON.parse(accountRaw || legacyRaw || '{}')); } catch { setDecisions({}); }
      } catch (error) {
        if (cancelled) return;
        console.warn('[ActionInbox] Integrity history is temporarily unavailable:', error);
        setIntegrity([]);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId, integrityOwnerIds, ownerId]);

  const candidates = useMemo<InboxIssue[]>(() => {
    const now = Date.now();
    const expiringOffers = (core.casinoOffers ?? []).flatMap((offer, index) => {
      const expires = Date.parse(String((offer as any).expirationDate ?? (offer as any).expiresAt ?? ''));
      if (!expires || expires < now || expires - now > 30 * 86400000) return [];
      const recordId = String(offer.id ?? index);
      return [{ id: `offer-${recordId}`, dedupeKey: `offer:${(offer as any).offerCode ?? recordId}`, type: 'expiring-offer', priority: 60, deadline: new Date(expires).toISOString(), ownerId: '__shared__', source: 'Offer inventory', sourceRecordId: recordId, observedAt: String((offer as any).syncedAt ?? (offer as any).updatedAt ?? nowIso()), confidence: 'high', formula: 'Provider expiration is within 30 days.', details: `${String((offer as any).offerCode ?? (offer as any).title ?? 'Offer')} needs a use-or-release decision.`, status: 'open', route: `/offer-details?offerId=${encodeURIComponent(recordId)}` } as InboxIssue];
    });
    const certs = searchableCertificates.flatMap((certificate, index) => {
      const expires = Date.parse(String((certificate as any).expirationDate ?? (certificate as any).expiresAt ?? ''));
      if (!expires || expires < now || expires - now > 30 * 86400000) return [];
      const recordId = String(certificate.id ?? index);
      return [{ id: `cert-${recordId}`, dedupeKey: `certificate:${(certificate as any).certificateCode ?? recordId}`, type: 'expiring-certificate', priority: 80, deadline: new Date(expires).toISOString(), ownerId: '__shared__', source: 'Downloaded certificate inventory', sourceRecordId: recordId, observedAt: String((certificate as any).parsedAt ?? (certificate as any).updatedAt ?? nowIso()), confidence: (certificate as any).parserStatus === 'success' ? 'high' : 'medium', formula: 'Parsed certificate expiration is within 30 days.', details: `${String((certificate as any).certificateCode ?? 'Certificate')} should be compared with its eligible sailing rows.`, status: 'open', route: `/certificate-lookup?certificateCode=${encodeURIComponent(String((certificate as any).certificateCode ?? ''))}` } as InboxIssue];
    });
    const closeouts = (core.bookedCruises ?? []).flatMap((cruise, index) => {
      const cruiseOwner = String((cruise as any).ownerProfileId ?? (cruise as any).userId ?? '').toLowerCase();
      if ((cruiseOwner && cruiseOwner !== ownerId.toLowerCase()) || String(cruise.status).toLowerCase() !== 'completed' || Number((cruise as any).casinoPoints ?? (cruise as any).pointsEarned ?? 0)) return [];
      const recordId = String(cruise.id ?? index);
      return [{ id: `closeout-${recordId}`, dedupeKey: `closeout:${recordId}`, type: 'incomplete-closeout', priority: 70, ownerId, source: 'Owner-scoped completed cruises', sourceRecordId: recordId, observedAt: String((cruise as any).updatedAt ?? nowIso()), confidence: 'high', formula: 'Completed cruise has no saved casino points.', details: `${String(cruise.shipName ?? 'Completed cruise')} is missing its casino closeout.`, status: 'open', route: '/(tabs)/booked' } as InboxIssue];
    });
    return [...integrity, ...expiringOffers, ...certs, ...closeouts].map((row) => {
      const decision = decisions[row.id];
      if (!decision) return row;
      const assignedOwnerId = decision.assignedOwnerId ?? row.ownerId;
      if (decision.status === 'snoozed' && decision.snoozedUntil && decision.snoozedUntil <= nowIso()) return { ...row, ownerId: assignedOwnerId, status: 'open' as const };
      return { ...row, ownerId: assignedOwnerId, status: decision.status };
    });
  }, [core.bookedCruises, core.casinoOffers, decisions, integrity, ownerId, searchableCertificates]);

  const rows = reconcileInbox(candidates).rows.filter((row) => row.status === 'open');
  const visible = rows.filter((row) => canManageAllProfiles && scope === 'all' ? true : row.ownerId === ownerId || row.ownerId === '__shared__');
  const store = (next: Record<string, Decision>) => { setDecisions(next); void AsyncStorage.setItem(storageKey(accountId), JSON.stringify(next)); };
  const decide = (id: string, decision: Decision) => store({ ...decisions, [id]: { ...decisions[id], ...decision } });
  const bulkDecide = (decision: Decision) => { const next = { ...decisions }; selected.forEach((id) => { next[id] = { ...next[id], ...decision }; }); store(next); setSelected(new Set()); };
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return <SafeAreaView style={styles.safe}><Stack.Screen options={{ headerShown: false }}/>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Back"><ArrowLeft color={T.color.deepNavy}/></TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.eyebrow}>One priority queue</Text><Text style={styles.title}>Action Inbox</Text></View><View style={styles.count}><Text style={styles.countText}>{visible.length}</Text></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      <TabIdentityBand tab="settings" compact detail={`${visible.length} action${visible.length === 1 ? '' : 's'} need review`} testID="action-inbox-story-card" />
      <ThemedSectionHeader tab="settings" emoji="🧭" title="Review queue" subtitle="Filter, select, assign, snooze, or resolve owner-scoped actions." tone="info" compact testID="action-inbox-review-section" />
      <View style={styles.toolbar}>{canManageAllProfiles ? <TouchableOpacity style={[styles.filter, scope === 'all' && styles.filterActive]} onPress={() => setScope('all')} testID="action-inbox-all-profiles"><Text style={[styles.filterText, scope === 'all' && styles.filterTextActive]}>All profiles</Text></TouchableOpacity> : null}<TouchableOpacity style={[styles.filter, scope === 'mine' && styles.filterActive]} onPress={() => setScope('mine')}><Text style={[styles.filterText, scope === 'mine' && styles.filterTextActive]}>Mine + shared</Text></TouchableOpacity>{visible.length ? <TouchableOpacity style={styles.selectAll} onPress={() => setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((row) => row.id)))}>{selected.size === visible.length ? <CheckSquare2 size={18} color={T.color.navy}/> : <Square size={18} color={T.color.navy}/>}<Text style={styles.smallActionText}>Select all</Text></TouchableOpacity> : null}</View>
      {selected.size ? <View style={styles.bulk} testID="action-inbox-bulk-actions"><Text style={styles.bulkTitle}>{selected.size} selected</Text><TouchableOpacity style={styles.bulkButton} onPress={() => bulkDecide({ status: 'snoozed', snoozedUntil: new Date(Date.now() + 7 * 86400000).toISOString() })}><Text style={styles.bulkText}>Snooze 7 days</Text></TouchableOpacity><TouchableOpacity style={styles.bulkButton} onPress={() => bulkDecide({ status: 'resolved' })}><Text style={styles.bulkText}>Mark done</Text></TouchableOpacity>{canManageAllProfiles ? users.map((user) => <TouchableOpacity key={user.id} style={styles.bulkButton} onPress={() => bulkDecide({ status: 'open', assignedOwnerId: user.id })}><Text style={styles.bulkText}>Assign {user.displayName || user.name}</Text></TouchableOpacity>) : null}</View> : null}
      {visible.length === 0 ? <View style={styles.empty}><CheckCircle2 size={38} color={T.color.success}/><Text style={styles.emptyTitle}>Everything is current</Text><Text style={styles.copy}>New sync, certificate, casino, and integrity evidence will automatically reopen relevant actions.</Text></View> : visible.map((row) => <View key={row.id} style={styles.card}><View style={styles.selectRow}><TouchableOpacity onPress={() => toggle(row.id)} accessibilityLabel={`${selected.has(row.id) ? 'Deselect' : 'Select'} ${row.type}`}>{selected.has(row.id) ? <CheckSquare2 color={T.color.navy}/> : <Square color={T.color.muted}/>}</TouchableOpacity><TouchableOpacity style={styles.main} onPress={() => router.push(row.route as never)}><ShieldAlert color={row.priority >= 75 ? T.color.error : T.color.warning}/><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{row.type.replaceAll('-', ' ').replaceAll(':', ' · ')}</Text><Text style={styles.copy}>{row.details || row.source}{row.deadline ? ` · due ${new Date(row.deadline).toLocaleDateString()}` : ''}</Text><View style={styles.provenance} testID={`action-inbox-provenance-${row.id}`}><Database size={12} color={T.color.navy}/><Text style={styles.provenanceText}>{row.source}{row.sourceRecordId ? ` · record ${row.sourceRecordId}` : ''}{row.confidence ? ` · ${row.confidence} confidence` : ''}</Text></View>{row.formula ? <Text style={styles.formula}>{row.formula}{row.observedAt ? ` · observed ${new Date(row.observedAt).toLocaleDateString()}` : ''}</Text> : null}<View style={styles.assigned}><UserRound size={12} color={T.color.muted}/><Text style={styles.assignedText}>{row.ownerId === '__shared__' ? 'Shared' : users.find((user) => user.id === row.ownerId)?.displayName || users.find((user) => user.id === row.ownerId)?.name || 'Current profile'}</Text></View></View><ChevronRight color={T.color.muted}/></TouchableOpacity></View><View style={styles.actions}><TouchableOpacity style={styles.smallAction} onPress={() => decide(row.id, { status: 'snoozed', snoozedUntil: new Date(Date.now() + 7 * 86400000).toISOString() })}><Clock3 size={15} color={T.color.navy}/><Text style={styles.smallActionText}>Snooze 7 days</Text></TouchableOpacity><TouchableOpacity style={styles.smallAction} onPress={() => decide(row.id, { status: 'resolved' })}><CheckCircle2 size={15} color={T.color.success}/><Text style={styles.smallActionText}>Done</Text></TouchableOpacity></View></View>)}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:T.color.background},header:{backgroundColor:T.color.surface,padding:T.space.lg,flexDirection:'row',alignItems:'center',gap:T.space.md},back:{minWidth:44,minHeight:44,justifyContent:'center'},eyebrow:{color:'#0E7FA7',fontSize:10,fontWeight:'900',letterSpacing:1.1,textTransform:'uppercase'},title:{color:T.color.deepNavy,fontSize:23,fontWeight:'900'},count:{minWidth:38,height:38,borderRadius:19,backgroundColor:'#E6B63D',alignItems:'center',justifyContent:'center'},countText:{color:T.color.deepNavy,fontWeight:'900'},content:{padding:T.space.lg,paddingBottom:50},toolbar:{flexDirection:'row',flexWrap:'wrap',gap:T.space.sm,marginBottom:T.space.md},filter:{minHeight:42,borderRadius:21,borderWidth:1,borderColor:T.color.border,paddingHorizontal:T.space.md,alignItems:'center',justifyContent:'center',backgroundColor:T.color.surface},filterActive:{backgroundColor:T.color.navy,borderColor:T.color.navy},filterText:{color:T.color.navy,fontWeight:'800'},filterTextActive:{color:'#fff'},selectAll:{minHeight:42,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:T.space.sm},bulk:{backgroundColor:'#EAF2FF',borderColor:T.color.navy,borderWidth:1,borderRadius:T.radius.md,padding:T.space.sm,gap:6,marginBottom:T.space.md},bulkTitle:{color:T.color.navy,fontWeight:'900'},bulkButton:{minHeight:42,backgroundColor:T.color.surface,borderWidth:1,borderColor:T.color.border,borderRadius:T.radius.sm,justifyContent:'center',paddingHorizontal:T.space.sm},bulkText:{color:T.color.navy,fontWeight:'800'},card:{backgroundColor:T.color.surface,borderRadius:T.radius.lg,borderWidth:1,borderColor:T.color.border,marginBottom:T.space.sm,overflow:'hidden'},selectRow:{flexDirection:'row',alignItems:'center',paddingLeft:T.space.md},main:{flex:1,minHeight:72,flexDirection:'row',alignItems:'center',gap:T.space.md,padding:T.space.md},cardTitle:{color:T.color.text,fontWeight:'900',textTransform:'capitalize'},copy:{color:T.color.muted,fontSize:T.type.supporting,lineHeight:18,marginTop:3},provenance:{flexDirection:'row',alignItems:'center',gap:4,marginTop:7},provenanceText:{color:T.color.navy,fontSize:T.type.caption,fontWeight:'800',flex:1},formula:{color:T.color.muted,fontSize:10,lineHeight:14,marginTop:3},assigned:{flexDirection:'row',alignItems:'center',gap:4,marginTop:5},assignedText:{color:T.color.muted,fontSize:T.type.caption,fontWeight:'700'},actions:{borderTopWidth:1,borderTopColor:T.color.border,flexDirection:'row'},smallAction:{flex:1,minHeight:46,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},smallActionText:{color:T.color.navy,fontSize:T.type.caption,fontWeight:'800'},empty:{backgroundColor:T.color.surface,borderRadius:T.radius.lg,padding:T.space.xl,alignItems:'center'},emptyTitle:{color:T.color.success,fontSize:T.type.title,fontWeight:'900',marginTop:T.space.sm} });
