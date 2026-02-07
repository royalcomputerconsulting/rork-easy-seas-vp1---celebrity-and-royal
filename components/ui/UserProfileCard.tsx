import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Save, CheckCircle, AlertCircle, Crown, Award, Star, Anchor, Ship, Edit2, X, User } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { getLevelByNights, CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';
import { getTierByPoints, CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { getCelebrityCaptainsClubLevelByPoints, CELEBRITY_CAPTAINS_CLUB_LEVELS } from '@/constants/celebrityCaptainsClub';
import { getCelebrityBlueChipTierByLevel, CELEBRITY_BLUE_CHIP_TIERS } from '@/constants/celebrityBlueChipClub';
import { BrandToggle, BrandType } from './BrandToggle';
import { useEntitlement } from '@/state/EntitlementProvider';

interface UserProfileData {
  name: string;
  email: string;
  crownAnchorNumber: string;
  clubRoyalePoints: number;
  clubRoyaleTier: string;
  loyaltyPoints: number;
  crownAnchorLevel: string;
  celebrityEmail?: string;
  celebrityCaptainsClubNumber?: string;
  celebrityCaptainsClubPoints: number;
  celebrityBlueChipPoints: number;
  celebrityBlueChipTier: string;
  celebrityCaptainsClubLevel: string;
  preferredBrand?: 'royal' | 'celebrity' | 'silversea';
  silverseaEmail?: string;
  silverseaVenetianNumber?: string;
  silverseaVenetianTier?: string;
  silverseaVenetianPoints?: number;
}

interface EnrichmentData {
  accountId?: string;
  crownAndAnchorId?: string;
  crownAndAnchorTier?: string;
  crownAndAnchorNextTier?: string;
  crownAndAnchorRemainingPoints?: number;
  crownAndAnchorTrackerPercentage?: number;
  crownAndAnchorRelationshipPointsFromApi?: number;
  crownAndAnchorLoyaltyMatchTier?: string;
  clubRoyaleTierFromApi?: string;
  clubRoyalePointsFromApi?: number;
  clubRoyaleRelationshipPointsFromApi?: number;
  captainsClubId?: string;
  captainsClubTier?: string;
  captainsClubPoints?: number;
  captainsClubRelationshipPoints?: number;
  captainsClubNextTier?: string;
  captainsClubRemainingPoints?: number;
  captainsClubTrackerPercentage?: number;
  captainsClubLoyaltyMatchTier?: string;
  celebrityBlueChipTier?: string;
  celebrityBlueChipPoints?: number;
  celebrityBlueChipRelationshipPoints?: number;
  venetianSocietyTier?: string;
  venetianSocietyNextTier?: string;
  venetianSocietyMemberNumber?: string;
  venetianSocietyEnrolled?: boolean;
  venetianSocietyLoyaltyMatchTier?: string;
  hasCoBrandCard?: boolean;
  coBrandCardStatus?: number;
  coBrandCardErrorMessage?: string;
  lastSyncTimestamp?: string;
}

interface UserProfileCardProps {
  currentValues: UserProfileData;
  enrichmentData?: EnrichmentData | null;
  onSave: (data: UserProfileData) => void;
  isSaving?: boolean;
}

export function UserProfileCard({
  currentValues,
  enrichmentData,
  onSave,
  isSaving = false,
}: UserProfileCardProps) {
  const entitlement = useEntitlement();
  const [formData, setFormData] = useState<UserProfileData>(currentValues);
  const [activeBrand, setActiveBrand] = useState<BrandType>(
    (currentValues.preferredBrand as BrandType) || 'royal'
  );
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    setFormData(currentValues);
    setActiveBrand((currentValues.preferredBrand as BrandType) || 'royal');
  }, [currentValues]);

  const calculatedLevel = getLevelByNights(formData.loyaltyPoints);
  const calculatedLevelInfo = CROWN_ANCHOR_LEVELS[calculatedLevel];
  
  const calculatedTier = getTierByPoints(formData.clubRoyalePoints);
  const calculatedTierInfo = CLUB_ROYALE_TIERS[calculatedTier];

  const calculatedCelebrityLevel = getCelebrityCaptainsClubLevelByPoints(formData.celebrityCaptainsClubPoints || 0);
  const calculatedCelebrityLevelInfo = CELEBRITY_CAPTAINS_CLUB_LEVELS[calculatedCelebrityLevel];
  
  const celebrityBlueChipLevel = 1;
  const calculatedCelebrityTier = getCelebrityBlueChipTierByLevel(celebrityBlueChipLevel);
  const calculatedCelebrityTierInfo = CELEBRITY_BLUE_CHIP_TIERS[calculatedCelebrityTier];

  const handleSave = () => {
    onSave({
      ...formData,
      clubRoyaleTier: calculatedTier,
      crownAnchorLevel: calculatedLevel,
      celebrityBlueChipTier: calculatedCelebrityTier,
      celebrityCaptainsClubLevel: calculatedCelebrityLevel,
      preferredBrand: activeBrand,
    });
    setIsModalVisible(false);
  };

  const handleBrandToggle = (brand: BrandType) => {
    setActiveBrand(brand);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown';
    }
  };

  const renderEnrichmentBadge = (hasData: boolean) => (
    <View style={[styles.enrichmentBadge, hasData ? styles.enrichmentBadgeActive : styles.enrichmentBadgeInactive]}>
      {hasData ? (
        <CheckCircle size={10} color={COLORS.white} />
      ) : (
        <AlertCircle size={10} color="rgba(255,255,255,0.7)" />
      )}
      <Text style={styles.enrichmentBadgeText}>
        {hasData ? 'Synced' : 'Manual'}
      </Text>
    </View>
  );

  const renderValueCard = (label: string, value: string | number | undefined, color?: string, wide?: boolean) => (
    <View style={[styles.valueCard, wide && styles.valueCardWide]}>
      <Text style={styles.valueCardLabel}>{label}</Text>
      <Text style={[styles.valueCardValue, color ? { color } : null]}>
        {value !== undefined && value !== null && value !== '' ? (typeof value === 'number' ? value.toLocaleString() : value) : 'Not set'}
      </Text>
    </View>
  );

  const getBrandIcon = () => {
    switch (activeBrand) {
      case 'royal':
        return <Anchor size={20} color={COLORS.white} />;
      case 'celebrity':
        return <Star size={20} color={COLORS.white} />;
      case 'silversea':
        return <Ship size={20} color={COLORS.white} />;
      default:
        return <Anchor size={20} color={COLORS.white} />;
    }
  };

  const getBrandTitle = () => {
    switch (activeBrand) {
      case 'royal':
        return 'Royal Caribbean Profile';
      case 'celebrity':
        return 'Celebrity Cruises Profile';
      case 'silversea':
        return 'Silversea Profile';
      default:
        return 'User Profile';
    }
  };

  const getBrandGradient = () => {
    switch (activeBrand) {
      case 'royal':
        return ['#0369A1', '#0284C7'] as [string, string];
      case 'celebrity':
        return ['#1E40AF', '#2563EB'] as [string, string];
      case 'silversea':
        return ['#78350F', '#92400E'] as [string, string];
      default:
        return ['#0369A1', '#0284C7'] as [string, string];
    }
  };

  const hasSyncedData = activeBrand === 'royal' 
    ? !!enrichmentData?.crownAndAnchorId 
    : activeBrand === 'celebrity' 
    ? !!enrichmentData?.captainsClubId 
    : !!enrichmentData?.venetianSocietyMemberNumber;

  const getSubscriptionTierDisplay = () => {
    if (entitlement.isPro) return { text: 'Pro Active', color: '#10B981' };
    if (entitlement.isBasic) return { text: 'Basic Active', color: '#3B82F6' };
    if (entitlement.tier === 'trial') return { text: `Trial (${entitlement.trialDaysRemaining}d left)`, color: '#F59E0B' };
    return { text: 'View Only', color: '#6B7280' };
  };

  const renderRoyalCaribbeanValues = () => {
    const subTier = getSubscriptionTierDisplay();
    return (
      <View style={styles.valuesGrid}>
        {renderValueCard('Subscription', subTier.text, subTier.color, true)}
        {renderValueCard('Name', currentValues.name, undefined, true)}
        {renderValueCard('Email', currentValues.email, undefined, true)}
        {renderValueCard('Crown & Anchor #', enrichmentData?.crownAndAnchorId || currentValues.crownAnchorNumber, undefined, true)}
        {renderValueCard('C&A Level', enrichmentData?.crownAndAnchorTier || calculatedLevel, calculatedLevelInfo?.color)}
        {renderValueCard('Loyalty Points', currentValues.loyaltyPoints, COLORS.loyalty)}
        {renderValueCard('Club Royale Tier', enrichmentData?.clubRoyaleTierFromApi || calculatedTier, calculatedTierInfo?.color)}
        {renderValueCard('Casino Points', enrichmentData?.clubRoyalePointsFromApi ?? currentValues.clubRoyalePoints, COLORS.points)}
        {enrichmentData?.crownAndAnchorNextTier && renderValueCard('Next C&A Level', enrichmentData.crownAndAnchorNextTier)}
        {enrichmentData?.crownAndAnchorRemainingPoints !== undefined && renderValueCard('Points to Next', enrichmentData.crownAndAnchorRemainingPoints)}
      </View>
    );
  };

  const renderCelebrityValues = () => {
    const subTier = getSubscriptionTierDisplay();
    return (
      <View style={styles.valuesGrid}>
        {renderValueCard('Subscription', subTier.text, subTier.color, true)}
        {renderValueCard('Name', currentValues.name, undefined, true)}
        {renderValueCard('Email', currentValues.celebrityEmail, undefined, true)}
        {renderValueCard("Captain's Club #", enrichmentData?.captainsClubId || currentValues.celebrityCaptainsClubNumber, undefined, true)}
        {renderValueCard("Captain's Level", enrichmentData?.captainsClubTier || calculatedCelebrityLevel, calculatedCelebrityLevelInfo?.color)}
        {renderValueCard('Club Points', enrichmentData?.captainsClubPoints ?? currentValues.celebrityCaptainsClubPoints, COLORS.loyalty)}
        {renderValueCard('Blue Chip Tier', enrichmentData?.celebrityBlueChipTier || calculatedCelebrityTier, calculatedCelebrityTierInfo?.color)}
        {renderValueCard('Casino Points', enrichmentData?.celebrityBlueChipPoints ?? currentValues.celebrityBlueChipPoints, COLORS.points)}
        {enrichmentData?.captainsClubNextTier && renderValueCard('Next Level', enrichmentData.captainsClubNextTier)}
        {enrichmentData?.captainsClubRemainingPoints !== undefined && renderValueCard('Points to Next', enrichmentData.captainsClubRemainingPoints)}
      </View>
    );
  };

  const renderSilverseaValues = () => {
    const subTier = getSubscriptionTierDisplay();
    return (
      <View style={styles.valuesGrid}>
        {renderValueCard('Subscription', subTier.text, subTier.color, true)}
        {renderValueCard('Name', currentValues.name, undefined, true)}
        {renderValueCard('Email', currentValues.silverseaEmail, undefined, true)}
        {renderValueCard('Venetian Member #', enrichmentData?.venetianSocietyMemberNumber || currentValues.silverseaVenetianNumber, undefined, true)}
        {renderValueCard('Enrolled', enrichmentData?.venetianSocietyEnrolled ? 'Yes' : 'No', enrichmentData?.venetianSocietyEnrolled ? COLORS.success : undefined)}
        {renderValueCard('Tier', enrichmentData?.venetianSocietyTier || currentValues.silverseaVenetianTier)}
        {renderValueCard('Points', currentValues.silverseaVenetianPoints, COLORS.loyalty)}
        {enrichmentData?.venetianSocietyNextTier && renderValueCard('Next Tier', enrichmentData.venetianSocietyNextTier)}
      </View>
    );
  };

  const renderEditForm = () => {
    if (activeBrand === 'royal') {
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Crown & Anchor #</Text>
            <TextInput
              style={styles.input}
              value={formData.crownAnchorNumber}
              onChangeText={(text) => setFormData(prev => ({ ...prev, crownAnchorNumber: text }))}
              placeholder="Enter Crown & Anchor number"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Loyalty Points (Nights)</Text>
            <TextInput
              style={styles.input}
              value={formData.loyaltyPoints.toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, loyaltyPoints: parseInt(text) || 0 }))}
              placeholder="Enter loyalty nights"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <View style={styles.levelHint}>
              <View style={[styles.levelHintDot, { backgroundColor: calculatedLevelInfo?.color || COLORS.points }]} />
              <Text style={styles.levelHintText}>
                Level: <Text style={[styles.levelHintLevel, { color: calculatedLevelInfo?.color || COLORS.points }]}>{calculatedLevel}</Text>
              </Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Club Royale Points</Text>
            <TextInput
              style={styles.input}
              value={formData.clubRoyalePoints.toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, clubRoyalePoints: parseInt(text) || 0 }))}
              placeholder="Enter current points"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <View style={styles.levelHint}>
              <View style={[styles.levelHintDot, { backgroundColor: calculatedTierInfo?.color || COLORS.loyalty }]} />
              <Text style={styles.levelHintText}>
                Tier: <Text style={[styles.levelHintLevel, { color: calculatedTierInfo?.color || COLORS.loyalty }]}>{calculatedTier}</Text>
              </Text>
            </View>
          </View>
        </>
      );
    } else if (activeBrand === 'celebrity') {
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Celebrity Email</Text>
            <TextInput
              style={styles.input}
              value={formData.celebrityEmail || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityEmail: text }))}
              placeholder="Enter Celebrity email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Captain&apos;s Club #</Text>
            <TextInput
              style={styles.input}
              value={formData.celebrityCaptainsClubNumber || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityCaptainsClubNumber: text }))}
              placeholder="Enter Captain's Club number"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Captain&apos;s Club Points</Text>
            <TextInput
              style={styles.input}
              value={(formData.celebrityCaptainsClubPoints || 0).toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityCaptainsClubPoints: parseInt(text) || 0 }))}
              placeholder="Enter Captain's Club points"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <View style={styles.levelHint}>
              <View style={[styles.levelHintDot, { backgroundColor: calculatedCelebrityLevelInfo?.color || COLORS.points }]} />
              <Text style={styles.levelHintText}>
                Level: <Text style={[styles.levelHintLevel, { color: calculatedCelebrityLevelInfo?.color || COLORS.points }]}>{calculatedCelebrityLevel}</Text>
              </Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Blue Chip Points</Text>
            <TextInput
              style={styles.input}
              value={(formData.celebrityBlueChipPoints || 0).toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityBlueChipPoints: parseInt(text) || 0 }))}
              placeholder="Enter Blue Chip points"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <View style={styles.levelHint}>
              <View style={[styles.levelHintDot, { backgroundColor: calculatedCelebrityTierInfo?.color || COLORS.loyalty }]} />
              <Text style={styles.levelHintText}>
                Tier: <Text style={[styles.levelHintLevel, { color: calculatedCelebrityTierInfo?.color || COLORS.loyalty }]}>{calculatedCelebrityTier}</Text>
              </Text>
            </View>
          </View>
        </>
      );
    } else {
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Silversea Email</Text>
            <TextInput
              style={styles.input}
              value={formData.silverseaEmail || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaEmail: text }))}
              placeholder="Enter Silversea email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venetian Society Member #</Text>
            <TextInput
              style={styles.input}
              value={formData.silverseaVenetianNumber || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaVenetianNumber: text }))}
              placeholder="Enter member number"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venetian Tier</Text>
            <TextInput
              style={styles.input}
              value={formData.silverseaVenetianTier || ''}
              onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaVenetianTier: text }))}
              placeholder="e.g., Silver, Gold, Platinum"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Venetian Points</Text>
            <TextInput
              style={styles.input}
              value={(formData.silverseaVenetianPoints || 0).toString()}
              onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaVenetianPoints: parseInt(text) || 0 }))}
              placeholder="Enter points"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>
        </>
      );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={getBrandGradient()}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            {getBrandIcon()}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{getBrandTitle()}</Text>
            <Text style={styles.headerSubtitle}>
              {hasSyncedData ? 'Synced with account' : 'Manual entry'}
            </Text>
          </View>
        </View>
        {renderEnrichmentBadge(hasSyncedData)}
      </LinearGradient>

      <View style={styles.brandToggleContainer}>
        <BrandToggle activeBrand={activeBrand} onToggle={handleBrandToggle} showSilversea={true} />
      </View>

      <View style={styles.currentValuesSection}>
        {activeBrand === 'royal' && renderRoyalCaribbeanValues()}
        {activeBrand === 'celebrity' && renderCelebrityValues()}
        {activeBrand === 'silversea' && renderSilverseaValues()}
      </View>

      {enrichmentData?.lastSyncTimestamp && (
        <View style={styles.syncTimestampContainer}>
          <Text style={styles.syncTimestampText}>Last synced: {formatDate(enrichmentData.lastSyncTimestamp)}</Text>
        </View>
      )}

      <View style={styles.editButtonContainer}>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => setIsModalVisible(true)}
          activeOpacity={0.7}
        >
          <Edit2 size={16} color={getBrandGradient()[0]} />
          <Text style={[styles.editButtonText, { color: getBrandGradient()[0] }]}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <User size={20} color={getBrandGradient()[0]} />
                  <Text style={[styles.modalTitle, { color: getBrandGradient()[0] }]}>
                    Edit {getBrandTitle()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setIsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                {renderEditForm()}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setIsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={handleSave}
                  activeOpacity={0.7}
                  disabled={isSaving}
                >
                  <LinearGradient
                    colors={getBrandGradient()}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSaveButtonGradient}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Save size={16} color={COLORS.white} />
                        <Text style={styles.modalSaveText}>Save Profile</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.2)',
    ...SHADOW.sm,
  },
  header: {
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  enrichmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.xs,
  },
  enrichmentBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  enrichmentBadgeInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  enrichmentBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  brandToggleContainer: {
    padding: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  currentValuesSection: {
    padding: SPACING.sm,
    paddingTop: 0,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  valueCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.15)',
  },
  valueCardWide: {
    minWidth: '96%',
  },
  valueCardLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  valueCardValue: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#0F172A',
  },
  syncTimestampContainer: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  syncTimestampText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic' as const,
    textAlign: 'center',
  },
  editButtonContainer: {
    padding: SPACING.sm,
    paddingTop: 0,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(3, 105, 161, 0.3)',
    borderStyle: 'dashed',
    gap: SPACING.xs,
  },
  editButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  modalCloseButton: {
    padding: SPACING.xs,
  },
  modalContent: {
    padding: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#1E40AF',
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#111827',
  },
  levelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(3, 105, 161, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    gap: 6,
  },
  levelHintDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  levelHintText: {
    fontSize: 10,
    color: '#1E40AF',
  },
  levelHintLevel: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: 0,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#6B7280',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  modalSaveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  modalSaveText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
});
