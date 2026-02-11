import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Linking, Platform, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Download, Ship, ExternalLink, CheckCircle, AlertCircle, FileText, Globe, Search, DollarSign, Calendar, Rss, Copy, RefreshCcw, Link2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCoreData } from '@/state/CoreDataProvider';
import { useUser } from '@/state/UserProvider';
import type { BookedCruise } from '@/types/models';
import { syncCruisePricing, SyncProgress, CruisePricing } from '@/lib/cruisePricingSync';
import { generateCalendarFeed, generateFeedToken } from '@/lib/calendar/feedGenerator';
import { exportFile } from '@/lib/fileIO/fileOperations';
import { trpc, RENDER_BACKEND_URL } from '@/lib/trpc';

type ScreenMode = 'auto' | 'manual' | 'calendar';

interface SyncedCruiseResult {
  cruiseId: string;
  shipName: string;
  sailDate: string;
  interiorPrice?: number;
  oceanviewPrice?: number;
  balconyPrice?: number;
  suitePrice?: number;
  portTaxesFees?: number;
  confidence?: 'high' | 'medium' | 'low';
  saved: boolean;
}

export default function ImportCruisesScreen() {
  const router = useRouter();
  const { addBookedCruise, bookedCruises, updateBookedCruise, calendarEvents } = useCoreData();
  const { currentUser } = useUser();

  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [pastedData, setPastedData] = useState('');
  const [searchingDeals, setSearchingDeals] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SyncProgress | null>(null);
  const [searchMode, setSearchMode] = useState<ScreenMode>('auto');
  const [syncedResults, setSyncedResults] = useState<SyncedCruiseResult[]>([]);

  const [calendarFeedToken, setCalendarFeedToken] = useState<string | null>(null);
  const [calendarFeedUrl, setCalendarFeedUrl] = useState<string | null>(null);
  const [isPublishingFeed, setIsPublishingFeed] = useState(false);
  const [feedLastUpdated, setFeedLastUpdated] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isExportingICS, setIsExportingICS] = useState(false);

  const saveCalendarFeedMutation = trpc.calendar.saveCalendarFeed.useMutation();

  const upcomingCruises = bookedCruises.filter(c => c.completionState === 'upcoming');
  const completedCruises = bookedCruises.filter(c => c.completionState === 'completed' || c.status === 'completed');

  useEffect(() => {
    const loadFeedToken = async () => {
      try {
        const stored = await AsyncStorage.getItem('easyseas_calendar_feed_token');
        if (stored) {
          setCalendarFeedToken(stored);
          setCalendarFeedUrl(`${RENDER_BACKEND_URL}/api/calendar-feed/${stored}`);
          const lastUpdate = await AsyncStorage.getItem('easyseas_calendar_feed_updated');
          if (lastUpdate) setFeedLastUpdated(lastUpdate);
          console.log('[ImportCruises] Loaded calendar feed token:', stored.slice(0, 8) + '...');
        }
      } catch (error) {
        console.error('[ImportCruises] Error loading feed token:', error);
      }
    };
    loadFeedToken();
  }, []);

  const addToLog = (message: string) => {
    setImportLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handlePublishCalendarFeed = useCallback(async () => {
    const email = currentUser?.email;
    if (!email) {
      Alert.alert('Profile Required', 'Please set your email in your profile (Settings) before publishing a calendar feed.');
      return;
    }

    try {
      setIsPublishingFeed(true);
      console.log('[ImportCruises] Publishing calendar feed...');

      let token = calendarFeedToken;
      if (!token) {
        token = generateFeedToken();
        setCalendarFeedToken(token);
        await AsyncStorage.setItem('easyseas_calendar_feed_token', token);
        console.log('[ImportCruises] Generated new feed token:', token.slice(0, 8) + '...');
      }

      console.log('[ImportCruises] Generating ICS from', bookedCruises.length, 'cruises and', calendarEvents.length, 'events');
      const icsContent = generateCalendarFeed(bookedCruises, calendarEvents);

      await saveCalendarFeedMutation.mutateAsync({
        email,
        token,
        icsContent,
      });

      const feedUrl = `${RENDER_BACKEND_URL}/api/calendar-feed/${token}`;
      setCalendarFeedUrl(feedUrl);
      const now = new Date().toISOString();
      setFeedLastUpdated(now);
      await AsyncStorage.setItem('easyseas_calendar_feed_updated', now);

      console.log('[ImportCruises] Calendar feed published successfully:', feedUrl);
      Alert.alert(
        'Calendar Feed Published',
        `Your calendar feed is live with ${bookedCruises.length} cruises and ${calendarEvents.length} events.\n\nYou can now subscribe to this feed from any calendar app (Apple Calendar, Google Calendar, Outlook, etc.).\n\nTap "Copy URL" to copy the feed link.`
      );
    } catch (error) {
      console.error('[ImportCruises] Publish feed error:', error);
      Alert.alert('Publish Failed', 'Failed to publish calendar feed. Please check your internet connection and try again.');
    } finally {
      setIsPublishingFeed(false);
    }
  }, [calendarFeedToken, currentUser, bookedCruises, calendarEvents, saveCalendarFeedMutation]);

  const handleCopyFeedUrl = useCallback(async () => {
    if (!calendarFeedUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(calendarFeedUrl);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      console.log('[ImportCruises] Calendar feed URL copied');
    } catch (error) {
      console.error('[ImportCruises] Copy error:', error);
      Alert.alert('Feed URL', calendarFeedUrl);
    }
  }, [calendarFeedUrl]);

  const handleSubscribeToFeed = useCallback(() => {
    if (!calendarFeedUrl) return;
    const webcalUrl = calendarFeedUrl.replace(/^https?:\/\//, 'webcal://');
    console.log('[ImportCruises] Opening webcal URL:', webcalUrl);
    Linking.openURL(webcalUrl).catch(() => {
      Alert.alert(
        'Subscribe to Calendar',
        `Copy this URL and add it as a calendar subscription in your calendar app:\n\n${calendarFeedUrl}`,
        [
          { text: 'Copy URL', onPress: handleCopyFeedUrl },
          { text: 'OK', style: 'cancel' },
        ]
      );
    });
  }, [calendarFeedUrl, handleCopyFeedUrl]);

  const handleRegenerateFeedToken = useCallback(() => {
    Alert.alert(
      'Regenerate Feed URL',
      'This will create a new unique URL. Your old URL will stop working. Any calendar apps subscribed to the old URL will need to be updated.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            const newToken = generateFeedToken();
            setCalendarFeedToken(newToken);
            setCalendarFeedUrl(null);
            setFeedLastUpdated(null);
            await AsyncStorage.setItem('easyseas_calendar_feed_token', newToken);
            await AsyncStorage.removeItem('easyseas_calendar_feed_updated');
            console.log('[ImportCruises] Regenerated feed token:', newToken.slice(0, 8) + '...');
            Alert.alert('Token Regenerated', 'Your feed URL has been reset. Tap "Publish Feed" to make it live with the new URL.');
          },
        },
      ]
    );
  }, []);

  const handleExportCalendarICS = useCallback(async () => {
    try {
      setIsExportingICS(true);
      console.log('[ImportCruises] Exporting calendar ICS...');

      if (bookedCruises.length === 0 && calendarEvents.length === 0) {
        Alert.alert('No Data', 'No cruises or events to export.');
        setIsExportingICS(false);
        return;
      }

      const icsContent = generateCalendarFeed(bookedCruises, calendarEvents);
      const fileName = `easyseas_calendar_${new Date().toISOString().split('T')[0]}.ics`;

      const success = await exportFile(icsContent, fileName);
      if (success) {
        Alert.alert('Export Successful', `Exported ${bookedCruises.length} cruises and ${calendarEvents.length} events to ${fileName}`);
      } else {
        Alert.alert('Export Info', 'File saved but sharing may not be available on this device.');
      }
      console.log('[ImportCruises] ICS export complete');
    } catch (error) {
      console.error('[ImportCruises] ICS export error:', error);
      Alert.alert('Export Error', 'Failed to export calendar. Please try again.');
    } finally {
      setIsExportingICS(false);
    }
  }, [bookedCruises, calendarEvents]);

  const searchForDeals = async () => {
    if (bookedCruises.length === 0) {
      addToLog('No booked cruises to sync');
      return;
    }

    setSearchingDeals(true);

    try {
      if (upcomingCruises.length === 0) {
        addToLog('No upcoming cruises to sync');
        setSearchingDeals(false);
        return;
      }

      addToLog(`Starting pricing sync for ${upcomingCruises.length} upcoming cruises...`);

      const cruiseSearchParams = upcomingCruises.map(cruise => ({
        id: cruise.id,
        shipName: cruise.shipName,
        sailDate: cruise.sailDate,
        nights: cruise.nights,
        departurePort: cruise.departurePort,
      }));

      addToLog(`Searching web for current cabin prices...`);

      const result = await syncCruisePricing(cruiseSearchParams, (progress) => {
        setSearchProgress(progress);
        if (progress.status === 'searching') {
          addToLog(`Searching prices for ${progress.shipName} (${progress.current}/${progress.total})...`);
        } else if (progress.status === 'found') {
          addToLog(`Found prices for ${progress.shipName}`);
        } else if (progress.status === 'not_found') {
          addToLog(`No prices found for ${progress.shipName}`);
        }
      });

      console.log('[ImportCruises] syncCruisePricing result:', JSON.stringify({
        pricingCount: result.pricing.length,
        syncedCount: result.syncedCount,
        successCount: result.successCount,
        errorCount: result.errors.length,
      }));

      setSearchProgress(null);

      if (result.pricing && result.pricing.length > 0) {
        addToLog(`Found pricing for ${result.pricing.length} of ${upcomingCruises.length} cruises`);
        addToLog('Saving prices to your cruise records...');

        const newSyncedResults: SyncedCruiseResult[] = [];
        let updateCount = 0;

        for (const pricing of result.pricing) {
          const cruise = bookedCruises.find(c => c.id === pricing.bookingId);
          if (!cruise) {
            console.log('[ImportCruises] Cruise not found for pricing:', pricing.bookingId);
            continue;
          }

          const updatePayload: Partial<BookedCruise> = {
            updatedAt: new Date().toISOString(),
          };

          if (pricing.interiorPrice) updatePayload.interiorPrice = pricing.interiorPrice;
          if (pricing.oceanviewPrice) updatePayload.oceanviewPrice = pricing.oceanviewPrice;
          if (pricing.balconyPrice) updatePayload.balconyPrice = pricing.balconyPrice;
          if (pricing.suitePrice) updatePayload.suitePrice = pricing.suitePrice;
          if (pricing.portTaxesFees) updatePayload.taxes = pricing.portTaxesFees;

          console.log('[ImportCruises] Saving prices to cruise:', cruise.id, cruise.shipName, updatePayload);
          updateBookedCruise(cruise.id, updatePayload);
          updateCount++;

          newSyncedResults.push({
            cruiseId: cruise.id,
            shipName: cruise.shipName,
            sailDate: cruise.sailDate,
            interiorPrice: pricing.interiorPrice,
            oceanviewPrice: pricing.oceanviewPrice,
            balconyPrice: pricing.balconyPrice,
            suitePrice: pricing.suitePrice,
            portTaxesFees: pricing.portTaxesFees,
            confidence: pricing.confidence,
            saved: true,
          });

          addToLog(`  Saved: ${cruise.shipName}: INT ${pricing.interiorPrice || '-'} | OV ${pricing.oceanviewPrice || '-'} | BAL ${pricing.balconyPrice || '-'} | STE ${pricing.suitePrice || '-'} | TAX ${pricing.portTaxesFees || '-'}`);
        }

        const missingCruises = upcomingCruises.filter(
          c => !result.pricing.some((p: CruisePricing) => p.bookingId === c.id)
        );
        missingCruises.forEach(c => {
          newSyncedResults.push({
            cruiseId: c.id,
            shipName: c.shipName,
            sailDate: c.sailDate,
            saved: false,
          });
        });

        setSyncedResults(newSyncedResults);
        addToLog(`Saved pricing for ${updateCount} of ${upcomingCruises.length} cruises!`);

        if (updateCount < upcomingCruises.length) {
          addToLog(`${upcomingCruises.length - updateCount} cruises had no pricing data available`);
        }
      } else {
        addToLog('No pricing data found from any source.');
        if (result.errors.length > 0) {
          result.errors.slice(0, 5).forEach(err => addToLog(`  ${err}`));
        }
        addToLog('Ensure your cruise details (ship name, sail date, port) are filled in correctly.');

        setSyncedResults(upcomingCruises.map(c => ({
          cruiseId: c.id,
          shipName: c.shipName,
          sailDate: c.sailDate,
          saved: false,
        })));
      }
    } catch (error: any) {
      console.log('[ImportCruises] Pricing sync error:', error);
      const errorMessage = error?.message || String(error);

      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network request failed')) {
        addToLog('Could not connect to pricing service');
        addToLog('This may be temporary. Please try again in a moment.');
      } else if (errorMessage.includes('unavailable')) {
        addToLog('Pricing service temporarily unavailable');
        addToLog('Please try again in a few minutes.');
      } else {
        addToLog(`Sync error: ${errorMessage}`);
        addToLog('Please try again or check your connection.');
      }
    } finally {
      setSearchingDeals(false);
    }
  };

  useEffect(() => {
    if (searchMode === 'auto' && bookedCruises.length > 0) {
      const upcomingCount = bookedCruises.filter(c => c.completionState === 'upcoming').length;
      if (upcomingCount > 0) {
        addToLog(`Found ${upcomingCount} upcoming cruises ready to search`);
      }
    }
  }, [bookedCruises, searchMode]);

  const openWebsite = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  const parseCruiseData = (text: string): BookedCruise[] => {
    const cruises: BookedCruise[] = [];
    addToLog('Parsing cruise data...');

    try {
      const lines = text.split('\n').filter(line => line.trim());

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.includes('Ship:') || line.includes('ship:') ||
            line.includes('Sail Date:') || line.includes('sail date:')) {

          let shipName = '';
          let sailDate = '';
          let returnDate = '';
          let nights = 7;
          let departurePort = '';
          let destination = '';
          let price = 0;
          let cabinType = 'Balcony';

          const shipMatch = line.match(/Ship[:\s]+([^,\n]+)/i);
          if (shipMatch) shipName = shipMatch[1].trim();

          const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
          if (dateMatch) {
            const parts = dateMatch[1].split('/');
            sailDate = `${parts[2].length === 2 ? '20' + parts[2] : parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          }

          const nightsMatch = line.match(/(\d+)[- ]night/i);
          if (nightsMatch) nights = parseInt(nightsMatch[1]);

          const portMatch = line.match(/(?:from|departs?)[:\s]+([^,\n]+)/i);
          if (portMatch) departurePort = portMatch[1].trim();

          const destMatch = line.match(/(?:to|destination)[:\s]+([^,\n]+)/i);
          if (destMatch) destination = destMatch[1].trim();

          const priceMatch = line.match(/\$[\d,]+/);
          if (priceMatch) price = parseFloat(priceMatch[0].replace(/[$,]/g, ''));

          const cabinMatch = line.match(/(interior|oceanview|balcony|suite)/i);
          if (cabinMatch) cabinType = cabinMatch[1];

          if (sailDate && !returnDate) {
            const sailDateObj = new Date(sailDate);
            const returnDateObj = new Date(sailDateObj);
            returnDateObj.setDate(sailDateObj.getDate() + nights);
            returnDate = returnDateObj.toISOString().split('T')[0];
          }

          if (shipName || sailDate) {
            const cruise: BookedCruise = {
              id: `imported-${Date.now()}-${i}`,
              shipName: shipName || 'Unknown Ship',
              sailDate: sailDate || new Date().toISOString().split('T')[0],
              returnDate: returnDate || new Date().toISOString().split('T')[0],
              departurePort: departurePort || 'Unknown Port',
              destination: destination || 'Caribbean',
              itineraryName: `${nights} Night ${destination || 'Caribbean'}`,
              nights: nights,
              cabinType: cabinType,
              status: 'available',
              completionState: 'upcoming',
              guests: 2,
              guestNames: [],
              price: price > 0 ? price : undefined,
              cruiseSource: 'royal',
              createdAt: new Date().toISOString(),
            };

            cruises.push(cruise);
            addToLog(`Parsed: ${cruise.shipName} - ${cruise.sailDate}`);
          }
        }
      }

      if (cruises.length === 0) {
        try {
          const jsonData = JSON.parse(text);
          if (Array.isArray(jsonData)) {
            jsonData.forEach((item, index) => {
              const cruise: BookedCruise = {
                id: `imported-json-${Date.now()}-${index}`,
                shipName: item.ship || item.shipName || 'Unknown Ship',
                sailDate: item.sailDate || item.date || new Date().toISOString().split('T')[0],
                returnDate: item.returnDate || new Date().toISOString().split('T')[0],
                departurePort: item.port || item.departurePort || 'Unknown Port',
                destination: item.destination || 'Caribbean',
                itineraryName: item.itinerary || item.itineraryName || `Cruise`,
                nights: item.nights || 7,
                cabinType: item.cabin || item.cabinType || 'Balcony',
                status: 'available',
                completionState: 'upcoming',
                guests: item.guests || 2,
                guestNames: [],
                price: item.price,
                cruiseSource: 'royal',
                createdAt: new Date().toISOString(),
              };
              cruises.push(cruise);
            });
            addToLog(`Parsed ${cruises.length} cruises from JSON`);
          }
        } catch {
          addToLog('Not valid JSON format');
        }
      }

    } catch (error) {
      addToLog(`Error parsing: ${error}`);
    }

    return cruises;
  };

  const handleImport = async () => {
    if (!pastedData.trim()) {
      addToLog('Please paste cruise data first');
      return;
    }

    setImporting(true);
    setImportedCount(0);
    addToLog('Starting import...');

    try {
      const cruises = parseCruiseData(pastedData);

      if (cruises.length === 0) {
        addToLog('No cruises found in the pasted data');
        setImporting(false);
        return;
      }

      for (const cruise of cruises) {
        await addBookedCruise(cruise);
        setImportedCount(prev => prev + 1);
      }

      addToLog(`Successfully imported ${cruises.length} cruises`);

      setTimeout(() => {
        router.back();
      }, 2000);

    } catch (error) {
      addToLog(`Import failed: ${error}`);
    } finally {
      setImporting(false);
    }
  };

  const renderCalendarTab = () => (
    <>
      <View style={styles.calFeedCard}>
        <View style={styles.calFeedHeader}>
          <View style={styles.calFeedIconWrap}>
            <Rss size={18} color="#fff" />
          </View>
          <View style={styles.calFeedHeaderText}>
            <Text style={styles.calFeedTitle}>Publish Calendar Feed</Text>
            <Text style={styles.calFeedSubtitle}>
              Subscribe from Apple Calendar, Google, Outlook
            </Text>
          </View>
        </View>

        <View style={styles.calFeedStatsRow}>
          <View style={styles.calFeedStat}>
            <Ship size={14} color="#60a5fa" />
            <Text style={styles.calFeedStatValue}>{bookedCruises.length}</Text>
            <Text style={styles.calFeedStatLabel}>Cruises</Text>
          </View>
          <View style={styles.calFeedStatDivider} />
          <View style={styles.calFeedStat}>
            <Calendar size={14} color="#a78bfa" />
            <Text style={styles.calFeedStatValue}>{calendarEvents.length}</Text>
            <Text style={styles.calFeedStatLabel}>Events</Text>
          </View>
          <View style={styles.calFeedStatDivider} />
          <View style={styles.calFeedStat}>
            <Ship size={14} color="#34d399" />
            <Text style={styles.calFeedStatValue}>{upcomingCruises.length}</Text>
            <Text style={styles.calFeedStatLabel}>Upcoming</Text>
          </View>
        </View>

        <Pressable
          style={[styles.publishButton, isPublishingFeed && styles.publishButtonDisabled]}
          onPress={handlePublishCalendarFeed}
          disabled={isPublishingFeed}
        >
          {isPublishingFeed ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Rss size={18} color="#fff" />
          )}
          <Text style={styles.publishButtonText}>
            {calendarFeedUrl ? 'Update Feed' : 'Publish Feed'}
          </Text>
          {calendarFeedUrl && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          )}
        </Pressable>

        {calendarFeedUrl ? (
          <>
            <View style={styles.feedUrlBox}>
              <Link2 size={13} color="#64748b" />
              <Text style={styles.feedUrlText} numberOfLines={1} ellipsizeMode="middle">
                {calendarFeedUrl}
              </Text>
            </View>

            <View style={styles.feedActionsRow}>
              <Pressable
                style={[styles.feedActionBtn, isCopied && styles.feedActionBtnActive]}
                onPress={handleCopyFeedUrl}
              >
                {isCopied ? (
                  <CheckCircle size={14} color="#10b981" />
                ) : (
                  <Copy size={14} color="#e2e8f0" />
                )}
                <Text style={[styles.feedActionLabel, isCopied && styles.feedActionLabelActive]}>
                  {isCopied ? 'Copied!' : 'Copy URL'}
                </Text>
              </Pressable>
              <Pressable style={styles.feedActionBtn} onPress={handleSubscribeToFeed}>
                <Calendar size={14} color="#e2e8f0" />
                <Text style={styles.feedActionLabel}>Subscribe</Text>
              </Pressable>
              <Pressable style={styles.feedActionBtn} onPress={handleRegenerateFeedToken}>
                <RefreshCcw size={14} color="#e2e8f0" />
                <Text style={styles.feedActionLabel}>New URL</Text>
              </Pressable>
            </View>

            {feedLastUpdated && (
              <Text style={styles.feedTimestamp}>
                Last published: {new Date(feedLastUpdated).toLocaleDateString()} at {new Date(feedLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.feedHelp}>
            Publish your booked cruises and events as an .ics calendar feed. Any calendar app can subscribe to the URL and stay in sync.
          </Text>
        )}
      </View>

      <View style={styles.calExportCard}>
        <Text style={styles.calExportTitle}>Export as .ICS File</Text>
        <Text style={styles.calExportDesc}>
          Download a snapshot of your {bookedCruises.length} cruise{bookedCruises.length !== 1 ? 's' : ''} and {calendarEvents.length} event{calendarEvents.length !== 1 ? 's' : ''} as an .ics file you can import into any calendar app.
        </Text>
        <Pressable
          style={[styles.exportICSButton, isExportingICS && styles.exportICSButtonDisabled]}
          onPress={handleExportCalendarICS}
          disabled={isExportingICS || (bookedCruises.length === 0 && calendarEvents.length === 0)}
        >
          {isExportingICS ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Download size={18} color="#fff" />
          )}
          <Text style={styles.exportICSButtonText}>Download .ICS</Text>
        </Pressable>
      </View>

      {bookedCruises.length > 0 && (
        <View style={styles.calPreviewCard}>
          <Text style={styles.calPreviewTitle}>Feed Preview</Text>
          <Text style={styles.calPreviewSubtitle}>
            These cruises will appear in your calendar feed:
          </Text>
          {bookedCruises.slice(0, 8).map((cruise) => (
            <View key={cruise.id} style={styles.calPreviewRow}>
              <Ship size={13} color={cruise.completionState === 'upcoming' ? '#60a5fa' : '#64748b'} />
              <View style={styles.calPreviewInfo}>
                <Text style={styles.calPreviewName} numberOfLines={1}>
                  {cruise.shipName}
                </Text>
                <Text style={styles.calPreviewDate}>
                  {cruise.sailDate} - {cruise.returnDate}{cruise.nights ? ` (${cruise.nights}N)` : ''}
                </Text>
              </View>
              {cruise.completionState === 'upcoming' ? (
                <View style={styles.calPreviewBadgeUpcoming}>
                  <Text style={styles.calPreviewBadgeText}>Upcoming</Text>
                </View>
              ) : (
                <View style={styles.calPreviewBadgeCompleted}>
                  <Text style={styles.calPreviewBadgeCompletedText}>Completed</Text>
                </View>
              )}
            </View>
          ))}
          {bookedCruises.length > 8 && (
            <Text style={styles.calPreviewMore}>
              + {bookedCruises.length - 8} more cruise{bookedCruises.length - 8 !== 1 ? 's' : ''}
            </Text>
          )}
          {calendarEvents.length > 0 && (
            <View style={styles.calPreviewEventsRow}>
              <Calendar size={13} color="#a78bfa" />
              <Text style={styles.calPreviewEventsText}>
                + {calendarEvents.length} calendar event{calendarEvents.length !== 1 ? 's' : ''} included
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Import & Calendar',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff'
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {searchMode === 'calendar' ? (
            <Calendar size={32} color="#a78bfa" />
          ) : (
            <Search size={32} color="#60a5fa" />
          )}
          <Text style={styles.title}>
            {searchMode === 'calendar' ? 'Calendar Feed' : 'Web Price Search'}
          </Text>
          <Text style={styles.subtitle}>
            {searchMode === 'calendar'
              ? 'Publish and subscribe to your cruise calendar'
              : 'Search current cabin prices for your upcoming cruises'}
          </Text>
        </View>

        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, searchMode === 'auto' && styles.modeButtonActive]}
            onPress={() => setSearchMode('auto')}
          >
            <Search size={16} color={searchMode === 'auto' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeButtonText, searchMode === 'auto' && styles.modeButtonTextActive]}>
              Auto Sync
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, searchMode === 'manual' && styles.modeButtonActive]}
            onPress={() => setSearchMode('manual')}
          >
            <FileText size={16} color={searchMode === 'manual' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeButtonText, searchMode === 'manual' && styles.modeButtonTextActive]}>
              Import
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, searchMode === 'calendar' && styles.modeButtonActiveCal]}
            onPress={() => setSearchMode('calendar')}
          >
            <Calendar size={16} color={searchMode === 'calendar' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeButtonText, searchMode === 'calendar' && styles.modeButtonTextActive]}>
              Calendar
            </Text>
          </Pressable>
        </View>

        {searchMode === 'calendar' ? (
          renderCalendarTab()
        ) : searchMode === 'auto' ? (
          <>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Sync Cabin Prices</Text>
              <Text style={styles.autoSearchDesc}>
                Search and save current per-person pricing (Interior, Oceanview, Balcony, Suite, Port Taxes & Fees) to your {upcomingCruises.length} upcoming cruise{upcomingCruises.length !== 1 ? 's' : ''}. Prices will be saved directly to each cruise record.
              </Text>

              <Pressable
                style={[styles.searchButton, searchingDeals && styles.searchButtonDisabled]}
                onPress={searchForDeals}
                disabled={searchingDeals || upcomingCruises.length === 0}
              >
                {searchingDeals ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.searchButtonText}>
                      {searchProgress ? `Syncing ${searchProgress.current}/${searchProgress.total}...` : 'Syncing Prices...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Search size={20} color="#fff" />
                    <Text style={styles.searchButtonText}>
                      Sync Prices for {upcomingCruises.length} Cruise{upcomingCruises.length !== 1 ? 's' : ''}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {syncedResults.length > 0 && (
              <View style={styles.syncResultsCard}>
                <View style={styles.syncResultsHeader}>
                  <DollarSign size={20} color="#10b981" />
                  <Text style={styles.syncResultsTitle}>Synced Prices</Text>
                  <View style={styles.syncBadge}>
                    <Text style={styles.syncBadgeText}>
                      {syncedResults.filter(r => r.saved).length}/{syncedResults.length} saved
                    </Text>
                  </View>
                </View>

                {syncedResults.map((result) => (
                  <View key={result.cruiseId} style={[styles.syncCruiseCard, !result.saved && styles.syncCruiseCardFailed]}>
                    <View style={styles.syncCruiseHeader}>
                      <View style={styles.syncCruiseInfo}>
                        <Ship size={14} color={result.saved ? '#60a5fa' : '#64748b'} />
                        <Text style={styles.syncCruiseName} numberOfLines={1}>{result.shipName}</Text>
                      </View>
                      <Text style={styles.syncCruiseDate}>{result.sailDate}</Text>
                    </View>

                    {result.saved ? (
                      <View style={styles.syncPriceGrid}>
                        <View style={styles.syncPriceItem}>
                          <Text style={styles.syncPriceLabel}>Interior</Text>
                          <Text style={styles.syncPriceValue}>
                            {result.interiorPrice ? `${result.interiorPrice.toLocaleString()}` : '—'}
                          </Text>
                        </View>
                        <View style={styles.syncPriceItem}>
                          <Text style={styles.syncPriceLabel}>Oceanview</Text>
                          <Text style={styles.syncPriceValue}>
                            {result.oceanviewPrice ? `${result.oceanviewPrice.toLocaleString()}` : '—'}
                          </Text>
                        </View>
                        <View style={styles.syncPriceItem}>
                          <Text style={styles.syncPriceLabel}>Balcony</Text>
                          <Text style={styles.syncPriceValue}>
                            {result.balconyPrice ? `${result.balconyPrice.toLocaleString()}` : '—'}
                          </Text>
                        </View>
                        <View style={styles.syncPriceItem}>
                          <Text style={styles.syncPriceLabel}>Suite</Text>
                          <Text style={styles.syncPriceValue}>
                            {result.suitePrice ? `${result.suitePrice.toLocaleString()}` : '—'}
                          </Text>
                        </View>
                        <View style={[styles.syncPriceItem, styles.syncPriceItemWide]}>
                          <Text style={styles.syncPriceLabel}>Port Taxes & Fees</Text>
                          <Text style={styles.syncPriceValue}>
                            {result.portTaxesFees ? `${result.portTaxesFees.toLocaleString()}` : '—'}
                          </Text>
                        </View>
                        {result.confidence && (
                          <View style={[styles.syncPriceItem, styles.syncPriceItemWide]}>
                            <Text style={styles.syncPriceLabel}>Confidence</Text>
                            <View style={[styles.confidenceBadge,
                              result.confidence === 'high' && styles.confidenceHigh,
                              result.confidence === 'medium' && styles.confidenceMedium,
                              result.confidence === 'low' && styles.confidenceLow,
                            ]}>
                              <Text style={styles.confidenceText}>{result.confidence}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.syncFailedRow}>
                        <AlertCircle size={14} color="#f59e0b" />
                        <Text style={styles.syncFailedText}>No pricing data found</Text>
                      </View>
                    )}

                    {result.saved && (
                      <View style={styles.syncSavedRow}>
                        <CheckCircle size={12} color="#10b981" />
                        <Text style={styles.syncSavedText}>Saved to cruise record</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>How to Import:</Text>

              <View style={styles.step}>
                <Text style={styles.stepNumber}>1.</Text>
                <View style={styles.stepContent}>
                  <Text style={styles.stepText}>Visit ICruise.com or CruiseSheet.com</Text>
                  <View style={styles.websiteLinks}>
                    <Pressable
                      style={styles.websiteButton}
                      onPress={() => openWebsite('https://www.icruise.com')}
                    >
                      <Globe size={16} color="#60a5fa" />
                      <Text style={styles.websiteButtonText}>ICruise.com</Text>
                      <ExternalLink size={14} color="#60a5fa" />
                    </Pressable>

                    <Pressable
                      style={styles.websiteButton}
                      onPress={() => openWebsite('https://www.cruisesheet.com')}
                    >
                      <Globe size={16} color="#10b981" />
                      <Text style={styles.websiteButtonText}>CruiseSheet.com</Text>
                      <ExternalLink size={14} color="#10b981" />
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.step}>
                <Text style={styles.stepNumber}>2.</Text>
                <Text style={styles.stepText}>
                  Copy cruise details (ship name, date, port, nights, price)
                </Text>
              </View>

              <View style={styles.step}>
                <Text style={styles.stepNumber}>3.</Text>
                <Text style={styles.stepText}>Paste the data below</Text>
              </View>

              <View style={styles.step}>
                <Text style={styles.stepNumber}>4.</Text>
                <Text style={styles.stepText}>Click Import to add to your list</Text>
              </View>
            </View>

            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <FileText size={20} color="#64748b" />
                <Text style={styles.inputTitle}>Paste Cruise Data</Text>
              </View>

              <TextInput
                style={styles.textInput}
                multiline
                placeholder={"Paste cruise data here...\n\nExample:\nShip: Navigator of the Seas\nSail Date: 03/15/2026\n7-Night Caribbean from Miami\nBalcony from $899"}
                placeholderTextColor="#64748b"
                value={pastedData}
                onChangeText={setPastedData}
                editable={!importing}
              />

              <Text style={styles.inputHint}>
                Tip: You can paste multiple cruises at once
              </Text>
            </View>

            <Pressable
              style={[styles.importButton, importing && styles.importButtonDisabled]}
              onPress={handleImport}
              disabled={importing || !pastedData.trim()}
            >
              {importing ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.importButtonText}>Importing... ({importedCount})</Text>
                </>
              ) : (
                <>
                  <Download size={20} color="#fff" />
                  <Text style={styles.importButtonText}>Import Cruises</Text>
                </>
              )}
            </Pressable>
          </>
        )}

        {searchMode !== 'calendar' && importLog.length > 0 && (
          <View style={styles.logCard}>
            <Text style={styles.logTitle}>Search Log:</Text>
            <ScrollView style={styles.logScroll}>
              {importLog.map((log, index) => (
                <View key={index} style={styles.logItem}>
                  {log.includes('Successfully') || log.includes('Saved') ? (
                    <CheckCircle size={14} color="#10b981" />
                  ) : log.includes('Error') || log.includes('failed') ? (
                    <AlertCircle size={14} color="#ef4444" />
                  ) : (
                    <Ship size={14} color="#60a5fa" />
                  )}
                  <Text style={styles.logText}>{log}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#fff',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center' as const,
  },
  instructionsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row' as const,
    marginBottom: 12,
    alignItems: 'flex-start' as const,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#60a5fa',
    marginRight: 12,
    minWidth: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    flex: 1,
  },
  websiteLinks: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap' as const,
  },
  websiteButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  websiteButtonText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  inputCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 12,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    minHeight: 200,
    textAlignVertical: 'top' as const,
    borderWidth: 1,
    borderColor: '#334155',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  inputHint: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
  importButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  importButtonDisabled: {
    backgroundColor: '#475569',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  logCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 300,
  },
  logTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 12,
  },
  logScroll: {
    maxHeight: 250,
  },
  logItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingVertical: 6,
  },
  logText: {
    flex: 1,
    fontSize: 13,
    color: '#cbd5e1',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  modeToggle: {
    flexDirection: 'row' as const,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  modeButtonActiveCal: {
    backgroundColor: '#7c3aed',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#64748b',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  autoSearchDesc: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    marginBottom: 16,
  },
  searchButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  searchButtonDisabled: {
    backgroundColor: '#475569',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  syncResultsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  syncResultsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 16,
  },
  syncResultsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  syncBadge: {
    backgroundColor: '#10b98130',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  syncCruiseCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  syncCruiseCardFailed: {
    borderColor: '#f59e0b40',
    opacity: 0.7,
  },
  syncCruiseHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  syncCruiseInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flex: 1,
  },
  syncCruiseName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    flex: 1,
  },
  syncCruiseDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  syncPriceGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  syncPriceItem: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '22%' as unknown as number,
    flex: 1,
  },
  syncPriceItemWide: {
    minWidth: '45%' as unknown as number,
  },
  syncPriceLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  syncPriceValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#10b981',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
  },
  confidenceHigh: {
    backgroundColor: '#10b98130',
  },
  confidenceMedium: {
    backgroundColor: '#f59e0b30',
  },
  confidenceLow: {
    backgroundColor: '#ef444430',
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#e2e8f0',
    textTransform: 'capitalize' as const,
  },
  syncFailedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 4,
  },
  syncFailedText: {
    fontSize: 13,
    color: '#f59e0b',
  },
  syncSavedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  syncSavedText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '500' as const,
  },

  calFeedCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7c3aed40',
  },
  calFeedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 16,
  },
  calFeedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  calFeedHeaderText: {
    flex: 1,
  },
  calFeedTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#fff',
  },
  calFeedSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  calFeedStatsRow: {
    flexDirection: 'row' as const,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    justifyContent: 'space-around' as const,
  },
  calFeedStat: {
    alignItems: 'center' as const,
    gap: 4,
  },
  calFeedStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  calFeedStatLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  calFeedStatDivider: {
    width: 1,
    backgroundColor: '#334155',
  },
  publishButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 14,
  },
  publishButtonDisabled: {
    backgroundColor: '#475569',
  },
  publishButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  liveBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginLeft: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  feedUrlBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  feedUrlText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
  },
  feedActionsRow: {
    flexDirection: 'row' as const,
    gap: 6,
    marginTop: 10,
  },
  feedActionBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  feedActionBtnActive: {
    backgroundColor: '#10b98130',
  },
  feedActionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#e2e8f0',
  },
  feedActionLabelActive: {
    color: '#10b981',
  },
  feedTimestamp: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 10,
    textAlign: 'center' as const,
  },
  feedHelp: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 12,
    lineHeight: 20,
  },

  calExportCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  calExportTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
  },
  calExportDesc: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 14,
  },
  exportICSButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    paddingVertical: 13,
  },
  exportICSButtonDisabled: {
    backgroundColor: '#475569',
  },
  exportICSButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },

  calPreviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  calPreviewTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  calPreviewSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  calPreviewRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  calPreviewInfo: {
    flex: 1,
  },
  calPreviewName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#e2e8f0',
  },
  calPreviewDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  calPreviewBadgeUpcoming: {
    backgroundColor: '#3b82f620',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  calPreviewBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#60a5fa',
  },
  calPreviewBadgeCompleted: {
    backgroundColor: '#10b98120',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  calPreviewBadgeCompletedText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#10b981',
  },
  calPreviewMore: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center' as const,
    marginTop: 8,
  },
  calPreviewEventsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
  },
  calPreviewEventsText: {
    fontSize: 12,
    color: '#a78bfa',
    fontWeight: '500' as const,
  },
});
