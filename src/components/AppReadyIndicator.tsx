'use client';

import { useAppStore } from '@/store/useAppStore';

/**
 * AppReadyIndicator - Provides a data-testid hook for Playwright tests
 * 
 * This component renders a div with data-testid="app-ready"
 * once the app has completed hydration. E2E tests wait for this element
 * to know the app is ready for interaction.
 * 
 * Note: Uses display:none/block instead of visibility:hidden/visible
 * because Playwright's visibility check requires positive dimensions.
 */
export function AppReadyIndicator() {
  const isHydrated = useAppStore((state) => state.isHydrated);

  return (
    <div
      data-testid="app-ready"
      style={{
        display: isHydrated ? 'block' : 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  );
}
