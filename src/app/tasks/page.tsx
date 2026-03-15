'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, TaskStatus, TaskPriority, Workspace, Project, Subtask } from '@/types'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'
import FocusMode from '@/components/FocusMode'

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

// Kanban column mapping
type KanbanColumn = 'todo' | 'in-progress' | 'done'
const KANBAN_COLUMNS: Record<KanbanColumn, TaskStatus[]> = {
  'todo': ['backlog', 'today'],
  'in-progress': ['in_progress', 'blocked'],
  'done': ['done'],
}

// ─── Subtask list ──────────────────────────────────────────
function SubtaskList({
  subtasks,
  taskId,
  onToggle,
  onDelete,
}: {
  subtasks: Subtask[]
  taskId: string
  onToggle: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="mt-3 space-y-2 pl-8 border-l-2 border-zinc-100">
      {subtasks.map(st => (
        <div key={st.id} className="flex items-center gap-2 py-1.5">
          <button
            onClick={() => onToggle(st.id, st.completed)}
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              st.completed ? 'bg-green-500 border-green-500' : 'border-zinc-300 hover:border-indigo-400'
            }`}
          >
            {st.completed && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className={`text-xs ${st.completed ? 'line-through text-zinc-400' : 'text-zinc-600'}`}>
            {st.title}
          </span>
          <button
            onClick={() => onDelete(st.id)}
            className="ml-auto text-zinc-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Delete subtask"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Task row (List view) ──────────────────────────────────────
function TaskRow({
  task,
  subtaskCount,
  expandedSubtasks,
  onToggleExpand,
  onToggle,
  onDelete,
  onStatusChange,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onFocus,
  subtasks,
}: {
  task: Task
  subtaskCount: number
  expandedSubtasks: Set<string>
  onToggleExpand: (id: string) => void
  onToggle: (id: string, isDone: boolean) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: TaskStatus) => void
  onAddSubtask: (taskId: string, title: string) => void
  onToggleSubtask: (id: string, completed: boolean) => void
  onDeleteSubtask: (id: string) => void
  onFocus: (task: Task) => void
  subtasks: Subtask[]
}) {
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const pc = PRIORITY_CONFIG[task.priority]
  const isExpanded = expandedSubtasks.has(task.id)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)

  const handleAddSubtask = async () => {
    if (!subtaskTitle.trim()) return
    setAddingSubtask(true)
    await onAddSubtask(task.id, subtaskTitle)
    setSubtaskTitle('')
    setAddingSubtask(false)
  }

  return (
    <div className="bg-white border-b border-zinc-100 hover:bg-zinc-50 transition-colors group">
      <div className={`flex items-start gap-3 px-4 py-3 border-l-4 ${pc.border}`}>
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
            <select
              value={task.status}
              onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
              className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 outline-none cursor-pointer ${STATUS_CONFIG[task.status].bgColor} ${STATUS_CONFIG[task.status].textColor}`}
            >
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>

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

            {/* Subtask badge */}
            {subtaskCount > 0 && (
              <button
                onClick={() => onToggleExpand(task.id)}
                className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
              >
                {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Focus mode button */}
          <button
            onClick={() => onFocus(task)}
            className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
            aria-label="Focus mode"
            title="Focus mode"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 text-zinc-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Delete task"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {isExpanded && (
        <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100">
          {subtasks.length > 0 && (
            <SubtaskList
              subtasks={subtasks}
              taskId={task.id}
              onToggle={onToggleSubtask}
              onDelete={onDeleteSubtask}
            />
          )}

          {/* Add subtask form */}
          <div className="mt-3 flex gap-2 pl-8">
            <input
              type="text"
              placeholder="Add subtask..."
              value={subtaskTitle}
              onChange={e => setSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleAddSubtask()
                }
              }}
              className="flex-1 text-xs px-2 py-1.5 border border-zinc-200 rounded-lg bg-white text-zinc-700 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              onClick={handleAddSubtask}
              disabled={!subtaskTitle.trim() || addingSubtask}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {addingSubtask ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Kanban card ──────────────────────────────────────────
function KanbanTaskCard({
  task,
  subtaskCount,
  onStatusChange,
  onToggle,
  onDelete,
  onFocus,
}: {
  task: Task
  subtaskCount: number
  onStatusChange: (id: string, status: TaskStatus) => void
  onToggle: (id: string, isDone: boolean) => void
  onDelete: (id: string) => void
  onFocus: (task: Task) => void
}) {
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const pc = PRIORITY_CONFIG[task.priority]
  const sc = STATUS_CONFIG[task.status]

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3 hover:shadow-md transition-shadow group">
      {/* Header with checkbox */}
      <div className="flex items-start gap-2 mb-2">
        <button
          onClick={() => onToggle(task.id, done)}
          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            done ? 'bg-green-500 border-green-500' : 'border-zinc-300 hover:border-indigo-400'
          }`}
        >
          {done && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="ml-auto opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all"
          aria-label="Delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <p className={`text-sm font-medium text-zinc-800 mb-2 ${done ? 'line-through text-zinc-400' : ''}`}>
        {task.title}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pc.color}`}>
          {pc.label}
        </span>
        {task.project && (
          <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
            {task.project.title}
          </span>
        )}
        {subtaskCount > 0 && (
          <span className="text-xs bg-indigo-50 text-indigo-600 font-medium px-2 py-0.5 rounded-full">
            {subtaskCount}
          </span>
        )}
      </div>

      {/* Due date */}
      {task.due_date && (
        <p className={`text-xs mb-2 ${overdue ? 'text-red-500 font-medium' : 'text-zinc-400'}`}>
          {overdue ? '⚠ ' : ''}Due {task.due_date}
        </p>
      )}

      {/* Status + Focus buttons */}
      <div className="flex gap-1.5 pt-2 border-t border-zinc-100">
        <select
          value={task.status}
          onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="flex-1 text-xs px-1.5 py-1 border border-zinc-200 rounded bg-white text-zinc-600 outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <button
          onClick={() => onFocus(task)}
          className="p-1 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
          title="Focus mode"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>
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

// ─── Main page ────────────────────────────────────────────────
export default function TasksPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [subtasksMap, setSubtasksMap] = useState<Record<string, Subtask[]>>({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set())
  const [focusTask, setFocusTask] = useState<Task | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!ws) {
        setLoading(false)
        return
      }
      setWorkspace(ws)

      const [{ data: taskData }, { data: projectData }, { data: subtaskData }] = await Promise.all([
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
        supabase
          .from('subtasks')
          .select('*, task:tasks!inner(workspace_id)')
          .eq('task.workspace_id', ws.id),
      ])

      setTasks(taskData ?? [])
      setProjects(projectData ?? [])

      // Group subtasks by task_id
      const grouped: Record<string, Subtask[]> = {}
      if (subtaskData) {
        subtaskData.forEach(st => {
          if (!grouped[st.task_id]) grouped[st.task_id] = []
          grouped[st.task_id].push(st)
        })
      }
      setSubtasksMap(grouped)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
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

  const addSubtask = async (taskId: string, title: string) => {
    if (!workspace) return
    const { data: created } = await supabase
      .from('subtasks')
      .insert({
        task_id: taskId,
        title: title.trim(),
        completed: false,
      })
      .select()
      .single()

    if (created) {
      setSubtasksMap(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] ?? []), created],
      }))
    }
  }

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    await supabase.from('subtasks').update({ completed: !completed }).eq('id', subtaskId)
    setSubtasksMap(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(taskId => {
        updated[taskId] = updated[taskId].map(st =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        )
      })
      return updated
    })
  }

  const deleteSubtask = async (subtaskId: string) => {
    await supabase.from('subtasks').delete().eq('id', subtaskId)
    setSubtasksMap(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(taskId => {
        updated[taskId] = updated[taskId].filter(st => st.id !== subtaskId)
      })
      return updated
    })
  }

  const toggleExpandSubtasks = (taskId: string) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  // Filtered tasks
  const filtered = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    if (projectFilter !== 'all' && t.project_id !== projectFilter) return false
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
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tasks</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {totalActive} active · {overdueCount} overdue · {doneToday} done today
          </p>
        </div>

        {/* View toggle */}
        <div className="flex bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            List
          </button>
          <div className="w-px bg-zinc-200" />
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === 'kanban'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            Kanban
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Status filters */}
        <div className="flex bg-white border border-zinc-200 rounded-xl overflow-hidden p-0.5 gap-0.5">
          {['all', 'today', 'in_progress', 'blocked', 'backlog', 'done'].map((value) => {
            const label = value === 'all' ? 'All' : STATUS_CONFIG[value as TaskStatus]?.label || value
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value as TaskStatus | 'all')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === value
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {label}
              </button>
            )
          })}
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

        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="text-xs border border-zinc-200 bg-white rounded-xl px-3 py-2 text-zinc-600 outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>

        {/* Count */}
        <span className="text-xs text-zinc-400 ml-auto">
          {sorted.length} task{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-px rounded-xl overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-zinc-200 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-dashed border-zinc-200 rounded-xl px-6 py-12 text-center">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-zinc-600 font-medium text-sm">No tasks match this filter</p>
          <p className="text-zinc-400 text-xs mt-1">Try a different filter or add a new task below</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="rounded-xl overflow-hidden border border-zinc-200 mb-4 bg-white">
          {sorted.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              subtaskCount={subtasksMap[task.id]?.length ?? 0}
              expandedSubtasks={expandedSubtasks}
              onToggleExpand={toggleExpandSubtasks}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onStatusChange={updateTaskStatus}
              onAddSubtask={addSubtask}
              onToggleSubtask={toggleSubtask}
              onDeleteSubtask={deleteSubtask}
              onFocus={setFocusTask}
              subtasks={subtasksMap[task.id] ?? []}
            />
          ))}
        </div>
      ) : (
        // Kanban view
        <div className="grid grid-cols-3 gap-4 mb-4">
          {(['todo', 'in-progress', 'done'] as const).map(column => {
            const columnTasks = sorted.filter(t => KANBAN_COLUMNS[column].includes(t.status))
            const columnLabels: Record<typeof column, string> = {
              'todo': 'To Do',
              'in-progress': 'In Progress',
              'done': 'Done',
            }

            return (
              <div key={column} className="flex flex-col">
                <h2 className="text-sm font-semibold text-zinc-700 mb-3">
                  {columnLabels[column]} ({columnTasks.length})
                </h2>
                <div className="flex-1 space-y-3 bg-zinc-50 rounded-xl p-4 min-h-96">
                  {columnTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-zinc-400">No tasks</p>
                    </div>
                  ) : (
                    columnTasks.map(task => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        subtaskCount={subtasksMap[task.id]?.length ?? 0}
                        onStatusChange={updateTaskStatus}
                        onToggle={toggleTask}
                        onDelete={deleteTask}
                        onFocus={setFocusTask}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
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

      {/* Focus Mode */}
      {focusTask && (
        <FocusMode task={focusTask} onClose={() => setFocusTask(null)} />
      )}
    </div>
  )
}
