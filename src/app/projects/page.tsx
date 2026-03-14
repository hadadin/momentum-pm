'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Project, Workspace, ProjectPhase } from '@/types'

const PHASE_CONFIG: Record<ProjectPhase, { label: string; bg: string; text: string }> = {
  discovery:   { label: 'Discovery',   bg: 'bg-purple-100', text: 'text-purple-700' },
  grooming:    { label: 'Grooming',    bg: 'bg-blue-100',   text: 'text-blue-700' },
  development: { label: 'Development', bg: 'bg-amber-100',  text: 'text-amber-700' },
  testing:     { label: 'Testing',     bg: 'bg-orange-100', text: 'text-orange-700' },
  launched:    { label: 'Launched',    bg: 'bg-green-100',  text: 'text-green-700' },
  archived:    { label: 'Archived',    bg: 'bg-zinc-100',   text: 'text-zinc-500' },
}

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16']

export default function ProjectsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; done: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [phase, setPhase] = useState<ProjectPhase>('discovery')
  const [color, setColor] = useState(COLORS[0])
  const [dueDate, setDueDate] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase
        .from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)

      const { data: projectData } = await supabase
        .from('projects').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: false })
      setProjects(projectData ?? [])

      // get task counts per project
      const { data: tasks } = await supabase
        .from('tasks').select('project_id, status').eq('workspace_id', ws.id).not('project_id', 'is', null)
      const counts: Record<string, { total: number; done: number }> = {}
      for (const t of (tasks ?? [])) {
        if (!t.project_id) continue
        if (!counts[t.project_id]) counts[t.project_id] = { total: 0, done: 0 }
        counts[t.project_id].total++
        if (t.status === 'done') counts[t.project_id].done++
      }
      setTaskCounts(counts)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setTitle(''); setDescription(''); setPhase('discovery'); setColor(COLORS[0]); setDueDate('')
    setShowForm(false); setEditingId(null)
  }

  const startEdit = (p: Project) => {
    setTitle(p.title); setDescription(p.description ?? ''); setPhase(p.phase)
    setColor(p.color); setDueDate(p.due_date ?? ''); setEditingId(p.id); setShowForm(true)
  }

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !workspace) return
    const payload = { workspace_id: workspace.id, title: title.trim(), description: description.trim() || null, phase, color, due_date: dueDate || null }

    if (editingId) {
      const { data } = await supabase.from('projects').update(payload).eq('id', editingId).select().single()
      if (data) setProjects(prev => prev.map(p => p.id === editingId ? data : p))
    } else {
      const { data } = await supabase.from('projects').insert(payload).select().single()
      if (data) setProjects(prev => [data, ...prev])
    }
    resetForm()
  }

  const deleteProject = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className="p-10 text-zinc-400">Loading projects...</div>

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Projects</h1>
          <p className="text-zinc-500 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          + New Project
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveProject} className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Project name"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Phase</label>
              <select value={phase} onChange={e => setPhase(e.target.value as ProjectPhase)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {Object.entries(PHASE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Brief description..."
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button type="button" key={c} onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-zinc-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              {editingId ? 'Update' : 'Create'} Project
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-zinc-500 text-sm hover:text-zinc-700">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map(p => {
          const tc = taskCounts[p.id] ?? { total: 0, done: 0 }
          const pc = PHASE_CONFIG[p.phase]
          const progress = tc.total > 0 ? Math.round((tc.done / tc.total) * 100) : 0
          return (
            <div key={p.id} className="bg-white border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  <h3 className="font-semibold text-zinc-900">{p.title}</h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>{pc.label}</span>
              </div>
              {p.description && <p className="text-sm text-zinc-500 mb-3 line-clamp-2">{p.description}</p>}
              <div className="flex items-center gap-4 text-xs text-zinc-400 mb-3">
                <span>{tc.total} task{tc.total !== 1 ? 's' : ''}</span>
                <span>{tc.done} done</span>
                {p.due_date && <span>Due {p.due_date}</span>}
              </div>
              {tc.total > 0 && (
                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: p.color }} />
                </div>
              )}
              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(p)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                <button onClick={() => deleteProject(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
              </div>
            </div>
          )
        })}
      </div>

      {projects.length === 0 && !showForm && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-lg mb-1">No projects yet</p>
          <p className="text-sm">Create your first project to start organizing work</p>
        </div>
      )}
    </div>
  )
}
