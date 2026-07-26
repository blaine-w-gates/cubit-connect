/**
 * Landing Page Redirect Logic Tests
 *
 * Tests the checkedRedirect gating that prevents a flash of the
 * landing page for returning users who already have an API key.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock child components to avoid complex rendering
vi.mock('@/components/HeroCarousel', () => ({
  default: () => <div data-testid="hero-carousel" />,
}));

vi.mock('@/components/IgnitionForm', () => ({
  default: () => <div data-testid="ignition-form" />,
}));

import { render, screen } from '@testing-library/react';

describe('Landing Page Redirect Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPush.mockClear();
  });

  it('should render landing page content when no API key exists', async () => {
    const { default: LandingPage } = await import('@/app/page');

    render(<LandingPage />);

    // Wait for checkedRedirect to flip
    await new Promise((r) => setTimeout(r, 100));

    expect(screen.getByTestId('hero-carousel')).toBeDefined();
    expect(screen.getByTestId('ignition-form')).toBeDefined();
  });

  it('should redirect to /engine when API key exists', async () => {
    localStorage.setItem('cubit_api_key', 'test-key');

    const { default: LandingPage } = await import('@/app/page');

    render(<LandingPage />);

    await new Promise((r) => setTimeout(r, 100));

    expect(mockPush).toHaveBeenCalledWith('/engine');
  });

  it('should not render landing content when API key exists (redirects instead)', async () => {
    localStorage.setItem('cubit_api_key', 'test-key');

    const { default: LandingPage } = await import('@/app/page');

    render(<LandingPage />);

    await new Promise((r) => setTimeout(r, 100));

    // Should have redirected, not rendered landing content
    expect(mockPush).toHaveBeenCalledWith('/engine');
    expect(screen.queryByTestId('hero-carousel')).toBeNull();
  });
});
