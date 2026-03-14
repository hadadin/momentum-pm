'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, DailyPlan, Workspace } from '@/types'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'

// ─── helpers ────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function isOverdue(task: Task) {
  if (!task.due_date || task.status === 'done') return false
  return task.due_date < todayISO()
}

// ─── sub-components ─────────────────────────────────────────
function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4 flex flex-col gap-1">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">{label}</span>
    </div>
  )
}

function PriorityDot({ priority }: { priority: Task['priority'] }) {
  return (
    <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_CONFIG[priority].dot}`} />
  )
}

function StatusBadge({ status }: { status: Task['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.textColor}`}>
      {cfg.label}
    </span>
  )
}

function TaskRow({
  task,
  onToggle,
  highlight,
}: {
  task: Task
  onToggle: (id: string, done: boolean) => void
  highlight?: boolean
}) {
  const overdue = isOverdue(task)
  const done = task.status === 'done'

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
        highlight
          ? 'bg-indigo-50 border-indigo-200'
          : 'bg-white border-zinc-200 hover:border-zinc-300'
      } ${done ? 'opacity-50' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id, done)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          done ? 'bg-green-500 border-green-500' : 'border-zinc-300 hover:border-indigo-400'
        }`}
        aria-label={done ? 'Mark incomplete' : 'Mark done'}
      >
        {done && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityDot priority={task.priority} />
          <span className={`text-sm font-medium text-zinc-800 truncate ${done ? 'line-through text-zinc-400' : ''}`}>
            {task.title}
          </span>
          {highlight && (
            <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-medium">⭐ Top 3</span>
          )}
          {overdue && (
            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Overdue</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <StatusBadge status={task.status} />
          {task.project && (
            <span
              className="text-xs text-zinc-500 font-medium"
              style={{ color: task.project.color }}
            >
              {task.project.title}
            </span>
          )}
          {task.due_date && (
            <span className={`text-xs ${overdue ? 'text-red-500' : 'text-zinc-400'}`}>
              {overdue ? '⚠ ' : ''}Due {task.due_date}
            </span>
          )}
          {task.time_estimate_minutes && (
            <span className="text-xs text-zinc-400">{task.time_estimate_minutes}m</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty states ─────────────────────────────────────────────
function EmptyToday() {
  return (
    <div className="bg-white border border-dashed border-zinc-200 rounded-xl px-6 py-10 text-center">
      <div className="text-3xl mb-2">🎯</div>
      <p className="text-zinc-600 font-medium text-sm">No tasks for today yet</p>
      <p className="text-zinc-400 text-xs mt-1">Add a task below or pull from backlog</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────
export default function DashboardPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const today = todayISO()

  // ── fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. workspace
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!ws) { setLoading(false); return }
      setWorkspace(ws)

      // 2. today's tasks (status = today | in_progress | blocked, or scheduled_date = today)
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*, project:projects(title, color)')
        .eq('workspace_id', ws.id)
        .or(`status.in.(today,in_progress,blocked),scheduled_date.eq.${today}`)
        .order('priority', { ascending: true })

      setTasks(taskData ?? [])

      // 3. daily plan for today
      const { data: plan } = await supabase
        .from('daily_plans')
        .select('*')
        .eq('workspace_id', ws.id)
        .eq('date', today)
        .maybeSingle()

      setDailyPlan(plan)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { fetchData() }, [fetchData])

  // ── toggle done ──
  const toggleTask = async (taskId: string, isDone: boolean) => {
    const newStatus = isDone ? 'today' : 'done'
    const updates: Partial<Task> = {
      status: newStatus,
      completed_at: isDone ? undefined : new Date().toISOString(),
    }
    await supabase.from('tasks').update(updates).eq('id', taskId)
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, ...updates } : t)
    )
  }

  // ── add task ──
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !workspace) return
    setAddingTask(true)
    const { data } = await supabase
      .from('tasks')
      .insert({
        workspace_id: workspace.id,
        title: newTaskTitle.trim(),
        status: 'today',
        priority: 'medium',
        source: 'manual',
        scheduled_date: today,
      })
      .select('*, project:projects(title, color)')
      .single()

    if (data) {
      setTasks(prev => [data, ...prev])
      setNewTaskTitle('')
    }
    setAddingTask(false)
  }

  // ── derived ──
  const top3Ids = new Set(dailyPlan?.top_3 ?? [])
  const doneTasks = tasks.filter(t => t.status === 'done')
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const blockedCount = tasks.filter(t => t.status === 'blocked').length
  const overdueCount = tasks.filter(t => isOverdue(t)).length
  const top3Tasks = activeTasks.filter(t => top3Ids.has(t.id))
  const otherTasks = activeTasks.filter(t => !top3Ids.has(t.id))

  // ── render ──
  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-zinc-400 text-sm font-medium">{formatDate(new Date())}</p>
        <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">
          {greeting()}, Noam 👋
        </h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 bg-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            <StatCard value={activeTasks.length} label="Active today" color="text-indigo-600" />
            <StatCard value={doneTasks.length}   label="Done today"   color="text-green-600" />
            <StatCard value={blockedCount}        label="Blocked"      color="text-red-500" />
            <StatCard value={overdueCount}        label="Overdue"      color="text-orange-500" />
          </div>

          {/* Top 3 */}
          {top3Tasks.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                ⭐ Top 3 Today
              </h2>
              <div className="space-y-2">
                {top3Tasks.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} highlight />
                ))}
              </div>
            </section>
          )}

          {/* Active tasks */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                Today&apos;s Tasks
              </h2>
              <span className="text-xs text-zinc-400">{activeTasks.length} active</span>
            </div>

            {activeTasks.length === 0 ? (
              <EmptyToday />
            ) : (
              <div className="space-y-2">
                {otherTasks.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </div>
            )}
          </section>

          {/* Done tasks (collapsed) */}
          {doneTasks.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
                ✅ Done ({doneTasks.length})
              </h2>
              <div className="space-y-2">
                {doneTasks.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} />
                ))}
              </div>
            </section>
          )}

          {/* Quick add */}
          <form onSubmit={addTask} className="flex gap-2">
            <input
              type="text"
              placeholder="+ Add a task for today..."
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim() || addingTask}
              className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {addingTask ? '...' : 'Add'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
