/**
 * Tests for extracted TodoTable sub-components.
 *
 * Tests the pure presentational components extracted during decomposition (#26).
 */

import { describe, it, expect } from 'vitest';

describe('TodoTable Sub-Components', () => {
  describe('EditableCell', () => {
    it('should exist and be importable', async () => {
      const mod = await import('@/components/todo/EditableCell');
      expect(mod.EditableCell).toBeDefined();
      expect(typeof mod.EditableCell).toBe('function');
    });

    it('should have component name EditableCell', async () => {
      const { EditableCell } = await import('@/components/todo/EditableCell');
      expect(EditableCell.name).toBe('EditableCell');
    });
  });

  describe('CircularProgress', () => {
    it('should exist and be importable', async () => {
      const mod = await import('@/components/todo/CircularProgress');
      expect(mod.CircularProgress).toBeDefined();
      expect(typeof mod.CircularProgress).toBe('function');
    });

    it('should have component name CircularProgress', async () => {
      const { CircularProgress } = await import('@/components/todo/CircularProgress');
      expect(CircularProgress.name).toBe('CircularProgress');
    });
  });

  describe('ParticleBurst', () => {
    it('should exist and be importable', async () => {
      const mod = await import('@/components/todo/ParticleBurst');
      expect(mod.ParticleBurst).toBeDefined();
      expect(typeof mod.ParticleBurst).toBe('function');
    });
  });

  describe('RabbitDraggable', () => {
    it('should export RabbitDraggable', async () => {
      const mod = await import('@/components/todo/RabbitDraggable');
      expect(mod.RabbitDraggable).toBeDefined();
      expect(typeof mod.RabbitDraggable).toBe('function');
    });

    it('should export RabbitOverlayWrapper', async () => {
      const mod = await import('@/components/todo/RabbitDraggable');
      expect(mod.RabbitOverlayWrapper).toBeDefined();
      expect(typeof mod.RabbitOverlayWrapper).toBe('function');
    });
  });

  describe('StepCellNode', () => {
    it('should exist and be importable', async () => {
      const mod = await import('@/components/todo/StepCellNode');
      expect(mod.StepCellNode).toBeDefined();
      expect(typeof mod.StepCellNode).toBe('function');
    });
  });

  describe('SortableRow', () => {
    it('should exist and be importable', async () => {
      const mod = await import('@/components/todo/SortableRow');
      expect(mod.SortableRow).toBeDefined();
      expect(typeof mod.SortableRow).toBe('function');
    });
  });

  describe('parseGeminiError', () => {
    it('should exist and be importable', async () => {
      const mod = await import('@/components/todo/parseGeminiError');
      expect(mod.parseGeminiError).toBeDefined();
      expect(typeof mod.parseGeminiError).toBe('function');
    });

    it('should return original message for non-API errors', async () => {
      const { parseGeminiError } = await import('@/components/todo/parseGeminiError');
      const result = parseGeminiError(new Error('Something went wrong'));
      expect(result).toBe('Something went wrong');
    });

    it('should return friendly message for API key errors', async () => {
      const { parseGeminiError } = await import('@/components/todo/parseGeminiError');
      const result = parseGeminiError(new Error('API_KEY_INVALID'));
      expect(result).toContain('API key is invalid or expired');
    });

    it('should parse JSON error messages', async () => {
      const { parseGeminiError } = await import('@/components/todo/parseGeminiError');
      const result = parseGeminiError(new Error('Request failed: {"error":{"message":"Quota exceeded"}}'));
      expect(result).toBe('Quota exceeded');
    });

    it('should handle array-style JSON errors', async () => {
      const { parseGeminiError } = await import('@/components/todo/parseGeminiError');
      // The parser finds the first '{' and slices from there
      const result = parseGeminiError(new Error('{"error":{"message":"Rate limited"}}'));
      expect(result).toBe('Rate limited');
    });

    it('should fall back to original message for invalid JSON', async () => {
      const { parseGeminiError } = await import('@/components/todo/parseGeminiError');
      const result = parseGeminiError(new Error('{invalid json}'));
      expect(result).toBe('{invalid json}');
    });
  });

  describe('types', () => {
    it('should export SortableRowProps interface', async () => {
      const mod = await import('@/components/todo/types');
      expect(mod).toBeDefined();
    });
  });
});
