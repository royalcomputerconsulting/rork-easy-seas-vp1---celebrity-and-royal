import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, CheckCircle2, ChevronRight, Inbox, MailQuestion, UserPlus, UsersRound, X } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser, type UserProfile } from '@/state/UserProvider';
import { IntelligenceFilterStrip } from '@/components/IntelligenceFilterStrip';
import { useIntelligenceFilters } from '@/state/IntelligenceFiltersProvider';
import { recordMatchesIntelligenceFilters } from '@/lib/intelligenceFilters';
import {
  buildImportAssignmentPatch,
  buildKeepUnassignedPatch,
  getEntityLabel,
  getImportAssignmentReviewItems,
  getImportProfileName,
  getSuggestedProfileName,
  groupImportAssignmentReviewItems,
  type ImportAssignmentReviewGroup,
  type ImportAssignmentReviewItem,
} from '@/lib/importAssignmentReview';
import type { BookedCruise, CalendarEvent, CasinoOffer, Cruise } from '@/types/models';

export default function ImportReviewScreen() {
  const router = useRouter();
  const {
    casinoOffers,
    cruises,
    bookedCruises,
    calendarEvents,
    updateCasinoOffer,
    updateCruise,
    updateBookedCruise,
    updateCalendarEvent,
  } = useCoreData();
  const { users, addUser } = useUser();
  const { selectedProfileId, selectedBrand, selectedProgram } = useIntelligenceFilters();
  const [processingKey, setProcessingKey] = useState<string | null>(null);

  const intelligenceFilterSnapshot = useMemo(() => ({
    selectedProfileId,
    selectedBrand,
    selectedProgram,
  }), [selectedBrand, selectedProfileId, selectedProgram]);

  const allReviewItems = useMemo(() => getImportAssignmentReviewItems({
    offers: casinoOffers,
    cruises,
    bookedCruises,
    calendarEvents,
    users,
  }), [bookedCruises, calendarEvents, casinoOffers, cruises, users]);

  const reviewItems = useMemo(() => allReviewItems.filter((item) => recordMatchesIntelligenceFilters(item.record, intelligenceFilterSnapshot, users)), [allReviewItems, intelligenceFilterSnapshot, users]);

  const reviewGroups = useMemo(() => groupImportAssignmentReviewItems(reviewItems), [reviewItems]);
  const activeProfiles = useMemo(() => {
    const seenProfileIds = new Set<string>();
    return users.filter((profile) => {
      if (profile.active === false) {
        return false;
      }

      const profileId = profile.id.trim();
      if (!profileId || seenProfileIds.has(profileId)) {
        return false;
      }

      seenProfileIds.add(profileId);
      return true;
    });
  }, [users]);

  const applyPatchToItem = useCallback((item: ImportAssignmentReviewItem, patch: Partial<CasinoOffer & Cruise & BookedCruise & CalendarEvent>) => {
    console.log('[ImportReview] Applying assignment patch:', { entity: item.entity, id: item.id, patch });
    if (item.entity === 'offer') {
      updateCasinoOffer(item.id, patch as Partial<CasinoOffer>);
      return;
    }
    if (item.entity === 'availableCruise') {
      updateCruise(item.id, patch as Partial<Cruise>);
      return;
    }
    if (item.entity === 'bookedCruise') {
      updateBookedCruise(item.id, patch as Partial<BookedCruise>);
      return;
    }
    updateCalendarEvent(item.id, patch as Partial<CalendarEvent>);
  }, [updateBookedCruise, updateCalendarEvent, updateCasinoOffer, updateCruise]);

  const assignGroupToProfile = useCallback(async (group: ImportAssignmentReviewGroup, profile: UserProfile) => {
    try {
      setProcessingKey(`${group.key}:${profile.id}`);
      const patch = buildImportAssignmentPatch(profile, group.sourceEmail);
      group.items.forEach((item) => applyPatchToItem(item, patch as Partial<CasinoOffer & Cruise & BookedCruise & CalendarEvent>));
      console.log('[ImportReview] Assigned import group:', { group: group.key, profileId: profile.id, itemCount: group.items.length });
    } catch (error) {
      console.error('[ImportReview] Failed to assign group:', error);
      Alert.alert('Assignment Failed', 'Could not assign these imports. Please try again.');
    } finally {
      setProcessingKey(null);
    }
  }, [applyPatchToItem]);

  const createProfileAndAssign = useCallback(async (group: ImportAssignmentReviewGroup) => {
    if (!group.sourceEmail) {
      Alert.alert('Email Required', 'This group has no email address. Assign it to an existing profile or leave it unassigned.');
      return;
    }

    try {
      setProcessingKey(`${group.key}:create`);
      const existingProfile = activeProfiles.find((profile) => profile.email.toLowerCase().trim() === group.sourceEmail?.toLowerCase().trim() || profile.celebrityEmail?.toLowerCase().trim() === group.sourceEmail?.toLowerCase().trim());
      const profile = existingProfile ?? await addUser({ name: getSuggestedProfileName(group.sourceEmail), email: group.sourceEmail });
      const patch = buildImportAssignmentPatch(profile, group.sourceEmail);
      group.items.forEach((item) => applyPatchToItem(item, patch as Partial<CasinoOffer & Cruise & BookedCruise & CalendarEvent>));
      console.log('[ImportReview] Created/matched profile and assigned import group:', { group: group.key, profileId: profile.id, itemCount: group.items.length });
    } catch (error) {
      console.error('[ImportReview] Failed to create profile for import group:', error);
      Alert.alert('Profile Creation Failed', 'Could not create the traveler profile. Please try again from Settings.');
    } finally {
      setProcessingKey(null);
    }
  }, [activeProfiles, addUser, applyPatchToItem]);

  const keepGroupUnassigned = useCallback((group: ImportAssignmentReviewGroup) => {
    try {
      setProcessingKey(`${group.key}:unassigned`);
      const patch = buildKeepUnassignedPatch(group.sourceEmail);
      group.items.forEach((item) => applyPatchToItem(item, patch as Partial<CasinoOffer & Cruise & BookedCruise & CalendarEvent>));
      console.log('[ImportReview] Kept import group unassigned:', { group: group.key, itemCount: group.items.length });
    } catch (error) {
      console.error('[ImportReview] Failed to keep group unassigned:', error);
      Alert.alert('Update Failed', 'Could not update these imports. Please try again.');
    } finally {
      setProcessingKey(null);
    }
  }, [applyPatchToItem]);

  const renderItem = useCallback((item: ImportAssignmentReviewItem) => (
    <View key={`${item.entity}:${item.id}`} style={styles.itemRow} testID={`import-review-item-${item.id}`}>
      <View style={styles.itemTypePill}>
        <Text style={styles.itemTypeText}>{getEntityLabel(item.entity)}</Text>
      </View>
      <View style={styles.itemCopy}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.itemSubtitle} numberOfLines={2}>{item.subtitle || 'Imported record'}</Text>
        <Text style={styles.itemMeta}>{[item.dateLabel, item.brand, item.casinoProgram, item.importStatus].filter(Boolean).join(' • ')}</Text>
      </View>
    </View>
  ), []);

  const renderGroup = useCallback((group: ImportAssignmentReviewGroup) => {
    const isProcessingGroup = processingKey?.startsWith(group.key) === true;
    return (
      <View key={group.key} style={styles.groupCard} testID={`import-review-group-${group.key}`}>
        <View style={styles.groupHeader}>
          <View style={styles.groupIconWrap}>
            <MailQuestion size={20} color="#0F766E" />
          </View>
          <View style={styles.groupHeaderCopy}>
            <Text style={styles.groupTitle} numberOfLines={1}>{group.label}</Text>
            <Text style={styles.groupSubtitle}>{group.items.length} import record{group.items.length === 1 ? '' : 's'} need ownership review</Text>
          </View>
        </View>

        <View style={styles.actionPanel}>
          <Text style={styles.actionLabel}>Assign this group to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileChipRow}>
            {activeProfiles.map((profile) => (
              <TouchableOpacity
                key={`assign-profile-${profile.id}`}
                style={styles.profileChip}
                onPress={() => { void assignGroupToProfile(group, profile); }}
                activeOpacity={0.78}
                disabled={isProcessingGroup}
                testID={`assign-import-${group.key}-${profile.id}`}
              >
                <UsersRound size={13} color={COLORS.navyDeep} />
                <Text style={styles.profileChipText}>{getImportProfileName(profile)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.groupButtonRow}>
            <TouchableOpacity
              style={[styles.groupButton, styles.createButton]}
              onPress={() => { void createProfileAndAssign(group); }}
              activeOpacity={0.78}
              disabled={isProcessingGroup || !group.sourceEmail}
              testID={`create-profile-for-import-${group.key}`}
            >
              <UserPlus size={14} color={COLORS.white} />
              <Text style={styles.createButtonText}>{group.sourceEmail ? 'Create profile' : 'No email'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.groupButton, styles.unassignedButton]}
              onPress={() => keepGroupUnassigned(group)}
              activeOpacity={0.78}
              disabled={isProcessingGroup}
              testID={`keep-import-unassigned-${group.key}`}
            >
              <Text style={styles.unassignedButtonText}>Keep unassigned</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isProcessingGroup ? (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color="#0F766E" />
            <Text style={styles.processingText}>Updating assignments...</Text>
          </View>
        ) : null}

        <View style={styles.itemsList}>
          {group.items.slice(0, 5).map(renderItem)}
          {group.items.length > 5 ? <Text style={styles.moreItemsText}>+{group.items.length - 5} more records in this group</Text> : null}
        </View>
      </View>
    );
  }, [activeProfiles, assignGroupToProfile, createProfileAndAssign, keepGroupUnassigned, processingKey, renderItem]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#081827', '#0F3D4C', '#0F766E']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Inbox size={22} color="#A7F3D0" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Import Assignment Review</Text>
            <Text style={styles.headerSubtitle}>Resolve unknown emails before planning</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} activeOpacity={0.75} testID="close-import-review">
            <X size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <AlertTriangle size={15} color="#92400E" />
                <Text style={styles.heroBadgeText}>{reviewItems.length} need review</Text>
              </View>
              <Text style={styles.heroMeta}>{reviewGroups.length} email group{reviewGroups.length === 1 ? '' : 's'}</Text>
            </View>
            <Text style={styles.heroTitle}>Unknown-email imports now have a dedicated owner assignment queue.</Text>
            <Text style={styles.heroBody}>Assign imported offers, cruises, and calendar events to the correct traveler profile, create a new linked profile, or intentionally leave records unassigned for later review.</Text>
          </View>

          <IntelligenceFilterStrip contextLabel="Import Review" compact={true} />

          {reviewItems.length === 0 ? (
            <View style={styles.emptyCard} testID="import-review-empty">
              <CheckCircle2 size={34} color="#059669" />
              <Text style={styles.emptyTitle}>No import assignments need review</Text>
              <Text style={styles.emptyBody}>All current imported records are matched to a profile/account or intentionally scoped.</Text>
              <TouchableOpacity style={styles.doneButton} onPress={() => router.back()} activeOpacity={0.78}>
                <Text style={styles.doneButtonText}>Done</Text>
                <ChevronRight size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.groupsWrap}>{reviewGroups.map(renderGroup)}</View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081827',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 243, 208, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167, 243, 208, 0.28)',
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '900' as const,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#FEF3C7',
  },
  heroBadgeText: {
    color: '#92400E',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '900' as const,
  },
  heroMeta: {
    color: '#64748B',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
  },
  heroTitle: {
    color: COLORS.navyDeep,
    fontSize: 21,
    fontWeight: '900' as const,
    lineHeight: 26,
  },
  heroBody: {
    color: '#475569',
    fontSize: TYPOGRAPHY.fontSizeSM,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  groupsWrap: {
    gap: SPACING.md,
  },
  groupCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.18)',
    ...SHADOW.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  groupIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CCFBF1',
  },
  groupHeaderCopy: {
    flex: 1,
  },
  groupTitle: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: '900' as const,
  },
  groupSubtitle: {
    color: '#64748B',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 2,
  },
  actionPanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '900' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    marginBottom: SPACING.sm,
  },
  profileChipRow: {
    gap: SPACING.xs,
    paddingRight: SPACING.md,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  profileChipText: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
  },
  groupButtonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  groupButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  createButton: {
    backgroundColor: '#0F766E',
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '900' as const,
  },
  unassignedButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  unassignedButtonText: {
    color: '#475569',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '900' as const,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  processingText: {
    color: '#0F766E',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
  },
  itemsList: {
    gap: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  itemTypePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#E0F2FE',
  },
  itemTypeText: {
    color: '#0369A1',
    fontSize: 10,
    fontWeight: '900' as const,
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
  },
  itemSubtitle: {
    color: '#64748B',
    fontSize: TYPOGRAPHY.fontSizeXS,
    marginTop: 2,
  },
  itemMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700' as const,
  },
  moreItemsText: {
    color: '#64748B',
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: '800' as const,
    paddingTop: SPACING.xs,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOW.sm,
  },
  emptyTitle: {
    color: COLORS.navyDeep,
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: '900' as const,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptyBody: {
    color: '#64748B',
    fontSize: TYPOGRAPHY.fontSizeSM,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.lg,
    backgroundColor: '#0F766E',
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  doneButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: '900' as const,
  },
});
