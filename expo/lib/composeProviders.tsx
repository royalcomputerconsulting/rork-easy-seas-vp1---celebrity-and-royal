import React, { type ComponentType, type ReactNode } from 'react';

type ProviderComponent = ComponentType<{ children: ReactNode }>;

interface ProviderBoundaryProps {
  providerName: string;
  fallback: ReactNode;
  children: ReactNode;
}

interface ProviderBoundaryState {
  failed: boolean;
}

class ProviderBoundary extends React.Component<ProviderBoundaryProps, ProviderBoundaryState> {
  state: ProviderBoundaryState = { failed: false };

  static getDerivedStateFromError(): ProviderBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(`[Startup] ${this.props.providerName} failed during render; continuing without that provider so the app can still open.`, error);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function composeProviders(
  ...providers: ProviderComponent[]
): ComponentType<{ children: ReactNode }> {
  return function ComposedProviders({ children }: { children: ReactNode }) {
    return providers.reduceRight<ReactNode>((acc, Provider) => {
      const providerName = Provider.displayName || Provider.name || 'AnonymousProvider';
      return (
        <ProviderBoundary providerName={providerName} fallback={acc}>
          <Provider>{acc}</Provider>
        </ProviderBoundary>
      );
    }, children);
  };
}
