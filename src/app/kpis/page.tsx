'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { KpiEntry, Workspace } from '@/types'

export default function KpisPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [entries, setEntries] = useState<KpiEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // form
  const [metricName, setMetricName] = useState('')
  const [value, setValue] = useState('')
  const [previousValue, setPreviousValue] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)
      const { data } = await supabase.from('kpi_entries').select('*').eq('workspace_id', ws.id).order('date', { ascending: false })
      setEntries(data ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!metricName.trim() || !value || !workspace) return
    const { data } = await supabase.from('kpi_entries').insert({
      workspace_id: workspace.id, metric_name: metricName.trim(),
      value: parseFloat(value), previous_value: previousValue ? parseFloat(previousValue) : null,
      date, source: 'manual', notes: notes.trim() || null,
    }).select().single()
    if (data) setEntries(prev => [data, ...prev])
    setMetricName(''); setValue(''); setPreviousValue(''); setNotes(''); setShowForm(false)
  }

  const deleteEntry = async (id: string) => {
    await supabase.from('kpi_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  // group by metric
  const metrics = new Map<string, KpiEntry[]>()
  for (const e of entries) {
    if (!metrics.has(e.metric_name)) metrics.set(e.metric_name, [])
    metrics.get(e.metric_name)!.push(e)
  }

  const [viewMode, setViewMode] = useState<'metrics' | 'timeline'>('metrics')

  if (loading) return <div className="p-10 text-zinc-400">Loading KPIs...</div>

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">KPIs</h1>
          <p className="text-zinc-500 text-sm mt-1">{metrics.size} metric{metrics.size !== 1 ? 's' : ''} tracked</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-zinc-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('metrics')}
              className={`px-3 py-1.5 text-xs rounded-md ${viewMode === 'metrics' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500'}`}>
              By Metric
            </button>
            <button onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-xs rounded-md ${viewMode === 'timeline' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500'}`}>
              Timeline
            </button>
          </div>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Log KPI
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveEntry} className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Metric Name *</label>
              <input value={metricName} onChange={e => setMetricName(e.target.value)} placeholder="e.g. DAU, Conversion Rate, NPS"
                list="metric-names"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <datalist id="metric-names">
                {[...metrics.keys()].map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Value *</label>
              <input type="number" step="any" value={value} onChange={e => setValue(e.target.value)} placeholder="100"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Previous Value</label>
              <input type="number" step="any" value={previousValue} onChange={e => setPreviousValue(e.target.value)} placeholder="90"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Log Entry</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-zinc-500 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {viewMode === 'metrics' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...metrics.entries()].map(([name, items]) => {
            const latest = items[0]
            const change = latest.previous_value != null ? ((latest.value - latest.previous_value) / latest.previous_value * 100) : null
            return (
              <div key={name} className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-zinc-900 text-sm">{name}</h3>
                  <span className="text-xs text-zinc-400">{items.length} entries</span>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold text-zinc-900">{latest.value.toLocaleString()}</span>
                  {change != null && (
                    <span className={`text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                    </span>
                  )}
                </div>
                {/* mini sparkline with divs */}
                <div className="flex items-end gap-0.5 h-8">
                  {items.slice(0, 12).reverse().map((item, i) => {
                    const max = Math.max(...items.slice(0, 12).map(x => x.value))
                    const min = Math.min(...items.slice(0, 12).map(x => x.value))
                    const range = max - min || 1
                    const height = ((item.value - min) / range) * 100
                    return <div key={i} className="flex-1 bg-indigo-400 rounded-sm" style={{ height: `${Math.max(height, 10)}%` }} />
                  })}
                </div>
                <div className="text-xs text-zinc-400 mt-2">Last updated: {latest.date}</div>
                {latest.notes && <div className="text-xs text-zinc-500 mt-1">{latest.notes}</div>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="bg-white border border-zinc-200 rounded-lg px-5 py-3 flex items-center gap-4 group">
              <span className="text-xs text-zinc-400 w-24">{e.date}</span>
              <span className="font-medium text-zinc-900 text-sm flex-1">{e.metric_name}</span>
              <span className="text-lg font-bold text-zinc-900">{e.value.toLocaleString()}</span>
              {e.previous_value != null && (
                <span className={`text-xs ${e.value >= e.previous_value ? 'text-green-600' : 'text-red-600'}`}>
                  {e.value >= e.previous_value ? '↑' : '↓'} {Math.abs(((e.value - e.previous_value) / e.previous_value * 100)).toFixed(1)}%
                </span>
              )}
              {e.notes && <span className="text-xs text-zinc-400 max-w-48 truncate">{e.notes}</span>}
              <button onClick={() => deleteEntry(e.id)} className="text-xs text-red-500 hover:underline opacity-0 group-hover:opacity-100">Delete</button>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-lg mb-1">No KPIs tracked yet</p>
          <p className="text-sm">Start logging metrics to track product health</p>
        </div>
      )}
    </div>
  )
}
