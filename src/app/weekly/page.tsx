'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { WeeklyReview, Workspace } from '@/types'

function getWeekStart(d: Date = new Date()): string {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

export default function WeeklyPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [reviews, setReviews] = useState<WeeklyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [editingReview, setEditingReview] = useState<WeeklyReview | null>(null)

  // current week stats
  const [weekStats, setWeekStats] = useState<{
    completed: number; total: number; byProject: Record<string, { name: string; count: number }>
  }>({ completed: 0, total: 0, byProject: {} })

  // form
  const [goalsSet, setGoalsSet] = useState<string[]>([''])
  const [goalsAchieved, setGoalsAchieved] = useState<string[]>([])
  const [keyLearnings, setKeyLearnings] = useState<string[]>([''])
  const [nextWeekFocus, setNextWeekFocus] = useState<string[]>([''])

  const weekStart = getWeekStart()

  const fetchData = useCallback(async () => {
    try {
      const { data: ws } = await supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single()
      if (!ws) { setLoading(false); return }
      setWorkspace(ws)

      const [{ data: revs }, { data: tasks }, { data: projects }] = await Promise.all([
        supabase.from('weekly_reviews').select('*').eq('workspace_id', ws.id).order('week_start', { ascending: false }),
        supabase.from('tasks').select('id, status, project_id, completed_at').eq('workspace_id', ws.id)
          .gte('created_at', weekStart + 'T00:00:00'),
        supabase.from('projects').select('id, title').eq('workspace_id', ws.id),
      ])

      setReviews(revs ?? [])

      // compute this week stats
      const allTasks = tasks ?? []
      const completed = allTasks.filter(t => t.status === 'done').length
      const byProject: Record<string, { name: string; count: number }> = {}
      for (const t of allTasks) {
        if (t.project_id) {
          const proj = (projects ?? []).find(p => p.id === t.project_id)
          if (proj) {
            if (!byProject[proj.id]) byProject[proj.id] = { name: proj.title, count: 0 }
            byProject[proj.id].count++
          }
        }
      }
      setWeekStats({ completed, total: allTasks.length, byProject })

      // load existing review for this week
      const existing = (revs ?? []).find(r => r.week_start === weekStart)
      if (existing) {
        setEditingReview(existing)
        setGoalsSet(existing.goals_set?.length ? existing.goals_set : [''])
        setGoalsAchieved(existing.goals_achieved ?? [])
        setKeyLearnings(existing.key_learnings?.length ? existing.key_learnings : [''])
        setNextWeekFocus(existing.next_week_focus?.length ? existing.next_week_focus : [''])
      }
    } finally { setLoading(false) }
  }, [weekStart])

  useEffect(() => { fetchData() }, [fetchData])

  const updateList = (setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number, value: string) => {
    setter(prev => prev.map((item, i) => i === idx ? value : item))
  }
  const addToList = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => [...prev, ''])
  }

  const saveReview = async () => {
    if (!workspace) return
    const payload = {
      workspace_id: workspace.id, week_start: weekStart,
      goals_set: goalsSet.filter(Boolean), goals_achieved: goalsAchieved.filter(Boolean),
      tasks_completed: weekStats.completed, tasks_planned: weekStats.total,
      estimation_accuracy: weekStats.total > 0 ? Math.round((weekStats.completed / weekStats.total) * 100) : null,
      key_learnings: keyLearnings.filter(Boolean),
      next_week_focus: nextWeekFocus.filter(Boolean),
      time_by_project: Object.fromEntries(Object.entries(weekStats.byProject).map(([k, v]) => [v.name, v.count])),
    }
    if (editingReview) {
      const { data } = await supabase.from('weekly_reviews').update(payload).eq('id', editingReview.id).select().single()
      if (data) {
        setReviews(prev => prev.map(r => r.id === editingReview.id ? data : r))
        setEditingReview(data)
      }
    } else {
      const { data } = await supabase.from('weekly_reviews').insert(payload).select().single()
      if (data) {
        setReviews(prev => [data, ...prev])
        setEditingReview(data)
      }
    }
  }

  if (loading) return <div className="p-10 text-gray-400">Loading weekly review...</div>

  const accuracy = weekStats.total > 0 ? Math.round((weekStats.completed / weekStats.total) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Weekly Review</h1>
        <p className="text-gray-500 text-sm mt-1">Week of {weekStart}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-3xl font-bold text-indigo-600">{weekStats.completed}</div>
          <div className="text-xs text-gray-500 mt-1">Tasks completed</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-3xl font-bold text-gray-900">{weekStats.total}</div>
          <div className="text-xs text-gray-500 mt-1">Total tasks</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className={`text-3xl font-bold ${accuracy >= 70 ? 'text-green-600' : accuracy >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
            {accuracy}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Completion rate</div>
        </div>
      </div>

      {/* Time by project */}
      {Object.keys(weekStats.byProject).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tasks by Project</h3>
          <div className="space-y-2">
            {Object.values(weekStats.byProject).sort((a, b) => b.count - a.count).map(bp => (
              <div key={bp.name} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-40 truncate">{bp.name}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(bp.count / weekStats.total) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{bp.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">Goals for this week</label>
          {goalsSet.map((g, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={g} onChange={e => updateList(setGoalsSet, i, e.target.value)} placeholder="What did you set out to do?"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="button" onClick={() => {
                const v = goalsSet[i]
                if (v && !goalsAchieved.includes(v)) setGoalsAchieved(prev => [...prev, v])
                else setGoalsAchieved(prev => prev.filter(a => a !== v))
              }} className={`text-xs px-2 py-1 rounded ${goalsAchieved.includes(g) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {goalsAchieved.includes(g) ? '✓ Achieved' : 'Mark done'}
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addToList(setGoalsSet)} className="text-xs text-indigo-600 hover:underline">+ Add goal</button>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">Key Learnings</label>
          {keyLearnings.map((l, i) => (
            <input key={i} value={l} onChange={e => updateList(setKeyLearnings, i, e.target.value)}
              placeholder="What did you learn?" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          ))}
          <button type="button" onClick={() => addToList(setKeyLearnings)} className="text-xs text-indigo-600 hover:underline">+ Add learning</button>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">Next Week Focus</label>
          {nextWeekFocus.map((f, i) => (
            <input key={i} value={f} onChange={e => updateList(setNextWeekFocus, i, e.target.value)}
              placeholder="What will you focus on next week?" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          ))}
          <button type="button" onClick={() => addToList(setNextWeekFocus)} className="text-xs text-indigo-600 hover:underline">+ Add focus area</button>
        </div>

        <button onClick={saveReview}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          {editingReview ? 'Update' : 'Save'} Review
        </button>
      </div>

      {/* Past reviews */}
      {reviews.filter(r => r.week_start !== weekStart).length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Past Reviews</h2>
          <div className="space-y-3">
            {reviews.filter(r => r.week_start !== weekStart).map(r => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">Week of {r.week_start}</span>
                  <span className="text-xs text-gray-400">
                    {r.tasks_completed ?? 0}/{r.tasks_planned ?? 0} tasks
                    {r.estimation_accuracy != null && ` · ${r.estimation_accuracy}%`}
                  </span>
                </div>
                {r.goals_achieved && r.goals_achieved.length > 0 && (
                  <div className="text-xs text-green-600 mb-1">Achieved: {r.goals_achieved.join(', ')}</div>
                )}
                {r.key_learnings && r.key_learnings.length > 0 && (
                  <div className="text-xs text-gray-500">Learnings: {r.key_learnings.join(' · ')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
