import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Download, Ship, ExternalLink, CheckCircle, AlertCircle, FileText, Globe, Search, DollarSign, TrendingDown } from 'lucide-react-native';
import { useCoreData } from '@/state/CoreDataProvider';
import type { BookedCruise } from '@/types/models';
import { trpc } from '@/lib/trpc';

interface CruiseDeal {
  bookingId: string;
  shipName: string;
  sailDate: string;
  source: 'icruise' | 'cruisesheet';
  price: number;
  cabinType: string;
  url: string;
  nights: number;
  departurePort: string;
}

export default function ImportCruisesScreen() {
  const router = useRouter();
  const { addBookedCruise, bookedCruises } = useCoreData();
  
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [pastedData, setPastedData] = useState('');
  const [searchingDeals, setSearchingDeals] = useState(false);
  const [deals, setDeals] = useState<CruiseDeal[]>([]);
  const [searchMode, setSearchMode] = useState<'manual' | 'auto'>('auto');
  
  const searchDealsMutation = trpc.cruiseDeals.searchForBookedCruises.useMutation();

  const addToLog = (message: string) => {
    setImportLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const searchForDeals = async () => {
    if (bookedCruises.length === 0) {
      addToLog('No booked cruises to search for');
      return;
    }

    setSearchingDeals(true);
    setDeals([]);
    addToLog(`Starting search for ${bookedCruises.length} booked cruises...`);

    try {
      const cruiseSearchParams = bookedCruises
        .filter(c => c.completionState === 'upcoming')
        .map(cruise => ({
          id: cruise.id,
          shipName: cruise.shipName,
          sailDate: cruise.sailDate,
          nights: cruise.nights,
          departurePort: cruise.departurePort,
        }));

      addToLog(`Searching ICruise and CruiseSheet for ${cruiseSearchParams.length} cruises...`);

      const result = await searchDealsMutation.mutateAsync({
        cruises: cruiseSearchParams,
      });

      if (result.deals && result.deals.length > 0) {
        setDeals(result.deals);
        addToLog(`Found ${result.deals.length} deals!`);
      } else {
        addToLog('No deals found. Try searching manually on the websites.');
      }
    } catch (error: any) {
      console.error('Search error:', error);
      if (error.message?.includes('Backend') || error.message?.includes('TRPC')) {
        addToLog('Auto-search requires backend. Opening websites manually...');
        await openWebsite('https://www.icruise.com');
        await openWebsite('https://www.cruisesheet.com');
      } else {
        addToLog(`Search failed: ${error.message || error}`);
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
          <Text style={styles.title}>Find Cruise Deals</Text>
          <Text style={styles.subtitle}>
            Automatically search ICruise.com and CruiseSheet.com for your booked cruises
          </Text>
        </View>

        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, searchMode === 'auto' && styles.modeButtonActive]}
            onPress={() => setSearchMode('auto')}
          >
            <Search size={18} color={searchMode === 'auto' ? '#fff' : '#64748b'} />
            <Text style={[styles.modeButtonText, searchMode === 'auto' && styles.modeButtonTextActive]}>
              Auto Search
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
              <Text style={styles.instructionsTitle}>🔍 Auto Search</Text>
              <Text style={styles.autoSearchDesc}>
                We'll automatically search ICruise.com and CruiseSheet.com for better prices on your {bookedCruises.filter(c => c.completionState === 'upcoming').length} upcoming cruise{bookedCruises.filter(c => c.completionState === 'upcoming').length !== 1 ? 's' : ''}.
              </Text>
              
              <Pressable
                style={[styles.searchButton, searchingDeals && styles.searchButtonDisabled]}
                onPress={searchForDeals}
                disabled={searchingDeals || bookedCruises.filter(c => c.completionState === 'upcoming').length === 0}
              >
                {searchingDeals ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.searchButtonText}>Searching...</Text>
                  </>
                ) : (
                  <>
                    <Search size={20} color="#fff" />
                    <Text style={styles.searchButtonText}>
                      Search {bookedCruises.filter(c => c.completionState === 'upcoming').length} Cruise{bookedCruises.filter(c => c.completionState === 'upcoming').length !== 1 ? 's' : ''}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {deals.length > 0 && (
              <View style={styles.dealsCard}>
                <View style={styles.dealsHeader}>
                  <TrendingDown size={20} color="#10b981" />
                  <Text style={styles.dealsTitle}>Found {deals.length} Deal{deals.length !== 1 ? 's' : ''}</Text>
                </View>
                <ScrollView style={styles.dealsScroll}>
                  {deals.map((deal, index) => {
                    const bookedCruise = bookedCruises.find(c => c.id === deal.bookingId);
                    const savings = bookedCruise?.price ? bookedCruise.price - deal.price : 0;
                    return (
                      <Pressable
                        key={index}
                        style={styles.dealCard}
                        onPress={() => Linking.openURL(deal.url)}
                      >
                        <View style={styles.dealInfo}>
                          <Text style={styles.dealShip}>{deal.shipName}</Text>
                          <Text style={styles.dealDate}>{new Date(deal.sailDate).toLocaleDateString()} • {deal.nights} nights</Text>
                          <Text style={styles.dealPort}>{deal.departurePort}</Text>
                          <View style={styles.dealPriceRow}>
                            <DollarSign size={16} color="#10b981" />
                            <Text style={styles.dealPrice}>${deal.price.toLocaleString()}</Text>
                            <Text style={styles.dealCabin}>{deal.cabinType}</Text>
                            {savings > 0 && (
                              <View style={styles.savingsBadge}>
                                <Text style={styles.savingsText}>Save ${savings.toLocaleString()}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.dealSource}>
                            <Globe size={12} color="#60a5fa" />
                            <Text style={styles.dealSourceText}>{deal.source === 'icruise' ? 'ICruise.com' : 'CruiseSheet.com'}</Text>
                          </View>
                        </View>
                        <ExternalLink size={20} color="#60a5fa" />
                      </Pressable>
                    );
                  })}
                </ScrollView>
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
            <Text style={styles.logTitle}>Import Log:</Text>
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
  dealsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  dealsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dealsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  dealsScroll: {
    maxHeight: 500,
  },
  dealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dealInfo: {
    flex: 1,
  },
  dealShip: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  dealDate: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 2,
  },
  dealPort: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  dealPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  dealPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
  },
  dealCabin: {
    fontSize: 13,
    color: '#64748b',
  },
  savingsBadge: {
    backgroundColor: '#10b98120',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  dealSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dealSourceText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
});
