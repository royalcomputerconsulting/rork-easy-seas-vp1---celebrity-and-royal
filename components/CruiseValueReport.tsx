import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { BookedCruise } from '@/types/models';
import { calculateCruiseValue } from '@/lib/valueCalculator';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants/theme';

interface CruiseValueReportProps {
  cruise: BookedCruise;
}

export function CruiseValueReport({ cruise }: CruiseValueReportProps) {
  const breakdown = calculateCruiseValue(cruise);
  const hasReceiptData = Boolean(cruise.totalRetailCost && cruise.pricePaid !== undefined);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.shipName}>{cruise.shipName}</Text>
        <Text style={styles.sailDate}>{new Date(cruise.sailDate).toLocaleDateString()}</Text>
      </View>

      {hasReceiptData ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓ ACTUAL RECEIPT DATA</Text>
        </View>
      ) : (
        <View style={[styles.badge, styles.estimatedBadge]}>
          <Text style={[styles.badgeText, styles.estimatedText]}>⚠ ESTIMATED VALUES</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What You Received</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>Cabin Retail Value (×{cruise.guests || 2})</Text>
          <Text style={styles.value}>${breakdown.cabinValueForTwo.toLocaleString()}</Text>
        </View>

        {breakdown.discountValue > breakdown.cabinValueForTwo && (
          <View style={styles.row}>
            <Text style={styles.label}>Casino Discount</Text>
            <Text style={[styles.value, styles.positiveValue]}>
              ${(breakdown.discountValue - breakdown.cabinValueForTwo).toLocaleString()}
            </Text>
          </View>
        )}

        {breakdown.freePlayValue > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Free Play</Text>
            <Text style={styles.value}>${breakdown.freePlayValue.toLocaleString()}</Text>
          </View>
        )}

        {breakdown.obcValue > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Onboard Credit (OBC)</Text>
            <Text style={styles.value}>${breakdown.obcValue.toLocaleString()}</Text>
          </View>
        )}

        {breakdown.tradeInValue > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Trade-In Value</Text>
            <Text style={styles.value}>${breakdown.tradeInValue.toLocaleString()}</Text>
          </View>
        )}

        {breakdown.freeInternetValue > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Free WiFi Value</Text>
            <Text style={styles.value}>${breakdown.freeInternetValue.toLocaleString()}</Text>
          </View>
        )}

        {(cruise.earnedPoints || cruise.casinoPoints) ? (
          <View style={styles.row}>
            <Text style={styles.label}>
              Club Royale Points ({(cruise.earnedPoints || cruise.casinoPoints || 0).toLocaleString()} pts)
            </Text>
            <Text style={styles.value}>
              ${((cruise.earnedPoints || cruise.casinoPoints || 0) * 0.01).toFixed(2)}
            </Text>
          </View>
        ) : null}

        {breakdown.casinoWinnings !== 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Casino Winnings/Losses</Text>
            <Text style={[
              styles.value, 
              breakdown.casinoWinnings > 0 ? styles.positiveValue : styles.negativeValue
            ]}>
              ${breakdown.casinoWinnings.toLocaleString()}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.totalLabel}>Total Value Received</Text>
          <Text style={styles.totalValue}>${breakdown.totalValueReceived.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What You Paid</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>{hasReceiptData ? 'Price Paid' : 'Taxes & Fees'}</Text>
          <Text style={[styles.value, styles.negativeValue]}>
            ${breakdown.trueOutOfPocket.toFixed(2)}
          </Text>
        </View>

        {breakdown.casinoWinnings < 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>Casino Losses</Text>
            <Text style={[styles.value, styles.negativeValue]}>
              ${Math.abs(breakdown.casinoWinnings).toLocaleString()}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.totalLabel}>Total Out of Pocket</Text>
          <Text style={[styles.totalValue, styles.negativeValue]}>
            ${breakdown.trueOutOfPocket.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={[styles.section, styles.summarySection]}>
        <Text style={styles.sectionTitle}>Net Value Analysis</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>Total Profit</Text>
          <Text style={[styles.value, styles.profitValue]}>
            ${breakdown.totalProfit.toLocaleString()}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Value per Dollar Paid</Text>
          <Text style={[styles.value, styles.profitValue]}>
            {breakdown.valuePerDollar === Infinity 
              ? '∞' 
              : `$${breakdown.valuePerDollar.toFixed(2)}`}
          </Text>
        </View>

        {hasReceiptData && (
          <View style={styles.row}>
            <Text style={styles.label}>Coverage</Text>
            <Text style={styles.value}>
              {(breakdown.coverageFraction * 100).toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      <View style={styles.formulaSection}>
        <Text style={styles.formulaTitle}>Calculation Formula:</Text>
        <Text style={styles.formulaText}>{breakdown.formula}</Text>
      </View>

      {hasReceiptData && cruise.cabinCategory && (
        <View style={styles.receiptInfo}>
          <Text style={styles.receiptLabel}>Receipt Details</Text>
          <Text style={styles.receiptText}>
            Cabin: {cruise.cabinCategory} {cruise.cabinNumber ? `#${cruise.cabinNumber}` : ''}
          </Text>
          <Text style={styles.receiptText}>
            Price Paid: ${cruise.pricePaid?.toFixed(2) || '0.00'}
          </Text>
          <Text style={styles.receiptText}>
            Total Retail: ${cruise.totalRetailCost?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.receiptText}>
            Casino Discount: ${cruise.totalCasinoDiscount?.toLocaleString() || '0'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  header: {
    marginBottom: SPACING.md,
  },
  shipName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.textNavy,
    marginBottom: 4,
  },
  sailDate: {
    fontSize: 16,
    color: COLORS.textDarkGrey,
  },
  badge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
    marginBottom: SPACING.md,
  },
  estimatedBadge: {
    backgroundColor: '#F59E0B',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  estimatedText: {
    color: '#000000',
  },
  section: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  summarySection: {
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.textNavy,
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: COLORS.textDarkGrey,
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.textNavy,
  },
  positiveValue: {
    color: '#10B981',
  },
  negativeValue: {
    color: '#EF4444',
  },
  profitValue: {
    color: '#10B981',
    fontSize: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.textNavy,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.textNavy,
  },
  formulaSection: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  formulaTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textDarkGrey,
    marginBottom: 8,
  },
  formulaText: {
    fontSize: 12,
    color: COLORS.textNavy,
    fontFamily: 'monospace',
  },
  receiptInfo: {
    backgroundColor: '#1E293B',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  receiptLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: COLORS.textNavy,
    marginBottom: 8,
  },
  receiptText: {
    fontSize: 12,
    color: COLORS.textDarkGrey,
    marginBottom: 4,
  },
});
