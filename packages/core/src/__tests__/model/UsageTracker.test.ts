/**
 * Tests for UsageTracker
 *
 * Tests usage logging, cost calculation, and aggregation functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UsageTracker } from '../../model/UsageTracker';
import { ModelDatabase } from '../../model/Database';
import type { LogUsageInput, UsageLogFilters } from '../../model/types';

describe('UsageTracker', () => {
  let db: ModelDatabase;
  let tracker: UsageTracker;

  beforeEach(async () => {
    // Use in-memory database for testing
    db = new ModelDatabase(':memory:');
    await db.initialize();
    tracker = new UsageTracker(db);

    // Insert test providers and model configs for pricing
    await db.run(
      `INSERT INTO providers (id, name, type, enabled, priority)
       VALUES ('openai', 'OpenAI', 'openai-compatible', 1, 100)`
    );

    await db.run(
      `INSERT INTO providers (id, name, type, enabled, priority)
       VALUES ('anthropic', 'Anthropic', 'anthropic', 1, 90)`
    );

    await db.run(
      `INSERT INTO model_configs (id, provider_id, model_id, display_name, context_window, max_output_tokens, pricing_input, pricing_output, enabled)
       VALUES ('openai-gpt-4o', 'openai', 'gpt-4o', 'GPT-4o', 128000, 4096, 0.005, 0.015, 1)`
    );

    await db.run(
      `INSERT INTO model_configs (id, provider_id, model_id, display_name, context_window, max_output_tokens, pricing_input, pricing_output, enabled)
       VALUES ('anthropic-sonnet', 'anthropic', 'claude-sonnet-4-5', 'Claude Sonnet 4.5', 200000, 8192, 0.003, 0.015, 1)`
    );
  });

  afterEach(async () => {
    await db.close();
  });

  describe('logUsage()', () => {
    it('should log usage with calculated cost', async () => {
      const input: LogUsageInput = {
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      };

      const log = await tracker.logUsage(input);

      expect(log).toBeDefined();
      expect(log.id).toBeDefined();
      expect(typeof log.id).toBe('number');
      expect(log.id).toBeGreaterThan(0);
      expect(log.inputTokens).toBe(1000);
      expect(log.outputTokens).toBe(500);
      expect(log.totalTokens).toBe(1500);
    });

    it('should calculate cost correctly for GPT-4o', async () => {
      const input: LogUsageInput = {
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      };

      const log = await tracker.logUsage(input);

      // Cost: (1000/1000 * 0.005) + (500/1000 * 0.015) = 0.005 + 0.0075 = 0.0125
      expect(log.cost).toBeCloseTo(0.0125, 6);
      expect(log.inputTokens).toBe(1000);
      expect(log.outputTokens).toBe(500);
      expect(log.totalTokens).toBe(1500);
    });

    it('should calculate cost correctly for Claude Sonnet', async () => {
      const input: LogUsageInput = {
        providerId: 'anthropic',
        model: 'claude-sonnet-4-5',
        inputTokens: 2000,
        outputTokens: 1000,
      };

      const log = await tracker.logUsage(input);

      // Cost: (2000/1000 * 0.003) + (1000/1000 * 0.015) = 0.006 + 0.015 = 0.021
      expect(log.cost).toBeCloseTo(0.021, 6);
    });

    it('should use provided cost instead of calculating', async () => {
      const input: LogUsageInput = {
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.05, // Override calculated cost
      };

      const log = await tracker.logUsage(input);

      expect(log.cost).toBe(0.05);
    });

    it('should log usage with request ID', async () => {
      const input: LogUsageInput = {
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 500,
        outputTokens: 250,
        requestId: 'req-123-abc',
      };

      const log = await tracker.logUsage(input);

      expect(log.requestId).toBe('req-123-abc');
    });

    it('should log usage with metadata', async () => {
      const input: LogUsageInput = {
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 500,
        outputTokens: 250,
        metadata: {
          user: 'john',
          app: 'unify-ai',
          cached: true,
        },
      };

      const log = await tracker.logUsage(input);

      expect(log.metadata).toEqual({
        user: 'john',
        app: 'unify-ai',
        cached: true,
      });
    });

    it('should handle zero tokens', async () => {
      const input: LogUsageInput = {
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 0,
        outputTokens: 0,
      };

      const log = await tracker.logUsage(input);

      expect(log.cost).toBe(0);
      expect(log.totalTokens).toBe(0);
    });

    it('should calculate cost as 0 when model not found', async () => {
      const input: LogUsageInput = {
        providerId: 'unknown',
        model: 'unknown-model',
        inputTokens: 1000,
        outputTokens: 500,
      };

      // Need to create the 'unknown' provider first due to FK constraint
      await db.run(
        `INSERT INTO providers (id, name, type, enabled, priority)
         VALUES ('unknown', 'Unknown', 'custom', 1, 0)`
      );

      const log = await tracker.logUsage(input);

      expect(log.cost).toBe(0);
    });

    it('should handle large token counts', async () => {
      const input: LogUsageInput = {
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000000,
        outputTokens: 500000,
      };

      const log = await tracker.logUsage(input);

      // Cost: (1000000/1000 * 0.005) + (500000/1000 * 0.015) = 5 + 7.5 = 12.5
      expect(log.cost).toBeCloseTo(12.5, 6);
      expect(log.totalTokens).toBe(1500000);
    });
  });

  describe('getLogs()', () => {
    beforeEach(async () => {
      // Insert test data
      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
        requestId: 'req-1',
      });

      await tracker.logUsage({
        providerId: 'anthropic',
        model: 'claude-sonnet-4-5',
        inputTokens: 2000,
        outputTokens: 1000,
        requestId: 'req-2',
      });

      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 500,
        outputTokens: 250,
        requestId: 'req-3',
      });
    });

    it('should get all logs without filters', async () => {
      const logs = await tracker.getLogs({});

      expect(logs).toHaveLength(3);
    });

    it('should filter by provider', async () => {
      const logs = await tracker.getLogs({ providerId: 'openai' });

      expect(logs).toHaveLength(2);
      logs.forEach(log => {
        expect(log.providerId).toBe('openai');
      });
    });

    it('should filter by model', async () => {
      const logs = await tracker.getLogs({ model: 'gpt-4o' });

      expect(logs).toHaveLength(2);
      logs.forEach(log => {
        expect(log.model).toBe('gpt-4o');
      });
    });

    it('should filter by provider and model', async () => {
      const logs = await tracker.getLogs({
        providerId: 'anthropic',
        model: 'claude-sonnet-4-5',
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].providerId).toBe('anthropic');
      expect(logs[0].model).toBe('claude-sonnet-4-5');
    });

    it('should limit results', async () => {
      const logs = await tracker.getLogs({ limit: 2 });

      expect(logs).toHaveLength(2);
    });

    it('should filter by start date', async () => {
      // Get logs from 1 hour ago
      const startDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const logs = await tracker.getLogs({ startDate });

      expect(logs.length).toBeGreaterThan(0);
    });

    it('should filter by end date', async () => {
      // Get logs up to 1 hour in the future
      const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const logs = await tracker.getLogs({ endDate });

      expect(logs.length).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const logs = await tracker.getLogs({ startDate, endDate });

      expect(logs.length).toBeGreaterThan(0);
    });

    it('should return logs in descending order by timestamp', async () => {
      const logs = await tracker.getLogs({});

      for (let i = 1; i < logs.length; i++) {
        const prevTime = new Date(logs[i - 1].timestamp).getTime();
        const currTime = new Date(logs[i].timestamp).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });

    it('should return empty array when no logs match filters', async () => {
      const logs = await tracker.getLogs({ providerId: 'nonexistent' });

      expect(logs).toEqual([]);
    });
  });

  describe('getSummary()', () => {
    beforeEach(async () => {
      // Insert comprehensive test data
      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 2000,
        outputTokens: 1000,
      });

      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 500,
        outputTokens: 250,
      });

      await tracker.logUsage({
        providerId: 'anthropic',
        model: 'claude-sonnet-4-5',
        inputTokens: 2000,
        outputTokens: 1000,
      });
    });

    it('should get summary for all providers', async () => {
      const summary = await tracker.getSummary({});

      expect(summary.totalRequests).toBe(4);
      expect(summary.totalInputTokens).toBe(5500);
      expect(summary.totalOutputTokens).toBe(2750);
      // Cost: gpt-4o (0.04375) + claude-sonnet (0.021) = 0.06475
      expect(summary.totalCost).toBeCloseTo(0.06475, 6);
      expect(summary.byModel.size).toBe(2);
    });

    it('should get summary for specific provider', async () => {
      const summary = await tracker.getSummary({ providerId: 'openai' });

      expect(summary.totalRequests).toBe(3);
      expect(summary.providerId).toBe('openai');
      expect(summary.totalInputTokens).toBe(3500);
      expect(summary.totalOutputTokens).toBe(1750);
      // Cost: 3 uses of gpt-4o = 0.0125 + 0.025 + 0.00625 = 0.04375
      expect(summary.totalCost).toBeCloseTo(0.04375, 6);
    });

    it('should aggregate by model correctly', async () => {
      const summary = await tracker.getSummary({ providerId: 'openai' });

      const gpt4oUsage = summary.byModel.get('gpt-4o');
      expect(gpt4oUsage).toBeDefined();
      expect(gpt4oUsage!.requests).toBe(3);
      expect(gpt4oUsage!.inputTokens).toBe(3500);
      expect(gpt4oUsage!.outputTokens).toBe(1750);
      expect(gpt4oUsage!.cost).toBeCloseTo(0.04375, 6);
    });

    it('should return zero values when no logs exist', async () => {
      const summary = await tracker.getSummary({ providerId: 'nonexistent' });

      expect(summary.totalRequests).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.byModel.size).toBe(0);
    });

    it('should include time period in summary', async () => {
      const summary = await tracker.getSummary({});

      expect(summary.period.start).toBeDefined();
      expect(summary.period.end).toBeDefined();
      expect(new Date(summary.period.start).getTime()).toBeLessThanOrEqual(
        new Date(summary.period.end).getTime()
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const summary = await tracker.getSummary({ startDate, endDate });

      expect(summary.totalRequests).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent logUsage calls', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        tracker.logUsage({
          providerId: 'openai',
          model: 'gpt-4o',
          inputTokens: 100 * (i + 1),
          outputTokens: 50 * (i + 1),
        })
      );

      const logs = await Promise.all(promises);

      expect(logs).toHaveLength(10);
      logs.forEach(log => {
        expect(log.id).toBeDefined();
        expect(log.id).toBeGreaterThan(0);
      });

      const allLogs = await tracker.getLogs({});
      expect(allLogs).toHaveLength(10);
    });

    it('should handle missing model pricing gracefully', async () => {
      // Need to create the 'unknown' provider first due to FK constraint
      await db.run(
        `INSERT INTO providers (id, name, type, enabled, priority)
         VALUES ('unknown', 'Unknown', 'custom', 1, 0)`
      );

      const input: LogUsageInput = {
        providerId: 'unknown',
        model: 'unknown-model',
        inputTokens: 1000,
        outputTokens: 500,
      };

      const log = await tracker.logUsage(input);
      expect(log).toBeDefined();
      expect(log.cost).toBe(0);
    });

    it('should handle very small token counts', async () => {
      const input: LogUsageInput = {
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1,
        outputTokens: 1,
      };

      const log = await tracker.logUsage(input);

      expect(log.cost).toBeGreaterThan(0);
      expect(log.totalTokens).toBe(2);
    });
  });
});
