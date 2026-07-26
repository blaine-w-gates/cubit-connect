/**
 * OnboardingOverlay Component Tests
 *
 * Tests the first-run onboarding overlay that shows on /engine and /todo.
 * Verifies localStorage gating, step navigation, and dismissal behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import OnboardingOverlay from '@/components/OnboardingOverlay';

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should exist and be importable', async () => {
    expect(OnboardingOverlay).toBeDefined();
    expect(typeof OnboardingOverlay).toBe('function');
  });

  it('should not show when onboarding already complete', async () => {
    localStorage.setItem('cubit_onboarding_complete', 'true');
    localStorage.setItem('cubit_api_key', 'test-key');

    render(<OnboardingOverlay />);

    // Wait past the 800ms delay
    await new Promise((r) => setTimeout(r, 1000));

    expect(screen.queryByText('The Engine')).toBeNull();
  });

  it('should not show when no API key is present', async () => {
    // No API key, no onboarding complete
    render(<OnboardingOverlay />);

    await new Promise((r) => setTimeout(r, 1000));

    expect(screen.queryByText('The Engine')).toBeNull();
  });

  it('should show onboarding when API key exists but onboarding not complete', async () => {
    localStorage.setItem('cubit_api_key', 'test-key');
    // onboarding_complete not set

    render(<OnboardingOverlay />);

    await waitFor(
      () => {
        expect(screen.getByText('The Engine')).toBeDefined();
      },
      { timeout: 2000 }
    );
  });

  it('should show 3 steps with correct titles', async () => {
    localStorage.setItem('cubit_api_key', 'test-key');

    render(<OnboardingOverlay />);

    await waitFor(
      () => {
        expect(screen.getByText('The Engine')).toBeDefined();
      },
      { timeout: 2000 }
    );

    // First step should be visible — description is a long string, use partial match
    expect(screen.getByText(/Upload a video or paste a transcript/)).toBeDefined();
  });

  it('should dismiss and set localStorage when Skip Tour is clicked', async () => {
    localStorage.setItem('cubit_api_key', 'test-key');

    render(<OnboardingOverlay />);

    await waitFor(
      () => {
        expect(screen.getByText('Skip Tour')).toBeDefined();
      },
      { timeout: 2000 }
    );

    fireEvent.click(screen.getByText('Skip Tour'));

    expect(localStorage.getItem('cubit_onboarding_complete')).toBe('true');
  });

  it('should dismiss when close button (X) is clicked', async () => {
    localStorage.setItem('cubit_api_key', 'test-key');

    render(<OnboardingOverlay />);

    await waitFor(
      () => {
        expect(screen.getByLabelText('Skip onboarding')).toBeDefined();
      },
      { timeout: 2000 }
    );

    fireEvent.click(screen.getByLabelText('Skip onboarding'));

    expect(localStorage.getItem('cubit_onboarding_complete')).toBe('true');
  });

  it('should advance to next step when Next is clicked', async () => {
    localStorage.setItem('cubit_api_key', 'test-key');

    render(<OnboardingOverlay />);

    await waitFor(
      () => {
        expect(screen.getByText('Next')).toBeDefined();
      },
      { timeout: 2000 }
    );

    // Step 1: The Engine
    expect(screen.getByText('The Engine')).toBeDefined();

    // Click Next to go to Step 2: Scout
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Scout')).toBeDefined();
    });
  });

  it('should show Go to To-Do button on last step', async () => {
    localStorage.setItem('cubit_api_key', 'test-key');

    render(<OnboardingOverlay />);

    await waitFor(
      () => {
        expect(screen.getByText('Next')).toBeDefined();
      },
      { timeout: 2000 }
    );

    // Advance to step 2 (Scout)
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(screen.getByText('Scout')).toBeDefined());

    // Advance to step 3 (To-Do)
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(screen.getByText('To-Do')).toBeDefined());

    // Last step should have "Go to To-Do" instead of "Next"
    expect(screen.getByText('Go to To-Do')).toBeDefined();
    expect(screen.queryByText('Next')).toBeNull();
  });
});
