'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Meeting, Workspace, Project } from '@/types'

type MeetingStatus = 'pending' | 'processed' | 'tasks_created'

interface MeetingWithStatus extends Meeting {
  status?: MeetingStatus
  project_id?: string
}

const STATUS_CONFIG: Record<MeetingStatus, { label: string; bg: string; text: string }> = {
  pending:      { label: 'Pending',        bg: 'bg-gray-100',   text: 'text-gray-700' },
  processed:    { label: 'Processed',      bg: 'bg-blue-100',   text: 'text-blue-700' },
  tasks_created: { label: 'Tasks Created', bg: 'bg-green-100',  text: 'text-green-700' },
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function groupMeetings(meetings: MeetingWithStatus[]): Record<string, MeetingWithStatus[]> {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const weekStart = getWeekStart(now)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const monthStart = getMonthStart(now)
  const monthStartStr = monthStart.toISOString().split('T')[0]

  const groups: Record<string, MeetingWithStatus[]> = {
    'This Week': [],
    'This Month': [],
    'Older': [],
  }

  meetings.forEach(m => {
    const meetingDate = m.date ? m.date : ''
    if (meetingDate >= weekStartStr) {
      groups['This Week'].push(m)
    } else if (meetingDate >= monthStartStr) {
      groups['This Month'].push(m)
    } else {
      groups['Older'].push(m)
    }
  })

  return groups
}

export default function MeetingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [meetings, setMeetings] = useState<MeetingWithStatus[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creatingTasksId, setCreatingTasksId] = useState<string | null>(null)

  // form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [projectId, setProjectId] = useState<string>('')
  const [attendees, setAttendees] = useState('')
  const [rawNotes, setRawNotes] = useState('')
  const [summary, setSummary] = useState('')
  const [actionItems, setActionItems] = useState<Array<{ description: string; owner: string; due_date?: string; task_id?: string }>>([])

  const fetchData = useCallback(async () => {
    try {
      const [wsRes, meetingsRes, projectsRes] = await Promise.all([
        supabase.from('workspaces').select('*').eq('is_active', true).limit(1).single(),
        supabase.from('meetings').select('*').order('date', { ascending: false }),
        supabase.from('projects').select('*'),
      ])

      const ws = wsRes.data
      if (!ws) {
        setLoading(false)
        return
      }

      setWorkspace(ws)
      setMeetings((meetingsRes.data ?? []).filter(m => m.workspace_id === ws.id))
      setProjects((projectsRes.data ?? []).filter(p => p.workspace_id === ws.id))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const resetForm = () => {
    setTitle('')
    setDate(new Date().toISOString().split('T')[0])
    setProjectId('')
    setAttendees('')
    setRawNotes('')
    setSummary('')
    setActionItems([])
    setShowForm(false)
    setEditingId(null)
  }

  const startEdit = (m: MeetingWithStatus) => {
    setTitle(m.title)
    setDate(m.date ?? new Date().toISOString().split('T')[0])
    setProjectId(m.project_id ?? '')
    setAttendees((m.attendees ?? []).join(', '))
    setRawNotes(m.raw_notes ?? '')
    setSummary(m.summary ?? '')
    setActionItems(m.action_items ?? [])
    setEditingId(m.id)
    setShowForm(true)
  }

  const saveMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !workspace) return

    const payload = {
      workspace_id: workspace.id,
      title: title.trim(),
      date,
      project_id: projectId || null,
      attendees: attendees
        .split(',')
        .map(a => a.trim())
        .filter(Boolean),
      raw_notes: rawNotes.trim() || null,
      summary: summary.trim() || null,
      action_items: actionItems.length > 0 ? actionItems : null,
      status: 'pending' as MeetingStatus,
    }

    if (editingId) {
      const { data } = await supabase
        .from('meetings')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single()
      if (data) {
        setMeetings(prev =>
          prev.map(m => (m.id === editingId ? { ...data, status: (data.status as MeetingStatus) || 'pending' } : m))
        )
      }
    } else {
      const { data } = await supabase
        .from('meetings')
        .insert(payload)
        .select()
        .single()
      if (data) {
        setMeetings(prev => [{ ...data, status: (data.status as MeetingStatus) || 'pending' }, ...prev])
      }
    }
    resetForm()
  }

  const deleteMeeting = async (id: string) => {
    await supabase.from('meetings').delete().eq('id', id)
    setMeetings(prev => prev.filter(m => m.id !== id))
  }

  const createTasksFromActionItems = async (meetingId: string, items: Array<{ description: string; owner: string; due_date?: string }>) => {
    if (!workspace) return
    setCreatingTasksId(meetingId)

    try {
      const tasks = items
        .filter(item => item.description.trim())
        .map(item => ({
          workspace_id: workspace.id,
          title: item.description.trim(),
          description: `From meeting: ${title}`,
          status: 'backlog' as const,
          priority: 'medium' as const,
          source: 'meeting' as const,
          due_date: item.due_date || null,
          tags: [item.owner].filter(Boolean),
          time_actual_minutes: 0,
          is_recurring: false,
        }))

      if (tasks.length > 0) {
        const { data: createdTasks } = await supabase
          .from('tasks')
          .insert(tasks)
          .select()

        if (createdTasks && createdTasks.length > 0) {
          const updatedActionItems = items.map((item, idx) => ({
            ...item,
            task_id: createdTasks[idx]?.id,
          }))

          const meetingPayload = {
            action_items: updatedActionItems,
            status: 'tasks_created' as MeetingStatus,
          }

          const { data: updatedMeeting } = await supabase
            .from('meetings')
            .update(meetingPayload)
            .eq('id', meetingId)
            .select()
            .single()

          if (updatedMeeting) {
            setMeetings(prev =>
              prev.map(m =>
                m.id === meetingId
                  ? { ...updatedMeeting, status: (updatedMeeting.status as MeetingStatus) || 'tasks_created' }
                  : m
              )
            )
          }
        }
      }
    } finally {
      setCreatingTasksId(null)
    }
  }

  const addActionItem = () => {
    setActionItems(prev => [...prev, { description: '', owner: '' }])
  }

  const updateActionItem = (idx: number, field: string, value: string) => {
    setActionItems(prev => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  const removeActionItem = (idx: number) => {
    setActionItems(prev => prev.filter((_, i) => i !== idx))
  }

  if (loading) return <div className="p-10 text-zinc-400">Loading meetings...</div>

  const groupedMeetings = groupMeetings(meetings)
  const hasAnyMeetings = Object.values(groupedMeetings).some(group => group.length > 0)

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Meetings</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + New Meeting
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveMeeting} className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Meeting title"
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a project (optional)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Attendees (comma-separated)
            </label>
            <input
              value={attendees}
              onChange={e => setAttendees(e.target.value)}
              placeholder="Alice, Bob, Charlie"
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Notes</label>
            <textarea
              value={rawNotes}
              onChange={e => setRawNotes(e.target.value)}
              rows={4}
              placeholder="Raw meeting notes..."
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Summary</label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={2}
              placeholder="Key takeaways..."
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-500">Action Items</label>
              <button
                type="button"
                onClick={addActionItem}
                className="text-xs text-indigo-600 hover:underline"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {actionItems.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={item.description}
                    onChange={e => updateActionItem(i, 'description', e.target.value)}
                    placeholder="Action item"
                    className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                  />
                  <input
                    value={item.owner}
                    onChange={e => updateActionItem(i, 'owner', e.target.value)}
                    placeholder="Owner"
                    className="w-32 px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={item.due_date ?? ''}
                    onChange={e => updateActionItem(i, 'due_date', e.target.value)}
                    className="w-36 px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeActionItem(i)}
                    className="text-red-400 hover:text-red-600 text-sm px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {editingId ? 'Update' : 'Save'} Meeting
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-zinc-500 text-sm hover:text-zinc-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Grouped Meetings */}
      {hasAnyMeetings ? (
        <div className="space-y-6">
          {Object.entries(groupedMeetings).map(([groupName, groupMeetings]) => {
            if (groupMeetings.length === 0) return null

            return (
              <div key={groupName}>
                <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  {groupName}
                </h2>
                <div className="space-y-3">
                  {groupMeetings.map(m => {
                    const expanded = expandedId === m.id
                    const aiCount = (m.action_items ?? []).length
                    const linkedProject = projects.find(p => p.id === m.project_id)
                    const status = m.status as MeetingStatus || 'pending'

                    return (
                      <div
                        key={m.id}
                        className="bg-white border border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-300 transition-colors"
                      >
                        <button
                          onClick={() => setExpandedId(expanded ? null : m.id)}
                          className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-zinc-900">{m.title}</div>
                            <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{m.date}</span>
                              {m.attendees && m.attendees.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span>{m.attendees.join(', ')}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Status Badge */}
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].text}`}
                            >
                              {STATUS_CONFIG[status].label}
                            </span>

                            {/* Project Badge */}
                            {linkedProject && (
                              <span
                                className="text-xs px-2 py-1 rounded-full font-medium bg-zinc-100 text-zinc-700"
                              >
                                {linkedProject.title}
                              </span>
                            )}

                            {/* Action Items Badge */}
                            {aiCount > 0 && (
                              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                                {aiCount} action{aiCount !== 1 ? 's' : ''}
                              </span>
                            )}

                            <span className="text-zinc-300 text-sm ml-1">
                              {expanded ? '▲' : '▼'}
                            </span>
                          </div>
                        </button>

                        {expanded && (
                          <div className="px-5 pb-4 border-t border-zinc-100 pt-4 space-y-4 text-sm">
                            {m.summary && (
                              <div>
                                <span className="text-zinc-400 text-xs block mb-1 font-medium">
                                  Summary
                                </span>
                                <p className="text-zinc-700">{m.summary}</p>
                              </div>
                            )}

                            {m.raw_notes && (
                              <div>
                                <span className="text-zinc-400 text-xs block mb-1 font-medium">
                                  Notes
                                </span>
                                <pre className="text-zinc-600 text-xs bg-zinc-50 rounded-lg p-3 whitespace-pre-wrap font-mono overflow-x-auto">
                                  {m.raw_notes}
                                </pre>
                              </div>
                            )}

                            {m.action_items && m.action_items.length > 0 && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-zinc-400 text-xs font-medium">
                                    Action Items ({m.action_items.length})
                                  </span>
                                  {status !== 'tasks_created' && (
                                    <button
                                      onClick={() =>
                                        createTasksFromActionItems(
                                          m.id,
                                          m.action_items ?? []
                                        )
                                      }
                                      disabled={creatingTasksId === m.id}
                                      className="text-xs text-indigo-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                    >
                                      {creatingTasksId === m.id ? 'Creating...' : 'Create Tasks'}
                                    </button>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {m.action_items.map((ai, i) => (
                                    <div
                                      key={i}
                                      className="flex items-start gap-2 text-xs bg-amber-50 rounded-lg px-3 py-2"
                                    >
                                      <div className="flex-1">
                                        <div className="text-zinc-700 font-medium">
                                          {ai.description}
                                        </div>
                                        <div className="text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                          <span>Owner: {ai.owner}</span>
                                          {ai.due_date && (
                                            <>
                                              <span>·</span>
                                              <span>Due: {ai.due_date}</span>
                                            </>
                                          )}
                                          {ai.task_id && (
                                            <>
                                              <span>·</span>
                                              <span className="text-green-600 font-medium">
                                                ✓ Task created
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-3 pt-2 border-t border-zinc-100">
                              <button
                                onClick={() => startEdit(m)}
                                className="text-xs text-indigo-600 hover:underline font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteMeeting(m.id)}
                                className="text-xs text-red-500 hover:underline font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-16 text-zinc-400">
            <p className="text-lg mb-1">No meetings recorded</p>
            <p className="text-sm">
              Start capturing meeting notes and action items
            </p>
          </div>
        )
      )}
    </div>
  )
}
