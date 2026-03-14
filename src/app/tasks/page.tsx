'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, TaskStatus, TaskPriority, Workspace, Project } from '@/types'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'

// ─── helpers ────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false
  return task.due_date < todayISO()
}

const ALL_STATUSES: TaskStatus[] = ['today', 'in_progress', 'blocked', 'backlog', 'done']
const ALL_PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low']

// ─── Task row ────────────────────────────────────────────────
function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task
  onToggle: (id: string, isDone: boolean) => void
  onDelete: (id: string) => void
}) {
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const pc = PRIORITY_CONFIG[task.priority]

  return (
    <div className={`flex items-start gap-3 px-4 py-3 bg-white border-l-4 ${pc.border} border-b border-zinc-100 hover:bg-zinc-50 transition-colors group`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id, done)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          done ? 'bg-green-500 border-green-500' : 'border-zinc-300 hover:border-indigo-400'
        }`}
      >
        {done && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-zinc-800 ${done ? 'line-through text-zinc-400' : ''}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Status badge */}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG[task.status].bgColor} ${STATUS_CONFIG[task.status].textColor}`}>
            {STATUS_CONFIG[task.status].label}
          </span>
          {/* Priority badge */}
          <span className={`text-xs font-medium ${pc.color}`}>
            {pc.label}
          </span>
          {/* Project */}
          {task.project && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
              {task.project.title}
            </span>
          )}
          {/* Due date */}
          {task.due_date && (
            <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-zinc-400'}`}>
              {overdue ? '⚠ ' : ''}Due {task.due_date}
            </span>
          )}
          {/* Time estimate */}
          {task.time_estimate_minutes && (
            <span className="text-xs text-zinc-400">⏱ {task.time_estimate_minutes}m</span>
          )}
          {/* Tags */}
          {task.tags?.map(tag => (
            <span key={tag} className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Delete button (hover) */}
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all mt-0.5 shrink-0"
        aria-label="Delete task"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Add task modal ───────────────────────────────────────────
function AddTaskForm({
  onAdd,
  projects,
  defaultStatus = 'backlog',
}: {
  onAdd: (data: Partial<Task>) => Promise<void>
  projects: Project[]
  defaultStatus?: TaskStatus
}) {
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<TaskStatus>(defaultStatus)
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [projectId, setProjectId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimate, setEstimate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [open, setOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    await onAdd({
      title: title.trim(),
      status,
      priority,
      project_id: projectId || undefined,
      due_date: dueDate || undefined,
      time_estimate_minutes: estimate ? parseInt(estimate) : undefined,
    })
    setTitle('')
    setDueDate('')
    setEstimate('')
    setSubmitting(false)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-white border border-dashed border-zinc-300 rounded-xl text-sm text-zinc-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New task
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-indigo-300 rounded-xl p-4 space-y-3 shadow-sm">
      <input
        autoFocus
        type="text"
        placeholder="Task title..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full text-sm font-medium text-zinc-800 placeholder-zinc-400 outline-none"
      />

      <div className="flex gap-2 flex-wrap">
        {/* Status */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value as TaskStatus)}
          className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={priority}
          onChange={e => setPriority(e.target.value as TaskPriority)}
          className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {ALL_PRIORITIES.map(p => (
            <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>

        {/* Project */}
        {projects.length > 0 && (
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="">No project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}

        {/* Due date */}
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none focus:ring-1 focus:ring-indigo-400"
        />

        {/* Estimate */}
        <input
          type="number"
          placeholder="Estimate (min)"
          value={estimate}
          onChange={e => setEstimate(e.target.value)}
          className="w-28 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 bg-white outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600 px-3 py-1.5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || submitting}
          className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {submitting ? 'Adding...' : 'Add task'}
        </button>
      </div>
    </form>
  )
}

// ─── Filter bar ───────────────────────────────────────────────
const FILTER_OPTIONS: Array<{ label: string; value: TaskStatus | 'all' }> = [
  { label: 'All',         value: 'all' },
  { label: 'Today',       value: 'today' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Blocked',     value: 'blocked' },
  { label: 'Backlog',     value: 'backlog' },
  { label: 'Done',        value: 'done' },
]

// ─── Main page ────────────────────────────────────────────────
export default function TasksPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!ws) { setLoading(false); return }
      setWorkspace(ws)

      const [{ data: taskData }, { data: projectData }] = await Promise.all([
        supabase
          .from('tasks')
          .select('*, project:projects(title, color)')
          .eq('workspace_id', ws.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .eq('workspace_id', ws.id)
          .order('title'),
      ])

      setTasks(taskData ?? [])
      setProjects(projectData ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleTask = async (taskId: string, isDone: boolean) => {
    const newStatus: TaskStatus = isDone ? 'today' : 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: isDone ? null : new Date().toISOString(),
    }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  const deleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const addTask = async (data: Partial<Task>) => {
    if (!workspace) return
    const { data: created } = await supabase
      .from('tasks')
      .insert({
        ...data,
        workspace_id: workspace.id,
        source: 'manual',
        time_actual_minutes: 0,
      })
      .select('*, project:projects(title, color)')
      .single()

    if (created) {
      setTasks(prev => [created, ...prev])
    }
  }

  // Filtered + sorted tasks
  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const statusOrder: Record<TaskStatus, number> = { blocked: 0, in_progress: 1, today: 2, backlog: 3, done: 4 }
  const sorted = [...filtered].sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  // Stats
  const totalActive = tasks.filter(t => t.status !== 'done').length
  const overdueCount = tasks.filter(t => isOverdue(t)).length
  const doneToday = tasks.filter(t => t.status === 'done' && t.completed_at?.startsWith(todayISO())).length

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tasks</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {totalActive} active · {overdueCount} overdue · {doneToday} done today
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Status filters */}
        <div className="flex bg-white border border-zinc-200 rounded-xl overflow-hidden p-0.5 gap-0.5">
          {FILTER_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as TaskPriority | 'all')}
          className="text-xs border border-zinc-200 bg-white rounded-xl px-3 py-2 text-zinc-600 outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All priorities</option>
          {ALL_PRIORITIES.map(p => (
            <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>

        {/* Count */}
        <span className="text-xs text-zinc-400 ml-auto">
          {sorted.length} task{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-px rounded-xl overflow-hidden">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-16 bg-zinc-200 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-xl px-6 py-12 text-center">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-zinc-600 font-medium text-sm">No tasks match this filter</p>
          <p className="text-zinc-400 text-xs mt-1">Try a different filter or add a new task below</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-zinc-200 mb-4 bg-white">
          {sorted.map(task => (
            <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
          ))}
        </div>
      )}

      {/* Add task form */}
      {workspace && (
        <AddTaskForm
          onAdd={addTask}
          projects={projects}
          defaultStatus={statusFilter !== 'all' ? statusFilter as TaskStatus : 'backlog'}
        />
      )}
    </div>
  )
}
