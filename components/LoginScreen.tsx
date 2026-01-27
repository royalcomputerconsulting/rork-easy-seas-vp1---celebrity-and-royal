import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, Image, Dimensions, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { IMAGES } from '@/constants/images';
import { useAuth } from '@/state/AuthProvider';

const { width, height } = Dimensions.get('window');

const ADMIN_EMAIL = 'scott.merlis1@gmail.com';

export function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [logoError, setLogoError] = useState<boolean>(false);
  const { login } = useAuth();

  console.log('Logo URL:', IMAGES.logo);
  
  const isAdminEmail = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();

  const handleLogin = async () => {
    setError('');
    
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    
    if (isAdminEmail && !password) {
      setError('Please enter the admin password.');
      return;
    }
    
    const success = await login(email, password || undefined);
    if (!success) {
      if (isAdminEmail) {
        setError('Incorrect admin password.');
      } else {
        setError('Unable to log in. Please check your email.');
      }
    }
  };

  const handlePurchasePress = () => {
    Linking.openURL('https://buy.stripe.com/3cIeVc4RtcXT3QH54Y0VO00');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            {!logoError ? (
              <Image 
                source={{ uri: IMAGES.logo }}
                style={styles.logoImage}
                resizeMode="contain"
                onError={(e) => {
                  console.log('Logo failed to load:', e.nativeEvent.error);
                  setLogoError(true);
                }}
                onLoad={() => console.log('Logo loaded successfully')}
              />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>Easy Seas</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Easy Seas</Text>
            <Text style={styles.tagline}>Manage your Nautical Lifestyle</Text>
            
            <Text style={styles.loginLabel}>Please Enter your Email Address</Text>
            
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
              }}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              onSubmitEditing={isAdminEmail ? undefined : handleLogin}
            />

            {isAdminEmail && (
              <>
                <Text style={styles.passwordLabel}>Admin Password</Text>
                <TextInput
                  style={[styles.input, error ? styles.inputError : null]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError('');
                  }}
                  placeholder="Enter admin password"
                  placeholderTextColor={COLORS.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleLogin}
                />
              </>
            )}

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <TouchableOpacity 
              style={styles.loginButton}
              onPress={handleLogin}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.aboutButton}
            onPress={() => setShowAboutModal(true)}
          >
            <Text style={styles.aboutButtonText}>What is Easy Seas?</Text>
          </TouchableOpacity>

          
        </View>
      </ScrollView>

      <Modal
        visible={showAboutModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>What is Easy Seas?</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowAboutModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
          >
            <Text style={styles.modalText}>
              <Text style={styles.modalHeading}>EasySeas™ Casino Cruise Intelligence Platform{"\n\n"}</Text>
              <Text style={styles.modalSubheading}>Your AI Casino Host & Cruise Planner — Working 24/7 for You{"\n\n"}</Text>
              
              Automatically import every cruise, offer, itinerary, price, and calendar event — then let AI recommend exactly what to book, when to sail, and why.{"\n\n"}
              
              <Text style={styles.modalBold}>🌐 Live Platform:{"\n"}</Text>
              https://easy-seas.com{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>🚀 THE DIFFERENCE{"\n\n"}</Text>
              
              EasySeas is not a tracker.{"\n"}
              It is a fully automated intelligence platform designed for serious cruise-casino players.{"\n\n"}
              
              EasySeas:{"\n"}
              • Downloads your real data{"\n"}
              • Understands your schedule{"\n"}
              • Evaluates offer value{"\n"}
              • Interacts with you using AI{"\n"}
              • Recommends the best cruises for your life{"\n\n"}
              
              No spreadsheets.{"\n"}
              No manual entry.{"\n"}
              No guesswork.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>⚡ AUTOMATIC DATA INGESTION (THE CORE POWER){"\n\n"}</Text>
              
              <Text style={styles.modalBold}>🎰 Club Royale Offers — Fully Parsed{"\n\n"}</Text>
              
              With one click, EasySeas automatically imports everything from the Club Royale offers page:{"\n\n"}
              
              ✔ All current casino offers{"\n"}
              ✔ Every eligible sailing per offer{"\n"}
              ✔ Ship names & sailing dates{"\n"}
              ✔ Cabin pricing (Interior / Ocean View / Balcony / Suite){"\n"}
              ✔ Full itineraries & ports{"\n"}
              ✔ Offer codes & expiration dates{"\n\n"}
              
              Multiple offers on the same cruise?{"\n"}
              EasySeas keeps them separate, accurate, and historically correct.{"\n\n"}
              
              Nothing missed. Nothing overwritten. Nothing outdated.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalBold}>🧭 Complete Cruise Intelligence{"\n\n"}</Text>
              
              Every cruise is enriched with:{"\n\n"}
              
              • Full itineraries & sea-day density{"\n"}
              • Night count & embarkation port{"\n"}
              • Ship class & casino profile{"\n"}
              • Pricing snapshots{"\n"}
              • Historical value tracking{"\n\n"}
              
              You don&apos;t just see cruises — you see value trends.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>📅 CALENDAR & TRIPIT SYNC (ZERO MANUAL WORK){"\n\n"}</Text>
              
              EasySeas connects directly to:{"\n\n"}
              
              🗓 TripIt{"\n"}
              🗓 Google / Apple / Outlook calendars{"\n"}
              🗓 ICS imports{"\n\n"}
              
              This creates a live availability map of your life:{"\n\n"}
              
              ✔ Existing cruises{"\n"}
              ✔ Work trips{"\n"}
              ✔ Family events{"\n"}
              ✔ Blackout dates{"\n\n"}
              
              No overlaps.{"\n"}
              No conflicts.{"\n"}
              No surprises.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>🤖 AI INTERACTION — THIS IS WHERE IT WINS{"\n\n"}</Text>
              
              EasySeas isn&apos;t static software.{"\n"}
              It&apos;s interactive intelligence.{"\n\n"}
              
              <Text style={styles.modalBold}>🧠 Ask EasySeas:{"\n\n"}</Text>
              
              &quot;Which Club Royale cruises fit my schedule next quarter?&quot;{"\n"}
              &quot;Which offers give me the best value for my tier?&quot;{"\n"}
              &quot;What sailings maximize sea days without overlapping work?&quot;{"\n"}
              &quot;Which ships historically give me the best ROI?&quot;{"\n\n"}
              
              EasySeas answers using your real imported data, not generic advice.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>📊 INTELLIGENT CRUISE RECOMMENDATIONS{"\n\n"}</Text>
              
              The AI automatically:{"\n\n"}
              
              ✔ Filters out calendar conflicts{"\n"}
              ✔ Prioritizes high-value itineraries{"\n"}
              ✔ Evaluates pricing vs. comp value{"\n"}
              ✔ Accounts for offer expiration timing{"\n"}
              ✔ Ranks cruises by schedule fit, value, and ROI{"\n\n"}
              
              You stop browsing.{"\n"}
              You start choosing from ranked recommendations.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>🧭 SCHEDULE-AWARE PLANNING{"\n\n"}</Text>
              
              EasySeas doesn&apos;t ask:{"\n"}
              &quot;Is this a good cruise?&quot;{"\n\n"}
              
              It asks:{"\n"}
              &quot;Is this a good cruise for you, right now?&quot;{"\n\n"}
              
              It considers:{"\n"}
              • Recovery time{"\n"}
              • Back-to-back feasibility{"\n"}
              • Tier timing windows{"\n"}
              • Travel efficiency{"\n\n"}
              
              This is strategy, not browsing.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>💳 SIMPLE, SECURE PAYMENTS — POWERED BY STRIPE{"\n\n"}</Text>
              
              Plan: $35 for 90 days of full access{"\n"}
              Processor: Stripe{"\n\n"}
              
              ✔ PCI-DSS Level 1 compliant{"\n"}
              ✔ End-to-end encrypted checkout{"\n"}
              ✔ No credit card data stored by EasySeas{"\n"}
              ✔ One-time payment (no surprise renewals){"\n"}
              ✔ Immediate access after checkout{"\n\n"}
              
              Stripe is trusted by Amazon, Google, Shopify, and OpenAI — and now EasySeas.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>💰 REAL VALUE — $0.39 PER DAY{"\n\n"}</Text>
              
              Less than:{"\n"}
              • One specialty dinner{"\n"}
              • Three casino cocktails{"\n"}
              • One shore excursion{"\n\n"}
              
              Included:{"\n"}
              ✔ Unlimited offer imports{"\n"}
              ✔ Full cruise pricing & itineraries{"\n"}
              ✔ Calendar & TripIt sync{"\n"}
              ✔ AI cruise recommendations{"\n"}
              ✔ Interactive AI assistant{"\n"}
              ✔ Historical analytics{"\n\n"}
              
              Avoid one bad offer and it pays for itself.{"\n"}
              Hit one tier earlier and the upside is massive.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>🎯 WHO EASYSEAS IS FOR{"\n\n"}</Text>
              
              ✔ Club Royale members maximizing tier value{"\n"}
              ✔ Frequent cruisers juggling multiple offers{"\n"}
              ✔ Strategic players focused on ROI{"\n"}
              ✔ Couples coordinating schedules{"\n"}
              ✔ Anyone spending $10,000+/year in cruise casinos{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>🔔 THE EASYSEAS PROMISE{"\n\n"}</Text>
              
              EasySeas doesn&apos;t tell you what to gamble.{"\n"}
              It organizes information, reveals insights, and helps you plan intelligently.{"\n\n"}
              
              You decide. EasySeas supports.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>⚖️ LEGAL & COMPLIANCE INFORMATION{"\n\n"}</Text>
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalBold}>🔐 PAYMENT SECURITY{"\n\n"}</Text>
              
              Payments are processed securely by Stripe, Inc., a PCI-DSS Level 1 compliant provider. EasySeas does not store or process credit card information.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalBold}>✅ STRIPE CHECKOUT ACCEPTANCE{"\n\n"}</Text>
              
              By completing payment, you acknowledge that you have read and agree to the EasySeas Terms of Use and Legal Disclaimer, that payments are processed by Stripe, and that access is time-limited and provided &quot;as is.&quot;{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalBold}>⚖️ LEGAL DISCLAIMER{"\n\n"}</Text>
              
              This application is provided for informational and entertainment purposes only.{"\n\n"}
              
              The creator of this application, Royal Computer Consulting, Scott Merlis, and any associated parties expressly disclaim all liability for any actions, decisions, or consequences resulting from the use of this application. Users assume all responsibility and risk associated with its use.{"\n\n"}
              
              This application is not intended to be, nor should it be construed as, a gambling manual, guide, or instructional material. It does not provide gambling advice, strategies, or recommendations.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalBold}>🆘 GAMBLING HELP{"\n\n"}</Text>
              
              If you or someone you know has a gambling problem, seek help immediately:{"\n\n"}
              
              • National Council on Problem Gambling: 1-800-522-4700{"\n"}
              • Gamblers Anonymous: www.gamblersanonymous.org{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalBold}>🚫 NO WARRANTY{"\n\n"}</Text>
              
              This application is provided &quot;AS IS&quot; without warranty of any kind. Use entirely at your own risk.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalBold}>🛡 INDEMNIFICATION{"\n\n"}</Text>
              
              By using this application, you agree to indemnify, defend, and hold harmless Royal Computer Consulting, Scott Merlis, and all associated parties from any claims arising from your use.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalBold}>™ TRADEMARK NOTICE{"\n\n"}</Text>
              
              All trademarks, ship names, logos, and product names (including Club Royale, Royal Caribbean, Celebrity Cruises) are the property of their respective owners. EasySeas has no affiliation, authorization, endorsement, or sponsorship with these entities. Trademarks are used for descriptive purposes only.{"\n\n"}
              
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{"\n\n"}
              
              <Text style={styles.modalHeading}>✅ FINAL CALL TO ACTION{"\n\n"}</Text>
              
              Stop guessing. Stop juggling tabs. Stop missing value.{"\n\n"}
              
              <Text style={styles.modalBold}>Launch EasySeas Today{"\n\n"}</Text>
              
              🌐 https://easy-seas.com{"\n"}
              $35 / 90 Days{"\n\n"}
              
              EasySeas™ — Because every cruise should be planned intelligently.
            </Text>

            <View style={styles.screenshotsContainer}>
              <Text style={[styles.modalHeading, { marginBottom: SPACING.lg }]}>📱 APP SCREENSHOTS{"\n\n"}</Text>
              
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/tlxq0q9o0gdcfngkokvlh' }}
                style={styles.screenshot}
                resizeMode="contain"
              />
              
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/w2zey3d6a8xckymbkgmf7' }}
                style={styles.screenshot}
                resizeMode="contain"
              />
              
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/1z169xe4tqavkcqiktxni' }}
                style={styles.screenshot}
                resizeMode="contain"
              />
              
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/0k28e2rkxtsc5ibb50cm2' }}
                style={styles.screenshot}
                resizeMode="contain"
              />
              
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9un3tdosjhtruizi1kmzd' }}
                style={styles.screenshot}
                resizeMode="contain"
              />
              
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/atzqjf1eolsjstwtaxme2' }}
                style={styles.screenshot}
                resizeMode="contain"
              />
              
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/duyyqjq015nwztoutuvad' }}
                style={styles.screenshot}
                resizeMode="contain"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0077B6',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },
  logoContainer: {
    width: width * 0.85,
    height: height * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFallbackText: {
    fontSize: 48,
    fontWeight: '800' as const,
    color: COLORS.white,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.xl,
    paddingVertical: SPACING.lg,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeXXL * 1.3,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  pricing: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: '#0077B6',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  purchaseButton: {
    backgroundColor: '#001F54',
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  purchaseButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
  },

  loginLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  passwordLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  errorText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSizeSM,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#001F54',
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
  },
  aboutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  aboutButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    textAlign: 'center',
  },
  tagline: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: '#0077B6',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.white,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  closeButtonText: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  modalHeading: {
    fontSize: TYPOGRAPHY.fontSizeXL,
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: '#0077B6',
  },
  modalSubheading: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold as any,
    color: COLORS.textPrimary,
  },
  modalBold: {
    fontWeight: TYPOGRAPHY.fontWeightBold as any,
    color: COLORS.textPrimary,
  },
  screenshotsContainer: {
    marginTop: SPACING.xxl,
    gap: SPACING.lg,
  },
  screenshot: {
    width: '100%',
    aspectRatio: 0.5,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    marginBottom: SPACING.md,
  },
});
