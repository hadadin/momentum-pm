'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { KpiEntry, Workspace } from '@/types';
import Modal from '@/components/ui/Modal';
import KpiFormDialog from '@/components/forms/KpiFormDialog';

// Inline SVG icons
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function TrendingDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

interface ParsedKpi {
  metric_name: string;
  current_value: number;
  previous_value?: number;
  unit?: string;
  trend: 'up' | 'down' | 'neutral';
}

export default function KpisPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [entries, setEntries] = useState<KpiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiFormOpen, setKpiFormOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [parsedKpis, setParsedKpis] = useState<ParsedKpi[]>([]);
  const [showReview, setShowReview] = useState(false);

  // Fetch workspace and KPIs
  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!ws) {
        setLoading(false);
        return;
      }

      setWorkspace(ws);

      const { data } = await supabase
        .from('kpi_entries')
        .select('*')
        .eq('workspace_id', ws.id)
        .order('date', { ascending: false });

      setEntries(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // AI Metrics Extraction
  const handleExtractMetrics = async () => {
    if (!aiInput.trim()) {
      setAiError('Please paste metrics text');
      return;
    }

    setAiLoading(true);
    setAiError('');
    setParsedKpis([]);

    try {
      const today = new Date().toISOString().split('T')[0];
      const prompt = `You are a metrics assistant. Parse the user's input and extract KPI data.
User input: ${aiInput}
For each metric, determine:
- metric_name (clear, standard name)
- current_value (number)
- previous_value (number if mentioned, otherwise null)
- unit (%, $, users, etc.)
- trend (up/down/neutral based on values)
Today's date is ${today}.
Return JSON with structure: { kpis: [{ metric_name, current_value, previous_value, unit, trend }] }`;

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract metrics');
      }

      const data = await response.json();

      if (data.data?.kpis && Array.isArray(data.data.kpis)) {
        setParsedKpis(data.data.kpis);
        setShowReview(true);
      } else {
        setAiError('Could not parse metrics. Please try again with clearer data.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to extract metrics');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveExtractedKpis = async () => {
    if (!workspace || parsedKpis.length === 0) return;

    setAiLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const kpiRecords = parsedKpis.map((kpi) => ({
        workspace_id: workspace.id,
        metric_name: kpi.metric_name,
        value: kpi.current_value,
        previous_value: kpi.previous_value || null,
        unit: kpi.unit || null,
        trend: kpi.trend,
        date: today,
        source: 'ai' as const,
      }));

      const { error } = await supabase.from('kpi_entries').insert(kpiRecords);

      if (error) throw error;

      // Refresh data
      await fetchData();

      // Reset form
      setAiInput('');
      setParsedKpis([]);
      setShowReview(false);
      setAiModalOpen(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to save KPIs');
    } finally {
      setAiLoading(false);
    }
  };

  const toggleFavorite = async (metricName: string) => {
    const metricEntries = entries.filter((e) => e.metric_name === metricName);
    const currentFavoriteState = metricEntries[0]?.is_favorite ?? false;
    const newFavoriteState = !currentFavoriteState;

    const { error } = await supabase
      .from('kpi_entries')
      .update({ is_favorite: newFavoriteState })
      .eq('metric_name', metricName);

    if (!error) {
      setEntries((prev) =>
        prev.map((e) =>
          e.metric_name === metricName ? { ...e, is_favorite: newFavoriteState } : e
        )
      );
    }
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('kpi_entries').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Group by metric_name
  const metrics = new Map<string, KpiEntry[]>();
  for (const e of entries) {
    if (!metrics.has(e.metric_name)) metrics.set(e.metric_name, []);
    metrics.get(e.metric_name)!.push(e);
  }

  // Get favorites
  const favoriteMetrics = new Set(
    [...metrics.entries()]
      .filter(([_, items]) => items[0]?.is_favorite)
      .map(([name]) => name)
  );

  // Sort: favorites first
  const sortedMetrics = [...metrics.entries()].sort(([aName], [bName]) => {
    const aFav = favoriteMetrics.has(aName) ? 0 : 1;
    const bFav = favoriteMetrics.has(bName) ? 0 : 1;
    return aFav - bFav;
  });

  const TrendIcon = ({ trend, change }: { trend?: string; change: number | null }) => {
    if (trend === 'up' || (change !== null && change > 0)) {
      return <TrendingUpIcon className="w-4 h-4 text-emerald-500" />;
    }
    if (trend === 'down' || (change !== null && change < 0)) {
      return <TrendingDownIcon className="w-4 h-4 text-red-500" />;
    }
    return <div className="w-4 h-4 text-zinc-400">—</div>;
  };

  const LineChart = ({ items }: { items: KpiEntry[] }) => {
    if (items.length < 2) return null;

    const data = items.slice(0, 10).reverse();
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const padding = 12;
    const chartWidth = 200;
    const chartHeight = 60;
    const pointSpacing = (chartWidth - padding * 2) / (data.length - 1 || 1);

    const points = data
      .map((d, i) => {
        const x = padding + i * pointSpacing;
        const y = chartHeight - ((d.value - min) / range) * (chartHeight - padding * 2) - padding;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-12 mt-2">
        <polyline
          points={points}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading KPIs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">KPIs & Metrics</h1>
              <p className="text-gray-600 text-sm mt-1">Track and monitor your key performance indicators</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setAiModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                <SparkleIcon className="w-4 h-4" />
                Update with AI
              </button>
              <button
                onClick={() => setKpiFormOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
              >
                Add KPI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Favorites Section */}
        {[...metrics.entries()]
          .filter(([name]) => favoriteMetrics.has(name))
          .length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Favorites</h2>
            <div className="grid grid-cols-3 gap-6">
              {sortedMetrics
                .filter(([name]) => favoriteMetrics.has(name))
                .map(([name, items]) => {
                  const latest = items[0];
                  const change =
                    latest.previous_value != null
                      ? ((latest.value - latest.previous_value) / latest.previous_value) * 100
                      : null;

                  return (
                    <div
                      key={name}
                      className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 text-sm flex-1">{name}</h3>
                        <button
                          onClick={() => toggleFavorite(name)}
                          className="text-amber-400 hover:text-amber-500 transition-colors"
                          title="Remove from favorites"
                        >
                          <StarIcon className="w-5 h-5" filled={true} />
                        </button>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-3xl font-bold text-gray-900">
                            {latest.value.toLocaleString('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 1,
                            })}
                          </span>
                          {latest.unit && <span className="text-gray-600 text-sm font-medium">{latest.unit}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendIcon trend={latest.trend} change={change} />
                          {change !== null && (
                            <span className={`text-sm font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {change >= 0 ? '+' : ''}
                              {change.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {items.length >= 2 && <LineChart items={items} />}

                      <div className="text-xs text-gray-500 mt-4">{items.length} entries</div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* All Metrics Grid */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Metrics</h2>
          {sortedMetrics.length === 0 ? (
            <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
              <p className="text-gray-600">No metrics tracked yet</p>
              <p className="text-gray-500 text-sm mt-1">Add your first KPI to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {sortedMetrics.map(([name, items]) => {
                const latest = items[0];
                const change =
                  latest.previous_value != null
                    ? ((latest.value - latest.previous_value) / latest.previous_value) * 100
                    : null;
                const isFavorite = favoriteMetrics.has(name);

                return (
                  <div
                    key={name}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 text-sm">{name}</h3>
                      <button
                        onClick={() => toggleFavorite(name)}
                        className={`text-gray-300 hover:text-amber-400 transition-colors ${
                          isFavorite ? 'text-amber-400' : ''
                        }`}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <StarIcon className="w-4 h-4" filled={isFavorite} />
                      </button>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl font-bold text-gray-900">
                          {latest.value.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 1,
                          })}
                        </span>
                        {latest.unit && <span className="text-xs text-gray-500">{latest.unit}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendIcon trend={latest.trend} change={change} />
                        {change !== null && (
                          <span className={`text-xs font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {change >= 0 ? '+' : ''}
                            {change.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {items.length >= 2 && <LineChart items={items} />}

                    <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                      {latest.date} • {items.length} entries
                    </div>

                    <button
                      onClick={() => deleteEntry(latest.id)}
                      className="mt-2 w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* KPI Form Dialog */}
      <KpiFormDialog
        open={kpiFormOpen}
        onClose={() => setKpiFormOpen(false)}
        workspaceId={workspace?.id || ''}
        onSaved={() => {
          fetchData();
          setKpiFormOpen(false);
        }}
      />

      {/* AI Metrics Modal */}
      <Modal open={aiModalOpen} onClose={() => setAiModalOpen(false)} title="AI Metrics Extraction" maxWidth="max-w-2xl">
        <div className="space-y-4">
          {!showReview ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste your metrics update
                </label>
                <textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="e.g. 'DAU is 45,000, up from 42,000 last week. Revenue hit $120K'"
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{aiError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setAiModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtractMetrics}
                  disabled={aiLoading || !aiInput.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {aiLoading ? 'Extracting...' : 'Extract'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Parsed Metrics</h3>
                <div className="space-y-2">
                  {parsedKpis.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{kpi.metric_name}</span>
                        <span className="text-lg font-bold text-gray-700">
                          {kpi.current_value}
                          {kpi.unit && ` ${kpi.unit}`}
                        </span>
                      </div>
                      {kpi.previous_value !== undefined && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>Previous: {kpi.previous_value}</span>
                          <div className="flex items-center gap-1">
                            {kpi.trend === 'up' && (
                              <>
                                <TrendingUpIcon className="w-4 h-4 text-emerald-500" />
                                <span className="text-emerald-600 font-medium">
                                  +
                                  {(
                                    ((kpi.current_value - kpi.previous_value) / kpi.previous_value) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </>
                            )}
                            {kpi.trend === 'down' && (
                              <>
                                <TrendingDownIcon className="w-4 h-4 text-red-500" />
                                <span className="text-red-600 font-medium">
                                  {(
                                    ((kpi.current_value - kpi.previous_value) / kpi.previous_value) *
                                    100
                                  ).toFixed(1)}
                                  %
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowReview(false);
                    setAiInput('');
                    setParsedKpis([]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveExtractedKpis}
                  disabled={aiLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  {aiLoading ? 'Saving...' : 'Save All'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
