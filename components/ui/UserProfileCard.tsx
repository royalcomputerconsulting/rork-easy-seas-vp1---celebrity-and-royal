import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Save, CheckCircle, AlertCircle, Crown, Award, Star, Anchor, Ship } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, GRADIENTS } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { getLevelByNights, CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';
import { getTierByPoints, CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { getCelebrityCaptainsClubLevelByPoints, CELEBRITY_CAPTAINS_CLUB_LEVELS } from '@/constants/celebrityCaptainsClub';
import { getCelebrityBlueChipTierByLevel, CELEBRITY_BLUE_CHIP_TIERS } from '@/constants/celebrityBlueChipClub';
import { BrandToggle, BrandType } from './BrandToggle';

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
              {enrichmentData && Object.keys(enrichmentData).length > 0 ? 'Synced with account' : 'Manual entry'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.brandToggleContainer}>
        <BrandToggle activeBrand={activeBrand} onToggle={handleBrandToggle} showSilversea={true} />
      </View>

      <View style={styles.currentValuesSection}>
        {activeBrand === 'royal' && renderRoyalCaribbeanCurrentValues()}
        {activeBrand === 'celebrity' && renderCelebrityCurrentValues()}
        {activeBrand === 'silversea' && renderSilverseaCurrentValues()}
      </View>

      <View style={styles.editSection}>
        <Text style={styles.editSectionTitle}>EDIT PROFILE</Text>
        
        {activeBrand === 'royal' && renderRoyalCaribbeanEditForm()}
        {activeBrand === 'celebrity' && renderCelebrityEditForm()}
        {activeBrand === 'silversea' && renderSilverseaEditForm()}

        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          <LinearGradient
            colors={getBrandGradient()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Save size={18} color={COLORS.white} />
                <Text style={styles.saveButtonText}>Save Profile</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
  brandToggleContainer: {
    padding: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  currentValuesSection: {
    padding: SPACING.sm,
    paddingTop: 0,
  },
  currentValuesBg: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  currentValuesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 31, 63, 0.08)',
  },
  currentValuesTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    marginLeft: SPACING.xs,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  valueLabel: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.navyDeep,
    opacity: 0.7,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
  valueText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
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
    padding: SPACING.sm,
  },
  editSectionTitle: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: '#075985',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: '#075985',
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: '#0C4A6E',
  },
  saveButton: {
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
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
    color: COLORS.navyDeep,
    opacity: 0.7,
  },
  levelHintLevel: {
    fontWeight: TYPOGRAPHY.fontWeightBold,
  },
  sectionDividerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingTop: SPACING.xs,
  },
  sectionDividerSmallText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    opacity: 0.8,
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
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  enrichmentBadgeInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  enrichmentBadgeText: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  enrichmentBadgeTextActive: {
    color: '#166534',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
  },
  progressBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    gap: SPACING.xs,
  },
  progressBarBg: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  progressBarText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
    minWidth: 38,
    textAlign: 'right',
  },
  syncTimestamp: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 31, 63, 0.08)',
  },
  syncTimestampText: {
    fontSize: 10,
    color: COLORS.navyDeep,
    opacity: 0.6,
    fontStyle: 'italic' as const,
  },
});
