import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { useState } from 'react';
import { RoyalCaribbeanSyncProvider, useRoyalCaribbeanSync } from '@/state/RoyalCaribbeanSyncProvider';
import { ChevronDown, ChevronUp, Loader2, CheckCircle, AlertCircle, XCircle } from 'lucide-react-native';
import { WebViewMessage } from '@/lib/royalCaribbean/types';
import { AUTH_DETECTION_SCRIPT } from '@/lib/royalCaribbean/authDetection';
import { useCoreData } from '@/state/CoreDataProvider';

function RoyalCaribbeanSyncScreen() {
  const coreData = useCoreData();
  const {
    state,
    webViewRef,
    openLogin,
    runIngestion,
    exportOffersCSV,
    exportBookedCruisesCSV,
    exportLog,
    resetState,
    syncToApp,
    handleWebViewMessage
  } = useRoyalCaribbeanSync();

  const [webViewVisible, setWebViewVisible] = useState(true);
  const [logsVisible, setLogsVisible] = useState(false);

  const onMessage = (event: any) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);
      handleWebViewMessage(message);
    } catch (error) {
      console.error('Failed to parse WebView message:', error);
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case 'not_logged_in':
        return '#94a3b8';
      case 'logged_in':
        return '#10b981';
      case 'running_step_1':
      case 'running_step_2':
      case 'running_step_3':
      case 'running_step_4':
        return '#3b82f6';
      case 'complete':
        return '#22c55e';
      case 'login_expired':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case 'not_logged_in':
        return 'Not Logged In';
      case 'logged_in':
        return 'Logged In';
      case 'running_step_1':
        return 'Extracting Club Royale Offers...';
      case 'running_step_2':
        return 'Extracting Upcoming Cruises...';
      case 'running_step_3':
        return 'Extracting Courtesy Holds...';
      case 'running_step_4':
        return 'Extracting Loyalty Status...';
      case 'complete':
        return 'Complete';
      case 'login_expired':
        return 'Login Expired';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    const color = '#fff';
    const size = 16;
    
    switch (state.status) {
      case 'running_step_1':
      case 'running_step_2':
      case 'running_step_3':
      case 'running_step_4':
        return <Loader2 size={size} color={color} />;
      case 'complete':
        return <CheckCircle size={size} color={color} />;
      case 'login_expired':
      case 'error':
        return <AlertCircle size={size} color={color} />;
      default:
        return null;
    }
  };

  const canRunIngestion = state.status === 'logged_in';
  const canExport = state.status === 'complete';
  const isRunning = state.status.startsWith('running_');

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Royal Caribbean Sync',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#fff'
        }}
      />
      
      <View style={styles.container}>
        <View style={[styles.statusPill, { backgroundColor: getStatusColor() }]}>
          {getStatusIcon()}
          <Text style={styles.statusText}>{getStatusText()}</Text>
          {state.progress && (
            <Text style={styles.progressText}>
              {state.progress.current}/{state.progress.total}
            </Text>
          )}
        </View>

        <Pressable 
          style={styles.webViewToggle}
          onPress={() => setWebViewVisible(!webViewVisible)}
        >
          <Text style={styles.webViewToggleText}>
            {webViewVisible ? 'Hide' : 'Show'} Browser
          </Text>
          {webViewVisible ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </Pressable>

        {webViewVisible && (
          <View style={styles.webViewContainer}>
            <WebView
              ref={(ref) => {
                if (ref) {
                  webViewRef.current = ref;
                }
              }}
              source={{ uri: 'https://www.royalcaribbean.com' }}
              style={styles.webView}
              onMessage={onMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              injectedJavaScriptBeforeContentLoaded={AUTH_DETECTION_SCRIPT}
            />
          </View>
        )}

        <View style={styles.actionsContainer}>
          <View style={styles.buttonRow}>
            <Pressable 
              style={[styles.button, styles.primaryButton]}
              onPress={openLogin}
            >
              <Text style={styles.buttonText}>Open Login</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.button, 
                styles.primaryButton,
                (!canRunIngestion || isRunning) && styles.buttonDisabled
              ]}
              onPress={runIngestion}
              disabled={!canRunIngestion || isRunning}
            >
              <Text style={[
                styles.buttonText,
                (!canRunIngestion || isRunning) && styles.buttonTextDisabled
              ]}>
                Run Ingestion
              </Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable 
              style={[
                styles.button, 
                styles.secondaryButton,
                !canExport && styles.buttonDisabled
              ]}
              onPress={exportOffersCSV}
              disabled={!canExport}
            >
              <Text style={[
                styles.secondaryButtonText,
                !canExport && styles.buttonTextDisabled
              ]}>
                Export Offers
              </Text>
            </Pressable>

            <Pressable 
              style={[
                styles.button, 
                styles.secondaryButton,
                !canExport && styles.buttonDisabled
              ]}
              onPress={exportBookedCruisesCSV}
              disabled={!canExport}
            >
              <Text style={[
                styles.secondaryButtonText,
                !canExport && styles.buttonTextDisabled
              ]}>
                Export Booked
              </Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable 
              style={[
                styles.button, 
                styles.successButton,
                !canExport && styles.buttonDisabled
              ]}
              onPress={() => syncToApp(coreData)}
              disabled={!canExport}
            >
              <Text style={[
                styles.buttonText,
                !canExport && styles.buttonTextDisabled
              ]}>
                Sync to App
              </Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable 
              style={[styles.button, styles.tertiaryButton]}
              onPress={() => setLogsVisible(!logsVisible)}
            >
              <Text style={styles.tertiaryButtonText}>
                {logsVisible ? 'Hide' : 'View'} Log ({state.logs.length})
              </Text>
            </Pressable>

            <Pressable 
              style={[styles.button, styles.tertiaryButton]}
              onPress={exportLog}
            >
              <Text style={styles.tertiaryButtonText}>Export Log</Text>
            </Pressable>

            <Pressable 
              style={[styles.button, styles.dangerButton]}
              onPress={resetState}
            >
              <Text style={styles.buttonText}>Reset</Text>
            </Pressable>
          </View>
        </View>

        {logsVisible && (
          <View style={styles.logsContainer}>
            <Text style={styles.logsTitle}>Sync Log</Text>
            <ScrollView style={styles.logsScroll}>
              {state.logs.map((log, index) => (
                <View key={index} style={[styles.logEntry, log.type === 'error' && styles.logError]}>
                  <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                  <Text style={[
                    styles.logMessage,
                    log.type === 'error' && styles.logMessageError,
                    log.type === 'success' && styles.logMessageSuccess
                  ]}>
                    {log.message}
                  </Text>
                </View>
              ))}
              {state.logs.length === 0 && (
                <Text style={styles.logsEmpty}>No logs yet</Text>
              )}
            </ScrollView>
          </View>
        )}

        {state.error && (
          <View style={styles.errorContainer}>
            <XCircle size={20} color="#ef4444" />
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  statusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 12,
    borderRadius: 24
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9
  },
  webViewToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  webViewToggleText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500' as const
  },
  webViewContainer: {
    height: 300,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  webView: {
    flex: 1
  },
  actionsContainer: {
    padding: 12,
    gap: 12
  },
  buttonRow: {
    flexDirection: 'row' as const,
    gap: 12
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  },
  primaryButton: {
    backgroundColor: '#3b82f6'
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  tertiaryButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  dangerButton: {
    backgroundColor: '#7f1d1d'
  },
  successButton: {
    backgroundColor: '#059669'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600' as const
  },
  tertiaryButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500' as const
  },
  buttonTextDisabled: {
    opacity: 0.5
  },
  logsContainer: {
    flex: 1,
    margin: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    overflow: 'hidden' as const
  },
  logsTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600' as const,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  logsScroll: {
    flex: 1,
    padding: 12
  },
  logEntry: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  logError: {
    backgroundColor: '#7f1d1d22'
  },
  logTimestamp: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 2
  },
  logMessage: {
    color: '#cbd5e1',
    fontSize: 12
  },
  logMessageError: {
    color: '#f87171'
  },
  logMessageSuccess: {
    color: '#4ade80'
  },
  logsEmpty: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center' as const,
    paddingVertical: 24
  },
  errorContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    margin: 12,
    padding: 12,
    backgroundColor: '#7f1d1d',
    borderRadius: 8
  },
  errorText: {
    flex: 1,
    color: '#fecaca',
    fontSize: 13
  }
});

export default function RoyalCaribbeanSyncScreenWrapper() {
  return (
    <RoyalCaribbeanSyncProvider>
      <RoyalCaribbeanSyncScreen />
    </RoyalCaribbeanSyncProvider>
  );
}
