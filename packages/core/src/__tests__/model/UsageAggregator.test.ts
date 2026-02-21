/**
 * Tests for UsageAggregator
 *
 * Tests daily and weekly usage aggregation, scheduling, and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UsageAggregator } from '../../model/UsageAggregator';
import { ModelDatabase } from '../../model/Database';
import { UsageTracker } from '../../model/UsageTracker';
import type { LogUsageInput, DailyUsageSummary, WeeklyUsageSummary } from '../../model/types';

describe('UsageAggregator', () => {
  let db: ModelDatabase;
  let tracker: UsageTracker;
  let aggregator: UsageAggregator;

  beforeEach(async () => {
    // Use in-memory database for testing
    db = new ModelDatabase(':memory:');
    await db.initialize();
    tracker = new UsageTracker(db);
    aggregator = new UsageAggregator(db, {
      maxRetries: 3,
      retryDelayMs: 100,
    });

    // Insert test providers and model configs
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
    aggregator.stopScheduler();
    await db.close();
  });

  // ============================================
  // Daily Aggregation Tests
  // ============================================

  describe('aggregateDaily()', () => {
    it('should aggregate daily usage for a specific date', async () => {
      // Insert usage logs for today
      const today = new Date().toISOString().split('T')[0];

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
        providerId: 'anthropic',
        model: 'claude-sonnet-4-5',
        inputTokens: 1500,
        outputTokens: 750,
      });

      // Run aggregation
      const result = await aggregator.aggregateDaily(today);

      expect(result.success).toBe(true);
      expect(result.type).toBe('daily');
      expect(result.date).toBe(today);
      expect(result.recordsProcessed).toBe(2); // 2 models

      // Verify daily summaries
      const summaries = await aggregator.getDailySummaries(today, today);
      expect(summaries).toHaveLength(2);

      const openaiSummary = summaries.find((s) => s.providerId === 'openai');
      expect(openaiSummary).toBeDefined();
      expect(openaiSummary!.totalRequests).toBe(2);
      expect(openaiSummary!.inputTokens).toBe(3000);
      expect(openaiSummary!.outputTokens).toBe(1500);
      expect(openaiSummary!.totalTokens).toBe(4500);
    });

    it('should update existing daily summary on re-aggregation', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Insert and aggregate
      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await aggregator.aggregateDaily(today);

      // Add more usage and re-aggregate
      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 500,
        outputTokens: 250,
      });

      const result = await aggregator.aggregateDaily(today);

      expect(result.success).toBe(true);

      const summaries = await aggregator.getDailySummaries(today, today);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].totalRequests).toBe(2);
      expect(summaries[0].inputTokens).toBe(1500);
      expect(summaries[0].outputTokens).toBe(750);
    });

    it('should handle empty days gracefully', async () => {
      const emptyDate = '2020-01-01';

      const result = await aggregator.aggregateDaily(emptyDate);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(0);

      const summaries = await aggregator.getDailySummaries(emptyDate, emptyDate);
      expect(summaries).toHaveLength(0);
    });

    it('should create aggregation log entries', async () => {
      const today = new Date().toISOString().split('T')[0];

      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await aggregator.aggregateDaily(today);

      const pendingLogs = await aggregator.getPendingAggregations('daily');
      expect(pendingLogs).toHaveLength(0); // Should be completed, not pending

      // Check log exists and is completed
      const logs = await db.all<{ status: string }>(
        "SELECT status FROM aggregation_log WHERE aggregation_type = 'daily' AND aggregation_date = ?",
        [today]
      );
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('completed');
    });
  });

  // ============================================
  // Weekly Aggregation Tests
  // ============================================

  describe('aggregateWeekly()', () => {
    it('should aggregate weekly usage for a specific week', async () => {
      // Get current week
      const now = new Date();
      const jan4 = new Date(now.getFullYear(), 0, 4);
      const dayOfWeek = jan4.getDay();
      const mondayOfWeek1 = new Date(jan4);
      mondayOfWeek1.setDate(jan4.getDate() - ((dayOfWeek + 6) % 7));
      const currentMonday = new Date(mondayOfWeek1);
      currentMonday.setDate(mondayOfWeek1.getDate() + Math.floor((now.getDate() - mondayOfWeek1.getDate()) / 7) * 7);

      // Get ISO week
      const tempDate = new Date(now.valueOf());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      const weekNumber = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
      const year = tempDate.getFullYear();

      // Insert usage logs
      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 2000,
        outputTokens: 1000,
      });

      await tracker.logUsage({
        providerId: 'anthropic',
        model: 'claude-sonnet-4-5',
        inputTokens: 3000,
        outputTokens: 1500,
      });

      // Run aggregation
      const result = await aggregator.aggregateWeekly(year, weekNumber);

      expect(result.success).toBe(true);
      expect(result.type).toBe('weekly');
      expect(result.recordsProcessed).toBe(2);

      // Verify weekly summaries
      const summaries = await aggregator.getWeeklySummaries(year, 1, 53);
      expect(summaries.length).toBeGreaterThan(0);

      const openaiSummary = summaries.find((s) => s.providerId === 'openai' && s.week === weekNumber);
      expect(openaiSummary).toBeDefined();
      expect(openaiSummary!.totalRequests).toBe(1);
      expect(openaiSummary!.inputTokens).toBe(2000);
    });

    it('should handle weeks with no usage', async () => {
      const result = await aggregator.aggregateWeekly(2020, 1);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(0);

      const summaries = await aggregator.getWeeklySummaries(2020, 1, 1);
      expect(summaries).toHaveLength(0);
    });
  });

  // ============================================
  // Query Tests
  // ============================================

  describe('getDailySummaries()', () => {
    it('should return summaries for date range', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = today.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Insert usage for both days
      // Note: We can't easily control timestamps, so we'll just check the structure
      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await aggregator.aggregateDaily(todayStr);

      const summaries = await aggregator.getDailySummaries(
        yesterdayStr,
        todayStr
      );

      expect(summaries.length).toBeGreaterThanOrEqual(1);
      summaries.forEach((s) => {
        expect(s.date >= yesterdayStr).toBe(true);
        expect(s.date <= todayStr).toBe(true);
      });
    });

    it('should filter by provider', async () => {
      const today = new Date().toISOString().split('T')[0];

      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await tracker.logUsage({
        providerId: 'anthropic',
        model: 'claude-sonnet-4-5',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await aggregator.aggregateDaily(today);

      const summaries = await aggregator.getDailySummaries(today, today, 'openai');

      expect(summaries).toHaveLength(1);
      expect(summaries[0].providerId).toBe('openai');
    });
  });

  describe('getWeeklySummaries()', () => {
    it('should return summaries for week range', async () => {
      const now = new Date();
      const tempDate = new Date(now.valueOf());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      const weekNumber = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
      const year = tempDate.getFullYear();

      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });

      await aggregator.aggregateWeekly(year, weekNumber);

      const summaries = await aggregator.getWeeklySummaries(year, 1, 53);

      expect(summaries.length).toBeGreaterThan(0);
      summaries.forEach((s) => {
        expect(s.year).toBe(year);
        expect(s.week).toBeGreaterThanOrEqual(1);
        expect(s.week).toBeLessThanOrEqual(53);
      });
    });
  });

  // ============================================
  // Scheduler Tests
  // ============================================

  describe('Scheduler', () => {
    it('should start and stop scheduler', () => {
      expect(aggregator.isSchedulerRunning()).toBe(false);

      aggregator.startScheduler();
      expect(aggregator.isSchedulerRunning()).toBe(true);

      aggregator.stopScheduler();
      expect(aggregator.isSchedulerRunning()).toBe(false);
    });

    it('should not start duplicate schedulers', () => {
      aggregator.startScheduler();
      aggregator.startScheduler(); // Should be no-op

      expect(aggregator.isSchedulerRunning()).toBe(true);

      aggregator.stopScheduler();
    });
  });

  // ============================================
  // Retry Tests
  // ============================================

  describe('Retry Logic', () => {
    it('should track failed aggregations', async () => {
      const today = new Date().toISOString().split('T')[0];

      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // This should succeed
      await aggregator.aggregateDaily(today);

      const pending = await aggregator.getPendingAggregations('daily');
      expect(pending).toHaveLength(0);
    });

    it('should retry failed aggregations', async () => {
      // Manually insert a failed aggregation log
      await db.run(
        `INSERT INTO aggregation_log (aggregation_type, aggregation_date, status, retry_count)
         VALUES ('daily', '2024-01-01', 'failed', 0)`
      );

      // Insert usage for that date
      await db.run(
        `INSERT INTO usage_logs (provider_id, model, timestamp, input_tokens, output_tokens, total_tokens, cost)
         VALUES ('openai', 'gpt-4o', '2024-01-01T12:00:00Z', 1000, 500, 1500, 0.0125)`
      );

      const results = await aggregator.retryFailedAggregations();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].date).toBe('2024-01-01');
    });
  });

  // ============================================
  // Performance Tests
  // ============================================

  describe('Performance', () => {
    it('should aggregate 1000 usage logs quickly', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Insert 1000 usage logs
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(
          tracker.logUsage({
            providerId: i % 2 === 0 ? 'openai' : 'anthropic',
            model: i % 2 === 0 ? 'gpt-4o' : 'claude-sonnet-4-5',
            inputTokens: 100 + i,
            outputTokens: 50 + i,
          })
        );
      }
      await Promise.all(promises);

      // Measure aggregation time
      const start = performance.now();
      const result = await aggregator.aggregateDaily(today);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(50); // Should complete in < 50ms
    });

    it('should query daily summaries quickly', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Insert and aggregate data
      for (let i = 0; i < 100; i++) {
        await tracker.logUsage({
          providerId: i % 2 === 0 ? 'openai' : 'anthropic',
          model: i % 2 === 0 ? 'gpt-4o' : 'claude-sonnet-4-5',
          inputTokens: 100,
          outputTokens: 50,
        });
      }
      await aggregator.aggregateDaily(today);

      // Measure query time
      const start = performance.now();
      const summaries = await aggregator.getDailySummaries(today, today);
      const duration = performance.now() - start;

      expect(summaries).toHaveLength(2);
      expect(duration).toBeLessThan(50); // Should complete in < 50ms
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle concurrent aggregation requests', async () => {
      const today = new Date().toISOString().split('T')[0];

      await tracker.logUsage({
        providerId: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // Run multiple aggregations concurrently
      const results = await Promise.all([
        aggregator.aggregateDaily(today),
        aggregator.aggregateDaily(today),
        aggregator.aggregateDaily(today),
      ]);

      // All should succeed (idempotent)
      results.forEach((r) => {
        expect(r.success).toBe(true);
      });

      // Should still have only one summary per model
      const summaries = await aggregator.getDailySummaries(today, today);
      expect(summaries).toHaveLength(1);
    });

    it('should handle year boundary correctly for weekly aggregation', async () => {
      // Test week 1 of a year (may belong to previous year's last week)
      const result = await aggregator.aggregateWeekly(2024, 1);

      expect(result.success).toBe(true);
      expect(result.type).toBe('weekly');
    });

    it('should handle week 53 correctly', async () => {
      // Some years have week 53
      const result = await aggregator.aggregateWeekly(2026, 53);

      expect(result.success).toBe(true);
    });
  });
});
