import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { CLEAN_THEME, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

interface CleanSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function CleanSearchBar({ 
  value, 
  onChangeText, 
  placeholder = 'Search by ship, itinerary, departure port, date...' 
}: CleanSearchBarProps) {
  return (
    <View style={styles.container}>
      <Search size={18} color={CLEAN_THEME.search.icon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={CLEAN_THEME.search.placeholder}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={18} color={CLEAN_THEME.search.icon} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CLEAN_THEME.search.bg,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : 0,
    borderWidth: 1,
    borderColor: CLEAN_THEME.search.border,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: CLEAN_THEME.search.text,
    paddingVertical: SPACING.sm,
  },
});
