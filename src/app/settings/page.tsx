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
  const [workStartHour, setWorkStartHour] = useState(9)
  const [workEndHour, setWorkEndHour] = useState(18)
  const [weekStartsOn, setWeekStartsOn] = useState(0)
  const [defaultTaskDuration, setDefaultTaskDuration] = useState(30)
  const [showWeekends, setShowWeekends] = useState(true)
  const [saved, setSaved] = useState(false)

  // stats
  const [stats, setStats] = useState({ tasks: 0, projects: 0, people: 0, decisions: 0, meetings: 0, kpis: 0 })

  // data management
  const [exporting, setExporting] = useState(false)
  const [deletingCompleted, setDeletingCompleted] = useState(false)
  const [completedTasksCount, setCompletedTasksCount] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)
      setName(ws.name)
      setDescription(ws.description ?? '')
      setWorkStartHour(ws.work_start_hour ?? 9)
      setWorkEndHour(ws.work_end_hour ?? 18)
      setWeekStartsOn(ws.week_starts_on ?? 0)
      setDefaultTaskDuration(ws.default_task_duration ?? 30)
      setShowWeekends(ws.show_weekends ?? true)

      const [
        { count: tasks }, { count: projects }, { count: people },
        { count: decisions }, { count: meetings }, { count: kpis },
        { count: completed },
      ] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('people').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('decisions').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('meetings').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('kpi_entries').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id).eq('status', 'done'),
      ])
      setStats({
        tasks: tasks ?? 0, projects: projects ?? 0, people: people ?? 0,
        decisions: decisions ?? 0, meetings: meetings ?? 0, kpis: kpis ?? 0,
      })
      setCompletedTasksCount(completed ?? 0)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const saveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspace || !name.trim()) return
    setSaving(true)
    try {
      await supabase.from('workspaces').update({
        name: name.trim(),
        description: description.trim() || null,
        work_start_hour: workStartHour,
        work_end_hour: workEndHour,
        week_starts_on: weekStartsOn,
        default_task_duration: defaultTaskDuration,
        show_weekends: showWeekends,
      }).eq('id', workspace.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleExportData = async () => {
    if (!workspace) return
    setExporting(true)
    try {
      const { data: tasks } = await supabase.from('tasks').select('*').eq('workspace_id', workspace.id)
      const { data: projects } = await supabase.from('projects').select('*').eq('workspace_id', workspace.id)

      const exportData = {
        exportedAt: new Date().toISOString(),
        workspaceName: workspace.name,
        tasks: tasks ?? [],
        projects: projects ?? [],
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `momentum-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteCompletedTasks = async () => {
    if (!workspace) return
    setDeletingCompleted(true)
    try {
      await supabase.from('tasks').delete().eq('workspace_id', workspace.id).eq('status', 'done')
      setCompletedTasksCount(0)
      setShowDeleteConfirm(false)
      setStats(prev => ({ ...prev, tasks: prev.tasks - completedTasksCount }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setDeletingCompleted(false)
    }
  }

  if (loading) return <div className="p-10 text-zinc-400">Loading settings...</div>

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">Settings</h1>

      {/* Success message */}
      {saved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Saved!
        </div>
      )}

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
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* Working Hours */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Working Hours</h2>
        <form onSubmit={saveWorkspace} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2">Work Start Time</label>
              <select value={workStartHour} onChange={e => setWorkStartHour(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2">Work End Time</label>
              <select value={workEndHour} onChange={e => setWorkEndHour(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* Calendar Preferences */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Calendar Preferences</h2>
        <form onSubmit={saveWorkspace} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2">Week Starts On</label>
              <select value={weekStartsOn} onChange={e => setWeekStartsOn(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-2">Default Task Duration</label>
              <select value={defaultTaskDuration} onChange={e => setDefaultTaskDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="showWeekends"
              checked={showWeekends}
              onChange={e => setShowWeekends(e.target.checked)}
              className="w-4 h-4 border border-zinc-300 rounded accent-indigo-600"
            />
            <label htmlFor="showWeekends" className="text-sm text-zinc-700">Show weekends in calendar</label>
          </div>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
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

      {/* Data Management */}
      <section className="bg-white border border-zinc-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Data Management</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-zinc-100">
            <div>
              <div className="text-sm font-medium text-zinc-900">Export Data</div>
              <div className="text-xs text-zinc-500">Download all tasks and projects as JSON</div>
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-zinc-900">Delete Completed Tasks</div>
              <div className="text-xs text-zinc-500">{completedTasksCount} completed task{completedTasksCount !== 1 ? 's' : ''}</div>
            </div>
            {completedTasksCount > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deletingCompleted}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50"
              >
                {deletingCompleted ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-900 mb-4">
                Are you sure you want to permanently delete {completedTasksCount} completed task{completedTasksCount !== 1 ? 's' : ''}? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCompletedTasks}
                  disabled={deletingCompleted}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingCompleted ? 'Deleting...' : 'Delete Permanently'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingCompleted}
                  className="px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Integrations */}
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
