import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  DollarSign,
  Coffee,
  Utensils,
  Wine,
  Ship,
  Wifi,
  Waves,
  Repeat,
  Plus,
  X,
  Calculator,
  Save,
} from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOW } from '@/constants/theme';
import { MARBLE_TEXTURES } from '@/constants/marbleTextures';
import { formatCurrency } from '@/lib/format';

interface CompItem {
  id: string;
  category: 'drinks' | 'dining' | 'wifi' | 'voom' | 'spa' | 'gratuities' | 'obc' | 'excursions' | 'tradeIn' | 'other';
  name: string;
  value: number;
}

interface CompValueCalculatorProps {
  onCompValueChange?: (totalValue: number, items: CompItem[]) => void;
  initialItems?: CompItem[];
  /** Real cruises to save the tallied comp value onto (Stage 9.4). */
  saveTargets?: { id: string; label: string }[];
  onSaveToCruise?: (cruiseId: string, totalValue: number, items: CompItem[]) => void;
}

const COMP_CATEGORIES = [
  { id: 'drinks', label: 'Drink Package', icon: Wine, color: COLORS.error },
  { id: 'dining', label: 'Specialty Dining', icon: Utensils, color: COLORS.goldDark },
  { id: 'wifi', label: 'WiFi Package', icon: Wifi, color: COLORS.navyDeep },
  { id: 'voom', label: 'VOOM / Internet', icon: Wifi, color: COLORS.info ?? COLORS.navyDeep },
  { id: 'spa', label: 'Spa', icon: Waves, color: COLORS.success },
  { id: 'gratuities', label: 'Gratuities', icon: Coffee, color: COLORS.success },
  { id: 'obc', label: 'Onboard Credit', icon: DollarSign, color: COLORS.royalPurple },
  { id: 'excursions', label: 'Shore Excursions', icon: Ship, color: COLORS.warning },
  { id: 'tradeIn', label: 'Trade-In Value', icon: Repeat, color: COLORS.goldDark },
  { id: 'other', label: 'Other Comps', icon: Plus, color: COLORS.navyDeep },
] as const;

export function CompValueCalculator({ onCompValueChange, initialItems = [], saveTargets = [], onSaveToCruise }: CompValueCalculatorProps) {
  const [compItems, setCompItems] = useState<CompItem[]>(initialItems);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSavePicker, setShowSavePicker] = useState(false);
  const [newItemCategory, setNewItemCategory] = useState<CompItem['category']>('drinks');
  const [newItemName, setNewItemName] = useState('');
  const [newItemValue, setNewItemValue] = useState('');

  const totalCompValue = useMemo(() => {
    return compItems.reduce((sum, item) => sum + item.value, 0);
  }, [compItems]);

  const handleAddItem = () => {
    const value = parseFloat(newItemValue);
    if (!newItemName.trim() || isNaN(value) || value <= 0) return;

    const newItem: CompItem = {
      id: Date.now().toString(),
      category: newItemCategory,
      name: newItemName.trim(),
      value,
    };

    const updatedItems = [...compItems, newItem];
    setCompItems(updatedItems);
    onCompValueChange?.(totalCompValue + value, updatedItems);

    setNewItemName('');
    setNewItemValue('');
    setShowAddForm(false);
  };

  const handleRemoveItem = (id: string) => {
    const updatedItems = compItems.filter(item => item.id !== id);
    setCompItems(updatedItems);
    const newTotal = updatedItems.reduce((sum, item) => sum + item.value, 0);
    onCompValueChange?.(newTotal, updatedItems);
  };

  const getCategoryInfo = (category: CompItem['category']) => {
    return COMP_CATEGORIES.find(c => c.id === category) || COMP_CATEGORIES[COMP_CATEGORIES.length - 1];
  };

  const handleSaveToCruise = (cruiseId: string) => {
    onSaveToCruise?.(cruiseId, totalCompValue, compItems);
    setShowSavePicker(false);
  };

  return (
    <LinearGradient
      colors={MARBLE_TEXTURES.lightBlue.gradientColors}
      locations={MARBLE_TEXTURES.lightBlue.gradientLocations}
      style={styles.container}
    >
      <View style={styles.header}>
        <Calculator size={20} color={COLORS.navyDeep} />
        <Text style={styles.title}>Comp Value Calculator</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Comp Value</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalCompValue)}</Text>
        <Text style={styles.totalSubtext}>
          Track all complimentary items and their retail value
        </Text>
      </View>

      {compItems.length > 0 && (
        <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
          {compItems.map((item) => {
            const categoryInfo = getCategoryInfo(item.category);
            const IconComponent = categoryInfo.icon;
            
            return (
              <View key={item.id} style={styles.compItemCard}>
                <View style={[styles.itemIcon, { backgroundColor: `${categoryInfo.color}15` }]}>
                  <IconComponent size={18} color={categoryInfo.color} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{categoryInfo.label}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemValue}>{formatCurrency(item.value)}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveItem(item.id)}
                    style={styles.removeButton}
                    activeOpacity={0.7}
                  >
                    <X size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {!showAddForm ? (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(true)}
          activeOpacity={0.8}
        >
          <Plus size={18} color={COLORS.white} />
          <Text style={styles.addButtonText}>Add Comp Item</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.addForm}>
          <Text style={styles.formLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {COMP_CATEGORIES.map((category) => {
              const isSelected = newItemCategory === category.id;
              const IconComponent = category.icon;
              
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    isSelected && [styles.categoryChipActive, { backgroundColor: category.color }],
                  ]}
                  onPress={() => setNewItemCategory(category.id as CompItem['category'])}
                  activeOpacity={0.7}
                >
                  <IconComponent size={14} color={isSelected ? COLORS.white : category.color} />
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextActive,
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.formLabel}>Item Name</Text>
          <TextInput
            style={styles.input}
            value={newItemName}
            onChangeText={setNewItemName}
            placeholder="e.g., Deluxe Beverage Package"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.formLabel}>Retail Value</Text>
          <View style={styles.valueInputContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.valueInput}
              value={newItemValue}
              onChangeText={setNewItemValue}
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddForm(false);
                setNewItemName('');
                setNewItemValue('');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!newItemName.trim() || !newItemValue || parseFloat(newItemValue) <= 0) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={handleAddItem}
              disabled={!newItemName.trim() || !newItemValue || parseFloat(newItemValue) <= 0}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {compItems.length === 0 && !showAddForm && (
        <View style={styles.emptyState}>
          <Calculator size={40} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No comp items tracked yet</Text>
          <Text style={styles.emptySubtext}>
            Add items to calculate total comp value
          </Text>
        </View>
      )}

      {compItems.length > 0 && saveTargets.length > 0 && onSaveToCruise && !showSavePicker && (
        <TouchableOpacity style={styles.saveToCruiseButton} onPress={() => setShowSavePicker(true)} activeOpacity={0.8} testID="comp-calc-save-to-cruise">
          <Save size={16} color={COLORS.white} />
          <Text style={styles.saveToCruiseButtonText}>Save to Cruise</Text>
        </TouchableOpacity>
      )}

      {showSavePicker && (
        <View style={styles.addForm}>
          <Text style={styles.formLabel}>Choose a cruise to save this total onto</Text>
          <ScrollView style={{ maxHeight: 220 }}>
            {saveTargets.map((target) => (
              <TouchableOpacity key={target.id} style={styles.saveTargetRow} onPress={() => handleSaveToCruise(target.id)} activeOpacity={0.7}>
                <Text style={styles.saveTargetText} numberOfLines={1}>{target.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.emptySubtext}>Values map to FreePlay, OBC, VOOM, dining, spa, and trade-in fields. Anything already recorded on the cruise won't be double-counted — it will be replaced with this total.</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowSavePicker(false)} activeOpacity={0.7}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.navyDeep,
  },
  totalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  totalLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    marginBottom: SPACING.xs,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
    marginBottom: SPACING.xs,
  },
  totalSubtext: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  itemsList: {
    maxHeight: 300,
    marginBottom: SPACING.md,
  },
  compItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: 2,
  },
  itemCategory: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    color: COLORS.textSecondary,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemValue: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.success,
  },
  removeButton: {
    padding: SPACING.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.navyDeep,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  addButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  addForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.md,
  },
  formLabel: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  categoryScroll: {
    marginBottom: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginRight: SPACING.xs,
  },
  categoryChipActive: {
    backgroundColor: COLORS.navyDeep,
  },
  categoryChipText: {
    fontSize: TYPOGRAPHY.fontSizeXS,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
    color: COLORS.navyDeep,
  },
  categoryChipTextActive: {
    color: COLORS.white,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
    marginBottom: SPACING.sm,
  },
  valueInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 31, 63, 0.15)',
    marginBottom: SPACING.md,
  },
  currencySymbol: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    paddingLeft: SPACING.sm,
  },
  valueInput: {
    flex: 1,
    padding: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
  },
  formActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
  saveButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.success,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
    marginTop: SPACING.sm,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.fontSizeSM,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  saveToCruiseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  saveToCruiseButtonText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.white,
  },
  saveTargetRow: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  saveTargetText: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.navyDeep,
    fontWeight: TYPOGRAPHY.fontWeightMedium,
  },
});
