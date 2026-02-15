import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '@/constants/theme';

type ErrorBoundaryState = { hasError: boolean; errorMessage: string; errorStack?: string };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '', errorStack: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    let message = 'An unexpected error occurred';
    let stack = '';
    try {
      if (error instanceof Error) {
        message = error.message || 'Unknown error';
        stack = error.stack || '';
      } else if (typeof error === 'string') {
        message = error;
      } else if (error !== null && error !== undefined) {
        message = String(error);
      }
    } catch {
      message = 'Failed to process error';
    }
    console.error('[ErrorBoundary] getDerivedStateFromError', message, stack);
    return { hasError: true, errorMessage: message, errorStack: stack };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    try {
      const msg = error instanceof Error ? error.message : String(error);
      const stk = error instanceof Error ? error.stack : '';
      console.error('[ErrorBoundary] componentDidCatch', {
        error: msg,
        stack: stk,
        componentStack: errorInfo?.componentStack
      });
    } catch {
      console.error('[ErrorBoundary] componentDidCatch - could not log error details');
    }
  }

  handleReset = () => {
    console.log('[ErrorBoundary] Reset pressed');
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container} testID="error-boundary">
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.errorMessage || 'An unexpected error occurred.'}</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset} testID="error-reset-button">
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.navyDeep,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizeXXL,
    fontWeight: TYPOGRAPHY.fontWeightBold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  message: {
    fontSize: TYPOGRAPHY.fontSizeMD,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: COLORS.beigeWarm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  buttonText: {
    fontSize: TYPOGRAPHY.fontSizeLG,
    fontWeight: TYPOGRAPHY.fontWeightSemiBold,
    color: COLORS.navyDeep,
  },
});
