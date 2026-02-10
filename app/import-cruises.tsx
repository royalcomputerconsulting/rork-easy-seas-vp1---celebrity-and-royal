import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Download, Ship, ExternalLink, CheckCircle, AlertCircle, FileText, Globe, Search, DollarSign } from 'lucide-react-native';
import { useCoreData } from '@/state/CoreDataProvider';
import type { BookedCruise } from '@/types/models';
import { syncCruisePricing, SyncProgress, CruisePricing } from '@/lib/cruisePricingSync';

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
  const { addBookedCruise, bookedCruises, updateBookedCruise } = useCoreData();
  
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [pastedData, setPastedData] = useState('');
  const [searchingDeals, setSearchingDeals] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SyncProgress | null>(null);

  const [searchMode, setSearchMode] = useState<'manual' | 'auto'>('auto');
  const [syncedResults, setSyncedResults] = useState<SyncedCruiseResult[]>([]);

  const addToLog = (message: string) => {
    setImportLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const searchForDeals = async () => {
    if (bookedCruises.length === 0) {
      addToLog('No booked cruises to sync');
      return;
    }

    setSearchingDeals(true);

    try {
      const upcomingCruises = bookedCruises.filter(c => c.completionState === 'upcoming');
      
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
          addToLog(`🔍 Searching prices for ${progress.shipName} (${progress.current}/${progress.total})...`);
        } else if (progress.status === 'found') {
          addToLog(`✅ Found prices for ${progress.shipName}`);
        } else if (progress.status === 'not_found') {
          addToLog(`⚠️ No prices found for ${progress.shipName}`);
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

          addToLog(`  Saved → ${cruise.shipName}: INT ${pricing.interiorPrice || '-'} | OV ${pricing.oceanviewPrice || '-'} | BAL ${pricing.balconyPrice || '-'} | STE ${pricing.suitePrice || '-'} | TAX ${pricing.portTaxesFees || '-'}`);
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
        addToLog('⚠️ Could not connect to pricing service');
        addToLog('This may be temporary. Please try again in a moment.');
      } else if (errorMessage.includes('unavailable')) {
        addToLog('⚠️ Pricing service temporarily unavailable');
        addToLog('Please try again in a few minutes.');
      } else {
        addToLog(`⚠️ Sync error: ${errorMessage}`);
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

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Import Cruises',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff'
        }}
      />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Search size={32} color="#60a5fa" />
          <Text style={styles.title}>Web Price Search</Text>
          <Text style={styles.subtitle}>
            Search current cabin prices for your upcoming cruises
          </Text>
        </View>

        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, searchMode === 'auto' && styles.modeButtonActive]}
            onPress={() => setSearchMode('auto')}
          >
            <Search size={18} color={searchMode === 'auto' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeButtonText, searchMode === 'auto' && styles.modeButtonTextActive]}>
              Auto Sync
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, searchMode === 'manual' && styles.modeButtonActive]}
            onPress={() => setSearchMode('manual')}
          >
            <FileText size={18} color={searchMode === 'manual' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeButtonText, searchMode === 'manual' && styles.modeButtonTextActive]}>
              Manual Import
            </Text>
          </Pressable>
        </View>

        {searchMode === 'auto' ? (
          <>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>💰 Sync Cabin Prices</Text>
              <Text style={styles.autoSearchDesc}>
                Search and save current per-person pricing (Interior, Oceanview, Balcony, Suite, Port Taxes & Fees) to your {bookedCruises.filter(c => c.completionState === 'upcoming').length} upcoming cruise{bookedCruises.filter(c => c.completionState === 'upcoming').length !== 1 ? 's' : ''}. Prices will be saved directly to each cruise record.
              </Text>
              
              <Pressable
                style={[styles.searchButton, searchingDeals && styles.searchButtonDisabled]}
                onPress={searchForDeals}
                disabled={searchingDeals || bookedCruises.filter(c => c.completionState === 'upcoming').length === 0}
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
                      Sync Prices for {bookedCruises.filter(c => c.completionState === 'upcoming').length} Cruise{bookedCruises.filter(c => c.completionState === 'upcoming').length !== 1 ? 's' : ''}
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
          <Text style={styles.instructionsTitle}>📋 How to Import:</Text>
          
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
            placeholder="Paste cruise data here...&#10;&#10;Example:&#10;Ship: Navigator of the Seas&#10;Sail Date: 03/15/2026&#10;7-Night Caribbean from Miami&#10;Balcony from $899"
            placeholderTextColor="#64748b"
            value={pastedData}
            onChangeText={setPastedData}
            editable={!importing}
          />
          
          <Text style={styles.inputHint}>
            💡 Tip: You can paste multiple cruises at once
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

        {importLog.length > 0 && (
          <View style={styles.logCard}>
            <Text style={styles.logTitle}>Search Log:</Text>
            <ScrollView style={styles.logScroll}>
              {importLog.map((log, index) => (
                <View key={index} style={styles.logItem}>
                  {log.includes('Successfully') ? (
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
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
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
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
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  websiteButtonText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '500',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    minHeight: 200,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  inputHint: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  importButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  logScroll: {
    maxHeight: 250,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: '#3b82f6',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  syncCruiseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  syncFailedText: {
    fontSize: 13,
    color: '#f59e0b',
  },
  syncSavedRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
