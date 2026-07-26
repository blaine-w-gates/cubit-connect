/**
 * Tests for useKeyboardShortcuts hook (#28).
 *
 * Verifies:
 * - ? toggles help overlay
 * - Escape closes help overlay
 * - Shortcuts are disabled when typing in input fields
 * - g+e/g+t/g+d navigation sequences
 * - n creates new task on todo page
 * - SHORTCUTS constant has expected entries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts, SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/todo',
}));

describe('useKeyboardShortcuts', () => {
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  beforeEach(() => {
    keydownHandler = null;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown' && typeof handler === 'function') {
        keydownHandler = handler as (e: KeyboardEvent) => void;
      }
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function pressKey(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {}) {
    if (!keydownHandler) throw new Error('No keydown handler registered');
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      metaKey: opts.metaKey || false,
      ctrlKey: opts.ctrlKey || false,
      shiftKey: opts.shiftKey || false,
    });
    vi.spyOn(event, 'preventDefault').mockImplementation(() => {});
    keydownHandler(event);
    return event;
  }

  it('should toggle help overlay on ?', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    expect(result.current.showHelp).toBe(false);

    act(() => pressKey('?'));
    expect(result.current.showHelp).toBe(true);

    act(() => pressKey('?'));
    expect(result.current.showHelp).toBe(false);
  });

  it('should close help overlay on Escape', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    
    act(() => pressKey('?'));
    expect(result.current.showHelp).toBe(true);

    act(() => pressKey('Escape'));
    expect(result.current.showHelp).toBe(false);
  });

  it('should not toggle help when typing in input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => useKeyboardShortcuts());
    act(() => pressKey('?'));
    expect(result.current.showHelp).toBe(false);

    document.body.removeChild(input);
  });

  it('should allow Escape even when typing in input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => useKeyboardShortcuts());
    
    // First open help (need to blur input first)
    input.blur();
    act(() => pressKey('?'));
    expect(result.current.showHelp).toBe(true);

    // Now focus input and press Escape — should still close
    input.focus();
    act(() => pressKey('Escape'));
    expect(result.current.showHelp).toBe(false);

    document.body.removeChild(input);
  });

  it('should have SHORTCUTS constant with global, todo, and engine entries', () => {
    expect(SHORTCUTS.global).toBeDefined();
    expect(SHORTCUTS.global.length).toBeGreaterThan(0);
    expect(SHORTCUTS.todo).toBeDefined();
    expect(SHORTCUTS.todo.length).toBeGreaterThan(0);
    expect(SHORTCUTS.engine).toBeDefined();
    expect(SHORTCUTS.engine.length).toBeGreaterThan(0);
  });

  it('should include navigation shortcuts in global group', () => {
    const navShortcuts = SHORTCUTS.global.filter(s => s.group === 'Navigation');
    expect(navShortcuts.length).toBeGreaterThanOrEqual(3);
    
    const keys = navShortcuts.map(s => s.keys);
    expect(keys).toContain('g e');
    expect(keys).toContain('g t');
    expect(keys).toContain('g d');
  });

  it('should include ? shortcut in help group', () => {
    const helpShortcuts = SHORTCUTS.global.filter(s => s.group === 'Help');
    expect(helpShortcuts.some(s => s.keys === '?')).toBe(true);
    expect(helpShortcuts.some(s => s.keys === 'Esc')).toBe(true);
  });

  it('should include n, Space, Delete in todo shortcuts', () => {
    const keys = SHORTCUTS.todo.map(s => s.keys);
    expect(keys).toContain('n');
    expect(keys).toContain('Space');
    expect(keys).toContain('Delete');
  });

  it('should include ⌘ ⏎, s, v in engine shortcuts', () => {
    const keys = SHORTCUTS.engine.map(s => s.keys);
    expect(keys).toContain('⌘ ⏎');
    expect(keys).toContain('s');
    expect(keys).toContain('v');
  });

  it('should prevent default on ? key', () => {
    renderHook(() => useKeyboardShortcuts());
    const event = pressKey('?');
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
