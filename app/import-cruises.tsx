import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Download, Ship, ExternalLink, CheckCircle, AlertCircle, FileText, Globe } from 'lucide-react-native';
import { useCoreData } from '@/state/CoreDataProvider';
import type { BookedCruise } from '@/types/models';

export default function ImportCruisesScreen() {
  const router = useRouter();
  const { addBookedCruise } = useCoreData();
  
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [pastedData, setPastedData] = useState('');

  const addToLog = (message: string) => {
    setImportLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

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
          <Download size={32} color="#60a5fa" />
          <Text style={styles.title}>Import Cruise Deals</Text>
          <Text style={styles.subtitle}>
            Import cruises from ICruise.com and CruiseSheet.com
          </Text>
        </View>

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
});
