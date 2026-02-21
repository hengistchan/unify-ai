/**
 * UsageAggregator - Aggregates usage logs into daily and weekly summaries
 *
 * Provides efficient querying of usage statistics by pre-aggregating
 * usage data into summary tables. Supports background aggregation with
 * automatic retry on failure.
 */

import type { ModelDatabase } from './Database';
import type {
  DailyUsageSummary,
  WeeklyUsageSummary,
  AggregationLog,
  AggregationType,
  AggregationOptions,
  AggregationResult,
  ISOWeek,
} from './types';

/**
 * Database row format for daily summary (snake_case)
 */
interface DailySummaryRow {
  id: number;
  provider_id: string;
  model: string;
  date: string;
  total_requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

/**
 * Database row format for weekly summary (snake_case)
 */
interface WeeklySummaryRow {
  id: number;
  provider_id: string;
  model: string;
  year: number;
  week: number;
  total_requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

/**
 * Database row format for aggregation log (snake_case)
 */
interface AggregationLogRow {
  id: number;
  aggregation_type: string;
  aggregation_date: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

/**
 * Convert daily summary row to DailyUsageSummary type
 */
function rowToDailySummary(row: DailySummaryRow): DailyUsageSummary {
  return {
    id: row.id,
    providerId: row.provider_id,
    model: row.model,
    date: row.date,
    totalRequests: row.total_requests,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    totalCost: row.total_cost,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert weekly summary row to WeeklyUsageSummary type
 */
function rowToWeeklySummary(row: WeeklySummaryRow): WeeklyUsageSummary {
  return {
    id: row.id,
    providerId: row.provider_id,
    model: row.model,
    year: row.year,
    week: row.week,
    totalRequests: row.total_requests,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    totalCost: row.total_cost,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert aggregation log row to AggregationLog type
 */
function rowToAggregationLog(row: AggregationLogRow): AggregationLog {
  return {
    id: row.id,
    aggregationType: row.aggregation_type as AggregationType,
    aggregationDate: row.aggregation_date,
    status: row.status as AggregationLog['status'],
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
    retryCount: row.retry_count,
    createdAt: row.created_at,
  };
}

/**
 * UsageAggregator - Manages usage data aggregation
 */
export class UsageAggregator {
  private schedulerTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly options: Required<AggregationOptions>;

  /**
   * Create a new UsageAggregator instance
   * @param db - ModelDatabase instance
   * @param options - Aggregation options
   */
  constructor(
    private db: ModelDatabase,
    options?: AggregationOptions
  ) {
    this.options = {
      maxRetries: options?.maxRetries ?? 3,
      retryDelayMs: options?.retryDelayMs ?? 5000,
      runInBackground: options?.runInBackground ?? true,
      timezone: options?.timezone ?? 'UTC',
    };
  }

  // ============================================
  // Aggregation Methods
  // ============================================

  /**
   * Aggregate usage logs for a specific date
   * @param date - ISO date string (YYYY-MM-DD)
   * @returns Aggregation result
   */
  async aggregateDaily(date: string): Promise<AggregationResult> {
    const logId = await this.startAggregationLog('daily', date);

    try {
      // Get all usage logs for the date
      const rows = await this.db.all<{
        provider_id: string;
        model: string;
        total_requests: number;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        total_cost: number;
      }>(
        `SELECT
          provider_id,
          model,
          COUNT(*) as total_requests,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(total_tokens) as total_tokens,
          SUM(cost) as total_cost
        FROM usage_logs
        WHERE DATE(timestamp) = DATE(?)
        GROUP BY provider_id, model`,
        [date]
      );

      // Insert or update daily summaries
      for (const row of rows) {
        await this.db.run(
          `INSERT INTO daily_usage_summary
            (provider_id, model, date, total_requests, input_tokens, output_tokens, total_tokens, total_cost, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(provider_id, model, date) DO UPDATE SET
            total_requests = excluded.total_requests,
            input_tokens = excluded.input_tokens,
            output_tokens = excluded.output_tokens,
            total_tokens = excluded.total_tokens,
            total_cost = excluded.total_cost,
            updated_at = CURRENT_TIMESTAMP`,
          [
            row.provider_id,
            row.model,
            date,
            row.total_requests,
            row.input_tokens,
            row.output_tokens,
            row.total_tokens,
            row.total_cost,
          ]
        );
      }

      await this.completeAggregationLog(logId);
      return {
        type: 'daily',
        date,
        recordsProcessed: rows.length,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.failAggregationLog(logId, errorMessage);
      return {
        type: 'daily',
        date,
        recordsProcessed: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Aggregate usage logs for a specific ISO week
   * @param year - ISO year
   * @param week - ISO week number (1-53)
   * @returns Aggregation result
   */
  async aggregateWeekly(year: number, week: number): Promise<AggregationResult> {
    const dateKey = `${year}-W${week.toString().padStart(2, '0')}`;
    const logId = await this.startAggregationLog('weekly', dateKey);

    try {
      // Calculate week start and end dates
      const { start, end } = this.getISOWeekRange(year, week);

      // Get all usage logs for the week
      const rows = await this.db.all<{
        provider_id: string;
        model: string;
        total_requests: number;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        total_cost: number;
      }>(
        `SELECT
          provider_id,
          model,
          COUNT(*) as total_requests,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(total_tokens) as total_tokens,
          SUM(cost) as total_cost
        FROM usage_logs
        WHERE DATE(timestamp) >= DATE(?) AND DATE(timestamp) <= DATE(?)
        GROUP BY provider_id, model`,
        [start, end]
      );

      // Insert or update weekly summaries
      for (const row of rows) {
        await this.db.run(
          `INSERT INTO weekly_usage_summary
            (provider_id, model, year, week, total_requests, input_tokens, output_tokens, total_tokens, total_cost, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(provider_id, model, year, week) DO UPDATE SET
            total_requests = excluded.total_requests,
            input_tokens = excluded.input_tokens,
            output_tokens = excluded.output_tokens,
            total_tokens = excluded.total_tokens,
            total_cost = excluded.total_cost,
            updated_at = CURRENT_TIMESTAMP`,
          [
            row.provider_id,
            row.model,
            year,
            week,
            row.total_requests,
            row.input_tokens,
            row.output_tokens,
            row.total_tokens,
            row.total_cost,
          ]
        );
      }

      await this.completeAggregationLog(logId);
      return {
        type: 'weekly',
        date: dateKey,
        recordsProcessed: rows.length,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.failAggregationLog(logId, errorMessage);
      return {
        type: 'weekly',
        date: dateKey,
        recordsProcessed: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Run aggregation for previous day (typically called by scheduler)
   * @returns Aggregation result
   */
  async aggregatePreviousDay(): Promise<AggregationResult> {
    const yesterday = this.formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return this.aggregateWithRetry('daily', yesterday);
  }

  /**
   * Run aggregation for previous week (typically called by scheduler)
   * @returns Aggregation result
   */
  async aggregatePreviousWeek(): Promise<AggregationResult> {
    const lastWeek = this.getISOWeek(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    return this.aggregateWithRetry('weekly', `${lastWeek.year}-W${lastWeek.week.toString().padStart(2, '0')}`);
  }

  /**
   * Aggregate with retry logic
   */
  private async aggregateWithRetry(
    type: AggregationType,
    dateKey: string
  ): Promise<AggregationResult> {
    let lastResult: AggregationResult | null = null;

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      if (type === 'daily') {
        lastResult = await this.aggregateDaily(dateKey);
      } else {
        const match = dateKey.match(/^(\d{4})-W(\d{2})$/);
        if (match) {
          lastResult = await this.aggregateWeekly(parseInt(match[1]), parseInt(match[2]));
        } else {
          return {
            type,
            date: dateKey,
            recordsProcessed: 0,
            success: false,
            error: 'Invalid week format',
          };
        }
      }

      if (lastResult.success) {
        return lastResult;
      }

      // Wait before retry
      if (attempt < this.options.maxRetries - 1) {
        await this.sleep(this.options.retryDelayMs);
      }
    }

    return lastResult!;
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get daily usage summary for a date range
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @param providerId - Optional provider filter
   * @returns Array of daily summaries
   */
  async getDailySummaries(
    startDate: string,
    endDate: string,
    providerId?: string
  ): Promise<DailyUsageSummary[]> {
    let sql = 'SELECT * FROM daily_usage_summary WHERE date >= ? AND date <= ?';
    const params: string[] = [startDate, endDate];

    if (providerId) {
      sql += ' AND provider_id = ?';
      params.push(providerId);
    }

    sql += ' ORDER BY date DESC, total_cost DESC';

    const rows = await this.db.all<DailySummaryRow>(sql, params);
    return rows.map(rowToDailySummary);
  }

  /**
   * Get weekly usage summary for a year/week range
   * @param year - Year
   * @param startWeek - Start week number
   * @param endWeek - End week number
   * @param providerId - Optional provider filter
   * @returns Array of weekly summaries
   */
  async getWeeklySummaries(
    year: number,
    startWeek: number,
    endWeek: number,
    providerId?: string
  ): Promise<WeeklyUsageSummary[]> {
    let sql = 'SELECT * FROM weekly_usage_summary WHERE year = ? AND week >= ? AND week <= ?';
    const params: (number | string)[] = [year, startWeek, endWeek];

    if (providerId) {
      sql += ' AND provider_id = ?';
      params.push(providerId);
    }

    sql += ' ORDER BY week DESC, total_cost DESC';

    const rows = await this.db.all<WeeklySummaryRow>(sql, params);
    return rows.map(rowToWeeklySummary);
  }

  /**
   * Get pending aggregation logs for retry
   * @param type - Aggregation type
   * @returns Array of pending logs
   */
  async getPendingAggregations(type?: AggregationType): Promise<AggregationLog[]> {
    let sql = "SELECT * FROM aggregation_log WHERE status = 'failed' AND retry_count < ?";
    const params: (number | string)[] = [this.options.maxRetries];

    if (type) {
      sql += ' AND aggregation_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at ASC';

    const rows = await this.db.all<AggregationLogRow>(sql, params);
    return rows.map(rowToAggregationLog);
  }

  // ============================================
  // Scheduling Methods
  // ============================================

  /**
   * Start automatic aggregation scheduler
   * Runs daily aggregation every day at 00:05 UTC
   * Runs weekly aggregation every Monday at 00:10 UTC
   */
  startScheduler(): void {
    if (this.schedulerTimer) {
      return; // Already running
    }

    // Check every minute for scheduled tasks
    this.schedulerTimer = setInterval(() => {
      this.checkAndRunScheduledTasks();
    }, 60 * 1000);

    // Run initial check
    this.checkAndRunScheduledTasks();
  }

  /**
   * Stop the automatic aggregation scheduler
   */
  stopScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * Check and run scheduled aggregation tasks
   */
  private async checkAndRunScheduledTasks(): Promise<void> {
    if (this.isRunning) {
      return; // Already running aggregation
    }

    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday

    // Daily aggregation at 00:05 UTC
    if (hour === 0 && minute === 5) {
      this.isRunning = true;
      try {
        await this.aggregatePreviousDay();
      } finally {
        this.isRunning = false;
      }
    }

    // Weekly aggregation on Monday at 00:10 UTC
    if (dayOfWeek === 1 && hour === 0 && minute === 10) {
      this.isRunning = true;
      try {
        await this.aggregatePreviousWeek();
      } finally {
        this.isRunning = false;
      }
    }

    // Retry failed aggregations at 00:15 UTC
    if (hour === 0 && minute === 15) {
      this.isRunning = true;
      try {
        await this.retryFailedAggregations();
      } finally {
        this.isRunning = false;
      }
    }
  }

  /**
   * Retry all failed aggregations
   */
  async retryFailedAggregations(): Promise<AggregationResult[]> {
    const failedLogs = await this.getPendingAggregations();
    const results: AggregationResult[] = [];

    for (const log of failedLogs) {
      // Increment retry count
      await this.db.run(
        'UPDATE aggregation_log SET retry_count = retry_count + 1 WHERE id = ?',
        [log.id]
      );

      let result: AggregationResult;
      if (log.aggregationType === 'daily') {
        result = await this.aggregateDaily(log.aggregationDate);
      } else {
        const match = log.aggregationDate.match(/^(\d{4})-W(\d{2})$/);
        if (match) {
          result = await this.aggregateWeekly(parseInt(match[1]), parseInt(match[2]));
        } else {
          continue;
        }
      }
      results.push(result);
    }

    return results;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Start an aggregation log entry
   */
  private async startAggregationLog(
    type: AggregationType,
    date: string
  ): Promise<number> {
    const result = await this.db.get<{ id: number }>(
      `INSERT INTO aggregation_log (aggregation_type, aggregation_date, status, started_at)
       VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
       RETURNING id`,
      [type, date]
    );
    return result!.id;
  }

  /**
   * Mark aggregation log as completed
   */
  private async completeAggregationLog(id: number): Promise<void> {
    await this.db.run(
      `UPDATE aggregation_log
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );
  }

  /**
   * Mark aggregation log as failed
   */
  private async failAggregationLog(id: number, errorMessage: string): Promise<void> {
    await this.db.run(
      `UPDATE aggregation_log
       SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [errorMessage, id]
    );
  }

  /**
   * Get ISO week number for a date
   */
  private getISOWeek(date: Date): ISOWeek {
    const tempDate = new Date(date.valueOf());
    tempDate.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    // January 4 is always in week 1
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1
    const weekNumber =
      1 +
      Math.round(
        ((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
      );
    return {
      year: tempDate.getFullYear(),
      week: weekNumber,
    };
  }

  /**
   * Get start and end dates for an ISO week
   */
  private getISOWeekRange(year: number, week: number): { start: string; end: string } {
    // January 4th is always in week 1
    const jan4 = new Date(year, 0, 4);
    // Get Monday of week 1
    const dayOfWeek = jan4.getDay(); // 0 = Sunday
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - ((dayOfWeek + 6) % 7));

    // Add (week - 1) weeks to get to target week
    const weekStart = new Date(mondayOfWeek1);
    weekStart.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);

    // Week ends on Sunday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return {
      start: this.formatDate(weekStart),
      end: this.formatDate(weekEnd),
    };
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.schedulerTimer !== null;
  }
}
