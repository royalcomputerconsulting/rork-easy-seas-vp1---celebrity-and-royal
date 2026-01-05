import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Save } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW, GRADIENTS } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { getLevelByNights, CROWN_ANCHOR_LEVELS } from '@/constants/crownAnchor';
import { getTierByPoints, CLUB_ROYALE_TIERS } from '@/constants/clubRoyaleTiers';
import { getCelebrityCaptainsClubLevelByPoints, CELEBRITY_CAPTAINS_CLUB_LEVELS } from '@/constants/celebrityCaptainsClub';
import { getCelebrityBlueChipTierByLevel, CELEBRITY_BLUE_CHIP_TIERS } from '@/constants/celebrityBlueChipClub';
import { BrandToggle } from './BrandToggle';

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
  preferredBrand?: 'royal' | 'celebrity';
}

interface LevelOption {
  value: string;
  label: string;
  color: string;
  nights: number;
}

interface UserProfileCardProps {
  currentValues: UserProfileData;
  onSave: (data: UserProfileData) => void;
  levelOptions?: LevelOption[];
  tierOptions?: { value: string; label: string; color: string }[];
  isSaving?: boolean;
}

export function UserProfileCard({
  currentValues,
  onSave,
  isSaving = false,
}: UserProfileCardProps) {
  const [formData, setFormData] = useState<UserProfileData>(currentValues);
  const [activeBrand, setActiveBrand] = useState<'royal' | 'celebrity'>(currentValues.preferredBrand || 'royal');

  useEffect(() => {
    setFormData(currentValues);
    setActiveBrand(currentValues.preferredBrand || 'royal');
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

  const handleBrandToggle = (brand: 'royal' | 'celebrity') => {
    setActiveBrand(brand);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Profile</Text>
      </View>

      <BrandToggle activeBrand={activeBrand} onToggle={handleBrandToggle} />

      <View style={styles.currentValuesSection}>
        <LinearGradient
          colors={GRADIENTS.nauticalCard as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.currentValuesBg}
        >
          <Text style={styles.currentValuesTitle}>Current Values</Text>
          
          {activeBrand === 'royal' ? (
            <>
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Name:</Text>
                <Text style={styles.valueText}>
                  {currentValues.name || 'Not set'}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Email:</Text>
                <Text style={styles.valueText}>
                  {currentValues.email || 'Not set'}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>C&A #:</Text>
                <Text style={styles.valueText}>
                  {currentValues.crownAnchorNumber || 'Not set'}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Club Royale Points:</Text>
                <Text style={[styles.valueText, styles.pointsValue]}>
                  {currentValues.clubRoyalePoints.toLocaleString()}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Club Royale Tier:</Text>
                <Text style={[styles.valueText, { color: calculatedTierInfo?.color || COLORS.loyalty }]}>
                  {calculatedTier.toUpperCase()}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Loyalty Points:</Text>
                <Text style={[styles.valueText, styles.loyaltyValue]}>
                  {currentValues.loyaltyPoints}
                </Text>
              </View>

              <View style={[styles.valueRow, styles.lastRow]}>
                <Text style={styles.valueLabel}>Crown & Anchor Level:</Text>
                <Text style={[styles.valueText, { color: calculatedLevelInfo?.color || COLORS.points }]}>
                  {calculatedLevel}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Name:</Text>
                <Text style={styles.valueText}>
                  {currentValues.name || 'Not set'}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Email:</Text>
                <Text style={styles.valueText}>
                  {currentValues.celebrityEmail || 'Not set'}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Captain&apos;s Club #:</Text>
                <Text style={styles.valueText}>
                  {currentValues.celebrityCaptainsClubNumber || 'Not set'}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Blue Chip Points:</Text>
                <Text style={[styles.valueText, styles.pointsValue]}>
                  {(currentValues.celebrityBlueChipPoints || 0).toLocaleString()}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Blue Chip Tier:</Text>
                <Text style={[styles.valueText, { color: calculatedCelebrityTierInfo?.color || COLORS.loyalty }]}>
                  {calculatedCelebrityTier.toUpperCase()}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Captain&apos;s Club Points:</Text>
                <Text style={[styles.valueText, styles.loyaltyValue]}>
                  {currentValues.celebrityCaptainsClubPoints || 0}
                </Text>
              </View>

              <View style={[styles.valueRow, styles.lastRow]}>
                <Text style={styles.valueLabel}>Captain&apos;s Club Level:</Text>
                <Text style={[styles.valueText, { color: calculatedCelebrityLevelInfo?.color || COLORS.points }]}>
                  {calculatedCelebrityLevel}
                </Text>
              </View>
            </>
          )}
        </LinearGradient>
      </View>

      <View style={styles.editSection}>
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

        <View style={styles.sectionDivider}>
          <Text style={styles.sectionDividerText}>Celebrity Cruises Profile</Text>
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
  currentValuesTitle: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.textNavy,
    textAlign: 'center',
    marginBottom: SPACING.md,
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
  sectionDivider: {
    marginVertical: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.bgSecondary,
  },
  sectionDividerText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textNavy,
    textAlign: 'center',
  },
});
