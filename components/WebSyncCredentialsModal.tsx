import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { X, Ship, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react-native';

interface WebSyncCredentialsModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => Promise<void>;
  cruiseLine: 'royal_caribbean' | 'celebrity';
  isLoading: boolean;
  error: string | null;
}

export function WebSyncCredentialsModal({
  visible,
  onClose,
  onSubmit,
  cruiseLine,
  isLoading,
  error
}: WebSyncCredentialsModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isCelebrity = cruiseLine === 'celebrity';
  const brandName = isCelebrity ? 'Celebrity Cruises' : 'Royal Caribbean';
  const clubName = isCelebrity ? 'Blue Chip Club' : 'Club Royale';

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) return;
    await onSubmit(username.trim(), password.trim());
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#94a3b8" />
          </Pressable>

          <View style={styles.header}>
            <View style={[styles.iconContainer, isCelebrity && styles.iconContainerCelebrity]}>
              <Ship size={32} color={isCelebrity ? '#10b981' : '#3b82f6'} />
            </View>
            <Text style={styles.title}>Web Sync Login</Text>
            <Text style={styles.subtitle}>
              Enter your {brandName} credentials to sync your {clubName} data
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email / Username</Text>
              <View style={styles.inputContainer}>
                <User size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter your email"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#64748b" />
                  ) : (
                    <Eye size={18} color="#64748b" />
                  )}
                </Pressable>
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.securityNote}>
              <Lock size={14} color="#64748b" />
              <Text style={styles.securityText}>
                Your credentials are used only for this sync session and are not stored.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[
                styles.submitButton,
                isCelebrity && styles.submitButtonCelebrity,
                (!username.trim() || !password.trim() || isLoading) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!username.trim() || !password.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In & Sync</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modal: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155'
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4
  },
  header: {
    alignItems: 'center',
    marginBottom: 24
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e40af20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  iconContainerCelebrity: {
    backgroundColor: '#05966920'
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 8
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  form: {
    gap: 16,
    marginBottom: 24
  },
  inputGroup: {
    gap: 8
  },
  label: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500' as const
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 14
  },
  eyeButton: {
    padding: 4
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7f1d1d40',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  errorText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 13
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 8
  },
  securityText: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButtonText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '600' as const
  },
  submitButton: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitButtonCelebrity: {
    backgroundColor: '#059669'
  },
  submitButtonDisabled: {
    opacity: 0.5
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const
  }
});
