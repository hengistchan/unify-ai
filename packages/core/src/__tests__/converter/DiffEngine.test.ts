/**
 * Tests for DiffEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiffEngine, DiffType, type DiffEntry, type DiffResult } from '../../converter/DiffEngine';
import type { UnifiedConfig, RuleConfig, MCPServerConfig } from '../../core/types';

describe('DiffEngine', () => {
  let diffEngine: DiffEngine;

  beforeEach(() => {
    diffEngine = new DiffEngine();
  });

  describe('deepDiff()', () => {
    it('should return empty array for identical objects', () => {
      const obj = { a: 1, b: 'test', c: { nested: true } };
      const diffs = diffEngine.deepDiff(obj, obj);
      expect(diffs).toEqual([]);
    });

    it('should return empty array for both undefined', () => {
      const diffs = diffEngine.deepDiff(undefined, undefined);
      expect(diffs).toEqual([]);
    });

    it('should detect added properties (in generated but not in unified)', () => {
      const unified = { a: 1 };
      const generated = { a: 1, b: 2 };

      const diffs = diffEngine.deepDiff(unified, generated);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.ADDED);
      expect(diffs[0].path).toBe('b');
      expect(diffs[0].source).toBe('tool');
      expect(diffs[0].toolValue).toBe(2);
    });

    it('should detect removed properties (in unified but not in generated)', () => {
      const unified = { a: 1, b: 2 };
      const generated = { a: 1 };

      const diffs = diffEngine.deepDiff(unified, generated);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.REMOVED);
      expect(diffs[0].path).toBe('b');
      expect(diffs[0].source).toBe('unified');
      expect(diffs[0].unifiedValue).toBe(2);
    });

    it('should detect modified properties', () => {
      const unified = { a: 1, b: 'old' };
      const generated = { a: 1, b: 'new' };

      const diffs = diffEngine.deepDiff(unified, generated);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.MODIFIED);
      expect(diffs[0].path).toBe('b');
      expect(diffs[0].source).toBe('both');
      expect(diffs[0].unifiedValue).toBe('old');
      expect(diffs[0].toolValue).toBe('new');
    });

    it('should detect nested differences', () => {
      const unified = { a: { b: { c: 1 } } };
      const generated = { a: { b: { c: 2 } } };

      const diffs = diffEngine.deepDiff(unified, generated);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.MODIFIED);
      expect(diffs[0].path).toBe('a.b.c');
    });

    it('should handle null values', () => {
      const diffs = diffEngine.deepDiff(null, { a: 1 });

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.ADDED);
    });

    it('should handle undefined unified value', () => {
      const diffs = diffEngine.deepDiff(undefined, { a: 1 });

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.ADDED);
      expect(diffs[0].source).toBe('tool');
    });

    it('should handle undefined generated value', () => {
      const diffs = diffEngine.deepDiff({ a: 1 }, undefined);

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.REMOVED);
      expect(diffs[0].source).toBe('unified');
    });

    it('should handle complex nested objects', () => {
      const unified = {
        rules: [{ id: 'rule-1', content: 'old content' }],
        settings: {
          model: { default: 'gpt-4' },
        },
      };
      const generated = {
        rules: [{ id: 'rule-1', content: 'new content' }],
        settings: {
          model: { default: 'claude-3' },
        },
      };

      const diffs = diffEngine.deepDiff(unified, generated);

      // Should detect differences in both rules array and settings
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.some(d => d.path.includes('rules'))).toBe(true);
      expect(diffs.some(d => d.path.includes('settings'))).toBe(true);
    });

    it('should use custom path prefix', () => {
      const unified = { a: 1 };
      const generated = { a: 2 };

      const diffs = diffEngine.deepDiff(unified, generated, 'config');

      expect(diffs[0].path).toBe('config.a');
    });

    it('should include timestamp in diff entries', () => {
      const diffs = diffEngine.deepDiff({ a: 1 }, { a: 2 });

      expect(diffs[0].timestamp).toBeDefined();
      expect(new Date(diffs[0].timestamp).toISOString()).toBe(diffs[0].timestamp);
    });
  });

  describe('diffArrays()', () => {
    it('should return empty array for identical arrays', () => {
      const arr = [{ id: '1', name: 'test' }];
      const diffs = diffEngine.diffArrays(arr, arr, 'items');
      expect(diffs).toEqual([]);
    });

    it('should detect added items by ID', () => {
      const unified = [{ id: '1', name: 'item1' }];
      const generated = [
        { id: '1', name: 'item1' },
        { id: '2', name: 'item2' },
      ];

      const diffs = diffEngine.diffArrays(unified, generated, 'items');

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.ADDED);
      expect(diffs[0].path).toBe('items[2]');
      expect(diffs[0].source).toBe('tool');
    });

    it('should detect removed items by ID', () => {
      const unified = [
        { id: '1', name: 'item1' },
        { id: '2', name: 'item2' },
      ];
      const generated = [{ id: '1', name: 'item1' }];

      const diffs = diffEngine.diffArrays(unified, generated, 'items');

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.REMOVED);
      expect(diffs[0].path).toBe('items[2]');
      expect(diffs[0].source).toBe('unified');
    });

    it('should detect modified items', () => {
      const unified = [{ id: '1', name: 'old' }];
      const generated = [{ id: '1', name: 'new' }];

      const diffs = diffEngine.diffArrays(unified, generated, 'items');

      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.some(d => d.type === DiffType.MODIFIED)).toBe(true);
    });

    it('should use custom ID field', () => {
      const unified = [{ name: 'server1', command: 'cmd1' }];
      const generated = [
        { name: 'server1', command: 'cmd1' },
        { name: 'server2', command: 'cmd2' },
      ];

      const diffs = diffEngine.diffArrays(unified, generated, 'servers', 'name');

      expect(diffs).toHaveLength(1);
      expect(diffs[0].type).toBe(DiffType.ADDED);
      expect(diffs[0].path).toBe('servers[server2]');
    });

    it('should handle empty arrays', () => {
      const diffs1 = diffEngine.diffArrays([], [], 'items');
      expect(diffs1).toEqual([]);

      const diffs2 = diffEngine.diffArrays([], [{ id: '1' }], 'items');
      expect(diffs2).toHaveLength(1);
      expect(diffs2[0].type).toBe(DiffType.ADDED);

      const diffs3 = diffEngine.diffArrays([{ id: '1' }], [], 'items');
      expect(diffs3).toHaveLength(1);
      expect(diffs3[0].type).toBe(DiffType.REMOVED);
    });

    it('should handle items without ID field', () => {
      const arr = [{ name: 'no-id' }];
      const diffs = diffEngine.diffArrays(arr, arr, 'items');
      // Items without ID field are not tracked
      expect(diffs).toEqual([]);
    });
  });

  describe('isEqual()', () => {
    it('should return true for identical primitives', () => {
      expect(diffEngine['isEqual'](1, 1)).toBe(true);
      expect(diffEngine['isEqual']('test', 'test')).toBe(true);
      expect(diffEngine['isEqual'](true, true)).toBe(true);
      expect(diffEngine['isEqual'](null, null)).toBe(true);
      expect(diffEngine['isEqual'](undefined, undefined)).toBe(true);
    });

    it('should return false for different primitives', () => {
      expect(diffEngine['isEqual'](1, 2)).toBe(false);
      expect(diffEngine['isEqual']('test', 'other')).toBe(false);
      expect(diffEngine['isEqual'](true, false)).toBe(false);
      expect(diffEngine['isEqual'](null, undefined)).toBe(false);
    });

    it('should return false for different types', () => {
      expect(diffEngine['isEqual'](1, '1')).toBe(false);
      expect(diffEngine['isEqual'](0, false)).toBe(false);
      expect(diffEngine['isEqual'](null, 0)).toBe(false);
    });

    it('should compare arrays deeply', () => {
      expect(diffEngine['isEqual']([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(diffEngine['isEqual']([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(diffEngine['isEqual']([1, 2], [1, 2, 3])).toBe(false);
      expect(diffEngine['isEqual']([1, 2, 3], [3, 2, 1])).toBe(false);
    });

    it('should compare nested arrays', () => {
      expect(diffEngine['isEqual']([[1, 2], [3]], [[1, 2], [3]])).toBe(true);
      expect(diffEngine['isEqual']([[1, 2], [3]], [[1, 2], [4]])).toBe(false);
    });

    it('should compare objects deeply', () => {
      expect(diffEngine['isEqual']({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(diffEngine['isEqual']({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
      expect(diffEngine['isEqual']({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('should compare nested objects', () => {
      const obj1 = { a: { b: { c: 1 } } };
      const obj2 = { a: { b: { c: 1 } } };
      const obj3 = { a: { b: { c: 2 } } };

      expect(diffEngine['isEqual'](obj1, obj2)).toBe(true);
      expect(diffEngine['isEqual'](obj1, obj3)).toBe(false);
    });

    it('should compare Date objects', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-01');
      const date3 = new Date('2024-01-02');

      expect(diffEngine['isEqual'](date1, date2)).toBe(true);
      expect(diffEngine['isEqual'](date1, date3)).toBe(false);
    });

    it('should handle mixed object/array comparison', () => {
      expect(diffEngine['isEqual']({ a: [1, 2] }, { a: [1, 2] })).toBe(true);
      expect(diffEngine['isEqual']({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
    });
  });

  describe('compareUnified()', () => {
    it('should compare two UnifiedConfig objects', () => {
      const config1: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'old content' }],
      };
      const config2: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'new content' }],
      };

      const diffs = diffEngine.compareUnified(config1, config2);

      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.some(d => d.type === DiffType.MODIFIED)).toBe(true);
    });

    it('should return empty array for identical configs', () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [],
      };

      const diffs = diffEngine.compareUnified(config, config);
      expect(diffs).toEqual([]);
    });
  });
});
