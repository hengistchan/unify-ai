/**
 * Usage Dashboard Component
 * Displays usage statistics and charts
 */

import { useEffect } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { Card } from '../common';
import { DollarSign, Zap, Activity } from 'lucide-react';

export function UsageDashboard() {
  const { usageSummary, loadUsageSummary, loading } = useModelStore();

  useEffect(() => {
    loadUsageSummary();
  }, [loadUsageSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-secondary">
        Loading usage data...
      </div>
    );
  }

  if (!usageSummary) {
    return (
      <div className="rounded border border-dashed border-border p-6 text-center text-sm text-text-secondary">
        No usage data yet. Usage statistics will appear here once you start making API calls.
      </div>
    );
  }

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number | undefined) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount ?? 0);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="space-y-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-success" />
            <div>
              <p className="text-xs text-text-secondary">Total Cost</p>
              <p className="text-lg font-bold">{formatCurrency(usageSummary.totalCost)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-text-secondary">Total Tokens</p>
              <p className="text-lg font-bold">
                {formatNumber(usageSummary.totalInputTokens + usageSummary.totalOutputTokens)}
              </p>
              <p className="text-xs text-text-secondary">
                {formatNumber(usageSummary.totalInputTokens)} in /{' '}
                {formatNumber(usageSummary.totalOutputTokens)} out
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-warning" />
            <div>
              <p className="text-xs text-text-secondary">Total Requests</p>
              <p className="text-lg font-bold">{usageSummary.totalRequests.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* By Model Breakdown */}
      {usageSummary.byModel && usageSummary.byModel.size > 0 && (
        <Card className="p-3">
          <h3 className="mb-2 text-sm font-semibold">By Model</h3>
          <div className="space-y-2">
            {Array.from(usageSummary.byModel.entries()).map(([modelId, stats]) => (
              <div key={modelId} className="flex items-center justify-between text-xs">
                <span className="font-mono">{modelId}</span>
                <span className="text-text-secondary">
                  {stats.requests} req • {formatCurrency(stats.cost)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Period */}
      {usageSummary.period && (
        <p className="text-center text-xs text-text-secondary">
          {usageSummary.period.start} to {usageSummary.period.end}
        </p>
      )}
    </div>
  );
}
