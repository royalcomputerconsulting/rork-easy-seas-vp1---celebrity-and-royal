import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Save, CheckCircle, AlertCircle, Crown, Award, Star, Anchor, Ship } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, GRADIENTS } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { getLevelByNights, CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';
import { getTierByPoints, CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { getCelebrityCaptainsClubLevelByPoints, CELEBRITY_CAPTAINS_CLUB_LEVELS } from '@/constants/celebrityCaptainsClub';
import { getCelebrityBlueChipTierByLevel, CELEBRITY_BLUE_CHIP_TIERS } from '@/constants/celebrityBlueChipClub';
import { BrandToggle, BrandType } from './BrandToggle';
import type { ExtendedLoyaltyData } from '@/lib/royalCaribbean/types';

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
  captainsClubId?: string;
  crownAndAnchorId?: string;
  crownAndAnchorTier?: string;
  crownAndAnchorNextTier?: string;
  crownAndAnchorRemainingPoints?: number;
  crownAndAnchorTrackerPercentage?: number;
  clubRoyaleTierFromApi?: string;
  clubRoyalePointsFromApi?: number;
  captainsClubTier?: string;
  captainsClubPoints?: number;
  captainsClubNextTier?: string;
  captainsClubRemainingPoints?: number;
  captainsClubTrackerPercentage?: number;
  celebrityBlueChipTier?: string;
  celebrityBlueChipPoints?: number;
  venetianSocietyTier?: string;
  venetianSocietyNextTier?: string;
  venetianSocietyMemberNumber?: string;
  venetianSocietyEnrolled?: boolean;
  hasCoBrandCard?: boolean;
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
  const [formData, setFormData] = useState<UserProfileData>(currentValues);
  const [activeBrand, setActiveBrand] = useState<BrandType>(
    (currentValues.preferredBrand as BrandType) || 'royal'
  );

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
        <CheckCircle size={10} color={COLORS.success} />
      ) : (
        <AlertCircle size={10} color={COLORS.textMuted} />
      )}
      <Text style={[styles.enrichmentBadgeText, hasData && styles.enrichmentBadgeTextActive]}>
        {hasData ? 'Synced' : 'Not Synced'}
      </Text>
    </View>
  );

  const renderValueRow = (label: string, value: string | number | undefined, color?: string, isLast?: boolean) => (
    <View style={[styles.valueRow, isLast && styles.lastRow]}>
      <Text style={styles.valueLabel}>{label}:</Text>
      <Text style={[styles.valueText, color ? { color } : null]}>
        {value !== undefined && value !== null && value !== '' ? (typeof value === 'number' ? value.toLocaleString() : value) : 'Not set'}
      </Text>
    </View>
  );

  const renderProgressBar = (percentage: number, color: string) => (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${Math.min(100, percentage)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.progressBarText}>{percentage.toFixed(1)}%</Text>
    </View>
  );

  const renderRoyalCaribbeanCurrentValues = () => (
    <LinearGradient
      colors={GRADIENTS.nauticalCard as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.currentValuesBg}
    >
      <View style={styles.currentValuesHeader}>
        <Anchor size={16} color={COLORS.textNavy} />
        <Text style={styles.currentValuesTitle}>Royal Caribbean Profile</Text>
        {renderEnrichmentBadge(!!enrichmentData?.crownAndAnchorId)}
      </View>
      
      <View style={styles.sectionDividerSmall}>
        <Text style={styles.sectionDividerSmallText}>Account Information</Text>
      </View>
      
      {renderValueRow('Name', currentValues.name)}
      {renderValueRow('Email', currentValues.email)}
      {renderValueRow('Crown & Anchor #', enrichmentData?.crownAndAnchorId || currentValues.crownAnchorNumber)}
      {enrichmentData?.accountId && renderValueRow('Account ID', enrichmentData.accountId)}
      {enrichmentData?.hasCoBrandCard !== undefined && renderValueRow('Co-Brand Card', enrichmentData.hasCoBrandCard ? 'Active' : 'None', enrichmentData.hasCoBrandCard ? COLORS.success : undefined)}
      
      <View style={styles.sectionDividerSmall}>
        <Crown size={12} color={COLORS.goldDark} />
        <Text style={styles.sectionDividerSmallText}>Crown & Anchor Society</Text>
      </View>
      
      {renderValueRow('Current Level', enrichmentData?.crownAndAnchorTier || calculatedLevel, calculatedLevelInfo?.color)}
      {renderValueRow('Loyalty Points (Nights)', currentValues.loyaltyPoints, COLORS.loyalty)}
      {enrichmentData?.crownAndAnchorNextTier && renderValueRow('Next Level', enrichmentData.crownAndAnchorNextTier)}
      {enrichmentData?.crownAndAnchorRemainingPoints !== undefined && renderValueRow('Points to Next', enrichmentData.crownAndAnchorRemainingPoints)}
      {enrichmentData?.crownAndAnchorTrackerPercentage !== undefined && (
        <View style={styles.progressRow}>
          <Text style={styles.valueLabel}>Progress:</Text>
          {renderProgressBar(enrichmentData.crownAndAnchorTrackerPercentage, calculatedLevelInfo?.color || COLORS.points)}
        </View>
      )}
      
      <View style={styles.sectionDividerSmall}>
        <Award size={12} color={COLORS.goldDark} />
        <Text style={styles.sectionDividerSmallText}>Club Royale Casino</Text>
      </View>
      
      {renderValueRow('Current Tier', enrichmentData?.clubRoyaleTierFromApi || calculatedTier, calculatedTierInfo?.color)}
      {renderValueRow('Casino Points', enrichmentData?.clubRoyalePointsFromApi ?? currentValues.clubRoyalePoints, COLORS.points)}
      
      {(enrichmentData?.venetianSocietyTier || enrichmentData?.venetianSocietyEnrolled) && (
        <>
          <View style={styles.sectionDividerSmall}>
            <Ship size={12} color="#8B4513" />
            <Text style={styles.sectionDividerSmallText}>Venetian Society (Silversea)</Text>
          </View>
          
          {renderValueRow('Enrolled', enrichmentData.venetianSocietyEnrolled ? 'Yes' : 'No', enrichmentData.venetianSocietyEnrolled ? COLORS.success : undefined)}
          {enrichmentData.venetianSocietyTier && renderValueRow('Tier', enrichmentData.venetianSocietyTier)}
          {enrichmentData.venetianSocietyMemberNumber && renderValueRow('Member #', enrichmentData.venetianSocietyMemberNumber)}
          {enrichmentData.venetianSocietyNextTier && renderValueRow('Next Tier', enrichmentData.venetianSocietyNextTier)}
        </>
      )}
      
      {enrichmentData?.lastSyncTimestamp && (
        <View style={[styles.valueRow, styles.lastRow, styles.syncTimestamp]}>
          <Text style={styles.syncTimestampText}>Last synced: {formatDate(enrichmentData.lastSyncTimestamp)}</Text>
        </View>
      )}
    </LinearGradient>
  );

  const renderCelebrityCurrentValues = () => (
    <LinearGradient
      colors={['#F0F4F8', '#E8EEF4', '#DDE6EF'] as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.currentValuesBg}
    >
      <View style={styles.currentValuesHeader}>
        <Star size={16} color="#1a365d" />
        <Text style={styles.currentValuesTitle}>Celebrity Cruises Profile</Text>
        {renderEnrichmentBadge(!!enrichmentData?.captainsClubId)}
      </View>
      
      <View style={styles.sectionDividerSmall}>
        <Text style={styles.sectionDividerSmallText}>Account Information</Text>
      </View>
      
      {renderValueRow('Name', currentValues.name)}
      {renderValueRow('Email', currentValues.celebrityEmail)}
      {renderValueRow("Captain's Club #", enrichmentData?.captainsClubId || currentValues.celebrityCaptainsClubNumber)}
      
      <View style={styles.sectionDividerSmall}>
        <Crown size={12} color="#1a365d" />
        <Text style={styles.sectionDividerSmallText}>Captain&apos;s Club</Text>
      </View>
      
      {renderValueRow('Current Level', enrichmentData?.captainsClubTier || calculatedCelebrityLevel, calculatedCelebrityLevelInfo?.color)}
      {renderValueRow('Club Points', enrichmentData?.captainsClubPoints ?? currentValues.celebrityCaptainsClubPoints, COLORS.loyalty)}
      {enrichmentData?.captainsClubNextTier && renderValueRow('Next Level', enrichmentData.captainsClubNextTier)}
      {enrichmentData?.captainsClubRemainingPoints !== undefined && renderValueRow('Points to Next', enrichmentData.captainsClubRemainingPoints)}
      {enrichmentData?.captainsClubTrackerPercentage !== undefined && (
        <View style={styles.progressRow}>
          <Text style={styles.valueLabel}>Progress:</Text>
          {renderProgressBar(enrichmentData.captainsClubTrackerPercentage, calculatedCelebrityLevelInfo?.color || COLORS.points)}
        </View>
      )}
      
      <View style={styles.sectionDividerSmall}>
        <Award size={12} color="#1a365d" />
        <Text style={styles.sectionDividerSmallText}>Blue Chip Club Casino</Text>
      </View>
      
      {renderValueRow('Current Tier', enrichmentData?.celebrityBlueChipTier || calculatedCelebrityTier, calculatedCelebrityTierInfo?.color)}
      {renderValueRow('Casino Points', enrichmentData?.celebrityBlueChipPoints ?? currentValues.celebrityBlueChipPoints, COLORS.points, true)}
    </LinearGradient>
  );

  const renderSilverseaCurrentValues = () => (
    <LinearGradient
      colors={['#FAF8F5', '#F5F0E8', '#EDE5D8'] as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.currentValuesBg}
    >
      <View style={styles.currentValuesHeader}>
        <Ship size={16} color="#8B4513" />
        <Text style={styles.currentValuesTitle}>Silversea Profile</Text>
        {renderEnrichmentBadge(!!enrichmentData?.venetianSocietyMemberNumber)}
      </View>
      
      <View style={styles.sectionDividerSmall}>
        <Text style={styles.sectionDividerSmallText}>Account Information</Text>
      </View>
      
      {renderValueRow('Name', currentValues.name)}
      {renderValueRow('Email', currentValues.silverseaEmail)}
      
      <View style={styles.sectionDividerSmall}>
        <Crown size={12} color="#8B4513" />
        <Text style={styles.sectionDividerSmallText}>Venetian Society</Text>
      </View>
      
      {renderValueRow('Member #', enrichmentData?.venetianSocietyMemberNumber || currentValues.silverseaVenetianNumber)}
      {renderValueRow('Enrolled', enrichmentData?.venetianSocietyEnrolled ? 'Yes' : 'No', enrichmentData?.venetianSocietyEnrolled ? COLORS.success : undefined)}
      {renderValueRow('Current Tier', enrichmentData?.venetianSocietyTier || currentValues.silverseaVenetianTier)}
      {enrichmentData?.venetianSocietyNextTier && renderValueRow('Next Tier', enrichmentData.venetianSocietyNextTier)}
      {currentValues.silverseaVenetianPoints !== undefined && renderValueRow('Points', currentValues.silverseaVenetianPoints, COLORS.loyalty, true)}
    </LinearGradient>
  );

  const renderRoyalCaribbeanEditForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
          placeholder="Enter your name"
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
          placeholder="Enter your email"
          placeholderTextColor={COLORS.textMuted}
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
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Current Club Royale Points</Text>
        <TextInput
          style={styles.input}
          value={formData.clubRoyalePoints.toString()}
          onChangeText={(text) => setFormData(prev => ({ ...prev, clubRoyalePoints: parseInt(text) || 0 }))}
          placeholder="Enter current points"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
        />
        <View style={styles.levelHint}>
          <View style={[styles.levelHintDot, { backgroundColor: calculatedTierInfo?.color || COLORS.loyalty }]} />
          <Text style={styles.levelHintText}>
            Club Royale Tier: <Text style={[styles.levelHintLevel, { color: calculatedTierInfo?.color || COLORS.loyalty }]}>{calculatedTier}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Loyalty Points (Nights)</Text>
        <TextInput
          style={styles.input}
          value={formData.loyaltyPoints.toString()}
          onChangeText={(text) => setFormData(prev => ({ ...prev, loyaltyPoints: parseInt(text) || 0 }))}
          placeholder="Enter loyalty nights"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
        />
        <View style={styles.levelHint}>
          <View style={[styles.levelHintDot, { backgroundColor: calculatedLevelInfo?.color || COLORS.points }]} />
          <Text style={styles.levelHintText}>
            Crown & Anchor Level: <Text style={[styles.levelHintLevel, { color: calculatedLevelInfo?.color || COLORS.points }]}>{calculatedLevel}</Text>
          </Text>
        </View>
      </View>
    </>
  );

  const renderCelebrityEditForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
          placeholder="Enter your name"
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Celebrity Email Address</Text>
        <TextInput
          style={styles.input}
          value={formData.celebrityEmail || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityEmail: text }))}
          placeholder="Enter Celebrity email"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Captain&apos;s Club Number</Text>
        <TextInput
          style={styles.input}
          value={formData.celebrityCaptainsClubNumber || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityCaptainsClubNumber: text }))}
          placeholder="Enter Captain's Club number"
          placeholderTextColor={COLORS.textMuted}
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
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
        />
        <View style={styles.levelHint}>
          <View style={[styles.levelHintDot, { backgroundColor: calculatedCelebrityLevelInfo?.color || COLORS.points }]} />
          <Text style={styles.levelHintText}>
            Captain&apos;s Club Level: <Text style={[styles.levelHintLevel, { color: calculatedCelebrityLevelInfo?.color || COLORS.points }]}>{calculatedCelebrityLevel}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Blue Chip Club Points</Text>
        <TextInput
          style={styles.input}
          value={(formData.celebrityBlueChipPoints || 0).toString()}
          onChangeText={(text) => setFormData(prev => ({ ...prev, celebrityBlueChipPoints: parseInt(text) || 0 }))}
          placeholder="Enter Blue Chip points"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
        />
        <View style={styles.levelHint}>
          <View style={[styles.levelHintDot, { backgroundColor: calculatedCelebrityTierInfo?.color || COLORS.loyalty }]} />
          <Text style={styles.levelHintText}>
            Blue Chip Tier: <Text style={[styles.levelHintLevel, { color: calculatedCelebrityTierInfo?.color || COLORS.loyalty }]}>{calculatedCelebrityTier}</Text>
          </Text>
        </View>
      </View>
    </>
  );

  const renderSilverseaEditForm = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
          placeholder="Enter your name"
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Silversea Email Address</Text>
        <TextInput
          style={styles.input}
          value={formData.silverseaEmail || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaEmail: text }))}
          placeholder="Enter Silversea email"
          placeholderTextColor={COLORS.textMuted}
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
          placeholder="Enter Venetian Society number"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Venetian Society Tier</Text>
        <TextInput
          style={styles.input}
          value={formData.silverseaVenetianTier || ''}
          onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaVenetianTier: text }))}
          placeholder="e.g., Silver, Gold, Platinum"
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Venetian Society Points</Text>
        <TextInput
          style={styles.input}
          value={(formData.silverseaVenetianPoints || 0).toString()}
          onChangeText={(text) => setFormData(prev => ({ ...prev, silverseaVenetianPoints: parseInt(text) || 0 }))}
          placeholder="Enter Venetian points"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
        />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Profile</Text>
      </View>

      <BrandToggle activeBrand={activeBrand} onToggle={handleBrandToggle} showSilversea={true} />

      <View style={styles.currentValuesSection}>
        {activeBrand === 'royal' && renderRoyalCaribbeanCurrentValues()}
        {activeBrand === 'celebrity' && renderCelebrityCurrentValues()}
        {activeBrand === 'silversea' && renderSilverseaCurrentValues()}
      </View>

      <View style={styles.editSection}>
        <Text style={styles.editSectionTitle}>Edit Profile</Text>
        
        {activeBrand === 'royal' && renderRoyalCaribbeanEditForm()}
        {activeBrand === 'celebrity' && renderCelebrityEditForm()}
        {activeBrand === 'silversea' && renderSilverseaEditForm()}

        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Save size={18} color={COLORS.white} />
              <Text style={styles.saveButtonText}>Save Profile</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOW.lg,
  },
  header: {
    backgroundColor: COLORS.textNavy,
    padding: SPACING.lg,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.white,
  },
  currentValuesSection: {
    padding: SPACING.lg,
    paddingBottom: 0,
  },
  currentValuesBg: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  currentValuesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  currentValuesTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textNavy,
    marginLeft: SPACING.sm,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  valueLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textDarkGrey,
  },
  valueText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textNavy,
    maxWidth: '60%',
    textAlign: 'right',
  },
  pointsValue: {
    color: COLORS.points,
  },
  loyaltyValue: {
    color: COLORS.loyalty,
  },
  editSection: {
    padding: SPACING.lg,
  },
  editSectionTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textNavy,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textNavy,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textNavy,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  saveButton: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.textNavy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  levelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    gap: SPACING.xs,
  },
  levelHintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  levelHintText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textDarkGrey,
  },
  levelHintLevel: {
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
  },
  sectionDividerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.1)',
  },
  sectionDividerSmallText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textNavy,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  enrichmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  enrichmentBadgeActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  enrichmentBadgeInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  enrichmentBadgeText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textMuted,
  },
  enrichmentBadgeTextActive: {
    color: COLORS.success,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  progressBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.md,
    gap: SPACING.sm,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textNavy,
    minWidth: 45,
    textAlign: 'right',
  },
  syncTimestamp: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.1)',
  },
  syncTimestampText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textMuted,
    fontStyle: 'italic' as const,
  },
});
