import type {
  LogUsageInput,
  UsageLog,
  UsageSummary,
  UsageLogFilters,
  ModelUsageSummary
} from './types';
import type { ModelDatabase } from './Database';

/**
 * Database row format (snake_case)
 */
interface UsageLogRow {
  id: number;
  provider_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  request_id: string | null;
  metadata: string | null;
  timestamp: string;
}

/**
 * Convert database row to UsageLog type
 */
function rowToUsageLog(row: UsageLogRow): UsageLog {
  return {
    id: row.id,
    providerId: row.provider_id,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    cost: row.cost,
    requestId: row.request_id ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    timestamp: row.timestamp,
  };
}

/**
 * UsageTracker - Track and analyze API usage and costs
 *
 * Provides methods for logging API usage, querying usage history,
 * and generating usage summary statistics with cost calculations.
 */
export class UsageTracker {
  constructor(private db: ModelDatabase) {}

  /**
   * Log a usage entry
   * @param input - Usage log input data
   * @returns Created usage log entry
   */
  async logUsage(input: LogUsageInput): Promise<UsageLog> {
    const { providerId, model, inputTokens, outputTokens, cost, requestId, metadata } = input;

    // Calculate total tokens
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost if not provided
    const calculatedCost = cost ?? await this.calculateCost(providerId, model, inputTokens, outputTokens);

    // Insert into database with ISO timestamp
    const timestamp = new Date().toISOString();
    const result = await this.db.get<{ id: number }>(
      `INSERT INTO usage_logs (provider_id, model, input_tokens, output_tokens, total_tokens, cost, request_id, metadata, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        providerId,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        calculatedCost,
        requestId ?? null,
        metadata ? JSON.stringify(metadata) : null,
        timestamp
      ]
    );

    if (!result) {
      throw new Error('Failed to insert usage log');
    }

    // Return the created log entry
    const row = await this.db.get<UsageLogRow>(
      'SELECT * FROM usage_logs WHERE id = ?',
      [result.id]
    );

    if (!row) {
      throw new Error('Failed to retrieve created usage log');
    }

    return rowToUsageLog(row);
  }

  /**
   * Get usage logs with optional filters
   * @param filters - Query filters
   * @returns Array of usage logs
   */
  async getLogs(filters?: UsageLogFilters): Promise<UsageLog[]> {
    let sql = 'SELECT * FROM usage_logs WHERE 1=1';
    const params: any[] = [];

    // Apply filters
    if (filters?.providerId) {
      sql += ' AND provider_id = ?';
      params.push(filters.providerId);
    }

    if (filters?.model) {
      sql += ' AND model = ?';
      params.push(filters.model);
    }

    if (filters?.startDate) {
      sql += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      sql += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    // Order by timestamp descending
    sql += ' ORDER BY timestamp DESC';

    // Apply limit
    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = await this.db.all<UsageLogRow>(sql, params);

    // Convert to UsageLog format
    return rows.map(rowToUsageLog);
  }

  /**
   * Get usage summary statistics
   * @param filters - Query filters
   * @returns Usage summary with aggregated statistics
   */
  async getSummary(filters?: UsageLogFilters): Promise<UsageSummary> {
    const logs = await this.getLogs(filters);

    // Calculate aggregate statistics
    const totalRequests = logs.length;
    const totalInputTokens = logs.reduce((sum, log) => sum + log.inputTokens, 0);
    const totalOutputTokens = logs.reduce((sum, log) => sum + log.outputTokens, 0);
    const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);

    // Calculate breakdown by model
    const byModelMap = new Map<string, ModelUsageSummary>();
    for (const log of logs) {
      const existing = byModelMap.get(log.model);
      if (existing) {
        existing.requests += 1;
        existing.inputTokens += log.inputTokens;
        existing.outputTokens += log.outputTokens;
        existing.cost += log.cost;
      } else {
        byModelMap.set(log.model, {
          model: log.model,
          requests: 1,
          inputTokens: log.inputTokens,
          outputTokens: log.outputTokens,
          cost: log.cost
        });
      }
    }

    // Determine time period
    const timestamps = logs.map(log => log.timestamp).sort();
    const period = {
      start: timestamps[0] ?? new Date().toISOString(),
      end: timestamps[timestamps.length - 1] ?? new Date().toISOString()
    };

    return {
      providerId: filters?.providerId,
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      byModel: byModelMap,
      period
    };
  }

  /**
   * Calculate cost for a usage entry based on model pricing
   * @param providerId - Provider ID
   * @param model - Model ID
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @returns Cost in USD
   */
  private async calculateCost(
    providerId: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<number> {
    // Look up model pricing from model_configs table
    const config = await this.db.get<{
      pricing_input: number;
      pricing_output: number;
    }>(
      'SELECT pricing_input, pricing_output FROM model_configs WHERE provider_id = ? AND model_id = ?',
      [providerId, model]
    );

    // If no pricing found, return 0
    if (!config) {
      console.warn(`No pricing found for provider ${providerId}, model ${model}`);
      return 0;
    }

    // Calculate cost: (inputTokens * inputPrice/1K) + (outputTokens * outputPrice/1K)
    const inputCost = (inputTokens / 1000) * config.pricing_input;
    const outputCost = (outputTokens / 1000) * config.pricing_output;

    return inputCost + outputCost;
  }
}
