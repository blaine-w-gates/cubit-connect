'use client';

import { useAppStore } from '@/store/useAppStore';

/**
 * AppReadyIndicator - Provides a data-testid hook for Playwright tests
 * 
 * This component renders an invisible div with data-testid="app-ready"
 * once the app has completed hydration. E2E tests wait for this element
 * to know the app is ready for interaction.
 */
export function AppReadyIndicator() {
  const isHydrated = useAppStore((state) => state.isHydrated);

  return (
    <div
      data-testid="app-ready"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        visibility: isHydrated ? 'visible' : 'hidden',
      }}
      aria-hidden="true"
    />
  );
}
