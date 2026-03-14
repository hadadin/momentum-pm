'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Workspace } from '@/types'

export default function SettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState(false)

  // stats
  const [stats, setStats] = useState({ tasks: 0, projects: 0, people: 0, decisions: 0, meetings: 0, kpis: 0 })

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)
      setName(ws.name)
      setDescription(ws.description ?? '')

      const [
        { count: tasks }, { count: projects }, { count: people },
        { count: decisions }, { count: meetings }, { count: kpis },
      ] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('people').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('decisions').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('meetings').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('kpi_entries').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
      ])
      setStats({
        tasks: tasks ?? 0, projects: projects ?? 0, people: people ?? 0,
        decisions: decisions ?? 0, meetings: meetings ?? 0, kpis: kpis ?? 0,
      })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const saveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspace || !name.trim()) return
    setSaving(true)
    await supabase.from('workspaces').update({
      name: name.trim(), description: description.trim() || null,
    }).eq('id', workspace.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-10 text-zinc-400">Loading settings...</div>

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">Settings</h1>

      {/* Workspace */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Workspace</h2>
        <form onSubmit={saveWorkspace} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Workspace Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description"
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* Data Summary */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Data Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tasks', count: stats.tasks, icon: '✓' },
            { label: 'Projects', count: stats.projects, icon: '◆' },
            { label: 'People', count: stats.people, icon: '◉' },
            { label: 'Decisions', count: stats.decisions, icon: '⚖' },
            { label: 'Meetings', count: stats.meetings, icon: '◷' },
            { label: 'KPI Entries', count: stats.kpis, icon: '↗' },
          ].map(s => (
            <div key={s.label} className="bg-zinc-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-zinc-900">{s.count}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* API Keys Info */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Integrations</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium text-zinc-900">Supabase</div>
              <div className="text-xs text-zinc-400">Database & Auth</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Connected</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-zinc-100">
            <div>
              <div className="text-sm font-medium text-zinc-900">Gemini AI</div>
              <div className="text-xs text-zinc-400">In-app AI engine</div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending Setup</span>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-2">About</h2>
        <p className="text-sm text-zinc-500">Momentum PM v1.0 — Personal OS for Product Managers</p>
        <p className="text-xs text-zinc-400 mt-1">Built with Next.js 16, React 19, Supabase, Tailwind CSS 4</p>
      </section>
    </div>
  )
}
