'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { KpiEntry, Workspace } from '@/types'
// Inline SVG icons (no lucide-react dependency)
function TrendingUpIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
}
function TrendingDownIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
}
function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return <svg className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}

export default function KpisPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [entries, setEntries] = useState<KpiEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'metrics' | 'timeline'>('metrics')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // form state
  const [metricName, setMetricName] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [previousValue, setPreviousValue] = useState('')
  const [trend, setTrend] = useState<'up' | 'down' | 'neutral'>('neutral')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) {
        setLoading(false)
        return
      }
      setWorkspace(ws)
      const { data } = await supabase.from('kpi_entries').select('*').eq('workspace_id', ws.id).order('date', { ascending: false })
      setEntries(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!metricName.trim() || !value || !workspace) return

    const { data } = await supabase
      .from('kpi_entries')
      .insert({
        workspace_id: workspace.id,
        metric_name: metricName.trim(),
        value: parseFloat(value),
        previous_value: previousValue ? parseFloat(previousValue) : null,
        unit: unit.trim() || null,
        trend: trend !== 'neutral' ? trend : null,
        date,
        source: 'manual',
        notes: notes.trim() || null,
        is_favorite: false,
      })
      .select()
      .single()

    if (data) setEntries((prev) => [data, ...prev])
    setMetricName('')
    setValue('')
    setUnit('')
    setPreviousValue('')
    setTrend('neutral')
    setNotes('')
    setShowForm(false)
  }

  const deleteEntry = async (id: string) => {
    await supabase.from('kpi_entries').delete().eq('id', id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setDeleteConfirm(null)
  }

  const toggleFavorite = async (metricName: string) => {
    const metricEntries = entries.filter((e) => e.metric_name === metricName)
    const currentFavoriteState = metricEntries[0]?.is_favorite ?? false
    const newFavoriteState = !currentFavoriteState

    const { error } = await supabase
      .from('kpi_entries')
      .update({ is_favorite: newFavoriteState })
      .eq('metric_name', metricName)

    if (!error) {
      setEntries((prev) =>
        prev.map((e) =>
          e.metric_name === metricName ? { ...e, is_favorite: newFavoriteState } : e
        )
      )
    }
  }

  // Group entries by metric_name
  const metrics = new Map<string, KpiEntry[]>()
  for (const e of entries) {
    if (!metrics.has(e.metric_name)) metrics.set(e.metric_name, [])
    metrics.get(e.metric_name)!.push(e)
  }

  // Get favorited metrics for sorting
  const favoriteMetrics = new Set(
    [...metrics.entries()]
      .filter(([_, items]) => items[0]?.is_favorite)
      .map(([name]) => name)
  )

  // Sort metrics: favorites first, then by most recent
  const sortedMetrics = [...metrics.entries()].sort(([aName], [bName]) => {
    const aFav = favoriteMetrics.has(aName) ? 0 : 1
    const bFav = favoriteMetrics.has(bName) ? 0 : 1
    if (aFav !== bFav) return aFav - bFav
    return 0
  })

  const TrendIcon = ({ trend, change }: { trend?: string; change: number | null }) => {
    if (trend === 'up' || (change !== null && change > 0)) {
      return <TrendingUpIcon className="w-4 h-4 text-emerald-500" />
    }
    if (trend === 'down' || (change !== null && change < 0)) {
      return <TrendingDownIcon className="w-4 h-4 text-red-500" />
    }
    return <div className="w-4 h-4 text-zinc-400">—</div>
  }

  const LineChart = ({ items }: { items: KpiEntry[] }) => {
    if (items.length < 2) return null

    const data = items.slice(0, 7).reverse()
    const values = data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    const padding = 16
    const chartWidth = 280
    const chartHeight = 80
    const pointSpacing = (chartWidth - padding * 2) / (data.length - 1 || 1)

    const points = data
      .map((d, i) => {
        const x = padding + i * pointSpacing
        const y = chartHeight - ((d.value - min) / range) * (chartHeight - padding * 2) - padding
        return `${x},${y}`
      })
      .join(' ')

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-16 mt-3">
        <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((_, i) => {
          const x = padding + i * pointSpacing
          const y = chartHeight - ((data[i].value - min) / range) * (chartHeight - padding * 2) - padding
          return <circle key={i} cx={x} cy={y} r="3" fill="#4f46e5" />
        })}
      </svg>
    )
  }

  if (loading)
    return <div className="p-10 text-zinc-400">Loading KPIs...</div>

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">KPIs</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {metrics.size} metric{metrics.size !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-zinc-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('metrics')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition ${
                viewMode === 'metrics'
                  ? 'bg-white shadow text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Current Metrics
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition ${
                viewMode === 'timeline'
                  ? 'bg-white shadow text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              All Entries
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            + Log KPI
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveEntry} className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Metric Name *</label>
              <input
                value={metricName}
                onChange={(e) => setMetricName(e.target.value)}
                placeholder="e.g. DAU, Conversion Rate, NPS"
                list="metric-names"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50"
              />
              <datalist id="metric-names">
                {[...metrics.keys()].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Value *</label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. %, users, $"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Previous Value</label>
              <input
                type="number"
                step="any"
                value={previousValue}
                onChange={(e) => setPreviousValue(e.target.value)}
                placeholder="90"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Trend</label>
              <select
                value={trend}
                onChange={(e) => setTrend(e.target.value as 'up' | 'down' | 'neutral')}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50"
              >
                <option value="neutral">Neutral</option>
                <option value="up">Up</option>
                <option value="down">Down</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context"
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
            >
              Log Entry
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-zinc-500 text-sm hover:text-zinc-700 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {viewMode === 'metrics' ? (
        <>
          {sortedMetrics.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-lg mb-1">No KPIs tracked yet</p>
              <p className="text-sm">Start logging metrics to track product health</p>
            </div>
          ) : (
            <>
              {/* Current Metrics Grid */}
              <div className="mb-12">
                <h2 className="text-lg font-semibold text-zinc-900 mb-4">Current Metrics</h2>
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
                  {sortedMetrics.map(([name, items]) => {
                    const latest = items[0]
                    const change =
                      latest.previous_value != null
                        ? ((latest.value - latest.previous_value) / latest.previous_value) * 100
                        : null

                    return (
                      <div
                        key={name}
                        className="bg-white border border-zinc-200 rounded-xl p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-zinc-900 text-sm leading-tight flex-1">
                            {name}
                          </h3>
                          <button
                            onClick={() => toggleFavorite(name)}
                            className="ml-2 text-zinc-300 hover:text-amber-400 transition"
                            title="Add to favorites"
                          >
                            <StarIcon
                              className={`w-4 h-4 ${latest.is_favorite ? 'text-amber-400' : ''}`}
                              filled={latest.is_favorite}
                            />
                          </button>
                        </div>

                        <div className="mb-3">
                          <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-2xl font-bold text-zinc-900">
                              {latest.value.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 1,
                              })}
                            </span>
                            {latest.unit && (
                              <span className="text-xs text-zinc-500 font-medium">
                                {latest.unit}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <TrendIcon trend={latest.trend} change={change} />
                            {change !== null && (
                              <span
                                className={`text-xs font-semibold ${
                                  change >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }`}
                              >
                                {change >= 0 ? '+' : ''}
                                {change.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Trend chart for metrics with 2+ entries */}
                        {items.length >= 2 && <LineChart items={items} />}

                        <div className="text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-100">
                          {items.length} entries
                        </div>

                        <div className="flex gap-1 mt-2 pt-2">
                          <button
                            onClick={() =>
                              setDeleteConfirm(
                                deleteConfirm === latest.id ? null : latest.id
                              )
                            }
                            className="flex-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 py-1 rounded transition"
                          >
                            Delete
                          </button>
                        </div>

                        {deleteConfirm === latest.id && (
                          <div className="mt-2 p-2 bg-red-50 rounded border border-red-200 space-y-2">
                            <p className="text-xs text-red-700 font-medium">
                              Delete this metric?
                            </p>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => deleteEntry(latest.id)}
                                className="flex-1 text-xs bg-red-500 text-white py-1 rounded hover:bg-red-600 transition"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 text-xs bg-zinc-200 text-zinc-700 py-1 rounded hover:bg-zinc-300 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">All Entries</h2>
          {entries.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <p className="text-lg mb-1">No KPI entries yet</p>
              <p className="text-sm">Start logging metrics to track product health</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="bg-white border border-zinc-200 rounded-lg px-5 py-3 flex items-center gap-4 group hover:shadow-sm transition"
                >
                  <span className="text-xs text-zinc-400 w-20 font-medium">
                    {e.date}
                  </span>
                  <span className="font-semibold text-zinc-900 text-sm w-40">
                    {e.metric_name}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-zinc-900">
                      {e.value.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 1,
                      })}
                    </span>
                    {e.unit && (
                      <span className="text-xs text-zinc-500 font-medium">
                        {e.unit}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {e.previous_value != null && (
                      <>
                        <TrendIcon
                          trend={e.trend}
                          change={
                            ((e.value - e.previous_value) / e.previous_value) *
                            100
                          }
                        />
                        <span
                          className={`text-xs font-semibold ${
                            e.value >= e.previous_value
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {e.value >= e.previous_value ? '+' : ''}
                          {(
                            ((e.value - e.previous_value) /
                              e.previous_value) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </>
                    )}
                  </div>

                  {e.notes && (
                    <span className="text-xs text-zinc-400 max-w-48 truncate">
                      {e.notes}
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite(e.metric_name)}
                      className="text-zinc-300 hover:text-amber-400 transition"
                      title="Add to favorites"
                    >
                      <StarIcon
                        className={`w-4 h-4 ${e.is_favorite ? 'text-amber-400' : ''}`}
                        filled={e.is_favorite}
                      />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteConfirm(
                          deleteConfirm === e.id ? null : e.id
                        )
                      }
                      className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition"
                    >
                      Delete
                    </button>
                  </div>

                  {deleteConfirm === e.id && (
                    <div className="absolute right-5 bg-white border border-red-200 rounded-lg p-3 shadow-lg space-y-2 z-10">
                      <p className="text-xs text-red-700 font-medium">
                        Delete this entry?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteEntry(e.id)}
                          className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs bg-zinc-200 text-zinc-700 px-3 py-1 rounded hover:bg-zinc-300 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
