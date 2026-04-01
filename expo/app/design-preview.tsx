import React, { useCallback, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  Settings,
  Ship,
  Star,
} from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

type BrandTab = 'royal' | 'celebrity' | 'silversea';
type PreviewTone = 'coral' | 'amber' | 'gold';

type BrandPreview = {
  memberLabel: string;
  primaryStatus: string;
  secondaryStatus: string;
  progressCards: ProgressPreview[];
  metrics: Array<{ label: string; value: string; tint: string }>;
};

type ProgressPreview = {
  id: string;
  title: string;
  percentage: string;
  amount: string;
  support: string;
  accent: [string, string];
  kind: 'crown' | 'star';
  callouts: Array<{
    id: string;
    tone: PreviewTone;
    title: string;
    detail: string;
  }>;
};

type GlassSurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

const SCREEN_BACKGROUND = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80';
const SCREEN_BACKGROUND_FALLBACK = 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80';
const PLAYER_HERO = 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=80';
const PLAYER_HERO_FALLBACK = 'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1400&q=80';
const OFFER_HERO = 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&w=1400&q=80';
const OFFER_HERO_FALLBACK = 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1400&q=80';

const TABS: Array<{ key: BrandTab; label: string }> = [
  { key: 'royal', label: 'Royal Caribbean' },
  { key: 'celebrity', label: 'Celebrity' },
  { key: 'silversea', label: 'Silversea' },
];

const BRANDS: Record<BrandTab, BrandPreview> = {
  royal: {
    memberLabel: 'Crown & Anchor # 4387 2041',
    primaryStatus: 'Diamond Plus',
    secondaryStatus: 'Signature',
    progressCards: [
      {
        id: 'diamond-pinnacle',
        title: 'Diamond → Pinnacle',
        percentage: '73%',
        amount: '512 / 700 nights',
        support: '188 nights to Pinnacle with your current booked sailings preserved.',
        accent: ['#00BCD4', '#B8860B'],
        kind: 'crown',
        callouts: [
          {
            id: 'threshold',
            tone: 'gold',
            title: 'Threshold crossed',
            detail: 'Diamond Plus clears on Icon of the Seas · Feb 14, 2027',
          },
          {
            id: 'first-cruise',
            tone: 'amber',
            title: 'First cruise as Pinnacle',
            detail: 'Legend of the Seas · Jun 02, 2028',
          },
        ],
      },
      {
        id: 'prime-signature',
        title: 'Prime → Signature',
        percentage: '79%',
        amount: '8,460 / 10,000 pts',
        support: 'Cruise-day play is trending toward Signature without changing the current bar logic.',
        accent: ['#3B82F6', '#7B2D8E'],
        kind: 'star',
        callouts: [
          {
            id: 'prime-window',
            tone: 'coral',
            title: 'Threshold crossed',
            detail: 'Projected during Oasis casino week · Sep 2026',
          },
        ],
      },
      {
        id: 'signature-masters',
        title: 'Signature → Masters',
        percentage: '41%',
        amount: '48,630 / 100,000 pts',
        support: 'Long-term runway remains visible with the same existing progress structure.',
        accent: ['#7B2D8E', '#D4A00A'],
        kind: 'star',
        callouts: [
          {
            id: 'milestone',
            tone: 'gold',
            title: 'Big milestone',
            detail: 'Crosses 50K club points on your spring Caribbean block',
          },
        ],
      },
    ],
    metrics: [
      { label: 'CR Points', value: '48,630', tint: '#7B2D8E' },
      { label: 'C&A', value: '512', tint: '#00BCD4' },
      { label: 'To Pinnacle', value: '188', tint: '#B8860B' },
    ],
  },
  celebrity: {
    memberLabel: "Captain's Club # 8126 1930",
    primaryStatus: 'Zenith',
    secondaryStatus: 'Elite Plus',
    progressCards: [
      {
        id: 'captains-club',
        title: 'Elite Plus → Zenith',
        percentage: '64%',
        amount: '1,920 / 3,000 pts',
        support: 'The same glass progress treatment holds the full next-tier journey cleanly.',
        accent: ['#22C55E', '#A855F7'],
        kind: 'crown',
        callouts: [
          {
            id: 'zenith-window',
            tone: 'gold',
            title: 'Closest window',
            detail: 'Ascent transatlantic loop moves this most aggressively',
          },
        ],
      },
      {
        id: 'blue-chip',
        title: 'Prime → Signature',
        percentage: '58%',
        amount: '14,500 / 25,000 pts',
        support: 'Casino tier progression stays in the same visual hierarchy across brands.',
        accent: ['#0EA5E9', '#7B2D8E'],
        kind: 'star',
        callouts: [
          {
            id: 'celeb-milestone',
            tone: 'amber',
            title: 'Signature pace',
            detail: 'Three sailings would push this into the next band',
          },
        ],
      },
      {
        id: 'celeb-long-run',
        title: 'Signature → Masters',
        percentage: '24%',
        amount: '24,000 / 100,000 pts',
        support: 'Long horizon value remains readable without flattening the card.',
        accent: ['#7B2D8E', '#D4A00A'],
        kind: 'star',
        callouts: [
          {
            id: 'celeb-cta',
            tone: 'coral',
            title: 'Strategic note',
            detail: 'Scenic redeye sailings become the strongest comp-growth windows',
          },
        ],
      },
    ],
    metrics: [
      { label: 'Blue Chip', value: '24,000', tint: '#7B2D8E' },
      { label: 'Captain’s', value: '1,920', tint: '#22C55E' },
      { label: 'To Zenith', value: '1,080', tint: '#B8860B' },
    ],
  },
  silversea: {
    memberLabel: 'Venetian Society # 6207 0043',
    primaryStatus: '500 VS Days',
    secondaryStatus: 'Palladium',
    progressCards: [
      {
        id: 'venetian',
        title: '350 → 500 VS Days',
        percentage: '67%',
        amount: '338 / 500 days',
        support: 'Silversea keeps the same premium shell with quieter luxury accents.',
        accent: ['#38BDF8', '#CBD5E1'],
        kind: 'crown',
        callouts: [
          {
            id: 'vs-window',
            tone: 'gold',
            title: 'Upcoming threshold',
            detail: 'Silver Moon completes the next major Venetian jump',
          },
        ],
      },
      {
        id: 'palladium',
        title: 'Prime → Signature',
        percentage: '52%',
        amount: '13,200 / 25,000 pts',
        support: 'The same casino treatment stays consistent across the full system.',
        accent: ['#2563EB', '#7B2D8E'],
        kind: 'star',
        callouts: [
          {
            id: 'silversea-projection',
            tone: 'amber',
            title: 'Cruise block impact',
            detail: 'Mediterranean cluster raises the slope the fastest',
          },
        ],
      },
      {
        id: 'masters-silversea',
        title: 'Signature → Masters',
        percentage: '31%',
        amount: '31,440 / 100,000 pts',
        support: 'Even the largest numbers stay calm inside the glass cards.',
        accent: ['#7B2D8E', '#D4A00A'],
        kind: 'star',
        callouts: [
          {
            id: 'silversea-summary',
            tone: 'coral',
            title: 'Best-value route',
            detail: 'Galápagos sequences would lead the next acceleration band',
          },
        ],
      },
    ],
    metrics: [
      { label: 'Casino', value: '31,440', tint: '#7B2D8E' },
      { label: 'VS Days', value: '338', tint: '#38BDF8' },
      { label: 'To 500', value: '162', tint: '#B8860B' },
    ],
  },
};

function getGlassAvailable(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return isLiquidGlassAvailable();
  } catch (error) {
    console.log('[DesignPreview] Native glass availability check failed:', error);
    return false;
  }
}

const glassSupported = getGlassAvailable();

function GlassSurface({ children, style, contentStyle }: GlassSurfaceProps) {
  return (
    <View style={[styles.glassShell, style]} testID="glass-surface">
      {glassSupported ? (
        <GlassView style={styles.absoluteFill} glassEffectStyle="regular" tintColor="rgba(255,255,255,0.18)" />
      ) : Platform.OS !== 'web' ? (
        <BlurView intensity={28} tint="light" style={styles.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={['rgba(255,255,255,0.66)', 'rgba(255,255,255,0.20)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.absoluteFill}
      />
      <View style={styles.glassStroke} pointerEvents="none" />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

function PreviewBadge({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.previewBadge, { backgroundColor: `${tint}18`, borderColor: `${tint}38` }]}>
      <Text style={[styles.previewBadgeText, { color: tint }]}>{label}</Text>
    </View>
  );
}

function ToneCallout({ tone, title, detail }: { tone: PreviewTone; title: string; detail: string }) {
  const palette = useMemo(() => {
    if (tone === 'coral') {
      return { bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.24)', icon: '#FB7185' };
    }

    if (tone === 'amber') {
      return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.26)', icon: '#F59E0B' };
    }

    return { bg: 'rgba(184,134,11,0.12)', border: 'rgba(184,134,11,0.26)', icon: '#B8860B' };
  }, [tone]);

  return (
    <View style={[styles.calloutCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <View style={[styles.calloutIconWrap, { backgroundColor: `${palette.icon}18` }]}>
        <Star size={12} color={palette.icon} fill={palette.icon} />
      </View>
      <View style={styles.calloutCopy}>
        <Text style={styles.calloutTitle}>{title}</Text>
        <Text style={styles.calloutDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export default function DesignPreviewScreen() {
  const [activeTab, setActiveTab] = useState<BrandTab>('royal');
  const [screenBackgroundUri, setScreenBackgroundUri] = useState<string>(SCREEN_BACKGROUND);
  const [playerHeroUri, setPlayerHeroUri] = useState<string>(PLAYER_HERO);
  const [offerHeroUri, setOfferHeroUri] = useState<string>(OFFER_HERO);

  const activeBrand = BRANDS[activeTab];

  const handleFabPress = useCallback(() => {
    console.log('[DesignPreview] Floating action button pressed');
  }, []);

  const handleBackgroundError = useCallback(() => {
    console.log('[DesignPreview] Background image failed, swapping to fallback');
    setScreenBackgroundUri(SCREEN_BACKGROUND_FALLBACK);
  }, []);

  const handlePlayerHeroError = useCallback(() => {
    console.log('[DesignPreview] Player hero image failed, swapping to fallback');
    setPlayerHeroUri(PLAYER_HERO_FALLBACK);
  }, []);

  const handleOfferHeroError = useCallback(() => {
    console.log('[DesignPreview] Offer hero image failed, swapping to fallback');
    setOfferHeroUri(OFFER_HERO_FALLBACK);
  }, []);

  console.log('[DesignPreview] Rendering preview route for brand:', activeTab);

  return (
    <View style={styles.screen} testID="design-preview-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <Image
        source={{ uri: screenBackgroundUri }}
        style={styles.backgroundImage}
        contentFit="cover"
        transition={250}
        onError={handleBackgroundError}
        testID="design-preview-background"
      />
      <LinearGradient
        colors={['rgba(4, 14, 30, 0.18)', 'rgba(6, 16, 30, 0.76)', 'rgba(7, 12, 24, 0.92)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={styles.backgroundOverlay}
      />
      <LinearGradient
        colors={['rgba(56, 189, 248, 0.12)', 'rgba(0,0,0,0)', 'rgba(167, 139, 250, 0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.atmosphereOverlay}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="design-preview-scroll"
        >
          <GlassSurface style={styles.introCard} contentStyle={styles.introCardContent}>
            <PreviewBadge label="Preview only" tint="#FFFFFF" />
            <Text style={styles.introTitle}>Premium glass + scenic redesign prototype</Text>
            <Text style={styles.introBody}>
              This is a separate preview route so you can approve the visual system before I touch the live Player Card or Offer Card.
            </Text>
          </GlassSurface>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Player Card</Text>
            <GlassSurface style={styles.playerCard} contentStyle={styles.playerCardContent}>
              <View style={styles.playerHeroWrap}>
                <Image
                  source={{ uri: playerHeroUri }}
                  style={styles.playerHeroImage}
                  contentFit="cover"
                  transition={250}
                  onError={handlePlayerHeroError}
                  testID="player-preview-hero"
                />
                <LinearGradient
                  colors={['rgba(12, 25, 43, 0.16)', 'rgba(10, 22, 38, 0.55)', 'rgba(7, 17, 31, 0.92)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.75, y: 1 }}
                  style={styles.playerHeroOverlay}
                />

                <View style={styles.playerHeroTopRow}>
                  <View>
                    <PreviewBadge label="Player card prototype" tint="#EAF4FF" />
                    <Text style={styles.playerName}>Scott Merlis</Text>
                    <Text style={styles.playerMemberLabel}>{activeBrand.memberLabel}</Text>
                  </View>

                  <View style={styles.playerHeaderActions}>
                    <Pressable style={styles.iconButton} testID="preview-bell-button">
                      <Bell size={18} color="#F8FBFF" />
                    </Pressable>
                    <Pressable style={styles.iconButton} testID="preview-settings-button">
                      <Settings size={18} color="#F8FBFF" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <GlassSurface style={styles.tabsShell} contentStyle={styles.tabsRow}>
                {TABS.map((tab) => {
                  const active = tab.key === activeTab;

                  return (
                    <Pressable
                      key={tab.key}
                      style={styles.tabPressable}
                      onPress={() => setActiveTab(tab.key)}
                      testID={`preview-tab-${tab.key}`}
                    >
                      {active ? (
                        <LinearGradient
                          colors={['#59B7FF', '#367DFF']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.activeTabPill}
                        >
                          <Text style={styles.activeTabText}>{tab.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.inactiveTabPill}>
                          <Text style={styles.inactiveTabText}>{tab.label}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </GlassSurface>

              <View style={styles.statusRow}>
                <GlassSurface style={styles.statusCard} contentStyle={styles.statusCardContent}>
                  <View style={[styles.statusIconWrap, { backgroundColor: 'rgba(0,188,212,0.14)' }]}>
                    <Crown size={16} color="#00BCD4" />
                  </View>
                  <View style={styles.statusCopy}>
                    <Text style={styles.statusLabel}>Loyalty</Text>
                    <Text style={styles.statusValue}>{activeBrand.primaryStatus}</Text>
                  </View>
                </GlassSurface>

                <GlassSurface style={styles.statusCard} contentStyle={styles.statusCardContent}>
                  <View style={[styles.statusIconWrap, { backgroundColor: 'rgba(123,45,142,0.14)' }]}>
                    <Star size={16} color="#7B2D8E" fill="#7B2D8E" />
                  </View>
                  <View style={styles.statusCopy}>
                    <Text style={styles.statusLabel}>Casino</Text>
                    <Text style={styles.statusValue}>{activeBrand.secondaryStatus}</Text>
                  </View>
                </GlassSurface>
              </View>

              <View style={styles.progressList}>
                {activeBrand.progressCards.map((item) => {
                  const Icon = item.kind === 'crown' ? Crown : Star;

                  return (
                    <GlassSurface key={item.id} style={styles.progressCard} contentStyle={styles.progressCardContent}>
                      <View style={styles.progressHeaderRow}>
                        <View style={styles.progressHeaderLeft}>
                          <View style={[styles.progressIconWrap, { backgroundColor: `${item.accent[0]}18` }]}>
                            <Icon size={16} color={item.accent[0]} />
                          </View>
                          <View>
                            <Text style={styles.progressTitle}>{item.title}</Text>
                            <Text style={styles.progressAmount}>{item.amount}</Text>
                          </View>
                        </View>
                        <PreviewBadge label={item.percentage} tint={item.accent[1]} />
                      </View>

                      <View style={styles.progressTrack}>
                        <LinearGradient
                          colors={item.accent}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.progressFill, { width: item.percentage as `${number}%` }]}
                        />
                      </View>

                      <Text style={styles.progressSupport}>{item.support}</Text>

                      <View style={styles.calloutList}>
                        {item.callouts.map((callout) => (
                          <ToneCallout
                            key={callout.id}
                            tone={callout.tone}
                            title={callout.title}
                            detail={callout.detail}
                          />
                        ))}
                      </View>
                    </GlassSurface>
                  );
                })}
              </View>

              <GlassSurface style={styles.metricsShell} contentStyle={styles.metricsRow}>
                {activeBrand.metrics.map((metric, index) => (
                  <View key={metric.label} style={[styles.metricColumn, index < activeBrand.metrics.length - 1 && styles.metricDivider]}>
                    <Text style={[styles.metricValue, { color: metric.tint }]}>{metric.value}</Text>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                  </View>
                ))}
              </GlassSurface>

              <Pressable style={styles.fabButton} onPress={handleFabPress} testID="player-preview-fab">
                <LinearGradient
                  colors={['#67C0FF', '#2456FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fabGradient}
                >
                  <ChevronRight size={22} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </GlassSurface>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>Offer Card</Text>
            <GlassSurface style={styles.offerCard} contentStyle={styles.offerCardContent}>
              <View style={styles.offerHeaderStrip}>
                <View style={styles.offerHeaderCopy}>
                  <Text style={styles.offerTitle}>Longer Paylines</Text>
                  <Text style={styles.offerCode}>Code · LP-2026-40</Text>
                </View>
                <PreviewBadge label="ACTIVE" tint="#6D28D9" />
              </View>

              <View style={styles.offerHeroWrap}>
                <Image
                  source={{ uri: offerHeroUri }}
                  style={styles.offerHeroImage}
                  contentFit="cover"
                  transition={250}
                  onError={handleOfferHeroError}
                  testID="offer-preview-hero"
                />
                <LinearGradient
                  colors={['rgba(5, 12, 28, 0.08)', 'rgba(7, 17, 31, 0.38)', 'rgba(7, 17, 31, 0.84)']}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.offerHeroOverlay}
                />

                <View style={styles.offerHeroBadges}>
                  <PreviewBadge label="ACTIVE" tint="#FFFFFF" />
                </View>

                <GlassSurface style={styles.cruiseCountPill} contentStyle={styles.cruiseCountPillContent}>
                  <Ship size={14} color="#F8FBFF" />
                  <Text style={styles.cruiseCountText}>40 cruises available</Text>
                </GlassSurface>
              </View>

              <View style={styles.offerBodyRow}>
                <View style={styles.offerDestinationsBlock}>
                  <Text style={styles.offerBlockLabel}>DESTINATIONS</Text>
                  <Text style={styles.destinationLine}>6 NIGHT WESTERN CARIBBEAN</Text>
                  <Text style={styles.destinationLine}>7 NIGHT PERFECT DAY & NASSAU</Text>
                  <Text style={styles.destinationLine}>5 NIGHT CABO OVERNIGHT</Text>
                </View>

                <View style={styles.offerValueBlock}>
                  <Text style={styles.offerBlockLabel}>TOTAL VALUE</Text>
                  <Text style={styles.offerValue}>$103,320</Text>
                  <Text style={styles.offerValueSub}>High-value balcony mix</Text>
                </View>
              </View>

              <GlassSurface style={styles.offerInfoPanel} contentStyle={styles.offerInfoPanelContent}>
                <View style={styles.offerInfoItem}>
                  <Ship size={15} color={COLORS.navyDark} />
                  <View>
                    <Text style={styles.offerInfoLabel}>ROOM TYPE(S)</Text>
                    <Text style={styles.offerInfoValue}>Balcony, Oceanview</Text>
                  </View>
                </View>

                <View style={styles.offerInfoDivider} />

                <View style={styles.offerInfoItem}>
                  <Calendar size={15} color={COLORS.navyDark} />
                  <View>
                    <Text style={styles.offerInfoLabel}>EXPIRES</Text>
                    <Text style={styles.offerInfoValue}>October 31, 2026</Text>
                  </View>
                </View>

                <View style={styles.offerInfoDivider} />

                <View style={styles.offerInfoItem}>
                  <Clock size={15} color={COLORS.navyDark} />
                  <View>
                    <Text style={styles.offerInfoLabel}>TOTAL VALUE</Text>
                    <Text style={styles.offerInfoValue}>40 sailings</Text>
                  </View>
                </View>
              </GlassSurface>

              <Pressable style={styles.offerButton} testID="offer-preview-button">
                <LinearGradient
                  colors={['rgba(255,255,255,0.94)', 'rgba(255,255,255,0.82)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.offerButtonFill}
                >
                  <Text style={styles.offerButtonText}>View all 40 cruises</Text>
                  <ChevronRight size={16} color={COLORS.navyDark} />
                </LinearGradient>
              </Pressable>
            </GlassSurface>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#08111F',
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  atmosphereOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 22,
  },
  introCard: {
    borderRadius: 28,
  },
  introCardContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FBFF',
    letterSpacing: -0.5,
  },
  introBody: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(248,251,255,0.84)',
  },
  sectionBlock: {
    gap: 10,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.76)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  glassShell: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#03111F',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  glassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  previewBadge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  playerCard: {
    borderRadius: 30,
  },
  playerCardContent: {
    paddingBottom: 22,
    gap: 16,
  },
  playerHeroWrap: {
    minHeight: 214,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  playerHeroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  playerHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  playerHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  playerHeaderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  playerName: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  playerMemberLabel: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
  },
  tabsShell: {
    marginHorizontal: 16,
    marginTop: -22,
    borderRadius: 22,
  },
  tabsRow: {
    flexDirection: 'row',
    padding: 6,
    gap: 6,
  },
  tabPressable: {
    flex: 1,
  },
  activeTabPill: {
    minHeight: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveTabPill: {
    minHeight: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(7,17,31,0.08)',
  },
  activeTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  inactiveTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#19304F',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  statusCard: {
    flex: 1,
    borderRadius: 22,
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statusIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(25,48,79,0.62)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
    color: '#10223B',
  },
  progressList: {
    gap: 12,
    paddingHorizontal: 16,
  },
  progressCard: {
    borderRadius: 24,
  },
  progressCardContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10223B',
  },
  progressAmount: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(16,34,59,0.62)',
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(16,34,59,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressSupport: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(16,34,59,0.74)',
  },
  calloutList: {
    gap: 8,
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  calloutIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutCopy: {
    flex: 1,
    gap: 2,
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#12233C',
  },
  calloutDetail: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(18,35,60,0.72)',
  },
  metricsShell: {
    marginHorizontal: 16,
    borderRadius: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  metricDivider: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(16,34,59,0.08)',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(16,34,59,0.62)',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  fabButton: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    shadowColor: '#1B5FFF',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerCard: {
    borderRadius: 30,
  },
  offerCardContent: {
    padding: 16,
    gap: 14,
  },
  offerHeaderStrip: {
    borderRadius: 22,
    backgroundColor: 'rgba(236, 224, 255, 0.86)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  offerHeaderCopy: {
    flex: 1,
  },
  offerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10223B',
    letterSpacing: -0.6,
  },
  offerCode: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(16,34,59,0.68)',
  },
  offerHeroWrap: {
    height: 208,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  offerHeroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  offerHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  offerHeroBadges: {
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  cruiseCountPill: {
    alignSelf: 'flex-start',
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 18,
  },
  cruiseCountPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cruiseCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FBFF',
    letterSpacing: 0.2,
  },
  offerBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  offerDestinationsBlock: {
    flex: 1,
    gap: 5,
  },
  offerValueBlock: {
    width: 122,
    alignItems: 'flex-end',
    gap: 4,
  },
  offerBlockLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(16,34,59,0.56)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  destinationLine: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#10223B',
  },
  offerValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: -0.8,
    textAlign: 'right',
  },
  offerValueSub: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: 'rgba(5,150,105,0.80)',
    textAlign: 'right',
  },
  offerInfoPanel: {
    borderRadius: 22,
  },
  offerInfoPanelContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  offerInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  offerInfoDivider: {
    height: 1,
    backgroundColor: 'rgba(16,34,59,0.08)',
  },
  offerInfoLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(16,34,59,0.56)',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  offerInfoValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '700',
    color: '#10223B',
  },
  offerButton: {
    alignSelf: 'center',
    minWidth: 220,
    borderRadius: 999,
    overflow: 'hidden',
  },
  offerButtonFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  offerButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navyDark,
  },
});
